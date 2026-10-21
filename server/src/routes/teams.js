const express = require('express');
const pool = require('../db/pool');
const validate = require('../middleware/validate');
const schemas = require('../validators/schemas');
const { requireTeamMember, requireTeamOwner } = require('../middleware/teamAccess');
const { sendInviteEmail } = require('../services/invites');

const router = express.Router();

// A team as seen by one user: includes their role plus member / open-task counts.
const TEAM_SUMMARY_SQL = `
  SELECT t.id, t.name, t.description,
         t.created_by AS "createdBy", t.created_at AS "createdAt", m.role,
         (SELECT COUNT(*)::int FROM team_members WHERE team_id = t.id) AS "memberCount",
         (SELECT COUNT(*)::int FROM tasks WHERE team_id = t.id AND status <> 'done') AS "openTaskCount"
  FROM teams t
  JOIN team_members m ON m.team_id = t.id AND m.user_id = $1`;

async function fetchTeam(teamId, userId) {
  const { rows } = await pool.query(`${TEAM_SUMMARY_SQL} WHERE t.id = $2`, [userId, teamId]);
  return rows[0] || null;
}

// GET /api/teams - every team the current user belongs to
router.get('/', async (req, res) => {
  const { rows } = await pool.query(`${TEAM_SUMMARY_SQL} ORDER BY t.created_at DESC`, [req.user.id]);
  res.json({ teams: rows });
});

// POST /api/teams - the creator becomes the team owner
router.post('/', validate(schemas.createTeam), async (req, res) => {
  const { name, description } = req.valid.body;
  const client = await pool.connect();
  let teamId;
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'INSERT INTO teams (name, description, created_by) VALUES ($1, $2, $3) RETURNING id',
      [name, description, req.user.id]
    );
    teamId = rows[0].id;
    await client.query(
      "INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, 'owner')",
      [teamId, req.user.id]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  res.status(201).json({ team: await fetchTeam(teamId, req.user.id) });
});

// GET /api/teams/:id - team details with members (and pending invites for the owner)
router.get('/:id', validate(schemas.idParam, 'params'), requireTeamMember, async (req, res) => {
  const teamId = req.valid.params.id;
  const team = await fetchTeam(teamId, req.user.id);

  const { rows: members } = await pool.query(
    `SELECT u.id, u.name, u.email, m.role, m.joined_at AS "joinedAt"
     FROM team_members m JOIN users u ON u.id = m.user_id
     WHERE m.team_id = $1
     ORDER BY (m.role = 'owner') DESC, u.name`,
    [teamId]
  );

  let invites = [];
  if (req.teamRole === 'owner') {
    const result = await pool.query(
      'SELECT id, email, created_at AS "createdAt" FROM team_invites WHERE team_id = $1 ORDER BY created_at DESC',
      [teamId]
    );
    invites = result.rows;
  }
  res.json({ team, members, invites });
});

// PUT /api/teams/:id - owner only
router.put(
  '/:id',
  validate(schemas.idParam, 'params'),
  requireTeamOwner,
  validate(schemas.updateTeam),
  async (req, res) => {
    const { name, description } = req.valid.body;
    await pool.query(
      'UPDATE teams SET name = COALESCE($1, name), description = COALESCE($2, description) WHERE id = $3',
      [name, description, req.valid.params.id]
    );
    res.json({ team: await fetchTeam(req.valid.params.id, req.user.id) });
  }
);

// DELETE /api/teams/:id - owner only (cascades to members and tasks)
router.delete('/:id', validate(schemas.idParam, 'params'), requireTeamOwner, async (req, res) => {
  await pool.query('DELETE FROM teams WHERE id = $1', [req.valid.params.id]);
  res.status(204).end();
});

// POST /api/teams/:id/members - owner adds an already-registered user by email
router.post(
  '/:id/members',
  validate(schemas.idParam, 'params'),
  requireTeamOwner,
  validate(schemas.emailBody),
  async (req, res) => {
    const teamId = req.valid.params.id;
    const { rows } = await pool.query('SELECT id, name, email FROM users WHERE email = $1', [
      req.valid.body.email,
    ]);
    const user = rows[0];
    if (!user) {
      return res
        .status(404)
        .json({ error: 'No user is registered with that email. Send them an invite instead.' });
    }

    const result = await pool.query(
      `INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, 'member')
       ON CONFLICT DO NOTHING`,
      [teamId, user.id]
    );
    if (result.rowCount === 0) {
      return res.status(409).json({ error: 'That user is already in the team' });
    }
    res.status(201).json({ member: { ...user, role: 'member' } });
  }
);

// DELETE /api/teams/:id/members/:userId - owner removes anyone; members can remove themselves
router.delete(
  '/:id/members/:userId',
  validate(schemas.memberParams, 'params'),
  requireTeamMember,
  async (req, res) => {
    const { id: teamId, userId } = req.valid.params;
    const isSelf = userId === req.user.id;

    if (!isSelf && req.teamRole !== 'owner') {
      return res.status(403).json({ error: 'Only the team owner can remove other members' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2 FOR UPDATE',
        [teamId, userId]
      );
      if (!rows[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Member not found' });
      }
      if (rows[0].role === 'owner') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'The owner cannot leave. Delete the team instead.' });
      }
      await client.query('DELETE FROM team_members WHERE team_id = $1 AND user_id = $2', [
        teamId,
        userId,
      ]);
      // Their open tasks become unassigned rather than pointing at a non-member.
      await client.query('UPDATE tasks SET assignee_id = NULL WHERE team_id = $1 AND assignee_id = $2', [
        teamId,
        userId,
      ]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    return res.status(204).end();
  }
);

// POST /api/teams/:id/invites - owner invites by email (email delivery is stubbed)
router.post(
  '/:id/invites',
  validate(schemas.idParam, 'params'),
  requireTeamOwner,
  validate(schemas.emailBody),
  async (req, res) => {
    const teamId = req.valid.params.id;
    const { email } = req.valid.body;

    const { rows: existing } = await pool.query('SELECT id, name, email FROM users WHERE email = $1', [email]);
    if (existing[0]) {
      // Already registered: no need to wait for them, add them straight away.
      const result = await pool.query(
        `INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, 'member')
         ON CONFLICT DO NOTHING`,
        [teamId, existing[0].id]
      );
      if (result.rowCount === 0) {
        return res.status(409).json({ error: 'That user is already in the team' });
      }
      return res.status(201).json({ status: 'added', member: { ...existing[0], role: 'member' } });
    }

    const { rows } = await pool.query(
      `INSERT INTO team_invites (team_id, email, invited_by) VALUES ($1, $2, $3)
       ON CONFLICT (team_id, email) DO UPDATE SET invited_by = EXCLUDED.invited_by
       RETURNING id, email, created_at AS "createdAt"`,
      [teamId, email, req.user.id]
    );
    const team = await fetchTeam(teamId, req.user.id);
    const delivery = await sendInviteEmail({ to: email, teamName: team.name, invitedBy: req.user.name });
    return res.status(201).json({ status: 'invited', invite: rows[0], delivery });
  }
);

// DELETE /api/teams/:id/invites/:inviteId - owner revokes a pending invite
router.delete(
  '/:id/invites/:inviteId',
  validate(schemas.inviteParams, 'params'),
  requireTeamOwner,
  async (req, res) => {
    const { id: teamId, inviteId } = req.valid.params;
    const result = await pool.query('DELETE FROM team_invites WHERE id = $1 AND team_id = $2', [
      inviteId,
      teamId,
    ]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Invite not found' });
    return res.status(204).end();
  }
);

module.exports = router;

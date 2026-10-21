const pool = require('../db/pool');

/** Returns 'owner', 'member', or null for the given team/user pair. */
async function getRole(teamId, userId) {
  const { rows } = await pool.query(
    'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
    [teamId, userId]
  );
  return rows[0] ? rows[0].role : null;
}

/**
 * Requires the current user to belong to the team in `req.valid.params.id`.
 * Sets `req.teamRole`. Non-members get 404 so team ids cannot be probed.
 */
async function requireTeamMember(req, res, next) {
  const role = await getRole(req.valid.params.id, req.user.id);
  if (!role) return res.status(404).json({ error: 'Team not found' });
  req.teamRole = role;
  return next();
}

/** Same as requireTeamMember, but only the team owner may continue. */
async function requireTeamOwner(req, res, next) {
  const role = await getRole(req.valid.params.id, req.user.id);
  if (!role) return res.status(404).json({ error: 'Team not found' });
  if (role !== 'owner') {
    return res.status(403).json({ error: 'Only the team owner can do this' });
  }
  req.teamRole = role;
  return next();
}

module.exports = { getRole, requireTeamMember, requireTeamOwner };

const config = require('../config/env');

/**
 * STUB: pretends to send an invitation email. A real implementation would call
 * an email provider (SendGrid, SES, ...) here. Nothing leaves the server.
 */
async function sendInviteEmail({ to, teamName, invitedBy }) {
  if (!config.isTest) {
    console.log(`[invite:stub] To: ${to} - ${invitedBy} invited you to join "${teamName}"`);
  }
  return { delivered: false, stubbed: true };
}

/**
 * When someone registers, joins every team that had invited their email address.
 * Runs inside the caller's transaction. Returns the number of teams joined.
 */
async function acceptPendingInvites(client, user) {
  const { rowCount } = await client.query(
    `INSERT INTO team_members (team_id, user_id, role)
     SELECT team_id, $1, 'member' FROM team_invites WHERE email = $2
     ON CONFLICT DO NOTHING`,
    [user.id, user.email]
  );
  await client.query('DELETE FROM team_invites WHERE email = $1', [user.email]);
  return rowCount;
}

module.exports = { sendInviteEmail, acceptPendingInvites };

/**
 * Integration tests: they run the real Express app against a real PostgreSQL database.
 *
 *   NODE_ENV=test DATABASE_URL=postgres://.../taskmanager_test npm test
 *
 * WARNING: all tables are emptied before the run - never point this at real data.
 */
process.env.NODE_ENV = 'test';
process.env.BCRYPT_ROUNDS = '4'; // fast hashing for tests
process.env.AUTO_MIGRATE = 'false';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const pool = require('../src/db/pool');
const migrate = require('../src/db/migrate');
const createApp = require('../src/app');

let server;
let baseUrl;

/** Minimal HTTP client that keeps cookies, like a browser would. */
class Client {
  constructor() {
    this.cookie = '';
  }

  async request(method, path, body) {
    const res = await fetch(baseUrl + path, {
      method,
      headers: { 'content-type': 'application/json', cookie: this.cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookie = res.headers.getSetCookie();
    if (setCookie.length) this.cookie = setCookie.map((c) => c.split(';')[0]).join('; ');
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null, setCookie };
  }

  get = (path) => this.request('GET', path);
  post = (path, body) => this.request('POST', path, body ?? {});
  put = (path, body) => this.request('PUT', path, body);
  del = (path) => this.request('DELETE', path);
}

const isoDate = (offsetDays) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

async function registerUser(name, email) {
  const client = new Client();
  const res = await client.post('/api/auth/register', { name, email, password: 'Passw0rd!' });
  assert.equal(res.status, 201);
  return { client, user: res.body.user };
}

before(async () => {
  await migrate();
  await pool.query('TRUNCATE users, teams, team_members, tasks, team_invites, user_sessions RESTART IDENTITY CASCADE');
  server = createApp().listen(0);
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

test('health check is public', async () => {
  const res = await new Client().get('/api/health');
  assert.equal(res.status, 200);
});

test('protected routes reject anonymous requests', async () => {
  const anon = new Client();
  assert.equal((await anon.get('/api/teams')).status, 401);
  assert.equal((await anon.get('/api/tasks')).status, 401);
  assert.equal((await anon.post('/api/tasks', { title: 'x' })).status, 401);
  assert.equal((await anon.get('/api/auth/me')).status, 401);
});

test('registration validates input and rejects duplicates', async () => {
  const c = new Client();
  const weak = await c.post('/api/auth/register', { name: 'Al', email: 'al@example.com', password: 'short' });
  assert.equal(weak.status, 400);
  assert.ok(weak.body.details.some((d) => d.field === 'password'));

  const badEmail = await c.post('/api/auth/register', { name: 'Al', email: 'nope', password: 'Passw0rd!' });
  assert.equal(badEmail.status, 400);

  const ok = await c.post('/api/auth/register', { name: 'Alice', email: 'Alice@Example.com', password: 'Passw0rd!' });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.user.email, 'alice@example.com'); // normalised
  assert.equal(ok.body.user.password_hash, undefined);
  assert.match(ok.setCookie[0], /HttpOnly/i);

  const dup = await new Client().post('/api/auth/register', { name: 'Alice 2', email: 'alice@example.com', password: 'Passw0rd!' });
  assert.equal(dup.status, 409);
});

test('passwords are stored as bcrypt hashes', async () => {
  const { rows } = await pool.query("SELECT password_hash FROM users WHERE email = 'alice@example.com'");
  assert.match(rows[0].password_hash, /^\$2[aby]\$/);
  assert.ok(!rows[0].password_hash.includes('Passw0rd!'));
});

test('login, session restore and logout', async () => {
  const c = new Client();
  assert.equal((await c.post('/api/auth/login', { email: 'alice@example.com', password: 'wrong-pass1' })).status, 401);
  assert.equal((await c.post('/api/auth/login', { email: 'nobody@example.com', password: 'Passw0rd!' })).status, 401);

  const login = await c.post('/api/auth/login', { email: 'ALICE@example.com', password: 'Passw0rd!' });
  assert.equal(login.status, 200);
  assert.match(login.setCookie[0], /HttpOnly/i);

  assert.equal((await c.get('/api/auth/me')).body.user.name, 'Alice');
  assert.equal((await c.post('/api/auth/logout')).status, 204);
  assert.equal((await c.get('/api/auth/me')).status, 401);
  assert.equal((await c.get('/api/teams')).status, 401);
});

test('teams: creation, membership and owner-only actions', async () => {
  const alice = (await new Client().post('/api/auth/login', {})).status; // sanity: validation error, no crash
  assert.equal(alice, 400);

  const { client: owner } = await registerUser('Olivia Owner', 'olivia@example.com');
  const { client: member, user: memberUser } = await registerUser('Mark Member', 'mark@example.com');
  const { client: outsider } = await registerUser('Oscar Outsider', 'oscar@example.com');

  const created = await owner.post('/api/teams', { name: 'Platform', description: 'Infra team' });
  assert.equal(created.status, 201);
  assert.equal(created.body.team.role, 'owner');
  const teamId = created.body.team.id;

  // Only the owner can add members
  assert.equal((await member.post(`/api/teams/${teamId}/members`, { email: 'oscar@example.com' })).status, 404); // not in team yet
  assert.equal((await owner.post(`/api/teams/${teamId}/members`, { email: 'nobody@example.com' })).status, 404);
  assert.equal((await owner.post(`/api/teams/${teamId}/members`, { email: 'mark@example.com' })).status, 201);
  assert.equal((await owner.post(`/api/teams/${teamId}/members`, { email: 'mark@example.com' })).status, 409);

  // Members see the team; outsiders do not
  assert.equal((await member.get('/api/teams')).body.teams.length, 1);
  assert.equal((await outsider.get('/api/teams')).body.teams.length, 0);
  assert.equal((await outsider.get(`/api/teams/${teamId}`)).status, 404);

  const detail = await member.get(`/api/teams/${teamId}`);
  assert.equal(detail.body.members.length, 2);
  assert.deepEqual(detail.body.invites, []); // invites are only shown to the owner

  // Role-based access: members cannot edit/delete the team or remove others
  assert.equal((await member.put(`/api/teams/${teamId}`, { name: 'Hacked' })).status, 403);
  assert.equal((await member.del(`/api/teams/${teamId}`)).status, 403);
  assert.equal((await owner.put(`/api/teams/${teamId}`, { name: 'Platform Team' })).body.team.name, 'Platform Team');

  // The owner cannot be removed; a member can leave
  const ownerId = created.body.team.createdBy;
  assert.equal((await owner.del(`/api/teams/${teamId}/members/${ownerId}`)).status, 400);
  assert.equal((await member.del(`/api/teams/${teamId}/members/${memberUser.id}`)).status, 204);
  assert.equal((await member.get(`/api/teams/${teamId}`)).status, 404);

  // Owner can delete the team
  assert.equal((await owner.del(`/api/teams/${teamId}`)).status, 204);
  assert.equal((await owner.get(`/api/teams/${teamId}`)).status, 404);
});

test('tasks: CRUD, assignment rules, filters and permissions', async () => {
  const { client: owner, user: ownerUser } = await registerUser('Tess Owner', 'tess@example.com');
  const { client: member, user: memberUser } = await registerUser('Tom Member', 'tom@example.com');
  const { client: outsider } = await registerUser('Olga Outsider', 'olga@example.com');

  const teamA = (await owner.post('/api/teams', { name: 'Alpha' })).body.team.id;
  const teamB = (await owner.post('/api/teams', { name: 'Beta' })).body.team.id;
  await owner.post(`/api/teams/${teamA}/members`, { email: 'tom@example.com' });

  // Validation + membership checks
  assert.equal((await owner.post('/api/tasks', { teamId: teamA })).status, 400); // title missing
  assert.equal((await owner.post('/api/tasks', { teamId: teamA, title: 'T', status: 'bogus' })).status, 400);
  assert.equal((await outsider.post('/api/tasks', { teamId: teamA, title: 'Sneaky' })).status, 403);
  assert.equal(
    (await owner.post('/api/tasks', { teamId: teamB, title: 'Bad assign', assigneeId: memberUser.id })).status,
    400
  ); // Tom is not in Beta

  // Titles that are empty once HTML is stripped (or only whitespace) are rejected
  assert.equal((await owner.post('/api/tasks', { teamId: teamA, title: '<b></b>' })).status, 400);
  assert.equal((await owner.post('/api/tasks', { teamId: teamA, title: '   ' })).status, 400);
  assert.equal((await owner.post('/api/teams', { name: '<i></i>' })).status, 400);

  // Create (with sanitisation)
  const t1 = await owner.post('/api/tasks', {
    teamId: teamA,
    title: '<script>alert(1)</script>Write docs',
    description: 'Cover <b>auth</b> & teams',
    priority: 'high',
    dueDate: isoDate(5),
    assigneeId: memberUser.id,
  });
  assert.equal(t1.status, 201);
  assert.equal(t1.body.task.title, 'Write docs');
  assert.equal(t1.body.task.description, 'Cover auth & teams');
  assert.equal(t1.body.task.assigneeName, 'Tom Member');
  assert.match(t1.body.task.dueDate, /^\d{4}-\d{2}-\d{2}$/);

  const t2 = await member.post('/api/tasks', { teamId: teamA, title: 'Fix login bug', priority: 'low' });
  const t3 = await owner.post('/api/tasks', { teamId: teamB, title: 'Beta launch', assigneeId: ownerUser.id });
  assert.equal(t2.status, 201);
  assert.equal(t3.status, 201);

  // Filters
  const all = await owner.get('/api/tasks');
  assert.equal(all.body.tasks.length, 3);
  assert.equal((await owner.get(`/api/tasks?teamId=${teamA}`)).body.tasks.length, 2);
  assert.equal((await owner.get(`/api/tasks?assignee=${memberUser.id}`)).body.tasks.length, 1);
  assert.equal((await owner.get('/api/tasks?assignee=me')).body.tasks.length, 1);
  assert.equal((await owner.get('/api/tasks?assignee=unassigned')).body.tasks.length, 1);
  assert.equal((await owner.get('/api/tasks?search=login')).body.tasks.length, 1);
  assert.equal((await owner.get('/api/tasks?priority=high')).body.tasks.length, 1);
  assert.equal((await owner.get('/api/tasks?status=done')).body.tasks.length, 0);
  assert.equal((await owner.get('/api/tasks?sort=priority')).body.tasks[0].priority, 'high');
  assert.equal((await owner.get('/api/tasks?status=nonsense')).status, 400);

  // LIKE wildcards and SQL metacharacters are treated literally
  assert.equal((await owner.get('/api/tasks?search=%25')).body.tasks.length, 0);
  assert.equal((await owner.get(`/api/tasks?search=${encodeURIComponent("'; DROP TABLE tasks;--")}`)).body.tasks.length, 0);
  assert.equal((await owner.get('/api/tasks')).body.tasks.length, 3);

  // Visibility: Tom only sees Alpha tasks, outsider sees nothing
  assert.equal((await member.get('/api/tasks')).body.tasks.length, 2);
  assert.equal((await outsider.get('/api/tasks')).body.tasks.length, 0);
  assert.equal((await outsider.get(`/api/tasks/${t1.body.task.id}`)).status, 404);
  assert.equal((await member.get(`/api/tasks/${t3.body.task.id}`)).status, 404);

  // Update: any member can edit/reassign; outsiders cannot
  const id1 = t1.body.task.id;
  const upd = await member.put(`/api/tasks/${id1}`, { status: 'in_progress', assigneeId: null });
  assert.equal(upd.status, 200);
  assert.equal(upd.body.task.status, 'in_progress');
  assert.equal(upd.body.task.assigneeId, null);
  assert.equal(upd.body.task.title, 'Write docs'); // untouched fields stay
  assert.equal((await member.put(`/api/tasks/${id1}`, {})).status, 400); // empty update
  assert.equal((await member.put(`/api/tasks/${id1}`, { assigneeId: 999999 })).status, 400);
  assert.equal((await outsider.put(`/api/tasks/${id1}`, { status: 'done' })).status, 404);

  // Delete: creator or team owner only
  const id2 = t2.body.task.id; // created by Tom
  assert.equal((await outsider.del(`/api/tasks/${id2}`)).status, 404);
  assert.equal((await member.del(`/api/tasks/${id1}`)).status, 403); // Tess's task, Tom is not owner/creator
  assert.equal((await member.del(`/api/tasks/${id2}`)).status, 204); // his own
  assert.equal((await owner.del(`/api/tasks/${id1}`)).status, 204); // owner can delete any

  // Removing a member unassigns their tasks
  const t4 = await owner.post('/api/tasks', { teamId: teamA, title: 'Handover', assigneeId: memberUser.id });
  await owner.del(`/api/teams/${teamA}/members/${memberUser.id}`);
  assert.equal((await owner.get(`/api/tasks/${t4.body.task.id}`)).body.task.assigneeId, null);
});

test('reminders list my overdue and soon-due unfinished tasks', async () => {
  const { client, user } = await registerUser('Rita Reminder', 'rita@example.com');
  const teamId = (await client.post('/api/teams', { name: 'Reminders' })).body.team.id;
  const make = (title, dueDate, extra = {}) =>
    client.post('/api/tasks', { teamId, title, dueDate, assigneeId: user.id, ...extra });

  await make('Overdue', isoDate(-3));
  await make('Tomorrow', isoDate(1));
  await make('Far away', isoDate(30));
  await make('Already done', isoDate(-1), { status: 'done' });
  await client.post('/api/tasks', { teamId, title: 'Unassigned', dueDate: isoDate(0) });

  const res = await client.get('/api/tasks/reminders');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.overdue.map((t) => t.title), ['Overdue']);
  assert.deepEqual(res.body.dueSoon.map((t) => t.title), ['Tomorrow']);
});

test('invites: unregistered emails are stored and accepted on sign-up', async () => {
  const { client: owner, user: ownerUser } = await registerUser('Ivy Owner', 'ivy@example.com');
  const { client: other } = await registerUser('Ian Other', 'ian@example.com');
  const teamId = (await owner.post('/api/teams', { name: 'Invite Team' })).body.team.id;

  assert.equal((await other.post(`/api/teams/${teamId}/invites`, { email: 'x@example.com' })).status, 404);

  const invite = await owner.post(`/api/teams/${teamId}/invites`, { email: 'newbie@example.com' });
  assert.equal(invite.status, 201);
  assert.equal(invite.body.status, 'invited');
  assert.equal(invite.body.delivery.stubbed, true);

  const pending = await owner.get(`/api/teams/${teamId}`);
  assert.equal(pending.body.invites.length, 1);

  // Inviting an existing user adds them straight away
  const direct = await owner.post(`/api/teams/${teamId}/invites`, { email: 'ian@example.com' });
  assert.equal(direct.body.status, 'added');
  assert.equal((await owner.post(`/api/teams/${teamId}/invites`, { email: 'ian@example.com' })).status, 409);

  // The invited person registers and lands in the team
  const { client: newbie } = await registerUser('Nina Newbie', 'newbie@example.com');
  const teams = await newbie.get('/api/teams');
  assert.equal(teams.body.teams.length, 1);
  assert.equal(teams.body.teams[0].id, teamId);
  assert.equal(teams.body.teams[0].role, 'member');
  assert.equal((await owner.get(`/api/teams/${teamId}`)).body.invites.length, 0);
  assert.equal(ownerUser.email, 'ivy@example.com');
});

test('unknown API routes return JSON 404', async () => {
  const res = await new Client().get('/api/does-not-exist');
  assert.equal(res.status, 404);
  assert.ok(res.body.error);
});

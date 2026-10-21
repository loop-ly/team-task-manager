const express = require('express');
const pool = require('../db/pool');
const validate = require('../middleware/validate');
const schemas = require('../validators/schemas');
const { getRole } = require('../middleware/teamAccess');

const router = express.Router();

const TASK_COLUMNS = `
  t.id, t.team_id AS "teamId", tm.name AS "teamName",
  t.title, t.description, t.status, t.priority, t.due_date AS "dueDate",
  t.assignee_id AS "assigneeId", a.name AS "assigneeName",
  t.created_by AS "createdBy", c.name AS "createdByName",
  t.created_at AS "createdAt", t.updated_at AS "updatedAt"`;

const TASK_FROM = `
  tasks t
  JOIN teams tm ON tm.id = t.team_id
  JOIN users c ON c.id = t.created_by
  LEFT JOIN users a ON a.id = t.assignee_id`;

// $1 is always the current user: tasks are only visible to members of the task's team.
const VISIBLE_TO_USER = 't.team_id IN (SELECT team_id FROM team_members WHERE user_id = $1)';

const SORT_ORDER = {
  createdAt: 't.created_at DESC',
  dueDate: 't.due_date ASC NULLS LAST, t.created_at DESC',
  priority: `CASE t.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, t.created_at DESC`,
};

// Maps API field names to database columns. Only these keys can ever reach the UPDATE.
const UPDATABLE_COLUMNS = {
  title: 'title',
  description: 'description',
  status: 'status',
  priority: 'priority',
  dueDate: 'due_date',
  assigneeId: 'assignee_id',
};

async function fetchTask(taskId, userId) {
  const { rows } = await pool.query(
    `SELECT ${TASK_COLUMNS} FROM ${TASK_FROM} WHERE t.id = $2 AND ${VISIBLE_TO_USER}`,
    [userId, taskId]
  );
  return rows[0] || null;
}

/** Escapes % and _ so user input is matched literally inside ILIKE. */
const escapeLike = (value) => value.replace(/[\\%_]/g, '\\$&');

// GET /api/tasks?teamId=&assignee=&status=&priority=&search=&sort=
router.get('/', validate(schemas.listTasks, 'query'), async (req, res) => {
  const { teamId, assignee, status, priority, search, sort } = req.valid.query;

  const params = [req.user.id];
  const where = [VISIBLE_TO_USER];
  const addFilter = (clause, value) => {
    params.push(value);
    where.push(clause.replace('?', `$${params.length}`));
  };

  if (teamId) addFilter('t.team_id = ?', teamId);
  if (assignee === 'me') addFilter('t.assignee_id = ?', req.user.id);
  else if (assignee === 'unassigned') where.push('t.assignee_id IS NULL');
  else if (assignee) addFilter('t.assignee_id = ?', assignee);
  if (status) addFilter('t.status = ?', status);
  if (priority) addFilter('t.priority = ?', priority);
  if (search) {
    params.push(`%${escapeLike(search)}%`);
    const n = params.length;
    where.push(`(t.title ILIKE $${n} OR t.description ILIKE $${n})`);
  }

  const { rows } = await pool.query(
    `SELECT ${TASK_COLUMNS} FROM ${TASK_FROM}
     WHERE ${where.join(' AND ')}
     ORDER BY ${SORT_ORDER[sort]}
     LIMIT 500`,
    params
  );
  res.json({ tasks: rows });
});

// GET /api/tasks/reminders - my unfinished tasks that are overdue or due within 2 days.
// Must be registered before '/:id' so "reminders" is not parsed as an id.
router.get('/reminders', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT ${TASK_COLUMNS}, (t.due_date < CURRENT_DATE) AS "isOverdue"
     FROM ${TASK_FROM}
     WHERE t.assignee_id = $1 AND t.status <> 'done'
       AND t.due_date IS NOT NULL AND t.due_date <= CURRENT_DATE + 2
     ORDER BY t.due_date`,
    [req.user.id]
  );
  res.json({
    overdue: rows.filter((t) => t.isOverdue),
    dueSoon: rows.filter((t) => !t.isOverdue),
  });
});

// POST /api/tasks - any team member can create tasks
router.post('/', validate(schemas.createTask), async (req, res) => {
  const b = req.valid.body;

  if (!(await getRole(b.teamId, req.user.id))) {
    return res.status(403).json({ error: 'You are not a member of that team' });
  }
  if (b.assigneeId && !(await getRole(b.teamId, b.assigneeId))) {
    return res.status(400).json({ error: 'Assignee must be a member of the team' });
  }

  const { rows } = await pool.query(
    `INSERT INTO tasks (team_id, title, description, status, priority, due_date, assignee_id, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [b.teamId, b.title, b.description, b.status, b.priority, b.dueDate, b.assigneeId, req.user.id]
  );
  res.status(201).json({ task: await fetchTask(rows[0].id, req.user.id) });
});

// GET /api/tasks/:id
router.get('/:id', validate(schemas.idParam, 'params'), async (req, res) => {
  const task = await fetchTask(req.valid.params.id, req.user.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  return res.json({ task });
});

// PUT or PATCH /api/tasks/:id - partial updates; any team member can edit or reassign
async function updateTask(req, res) {
  const existing = await fetchTask(req.valid.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });

  const changes = req.valid.body;
  if (changes.assigneeId && !(await getRole(existing.teamId, changes.assigneeId))) {
    return res.status(400).json({ error: 'Assignee must be a member of the team' });
  }

  const sets = [];
  const params = [];
  Object.entries(UPDATABLE_COLUMNS).forEach(([field, column]) => {
    if (field in changes) {
      params.push(changes[field]);
      sets.push(`${column} = $${params.length}`);
    }
  });
  sets.push('updated_at = now()');
  params.push(existing.id);

  await pool.query(`UPDATE tasks SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
  return res.json({ task: await fetchTask(existing.id, req.user.id) });
}
router.put('/:id', validate(schemas.idParam, 'params'), validate(schemas.updateTask), updateTask);
router.patch('/:id', validate(schemas.idParam, 'params'), validate(schemas.updateTask), updateTask);

// DELETE /api/tasks/:id - the task's creator or the team owner
router.delete('/:id', validate(schemas.idParam, 'params'), async (req, res) => {
  const task = await fetchTask(req.valid.params.id, req.user.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const role = await getRole(task.teamId, req.user.id);
  if (task.createdBy !== req.user.id && role !== 'owner') {
    return res.status(403).json({ error: 'Only the task creator or team owner can delete this task' });
  }

  await pool.query('DELETE FROM tasks WHERE id = $1', [task.id]);
  return res.status(204).end();
});

module.exports = router;

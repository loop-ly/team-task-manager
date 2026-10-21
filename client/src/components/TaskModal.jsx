import { useEffect, useState } from 'react';
import { api } from '../api/client';
import Modal from './ui/Modal';
import Field from './ui/Field';
import { PRIORITIES, STATUSES, errorMessage } from '../utils/format';

/**
 * Create / update form for a task.
 * - `task` is null when creating.
 * - `canDelete` lets the parent decide who sees the delete button.
 */
export default function TaskModal({ task, teams, defaultTeamId, canDelete, onSaved, onDelete, onClose }) {
  const isEdit = Boolean(task);

  const [form, setForm] = useState({
    teamId: task?.teamId ?? defaultTeamId ?? teams[0]?.id ?? '',
    title: task?.title ?? '',
    description: task?.description ?? '',
    status: task?.status ?? 'todo',
    priority: task?.priority ?? 'medium',
    dueDate: task?.dueDate ?? '',
    assigneeId: task?.assigneeId ?? '',
  });
  const [members, setMembers] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  // Who can be assigned depends on the selected team.
  useEffect(() => {
    if (!form.teamId) return undefined;
    let ignore = false;
    api.teams
      .get(form.teamId)
      .then((data) => {
        if (ignore) return;
        setMembers(data.members);
        // Drop an assignee that is not in the newly selected team.
        setForm((current) =>
          data.members.some((m) => String(m.id) === String(current.assigneeId))
            ? current
            : { ...current, assigneeId: '' }
        );
      })
      .catch((error) => !ignore && setFormError(errorMessage(error)));
    return () => {
      ignore = true;
    };
  }, [form.teamId]);

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError('');

    if (!form.title.trim()) {
      setFieldErrors({ title: 'Give the task a title' });
      return;
    }
    setFieldErrors({});

    const payload = {
      title: form.title,
      description: form.description,
      status: form.status,
      priority: form.priority,
      dueDate: form.dueDate || null,
      assigneeId: form.assigneeId ? Number(form.assigneeId) : null,
    };

    setSaving(true);
    try {
      const data = isEdit
        ? await api.tasks.update(task.id, payload)
        : await api.tasks.create({ ...payload, teamId: Number(form.teamId) });
      onSaved(data.task, !isEdit);
    } catch (error) {
      const serverErrors = {};
      (error.details || []).forEach((detail) => {
        serverErrors[detail.field] = detail.message;
      });
      if (Object.keys(serverErrors).length > 0) setFieldErrors(serverErrors);
      else setFormError(errorMessage(error));
      setSaving(false);
    }
  }

  return (
    <Modal
      title={isEdit ? 'Edit task' : 'New task'}
      onClose={onClose}
      footer={
        <>
          {isEdit && canDelete && (
            <button type="button" className="btn-ghost mr-auto text-danger hover:bg-danger-soft hover:text-danger" onClick={onDelete} disabled={saving}>
              Delete task
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="task-form" className="btn-primary" disabled={saving || !form.teamId}>
            {saving ? 'Saving...' : isEdit ? 'Save task' : 'Create task'}
          </button>
        </>
      }
    >
      <form id="task-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field label="Team" hint={isEdit ? 'A task stays in the team it was created in.' : undefined}>
          <select className="input" value={form.teamId} onChange={update('teamId')} disabled={isEdit}>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Title" error={fieldErrors.title}>
          <input className="input" value={form.title} onChange={update('title')} maxLength={200} placeholder="What needs to be done?" />
        </Field>

        <Field label="Description" error={fieldErrors.description}>
          <textarea className="input min-h-24 resize-y" value={form.description} onChange={update('description')} maxLength={2000} placeholder="Add details, links or acceptance criteria" />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Status">
            <select className="input" value={form.status} onChange={update('status')}>
              {STATUSES.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Priority">
            <select className="input" value={form.priority} onChange={update('priority')}>
              {PRIORITIES.map((priority) => (
                <option key={priority.value} value={priority.value}>
                  {priority.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Due date" error={fieldErrors.dueDate}>
            <input type="date" className="input" value={form.dueDate} onChange={update('dueDate')} />
          </Field>
          <Field label="Assignee" error={fieldErrors.assigneeId}>
            <select className="input" value={form.assigneeId} onChange={update('assigneeId')}>
              <option value="">Unassigned</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {formError && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2.5 text-sm font-medium text-danger">
            {formError}
          </p>
        )}
      </form>
    </Modal>
  );
}

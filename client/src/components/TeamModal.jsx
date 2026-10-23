import { useState } from 'react';
import { api } from '../api/client';
import Modal from './ui/Modal';
import Field from './ui/Field';
import { errorMessage } from '../utils/format';

/** Create a new team, or rename / re-describe an existing one (`team` set). */
export default function TeamModal({ team, onSaved, onClose }) {
  const isEdit = Boolean(team);
  const [form, setForm] = useState({ name: team?.name ?? '', description: team?.description ?? '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError('');
    if (form.name.trim().length < 2) {
      setFieldErrors({ name: 'Team names need at least 2 characters' });
      return;
    }
    setFieldErrors({});

    setSaving(true);
    try {
      const data = isEdit ? await api.teams.update(team.id, form) : await api.teams.create(form);
      onSaved(data.team, !isEdit);
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
      title={isEdit ? 'Edit team' : 'New team'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="team-form" className="btn-primary" disabled={saving}>
            {saving ? 'Saving...' : isEdit ? 'Save team' : 'Create team'}
          </button>
        </>
      }
    >
      <form id="team-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field label="Team name" error={fieldErrors.name}>
          <input className="input" value={form.name} onChange={update('name')} maxLength={100} placeholder="For example, Design or Backend" />
        </Field>
        <Field label="Description" hint="Optional. What does this team work on?" error={fieldErrors.description}>
          <textarea className="input min-h-20 resize-y" value={form.description} onChange={update('description')} maxLength={500} />
        </Field>
        {formError && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2.5 text-sm font-medium text-danger">
            {formError}
          </p>
        )}
      </form>
    </Modal>
  );
}

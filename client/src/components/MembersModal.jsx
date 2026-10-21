import { useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import Modal from './ui/Modal';
import Avatar from './ui/Avatar';
import Field from './ui/Field';
import { errorMessage } from '../utils/format';

/**
 * Lists team members and lets the owner add people (by email) or send invites.
 * Invite emails are stubbed on the server, so invites are stored and accepted when
 * the person registers with that address.
 */
export default function MembersModal({ team, members, invites, currentUser, onChanged, onClose }) {
  const toast = useToast();
  const isOwner = team.role === 'owner';

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmingId, setConfirmingId] = useState(null); // member awaiting a second click to remove

  async function run(action, successMessage) {
    setBusy(true);
    setError('');
    try {
      await action();
      if (successMessage) toast.success(successMessage);
      await onChanged();
      return true;
    } catch (err) {
      setError(errorMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleAdd(kind) {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Enter a valid email address');
      return;
    }
    const address = email.trim();
    const done =
      kind === 'add'
        ? await run(() => api.teams.addMember(team.id, address), `Added ${address} to the team`)
        : await run(async () => {
            const result = await api.teams.invite(team.id, address);
            toast.success(
              result.status === 'added'
                ? `${address} already has an account, so they were added`
                : `Invite saved for ${address} (email sending is simulated)`
            );
          });
    if (done) setEmail('');
  }

  async function handleRemove(member) {
    if (confirmingId !== member.id) {
      setConfirmingId(member.id);
      return;
    }
    setConfirmingId(null);
    const isSelf = member.id === currentUser.id;
    const ok = await run(() => api.teams.removeMember(team.id, member.id), isSelf ? 'You left the team' : `Removed ${member.name}`);
    if (ok && isSelf) onClose();
  }

  return (
    <Modal title={`Members of ${team.name}`} onClose={onClose} size="lg">
      <div className="space-y-6">
        {isOwner && (
          <form onSubmit={(event) => event.preventDefault()} noValidate className="space-y-3">
            <Field label="Add by email" hint="Add someone who has an account, or send an invite if they do not.">
              <input
                type="email"
                className="input"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="teammate@example.com"
                autoComplete="off"
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary" disabled={busy || !email} onClick={() => handleAdd('add')}>
                Add member
              </button>
              <button type="button" className="btn-secondary" disabled={busy || !email} onClick={() => handleAdd('invite')}>
                Send invite
              </button>
            </div>
          </form>
        )}

        {error && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2.5 text-sm font-medium text-danger">
            {error}
          </p>
        )}

        <section aria-label="Current members">
          <h3 className="mb-2 text-sm font-bold text-muted">
            {members.length} {members.length === 1 ? 'member' : 'members'}
          </h3>
          <ul className="divide-y divide-line rounded-xl border border-line">
            {members.map((member) => {
              const isSelf = member.id === currentUser.id;
              const canRemove = member.role !== 'owner' && (isOwner || isSelf);
              return (
                <li key={member.id} className="flex items-center gap-3 px-3.5 py-3">
                  <Avatar name={member.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {member.name}
                      {isSelf && <span className="font-normal text-muted"> (you)</span>}
                    </p>
                    <p className="truncate text-xs text-muted">{member.email}</p>
                  </div>
                  <span className="rounded-md bg-canvas px-2 py-0.5 text-xs font-semibold text-muted">
                    {member.role === 'owner' ? 'Owner' : 'Member'}
                  </span>
                  {canRemove && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleRemove(member)}
                      onBlur={() => setConfirmingId(null)}
                      className={`btn-ghost px-2 py-1 text-xs ${confirmingId === member.id ? 'bg-danger-soft text-danger' : ''}`}
                    >
                      {confirmingId === member.id ? 'Click to confirm' : isSelf ? 'Leave' : 'Remove'}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {isOwner && invites.length > 0 && (
          <section aria-label="Pending invites">
            <h3 className="mb-2 text-sm font-bold text-muted">Waiting to join</h3>
            <ul className="divide-y divide-line rounded-xl border border-line">
              {invites.map((invite) => (
                <li key={invite.id} className="flex items-center justify-between gap-3 px-3.5 py-3">
                  <span className="truncate text-sm">{invite.email}</span>
                  <button
                    type="button"
                    disabled={busy}
                    className="btn-ghost px-2 py-1 text-xs"
                    onClick={() => run(() => api.teams.revokeInvite(team.id, invite.id), 'Invite removed')}
                  >
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted">They join automatically when they sign up with that email address.</p>
          </section>
        )}
      </div>
    </Modal>
  );
}

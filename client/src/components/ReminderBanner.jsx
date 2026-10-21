import { useState } from 'react';
import { formatDate } from '../utils/format';

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

/**
 * Shown after logging in when tasks assigned to you are overdue or due within two days.
 * Clicking a task opens it; the banner can be dismissed for this visit.
 */
export default function ReminderBanner({ reminders, onOpenTask }) {
  const [dismissed, setDismissed] = useState(false);
  if (!reminders || dismissed) return null;

  const { overdue, dueSoon } = reminders;
  if (overdue.length === 0 && dueSoon.length === 0) return null;

  const parts = [];
  if (overdue.length) parts.push(`${plural(overdue.length, 'overdue task')}`);
  if (dueSoon.length) parts.push(`${plural(dueSoon.length, 'task')} due within 2 days`);

  return (
    <section
      aria-label="Task reminders"
      className="rounded-xl border border-amber-200 bg-amber-50 p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-bold text-amber-900">You have {parts.join(' and ')}.</p>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="-mr-1 -mt-1 rounded p-1 text-amber-800 hover:bg-amber-100"
          aria-label="Dismiss reminders"
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M5 5l10 10M15 5L5 15" />
          </svg>
        </button>
      </div>
      <ul className="mt-2 flex flex-wrap gap-2">
        {[...overdue, ...dueSoon].map((task) => (
          <li key={task.id}>
            <button
              type="button"
              onClick={() => onOpenTask(task)}
              className="rounded-lg bg-white px-3 py-1.5 text-left text-sm shadow-sm ring-1 ring-amber-200 hover:ring-amber-400"
            >
              <span className="font-semibold">{task.title}</span>{' '}
              <span className={task.isOverdue ? 'font-semibold text-danger' : 'text-muted'}>
                {task.isOverdue ? 'overdue since' : 'due'} {formatDate(task.dueDate)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

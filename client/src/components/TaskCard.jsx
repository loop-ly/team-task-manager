import Avatar from './ui/Avatar';
import { STATUSES, dueState, formatDate, priorityMeta } from '../utils/format';

const DUE_STYLES = {
  overdue: 'bg-danger-soft text-danger',
  soon: 'bg-amber-50 text-amber-700',
  upcoming: 'bg-canvas text-muted',
};

export default function TaskCard({ task, showTeam, onOpen, onStatusChange }) {
  const priority = priorityMeta(task.priority);
  const due = dueState(task.dueDate, task.status);

  return (
    <article className="rounded-xl border border-line bg-white shadow-sm transition-colors hover:border-cobalt/40">
      <button
        type="button"
        onClick={() => onOpen(task)}
        className="block w-full rounded-t-xl p-3.5 pb-2 text-left"
        aria-label={`Edit task: ${task.title}`}
      >
        <span className={`block text-sm font-bold leading-snug ${task.status === 'done' ? 'text-muted line-through' : ''}`}>
          {task.title}
        </span>
        {task.description && (
          <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-muted">{task.description}</span>
        )}
        <span className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${priority.style}`}>{priority.label}</span>
          {task.dueDate && (
            <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${DUE_STYLES[due] || DUE_STYLES.upcoming}`}>
              {due === 'overdue' ? 'Overdue ' : 'Due '}
              {formatDate(task.dueDate)}
            </span>
          )}
          {showTeam && (
            <span className="rounded-md bg-cobalt-soft px-2 py-0.5 text-xs font-semibold text-cobalt">
              {task.teamName}
            </span>
          )}
        </span>
      </button>

      <div className="flex items-center justify-between gap-2 border-t border-line px-3.5 py-2.5">
        <span className="flex min-w-0 items-center gap-2 text-xs text-muted">
          {task.assigneeName ? (
            <>
              <Avatar name={task.assigneeName} size="sm" />
              <span className="truncate font-medium text-ink-soft">{task.assigneeName}</span>
            </>
          ) : (
            <span>Unassigned</span>
          )}
        </span>
        <select
          value={task.status}
          onChange={(event) => onStatusChange(task, event.target.value)}
          aria-label={`Status of ${task.title}`}
          className="rounded-md border border-line bg-white py-1 pl-2 pr-6 text-xs font-semibold text-ink-soft focus:border-cobalt focus:outline-none focus:ring-2 focus:ring-cobalt/25"
        >
          {STATUSES.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </select>
      </div>
    </article>
  );
}

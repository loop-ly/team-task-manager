import TaskCard from './TaskCard';
import Spinner from './ui/Spinner';
import { STATUSES } from '../utils/format';

/** Tasks grouped into To do / In progress / Done columns (stacked on small screens). */
export default function TaskBoard({ tasks, loading, hasActiveFilters, showTeam, onOpen, onStatusChange, onCreate }) {
  if (loading && tasks.length === 0) return <Spinner label="Loading tasks" />;

  if (!loading && tasks.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line bg-white px-6 py-14 text-center">
        <p className="text-base font-bold">{hasActiveFilters ? 'No tasks match these filters' : 'No tasks yet'}</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
          {hasActiveFilters
            ? 'Try a different search or clear the filters to see everything.'
            : 'Create the first task and assign it to someone on the team.'}
        </p>
        {!hasActiveFilters && (
          <button type="button" className="btn-primary mt-5" onClick={onCreate}>
            Create a task
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`grid gap-4 md:grid-cols-3 ${loading ? 'opacity-60 transition-opacity' : ''}`} aria-busy={loading}>
      {STATUSES.map((status) => {
        const column = tasks.filter((task) => task.status === status.value);
        return (
          <section key={status.value} aria-label={`${status.label} tasks`} className="min-w-0 rounded-xl bg-black/[0.035] p-2.5">
            <h3 className="flex items-center gap-2 px-1.5 pb-2.5 pt-1 text-sm font-bold">
              <span className={`h-2.5 w-2.5 rounded-full ${status.dot}`} />
              {status.label}
              <span className="text-muted">{column.length}</span>
            </h3>
            <div className="space-y-2.5">
              {column.map((task) => (
                <TaskCard key={task.id} task={task} showTeam={showTeam} onOpen={onOpen} onStatusChange={onStatusChange} />
              ))}
              {column.length === 0 && <p className="px-1.5 pb-3 text-xs text-muted">Nothing here.</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}

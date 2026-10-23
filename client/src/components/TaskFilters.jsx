import { PRIORITIES, STATUSES } from '../utils/format';

const SORTS = [
  { value: 'createdAt', label: 'Newest first' },
  { value: 'dueDate', label: 'Due date' },
  { value: 'priority', label: 'Priority' },
];

/** Search box and dropdown filters. `members` is only set when a single team is selected. */
export default function TaskFilters({ filters, onChange, members, hasActiveFilters, onClear }) {
  const set = (key) => (event) => onChange({ ...filters, [key]: event.target.value });

  return (
    <form
      role="search"
      onSubmit={(event) => event.preventDefault()}
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))]"
    >
      <div className="relative sm:col-span-2 xl:col-span-1">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          width="16"
          height="16"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <circle cx="9" cy="9" r="6" />
          <path d="M14 14l4 4" />
        </svg>
        <input
          type="search"
          className="input pl-9"
          placeholder="Search tasks"
          aria-label="Search tasks"
          value={filters.search}
          onChange={set('search')}
          maxLength={100}
        />
      </div>

      <select className="input" aria-label="Filter by assignee" value={filters.assignee} onChange={set('assignee')}>
        <option value="">All assignees</option>
        <option value="me">Assigned to me</option>
        <option value="unassigned">Unassigned</option>
        {members?.map((member) => (
          <option key={member.id} value={member.id}>
            {member.name}
          </option>
        ))}
      </select>

      <select className="input" aria-label="Filter by status" value={filters.status} onChange={set('status')}>
        <option value="">All statuses</option>
        {STATUSES.map((status) => (
          <option key={status.value} value={status.value}>
            {status.label}
          </option>
        ))}
      </select>

      <select className="input" aria-label="Filter by priority" value={filters.priority} onChange={set('priority')}>
        <option value="">All priorities</option>
        {PRIORITIES.map((priority) => (
          <option key={priority.value} value={priority.value}>
            {priority.label}
          </option>
        ))}
      </select>

      <div className="flex gap-2">
        <select className="input" aria-label="Sort tasks" value={filters.sort} onChange={set('sort')}>
          {SORTS.map((sort) => (
            <option key={sort.value} value={sort.value}>
              {sort.label}
            </option>
          ))}
        </select>
        {hasActiveFilters && (
          <button type="button" className="btn-ghost shrink-0 whitespace-nowrap" onClick={onClear}>
            Clear
          </button>
        )}
      </div>
    </form>
  );
}

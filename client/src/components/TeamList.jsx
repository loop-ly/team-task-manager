import { NavLink } from 'react-router-dom';

const itemClass = ({ isActive }) =>
  `flex shrink-0 items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
    isActive ? 'bg-cobalt-soft text-cobalt' : 'text-ink-soft hover:bg-white'
  }`;

/**
 * Team picker. A vertical list beside the board on large screens,
 * a horizontally scrolling row of chips on phones.
 */
export default function TeamList({ teams, loading, onCreate }) {
  return (
    <nav aria-label="Teams" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-muted">Your teams</h2>
        <button type="button" className="btn-ghost px-2 py-1 text-cobalt hover:text-cobalt" onClick={onCreate}>
          + New team
        </button>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0 lg:pb-0">
        <NavLink to="/" end className={itemClass}>
          All teams
        </NavLink>
        {teams.map((team) => (
          <NavLink key={team.id} to={`/teams/${team.id}`} className={itemClass}>
            <span className="truncate">{team.name}</span>
            <span
              className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-bold tabular-nums"
              title={`${team.openTaskCount} open task${team.openTaskCount === 1 ? '' : 's'}`}
            >
              {team.openTaskCount}
            </span>
          </NavLink>
        ))}
      </div>

      {!loading && teams.length === 0 && (
        <p className="text-sm leading-relaxed text-muted">
          You are not in a team yet. Create one to start adding tasks, or ask a teammate to add you.
        </p>
      )}
    </nav>
  );
}

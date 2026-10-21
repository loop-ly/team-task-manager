import Avatar from './ui/Avatar';

const MAX_AVATARS = 5;

/** Title area above the board. Shows team details and owner actions for one team, or a summary for "All teams". */
export default function TeamHeader({ team, members, teamCount, onNewTask, onMembers, onEdit, onDelete, onLeave, canCreateTask }) {
  const shown = (members || []).slice(0, MAX_AVATARS);
  const extra = (members?.length || 0) - shown.length;
  const isOwner = team?.role === 'owner';

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1.5">
        <h1 className="truncate text-2xl font-extrabold tracking-tight">{team ? team.name : 'All tasks'}</h1>
        <p className="max-w-prose text-sm text-muted">
          {team
            ? team.description || 'No description yet.'
            : teamCount > 0
              ? `Tasks from all ${teamCount} of your ${teamCount === 1 ? 'team' : 'teams'}.`
              : 'Tasks from your teams will show up here.'}
        </p>
        {team && (
          <div className="flex items-center gap-3 pt-1">
            <div className="flex -space-x-2">
              {shown.map((member) => (
                <Avatar key={member.id} name={member.name} />
              ))}
              {extra > 0 && (
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-canvas text-xs font-bold text-muted ring-2 ring-white">
                  +{extra}
                </span>
              )}
            </div>
            <button type="button" className="text-sm font-semibold text-cobalt hover:underline" onClick={onMembers}>
              {isOwner ? 'Manage members' : 'View members'}
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {team && isOwner && (
          <>
            <button type="button" className="btn-ghost" onClick={onEdit}>
              Edit team
            </button>
            <button type="button" className="btn-ghost text-danger hover:bg-danger-soft hover:text-danger" onClick={onDelete}>
              Delete team
            </button>
          </>
        )}
        {team && !isOwner && (
          <button type="button" className="btn-ghost" onClick={onLeave}>
            Leave team
          </button>
        )}
        <button type="button" className="btn-primary" onClick={onNewTask} disabled={!canCreateTask}>
          + New task
        </button>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import useDebounce from '../hooks/useDebounce';
import { errorMessage } from '../utils/format';
import Header from '../components/Header';
import TeamList from '../components/TeamList';
import TeamHeader from '../components/TeamHeader';
import TaskFilters from '../components/TaskFilters';
import TaskBoard from '../components/TaskBoard';
import ReminderBanner from '../components/ReminderBanner';
import TaskModal from '../components/TaskModal';
import TeamModal from '../components/TeamModal';
import MembersModal from '../components/MembersModal';
import ConfirmModal from '../components/ui/ConfirmModal';

const EMPTY_FILTERS = { search: '', assignee: '', status: '', priority: '', sort: 'createdAt' };

export default function Dashboard() {
  const { teamId } = useParams();
  const selectedTeamId = teamId ? Number(teamId) : null;
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const toast = useToast();

  const [teams, setTeams] = useState([]);
  const [teamsLoaded, setTeamsLoaded] = useState(false);
  const [detail, setDetail] = useState(null); // { team, members, invites } for the selected team
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [reloadCounter, setReloadCounter] = useState(0);
  const [reminders, setReminders] = useState(null);
  // Which dialog is open: { type: 'task' | 'team' | 'members' | 'delete-team' | 'leave-team' | 'delete-task', ... }
  const [modal, setModal] = useState(null);

  const debouncedSearch = useDebounce(filters.search);
  const selectedTeam = teams.find((team) => team.id === selectedTeamId) || null;
  const hasActiveFilters = Boolean(filters.search || filters.assignee || filters.status || filters.priority);

  const latestTeamId = useRef(selectedTeamId);
  latestTeamId.current = selectedTeamId;

  const showError = useCallback((error) => toast.error(errorMessage(error)), [toast]);

  // ---- Data loading -------------------------------------------------------------------

  const loadTeams = useCallback(async () => {
    try {
      const data = await api.teams.list();
      setTeams(data.teams);
    } catch (error) {
      showError(error);
    } finally {
      setTeamsLoaded(true);
    }
  }, [showError]);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  // Reminders are fetched once, when the dashboard opens after logging in.
  useEffect(() => {
    api.tasks.reminders().then(setReminders).catch(() => setReminders(null));
  }, []);

  const loadDetail = useCallback(async () => {
    const id = latestTeamId.current;
    if (!id) {
      setDetail(null);
      return;
    }
    try {
      const data = await api.teams.get(id);
      if (latestTeamId.current === id) setDetail(data); // ignore answers for a team we already left
    } catch (error) {
      if (error.status === 404) navigate('/', { replace: true });
      else showError(error);
    }
  }, [navigate, showError]);

  useEffect(() => {
    setDetail(null);
    // A person filter from another team is meaningless here, so reset it.
    setFilters((current) =>
      current.assignee && !['me', 'unassigned'].includes(current.assignee) ? { ...current, assignee: '' } : current
    );
    loadDetail();
  }, [selectedTeamId, loadDetail]);

  // Unknown or no-longer-accessible team in the URL: go back to the overview.
  useEffect(() => {
    if (teamsLoaded && selectedTeamId && !selectedTeam) navigate('/', { replace: true });
  }, [teamsLoaded, selectedTeamId, selectedTeam, navigate]);

  useEffect(() => {
    let ignore = false;
    setTasksLoading(true);
    api.tasks
      .list({
        teamId: selectedTeamId ?? undefined,
        assignee: filters.assignee,
        status: filters.status,
        priority: filters.priority,
        search: debouncedSearch.trim(),
        sort: filters.sort,
      })
      .then((data) => !ignore && setTasks(data.tasks))
      .catch((error) => !ignore && showError(error))
      .finally(() => !ignore && setTasksLoading(false));
    return () => {
      ignore = true;
    };
  }, [selectedTeamId, filters.assignee, filters.status, filters.priority, filters.sort, debouncedSearch, reloadCounter, showError]);

  const refreshTasks = useCallback(() => {
    setReloadCounter((n) => n + 1);
    loadTeams(); // keeps the open-task counts in the sidebar accurate
  }, [loadTeams]);

  // ---- Actions ------------------------------------------------------------------------

  const closeModal = () => setModal(null);

  async function handleLogout() {
    try {
      await logout();
    } catch (error) {
      showError(error);
    }
  }

  function handleTaskSaved(task, isNew) {
    closeModal();
    toast.success(isNew ? 'Task created' : 'Task saved');
    refreshTasks();
    api.tasks.reminders().then(setReminders).catch(() => {});
  }

  async function handleDeleteTask() {
    try {
      await api.tasks.remove(modal.task.id);
      toast.success('Task deleted');
      closeModal();
      refreshTasks();
    } catch (error) {
      showError(error);
    }
  }

  async function handleStatusChange(task, status) {
    setTasks((current) => current.map((t) => (t.id === task.id ? { ...t, status } : t))); // optimistic
    try {
      await api.tasks.update(task.id, { status });
      loadTeams();
    } catch (error) {
      showError(error);
      setReloadCounter((n) => n + 1); // put the board back to what the server has
    }
  }

  function handleTeamSaved(team, isNew) {
    closeModal();
    toast.success(isNew ? `Created ${team.name}` : 'Team saved');
    loadTeams();
    if (isNew) navigate(`/teams/${team.id}`);
    else {
      loadDetail();
      refreshTasks();
    }
  }

  async function handleDeleteTeam() {
    try {
      await api.teams.remove(selectedTeamId);
      toast.success('Team deleted');
      closeModal();
      navigate('/');
      refreshTasks();
    } catch (error) {
      showError(error);
    }
  }

  async function handleLeaveTeam() {
    try {
      await api.teams.removeMember(selectedTeamId, user.id);
      toast.success('You left the team');
      closeModal();
      navigate('/');
      refreshTasks();
    } catch (error) {
      showError(error);
    }
  }

  const openTask = (task) => setModal({ type: 'task', task });
  const openNewTask = () => setModal({ type: 'task', task: null });

  const roleFor = (teamIdToFind) => teams.find((team) => team.id === teamIdToFind)?.role;

  // ---- Render -------------------------------------------------------------------------

  return (
    <div className="min-h-screen">
      <Header user={user} onLogout={handleLogout} />

      <div className="mx-auto flex max-w-[1400px] flex-col gap-6 px-4 py-6 lg:flex-row lg:gap-8 lg:px-8">
        <aside className="lg:w-60 lg:shrink-0">
          <TeamList teams={teams} loading={!teamsLoaded} onCreate={() => setModal({ type: 'team', team: null })} />
        </aside>

        <main className="min-w-0 flex-1 space-y-5">
          <ReminderBanner reminders={reminders} onOpenTask={openTask} />

          <TeamHeader
            team={selectedTeam}
            members={detail?.members}
            teamCount={teams.length}
            canCreateTask={teams.length > 0}
            onNewTask={openNewTask}
            onMembers={() => setModal({ type: 'members' })}
            onEdit={() => setModal({ type: 'team', team: selectedTeam })}
            onDelete={() => setModal({ type: 'delete-team' })}
            onLeave={() => setModal({ type: 'leave-team' })}
          />

          {teamsLoaded && teams.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line bg-white px-6 py-14 text-center">
              <p className="text-base font-bold">Start by creating a team</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
                Teams hold tasks and people. Once you have one, you can add teammates and assign work.
              </p>
              <button type="button" className="btn-primary mt-5" onClick={() => setModal({ type: 'team', team: null })}>
                Create your first team
              </button>
            </div>
          ) : (
            <>
              <TaskFilters
                filters={filters}
                onChange={setFilters}
                members={detail?.members}
                hasActiveFilters={hasActiveFilters}
                onClear={() => setFilters((current) => ({ ...EMPTY_FILTERS, sort: current.sort }))}
              />
              <TaskBoard
                tasks={tasks}
                loading={tasksLoading}
                hasActiveFilters={hasActiveFilters}
                showTeam={!selectedTeamId}
                onOpen={openTask}
                onStatusChange={handleStatusChange}
                onCreate={openNewTask}
              />
            </>
          )}
        </main>
      </div>

      {modal?.type === 'task' && (
        <TaskModal
          task={modal.task}
          teams={teams}
          defaultTeamId={selectedTeamId}
          canDelete={
            modal.task && (modal.task.createdBy === user.id || roleFor(modal.task.teamId) === 'owner')
          }
          onSaved={handleTaskSaved}
          onDelete={() => setModal({ type: 'delete-task', task: modal.task })}
          onClose={closeModal}
        />
      )}

      {modal?.type === 'delete-task' && (
        <ConfirmModal
          title="Delete this task?"
          message={`"${modal.task.title}" will be removed for everyone on the team. This cannot be undone.`}
          confirmLabel="Delete task"
          onConfirm={handleDeleteTask}
          onClose={() => setModal({ type: 'task', task: modal.task })}
        />
      )}

      {modal?.type === 'team' && <TeamModal team={modal.team} onSaved={handleTeamSaved} onClose={closeModal} />}

      {modal?.type === 'members' && selectedTeam && detail && (
        <MembersModal
          team={selectedTeam}
          members={detail.members}
          invites={detail.invites}
          currentUser={user}
          onChanged={async () => {
            await Promise.all([loadDetail(), loadTeams()]);
            setReloadCounter((n) => n + 1);
          }}
          onClose={closeModal}
        />
      )}

      {modal?.type === 'delete-team' && selectedTeam && (
        <ConfirmModal
          title={`Delete ${selectedTeam.name}?`}
          message="The team, all of its tasks and its member list will be permanently deleted."
          confirmLabel="Delete team"
          onConfirm={handleDeleteTeam}
          onClose={closeModal}
        />
      )}

      {modal?.type === 'leave-team' && selectedTeam && (
        <ConfirmModal
          title={`Leave ${selectedTeam.name}?`}
          message="You will lose access to this team's tasks, and anything assigned to you becomes unassigned."
          confirmLabel="Leave team"
          onConfirm={handleLeaveTeam}
          onClose={closeModal}
        />
      )}
    </div>
  );
}

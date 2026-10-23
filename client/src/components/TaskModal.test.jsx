import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TaskModal from './TaskModal';
import { api } from '../api/client';

vi.mock('../api/client', () => ({
  api: { teams: { get: vi.fn() }, tasks: { create: vi.fn(), update: vi.fn() } },
}));

const teams = [
  { id: 1, name: 'Design', role: 'owner' },
  { id: 2, name: 'Backend', role: 'member' },
];
const members = [
  { id: 10, name: 'Maya Lopez', email: 'maya@example.com', role: 'owner' },
  { id: 11, name: 'Dev Patel', email: 'dev@example.com', role: 'member' },
];

describe('TaskModal', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    api.teams.get.mockResolvedValue({ team: teams[0], members, invites: [] });
  });

  it('requires a title and does not call the API without one', async () => {
    const user = userEvent.setup();
    render(<TaskModal teams={teams} defaultTeamId={1} onSaved={vi.fn()} onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /create task/i }));

    expect(screen.getByText(/give the task a title/i)).toBeInTheDocument();
    expect(api.tasks.create).not.toHaveBeenCalled();
  });

  it('creates a task with the chosen team, assignee, priority and due date', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    api.tasks.create.mockResolvedValue({ task: { id: 99, title: 'Ship it' } });
    render(<TaskModal teams={teams} defaultTeamId={1} onSaved={onSaved} onClose={vi.fn()} />);

    await waitFor(() => expect(screen.getByRole('option', { name: 'Dev Patel' })).toBeInTheDocument());
    await user.type(screen.getByLabelText(/^title/i), 'Ship it');
    await user.selectOptions(screen.getByLabelText(/priority/i), 'high');
    await user.selectOptions(screen.getByLabelText(/assignee/i), 'Dev Patel');
    fireEvent.change(screen.getByLabelText(/due date/i), { target: { value: '2026-12-01' } });
    await user.click(screen.getByRole('button', { name: /create task/i }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ id: 99, title: 'Ship it' }, true));
    expect(api.tasks.create).toHaveBeenCalledWith({
      teamId: 1,
      title: 'Ship it',
      description: '',
      status: 'todo',
      priority: 'high',
      dueDate: '2026-12-01',
      assigneeId: 11,
    });
  });

  it('edits an existing task: team is locked and unassigning sends null', async () => {
    const user = userEvent.setup();
    const task = {
      id: 5,
      teamId: 1,
      title: 'Write docs',
      description: '',
      status: 'in_progress',
      priority: 'low',
      dueDate: null,
      assigneeId: 11,
    };
    api.tasks.update.mockResolvedValue({ task: { ...task, assigneeId: null } });
    render(<TaskModal task={task} teams={teams} canDelete onDelete={vi.fn()} onSaved={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByLabelText(/^team/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /delete task/i })).toBeInTheDocument();

    await waitFor(() => expect(screen.getByLabelText(/assignee/i)).toHaveValue('11'));
    await user.selectOptions(screen.getByLabelText(/assignee/i), '');
    await user.click(screen.getByRole('button', { name: /save task/i }));

    await waitFor(() => expect(api.tasks.update).toHaveBeenCalled());
    expect(api.tasks.update.mock.calls[0][0]).toBe(5);
    expect(api.tasks.update.mock.calls[0][1]).toMatchObject({ assigneeId: null, status: 'in_progress', priority: 'low' });
  });

  it('hides the delete button when the user is not allowed to delete', () => {
    const task = { id: 5, teamId: 1, title: 'x', description: '', status: 'todo', priority: 'low', dueDate: null, assigneeId: null };
    render(<TaskModal task={task} teams={teams} canDelete={false} onSaved={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /delete task/i })).not.toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<TaskModal teams={teams} defaultTeamId={1} onSaved={vi.fn()} onClose={onClose} />);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});

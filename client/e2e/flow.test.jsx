/**
 * End-to-end test: renders the real React app in jsdom and drives it against the REAL API
 * and PostgreSQL, to prove the UI and backend agree on every request and response.
 *
 * Prerequisites (see README): the API must be running on http://localhost:4000 with a
 * database it can write to. Run with:  npm run test:e2e
 * It registers a brand-new user each run, so it is safe to repeat.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App';
import { AuthProvider } from '../src/context/AuthContext';
import { ToastProvider } from '../src/context/ToastContext';

// jsdom has no cookie-aware fetch to our API: add a base URL and a tiny cookie jar.
let cookie = '';
const nodeFetch = globalThis.fetch;
beforeAll(() => {
  globalThis.fetch = async (url, options = {}) => {
    const full = String(url).startsWith('/') ? `http://localhost:4000${url}` : url;
    const response = await nodeFetch(full, { ...options, credentials: undefined, headers: { ...(options.headers || {}), cookie } });
    const set = response.headers.getSetCookie();
    if (set.length) cookie = set.map((c) => c.split(';')[0]).join('; ');
    return response;
  };
});

const mount = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>
  );

const EMAIL = `ibtihal.${Date.now()}@example.com`;

const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

describe('Team Task Manager UI against the real API', () => {
  it('walks the whole user journey', async () => {
    const user = userEvent.setup();
    mount('/register');

    // --- Register: client-side validation first
    await screen.findByRole('heading', { name: /create your account/i });
    await user.click(screen.getByRole('button', { name: /create account/i }));
    await screen.findByText(/enter your name/i);
    expect(screen.getByText(/enter a valid email/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/full name/i), 'Ibtihal Test');
    await user.type(screen.getByLabelText(/^email/i), EMAIL);
    await user.type(screen.getByLabelText(/^password/i), 'weakpass');
    await user.click(screen.getByRole('button', { name: /create account/i }));
    await screen.findByText(/letter and a number/i);

    await user.clear(screen.getByLabelText(/^password/i));
    await user.type(screen.getByLabelText(/^password/i), 'Strong1pass');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    // --- Lands on an empty dashboard
    await screen.findByText(/start by creating a team/i);

    // --- Create a team
    await user.click(screen.getByRole('button', { name: /create your first team/i }));
    const teamDialog = await screen.findByRole('dialog', { name: /new team/i });
    await user.type(within(teamDialog).getByLabelText(/team name/i), 'Design Crew');
    await user.type(within(teamDialog).getByLabelText(/description/i), 'Makes things pretty');
    await user.click(within(teamDialog).getByRole('button', { name: /create team/i }));
    await screen.findByRole('heading', { level: 1, name: 'Design Crew' });
    await screen.findByText(/no tasks yet/i);

    // --- Create a task (assigned to myself, due tomorrow, high priority)
    await user.click(screen.getByRole('button', { name: /\+ new task/i }));
    const taskDialog = await screen.findByRole('dialog', { name: /new task/i });
    await user.click(within(taskDialog).getByRole('button', { name: /create task/i }));
    await within(taskDialog).findByText(/give the task a title/i);

    await user.type(within(taskDialog).getByLabelText(/^title/i), 'Design login screen');
    await user.type(within(taskDialog).getByLabelText(/description/i), 'Mobile first');
    await user.selectOptions(within(taskDialog).getByLabelText(/priority/i), 'high');
    fireEvent.change(within(taskDialog).getByLabelText(/due date/i), { target: { value: tomorrow() } });
    await waitFor(() => expect(within(taskDialog).getByRole('option', { name: 'Ibtihal Test' })).toBeInTheDocument());
    await user.selectOptions(within(taskDialog).getByLabelText(/assignee/i), 'Ibtihal Test');
    await user.click(within(taskDialog).getByRole('button', { name: /create task/i }));

    const card = await screen.findByRole('article');
    expect(within(card).getByText('Design login screen')).toBeInTheDocument();
    expect(within(card).getByText('High')).toBeInTheDocument();
    expect(within(card).getByText(/^Due /)).toBeInTheDocument();
    expect(within(card).getAllByText('Ibtihal Test').length).toBeGreaterThan(0);

    // --- Move it to "In progress" with the quick status control
    await user.selectOptions(within(card).getByLabelText(/status of design login screen/i), 'in_progress');
    const inProgress = screen.getByRole('region', { name: /in progress tasks/i });
    await waitFor(() => expect(within(inProgress).getByText('Design login screen')).toBeInTheDocument());

    // --- Edit it in the modal
    await user.click(screen.getByRole('button', { name: /edit task: design login screen/i }));
    const editDialog = await screen.findByRole('dialog', { name: /edit task/i });
    const title = within(editDialog).getByLabelText(/^title/i);
    await user.clear(title);
    await user.type(title, 'Design sign-in screen');
    await user.click(within(editDialog).getByRole('button', { name: /save task/i }));
    await screen.findByText('Design sign-in screen');

    // --- Search and filters
    await user.type(screen.getByRole('searchbox', { name: /search tasks/i }), 'zzz-nothing');
    await screen.findByText(/no tasks match these filters/i);
    await user.clear(screen.getByRole('searchbox', { name: /search tasks/i }));
    await user.type(screen.getByRole('searchbox', { name: /search tasks/i }), 'sign-in');
    await screen.findByText('Design sign-in screen');
    await user.clear(screen.getByRole('searchbox', { name: /search tasks/i }));
    await user.selectOptions(screen.getByLabelText(/filter by assignee/i), 'unassigned');
    await screen.findByText(/no tasks match these filters/i);
    await user.selectOptions(screen.getByLabelText(/filter by assignee/i), 'me');
    await screen.findByText('Design sign-in screen');

    // --- Members: invite someone who has no account yet
    await user.click(screen.getByRole('button', { name: /manage members/i }));
    const membersDialog = await screen.findByRole('dialog', { name: /members of design crew/i });
    await user.type(within(membersDialog).getByLabelText(/add by email/i), 'nobody@example.com');
    await user.click(within(membersDialog).getByRole('button', { name: /^add member/i }));
    await within(membersDialog).findByText(/send them an invite instead/i);
    await user.click(within(membersDialog).getByRole('button', { name: /send invite/i }));
    await within(membersDialog).findByText('nobody@example.com');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    // --- Reminder banner appears for a task due tomorrow when the dashboard (re)loads
    // (checked below after logging back in)

    // --- Log out, then log back in; data persists
    await user.click(screen.getByRole('button', { name: /log out/i }));
    await screen.findByRole('heading', { name: /log in to tandem/i });

    await user.type(screen.getByLabelText(/^email/i), EMAIL.toUpperCase());
    await user.type(screen.getByLabelText(/^password/i), 'wrong-pass1');
    await user.click(screen.getByRole('button', { name: /^log in/i }));
    await screen.findByText(/invalid email or password/i);

    await user.clear(screen.getByLabelText(/^password/i));
    await user.type(screen.getByLabelText(/^password/i), 'Strong1pass');
    await user.click(screen.getByRole('button', { name: /^log in/i }));

    await screen.findByRole('heading', { level: 1, name: /all tasks/i });
    await screen.findByText('Design sign-in screen');
    expect(await screen.findByRole('region', { name: /task reminders/i })).toHaveTextContent(/1 task due within 2 days/i);
  }, 60000);
});

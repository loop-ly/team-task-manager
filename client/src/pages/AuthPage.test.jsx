import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';
import { api } from '../api/client';

vi.mock('../api/client', () => ({
  api: { auth: { me: vi.fn(), login: vi.fn(), register: vi.fn(), logout: vi.fn() }, teams: {}, tasks: {} },
  setUnauthorizedHandler: vi.fn(),
  ApiError: class ApiError extends Error {},
}));

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('login and register screens', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    api.auth.me.mockRejectedValue(new Error('Authentication required')); // not logged in
  });

  it('sends anonymous visitors from the dashboard to the login page', async () => {
    renderAt('/');
    expect(await screen.findByRole('heading', { name: /log in to tandem/i })).toBeInTheDocument();
  });

  it('validates the login form before calling the API', async () => {
    const user = userEvent.setup();
    renderAt('/login');

    await user.click(await screen.findByRole('button', { name: /^log in/i }));

    expect(screen.getByText(/enter a valid email/i)).toBeInTheDocument();
    expect(screen.getByText(/enter your password/i)).toBeInTheDocument();
    expect(api.auth.login).not.toHaveBeenCalled();
  });

  it('shows the server message when credentials are wrong', async () => {
    const user = userEvent.setup();
    api.auth.login.mockRejectedValue(new Error('Invalid email or password'));
    renderAt('/login');

    await user.type(await screen.findByLabelText(/^email/i), 'a@b.co');
    await user.type(screen.getByLabelText(/^password/i), 'whatever1');
    await user.click(screen.getByRole('button', { name: /^log in/i }));

    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument();
    expect(api.auth.login).toHaveBeenCalledWith({ email: 'a@b.co', password: 'whatever1' });
  });

  it('enforces the password rules on the register form', async () => {
    const user = userEvent.setup();
    renderAt('/register');

    await user.type(await screen.findByLabelText(/full name/i), 'Sam Rivera');
    await user.type(screen.getByLabelText(/^email/i), 'sam@example.com');
    await user.type(screen.getByLabelText(/^password/i), 'onlyletters');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(screen.getByText(/at least 8 characters, including a letter and a number/i)).toBeInTheDocument();
    expect(api.auth.register).not.toHaveBeenCalled();
  });
});

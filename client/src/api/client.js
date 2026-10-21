/**
 * Thin wrapper around fetch for the REST API.
 * - sends the session cookie (credentials: 'include')
 * - throws an ApiError with the server's message and field details
 * - reports 401s on protected calls so the app can return to the login screen
 */
export class ApiError extends Error {
  constructor(message, status, details = []) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

let onUnauthorized = () => {};
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

async function request(path, { method = 'GET', body } = {}) {
  const response = await fetch(`/api${path}`, {
    method,
    credentials: 'include',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const isAuthCall = path.startsWith('/auth/');
    if (response.status === 401 && !isAuthCall) onUnauthorized();
    throw new ApiError(data?.error || 'Request failed', response.status, data?.details);
  }
  return data;
}

const toQuery = (params) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, value);
  });
  const text = search.toString();
  return text ? `?${text}` : '';
};

export const api = {
  auth: {
    register: (data) => request('/auth/register', { method: 'POST', body: data }),
    login: (data) => request('/auth/login', { method: 'POST', body: data }),
    logout: () => request('/auth/logout', { method: 'POST', body: {} }),
    me: () => request('/auth/me'),
  },
  teams: {
    list: () => request('/teams'),
    get: (id) => request(`/teams/${id}`),
    create: (data) => request('/teams', { method: 'POST', body: data }),
    update: (id, data) => request(`/teams/${id}`, { method: 'PUT', body: data }),
    remove: (id) => request(`/teams/${id}`, { method: 'DELETE' }),
    addMember: (id, email) => request(`/teams/${id}/members`, { method: 'POST', body: { email } }),
    removeMember: (id, userId) => request(`/teams/${id}/members/${userId}`, { method: 'DELETE' }),
    invite: (id, email) => request(`/teams/${id}/invites`, { method: 'POST', body: { email } }),
    revokeInvite: (id, inviteId) => request(`/teams/${id}/invites/${inviteId}`, { method: 'DELETE' }),
  },
  tasks: {
    list: (filters = {}) => request(`/tasks${toQuery(filters)}`),
    create: (data) => request('/tasks', { method: 'POST', body: data }),
    update: (id, data) => request(`/tasks/${id}`, { method: 'PUT', body: data }),
    remove: (id) => request(`/tasks/${id}`, { method: 'DELETE' }),
    reminders: () => request('/tasks/reminders'),
  },
};

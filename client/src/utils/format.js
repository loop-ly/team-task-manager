export const STATUSES = [
  { value: 'todo', label: 'To do', dot: 'bg-todo' },
  { value: 'in_progress', label: 'In progress', dot: 'bg-progress' },
  { value: 'done', label: 'Done', dot: 'bg-done' },
];

export const PRIORITIES = [
  { value: 'high', label: 'High', style: 'bg-danger-soft text-danger' },
  { value: 'medium', label: 'Medium', style: 'bg-amber-50 text-amber-700' },
  { value: 'low', label: 'Low', style: 'bg-canvas text-muted' },
];

export const priorityMeta = (value) => PRIORITIES.find((p) => p.value === value) || PRIORITIES[1];

const pad = (n) => String(n).padStart(2, '0');

/** Today as "YYYY-MM-DD" in the user's local timezone (what the date input uses). */
export function todayString() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Parses "YYYY-MM-DD" as a local date. `new Date("2026-11-03")` would be read as UTC
 * and can display the previous day in timezones behind UTC.
 */
function parseDate(value) {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDate(value) {
  if (!value) return '';
  const date = parseDate(value);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/** 'overdue' | 'soon' (today or tomorrow) | 'upcoming' | null */
export function dueState(value, status) {
  if (!value || status === 'done') return null;
  const days = Math.round((parseDate(value) - parseDate(todayString())) / 86_400_000);
  if (days < 0) return 'overdue';
  if (days <= 1) return 'soon';
  return 'upcoming';
}

export function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

const AVATAR_COLORS = [
  'bg-sky-100 text-sky-800',
  'bg-emerald-100 text-emerald-800',
  'bg-violet-100 text-violet-800',
  'bg-amber-100 text-amber-800',
  'bg-rose-100 text-rose-800',
  'bg-teal-100 text-teal-800',
];

/** Same name always gets the same colour. */
export function avatarColor(name = '') {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/** Turns an ApiError into one readable message, including field-level details. */
export function errorMessage(error) {
  if (error?.details?.length) return error.details.map((d) => d.message).join('. ');
  return error?.message || 'Something went wrong';
}

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { avatarColor, dueState, errorMessage, formatDate, initials, todayString } from './format';

describe('date helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 21, 12, 0, 0)); // 21 Oct 2026, local time
  });
  afterEach(() => vi.useRealTimers());

  it('todayString uses the local date in YYYY-MM-DD form', () => {
    expect(todayString()).toBe('2026-10-21');
  });

  it('dueState classifies deadlines', () => {
    expect(dueState('2026-10-20', 'todo')).toBe('overdue');
    expect(dueState('2026-10-21', 'in_progress')).toBe('soon');
    expect(dueState('2026-10-22', 'todo')).toBe('soon');
    expect(dueState('2026-10-23', 'todo')).toBe('upcoming');
  });

  it('dueState ignores finished tasks and missing dates', () => {
    expect(dueState('2026-10-01', 'done')).toBeNull();
    expect(dueState(null, 'todo')).toBeNull();
  });

  it('formatDate shows the right day and only adds the year when it differs', () => {
    expect(formatDate('2026-11-03')).toMatch(/3/);
    expect(formatDate('2026-11-03')).not.toMatch(/2026/);
    expect(formatDate('2027-01-05')).toMatch(/2027/);
    expect(formatDate('')).toBe('');
  });
});

describe('initials and avatar colours', () => {
  it('uses first and last name initials', () => {
    expect(initials('Maya Lopez')).toBe('ML');
    expect(initials('  ada   king  lovelace ')).toBe('AL');
    expect(initials('Cher')).toBe('C');
    expect(initials('')).toBe('?');
  });

  it('gives the same colour to the same name', () => {
    expect(avatarColor('Maya Lopez')).toBe(avatarColor('Maya Lopez'));
  });
});

describe('errorMessage', () => {
  it('joins field-level validation messages', () => {
    const error = { message: 'Validation failed', details: [{ message: 'title is required' }, { message: 'bad date' }] };
    expect(errorMessage(error)).toBe('title is required. bad date');
  });

  it('falls back to the error message, then a generic one', () => {
    expect(errorMessage(new Error('Nope'))).toBe('Nope');
    expect(errorMessage(undefined)).toBe('Something went wrong');
  });
});

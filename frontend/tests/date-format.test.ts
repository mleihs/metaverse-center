import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatDateTime,
  formatDateTimeShort,
  formatTime,
  formatTimestamp,
  formatElapsedMs,
  formatDateRange,
  formatShortDateRange,
  formatDateLabel,
} from '../src/utils/date-format.js';

// ── formatDate ───────────────────────────────────────────────────────────────

describe('formatDate', () => {
  it('formats a valid ISO date string', () => {
    const result = formatDate('2026-03-26T14:30:00Z', { locale: 'en-US' });
    expect(result).toContain('Mar');
    expect(result).toContain('26');
    expect(result).toContain('2026');
  });

  it('returns fallback for null', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDate(null, { fallback: 'N/A' })).toBe('N/A');
  });

  it('returns fallback for undefined', () => {
    expect(formatDate(undefined)).toBe('');
  });

  it('returns fallback for empty string', () => {
    expect(formatDate('')).toBe('');
  });
});

// ── formatDateTime ───────────────────────────────────────────────────────────

describe('formatDateTime', () => {
  it('includes date and time components', () => {
    const result = formatDateTime('2026-03-26T14:30:00Z', { locale: 'en-US' });
    expect(result).toContain('Mar');
    expect(result).toContain('26');
  });

  it('returns fallback for null', () => {
    expect(formatDateTime(null)).toBe('');
  });
});

// ── formatDateTimeShort ──────────────────────────────────────────────────────

describe('formatDateTimeShort', () => {
  it('returns a shorter format without year', () => {
    const result = formatDateTimeShort('2026-03-26T14:30:00Z', { locale: 'en-US' });
    expect(result).toContain('Mar');
    expect(result).not.toContain('2026');
  });

  it('returns fallback for null', () => {
    expect(formatDateTimeShort(null)).toBe('');
  });
});

// ── formatTime ───────────────────────────────────────────────────────────────

describe('formatTime', () => {
  it('returns time only', () => {
    const result = formatTime('2026-03-26T14:30:00Z', { locale: 'en-GB' });
    expect(result).toMatch(/\d{2}:\d{2}/);
  });

  it('returns fallback for null', () => {
    expect(formatTime(null)).toBe('');
  });
});

// ── formatTimestamp ──────────────────────────────────────────────────────────

describe('formatTimestamp', () => {
  it('returns DD.MM HH:MM format', () => {
    // Use a date that won't be affected by timezone
    const d = new Date(2026, 2, 26, 14, 30); // March 26, local time
    const result = formatTimestamp(d.toISOString());
    expect(result).toMatch(/\d{2}\.\d{2} \d{2}:\d{2}/);
  });
});

// ── formatElapsedMs ──────────────────────────────────────────────────────────

describe('formatElapsedMs', () => {
  it('formats 0ms as 00:00', () => {
    expect(formatElapsedMs(0)).toBe('00:00');
  });

  it('formats 90 seconds as 01:30', () => {
    expect(formatElapsedMs(90_000)).toBe('01:30');
  });

  it('formats 600 seconds as 10:00', () => {
    expect(formatElapsedMs(600_000)).toBe('10:00');
  });

  it('handles negative ms by clamping to 0', () => {
    expect(formatElapsedMs(-1000)).toBe('00:00');
  });
});

// ── formatDateRange ──────────────────────────────────────────────────────────

describe('formatDateRange', () => {
  it('uses en-dash separator', () => {
    const result = formatDateRange('2026-03-20', '2026-03-26', { locale: 'en-US' });
    expect(result).toContain('\u2013'); // en-dash
  });

  it('includes both start and end dates', () => {
    const result = formatDateRange('2026-03-20', '2026-03-26', { locale: 'en-US' });
    expect(result).toContain('20');
    expect(result).toContain('26');
  });
});

// ── formatShortDateRange ─────────────────────────────────────────────────────

describe('formatShortDateRange', () => {
  it('uses en-dash separator', () => {
    const result = formatShortDateRange('2026-03-20', '2026-03-26', { locale: 'en-US' });
    expect(result).toContain('\u2013');
  });
});

// ── formatDateLabel ──────────────────────────────────────────────────────────

describe('formatDateLabel', () => {
  it('returns "Today" for today\'s date', () => {
    const now = new Date();
    const result = formatDateLabel(now.toISOString());
    // msg('Today') in test context returns the source string
    expect(result).toBe('Today');
  });

  it('returns "Yesterday" for yesterday\'s date', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const result = formatDateLabel(yesterday.toISOString());
    expect(result).toBe('Yesterday');
  });

  it('returns formatted date for older dates', () => {
    const old = new Date(2025, 0, 15); // Jan 15 2025
    const result = formatDateLabel(old.toISOString());
    expect(result).toContain('Jan');
    expect(result).toContain('15');
  });
});

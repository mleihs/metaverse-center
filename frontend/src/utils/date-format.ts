/**
 * Shared date/time formatting utilities.
 *
 * Every component that needs to render a human-readable date or time
 * should import from here instead of defining its own private formatter.
 *
 * Locale handling:
 *  - Most formatters accept an optional `locale` parameter (BCP-47 string).
 *    When omitted the browser default (`undefined`) is used, which is correct
 *    for admin/internal surfaces.
 *  - Public-facing surfaces that need to follow the app locale should pass
 *    the result of `getDateLocale()`.
 */

import { msg, str } from '@lit/localize';
import { localeService } from '../services/i18n/locale-service.js';

// ── Locale helper ─────────────────────────────────────────────────────

/** Map the app locale to a BCP-47 date locale. */
export function getDateLocale(): string {
  return localeService.currentLocale === 'de' ? 'de-DE' : 'en-GB';
}

// ── Absolute formatters ───────────────────────────────────────────────

/**
 * Short date: "Mar 26, 2026"
 * Used by most listing/card UIs.
 *
 * Returns the `fallback` (default `''`) when the input is nullish or
 * unparseable.
 */
export function formatDate(
  dateStr: string | null | undefined,
  options?: { locale?: string; fallback?: string },
): string {
  const fallback = options?.fallback ?? '';
  if (!dateStr) return fallback;
  try {
    return new Date(dateStr).toLocaleDateString(options?.locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return fallback || dateStr;
  }
}

/**
 * Date + time: "Mar 26, 2026, 14:30"
 * Used by forge queues, resonance details, etc.
 */
export function formatDateTime(
  dateStr: string | null | undefined,
  options?: { locale?: string; fallback?: string },
): string {
  const fallback = options?.fallback ?? '';
  if (!dateStr) return fallback;
  try {
    return new Date(dateStr).toLocaleString(options?.locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return fallback || dateStr;
  }
}

/**
 * Short date + time (no year): "Mar 26, 14:30"
 * Used by Instagram/Bluesky admin tabs, invite panels.
 */
export function formatDateTimeShort(
  dateStr: string | null | undefined,
  options?: { locale?: string; fallback?: string },
): string {
  const fallback = options?.fallback ?? '';
  if (!dateStr) return fallback;
  try {
    return new Date(dateStr).toLocaleDateString(options?.locale, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return fallback || dateStr;
  }
}

/**
 * Full date with weekday: "Thursday, March 26, 2026, 14:30"
 * Used by event detail panels.
 */
export function formatDateFull(
  dateStr: string | null | undefined,
  options?: { locale?: string; fallback?: string },
): string {
  const fallback = options?.fallback ?? '';
  if (!dateStr) return fallback;
  try {
    return new Date(dateStr).toLocaleDateString(options?.locale, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return fallback || dateStr;
  }
}

/**
 * Time only: "14:30"
 * Used by chat panels, war room.
 */
export function formatTime(
  dateStr: string | null | undefined,
  options?: { locale?: string; fallback?: string },
): string {
  const fallback = options?.fallback ?? '';
  if (!dateStr) return fallback;
  try {
    return new Date(dateStr).toLocaleTimeString(options?.locale, {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return fallback || dateStr;
  }
}

/**
 * Compact timestamp: "26.03 14:30" (DD.MM HH:MM)
 * Used by agent life timelines.
 */
export function formatTimestamp(dateStr: string): string {
  const d = new Date(dateStr);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  const mon = (d.getMonth() + 1).toString().padStart(2, '0');
  return `${day}.${mon} ${h}:${m}`;
}

// ── Relative formatters ───────────────────────────────────────────────

/**
 * Compact relative time: "Now" / "5m" / "3h" / "2d" / "Mar 26"
 * Used by conversation lists.
 */
export function formatRelativeTime(
  dateStr: string | undefined,
  options?: { locale?: string },
): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return msg('Now');
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;

    return date.toLocaleDateString(options?.locale, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

/**
 * Verbose relative time: "Just now" / "5m ago" / "3h ago" / "2d ago" / "Mar 26, 14:30"
 * Used by message lists.
 */
export function formatRelativeTimeVerbose(
  dateStr: string | null | undefined,
  options?: { locale?: string },
): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return msg('Just now');
    if (diffMins < 60) return msg(str`${diffMins}m ago`);
    if (diffHours < 24) return msg(str`${diffHours}h ago`);
    if (diffDays < 7) return msg(str`${diffDays}d ago`);

    return date.toLocaleDateString(options?.locale, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

/**
 * Date separator label: "Today" / "Yesterday" / "Mon, Mar 26"
 * Used by chat message lists.
 */
export function formatDateLabel(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.round((today.getTime() - target.getTime()) / 86400000);

    if (diffDays === 0) return msg('Today');
    if (diffDays === 1) return msg('Yesterday');

    return date.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

// ── Range formatters ──────────────────────────────────────────────────

/**
 * Date range: "Mar 20, 2026 - Mar 26, 2026"
 * Uses en-dash (\u2013) as separator.
 */
export function formatDateRange(start: string, end: string, options?: { locale?: string }): string {
  const locale = options?.locale;
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  const s = new Date(start);
  const e = new Date(end);
  return `${s.toLocaleDateString(locale, opts)} \u2013 ${e.toLocaleDateString(locale, opts)}`;
}

/**
 * Short date range (no year): "Mar 20 - Mar 26"
 * Uses en-dash (\u2013) as separator.
 */
export function formatShortDateRange(
  start: string,
  end: string,
  options?: { locale?: string },
): string {
  const locale = options?.locale;
  const o: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const s = new Date(start);
  const e = new Date(end);
  return `${s.toLocaleDateString(locale, o)} \u2013 ${e.toLocaleDateString(locale, o)}`;
}

// ── Timer formatters ──────────────────────────────────────────────────

/**
 * Format elapsed milliseconds as MM:SS.
 * Used by scan overlay timer displays.
 */
export function formatElapsedMs(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

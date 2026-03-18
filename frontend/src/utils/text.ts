/**
 * Text utilities for display formatting.
 */

// ── Number Formatting ────────────────────────────────────────────

/** Format a 0–1 value as a percentage string (e.g. 0.483 → "48%"). */
export function formatPercent(value: number, decimals = 0): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/** Format a signed delta (e.g. +0.05 → "+5%", -0.12 → "−12%"). */
export function formatDelta(value: number, decimals = 0): string {
  const sign = value >= 0 ? '+' : '−';
  return `${sign}${Math.abs(value * 100).toFixed(decimals)}%`;
}

/** Format tick count as human-readable duration (e.g. 3 ticks × 8h = "1d"). */
export function formatTickDuration(ticks: number, hoursPerTick = 8): string {
  const totalHours = ticks * hoursPerTick;
  if (totalHours < 24) return `${totalHours}h`;
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
}

/** Convert a snake_case or SCREAMING_SNAKE enum value to Title Case. */
export function humanizeEnum(value: string): string {
  return value
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/** Build descriptive alt text for an agent portrait from available fields. */
export function agentAltText(agent: {
  name: string;
  character?: string;
  background?: string;
  primary_profession?: string;
}): string {
  const parts = [`Portrait of ${agent.name}`];
  if (agent.primary_profession) parts.push(agent.primary_profession);
  if (agent.character) parts.push(agent.character);
  if (agent.background) parts.push(agent.background);
  return parts.join(' — ');
}

/** Build descriptive alt text for a building image from available fields. */
/** Return singular or plural form based on count. */
export function pluralCount(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function buildingAltText(building: {
  name: string;
  building_type?: string;
  description?: string;
  building_condition?: string;
  zone?: { name: string } | null;
}): string {
  const parts = [building.name];
  if (building.building_type) parts.push(building.building_type);
  if (building.zone?.name) parts.push(`in ${building.zone.name}`);
  if (building.description) parts.push(building.description);
  if (building.building_condition) parts.push(`condition: ${building.building_condition}`);
  return parts.join(' — ');
}

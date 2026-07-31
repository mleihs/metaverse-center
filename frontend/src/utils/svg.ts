/**
 * Shared SVG geometry utilities for circular gauges and arc paths.
 * Used by: MapGraph (allegiance rings), AgentMoodPanel (mood gauge + radar).
 */

/** Project polar coordinates (SVG gauge convention: 0° = 12 o'clock) to cartesian. */
export function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number,
): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/**
 * SVG arc path between two angles (degrees, clockwise from 12 o'clock).
 *
 * The path deliberately runs from the END angle back to the START angle with
 * sweep flag 0 — the drawing direction the MapGraph and AgentMoodPanel gauges
 * were built against (stroke-dash animations follow path direction). Keep
 * this orientation when adding callers.
 */
export function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

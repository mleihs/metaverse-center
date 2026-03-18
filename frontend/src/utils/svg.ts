/**
 * Shared SVG utilities for circular gauges, arcs, and progress indicators.
 * Used by: AnchorDashboard, SimulationHealthView.
 */

/** Compute an SVG arc path from center (cx,cy) with radius r between two angles (degrees). */
export function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const rad = (deg: number) => ((deg - 90) * Math.PI) / 180;
  const x1 = cx + r * Math.cos(rad(startAngle));
  const y1 = cy + r * Math.sin(rad(startAngle));
  const x2 = cx + r * Math.cos(rad(endAngle));
  const y2 = cy + r * Math.sin(rad(endAngle));
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

/** Compute SVG dasharray offset for a circular progress indicator. */
export function circularProgress(
  radius: number,
  progress: number,
): { circumference: number; dashoffset: number } {
  const circumference = 2 * Math.PI * radius;
  const dashoffset = circumference * (1 - Math.max(0, Math.min(1, progress)));
  return { circumference, dashoffset };
}

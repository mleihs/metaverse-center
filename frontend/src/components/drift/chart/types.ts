export const FREQ_NAMES = [
  'Handel',
  'Sprache',
  'Gedächtnis',
  'Resonanz',
  'Architektur',
  'Traum',
  'Begehren',
] as const;

export const NODE_TYPE_NAMES = [
  'Wegpunkt',
  'Relais',
  'Echo-Untiefe',
  'Geisterinsel',
  'Träger-Wrack',
  'Splitterfänger-Revier',
  'Resonanzsturm',
] as const;

export interface SimSpec {
  code: string;
  name: string;
  x: number;
  y: number;
  radius: number;
  colorA: string;
  colorB: string;
  /** 0 Velgarien lattice, 1 Gaslit smear, 2 Null pulse, 3 Speranza heartbeat, 4 Cité dawn */
  style: number;
  /** Background light-field contribution; negative = eats light (Station Null). */
  light: number;
}

export interface CorridorSpec {
  a: number;
  b: number;
  /** Bit i set = passable on frequency i. */
  mask: number;
  strength: number;
  /** Perpendicular bow of the bezier control point, world units. */
  bow: number;
}

export interface NodeSpec {
  x: number;
  y: number;
  size: number;
  type: number;
  mask: number;
  seed: number;
  name: string;
}

export interface ChartData {
  sims: SimSpec[];
  corridors: CorridorSpec[];
  nodes: NodeSpec[];
}

export interface FrameCtx {
  time: number;
  dt: number;
  /** Continuous tuning 0..6 across the seven bleed vectors. */
  tune: number;
  /** 0..1 */
  dissonance: number;
  unitsPerPixel: number;
  camCenter: { x: number; y: number };
  viewHeight: number;
  hoverIndex: number;
}

/** Crossfaded visibility of a frequency mask at continuous tuning — mirrors the node shader. */
export function maskVisibility(mask: number, tune: number): number {
  const f0 = Math.floor(tune);
  const f1 = Math.min(f0 + 1, 6);
  const t = smoothstep(tune - f0);
  const v0 = (mask >> f0) & 1;
  const v1 = (mask >> f1) & 1;
  return v0 * (1 - t) + v1 * t;
}

export function smoothstep(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

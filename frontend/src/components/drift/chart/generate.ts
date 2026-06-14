import type { ChartData, CorridorSpec, NodeSpec, SimSpec } from './types';

/** The five canonical worlds, laid out for chart aesthetics (would come from the multiverse force layout). */
const SIMS: SimSpec[] = [
  {
    code: 'VG',
    name: 'Velgarien',
    x: -650,
    y: 120,
    radius: 340,
    colorA: '#a8dcff',
    colorB: '#e8f6ff',
    style: 0,
    light: 1.0,
  },
  {
    code: 'GR',
    name: 'The Gaslit Reach',
    x: 180,
    y: -420,
    radius: 300,
    colorA: '#ffb45f',
    colorB: '#46d8c4',
    style: 1,
    light: 0.9,
  },
  {
    code: 'SN',
    name: 'Station Null',
    x: 1250,
    y: 760,
    radius: 150,
    colorA: '#b48fff',
    colorB: '#7a5fd0',
    style: 2,
    light: -0.7,
  },
  {
    code: 'SP',
    name: 'Speranza',
    x: 760,
    y: -40,
    radius: 240,
    colorA: '#ff8f6a',
    colorB: '#ffc89a',
    style: 3,
    light: 0.75,
  },
  {
    code: 'CD',
    name: 'Cité des Dames',
    x: -1050,
    y: 620,
    radius: 260,
    colorA: '#ffd9a0',
    colorB: '#ff9fb0',
    style: 4,
    light: 0.85,
  },
];

/** Bits: 0 Handel, 1 Sprache, 2 Gedächtnis, 3 Resonanz, 4 Architektur, 5 Traum, 6 Begehren. */
const CORRIDORS: CorridorSpec[] = [
  { a: 0, b: 1, mask: 0b0000110, strength: 1.0, bow: 120 }, // VG↔GR memory+language — the P0 pair
  { a: 0, b: 4, mask: 0b0000010, strength: 0.7, bow: -90 }, // VG↔CD language
  { a: 1, b: 3, mask: 0b0010001, strength: 0.8, bow: 80 }, // GR↔SP commerce+architecture
  { a: 4, b: 3, mask: 0b0000100, strength: 0.5, bow: 220 }, // CD↔SP memory
  { a: 0, b: 2, mask: 0b0101000, strength: 0.45, bow: 200 }, // VG↔SN resonance+dream, long and thin
  { a: 1, b: 4, mask: 0b0100000, strength: 0.4, bow: 140 }, // GR↔CD dream
  { a: 3, b: 2, mask: 0b1000000, strength: 0.35, bow: -110 }, // SP↔SN desire — the rare layer
];

const TYPE_ABBR = ['W', 'R', 'E', 'G', 'X', 'S', 'T'];

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function corridorPoint(
  c: CorridorSpec,
  sims: SimSpec[],
  t: number,
): { x: number; y: number } {
  const A = sims[c.a];
  const B = sims[c.b];
  const mx = (A.x + B.x) / 2;
  const my = (A.y + B.y) / 2;
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const len = Math.hypot(dx, dy) || 1;
  const px = (-dy / len) * c.bow;
  const py = (dx / len) * c.bow;
  const cx = mx + px;
  const cy = my + py;
  const u = 1 - t;
  return {
    x: u * u * A.x + 2 * u * t * cx + t * t * B.x,
    y: u * u * A.y + 2 * u * t * cy + t * t * B.y,
  };
}

function pickWeighted(rand: () => number, weights: number[]): number {
  let r = rand() * weights.reduce((s, w) => s + w, 0);
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

function gauss(rand: () => number): number {
  return rand() + rand() + rand() - 1.5;
}

const TYPE_SIZE: Array<(r: number) => number> = [
  (r) => 7 + 5 * r, // Wegpunkt
  (r) => 13 + 4 * r, // Relais
  (r) => 9 + 5 * r, // Echo-Untiefe
  (r) => 10 + 4 * r, // Geisterinsel
  (r) => 8 + 3 * r, // Wrack
  (r) => 9 + 4 * r, // Splitterfänger
  (r) => 12 + 6 * r, // Resonanzsturm
];

export function generateChart(seed: number, nodeCount: number): ChartData {
  const rand = mulberry32(seed);
  const nodes: NodeSpec[] = [];

  // Per-sim frequency identity = union of its corridors' vectors.
  const simMasks = SIMS.map((_, i) =>
    CORRIDORS.filter((c) => c.a === i || c.b === i).reduce((m, c) => m | c.mask, 0),
  );

  const corridorWeights = CORRIDORS.map((c) => c.strength);
  const coreTypes = [0.56, 0.1, 0.12, 0.08, 0.05, 0.05, 0.04];
  const frontierTypes = [0.34, 0.06, 0.12, 0.18, 0.1, 0.09, 0.11];
  const frontierBits = [0.07, 0.07, 0.1, 0.12, 0.09, 0.27, 0.28]; // dream/desire-heavy out there

  const nCorridor = Math.round(nodeCount * 0.55);
  const nHalo = Math.round(nodeCount * 0.2);
  const nFrontier = nodeCount - nCorridor - nHalo;

  const push = (x: number, y: number, type: number, mask: number, region: string) => {
    if (mask === 0) mask = 1 << pickWeighted(rand, frontierBits);
    const idx = nodes.length;
    nodes.push({
      x,
      y,
      size: TYPE_SIZE[type](rand()),
      type,
      mask,
      seed: rand(),
      name: `${region}-${TYPE_ABBR[type]}${String(idx).padStart(3, '0')}`,
    });
  };

  // Interstitial tissue along the Strömungsbänder.
  for (let i = 0; i < nCorridor; i++) {
    const c = CORRIDORS[pickWeighted(rand, corridorWeights)];
    const t = 0.06 + 0.88 * rand();
    const p = corridorPoint(c, SIMS, t);
    const sigma = 70 + 60 * rand();
    const x = p.x + gauss(rand) * sigma;
    const y = p.y + gauss(rand) * sigma;
    let mask = c.mask;
    if (rand() < 0.3) mask |= 1 << Math.floor(rand() * 7);
    const near = t < 0.5 ? SIMS[c.a] : SIMS[c.b];
    push(x, y, pickWeighted(rand, coreTypes), mask, near.code);
  }

  // Halos around the broadcast glows.
  for (let i = 0; i < nHalo; i++) {
    const si = Math.floor(rand() * SIMS.length);
    const s = SIMS[si];
    const ang = rand() * Math.PI * 2;
    const dist = s.radius * (0.9 + 1.3 * rand());
    let mask = simMasks[si];
    if (rand() < 0.25) mask |= 1 << Math.floor(rand() * 7);
    push(
      s.x + Math.cos(ang) * dist,
      s.y + Math.sin(ang) * dist,
      pickWeighted(rand, coreTypes),
      mask,
      s.code,
    );
  }

  // Frontier ring — rarer, stranger, tuned to dream/desire.
  for (let i = 0; i < nFrontier; i++) {
    const ang = rand() * Math.PI * 2;
    const dist = 1350 + 850 * rand();
    const x = 100 + Math.cos(ang) * dist * 1.15;
    const y = 150 + Math.sin(ang) * dist * 0.78;
    let mask = 1 << pickWeighted(rand, frontierBits);
    if (rand() < 0.35) mask |= 1 << pickWeighted(rand, frontierBits);
    push(x, y, pickWeighted(rand, frontierTypes), mask, 'ZR');
  }

  return { sims: SIMS, corridors: CORRIDORS, nodes };
}

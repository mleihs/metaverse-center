/**
 * Procedural SVG placeholders for the Forge Table.
 *
 * 12 operative dossier silhouettes + 14 building blueprint silhouettes.
 * Green-phosphor CRT aesthetic matching the forge's visual identity.
 * Each is a self-contained SVG data URI — zero network requests.
 */

// ══════════════════════════════════════════════════════════════════════
//  OPERATIVE PLACEHOLDERS (12)
// ══════════════════════════════════════════════════════════════════════

interface SilhouetteParams {
  headRx: number;
  headRy: number;
  headCy: number;
  shoulderW: number;
  neckW: number;
  extras: string;
}

const SILHOUETTES: SilhouetteParams[] = [
  // 0 — Standard operative
  { headRx: 30, headRy: 36, headCy: 120, shoulderW: 82, neckW: 14, extras: '' },
  // 1 — Broad enforcer
  { headRx: 33, headRy: 32, headCy: 118, shoulderW: 95, neckW: 18, extras: '' },
  // 2 — Lean infiltrator
  { headRx: 26, headRy: 40, headCy: 115, shoulderW: 65, neckW: 12, extras: '' },
  // 3 — Hooded shadow
  {
    headRx: 30, headRy: 36, headCy: 122, shoulderW: 80, neckW: 14,
    extras: `<path d="M100,78 C60,78 48,110 50,155 L70,150 C68,118 72,92 100,88 C128,92 132,118 130,150 L150,155 C152,110 140,78 100,78Z" fill="#0a160a" opacity="0.9"/>`,
  },
  // 4 — Field cap
  {
    headRx: 30, headRy: 35, headCy: 122, shoulderW: 78, neckW: 14,
    extras: `<rect x="65" y="83" width="70" height="12" rx="2" fill="#0a160a"/><rect x="58" y="93" width="84" height="5" rx="1" fill="#0a160a"/>`,
  },
  // 5 — Spiky hair (cyber)
  {
    headRx: 28, headRy: 36, headCy: 120, shoulderW: 76, neckW: 13,
    extras: `<path d="M80,85 L76,68 L85,82 L82,62 L92,78 L90,56 L100,76 L108,56 L110,78 L118,62 L115,82 L124,68 L120,85" fill="#0a160a"/>`,
  },
  // 6 — Long-haired agent
  {
    headRx: 29, headRy: 37, headCy: 118, shoulderW: 74, neckW: 13,
    extras: `<path d="M68,118 C62,135 56,165 52,210 L60,208 C63,170 66,145 70,125Z" fill="#0a160a" opacity="0.85"/><path d="M132,118 C138,135 144,165 148,210 L140,208 C137,170 134,145 130,125Z" fill="#0a160a" opacity="0.85"/>`,
  },
  // 7 — High-collar operative
  {
    headRx: 30, headRy: 35, headCy: 120, shoulderW: 80, neckW: 14,
    extras: `<path d="M78,158 C78,148 84,140 86,155Z" fill="#0a160a"/><path d="M122,158 C122,148 116,140 114,155Z" fill="#0a160a"/><rect x="82" y="148" width="36" height="18" fill="#0a160a"/>`,
  },
  // 8 — Bald, broad-jawed
  { headRx: 34, headRy: 30, headCy: 118, shoulderW: 88, neckW: 17, extras: '' },
  // 9 — Visor/goggles
  {
    headRx: 30, headRy: 36, headCy: 120, shoulderW: 80, neckW: 14,
    extras: `<rect x="68" y="112" width="64" height="10" rx="5" fill="#060e06" stroke="#1a3a1a" stroke-width="1" opacity="0.8"/>`,
  },
  // 10 — Mohawk ridge
  {
    headRx: 28, headRy: 36, headCy: 120, shoulderW: 78, neckW: 14,
    extras: `<rect x="95" y="76" width="10" height="14" rx="2" fill="#0a160a"/>`,
  },
  // 11 — Headband/bandana
  {
    headRx: 30, headRy: 36, headCy: 120, shoulderW: 80, neckW: 14,
    extras: `<rect x="68" y="100" width="64" height="6" rx="1" fill="#0d1a0d" stroke="#1a3a1a" stroke-width="0.5"/><path d="M132,100 L142,108 L140,112 L132,106Z" fill="#0d1a0d"/>`,
  },
];

// ── Pattern definitions ──────────────────────────────────────────────

type PatternType = 'scanlines' | 'grid' | 'dots' | 'diagonal';

function patternDef(type: PatternType, id: string): string {
  switch (type) {
    case 'scanlines':
      return `<pattern id="${id}" width="200" height="3" patternUnits="userSpaceOnUse"><rect width="200" height="1" fill="#22c55e"/></pattern>`;
    case 'grid':
      return `<pattern id="${id}" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20,0L0,0 0,20" fill="none" stroke="#22c55e" stroke-width="0.3"/></pattern>`;
    case 'dots':
      return `<pattern id="${id}" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="0.6" fill="#22c55e"/></pattern>`;
    case 'diagonal':
      return `<pattern id="${id}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="0.5" fill="#22c55e"/></pattern>`;
  }
}

// ── Operative variant presets ────────────────────────────────────────

interface OperativeVariant {
  silhouetteIdx: number;
  pattern: PatternType;
  accent: string;
  label: string;
  code: string;
}

const OP_VARIANTS: OperativeVariant[] = [
  { silhouetteIdx: 0, pattern: 'scanlines', accent: '#22c55e', label: 'CLASSIFIED', code: 'SPECTER-7A' },
  { silhouetteIdx: 1, pattern: 'grid',      accent: '#4ade80', label: 'RESTRICTED', code: 'IRON-12' },
  { silhouetteIdx: 2, pattern: 'dots',      accent: '#14b8a6', label: 'CLASSIFIED', code: 'WRAITH-3X' },
  { silhouetteIdx: 3, pattern: 'diagonal',  accent: '#22c55e', label: 'TOP SECRET', code: 'SHADOW-09' },
  { silhouetteIdx: 4, pattern: 'scanlines', accent: '#2dd4bf', label: 'RESTRICTED', code: 'VIPER-4K' },
  { silhouetteIdx: 5, pattern: 'grid',      accent: '#10b981', label: 'CLASSIFIED', code: 'CIPHER-21' },
  { silhouetteIdx: 6, pattern: 'dots',      accent: '#34d399', label: 'TOP SECRET', code: 'ORACLE-6F' },
  { silhouetteIdx: 7, pattern: 'diagonal',  accent: '#22c55e', label: 'CLASSIFIED', code: 'COBALT-15' },
  { silhouetteIdx: 8, pattern: 'scanlines', accent: '#4ade80', label: 'RESTRICTED', code: 'TITAN-8R' },
  { silhouetteIdx: 9, pattern: 'grid',      accent: '#14b8a6', label: 'TOP SECRET', code: 'GHOST-02' },
  { silhouetteIdx: 10, pattern: 'dots',     accent: '#10b981', label: 'CLASSIFIED', code: 'RAVEN-11' },
  { silhouetteIdx: 11, pattern: 'diagonal', accent: '#2dd4bf', label: 'RESTRICTED', code: 'FLUX-7Z' },
];

// ── SVG builders ─────────────────────────────────────────────────────

function buildSilhouettePath(s: SilhouetteParams): string {
  const cx = 100;
  const { headRx, headRy, headCy: cy, shoulderW, neckW } = s;
  const bodyTop = cy + headRy + 12;
  return [
    `M${cx - shoulderW},320`,
    `L${cx - shoulderW},${bodyTop + 48}`,
    `Q${cx - shoulderW + 12},${bodyTop + 4} ${cx - neckW},${bodyTop}`,
    `L${cx - neckW},${cy + headRy}`,
    `A${headRx},${headRy} 0 1,1 ${cx + neckW},${cy + headRy}`,
    `L${cx + neckW},${bodyTop}`,
    `Q${cx + shoulderW - 12},${bodyTop + 4} ${cx + shoulderW},${bodyTop + 48}`,
    `L${cx + shoulderW},320Z`,
  ].join(' ');
}

function svgWrapper(
  inner: string,
  accent: string,
  label: string,
  code: string,
  patternType: PatternType,
): string {
  const pid = 'p';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 320">
<defs>
${patternDef(patternType, pid)}
<radialGradient id="g" cx="50%" cy="38%" r="55%">
<stop offset="0%" stop-color="${accent}" stop-opacity="0.1"/>
<stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
</radialGradient>
<linearGradient id="v" x1="0" y1="0" x2="0" y2="1">
<stop offset="0%" stop-color="#000" stop-opacity="0.35"/>
<stop offset="35%" stop-color="#000" stop-opacity="0"/>
<stop offset="75%" stop-color="#000" stop-opacity="0"/>
<stop offset="100%" stop-color="#000" stop-opacity="0.55"/>
</linearGradient>
</defs>
<rect width="200" height="320" fill="#050a05"/>
<rect width="200" height="320" fill="url(#g)"/>
<rect width="200" height="320" fill="url(#${pid})" opacity="0.12"/>
${inner}
<rect width="200" height="320" fill="url(#v)"/>
<rect x="4" y="4" width="192" height="312" fill="none" stroke="${accent}" stroke-width="0.5" opacity="0.18"/>
<text x="10" y="18" font-family="monospace" font-size="7" fill="${accent}" opacity="0.45" letter-spacing="0.12em">${label}</text>
<text x="10" y="310" font-family="monospace" font-size="6" fill="${accent}" opacity="0.25">${code}</text>
<text x="190" y="310" font-family="monospace" font-size="6" fill="${accent}" opacity="0.25" text-anchor="end">DOSSIER</text>
</svg>`;
}

function buildOperativeSvg(v: OperativeVariant): string {
  const s = SILHOUETTES[v.silhouetteIdx];
  const silPath = buildSilhouettePath(s);
  const inner = `<path d="${silPath}" fill="#0b150b"/>${s.extras}<path d="${silPath}" fill="none" stroke="${v.accent}" stroke-width="0.6" opacity="0.25"/>`;
  return svgWrapper(inner, v.accent, v.label, v.code, v.pattern);
}

// ══════════════════════════════════════════════════════════════════════
//  BUILDING PLACEHOLDERS (14)
// ══════════════════════════════════════════════════════════════════════

interface BuildingSilhouette {
  path: string;
  extras: string;
}

const BUILDINGS: BuildingSilhouette[] = [
  // 0 — Monolithic tower
  {
    path: 'M70,320 L70,80 L80,60 L120,60 L130,80 L130,320Z',
    extras: `<rect x="82" y="90" width="12" height="8" fill="#060e06" opacity="0.6"/><rect x="106" y="90" width="12" height="8" fill="#060e06" opacity="0.6"/><rect x="82" y="110" width="12" height="8" fill="#060e06" opacity="0.6"/><rect x="106" y="110" width="12" height="8" fill="#060e06" opacity="0.6"/><rect x="82" y="130" width="12" height="8" fill="#060e06" opacity="0.6"/><rect x="106" y="130" width="12" height="8" fill="#060e06" opacity="0.6"/>`,
  },
  // 1 — Industrial complex (wide, low)
  {
    path: 'M20,320 L20,160 L50,160 L50,120 L70,120 L70,100 L130,100 L130,120 L150,120 L150,160 L180,160 L180,320Z',
    extras: `<rect x="55" y="108" width="8" height="12" fill="#060e06" opacity="0.5"/><rect x="80" y="108" width="8" height="12" fill="#060e06" opacity="0.5"/><rect x="112" y="108" width="8" height="12" fill="#060e06" opacity="0.5"/><path d="M140,100 L145,70 L150,100" fill="none" stroke="#0d1a0d" stroke-width="2"/>`,
  },
  // 2 — Domed structure
  {
    path: 'M40,320 L40,180 Q40,80 100,60 Q160,80 160,180 L160,320Z',
    extras: `<ellipse cx="100" cy="180" rx="55" ry="4" fill="none" stroke="#0d1a0d" stroke-width="1" opacity="0.5"/>`,
  },
  // 3 — Pyramid
  {
    path: 'M20,320 L100,50 L180,320Z',
    extras: `<path d="M60,200 L100,50 L140,200" fill="none" stroke="#0d1a0d" stroke-width="0.5" opacity="0.4"/><line x1="20" y1="320" x2="180" y2="320" stroke="#0d1a0d" stroke-width="1"/>`,
  },
  // 4 — Warehouse / hangar
  {
    path: 'M25,320 L25,140 Q100,60 175,140 L175,320Z',
    extras: `<rect x="75" y="240" width="50" height="80" fill="#060e06" opacity="0.4"/><line x1="100" y1="240" x2="100" y2="320" stroke="#0a160a" stroke-width="1"/>`,
  },
  // 5 — Gothic spire
  {
    path: 'M75,320 L75,120 L85,120 L85,80 L95,80 L95,50 L100,20 L105,50 L105,80 L115,80 L115,120 L125,120 L125,320Z',
    extras: `<rect x="88" y="200" width="24" height="40" rx="12" fill="#060e06" opacity="0.5"/><circle cx="100" cy="100" r="8" fill="none" stroke="#0d1a0d" stroke-width="0.5" opacity="0.5"/>`,
  },
  // 6 — Bunker / fortification
  {
    path: 'M15,320 L15,200 L30,180 L170,180 L185,200 L185,320Z',
    extras: `<rect x="35" y="188" width="20" height="10" fill="#060e06" opacity="0.5"/><rect x="90" y="188" width="20" height="10" fill="#060e06" opacity="0.5"/><rect x="145" y="188" width="20" height="10" fill="#060e06" opacity="0.5"/><rect x="15" y="196" width="170" height="2" fill="#0d1a0d" opacity="0.3"/>`,
  },
  // 7 — Radio tower / antenna
  {
    path: 'M85,320 L85,280 L60,280 L95,30 L105,30 L140,280 L115,280 L115,320Z',
    extras: `<line x1="72" y1="160" x2="128" y2="160" stroke="#0d1a0d" stroke-width="1" opacity="0.5"/><line x1="78" y1="200" x2="122" y2="200" stroke="#0d1a0d" stroke-width="1" opacity="0.5"/><line x1="84" y1="240" x2="116" y2="240" stroke="#0d1a0d" stroke-width="1" opacity="0.5"/><circle cx="100" cy="30" r="3" fill="#0d1a0d"/>`,
  },
  // 8 — Observatory dome
  {
    path: 'M35,320 L35,180 L165,180 L165,320Z',
    extras: `<path d="M35,180 Q35,100 100,70 Q165,100 165,180" fill="#0b150b" stroke="#0d1a0d" stroke-width="0.5"/><line x1="100" y1="70" x2="100" y2="40" stroke="#0d1a0d" stroke-width="2"/><rect x="70" y="210" width="60" height="40" fill="#060e06" opacity="0.3"/>`,
  },
  // 9 — Skyscraper (stepped)
  {
    path: 'M55,320 L55,200 L65,200 L65,140 L75,140 L75,80 L125,80 L125,140 L135,140 L135,200 L145,200 L145,320Z',
    extras: `<rect x="85" y="90" width="6" height="6" fill="#060e06" opacity="0.5"/><rect x="109" y="90" width="6" height="6" fill="#060e06" opacity="0.5"/><rect x="85" y="106" width="6" height="6" fill="#060e06" opacity="0.5"/><rect x="109" y="106" width="6" height="6" fill="#060e06" opacity="0.5"/><rect x="85" y="122" width="6" height="6" fill="#060e06" opacity="0.5"/>`,
  },
  // 10 — Brutalist cube
  {
    path: 'M30,320 L30,100 L170,100 L170,320Z',
    extras: `<line x1="30" y1="140" x2="170" y2="140" stroke="#0d1a0d" stroke-width="0.5" opacity="0.4"/><line x1="30" y1="180" x2="170" y2="180" stroke="#0d1a0d" stroke-width="0.5" opacity="0.4"/><line x1="30" y1="220" x2="170" y2="220" stroke="#0d1a0d" stroke-width="0.5" opacity="0.4"/><line x1="100" y1="100" x2="100" y2="320" stroke="#0d1a0d" stroke-width="0.5" opacity="0.3"/>`,
  },
  // 11 — Factory with smokestacks
  {
    path: 'M20,320 L20,160 L180,160 L180,320Z',
    extras: `<rect x="40" y="80" width="14" height="80" fill="#0b150b"/><rect x="70" y="100" width="14" height="60" fill="#0b150b"/><rect x="40" y="76" width="14" height="6" fill="#0a160a"/><rect x="70" y="96" width="14" height="6" fill="#0a160a"/><path d="M42,80 C38,60 35,40 40,30" fill="none" stroke="#0d1a0d" stroke-width="1" opacity="0.3"/>`,
  },
  // 12 — Bridge / overpass
  {
    path: 'M0,220 L10,200 L40,200 Q50,200 50,210 L50,260 Q50,320 30,320 L0,320Z M200,220 L190,200 L160,200 Q150,200 150,210 L150,260 Q150,320 170,320 L200,320Z',
    extras: `<rect x="0" y="196" width="200" height="8" fill="#0b150b"/><line x1="50" y1="204" x2="150" y2="204" stroke="#0d1a0d" stroke-width="0.5" opacity="0.4"/><path d="M50,260 Q100,300 150,260" fill="none" stroke="#0b150b" stroke-width="2"/>`,
  },
  // 13 — Citadel / castle
  {
    path: 'M30,320 L30,180 L40,180 L40,140 L50,140 L50,180 L70,180 L70,100 L130,100 L130,180 L150,180 L150,140 L160,140 L160,180 L170,180 L170,320Z',
    extras: `<rect x="42" y="132" width="6" height="8" fill="#060e06" opacity="0.5"/><rect x="152" y="132" width="6" height="8" fill="#060e06" opacity="0.5"/><rect x="85" y="240" width="30" height="80" rx="15" fill="#060e06" opacity="0.4"/><rect x="90" y="108" width="20" height="14" fill="#060e06" opacity="0.4"/>`,
  },
];

interface BuildingVariant {
  buildingIdx: number;
  pattern: PatternType;
  accent: string;
  label: string;
  code: string;
}

const BLD_VARIANTS: BuildingVariant[] = [
  { buildingIdx: 0,  pattern: 'grid',      accent: '#22c55e', label: 'SECTOR A-7',  code: 'TOWER-01' },
  { buildingIdx: 1,  pattern: 'scanlines', accent: '#14b8a6', label: 'INDUSTRIAL',  code: 'PLANT-3K' },
  { buildingIdx: 2,  pattern: 'dots',      accent: '#4ade80', label: 'CLASSIFIED',   code: 'DOME-09' },
  { buildingIdx: 3,  pattern: 'diagonal',  accent: '#10b981', label: 'RESTRICTED',   code: 'APEX-12' },
  { buildingIdx: 4,  pattern: 'scanlines', accent: '#2dd4bf', label: 'DEPOT',        code: 'BAY-4F' },
  { buildingIdx: 5,  pattern: 'grid',      accent: '#22c55e', label: 'SECTOR C-2',  code: 'SPIRE-07' },
  { buildingIdx: 6,  pattern: 'dots',      accent: '#34d399', label: 'FORTIFIED',    code: 'BASTION-5' },
  { buildingIdx: 7,  pattern: 'diagonal',  accent: '#14b8a6', label: 'COMMS ARRAY', code: 'RELAY-8X' },
  { buildingIdx: 8,  pattern: 'scanlines', accent: '#4ade80', label: 'SECTOR D-1',  code: 'LENS-02' },
  { buildingIdx: 9,  pattern: 'grid',      accent: '#10b981', label: 'COMMERCIAL',   code: 'MONOLITH-6' },
  { buildingIdx: 10, pattern: 'dots',      accent: '#22c55e', label: 'SECTOR B-9',  code: 'BLOCK-11' },
  { buildingIdx: 11, pattern: 'diagonal',  accent: '#2dd4bf', label: 'INDUSTRIAL',  code: 'FORGE-3A' },
  { buildingIdx: 12, pattern: 'scanlines', accent: '#34d399', label: 'TRANSIT',      code: 'SPAN-14' },
  { buildingIdx: 13, pattern: 'grid',      accent: '#14b8a6', label: 'FORTIFIED',    code: 'KEEP-7R' },
];

function buildBuildingSvg(v: BuildingVariant): string {
  const b = BUILDINGS[v.buildingIdx];
  const inner = `<path d="${b.path}" fill="#0b150b"/>${b.extras}<path d="${b.path}" fill="none" stroke="${v.accent}" stroke-width="0.5" opacity="0.2"/>`;

  const pid = 'p';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 320">
<defs>
${patternDef(v.pattern, pid)}
<radialGradient id="g" cx="50%" cy="50%" r="60%">
<stop offset="0%" stop-color="${v.accent}" stop-opacity="0.08"/>
<stop offset="100%" stop-color="${v.accent}" stop-opacity="0"/>
</radialGradient>
<linearGradient id="v" x1="0" y1="0" x2="0" y2="1">
<stop offset="0%" stop-color="#000" stop-opacity="0.4"/>
<stop offset="40%" stop-color="#000" stop-opacity="0"/>
<stop offset="80%" stop-color="#000" stop-opacity="0"/>
<stop offset="100%" stop-color="#000" stop-opacity="0.5"/>
</linearGradient>
</defs>
<rect width="200" height="320" fill="#050a05"/>
<rect width="200" height="320" fill="url(#g)"/>
<rect width="200" height="320" fill="url(#${pid})" opacity="0.1"/>
${inner}
<rect width="200" height="320" fill="url(#v)"/>
<rect x="4" y="4" width="192" height="312" fill="none" stroke="${v.accent}" stroke-width="0.5" opacity="0.15"/>
<text x="10" y="18" font-family="monospace" font-size="7" fill="${v.accent}" opacity="0.4" letter-spacing="0.12em">${v.label}</text>
<text x="10" y="310" font-family="monospace" font-size="6" fill="${v.accent}" opacity="0.25">${v.code}</text>
<text x="190" y="310" font-family="monospace" font-size="6" fill="${v.accent}" opacity="0.25" text-anchor="end">BLUEPRINT</text>
</svg>`;
}

// ══════════════════════════════════════════════════════════════════════
//  PUBLIC API
// ══════════════════════════════════════════════════════════════════════

function toDataUri(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** 12 pre-built operative placeholder data URIs. */
export const OPERATIVE_PLACEHOLDERS: string[] = OP_VARIANTS.map((v) =>
  toDataUri(buildOperativeSvg(v)),
);

/** 14 pre-built building placeholder data URIs. */
export const BUILDING_PLACEHOLDERS: string[] = BLD_VARIANTS.map((v) =>
  toDataUri(buildBuildingSvg(v)),
);

/**
 * Seeded Fisher-Yates shuffle — deterministic for a given seed.
 * Returns a new shuffled copy.
 */
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  let s = Math.abs(seed) | 1;
  for (let i = result.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Simple string hash for seeding.
 */
function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return h;
}

/**
 * Get `count` unique operative placeholders for a draft.
 * Same seed always produces the same selection.
 */
export function getOperativeSet(count: number, seed: string): string[] {
  const indices = Array.from({ length: OPERATIVE_PLACEHOLDERS.length }, (_, i) => i);
  const shuffled = seededShuffle(indices, hashString(seed));
  return shuffled.slice(0, count).map((i) => OPERATIVE_PLACEHOLDERS[i]);
}

/**
 * Get `count` unique building placeholders for a draft.
 * Same seed always produces the same selection.
 */
export function getBuildingSet(count: number, seed: string): string[] {
  const indices = Array.from({ length: BUILDING_PLACEHOLDERS.length }, (_, i) => i);
  const shuffled = seededShuffle(indices, hashString(seed));
  return shuffled.slice(0, count).map((i) => BUILDING_PLACEHOLDERS[i]);
}

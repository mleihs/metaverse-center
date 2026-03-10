/**
 * Procedural SVG placeholders for the Forge Table.
 *
 * 12 animated morphing operative silhouettes + 14 building blueprint silhouettes.
 * Each operative cycles through 12 distinct person types via SMIL animation —
 * body shape, head, hairstyle, facial features all morph in sync to express
 * "different persons being forged." Per-card timing offsets ensure no two
 * cards ever show the same identity simultaneously.
 */

// ══════════════════════════════════════════════════════════════════════
//  OPERATIVE PLACEHOLDERS — 12 MORPHING IDENTITIES
// ══════════════════════════════════════════════════════════════════════

/** Full silhouette keyframes (body + head as one path, M + 6C + Z) */
const BODY_KF: string[] = [
  // 0: Average
  'M20,320 C20,280 20,264 20,214 C35,176 75,162 86,154 C86,120 76,82 100,82 C124,82 114,120 114,154 C125,162 165,176 180,214 C180,264 180,280 180,320Z',
  // 1: Broad enforcer
  'M5,320 C5,280 5,270 5,220 C18,184 68,160 82,150 C82,128 70,94 100,94 C130,94 118,128 118,150 C132,160 182,184 195,220 C195,270 195,280 195,320Z',
  // 2: Lean infiltrator
  'M35,320 C35,280 35,256 35,206 C48,172 78,164 89,158 C89,130 80,74 100,74 C120,74 111,130 111,158 C122,164 152,172 165,206 C165,256 165,280 165,320Z',
  // 3: Petite
  'M42,320 C42,280 42,278 42,228 C52,190 82,160 90,150 C90,134 82,98 100,98 C118,98 110,134 110,150 C118,160 148,190 158,228 C158,278 158,280 158,320Z',
  // 4: Athletic
  'M14,320 C14,280 14,260 14,210 C28,174 74,158 85,150 C85,126 76,82 100,82 C124,82 115,126 115,150 C126,158 172,174 186,210 C186,260 186,280 186,320Z',
  // 5: Heavy
  'M8,320 C8,280 8,274 8,224 C22,186 72,162 83,152 C83,130 68,92 100,92 C132,92 117,130 117,152 C128,162 178,186 192,224 C192,274 192,280 192,320Z',
  // 6: Wiry
  'M34,320 C34,280 34,252 34,202 C46,168 78,160 88,154 C88,126 81,74 100,74 C119,74 112,126 112,154 C122,160 154,168 166,202 C166,252 166,280 166,320Z',
  // 7: Imposing
  'M10,320 C10,280 10,262 10,212 C24,174 74,160 84,152 C84,124 72,80 100,80 C128,80 116,124 116,152 C126,160 176,174 190,212 C190,262 190,280 190,320Z',
  // 8: Tall/elongated
  'M32,320 C32,280 32,258 32,208 C44,170 78,162 88,156 C88,124 80,70 100,70 C120,70 112,124 112,156 C122,162 156,170 168,208 C168,258 168,280 168,320Z',
  // 9: Curvy
  'M12,320 C12,280 12,268 12,218 C30,182 72,166 84,156 C84,124 74,86 100,86 C126,86 116,124 116,156 C128,166 170,182 188,218 C188,268 188,280 188,320Z',
  // 10: Elder
  'M36,320 C36,280 36,270 36,220 C48,186 76,168 86,160 C86,134 78,96 100,96 C122,96 114,134 114,160 C124,168 152,186 164,220 C164,270 164,280 164,320Z',
  // 11: Youth
  'M38,320 C38,280 38,274 38,224 C50,188 80,168 90,158 C90,136 82,100 100,100 C118,100 110,136 110,158 C120,168 150,188 162,224 C162,274 162,280 162,320Z',
];

/** Hair contour keyframes (M + 6C + Z) */
const HAIR_KF: string[] = [
  // 0: Buzz cut
  'M70,118 C70,104 76,90 86,86 C92,83 96,82 100,82 C104,82 108,83 114,86 C124,90 130,104 130,118 C120,114 110,112 100,112 C90,112 80,114 70,118Z',
  // 1: Flat-top
  'M68,120 C68,100 74,88 88,84 C92,78 96,74 100,74 C104,74 108,78 112,84 C126,88 132,100 132,120 C122,116 112,114 100,114 C88,114 78,116 68,120Z',
  // 2: Flowing long
  'M56,148 C52,112 60,76 88,68 C93,65 97,63 100,62 C103,63 107,65 112,68 C140,76 148,112 144,148 C132,138 116,132 100,132 C84,132 68,138 56,148Z',
  // 3: Soft bob
  'M64,130 C62,104 68,84 88,78 C93,75 97,74 100,74 C103,74 107,75 112,78 C132,84 138,104 136,130 C126,126 114,122 100,122 C86,122 74,126 64,130Z',
  // 4: Short crop
  'M72,116 C72,103 78,91 88,87 C93,85 97,84 100,84 C103,84 107,85 112,87 C122,91 128,103 128,116 C120,113 110,112 100,112 C90,112 80,113 72,116Z',
  // 5: Bald
  'M74,120 C74,110 80,100 90,96 C94,94 97,94 100,94 C103,94 106,94 110,96 C120,100 126,110 126,120 C118,117 110,116 100,116 C90,116 82,117 74,120Z',
  // 6: Wild spiky
  'M60,128 C56,96 62,58 84,44 C88,56 94,36 100,24 C106,36 112,56 116,44 C138,58 144,96 140,128 C130,124 116,120 100,120 C84,120 70,124 60,128Z',
  // 7: Slicked back
  'M66,124 C64,102 70,82 90,76 C94,74 98,76 100,76 C102,76 106,74 110,76 C130,82 136,102 134,124 C126,120 114,118 100,118 C86,118 74,120 66,124Z',
  // 8: Ponytail
  'M68,126 C66,100 72,84 86,78 C92,74 96,72 100,72 C104,72 108,74 114,78 C128,84 134,100 132,126 C122,122 112,118 100,118 C88,118 78,122 68,126Z',
  // 9: Curly/voluminous
  'M54,136 C50,100 58,64 86,54 C92,50 96,48 100,48 C104,48 108,50 114,54 C142,64 150,100 146,136 C134,130 118,126 100,126 C82,126 66,130 54,136Z',
  // 10: Thinning/receding
  'M76,118 C76,112 82,104 92,100 C96,98 98,98 100,98 C102,98 104,98 108,100 C118,104 124,112 124,118 C116,116 108,114 100,114 C92,114 84,116 76,118Z',
  // 11: Undercut
  'M72,120 C72,106 76,88 88,80 C92,68 96,60 100,58 C104,60 108,68 112,80 C124,88 128,106 128,120 C118,116 110,114 100,114 C90,114 82,116 72,120Z',
];

/** Mouth keyframes (M + Q) */
const MOUTH_KF: string[] = [
  'M91,132 Q100,135 109,132',
  'M88,136 Q100,136 112,136',
  'M93,128 Q100,131 107,128',
  'M94,136 Q100,138 106,136',
  'M90,130 Q100,130 110,130',
  'M87,136 Q100,138 113,136',
  'M93,126 Q100,124 107,126',
  'M90,130 Q100,134 110,130',
  'M92,130 Q100,128 108,130',
  'M89,134 Q100,137 111,134',
  'M92,134 Q100,132 108,134',
  'M93,130 Q100,132 107,130',
];

/** Left eyebrow keyframes (M + Q) */
const BROW_L_KF: string[] = [
  'M83,110 Q88,108 93,110',
  'M81,114 Q86,111 91,114',
  'M85,107 Q90,104 95,108',
  'M87,116 Q91,114 95,116',
  'M83,107 Q88,105 93,108',
  'M80,114 Q85,112 90,114',
  'M86,105 Q91,102 96,106',
  'M81,107 Q86,105 91,108',
  'M84,108 Q89,106 94,109',
  'M82,112 Q87,110 92,112',
  'M85,112 Q90,110 95,113',
  'M86,110 Q90,108 94,110',
];

/** Right eyebrow keyframes (M + Q) */
const BROW_R_KF: string[] = [
  'M107,110 Q112,108 117,110',
  'M109,114 Q114,111 119,114',
  'M105,108 Q110,104 115,107',
  'M105,116 Q109,114 113,116',
  'M107,108 Q112,105 117,107',
  'M110,114 Q115,112 120,114',
  'M104,106 Q109,102 114,105',
  'M109,108 Q114,105 119,107',
  'M106,109 Q111,106 116,108',
  'M108,112 Q113,110 118,112',
  'M105,113 Q110,110 115,112',
  'M106,110 Q110,108 114,110',
];

/** Per-person-type eye geometry */
const EYE_L_CX = [88, 86, 90, 91, 88, 85, 91, 86, 89, 87, 90, 89];
const EYE_R_CX = [112, 114, 110, 109, 112, 115, 109, 114, 111, 113, 110, 111];
const EYE_CY   = [115, 118, 112, 120, 112, 118, 110, 112, 113, 117, 117, 114];
const EYE_RX   = [5, 4, 5.5, 4, 5, 3.5, 5.5, 5, 5, 4.5, 4, 4.5];
const EYE_RY   = [2.5, 1.8, 2, 3, 2, 1.5, 2.5, 2, 2.2, 2.5, 1.8, 2];

/** Per-person-type nose position */
const NOSE_Y1 = [118, 122, 116, 124, 116, 122, 114, 116, 117, 120, 120, 118];
const NOSE_Y2 = [126, 130, 124, 132, 124, 130, 122, 124, 125, 128, 128, 126];

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

// ── Operative variant presets (12) ───────────────────────────────────

interface OperativeVariant {
  pattern: PatternType;
  accent: string;
  label: string;
  code: string;
}

const OP_VARIANTS: OperativeVariant[] = [
  { pattern: 'scanlines', accent: '#22c55e', label: 'CLASSIFIED', code: 'SPECTER-7A' },
  { pattern: 'grid',      accent: '#4ade80', label: 'RESTRICTED', code: 'IRON-12' },
  { pattern: 'dots',      accent: '#14b8a6', label: 'CLASSIFIED', code: 'WRAITH-3X' },
  { pattern: 'diagonal',  accent: '#22c55e', label: 'TOP SECRET', code: 'SHADOW-09' },
  { pattern: 'scanlines', accent: '#2dd4bf', label: 'RESTRICTED', code: 'VIPER-4K' },
  { pattern: 'grid',      accent: '#10b981', label: 'CLASSIFIED', code: 'CIPHER-21' },
  { pattern: 'dots',      accent: '#34d399', label: 'TOP SECRET', code: 'ORACLE-6F' },
  { pattern: 'diagonal',  accent: '#4ade80', label: 'RESTRICTED', code: 'FLUX-7Z' },
  { pattern: 'scanlines', accent: '#10b981', label: 'TOP SECRET', code: 'PHANTOM-5A' },
  { pattern: 'grid',      accent: '#2dd4bf', label: 'CLASSIFIED', code: 'NOMAD-8R' },
  { pattern: 'dots',      accent: '#22c55e', label: 'RESTRICTED', code: 'DAGGER-11' },
  { pattern: 'diagonal',  accent: '#14b8a6', label: 'TOP SECRET', code: 'AEGIS-2K' },
];

// ── SVG helpers ──────────────────────────────────────────────────────

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

/** Rotate array by n positions */
function rotateArr<T>(arr: T[], n: number): T[] {
  const len = arr.length;
  const off = ((n % len) + len) % len;
  return [...arr.slice(off), ...arr.slice(0, off)];
}

/** Build SMIL values string: rotate keyframes + loop back to first */
function vals<T>(arr: T[], offset: number): string {
  const r = rotateArr(arr, offset);
  return [...r, r[0]].join(';');
}

/** SMIL keySplines for n values */
function sp(n: number): string {
  return Array(n - 1).fill('0.4 0 0.6 1').join(';');
}

// ── Animated operative builder ───────────────────────────────────────

function buildOperativeSvg(v: OperativeVariant, index: number): string {
  const { accent } = v;
  const dur = 32 + index * 4.3;
  const scanDur = 3.5 + index * 0.4;
  const glowDur = 7 + index * 0.8;
  const off = index;
  const s13 = sp(13);

  // Helper: single animate element
  const a = (attr: string, v: string, d = dur) =>
    `<animate attributeName="${attr}" values="${v}" dur="${d}s" repeatCount="indefinite" calcMode="spline" keySplines="${s13}"/>`;

  // Initial values (first keyframe after rotation)
  const i0 = off % 12;

  const inner = [
    // Body + head silhouette morph
    `<path d="${BODY_KF[i0]}" fill="#0b150b">${a('d', vals(BODY_KF, off))}</path>`,
    // Hair morph
    `<path d="${HAIR_KF[i0]}" fill="#070f07" opacity="0.9">${a('d', vals(HAIR_KF, off))}</path>`,
    // Face glow pulse
    `<ellipse cx="100" cy="118" rx="38" ry="42" fill="${accent}" opacity="0"><animate attributeName="opacity" values="0;0.03;0;0.02;0" dur="${glowDur}s" repeatCount="indefinite"/></ellipse>`,
    // Face scan line
    `<rect x="65" y="70" width="70" height="1" fill="${accent}" opacity="0.06"><animate attributeName="y" values="70;155;70" dur="${scanDur}s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1"/></rect>`,
    // Eyebrows
    `<path d="${BROW_L_KF[i0]}" fill="none" stroke="${accent}" stroke-width="0.5" opacity="0.1">${a('d', vals(BROW_L_KF, off))}</path>`,
    `<path d="${BROW_R_KF[i0]}" fill="none" stroke="${accent}" stroke-width="0.5" opacity="0.1">${a('d', vals(BROW_R_KF, off))}</path>`,
    // Left eye
    `<ellipse cx="${EYE_L_CX[i0]}" cy="${EYE_CY[i0]}" rx="${EYE_RX[i0]}" ry="${EYE_RY[i0]}" fill="${accent}" opacity="0.12">${a('cx', vals(EYE_L_CX, off))}${a('cy', vals(EYE_CY, off))}${a('rx', vals(EYE_RX, off))}${a('ry', vals(EYE_RY, off))}</ellipse>`,
    // Right eye
    `<ellipse cx="${EYE_R_CX[i0]}" cy="${EYE_CY[i0]}" rx="${EYE_RX[i0]}" ry="${EYE_RY[i0]}" fill="${accent}" opacity="0.12">${a('cx', vals(EYE_R_CX, off))}${a('cy', vals(EYE_CY, off))}${a('rx', vals(EYE_RX, off))}${a('ry', vals(EYE_RY, off))}</ellipse>`,
    // Nose
    `<line x1="100" y1="${NOSE_Y1[i0]}" x2="100" y2="${NOSE_Y2[i0]}" stroke="${accent}" stroke-width="0.4" opacity="0.1">${a('y1', vals(NOSE_Y1, off))}${a('y2', vals(NOSE_Y2, off))}</line>`,
    // Mouth morph
    `<path d="${MOUTH_KF[i0]}" fill="none" stroke="${accent}" stroke-width="0.6" opacity="0.15">${a('d', vals(MOUTH_KF, off))}</path>`,
    // CRT glitch scanlines
    `<g opacity="0.04"><rect x="20" y="95" width="160" height="0.5" fill="${accent}"><animate attributeName="y" values="95;175;120;155;95" dur="0.4s" repeatCount="indefinite"/></rect><rect x="20" y="140" width="160" height="0.5" fill="${accent}"><animate attributeName="y" values="140;92;165;108;140" dur="0.7s" repeatCount="indefinite"/></rect></g>`,
    // Body outline glow (morphs with body)
    `<path d="${BODY_KF[i0]}" fill="none" stroke="${accent}" stroke-width="0.6" opacity="0.2">${a('d', vals(BODY_KF, off))}</path>`,
  ].join('\n');

  return svgWrapper(inner, accent, v.label, v.code, v.pattern);
}

// ══════════════════════════════════════════════════════════════════════
//  BUILDING PLACEHOLDERS (14)
// ══════════════════════════════════════════════════════════════════════

interface BuildingSilhouette {
  path: string;
  extras: string;
}

const BUILDINGS: BuildingSilhouette[] = [
  {
    path: 'M70,320 L70,80 L80,60 L120,60 L130,80 L130,320Z',
    extras: `<rect x="82" y="90" width="12" height="8" fill="#060e06" opacity="0.6"/><rect x="106" y="90" width="12" height="8" fill="#060e06" opacity="0.6"/><rect x="82" y="110" width="12" height="8" fill="#060e06" opacity="0.6"/><rect x="106" y="110" width="12" height="8" fill="#060e06" opacity="0.6"/><rect x="82" y="130" width="12" height="8" fill="#060e06" opacity="0.6"/><rect x="106" y="130" width="12" height="8" fill="#060e06" opacity="0.6"/>`,
  },
  {
    path: 'M20,320 L20,160 L50,160 L50,120 L70,120 L70,100 L130,100 L130,120 L150,120 L150,160 L180,160 L180,320Z',
    extras: `<rect x="55" y="108" width="8" height="12" fill="#060e06" opacity="0.5"/><rect x="80" y="108" width="8" height="12" fill="#060e06" opacity="0.5"/><rect x="112" y="108" width="8" height="12" fill="#060e06" opacity="0.5"/><path d="M140,100 L145,70 L150,100" fill="none" stroke="#0d1a0d" stroke-width="2"/>`,
  },
  {
    path: 'M40,320 L40,180 Q40,80 100,60 Q160,80 160,180 L160,320Z',
    extras: `<ellipse cx="100" cy="180" rx="55" ry="4" fill="none" stroke="#0d1a0d" stroke-width="1" opacity="0.5"/>`,
  },
  {
    path: 'M20,320 L100,50 L180,320Z',
    extras: `<path d="M60,200 L100,50 L140,200" fill="none" stroke="#0d1a0d" stroke-width="0.5" opacity="0.4"/><line x1="20" y1="320" x2="180" y2="320" stroke="#0d1a0d" stroke-width="1"/>`,
  },
  {
    path: 'M25,320 L25,140 Q100,60 175,140 L175,320Z',
    extras: `<rect x="75" y="240" width="50" height="80" fill="#060e06" opacity="0.4"/><line x1="100" y1="240" x2="100" y2="320" stroke="#0a160a" stroke-width="1"/>`,
  },
  {
    path: 'M75,320 L75,120 L85,120 L85,80 L95,80 L95,50 L100,20 L105,50 L105,80 L115,80 L115,120 L125,120 L125,320Z',
    extras: `<rect x="88" y="200" width="24" height="40" rx="12" fill="#060e06" opacity="0.5"/><circle cx="100" cy="100" r="8" fill="none" stroke="#0d1a0d" stroke-width="0.5" opacity="0.5"/>`,
  },
  {
    path: 'M15,320 L15,200 L30,180 L170,180 L185,200 L185,320Z',
    extras: `<rect x="35" y="188" width="20" height="10" fill="#060e06" opacity="0.5"/><rect x="90" y="188" width="20" height="10" fill="#060e06" opacity="0.5"/><rect x="145" y="188" width="20" height="10" fill="#060e06" opacity="0.5"/><rect x="15" y="196" width="170" height="2" fill="#0d1a0d" opacity="0.3"/>`,
  },
  {
    path: 'M85,320 L85,280 L60,280 L95,30 L105,30 L140,280 L115,280 L115,320Z',
    extras: `<line x1="72" y1="160" x2="128" y2="160" stroke="#0d1a0d" stroke-width="1" opacity="0.5"/><line x1="78" y1="200" x2="122" y2="200" stroke="#0d1a0d" stroke-width="1" opacity="0.5"/><line x1="84" y1="240" x2="116" y2="240" stroke="#0d1a0d" stroke-width="1" opacity="0.5"/><circle cx="100" cy="30" r="3" fill="#0d1a0d"/>`,
  },
  {
    path: 'M35,320 L35,180 L165,180 L165,320Z',
    extras: `<path d="M35,180 Q35,100 100,70 Q165,100 165,180" fill="#0b150b" stroke="#0d1a0d" stroke-width="0.5"/><line x1="100" y1="70" x2="100" y2="40" stroke="#0d1a0d" stroke-width="2"/><rect x="70" y="210" width="60" height="40" fill="#060e06" opacity="0.3"/>`,
  },
  {
    path: 'M55,320 L55,200 L65,200 L65,140 L75,140 L75,80 L125,80 L125,140 L135,140 L135,200 L145,200 L145,320Z',
    extras: `<rect x="85" y="90" width="6" height="6" fill="#060e06" opacity="0.5"/><rect x="109" y="90" width="6" height="6" fill="#060e06" opacity="0.5"/><rect x="85" y="106" width="6" height="6" fill="#060e06" opacity="0.5"/><rect x="109" y="106" width="6" height="6" fill="#060e06" opacity="0.5"/><rect x="85" y="122" width="6" height="6" fill="#060e06" opacity="0.5"/>`,
  },
  {
    path: 'M30,320 L30,100 L170,100 L170,320Z',
    extras: `<line x1="30" y1="140" x2="170" y2="140" stroke="#0d1a0d" stroke-width="0.5" opacity="0.4"/><line x1="30" y1="180" x2="170" y2="180" stroke="#0d1a0d" stroke-width="0.5" opacity="0.4"/><line x1="30" y1="220" x2="170" y2="220" stroke="#0d1a0d" stroke-width="0.5" opacity="0.4"/><line x1="100" y1="100" x2="100" y2="320" stroke="#0d1a0d" stroke-width="0.5" opacity="0.3"/>`,
  },
  {
    path: 'M20,320 L20,160 L180,160 L180,320Z',
    extras: `<rect x="40" y="80" width="14" height="80" fill="#0b150b"/><rect x="70" y="100" width="14" height="60" fill="#0b150b"/><rect x="40" y="76" width="14" height="6" fill="#0a160a"/><rect x="70" y="96" width="14" height="6" fill="#0a160a"/><path d="M42,80 C38,60 35,40 40,30" fill="none" stroke="#0d1a0d" stroke-width="1" opacity="0.3"/>`,
  },
  {
    path: 'M0,220 L10,200 L40,200 Q50,200 50,210 L50,260 Q50,320 30,320 L0,320Z M200,220 L190,200 L160,200 Q150,200 150,210 L150,260 Q150,320 170,320 L200,320Z',
    extras: `<rect x="0" y="196" width="200" height="8" fill="#0b150b"/><line x1="50" y1="204" x2="150" y2="204" stroke="#0d1a0d" stroke-width="0.5" opacity="0.4"/><path d="M50,260 Q100,300 150,260" fill="none" stroke="#0b150b" stroke-width="2"/>`,
  },
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

/** 12 animated operative placeholder data URIs. */
export const OPERATIVE_PLACEHOLDERS: string[] = OP_VARIANTS.map((v, i) =>
  toDataUri(buildOperativeSvg(v, i)),
);

/** 14 pre-built building placeholder data URIs. */
export const BUILDING_PLACEHOLDERS: string[] = BLD_VARIANTS.map((v) =>
  toDataUri(buildBuildingSvg(v)),
);

/**
 * Seeded Fisher-Yates shuffle — deterministic for a given seed.
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
 */
export function getBuildingSet(count: number, seed: string): string[] {
  const indices = Array.from({ length: BUILDING_PLACEHOLDERS.length }, (_, i) => i);
  const shuffled = seededShuffle(indices, hashString(seed));
  return shuffled.slice(0, count).map((i) => BUILDING_PLACEHOLDERS[i]);
}

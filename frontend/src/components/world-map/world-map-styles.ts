import type {
  ExpressionSpecification,
  GeoJSONSourceSpecification,
  LayerSpecification,
  StyleSpecification,
} from 'maplibre-gl';
import type {
  WorldMapAgentMarker,
  WorldMapBuilding,
  WorldMapResponse,
  WorldMapStreet,
  WorldMapThemeHints,
  WorldMapZone,
} from '../../types/world-map.js';

export interface MapColors {
  surface: string;
  surfaceRaised: string;
  border: string;
  textMuted: string;
  textSecondary: string;
  primary: string;
  danger: string;
  success: string;
  warning: string;
  info: string;
  epochInfluence: string;
}

// MapLibre paint properties accept CSS color strings only (no var()). When both
// getComputedStyle and theme_hints fail to yield a value (detached host edge
// case), we fall back to the brutalist default-theme hex values — the source
// of truth for these is frontend/src/styles/tokens/_colors.css.
const FALLBACK_COLORS: MapColors = {
  surface: '#0a0a0a', // lint-color-ok
  surfaceRaised: '#111111', // lint-color-ok
  border: '#333333', // lint-color-ok
  textMuted: '#888888', // lint-color-ok
  textSecondary: '#a0a0a0', // lint-color-ok
  primary: '#f59e0b', // lint-color-ok
  danger: '#ef4444', // lint-color-ok
  success: '#22c55e', // lint-color-ok
  warning: '#f59e0b', // lint-color-ok
  info: '#3b82f6', // lint-color-ok
  epochInfluence: '#a78bfa', // lint-color-ok
};

function pickColor(
  computed: CSSStyleDeclaration,
  token: string,
  hint: string | null | undefined,
  fallback: string,
): string {
  const fromToken = computed.getPropertyValue(token).trim();
  if (fromToken && !fromToken.startsWith('color-mix')) return fromToken;
  if (hint) return hint;
  return fallback;
}

export function readMapColors(
  host: HTMLElement,
  hints: WorldMapThemeHints | null | undefined,
): MapColors {
  const computed = window.getComputedStyle(host);
  const h = hints ?? null;
  return {
    surface: pickColor(computed, '--color-surface', h?.color_surface, FALLBACK_COLORS.surface),
    surfaceRaised: pickColor(
      computed,
      '--color-surface-raised',
      h?.color_surface,
      FALLBACK_COLORS.surfaceRaised,
    ),
    border: pickColor(computed, '--color-border', h?.color_border, FALLBACK_COLORS.border),
    textMuted: pickColor(computed, '--color-text-muted', null, FALLBACK_COLORS.textMuted),
    textSecondary: pickColor(
      computed,
      '--color-text-secondary',
      h?.color_text,
      FALLBACK_COLORS.textSecondary,
    ),
    primary: pickColor(computed, '--color-primary', h?.color_primary, FALLBACK_COLORS.primary),
    danger: pickColor(computed, '--color-danger', h?.color_danger, FALLBACK_COLORS.danger),
    success: pickColor(computed, '--color-success', h?.color_success, FALLBACK_COLORS.success),
    warning: pickColor(computed, '--color-warning', null, FALLBACK_COLORS.warning),
    info: pickColor(computed, '--color-info', null, FALLBACK_COLORS.info),
    epochInfluence: pickColor(
      computed,
      '--color-epoch-influence',
      null,
      FALLBACK_COLORS.epochInfluence,
    ),
  };
}

// Map zone_type strings (which vary widely per sim — see the taxonomy in the
// `zones` table) into one of six color buckets that read consistently across
// themes. Unknown types fall back to a neutral text-secondary tone.
export type ZoneCategory =
  | 'authority'
  | 'sacred'
  | 'industrial'
  | 'commercial'
  | 'residential'
  | 'marginal'
  | 'liminal'
  | 'other';

export function categoriseZoneType(zoneType: string | null | undefined): ZoneCategory {
  if (!zoneType) return 'other';
  const t = zoneType.toLowerCase();
  if (/govern|capital|command|admin|throne|palace|citadel|seat/.test(t)) return 'authority';
  if (/relig|sacred|temple|shrine|chapel|cathedral|monaster/.test(t)) return 'sacred';
  if (/industri|workshop|factory|forge|engineering|firmware|refiner|mill/.test(t))
    return 'industrial';
  if (/commerc|market|bazaar|trade|hub|port/.test(t)) return 'commercial';
  if (/resid|habit|housing|quarter|domest|dwelling/.test(t)) return 'residential';
  if (/science|memory|topside|liminal|astral|reality|deck|segment|access/.test(t)) return 'liminal';
  if (/slum|worker|ruin|waste|decay|abandoned/.test(t)) return 'marginal';
  return 'other';
}

// Single source of truth for zone-category visual treatment. Adding a new
// ZoneCategory forces an addition here (TypeScript enforces the Record), and
// downstream — both zoneCategoryColor (JS label tinting) and the MapLibre
// match expressions (zone-fill paint + opacity) derive their values from here.
// The match expressions themselves are still literal arrays because
// MapLibre's ExpressionSpecification tuple typing makes dynamic construction
// awkward; comments below remind contributors to extend them in lockstep.
const ZONE_CATEGORY_STYLE: Record<ZoneCategory, { color: keyof MapColors; opacity: number }> = {
  authority: { color: 'primary', opacity: 0.34 },
  sacred: { color: 'success', opacity: 0.3 },
  // Industrial uses epochInfluence (purple), NOT `warning`: in the default
  // theme `--color-warning` resolves to the same amber as `--color-primary`,
  // so authority and industrial zones were visually identical. Purple also
  // matches the OSM convention for industrial land. The rare `liminal`
  // category gives up purple and takes the neutral grey in exchange, so the
  // four common categories (authority/residential/industrial/commercial) all
  // get a distinct hue: amber / grey / purple / blue.
  industrial: { color: 'epochInfluence', opacity: 0.32 },
  commercial: { color: 'info', opacity: 0.3 },
  residential: { color: 'textSecondary', opacity: 0.24 },
  marginal: { color: 'danger', opacity: 0.28 },
  liminal: { color: 'textMuted', opacity: 0.42 },
  other: { color: 'textSecondary', opacity: 0.26 },
};

export function zoneCategoryColor(category: ZoneCategory, colors: MapColors): string {
  return colors[ZONE_CATEGORY_STYLE[category].color];
}

// Agent professions are free text and vary widely per simulation (medieval
// sims: "Forgewright"; coastal: "Tide Clerk"; literary: "Story Distiller").
// Bucket them into four broad role archetypes for the marker tint —
// everything we can't place (including the plain "laborer" default) falls
// back to `other`, which keeps the familiar phosphor-green agent dot.
export type AgentRoleArchetype = 'civic' | 'craft' | 'lore' | 'trade' | 'other';

// Order matters: the most distinctive patterns are tested first so a broad
// keyword in a later arm can't swallow a precise match. e.g. "Resonance
// Broker" / "Memory Scribe" must read as `lore`, not be caught by the
// "broker" arm of `trade` or the "scribe" arm of `civic`.
export function categoriseAgentRole(profession: string | null | undefined): AgentRoleArchetype {
  if (!profession) return 'other';
  const p = profession.toLowerCase();
  // `\bkeeper\b` (whole word) not bare `keeper` — "shopkeeper"/"innkeeper"
  // are trade, not lore; only a standalone "Keeper" / "Records Keeper" reads
  // as lore.
  if (
    /archiv|scholar|scribe|loremaster|lorekeeper|\bkeeper\b|librar|histor|chronicl|\bsage\b|distill|cartograph|mapmaker|attun|resonan|seer|oracle|mystic|divin|alchem|augur|astronom|philosoph|scient|research|analyst|teacher|professor|recorder/.test(
      p,
    )
  )
    return 'lore';
  if (
    /smith|wright|forge|carpenter|joiner|weaver|spinner|potter|baker|brewer|tailor|\bcooper\b|builder|maker|artisan|mechan|engineer|machin|fabricat|founder|miller|woodwork|stonemason|\bmason\b|glazier|tanner|\bdyer\b|cobbler|mill\b/.test(
      p,
    )
  )
    return 'craft';
  if (
    /broker|merchant|trader|tradesman|tradeswoman|dealer|vendor|peddler|banker|financ|accountant|\bfactor\b|shopkeep|stockist|auctioneer|moneylender|exchanger/.test(
      p,
    )
  )
    return 'trade';
  if (
    /govern|marshal|warden|magistrat|official|clerk|bureaucrat|administrat|minister|steward|constable|sheriff|judge|council|mayor|prefect|commission|inspector|registrar|notary|chancellor|overseer|envoy|ambassador|diplomat|secretary|adjudicat|prosecutor|bailiff/.test(
      p,
    )
  )
    return 'civic';
  return 'other';
}

// Single source of truth for agent-role marker tint — yields a `var(--color-…)`
// reference (not a resolved hex) so the DOM markers + legend swatches re-tint
// live if the theme tokens shift; same pattern as buildingMarkerColorVar /
// eventColorVar in SimulationWorldMap.ts. `other` keeps the original
// phosphor-green dot, so an unrecognised profession (the majority on most
// sims) is visually unchanged from before this pass. Adding an archetype
// forces an entry here (TypeScript enforces the Record).
const AGENT_ROLE_COLOR_VAR: Record<AgentRoleArchetype, string> = {
  civic: 'var(--color-primary)',
  craft: 'var(--color-warning)',
  lore: 'var(--color-info)',
  trade: 'var(--color-epoch-influence)',
  other: 'var(--color-success)',
};

export function agentRoleColorVar(archetype: AgentRoleArchetype): string {
  return AGENT_ROLE_COLOR_VAR[archetype];
}

interface BuildingPosition {
  id: string;
  lng: number;
  lat: number;
}

interface ZoneFeature {
  type: 'Feature';
  id: string;
  properties: {
    id: string;
    name: string;
    zone_type: string;
    category: ZoneCategory;
    stability: number | null;
    stability_label: string | null;
  };
  geometry: { type: 'Polygon'; coordinates: number[][][] };
}

interface StreetFeature {
  type: 'Feature';
  id: string;
  properties: {
    id: string;
    name: string;
    street_type: string;
    length_km: number | null;
  };
  geometry: { type: 'LineString'; coordinates: number[][] };
}

interface BuildingFeature {
  type: 'Feature';
  id: string;
  properties: {
    id: string;
    name: string;
    building_type: string;
    zone_id: string | null;
  };
  geometry: { type: 'Point'; coordinates: number[] };
}

interface AgentFeature {
  type: 'Feature';
  id: string;
  properties: {
    id: string;
    name: string;
    home_building_id: string;
  };
  geometry: { type: 'Point'; coordinates: number[] };
}

interface BuildingFootprintFeature {
  type: 'Feature';
  id: string;
  properties: { id: string };
  geometry: { type: 'Polygon'; coordinates: number[][][] };
}

interface GraticuleFeature {
  type: 'Feature';
  properties: Record<string, never>;
  geometry: { type: 'LineString'; coordinates: number[][] };
}

interface FeatureCollection<F> {
  type: 'FeatureCollection';
  features: F[];
}

export function buildZonesData(zones: WorldMapZone[]): FeatureCollection<ZoneFeature> {
  return {
    type: 'FeatureCollection',
    features: zones
      .filter(
        (z): z is WorldMapZone & { geojson: NonNullable<WorldMapZone['geojson']> } =>
          z.geojson != null,
      )
      .map((z) => ({
        type: 'Feature',
        id: z.id,
        properties: {
          id: z.id,
          name: z.name,
          zone_type: z.zone_type ?? 'unknown',
          category: categoriseZoneType(z.zone_type),
          stability: z.stability,
          stability_label: z.stability_label,
        },
        geometry: { type: 'Polygon', coordinates: z.geojson.coordinates },
      })),
  };
}

function streetsToFeatures(streets: WorldMapStreet[]): FeatureCollection<StreetFeature> {
  return {
    type: 'FeatureCollection',
    features: streets
      .filter(
        (s): s is WorldMapStreet & { geojson: NonNullable<WorldMapStreet['geojson']> } =>
          s.geojson != null,
      )
      .map((s) => ({
        type: 'Feature',
        id: s.id,
        properties: {
          id: s.id,
          name: s.name ?? '',
          street_type: s.street_type ?? 'tertiary',
          length_km: s.length_km,
        },
        geometry: { type: 'LineString', coordinates: s.geojson.coordinates },
      })),
  };
}

// Half-extent of a synthesised building footprint, in degrees (≈ 22 m at the
// equator). Buildings are stored as Points; the frontend buffers each into a
// small square so the map reads as structures, not floating icons. Real
// generator-emitted footprint polygons are a future backend follow-up.
const FOOTPRINT_HALF_DEG = 0.0002;

function buildingsToFeatures(buildings: WorldMapBuilding[]): {
  collection: FeatureCollection<BuildingFeature>;
  footprints: FeatureCollection<BuildingFootprintFeature>;
  positions: Map<string, BuildingPosition>;
} {
  const positions = new Map<string, BuildingPosition>();
  const features: BuildingFeature[] = [];
  const footprints: BuildingFootprintFeature[] = [];
  for (const b of buildings) {
    if (!b.geojson) continue;
    const [lng, lat] = b.geojson.coordinates;
    positions.set(b.id, { id: b.id, lng, lat });
    features.push({
      type: 'Feature',
      id: b.id,
      properties: {
        id: b.id,
        name: b.name,
        building_type: b.building_type ?? 'unknown',
        zone_id: b.zone_id,
      },
      geometry: { type: 'Point', coordinates: [lng, lat] },
    });
    const h = FOOTPRINT_HALF_DEG;
    footprints.push({
      type: 'Feature',
      id: b.id,
      properties: { id: b.id },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [lng - h, lat - h],
            [lng + h, lat - h],
            [lng + h, lat + h],
            [lng - h, lat + h],
            [lng - h, lat - h],
          ],
        ],
      },
    });
  }
  return {
    collection: { type: 'FeatureCollection', features },
    footprints: { type: 'FeatureCollection', features: footprints },
    positions,
  };
}

function agentsToFeatures(
  markers: WorldMapAgentMarker[],
  buildingPositions: Map<string, BuildingPosition>,
): FeatureCollection<AgentFeature> {
  const features: AgentFeature[] = [];
  for (const m of markers) {
    if (!m.home_building_id) continue;
    const pos = buildingPositions.get(m.home_building_id);
    if (!pos) continue;
    features.push({
      type: 'Feature',
      id: m.agent_id,
      properties: {
        id: m.agent_id,
        name: m.name,
        home_building_id: m.home_building_id,
      },
      geometry: { type: 'Point', coordinates: [pos.lng, pos.lat] },
    });
  }
  return { type: 'FeatureCollection', features };
}

// A faint reference grid for the map base — turns the empty margin around the
// geometry into "archive paper" rather than a broken-looking void. Generated
// over a generous span around the content so a pan never reaches its edge.
function buildGraticule(
  bounds: [[number, number], [number, number]],
): FeatureCollection<GraticuleFeature> {
  const [[minLng, minLat], [maxLng, maxLat]] = bounds;
  const spanLng = Math.max(maxLng - minLng, 1e-6);
  const spanLat = Math.max(maxLat - minLat, 1e-6);
  // ~8 grid cells across the content; the grid extends one content-span past
  // every edge so a pan stays on-grid.
  const step = Math.max(spanLng, spanLat) / 8;
  const startLng = Math.floor((minLng - spanLng) / step) * step;
  const endLng = maxLng + spanLng;
  const startLat = Math.floor((minLat - spanLat) / step) * step;
  const endLat = maxLat + spanLat;
  const features: GraticuleFeature[] = [];
  for (let lng = startLng; lng <= endLng; lng += step) {
    features.push({
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: [
          [lng, startLat],
          [lng, endLat],
        ],
      },
    });
  }
  for (let lat = startLat; lat <= endLat; lat += step) {
    features.push({
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: [
          [startLng, lat],
          [endLng, lat],
        ],
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

// MapLibre match expression — keep arms aligned with ZONE_CATEGORY_STYLE.
function zoneFillColorExpr(colors: MapColors): ExpressionSpecification {
  return [
    'match',
    ['get', 'category'],
    'authority',
    colors[ZONE_CATEGORY_STYLE.authority.color],
    'sacred',
    colors[ZONE_CATEGORY_STYLE.sacred.color],
    'industrial',
    colors[ZONE_CATEGORY_STYLE.industrial.color],
    'commercial',
    colors[ZONE_CATEGORY_STYLE.commercial.color],
    'residential',
    colors[ZONE_CATEGORY_STYLE.residential.color],
    'marginal',
    colors[ZONE_CATEGORY_STYLE.marginal.color],
    'liminal',
    colors[ZONE_CATEGORY_STYLE.liminal.color],
    /* default */ colors[ZONE_CATEGORY_STYLE.other.color],
  ];
}

const ZONE_CATEGORY_OPACITY_EXPR: ExpressionSpecification = [
  'match',
  ['get', 'category'],
  'authority',
  ZONE_CATEGORY_STYLE.authority.opacity,
  'sacred',
  ZONE_CATEGORY_STYLE.sacred.opacity,
  'industrial',
  ZONE_CATEGORY_STYLE.industrial.opacity,
  'commercial',
  ZONE_CATEGORY_STYLE.commercial.opacity,
  'residential',
  ZONE_CATEGORY_STYLE.residential.opacity,
  'marginal',
  ZONE_CATEGORY_STYLE.marginal.opacity,
  'liminal',
  ZONE_CATEGORY_STYLE.liminal.opacity,
  /* default */ ZONE_CATEGORY_STYLE.other.opacity,
];

// Stability label config (matches the 5 canonical bands from mv_zone_stability
// in migration 031). Same pattern as ZONE_CATEGORY_STYLE: single source of
// truth, match expressions below derive their values from here.
//
// Stability is rendered as a RESTRAINED accent, not a wash: a faint fill tint
// for the two urgent bands only, plus a solid coloured zone edge (the
// `zones-stability-edge` layer). The old heavy full-fill (critical at 0.32)
// buried the category colours and made an all-critical map read as one red
// hazard zone. functional/stable/exemplary contribute no fill — a healthy map
// stays calm and lets the category colours carry.
type StabilityLabel = 'critical' | 'unstable' | 'functional' | 'stable' | 'exemplary';

const STABILITY_STYLE: Record<StabilityLabel, { color: keyof MapColors; opacity: number }> = {
  critical: { color: 'danger', opacity: 0.1 },
  unstable: { color: 'danger', opacity: 0.06 },
  functional: { color: 'warning', opacity: 0 },
  stable: { color: 'success', opacity: 0 },
  exemplary: { color: 'success', opacity: 0 },
};

// Zone-edge width per stability band — the primary stability signal now that
// the fill is demoted. Only the two urgent bands get a visible edge.
const STABILITY_EDGE_WIDTH: ExpressionSpecification = [
  'match',
  ['get', 'stability_label'],
  'critical',
  2.6,
  'unstable',
  1.8,
  /* default */ 0,
];

function stabilityFillColorExpr(colors: MapColors): ExpressionSpecification {
  return [
    'match',
    ['get', 'stability_label'],
    'critical',
    colors[STABILITY_STYLE.critical.color],
    'unstable',
    colors[STABILITY_STYLE.unstable.color],
    'functional',
    colors[STABILITY_STYLE.functional.color],
    'stable',
    colors[STABILITY_STYLE.stable.color],
    'exemplary',
    colors[STABILITY_STYLE.exemplary.color],
    /* default */ colors.surface,
  ];
}

const STABILITY_OPACITY_EXPR: ExpressionSpecification = [
  'match',
  ['get', 'stability_label'],
  'critical',
  STABILITY_STYLE.critical.opacity,
  'unstable',
  STABILITY_STYLE.unstable.opacity,
  'functional',
  STABILITY_STYLE.functional.opacity,
  'stable',
  STABILITY_STYLE.stable.opacity,
  'exemplary',
  STABILITY_STYLE.exemplary.opacity,
  /* default */ 0,
];

// Street line-width interpolation, parameterised by a flat px addend so the
// per-tier hierarchy lives in exactly one place. Used for the road itself
// (`STREET_WIDTH`, addend 0) and its casing (`STREET_CASING_WIDTH`, addend 3).
// A factory — not `['+', STREET_WIDTH, 3]` — because MapLibre requires the
// zoom `interpolate` to be the TOP-LEVEL property value; nesting it inside a
// `+` expression is rejected at style-load time.
function streetWidthExpr(addend: number): ExpressionSpecification {
  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    10,
    [
      'match',
      ['get', 'street_type'],
      'arterial',
      1.6 + addend,
      'secondary',
      1 + addend,
      'tertiary',
      0.6 + addend,
      'alley',
      0.4 + addend,
      0.4 + addend,
    ],
    18,
    [
      'match',
      ['get', 'street_type'],
      'arterial',
      6 + addend,
      'secondary',
      3.6 + addend,
      'tertiary',
      2.2 + addend,
      'alley',
      1.2 + addend,
      1.2 + addend,
    ],
  ];
}

const STREET_WIDTH: ExpressionSpecification = streetWidthExpr(0);

// Casing — a dark sleeve 3px wider than the road, peeking ~1.5px past each edge
// to separate the street from the coloured zone fill it crosses.
const STREET_CASING_WIDTH: ExpressionSpecification = streetWidthExpr(3);

// `bounds` is the geometry extent the caller already computed (for fitBounds) —
// passed in rather than recomputed here so computeBounds runs once per init.
export function buildMapStyle(
  payload: WorldMapResponse,
  colors: MapColors,
  bounds: [[number, number], [number, number]],
): StyleSpecification {
  const zonesFC = buildZonesData(payload.zones);
  const streetsFC = streetsToFeatures(payload.streets);
  const {
    collection: buildingsFC,
    footprints: footprintsFC,
    positions,
  } = buildingsToFeatures(payload.buildings);
  const agentsFC = agentsToFeatures(payload.agent_markers, positions);
  const graticuleFC = buildGraticule(bounds);

  // Hoist: the zone category-color expression is identical across three
  // layers (fill, line, hover) — build the array once instead of per-layer.
  const categoryColorExpr = zoneFillColorExpr(colors);
  const stabilityColorExpr = stabilityFillColorExpr(colors);

  // promoteId: 'id' makes MapLibre use feature.properties.id (our UUID) as
  // the canonical feature.id, instead of auto-assigning numeric 0,1,2,…. This:
  //  - gives click/hover handlers a single, stable identifier
  //  - preserves feature-state across setData refreshes (Phase 6 live overlay)
  //  - aligns setFeatureState lookups with our _zonesById/_buildingsById maps
  const sources: Record<string, GeoJSONSourceSpecification> = {
    graticule: { type: 'geojson', data: graticuleFC },
    zones: { type: 'geojson', data: zonesFC, promoteId: 'id' },
    streets: { type: 'geojson', data: streetsFC, promoteId: 'id' },
    buildings: { type: 'geojson', data: buildingsFC, promoteId: 'id' },
    buildingFootprints: { type: 'geojson', data: footprintsFC },
    agents: { type: 'geojson', data: agentsFC, promoteId: 'id' },
  };

  const layers: LayerSpecification[] = [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': colors.surface },
    },
    {
      // Faint reference grid — turns the empty margin into archive paper
      // rather than a broken-looking void.
      id: 'graticule',
      type: 'line',
      source: 'graticule',
      paint: {
        'line-color': colors.border,
        'line-width': 0.5,
        'line-opacity': 0.4,
      },
    },
    {
      // Category fill — static once geometry is loaded; no transition needed.
      id: 'zones-fill',
      type: 'fill',
      source: 'zones',
      paint: {
        'fill-color': categoryColorExpr,
        'fill-opacity': ZONE_CATEGORY_OPACITY_EXPR,
      },
    },
    {
      // Crisp solid category outline (replaces the old sketchy dashes).
      id: 'zones-line',
      type: 'line',
      source: 'zones',
      paint: {
        'line-color': categoryColorExpr,
        'line-width': 1.4,
        'line-opacity': 0.85,
      },
    },
    {
      // Live overlay: paints a stability-state tint ON TOP of the category
      // fill. Polled every STABILITY_REFRESH_MS (Phase 6.1) and updated via
      // setData on the zones source. Canonical labels are produced by
      // mv_zone_stability (migration 031): critical / unstable / functional
      // / stable / exemplary. Sits BELOW zones-fill-hover so the active
      // hover signal remains readable even on critical zones.
      id: 'zones-stability',
      type: 'fill',
      source: 'zones',
      paint: {
        'fill-color': stabilityColorExpr,
        'fill-opacity': STABILITY_OPACITY_EXPR,
        'fill-opacity-transition': { duration: 600 },
      },
    },
    {
      // Stability as a zone-edge signal — solid coloured border, thicker for
      // the more urgent bands, invisible for healthy zones. The primary
      // stability cue now that the fill wash is demoted (see STABILITY_STYLE).
      id: 'zones-stability-edge',
      type: 'line',
      source: 'zones',
      layout: { 'line-join': 'round' },
      paint: {
        'line-color': stabilityColorExpr,
        'line-width': STABILITY_EDGE_WIDTH,
        'line-opacity': 0.9,
        'line-width-transition': { duration: 600 },
      },
    },
    {
      // Hover overlay sits LAST among zone layers so the user's active
      // pointer signal wins over ambient stability colour.
      id: 'zones-fill-hover',
      type: 'fill',
      source: 'zones',
      paint: {
        'fill-color': categoryColorExpr,
        'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.18, 0],
      },
    },
    {
      // Casing — a dark sleeve under each street so it reads crisply where it
      // crosses a coloured zone fill.
      id: 'streets-casing',
      type: 'line',
      source: 'streets',
      layout: { 'line-cap': 'butt', 'line-join': 'miter' },
      paint: {
        'line-color': colors.surface,
        'line-width': STREET_CASING_WIDTH,
        'line-opacity': 0.85,
      },
    },
    {
      id: 'streets',
      type: 'line',
      source: 'streets',
      layout: { 'line-cap': 'butt', 'line-join': 'miter' },
      paint: {
        'line-color': [
          'match',
          ['get', 'street_type'],
          'arterial',
          colors.primary,
          'secondary',
          colors.textSecondary,
          colors.textMuted,
        ],
        'line-width': STREET_WIDTH,
        'line-opacity': 0.95,
      },
    },
    {
      // Synthesised building footprints — buildings are stored as Points;
      // buildingsToFeatures buffers each into a small square so structures
      // read as shapes. The type icon rides above as a DOM marker.
      id: 'building-footprints-fill',
      type: 'fill',
      source: 'buildingFootprints',
      paint: {
        'fill-color': colors.textSecondary,
        'fill-opacity': 0.55,
      },
    },
    {
      id: 'building-footprints-line',
      type: 'line',
      source: 'buildingFootprints',
      paint: {
        'line-color': colors.textSecondary,
        'line-width': 1,
        'line-opacity': 0.9,
      },
    },
    // NOTE: buildings and agents are rendered as DOM markers (Lit-rendered
    // icons + count badges) instead of MapLibre circle layers — see
    // SimulationWorldMap._renderBuildingMarkers / _renderAgentMarkers. The
    // buildings/agents *sources* stay populated so queryRenderedFeatures
    // and any future symbol-layer overlay remain available without a
    // source rebuild.
  ];

  return {
    version: 8,
    name: 'velg-world-map',
    sources,
    layers,
  };
}

export function polygonCentroid(polygon: { coordinates: number[][][] }): [number, number] | null {
  const ring = polygon.coordinates[0];
  if (!ring || ring.length === 0) return null;
  // Use the shoelace-weighted centroid for non-degenerate polygons; falls back
  // to simple averaging if the area is zero.
  let area = 0;
  let cx = 0;
  let cy = 0;
  const n =
    ring.length -
    (ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[(i + 1) % n];
    const cross = x0 * y1 - x1 * y0;
    area += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  area /= 2;
  if (Math.abs(area) < 1e-12) {
    let sx = 0;
    let sy = 0;
    for (let i = 0; i < n; i++) {
      sx += ring[i][0];
      sy += ring[i][1];
    }
    return [sx / n, sy / n];
  }
  return [cx / (6 * area), cy / (6 * area)];
}

/**
 * Label anchor for a zone polygon: horizontally centred on the centroid,
 * vertically near the top edge. Area labels read better at the top of the
 * shape than dead-centre, and it frees the polygon interior for building
 * markers — de-conflicting the zone-label and building-marker layers.
 */
export function zoneLabelAnchor(polygon: { coordinates: number[][][] }): [number, number] | null {
  const centroid = polygonCentroid(polygon);
  if (!centroid) return null;
  const ring = polygon.coordinates[0];
  if (!ring || ring.length === 0) return null;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const [, lat] of ring) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return [centroid[0], maxLat - (maxLat - minLat) * 0.15];
}

export function computeBounds(
  payload: WorldMapResponse,
): [[number, number], [number, number]] | null {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  const ingest = (lng: number, lat: number) => {
    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  };

  for (const z of payload.zones) {
    if (!z.geojson) continue;
    for (const ring of z.geojson.coordinates) {
      for (const [lng, lat] of ring) ingest(lng, lat);
    }
  }
  for (const s of payload.streets) {
    if (!s.geojson) continue;
    for (const [lng, lat] of s.geojson.coordinates) ingest(lng, lat);
  }
  for (const b of payload.buildings) {
    if (!b.geojson) continue;
    const [lng, lat] = b.geojson.coordinates;
    ingest(lng, lat);
  }
  // City centers are label anchors, not content extent. Fold them into the
  // bounds only as a fallback when there is no geometry at all — otherwise an
  // empty city (a center coordinate with zero zones/streets/buildings, e.g.
  // Hafenstadt Korrin) drags the fitted box far past the real content and
  // leaves half the canvas dead. With geometry present, fit to it alone.
  if (!Number.isFinite(minLng)) {
    for (const c of payload.cities) {
      if (c.map_center_lat == null || c.map_center_lng == null) continue;
      ingest(c.map_center_lng, c.map_center_lat);
    }
  }

  if (!Number.isFinite(minLng)) return null;
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

/**
 * True if (lng, lat) lies inside the bounding box. Used to drop the label for a
 * city that has no geometry — computeBounds fits to geometry alone, so an empty
 * city's centre falls outside the returned bounds.
 */
export function pointInBounds(
  lng: number,
  lat: number,
  bounds: [[number, number], [number, number]],
): boolean {
  return lng >= bounds[0][0] && lng <= bounds[1][0] && lat >= bounds[0][1] && lat <= bounds[1][1];
}

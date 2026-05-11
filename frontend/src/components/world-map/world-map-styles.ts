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
  if (/industri|workshop|factory|forge|engineering|firmware|refiner|mill/.test(t)) return 'industrial';
  if (/commerc|market|bazaar|trade|hub|port/.test(t)) return 'commercial';
  if (/resid|habit|housing|quarter|domest|dwelling/.test(t)) return 'residential';
  if (/science|memory|topside|liminal|astral|reality|deck|segment|access/.test(t))
    return 'liminal';
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
  authority: { color: 'primary', opacity: 0.26 },
  sacred: { color: 'success', opacity: 0.22 },
  industrial: { color: 'warning', opacity: 0.24 },
  commercial: { color: 'info', opacity: 0.22 },
  residential: { color: 'textSecondary', opacity: 0.16 },
  marginal: { color: 'danger', opacity: 0.2 },
  liminal: { color: 'epochInfluence', opacity: 0.24 },
  other: { color: 'textSecondary', opacity: 0.18 },
};

export function zoneCategoryColor(category: ZoneCategory, colors: MapColors): string {
  return colors[ZONE_CATEGORY_STYLE[category].color];
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

interface FeatureCollection<F> {
  type: 'FeatureCollection';
  features: F[];
}

export function buildZonesData(zones: WorldMapZone[]): FeatureCollection<ZoneFeature> {
  return {
    type: 'FeatureCollection',
    features: zones
      .filter((z): z is WorldMapZone & { geojson: NonNullable<WorldMapZone['geojson']> } =>
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
      .filter((s): s is WorldMapStreet & { geojson: NonNullable<WorldMapStreet['geojson']> } =>
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

function buildingsToFeatures(buildings: WorldMapBuilding[]): {
  collection: FeatureCollection<BuildingFeature>;
  positions: Map<string, BuildingPosition>;
} {
  const positions = new Map<string, BuildingPosition>();
  const features: BuildingFeature[] = [];
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
  }
  return { collection: { type: 'FeatureCollection', features }, positions };
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

// MapLibre match expression — keep arms aligned with ZONE_CATEGORY_STYLE.
function zoneFillColorExpr(colors: MapColors): ExpressionSpecification {
  return [
    'match',
    ['get', 'category'],
    'authority', colors[ZONE_CATEGORY_STYLE.authority.color],
    'sacred', colors[ZONE_CATEGORY_STYLE.sacred.color],
    'industrial', colors[ZONE_CATEGORY_STYLE.industrial.color],
    'commercial', colors[ZONE_CATEGORY_STYLE.commercial.color],
    'residential', colors[ZONE_CATEGORY_STYLE.residential.color],
    'marginal', colors[ZONE_CATEGORY_STYLE.marginal.color],
    'liminal', colors[ZONE_CATEGORY_STYLE.liminal.color],
    /* default */ colors[ZONE_CATEGORY_STYLE.other.color],
  ];
}

const ZONE_CATEGORY_OPACITY_EXPR: ExpressionSpecification = [
  'match',
  ['get', 'category'],
  'authority', ZONE_CATEGORY_STYLE.authority.opacity,
  'sacred', ZONE_CATEGORY_STYLE.sacred.opacity,
  'industrial', ZONE_CATEGORY_STYLE.industrial.opacity,
  'commercial', ZONE_CATEGORY_STYLE.commercial.opacity,
  'residential', ZONE_CATEGORY_STYLE.residential.opacity,
  'marginal', ZONE_CATEGORY_STYLE.marginal.opacity,
  'liminal', ZONE_CATEGORY_STYLE.liminal.opacity,
  /* default */ ZONE_CATEGORY_STYLE.other.opacity,
];

// Stability label config (matches the 5 canonical bands from mv_zone_stability
// in migration 031). Same pattern as ZONE_CATEGORY_STYLE: single source of
// truth, match expressions below derive their values from here.
type StabilityLabel = 'critical' | 'unstable' | 'functional' | 'stable' | 'exemplary';

const STABILITY_STYLE: Record<StabilityLabel, { color: keyof MapColors; opacity: number }> = {
  critical: { color: 'danger', opacity: 0.32 },
  unstable: { color: 'danger', opacity: 0.2 },
  functional: { color: 'warning', opacity: 0.1 },
  stable: { color: 'success', opacity: 0.04 },
  exemplary: { color: 'success', opacity: 0.08 },
};

function stabilityFillColorExpr(colors: MapColors): ExpressionSpecification {
  return [
    'match',
    ['get', 'stability_label'],
    'critical', colors[STABILITY_STYLE.critical.color],
    'unstable', colors[STABILITY_STYLE.unstable.color],
    'functional', colors[STABILITY_STYLE.functional.color],
    'stable', colors[STABILITY_STYLE.stable.color],
    'exemplary', colors[STABILITY_STYLE.exemplary.color],
    /* default */ colors.surface,
  ];
}

const STABILITY_OPACITY_EXPR: ExpressionSpecification = [
  'match',
  ['get', 'stability_label'],
  'critical', STABILITY_STYLE.critical.opacity,
  'unstable', STABILITY_STYLE.unstable.opacity,
  'functional', STABILITY_STYLE.functional.opacity,
  'stable', STABILITY_STYLE.stable.opacity,
  'exemplary', STABILITY_STYLE.exemplary.opacity,
  /* default */ 0,
];

const STREET_WIDTH: ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['zoom'],
  10,
  ['match', ['get', 'street_type'], 'arterial', 1.2, 'secondary', 0.8, 'tertiary', 0.5, 0.3],
  18,
  ['match', ['get', 'street_type'], 'arterial', 4, 'secondary', 2.6, 'tertiary', 1.6, 0.8],
];

const BUILDING_RADIUS: ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['zoom'],
  12,
  ['match', ['get', 'building_type'], 'government', 3, 'religious', 2.8, 'industrial', 2.4, 2],
  18,
  ['match', ['get', 'building_type'], 'government', 7, 'religious', 6.5, 'industrial', 5.5, 4.5],
];

export function buildMapStyle(payload: WorldMapResponse, colors: MapColors): StyleSpecification {
  const zonesFC = buildZonesData(payload.zones);
  const streetsFC = streetsToFeatures(payload.streets);
  const { collection: buildingsFC, positions } = buildingsToFeatures(payload.buildings);
  const agentsFC = agentsToFeatures(payload.agent_markers, positions);

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
    zones: { type: 'geojson', data: zonesFC, promoteId: 'id' },
    streets: { type: 'geojson', data: streetsFC, promoteId: 'id' },
    buildings: { type: 'geojson', data: buildingsFC, promoteId: 'id' },
    agents: { type: 'geojson', data: agentsFC, promoteId: 'id' },
  };

  const layers: LayerSpecification[] = [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': colors.surface },
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
      id: 'zones-line',
      type: 'line',
      source: 'zones',
      paint: {
        'line-color': categoryColorExpr,
        'line-width': 1.2,
        'line-dasharray': [3, 2],
        'line-opacity': 0.65,
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
        'line-opacity': 0.85,
      },
    },
    {
      id: 'buildings-shadow',
      type: 'circle',
      source: 'buildings',
      paint: {
        'circle-radius': BUILDING_RADIUS,
        'circle-color': colors.surface,
        'circle-translate': [1, 1],
        'circle-opacity': 0.9,
      },
    },
    {
      id: 'buildings',
      type: 'circle',
      source: 'buildings',
      paint: {
        'circle-radius': BUILDING_RADIUS,
        'circle-color': [
          'match',
          ['get', 'building_type'],
          'government',
          colors.primary,
          'religious',
          colors.primary,
          colors.textSecondary,
        ],
        'circle-stroke-width': 1,
        'circle-stroke-color': colors.surface,
        'circle-pitch-alignment': 'map',
      },
    },
    {
      id: 'agents',
      type: 'circle',
      source: 'agents',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 1.2, 18, 2.6],
        'circle-color': colors.success,
        'circle-stroke-width': 0.5,
        'circle-stroke-color': colors.surface,
        'circle-opacity': 0.85,
      },
    },
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
  const n = ring.length - (ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? 1 : 0);
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

export function computeBounds(payload: WorldMapResponse): [[number, number], [number, number]] | null {
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
  for (const c of payload.cities) {
    if (c.map_center_lat == null || c.map_center_lng == null) continue;
    ingest(c.map_center_lng, c.map_center_lat);
  }

  if (!Number.isFinite(minLng)) return null;
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

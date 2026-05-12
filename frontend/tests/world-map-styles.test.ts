/**
 * Unit tests for world-map-styles.ts pure helpers.
 *
 * Integration via Playwright covers the MapLibre pipeline end-to-end;
 * these tests lock in the pure-function contracts (categorisation,
 * centroid math, bounds math, color lookup) so behaviour regressions
 * surface without spinning up a browser.
 */

import { describe, expect, it } from 'vitest';
import {
  agentRoleColorVar,
  buildZonesData,
  categoriseAgentRole,
  categoriseZoneType,
  computeBounds,
  type MapColors,
  polygonCentroid,
  zoneCategoryColor,
} from '../src/components/world-map/world-map-styles.js';
import type {
  WorldMapBuilding,
  WorldMapResponse,
  WorldMapStreet,
  WorldMapZone,
} from '../src/types/world-map.js';

// ───────────────────────────────────────────────────────────────────
// Fixtures
// ───────────────────────────────────────────────────────────────────

const TEST_COLORS: MapColors = {
  surface: '#000001',
  surfaceRaised: '#000002',
  border: '#000003',
  textMuted: '#000004',
  textSecondary: '#000005',
  primary: '#000006',
  danger: '#000007',
  success: '#000008',
  warning: '#000009',
  info: '#00000A',
  epochInfluence: '#00000B',
};

function makeZone(overrides: Partial<WorldMapZone> = {}): WorldMapZone {
  return {
    id: 'z1',
    name: 'Test Zone',
    zone_type: 'residential',
    geojson: null,
    stability: null,
    stability_label: null,
    ...overrides,
  };
}

function emptyPayload(): WorldMapResponse {
  return {
    simulation_id: 's1',
    simulation_slug: 'sim',
    is_game_instance: false,
    geometry_source_id: 's1',
    geometry_version: 1,
    cities: [],
    zones: [],
    streets: [],
    buildings: [],
    agent_markers: [],
    theme_hints: {
      color_primary: null,
      color_surface: null,
      color_border: null,
      color_danger: null,
      color_success: null,
      color_text: null,
      font_heading: null,
      font_body: null,
    },
  };
}

// ───────────────────────────────────────────────────────────────────
// categoriseZoneType — covers the 8 buckets + edge cases
// ───────────────────────────────────────────────────────────────────

describe('categoriseZoneType', () => {
  it('returns "other" for null / undefined / empty', () => {
    expect(categoriseZoneType(null)).toBe('other');
    expect(categoriseZoneType(undefined)).toBe('other');
    expect(categoriseZoneType('')).toBe('other');
  });

  it('categorises authority bucket', () => {
    expect(categoriseZoneType('government')).toBe('authority');
    expect(categoriseZoneType('capital_core')).toBe('authority');
    expect(categoriseZoneType('command-deck')).toBe('authority');
    expect(categoriseZoneType('administrative')).toBe('authority');
    expect(categoriseZoneType('throne_room')).toBe('authority');
  });

  it('categorises sacred bucket', () => {
    expect(categoriseZoneType('religious')).toBe('sacred');
    expect(categoriseZoneType('temple')).toBe('sacred');
    expect(categoriseZoneType('monastery')).toBe('sacred');
    expect(categoriseZoneType('cathedral')).toBe('sacred');
  });

  it('categorises industrial bucket', () => {
    expect(categoriseZoneType('industrial')).toBe('industrial');
    expect(categoriseZoneType('workshop')).toBe('industrial');
    expect(categoriseZoneType('engineering-core')).toBe('industrial');
    expect(categoriseZoneType('forge')).toBe('industrial');
    expect(categoriseZoneType('firmware')).toBe('industrial');
  });

  it('categorises commercial bucket', () => {
    expect(categoriseZoneType('commercial')).toBe('commercial');
    expect(categoriseZoneType('market')).toBe('commercial');
    expect(categoriseZoneType('bazaar')).toBe('commercial');
    expect(categoriseZoneType('port')).toBe('commercial');
    expect(categoriseZoneType('hub')).toBe('commercial');
  });

  it('categorises residential bucket', () => {
    expect(categoriseZoneType('residential')).toBe('residential');
    expect(categoriseZoneType('habitation-ring')).toBe('residential');
    expect(categoriseZoneType('quarter')).toBe('residential');
    expect(categoriseZoneType('domestic')).toBe('residential');
  });

  it('categorises liminal bucket', () => {
    expect(categoriseZoneType('science-wing')).toBe('liminal');
    expect(categoriseZoneType('memory-segment')).toBe('liminal');
    expect(categoriseZoneType('topside-access')).toBe('liminal');
    expect(categoriseZoneType('astral_plane')).toBe('liminal');
  });

  it('categorises marginal bucket', () => {
    expect(categoriseZoneType('slums')).toBe('marginal');
    expect(categoriseZoneType('worker_slum')).toBe('marginal');
    expect(categoriseZoneType('ruins')).toBe('marginal');
    expect(categoriseZoneType('abandoned_block')).toBe('marginal');
    expect(categoriseZoneType('decay')).toBe('marginal');
  });

  it('prefers liminal over marginal for "edge_of_reality"', () => {
    // Regression guard: regex order was reversed in self-check #2 so the
    // semantic "edge of reality" reads as liminal (boundary) not marginal
    // (decayed) despite containing neither "marginal" keywords.
    expect(categoriseZoneType('edge_of_reality')).toBe('liminal');
  });

  it('falls back to "other" for unknown zone types', () => {
    expect(categoriseZoneType('unknown-type')).toBe('other');
    expect(categoriseZoneType('field')).toBe('other');
  });

  it('is case-insensitive', () => {
    expect(categoriseZoneType('GOVERNMENT')).toBe('authority');
    expect(categoriseZoneType('RuInS')).toBe('marginal');
  });
});

// ───────────────────────────────────────────────────────────────────
// zoneCategoryColor — single-source-of-truth dispatch
// ───────────────────────────────────────────────────────────────────

describe('zoneCategoryColor', () => {
  it('maps each category to its configured colour', () => {
    expect(zoneCategoryColor('authority', TEST_COLORS)).toBe(TEST_COLORS.primary);
    expect(zoneCategoryColor('sacred', TEST_COLORS)).toBe(TEST_COLORS.success);
    expect(zoneCategoryColor('industrial', TEST_COLORS)).toBe(TEST_COLORS.warning);
    expect(zoneCategoryColor('commercial', TEST_COLORS)).toBe(TEST_COLORS.info);
    expect(zoneCategoryColor('residential', TEST_COLORS)).toBe(TEST_COLORS.textSecondary);
    expect(zoneCategoryColor('marginal', TEST_COLORS)).toBe(TEST_COLORS.danger);
    expect(zoneCategoryColor('liminal', TEST_COLORS)).toBe(TEST_COLORS.epochInfluence);
    expect(zoneCategoryColor('other', TEST_COLORS)).toBe(TEST_COLORS.textSecondary);
  });
});

// ───────────────────────────────────────────────────────────────────
// polygonCentroid — shoelace math + degenerate fallbacks
// ───────────────────────────────────────────────────────────────────

describe('polygonCentroid', () => {
  it('returns the geometric centre of an axis-aligned square (closed ring)', () => {
    // Closed ring: last point equals first.
    const c = polygonCentroid({
      coordinates: [
        [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10],
          [0, 0],
        ],
      ],
    });
    expect(c).not.toBeNull();
    expect(c![0]).toBeCloseTo(5, 6);
    expect(c![1]).toBeCloseTo(5, 6);
  });

  it('handles an open ring (last point != first) equivalently', () => {
    const c = polygonCentroid({
      coordinates: [
        [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10],
        ],
      ],
    });
    expect(c).not.toBeNull();
    expect(c![0]).toBeCloseTo(5, 6);
    expect(c![1]).toBeCloseTo(5, 6);
  });

  it('returns null for empty coordinates', () => {
    expect(polygonCentroid({ coordinates: [[]] })).toBeNull();
  });

  it('returns null for missing ring', () => {
    expect(polygonCentroid({ coordinates: [] })).toBeNull();
  });

  it('falls back to vertex average for zero-area polygons (collinear points)', () => {
    // All points on the x-axis — area is zero. Should fall back to mean.
    const c = polygonCentroid({
      coordinates: [
        [
          [0, 0],
          [5, 0],
          [10, 0],
        ],
      ],
    });
    expect(c).not.toBeNull();
    expect(c![0]).toBeCloseTo(5, 6);
    expect(c![1]).toBeCloseTo(0, 6);
  });

  it('computes the centre of a non-axis-aligned triangle correctly', () => {
    // Triangle with vertices (0,0), (6,0), (0,6) — centroid at (2,2).
    const c = polygonCentroid({
      coordinates: [
        [
          [0, 0],
          [6, 0],
          [0, 6],
        ],
      ],
    });
    expect(c).not.toBeNull();
    expect(c![0]).toBeCloseTo(2, 6);
    expect(c![1]).toBeCloseTo(2, 6);
  });
});

// ───────────────────────────────────────────────────────────────────
// computeBounds — union over zones/streets/buildings/cities
// ───────────────────────────────────────────────────────────────────

describe('computeBounds', () => {
  it('returns null when no geometry is present', () => {
    expect(computeBounds(emptyPayload())).toBeNull();
  });

  it('returns null when zones have null geojson and no other geometry', () => {
    const payload = emptyPayload();
    payload.zones = [makeZone({ geojson: null })];
    expect(computeBounds(payload)).toBeNull();
  });

  it('captures the bbox of a single zone polygon', () => {
    const payload = emptyPayload();
    payload.zones = [
      makeZone({
        geojson: {
          type: 'Polygon',
          coordinates: [
            [
              [1, 2],
              [3, 2],
              [3, 4],
              [1, 4],
              [1, 2],
            ],
          ],
        },
      }),
    ];
    expect(computeBounds(payload)).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it('expands the bbox to include streets, buildings, and cities', () => {
    const payload = emptyPayload();
    payload.zones = [
      makeZone({
        geojson: {
          type: 'Polygon',
          coordinates: [
            [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 1],
              [0, 0],
            ],
          ],
        },
      }),
    ];
    const street: WorldMapStreet = {
      id: 'st1',
      name: null,
      street_type: 'tertiary',
      length_km: 0.1,
      geojson: { type: 'LineString', coordinates: [[-1, -1], [5, 5]] },
    };
    payload.streets = [street];
    const building: WorldMapBuilding = {
      id: 'b1',
      name: 'B',
      building_type: 'archive',
      geojson: { type: 'Point', coordinates: [7, 8] },
      street_id: null,
      zone_id: null,
    };
    payload.buildings = [building];
    payload.cities = [
      {
        id: 'c1',
        name: 'City',
        map_center_lat: -3,
        map_center_lng: 10,
        map_default_zoom: 12,
      },
    ];
    expect(computeBounds(payload)).toEqual([
      [-1, -3],
      [10, 8],
    ]);
  });

  it('skips cities whose centre is missing', () => {
    const payload = emptyPayload();
    payload.zones = [
      makeZone({
        geojson: {
          type: 'Polygon',
          coordinates: [[[0, 0], [1, 1]]],
        },
      }),
    ];
    payload.cities = [
      { id: 'c1', name: 'X', map_center_lat: null, map_center_lng: null, map_default_zoom: null },
    ];
    expect(computeBounds(payload)).toEqual([
      [0, 0],
      [1, 1],
    ]);
  });
});

// ───────────────────────────────────────────────────────────────────
// buildZonesData — feature-collection projection used by setData polling
// ───────────────────────────────────────────────────────────────────

describe('buildZonesData', () => {
  it('drops zones with null geojson', () => {
    const fc = buildZonesData([
      makeZone({ id: 'a', geojson: null }),
      makeZone({
        id: 'b',
        geojson: {
          type: 'Polygon',
          coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]],
        },
      }),
    ]);
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0].id).toBe('b');
  });

  it('promotes zone.id to feature.id AND properties.id (for promoteId compat)', () => {
    const fc = buildZonesData([
      makeZone({
        id: 'zone-uuid',
        zone_type: 'government',
        geojson: { type: 'Polygon', coordinates: [[[0, 0], [1, 1]]] },
      }),
    ]);
    expect(fc.features[0].id).toBe('zone-uuid');
    expect(fc.features[0].properties.id).toBe('zone-uuid');
  });

  it('runs categoriseZoneType into properties.category', () => {
    const fc = buildZonesData([
      makeZone({
        zone_type: 'workshop',
        geojson: { type: 'Polygon', coordinates: [[[0, 0], [1, 1]]] },
      }),
    ]);
    expect(fc.features[0].properties.category).toBe('industrial');
  });

  it('preserves stability fields for the live-overlay paint expression', () => {
    const fc = buildZonesData([
      makeZone({
        stability: 0.42,
        stability_label: 'unstable',
        geojson: { type: 'Polygon', coordinates: [[[0, 0], [1, 1]]] },
      }),
    ]);
    expect(fc.features[0].properties.stability).toBe(0.42);
    expect(fc.features[0].properties.stability_label).toBe('unstable');
  });
});

// ───────────────────────────────────────────────────────────────────
// categoriseAgentRole — free-text profession → role archetype
// ───────────────────────────────────────────────────────────────────

describe('categoriseAgentRole', () => {
  it('returns "other" for null / undefined / empty', () => {
    expect(categoriseAgentRole(null)).toBe('other');
    expect(categoriseAgentRole(undefined)).toBe('other');
    expect(categoriseAgentRole('')).toBe('other');
  });

  it('categorises the lore bucket', () => {
    expect(categoriseAgentRole('Archivist')).toBe('lore');
    expect(categoriseAgentRole('Lorekeeper of the Vault')).toBe('lore');
    expect(categoriseAgentRole('Cartographer')).toBe('lore');
    expect(categoriseAgentRole('Story Distiller')).toBe('lore');
    expect(categoriseAgentRole('Resonance Attuner')).toBe('lore');
    expect(categoriseAgentRole('Court Historian')).toBe('lore');
  });

  it('categorises the craft bucket', () => {
    expect(categoriseAgentRole('Forgewright')).toBe('craft');
    expect(categoriseAgentRole('Blacksmith')).toBe('craft');
    expect(categoriseAgentRole('Stonemason')).toBe('craft');
    expect(categoriseAgentRole('Mason')).toBe('craft');
    expect(categoriseAgentRole('Cooper')).toBe('craft');
    expect(categoriseAgentRole('Shipwright')).toBe('craft');
  });

  it('categorises the trade bucket', () => {
    expect(categoriseAgentRole('Merchant')).toBe('trade');
    expect(categoriseAgentRole('Grain Trader')).toBe('trade');
    expect(categoriseAgentRole('Moneylender')).toBe('trade');
    expect(categoriseAgentRole('Broker')).toBe('trade');
  });

  it('categorises the civic bucket', () => {
    expect(categoriseAgentRole('Magistrate')).toBe('civic');
    expect(categoriseAgentRole('Tide Clerk')).toBe('civic');
    expect(categoriseAgentRole('Harbour Warden')).toBe('civic');
    expect(categoriseAgentRole('Diplomat')).toBe('civic');
    expect(categoriseAgentRole('Registrar')).toBe('civic');
  });

  it('prefers lore over trade for "Resonance Broker"', () => {
    // Regression guard: "broker" alone is a trade keyword, but "resonance"
    // is the distinctive part — a Resonance Broker is a keeper of arcane
    // knowledge, not a market trader. Lore is tested first so it wins.
    expect(categoriseAgentRole('Resonance Broker')).toBe('lore');
    // And a plain "Broker" still falls through to trade.
    expect(categoriseAgentRole('Broker')).toBe('trade');
  });

  it('matches "mason" only as a whole word but "stonemason" via its own arm', () => {
    // \bmason\b would miss "stonemason" (no boundary before "mason"), so
    // the craft arm carries an explicit "stonemason" alternative.
    expect(categoriseAgentRole('Stonemason')).toBe('craft');
    expect(categoriseAgentRole('Mason')).toBe('craft');
  });

  it('does not let bare "sage" match inside other words', () => {
    // \bsage\b — "Message Clerk" must read as civic (clerk), not lore.
    expect(categoriseAgentRole('Message Clerk')).toBe('civic');
    expect(categoriseAgentRole('Court Sage')).toBe('lore');
  });

  it('matches "keeper" only as a whole word — "shopkeeper" is trade, not lore', () => {
    // Regression guard: bare /keeper/ caught "shopkeeper"/"innkeeper"; the
    // \bkeeper\b anchor + the explicit "shopkeep" arm of trade fix it.
    expect(categoriseAgentRole('Shopkeeper')).toBe('trade');
    expect(categoriseAgentRole('Records Keeper')).toBe('lore');
    expect(categoriseAgentRole('Lorekeeper of the Vault')).toBe('lore');
  });

  it('falls back to "other" for unrecognised / plain professions', () => {
    expect(categoriseAgentRole('laborer')).toBe('other');
    expect(categoriseAgentRole('Field Hand')).toBe('other');
    expect(categoriseAgentRole('Wanderer')).toBe('other');
  });

  it('is case-insensitive', () => {
    expect(categoriseAgentRole('ARCHIVIST')).toBe('lore');
    expect(categoriseAgentRole('blackSMITH')).toBe('craft');
  });
});

describe('agentRoleColorVar', () => {
  it('maps each archetype to its CSS-token var reference', () => {
    expect(agentRoleColorVar('civic')).toBe('var(--color-primary)');
    expect(agentRoleColorVar('craft')).toBe('var(--color-warning)');
    expect(agentRoleColorVar('lore')).toBe('var(--color-info)');
    expect(agentRoleColorVar('trade')).toBe('var(--color-epoch-influence)');
    expect(agentRoleColorVar('other')).toBe('var(--color-success)');
  });
});

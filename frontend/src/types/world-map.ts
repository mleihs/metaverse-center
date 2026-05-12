import type { UUID } from './index.js';

export type MapGeneratorPreset =
  | 'medieval_walled'
  | 'modern_grid'
  | 'radial_capital'
  | 'coastal_port'
  | 'underground_station';

export interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

export interface GeoJSONLineString {
  type: 'LineString';
  coordinates: number[][];
}

export interface GeoJSONPoint {
  type: 'Point';
  coordinates: number[];
}

export interface WorldMapCity {
  id: UUID;
  name: string;
  map_center_lat: number | null;
  map_center_lng: number | null;
  map_default_zoom: number | null;
}

export interface WorldMapZone {
  id: UUID;
  name: string;
  zone_type: string | null;
  geojson: GeoJSONPolygon | null;
  stability: number | null;
  stability_label: string | null;
}

export interface WorldMapStreet {
  id: UUID;
  name: string | null;
  street_type: string | null;
  length_km: number | null;
  geojson: GeoJSONLineString | null;
}

export interface WorldMapBuilding {
  id: UUID;
  name: string;
  building_type: string | null;
  geojson: GeoJSONPoint | null;
  street_id: UUID | null;
  zone_id: UUID | null;
}

export interface WorldMapAgentMarker {
  agent_id: UUID;
  name: string;
  home_building_id: UUID | null;
  /** Free-text profession (mirrors `agents.primary_profession`). The map
   *  buckets this into a small set of role archetypes for the marker tint;
   *  the detail panel shows the localised text. NULL when unrecorded. */
  profession: string | null;
  profession_de: string | null;
}

/**
 * Transient event payload streamed via Supabase Realtime (postgres_changes on
 * the `events` table). NOT part of `WorldMapResponse` — events are not
 * returned by the /map endpoint; they arrive live and drop pulse markers on
 * the map. Field names mirror the `events` table row 1:1 (snake_case) so
 * the realtime handler can pass the row through with minimal projection.
 */
export interface WorldMapEvent {
  id: UUID;
  title: string;
  location: string;
  impact_level: number;
  event_type: string | null;
  occurred_at: string | null;
}

export interface WorldMapThemeHints {
  color_primary: string | null;
  color_surface: string | null;
  color_border: string | null;
  color_danger: string | null;
  color_success: string | null;
  color_text: string | null;
  font_heading: string | null;
  font_body: string | null;
}

export interface WorldMapResponse {
  simulation_id: UUID;
  simulation_slug: string;
  is_game_instance: boolean;
  geometry_source_id: UUID;
  geometry_version: number;
  cities: WorldMapCity[];
  zones: WorldMapZone[];
  streets: WorldMapStreet[];
  buildings: WorldMapBuilding[];
  agent_markers: WorldMapAgentMarker[];
  theme_hints: WorldMapThemeHints;
}

export interface MapGenerationResult {
  simulation_id: UUID;
  preset_used: MapGeneratorPreset;
  seed_used: string;
  geometry_version: number;
  cities_updated: number;
  zones_updated: number;
  streets_inserted: number;
  buildings_updated: number;
  lives_at_inserted: number;
  duration_seconds: number;
}

export interface MapRegenerateRequest {
  seed?: string;
  preset?: MapGeneratorPreset;
}

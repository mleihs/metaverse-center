/* === DRIFT travel types (P0a vertical slice) === */

import type { UUID } from './index.js';

export type DriftRunStatus = 'active' | 'frozen' | 'distress' | 'completed' | 'abandoned';

export type DriftFrequency =
  | 'commerce'
  | 'language'
  | 'memory'
  | 'resonance'
  | 'architecture'
  | 'dream'
  | 'desire';

export type DriftDistanceBand = 'near' | 'mid' | 'deep';

/** A travel_runs row as returned by the run-lifecycle RPCs (mirrors TravelRunResponse). */
export interface TravelRun {
  id: UUID;
  user_id: UUID;
  status: DriftRunStatus;
  run_version: number;
  kohaerenz: number;
  bandbreite: number;
  dissonanz: number;
  frequency: DriftFrequency;
  position_node_id: UUID | null;
  scale: string;
  begehung_simulation_id: UUID | null;
  begehung_zone_id: UUID | null;
  window_remaining: number;
  takt_count: number;
  checkpoint: Record<string, unknown>;
  event_seq: number;
  chart_version: number | null;
  opened_at: string;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DriftChartNode {
  id: UUID;
  stable_key: string;
  node_type: string;
  simulation_id: UUID | null;
  /** World display name for broadcast_rand homes (null for interstitials/core). */
  simulation_name: string | null;
  x: number;
  y: number;
  frequency_mask: number;
  distance_band: DriftDistanceBand;
  payload: Record<string, unknown>;
}

export interface DriftChartEdge {
  id: UUID;
  from_node: UUID;
  to_node: UUID;
  weight: number;
  /** Per-vector permeability multiplier, keyed by frequency name. */
  permeability: Record<string, number>;
  corridor: boolean;
}

export interface DriftChart {
  chart_version: number;
  nodes: DriftChartNode[];
  edges: DriftChartEdge[];
}

/** HUD gauge scalars from drift_tuning (§2) — the source of truth for bar maxima. */
export interface DriftTuning {
  window_base: number;
  dz_cap: number;
  /** Bandbreite max keyed by bandwidth class ("1".."4"); P0 travellers are class 1. */
  bandwidth_class_bb_max: Record<string, number>;
}

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

/** An Erstvermessung claim on the shared chart (chart_honors, first-write-wins / C4).
 *  Keyed by node_stable_key so it survives regeneration; is_self marks the caller's own. */
export interface DriftHonor {
  node_stable_key: string;
  kind: 'erstvermessung' | 'erstkontakt';
  claimed_at: string;
  is_self: boolean;
}

/** A Träger of a world, surfaced on docking (active_agents, public-read). */
export interface DriftDockAgent {
  id: UUID;
  name: string;
  primary_profession: string | null;
  portrait_image_url: string | null;
}

/** A lore chapter's voice (simulation_lore) shown at the broadcast edge. */
export interface DriftDockLore {
  title: string | null;
  epigraph: string | null;
}

/** A world's identity surfaced on docking at its broadcast edge. */
export interface DriftDock {
  simulation_id: UUID;
  name: string;
  description: string | null;
  theme: string | null;
  lore: DriftDockLore[];
  agents: DriftDockAgent[];
}

/** HUD gauge scalars from drift_tuning (§2) — the source of truth for bar maxima. */
export interface DriftTuning {
  window_base: number;
  dz_cap: number;
  /** Bandbreite max keyed by bandwidth class ("1".."4"); P0 travellers are class 1. */
  bandwidth_class_bb_max: Record<string, number>;
}

/* === Quests / Depeschen (P0c deliver) === */

/** A travel_cargo manifest item — the one-of-a-kind payload carried on a run. */
export interface DriftCargo {
  id: UUID;
  family: string;
  vector: DriftFrequency;
  twists: unknown[];
  quest_instance_id: UUID | null;
  run_id: UUID | null;
}

/** An offered deliver Depesche (the deliver template bound to a foreign world). */
export interface DriftQuestOffer {
  template_key: string;
  family: string;
  title: string;
  brief: string;
  cargo_family: string;
  cargo_vector: DriftFrequency;
  target_simulation_id: UUID;
  target_simulation_name: string;
}

/** The accepted Depesche the traveler carries (raw instance + HUD enrichment). */
export interface DriftQuestInstance {
  id: UUID;
  template_key: string;
  simulation_id: UUID;
  status: string;
  slots: Record<string, unknown>;
  title: string | null;
  target_simulation_name: string | null;
}

/** The hospitality-gate outcome of a delivery (applied vs filtered, with reasons). */
export interface DriftQuestEffects {
  already_applied: boolean;
  applied: Array<Record<string, unknown>>;
  skipped: Array<Record<string, unknown>>;
}

/** The HUD's quest snapshot: acceptable offers here + the carried one + the manifest. */
export interface DriftQuestState {
  offers: DriftQuestOffer[];
  active: DriftQuestInstance | null;
  cargo: DriftCargo[];
}

/** fn_quest_accept result — the version-bumped run + the new instance + bound cargo. */
export interface DriftQuestAcceptResult {
  run: TravelRun;
  instance: DriftQuestInstance;
  cargo: DriftCargo;
}

/** fn_quest_advance result — the version-bumped run + completed instance + effects. */
export interface DriftQuestDeliverResult {
  run: TravelRun;
  instance: DriftQuestInstance;
  effects: DriftQuestEffects;
}

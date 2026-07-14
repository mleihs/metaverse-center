/* === DRIFT travel types (P0a vertical slice) === */

import type { UUID } from './index.js';

export type DriftRunStatus =
  | 'active'
  | 'frozen'
  | 'distress'
  /** Stranded at the failure floor, awaiting the traveller's decision (migration 265). */
  | 'havarie'
  | 'completed'
  | 'abandoned';

/** The five Havarie options. Which ones are OFFERED is decided server-side and written
 *  into the checkpoint when the Havarie opens — the client never invents one. */
export type DriftHavarieChoice =
  | 'notabwurf'
  | 'notruf'
  | 'zerfaserung'
  | 'ueberziehen'
  | 'rueckruf';

/** The Havarie block the RPC writes into checkpoint.havarie (migration 265). */
export interface DriftHavarie {
  cause: 'kohaerenz' | 'window';
  options: DriftHavarieChoice[];
  cargo_aboard: number;
  haul_at_risk: number;
  /** The tuning catalogue, so the panel can STATE each option's price instead of hiding it. */
  catalogue: Record<string, Record<string, number>>;
  expires_at: string;
}

/* === Signals + Sondierung (Welle 2, migrations 266-268) ==================== */

/** The five signal classes. The first two STOP the run and wait for an answer; the other
 *  three resolve the moment they are drawn and only write a logbook line. */
export type DriftSignalClass = 'stoerung' | 'fund' | 'geruecht' | 'begegnung' | 'stille';

/** The three Sondierung marker classes. Three of one kind at a node and it tears. */
export type DriftMarkerClass = 'resonanz' | 'statik' | 'echo';

/** The closed outcome vocabulary (migration 266). Every key optional — a signal writes
 *  only what it touches, and a key that is absent is a line the HUD must not print. */
export interface DriftSignalDeltas {
  kh?: number;
  bb?: number;
  dz?: number;
  takt?: number;
  siegel?: number;
  siegel_balance?: number;
  cargo_grant?: { family: string; vector: string; haul: number };
  rumor_reveal?: { node_id?: string; band?: string };
  marker_add?: DriftMarkerClass;
}

/** The scene text, with {sim} already resolved to a real world by the server. */
export interface DriftSignalProse {
  title_de: string;
  title_en: string;
  body_de: string;
  body_en: string;
}

/** One answer the traveller may give. Only PAYABLE options ever reach the panel — the draw
 *  refuses to show a scene it knows the run cannot afford to leave. */
export interface DriftSignalOption {
  key: string;
  label_de: string;
  label_en: string;
  /** Paid up front, whatever the roll says. The chip promises it; the RPC keeps it. */
  cost?: { kh?: number; bb?: number; takt?: number };
  /** Present ⇒ the option is a gamble. The DIFFICULTY is never shown (concept R4): the chip
   *  says "riskant" and names the vector, and the traveller learns the rest by living. */
  check?: { vector: string; difficulty: number };
}

/** The scene the run is standing in and cannot walk away from (checkpoint.pending_signal,
 *  lifted to a typed field by the backend model). While it is set, a move is refused. */
export interface DriftPendingSignal {
  template_key: string;
  signal_class: DriftSignalClass;
  takt?: number | null;
  prose?: DriftSignalProse | null;
  options: DriftSignalOption[];
}

/** What the answer did — the result state of the panel (checkpoint.last_signal). */
export interface DriftResolvedSignal {
  template_key: string;
  signal_class: DriftSignalClass;
  option_key: string;
  success: boolean;
  outcome?: { text_de?: string; text_en?: string; deltas?: DriftSignalDeltas } | null;
  applied?: DriftSignalDeltas | null;
}

/** The reveal of one dig (checkpoint.last_sondierung, migration 268). `bust` is the
 *  Resonanzriss: the loose yield of THIS node is gone — nothing else is. */
export interface DriftSondierungReveal {
  node_id: string;
  dig: number;
  marker: DriftMarkerClass;
  stack: DriftMarkerClass[];
  yield: number;
  bust: boolean;
  forfeited: number;
}

/** The Funkboje's receipt (checkpoint.last_bank). */
export interface DriftBankReceipt {
  loose: number;
  safe: number;
  rate: number;
  haul_safe: number;
}

/** One line of the traveller's logbook — signals, rumours, banks, digs, Havarien. Outlives
 *  its run: knowledge is the only thing a Havarie cannot scatter. */
export interface DriftLogEntry {
  id: UUID;
  run_id: UUID | null;
  takt: number;
  kind: 'signal' | 'rumor' | 'bank' | 'havarie' | 'sondierung';
  node_id: UUID | null;
  payload: Record<string, unknown>;
  created_at: string;
}

/** What an act of the run paid (fn_drift_award). One shape for every payer. */
export interface DriftEarnings {
  source: string;
  siegel_earned: number;
  vp_earned: number;
  siegel_balance: number;
  vp_total: number;
  clearance_rank: string;
}

/** ONE thing a delivery did to the world — or was stopped from doing. A filtered card is
 *  not an error: a world that only admits echoes has ANSWERED, and the card says so. */
export interface DriftEffectCard {
  kind: string;
  status: 'applied' | 'filtered';
  target_kind: 'self' | 'simulation' | 'agent' | 'none';
  target_label: string;
  simulation_id: UUID | null;
  simulation_slug: string | null;
  agent_id: UUID | null;
  /** The agent route addresses by slug, not by id — the receipt link needs this one. */
  agent_slug: string | null;
  event_id: UUID | null;
  hospitality: string | null;
  reason: string | null;
}

/** The traveller's Bureau account (GET /drift/profile). Null before the first run. */
export interface DriftProfile {
  siegel: number;
  vp: number;
  clearance_rank: string;
  bandwidth_class: number;
  zerfaserung_count: number;
  vermessung_lodged: number;
  unlocked_vectors: string[];
  next_rank: string | null;
  next_rank_vp: number | null;
  next_rank_fee: number | null;
  next_rank_progress: number;
  exam_ready: boolean;
}

/** fn_clearance_exam result. */
export interface DriftClearanceExam {
  clearance_rank: string;
  fee_paid: number;
  siegel_balance: number;
  vp_total: number;
}

export type DriftFrequency =
  | 'commerce'
  | 'language'
  | 'memory'
  | 'resonance'
  | 'architecture'
  | 'dream'
  | 'desire';

export type DriftDistanceBand = 'near' | 'mid' | 'deep';

/** Public phase-gate snapshot from GET /api/v1/public/drift/state (no JWT). */
export interface DriftPublicState {
  enabled: boolean;
}

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
  /** Lifted out of checkpoint.earnings by the backend model — the receipt of the act that
   *  closed (or paid) this run. Null while the Fun-Kern gate is closed. */
  earnings: DriftEarnings | null;
  /** Lifted out of checkpoint.pending_signal: the scene the run is WAITING on. While this
   *  is set the server refuses a move (SIGNAL_PENDING) — a Störung is a decision, not a
   *  notification. Null while the Fun-Kern gate is closed. */
  pending_signal: DriftPendingSignal | null;
  /** Lifted out of checkpoint.last_signal: what the last answer did. */
  last_signal: DriftResolvedSignal | null;
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
  /** What each successive dig at the same node is worth. The HUD STATES the next yield;
   *  the table is the server's, or a re-tune would turn the panel into a liar. */
  sondierung_yields: number[];
  /** The Funkboje's exchange rate (0.7 = 70 % of the loose haul arrives safely). */
  funkboje_rate: number;
  /** Where a haul can be transmitted at all (broadcast edges today, relays from W3). */
  funkboje_node_types: string[];
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

/** fn_quest_advance result — the version-bumped run + completed instance + effects.
 *  `cards` is the honest per-effect breakdown (named targets + receipt links); `earnings`
 *  is what the Depesche paid (null while the Fun-Kern gate is closed). */
export interface DriftQuestDeliverResult {
  run: TravelRun;
  instance: DriftQuestInstance;
  effects: DriftQuestEffects;
  cards: DriftEffectCard[];
  earnings: DriftEarnings | null;
}

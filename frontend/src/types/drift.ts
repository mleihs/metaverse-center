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

/** The five Havarie options. Which ones are OFFERED is decided server-side when the Havarie
 *  opens — the client never invents one, and an option the server did not offer is refused. */
export type DriftHavarieChoice =
  | 'notabwurf'
  | 'notruf'
  | 'zerfaserung'
  | 'ueberziehen'
  | 'rueckruf';

/** The wreck the run is standing in (TravelRun.havarie, migration 265). */
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
  /** Present ⇒ the option is a gamble. The chip says "riskant" and names the vector; the
   *  DIFFICULTY is not in this type because it is no longer in the RESPONSE (W2.6/B — the
   *  backend model parses it and drops it). The traveller learns the shape of a risk by
   *  living it, not by reading it off a tooltip (concept R4). */
  check?: { vector: string };
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

/** The reveal of one dig (TravelRun.last_sondierung, migration 268). `bust` is the
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

/** The Funkboje's receipt (TravelRun.last_bank). */
export interface DriftBankReceipt {
  loose: number;
  safe: number;
  rate: number;
  haul_safe: number;
}

/** How a run ENDED, and what it was worth (TravelRun.closing, W2.6).
 *
 *  Five endings write this one block server-side (drift_closing_payload), so the Bureau
 *  debriefing has a single contract to read. It used to be a flat set of loose checkpoint keys
 *  hand-built by four different functions — which is how four copies of a contract drift apart.
 *
 *  `haul_transmitted` is the Funkboje reserve that arrived anyway. It reads 0 while the
 *  Fun-Kern gate is shut (the reserve is still PAID in that case — money brought ashore under
 *  an open gate is not rollback residue — and `earnings` says so). */
export interface DriftClosingReceipt {
  reason: 'entladung' | 'rueckruf' | 'zerfaserung' | 'rueckzug' | 'kollaps';
  /** Why it ended, when it ended badly. */
  cause?: 'kohaerenz' | 'window' | null;
  /** How the unravelling was reached. */
  detail?: 'choice' | 'ttl_expired' | 'gate_closed' | null;
  haul_banked: number;
  haul_lost: number;
  haul_transmitted: number;
  /** The loose haul BEFORE a recall multiplier (a recalled haul must never be presented as
   *  a full one). */
  haul_before?: number | null;
  haul_mult?: number | null;
  surveys_delivered: number;
  honors_won: number;
  honor_keys: string[];
  scattered?: { scattered?: number; [k: string]: unknown } | null;
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
  /** The traveller's HOME world. The server derives "at home" from this (and only this) —
   *  deriving it from the ROUTE instead makes the client disagree with the server the
   *  moment DRIFT is opened from a world that is not the traveller's anchor. */
  anchor_simulation_id: UUID;
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

/** Public phase-gate snapshot from GET /api/v1/public/drift/state (no JWT).
 *
 *  Spiegelt `backend/models/drift.py::DriftPublicState` Feld fuer Feld. Alle Phasen
 *  kommen KUMULATIV an: `p2` ist nur wahr, wenn auch `p1` und `enabled` (P0) wahr
 *  sind. Die Regel wendet der Server an (`DriftService.get_public_state`) - der
 *  Client leitet sie nicht noch einmal her, sonst gaebe es zwei Fassungen davon.
 *
 *  `ai` ist keine Phase, sondern ein Querschalter, und haengt nur an P0. Er meldet
 *  einen Zustand, den heute keine Erzeugungsstelle abfragt: DRIFT ruft ueberhaupt
 *  keine KI. Die Oberflaeche darf daraus nicht ableiten, dass gerade Geld gespart
 *  wird.
 *
 *  `highest_open_phase` ist `null`, solange schon P0 zu ist; sonst die Nummer der
 *  hoechsten offenen Phase (0 = P0). */
export interface DriftPublicState {
  enabled: boolean;
  ai: boolean;
  p1: boolean;
  p2: boolean;
  p3: boolean;
  p4: boolean;
  highest_open_phase: number | null;
}

/** A travel_runs row as the API returns it (mirrors backend TravelRunResponse).
 *
 *  There is NO `checkpoint` here. The raw jsonb used to be shipped 1:1 alongside the typed
 *  fields that carefully lift only what the panel may see — which made the typing worthless
 *  for confidentiality: the blob carried every option's `check.difficulty` and the deltas of
 *  EVERY branch of a pending scene. The concept says the odds are never numbered (R4); via
 *  DevTools they were. W2.6/B made the checkpoint input-only, server-side.
 *
 *  What used to be untyped keys in that blob is now split in two:
 *    - the run's live STATE → columns (haul, haul_safe, overstay, markers, sondierung)
 *    - the run's SCENES     → typed fields (pending_signal, last_signal, last_sondierung,
 *                             last_bank, havarie, closing, earnings)
 *  A column is what is TRUE of the run; a scene is what JUST HAPPENED. */
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
  event_seq: number;
  chart_version: number | null;
  opened_at: string;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  /* ── The run's live state: COLUMNS (W2.6/D) ───────────────────────────────
   * These were untyped keys in the checkpoint jsonb, which is where a marker stack could
   * silently empty on a move and the same money could be booked three times. */

  /** The LOOSE haul — everything a Havarie, a Riss or a Zerfaserung can still take.
   *  DERIVED server-side (the Erstvermessung + the dig sites + the manifest); no writer sets
   *  it, so no partial booking can go stale. */
  haul: number;
  /** What the Funkboje transmitted: already ashore. Nothing after it can take it — not a
   *  Havarie, not a Riss, not a Zerfaserung, not a Rückzug (all four pay it out). */
  haul_safe: number;
  /** The Havarie's `ueberziehen` permit: the expired window no longer collapses the run, and
   *  every further Takt costs extra Dissonanz. */
  overstay: boolean;
  /** {node_id: [marker_class, …]} — the open, COUNTABLE marker stack (R4). */
  markers: Record<string, DriftMarkerClass[]>;
  /** {node_id: {digs, yield, rissig}} — the dig sites this run has opened. */
  sondierung: Record<string, { digs?: number; yield?: number; rissig?: boolean }>;

  /* ── The run's scenes: lifted out of the checkpoint, server-side ──────────── */

  /** What the last act PAID. The count-up ceremony's contract; null when nothing moved. */
  earnings: DriftEarnings | null;
  /** The scene the run is WAITING on. While this is set the server refuses a move, a dig AND
   *  a bank (SIGNAL_PENDING) — a Störung is a decision, not a notification. */
  pending_signal: DriftPendingSignal | null;
  /** What the last answer did — the result state of the panel. */
  last_signal: DriftResolvedSignal | null;
  /** The reveal of the last dig. */
  last_sondierung: DriftSondierungReveal | null;
  /** The Funkboje's receipt. */
  last_bank: DriftBankReceipt | null;
  /** The wreck the run is standing in, with the options the SERVER offered. */
  havarie: DriftHavarie | null;
  /** How the run ended, and what it was worth. Only on a closed run. */
  closing: DriftClosingReceipt | null;
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

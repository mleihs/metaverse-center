/**
 * TypeScript types for the Resonance Dungeon system.
 *
 * Mirrors backend Pydantic models:
 *   backend/models/resonance_dungeon.py — dungeon-specific types
 *   backend/models/combat.py — shared combat types
 *
 * Three layers:
 * 1. Enums / Union types — shared literals
 * 2. Client state — fog-of-war filtered, rendered by components
 * 3. Request / Response — API contract
 */

import type { UUID } from './index.js';

// ── Archetype Constants ─────────────────────────────────────────────────────

export const ARCHETYPE_SHADOW = 'The Shadow';
export const ARCHETYPE_TOWER = 'The Tower';
export const ARCHETYPE_ENTROPY = 'The Entropy';
export const ARCHETYPE_MOTHER = 'The Devouring Mother';
export const ARCHETYPE_PROMETHEUS = 'The Prometheus';

// ── Enums / Union Types ─────────────────────────────────────────────────────

/** Database-level run status. */
export type DungeonStatus =
  | 'active'
  | 'combat'
  | 'exploring'
  | 'distributing'
  | 'completed'
  | 'abandoned'
  | 'wiped';

/** State machine phase — drives HUD panel visibility. */
export type DungeonPhase =
  | 'exploring'
  | 'encounter'
  | 'combat_planning'
  | 'combat_resolving'
  | 'combat_outcome'
  | 'rest'
  | 'treasure'
  | 'boss'
  | 'exit'
  | 'room_clear'
  | 'distributing'
  | 'completed'
  | 'retreated'
  | 'wiped';

/** Event types logged to resonance_dungeon_events. */
export type DungeonEventType =
  | 'room_entered'
  | 'combat_started'
  | 'combat_resolved'
  | 'skill_check'
  | 'encounter_choice'
  | 'loot_found'
  | 'agent_stressed'
  | 'agent_afflicted'
  | 'agent_virtue'
  | 'agent_wounded'
  | 'party_wipe'
  | 'boss_defeated'
  | 'dungeon_completed'
  | 'dungeon_abandoned'
  | 'banter'
  | 'discovery';

/** Room types in the dungeon DAG. "?" for unrevealed (fog of war). */
export type RoomType =
  | 'combat'
  | 'elite'
  | 'encounter'
  | 'treasure'
  | 'rest'
  | 'boss'
  | 'entrance'
  | 'exit';

/** The 8 Substrate Archetypes. */
export type ArchetypeName =
  | 'The Tower'
  | 'The Shadow'
  | 'The Devouring Mother'
  | 'The Deluge'
  | 'The Overthrow'
  | 'The Prometheus'
  | 'The Awakening'
  | 'The Entropy';

/** Agent condition track (Operational → Stressed → Wounded → Afflicted → Captured). */
export type Condition = 'operational' | 'stressed' | 'wounded' | 'afflicted' | 'captured';

/** Computed stress display threshold. */
export type StressThreshold = 'normal' | 'tense' | 'critical';

/** Enemy power classification. */
export type ThreatLevel = 'minion' | 'standard' | 'elite' | 'boss';

/** Abstracted enemy health (exact HP hidden from client). */
export type EnemyConditionDisplay = 'healthy' | 'damaged' | 'critical' | 'defeated';

/** The 6 ability schools. */
export type AbilitySchool =
  | 'spy'
  | 'guardian'
  | 'saboteur'
  | 'propagandist'
  | 'infiltrator'
  | 'assassin';

/** Combat sub-phase within a round. */
export type CombatPhase = 'assessment' | 'planning' | 'resolving' | 'outcome';

/** 3-tier skill check result (Disco Elysium + PbtA hybrid). */
export type SkillCheckResult = 'success' | 'partial' | 'fail';

// ── Archetype-Specific State ───────────────���────────────────────────────────

/** Shadow archetype: visibility-point mechanic state. */
export interface ShadowArchetypeState {
  visibility: number;
  max_visibility: number;
  rooms_since_vp_loss: number;
}

/** Tower archetype: stability countdown mechanic state. */
export interface TowerArchetypeState {
  stability: number;
  max_stability: number;
}

/** Entropy archetype: decay accumulation mechanic state (0→100). */
export interface EntropyArchetypeState {
  decay: number;
  max_decay: number;
}

/** Devouring Mother archetype: parasitic attachment mechanic state (0→100). */
export interface MotherArchetypeState {
  attachment: number;
  max_attachment: number;
}

/** Component held in the Prometheus workshop inventory. */
export interface PrometheusComponent {
  id: string;
  name_en: string;
  name_de: string;
  /** Material category: metal, fluid, crystal, powder, energy. */
  type: string;
}

/** Crafted item produced by combining components (pharmakon: benefit + cost). */
export interface PrometheusCraftedItem {
  id: string;
  name_en: string;
  name_de: string;
  benefit_en: string;
  benefit_de: string;
  cost_en: string;
  cost_de: string;
}

/** Prometheus archetype: crafting insight mechanic (0→100, pharmakon accumulation). */
export interface PrometheusArchetypeState {
  insight: number;
  max_insight: number;
  components: PrometheusComponent[];
  crafted_items: PrometheusCraftedItem[];
  total_crafted: number;
  failed_crafts: number;
}

/** Archetype-specific state. Shadow, Tower, Entropy, Mother, and Prometheus have typed shapes; others are empty objects. */
export type ArchetypeState =
  | ShadowArchetypeState
  | TowerArchetypeState
  | EntropyArchetypeState
  | MotherArchetypeState
  | PrometheusArchetypeState
  | Record<string, unknown>;

/** Type guard: narrows ArchetypeState to ShadowArchetypeState. */
export function isShadowState(state: ArchetypeState): state is ShadowArchetypeState {
  return 'visibility' in state && typeof state.visibility === 'number';
}

/** Type guard: narrows ArchetypeState to TowerArchetypeState. */
export function isTowerState(state: ArchetypeState): state is TowerArchetypeState {
  return 'stability' in state && typeof state.stability === 'number';
}

/** Type guard: narrows ArchetypeState to EntropyArchetypeState. */
export function isEntropyState(state: ArchetypeState): state is EntropyArchetypeState {
  return 'decay' in state && typeof state.decay === 'number';
}

/** Type guard: narrows ArchetypeState to MotherArchetypeState. */
export function isMotherState(state: ArchetypeState): state is MotherArchetypeState {
  return 'attachment' in state && typeof state.attachment === 'number';
}

/** Type guard: narrows ArchetypeState to PrometheusArchetypeState. */
export function isPrometheusState(state: ArchetypeState): state is PrometheusArchetypeState {
  return 'insight' in state && typeof state.insight === 'number';
}

// ── Client State (fog-of-war filtered, from backend) ────────────────────────

/** Full state sent to client for rendering. Single source of truth. */
export interface DungeonClientState {
  run_id: UUID;
  archetype: string;
  signature: string;
  difficulty: number;
  depth: number;
  current_room: number;

  /** Room graph with fog of war applied. Unrevealed rooms show room_type "?". */
  rooms: RoomNodeClient[];

  /** Party agents with combat-relevant state. */
  party: AgentCombatStateClient[];

  /** Archetype-specific state (e.g. Shadow: {visibility, max_visibility, rooms_since_vp_loss}). */
  archetype_state: ArchetypeState;

  /** Active combat (null when not in combat). */
  combat: CombatStateClient | null;

  /** Current state machine phase — drives HUD panel visibility. */
  phase: DungeonPhase;

  /** Timer for timed phases (combat planning, distribution). Null when no timer active. */
  phase_timer: PhaseTimer | null;

  /** Pending loot items for distribution (only during 'distributing' phase). */
  pending_loot?: LootItem[] | null;
  /** Current loot assignments: loot_id → agent_id (during 'distributing' phase). */
  loot_assignments?: Record<string, string>;
  /** Suggested assignments: loot_id → agent_id (computed by backend). */
  loot_suggestions?: Record<string, string>;

  /** Encounter choices (only during 'encounter' or 'rest' phase). */
  encounter_choices?: EncounterChoiceClient[] | null;
  /** Encounter description in English (only during 'encounter' or 'rest' phase). */
  encounter_description_en?: string | null;
  /** Encounter description in German (only during 'encounter' or 'rest' phase). */
  encounter_description_de?: string | null;
}

/** Room as seen by the client (fog of war applied). */
export interface RoomNodeClient {
  index: number;
  depth: number;
  /** "?" if not revealed, otherwise a RoomType value. */
  room_type: string;
  /** Connected room indices. Empty if not revealed. */
  connections: number[];
  cleared: boolean;
  /** Is the party currently in this room? */
  current: boolean;
  revealed: boolean;
}

/** Agent state as seen by the client. */
export interface AgentCombatStateClient {
  agent_id: UUID;
  agent_name: string;
  portrait_url: string | null;
  condition: Condition;
  /** Raw stress value (0-1000+). */
  stress: number;
  /** Pre-computed display threshold: "normal" | "tense" | "critical". */
  stress_threshold: StressThreshold;
  /** Mood value (-100 to +100). */
  mood: number;
  active_buffs: BuffDebuff[];
  active_debuffs: BuffDebuff[];
  /** Aptitude levels keyed by school name (e.g. {"spy": 8, "guardian": 3}). */
  aptitudes: Record<string, number>;
  /** Abilities available for combat planning. */
  available_abilities: AbilityOption[];
  /** Short personality summary (e.g. "cautious, analytical, reserved"). */
  personality_summary: string;
}

/** Active buff or debuff on an agent. */
export interface BuffDebuff {
  id: string;
  name: string;
  /** Icon key from icons.ts. */
  icon: string;
  /** Rounds remaining. Null = permanent. */
  duration_rounds: number | null;
  description: string;
}

/** Available ability for combat planning. */
export interface AbilityOption {
  id: string;
  name_en: string;
  name_de: string;
  /** Ability school (spy, guardian, etc.). */
  school: string;
  description_en: string;
  description_de: string;
  /** Pre-calculated check info (e.g. "Spy 8: 73% success"). Null if auto-success. */
  check_info: string | null;
  /** Rounds until usable. 0 = ready. */
  cooldown_remaining: number;
  /** Once-per-dungeon ultimate ability. */
  is_ultimate: boolean;
  /** Target type: determines whether target picker is shown. */
  targets: 'single_enemy' | 'all_enemies' | 'single_ally' | 'all_allies' | 'self';
}

/** Combat state as seen by the client. */
export interface CombatStateClient {
  round_num: number;
  max_rounds: number;
  enemies: EnemyCombatStateClient[];
  phase: CombatPhase;
  timer: PhaseTimer | null;
  /** Into-the-Breach-style enemy intention previews. */
  telegraphed_actions: TelegraphedAction[];
}

/** Enemy state as seen by the client. Exact HP/steps hidden. */
export interface EnemyCombatStateClient {
  instance_id: string;
  name_en: string;
  name_de: string;
  /** Abstracted condition display, not exact steps. */
  condition_display: string;
  threat_level: string;
  is_alive: boolean;
  telegraphed_action: TelegraphedAction | null;
}

/** Enemy's telegraphed intent (Into the Breach style). */
export interface TelegraphedAction {
  enemy_name: string;
  /** Description of planned action (e.g. "will attack Agent Kovacs"). */
  intent: string;
  /** Target agent or "all". Null for untargeted abilities. */
  target: string | null;
  threat_level: 'low' | 'medium' | 'high' | 'critical';
}

/** Timer for timed phases (combat planning countdown). */
export interface PhaseTimer {
  /** ISO 8601 timestamp of when the timer started (server clock). */
  started_at: string;
  /** Total duration in milliseconds. */
  duration_ms: number;
  /** Phase this timer belongs to. */
  phase: string;
}

// ── Request Types ───────────────────────────────────────────────────────────

/** POST /dungeons/runs — start a new dungeon run. */
export interface DungeonRunCreate {
  archetype: ArchetypeName;
  /** 2-4 agent UUIDs forming the party. */
  party_agent_ids: UUID[];
  /** Difficulty 1-5. */
  difficulty: number;
}

/** POST /dungeons/runs/{id}/move — move party to adjacent room. */
export interface DungeonMoveRequest {
  room_index: number;
}

/** POST /dungeons/runs/{id}/action — generic encounter/interaction action. */
export interface DungeonAction {
  action_type: 'encounter_choice' | 'combat_action' | 'interact' | 'use_ability';
  agent_id?: UUID | null;
  choice_id?: string | null;
  ability_id?: string | null;
  target_id?: string | null;
}

/** Single agent's combat action for the planning phase. */
export interface CombatAction {
  agent_id: UUID;
  ability_id: string;
  target_id?: string | null;
}

/** POST /dungeons/runs/{id}/combat/submit — all actions for one planning phase. */
export interface CombatSubmission {
  actions: CombatAction[];
}

/** POST /dungeons/runs/{id}/scout — spy scout request. */
export interface ScoutRequest {
  agent_id: UUID;
}

/** POST /dungeons/runs/{id}/rest — rest at rest site. */
export interface RestRequest {
  agent_ids: UUID[];
}

// ── Response Types ──────────────────────────────────────────────────────────

/** Dungeon run record (DB row). */
export interface DungeonRunResponse {
  id: UUID;
  simulation_id: UUID;
  resonance_id: UUID | null;
  archetype: string;
  resonance_signature: string;
  party_agent_ids: UUID[];
  party_player_ids: UUID[];
  difficulty: number;
  depth_target: number;
  current_depth: number;
  rooms_cleared: number;
  rooms_total: number;
  status: DungeonStatus;
  outcome: Record<string, unknown> | null;
  completed_at: string | null;
  created_at: string;
}

/** Extended run response with denormalized agent data. */
export interface DungeonRunDetailResponse extends DungeonRunResponse {
  party_agents: Record<string, unknown>[];
  events_count: number;
  duration_seconds: number | null;
}

/** POST /dungeons/runs — create run response. */
export interface CreateRunResponse {
  run: DungeonRunResponse;
  state: DungeonClientState;
  entrance_text?: { text_en: string; text_de: string } | null;
}

/** Anchor object text entry (Objektanker Variation C). */
export interface AnchorText {
  text_en: string;
  text_de: string;
  anchor_id: string;
  phase: string;
}

/** POST /dungeons/runs/{id}/move — room entry response. */
export interface MoveToRoomResponse {
  banter?: Record<string, string> | null;
  anchor_texts?: AnchorText[] | null;
  barometer_text?: Record<string, string> | null;
  combat?: boolean;
  encounter?: boolean;
  encounter_id?: string;
  description_en?: string;
  description_de?: string;
  choices?: EncounterChoiceClient[];
  rest?: boolean;
  treasure?: boolean;
  auto_loot?: boolean;
  loot?: LootItem[];
  exit_available?: boolean;
  state: DungeonClientState;
}

/** Encounter choice as presented to the client. */
export interface EncounterChoiceClient {
  id: string;
  label_en: string;
  label_de: string;
  requires_aptitude: Record<string, number> | null;
  check_aptitude: string | null;
  check_difficulty: number;
}

/** POST /dungeons/runs/{id}/combat/submit — combat submission response. */
export interface CombatSubmitResponse {
  round_result?: CombatRoundResult | null;
  waiting_for_players?: boolean;
  /** True when combat ended in victory (room_clear or completed phase). */
  victory?: boolean;
  /** Loot items rolled on combat victory. Empty/absent on wipe or stalemate. */
  loot?: LootItem[];
  state: DungeonClientState;
  /** True when the finalization RPC failed after retry. Instance kept in memory. */
  rpc_failed?: boolean;
  rpc_error_message?: string;
}

/** Resolved combat round result. */
export interface CombatRoundResult {
  round: number;
  events: CombatEvent[];
  narrative_en: string;
  narrative_de: string;
  victory: boolean;
  wipe: boolean;
  stalemate: boolean;
}

/** Single combat event within a round resolution. */
export interface CombatEvent {
  actor: string;
  action: string;
  target: string;
  hit: boolean;
  damage: number;
  stress: number;
  narrative_en: string;
  narrative_de: string;
}

/** POST /dungeons/runs/{id}/action — encounter choice response. */
export interface EncounterChoiceResponse {
  result: SkillCheckResult;
  check?: SkillCheckDetail | null;
  effects: Record<string, unknown>;
  /** Backend-generated narrative effect descriptions (bilingual). */
  narrative_effects_en?: string[];
  narrative_effects_de?: string[];
  narrative_en: string;
  narrative_de: string;
  state: DungeonClientState;
  /** Boss deployment → combat transition fields (Prometheus). */
  combat?: boolean;
  is_ambush?: boolean;
  encounter_description_en?: string;
  encounter_description_de?: string;
}

/** Detailed skill check breakdown. */
export interface SkillCheckDetail {
  aptitude: string;
  level: number;
  chance: number;
  roll: number;
  result: SkillCheckResult;
  breakdown: Record<string, number>;
}

/** POST /dungeons/runs/{id}/scout — scout response. */
export interface ScoutResponse {
  revealed_rooms: number;
  visibility?: number;
  state: DungeonClientState;
}

/** POST /dungeons/runs/{id}/rest — rest response. */
export interface RestResponse {
  healed: boolean;
  ambushed: boolean;
  state: DungeonClientState;
}

/** POST /dungeons/runs/{id}/retreat — retreat response. */
export interface RetreatResponse {
  retreated: boolean;
  loot: LootItem[];
  rpc_failed?: boolean;
  rpc_error_message?: string;
}

/** GET /dungeons/available — available dungeon archetype. */
export interface AvailableDungeonResponse {
  archetype: string;
  signature: string;
  resonance_id: UUID | null;
  magnitude: number;
  susceptibility: number;
  effective_magnitude: number;
  suggested_difficulty: number;
  suggested_depth: number;
  last_run_at: string | null;
  available: boolean;
  admin_override: boolean;
}

/** Single dungeon event from the event log. */
export interface DungeonEventResponse {
  id: UUID;
  run_id: UUID;
  depth: number;
  room_index: number;
  event_type: DungeonEventType;
  narrative_en: string | null;
  narrative_de: string | null;
  outcome: Record<string, unknown>;
  created_at: string;
}

/** Loot item drop. */
export interface LootItem {
  id: string;
  name_en: string;
  name_de: string;
  /** 1=minor, 2=major, 3=legendary. */
  tier: number;
  /** Effect category (e.g. "stress_heal", "aptitude_boost", "memory", "moodlet"). */
  effect_type: string;
  effect_params: Record<string, unknown>;
  description_en: string;
  description_de: string;
}

/** Persistent dungeon loot effect applied to an agent (provenance UI). */
export interface AgentLootEffect {
  id: string;
  agent_id: string;
  effect_type: string;
  effect_params: Record<string, unknown>;
  source_run_id: string | null;
  source_loot_id: string;
  consumed: boolean;
  created_at: string;
  /** Denormalized from source run */
  source_archetype: string | null;
  source_difficulty: number | null;
  source_completed_at: string | null;
}

// ── Loot Distribution Request/Response ─────────────────────────────────────

/** POST /dungeons/runs/{id}/distribute — assign one loot item. */
export interface LootAssignmentRequest {
  loot_id: string;
  agent_id: string;
}

/** Response from assign loot endpoint. */
export interface LootAssignmentResponse {
  assignments: Record<string, string>;
  remaining: number;
  all_assigned: boolean;
  state: DungeonClientState;
}

/** Response from confirm distribution endpoint. */
export interface DistributeConfirmResponse {
  loot_result: Record<string, unknown>;
  state: DungeonClientState;
}

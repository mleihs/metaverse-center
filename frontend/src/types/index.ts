/* === Domain Types for Velgarien Platform === */

export type UUID = string;

// --- Enums / Union Types ---

export type SimulationTheme =
  | 'dystopian'
  | 'utopian'
  | 'fantasy'
  | 'scifi'
  | 'historical'
  | 'custom';

export type SimulationStatus = 'draft' | 'configuring' | 'active' | 'paused' | 'archived';

export type SimulationType = 'template' | 'game_instance' | 'archived';

export type SimulationRole = 'owner' | 'admin' | 'editor' | 'viewer';

export type SettingCategory =
  | 'general'
  | 'world'
  | 'ai'
  | 'integration'
  | 'design'
  | 'access'
  | 'prompts'
  | 'notifications'
  | 'anchor'
  | 'heartbeat';

export type TaxonomyType =
  | 'gender'
  | 'profession'
  | 'system'
  | 'building_type'
  | 'building_style'
  | 'building_special_type'
  | 'campaign_type'
  | 'target_demographic'
  | 'urgency_level'
  | 'zone_type'
  | 'security_level'
  | 'event_type'
  | 'sentiment'
  | 'interaction_type'
  | 'campaign_tone'
  | 'complexity_level'
  | 'relationship_type';

export type PromptTemplateType =
  | 'agent_generation'
  | 'agent_description'
  | 'agent_reactions'
  | 'agent_portrait_description'
  | 'user_agent_description'
  | 'user_agent_portrait_description'
  | 'building_generation'
  | 'building_description'
  | 'building_image_prompt'
  | 'building_image_generation'
  | 'social_trends_title'
  | 'social_trends_description'
  | 'event_reaction'
  | 'news_integration'
  | 'portrait_generation'
  | 'chat_system_prompt'
  | 'chat_with_memory'
  | 'news_transformation'
  | 'social_media_transformation'
  | 'social_media_sentiment'
  | 'social_media_agent_reaction'
  | 'relationship_generation'
  | 'event_echo_transformation';

export type PromptCategory =
  | 'text_generation'
  | 'image_generation'
  | 'description_generation'
  | 'reaction_generation'
  | 'transformation'
  | 'analysis';

// --- Simulation ---

export interface Simulation {
  id: UUID;
  name: string;
  slug: string;
  description: string;
  description_de?: string;
  theme: SimulationTheme;
  status: SimulationStatus;
  simulation_type: SimulationType;
  source_template_id?: UUID;
  epoch_id?: UUID;
  content_locale: string;
  additional_locales: string[];
  owner_id: UUID;
  icon_url?: string;
  banner_url?: string;
  created_at: string;
  updated_at: string;
  archived_at?: string;
  deleted_at?: string;
  last_heartbeat_tick?: number;
  last_heartbeat_at?: string;
  next_heartbeat_at?: string;
  agent_count?: number;
  building_count?: number;
  event_count?: number;
  member_count?: number;
  members?: SimulationMember[];
  settings?: SimulationSetting[];
  taxonomies?: SimulationTaxonomy[];
}

export interface SimulationMember {
  id: UUID;
  simulation_id: UUID;
  user_id: UUID;
  member_role: SimulationRole;
  invited_by_id?: UUID;
  joined_at: string;
  user?: UserProfile;
}

export interface SimulationSetting {
  id: UUID;
  simulation_id: UUID;
  category: SettingCategory;
  setting_key: string;
  setting_value: unknown;
  updated_by_id?: UUID;
  created_at: string;
  updated_at: string;
}

export interface SimulationTaxonomy {
  id: UUID;
  simulation_id: UUID;
  taxonomy_type: TaxonomyType;
  value: string;
  label: Record<string, string>;
  description?: Record<string, string>;
  sort_order: number;
  is_default: boolean;
  is_active: boolean;
  metadata?: Record<string, unknown>;
}

// --- Agent ---

export interface Agent {
  id: UUID;
  simulation_id: UUID;
  name: string;
  system?: string;
  character?: string;
  character_de?: string;
  background?: string;
  background_de?: string;
  gender?: string;
  primary_profession?: string;
  primary_profession_de?: string;
  portrait_image_url?: string;
  portrait_description?: string;
  data_source?: string;
  created_by_id?: UUID;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  is_ambassador?: boolean;
  ambassador_blocked_until?: string;
  professions?: AgentProfession[];
  aptitudes?: AgentAptitude[];
  reactions?: EventReaction[];
  building_relations?: BuildingAgentRelation[];
}

export interface AgentProfession {
  id: UUID;
  simulation_id: UUID;
  agent_id: UUID;
  profession: string;
  qualification_level: number;
  specialization?: string;
  certified_at?: string;
  certified_by?: string;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
  agent?: Agent;
  profession_label?: string;
}

export interface AgentAptitude {
  id: UUID;
  agent_id: UUID;
  simulation_id: UUID;
  operative_type: OperativeType;
  aptitude_level: number;
  created_at: string;
  updated_at: string;
}

export type AptitudeSet = Record<OperativeType, number>;

// --- Building ---

export interface GeoLocation {
  lat: number;
  lng: number;
  address?: string;
}

export interface Building {
  id: UUID;
  simulation_id: UUID;
  name: string;
  building_type: string;
  building_type_de?: string;
  description?: string;
  description_de?: string;
  style?: string;
  location?: GeoLocation;
  city_id?: UUID;
  zone_id?: UUID;
  street_id?: UUID;
  address?: string;
  population_capacity: number;
  construction_year?: number;
  building_condition?: string;
  building_condition_de?: string;
  geojson?: Record<string, unknown>;
  image_url?: string;
  image_prompt_text?: string;
  special_type?: string;
  special_attributes?: Record<string, unknown>;
  data_source?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  agents?: BuildingAgentRelation[];
  events?: BuildingEventRelation[];
  profession_requirements?: BuildingProfessionRequirement[];
  city?: City;
  zone?: Zone;
  street?: CityStreet;
}

export interface BuildingAgentRelation {
  id: UUID;
  simulation_id: UUID;
  building_id: UUID;
  agent_id: UUID;
  relation_type: string;
  created_at: string;
  building?: Building;
  agent?: Agent;
}

export interface BuildingEventRelation {
  id: UUID;
  simulation_id: UUID;
  building_id: UUID;
  event_id: UUID;
  relation_type: string;
  created_at: string;
}

export interface BuildingProfessionRequirement {
  id: UUID;
  simulation_id: UUID;
  building_id: UUID;
  profession: string;
  min_qualification_level: number;
  is_mandatory: boolean;
  description?: string;
  created_at: string;
}

// --- Event ---

export type EventStatus = 'active' | 'escalating' | 'resolving' | 'resolved' | 'archived';

export type EventChainType = 'escalation' | 'follow_up' | 'resolution' | 'cascade' | 'resonance';

export interface Event {
  id: UUID;
  simulation_id: UUID;
  title: string;
  event_type?: string;
  description?: string;
  occurred_at: string;
  data_source: string;
  metadata?: Record<string, unknown>;
  source_platform?: string;
  propaganda_type?: string;
  target_demographic?: string;
  urgency_level?: string;
  campaign_id?: UUID;
  original_trend_data?: Record<string, unknown>;
  impact_level: number;
  location?: string;
  tags: string[];
  external_refs?: Record<string, unknown>;
  event_status: EventStatus;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  reactions?: EventReaction[];
  campaign?: Campaign;
}

export interface EventChain {
  id: UUID;
  simulation_id: UUID;
  parent_event_id: UUID;
  child_event_id: UUID;
  chain_type: EventChainType;
  created_at: string;
  parent?: { id: UUID; title: string; event_status: EventStatus };
  child?: { id: UUID; title: string; event_status: EventStatus };
}

export interface EventReaction {
  id: UUID;
  simulation_id: UUID;
  event_id: UUID;
  agent_id: UUID;
  agent_name: string;
  reaction_text: string;
  occurred_at: string;
  emotion?: string;
  confidence_score?: number;
  data_source?: string;
  created_at: string;
  updated_at: string;
  agent?: Agent;
  agents?: { id: UUID; name: string; portrait_image_url?: string };
  event?: Event;
  events?: { id: UUID; title: string };
}

// --- City / Zone / Street ---

export interface City {
  id: UUID;
  simulation_id: UUID;
  name: string;
  layout_type?: string;
  description?: string;
  population: number;
  map_center_lat?: number;
  map_center_lng?: number;
  map_default_zoom: number;
  created_at: string;
  updated_at: string;
  zones?: Zone[];
  streets?: CityStreet[];
  buildings?: Building[];
}

export interface Zone {
  id: UUID;
  simulation_id: UUID;
  city_id: UUID;
  name: string;
  description?: string;
  description_de?: string;
  zone_type: string;
  zone_type_de?: string;
  population_estimate: number;
  security_level: string;
  data_source?: string;
  created_at: string;
  updated_at: string;
  city?: City;
  streets?: CityStreet[];
  buildings?: Building[];
}

export interface CityStreet {
  id: UUID;
  simulation_id: UUID;
  city_id: UUID;
  zone_id?: UUID;
  name?: string;
  street_type?: string;
  street_type_de?: string;
  length_km?: number;
  geojson?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// --- Campaign ---

export interface Campaign {
  id: UUID;
  simulation_id: UUID;
  title: string;
  description?: string;
  campaign_type?: string;
  target_demographic?: string;
  urgency_level?: string;
  source_trend_id?: UUID;
  is_integrated_as_event: boolean;
  event_id?: UUID;
  created_at: string;
  updated_at: string;
  source_trend?: SocialTrend;
  event?: Event;
  campaign_events?: CampaignEvent[];
  metrics?: CampaignMetric[];
}

export interface CampaignEvent {
  id: UUID;
  simulation_id: UUID;
  campaign_id: UUID;
  event_id: UUID;
  integration_type: string;
  integration_status: string;
  agent_reactions_generated: boolean;
  reactions_count: number;
  event_metadata?: Record<string, unknown>;
  performance_metrics?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CampaignMetric {
  id: UUID;
  simulation_id: UUID;
  campaign_id: UUID;
  metric_name: string;
  metric_value: number;
  metric_metadata?: Record<string, unknown>;
  measured_at: string;
}

export interface CampaignAnalytics {
  event_count: number;
  events_by_type: Record<string, number>;
  echo_count: number;
  avg_impact: number | null;
  metrics_timeline: Array<{ name: string; value: number; at: string }>;
}

// --- Battle Summary / Sitrep (War Room) ---

export interface BattleSummary {
  cycle_number: number;
  missions_deployed: number;
  successes: number;
  failures: number;
  detections: number;
  events_by_type: Record<string, number>;
  narrative_highlights: Array<{
    event_type: string;
    narrative: string;
    is_public: boolean;
    source_simulation_id?: UUID;
    target_simulation_id?: UUID;
    created_at: string;
  }>;
}

export interface Sitrep {
  cycle_number: number;
  sitrep: string;
  summary: Record<string, unknown>;
  model_used: string;
}

// --- Chronicle ---

export interface Chronicle {
  id: UUID;
  simulation_id: UUID;
  epoch_id?: UUID;
  edition_number: number;
  period_start: string;
  period_end: string;
  title: string;
  headline?: string;
  content: string;
  title_de?: string;
  headline_de?: string;
  content_de?: string;
  model_used?: string;
  published_at?: string;
  created_at: string;
  updated_at: string;
}

// --- Agent Memory ---

export type MemoryType = 'observation' | 'reflection';
export type MemorySourceType = 'chat' | 'event_reaction' | 'system' | 'reflection';

export interface AgentMemory {
  id: UUID;
  agent_id: UUID;
  simulation_id: UUID;
  memory_type: MemoryType;
  content: string;
  content_de?: string;
  importance: number;
  source_type: MemorySourceType;
  source_id?: UUID;
  created_at: string;
  last_accessed_at?: string;
  retrieval_score?: number;
}

// --- Bleed Gazette ---

export interface GazetteEntry {
  entry_type: string;
  source_simulation?: { id: UUID; name: string; slug: string; theme: string } | null;
  target_simulation?: { id: UUID; name: string; slug: string; theme: string } | null;
  echo_vector?: string | null;
  strength?: number | null;
  narrative: string;
  dispatch?: string | null;
  created_at: string;
}

// --- Social Trends ---

export interface SocialTrend {
  id: UUID;
  simulation_id: UUID;
  name: string;
  platform: string;
  raw_data?: Record<string, unknown>;
  volume: number;
  url?: string;
  fetched_at: string;
  relevance_score?: number;
  sentiment?: string;
  is_processed: boolean;
  created_at: string;
  updated_at: string;
}

// --- Social Media ---

export interface SocialMediaPost {
  id: UUID;
  simulation_id: UUID;
  platform: string;
  platform_id: string;
  page_id?: string;
  author?: string;
  message?: string;
  source_created_at: string;
  attachments: unknown[];
  reactions: Record<string, unknown>;
  transformed_content?: string;
  transformation_type?: string;
  transformed_at?: string;
  original_sentiment?: Record<string, unknown>;
  transformed_sentiment?: Record<string, unknown>;
  is_published: boolean;
  linked_event_id?: UUID;
  imported_at: string;
  last_synced_at: string;
  created_at: string;
  updated_at: string;
}

export interface SocialMediaComment {
  id: UUID;
  simulation_id: UUID;
  post_id: UUID;
  platform_id: string;
  parent_comment_id?: UUID;
  author: string;
  message: string;
  source_created_at: string;
  transformed_content?: string;
  sentiment?: Record<string, unknown>;
  imported_at: string;
  created_at: string;
  updated_at: string;
}

export interface SocialMediaAgentReaction {
  id: UUID;
  simulation_id: UUID;
  post_id?: UUID;
  comment_id?: UUID;
  agent_id: UUID;
  reaction_type: string;
  reaction_content: string;
  reaction_intensity?: number;
  created_at: string;
}

// --- Chat ---

export interface AgentBrief {
  id: UUID;
  name: string;
  portrait_image_url?: string;
}

export interface ChatEventReference {
  id: UUID;
  event_id: UUID;
  event_title: string;
  event_type?: string;
  event_description?: string;
  occurred_at?: string;
  impact_level?: number;
  referenced_at: string;
}

export interface ChatConversation {
  id: UUID;
  simulation_id: UUID;
  user_id: UUID;
  agent_id?: UUID;
  title?: string;
  status: 'active' | 'archived';
  message_count: number;
  last_message_at?: string;
  created_at: string;
  updated_at: string;
  messages?: ChatMessage[];
  agent?: Agent;
  agents?: AgentBrief[];
  event_references?: ChatEventReference[];
}

export interface ChatMessage {
  id: UUID;
  conversation_id: UUID;
  sender_role: 'user' | 'assistant';
  content: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  agent_id?: UUID;
  agent?: AgentBrief;
}

// --- Prompt Templates ---

export interface PromptVariable {
  name: string;
  type: string;
  required: boolean;
  description?: string;
}

export interface PromptTemplate {
  id: UUID;
  simulation_id?: UUID;
  template_type: PromptTemplateType;
  prompt_category: PromptCategory;
  locale: string;
  template_name: string;
  prompt_content: string;
  system_prompt?: string;
  variables: PromptVariable[];
  description?: string;
  default_model?: string;
  temperature: number;
  max_tokens: number;
  negative_prompt?: string;
  is_system_default: boolean;
  is_active: boolean;
  version: number;
  parent_template_id?: UUID;
  created_by_id?: UUID;
  created_at: string;
  updated_at: string;
}

// --- Invitations ---

export interface Invitation {
  id: UUID;
  simulation_id: UUID;
  invited_email?: string;
  invite_token: string;
  invited_role: SimulationRole;
  invited_by_id: UUID;
  expires_at: string;
  accepted_at?: string;
  created_at: string;
}

export interface InvitationPublicInfo {
  simulation_name: string;
  invited_role: SimulationRole;
  invited_email?: string;
  expires_at: string;
  is_expired: boolean;
  is_accepted: boolean;
}

// --- User ---

export interface UserProfile {
  id: UUID;
  email: string;
  display_name?: string;
  avatar_url?: string;
  is_platform_admin?: boolean;
  created_at: string;
  updated_at: string;
}

export interface MembershipInfo {
  simulation_id: UUID;
  simulation_name: string;
  simulation_slug: string;
  member_role: SimulationRole;
  joined_at: string;
}

export interface ActiveEpochParticipation {
  epoch_id: UUID;
  epoch_name: string;
  epoch_status: EpochStatus;
  epoch_type: EpochType;
  current_cycle: number;
  total_cycles: number;
  current_rp: number;
  rp_cap: number;
  simulation_name: string;
  rank: number;
  participant_count: number;
}

export interface DashboardData {
  memberships: MembershipInfo[];
  active_epoch_participations: ActiveEpochParticipation[];
  academy_epochs_played: number;
  active_resonance_count: number;
}

// --- Agent Relationships ---

export interface AgentRelationship {
  id: UUID;
  simulation_id: UUID;
  source_agent_id: UUID;
  target_agent_id: UUID;
  relationship_type: string;
  is_bidirectional: boolean;
  intensity: number;
  description?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  source_agent?: Agent;
  target_agent?: Agent;
}

export interface RelationshipSuggestion {
  target_agent_id: string;
  relationship_type: string;
  intensity: number;
  description: string;
  is_bidirectional: boolean;
}

// --- Event Echoes ---

export type EchoVector =
  | 'commerce'
  | 'language'
  | 'memory'
  | 'resonance'
  | 'architecture'
  | 'dream'
  | 'desire';

export type EchoStatus = 'pending' | 'generating' | 'completed' | 'failed' | 'rejected';

export interface EventEcho {
  id: UUID;
  source_event_id: UUID;
  source_simulation_id: UUID;
  target_simulation_id: UUID;
  target_event_id?: UUID;
  echo_vector: EchoVector;
  echo_strength: number;
  echo_depth: number;
  root_event_id?: UUID;
  status: EchoStatus;
  bleed_metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  source_event?: Event;
  target_event?: Event;
}

// --- Simulation Connections ---

export interface SimulationConnection {
  id: UUID;
  simulation_a_id: UUID;
  simulation_b_id: UUID;
  connection_type: string;
  bleed_vectors: string[];
  strength: number;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  simulation_a?: Simulation;
  simulation_b?: Simulation;
}

// --- Embassies ---

export type EmbassyStatus = 'proposed' | 'active' | 'suspended' | 'dissolved';

export interface EmbassyAmbassador {
  name: string;
  role?: string;
  quirk?: string;
}

export interface EmbassyMetadata {
  ambassador_a?: EmbassyAmbassador;
  ambassador_b?: EmbassyAmbassador;
  protocol?: string;
  ache_point?: string;
  [key: string]: unknown;
}

export interface Embassy {
  id: UUID;
  building_a_id: UUID;
  simulation_a_id: UUID;
  building_b_id: UUID;
  simulation_b_id: UUID;
  status: EmbassyStatus;
  connection_type: string;
  description?: string;
  established_by?: string;
  bleed_vector?: EchoVector;
  event_propagation: boolean;
  embassy_metadata?: EmbassyMetadata;
  created_by_id?: UUID;
  infiltration_penalty?: number;
  infiltration_penalty_expires_at?: string;
  created_at: string;
  updated_at: string;
  building_a?: Building;
  building_b?: Building;
  simulation_a?: Simulation;
  simulation_b?: Simulation;
}

// --- Map Data ---

export interface ScoreDimensions {
  stability: number;
  influence: number;
  sovereignty: number;
  diplomatic: number;
  military: number;
}

export interface OperativeFlowEntry {
  count: number;
  types: string[];
}

export interface MapData {
  simulations: Simulation[];
  connections: SimulationConnection[];
  echo_counts: Record<string, number>;
  embassies?: Embassy[];
  active_instance_counts?: Record<string, number>;
  operative_flow?: Record<string, OperativeFlowEntry>;
  score_dimensions?: Record<string, ScoreDimensions>;
  sparklines?: Record<string, number[]>;
}

// --- Game Mechanics ---

export interface BuildingReadiness {
  building_id: UUID;
  simulation_id: UUID;
  zone_id?: UUID;
  building_name: string;
  building_type?: string;
  building_condition?: string;
  population_capacity: number;
  special_type?: string;
  assigned_agents: number;
  staffing_ratio: number;
  staffing_status: string;
  qualification_match: number;
  condition_factor: number;
  criticality_weight: number;
  readiness: number;
}

export interface ZoneStability {
  zone_id: UUID;
  simulation_id: UUID;
  city_id?: UUID;
  zone_name: string;
  zone_type?: string;
  security_level?: string;
  infrastructure_score: number;
  security_factor: number;
  event_pressure: number;
  ambient_pressure: number;
  fortification_reduction: number;
  is_quarantined: boolean;
  total_pressure: number;
  building_count: number;
  total_agents: number;
  total_capacity: number;
  critical_understaffed_count: number;
  avg_readiness: number;
  stability: number;
  stability_label: string;
}

export interface EventZoneLink {
  id: UUID;
  event_id: UUID;
  zone_id: UUID;
  affinity_weight: number;
  link_source: 'auto' | 'manual' | 'location_match';
  zone_name?: string;
  zone_type?: string;
}

export type ZoneActionType = 'fortify' | 'quarantine' | 'deploy_resources';

export interface ZoneAction {
  id: UUID;
  zone_id: UUID;
  simulation_id: UUID;
  action_type: ZoneActionType;
  effect_value: number;
  created_by_id?: UUID;
  expires_at: string;
  cooldown_until: string;
  created_at: string;
  deleted_at?: string;
}

export interface EmbassyEffectiveness {
  embassy_id: UUID;
  simulation_a_id: UUID;
  simulation_b_id: UUID;
  building_a_id: UUID;
  building_b_id: UUID;
  status: string;
  bleed_vector?: string;
  building_health: number;
  ambassador_quality: number;
  vector_alignment: number;
  effectiveness: number;
  effectiveness_label: string;
}

export interface SimulationHealth {
  simulation_id: UUID;
  simulation_name: string;
  slug?: string;
  avg_zone_stability: number;
  zone_count: number;
  critical_zone_count: number;
  unstable_zone_count: number;
  building_count: number;
  avg_readiness: number;
  critically_understaffed_buildings: number;
  overcrowded_buildings: number;
  total_agents_assigned: number;
  total_capacity: number;
  diplomatic_reach: number;
  active_embassy_count: number;
  avg_embassy_effectiveness: number;
  outbound_echoes: number;
  inbound_echoes: number;
  avg_outbound_strength: number;
  bleed_permeability: number;
  overall_health: number;
  health_label: string;
}

export interface SimulationHealthDashboard {
  health: SimulationHealth;
  zones: ZoneStability[];
  buildings: BuildingReadiness[];
  embassies: EmbassyEffectiveness[];
  recent_high_impact_events: Record<string, unknown>[];
}

// --- Epochs (Competitive Layer) ---

export type EpochStatus =
  | 'lobby'
  | 'foundation'
  | 'competition'
  | 'reckoning'
  | 'completed'
  | 'cancelled';

export type OperativeType =
  | 'spy'
  | 'saboteur'
  | 'propagandist'
  | 'assassin'
  | 'guardian'
  | 'infiltrator';

// --- TCG Card System ---

export type CardRarity = 'common' | 'rare' | 'legendary';

export type CardFrameTexture =
  | 'circuits'
  | 'filigree'
  | 'scanlines'
  | 'rivets'
  | 'illumination'
  | 'none';
export type CardNameplateStyle = 'terminal' | 'banner' | 'readout' | 'plate' | 'cartouche';
export type CardCornerMotif = 'none' | 'brackets' | 'tentacles' | 'crosshairs' | 'bolts' | 'floral';
export type CardFoilStyle = 'holographic' | 'aquatic' | 'phosphor' | 'patina' | 'gilded';

export interface CardFrameConfig {
  texture: CardFrameTexture;
  nameplate_style: CardNameplateStyle;
  corner_motif: CardCornerMotif;
  foil_style: CardFoilStyle;
}

export type BattleLogEventType =
  | 'operative_deployed'
  | 'mission_success'
  | 'mission_failed'
  | 'detected'
  | 'captured'
  | 'sabotage'
  | 'propaganda'
  | 'assassination'
  | 'infiltration'
  | 'alliance_formed'
  | 'alliance_dissolved'
  | 'betrayal'
  | 'phase_change'
  | 'epoch_start'
  | 'epoch_end'
  | 'rp_allocated'
  | 'building_damaged'
  | 'agent_wounded'
  | 'counter_intel'
  | 'intel_report'
  | 'zone_fortified';

export interface EpochScoreWeights {
  stability: number;
  influence: number;
  sovereignty: number;
  diplomatic: number;
  military: number;
}

export interface EpochConfig {
  duration_days: number;
  cycle_hours: number;
  rp_per_cycle: number;
  rp_cap: number;
  foundation_cycles: number;
  reckoning_cycles: number;
  /** @deprecated Use foundation_cycles instead */
  foundation_pct?: number;
  /** @deprecated Use reckoning_cycles instead */
  reckoning_pct?: number;
  max_team_size: number;
  max_agents_per_player: number;
  allow_betrayal: boolean;
  score_weights: EpochScoreWeights;
  referee_mode: boolean;
}

export type EpochType = 'competitive' | 'academy';

export interface Epoch {
  id: UUID;
  name: string;
  description?: string;
  created_by_id: UUID;
  starts_at?: string;
  ends_at?: string;
  current_cycle: number;
  status: EpochStatus;
  config: EpochConfig;
  epoch_type: EpochType;
  created_at: string;
  updated_at: string;
  participant_count?: number;
  team_count?: number;
}

export interface EpochInvitation {
  id: UUID;
  epoch_id: UUID;
  invited_email: string;
  invite_token: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  invited_by_id: UUID;
  expires_at: string;
  accepted_at?: string;
  accepted_by_id?: UUID;
  created_at: string;
  email_sent?: boolean;
}

export interface EpochInvitationPublicInfo {
  epoch_name: string;
  epoch_description?: string;
  epoch_status: string;
  lore_text?: string;
  expires_at: string;
  is_expired: boolean;
  is_accepted: boolean;
}

export type BotPersonality = 'sentinel' | 'warlord' | 'diplomat' | 'strategist' | 'chaos';

export type BotDifficulty = 'easy' | 'medium' | 'hard';

export interface BotPlayer {
  id: UUID;
  name: string;
  personality: BotPersonality;
  difficulty: BotDifficulty;
  config: Record<string, unknown>;
  created_by_id: UUID;
  created_at: string;
  updated_at: string;
}

export interface EpochParticipant {
  id: UUID;
  epoch_id: UUID;
  simulation_id: UUID;
  user_id?: UUID;
  team_id?: UUID;
  joined_at: string;
  current_rp: number;
  last_rp_grant_at?: string;
  final_scores?: Record<string, number>;
  betrayal_penalty?: number;
  drafted_agent_ids?: UUID[];
  draft_completed_at?: string;
  cycle_ready?: boolean;
  is_bot: boolean;
  bot_player_id?: UUID;
  bot_players?: BotPlayer;
  simulations?: {
    name: string;
    slug: string;
    simulation_type?: SimulationType;
    source_template_id?: UUID;
  };
}

export interface EpochTeam {
  id: UUID;
  epoch_id: UUID;
  name: string;
  created_by_simulation_id: UUID;
  created_at: string;
  dissolved_at?: string;
  dissolved_reason?: string;
  tension?: number;
}

export interface AllianceProposal {
  id: UUID;
  epoch_id: UUID;
  team_id: UUID;
  proposer_simulation_id: UUID;
  proposed_at: string;
  expires_at_cycle: number;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  resolved_at?: string;
  votes?: AllianceVote[];
  proposer_name?: string;
}

export interface AllianceVote {
  id: UUID;
  proposal_id: UUID;
  voter_simulation_id: UUID;
  vote: 'accept' | 'reject';
  voted_at: string;
}

export interface OperativeMission {
  id: UUID;
  epoch_id: UUID;
  agent_id: UUID;
  operative_type: OperativeType;
  source_simulation_id: UUID;
  target_simulation_id?: UUID;
  embassy_id?: UUID;
  target_entity_id?: UUID;
  target_entity_type?: string;
  target_zone_id?: UUID;
  status: string;
  cost_rp: number;
  success_probability?: number;
  deployed_at: string;
  resolves_at: string;
  resolved_at?: string;
  mission_result?: Record<string, unknown>;
  created_at: string;
  agents?: { name: string; portrait_image_url?: string };
  target_sim?: { name: string };
  target_zone?: { name: string };
}

export interface LeaderboardEntry {
  rank: number;
  simulation_id: UUID;
  simulation_name: string;
  simulation_slug?: string;
  team_name?: string;
  stability: number;
  influence: number;
  sovereignty: number;
  diplomatic: number;
  military: number;
  composite: number;
  ally_count: number;
  ally_bonus_pct: number;
  betrayal_penalty: number;
  stability_title?: string;
  influence_title?: string;
  sovereignty_title?: string;
  diplomatic_title?: string;
  military_title?: string;
}

export interface IntelDossier {
  simulation_id: UUID;
  simulation_name: string;
  simulation_slug?: string;
  zone_security_levels: string[];
  zone_details: Array<{ name: string; security_level: string }>;
  guardian_count: number;
  fortifications: Array<{
    zone_name: string;
    security_bonus: number;
    expires_at_cycle: number;
  }>;
  last_intel_cycle: number;
  report_count: number;
  is_stale: boolean;
}

export interface ParticipantStats {
  simulation_id: UUID;
  total_operations: number;
  successes: number;
  failures: number;
  detections: number;
  captured: number;
  success_rate: number;
}

export interface MVPAward {
  title: string;
  description: string;
  simulation_id: UUID;
  simulation_name: string;
  value: number;
}

export interface ResultsSummary {
  epoch: {
    id: UUID;
    name: string;
    epoch_type: string;
    status: string;
    current_cycle: number;
  };
  standings: LeaderboardEntry[];
  participant_stats: ParticipantStats[];
  mvp_awards: MVPAward[];
  score_history: Record<UUID, EpochScore[]>;
}

export interface EpochScore {
  id: UUID;
  epoch_id: UUID;
  simulation_id: UUID;
  cycle_number: number;
  stability_score: number;
  influence_score: number;
  sovereignty_score: number;
  diplomatic_score: number;
  military_score: number;
  composite_score: number;
  computed_at: string;
}

export interface BattleLogEntry {
  id: UUID;
  epoch_id: UUID;
  cycle_number: number;
  event_type: BattleLogEventType;
  source_simulation_id?: UUID;
  target_simulation_id?: UUID;
  mission_id?: UUID;
  narrative: string;
  is_public: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface EpochChatMessage {
  id: UUID;
  epoch_id: UUID;
  sender_id: UUID;
  sender_simulation_id: UUID;
  channel_type: 'epoch' | 'team';
  team_id?: UUID;
  content: string;
  created_at: string;
  sender_name?: string;
  sender_type?: 'human' | 'bot';
}

export interface PresenceUser {
  user_id: string;
  simulation_id: string;
  simulation_name: string;
  online_at: string;
}

// --- API Response Types ---

export interface ApiError {
  code: string;
  message: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  meta?: { count?: number; total?: number; limit?: number; offset?: number };
  error?: ApiError;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data?: T[];
  meta?: { count: number; total: number; limit: number; offset: number };
  error?: ApiError;
}

// --- Style References ---

export type StyleReferenceScope = 'global' | 'entity';
export type StyleReferenceEntityType = 'portrait' | 'building';

export interface StyleReferenceInfo {
  entity_type: StyleReferenceEntityType;
  scope: StyleReferenceScope;
  reference_image_url: string;
  strength: number;
  entity_id?: string;
  entity_name?: string;
}

// --- Platform Admin ---

export interface PlatformSetting {
  id: string;
  setting_key: string;
  setting_value: string;
  description: string | null;
  updated_by_id: string | null;
  updated_at: string;
}

export interface AdminUser {
  id: string;
  email: string;
  raw_user_meta_data?: Record<string, unknown>;
  created_at: string | null;
  last_sign_in_at: string | null;
  forge_tokens?: number;
  is_architect?: boolean;
}

export interface UserWallet {
  user_id: string;
  forge_tokens: number;
  is_architect: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminUserDetail extends AdminUser {
  memberships: AdminMembership[];
  wallet?: UserWallet;
}

export interface AdminMembership {
  id: string;
  user_id: string;
  simulation_id: string;
  member_role: string;
  simulations?: { id: string; name: string; slug: string };
}

// --- Notification Preferences ---

export interface NotificationPreferences {
  cycle_resolved: boolean;
  phase_changed: boolean;
  epoch_completed: boolean;
  email_locale: string;
}

// --- Forge Access Requests ---

export type ForgeAccessStatus = 'pending' | 'approved' | 'rejected';

export interface ForgeAccessRequest {
  id: string;
  user_id: string;
  requested_tier: string;
  status: ForgeAccessStatus;
  message: string | null;
  admin_notes: string | null;
  reviewed_by: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface ForgeAccessRequestWithEmail extends ForgeAccessRequest {
  user_email: string;
}

// --- Admin Data Cleanup ---

export type CleanupType =
  | 'completed_epochs'
  | 'cancelled_epochs'
  | 'stale_lobbies'
  | 'archived_instances'
  | 'audit_log'
  | 'bot_decision_log';

export interface CleanupCategoryStats {
  count: number;
  oldest_at: string | null;
}

export interface CleanupStats {
  completed_epochs: CleanupCategoryStats;
  cancelled_epochs: CleanupCategoryStats;
  stale_lobbies: CleanupCategoryStats;
  archived_instances: CleanupCategoryStats;
  audit_log_entries: CleanupCategoryStats;
  bot_decision_entries: CleanupCategoryStats;
}

export interface CleanupPreviewItem {
  id: string;
  name: string;
  updated_at: string | null;
}

export interface CleanupPreviewResult {
  cleanup_type: CleanupType;
  min_age_days: number;
  primary_count: number;
  cascade_counts: Record<string, number>;
  items: CleanupPreviewItem[];
}

export interface CleanupExecuteResult {
  cleanup_type: CleanupType;
  min_age_days: number;
  deleted_count: number;
  cascade_counts: Record<string, number>;
}

// --- Substrate Resonance ---

export type ResonanceStatus = 'detected' | 'impacting' | 'subsiding' | 'archived';

export type ResonanceImpactStatus = 'pending' | 'generating' | 'completed' | 'skipped' | 'failed';

export type ResonanceSignature =
  | 'economic_tremor'
  | 'conflict_wave'
  | 'biological_tide'
  | 'elemental_surge'
  | 'authority_fracture'
  | 'innovation_spark'
  | 'consciousness_drift'
  | 'decay_bloom';

export type ResonanceArchetype =
  | 'The Tower'
  | 'The Shadow'
  | 'The Devouring Mother'
  | 'The Deluge'
  | 'The Overthrow'
  | 'The Prometheus'
  | 'The Awakening'
  | 'The Entropy';

export type SourceCategory =
  | 'economic_crisis'
  | 'military_conflict'
  | 'pandemic'
  | 'natural_disaster'
  | 'political_upheaval'
  | 'tech_breakthrough'
  | 'cultural_shift'
  | 'environmental_disaster';

export interface Resonance {
  id: UUID;
  source_category: SourceCategory;
  resonance_signature: ResonanceSignature;
  archetype: ResonanceArchetype;
  title: string;
  description?: string;
  bureau_dispatch?: string;
  real_world_source?: Record<string, unknown>;
  magnitude: number;
  affected_event_types: string[];
  status: ResonanceStatus;
  detected_at: string;
  impacts_at: string;
  subsides_at?: string;
  created_by_id?: UUID;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  magnitude_class?: string;
}

export interface ResonanceImpact {
  id: UUID;
  resonance_id: UUID;
  simulation_id: UUID;
  simulation_name?: string;
  simulation_slug?: string;
  magnitude_class?: string;
  susceptibility: number;
  effective_magnitude: number;
  status: ResonanceImpactStatus;
  spawned_event_ids: UUID[];
  narrative_context?: string;
  created_at: string;
}

// --- Simulation Heartbeat ---

export type HeartbeatStatus = 'processing' | 'completed' | 'failed' | 'skipped';

export type HeartbeatEntryType =
  | 'zone_shift'
  | 'event_aging'
  | 'event_escalation'
  | 'event_resolution'
  | 'scar_tissue'
  | 'resonance_pressure'
  | 'cascade_spawn'
  | 'bureau_response'
  | 'attunement_deepen'
  | 'anchor_strengthen'
  | 'convergence'
  | 'positive_event'
  | 'narrative_arc'
  | 'system_note';

export type HeartbeatSeverity = 'info' | 'warning' | 'critical' | 'positive';

export interface HeartbeatTick {
  id: UUID;
  simulation_id: UUID;
  tick_number: number;
  status: HeartbeatStatus;
  summary: Record<string, unknown>;
  dispatch_en?: string;
  dispatch_de?: string;
  events_aged: number;
  events_escalated: number;
  events_resolved: number;
  zone_actions_expired: number;
  scar_tissue_delta: number;
  resonance_pressure_delta: number;
  bureau_responses_resolved: number;
  cascade_events_spawned: number;
  convergence_detected: boolean;
  created_at: string;
}

export interface HeartbeatEntry {
  id: UUID;
  heartbeat_id: UUID;
  simulation_id: UUID;
  tick_number: number;
  entry_type: HeartbeatEntryType;
  narrative_en: string;
  narrative_de?: string;
  metadata: Record<string, unknown>;
  severity: HeartbeatSeverity;
  created_at: string;
}

export interface HeartbeatOverview {
  simulation_id: UUID;
  last_tick: number;
  last_heartbeat_at?: string;
  next_heartbeat_at?: string;
  active_arcs: number;
  pending_responses: number;
  active_attunements: number;
  active_anchors: number;
}

// --- Narrative Arcs ---

export type ArcType = 'escalation' | 'cascade' | 'convergence' | 'resolution';
export type ArcStatus = 'building' | 'active' | 'climax' | 'resolving' | 'resolved' | 'dormant';

export interface NarrativeArc {
  id: UUID;
  simulation_id: UUID;
  arc_type: ArcType;
  primary_signature: string;
  secondary_signature?: string;
  primary_archetype?: string;
  secondary_archetype?: string;
  status: ArcStatus;
  pressure: number;
  peak_pressure: number;
  started_at_tick: number;
  last_active_tick: number;
  ticks_active: number;
  ticks_dormant: number;
  source_event_ids: UUID[];
  spawned_event_ids: UUID[];
  scar_tissue_deposited: number;
  created_at: string;
  updated_at: string;
}

// --- Bureau Responses ---

export type BureauResponseType = 'contain' | 'remediate' | 'adapt';
export type BureauResponseStatus = 'pending' | 'resolving' | 'resolved' | 'expired' | 'failed';

export interface BureauResponse {
  id: UUID;
  simulation_id: UUID;
  event_id: UUID;
  response_type: BureauResponseType;
  assigned_agent_ids: UUID[];
  agent_count: number;
  status: BureauResponseStatus;
  submitted_before_tick: number;
  resolved_at_tick?: number;
  effectiveness: number;
  pressure_reduction: number;
  staffing_penalty_active: boolean;
  created_by_id?: UUID;
  created_at: string;
  updated_at: string;
}

// --- Substrate Attunements ---

export interface SubstrateAttunement {
  id: UUID;
  simulation_id: UUID;
  resonance_signature: ResonanceSignature;
  depth: number;
  ticks_exposed: number;
  positive_threshold: number;
  positive_event_generated: boolean;
  switching_cooldown_ticks: number;
  created_by_id?: UUID;
  created_at: string;
  updated_at: string;
}

// --- Collaborative Anchors ---

export type AnchorStatus = 'forming' | 'active' | 'reinforcing' | 'dissolved';

export interface CollaborativeAnchor {
  id: UUID;
  name: string;
  resonance_id?: UUID;
  resonance_signature: string;
  anchor_simulation_ids: UUID[];
  strength: number;
  status: AnchorStatus;
  formed_at_tick: number;
  ticks_active: number;
  created_by_simulation_id?: UUID;
  created_by_user_id?: UUID;
  created_at: string;
  updated_at: string;
}

// --- Cascade Rules ---

export interface CascadeRule {
  id: UUID;
  source_signature: string;
  target_signature: string;
  pressure_threshold: number;
  transfer_rate: number;
  narrative_en: string;
  narrative_de?: string;
  cooldown_hours: number;
  depth_cap: number;
  is_active: boolean;
  last_triggered_at?: string;
  created_at: string;
  updated_at: string;
}

// --- Heartbeat Admin Dashboard ---

export interface HeartbeatSimulationStatus {
  simulation_id: UUID;
  simulation_name: string;
  slug: string;
  last_tick: number;
  last_heartbeat_at?: string;
  next_heartbeat_at?: string;
  status: string;
  active_arcs: number;
  scar_tissue_level: number;
  pending_responses: number;
}

export interface HeartbeatDashboard {
  global_enabled: boolean;
  interval_seconds: number;
  active_systems: string[];
  simulations: HeartbeatSimulationStatus[];
}

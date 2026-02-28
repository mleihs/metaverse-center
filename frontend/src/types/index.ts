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
  | 'prompts';

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
  background?: string;
  gender?: string;
  primary_profession?: string;
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
  description?: string;
  style?: string;
  location?: GeoLocation;
  city_id?: UUID;
  zone_id?: UUID;
  street_id?: UUID;
  address?: string;
  population_capacity: number;
  construction_year?: number;
  building_condition?: string;
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
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  reactions?: EventReaction[];
  campaign?: Campaign;
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
  zone_type: string;
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

export interface MapData {
  simulations: Simulation[];
  connections: SimulationConnection[];
  echo_counts: Record<string, number>;
  embassies?: Embassy[];
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
  building_count: number;
  total_agents: number;
  total_capacity: number;
  critical_understaffed_count: number;
  avg_readiness: number;
  stability: number;
  stability_label: string;
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
  | 'counter_intel';

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
  foundation_pct: number;
  reckoning_pct: number;
  max_team_size: number;
  allow_betrayal: boolean;
  score_weights: EpochScoreWeights;
  referee_mode: boolean;
}

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
  created_at: string;
  updated_at: string;
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

export interface EpochParticipant {
  id: UUID;
  epoch_id: UUID;
  simulation_id: UUID;
  team_id?: UUID;
  joined_at: string;
  current_rp: number;
  last_rp_grant_at?: string;
  final_scores?: Record<string, number>;
  betrayal_penalty?: number;
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
  betrayal_penalty?: number;
  stability_title?: string;
  influence_title?: string;
  sovereignty_title?: string;
  diplomatic_title?: string;
  military_title?: string;
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

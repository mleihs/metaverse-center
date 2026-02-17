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
  | 'complexity_level';

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
  | 'social_media_agent_reaction';

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
  member_role: SimulationRole;
  joined_at: string;
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
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  error?: ApiError;
}

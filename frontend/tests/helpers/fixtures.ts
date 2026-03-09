import type {
  Agent,
  AllianceProposal,
  AllianceVote,
  Building,
  Campaign,
  CampaignEvent,
  CampaignMetric,
  ChatConversation,
  ChatMessage,
  Embassy,
  Event,
  EventReaction,
  Simulation,
  SocialMediaPost,
  SocialTrend,
} from '../../src/types/index.js';

// --- Simulation ---

export function createSimulation(overrides: Partial<Simulation> = {}): Simulation {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Test Simulation',
    slug: 'test-simulation',
    description: 'A test simulation',
    theme: 'dystopian',
    status: 'active',
    content_locale: 'de',
    additional_locales: ['en'],
    owner_id: '00000000-0000-0000-0000-000000000002',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// --- Agent ---

export function createAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: crypto.randomUUID(),
    simulation_id: '00000000-0000-0000-0000-000000000001',
    name: 'Test Agent',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// --- Building ---

export function createBuilding(overrides: Partial<Building> = {}): Building {
  return {
    id: crypto.randomUUID(),
    simulation_id: '00000000-0000-0000-0000-000000000001',
    name: 'Test Building',
    building_type: 'residential',
    population_capacity: 100,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// --- Event ---

export function createEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: crypto.randomUUID(),
    simulation_id: '00000000-0000-0000-0000-000000000001',
    title: 'Test Event',
    occurred_at: '2026-01-15T10:00:00Z',
    data_source: 'manual',
    impact_level: 5,
    tags: ['test'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// --- EventReaction ---

export function createEventReaction(overrides: Partial<EventReaction> = {}): EventReaction {
  return {
    id: crypto.randomUUID(),
    simulation_id: '00000000-0000-0000-0000-000000000001',
    event_id: '00000000-0000-0000-0000-000000000010',
    agent_id: '00000000-0000-0000-0000-000000000020',
    agent_name: 'Reactive Agent',
    reaction_text: 'This is a test reaction.',
    occurred_at: '2026-01-15T11:00:00Z',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// --- ChatConversation ---

export function createConversation(
  overrides: Partial<ChatConversation> = {},
): ChatConversation {
  return {
    id: crypto.randomUUID(),
    simulation_id: '00000000-0000-0000-0000-000000000001',
    user_id: '00000000-0000-0000-0000-000000000002',
    agent_id: '00000000-0000-0000-0000-000000000020',
    status: 'active',
    message_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// --- ChatMessage ---

export function createChatMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: crypto.randomUUID(),
    conversation_id: '00000000-0000-0000-0000-000000000050',
    sender_role: 'user',
    content: 'Hello, this is a test message.',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// --- Campaign ---

export function createCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: crypto.randomUUID(),
    simulation_id: '00000000-0000-0000-0000-000000000001',
    title: 'Test Campaign',
    description: 'A test propaganda campaign',
    campaign_type: 'news',
    target_demographic: 'workers',
    urgency_level: 'medium',
    is_integrated_as_event: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// --- CampaignEvent ---

export function createCampaignEvent(overrides: Partial<CampaignEvent> = {}): CampaignEvent {
  return {
    id: crypto.randomUUID(),
    simulation_id: '00000000-0000-0000-0000-000000000001',
    campaign_id: '00000000-0000-0000-0000-000000000060',
    event_id: '00000000-0000-0000-0000-000000000010',
    integration_type: 'direct',
    integration_status: 'pending',
    agent_reactions_generated: false,
    reactions_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// --- CampaignMetric ---

export function createCampaignMetric(overrides: Partial<CampaignMetric> = {}): CampaignMetric {
  return {
    id: crypto.randomUUID(),
    simulation_id: '00000000-0000-0000-0000-000000000001',
    campaign_id: '00000000-0000-0000-0000-000000000060',
    metric_name: 'reach',
    metric_value: 1500,
    measured_at: new Date().toISOString(),
    ...overrides,
  };
}

// --- SocialTrend ---

export function createSocialTrend(overrides: Partial<SocialTrend> = {}): SocialTrend {
  return {
    id: crypto.randomUUID(),
    simulation_id: '00000000-0000-0000-0000-000000000001',
    name: 'Test Trend',
    platform: 'twitter',
    volume: 12000,
    fetched_at: new Date().toISOString(),
    is_processed: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// --- SocialMediaPost ---

export function createSocialMediaPost(
  overrides: Partial<SocialMediaPost> = {},
): SocialMediaPost {
  return {
    id: crypto.randomUUID(),
    simulation_id: '00000000-0000-0000-0000-000000000001',
    platform: 'facebook',
    platform_id: 'fb_post_12345',
    author: 'Test Author',
    message: 'This is a test social media post.',
    source_created_at: '2026-01-10T08:00:00Z',
    attachments: [],
    reactions: { like: 42, share: 5 },
    is_published: true,
    imported_at: new Date().toISOString(),
    last_synced_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// --- Embassy ---

export function createEmbassy(overrides: Partial<Embassy> = {}): Embassy {
  return {
    id: crypto.randomUUID(),
    building_a_id: '00000000-0000-0000-0000-000000000030',
    simulation_a_id: '00000000-0000-0000-0000-000000000001',
    building_b_id: '00000000-0000-0000-0000-000000000031',
    simulation_b_id: '00000000-0000-0000-0000-000000000003',
    status: 'active',
    connection_type: 'embassy',
    description: 'What if bureaucracy and magic are the same thing?',
    bleed_vector: 'memory',
    event_propagation: true,
    building_a: {
      id: '00000000-0000-0000-0000-000000000030',
      simulation_id: '00000000-0000-0000-0000-000000000001',
      name: 'Embassy of Velgarien',
      building_type: 'government',
      population_capacity: 50,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    building_b: {
      id: '00000000-0000-0000-0000-000000000031',
      simulation_id: '00000000-0000-0000-0000-000000000003',
      name: 'Station Null Liaison Office',
      building_type: 'government',
      population_capacity: 30,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    simulation_a: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Velgarien',
      slug: 'velgarien',
      description: 'A dark dystopian world',
      theme: 'dystopian',
      status: 'active',
      content_locale: 'de',
      additional_locales: ['en'],
      owner_id: '00000000-0000-0000-0000-000000000002',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    simulation_b: {
      id: '00000000-0000-0000-0000-000000000003',
      name: 'Station Null',
      slug: 'station-null',
      description: 'A deep space horror station',
      theme: 'scifi',
      status: 'active',
      content_locale: 'de',
      additional_locales: ['en'],
      owner_id: '00000000-0000-0000-0000-000000000002',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// --- AllianceProposal ---

export function createAllianceProposal(
  overrides: Partial<AllianceProposal> = {},
): AllianceProposal {
  return {
    id: crypto.randomUUID(),
    epoch_id: '00000000-0000-0000-0000-000000000100',
    team_id: '00000000-0000-0000-0000-000000000200',
    proposer_simulation_id: '00000000-0000-0000-0000-000000000001',
    proposed_at: '2026-02-01T12:00:00Z',
    expires_at_cycle: 5,
    status: 'pending',
    ...overrides,
  };
}

// --- AllianceVote ---

export function createAllianceVote(overrides: Partial<AllianceVote> = {}): AllianceVote {
  return {
    id: crypto.randomUUID(),
    proposal_id: '00000000-0000-0000-0000-000000000300',
    voter_simulation_id: '00000000-0000-0000-0000-000000000001',
    vote: 'accept',
    voted_at: '2026-02-01T13:00:00Z',
    ...overrides,
  };
}

-- =============================================================================
-- SEED 004: Social Media, Campaigns, and Chat Migration
-- =============================================================================
-- Migrates social_trends, campaigns, facebook data, and chat conversations.
--
-- Key transformations:
--   - propaganda_campaigns → campaigns (table rename)
--   - propaganda_campaigns.dystopian_title → campaigns.title
--   - propaganda_campaigns.campaign_description → campaigns.description
--   - propaganda_campaigns.integrated_as_event → campaigns.is_integrated_as_event
--   - propaganda_campaigns.event_id: TEXT → UUID via mapping
--   - facebook_posts → social_media_posts (table rename + column renames)
--   - facebook_posts.facebook_id → social_media_posts.platform_id
--   - facebook_posts.created_time → social_media_posts.source_created_at
--   - facebook_posts.velgarien_event_id → social_media_posts.linked_event_id (TEXT → UUID)
--   - facebook_posts.transformation_timestamp → social_media_posts.transformed_at
--   - facebook_posts.import_timestamp → social_media_posts.imported_at
--   - facebook_posts.last_sync → social_media_posts.last_synced_at
--   - facebook_comments → social_media_comments (table rename + column renames)
--   - facebook_comments.facebook_id → social_media_comments.platform_id
--   - facebook_comments.created_time → social_media_comments.source_created_at
--   - facebook_agent_reactions → social_media_agent_reactions (table rename)
--   - agent_chats → chat_conversations + chat_messages (schema redesign)
--   - social_trends.processed → social_trends.is_processed
--   - social_trends.relevance_score: numeric(3,2) → numeric(4,2) — range 0-10
--
-- PREREQUISITE: 002 + 003 must run first
--   (creates public._migration_agent_id_mapping + _migration_event_id_mapping)
--
-- Source specs:
--   - 03_DATABASE_SCHEMA_NEW.md v2.0
--   - 15_MIGRATION_STRATEGY.md v1.1 Section 2.3
-- =============================================================================

BEGIN;

-- ===========================================================================
-- PART A: Social Trends
-- ===========================================================================

CREATE TEMP TABLE _old_social_trends (
    id uuid NOT NULL,
    name text NOT NULL,
    platform text NOT NULL,
    raw_data jsonb,
    volume integer DEFAULT 0,
    url text,
    fetched_at timestamptz DEFAULT now(),
    relevance_score numeric(3,2),           -- Old range (0.00-9.99), new is numeric(4,2) (0-10)
    sentiment text,
    processed boolean DEFAULT false,        -- Renamed to is_processed
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- \copy _old_social_trends FROM '/tmp/old_social_trends.csv' CSV HEADER

INSERT INTO social_trends (
    id, simulation_id, name, platform, raw_data,
    volume, url, fetched_at, relevance_score, sentiment,
    is_processed, created_at, updated_at
)
SELECT
    st.id,
    '10000000-0000-0000-0000-000000000001',
    st.name,
    st.platform,
    st.raw_data,
    st.volume,
    st.url,
    st.fetched_at,
    st.relevance_score,                     -- numeric(3,2) fits into numeric(4,2)
    st.sentiment,
    COALESCE(st.processed, false),          -- Renamed: processed → is_processed
    COALESCE(st.created_at, now()),
    COALESCE(st.updated_at, st.created_at, now())
FROM _old_social_trends st
ON CONFLICT (id) DO NOTHING;


-- ===========================================================================
-- PART B: Campaigns (ex propaganda_campaigns)
-- ===========================================================================

CREATE TEMP TABLE _old_propaganda_campaigns (
    id uuid NOT NULL,
    source_trend_id uuid,
    dystopian_title text NOT NULL,          -- Renamed to title
    campaign_description text,              -- Renamed to description
    propaganda_type text,                   -- Becomes campaign_type
    target_demographic text,                -- German → English
    urgency_level text,                     -- German → English
    created_at timestamptz DEFAULT now(),
    integrated_as_event boolean DEFAULT false, -- Renamed to is_integrated_as_event
    event_id text,                          -- TEXT → UUID via mapping
    updated_at timestamptz DEFAULT now()
);

-- \copy _old_propaganda_campaigns FROM '/tmp/old_propaganda_campaigns.csv' CSV HEADER

INSERT INTO campaigns (
    id, simulation_id, title, description, campaign_type,
    target_demographic, urgency_level, source_trend_id,
    is_integrated_as_event, event_id,
    created_at, updated_at
)
SELECT
    pc.id,
    '10000000-0000-0000-0000-000000000001',
    pc.dystopian_title,                     -- Renamed: dystopian_title → title
    pc.campaign_description,                -- Renamed: campaign_description → description
    pc.propaganda_type,                     -- Becomes campaign_type (same values)
    -- Target Demographic: German → English
    CASE pc.target_demographic
        WHEN 'Bildungssektor'               THEN 'education_sector'
        WHEN 'Arbeitende Bevölkerung'       THEN 'working_population'
        WHEN 'Gesundheitsbewusste Bürger'   THEN 'health_conscious'
        WHEN 'Allgemeine Bevölkerung'       THEN 'general_population'
        ELSE pc.target_demographic
    END,
    -- Urgency Level: German → English
    CASE pc.urgency_level
        WHEN 'NIEDRIG'  THEN 'low'
        WHEN 'MITTEL'   THEN 'medium'
        WHEN 'HOCH'     THEN 'high'
        WHEN 'KRITISCH' THEN 'critical'
        ELSE COALESCE(lower(pc.urgency_level), 'low')
    END,
    pc.source_trend_id,
    COALESCE(pc.integrated_as_event, false), -- Renamed: integrated_as_event → is_integrated_as_event
    em.new_id,                              -- event_id: TEXT → UUID via mapping
    COALESCE(pc.created_at, now()),
    COALESCE(pc.updated_at, pc.created_at, now())
FROM _old_propaganda_campaigns pc
LEFT JOIN public._migration_event_id_mapping em ON em.old_id = pc.event_id
ON CONFLICT (id) DO NOTHING;

-- Update events that reference campaigns (campaign_id FK)
-- The old events already had campaign_id as UUID, so this should work directly
-- if campaigns were migrated with their original UUIDs.


-- ===========================================================================
-- PART C: Campaign Events
-- ===========================================================================

CREATE TEMP TABLE _old_campaign_events (
    id uuid NOT NULL,
    campaign_id uuid,
    event_id text NOT NULL,                 -- varchar(255) in old → UUID via mapping
    integration_type text DEFAULT 'automatic',
    integration_status text DEFAULT 'pending',
    agent_reactions_generated boolean DEFAULT false,
    reactions_count integer DEFAULT 0,
    event_metadata jsonb DEFAULT '{}',
    performance_metrics jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- \copy _old_campaign_events FROM '/tmp/old_campaign_events.csv' CSV HEADER

INSERT INTO campaign_events (
    id, simulation_id, campaign_id, event_id,
    integration_type, integration_status, agent_reactions_generated,
    reactions_count, event_metadata, performance_metrics,
    created_at, updated_at
)
SELECT
    ce.id,
    '10000000-0000-0000-0000-000000000001',
    ce.campaign_id,
    em.new_id,                              -- event_id: TEXT → UUID
    ce.integration_type,
    ce.integration_status,
    ce.agent_reactions_generated,
    ce.reactions_count,
    ce.event_metadata,
    ce.performance_metrics,
    COALESCE(ce.created_at, now()),
    COALESCE(ce.updated_at, ce.created_at, now())
FROM _old_campaign_events ce
JOIN public._migration_event_id_mapping em ON em.old_id = ce.event_id
ON CONFLICT (campaign_id, event_id) DO NOTHING;


-- ===========================================================================
-- PART D: Social Media Posts (ex facebook_posts)
-- ===========================================================================

CREATE TEMP TABLE _old_facebook_posts (
    id uuid NOT NULL,
    facebook_id text NOT NULL,              -- Renamed to platform_id
    page_id text NOT NULL,
    author text,
    message text,
    created_time timestamptz NOT NULL,      -- Renamed to source_created_at
    attachments jsonb DEFAULT '[]',
    reactions jsonb DEFAULT '{}',
    transformed_content text,
    transformation_type text,
    transformation_timestamp timestamptz,   -- Renamed to transformed_at
    original_sentiment jsonb,
    transformed_sentiment jsonb,
    is_published boolean DEFAULT false,
    velgarien_event_id text,                -- Renamed to linked_event_id (TEXT → UUID)
    import_timestamp timestamptz DEFAULT now(), -- Renamed to imported_at
    last_sync timestamptz DEFAULT now(),    -- Renamed to last_synced_at
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- \copy _old_facebook_posts FROM '/tmp/old_facebook_posts.csv' CSV HEADER

INSERT INTO social_media_posts (
    id, simulation_id, platform, platform_id, page_id,
    author, message, source_created_at,
    attachments, reactions, transformed_content, transformation_type,
    transformed_at, original_sentiment, transformed_sentiment,
    is_published, linked_event_id, imported_at, last_synced_at,
    created_at, updated_at
)
SELECT
    fp.id,
    '10000000-0000-0000-0000-000000000001',
    'facebook',                             -- All old posts are from Facebook
    fp.facebook_id,                         -- Renamed: facebook_id → platform_id
    fp.page_id,
    fp.author,
    fp.message,
    fp.created_time,                        -- Renamed: created_time → source_created_at
    fp.attachments,
    fp.reactions,
    fp.transformed_content,
    fp.transformation_type,
    fp.transformation_timestamp,            -- Renamed: transformation_timestamp → transformed_at
    fp.original_sentiment,
    fp.transformed_sentiment,
    COALESCE(fp.is_published, false),
    em.new_id,                              -- velgarien_event_id: TEXT → UUID via mapping
    fp.import_timestamp,                    -- Renamed: import_timestamp → imported_at
    fp.last_sync,                           -- Renamed: last_sync → last_synced_at
    COALESCE(fp.created_at, now()),
    COALESCE(fp.updated_at, fp.created_at, now())
FROM _old_facebook_posts fp
LEFT JOIN public._migration_event_id_mapping em ON em.old_id = fp.velgarien_event_id
ON CONFLICT (simulation_id, platform, platform_id) DO NOTHING;


-- ===========================================================================
-- PART E: Social Media Comments (ex facebook_comments)
-- ===========================================================================

CREATE TEMP TABLE _old_facebook_comments (
    id uuid NOT NULL,
    facebook_id text NOT NULL,              -- Renamed to platform_id
    post_id uuid,
    parent_comment_id uuid,
    author text NOT NULL,
    message text NOT NULL,
    created_time timestamptz NOT NULL,      -- Renamed to source_created_at
    transformed_content text,
    sentiment jsonb,
    import_timestamp timestamptz DEFAULT now(), -- Renamed to imported_at
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- \copy _old_facebook_comments FROM '/tmp/old_facebook_comments.csv' CSV HEADER

INSERT INTO social_media_comments (
    id, simulation_id, post_id, platform_id,
    parent_comment_id, author, message, source_created_at,
    transformed_content, sentiment, imported_at,
    created_at, updated_at
)
SELECT
    fc.id,
    '10000000-0000-0000-0000-000000000001',
    fc.post_id,
    fc.facebook_id,                         -- Renamed: facebook_id → platform_id
    fc.parent_comment_id,
    fc.author,
    fc.message,
    fc.created_time,                        -- Renamed: created_time → source_created_at
    fc.transformed_content,
    fc.sentiment,
    fc.import_timestamp,                    -- Renamed: import_timestamp → imported_at
    COALESCE(fc.created_at, now()),
    COALESCE(fc.updated_at, fc.created_at, now())
FROM _old_facebook_comments fc
ON CONFLICT (id) DO NOTHING;


-- ===========================================================================
-- PART F: Social Media Agent Reactions (ex facebook_agent_reactions)
-- ===========================================================================

CREATE TEMP TABLE _old_facebook_agent_reactions (
    id uuid NOT NULL,
    post_id uuid,
    comment_id uuid,
    agent_id text,                          -- TEXT → UUID via mapping
    reaction_type text NOT NULL,
    reaction_content text NOT NULL,
    reaction_intensity integer,
    reaction_timestamp timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now()
);

-- \copy _old_facebook_agent_reactions FROM '/tmp/old_facebook_agent_reactions.csv' CSV HEADER

INSERT INTO social_media_agent_reactions (
    id, simulation_id, post_id, comment_id, agent_id,
    reaction_type, reaction_content, reaction_intensity,
    created_at
)
SELECT
    far.id,
    '10000000-0000-0000-0000-000000000001',
    far.post_id,
    far.comment_id,
    am.new_id,                              -- agent_id: TEXT → UUID
    far.reaction_type,
    far.reaction_content,
    far.reaction_intensity,
    COALESCE(far.created_at, far.reaction_timestamp, now())
FROM _old_facebook_agent_reactions far
JOIN public._migration_agent_id_mapping am ON am.old_id = far.agent_id
ON CONFLICT (id) DO NOTHING;


-- ===========================================================================
-- PART G: Chat (agent_chats → chat_conversations + chat_messages)
-- ===========================================================================
-- ARCHITECTURE CHANGE: Old system had agent_chats as flat messages between
-- agents (agent_id ↔ target_agent_id). New system has:
--   chat_conversations: user ↔ agent conversations
--   chat_messages: messages within a conversation
--
-- The old agent_chats table stored agent-to-agent messages triggered by users.
-- In the new model, these become user→agent conversations with messages.
-- The created_by_user UUID becomes the conversation user_id.
--
-- NOTE: Old agent_chats.agent_id was UUID type but referenced agents.id
-- which was TEXT — a type mismatch. The mapping handles this.

CREATE TEMP TABLE _old_agent_chats (
    id uuid NOT NULL,
    agent_id uuid NOT NULL,                 -- Was UUID in old system
    target_agent_id uuid NOT NULL,
    message text NOT NULL,
    status text DEFAULT 'sent',
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    created_by_user uuid,
    updated_by_user uuid
);

-- \copy _old_agent_chats FROM '/tmp/old_agent_chats.csv' CSV HEADER

-- Step 1: Create conversations for each unique (user, agent) pair
-- In the old system, a "conversation" was implicitly defined by the pair
-- (created_by_user, target_agent_id) — the user chatting with an agent.

INSERT INTO chat_conversations (
    simulation_id, user_id, agent_id, title, status,
    created_at, updated_at
)
SELECT DISTINCT ON (ac.created_by_user, am.new_id)
    '10000000-0000-0000-0000-000000000001',
    COALESCE(ac.created_by_user, '00000000-0000-0000-0000-000000000001'),
    am.new_id,
    'Migrated conversation',
    'active',
    MIN(ac.created_at) OVER (PARTITION BY ac.created_by_user, am.new_id),
    MAX(COALESCE(ac.updated_at, ac.created_at)) OVER (PARTITION BY ac.created_by_user, am.new_id)
FROM _old_agent_chats ac
JOIN public._migration_agent_id_mapping am ON am.old_id = ac.target_agent_id::text
WHERE ac.created_by_user IS NOT NULL
ON CONFLICT (simulation_id, user_id, agent_id) DO NOTHING;

-- Step 2: Migrate messages into the conversations
-- Determine sender_role from old data: if the message was from the user's
-- agent (agent_id = user's agent), sender_role = 'user', otherwise 'agent'.
-- In the old system, agent_id was the sender and target_agent_id was the recipient.

INSERT INTO chat_messages (
    conversation_id, sender_role, content, metadata, created_at
)
SELECT
    conv.id,
    -- Determine sender: if the old message's agent was the user's "side",
    -- it's a user message; otherwise it's an agent response
    CASE
        WHEN ac.agent_id = ac.target_agent_id THEN 'agent'  -- self-referential edge case
        ELSE 'user'                                           -- user sent to target agent
    END,
    ac.message,
    ac.metadata,
    ac.created_at
FROM _old_agent_chats ac
JOIN public._migration_agent_id_mapping am ON am.old_id = ac.target_agent_id::text
JOIN chat_conversations conv ON (
    conv.simulation_id = '10000000-0000-0000-0000-000000000001'
    AND conv.user_id = COALESCE(ac.created_by_user, '00000000-0000-0000-0000-000000000001')
    AND conv.agent_id = am.new_id
);

-- Step 3: Update conversation stats
UPDATE chat_conversations conv
SET
    message_count = sub.cnt,
    last_message_at = sub.last_msg
FROM (
    SELECT
        conversation_id,
        count(*) as cnt,
        max(created_at) as last_msg
    FROM chat_messages
    GROUP BY conversation_id
) sub
WHERE conv.id = sub.conversation_id
  AND conv.simulation_id = '10000000-0000-0000-0000-000000000001';


-- ===========================================================================
-- H. Quick Verification
-- ===========================================================================

DO $$
DECLARE
    sim_id uuid := '10000000-0000-0000-0000-000000000001';
    cnt integer;
BEGIN
    SELECT count(*) INTO cnt FROM social_trends WHERE simulation_id = sim_id;
    RAISE NOTICE 'Social trends migrated: %', cnt;

    SELECT count(*) INTO cnt FROM campaigns WHERE simulation_id = sim_id;
    RAISE NOTICE 'Campaigns migrated: %', cnt;

    SELECT count(*) INTO cnt FROM campaign_events WHERE simulation_id = sim_id;
    RAISE NOTICE 'Campaign events migrated: %', cnt;

    SELECT count(*) INTO cnt FROM social_media_posts WHERE simulation_id = sim_id;
    RAISE NOTICE 'Social media posts migrated: %', cnt;

    SELECT count(*) INTO cnt FROM social_media_comments WHERE simulation_id = sim_id;
    RAISE NOTICE 'Social media comments migrated: %', cnt;

    SELECT count(*) INTO cnt FROM social_media_agent_reactions WHERE simulation_id = sim_id;
    RAISE NOTICE 'Social media agent reactions migrated: %', cnt;

    SELECT count(*) INTO cnt FROM chat_conversations WHERE simulation_id = sim_id;
    RAISE NOTICE 'Chat conversations migrated: %', cnt;

    SELECT count(*) INTO cnt
    FROM chat_messages cm
    JOIN chat_conversations cc ON cc.id = cm.conversation_id
    WHERE cc.simulation_id = sim_id;
    RAISE NOTICE 'Chat messages migrated: %', cnt;
END;
$$;

COMMIT;

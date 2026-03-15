-- Refresh simulation_dashboard and map_simulations views to include columns
-- added after their original creation (banner_url, description, description_de,
-- icon_url, additional_locales, archived_at).
--
-- Root cause: simulation_dashboard (migration 035) explicitly listed columns,
-- so newer columns (e.g. description_de from migration 060, banner_url from
-- initial schema) were silently omitted. The authenticated /simulations endpoint
-- queries this view, causing owned-shard cards to render without banners.
--
-- map_simulations (migration 091) similarly omits description_de.
--
-- PostgreSQL expands SELECT * at view creation time, not query time. Views with
-- explicit column lists must be refreshed whenever the base table gains columns
-- that consumers expect.


-- ============================================================================
-- 1. simulation_dashboard — add all missing simulation columns
-- ============================================================================

-- Must DROP first: CREATE OR REPLACE cannot add columns to an existing view.
-- map_simulations depends on simulation_dashboard, so drop it first.
DROP VIEW IF EXISTS public.map_simulations CASCADE;
DROP VIEW IF EXISTS public.simulation_dashboard CASCADE;

CREATE VIEW public.simulation_dashboard AS
  SELECT
    s.id AS simulation_id,
    s.name,
    s.slug,
    s.description,
    s.description_de,
    s.status,
    s.theme,
    s.content_locale,
    s.additional_locales,
    s.owner_id,
    s.icon_url,
    s.banner_url,
    s.simulation_type,
    s.source_template_id,
    s.epoch_id,
    s.archived_at,
    (SELECT count(*) FROM simulation_members sm WHERE sm.simulation_id = s.id) AS member_count,
    (SELECT count(*) FROM agents a WHERE a.simulation_id = s.id AND a.deleted_at IS NULL) AS agent_count,
    (SELECT count(*) FROM buildings b WHERE b.simulation_id = s.id AND b.deleted_at IS NULL) AS building_count,
    (SELECT count(*) FROM events e WHERE e.simulation_id = s.id AND e.deleted_at IS NULL) AS event_count,
    s.created_at,
    s.updated_at
  FROM simulations s
  WHERE s.deleted_at IS NULL;

GRANT SELECT ON public.simulation_dashboard TO authenticated, anon;

COMMENT ON VIEW public.simulation_dashboard IS
  'Simulation list with pre-aggregated entity counts. '
  'Excludes soft-deleted simulations. Used by authenticated /simulations endpoint.';


-- ============================================================================
-- 2. map_simulations — add description_de
-- ============================================================================

CREATE OR REPLACE VIEW public.map_simulations AS
SELECT
  s.id,
  s.name,
  s.slug,
  s.theme,
  s.description,
  s.description_de,
  s.banner_url,
  s.status,
  s.simulation_type,
  s.source_template_id,
  s.epoch_id,
  ge.status AS epoch_status,
  COALESCE(sd.agent_count, 0)    AS agent_count,
  COALESCE(sd.building_count, 0) AS building_count,
  COALESCE(sd.event_count, 0)    AS event_count
FROM simulations s
LEFT JOIN game_epochs ge ON ge.id = s.epoch_id
LEFT JOIN simulation_dashboard sd ON sd.simulation_id = s.id
WHERE s.status = 'active'
  AND s.simulation_type != 'archived'
  AND s.deleted_at IS NULL
  -- Exclude game instances from completed/cancelled epochs
  AND NOT (
    s.simulation_type = 'game_instance'
    AND ge.status IN ('completed', 'cancelled')
  )
ORDER BY s.created_at ASC;

GRANT SELECT ON public.map_simulations TO authenticated, anon;

COMMENT ON VIEW public.map_simulations IS
  'Pre-filtered simulations for the Cartographer''s Map. Joins epoch status + dashboard counts. '
  'Excludes archived sims and game instances from completed/cancelled epochs.';


-- ============================================================================
-- 3. conversation_summaries — add _de agent columns
-- ============================================================================

DROP VIEW IF EXISTS public.conversation_summaries CASCADE;
CREATE VIEW public.conversation_summaries AS
  SELECT
    cc.id,
    cc.simulation_id,
    cc.user_id,
    cc.agent_id,
    a.name AS agent_name,
    a.portrait_image_url AS agent_portrait_url,
    a.character_de AS agent_character_de,
    a.background_de AS agent_background_de,
    cc.title,
    cc.status,
    cc.message_count,
    cc.last_message_at,
    cc.created_at
  FROM chat_conversations cc
  JOIN agents a ON cc.agent_id = a.id;

GRANT SELECT ON public.conversation_summaries TO authenticated, anon;

-- ============================================================================
-- Migration 217: Add name_de to simulations + refresh explicit-column views
--
-- WHY: Simulations already have description_de (migration 060), but name_de
-- was missing — an inconsistency that made /worlds and the landing page
-- render world names only in English regardless of locale.
--
-- WHAT:
--   1. ALTER TABLE: add name_de TEXT to simulations
--   2. Refresh simulation_dashboard view (explicit column list → add name_de)
--   3. Refresh map_simulations view (explicit column list → add name_de)
--   Note: active_simulations uses SELECT * — inherits automatically.
-- ============================================================================

-- 1. Add name_de column
ALTER TABLE public.simulations
  ADD COLUMN IF NOT EXISTS name_de TEXT;

COMMENT ON COLUMN public.simulations.name_de IS
  'German translation of simulation name. Falls back to name when NULL.';

-- 2. Refresh simulation_dashboard (latest definition: migration 111)
DROP VIEW IF EXISTS public.simulation_dashboard CASCADE;

CREATE VIEW public.simulation_dashboard AS
  SELECT
    s.id AS simulation_id,
    s.name,
    s.name_de,
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

-- 3. Refresh map_simulations (latest definition: migration 111)
CREATE OR REPLACE VIEW public.map_simulations AS
SELECT
  s.id,
  s.name,
  s.name_de,
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

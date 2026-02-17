-- Cleanup: Drop unused migration mapping tables and convert materialized views to regular views

-- These tables were created during the TEXT→UUID migration (seeds 002/003)
-- They have 0 rows and are not referenced anywhere in the codebase
DROP TABLE IF EXISTS public._migration_agent_id_mapping;
DROP TABLE IF EXISTS public._migration_event_id_mapping;

-- campaign_performance and agent_statistics were materialized views
-- but never had REFRESH calls → always empty.
-- Convert to regular views so they're always up-to-date.
DROP MATERIALIZED VIEW IF EXISTS public.campaign_performance;
CREATE VIEW public.campaign_performance AS
    SELECT
        c.id AS campaign_id,
        c.simulation_id,
        c.title,
        c.campaign_type,
        count(DISTINCT ce.event_id) AS event_count,
        coalesce(sum(ce.reactions_count), (0)::bigint) AS total_reactions,
        count(DISTINCT er.agent_id) AS unique_reacting_agents,
        c.created_at,
        c.updated_at
    FROM campaigns c
    LEFT JOIN campaign_events ce ON c.id = ce.campaign_id
    LEFT JOIN events e ON ce.event_id = e.id
    LEFT JOIN event_reactions er ON e.id = er.event_id
    GROUP BY c.id, c.simulation_id, c.title, c.campaign_type, c.created_at, c.updated_at;

DROP MATERIALIZED VIEW IF EXISTS public.agent_statistics;
CREATE VIEW public.agent_statistics AS
    SELECT
        a.id AS agent_id,
        a.simulation_id,
        a.name,
        count(DISTINCT ap.id) AS profession_count,
        count(DISTINCT er.id) AS reaction_count,
        count(DISTINCT bar.building_id) AS building_count
    FROM agents a
    LEFT JOIN agent_professions ap ON a.id = ap.agent_id
    LEFT JOIN event_reactions er ON a.id = er.agent_id
    LEFT JOIN building_agent_relations bar ON a.id = bar.agent_id
    WHERE a.deleted_at IS NULL
    GROUP BY a.id, a.simulation_id, a.name;

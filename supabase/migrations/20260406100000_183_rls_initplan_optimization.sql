-- Migration 183: RLS initPlan optimization
--
-- Wraps all RLS helper function calls in (SELECT ...) subqueries so that
-- PostgreSQL's planner can hoist them into an initPlan node. Without the
-- wrapper, the planner evaluates these STABLE functions per-row; with the
-- wrapper, the result is cached once per statement. Supabase documentation
-- reports 94-99% improvement on typical queries.
--
-- This migration uses ALTER POLICY exclusively -- no DROP/CREATE -- so
-- existing grants and role bindings are preserved.
--
-- Reference: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

-- ============================================================
-- simulations
-- ============================================================

ALTER POLICY simulations_select ON simulations
    USING (
        (status = 'active' AND deleted_at IS NULL)
        OR (SELECT user_has_simulation_access(id))
        OR owner_id = (SELECT auth.uid())
    );

ALTER POLICY simulations_insert ON simulations
    WITH CHECK (owner_id = (SELECT auth.uid()));

ALTER POLICY simulations_update ON simulations
    USING ((SELECT user_has_simulation_role(id, 'admin')));

ALTER POLICY simulations_delete ON simulations
    USING (owner_id = (SELECT auth.uid()));

-- ============================================================
-- simulation_members
-- ============================================================

ALTER POLICY sim_members_select ON simulation_members
    USING ((SELECT user_has_simulation_access(simulation_id)));

ALTER POLICY sim_members_insert ON simulation_members
    WITH CHECK ((SELECT user_has_simulation_role(simulation_id, 'admin')));

ALTER POLICY sim_members_update ON simulation_members
    USING ((SELECT user_simulation_role(simulation_id)) = 'owner');

ALTER POLICY sim_members_delete ON simulation_members
    USING ((SELECT user_simulation_role(simulation_id)) = 'owner');

-- ============================================================
-- simulation_settings
-- ============================================================

ALTER POLICY sim_settings_select ON simulation_settings
    USING ((SELECT user_has_simulation_access(simulation_id)));

ALTER POLICY sim_settings_insert ON simulation_settings
    WITH CHECK ((SELECT user_has_simulation_role(simulation_id, 'admin')));

ALTER POLICY sim_settings_update ON simulation_settings
    USING ((SELECT user_has_simulation_role(simulation_id, 'admin')));

ALTER POLICY sim_settings_delete ON simulation_settings
    USING ((SELECT user_has_simulation_role(simulation_id, 'admin')));

-- ============================================================
-- simulation_taxonomies
-- ============================================================

ALTER POLICY sim_taxonomies_select ON simulation_taxonomies
    USING ((SELECT user_has_simulation_access(simulation_id)));

ALTER POLICY sim_taxonomies_insert ON simulation_taxonomies
    WITH CHECK ((SELECT user_has_simulation_role(simulation_id, 'admin')));

ALTER POLICY sim_taxonomies_update ON simulation_taxonomies
    USING ((SELECT user_has_simulation_role(simulation_id, 'admin')));

ALTER POLICY sim_taxonomies_delete ON simulation_taxonomies
    USING ((SELECT user_has_simulation_role(simulation_id, 'admin')));

-- ============================================================
-- simulation_invitations
-- ============================================================

ALTER POLICY sim_invitations_select ON simulation_invitations
    USING ((SELECT user_has_simulation_access(simulation_id)));

ALTER POLICY sim_invitations_insert ON simulation_invitations
    WITH CHECK ((SELECT user_has_simulation_role(simulation_id, 'admin')));

ALTER POLICY sim_invitations_delete ON simulation_invitations
    USING ((SELECT user_has_simulation_role(simulation_id, 'admin')));

-- ============================================================
-- agents
-- ============================================================

ALTER POLICY agents_select ON agents
    USING ((SELECT user_has_simulation_access(simulation_id)));

ALTER POLICY agents_insert ON agents
    WITH CHECK ((SELECT user_has_simulation_role(simulation_id, 'editor')));

ALTER POLICY agents_update ON agents
    USING ((SELECT user_has_simulation_role(simulation_id, 'editor')));

ALTER POLICY agents_delete ON agents
    USING ((SELECT user_has_simulation_role(simulation_id, 'admin')));

-- ============================================================
-- agent_professions
-- ============================================================

ALTER POLICY agent_professions_select ON agent_professions
    USING ((SELECT user_has_simulation_access(simulation_id)));

ALTER POLICY agent_professions_insert ON agent_professions
    WITH CHECK ((SELECT user_has_simulation_role(simulation_id, 'editor')));

ALTER POLICY agent_professions_update ON agent_professions
    USING ((SELECT user_has_simulation_role(simulation_id, 'editor')));

ALTER POLICY agent_professions_delete ON agent_professions
    USING ((SELECT user_has_simulation_role(simulation_id, 'admin')));

-- ============================================================
-- buildings
-- ============================================================

ALTER POLICY buildings_select ON buildings
    USING ((SELECT user_has_simulation_access(simulation_id)));

ALTER POLICY buildings_insert ON buildings
    WITH CHECK ((SELECT user_has_simulation_role(simulation_id, 'editor')));

ALTER POLICY buildings_update ON buildings
    USING ((SELECT user_has_simulation_role(simulation_id, 'editor')));

ALTER POLICY buildings_delete ON buildings
    USING ((SELECT user_has_simulation_role(simulation_id, 'admin')));

-- ============================================================
-- events
-- ============================================================

ALTER POLICY events_select ON events
    USING ((SELECT user_has_simulation_access(simulation_id)));

ALTER POLICY events_insert ON events
    WITH CHECK ((SELECT user_has_simulation_role(simulation_id, 'editor')));

ALTER POLICY events_update ON events
    USING ((SELECT user_has_simulation_role(simulation_id, 'editor')));

ALTER POLICY events_delete ON events
    USING ((SELECT user_has_simulation_role(simulation_id, 'admin')));

-- ============================================================
-- event_reactions
-- ============================================================

ALTER POLICY event_reactions_select ON event_reactions
    USING ((SELECT user_has_simulation_access(simulation_id)));

ALTER POLICY event_reactions_insert ON event_reactions
    WITH CHECK ((SELECT user_has_simulation_role(simulation_id, 'editor')));

ALTER POLICY event_reactions_update ON event_reactions
    USING ((SELECT user_has_simulation_role(simulation_id, 'editor')));

-- event_reactions_delete was overridden in migration 017 to 'editor'
ALTER POLICY event_reactions_delete ON event_reactions
    USING ((SELECT user_has_simulation_role(simulation_id, 'editor')));

-- ============================================================
-- cities
-- ============================================================

ALTER POLICY cities_select ON cities
    USING ((SELECT user_has_simulation_access(simulation_id)));

ALTER POLICY cities_insert ON cities
    WITH CHECK ((SELECT user_has_simulation_role(simulation_id, 'admin')));

ALTER POLICY cities_update ON cities
    USING ((SELECT user_has_simulation_role(simulation_id, 'admin')));

ALTER POLICY cities_delete ON cities
    USING ((SELECT user_has_simulation_role(simulation_id, 'admin')));

-- ============================================================
-- zones
-- ============================================================

ALTER POLICY zones_select ON zones
    USING ((SELECT user_has_simulation_access(simulation_id)));

ALTER POLICY zones_insert ON zones
    WITH CHECK ((SELECT user_has_simulation_role(simulation_id, 'admin')));

ALTER POLICY zones_update ON zones
    USING ((SELECT user_has_simulation_role(simulation_id, 'admin')));

ALTER POLICY zones_delete ON zones
    USING ((SELECT user_has_simulation_role(simulation_id, 'admin')));

-- ============================================================
-- city_streets
-- ============================================================

ALTER POLICY city_streets_select ON city_streets
    USING ((SELECT user_has_simulation_access(simulation_id)));

ALTER POLICY city_streets_insert ON city_streets
    WITH CHECK ((SELECT user_has_simulation_role(simulation_id, 'admin')));

ALTER POLICY city_streets_update ON city_streets
    USING ((SELECT user_has_simulation_role(simulation_id, 'admin')));

ALTER POLICY city_streets_delete ON city_streets
    USING ((SELECT user_has_simulation_role(simulation_id, 'admin')));

-- ============================================================
-- campaigns
-- ============================================================

ALTER POLICY campaigns_select ON campaigns
    USING ((SELECT user_has_simulation_access(simulation_id)));

ALTER POLICY campaigns_insert ON campaigns
    WITH CHECK ((SELECT user_has_simulation_role(simulation_id, 'editor')));

ALTER POLICY campaigns_update ON campaigns
    USING ((SELECT user_has_simulation_role(simulation_id, 'editor')));

ALTER POLICY campaigns_delete ON campaigns
    USING ((SELECT user_has_simulation_role(simulation_id, 'admin')));

-- ============================================================
-- campaign_events
-- ============================================================

ALTER POLICY campaign_events_select ON campaign_events
    USING ((SELECT user_has_simulation_access(simulation_id)));

ALTER POLICY campaign_events_insert ON campaign_events
    WITH CHECK ((SELECT user_has_simulation_role(simulation_id, 'editor')));

ALTER POLICY campaign_events_update ON campaign_events
    USING ((SELECT user_has_simulation_role(simulation_id, 'editor')));

ALTER POLICY campaign_events_delete ON campaign_events
    USING ((SELECT user_has_simulation_role(simulation_id, 'admin')));

-- ============================================================
-- campaign_metrics
-- ============================================================

ALTER POLICY campaign_metrics_select ON campaign_metrics
    USING ((SELECT user_has_simulation_access(simulation_id)));

ALTER POLICY campaign_metrics_insert ON campaign_metrics
    WITH CHECK ((SELECT user_has_simulation_role(simulation_id, 'editor')));

ALTER POLICY campaign_metrics_update ON campaign_metrics
    USING ((SELECT user_has_simulation_role(simulation_id, 'editor')));

ALTER POLICY campaign_metrics_delete ON campaign_metrics
    USING ((SELECT user_has_simulation_role(simulation_id, 'admin')));

-- ============================================================
-- social_trends
-- ============================================================

ALTER POLICY social_trends_select ON social_trends
    USING ((SELECT user_has_simulation_access(simulation_id)));

ALTER POLICY social_trends_insert ON social_trends
    WITH CHECK ((SELECT user_has_simulation_role(simulation_id, 'editor')));

ALTER POLICY social_trends_update ON social_trends
    USING ((SELECT user_has_simulation_role(simulation_id, 'editor')));

ALTER POLICY social_trends_delete ON social_trends
    USING ((SELECT user_has_simulation_role(simulation_id, 'admin')));

-- ============================================================
-- social_media_posts
-- ============================================================

ALTER POLICY social_media_posts_select ON social_media_posts
    USING ((SELECT user_has_simulation_access(simulation_id)));

ALTER POLICY social_media_posts_insert ON social_media_posts
    WITH CHECK ((SELECT user_has_simulation_role(simulation_id, 'editor')));

ALTER POLICY social_media_posts_update ON social_media_posts
    USING ((SELECT user_has_simulation_role(simulation_id, 'editor')));

ALTER POLICY social_media_posts_delete ON social_media_posts
    USING ((SELECT user_has_simulation_role(simulation_id, 'admin')));

-- ============================================================
-- social_media_comments
-- ============================================================

ALTER POLICY social_media_comments_select ON social_media_comments
    USING ((SELECT user_has_simulation_access(simulation_id)));

ALTER POLICY social_media_comments_insert ON social_media_comments
    WITH CHECK ((SELECT user_has_simulation_role(simulation_id, 'editor')));

ALTER POLICY social_media_comments_update ON social_media_comments
    USING ((SELECT user_has_simulation_role(simulation_id, 'editor')));

ALTER POLICY social_media_comments_delete ON social_media_comments
    USING ((SELECT user_has_simulation_role(simulation_id, 'admin')));

-- ============================================================
-- social_media_agent_reactions
-- ============================================================

ALTER POLICY social_media_agent_reactions_select ON social_media_agent_reactions
    USING ((SELECT user_has_simulation_access(simulation_id)));

ALTER POLICY social_media_agent_reactions_insert ON social_media_agent_reactions
    WITH CHECK ((SELECT user_has_simulation_role(simulation_id, 'editor')));

ALTER POLICY social_media_agent_reactions_update ON social_media_agent_reactions
    USING ((SELECT user_has_simulation_role(simulation_id, 'editor')));

ALTER POLICY social_media_agent_reactions_delete ON social_media_agent_reactions
    USING ((SELECT user_has_simulation_role(simulation_id, 'admin')));

-- ============================================================
-- building_agent_relations
-- ============================================================

ALTER POLICY building_agent_relations_select ON building_agent_relations
    USING ((SELECT user_has_simulation_access(simulation_id)));

ALTER POLICY building_agent_relations_insert ON building_agent_relations
    WITH CHECK ((SELECT user_has_simulation_role(simulation_id, 'editor')));

ALTER POLICY building_agent_relations_delete ON building_agent_relations
    USING ((SELECT user_has_simulation_role(simulation_id, 'editor')));

-- ============================================================
-- building_event_relations
-- ============================================================

ALTER POLICY building_event_relations_select ON building_event_relations
    USING ((SELECT user_has_simulation_access(simulation_id)));

ALTER POLICY building_event_relations_insert ON building_event_relations
    WITH CHECK ((SELECT user_has_simulation_role(simulation_id, 'editor')));

ALTER POLICY building_event_relations_delete ON building_event_relations
    USING ((SELECT user_has_simulation_role(simulation_id, 'editor')));

-- ============================================================
-- building_profession_requirements
-- ============================================================

ALTER POLICY building_profession_requirements_select ON building_profession_requirements
    USING ((SELECT user_has_simulation_access(simulation_id)));

ALTER POLICY building_profession_requirements_insert ON building_profession_requirements
    WITH CHECK ((SELECT user_has_simulation_role(simulation_id, 'editor')));

ALTER POLICY building_profession_requirements_update ON building_profession_requirements
    USING ((SELECT user_has_simulation_role(simulation_id, 'editor')));

ALTER POLICY building_profession_requirements_delete ON building_profession_requirements
    USING ((SELECT user_has_simulation_role(simulation_id, 'admin')));

-- ============================================================
-- chat_conversations
-- ============================================================

ALTER POLICY chat_conversations_select ON chat_conversations
    USING (user_id = (SELECT auth.uid()));

ALTER POLICY chat_conversations_insert ON chat_conversations
    WITH CHECK (user_id = (SELECT auth.uid()) AND (SELECT user_has_simulation_access(simulation_id)));

ALTER POLICY chat_conversations_update ON chat_conversations
    USING (user_id = (SELECT auth.uid()));

ALTER POLICY chat_conversations_delete ON chat_conversations
    USING (user_id = (SELECT auth.uid()));

-- chat_messages: uses EXISTS subqueries already -- no change needed

-- ============================================================
-- prompt_templates
-- ============================================================

ALTER POLICY prompt_templates_select ON prompt_templates
    USING (
        simulation_id IS NULL
        OR (SELECT user_has_simulation_access(simulation_id))
    );

ALTER POLICY prompt_templates_insert ON prompt_templates
    WITH CHECK (
        simulation_id IS NOT NULL
        AND (SELECT user_has_simulation_role(simulation_id, 'admin'))
    );

ALTER POLICY prompt_templates_update ON prompt_templates
    USING (
        simulation_id IS NOT NULL
        AND (SELECT user_has_simulation_role(simulation_id, 'admin'))
    );

ALTER POLICY prompt_templates_delete ON prompt_templates
    USING (
        simulation_id IS NOT NULL
        AND (SELECT user_has_simulation_role(simulation_id, 'admin'))
    );

-- ============================================================
-- audit_log
-- ============================================================

ALTER POLICY audit_log_select ON audit_log
    USING ((SELECT user_has_simulation_role(simulation_id, 'admin')));

-- ============================================================
-- agent_relationships (from migration 026)
-- ============================================================

ALTER POLICY agent_relationships_select ON agent_relationships
    USING ((SELECT user_has_simulation_access(simulation_id)));

ALTER POLICY agent_relationships_insert ON agent_relationships
    WITH CHECK ((SELECT user_has_simulation_role(simulation_id, 'editor')));

ALTER POLICY agent_relationships_update ON agent_relationships
    USING ((SELECT user_has_simulation_role(simulation_id, 'editor')));

ALTER POLICY agent_relationships_delete ON agent_relationships
    USING ((SELECT user_has_simulation_role(simulation_id, 'editor')));

-- ============================================================
-- event_echoes (from migration 026)
-- ============================================================

ALTER POLICY event_echoes_select ON event_echoes
    USING (
        (SELECT user_has_simulation_access(source_simulation_id))
        OR (SELECT user_has_simulation_access(target_simulation_id))
    );

-- ============================================================
-- embassies (from migration 028)
-- ============================================================

ALTER POLICY embassies_select ON embassies
    USING (
        (SELECT user_has_simulation_access(simulation_a_id))
        OR (SELECT user_has_simulation_access(simulation_b_id))
    );

ALTER POLICY embassies_insert ON embassies
    WITH CHECK (
        (SELECT user_has_simulation_role(simulation_a_id, 'admin'))
        OR (SELECT user_has_simulation_role(simulation_b_id, 'admin'))
    );

ALTER POLICY embassies_update ON embassies
    USING (
        (SELECT user_has_simulation_role(simulation_a_id, 'admin'))
        OR (SELECT user_has_simulation_role(simulation_b_id, 'admin'))
    );

ALTER POLICY embassies_delete ON embassies
    USING (
        (SELECT user_has_simulation_role(simulation_a_id, 'admin'))
        OR (SELECT user_has_simulation_role(simulation_b_id, 'admin'))
    );

-- ============================================================
-- bureau_responses (from migration 129 — quoted policy names)
-- ============================================================

ALTER POLICY "Editor insert bureau responses" ON bureau_responses
    WITH CHECK ((SELECT user_has_simulation_role(simulation_id, 'editor')));

ALTER POLICY "Editor update bureau responses" ON bureau_responses
    USING ((SELECT user_has_simulation_role(simulation_id, 'editor')));

ALTER POLICY "Editor delete bureau responses" ON bureau_responses
    USING ((SELECT user_has_simulation_role(simulation_id, 'editor')));

-- ============================================================
-- substrate_attunements (from migration 129 — quoted policy names)
-- ============================================================

ALTER POLICY "Editor insert attunements" ON substrate_attunements
    WITH CHECK ((SELECT user_has_simulation_role(simulation_id, 'editor')));

ALTER POLICY "Editor update attunements" ON substrate_attunements
    USING ((SELECT user_has_simulation_role(simulation_id, 'editor')));

ALTER POLICY "Editor delete attunements" ON substrate_attunements
    USING ((SELECT user_has_simulation_role(simulation_id, 'editor')));

-- Anonymous read access for active simulation data.
-- TO anon policies — additive, don't modify existing authenticated policies.

-- Core entities
CREATE POLICY simulations_anon_select ON simulations
    FOR SELECT TO anon USING (status = 'active' AND deleted_at IS NULL);

CREATE POLICY taxonomies_anon_select ON simulation_taxonomies
    FOR SELECT TO anon
    USING (EXISTS (SELECT 1 FROM simulations WHERE id = simulation_id AND status = 'active' AND deleted_at IS NULL));

CREATE POLICY settings_anon_select ON simulation_settings
    FOR SELECT TO anon
    USING (EXISTS (SELECT 1 FROM simulations WHERE id = simulation_id AND status = 'active' AND deleted_at IS NULL));

CREATE POLICY agents_anon_select ON agents
    FOR SELECT TO anon
    USING (deleted_at IS NULL AND EXISTS (SELECT 1 FROM simulations WHERE id = simulation_id AND status = 'active' AND deleted_at IS NULL));

CREATE POLICY buildings_anon_select ON buildings
    FOR SELECT TO anon
    USING (deleted_at IS NULL AND EXISTS (SELECT 1 FROM simulations WHERE id = simulation_id AND status = 'active' AND deleted_at IS NULL));

CREATE POLICY events_anon_select ON events
    FOR SELECT TO anon
    USING (deleted_at IS NULL AND EXISTS (SELECT 1 FROM simulations WHERE id = simulation_id AND status = 'active' AND deleted_at IS NULL));

-- Locations
CREATE POLICY cities_anon_select ON cities
    FOR SELECT TO anon
    USING (EXISTS (SELECT 1 FROM simulations WHERE id = simulation_id AND status = 'active' AND deleted_at IS NULL));

CREATE POLICY zones_anon_select ON zones
    FOR SELECT TO anon
    USING (EXISTS (SELECT 1 FROM simulations WHERE id = simulation_id AND status = 'active' AND deleted_at IS NULL));

CREATE POLICY streets_anon_select ON city_streets
    FOR SELECT TO anon
    USING (EXISTS (SELECT 1 FROM simulations WHERE id = simulation_id AND status = 'active' AND deleted_at IS NULL));

-- Agent professions
CREATE POLICY agent_professions_anon_select ON agent_professions
    FOR SELECT TO anon
    USING (EXISTS (SELECT 1 FROM simulations WHERE id = simulation_id AND status = 'active' AND deleted_at IS NULL));

-- Junction/relation tables
CREATE POLICY building_agent_relations_anon_select ON building_agent_relations
    FOR SELECT TO anon
    USING (EXISTS (SELECT 1 FROM buildings WHERE id = building_id AND deleted_at IS NULL AND EXISTS (SELECT 1 FROM simulations WHERE id = simulation_id AND status = 'active' AND deleted_at IS NULL)));

CREATE POLICY event_reactions_anon_select ON event_reactions
    FOR SELECT TO anon
    USING (EXISTS (SELECT 1 FROM events WHERE id = event_id AND deleted_at IS NULL AND EXISTS (SELECT 1 FROM simulations WHERE id = simulation_id AND status = 'active' AND deleted_at IS NULL)));

-- Chat
CREATE POLICY conversations_anon_select ON chat_conversations
    FOR SELECT TO anon
    USING (EXISTS (SELECT 1 FROM simulations WHERE id = simulation_id AND status = 'active' AND deleted_at IS NULL));

CREATE POLICY messages_anon_select ON chat_messages
    FOR SELECT TO anon
    USING (EXISTS (
        SELECT 1 FROM chat_conversations c
        JOIN simulations s ON s.id = c.simulation_id
        WHERE c.id = conversation_id AND s.status = 'active' AND s.deleted_at IS NULL
    ));

CREATE POLICY chat_conv_agents_anon_select ON chat_conversation_agents
    FOR SELECT TO anon
    USING (EXISTS (
        SELECT 1 FROM chat_conversations c
        JOIN simulations s ON s.id = c.simulation_id
        WHERE c.id = conversation_id AND s.status = 'active' AND s.deleted_at IS NULL
    ));

CREATE POLICY chat_event_refs_anon_select ON chat_event_references
    FOR SELECT TO anon
    USING (EXISTS (
        SELECT 1 FROM chat_conversations c
        JOIN simulations s ON s.id = c.simulation_id
        WHERE c.id = conversation_id AND s.status = 'active' AND s.deleted_at IS NULL
    ));

-- Social
CREATE POLICY campaigns_anon_select ON campaigns
    FOR SELECT TO anon
    USING (EXISTS (SELECT 1 FROM simulations WHERE id = simulation_id AND status = 'active' AND deleted_at IS NULL));

CREATE POLICY social_trends_anon_select ON social_trends
    FOR SELECT TO anon
    USING (EXISTS (SELECT 1 FROM simulations WHERE id = simulation_id AND status = 'active' AND deleted_at IS NULL));

CREATE POLICY social_posts_anon_select ON social_media_posts
    FOR SELECT TO anon
    USING (EXISTS (SELECT 1 FROM simulations WHERE id = simulation_id AND status = 'active' AND deleted_at IS NULL));

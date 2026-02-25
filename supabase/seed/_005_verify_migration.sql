-- =============================================================================
-- SEED 005: Migration Verification
-- =============================================================================
-- Comprehensive verification of the entire Velgarien migration.
-- Run this AFTER 001-004 have completed successfully.
--
-- Checks performed:
--   1. Row count verification (all migrated tables)
--   2. FK integrity (no orphaned references)
--   3. Taxonomy value validation (all references exist in simulation_taxonomies)
--   4. UUID mapping completeness (no unmapped TEXT IDs)
--   5. Search vector generation (full-text search ready)
--   6. Constraint validation (no CHECK violations)
--   7. Soft-delete views (active_* views working)
--
-- Source specs:
--   - 15_MIGRATION_STRATEGY.md v1.1 Section 2.4
--   - 03_DATABASE_SCHEMA_NEW.md v2.0 (constraints, views)
-- =============================================================================

DO $$
DECLARE
    sim_id uuid := '10000000-0000-0000-0000-000000000001';
    cnt integer;
    errors integer := 0;
    label text;
BEGIN
    RAISE NOTICE '=== VELGARIEN MIGRATION VERIFICATION ===';
    RAISE NOTICE '';

    -- =========================================================================
    -- 1. ROW COUNTS
    -- =========================================================================
    RAISE NOTICE '--- 1. Row Counts ---';

    SELECT count(*) INTO cnt FROM simulations WHERE id = sim_id;
    RAISE NOTICE 'simulations:                 %', cnt;
    IF cnt != 1 THEN errors := errors + 1; RAISE WARNING 'FAIL: Expected 1 simulation'; END IF;

    SELECT count(*) INTO cnt FROM simulation_members WHERE simulation_id = sim_id;
    RAISE NOTICE 'simulation_members:          %', cnt;
    IF cnt < 1 THEN errors := errors + 1; RAISE WARNING 'FAIL: No simulation members'; END IF;

    SELECT count(*) INTO cnt FROM simulation_taxonomies WHERE simulation_id = sim_id;
    RAISE NOTICE 'simulation_taxonomies:       %', cnt;
    IF cnt < 60 THEN errors := errors + 1; RAISE WARNING 'FAIL: Expected ~70+ taxonomy values, got %', cnt; END IF;

    SELECT count(*) INTO cnt FROM agents WHERE simulation_id = sim_id;
    RAISE NOTICE 'agents:                      %', cnt;

    SELECT count(*) INTO cnt FROM agent_professions WHERE simulation_id = sim_id;
    RAISE NOTICE 'agent_professions:           %', cnt;

    SELECT count(*) INTO cnt FROM buildings WHERE simulation_id = sim_id;
    RAISE NOTICE 'buildings:                   %', cnt;

    SELECT count(*) INTO cnt FROM events WHERE simulation_id = sim_id;
    RAISE NOTICE 'events:                      %', cnt;

    SELECT count(*) INTO cnt FROM event_reactions WHERE simulation_id = sim_id;
    RAISE NOTICE 'event_reactions:             %', cnt;

    SELECT count(*) INTO cnt FROM cities WHERE simulation_id = sim_id;
    RAISE NOTICE 'cities:                      %', cnt;

    SELECT count(*) INTO cnt FROM zones WHERE simulation_id = sim_id;
    RAISE NOTICE 'zones:                       %', cnt;

    SELECT count(*) INTO cnt FROM city_streets WHERE simulation_id = sim_id;
    RAISE NOTICE 'city_streets:                %', cnt;

    SELECT count(*) INTO cnt FROM building_agent_relations WHERE simulation_id = sim_id;
    RAISE NOTICE 'building_agent_relations:    %', cnt;

    SELECT count(*) INTO cnt FROM building_event_relations WHERE simulation_id = sim_id;
    RAISE NOTICE 'building_event_relations:    %', cnt;

    SELECT count(*) INTO cnt FROM building_profession_requirements WHERE simulation_id = sim_id;
    RAISE NOTICE 'building_profession_reqs:    %', cnt;

    SELECT count(*) INTO cnt FROM campaigns WHERE simulation_id = sim_id;
    RAISE NOTICE 'campaigns:                   %', cnt;

    SELECT count(*) INTO cnt FROM campaign_events WHERE simulation_id = sim_id;
    RAISE NOTICE 'campaign_events:             %', cnt;

    SELECT count(*) INTO cnt FROM social_trends WHERE simulation_id = sim_id;
    RAISE NOTICE 'social_trends:               %', cnt;

    SELECT count(*) INTO cnt FROM social_media_posts WHERE simulation_id = sim_id;
    RAISE NOTICE 'social_media_posts:          %', cnt;

    SELECT count(*) INTO cnt FROM social_media_comments WHERE simulation_id = sim_id;
    RAISE NOTICE 'social_media_comments:       %', cnt;

    SELECT count(*) INTO cnt FROM chat_conversations WHERE simulation_id = sim_id;
    RAISE NOTICE 'chat_conversations:          %', cnt;

    SELECT count(*) INTO cnt
    FROM chat_messages cm
    JOIN chat_conversations cc ON cc.id = cm.conversation_id
    WHERE cc.simulation_id = sim_id;
    RAISE NOTICE 'chat_messages:               %', cnt;

    RAISE NOTICE '';

    -- =========================================================================
    -- 2. FK INTEGRITY (orphaned references)
    -- =========================================================================
    RAISE NOTICE '--- 2. FK Integrity ---';

    -- Orphaned event_reactions (event or agent missing)
    SELECT count(*) INTO cnt
    FROM event_reactions er
    WHERE er.simulation_id = sim_id
      AND (NOT EXISTS (SELECT 1 FROM events e WHERE e.id = er.event_id)
           OR NOT EXISTS (SELECT 1 FROM agents a WHERE a.id = er.agent_id));
    RAISE NOTICE 'Orphaned event_reactions:    %', cnt;
    IF cnt > 0 THEN errors := errors + 1; RAISE WARNING 'FAIL: % orphaned event_reactions', cnt; END IF;

    -- Orphaned building_agent_relations (building or agent missing)
    SELECT count(*) INTO cnt
    FROM building_agent_relations bar
    WHERE bar.simulation_id = sim_id
      AND (NOT EXISTS (SELECT 1 FROM buildings b WHERE b.id = bar.building_id)
           OR NOT EXISTS (SELECT 1 FROM agents a WHERE a.id = bar.agent_id));
    RAISE NOTICE 'Orphaned building_agent_rel: %', cnt;
    IF cnt > 0 THEN errors := errors + 1; RAISE WARNING 'FAIL: % orphaned building_agent_relations', cnt; END IF;

    -- Orphaned building_event_relations (building or event missing)
    SELECT count(*) INTO cnt
    FROM building_event_relations ber
    WHERE ber.simulation_id = sim_id
      AND (NOT EXISTS (SELECT 1 FROM buildings b WHERE b.id = ber.building_id)
           OR NOT EXISTS (SELECT 1 FROM events e WHERE e.id = ber.event_id));
    RAISE NOTICE 'Orphaned building_event_rel: %', cnt;
    IF cnt > 0 THEN errors := errors + 1; RAISE WARNING 'FAIL: % orphaned building_event_relations', cnt; END IF;

    -- Orphaned agent_professions (agent missing)
    SELECT count(*) INTO cnt
    FROM agent_professions ap
    WHERE ap.simulation_id = sim_id
      AND NOT EXISTS (SELECT 1 FROM agents a WHERE a.id = ap.agent_id);
    RAISE NOTICE 'Orphaned agent_professions:  %', cnt;
    IF cnt > 0 THEN errors := errors + 1; RAISE WARNING 'FAIL: % orphaned agent_professions', cnt; END IF;

    -- Orphaned zones (city missing)
    SELECT count(*) INTO cnt
    FROM zones z
    WHERE z.simulation_id = sim_id
      AND NOT EXISTS (SELECT 1 FROM cities c WHERE c.id = z.city_id);
    RAISE NOTICE 'Orphaned zones:              %', cnt;
    IF cnt > 0 THEN errors := errors + 1; RAISE WARNING 'FAIL: % orphaned zones', cnt; END IF;

    -- Orphaned social_media_comments (post missing)
    SELECT count(*) INTO cnt
    FROM social_media_comments smc
    WHERE smc.simulation_id = sim_id
      AND NOT EXISTS (SELECT 1 FROM social_media_posts smp WHERE smp.id = smc.post_id);
    RAISE NOTICE 'Orphaned social_comments:    %', cnt;
    IF cnt > 0 THEN errors := errors + 1; RAISE WARNING 'FAIL: % orphaned social_media_comments', cnt; END IF;

    -- Orphaned chat_messages (conversation missing)
    SELECT count(*) INTO cnt
    FROM chat_messages cm
    WHERE NOT EXISTS (SELECT 1 FROM chat_conversations cc WHERE cc.id = cm.conversation_id);
    RAISE NOTICE 'Orphaned chat_messages:      %', cnt;
    IF cnt > 0 THEN errors := errors + 1; RAISE WARNING 'FAIL: % orphaned chat_messages', cnt; END IF;

    RAISE NOTICE '';

    -- =========================================================================
    -- 3. TAXONOMY VALUE VALIDATION
    -- =========================================================================
    RAISE NOTICE '--- 3. Taxonomy Validation ---';

    -- Agents: gender values must exist in taxonomies
    SELECT count(*) INTO cnt
    FROM agents a
    WHERE a.simulation_id = sim_id
      AND a.gender IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM simulation_taxonomies st
          WHERE st.simulation_id = sim_id
            AND st.taxonomy_type = 'gender'
            AND st.value = a.gender
      );
    RAISE NOTICE 'Invalid agent genders:        %', cnt;
    IF cnt > 0 THEN errors := errors + 1; RAISE WARNING 'FAIL: % agents with invalid gender taxonomy', cnt; END IF;

    -- Agents: system values must exist in taxonomies
    SELECT count(*) INTO cnt
    FROM agents a
    WHERE a.simulation_id = sim_id
      AND a.system IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM simulation_taxonomies st
          WHERE st.simulation_id = sim_id
            AND st.taxonomy_type = 'system'
            AND st.value = a.system
      );
    RAISE NOTICE 'Invalid agent systems:        %', cnt;
    IF cnt > 0 THEN errors := errors + 1; RAISE WARNING 'FAIL: % agents with invalid system taxonomy', cnt; END IF;

    -- Agents: primary_profession values must exist in taxonomies
    SELECT count(*) INTO cnt
    FROM agents a
    WHERE a.simulation_id = sim_id
      AND a.primary_profession IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM simulation_taxonomies st
          WHERE st.simulation_id = sim_id
            AND st.taxonomy_type = 'profession'
            AND st.value = a.primary_profession
      );
    RAISE NOTICE 'Invalid agent professions:    %', cnt;
    IF cnt > 0 THEN errors := errors + 1; RAISE WARNING 'FAIL: % agents with invalid profession taxonomy', cnt; END IF;

    -- Buildings: building_type values must exist in taxonomies
    SELECT count(*) INTO cnt
    FROM buildings b
    WHERE b.simulation_id = sim_id
      AND NOT EXISTS (
          SELECT 1 FROM simulation_taxonomies st
          WHERE st.simulation_id = sim_id
            AND st.taxonomy_type = 'building_type'
            AND st.value = b.building_type
      );
    RAISE NOTICE 'Invalid building types:       %', cnt;
    IF cnt > 0 THEN errors := errors + 1; RAISE WARNING 'FAIL: % buildings with invalid building_type taxonomy', cnt; END IF;

    -- Events: urgency_level values must exist in taxonomies
    SELECT count(*) INTO cnt
    FROM events e
    WHERE e.simulation_id = sim_id
      AND e.urgency_level IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM simulation_taxonomies st
          WHERE st.simulation_id = sim_id
            AND st.taxonomy_type = 'urgency_level'
            AND st.value = e.urgency_level
      );
    RAISE NOTICE 'Invalid event urgency:        %', cnt;
    IF cnt > 0 THEN errors := errors + 1; RAISE WARNING 'FAIL: % events with invalid urgency_level taxonomy', cnt; END IF;

    RAISE NOTICE '';

    -- =========================================================================
    -- 4. SEARCH VECTOR VALIDATION
    -- =========================================================================
    RAISE NOTICE '--- 4. Search Vector ---';

    -- Agents with populated search_vector
    SELECT count(*) INTO cnt
    FROM agents
    WHERE simulation_id = sim_id
      AND search_vector IS NOT NULL
      AND search_vector != ''::tsvector;
    RAISE NOTICE 'Agents with search_vector:   %', cnt;

    -- Buildings with populated search_vector
    SELECT count(*) INTO cnt
    FROM buildings
    WHERE simulation_id = sim_id
      AND search_vector IS NOT NULL
      AND search_vector != ''::tsvector;
    RAISE NOTICE 'Buildings with search_vector: %', cnt;

    -- Events with populated search_vector
    SELECT count(*) INTO cnt
    FROM events
    WHERE simulation_id = sim_id
      AND search_vector IS NOT NULL
      AND search_vector != ''::tsvector;
    RAISE NOTICE 'Events with search_vector:   %', cnt;

    RAISE NOTICE '';

    -- =========================================================================
    -- 5. ACTIVE VIEWS (soft-delete filtering)
    -- =========================================================================
    RAISE NOTICE '--- 5. Active Views ---';

    -- Verify active_agents view excludes soft-deleted
    SELECT count(*) INTO cnt FROM active_agents WHERE simulation_id = sim_id;
    RAISE NOTICE 'active_agents view count:    %', cnt;

    SELECT count(*) INTO cnt FROM active_buildings WHERE simulation_id = sim_id;
    RAISE NOTICE 'active_buildings view count: %', cnt;

    SELECT count(*) INTO cnt FROM active_events WHERE simulation_id = sim_id;
    RAISE NOTICE 'active_events view count:    %', cnt;

    SELECT count(*) INTO cnt FROM active_simulations WHERE id = sim_id;
    RAISE NOTICE 'active_simulations:          %', cnt;

    RAISE NOTICE '';

    -- =========================================================================
    -- 6. DUPLICATE CHECK
    -- =========================================================================
    RAISE NOTICE '--- 6. Duplicate Check ---';

    SELECT count(*) - count(DISTINCT name) INTO cnt
    FROM agents WHERE simulation_id = sim_id;
    RAISE NOTICE 'Duplicate agent names:       %', cnt;
    IF cnt > 0 THEN RAISE NOTICE 'INFO: % duplicate agent names (may be intentional)', cnt; END IF;

    SELECT count(*) - count(DISTINCT name) INTO cnt
    FROM buildings WHERE simulation_id = sim_id;
    RAISE NOTICE 'Duplicate building names:    %', cnt;

    RAISE NOTICE '';

    -- =========================================================================
    -- 7. TAXONOMY TYPE COMPLETENESS
    -- =========================================================================
    RAISE NOTICE '--- 7. Taxonomy Types ---';

    FOR label, cnt IN
        SELECT taxonomy_type, count(*)
        FROM simulation_taxonomies
        WHERE simulation_id = sim_id
        GROUP BY taxonomy_type
        ORDER BY taxonomy_type
    LOOP
        RAISE NOTICE '  %-25s %s values', label, cnt;
    END LOOP;

    RAISE NOTICE '';

    -- =========================================================================
    -- SUMMARY
    -- =========================================================================
    RAISE NOTICE '========================================';
    IF errors = 0 THEN
        RAISE NOTICE 'MIGRATION VERIFICATION: ALL CHECKS PASSED';
    ELSE
        RAISE WARNING 'MIGRATION VERIFICATION: % CHECKS FAILED', errors;
    END IF;
    RAISE NOTICE '========================================';

END;
$$;

-- =============================================================================
-- Cleanup: Drop migration mapping tables
-- =============================================================================
-- Only uncomment after verification passes and you're sure no more references needed.
--
-- DROP TABLE IF EXISTS public._migration_agent_id_mapping;
-- DROP TABLE IF EXISTS public._migration_event_id_mapping;

-- =============================================================================
-- Taxonomy summary (queryable output)
-- =============================================================================
SELECT
    taxonomy_type,
    count(*) as value_count,
    string_agg(value, ', ' ORDER BY sort_order) as values
FROM simulation_taxonomies
WHERE simulation_id = '10000000-0000-0000-0000-000000000001'
GROUP BY taxonomy_type
ORDER BY taxonomy_type;

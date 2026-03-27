-- ============================================================================
-- Migration 163: Resonance Dungeons — Core Tables
-- ============================================================================
-- Creates the foundation for the Resonance Dungeon system:
--   - resonance_dungeon_runs: run metadata, party, progress, checkpoint
--   - resonance_dungeon_events: combat log, discoveries, narrative
--
-- RLS follows public-first architecture (Review #2):
--   - Completed/abandoned/wiped runs are publicly readable (no auth)
--   - Active runs require simulation membership
--   - All mutations go through service_role (Review #16)
-- ============================================================================

-- ── Table: resonance_dungeon_runs ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS resonance_dungeon_runs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    simulation_id       UUID NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
    resonance_id        UUID REFERENCES substrate_resonances(id) ON DELETE SET NULL,
    archetype           TEXT NOT NULL CHECK (archetype IN (
                            'The Tower', 'The Shadow', 'The Devouring Mother',
                            'The Deluge', 'The Overthrow', 'The Prometheus',
                            'The Awakening', 'The Entropy'
                        )),
    resonance_signature TEXT NOT NULL CHECK (resonance_signature IN (
                            'economic_tremor', 'conflict_wave', 'biological_tide',
                            'elemental_surge', 'authority_fracture', 'innovation_spark',
                            'consciousness_drift', 'decay_bloom'
                        )),

    -- Party
    party_agent_ids     UUID[] NOT NULL,
    party_player_ids    UUID[] NOT NULL DEFAULT '{}',

    -- Configuration
    difficulty          INT NOT NULL DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
    depth_target        INT NOT NULL DEFAULT 5,
    config              JSONB NOT NULL DEFAULT '{}',

    -- Progress
    current_depth       INT NOT NULL DEFAULT 0,
    rooms_cleared       INT NOT NULL DEFAULT 0,
    rooms_total         INT NOT NULL DEFAULT 0,
    status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN (
                            'active', 'combat', 'exploring',
                            'completed', 'abandoned', 'wiped'
                        )),

    -- Checkpoint: serialized mutable state for crash recovery
    -- Static graph is stored in config on creation; checkpoint only has mutable state
    checkpoint_state    JSONB,
    checkpoint_at       TIMESTAMPTZ,

    -- Outcome
    outcome             JSONB,
    completed_at        TIMESTAMPTZ,

    -- Metadata
    started_by_id       UUID NOT NULL REFERENCES auth.users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_dungeon_runs_sim
    ON resonance_dungeon_runs(simulation_id);

CREATE INDEX idx_dungeon_runs_active
    ON resonance_dungeon_runs(status)
    WHERE status IN ('active', 'combat', 'exploring');

CREATE INDEX idx_dungeon_runs_archetype
    ON resonance_dungeon_runs(archetype);

CREATE INDEX idx_dungeon_runs_started_by
    ON resonance_dungeon_runs(started_by_id);

-- RLS: Public-first (Review #2)
ALTER TABLE resonance_dungeon_runs ENABLE ROW LEVEL SECURITY;

-- Public can read completed/abandoned/wiped runs (no auth required)
CREATE POLICY dungeon_runs_public_read ON resonance_dungeon_runs
    FOR SELECT
    USING (status IN ('completed', 'abandoned', 'wiped'));

-- Simulation members can read active runs
CREATE POLICY dungeon_runs_member_read ON resonance_dungeon_runs
    FOR SELECT
    USING (
        status IN ('active', 'combat', 'exploring')
        AND EXISTS (
            SELECT 1 FROM simulation_members sm
            WHERE sm.simulation_id = resonance_dungeon_runs.simulation_id
            AND sm.user_id = auth.uid()
        )
    );

-- Editor+ can create runs (checked server-side, but RLS as safety net)
CREATE POLICY dungeon_runs_insert ON resonance_dungeon_runs
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM simulation_members sm
            WHERE sm.simulation_id = resonance_dungeon_runs.simulation_id
            AND sm.user_id = auth.uid()
            AND sm.member_role IN ('admin', 'owner', 'editor')
        )
    );

-- UPDATE/DELETE restricted to service_role only (Review #16)
-- No authenticated/anon UPDATE policy — all mutations go through backend with admin_supabase

-- Prevent concurrent active runs per simulation at DB level (no Python race condition)
CREATE UNIQUE INDEX idx_dungeon_runs_one_active_per_sim
    ON resonance_dungeon_runs(simulation_id)
    WHERE status IN ('active', 'combat', 'exploring');


-- ── Table: resonance_dungeon_events ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS resonance_dungeon_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id          UUID NOT NULL REFERENCES resonance_dungeon_runs(id) ON DELETE CASCADE,
    simulation_id   UUID NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
    depth           INT NOT NULL,
    room_index      INT NOT NULL,

    event_type      TEXT NOT NULL CHECK (event_type IN (
        'room_entered', 'combat_started', 'combat_resolved',
        'skill_check', 'encounter_choice', 'loot_found',
        'agent_stressed', 'agent_afflicted', 'agent_virtue',
        'agent_wounded', 'party_wipe', 'boss_defeated',
        'dungeon_completed', 'dungeon_abandoned',
        'banter', 'discovery'
    )),

    -- Narrative (bilingual)
    narrative_en    TEXT,
    narrative_de    TEXT,

    -- Mechanical outcome
    outcome         JSONB NOT NULL DEFAULT '{}',

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_dungeon_events_run
    ON resonance_dungeon_events(run_id, created_at);

CREATE INDEX idx_dungeon_events_sim
    ON resonance_dungeon_events(simulation_id);

CREATE INDEX idx_dungeon_events_type
    ON resonance_dungeon_events(event_type)
    WHERE event_type IN ('combat_resolved', 'boss_defeated', 'dungeon_completed', 'party_wipe');

-- RLS: Events inherit visibility from parent run
ALTER TABLE resonance_dungeon_events ENABLE ROW LEVEL SECURITY;

-- Public can read events from completed runs
CREATE POLICY dungeon_events_public_read ON resonance_dungeon_events
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM resonance_dungeon_runs r
            WHERE r.id = resonance_dungeon_events.run_id
            AND r.status IN ('completed', 'abandoned', 'wiped')
        )
    );

-- Members can read events from active runs in their simulation
CREATE POLICY dungeon_events_member_read ON resonance_dungeon_events
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM resonance_dungeon_runs r
            JOIN simulation_members sm ON sm.simulation_id = r.simulation_id
            WHERE r.id = resonance_dungeon_events.run_id
            AND r.status IN ('active', 'combat', 'exploring')
            AND sm.user_id = auth.uid()
        )
    );

-- INSERT restricted to service_role only (events are created by backend engine)
-- No authenticated INSERT policy — all events created via admin_supabase


-- ── PostgreSQL Functions ───────────────────────────────────────────────────
-- Atomic operations that MUST be in Postgres, not Python (ADR-007 pattern)

-- 1. Atomic dungeon outcome application: mood, moodlets, activities in one transaction
CREATE OR REPLACE FUNCTION fn_apply_dungeon_outcome(
    p_run_id         UUID,
    p_simulation_id  UUID,
    p_agent_outcomes JSONB  -- array of {agent_id, mood_delta, stress_delta, moodlets: [{...}], activity_narrative_en, activity_narrative_de}
) RETURNS VOID
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
    v_agent   JSONB;
    v_moodlet JSONB;
    v_agent_id UUID;
BEGIN
    FOR v_agent IN SELECT * FROM jsonb_array_elements(p_agent_outcomes)
    LOOP
        v_agent_id := (v_agent ->> 'agent_id')::UUID;

        -- Atomic mood update (compare-and-swap not needed — backend is sole writer during dungeon)
        UPDATE agent_mood
        SET mood_score   = GREATEST(-100, LEAST(100, mood_score + (v_agent ->> 'mood_delta')::INT)),
            stress_level = GREATEST(0, LEAST(1000, stress_level + (v_agent ->> 'stress_delta')::INT)),
            updated_at   = now()
        WHERE agent_id = v_agent_id;

        -- Bulk insert moodlets from dungeon
        FOR v_moodlet IN SELECT * FROM jsonb_array_elements(v_agent -> 'moodlets')
        LOOP
            INSERT INTO agent_moodlets (
                agent_id, simulation_id, moodlet_type, emotion, strength,
                source_type, source_description, decay_type, initial_strength,
                expires_at, stacking_group
            ) VALUES (
                v_agent_id,
                p_simulation_id,
                v_moodlet ->> 'moodlet_type',
                v_moodlet ->> 'emotion',
                (v_moodlet ->> 'strength')::INT,
                'system',
                v_moodlet ->> 'source_description',
                COALESCE(v_moodlet ->> 'decay_type', 'timed'),
                (v_moodlet ->> 'strength')::INT,
                CASE WHEN v_moodlet ->> 'expires_at' IS NOT NULL
                     THEN (v_moodlet ->> 'expires_at')::TIMESTAMPTZ
                     ELSE now() + INTERVAL '48 hours'
                END,
                'dungeon_outcome'
            );
        END LOOP;

        -- Create activity record (activity_type = 'explore', subtype = 'dungeon_exploration', Review #5)
        INSERT INTO agent_activities (
            agent_id, simulation_id, activity_type, activity_subtype,
            narrative_text, narrative_text_de, significance
        ) VALUES (
            v_agent_id,
            p_simulation_id,
            'explore',
            'dungeon_exploration',
            v_agent ->> 'activity_narrative_en',
            v_agent ->> 'activity_narrative_de',
            COALESCE((v_agent ->> 'significance')::INT, 7)
        );
    END LOOP;
END;
$$;

-- Only callable via backend service_role
GRANT EXECUTE ON FUNCTION fn_apply_dungeon_outcome(UUID, UUID, JSONB) TO service_role;

-- 2. Expire abandoned runs — called by heartbeat service cleanup
CREATE OR REPLACE FUNCTION fn_expire_abandoned_dungeon_runs(
    p_ttl_seconds INT DEFAULT 1800  -- 30 minutes
) RETURNS INT
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
    v_expired INT;
BEGIN
    UPDATE resonance_dungeon_runs
    SET status       = 'abandoned',
        completed_at = now(),
        updated_at   = now()
    WHERE status IN ('active', 'combat', 'exploring')
    AND   updated_at < now() - (p_ttl_seconds || ' seconds')::INTERVAL;

    GET DIAGNOSTICS v_expired = ROW_COUNT;
    RETURN v_expired;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_expire_abandoned_dungeon_runs(INT) TO service_role;

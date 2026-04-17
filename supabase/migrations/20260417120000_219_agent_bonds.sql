-- Migration 219: Agent Bonds foundation
--
-- Implements the Agent Bonds system (concept doc: docs/concepts/resonance-journal-agent-bonds-concept.md).
-- Three tables:
--   agent_bonds   -- core bond tracking (forming -> active -> strained -> farewell)
--   bond_whispers -- mood-dependent messages from bonded agents
--   bond_memories -- internal context for whisper generation (not user-facing)
--
-- RPC: fn_increment_attention -- atomic upsert for pre-bond attention tracking
-- RLS: initPlan-optimized with (SELECT ...) wrappers (migration 183 pattern)

-- ── Tables ────────────────────────────────────────────────────────────────

CREATE TABLE agent_bonds (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id),
    agent_id        UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    simulation_id   UUID NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
    depth           INTEGER NOT NULL DEFAULT 1
                        CHECK (depth BETWEEN 1 AND 5),
    status          TEXT NOT NULL DEFAULT 'forming'
                        CHECK (status IN ('forming', 'active', 'strained', 'farewell')),
    attention_score INTEGER NOT NULL DEFAULT 0,
    formed_at       TIMESTAMPTZ,
    depth_2_at      TIMESTAMPTZ,
    depth_3_at      TIMESTAMPTZ,
    depth_4_at      TIMESTAMPTZ,
    depth_5_at      TIMESTAMPTZ,
    farewell_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_user_agent_bond UNIQUE (user_id, agent_id)
);

CREATE TABLE bond_whispers (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bond_id              UUID NOT NULL REFERENCES agent_bonds(id) ON DELETE CASCADE,
    whisper_type         TEXT NOT NULL
                             CHECK (whisper_type IN ('state', 'event', 'memory', 'question', 'reflection')),
    content_de           TEXT NOT NULL,
    content_en           TEXT NOT NULL,
    trigger_context      JSONB NOT NULL DEFAULT '{}',
    read_at              TIMESTAMPTZ,
    acted_on             BOOLEAN NOT NULL DEFAULT false,
    action_acknowledged  BOOLEAN NOT NULL DEFAULT false,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE bond_memories (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bond_id      UUID NOT NULL REFERENCES agent_bonds(id) ON DELETE CASCADE,
    memory_type  TEXT NOT NULL
                     CHECK (memory_type IN ('action', 'neglect', 'milestone', 'farewell')),
    description  TEXT NOT NULL,
    context      JSONB NOT NULL DEFAULT '{}',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────

-- agent_bonds: list bonds for a user in a simulation
CREATE INDEX idx_bonds_user_sim ON agent_bonds(user_id, simulation_id);
-- agent_bonds: simulation-scoped queries (heartbeat, public)
CREATE INDEX idx_bonds_sim ON agent_bonds(simulation_id);
-- agent_bonds: farewell lookup when agent is deleted (CASCADE fires, but queries need this)
CREATE INDEX idx_bonds_agent ON agent_bonds(agent_id);
-- agent_bonds: active/forming bonds for slot counting + heartbeat
CREATE INDEX idx_bonds_active ON agent_bonds(simulation_id, status)
    WHERE status IN ('forming', 'active', 'strained');

-- bond_whispers: feed query (newest first per bond)
CREATE INDEX idx_whispers_bond_created ON bond_whispers(bond_id, created_at DESC);
-- bond_whispers: unread count badge
CREATE INDEX idx_whispers_unread ON bond_whispers(bond_id)
    WHERE read_at IS NULL;

-- bond_memories: context gathering for whisper generation
CREATE INDEX idx_memories_bond_created ON bond_memories(bond_id, created_at DESC);
-- bond_memories: type-filtered queries (e.g. count 'action' memories for depth check)
CREATE INDEX idx_memories_bond_type ON bond_memories(bond_id, memory_type);

-- ── Triggers ──────────────────────────────────────────────────────────────

CREATE TRIGGER set_agent_bonds_updated_at
    BEFORE UPDATE ON agent_bonds
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Bond lifecycle invariants enforced at the database level.
-- Python handles game logic (thresholds, engagement metrics); Postgres
-- guarantees structural integrity that no code path can violate.
CREATE OR REPLACE FUNCTION fn_bond_lifecycle_guard()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_active_count INTEGER;
BEGIN
    -- ── Status transition validation ──────────────────────────────────
    -- Allowed: forming→active, active→strained, strained→active,
    --          active→farewell, strained→farewell
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        IF NOT (
            (OLD.status = 'forming'  AND NEW.status = 'active')   OR
            (OLD.status = 'active'   AND NEW.status = 'strained') OR
            (OLD.status = 'strained' AND NEW.status = 'active')   OR
            (OLD.status = 'active'   AND NEW.status = 'farewell') OR
            (OLD.status = 'strained' AND NEW.status = 'farewell')
        ) THEN
            RAISE EXCEPTION 'Invalid bond status transition: % → %',
                OLD.status, NEW.status
                USING ERRCODE = 'P0001';
        END IF;
    END IF;

    -- ── Slot limit: max 5 active/strained bonds per user+simulation ──
    -- Only checked on transitions TO active (forming→active,
    -- strained→active). Compare-and-count is atomic within the trigger.
    IF NEW.status = 'active' AND OLD.status IN ('forming', 'strained') THEN
        SELECT count(*) INTO v_active_count
        FROM agent_bonds
        WHERE user_id = NEW.user_id
          AND simulation_id = NEW.simulation_id
          AND status IN ('active', 'strained')
          AND id != NEW.id;

        IF v_active_count >= 5 THEN
            RAISE EXCEPTION 'Maximum 5 active bonds per simulation'
                USING ERRCODE = 'P0002';
        END IF;
    END IF;

    -- ── Depth monotonicity: can only increase by exactly 1 ───────────
    IF NEW.depth IS DISTINCT FROM OLD.depth THEN
        IF NEW.depth != OLD.depth + 1 THEN
            RAISE EXCEPTION 'Bond depth can only advance by 1 (% → %)',
                OLD.depth, NEW.depth
                USING ERRCODE = 'P0003';
        END IF;
    END IF;

    -- ── Timestamp enforcement on transitions ─────────────────────────
    -- Set formed_at when entering active for the first time
    IF NEW.status = 'active' AND OLD.status = 'forming' THEN
        NEW.formed_at := coalesce(NEW.formed_at, now());
    END IF;

    -- Set farewell_at when entering farewell
    IF NEW.status = 'farewell' AND OLD.status != 'farewell' THEN
        NEW.farewell_at := coalesce(NEW.farewell_at, now());
    END IF;

    -- Set depth_N_at when depth advances
    IF NEW.depth IS DISTINCT FROM OLD.depth THEN
        CASE NEW.depth
            WHEN 2 THEN NEW.depth_2_at := coalesce(NEW.depth_2_at, now());
            WHEN 3 THEN NEW.depth_3_at := coalesce(NEW.depth_3_at, now());
            WHEN 4 THEN NEW.depth_4_at := coalesce(NEW.depth_4_at, now());
            WHEN 5 THEN NEW.depth_5_at := coalesce(NEW.depth_5_at, now());
            ELSE NULL;
        END CASE;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER bond_lifecycle_guard
    BEFORE UPDATE ON agent_bonds
    FOR EACH ROW EXECUTE FUNCTION fn_bond_lifecycle_guard();

-- ── RPC: Atomic attention increment ───────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_increment_attention(
    p_user_id UUID,
    p_agent_id UUID,
    p_simulation_id UUID
)
RETURNS SETOF agent_bonds
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_bond agent_bonds;
    v_agent_exists BOOLEAN;
BEGIN
    -- Validate: agent must exist in the specified simulation (prevents
    -- cross-simulation bond creation via crafted parameters).
    SELECT EXISTS (
        SELECT 1 FROM agents
        WHERE id = p_agent_id
          AND simulation_id = p_simulation_id
          AND deleted_at IS NULL
    ) INTO v_agent_exists;

    IF NOT v_agent_exists THEN
        RAISE EXCEPTION 'Agent does not belong to simulation'
            USING ERRCODE = 'P0004';
    END IF;

    -- Upsert: create forming bond if none exists, increment if forming.
    -- Once a bond is active/strained/farewell, attention tracking is a no-op
    -- (the ON CONFLICT UPDATE has a WHERE clause limiting to 'forming' status).
    INSERT INTO agent_bonds (user_id, agent_id, simulation_id, status, attention_score)
    VALUES (p_user_id, p_agent_id, p_simulation_id, 'forming', 1)
    ON CONFLICT (user_id, agent_id)
    DO UPDATE SET
        attention_score = agent_bonds.attention_score + 1,
        updated_at = now()
    WHERE agent_bonds.status = 'forming'
    RETURNING * INTO v_bond;

    -- If v_bond is null, the bond exists but is not 'forming' (already active).
    -- Return the existing bond unchanged.
    IF v_bond IS NULL THEN
        SELECT * INTO v_bond FROM agent_bonds
        WHERE user_id = p_user_id AND agent_id = p_agent_id;
    END IF;

    RETURN NEXT v_bond;
END;
$$;

-- SECURITY: Revoke public access — callable only via backend with service_role
-- (per ADR-006: SECURITY DEFINER RPCs must not be callable by anon/authenticated)
REVOKE EXECUTE ON FUNCTION fn_increment_attention FROM PUBLIC, anon, authenticated;
-- (per ADR-006: admin RPCs callable only via backend with role validation)

-- ── Row Level Security ────────────────────────────────────────────────────

-- agent_bonds: users see own bonds; public sees bond existence for social features
ALTER TABLE agent_bonds ENABLE ROW LEVEL SECURITY;

CREATE POLICY bonds_own_select ON agent_bonds
    FOR SELECT USING (
        user_id = (SELECT auth.uid())
    );

CREATE POLICY bonds_public_select ON agent_bonds
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM simulations s
            WHERE s.id = agent_bonds.simulation_id
              AND s.status = 'active'
              AND s.deleted_at IS NULL
        )
    );

CREATE POLICY bonds_own_insert ON agent_bonds
    FOR INSERT WITH CHECK (
        user_id = (SELECT auth.uid())
        AND (SELECT user_has_simulation_access(simulation_id))
    );

CREATE POLICY bonds_own_update ON agent_bonds
    FOR UPDATE USING (
        user_id = (SELECT auth.uid())
    );

-- Service role: full access for heartbeat pipeline + system operations
CREATE POLICY bonds_service_all ON agent_bonds
    FOR ALL USING (
        (SELECT auth.role()) = 'service_role'
    );

-- bond_whispers: only bond owner can read/update; service_role writes
ALTER TABLE bond_whispers ENABLE ROW LEVEL SECURITY;

CREATE POLICY whispers_owner_select ON bond_whispers
    FOR SELECT USING (
        (SELECT auth.uid()) = (
            SELECT ab.user_id FROM agent_bonds ab WHERE ab.id = bond_whispers.bond_id
        )
    );

CREATE POLICY whispers_owner_update ON bond_whispers
    FOR UPDATE USING (
        (SELECT auth.uid()) = (
            SELECT ab.user_id FROM agent_bonds ab WHERE ab.id = bond_whispers.bond_id
        )
    );

CREATE POLICY whispers_service_all ON bond_whispers
    FOR ALL USING (
        (SELECT auth.role()) = 'service_role'
    );

-- bond_memories: bond owner can insert; service_role has full access
ALTER TABLE bond_memories ENABLE ROW LEVEL SECURITY;

-- Bond owner can INSERT memories for their own bonds (depth progression,
-- action tracking). No SELECT/UPDATE/DELETE for authenticated users —
-- memories are write-only from the user perspective (read by service_role
-- for whisper generation context).
-- Bond owner can SELECT + INSERT their own memories.
-- SELECT needed for: _check_engagement (depth progression counts memories),
-- recover_from_strain (reads neglect memory for strain start time).
-- Without SELECT, depth 4+ is permanently unreachable for non-admin users.
CREATE POLICY memories_owner_select ON bond_memories
    FOR SELECT USING (
        (SELECT auth.uid()) = (
            SELECT ab.user_id FROM agent_bonds ab WHERE ab.id = bond_memories.bond_id
        )
    );

CREATE POLICY memories_owner_insert ON bond_memories
    FOR INSERT WITH CHECK (
        (SELECT auth.uid()) = (
            SELECT ab.user_id FROM agent_bonds ab WHERE ab.id = bond_memories.bond_id
        )
    );

CREATE POLICY memories_service_all ON bond_memories
    FOR ALL USING (
        (SELECT auth.role()) = 'service_role'
    );

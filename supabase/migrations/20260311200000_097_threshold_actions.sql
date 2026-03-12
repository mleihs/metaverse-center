-- ══════════════════════════════════════════════════════════════════
-- 097 ── Threshold Actions Log
-- ══════════════════════════════════════════════════════════════════
-- Tracks desperate/ascendant actions executed when simulation health
-- crosses critical (< 0.25) or ascendant (> 0.85) thresholds.
-- Actions: scorched_earth, emergency_draft, reality_anchor.

CREATE TABLE public.threshold_actions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    simulation_id UUID NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL CHECK (action_type IN ('scorched_earth', 'emergency_draft', 'reality_anchor')),
    executed_by UUID NOT NULL REFERENCES auth.users(id),
    target_building_id UUID REFERENCES buildings(id) ON DELETE SET NULL,
    target_zone_id UUID REFERENCES zones(id) ON DELETE SET NULL,
    result JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE threshold_actions IS 'Log of desperate/ascendant threshold actions executed by players.';

-- ── Indexes ─────────────────────────────────────────────────────
CREATE INDEX idx_threshold_actions_simulation ON threshold_actions (simulation_id);
CREATE INDEX idx_threshold_actions_user ON threshold_actions (executed_by);
CREATE INDEX idx_threshold_actions_type ON threshold_actions (simulation_id, action_type);

-- ── RLS ─────────────────────────────────────────────────────────
ALTER TABLE threshold_actions ENABLE ROW LEVEL SECURITY;

-- Members can view actions for their simulations
CREATE POLICY "Members can view simulation threshold actions"
    ON threshold_actions FOR SELECT
    USING (
        simulation_id IN (
            SELECT simulation_id FROM simulation_members WHERE user_id = auth.uid()
        )
    );

-- Public can also read (public-first architecture)
CREATE POLICY "Public can read threshold actions"
    ON threshold_actions FOR SELECT TO anon
    USING (true);

-- Inserts via service role only (backend executes actions)
CREATE POLICY "Service role can insert threshold actions"
    ON threshold_actions FOR INSERT TO service_role
    WITH CHECK (true);

-- ── Trigger: updated_at not needed (immutable log) ──────────────

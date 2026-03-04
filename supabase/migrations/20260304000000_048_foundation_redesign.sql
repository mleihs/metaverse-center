-- Migration 048: Foundation Phase Redesign ("Nebelkrieg")
-- Adds zone_fortifications table + zone_fortified battle log event type

-- ══════════════════════════════════════════════════════════════
-- 1. Zone Fortifications table
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS zone_fortifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    epoch_id    UUID NOT NULL REFERENCES game_epochs(id) ON DELETE CASCADE,
    zone_id     UUID NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
    source_simulation_id UUID NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
    security_bonus INT NOT NULL DEFAULT 1,
    expires_at_cycle INT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(epoch_id, zone_id)
);

CREATE INDEX idx_zone_fortifications_epoch ON zone_fortifications(epoch_id);
CREATE INDEX idx_zone_fortifications_source ON zone_fortifications(source_simulation_id);

-- ══════════════════════════════════════════════════════════════
-- 2. RLS policies
-- ══════════════════════════════════════════════════════════════

ALTER TABLE zone_fortifications ENABLE ROW LEVEL SECURITY;

-- Participants can view fortifications for their epoch
CREATE POLICY zone_fortifications_select ON zone_fortifications
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM epoch_participants ep
            WHERE ep.epoch_id = zone_fortifications.epoch_id
            AND ep.simulation_id = zone_fortifications.source_simulation_id
            AND ep.simulation_id IN (
                SELECT simulation_id FROM simulation_members
                WHERE user_id = auth.uid()
            )
        )
    );

-- Editors can insert fortifications for their own simulation
CREATE POLICY zone_fortifications_insert ON zone_fortifications
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM simulation_members sm
            WHERE sm.simulation_id = zone_fortifications.source_simulation_id
            AND sm.user_id = auth.uid()
            AND sm.member_role IN ('admin', 'owner', 'editor')
        )
    );

-- ══════════════════════════════════════════════════════════════
-- 3. Expand battle_log event type check to include 'zone_fortified'
-- ══════════════════════════════════════════════════════════════

ALTER TABLE battle_log DROP CONSTRAINT IF EXISTS battle_log_event_type_check;
ALTER TABLE battle_log ADD CONSTRAINT battle_log_event_type_check CHECK (
    event_type IN (
        'operative_deployed', 'mission_success', 'mission_failed',
        'detected', 'captured', 'sabotage', 'propaganda', 'assassination',
        'infiltration', 'alliance_formed', 'alliance_dissolved', 'betrayal',
        'phase_change', 'epoch_start', 'epoch_end', 'rp_allocated',
        'building_damaged', 'agent_wounded', 'counter_intel', 'intel_report',
        'zone_fortified'
    )
);

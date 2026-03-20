-- ============================================================================
-- Migration 144: Resonance impact hardening
--
-- Adds:
--   - failure_reason TEXT column on resonance_impacts
--   - 'partial' status enum value for partial event spawn success
--   - updated_at timestamp with auto-update trigger
--   - Improved fn_get_resonance_event_types fallback (never returns empty)
-- ============================================================================

-- ── 1. Add 'partial' to resonance_impact_status enum ──────────────────────

ALTER TYPE resonance_impact_status ADD VALUE IF NOT EXISTS 'partial' AFTER 'completed';


-- ── 2. Add failure_reason and updated_at columns ──────────────────────────

ALTER TABLE resonance_impacts
  ADD COLUMN IF NOT EXISTS failure_reason TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

COMMENT ON COLUMN resonance_impacts.failure_reason IS
  'Human-readable reason for failed/partial status. NULL when completed.';

-- Auto-update updated_at on modification
CREATE OR REPLACE TRIGGER set_resonance_impacts_updated_at
  BEFORE UPDATE ON resonance_impacts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── 3. Harden fn_get_resonance_event_types — never return empty ───────────

CREATE OR REPLACE FUNCTION fn_get_resonance_event_types(
  p_simulation_id UUID,
  p_signature TEXT
) RETURNS TEXT[] AS $$
  SELECT COALESCE(
    -- 1. Check simulation-level override
    (SELECT ARRAY(
       SELECT jsonb_array_elements_text(setting_value -> p_signature)
     )
     FROM simulation_settings
     WHERE simulation_id = p_simulation_id
       AND category = 'game_mechanics'
       AND setting_key = 'resonance_event_type_map'
       AND setting_value ? p_signature),
    -- 2. Fall back to signature defaults
    CASE p_signature
      WHEN 'economic_tremor'     THEN ARRAY['trade','crisis','social']
      WHEN 'conflict_wave'       THEN ARRAY['military','intrigue','social']
      WHEN 'biological_tide'     THEN ARRAY['social','crisis','eldritch']
      WHEN 'elemental_surge'     THEN ARRAY['crisis','nautical','discovery']
      WHEN 'authority_fracture'  THEN ARRAY['intrigue','military','social']
      WHEN 'innovation_spark'    THEN ARRAY['discovery','trade','intrigue']
      WHEN 'consciousness_drift' THEN ARRAY['social','religious','discovery']
      WHEN 'decay_bloom'         THEN ARRAY['crisis','eldritch','social']
      -- 3. Ultimate fallback — NEVER return empty
      ELSE ARRAY['crisis','social','intrigue']
    END
  );
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION fn_get_resonance_event_types(UUID, TEXT) IS
  'Returns event types for resonance impact. Checks simulation override first, '
  'then signature defaults, then generic fallback. Never returns empty array.';

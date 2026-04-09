-- Migration 191: Embassy Ward Mechanic — bleed defense for players.
--
-- L3 FIX: Previously, incoming echoes could only be approved/rejected by admins.
-- Players had zero control over incoming bleed. This adds a ward system to
-- embassies: players can configure a ward_vector on their embassy to reduce
-- the strength of matching-vector echoes arriving at their simulation.
--
-- Architecture:
--   ward_vector   — which bleed vector this embassy wards against (NULL = no ward)
--   ward_strength — reduction factor 0.0-1.0 (0.5 = halve echo strength)
--   fn_get_ward_strength() — RPC to query effective ward for a simulation+vector

-- 1. Add ward columns to embassies
ALTER TABLE embassies ADD COLUMN IF NOT EXISTS ward_vector TEXT CHECK (
    ward_vector IS NULL OR ward_vector IN (
        'commerce', 'language', 'memory', 'resonance',
        'architecture', 'dream', 'desire'
    )
);

ALTER TABLE embassies ADD COLUMN IF NOT EXISTS ward_strength NUMERIC(3,2)
    NOT NULL DEFAULT 0.0
    CHECK (ward_strength >= 0.0 AND ward_strength <= 1.0);

COMMENT ON COLUMN embassies.ward_vector IS
    'Bleed vector this embassy wards against. NULL means no ward active.';
COMMENT ON COLUMN embassies.ward_strength IS
    'Ward reduction factor (0.0 = no reduction, 1.0 = full block). Applied as (1 - ward_strength) multiplier on echo_strength for matching-vector echoes.';

-- 2. RPC: Get effective ward strength for a target simulation + echo vector.
-- Returns the MAX ward_strength from any active embassy involving this simulation
-- where ward_vector matches the echo vector. Returns 0.0 if no ward applies.
CREATE OR REPLACE FUNCTION fn_get_ward_strength(
    p_target_simulation_id UUID,
    p_echo_vector TEXT
) RETURNS NUMERIC
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
    v_strength NUMERIC := 0.0;
BEGIN
    SELECT COALESCE(MAX(e.ward_strength), 0.0) INTO v_strength
    FROM embassies e
    WHERE e.status = 'active'
      AND e.ward_vector = p_echo_vector
      AND (e.simulation_a_id = p_target_simulation_id
           OR e.simulation_b_id = p_target_simulation_id);

    RETURN v_strength;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_get_ward_strength(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_get_ward_strength(UUID, TEXT) TO service_role;

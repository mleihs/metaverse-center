-- 061: Fix simulation hard-delete
--
-- Two issues prevent hard-deleting simulations:
--   1. prevent_last_owner_removal() trigger blocks CASCADE deletes
--      on simulation_members — it doesn't distinguish between
--      "removing a member" vs "deleting the entire simulation"
--   2. embassies.simulation_a_id / simulation_b_id lack ON DELETE CASCADE

-- ── Fix 1: Make trigger cascade-aware ──────────────────────────────────
-- Skip the check when the parent simulation is being deleted.

CREATE OR REPLACE FUNCTION public.prevent_last_owner_removal()
RETURNS TRIGGER AS $$
BEGIN
    -- If the simulation itself is being deleted (CASCADE), allow it.
    IF NOT EXISTS (
        SELECT 1 FROM simulations WHERE id = OLD.simulation_id
    ) THEN
        RETURN OLD;
    END IF;

    IF OLD.member_role = 'owner' THEN
        IF NOT EXISTS (
            SELECT 1 FROM simulation_members
            WHERE simulation_id = OLD.simulation_id
              AND member_role = 'owner'
              AND id != OLD.id
        ) THEN
            RAISE EXCEPTION 'Cannot remove the last owner of a simulation';
        END IF;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- ── Fix 2: Add CASCADE to embassy foreign keys ────────────────────────

ALTER TABLE public.embassies
    DROP CONSTRAINT IF EXISTS embassies_simulation_a_id_fkey,
    DROP CONSTRAINT IF EXISTS embassies_simulation_b_id_fkey;

ALTER TABLE public.embassies
    ADD CONSTRAINT embassies_simulation_a_id_fkey
        FOREIGN KEY (simulation_a_id) REFERENCES simulations(id) ON DELETE CASCADE,
    ADD CONSTRAINT embassies_simulation_b_id_fkey
        FOREIGN KEY (simulation_b_id) REFERENCES simulations(id) ON DELETE CASCADE;

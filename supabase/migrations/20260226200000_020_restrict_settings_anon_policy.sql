-- Restrict anon settings policy to design category only.
-- Previously allowed all categories at DB level (backend filtered, but
-- a direct Supabase client call could bypass the backend filter).

DROP POLICY IF EXISTS settings_anon_select ON simulation_settings;

CREATE POLICY settings_anon_select ON simulation_settings
    FOR SELECT TO anon
    USING (
        category = 'design'
        AND EXISTS (
            SELECT 1 FROM simulations s
            WHERE s.id = simulation_settings.simulation_id
              AND s.status = 'active'
              AND s.deleted_at IS NULL
        )
    );

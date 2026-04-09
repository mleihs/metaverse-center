-- 187: Make 'features' settings publicly readable (like 'design' and 'anchor')
--
-- Feature flags (e.g. show_chronicle) are UI visibility toggles, not secrets.
-- They must be readable by all visitors so SimulationNav can show/hide tabs
-- without requiring membership.

DROP POLICY settings_anon_select ON simulation_settings;
CREATE POLICY settings_anon_select ON simulation_settings
  FOR SELECT USING (
    category IN ('design', 'anchor', 'features')
    AND (SELECT s.status FROM simulations s WHERE s.id = simulation_id AND s.deleted_at IS NULL) = 'active'
  );

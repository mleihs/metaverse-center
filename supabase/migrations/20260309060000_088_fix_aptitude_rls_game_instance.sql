-- ============================================================================
-- 088: Fix agent_aptitudes RLS to allow game_instance reads
-- ============================================================================
-- Game instance simulations need the same read access as templates for epoch
-- gameplay. Without this, the Deploy Operative modal cannot load aptitude data
-- for agents in game instances.
-- ============================================================================

-- Authenticated: members OR template/game_instance sims
DROP POLICY IF EXISTS agent_aptitudes_select ON agent_aptitudes;
CREATE POLICY agent_aptitudes_select ON agent_aptitudes
  FOR SELECT TO authenticated USING (
    simulation_id IN (
      SELECT simulation_id FROM simulation_members WHERE user_id = auth.uid()
    )
    OR simulation_id IN (
      SELECT id FROM simulations WHERE simulation_type IN ('template', 'game_instance')
    )
  );

-- Anonymous: template + game_instance sims (public read)
DROP POLICY IF EXISTS agent_aptitudes_anon_select ON agent_aptitudes;
CREATE POLICY agent_aptitudes_anon_select ON agent_aptitudes
  FOR SELECT TO anon USING (
    simulation_id IN (
      SELECT id FROM simulations WHERE simulation_type IN ('template', 'game_instance')
    )
  );

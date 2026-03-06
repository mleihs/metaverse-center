-- 064: Allow simulation members with editor+ role to manage lore sections
CREATE POLICY simulation_lore_member_write ON simulation_lore
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM simulation_members sm
      WHERE sm.simulation_id = simulation_lore.simulation_id
        AND sm.user_id = auth.uid()
        AND sm.member_role IN ('owner', 'admin', 'editor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM simulation_members sm
      WHERE sm.simulation_id = simulation_lore.simulation_id
        AND sm.user_id = auth.uid()
        AND sm.member_role IN ('owner', 'admin', 'editor')
    )
  );

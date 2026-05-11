-- Phase 6.2: world-map event markers via Supabase Realtime.
--
-- Adds the `events` table to the supabase_realtime publication so frontend
-- clients can subscribe to INSERTs via postgres_changes. Each subscription
-- is scoped to a single simulation_id via the filter param; clients see
-- only events for the sim they're viewing.
--
-- Frontend consumer: `frontend/src/components/world-map/SimulationWorldMap.ts`
-- — drops a pulse-marker at the event's matched zone-centroid for events
-- with impact_level >= 7. Markers self-fade after 12s.
--
-- Bandwidth note: every events INSERT now generates a WAL-replicated
-- Realtime broadcast. At metaverse.center scale (one subscriber per
-- simulation viewport, heartbeat-driven event cadence) this is negligible.
-- Re-evaluate if event volume grows beyond ~1k inserts/min/simulation.
--
-- See: docs/guides/world-map-observability.md
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE events;
EXCEPTION
  WHEN duplicate_object THEN
    -- Table already in publication; idempotent no-op.
    NULL;
END
$$;

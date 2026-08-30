-- Realtime publication: the two tables whose UI already listens for them.
--
-- Measured on production 30.08.2026:
--   select tablename from pg_publication_tables where pubname='supabase_realtime';
--   → ai_usage_log, forge_access_requests
--
-- Two subscriptions in the frontend therefore never fired:
--
--   `events` — SimulationWorldMap drops a pulse marker at the matched zone
--     centroid for events with impact_level >= 7. Migration 237
--     (20260511120000) added the table to the publication, but that version is
--     ABSENT from production's supabase_migrations.schema_migrations and the
--     table is absent from the publication: the migration was never applied.
--     (Its neighbour 238, 20260611120000, is missing from the ledger too, while
--     its effect IS present — the ledger is not evidence either way, only a
--     schema comparison is. See docs: prod-schema-gap-migration-235.)
--
--   `user_achievements` — VelgAchievementToast subscribes to INSERTs filtered
--     on its own user_id. No migration ever added this table to any
--     publication, so no achievement has ever raised a toast in real time.
--     RLS allows the read (policy user_achievements_select, authenticated,
--     qual = true), so the broadcast reaches the subscriber.
--
-- Idempotent by the pattern of 237: ALTER PUBLICATION raises duplicate_object
-- when the table is already a member, which is a no-op here. Re-applying this
-- migration, or applying it after a late 237, is safe.
--
-- Bandwidth: both tables are low-volume (heartbeat-driven event inserts, one
-- achievement row per unlock). Re-evaluate above ~1k inserts/min.

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE events;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END
$$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE user_achievements;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END
$$;

-- Ambient Weather System: geographic anchors for real-world weather seeding
-- + expand heartbeat entry types for weather events and agent autonomy

-- ── Add weather coordinates to simulations ──────────────────────────────────

ALTER TABLE simulations
  ADD COLUMN IF NOT EXISTS weather_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS weather_lon DOUBLE PRECISION;

COMMENT ON COLUMN simulations.weather_lat IS 'Latitude for real-world weather seeding (Open-Meteo API)';
COMMENT ON COLUMN simulations.weather_lon IS 'Longitude for real-world weather seeding (Open-Meteo API)';

-- Seed geographic anchors for main simulations
-- Velgarien → Prague (Cold War spy thriller, fog-prone, gothic)
UPDATE simulations SET weather_lat = 50.0755, weather_lon = 14.4378
WHERE id = '10000000-0000-0000-0000-000000000001';

-- The Gaslit Reach → Lofoten, Norway (biopunk, dramatic coastal, Arctic storms)
UPDATE simulations SET weather_lat = 68.2340, weather_lon = 14.5700
WHERE id = '20000000-0000-0000-0000-000000000001';

-- Station Null → Svalbard, Norway (sci-fi, polar night/midnight sun, extreme)
UPDATE simulations SET weather_lat = 78.2232, weather_lon = 15.6267
WHERE id = '30000000-0000-0000-0000-000000000001';

-- Speranza → Amalfi Coast, Italy (post-apocalyptic Mediterranean)
UPDATE simulations SET weather_lat = 40.6340, weather_lon = 14.6027
WHERE id = '40000000-0000-0000-0000-000000000001';

-- Cité des Dames → Carcassonne, France (medieval walled city, Tramontane wind)
UPDATE simulations SET weather_lat = 43.2130, weather_lon = 2.3491
WHERE id = '50000000-0000-0000-0000-000000000001';

-- ── Expand heartbeat_entries entry_type CHECK constraint ─────────────────────
-- Original constraint (migration 129) is too narrow — missing autonomy types
-- and now ambient_weather. Drop and recreate with all types.

ALTER TABLE heartbeat_entries
  DROP CONSTRAINT IF EXISTS heartbeat_entries_entry_type_check;

ALTER TABLE heartbeat_entries
  ADD CONSTRAINT heartbeat_entries_entry_type_check CHECK (entry_type IN (
    -- Original (migration 129)
    'zone_shift', 'event_aging', 'event_escalation', 'event_resolution',
    'scar_tissue', 'resonance_pressure', 'cascade_spawn', 'bureau_response',
    'attunement_deepen', 'anchor_strengthen', 'convergence', 'positive_event',
    'narrative_arc', 'system_note',
    -- Agent autonomy (heartbeat_service.py Phase 9)
    'agent_crisis', 'relationship_shift', 'social_event', 'autonomous_event',
    -- Ambient weather (this migration)
    'ambient_weather'
  ));

-- ── Enable weather for Velgarien ─────────────────────────────────────────────

INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value)
VALUES ('10000000-0000-0000-0000-000000000001', 'heartbeat', 'weather_enabled', 'true')
ON CONFLICT (simulation_id, category, setting_key) DO NOTHING;

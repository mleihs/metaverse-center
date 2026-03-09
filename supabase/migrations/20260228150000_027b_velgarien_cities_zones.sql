-- 027b: Pre-create Velgarien cities and zones for migration 028 FK dependencies
-- Seeds run after migrations, but migration 028_embassies references these zone IDs.
-- All inserts use ON CONFLICT DO NOTHING so they are idempotent with the seed file.

DO $$
DECLARE
  sim_id uuid := '10000000-0000-0000-0000-000000000001';
BEGIN

-- Cities
INSERT INTO cities (id, simulation_id, name, description, population) VALUES
  ('c0000001-0000-4000-a000-000000000001', sim_id, 'Velgarien-Stadt',
   'Die Hauptstadt und das politische Zentrum des Landes', 850000),
  ('c0000002-0000-0000-0000-000000000001', sim_id, 'Hafenstadt Korrin',
   'Wichtiger Handelshafen im Sueden', 320000)
ON CONFLICT (id) DO NOTHING;

-- Zones
INSERT INTO zones (id, simulation_id, city_id, name, zone_type, description) VALUES
  ('a0000001-0000-0000-0000-000000000001', sim_id,
   'c0000001-0000-4000-a000-000000000001', 'Regierungsviertel',
   'government', 'Das politische Herz der Hauptstadt'),
  ('a0000002-0000-0000-0000-000000000001', sim_id,
   'c0000001-0000-4000-a000-000000000001', 'Industriegebiet Nord',
   'industrial', 'Schwerindustrie und Fabriken'),
  ('a0000003-0000-0000-0000-000000000001', sim_id,
   'c0000001-0000-4000-a000-000000000001', 'Altstadt',
   'residential', 'Historisches Wohnviertel mit enger Bebauung')
ON CONFLICT (id) DO NOTHING;

END $$;

-- =============================================================================
-- SEED 007: Sample Data for Velgarien Simulation
-- =============================================================================

BEGIN;

DO $$
DECLARE
  sim_id uuid := '10000000-0000-0000-0000-000000000001';
  usr_id uuid := '00000000-0000-0000-0000-000000000001';
BEGIN

-- ============ AGENTS ============
INSERT INTO agents (simulation_id, name, system, gender, character, background, created_by_id) VALUES
  (sim_id, 'Viktor Harken', 'politics', 'male', 'Machthungriger Kanzler mit eisernem Willen', 'Viktor Harken regiert Velgarien seit 12 Jahren mit harter Hand. Sein politisches Geschick ist legendaer, doch seine Methoden sind umstritten.', usr_id),
  (sim_id, 'Elena Voss', 'economy', 'female', 'Brillante Industriemagnatinmit Weitblick', 'Elena Voss kontrolliert den groessten Industriekonzern Velgariens. Ihre Entscheidungen beeinflussen die gesamte Wirtschaft des Landes.', usr_id),
  (sim_id, 'Pater Cornelius', 'religion', 'male', 'Charismatischer Kirchenfuehrer mit dunklen Geheimnissen', 'Pater Cornelius ist das spirituelle Oberhaupt der Velgarischen Kirche. Seine Predigten bewegen Millionen, doch hinter der Fassade verbirgt sich mehr.', usr_id),
  (sim_id, 'Mira Steinfeld', 'media', 'female', 'Furchtlose Investigativjournalistin', 'Mira Steinfeld deckt Skandale auf, die andere lieber im Verborgenen lassen wuerden. Ihre Artikel haben schon Regierungen ins Wanken gebracht.', usr_id),
  (sim_id, 'General Aldric Wolf', 'military', 'male', 'Dekorierter Kriegsheld mit eigener Agenda', 'General Wolf ist der hoechstdekorierte Offizier Velgariens. Seine Loyalitaet gilt dem Land, nicht unbedingt der aktuellen Regierung.', usr_id),
  (sim_id, 'Lena Kray', 'politics', 'female', 'Idealistische Oppositionsfuehrerin', 'Lena Kray kaempft fuer Demokratie und Transparenz in einem System, das beides scheut. Ihre Anhaengerschaft waechst stetig.', usr_id),
  (sim_id, 'Doktor Fenn', 'economy', 'diverse', 'Genialer aber exzentrischer Wissenschaftler', 'Doktor Fenn forscht an der Grenze des Moeglichen. Die Erfindungen koennten Velgarien revolutionieren oder zerstoeren.', usr_id),
  (sim_id, 'Schwester Irma', 'religion', 'female', 'Rebellische Nonne mit sozialem Gewissen', 'Schwester Irma hat sich dem Dienst an den Armen verschrieben und scheut keinen Konflikt mit der Kirchenhierarchie.', usr_id);

-- ============ CITIES ============
INSERT INTO cities (id, simulation_id, name, description, population) VALUES
  ('c0000001-0000-4000-a000-000000000001', sim_id, 'Velgarien-Stadt', 'Die Hauptstadt und das politische Zentrum des Landes', 850000),
  ('c0000002-0000-0000-0000-000000000001', sim_id, 'Hafenstadt Korrin', 'Wichtiger Handelshafen im Sueden', 320000)
ON CONFLICT (id) DO NOTHING;

-- ============ ZONES ============
INSERT INTO zones (id, simulation_id, city_id, name, zone_type, description) VALUES
  ('a0000001-0000-0000-0000-000000000001', sim_id, 'c0000001-0000-4000-a000-000000000001', 'Regierungsviertel', 'government', 'Das politische Herz der Hauptstadt'),
  ('a0000002-0000-0000-0000-000000000001', sim_id, 'c0000001-0000-4000-a000-000000000001', 'Industriegebiet Nord', 'industrial', 'Schwerindustrie und Fabriken'),
  ('a0000003-0000-0000-0000-000000000001', sim_id, 'c0000001-0000-4000-a000-000000000001', 'Altstadt', 'residential', 'Historisches Wohnviertel mit enger Bebauung')
ON CONFLICT (id) DO NOTHING;

-- ============ BUILDINGS ============
INSERT INTO buildings (simulation_id, name, building_type, building_condition, description, zone_id, population_capacity) VALUES
  (sim_id, 'Kanzlerpalast', 'government', 'excellent', 'Sitz der Regierung und Symbol der Macht in Velgarien', 'a0000001-0000-0000-0000-000000000001', 200),
  (sim_id, 'Voss-Industriewerk', 'commercial', 'good', 'Das Flaggschiff der Voss-Industriegruppe', 'a0000002-0000-0000-0000-000000000001', 500),
  (sim_id, 'Kathedrale des Lichts', 'cultural', 'good', 'Die groesste Kirche Velgariens, erbaut im 14. Jahrhundert', 'a0000003-0000-0000-0000-000000000001', 1000),
  (sim_id, 'Steinfeld-Redaktion', 'commercial', 'fair', 'Bueros der unabhaengigen Zeitung', 'a0000003-0000-0000-0000-000000000001', 50),
  (sim_id, 'Militaerakademie Wolf', 'government', 'good', 'Ausbildungsstaette der velgarischen Streitkraefte', 'a0000001-0000-0000-0000-000000000001', 300),
  (sim_id, 'Armenhaus der Barmherzigkeit', 'residential', 'poor', 'Von Schwester Irma gefuehrte Unterkunft fuer Obdachlose', 'a0000003-0000-0000-0000-000000000001', 80);

-- ============ EVENTS ============
INSERT INTO events (simulation_id, title, event_type, description, impact_level, occurred_at, tags) VALUES
  (sim_id, 'Kanzler Harken verhaengt Ausnahmezustand', 'political', 'Nach wochenlangen Protesten verhaengt Kanzler Harken den Ausnahmezustand.', 9, now() - interval '30 days', ARRAY['politik', 'krise', 'harken']),
  (sim_id, 'Wirtschaftskrise trifft Velgarien', 'economic', 'Die Voss-Industriegruppe meldet Rekordverluste. Tausende Arbeitsplaetze sind bedroht.', 8, now() - interval '20 days', ARRAY['wirtschaft', 'krise', 'voss']),
  (sim_id, 'Kirchenskandal erschuettert Glaeubige', 'cultural', 'Mira Steinfeld veroeffentlicht brisante Dokumente ueber die Kirchenfinanzen.', 7, now() - interval '15 days', ARRAY['kirche', 'skandal', 'medien']),
  (sim_id, 'Militaerparade zum Nationalfeiertag', 'political', 'General Wolf nutzt die jaehrliche Militaerparade fuer eine ueberraschende Rede.', 5, now() - interval '10 days', ARRAY['militaer', 'nationalfeiertag', 'wolf']),
  (sim_id, 'Grossbrand im Industriegebiet', 'economic', 'Ein verheerender Brand zerstoert Teile des Voss-Industriewerks. Sabotage wird nicht ausgeschlossen.', 8, now() - interval '5 days', ARRAY['brand', 'industrie', 'sabotage']),
  (sim_id, 'Opposition fordert Neuwahlen', 'political', 'Lena Kray sammelt 100.000 Unterschriften fuer eine Petition.', 6, now() - interval '2 days', ARRAY['opposition', 'demokratie', 'kray']);

RAISE NOTICE 'Sample data: 8 agents, 2 cities, 3 zones, 6 buildings, 6 events';
END $$;

COMMIT;

-- ============================================================================
-- 354 — Auch das Erzeugte ist Text, den jemand liest
--
-- Migration 351 hat den Geviertstrich aus zwoelf Spalten geraeumt. Diese
-- Zielliste war aus den SAAT-DATEIEN abgeleitet, nicht aus der Datenbank —
-- und damit unvollstaendig. Nachgemessen an der Produktion trugen danach
-- immer noch 25359 Zeilen in 60 Spalten einen Geviertstrich.
--
-- Zwei Luecken, beide dieselbe Ursache:
--
--   1. Die ZWEISPRACHIGKEIT. 351 kannte `description`, aber nicht
--      `description_de`; `background`, aber nicht `background_de`. Die halbe
--      Plattform ist deutsch, und die halbe Zielliste hat das nicht gewusst.
--   2. Das ERZEUGTE. Der groesste Posten sind die Depeschen des Herzschlags
--      (`simulation_heartbeats.dispatch_en/de`, rund 24 000 Zeilen): Text, den
--      das Modell geschrieben hat, weil die Prompts ihm den Geviertstrich
--      vorgemacht haben. Die Ursache ist behoben (die Vorlagen tragen seit 351
--      den Halbgeviertstrich), die Wirkung stand noch da.
--
-- WAS BEWUSST NICHT MITKOMMT
--
-- Drei Spalten sind AUFZEICHNUNGEN FREMDER TATSACHEN und bleiben unberuehrt:
--
--   * `github_webhook_events.payload`  — woertlich das, was GitHub geschickt hat
--   * `news_scan_candidates.description` — der Text, den die QUELLE geschrieben hat
--   * `news_scan_log.title`            — die Protokollzeile eines Laufs
--
-- Ein Archiv, das seine eigenen Belege glaettet, ist kein Archiv mehr. Die
-- Hilfe zur Schleuse sagt es selbst: ein verworfenes Signal bleibt aktenkundig
-- als eines, das gesehen wurde. Dieselbe Regel gilt fuer den Wortlaut.
-- `news_scan_candidates.bureau_dispatch` kommt dagegen MIT — die Depesche ist
-- unsere eigene Erzeugung aus `scanner_bureau_dispatch`, nicht die der Quelle.
--
-- jsonb: ersetzt wird ueber den serialisierten Text. Vorher geprueft, ob ein
-- Geviertstrich je in einem SCHLUESSEL steht (Muster `"…—…" :`) — null Treffer
-- in allen zwoelf jsonb-Spalten. Nur Werte sind betroffen, ein Nachschlagen
-- kann also nicht brechen.
--
-- Ohne PITR auf diesem Projekt: der Originaltext aller betroffenen Zeilen ist
-- vor dem Lauf gesichert worden (25 Tabellen, 12 802 Zeilen).
--
-- Selbstpruefung wie in 351: geprueft wird die eigene WIRKUNG, nicht der
-- Bestand. Auf einer frischen Datenbank ist nichts zu tun, und die Migration
-- sagt das per RAISE NOTICE, statt still gruen zu sein.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  -- (Tabelle, Spalte, Art) — die Zahl im Kommentar ist der Bestand am 03.09.2026.
  ziele CONSTANT text[][] := ARRAY[
    ['agent_memories',          'content',                'text'],  -- 37
    ['agent_memories',          'content_de',             'text'],  -- 10
    ['agent_professions',       'profession',             'text'],  -- 5
    ['agent_relationships',     'description',            'text'],  -- 29
    ['agents',                  'background_de',          'text'],  -- 31
    ['agents',                  'character_de',           'text'],  -- 29
    ['agents',                  'portrait_description',   'text'],  -- 24
    ['agents',                  'primary_profession',     'text'],  -- 5
    ['agents',                  'primary_profession_de',  'text'],  -- 4
    ['agents',                  'system',                 'text'],  -- 11
    ['bluesky_posts',           'caption',                'text'],  -- 2
    ['buildings',               'description_de',         'text'],  -- 41
    ['buildings',               'image_prompt_text',      'text'],  -- 16
    ['chat_messages',           'content',                'text'],  -- 1
    ['drift_tuning',            'description',            'text'],  -- 20
    ['embassies',               'established_by',         'text'],  -- 37
    ['event_reactions',         'reaction_text',          'text'],  -- 93
    ['event_reactions',         'reaction_text_de',       'text'],  -- 51
    ['events',                  'description',            'text'],  -- 61
    ['events',                  'description_de',         'text'],  -- 1
    ['events',                  'title_de',               'text'],  -- 1
    ['forge_drafts',            'agents',                'jsonb'],  -- 16
    ['forge_drafts',            'ai_settings',           'jsonb'],  -- 1
    ['forge_drafts',            'buildings',             'jsonb'],  -- 15
    ['forge_drafts',            'geography',             'jsonb'],  -- 13
    ['forge_drafts',            'philosophical_anchor',  'jsonb'],  -- 13
    ['forge_drafts',            'research_context',      'jsonb'],  -- 11
    ['forge_drafts',            'theme_config',          'jsonb'],  -- 1
    ['heartbeat_entries',       'narrative_de',           'text'],  -- 49
    ['heartbeat_entries',       'narrative_en',           'text'],  -- 49
    ['instagram_posts',         'alt_text',               'text'],  -- 1
    ['instagram_posts',         'caption',                'text'],  -- 13
    ['news_scan_candidates',    'bureau_dispatch',        'text'],  -- 65
    ['platform_settings',       'description',            'text'],  -- 13
    ['resonance_cascade_rules', 'narrative_de',           'text'],  -- 8
    ['resonance_cascade_rules', 'narrative_en',           'text'],  -- 8
    ['simulation_broadsheets',  'gazette_wire',          'jsonb'],  -- 3
    ['simulation_broadsheets',  'subtitle',               'text'],  -- 4
    ['simulation_broadsheets',  'subtitle_de',            'text'],  -- 4
    ['simulation_chronicles',   'content',                'text'],  -- 9
    ['simulation_chronicles',   'content_de',             'text'],  -- 1
    ['simulation_chronicles',   'title',                  'text'],  -- 7
    ['simulation_chronicles',   'title_de',               'text'],  -- 1
    ['simulation_connections',  'description',            'text'],  -- 11
    ['simulation_heartbeats',   'dispatch_de',            'text'],  -- 12081
    ['simulation_heartbeats',   'dispatch_en',            'text'],  -- 12081
    ['simulation_lore',         'body',                   'text'],  -- 93
    ['simulation_lore',         'body_de',                'text'],  -- 47
    ['simulation_lore',         'chapter',                'text'],  -- 39
    ['simulation_lore',         'epigraph',               'text'],  -- 39
    ['simulation_lore',         'epigraph_de',            'text'],  -- 31
    ['simulation_lore',         'image_caption',          'text'],  -- 28
    ['simulation_lore',         'image_caption_de',       'text'],  -- 13
    ['simulation_lore',         'title',                  'text'],  -- 30
    ['simulation_lore',         'title_de',               'text'],  -- 13
    ['simulation_settings',     'setting_value',         'jsonb'],  -- 9
    ['simulations',             'anchor_choices',        'jsonb'],  -- 6
    ['simulations',             'description_de',         'text'],  -- 2
    ['simulations',             'philosophical_anchor',  'jsonb'],  -- 4
    ['zones',                   'description_de',         'text']   -- 18
  ];
  tabelle text;
  spalte  text;
  art     text;
  betroffen bigint;
  gesamt bigint := 0;
  uebrig bigint;
BEGIN
  FOR i IN 1 .. array_length(ziele, 1) LOOP
    tabelle := ziele[i][1];
    spalte  := ziele[i][2];
    art     := ziele[i][3];

    -- Eine fehlende Spalte ist ein Fehler in DIESER Liste, kein Grund,
    -- stillschweigend weiterzugehen.
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tabelle AND column_name = spalte
    ) THEN
      RAISE EXCEPTION 'Migration 354: %.% gibt es nicht — die Zielliste ist veraltet', tabelle, spalte;
    END IF;

    IF art = 'jsonb' THEN
      EXECUTE format(
        'UPDATE public.%I SET %I = replace(%I::text, %L, %L)::jsonb WHERE %I::text LIKE %L',
        tabelle, spalte, spalte, e'\u2014', e'\u2013', spalte, '%' || e'\u2014' || '%'
      );
    ELSE
      EXECUTE format(
        'UPDATE public.%I SET %I = replace(%I, %L, %L) WHERE %I LIKE %L',
        tabelle, spalte, spalte, e'\u2014', e'\u2013', spalte, '%' || e'\u2014' || '%'
      );
    END IF;
    GET DIAGNOSTICS betroffen = ROW_COUNT;
    gesamt := gesamt + betroffen;

    IF betroffen > 0 THEN
      RAISE NOTICE 'Migration 354: %.% — % Zeile(n) bereinigt', tabelle, spalte, betroffen;
    END IF;
  END LOOP;

  -- Wirkprobe: in keiner benannten Spalte darf noch ein U+2014 stehen.
  FOR i IN 1 .. array_length(ziele, 1) LOOP
    tabelle := ziele[i][1];
    spalte  := ziele[i][2];
    EXECUTE format(
      'SELECT count(*) FROM public.%I WHERE %I::text LIKE %L',
      tabelle, spalte, '%' || e'\u2014' || '%'
    ) INTO uebrig;
    IF uebrig > 0 THEN
      RAISE EXCEPTION 'Migration 354: %.% fuehrt noch % Zeile(n) mit U+2014', tabelle, spalte, uebrig;
    END IF;
  END LOOP;

  IF gesamt = 0 THEN
    RAISE NOTICE 'Migration 354: nichts zu bereinigen — die Wirkprobe ist damit AUSGESETZT, nicht bestanden (frische Datenbank? dort erzeugt noch niemand Text)';
  ELSE
    RAISE NOTICE 'Migration 354: % Zeile(n) insgesamt bereinigt, keine Spalte fuehrt mehr U+2014', gesamt;
  END IF;
END $$;

COMMIT;

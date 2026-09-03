-- ============================================================================
-- 351 — Der lange Strich hatte im Text nichts verloren
--
-- Die Projektregel kennt nur den Halbgeviertstrich (U+2013) in Text, den ein
-- Mensch zu sehen bekommt. Der Geviertstrich (U+2014) stand trotzdem an
-- Hunderten Stellen: in den Saat-Dateien, in den Erzähl-Vorlagen der Python-
-- Schicht und in den Inhaltspaketen des Verlieses.
--
-- Die QUELLEN sind im selben Commit bereinigt (`supabase/seed/*.sql`,
-- `backend/services/**/*.py`, `content/dungeon/**/*.yaml`). Damit ist eine
-- FRISCHE Datenbank von sich aus sauber — die Saat legt schon den richtigen
-- Strich an, und diese Migration findet dort folgerichtig nichts zu tun.
--
-- Diese Migration ist ausschliesslich für die BESTEHENDE Datenbank da: dort
-- liegen die Zeilen seit ihrer Aussaat mit dem falschen Strich, und keine
-- Änderung an einer Saat-Datei erreicht sie je. Genau das ist der Grund, warum
-- Quelle UND Bestand getrennt angefasst werden müssen.
--
-- Das Verlies-Material braucht hier nichts: Migration 350 schreibt die
-- Inhaltstabellen ohnehin per TRUNCATE + Neuaufbau aus den (bereinigten)
-- Paketen neu.
--
-- Selbstprüfung: geprüft wird die eigene WIRKUNG (steht in den benannten
-- Spalten noch ein U+2014?), nicht der Bestand der Plattform. Auf einer leeren
-- Datenbank ist die Prüfung erfüllt, WEIL es nichts gab — und sagt das per
-- RAISE NOTICE, denn ein Test, der nichts zu prüfen fand, ist kein bestandener.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  -- (Tabelle, Spalte) — jede Spalte trägt Text, den ein Mensch liest.
  ziele CONSTANT text[][] := ARRAY[
    ['prompt_templates', 'prompt_content'],
    ['prompt_templates', 'system_prompt'],
    ['prompt_templates', 'description'],
    ['prompt_templates', 'negative_prompt'],
    ['agents',           'character'],
    ['agents',           'background'],
    ['buildings',        'description'],
    ['zones',            'description'],
    ['cities',           'description'],
    ['simulations',      'description'],
    ['battle_log',       'narrative'],
    ['game_epochs',      'description']
  ];
  tabelle text;
  spalte  text;
  betroffen bigint;
  gesamt bigint := 0;
  uebrig bigint;
BEGIN
  FOR i IN 1 .. array_length(ziele, 1) LOOP
    tabelle := ziele[i][1];
    spalte  := ziele[i][2];

    -- Die Spalte muss es geben; eine fehlende ist ein Fehler in DIESER Liste,
    -- kein Grund, still weiterzugehen.
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tabelle AND column_name = spalte
    ) THEN
      RAISE EXCEPTION 'Migration 351: %.% gibt es nicht — die Zielliste ist veraltet', tabelle, spalte;
    END IF;

    EXECUTE format(
      'UPDATE public.%I SET %I = replace(%I, %L, %L) WHERE %I LIKE %L',
      tabelle, spalte, spalte, e'—', e'–', spalte, '%' || e'—' || '%'
    );
    GET DIAGNOSTICS betroffen = ROW_COUNT;
    gesamt := gesamt + betroffen;

    IF betroffen > 0 THEN
      RAISE NOTICE 'Migration 351: %.% — % Zeile(n) bereinigt', tabelle, spalte, betroffen;
    END IF;
  END LOOP;

  -- Wirkprobe: in keiner benannten Spalte darf noch ein U+2014 stehen.
  FOR i IN 1 .. array_length(ziele, 1) LOOP
    tabelle := ziele[i][1];
    spalte  := ziele[i][2];
    EXECUTE format(
      'SELECT count(*) FROM public.%I WHERE %I LIKE %L',
      tabelle, spalte, '%' || e'—' || '%'
    ) INTO uebrig;
    IF uebrig > 0 THEN
      RAISE EXCEPTION 'Migration 351: %.% führt noch % Zeile(n) mit U+2014', tabelle, spalte, uebrig;
    END IF;
  END LOOP;

  IF gesamt = 0 THEN
    RAISE NOTICE 'Migration 351: nichts zu bereinigen — die Wirkprobe ist damit AUSGESETZT, nicht bestanden (frische Datenbank? die Saat bringt den richtigen Strich schon mit)';
  ELSE
    RAISE NOTICE 'Migration 351: % Zeile(n) insgesamt bereinigt, keine Spalte führt mehr U+2014', gesamt;
  END IF;
END $$;

COMMIT;

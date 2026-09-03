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

-- ── prompt_templates: bewusst STATISCH und nach Reichweite getrennt ──────────
--
-- Diese vier Spalten könnten in der Schleife unten mitlaufen. Sie stehen
-- trotzdem ausgeschrieben hier, und zwar wegen eines zweiten Tores:
-- `scripts/lint-seed-carries-migration-effects.sh` spielt JEDE Anweisung der
-- Form `UPDATE … prompt_templates … WHERE simulation_id IS NULL` gegen die
-- frisch gesäte Datenbank nach und verlangt, dass danach kein Wert mehr
-- abweicht — die Saat ist der Endzustand, nicht der Anfang.
--
-- Dieses Tor sammelt per Textsuche über die Migrationsdateien. Eine
-- Normalisierung in dynamischem SQL (`EXECUTE format(...)`) sieht es NICHT.
-- Genau daran ist es beim ersten Anlauf zerbrochen: die Saat trug schon den
-- Halbgeviertstrich, die älteren Vorlagen-UPDATEs weiter den Geviertstrich,
-- und das Nachspielen hätte sechs Vorlagen wieder zurückgedreht
-- (building_generation ×2, building_generation_named ×2, portrait_description
-- ×2). Ausgeschrieben steht diese Migration in derselben Reihe wie jene — als
-- letzte — und das Nachspielen endet dort, wo die Saat steht.
--
-- Die Historie bleibt dabei unangetastet: keine bereits angewandte Migration
-- wird umgeschrieben. Die Versöhnung passiert am Ende der Kette, nicht am
-- Anfang.
--
-- Die zweite Hälfte (`IS NOT NULL`) trifft die welt-eigenen Vorlagen. Sie ist
-- absichtlich getrennt, damit das Tor die Plattform-Hälfte eindeutig erkennt.

-- Der Stand VOR den Anweisungen, damit die Schlussmeldung eine gemessene Zahl
-- nennt und keine geschaetzte: die statischen UPDATEs stehen ausserhalb des
-- DO-Blocks und koennen ihre Trefferzahl nicht selbst dorthin melden. Muster
-- wie in Migration 305.
CREATE TEMP TABLE _vorlagen_vorher ON COMMIT DROP AS
SELECT count(*) AS zeilen
  FROM public.prompt_templates
 WHERE prompt_content   LIKE '%' || e'—' || '%'
    OR system_prompt    LIKE '%' || e'—' || '%'
    OR description      LIKE '%' || e'—' || '%'
    OR negative_prompt  LIKE '%' || e'—' || '%';

UPDATE public.prompt_templates SET prompt_content = replace(prompt_content, e'—', e'–')
 WHERE simulation_id IS NULL AND prompt_content LIKE '%' || e'—' || '%';
UPDATE public.prompt_templates SET system_prompt = replace(system_prompt, e'—', e'–')
 WHERE simulation_id IS NULL AND system_prompt LIKE '%' || e'—' || '%';
UPDATE public.prompt_templates SET description = replace(description, e'—', e'–')
 WHERE simulation_id IS NULL AND description LIKE '%' || e'—' || '%';
UPDATE public.prompt_templates SET negative_prompt = replace(negative_prompt, e'—', e'–')
 WHERE simulation_id IS NULL AND negative_prompt LIKE '%' || e'—' || '%';

UPDATE public.prompt_templates SET prompt_content = replace(prompt_content, e'—', e'–')
 WHERE simulation_id IS NOT NULL AND prompt_content LIKE '%' || e'—' || '%';
UPDATE public.prompt_templates SET system_prompt = replace(system_prompt, e'—', e'–')
 WHERE simulation_id IS NOT NULL AND system_prompt LIKE '%' || e'—' || '%';
UPDATE public.prompt_templates SET description = replace(description, e'—', e'–')
 WHERE simulation_id IS NOT NULL AND description LIKE '%' || e'—' || '%';
UPDATE public.prompt_templates SET negative_prompt = replace(negative_prompt, e'—', e'–')
 WHERE simulation_id IS NOT NULL AND negative_prompt LIKE '%' || e'—' || '%';

DO $$
DECLARE
  -- (Tabelle, Spalte) — jede Spalte trägt Text, den ein Mensch liest.
  ziele CONSTANT text[][] := ARRAY[
    ['agents',           'character'],
    ['agents',           'background'],
    ['buildings',        'description'],
    ['zones',            'description'],
    ['cities',           'description'],
    ['simulations',      'description'],
    ['battle_log',       'narrative'],
    ['game_epochs',      'description']
  ];
  vorlagen_spalten CONSTANT text[] :=
    ARRAY['prompt_content', 'system_prompt', 'description', 'negative_prompt'];
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

  SELECT zeilen INTO betroffen FROM _vorlagen_vorher;
  gesamt := gesamt + betroffen;
  IF betroffen > 0 THEN
    RAISE NOTICE 'Migration 351: prompt_templates — % Zeile(n) bereinigt (Plattform und Welten)', betroffen;
  END IF;

  -- Wirkprobe: in keiner benannten Spalte darf noch ein U+2014 stehen —
  -- prompt_templates eingeschlossen, obwohl es oben statisch behandelt wurde.
  FOR i IN 1 .. array_length(vorlagen_spalten, 1) LOOP
    EXECUTE format(
      'SELECT count(*) FROM public.prompt_templates WHERE %I LIKE %L',
      vorlagen_spalten[i], '%' || e'—' || '%'
    ) INTO uebrig;
    IF uebrig > 0 THEN
      RAISE EXCEPTION 'Migration 351: prompt_templates.% fuehrt noch % Zeile(n) mit U+2014',
        vorlagen_spalten[i], uebrig;
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

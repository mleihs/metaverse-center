-- =============================================================================
-- 382: Der Geviertstrich kam durch die Hintertuer zurueck
-- =============================================================================
-- Migration 351 hat den Geviertstrich (U+2014) aus allen Vorlagen entfernt,
-- weil er Text ist, den ein Modell liest und dann selbst schreibt. Danach haben
-- DREI Migrationen neue Plattform-Vorlagen EINGEFUEGT, die ihn wieder fuehren:
--
--     359  chat_character_episode      (de, en)
--     373  chat_conversation_digest    (de, en)
--     380  chat_scene_image            (en)
--
-- 351 lief vorher, also hat es sie nie gesehen. Auf Produktion stehen sie seit
-- ihrem jeweiligen Ausrollen mit dem Strich darin, und auf einer frischen
-- Datenbank ebenso: die Reihenfolge ist dieselbe.
--
-- WER ES GEMELDET HAT, UND WARUM ERST JETZT
-- -----------------------------------------
-- `scripts/lint-seed-carries-migration-effects.sh`. Es spielt jedes
-- `UPDATE … prompt_templates … WHERE simulation_id IS NULL` aus ALLEN
-- Migrationen gegen die fertige Datenbank nach und meldet jede Zeile, die sich
-- dabei noch aendern wuerde. Genau das ist hier passiert: 351 nachgespielt
-- aendert fuenf Zeilen, also stand in fuenf Zeilen noch etwas, das 351
-- entfernen wollte.
--
-- Das Tor ist fuer eine andere Frage gebaut (traegt die Saat, was die
-- Migrationen bewirken) und hat diese hier als Nebenwirkung gefunden. Der
-- Grund ist derselbe: eine spaetere Migration kann eine fruehere aufheben, und
-- niemand merkt es, weil beide fuer sich richtig sind.
--
-- WAS DIESE MIGRATION TUT
-- -----------------------
-- Dasselbe wie 351, aber nur fuer die Plattform-Vorlagen und ohne den Umweg
-- ueber die uebrigen Tabellen: die sind seit 351 sauber und werden nicht durch
-- Vorlagen-Migrationen neu befuellt.
--
-- Sie ist absichtlich WIEDERHOLBAR. Ein `replace` auf einen Strich, den es
-- nicht mehr gibt, ist ein Nulldurchlauf; das naechste Mal, wenn jemand eine
-- Vorlage mit Strich einfuegt, faengt das Tor es wieder und diese Datei ist
-- die Vorlage fuer den Nachzug.
-- =============================================================================

-- Der Stand VOR den Anweisungen. Ohne ihn koennte die Schlussmeldung nur
-- behaupten, sie habe etwas getan — Muster wie in 305 und 351.
CREATE TEMP TABLE _strich_vorher ON COMMIT DROP AS
SELECT count(*) AS zeilen
  FROM public.prompt_templates
 WHERE simulation_id IS NULL
   AND (prompt_content   LIKE '%' || e'—' || '%'
     OR system_prompt    LIKE '%' || e'—' || '%'
     OR description      LIKE '%' || e'—' || '%'
     OR negative_prompt  LIKE '%' || e'—' || '%');

UPDATE public.prompt_templates SET prompt_content = replace(prompt_content, e'—', e'–')
 WHERE simulation_id IS NULL AND prompt_content LIKE '%' || e'—' || '%';
UPDATE public.prompt_templates SET system_prompt = replace(system_prompt, e'—', e'–')
 WHERE simulation_id IS NULL AND system_prompt LIKE '%' || e'—' || '%';
UPDATE public.prompt_templates SET description = replace(description, e'—', e'–')
 WHERE simulation_id IS NULL AND description LIKE '%' || e'—' || '%';
UPDATE public.prompt_templates SET negative_prompt = replace(negative_prompt, e'—', e'–')
 WHERE simulation_id IS NULL AND negative_prompt LIKE '%' || e'—' || '%';

DO $$
DECLARE
  v_vorher  bigint;
  v_uebrig  bigint;
  v_gesamt  bigint;
BEGIN
  SELECT zeilen INTO v_vorher FROM _strich_vorher;

  SELECT count(*) INTO v_gesamt
    FROM public.prompt_templates WHERE simulation_id IS NULL;

  SELECT count(*) INTO v_uebrig
    FROM public.prompt_templates
   WHERE simulation_id IS NULL
     AND (prompt_content   LIKE '%' || e'—' || '%'
       OR system_prompt    LIKE '%' || e'—' || '%'
       OR description      LIKE '%' || e'—' || '%'
       OR negative_prompt  LIKE '%' || e'—' || '%');

  -- Die Pruefung gilt der eigenen WIRKUNG, nicht dem Inhalt der Plattform:
  -- „nach mir traegt keine Plattform-Vorlage mehr einen Geviertstrich" ist auf
  -- jeder Datenbank wahr oder falsch, auch auf einer leeren. Eine Zusicherung
  -- auf eine bestimmte Zeilenzahl waere es nicht — die haengt davon ab, welche
  -- Migrationen vorher liefen, und hat CI schon einmal zwei Tage rot gehalten.
  IF v_uebrig <> 0 THEN
    RAISE EXCEPTION '382: % Plattform-Vorlage(n) fuehren nach dem Ersetzen noch U+2014', v_uebrig;
  END IF;

  -- Und die andere Seite: eine Pruefung, die nichts zu pruefen fand, ist keine
  -- bestandene Pruefung. Auf einer leeren Datenbank ist die Null oben trivial,
  -- und das gehoert gesagt statt verschwiegen.
  IF v_gesamt = 0 THEN
    RAISE NOTICE '382: keine Plattform-Vorlagen vorhanden — nichts zu ersetzen, nichts geprueft.';
  ELSE
    RAISE NOTICE '382: % von % Plattform-Vorlage(n) bereinigt.', v_vorher, v_gesamt;
  END IF;
END $$;

-- Migration 340: Kein Denkmodell mehr in den Listen
--
-- Entscheidung des Betreibers am 02.09.2026, auf Grundlage der
-- OpenRouter-Abrechnung: die Denkmodelle waren zu teuer fuer ihren Nutzen.
--
-- WARUM SEIN BELEG MEINEN SCHLÄGT
--
-- Ich konnte die Frage „wohin sind die 65 Einheiten gegangen" NICHT beantworten:
--
--     /api/v1/activity   403 — braucht einen Management-Key
--     ai_usage_log       deckt 10,53 von 65 ab und endet am 01.09.
--
-- Ein unvollständiges Messgerät gegen eine echte Rechnung zu stellen wäre
-- genau der Fehler, den dieses Projekt diese Woche mehrfach gemacht hat.
--
-- WAS ICH MESSEN KONNTE, UND ES STÜTZT DIE ENTSCHEIDUNG
--
--     Modell                     $/M ein   $/M aus   denkt
--     deepseek-v4-flash-0731       0,065     0,180    ja
--     deepseek-v4-pro              1,039     2,079    ja
--     deepseek-chat                0,257     1,029    NEIN
--
-- ⚠ Der STÜCKPREIS der Denkmodelle ist niedriger. Der Preis der AUFGABE nicht:
-- Denk-Token werden als Ausgabe abgerechnet, also zum teuersten Satz, und am
-- echten Depeschen-Prompt gemessen waren 219 bis 620 von 527 bis 914
-- Ausgabe-Token reines Denken — 47 bis 68 %. Man zahlt das Zwei- bis
-- Dreifache für dieselbe Antwort. Bei `model_forge` landete dieser Faktor auf
-- 2,079 $/M, dem elffachen Satz des Flash.
--
-- Dazu, schon vorher gemessen (Migration 337 und 338): bei knappem Budget
-- liefert ein Denkmodell eine 200er-Antwort mit LEEREM Inhalt. Teurer UND
-- unzuverlässiger.
--
-- WAS SICH ÄNDERT
--
--     model_default      v4-flash-0731  →  deepseek-chat
--     model_research     v4-flash-0731  →  deepseek-chat
--     model_forge        v4-pro         →  deepseek-chat
--     dieselben drei *_dev
--
-- Danach nennt KEINE Zeile in `platform_settings` mehr ein DeepSeek-V4-Modell;
-- die Selbstprüfung unten besteht genau darauf. `model_classify` und
-- `model_dispatch` standen schon auf `deepseek-chat` (337, 338) und bleiben.
--
-- ⚠ `model_forge` war das stärkste Modell im Haus. Der Wechsel ist eine
-- KOSTENENTSCHEIDUNG mit einem Fähigkeits-Abstrich beim Weltenbau. Er ist eine
-- Einstellungszeile und in Admin > Modelle ohne Deploy umkehrbar — wer ihn
-- zurücknimmt, sollte `reasoning_*` für die schweren Forge-Zwecke auf `off`
-- lassen (steht schon so) und das Token-Budget im Blick behalten.
--
-- Der Code trägt dieselben Werte in `HARDCODED_DEFAULTS`, damit ein kalter
-- Zwischenspeicher sich wie ein warmer verhält, und die Auswahlliste in
-- `AdminModelsTab.ts` bietet die beiden V4-Modelle gar nicht mehr an — sonst
-- holte „Auf Vorgaben zurücksetzen" sie durch die Hintertür zurück.

BEGIN;

UPDATE public.platform_settings
   SET setting_value = '"deepseek/deepseek-chat"'::jsonb,
       updated_at = now()
 WHERE setting_key IN (
         'model_default', 'model_default_dev',
         'model_research', 'model_research_dev',
         'model_forge', 'model_forge_dev'
       )
   AND setting_value #>> '{}' LIKE 'deepseek/deepseek-v4%';

-- ── Selbstpruefung ─────────────────────────────────────────────────────────
--
-- Nicht „sind die sechs Zeilen richtig", sondern die schaerfere Frage: nennt
-- IRGENDEINE Modellzeile noch ein V4-Denkmodell? Ein Schluessel, den ich beim
-- Aufzaehlen vergessen haette, faellt nur so auf.

DO $$
DECLARE
  rest text;
BEGIN
  SELECT string_agg(setting_key || ' = ' || (setting_value #>> '{}'), ', ')
    INTO rest
    FROM public.platform_settings
   WHERE setting_key LIKE 'model\_%'
     AND setting_value #>> '{}' LIKE 'deepseek/deepseek-v4%';

  IF rest IS NOT NULL THEN
    RAISE EXCEPTION 'Es zeigt weiterhin eine Modellzeile auf ein V4-Denkmodell: %', rest;
  END IF;
END $$;

COMMIT;

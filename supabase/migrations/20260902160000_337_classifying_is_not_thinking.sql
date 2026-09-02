-- Migration 337: Einordnen ist kein Nachdenken
--
-- Der Substrate-Scanner benutzte für seine Klassifikation `model_default`.
-- Auf Produktion steht dort `deepseek/deepseek-v4-flash-0731` — ein DENKMODELL.
-- Der erste Scan-Zyklus nach 197 Tagen lieferte deshalb 117 Signale und NULL
-- Kandidaten aus allen Nachrichtenquellen.
--
-- GEMESSEN AM 02.09.2026, direkt gegen OpenRouter:
--
--     deepseek-v4-flash-0731, EINE Überschrift
--       completion_tokens : 747
--       reasoning_tokens  : 709      ← 95 % der Ausgabe ist Nachdenken
--       content           : 38 Zeichen
--
-- Reicht das Antwortbudget nicht bis zum Ende des Denkens, kommt eine
-- 200er-Antwort mit LEEREM `content` zurück. Kein Fehler, kein abgeschnittenes
-- JSON — einfach nichts. Die Logzeile lautete „Empty content in response" und
-- klang nach einem kaputten Modell.
--
-- Dieselbe Aufgabe, zehn Überschriften:
--
--     deepseek-v4-flash-0731   ~25 s    747 Token (für EINE)   leer
--     deepseek-chat            5,8 s    329 Token (für ZEHN)   10/10 richtig
--
-- Von sechzehn DeepSeek-Modellen im Katalog denken vierzehn. `deepseek-chat`
-- ist eines der zwei, die es nicht tun.
--
-- WARUM EIN EIGENER SCHLÜSSEL UND NICHT `model_default` UMGEBOGEN
--
-- `model_default` traegt alles, was keinen eigenen Zweck hat. Ihn wegen EINER
-- Aufrufstelle zu ändern hiesse, eine Entscheidung für ein Dutzend anderer
-- mitzutreffen, ohne sie gemessen zu haben. Die grössere Frage — ob der
-- Standard ueberhaupt ein Denkmodell sein sollte — ist als eigene
-- Untersuchung aufgeschrieben (`handoff/denkmodell-als-standard-2026-09-02.md`)
-- und hier bewusst NICHT beantwortet.
--
-- Einordnen ist die Gegenprobe zum Erfinden: eine Ueberschrift kommt in eine
-- von acht Schubladen. Dafuer ist Nachdenken bezahlte Zeit ohne Gegenwert.
--
-- OHNE DIESE MIGRATION laeuft der Code trotzdem: `HARDCODED_DEFAULTS` in
-- `platform_model_config.py` traegt denselben Wert, damit ein kalter
-- Zwischenspeicher sich wie ein warmer verhaelt. Die Zeile hier macht ihn nur
-- fuer den Admin sichtbar und aenderbar — und genau darum geht es: ein Modell,
-- das nur im Code steht, ist das eine Modell, das ein Betreiber nicht wechseln
-- kann.

BEGIN;

INSERT INTO public.platform_settings (setting_key, setting_value, description)
VALUES
  ('model_classify', '"deepseek/deepseek-chat"'::jsonb,
   'Modell fuer das Einordnen von Schlagzeilen (Substrate-Scanner). MUSS ein Modell ohne Reasoning sein: ein Denkmodell verbraucht sein Antwortbudget vor der ersten Zeile Antwort. Gemessen 02.09.2026.'),
  ('model_classify_dev', '"deepseek/deepseek-chat"'::jsonb,
   'Wie model_classify, ausserhalb der Produktion.')
ON CONFLICT (setting_key) DO NOTHING;

-- ── Selbstpruefung ─────────────────────────────────────────────────────────
--
-- Eine Migration, die ihre eigene Wirkung nicht prueft, meldet Erfolg, wenn das
-- INSERT an einer Bedingung scheitert, die niemand erwartet hat.

DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n FROM public.platform_settings
   WHERE setting_key IN ('model_classify', 'model_classify_dev');
  IF n <> 2 THEN
    RAISE EXCEPTION 'Erwartet: zwei Zeilen fuer model_classify, gefunden: %', n;
  END IF;
END $$;

COMMIT;

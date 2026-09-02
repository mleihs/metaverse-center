-- Migration 338: Schreiben ist kein Nachdenken
--
-- Die Schwester von 337. Dort ging es ums Einordnen, hier ums Schreiben — und
-- beide Male war die Ursache dieselbe: `model_default` ist ein Denkmodell, und
-- das Denken wird aus demselben Antwortbudget bezahlt wie die Antwort.
--
-- DER BEFUND, an den echten Daten gemessen (02.09.2026)
--
-- 50 Bureau-Depeschen sind auf Produktion entstanden, seit der Scanner läuft:
--
--     50 Depeschen
--      7 vollständig LEER              (leerer String, nicht NULL)
--     27 mitten im Wort abgeschnitten
--     16 heil
--
-- Eine endet auf „… / DELUGE SUBTYPE / MAGN", eine auf „**NEXT REVIEW:** Upon
-- next harmonic deviation". Ein halber Satz sieht aus wie ein Stil. Genau
-- deshalb hat das niemand bemerkt: bei einer Depesche in der Stimme eines
-- Amtes ist ein abrupter Schluss keine Auffälligkeit.
--
-- DIE MESSUNG, direkt gegen OpenRouter, VIERMAL DERSELBE PROMPT
--
--     Modell                     cap   completion   davon Denken   Wörter
--     deepseek-v4-flash-0731     512          502            219      180
--     deepseek-v4-flash-0731    1024          914            620      180
--     deepseek-v4-flash-0731    1536          527            328      164
--     deepseek-chat              512          250              0      150
--
-- ⚠ Das Denken schwankt bei GLEICHEM Prompt zwischen 219 und 620 Token. Eine
-- feste Zahl kann das nicht auffangen — sie ist bei 219 verschwenderisch und
-- bei 620 zu klein. Deshalb ist die Antwort ein Modell OHNE Denken und nicht
-- ein grösseres Budget. Der Text wird dabei nicht schlechter: 171 Wörter im
-- richtigen Ton, in 250 statt 914 Token, in einem Bruchteil der Zeit.
--
-- ZWEI ZEILEN, WEIL ES ZWEI STELLEN GIBT
--
-- 1. `model_dispatch` — das Modell. Wie bei 337 ein EIGENER Schlüssel und
--    nicht `model_default` umgebogen: der Standard trägt alles, was keinen
--    eigenen Zweck hat, und ihn wegen einer Aufrufstelle zu ändern hiesse,
--    ungemessen für ein Dutzend andere mitzuentscheiden.
--
-- 2. `prompt_templates.max_tokens` für `scanner_bureau_dispatch` — das Budget.
--    Diese Zeile ist der Grund, warum die Code-Änderung ALLEIN nichts bewirkt
--    hätte: die Vorlage in der Datenbank trägt ihr eigenes `max_tokens` (512),
--    und der Aufruf zieht das dem Wert im Code vor. Der Code hätte 640 gesagt
--    und 512 bekommen. Dieselbe Familie wie der Klassifikator gestern: drei
--    Stellen einig, die vierte still anderer Meinung.
--
-- WOHER DIE 640 KOMMEN (abgeleitet, nicht gewählt)
--
-- Der Prompt verlangt 100–200 Wörter. Gemessen: 171 Wörter in 264 Token, also
-- 1,54 Token je Wort in diesem markdown-lastigen Register. Die Obergrenze des
-- Prompts von 200 Wörtern sind damit rund 310 Token; 640 ist das Doppelte,
-- damit ein Lauf, der lang gerät, seinen Satz noch zu Ende bringt. Sie ist
-- NICHT so bemessen, dass sie zusätzlich Denken bezahlt — das ist der Punkt.
--
-- OHNE DIESE MIGRATION läuft der Code: `HARDCODED_DEFAULTS` in
-- `platform_model_config.py` trägt denselben Modellwert, damit ein kalter
-- Zwischenspeicher sich wie ein warmer verhält. Das Budget aber käme weiterhin
-- aus der Vorlagen-Zeile — Punkt 2 oben ist der Teil, der ohne die Migration
-- wirklich fehlt.
--
-- Der Code prüft ab jetzt zusätzlich selbst nach: verbraucht eine Antwort ihr
-- ganzes Budget, wird sie VERWORFEN statt gespeichert, mit einer Logzeile, die
-- beide Zahlen nennt. Eine halbe Depesche ist schlechter als keine, weil man
-- ihr nicht ansieht, dass sie eine halbe ist.
--
-- Die 34 beschädigten Zeilen, die schon dastehen, rührt diese Migration NICHT
-- an. Inhalt zu löschen ist eine Entscheidung und gehört nicht in einen
-- Schema-Schritt.

BEGIN;

-- ── 1. Das Modell ──────────────────────────────────────────────────────────

INSERT INTO public.platform_settings (setting_key, setting_value, description)
VALUES
  ('model_dispatch', '"deepseek/deepseek-chat"'::jsonb,
   'Modell fuer die Bureau-Depeschen des Substrate-Scanners. MUSS ein Modell ohne Reasoning sein: ein Denkmodell verbraucht 219-620 Token desselben Budgets, bevor das erste Wort Prosa entsteht. Gemessen 02.09.2026 an 50 Depeschen (7 leer, 27 abgeschnitten).'),
  ('model_dispatch_dev', '"deepseek/deepseek-chat"'::jsonb,
   'Wie model_dispatch, ausserhalb der Produktion.')
ON CONFLICT (setting_key) DO NOTHING;

-- ── 2. Das Budget ──────────────────────────────────────────────────────────

UPDATE public.prompt_templates
   SET max_tokens = 640,
       updated_at = now()
 WHERE template_type = 'scanner_bureau_dispatch'
   AND simulation_id IS NULL
   AND max_tokens < 640;

-- ── Selbstpruefung ─────────────────────────────────────────────────────────
--
-- Eine Migration, die ihre eigene Wirkung nicht prueft, meldet Erfolg, wenn das
-- INSERT an einer Bedingung scheitert, die niemand erwartet hat.

DO $$
DECLARE
  n integer;
  budget integer;
BEGIN
  SELECT count(*) INTO n FROM public.platform_settings
   WHERE setting_key IN ('model_dispatch', 'model_dispatch_dev');
  IF n <> 2 THEN
    RAISE EXCEPTION 'Erwartet: zwei Zeilen fuer model_dispatch, gefunden: %', n;
  END IF;

  -- Die Vorlage darf fehlen (frische Datenbank vor der Saat). Sie darf nur
  -- nicht MIT einem zu kleinen Budget dastehen — das war der ganze Fehler.
  SELECT max_tokens INTO budget FROM public.prompt_templates
   WHERE template_type = 'scanner_bureau_dispatch' AND simulation_id IS NULL;
  IF budget IS NOT NULL AND budget < 640 THEN
    RAISE EXCEPTION 'scanner_bureau_dispatch traegt weiterhin max_tokens=%, erwartet >= 640', budget;
  END IF;
END $$;

COMMIT;

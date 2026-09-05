-- 385 — Ein Flux-Regler steuerte das einzige SDXL-Modell
--
-- DER BEFUND
--
-- Die Welt Velgarien traegt in `simulation_settings` zwei Schluessel:
--
--     image_guidance_scale         = '3.5'
--     image_num_inference_steps    = '28'
--
-- Das sind Flux-Werte. Sie wurden gesetzt, als die Plattform ausschliesslich
-- Flux-Modelle fuhr. Die Flux-Familie liest sie aber gar nicht — sie hat ihre
-- eigenen Schluessel (`flux_guidance`, `flux_num_inference_steps`). Gelesen
-- werden die beiden AUSSCHLIESSLICH im SD-Zweig des Aufloesers.
--
-- Solange es kein SDXL-Modell gab, war das folgenlos. Seit dem 05.09.2026 gibt
-- es die Erwachsenenspur (`datacte/proteus-v0.2`, `asiryan/juggernaut-xl-v7`),
-- und damit steuerten zwei tote Flux-Regler das einzige SDXL-Modell der
-- Plattform. Gemessen ging hinaus: `guidance_scale 3.5`, `num_inference_steps
-- 28` — waehrend die Autoren 7 bis 8 (Proteus) beziehungsweise 3 bis 6 bei 30
-- bis 40 Schritten (Juggernaut) empfehlen.
--
-- Der Code kennt die Empfehlungen jetzt (`MODEL_TUNINGS` in
-- `image_model_families.py`), aber die Welteinstellung geht ihnen vor — zu
-- Recht, denn sie ist die Entscheidung des Betreibers. Nur war hier nie eine
-- Entscheidung ueber SDXL gemeint. Also weg damit, und zwar NUR, wo der Wert
-- exakt der alte Flux-Wert ist: hat jemand bewusst etwas anderes gesetzt,
-- bleibt es stehen.
--
-- DAZU: die Szenenspur ist die einzige ohne Stilprompt
--
-- Gemessen am 05.09.2026:
--
--     scene      0 Zeichen
--     portrait   538 Zeichen
--     lore       499 Zeichen
--     banner     489 Zeichen
--     building   629 Zeichen
--
-- Jede andere Bildspur traegt auskomponierte Kameraf uehrung, die Szene nichts.
--
-- Der neue ist ABSICHTLICH kurz. Die SDXL-Spur kodiert mit CLIP und fasst 77
-- Token; ein Stilprompt von 500 Zeichen fraesse das ganze Fenster, und die
-- Bildbeschreibung — also das Bild — bliebe draussen. Ein Stilprompt, der die
-- Aussage verdraengt, ist schlimmer als keiner.
--
-- SELBSTPRUEFUNG
--
-- Geprueft wird die eigene WIRKUNG, nie der Inhalt der Plattform: auf einer
-- frischen Datenbank gibt es weder Welten noch Einstellungen, und ein Test,
-- der darauf besteht, ist auf einer leeren Datenbank unerfuellbar. Wo nichts
-- zu pruefen war, sagt die Migration es per RAISE NOTICE — eine uebersprungene
-- Pruefung ist keine bestandene.

BEGIN;

-- ── Vorher-Zustand festhalten, um die eigene Wirkung messen zu koennen ──────
CREATE TEMP TABLE _vorher_385 ON COMMIT DROP AS
SELECT simulation_id, setting_key, setting_value
  FROM public.simulation_settings
 WHERE category = 'ai'
   AND setting_key IN ('image_guidance_scale', 'image_num_inference_steps');

-- ── 1. Die toten Flux-Regler entfernen ─────────────────────────────────────
--
-- Nur exakt die alten Werte. Ein bewusst gesetzter anderer Wert bleibt.
DELETE FROM public.simulation_settings
 WHERE category = 'ai'
   AND (
        (setting_key = 'image_guidance_scale'      AND trim(both '"' from setting_value::text) IN ('3.5', '3,5'))
     OR (setting_key = 'image_num_inference_steps' AND trim(both '"' from setting_value::text) = '28')
   );

-- ── 2. Ein kurzer Stilprompt fuer die Szene ────────────────────────────────
--
-- Nur fuer Welten, die schon einen Portraet-Stilprompt haben: daran ist eine
-- eingerichtete Welt zu erkennen, ohne eine bestimmte Welt zu nennen.
INSERT INTO public.simulation_settings (simulation_id, category, setting_key, setting_value)
SELECT s.simulation_id,
       'ai',
       'image_style_prompt_scene',
       to_jsonb('cold institutional light, desaturated palette, documentary photography, film grain'::text)
  FROM public.simulation_settings s
 WHERE s.category = 'ai'
   AND s.setting_key = 'image_style_prompt_portrait'
   AND NOT EXISTS (
        SELECT 1 FROM public.simulation_settings t
         WHERE t.simulation_id = s.simulation_id
           AND t.category = 'ai'
           AND t.setting_key = 'image_style_prompt_scene'
   );

-- ── Selbstpruefung: die eigene Wirkung, mit Gegenprobe ─────────────────────
DO $$
DECLARE
  v_vorher   int;
  v_nachher  int;
  v_stil     int;
  v_welten   int;
BEGIN
  SELECT count(*) INTO v_vorher  FROM _vorher_385;
  SELECT count(*) INTO v_nachher
    FROM public.simulation_settings
   WHERE category = 'ai'
     AND setting_key IN ('image_guidance_scale', 'image_num_inference_steps')
     AND trim(both '"' from setting_value::text) IN ('3.5', '3,5', '28');

  IF v_vorher = 0 THEN
    RAISE NOTICE '385: keine Einstellungen vorhanden (frische Datenbank) — Loeschung nicht pruefbar, UEBERSPRUNGEN';
  ELSE
    IF v_nachher <> 0 THEN
      RAISE EXCEPTION '385: % Flux-Regler stehen noch im SD-Zweig — die Loeschung hat nicht gegriffen', v_nachher;
    END IF;
    RAISE NOTICE '385: % Einstellungszeilen geprueft, alle Flux-Regler entfernt', v_vorher;
  END IF;

  SELECT count(DISTINCT simulation_id) INTO v_welten
    FROM public.simulation_settings
   WHERE category = 'ai' AND setting_key = 'image_style_prompt_portrait';
  SELECT count(*) INTO v_stil
    FROM public.simulation_settings
   WHERE category = 'ai' AND setting_key = 'image_style_prompt_scene';

  IF v_welten = 0 THEN
    RAISE NOTICE '385: keine Welt mit Portraet-Stilprompt — Szenen-Stilprompt nicht pruefbar, UEBERSPRUNGEN';
  ELSIF v_stil < v_welten THEN
    RAISE EXCEPTION '385: % Welten mit Portraet-Stil, aber nur % mit Szenen-Stil', v_welten, v_stil;
  ELSE
    RAISE NOTICE '385: % Welten tragen jetzt einen Szenen-Stilprompt', v_stil;
  END IF;
END $$;

COMMIT;

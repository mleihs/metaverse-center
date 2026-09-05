-- Migration 377: die Inhaltsstufe eines Bildes
--
-- Der Nutzer stellt sie ein, und zwar frei — an und aus.
--
--     wirksam = min(Wunsch des Nutzers, Feststellung, Anfrage)
--
-- Die Stufe der WELT steht bewusst nicht in dieser Rechnung. Sie ist eine
-- VORGABE: womit ein Besucher startet, der nichts eingestellt hat. Sie
-- begrenzt ihn nicht. Eine erste Fassung machte daraus eine harte Obergrenze
-- — das war eine Bevormundung, die niemand verlangt hatte.
--
-- KEINE ALTERSFESTSTELLUNG. Eine erste Fassung dieser Migration legte dafuer
-- zwei Spalten an und berief sich auf Kalifornien SB 243, den UK Online Safety
-- Act und rund 25 US-Bundesstaaten. Das Projekt sitzt in Oesterreich, wo diese
-- Pflicht nicht besteht; der Betreiber hat entschieden, sie nicht zu fuehren.
-- Die Spalten sind deshalb wieder raus, statt als tote Felder stehenzubleiben.
--
-- Die Rechnung steht in `backend/services/image_content_policy.py`.
--

-- Siehe auch die Modellwahl: Flux 2 filtert beim Anbieter, die
-- SDXL-Abkoemmlinge tun es nicht. Zwischen den Stufen liegt deshalb nicht ein
-- Regler, sondern eine andere Modellzeile.

-- ZUR HAUSREGEL „Spalte an simulations -> active_*-View erneuern": geprueft am
-- 05.09.2026. Es gibt keine `active_simulations`. Die vier Views, die
-- `simulations` lesen — map_simulations, simulation_dashboard, v_bluesky_queue,
-- v_instagram_queue — nennen ihre Spalten alle einzeln, keine benutzt `SELECT *`.
-- Die Regel greift hier also nicht; sie steht trotzdem hier, weil der naechste
-- Leser dieselbe Frage hat und die Antwort sonst noch einmal messen muesste.

BEGIN;

-- 1. Die VORGABE der Welt: womit ein Besucher startet, der nichts eingestellt
--    hat. Keine Obergrenze — wer etwas anderes einstellt, bekommt es.
ALTER TABLE public.simulations
  ADD COLUMN IF NOT EXISTS content_rating text NOT NULL DEFAULT 'general';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'simulations_content_rating_check'
  ) THEN
    ALTER TABLE public.simulations
      ADD CONSTRAINT simulations_content_rating_check
      CHECK (content_rating IN ('general', 'mature'));
  END IF;
END $$;

COMMENT ON COLUMN public.simulations.content_rating IS
  'VORGABE der Bilddarstellung dieser Welt: general | mature. Womit ein Besucher startet, der nichts eingestellt hat. Keine Obergrenze — die Einstellung des Nutzers gewinnt.';

-- 2. Der WUNSCH des Nutzers — die einzige Groesse, die zaehlt.
--    Er gilt in BEIDE Richtungen: an und aus, auch gegen die Vorgabe der Welt.
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS image_content_preference text NOT NULL DEFAULT 'general';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_image_pref_check'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_image_pref_check
      CHECK (image_content_preference IN ('general', 'mature'));
  END IF;
END $$;

COMMENT ON COLUMN public.user_profiles.image_content_preference IS
  'Was der Nutzer sehen will: general | mature. Er stellt es frei ein, an und aus.';

-- 3. Der BLICK, aus dem ein Szenenbild entsteht.
--
--    Ein Bild hat eine Kameraposition, ein Text nicht — das ist die eine
--    Frage, die beim Uebergang von Prosa zu Bild neu dazukommt. Drei
--    Antworten sind sinnvoll:
--
--        human   Der Blick des Lesers. Immer stimmig, nie allwissend.
--        agent   Der Blick einer Figur. Was sie nicht wahrnehmen konnte,
--                gehoert nicht ins Bild — `agent_recent_focalization` sagt es.
--        wide    Die Totale, ein Erzaehlerblick. Im TEXT ist das die
--                Fokalisierungsstufe null und ein Fehler; im BILD ist sie
--                legitim, weil ein Bild keinen Erzaehler vortaeuscht.
--
--    Als Einstellung und nicht als Konstante im Code: welcher Blick zu einer
--    Welt passt, weiss der Architekt und nicht dieses Repository.
ALTER TABLE public.simulations
  ADD COLUMN IF NOT EXISTS scene_image_vantage text NOT NULL DEFAULT 'human';

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS scene_image_vantage text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'simulations_vantage_check') THEN
    ALTER TABLE public.simulations ADD CONSTRAINT simulations_vantage_check
      CHECK (scene_image_vantage IN ('human', 'agent', 'wide'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_vantage_check') THEN
    ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_vantage_check
      CHECK (scene_image_vantage IS NULL OR scene_image_vantage IN ('human', 'agent', 'wide'));
  END IF;
END $$;

COMMENT ON COLUMN public.simulations.scene_image_vantage IS
  'VORGABE fuer den Blick eines Szenenbildes: human | agent | wide. Womit ein Besucher startet, der nichts gewaehlt hat.';
COMMENT ON COLUMN public.user_profiles.scene_image_vantage IS
  'Eigene Wahl des Blicks. NULL heisst: die Vorgabe der Welt gilt. Kein Minimum, keine Rangfolge — hier gibt es kein schaedlicheres und kein harmloseres Ergebnis, nur einen Geschmack.';

-- 4. Die zweite Modellspur. Getrennte Schluessel und nicht ein Suffix an den
--    bestehenden: die Spuren sind verschiedene Modellfamilien mit
--    verschiedenen Parametern (siehe image_model_families.py), keine zwei
--    Einstellungen desselben Modells.
INSERT INTO platform_settings (setting_key, setting_value, description)
VALUES
  ('image_models_mature', '{}'::jsonb,
   'Modelle je Zweck fuer die Erwachsenenstufe, als {"agent_portrait": "...", "scene": "..."}. Leer heisst: die Stufe ist nicht eingerichtet und faellt auf die jugendfreie Spur zurueck.'),
  ('image_safety_tolerance_general', '2'::jsonb,
   'safety_tolerance fuer die jugendfreie Spur, 1 (streng) bis 6 (offen). Bis 05.09.2026 stand hier fest verdrahtet die 5 — eine Zahl, die niemand waehlen konnte.'),
  ('image_safety_tolerance_mature', '5'::jsonb,
   'safety_tolerance fuer die Erwachsenenstufe. Gilt nur, wenn Welt UND Konto die Stufe tragen.')
ON CONFLICT (setting_key) DO NOTHING;

-- 4. Selbstpruefung: gegen die eigene WIRKUNG, nicht gegen Plattforminhalt.
DO $$
DECLARE
  v_spalten int;
  v_schluessel int;
  v_offen int;
BEGIN
  SELECT count(*) INTO v_spalten FROM information_schema.columns
   WHERE (table_name = 'simulations' AND column_name IN ('content_rating', 'scene_image_vantage'))
      OR (table_name = 'user_profiles' AND column_name IN ('image_content_preference', 'scene_image_vantage'));
  IF v_spalten <> 4 THEN
    RAISE EXCEPTION 'Migration 377: erwartet 4 Spalten, gefunden %', v_spalten;
  END IF;

  -- Und die Gegenprobe: die Spalten der zurueckgenommenen Altersfeststellung
  -- duerfen NICHT dastehen. Ein Feld, das niemand fuellt, sieht spaeter aus
  -- wie eine vergessene Pflicht.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'user_profiles'
       AND column_name IN ('adult_verified_at', 'adult_verified_method')
  ) THEN
    RAISE EXCEPTION 'Migration 377: Spalten der Altersfeststellung sind noch da';
  END IF;

  SELECT count(*) INTO v_schluessel FROM platform_settings
   WHERE setting_key IN ('image_models_mature', 'image_safety_tolerance_general', 'image_safety_tolerance_mature');
  IF v_schluessel <> 3 THEN
    RAISE EXCEPTION 'Migration 377: erwartet 3 Einstellungen, gefunden %', v_schluessel;
  END IF;

  -- Wie viele Konten haben eine eigene Wahl getroffen? Beim ersten Lauf
  -- keines — alle stehen auf der Vorgabe. Die Zahl ist der Ausgangswert, gegen
  -- den man spaeter sieht, ob die Einstellung ueberhaupt gefunden wird.
  SELECT count(*) INTO v_offen FROM public.user_profiles
   WHERE image_content_preference <> 'general';
  RAISE NOTICE 'Migration 377: % Konten haben Erwachsenendarstellung eingeschaltet.', v_offen;
END $$;

COMMIT;

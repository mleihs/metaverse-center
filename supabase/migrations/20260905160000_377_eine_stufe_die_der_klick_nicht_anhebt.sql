-- Migration 377: die Inhaltsstufe eines Bildes
--
-- Ein Schalter im Verfasser waere die falsche Bauform. Die Stufe haengt nicht
-- am Klick, sondern an der WELT — eine Simulation hat einen Ton, und der gilt
-- fuer alles darin. Und sie braucht eine Obergrenze, die der Klick nicht
-- anheben kann: die des Nutzers.
--
--     wirksam = min(Stufe der Welt, Stufe des Nutzers, angefragte Stufe)
--
-- Das Minimum, nicht das Maximum. Die Rechnung steht in
-- `backend/services/image_content_policy.py`; hier stehen nur die zwei Werte,
-- aus denen sie gebildet wird.
--
-- WAS DIESE MIGRATION NICHT TUT: sie stellt die Volljaehrigkeit nicht fest.
-- `adult_verified_at` ist ein Zeitstempel, den ein Pruefverfahren setzt, kein
-- Haekchen, das ein Nutzer selbst umlegt. Solange es kein Verfahren gibt,
-- bleibt die Spalte NULL und die Erwachsenenstufe unerreichbar — was der
-- richtige Zustand ist. Kalifornien SB 243 (seit 01.01.2026), New York, Oregon
-- SB 1546 und der UK Online Safety Act verlangen sie; `Free Speech Coalition
-- v. Paxton` (Juni 2025) haelt Alterspruefungen fuer zulaessig.
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

-- 1. Die Stufe der Welt. Vorgabe jugendfrei — eine Vorgabe, die sich irrt,
--    soll in die harmlose Richtung irren.
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
  'Obergrenze der Bilddarstellung dieser Welt: general | mature. Der Klick eines Nutzers kann sie nicht anheben, nur unterschreiten.';

-- 2. Die Feststellung am Konto. NULL heisst „nicht festgestellt", nicht
--    „minderjaehrig" — der Unterschied zaehlt, wenn spaeter ein Verfahren
--    dazukommt und wissen muss, wen es noch nie gefragt hat.
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS adult_verified_at timestamptz;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS adult_verified_method text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_adult_method_check'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_adult_method_check
      CHECK (
        adult_verified_method IS NULL
        OR adult_verified_method IN ('platform_admin', 'document', 'estimation', 'third_party')
      );
  END IF;
END $$;

-- 2b. Der WUNSCH des Nutzers. Getrennt von der Feststellung, weil es zwei
--     verschiedene Dinge sind: `adult_verified_at` sagt, was jemand DARF, und
--     diese Spalte sagt, was er WILL. Wer volljaehrig ist und trotzdem keine
--     Erwachsenendarstellung moechte, stellt sie hier ab — und die Rechnung
--     nimmt das Minimum, also gewinnt der Wunsch gegen die Erlaubnis.
--
--     Umgekehrt gilt es nicht: dieser Wert kann keine Stufe anheben, die Welt
--     oder Feststellung nicht hergeben. Deshalb steht er in derselben
--     Minimum-Rechnung und nicht daneben.
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
  'Was der Nutzer sehen MOECHTE: general | mature. Kann die Stufe nur senken, nie anheben — die Rechnung nimmt das Minimum aus Welt, Feststellung, Wunsch und Anfrage.';

COMMENT ON COLUMN public.user_profiles.adult_verified_at IS
  'Wann die Volljaehrigkeit FESTGESTELLT wurde. NULL heisst nicht festgestellt. Kein selbst gesetztes Haekchen.';
COMMENT ON COLUMN public.user_profiles.adult_verified_method IS
  'Womit festgestellt wurde. Ohne dieses Feld waere der Zeitstempel eine Behauptung ohne Herkunft.';

-- 3. Die zweite Modellspur. Getrennte Schluessel und nicht ein Suffix an den
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
   WHERE (table_name = 'simulations' AND column_name = 'content_rating')
      OR (table_name = 'user_profiles'
          AND column_name IN ('adult_verified_at', 'adult_verified_method', 'image_content_preference'));
  IF v_spalten <> 4 THEN
    RAISE EXCEPTION 'Migration 377: erwartet 4 Spalten, gefunden %', v_spalten;
  END IF;

  SELECT count(*) INTO v_schluessel FROM platform_settings
   WHERE setting_key IN ('image_models_mature', 'image_safety_tolerance_general', 'image_safety_tolerance_mature');
  IF v_schluessel <> 3 THEN
    RAISE EXCEPTION 'Migration 377: erwartet 3 Einstellungen, gefunden %', v_schluessel;
  END IF;

  -- Der Zustand, den diese Migration herstellt und der der richtige ist:
  -- niemand ist als volljaehrig festgestellt, also ist die Erwachsenenstufe
  -- fuer niemanden erreichbar, bis es ein Verfahren gibt.
  SELECT count(*) INTO v_offen FROM public.user_profiles WHERE adult_verified_at IS NOT NULL;
  IF v_offen > 0 THEN
    RAISE NOTICE 'Migration 377: % Konten tragen bereits eine Feststellung.', v_offen;
  ELSE
    RAISE NOTICE 'Migration 377: keine Feststellung vorhanden — die Erwachsenenstufe ist noch fuer niemanden erreichbar. Das ist Absicht.';
  END IF;
END $$;

COMMIT;

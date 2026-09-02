-- Migration 347: Ein Abonnement ist der Ort, an dem der Ort einmal entschieden wird
--
-- Lücke 6 aus `handoff/schleuse-event-intake.md`, die letzte offene.
--
-- ── WARUM DAS ABO DEN WIDERSPRUCH DER STAPEL-VERWANDLUNG AUFLÖST ────────────
--
-- Die Stapel-Verwandlung („Alle → ②") setzt bewusst KEINE Linse. Begründung
-- dort: die Linse trägt den ORT, an dem ein Ereignis in der Welt eintritt, und
-- zehn Ereignisse in eine Zone zu legen, weil sie die erste in der Liste war,
-- ist keine Voreinstellung, sondern eine Entscheidung, die niemand gesehen hat.
--
-- Ein Abonnement ist genau die Stelle, an der ein Mensch diese Entscheidung
-- EINMAL trifft, sichtbar und widerrufbar: „alles, was nach Erdbeben aussieht,
-- gehört in den Hafen von Speranza". Was danach automatisch hereinkommt, trägt
-- eine Linse, die ein Mensch gesetzt hat — nicht eine, die ein Programm geraten
-- hat.
--
-- 🔑 Der Unterschied zwischen einer Voreinstellung und einer Entscheidung ist
-- nicht, ob ein Mensch sie trifft, sondern ob er sie SIEHT.
--
-- ── WAS DIESE MIGRATION NICHT ANLEGT ────────────────────────────────────────
--
-- Der Bauplan sagt: „Cron füllt Eingang mit vortransformierter Abo-Linse."
-- **Es wird nichts vortransformiert und kein Cron angelegt.** Ein Zeitgeber,
-- der von selbst Modellaufrufe auslöst, kostet Geld ohne Klick — und am
-- 02.09.2026 wurde auf Prod die gesamte autonome KI-Schicht abgeschaltet, weil
-- das OpenRouter-Konto leer war. Eine neue automatische Ausgabenquelle
-- anzulegen, während die anderen still stehen, wäre grob unaufmerksam.
--
-- Das Abo entscheidet deshalb nur, WAS in den Eingang kommt und mit welcher
-- Linse. Verwandelt wird weiterhin, wenn ein Mensch es auslöst.
--
-- ── DIE FELDER ──────────────────────────────────────────────────────────────
--
-- `source_category`  eine der acht Kategorien, oder NULL für „alle".
-- `min_magnitude`    Untergrenze; 0 heisst „auch das Leiseste".
-- `zone_id`          der Ort der Linse. Darf NULL sein: dann sagt das Abo nur,
--                    WAS hereinkommt, und der Ort bleibt eine Entscheidung je
--                    Stück — dieselbe Ehrlichkeit wie beim Stapel.
-- `vector`           der Vektor der Linse, ebenfalls optional.
-- `is_active`        ein Abo abzuschalten muss möglich sein, ohne es zu
--                    verlieren — sonst löscht man es und baut es neu, und die
--                    Frage „was habe ich damals abonniert" ist unbeantwortbar.

BEGIN;

CREATE TABLE IF NOT EXISTS public.intake_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_id uuid NOT NULL REFERENCES public.simulations(id) ON DELETE CASCADE,
  label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 120),
  source_category text
    CHECK (source_category IS NULL OR source_category IN (
      'economic_crisis', 'military_conflict', 'pandemic', 'natural_disaster',
      'political_upheaval', 'tech_breakthrough', 'cultural_shift',
      'environmental_disaster'
    )),
  min_magnitude numeric(3, 2) NOT NULL DEFAULT 0 CHECK (min_magnitude >= 0 AND min_magnitude <= 1),
  zone_id uuid REFERENCES public.zones(id) ON DELETE SET NULL,
  vector text,
  is_active boolean NOT NULL DEFAULT true,
  created_by_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.intake_subscriptions IS
  'Die Abonnements der Schleuse: was ohne Nachfrage in den Eingang einer Welt gehoert, und mit welcher Linse. Migration 347. Es wird NICHTS automatisch verwandelt — ein Abo entscheidet die Auswahl, nicht die Ausgabe.';
COMMENT ON COLUMN public.intake_subscriptions.zone_id IS
  'Der Ort der Abo-Linse. NULL heisst: das Abo sagt nur, WAS hereinkommt; der Ort bleibt eine Entscheidung je Stueck.';

CREATE INDEX IF NOT EXISTS idx_intake_subscriptions_sim
  ON public.intake_subscriptions (simulation_id)
  WHERE is_active;

ALTER TABLE public.intake_subscriptions ENABLE ROW LEVEL SECURITY;

-- Lesen darf, wer die Welt sehen darf; schreiben nur, wer sie bearbeiten darf.
-- Die Hilfsfunktionen stehen in `(SELECT …)` — ohne den Wrapper wertet Postgres
-- sie PRO ZEILE aus statt einmal je Anweisung (Migration 183).
CREATE POLICY "Member read intake subscriptions"
  ON public.intake_subscriptions FOR SELECT
  TO authenticated
  USING ((SELECT user_has_simulation_access(simulation_id)));

CREATE POLICY "Editor insert intake subscriptions"
  ON public.intake_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT user_has_simulation_role(simulation_id, 'editor')));

CREATE POLICY "Editor update intake subscriptions"
  ON public.intake_subscriptions FOR UPDATE
  TO authenticated
  USING ((SELECT user_has_simulation_role(simulation_id, 'editor')));

CREATE POLICY "Editor delete intake subscriptions"
  ON public.intake_subscriptions FOR DELETE
  TO authenticated
  USING ((SELECT user_has_simulation_role(simulation_id, 'editor')));

-- ── Selbstpruefung ─────────────────────────────────────────────────────────
--
-- Geprueft wird die WIRKUNG: Tabelle da, RLS an, vier Regeln. Eine Migration,
-- die eine Tabelle anlegt und die Regeln vergisst, legt eine offene Tabelle an
-- — und das faellt erst auf, wenn jemand fremde Abos liest.

DO $$
DECLARE
  rls boolean;
  regeln integer;
BEGIN
  SELECT relrowsecurity INTO rls FROM pg_class WHERE relname = 'intake_subscriptions';
  IF rls IS NOT TRUE THEN
    RAISE EXCEPTION 'intake_subscriptions steht ohne Row Level Security da';
  END IF;

  SELECT count(*) INTO regeln FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'intake_subscriptions';
  IF regeln <> 4 THEN
    RAISE EXCEPTION 'Erwartet: vier RLS-Regeln fuer intake_subscriptions, gefunden: %', regeln;
  END IF;
END $$;

COMMIT;

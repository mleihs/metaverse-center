-- Migration 334: Eine Meldung braucht einen Ort, an dem sie ankommt
--
-- Schritt 4 aus `handoff/schleuse-event-intake.md` (Backend-Lücke 1). Die
-- Schleuse gibt dem Architekten einen Weg, den er bisher nicht hatte: er kann
-- ein Signal DEM BUREAU MELDEN, statt es selbst zu einem Ereignis zu machen.
-- Das ist die eine Handlung, die seine Welt verlässt — er entscheidet nicht,
-- er legt vor.
--
-- WARUM DAS EINE MIGRATION BRAUCHT UND NICHT NUR EINEN ENDPUNKT
--
-- `news_scan_candidates.status` trägt seit Migration 084 eine CHECK-Bedingung
-- über vier Werte: `pending`, `approved`, `rejected`, `created`. „Gemeldet" ist
-- keiner davon. Das Frontend bildet `flagged` bereits auf eine Stufe der
-- Schleuse ab (`types/intake.ts`, `stageOfCandidate`) — auf einen Zustand
-- also, den die Datenbank heute zurückweist. Ein Zweig, der nie erreicht
-- werden kann, ist kein Zweig; ohne diese Migration wäre der Melden-Knopf eine
-- Tür, hinter der nichts liegt.
--
-- WARUM DIE MELDUNG ZWEI ZUSÄTZLICHE SPALTEN BEKOMMT
--
--   * `flag_reason` — eine Meldung ohne Begründung ist eine Zahl in einer
--     Warteschlange. Der Admin, der sie später liest, sieht sonst dieselbe
--     Schlagzeile wie der Scanner und weiss nicht, WARUM ein Mensch sie
--     hervorgeholt hat.
--   * `flagged_by_simulation_id` — aus WELCHER Welt die Meldung kommt. Das ist
--     nicht Buchführung, sondern die Rückrichtung: der Architekt sieht sein
--     gemeldetes Signal in Kammer ③ seiner eigenen Schleuse wieder
--     (`◈ gemeldet`), und ohne diese Spalte wäre nicht zu sagen, welche
--     Meldung wem gehört.
--
-- `reviewed_by_id` trägt bereits die Person und wird von der Meldung
-- mitgesetzt; eine zweite Spalte dafür wäre eine zweite Wahrheit.
--
-- SCHREIBRECHT: unverändert. `news_scan_candidates` ist seit Migration 215
-- `service_role`-only zum Schreiben (`candidates_service_role_only`),
-- `authenticated` liest. Die Meldung eines Architekten geht deshalb durch das
-- Backend, das VORHER die Mitgliedschaft in der Welt prüft
-- (`backend/routers/intake.py`) und ERST DANN mit dem Admin-Client schreibt —
-- das dokumentierte Muster, nicht eine Ausnahme davon.

BEGIN;

-- ── 1. Die Bedingung, die „gemeldet" bisher verbot ─────────────────────────
--
-- Der Name einer INLINE geschriebenen CHECK-Bedingung wird von PostgreSQL
-- vergeben (`<tabelle>_<spalte>_check`). Sich darauf zu VERLASSEN wäre die
-- halbe Bedingung: griffe das DROP daneben, liefe das ADD durch, es stünden
-- ZWEI Bedingungen auf derselben Spalte, und `flagged` bliebe verboten —
-- ohne dass irgendetwas fehlschlägt. Deshalb wird die Bedingung gesucht, nicht
-- geraten.

DO $$
DECLARE
  con record;
BEGIN
  FOR con IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.news_scan_candidates'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.news_scan_candidates DROP CONSTRAINT %I', con.conname);
  END LOOP;
END $$;

ALTER TABLE public.news_scan_candidates
  ADD CONSTRAINT news_scan_candidates_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'created', 'flagged'));

-- ── 2. Was eine Meldung mitbringt ──────────────────────────────────────────

ALTER TABLE public.news_scan_candidates
  ADD COLUMN IF NOT EXISTS flag_reason TEXT,
  ADD COLUMN IF NOT EXISTS flagged_by_simulation_id UUID
    REFERENCES public.simulations(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.news_scan_candidates.flag_reason IS
  'Warum ein Architekt dieses Signal dem Bureau vorgelegt hat. Freitext, nur bei status=''flagged''.';
COMMENT ON COLUMN public.news_scan_candidates.flagged_by_simulation_id IS
  'Aus welcher Welt die Meldung kam. Traegt die Rueckrichtung: der Architekt sieht sie in Kammer 3 seiner eigenen Schleuse wieder.';

-- Die Meldungen des Bureaus sind eine eigene Warteschlange und werden nach
-- Herkunftswelt gelesen. Ohne diesen Index ist beides ein Seq Scan ueber
-- alle Kandidaten.
CREATE INDEX IF NOT EXISTS idx_candidates_flagged
  ON public.news_scan_candidates (flagged_by_simulation_id, created_at DESC)
  WHERE status = 'flagged';

-- ── 3. Selbstpruefung ──────────────────────────────────────────────────────
--
-- Eine Migration, die ihre eigene Wirkung nicht prueft, meldet Erfolg, wenn
-- der DO-Block oben nichts gefunden hat. Genau dieser Fall waere still.

DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n
  FROM pg_constraint
  WHERE conrelid = 'public.news_scan_candidates'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%status%';
  IF n <> 1 THEN
    RAISE EXCEPTION 'Erwartet: genau eine status-CHECK-Bedingung, gefunden: %', n;
  END IF;

  SELECT count(*) INTO n
  FROM pg_constraint
  WHERE conrelid = 'public.news_scan_candidates'::regclass
    AND conname = 'news_scan_candidates_status_check'
    AND pg_get_constraintdef(oid) LIKE '%flagged%';
  IF n <> 1 THEN
    RAISE EXCEPTION 'Die status-Bedingung laesst ''flagged'' nicht zu.';
  END IF;
END $$;

COMMIT;

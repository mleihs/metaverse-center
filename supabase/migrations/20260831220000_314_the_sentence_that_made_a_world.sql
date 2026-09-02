-- ============================================================================
-- Migration 314 — Der Satz, aus dem eine Welt wurde, darf gezeigt werden
-- ============================================================================
--
-- BEFUND
-- ------
-- Der Schmiede-Abschnitt der Frontseite tippt Beispielsätze. Bis zum
-- 31.08.2026 standen zwanzig davon fest im Bauteil: gut geschrieben und
-- trotzdem erfunden. Gemessen liegen auf Prod **26 echte Ausgangssätze** in
-- `forge_drafts.seed_prompt`, 16 davon aus abgeschlossenen Läufen — die
-- tatsächlichen Sätze, aus denen die tatsächlichen Welten wurden.
--
-- Der Nutzer hat am 31.08.2026 entschieden, dass sie gezeigt werden dürfen.
--
-- WARUM EINE SICHT UND KEINE POLICY AUF DER TABELLE
-- --------------------------------------------------
-- `forge_drafts` trägt weit mehr als den Satz: `user_id`, die Zwischenstände
-- jeder Phase (`taxonomies`, `geography`, `agents`, `buildings`), die
-- KI-Einstellungen und das Fehlerprotokoll. Eine anon-Policy auf der TABELLE
-- gäbe eine Zeile frei, und wer eine Zeile hat, hat jede Spalte darin —
-- PostgREST lässt den Aufrufer die Spaltenliste wählen.
--
-- Diese Sicht gibt genau EINE Spalte heraus und sonst nichts. Kein `id`, kein
-- `user_id`, keine Zwischenstände, kein Zeitstempel (der ließe sich mit
-- anderen öffentlichen Zeiten zu einer Person zurückrechnen). Wer sie abfragt,
-- kann nur Sätze bekommen.
--
-- ⚠ SIE LÄUFT ABSICHTLICH MIT DEN RECHTEN IHRES BESITZERS
-- `security_invoker` bleibt aus (Vorgabe). Nur so kommt der anon-Aufrufer an
-- Zeilen, deren Tabelle ihm verschlossen ist — und genau das ist der Zweck.
-- Der Unterschied zur Regel aus ADR-006 (keine SECURITY-DEFINER-Funktionen an
-- anon) ist die Angriffsfläche: eine Funktion nimmt Parameter und kann in
-- fremden Zeilen wirken; diese Sicht nimmt nichts entgegen und hat keine
-- zweite Spalte, über die etwas herausliefe.
--
-- WELCHE SÄTZE
-- ------------
-- Nur `status='completed'`: ein Entwurf, der nie fertig wurde, ist ein
-- Zwischenstand, kein Werk. Nur nicht-leere. Die Längenwahl trifft die
-- Oberfläche, nicht die Sicht — was hier herauskommt, ist der Bestand, nicht
-- eine Auswahl fürs Schaufenster.
-- ============================================================================

BEGIN;

CREATE OR REPLACE VIEW public.public_forge_prompts AS
SELECT d.seed_prompt
  FROM public.forge_drafts d
 WHERE d.status = 'completed'
   AND COALESCE(btrim(d.seed_prompt), '') <> '';

COMMENT ON VIEW public.public_forge_prompts IS
  'Nur der Ausgangssatz abgeschlossener Forge-Läufe, für den Schmiede-Abschnitt '
  'der Frontseite. EINE Spalte, mit Absicht: forge_drafts trägt user_id, alle '
  'Zwischenstände und das Fehlerprotokoll, und wer eine Zeile hat, hat jede '
  'Spalte darin. Läuft mit den Rechten des Besitzers (security_invoker aus) — '
  'anders käme der anon-Aufrufer nicht an Zeilen, deren Tabelle ihm verschlossen '
  'ist. Migration 314.';

-- Lesen ja, mehr nicht. Kein INSERT/UPDATE/DELETE, auch nicht versehentlich
-- über ein späteres Standardrecht.
REVOKE ALL ON public.public_forge_prompts FROM PUBLIC;
REVOKE ALL ON public.public_forge_prompts FROM anon, authenticated;
GRANT SELECT ON public.public_forge_prompts TO anon, authenticated;

-- ── Abnahme: die Sicht beweist ihre eigene Enge ────────────────────────────
DO $$
DECLARE
  spalten     INT;
  saetze      INT;
  unfertige   INT;
  quelle      INT;
  darf_lesen  BOOLEAN;
  darf_mehr   BOOLEAN;
BEGIN
  SELECT count(*) INTO spalten
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'public_forge_prompts';

  SELECT count(*) INTO saetze FROM public.public_forge_prompts;

  -- Wieviel QUELLE es ueberhaupt gibt. Ohne diese Zahl ist "null Saetze" nicht
  -- von "null fertige Entwuerfe" zu unterscheiden.
  SELECT count(*) INTO quelle
    FROM public.forge_drafts d
   WHERE d.status = 'completed' AND d.seed_prompt IS NOT NULL AND btrim(d.seed_prompt) <> '';

  -- Kein unfertiger Entwurf darf durchkommen.
  SELECT count(*) INTO unfertige
    FROM public.public_forge_prompts p
    JOIN public.forge_drafts d ON d.seed_prompt = p.seed_prompt
   WHERE d.status <> 'completed'
     AND NOT EXISTS (SELECT 1 FROM public.forge_drafts x
                      WHERE x.seed_prompt = p.seed_prompt AND x.status = 'completed');

  SELECT has_table_privilege('anon', 'public.public_forge_prompts', 'SELECT') INTO darf_lesen;
  SELECT has_table_privilege('anon', 'public.public_forge_prompts', 'INSERT')
      OR has_table_privilege('anon', 'public.public_forge_prompts', 'UPDATE')
      OR has_table_privilege('anon', 'public.public_forge_prompts', 'DELETE') INTO darf_mehr;

  IF spalten <> 1 THEN
    RAISE EXCEPTION 'Migration 314: die Sicht hat % Spalten, erlaubt ist genau eine', spalten;
  END IF;
  -- NACHTRAG 02.09.2026: die Bedingung war "null Saetze", und das ist eine
  -- Aussage ueber den BESTAND, nicht ueber die Wirkung dieser Migration.
  --
  -- Auf einer frischen Datenbank gibt es keine fertigen Entwuerfe — die Saat
  -- laeuft nach den Migrationen. Die Abnahme brach dort ab und riss den ganzen
  -- CI-Lauf mit. Vierter Fall derselben Bauart nach 299, 305 und 311.
  --
  -- Was die Migration wirklich zusichern will: die Sicht reicht durch, was
  -- durchgereicht werden soll. Das ist jetzt genau die Bedingung — gibt es
  -- Quelle, muss die Sicht sie zeigen; gibt es keine, sagt die Migration das
  -- und laeuft weiter. Die vier uebrigen Zusicherungen (eine Spalte, kein
  -- unfertiger Entwurf, anon liest, anon darf sonst nichts) sind strukturell
  -- und gelten auf jeder Datenbank unveraendert.
  IF quelle = 0 THEN
    RAISE NOTICE 'Migration 314: kein fertiger Entwurf vorhanden — Mengenprobe ausgesetzt (frische Datenbank?)';
  ELSIF saetze = 0 THEN
    RAISE EXCEPTION 'Migration 314: % fertige Entwuerfe, aber die Sicht liefert null Saetze', quelle;
  END IF;
  IF unfertige > 0 THEN
    RAISE EXCEPTION 'Migration 314: % unfertige Entwürfe kommen durch', unfertige;
  END IF;
  IF NOT darf_lesen THEN
    RAISE EXCEPTION 'Migration 314: anon darf nicht lesen — dann ist die Sicht wirkungslos';
  END IF;
  IF darf_mehr THEN
    RAISE EXCEPTION 'Migration 314: anon darf mehr als lesen';
  END IF;

  RAISE NOTICE 'Migration 314 abgenommen: eine Spalte, % Sätze, anon liest und sonst nichts.', saetze;
END $$;

COMMIT;

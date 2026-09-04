-- ============================================================================
-- 328 — Ein Satz darf erfahren, welche Welt aus ihm wurde
-- ============================================================================
--
-- WARUM
--   Die Frontseite zeigt zwei Abschnitte uebereinander: „Sie erinnern sich"
--   mit drei Buergern, und darunter den Schmiede-Abschnitt, durch den die
--   echten Ausgangssaetze laufen. Beide sind wahr und haben nichts miteinander
--   zu tun — der Satz, der gerade durchlaeuft, und die Gesichter darueber
--   stammen aus verschiedenen Welten.
--
--   Der Grund steht in Migration 319, von mir selbst notiert:
--
--       „`simulations` kein `forge_draft_id`. Es gibt keinen Weg zurueck."
--
--   In KEINE Richtung: der Entwurf weiss nicht, welche Welt aus ihm wurde, und
--   die Welt weiss nicht, aus welchem Satz sie kam.
--
-- WAS DIE ZUORDNUNG TRAEGT
--   `forge_drafts.agents` ist ein jsonb-Feld mit den Agenten, die der Lauf
--   entworfen hat, jeder mit Namen. Ein Agentenname ist in Velgarien praktisch
--   eindeutig — auf Prod gemessen, nicht angenommen:
--
--       16 abgeschlossene Entwuerfe mit Ausgangssatz
--       16 davon tragen Agenten
--       13 lassen sich ueber die Namen einer Welt zuordnen
--       13 von 13 treffen GENAU EINE Welt, mit 100 % ihrer Treffer darin
--
--   Keine Mehrdeutigkeit, kein Schiedsspruch noetig. Die drei uebrigen sind
--   Laeufe, deren Agenten es nicht in eine lebende Welt geschafft haben; sie
--   bleiben NULL, und die Frontseite behandelt NULL als „kein Zusammenhang"
--   statt als Fehler.
--
--   ⚠ Die Zuordnung ist eine REKONSTRUKTION, keine Aufzeichnung. Sie gilt fuer
--   den Bestand von heute. Damit die naechste Welt nicht wieder geraten werden
--   muss, gehoert die Spalte beim Materialisieren gesetzt — das ist Sache des
--   Orchestrators und in derselben Auslieferung mitgeliefert.
--
-- DER SATZ GEHOERT ZUR WELT, NICHT ZUM ENTWURF
--   `forge_drafts` ist ein Arbeitsstand. Er kann aufgeraeumt werden, und dann
--   waere der Satz weg, aus dem die Welt wurde — die Welt haette ihre Herkunft
--   verloren, obwohl sie selbst weiterlebt. Deshalb bekommt `simulations` den
--   Satz als eigene Spalte: nicht als Verweis, sondern als Kopie.
--
--   Eine Kopie und kein Fremdschluessel ist hier die richtige Wahl, weil das
--   Kopierte ein HISTORISCHER Wert ist. Der Ausgangssatz einer Welt aendert
--   sich nicht mehr; er ist das, was jemand geschrieben hat, bevor es die Welt
--   gab. Ein Verweis wuerde eine Beziehung behaupten, die es nach dem Lauf
--   nicht mehr gibt — dieselbe Ueberlegung wie bei den materialisierten
--   Lore-Feldern.
--
--   ⚠ WAS DAS OEFFENTLICH MACHT, UND WAS SICH DAMIT AENDERT
--   Migration 314 veroeffentlichte die Ausgangssaetze ANONYM: eine Spalte,
--   ohne Bezug zu Welt oder Verfasser, eine Liste von Saetzen. Am Weltobjekt
--   ist derselbe Satz ZUORDENBAR — er haengt an einer benannten Welt, und die
--   hat einen Architekten. Das ist eine echte Erweiterung gegenueber 314 und
--   keine Formalie; sie wurde am 31.08.2026 ausdruecklich verlangt — der
--   erzeugende Prompt einer Welt soll erhalten bleiben. Die Korrelation auf
--   der Frontseite ist ohne sie nicht
--   moeglich. Hier notiert, damit die Entscheidung sichtbar bleibt statt
--   irgendwann als Nebenwirkung entdeckt zu werden.
--
-- WAS DIE SICHT HERAUSGIBT
--   Bis heute genau eine Spalte, und der Kommentar dort sagt warum:
--   `forge_drafts` traegt `user_id`, alle Zwischenstaende und das
--   Fehlerprotokoll. Diese Migration macht daraus ZWEI Spalten. Die zweite ist
--   eine simulation_id, und die ist ohnehin oeffentlich — die gesamte
--   Architektur ist public-first, jede Welt ist ohne Anmeldung lesbar. Was
--   NICHT dazukommt: user_id, Zwischenstaende, Fehlerprotokoll. Die Enge der
--   Sicht ist der Zweck, nicht ihre Spaltenzahl.
-- ============================================================================

BEGIN;

-- ── 1. Die Spalte ──────────────────────────────────────────────────────────
ALTER TABLE public.forge_drafts
  ADD COLUMN IF NOT EXISTS simulation_id uuid
    REFERENCES public.simulations(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.forge_drafts.simulation_id IS
  'Die Welt, die aus diesem Entwurf wurde. NULL heisst „unbekannt" und nicht '
  '„keine": fuer Laeufe vor Migration 328 ist der Wert rekonstruiert (ueber '
  'die Agentennamen), und drei von 16 liessen sich nicht zuordnen. Neue Laeufe '
  'setzen ihn beim Materialisieren.';

-- ── 2. Rueckfuellung ueber die Agentennamen ────────────────────────────────
-- Nur wo die Zuordnung EINDEUTIG ist. Ein Entwurf, dessen Namen auf zwei
-- Welten zeigen, bleibt lieber leer als falsch — die Frontseite zeigt dann
-- keinen Zusammenhang, und das ist die ehrliche Anzeige.
WITH entwurf AS (
  SELECT d.id,
         (SELECT array_agg(x->>'name')
            FROM jsonb_array_elements(COALESCE(d.agents, '[]'::jsonb)) x
           WHERE COALESCE(btrim(x->>'name'), '') <> '') AS namen
    FROM public.forge_drafts d
   WHERE d.simulation_id IS NULL
),
treffer AS (
  SELECT e.id, a.simulation_id, count(*) AS n
    FROM entwurf e
    JOIN public.agents a ON a.name = ANY(e.namen)
   WHERE e.namen IS NOT NULL
   GROUP BY e.id, a.simulation_id
),
eindeutig AS (
  -- (array_agg(DISTINCT …))[1] statt min(): Postgres kennt kein min(uuid),
  -- und das HAVING garantiert ohnehin genau einen Wert je Gruppe.
  SELECT id, (array_agg(DISTINCT simulation_id))[1] AS simulation_id
    FROM treffer
   GROUP BY id
  HAVING count(DISTINCT simulation_id) = 1
)
UPDATE public.forge_drafts d
   SET simulation_id = e.simulation_id
  FROM eindeutig e
 WHERE d.id = e.id;

-- ── 2b. Die Welt behaelt ihren Ausgangssatz ────────────────────────────────
ALTER TABLE public.simulations
  ADD COLUMN IF NOT EXISTS origin_prompt text;

COMMENT ON COLUMN public.simulations.origin_prompt IS
  'Der Satz, aus dem diese Welt entstand — kopiert aus forge_drafts.seed_prompt '
  'beim Materialisieren. Kopie und nicht Verweis: ein Entwurf ist ein '
  'Arbeitsstand und kann aufgeraeumt werden, die Herkunft der Welt soll das '
  'ueberleben. NULL heisst „nicht bekannt" (Welt aelter als Migration 328 und '
  'nicht rekonstruierbar), nie „ohne Satz entstanden". Migration 328.';

UPDATE public.simulations s
   SET origin_prompt = d.seed_prompt
  FROM public.forge_drafts d
 WHERE d.simulation_id = s.id
   AND s.origin_prompt IS NULL
   AND COALESCE(btrim(d.seed_prompt), '') <> '';

-- ── 2c. Und die Anker, die sie NICHT geworden ist ──────────────────────────
--
-- Der Astrolab-Schritt legt dem Architekten mehrere philosophische Anker vor;
-- er waehlt einen. Migration 319 hat den GEWAEHLTEN an die Welt geschrieben —
-- gemessen: 8 Welten tragen ihn. Die uebrigen Vorschlaege blieben im Entwurf,
-- und auf Prod sind das im Schnitt DREI je Lauf, also zwei nicht gegangene
-- Wege pro Welt.
--
-- Die gehoeren zur Welt. Nicht als Verwaltungsdatum, sondern weil eine Welt,
-- die weiss, was sie haette werden koennen, mehr ueber sich sagt als eine, die
-- nur ihr Ergebnis kennt. Und praktisch: wer den Astrolab-Schritt spaeter
-- aendert, kann ohne diese Zeilen nicht nachsehen, wie die Auswahl frueher
-- aussah.
--
-- Gespeichert wird die ganze Liste, einschliesslich des gewaehlten Ankers. Die
-- Alternativen ohne ihn waeren die Haelfte einer Auswahl: man saehe, was
-- verworfen wurde, aber nicht, wogegen.
ALTER TABLE public.simulations
  ADD COLUMN IF NOT EXISTS anchor_choices jsonb;

COMMENT ON COLUMN public.simulations.anchor_choices IS
  'Alle philosophischen Anker, die dem Architekten im Astrolab-Schritt '
  'vorlagen — einschliesslich des gewaehlten, der zusaetzlich flach in '
  'philosophical_anchor steht (Migration 319). NULL heisst „nicht bekannt", '
  'nicht „ohne Auswahl entstanden". Migration 328.';

UPDATE public.simulations s
   SET anchor_choices = d.philosophical_anchor->'options'
  FROM public.forge_drafts d
 WHERE d.simulation_id = s.id
   AND s.anchor_choices IS NULL
   AND jsonb_typeof(d.philosophical_anchor->'options') = 'array'
   AND jsonb_array_length(d.philosophical_anchor->'options') > 0;

-- ⚠ Die Sicht `active_simulations` liest SELECT * und loest ihre Spalten beim
-- ANLEGEN auf, nicht beim Abfragen — eine neue Spalte in `simulations` ist
-- dort unsichtbar, bis die Sicht neu geschrieben wird. Steht so in CLAUDE.md
-- und hat hier schon einmal Zeit gekostet.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname='public' AND viewname='active_simulations') THEN
    EXECUTE 'CREATE OR REPLACE VIEW public.active_simulations AS
             SELECT * FROM public.simulations WHERE deleted_at IS NULL';
  END IF;
END $$;

-- ── 3. Die Sicht darf die Welt nennen ──────────────────────────────────────
CREATE OR REPLACE VIEW public.public_forge_prompts AS
SELECT d.seed_prompt,
       d.simulation_id
  FROM public.forge_drafts d
 WHERE d.status = 'completed'
   AND COALESCE(btrim(d.seed_prompt), '') <> '';

COMMENT ON VIEW public.public_forge_prompts IS
  'Der Ausgangssatz abgeschlossener Forge-Laeufe und die Welt, die daraus '
  'wurde — fuer den Schmiede-Abschnitt der Frontseite, dessen Buergerfaecher '
  'jetzt zum durchlaufenden Satz gehoert. ZWEI Spalten, mit Absicht: '
  'forge_drafts traegt user_id, alle Zwischenstaende und das Fehlerprotokoll, '
  'und wer eine Zeile hat, hat jede Spalte darin. Eine simulation_id ist '
  'ohnehin oeffentlich (public-first). Laeuft mit den Rechten des Besitzers '
  '(security_invoker aus). Migrationen 314 und 328.';

REVOKE ALL ON public.public_forge_prompts FROM PUBLIC;
REVOKE ALL ON public.public_forge_prompts FROM anon, authenticated;
GRANT SELECT ON public.public_forge_prompts TO anon, authenticated;

-- ── 4. Abnahme ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  spalten      INT;
  saetze       INT;
  mit_welt     INT;
  mehrdeutig   INT;
BEGIN
  SELECT count(*) INTO spalten
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'public_forge_prompts';
  IF spalten <> 2 THEN
    RAISE EXCEPTION 'Die Sicht soll GENAU zwei Spalten geben, hat %', spalten;
  END IF;

  SELECT count(*), count(simulation_id) INTO saetze, mit_welt
    FROM public.public_forge_prompts;

  -- Die Eindeutigkeit, auf die die Rueckfuellung sich beruft, hier nachweisen
  -- statt behaupten: kein Entwurf darf nach dem Lauf auf zwei Welten zeigen.
  SELECT count(*) INTO mehrdeutig
    FROM (
      SELECT d.id
        FROM public.forge_drafts d
        JOIN public.agents a
          ON a.name IN (
               SELECT x->>'name'
                 FROM jsonb_array_elements(COALESCE(d.agents, '[]'::jsonb)) x
             )
       WHERE d.simulation_id IS NOT NULL
       GROUP BY d.id
      HAVING count(DISTINCT a.simulation_id) > 1
    ) q;
  IF mehrdeutig > 0 THEN
    RAISE EXCEPTION 'Zuordnung mehrdeutig bei % Entwuerfen', mehrdeutig;
  END IF;

  -- Und die Welten, die ihren Satz jetzt selbst tragen.
  DECLARE welten INT; sichtbar INT;
  BEGIN
    SELECT count(*) INTO welten FROM public.simulations WHERE origin_prompt IS NOT NULL;
    SELECT count(*) INTO sichtbar
      FROM information_schema.columns
     WHERE table_schema='public' AND table_name='active_simulations'
       AND column_name='origin_prompt';
    IF sichtbar <> 1 THEN
      RAISE EXCEPTION 'active_simulations kennt origin_prompt nicht — Sicht nicht erneuert';
    END IF;
    SELECT count(*) INTO sichtbar
      FROM information_schema.columns
     WHERE table_schema='public' AND table_name='active_simulations'
       AND column_name='anchor_choices';
    IF sichtbar <> 1 THEN
      RAISE EXCEPTION 'active_simulations kennt anchor_choices nicht — Sicht nicht erneuert';
    END IF;
    RAISE NOTICE 'Migration 328: % Saetze, davon % mit Welt, 0 mehrdeutig, % Welten mit Ausgangssatz.',
      saetze, mit_welt, welten;
  END;
END $$;

COMMIT;

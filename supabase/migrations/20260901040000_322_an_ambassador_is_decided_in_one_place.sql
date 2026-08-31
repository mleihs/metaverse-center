-- ============================================================================
-- Migration 322 — Wer ein Botschafter ist, wird an EINER Stelle entschieden
-- ============================================================================
--
-- BEFUND
-- ------
-- Die Frage „ist dieser Agent ein Botschafter?" wird an zwei Stellen
-- beantwortet, und beide schreiben dieselbe Regel aus:
--
--     fn_compute_agent_influence     (SQL, Migration 304)   speist die Einflusszahl
--     AgentService._enrich_ambassador_flag  (Python)        speist das Abzeichen
--
-- Migration 304 sagt es in ihrem eigenen Kopf: „Die Python-Seite löst die
-- Identität in derselben Reihenfolge auf. Diese beiden müssen übereinstimmen."
-- Das ist kein Fehler, sondern eine Verabredung — und eine Verabredung zwischen
-- zwei Kopien ist genau so lange gültig, wie beide jemand gleichzeitig ändert.
--
-- Der Anlass, sie aufzulösen: der Entwurf vom 31.08.2026 verlangt für den
-- Agenten-Reiter einen Filter „Botschafter". Ein Filter braucht die Antwort in
-- SQL (sonst zählt die Seitenzahl etwas anderes als die Liste), also wäre eine
-- DRITTE Kopie entstanden. Drei Kopien einer Regel, die übereinstimmen müssen,
-- stimmen irgendwann nicht mehr überein.
--
-- DIE REGEL SELBST, unverändert übernommen (Migration 304):
-- Kennung zuerst, Name nur ersatzweise. Auf Prod gemessen: 40 Botschaften, 37
-- mit `ambassador_a`-Block, davon 37 mit Namen und nur 9 mit `agent_id`. Der
-- Name hält heute und nur deshalb, weil zufällig kein Name doppelt vorkommt —
-- er hört geräuschlos auf zu halten, sobald zwei Agenten denselben tragen.
--
-- WAS SICH NICHT ÄNDERT — GEMESSEN, NICHT BEHAUPTET
-- Vor dem Schreiben gegen Prod gerechnet, die ALTE Regel wortgleich gegen die
-- neue Sicht gestellt:
--
--     alte Regel findet   14 Paare
--     Sicht findet        14 Paare
--     nur alt / nur neu    0 / 0
--
-- ZWEI UNTERSCHIEDE GIBT ES TROTZDEM, und beide sind heute wirkungslos:
--
--   (a) Der alte Block vergleicht `e.simulation_a_id = p_simulation_id`, also
--       die ÜBERGEBENE Welt; die Sicht vergleicht `a.simulation_id`, also die
--       EIGENE Welt des Agenten. Beide Aufrufer übergeben die eigene Welt
--       (`fn_agent_influence_batch` ist welt-gebunden, die Bau-Bereitschaft in
--       Migration 158 nimmt `bar.simulation_id`), also fallen sie zusammen. Die
--       Sicht ist dabei die engere Fassung: sie kann einen Agenten nicht zum
--       Botschafter einer fremden Welt machen, nur weil dort jemand seinen
--       Namen trägt.
--   (b) Die Sicht filtert `deleted_at IS NULL`, der alte Block nicht. Auf Prod
--       gibt es derzeit 0 gelöschte Agenten, die Menge ändert sich also nicht —
--       aber ein gelöschter Agent sollte keine Einflusszahl aus einem Amt
--       ziehen, das er nicht mehr innehat.
--
-- `backend/tests/unit/test_ambassador_identity.py` und
-- `test_agent_influence_enrichment.py` binden beide Seiten und bleiben grün.
--
-- WARUM EINE SICHT UND KEINE FUNKTION
-- Eine Funktion beantwortet die Frage für EINEN Agenten; der Filter braucht sie
-- für eine Menge. Eine Sicht liefert beides — der EXISTS-Block unten fragt eine
-- Zeile ab, der Router filtert über die ganze Menge, und der Planer darf beides
-- als Join behandeln statt als 258 Einzelaufrufe.
--
-- ⚠ SIE LÄUFT MIT DEN RECHTEN IHRES BESITZERS (`security_invoker` bleibt aus,
-- wie bei allen `active_*`-Sichten). Sie gibt zwei Spalten heraus,
-- `simulation_id` und `agent_id`, die beide über die öffentliche Leseflaeche
-- ohnehin sichtbar sind — kein Botschafts-Wörterbuch, kein Name, kein
-- Zeitstempel. Wer sie abfragt, kann nur Paare bekommen.
--
-- ANGEWANDT AUF PROD: nein (Stand 31.08.2026)
-- ============================================================================


-- ============================================================
-- 1. Die eine Stelle
-- ============================================================

CREATE OR REPLACE VIEW public.active_ambassadors AS
SELECT DISTINCT
    a.simulation_id,
    a.id AS agent_id
FROM public.agents a
JOIN public.embassies e
  ON e.status = 'active'
 AND (
      (e.simulation_a_id = a.simulation_id
       AND (
         e.embassy_metadata->'ambassador_a'->>'agent_id' = a.id::text
         OR (
           e.embassy_metadata->'ambassador_a'->>'agent_id' IS NULL
           AND e.embassy_metadata->'ambassador_a'->>'name' = a.name
         )
       ))
      OR
      (e.simulation_b_id = a.simulation_id
       AND (
         e.embassy_metadata->'ambassador_b'->>'agent_id' = a.id::text
         OR (
           e.embassy_metadata->'ambassador_b'->>'agent_id' IS NULL
           AND e.embassy_metadata->'ambassador_b'->>'name' = a.name
         )
       ))
     )
WHERE a.deleted_at IS NULL
  AND (a.ambassador_blocked_until IS NULL OR a.ambassador_blocked_until < now());

COMMENT ON VIEW public.active_ambassadors IS
  'Welcher Agent in welcher Welt gerade Botschafter ist — die EINE Stelle, an '
  'der diese Frage beantwortet wird. Kennung zuerst, Name nur ersatzweise (ein '
  'Name ist keine Identitaet; siehe Migration 304). Gesperrte Botschafter sind '
  'nicht enthalten. Gelesen von fn_compute_agent_influence und von '
  'AgentService._enrich_ambassador_flag; vor Migration 322 stand die Regel in '
  'beiden ausgeschrieben.';

GRANT SELECT ON public.active_ambassadors TO anon, authenticated, service_role;


-- ============================================================
-- 2. Die Einflusszahl liest die Sicht, statt die Regel zu wiederholen
-- ============================================================
--
-- Wortgleiche Uebernahme aus Migration 304, mit genau einer geaenderten Stelle:
-- der ausgeschriebene EXISTS-Block wird zur Abfrage auf die Sicht. Die
-- Beziehungs- und Professions-Anteile bleiben unberuehrt.

CREATE OR REPLACE FUNCTION public.fn_compute_agent_influence(
  p_agent_id uuid,
  p_simulation_id uuid
)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT
    -- Relationship component: top 5 by intensity, avg / 10
    COALESCE((
      SELECT AVG(sub.intensity)::numeric / 10.0
      FROM (
        SELECT ar.intensity
        FROM public.agent_relationships ar
        WHERE (ar.source_agent_id = p_agent_id OR ar.target_agent_id = p_agent_id)
          AND ar.simulation_id = p_simulation_id
        ORDER BY ar.intensity DESC
        LIMIT 5
      ) sub
    ), 0.0) * 0.4

    -- Profession component: avg qualification / 10 (scoped to THIS simulation)
    + COALESCE((
      SELECT AVG(ap.qualification_level)::numeric / 10.0
      FROM public.agent_professions ap
      WHERE ap.agent_id = p_agent_id
        AND ap.simulation_id = p_simulation_id
    ), 0.0) * 0.3

    -- Ambassador component: 1.0 if an active, unblocked ambassador, else 0.0.
    --
    -- The resolution itself now lives in `active_ambassadors` (section 1) and
    -- is read here rather than repeated. Before migration 322 the id-or-name
    -- rule stood written out twice — once here and once in Python — and the
    -- header of migration 304 says in so many words that the two must agree.
    -- Two copies of a rule that must agree are one copy too many; the filter
    -- this migration also enables would have made it three.
    + CASE WHEN EXISTS(
      SELECT 1 FROM public.active_ambassadors amb
      WHERE amb.simulation_id = p_simulation_id
        AND amb.agent_id = p_agent_id
    ) THEN 1.0 ELSE 0.0 END * 0.3
$function$;


COMMENT ON FUNCTION public.fn_compute_agent_influence(uuid, uuid) IS
  'Einflusszahl eines Agenten: Beziehungen 0,4 + Professionen 0,3 + '
  'Botschafteramt 0,3. Das Botschafteramt kommt seit Migration 322 aus der '
  'Sicht active_ambassadors — davor stand die Identitaetsaufloesung hier und '
  'in Python ausgeschrieben, und Migration 304 verlangte ausdruecklich, dass '
  'die beiden uebereinstimmen.';


-- ============================================================
-- 3. Nachweis, dass die Sicht dasselbe findet wie die ALTE Regel
-- ============================================================
--
-- ⚠ Die erste Fassung dieses Abschnitts verglich die Sicht gegen eine von Hand
-- abgeschriebene Kopie DERSELBEN Regel — sie hätte bestanden, ganz gleich was
-- die Umstellung tut. Ein Nachweis, der die neue Regel gegen sich selbst
-- stellt, weist nichts nach.
--
-- Unten steht deshalb die Regel, wie sie im Rumpf von Migration 304 STAND:
-- `agents` über den Parameter gejoint, Vergleich gegen die übergebene Welt,
-- ohne `deleted_at`-Filter — ausgewertet für jeden Agenten mit seiner eigenen
-- Welt, weil beide Aufrufer sie so übergeben.

DO $$
DECLARE
    v_nur_alt int;
    v_nur_neu int;
    v_anzahl  int;
BEGIN
    WITH alt AS (
        SELECT ag.id AS agent_id, ag.simulation_id
        FROM public.agents ag
        WHERE EXISTS (
            SELECT 1
            FROM public.embassies e
            JOIN public.agents a ON a.id = ag.id
            WHERE e.status = 'active'
              AND (
                (e.simulation_a_id = ag.simulation_id AND (
                   e.embassy_metadata->'ambassador_a'->>'agent_id' = a.id::text
                   OR (e.embassy_metadata->'ambassador_a'->>'agent_id' IS NULL
                       AND e.embassy_metadata->'ambassador_a'->>'name' = a.name)))
                OR
                (e.simulation_b_id = ag.simulation_id AND (
                   e.embassy_metadata->'ambassador_b'->>'agent_id' = a.id::text
                   OR (e.embassy_metadata->'ambassador_b'->>'agent_id' IS NULL
                       AND e.embassy_metadata->'ambassador_b'->>'name' = a.name)))
              )
              AND (a.ambassador_blocked_until IS NULL OR a.ambassador_blocked_until < now())
        )
    )
    SELECT
        (SELECT count(*) FROM (SELECT agent_id, simulation_id FROM alt
                               EXCEPT
                               SELECT agent_id, simulation_id FROM public.active_ambassadors) d1),
        (SELECT count(*) FROM (SELECT agent_id, simulation_id FROM public.active_ambassadors
                               EXCEPT
                               SELECT agent_id, simulation_id FROM alt) d2),
        (SELECT count(*) FROM public.active_ambassadors)
    INTO v_nur_alt, v_nur_neu, v_anzahl;

    IF v_nur_alt <> 0 OR v_nur_neu <> 0 THEN
        RAISE EXCEPTION
          'Migration 322: die Sicht findet nicht dasselbe wie die alte Regel — nur alt: %, nur neu: %',
          v_nur_alt, v_nur_neu;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'fn_compute_agent_influence'
          AND prosrc LIKE '%active_ambassadors%'
    ) THEN
        RAISE EXCEPTION 'Migration 322: die Einflusszahl liest die Sicht nicht';
    END IF;

    RAISE NOTICE '322 ok — % Botschafter-Paare, deckungsgleich mit der alten Regel, eine Stelle', v_anzahl;
END;
$$;

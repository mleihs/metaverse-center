-- ============================================================================
-- Migration 304 — Ein Botschafter wurde am Namen erkannt
-- ============================================================================
--
-- BEFUND (D12 / S16)
-- ------------------
-- `fn_compute_agent_influence` entscheidet, ob ein Agent Botschafter ist, indem
-- es den NAMEN des Agenten mit einem Namen im Botschafts-Wörterbuch vergleicht:
--
--     e.embassy_metadata->'ambassador_a'->>'name' = a.name
--
-- Ein Name ist keine Identität. Gemessen auf Prod am 31.08.2026:
--
--     40 Botschaften, alle aktiv
--     37 tragen einen `ambassador_a`-Block
--     davon mit `name`:      37
--     davon mit `agent_id`:   9
--     davon mit `id`:         0
--     mehrdeutige Agentennamen je Welt: 0
--
-- Der Vergleich funktioniert also HEUTE — und zwar nur, weil zufällig kein
-- Name doppelt vorkommt. Er hört in dem Moment auf zu funktionieren, in dem
-- zwei Agenten denselben Namen tragen oder einer umbenannt wird, und zwar
-- geräuschlos: ein Name, der nicht mehr passt, sieht genau aus wie ein Agent,
-- der kein Botschafter ist. Der Botschafteranteil ist 0,3 von 1,0 der
-- Einflusszahl — ein Drittel, das ohne Meldung verschwindet.
--
-- Und ein Viertel der Botschaften trägt die verlässliche Angabe bereits:
-- neun von 37 haben `agent_id` im selben Block stehen. Die Funktion hat sie
-- ignoriert.
--
-- WAS DIESE MIGRATION TUT
-- -----------------------
-- Der Vergleich geht zuerst über `agent_id`, dann über den Namen. Beide, nicht
-- eines: nur die id zu nehmen ließe 28 der 37 Botschaften fallen, nur den Namen
-- ist der heutige Zustand. Der Rückfall verschwindet von selbst, sobald die
-- Schmiede die id überall mitschreibt — bis dahin ist er die Wahrheit über den
-- Bestand, nicht eine Bequemlichkeit.
--
-- KEINE Verhaltensänderung auf dem heutigen Bestand: die neun Botschaften mit
-- `agent_id` treffen über die id dieselben Agenten, die sie über den Namen
-- schon trafen (0 mehrdeutige Namen). Was sich ändert, ist die Haltbarkeit.
--
-- Die Python-Seite (`AgentService._enrich_ambassador_flag`) löst die Identität
-- in derselben Reihenfolge auf. Die beiden MÜSSEN übereinstimmen: die eine
-- speist die Einflusszahl, die andere das Abzeichen auf der Karte, und ein
-- Agent, der auf der Karte Botschafter ist und in der Zahl nicht, ist
-- schlimmer als beides falsch.
--
-- Signatur unverändert `(uuid, uuid) RETURNS numeric`, STABLE, SECURITY
-- INVOKER. `fn_agent_influence_batch` (Migration 300) ruft diese Funktion und
-- bleibt unangetastet.
--
-- NICHT Teil dieser Migration
-- ---------------------------
-- Der zweite Teil von D12 — `embassy_ambassador_quality` in
-- `mv_embassy_effectiveness` speist bis zu 0,2 von 1,0 aus der ZEICHENLÄNGE
-- des Botschafternamens (`length(name_a) + length(name_b)) / 50`). Ein
-- Botschafter namens „Bartholomew Featherstonehaugh" ist dort diplomatisch
-- wirksamer als einer namens „Li Wei". Gemessen: die naheliegende Reparatur
-- (Anwesenheit statt Länge, 0,1 je Name, gleicher Deckel) ergibt auf **allen
-- 40 Botschaften exakt denselben Wert** — die Änderung wäre heute wirkungslos
-- und würde nur die Absurdität entfernen.
--
-- Sie steht trotzdem nicht hier, weil `mv_embassy_effectiveness` eine
-- MATERIALISIERTE Sicht mit drei Indizes ist, an der `mv_simulation_health`
-- hängt: sie zu ändern heißt, zwei Sichten und ihre Indizes neu zu bauen. Eine
-- wirkungslose Änderung ist der schlechteste Anlass für einen Eingriff dieser
-- Größe. Gemeldet, mit der Messung, zur Entscheidung.
-- ============================================================================

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

    -- Ambassador component: 1.0 if active ambassador (not blocked), else 0.0.
    -- Identity first, name second. See the header: 9 of 37 embassies already
    -- carry agent_id and were ignored; the name works today only because no
    -- two agents in a simulation share one.
    + CASE WHEN EXISTS(
      SELECT 1
      FROM public.embassies e
      JOIN public.agents a ON a.id = p_agent_id
      WHERE e.status = 'active'
        AND (
          (e.simulation_a_id = p_simulation_id
           AND (
             e.embassy_metadata->'ambassador_a'->>'agent_id' = a.id::text
             OR (
               e.embassy_metadata->'ambassador_a'->>'agent_id' IS NULL
               AND e.embassy_metadata->'ambassador_a'->>'name' = a.name
             )
           ))
          OR
          (e.simulation_b_id = p_simulation_id
           AND (
             e.embassy_metadata->'ambassador_b'->>'agent_id' = a.id::text
             OR (
               e.embassy_metadata->'ambassador_b'->>'agent_id' IS NULL
               AND e.embassy_metadata->'ambassador_b'->>'name' = a.name
             )
           ))
        )
        AND (a.ambassador_blocked_until IS NULL OR a.ambassador_blocked_until < now())
    ) THEN 1.0 ELSE 0.0 END * 0.3
$function$;

COMMENT ON FUNCTION public.fn_compute_agent_influence(uuid, uuid) IS
  'Einflusszahl eines Agenten: Beziehungen 0,4 + Professionen 0,3 + '
  'Botschafteramt 0,3. Der Botschafter wird seit Migration 304 zuerst über '
  'embassy_metadata->…->>''agent_id'' erkannt und nur ersatzweise über den '
  'Namen — ein Name ist keine Identität und der Vergleich hielt nur, solange '
  'kein Name doppelt vorkam. Die Python-Seite '
  '(AgentService._enrich_ambassador_flag) löst in derselben Reihenfolge auf.';

REVOKE ALL ON FUNCTION public.fn_compute_agent_influence(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_compute_agent_influence(uuid, uuid) TO authenticated, service_role;

-- ── Abnahme ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'fn_compute_agent_influence';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'Migration 304: fn_compute_agent_influence fehlt';
  END IF;

  -- Beide Wege müssen im Körper stehen. Nur die id wäre ein Rückschritt für
  -- 28 von 37 Botschaften, nur der Name der Ausgangszustand.
  IF position('''agent_id''' in v_def) = 0 THEN
    RAISE EXCEPTION 'Migration 304: der Botschafter wird nicht über agent_id erkannt';
  END IF;
  IF position('''name''' in v_def) = 0 THEN
    RAISE EXCEPTION 'Migration 304: der Namens-Rückfall fehlt — 28 von 37 Botschaften haben keine id';
  END IF;

  -- Und die Batch-Funktion aus Migration 300 muss weiter auflösen.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'fn_agent_influence_batch'
  ) THEN
    RAISE WARNING 'Migration 304: fn_agent_influence_batch fehlt — Migration 300 ist nicht angewandt';
  END IF;
END;
$$;

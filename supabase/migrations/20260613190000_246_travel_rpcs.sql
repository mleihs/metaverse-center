-- Migration 246: DRIFT — travel_rpcs (P0a run-lifecycle RPC family + tuning)
--
-- Spec: docs/plans/drift-implementation-plan.md §4 (RPC catalog + CAS + the
--       two grant classes), §2 (Zahlenwerk), §6 (run lifecycle), §16.1 (P0a race
--       set), §5 (ADR-006 grant posture).
--
-- The first GAME-LOGIC migration: the rules engine for the minimal playable loop
-- "open a run → move across the chart → complete / abandon". All five RPCs are the
-- §16.1 P0a race set. Survey (P0b), quests/effects (P0c) and cargo/dock RPCs are
-- separate later slices. Behind drift_p0_enabled=false (the gate is read by the
-- backend before calling these — the RPCs themselves stay callable for tests).
--
-- ── drift_tuning (so the Zahlenwerk is DATA, not hardcoded plpgsql) ────────────
-- §2 is the DRIFT Zahlenwerk. The SQL RPCs need those scalars server-side, so this
-- table is their DB home — hand-seeded here for P0a. NOTE: the drift content-pack
-- pipeline (a content/drift/ pack + a domain-aware generate_migration, plan §9.1)
-- is NOT built yet; until it lands, THIS migration is the single source of truth for
-- these values — do not introduce a second one. Reading from a table (not literals
-- in the function body) satisfies the "never hardcode mappings that should be
-- configurable" rule. Public read (admin Drift tab, read-only); service_role write.
--
-- ── Grant model (§4/§5) ───────────────────────────────────────────────────────
-- All five are SECURITY DEFINER (they bypass the travel_runs RLS to write the run,
-- after validating ownership). Two classes:
--   * PLAYER-class (run_open/move/complete/abandon): GRANT EXECUTE to authenticated;
--     the FIRST statement validates (SELECT auth.uid()) = p_user — called with the
--     user's JWT (auth.uid() = the player), never trusted from the p_user param.
--   * BACKEND-class (drift_emergency_return): REVOKE from anon + authenticated
--     explicitly (the 245 lesson — REVOKE FROM PUBLIC alone leaves Supabase's
--     direct default grants), GRANT service_role only — the admin kill-switch.
-- Every mutating RPC calls travel_audit(...) in-transaction; every RPC that
-- touches travel_runs carries p_run_version and raises RUN_STALE on mismatch.
-- RUN_STALE uses ERRCODE P0001, NOT 40001: PostgREST auto-retries
-- serialization_failure (40001), which would hang a *deterministic* CAS miss in an
-- endless retry. P0001 returns cleanly; the backend maps the 'RUN_STALE' message to
-- HTTP 409. (Found via the HTTP-layer test — the in-DB smoke can't see PostgREST.)
--
-- P0 simplifications (documented, wired fuller later): the off-vector frequency
-- multiplier uses the affinity-band table from tuning but not yet the per-edge
-- low-permeability ×3 case; Notfrequenz is allowed on any adjacent edge at the
-- KH cost (the "known-edge only" restriction needs the discovery layer, P0b); the
-- §19.4 KH=0 failure floor ships forced-return-home, with cargo→echo scatter deferred
-- to P0c (it needs the effect family); Entladung/cargo redemption on complete is P0c.
-- Each is marked inline.


-- ═══════════════════════════════════════════════════════════════════
-- 1. drift_tuning — the DB projection of content/drift/tuning.yaml (§2)
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS drift_tuning (
    setting_key  TEXT PRIMARY KEY,
    value        JSONB NOT NULL,
    description  TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_drift_tuning_updated_at
    BEFORE UPDATE ON drift_tuning
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE drift_tuning ENABLE ROW LEVEL SECURITY;
CREATE POLICY drift_tuning_public_select
    ON drift_tuning FOR SELECT TO anon, authenticated USING (TRUE);
CREATE POLICY drift_tuning_service_role
    ON drift_tuning FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

COMMENT ON TABLE drift_tuning IS
    'DB home for the DRIFT Zahlenwerk (plan §2). The SQL RPCs read launch defaults from here so game constants are DATA, not literals in function bodies. Hand-seeded for P0a; the drift content-pack pipeline (plan §9.1) is not built yet, so this migration is the source of truth until it lands. Public read (admin Drift tab, read-only); service_role write.';

INSERT INTO drift_tuning (setting_key, value, description) VALUES
    ('bandwidth_class_bb_max', '{"1": 6, "2": 10, "3": 14, "4": 18}'::jsonb,
        'Bandbreite (fuel) max per class (§2.4). P0 class I is deliberately tight — even the minimal round trip dips into Notfrequenz, and route ORDER (cheap corridor before expensive deep) decides whether the full-survey run survives.'),
    ('window_base', '6'::jsonb, 'Aufenthaltsfenster in Takte (§2.6): moves before recall. Tuned so the full-survey Hamiltonian path just fits (knife-edge), while the safe deep round-trip keeps margin — pushing for the full haul is the gamble.'),
    ('kh_start', '100'::jsonb, 'Kohärenz (integrity) at run open (§2.1).'),
    ('dz_p0_cap', '20'::jsonb, 'Hard cap on Dissonanz; above dz_kh_bleed.threshold it erodes Kohärenz (the rising-threat teeth).'),
    ('notfreq_kh_per_edge', '20'::jsonb, 'Kohärenz cost per edge under Notfrequenz (Bandbreite exhausted, §2.3).'),
    ('freq_offvector_mult', '{"on": 1, "aff_0_1": 2, "aff_2_3": 1.5, "aff_4_5": 1.25}'::jsonb,
        'Frequency cost multiplier: on-vector vs off-vector by affinity band (§2.2).'),
    ('dz_per_move_by_band', '{"near": 1, "mid": 2, "deep": 3}'::jsonb,
        'Dissonanz gained per Drift move by the target node distance band (§2.1).'),
    ('survey_value_by_band', '{"near": 0, "mid": 2, "deep": 3}'::jsonb,
        'Vermessung (haul) for first arrival at a node, by distance band. Banked on Entladung, lost on recall.'),
    ('foreign_dock_bonus', '5'::jsonb,
        'Extra Vermessung for first docking at a FOREIGN broadcast edge (a sim other than the anchor) — the expedition prize.'),
    ('dz_kh_bleed', '{"threshold": 8, "amount": 5}'::jsonb,
        'Above this Dissonanz, each move also bleeds this much Kohärenz — Dissonanz as a rising threat (Sunless-Sea Terror analog); longer routes accrue more DZ, so greed costs integrity.'),
    ('deep_surge', '{"chance": 0.4, "dz": 3, "kh": 10}'::jsonb,
        'A deep-Drift crossing has this chance of a Bleed surge (+Dissonanz, -Kohärenz) — the push-your-luck variance that makes even a planned route a gamble.')
ON CONFLICT (setting_key) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════
-- 2. drift_tuning_value(key) — internal read helper
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.drift_tuning_value(p_key TEXT)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT value FROM public.drift_tuning WHERE setting_key = p_key;
$$;

-- NB: the helper is deliberately NOT named _drift_tuning. Postgres auto-creates an
-- array type _drift_tuning for the drift_tuning table's rowtype, so a call
-- _drift_tuning('kh_start') parses as CAST('kh_start' AS drift_tuning[]) and raises
-- "malformed array literal" at runtime (the migration still applies — plpgsql bodies
-- are not type-checked at CREATE). drift_tuning_value sidesteps the collision.
REVOKE ALL ON FUNCTION public.drift_tuning_value(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.drift_tuning_value(TEXT) TO service_role;


-- ═══════════════════════════════════════════════════════════════════
-- 2b. Home-node invariant — one dockable broadcast edge per sim per chart
-- ═══════════════════════════════════════════════════════════════════
-- fn_travel_run_open, fn_travel_complete, the §19.4 KH floor and
-- fn_drift_emergency_return all resolve "the anchor sim's home" as THE broadcast_rand
-- node for that sim on a chart_version (node_type comment in 240: "a simulation's
-- dockable edge", singular). Enforce that singularity so every lookup is
-- deterministic by construction — no arbitrary pick, no non-deterministic UPDATE
-- join. Lives here (not 240) because it is the RPC layer that depends on it; the 247
-- seed creates exactly one such node per sim. If a later phase wants multiple
-- dockable edges per sim, that is a deliberate model change that revisits this index
-- and the home-lookup logic together.
CREATE UNIQUE INDEX IF NOT EXISTS uq_chart_home_node
    ON drift_chart_nodes (chart_version, simulation_id)
    WHERE node_type = 'broadcast_rand';


-- ═══════════════════════════════════════════════════════════════════
-- 3. fn_travel_run_open(user, anchor_sim) — start (or resume) a run
-- ═══════════════════════════════════════════════════════════════════
-- Ensures a profile, then the single-active-run CAS: a second open anywhere
-- returns the existing run rather than creating a second (uq_travel_runs_single_active).

CREATE OR REPLACE FUNCTION public.fn_travel_run_open(
    p_user        UUID,
    p_anchor_sim  UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_existing       travel_runs%ROWTYPE;
    v_run            travel_runs%ROWTYPE;
    v_class          INT;
    v_bb_max         INT;
    v_chart_version  INT;
    v_home_node      UUID;
    v_first_run      BOOLEAN;
BEGIN
    -- Ownership guard (player-class): never trust p_user from the parameter.
    IF (SELECT auth.uid()) IS DISTINCT FROM p_user THEN
        RAISE EXCEPTION 'fn_travel_run_open: caller is not the run owner' USING ERRCODE = '42501';
    END IF;

    -- Ensure a traveler profile (membership-required anchor). A fuller profile-init
    -- (vectors from the anchor's dominant bleed, §3.1) is P0c — this seeds defaults.
    INSERT INTO traveler_profiles (user_id, anchor_simulation_id)
    VALUES (p_user, p_anchor_sim)
    ON CONFLICT (user_id) DO NOTHING;

    -- Single-active-run CAS: return the existing open run, if any.
    SELECT * INTO v_existing FROM travel_runs
     WHERE user_id = p_user AND status IN ('active', 'frozen', 'distress')
     LIMIT 1;
    IF FOUND THEN
        RETURN to_jsonb(v_existing);
    END IF;

    -- Resolve the active chart version + the anchor sim's home broadcast node.
    SELECT max(version) INTO v_chart_version FROM chart_versions;
    IF v_chart_version IS NULL THEN
        RAISE EXCEPTION 'fn_travel_run_open: no chart version exists (seed not applied)'
            USING ERRCODE = 'P0002';
    END IF;

    SELECT id INTO v_home_node FROM drift_chart_nodes
     WHERE chart_version = v_chart_version
       AND node_type = 'broadcast_rand'
       AND simulation_id = p_anchor_sim
     LIMIT 1;
    IF v_home_node IS NULL THEN
        RAISE EXCEPTION 'fn_travel_run_open: anchor simulation % has no broadcast node on the chart', p_anchor_sim
            USING ERRCODE = 'P0002';
    END IF;

    SELECT bandwidth_class INTO v_class FROM traveler_profiles WHERE user_id = p_user;
    v_bb_max := COALESCE((drift_tuning_value('bandwidth_class_bb_max') ->> v_class::text)::int, 60);

    -- Create the run (single-active index also guards against a concurrent open).
    BEGIN
        INSERT INTO travel_runs (
            user_id, status, kohaerenz, bandbreite, dissonanz, frequency,
            position_node_id, scale, window_remaining, chart_version
        ) VALUES (
            p_user, 'active',
            COALESCE((drift_tuning_value('kh_start'))::int, 100),
            v_bb_max, 0, 'memory',
            v_home_node, 'drift',
            COALESCE((drift_tuning_value('window_base'))::int, 12),
            v_chart_version
        )
        RETURNING * INTO v_run;
    EXCEPTION WHEN unique_violation THEN
        -- A concurrent open won the single-active race — return that run.
        SELECT * INTO v_run FROM travel_runs
         WHERE user_id = p_user AND status IN ('active', 'frozen', 'distress')
         LIMIT 1;
        RETURN to_jsonb(v_run);
    END;

    -- Telemetry: first-ever run also stamps the first-session start (KPI 3).
    SELECT NOT EXISTS (
        SELECT 1 FROM travel_telemetry_events
         WHERE user_id = p_user AND event_key = 'drift_first_session_start'
    ) INTO v_first_run;
    IF v_first_run THEN
        INSERT INTO travel_telemetry_events (user_id, event_key, run_id)
        VALUES (p_user, 'drift_first_session_start', v_run.id);
    END IF;
    INSERT INTO travel_telemetry_events (user_id, event_key, run_id)
    VALUES (p_user, 'drift_run_opened', v_run.id);

    PERFORM travel_audit(p_user, 'travel_run_open', 'travel_run', v_run.id, p_anchor_sim,
        jsonb_build_object('home_node', v_home_node, 'chart_version', v_chart_version));

    RETURN to_jsonb(v_run);
END;
$$;


-- ═══════════════════════════════════════════════════════════════════
-- 4. fn_travel_move(user, run, run_version, to_node) — the Drift move
-- ═══════════════════════════════════════════════════════════════════
-- run_version CAS; validates adjacency (an edge in this chart_version); BB cost =
-- edge.weight × frequency multiplier; Notfrequenz path at BB 0; DZ by target band.

CREATE OR REPLACE FUNCTION public.fn_travel_move(
    p_user          UUID,
    p_run           UUID,
    p_run_version   INT,
    p_to_node       UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_run        travel_runs%ROWTYPE;
    v_weight     INT;
    v_perm       JSONB;
    v_affinity   INT;
    v_mult       NUMERIC;
    v_bb_cost    INT;
    v_band       TEXT;
    v_dz_add     INT;
    v_dz_cap     INT;
    v_notfreq    BOOLEAN := FALSE;
    v_surge      BOOLEAN := FALSE;
    v_home       UUID;
    v_anchor     UUID;
    v_to_sim     UUID;
    v_to_type    TEXT;
    v_haul       INT;
    v_visited    JSONB;
    v_survey     INT := 0;
    v_dz_bleed   JSONB;
    v_surge_cfg  JSONB;
BEGIN
    IF (SELECT auth.uid()) IS DISTINCT FROM p_user THEN
        RAISE EXCEPTION 'fn_travel_move: caller is not the run owner' USING ERRCODE = '42501';
    END IF;

    -- Lock + load the run; run_version CAS (concurrent move from a 2nd client loses).
    SELECT * INTO v_run FROM travel_runs WHERE id = p_run AND user_id = p_user FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'fn_travel_move: run not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_run.status <> 'active' THEN
        RAISE EXCEPTION 'fn_travel_move: run is %, not active', v_run.status USING ERRCODE = '22023';
    END IF;
    IF v_run.run_version <> p_run_version THEN
        RAISE EXCEPTION 'RUN_STALE' USING ERRCODE = 'P0001';
    END IF;

    -- Adjacency: an edge between the current position and the target in this chart.
    SELECT weight, permeability INTO v_weight, v_perm FROM drift_chart_edges
     WHERE chart_version = v_run.chart_version
       AND ((from_node = v_run.position_node_id AND to_node = p_to_node)
         OR (to_node   = v_run.position_node_id AND from_node = p_to_node))
     LIMIT 1;
    IF v_weight IS NULL THEN
        RAISE EXCEPTION 'NOT_ADJACENT' USING ERRCODE = '22023';
    END IF;

    -- Frequency multiplier: on-vector if the edge is permeable on the current
    -- frequency (≥1); else the affinity-banded off-vector penalty (§2.2).
    -- (P0 simplification: the per-edge low-permeability ×3 case is not yet split out.)
    IF COALESCE((v_perm ->> v_run.frequency)::numeric, 0) >= 1 THEN
        v_mult := (drift_tuning_value('freq_offvector_mult') ->> 'on')::numeric;
    ELSE
        v_affinity := COALESCE((SELECT (affinities ->> v_run.frequency)::int
                                FROM traveler_profiles WHERE user_id = p_user), 0);
        v_mult := (drift_tuning_value('freq_offvector_mult') ->> (
            CASE WHEN v_affinity <= 1 THEN 'aff_0_1'
                 WHEN v_affinity <= 3 THEN 'aff_2_3'
                 ELSE 'aff_4_5' END))::numeric;
    END IF;
    v_bb_cost := ceil(v_weight * v_mult)::int;

    -- Pay: Bandbreite if affordable, else Notfrequenz (KH per edge, BB stays 0).
    -- (P0 simplification: Notfrequenz allowed on any adjacent edge; the known-edge
    --  restriction §2.3 needs the discovery layer, P0b.)
    IF v_run.bandbreite >= v_bb_cost THEN
        v_run.bandbreite := v_run.bandbreite - v_bb_cost;
    ELSE
        v_notfreq := TRUE;
        v_run.kohaerenz := GREATEST(0, v_run.kohaerenz
            - COALESCE((drift_tuning_value('notfreq_kh_per_edge'))::int, 2));
    END IF;

    -- Target node band + identity (Dissonanz scaling, survey value, foreign-dock bonus).
    SELECT distance_band, simulation_id, node_type INTO v_band, v_to_sim, v_to_type
      FROM drift_chart_nodes WHERE id = p_to_node AND chart_version = v_run.chart_version;
    SELECT anchor_simulation_id INTO v_anchor FROM traveler_profiles WHERE user_id = p_user;
    SELECT n.id INTO v_home FROM drift_chart_nodes n
     WHERE n.simulation_id = v_anchor AND n.node_type = 'broadcast_rand'
       AND n.chart_version = v_run.chart_version;

    -- One Takt of the Aufenthaltsfenster spent (§2.6) — the time pressure.
    v_run.window_remaining := v_run.window_remaining - 1;

    -- Dissonanz by the target band, capped. Above the bleed threshold, instability
    -- erodes Kohärenz (the Bleed eats you) — Dissonanz is a rising threat with teeth.
    v_dz_add := COALESCE((drift_tuning_value('dz_per_move_by_band') ->> COALESCE(v_band, 'near'))::int, 1);
    v_dz_cap := COALESCE((drift_tuning_value('dz_p0_cap'))::int, 74);
    v_run.dissonanz := LEAST(v_dz_cap, v_run.dissonanz + v_dz_add);
    v_dz_bleed := drift_tuning_value('dz_kh_bleed');
    IF v_dz_bleed IS NOT NULL AND v_run.dissonanz >= (v_dz_bleed ->> 'threshold')::int THEN
        v_run.kohaerenz := GREATEST(0, v_run.kohaerenz - (v_dz_bleed ->> 'amount')::int);
    END IF;

    -- Deep-Drift surge (variance / push-your-luck): a deep crossing may spike DZ + KH.
    IF v_band = 'deep' THEN
        v_surge_cfg := drift_tuning_value('deep_surge');
        IF v_surge_cfg IS NOT NULL AND random() < (v_surge_cfg ->> 'chance')::numeric THEN
            v_surge := TRUE;
            v_run.dissonanz := LEAST(v_dz_cap, v_run.dissonanz + (v_surge_cfg ->> 'dz')::int);
            v_run.kohaerenz := GREATEST(0, v_run.kohaerenz - (v_surge_cfg ->> 'kh')::int);
        END IF;
    END IF;

    -- Vermessung: first arrival at this node this run → survey value (band + foreign dock).
    v_haul    := COALESCE((v_run.checkpoint ->> 'haul')::int, 0);
    v_visited := COALESCE(v_run.checkpoint -> 'visited', '[]'::jsonb);
    IF NOT (v_visited @> to_jsonb(p_to_node::text)) THEN
        v_survey := COALESCE((drift_tuning_value('survey_value_by_band') ->> COALESCE(v_band, 'near'))::int, 0);
        IF v_to_type = 'broadcast_rand' AND v_to_sim IS DISTINCT FROM v_anchor THEN
            v_survey := v_survey + COALESCE((drift_tuning_value('foreign_dock_bonus'))::int, 0);
        END IF;
        v_haul := v_haul + v_survey;
        v_visited := v_visited || to_jsonb(p_to_node::text);
    END IF;

    -- Recall floor: a depleted Kohärenz (§19.4) OR an expired Aufenthaltsfenster (§2.6)
    -- collapses the excursion — the Träger is snapped to the home broadcast edge and the
    -- un-lodged Vermessung is LOST (the push-your-luck stakes). P0 ships forced-return-
    -- home only (P0c: cargo scatters as echoes via the hospitality gate; P2 replaces
    -- this with fn_zerfaserung — wreck/scar/distress). Home is single-row by
    -- uq_chart_home_node (section 2b). Records under the 'drift_zerfaserung' KPI bucket.
    -- Kohärenz=0 unravels you anywhere; an expired window only strands you if this move
    -- did NOT bring you home (an on-time arrival home is a clean return, not a loss).
    IF v_run.kohaerenz <= 0 OR (v_run.window_remaining <= 0 AND p_to_node IS DISTINCT FROM v_home) THEN
        UPDATE travel_runs SET
            position_node_id = COALESCE(v_home, position_node_id),
            status           = 'abandoned',   -- the expedition collapsed (terminal; nothing lodged)
            closed_at        = now(),
            bandbreite       = v_run.bandbreite,
            kohaerenz        = v_run.kohaerenz,
            dissonanz        = v_run.dissonanz,
            window_remaining = GREATEST(0, v_run.window_remaining),
            takt_count       = takt_count + 1,
            event_seq        = event_seq + 1,
            run_version      = run_version + 1,
            checkpoint       = jsonb_build_object(
                'position_node_id', COALESCE(v_home, v_run.position_node_id),
                'recall', CASE WHEN v_run.kohaerenz <= 0 THEN 'kohaerenz' ELSE 'window' END,
                'haul', 0, 'haul_lost', v_haul, 'visited', v_visited)
        WHERE id = p_run
        RETURNING * INTO v_run;

        INSERT INTO travel_telemetry_events (user_id, event_key, run_id)
        VALUES (p_user, 'drift_zerfaserung', p_run);
        PERFORM travel_audit(p_user, 'travel_recall', 'travel_run', p_run, NULL,
            jsonb_build_object('reason', v_run.checkpoint ->> 'recall',
                               'haul_lost', v_haul, 'attempted_to', p_to_node));
        RETURN to_jsonb(v_run);
    END IF;

    -- Advance: position + counters + the spent window; rewrite the checkpoint carrying
    -- the accrued Vermessung haul + the visited set.
    UPDATE travel_runs SET
        position_node_id = p_to_node,
        bandbreite       = v_run.bandbreite,
        kohaerenz        = v_run.kohaerenz,
        dissonanz        = v_run.dissonanz,
        window_remaining = v_run.window_remaining,
        takt_count       = takt_count + 1,
        event_seq        = event_seq + 1,
        run_version      = run_version + 1,
        checkpoint       = jsonb_build_object(
            'position_node_id', p_to_node, 'haul', v_haul, 'visited', v_visited,
            'last_move', jsonb_build_object('from', v_run.position_node_id, 'bb_cost', v_bb_cost,
                                            'notfrequenz', v_notfreq, 'dz_add', v_dz_add,
                                            'surge', v_surge, 'survey', v_survey)
        )
    WHERE id = p_run
    RETURNING * INTO v_run;

    PERFORM travel_audit(p_user, 'travel_move', 'travel_run', p_run, NULL,
        jsonb_build_object('to_node', p_to_node, 'bb_cost', v_bb_cost, 'notfrequenz', v_notfreq,
                           'surge', v_surge, 'haul', v_haul, 'takt', v_run.takt_count));

    RETURN to_jsonb(v_run);
END;
$$;


-- ═══════════════════════════════════════════════════════════════════
-- 5. fn_travel_complete(user, run, run_version) — close at home
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_travel_complete(
    p_user UUID, p_run UUID, p_run_version INT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_run       travel_runs%ROWTYPE;
    v_is_home   BOOLEAN;
    v_haul      INT;
BEGIN
    IF (SELECT auth.uid()) IS DISTINCT FROM p_user THEN
        RAISE EXCEPTION 'fn_travel_complete: caller is not the run owner' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_run FROM travel_runs WHERE id = p_run AND user_id = p_user FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'fn_travel_complete: run not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_run.status <> 'active' THEN
        RAISE EXCEPTION 'fn_travel_complete: run is %, not active', v_run.status USING ERRCODE = '22023';
    END IF;
    IF v_run.run_version <> p_run_version THEN
        RAISE EXCEPTION 'RUN_STALE' USING ERRCODE = 'P0001';
    END IF;

    -- Must be standing on the anchor's home broadcast node.
    SELECT EXISTS (
        SELECT 1 FROM drift_chart_nodes n
        JOIN traveler_profiles p ON p.user_id = p_user
        WHERE n.id = v_run.position_node_id
          AND n.node_type = 'broadcast_rand'
          AND n.simulation_id = p.anchor_simulation_id
    ) INTO v_is_home;
    IF NOT v_is_home THEN
        RAISE EXCEPTION 'NOT_AT_HOME' USING ERRCODE = '22023';
    END IF;

    -- Entladung: lodge the run's accrued Vermessung into the traveler's lifetime total
    -- (qualities.vermessung_lodged), then close. (P0c: cargo redemption lands here too.)
    v_haul := COALESCE((v_run.checkpoint ->> 'haul')::int, 0);
    UPDATE traveler_profiles
       SET qualities = jsonb_set(qualities, '{vermessung_lodged}',
             to_jsonb(COALESCE((qualities ->> 'vermessung_lodged')::int, 0) + v_haul))
     WHERE user_id = p_user;
    UPDATE travel_runs
       SET status = 'completed', closed_at = now(), run_version = run_version + 1,
           checkpoint = jsonb_build_object('haul_banked', v_haul)
     WHERE id = p_run
     RETURNING * INTO v_run;

    INSERT INTO travel_telemetry_events (user_id, event_key, run_id)
    VALUES (p_user, 'drift_run_closed', p_run);
    PERFORM travel_audit(p_user, 'travel_complete', 'travel_run', p_run, NULL,
        jsonb_build_object('takt_count', v_run.takt_count, 'haul_banked', v_haul));

    RETURN to_jsonb(v_run);
END;
$$;


-- ═══════════════════════════════════════════════════════════════════
-- 6. fn_travel_abandon(user, run, run_version) — Rückzug
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_travel_abandon(
    p_user UUID, p_run UUID, p_run_version INT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_run travel_runs%ROWTYPE;
BEGIN
    IF (SELECT auth.uid()) IS DISTINCT FROM p_user THEN
        RAISE EXCEPTION 'fn_travel_abandon: caller is not the run owner' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_run FROM travel_runs WHERE id = p_run AND user_id = p_user FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'fn_travel_abandon: run not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_run.status NOT IN ('active', 'frozen') THEN
        RAISE EXCEPTION 'fn_travel_abandon: run is %, not abandonable', v_run.status USING ERRCODE = '22023';
    END IF;
    IF v_run.run_version <> p_run_version THEN
        RAISE EXCEPTION 'RUN_STALE' USING ERRCODE = 'P0001';
    END IF;

    -- Rückzug: unanchored cargo (run_id set) is forfeited; discoveries are kept.
    DELETE FROM travel_cargo WHERE run_id = p_run;

    UPDATE travel_runs
       SET status = 'abandoned', closed_at = now(), run_version = run_version + 1
     WHERE id = p_run
     RETURNING * INTO v_run;

    INSERT INTO travel_telemetry_events (user_id, event_key, run_id)
    VALUES (p_user, 'drift_run_closed', p_run);
    PERFORM travel_audit(p_user, 'travel_abandon', 'travel_run', p_run, NULL, '{}'::jsonb);

    RETURN to_jsonb(v_run);
END;
$$;


-- ═══════════════════════════════════════════════════════════════════
-- 7. fn_drift_emergency_return() — admin kill-switch (backend-only)
-- ═══════════════════════════════════════════════════════════════════
-- Forces every open/distress run home with resources + cargo intact. Idempotent
-- (a run already at home is a no-op move). Backend/service_role only.

CREATE OR REPLACE FUNCTION public.fn_drift_emergency_return()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INT := 0;
BEGIN
    WITH homed AS (
        UPDATE travel_runs r SET
            position_node_id = n.id,
            status           = 'active',
            run_version      = r.run_version + 1,
            checkpoint       = jsonb_build_object('position_node_id', n.id, 'emergency_return', true)
        FROM traveler_profiles p
        -- The UPDATE target r cannot be referenced inside a FROM-clause JOIN's ON, so
        -- the run-correlated predicate (n.chart_version = r.chart_version) lives in
        -- WHERE. With uq_chart_home_node (section 2b) this resolves to ≤1 home per run
        -- — deterministic, no arbitrary pick.
        JOIN drift_chart_nodes n
          ON n.simulation_id = p.anchor_simulation_id
         AND n.node_type = 'broadcast_rand'
        -- 'frozen' is deliberately excluded: a gate-flip freeze is already a safe,
        -- suspended state that thaws on re-enable (see 239) — the kill-switch
        -- repatriates only live and distressed travelers.
        WHERE r.user_id = p.user_id
          AND n.chart_version = r.chart_version
          AND r.status IN ('active', 'distress')
        RETURNING r.id, r.user_id
    )
    SELECT count(*) INTO v_count FROM homed;

    PERFORM travel_audit(NULL, 'travel_emergency_return', 'travel_run', NULL, NULL,
        jsonb_build_object('runs_returned', v_count));

    RETURN jsonb_build_object('runs_returned', v_count);
END;
$$;


-- ═══════════════════════════════════════════════════════════════════
-- 8. Grants (§4/§5 two grant classes; ADR-006 explicit revokes)
-- ═══════════════════════════════════════════════════════════════════

-- Player-class: callable by authenticated (validated by the in-function auth.uid()
-- ownership guard); not by anon.
DO $$
DECLARE sig TEXT;
BEGIN
    FOREACH sig IN ARRAY ARRAY[
        'fn_travel_run_open(uuid, uuid)',
        'fn_travel_move(uuid, uuid, integer, uuid)',
        'fn_travel_complete(uuid, uuid, integer)',
        'fn_travel_abandon(uuid, uuid, integer)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', sig);
        EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', sig);
    END LOOP;
END $$;

-- Backend-class: service_role only (explicit anon + authenticated revoke — 245 lesson).
REVOKE ALL    ON FUNCTION public.fn_drift_emergency_return() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_drift_emergency_return() TO service_role;

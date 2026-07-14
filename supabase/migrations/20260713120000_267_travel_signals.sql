-- Migration 267: DRIFT Fun-Kern — travel_signals (M1: der Zug wird ein Ereignis)
--
-- Plan:    docs/plans/drift-fun-core-implementation-plan.md §4 (Welle 2, Schritt 2.2)
--          docs/plans/drift-w25-architecture-consolidation-plan.md (C, D, E)
-- Concept: drift-gameplay-redesign-concept.md — D2 ("leere Züge"), M1 (Signale),
--          M9 (DZ-Eskalation), R9 (Zustand wird Text), R12 (Logbuch).
-- Content:  migration 266 (travel_signal_templates) + 266a (32 skeletons).
--
-- P0 gave a move exactly one thing to say: the deep_surge coin flip (40 % → −10 KH, +3 DZ),
-- nameless and unanswerable. This file draws a SIGNAL on every move instead: the tuned class
-- mix per distance band decides WHAT kind of thing happens, the skeleton's own band weights
-- and its requirements decide WHICH one, and the two interactive classes stop the run and
-- wait for an answer.
--
-- ── What is here ────────────────────────────────────────────────────────────
--   1. Tuning: signal_weights (class mix per band), signal_bands (the thresholds that turn
--      run state into the words the content requires), signal_check, dz_late_window (M9),
--      manifest_free_slots.
--   2. The draw's four pure helpers: drift_signal_bands / _eligible / _affordable / _prose.
--   3. fn_drift_signal_draw — WHAT the Drift does on a move it was not asked about.
--   4. fn_drift_apply_deltas — the closed outcome vocabulary, applied in ONE place.
--   5. fn_travel_move — the Takt, in its final form.
--   6. fn_signal_resolve — the traveller answers. Its outcome can end the run in a Havarie
--      (that is the point: a signal has teeth).
--
-- Each of them exactly ONCE (W2.6/C). fn_travel_move used to be defined three times across
-- 264/265/267 and fn_drift_signal_draw twice — so reading the engine meant diffing files, and
-- re-applying an earlier migration silently reverted a later fix.
--
-- ── The checkpoint no longer forgets, because it no longer REMEMBERS (W2.6/D) ─
-- fn_travel_move REBUILDS the checkpoint on every advance. That used to be a trap: run-level
-- state (the marker stack, the dig counters, the overstay permit, the banked reserve, the
-- haul, the visited set) lived in the same jsonb, so every advance would have thrown it away
-- — and the workaround, a `drift_checkpoint_carry` whitelist, only moved the trap one step
-- back (a key that nobody remembered to list vanished silently on the next move).
--
-- Since 264/§3 all of that state lives in COLUMNS. The rebuild is now safe BY CONSTRUCTION:
-- what stays in the checkpoint is only what SHOULD be forgotten on the next move — `last_move`,
-- `pending_signal`, `last_signal`, `havarie`, `earnings`. What just happened, not what is true.
-- The whitelist is gone.
--
-- ── And the snapshot trap with it (W2.6/E) ──────────────────────────────────
-- The mirrored snapshot bug — the caller holding a local `v_haul` while the helper writes the
-- same number back from the column, in both directions — cannot recur: `haul` is DERIVED
-- (264/§3.2), no function writes it, and the two functions here touch different sources
-- (fn_travel_move writes `haul_survey`, fn_drift_apply_deltas inserts cargo). Nothing is
-- carried in a local variable across a helper call any more.
--
-- Gate off (`drift_fun_core_enabled` = false) ⇒ not a single new write happens: no draw, no
-- log line, no escalation, and the anonymous deep_surge is back. A run that still holds a
-- pending_signal from a gated-on session is DRAINED (the key is dropped on the next move),
-- never trapped — a gate may refuse to CREATE state, never to lock a traveller inside it.

BEGIN;

-- ═══════════════════════════════════════════════════════════════════
-- 1. Tuning (plan §2.3: all numbers live in drift_tuning, never in code)
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO drift_tuning (setting_key, value, description) VALUES
('signal_weights',
 '{"near": {"stoerung": 15, "fund": 20, "geruecht": 25, "begegnung": 5,  "stille": 35},
   "mid":  {"stoerung": 25, "fund": 20, "geruecht": 20, "begegnung": 10, "stille": 25},
   "deep": {"stoerung": 35, "fund": 15, "geruecht": 15, "begegnung": 15, "stille": 20}}'::jsonb,
 'The class mix of the per-move signal draw, per distance band (M1). Near home the Drift gossips (Gerücht 25) and mostly holds its breath (Stille 35); in the deep it pushes back (Störung 35) and the silences stop being restful. Stille IS a class, not the absence of a draw — that is what makes the other four mean something.'),
('signal_bands',
 '{"kh": {"kritisch": 25, "angeschlagen": 60},
   "dz": {"ruhig": 7, "erhoeht": 14},
   "window": {"knapp": 3, "mittel": 7}}'::jsonb,
 'The thresholds that turn a run''s live state into the words a skeleton can require (R9 — Zustand wird Text). Read as upper bounds: KH <= 25 is kritisch, <= 60 angeschlagen, else intakt; DZ <= 7 ruhig, <= 14 erhoeht, else kritisch; window <= 3 Takte knapp, <= 7 mittel, else weit. Only the ENGINE knows the numbers; the content only ever names the band, so a rebalance never invalidates a skeleton.'),
('signal_check',
 '{"dice": 10, "dz_divisor": 10}'::jsonb,
 'Parameters of the signal option check: roll = drift_rand_int(seed, 1, dice) + affinities[vector] - floor(dissonanz / dz_divisor) >= difficulty. Difficulty is authored per option (2-14). The odds are never numbered for the player (R4) — the option chip says "riskant", and the traveller learns the rest by living.'),
('dz_late_window',
 '{"from_takt": 8, "extra": 1}'::jsonb,
 'M9 escalation: from this Takt on, every further move costs this much extra Dissonanz. A long run is not merely a longer run — the Drift gets a grip on you, and the last stretch home is the expensive one.'),
('manifest_free_slots',
 '{"1": 2, "2": 3, "3": 4, "4": 5}'::jsonb,
 'Free manifest slots per bandwidth class — the line beyond which a run counts as overloaded (the `overload` requirement band, which the signal content reads). W3 (Schritt 3.3, overload_bb_per_slot) is what CHARGES for crossing it; here it only makes the Drift notice.')
ON CONFLICT (setting_key) DO NOTHING;

-- The signal draw retires the hard-coded deep_surge: the same damage now arrives with a name,
-- prose and two ways to answer (`stoerung_frequenzscherung`). The tuning row stays for the
-- gate-off path, which is still P0.
COMMENT ON TABLE drift_tuning IS
    'DRIFT tuning knobs (migration 246). NOTE: `deep_surge` is the gate-OFF path only — with drift_fun_core_enabled the deep surge is drawn as a Störung signal (migration 267).';


-- ═══════════════════════════════════════════════════════════════════
-- 2. drift_signal_bands — run state, rendered as the words the content speaks
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.drift_signal_bands(
    p_kh INT, p_dz INT, p_window INT, p_overload BOOLEAN
) RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT jsonb_build_object(
        'kh_band', CASE
            WHEN p_kh <= COALESCE((drift_tuning_value('signal_bands') #>> '{kh,kritisch}')::int, 25)
                THEN 'kritisch'
            WHEN p_kh <= COALESCE((drift_tuning_value('signal_bands') #>> '{kh,angeschlagen}')::int, 60)
                THEN 'angeschlagen'
            ELSE 'intakt' END,
        'dz_band', CASE
            WHEN p_dz <= COALESCE((drift_tuning_value('signal_bands') #>> '{dz,ruhig}')::int, 7)
                THEN 'ruhig'
            WHEN p_dz <= COALESCE((drift_tuning_value('signal_bands') #>> '{dz,erhoeht}')::int, 14)
                THEN 'erhoeht'
            ELSE 'kritisch' END,
        'window_band', CASE
            WHEN p_window <= COALESCE((drift_tuning_value('signal_bands') #>> '{window,knapp}')::int, 3)
                THEN 'knapp'
            WHEN p_window <= COALESCE((drift_tuning_value('signal_bands') #>> '{window,mittel}')::int, 7)
                THEN 'mittel'
            ELSE 'weit' END,
        'overload', p_overload
    );
$$;

COMMENT ON FUNCTION public.drift_signal_bands(INT, INT, INT, BOOLEAN) IS
    'Turns a run''s live state into the four band words the signal content requires (R9). Thresholds come from drift_tuning.signal_bands, so a rebalance never invalidates a skeleton — the content names the band, never the number. INTERNAL-class: service_role only.';

REVOKE ALL    ON FUNCTION public.drift_signal_bands(INT, INT, INT, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.drift_signal_bands(INT, INT, INT, BOOLEAN) TO service_role;


-- ═══════════════════════════════════════════════════════════════════
-- 3. drift_signal_eligible — does this skeleton fit this run, right now?
-- ═══════════════════════════════════════════════════════════════════
-- Every listed requirement must hold (AND); an absent one means "any". An empty `requires` is
-- always eligible. Pure, so the draw can call it per candidate row.

CREATE OR REPLACE FUNCTION public.drift_signal_eligible(p_requires JSONB, p_bands JSONB)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT
        (p_requires -> 'kh_band'     IS NULL OR p_requires -> 'kh_band'     @> to_jsonb(p_bands ->> 'kh_band'))
    AND (p_requires -> 'dz_band'     IS NULL OR p_requires -> 'dz_band'     @> to_jsonb(p_bands ->> 'dz_band'))
    AND (p_requires -> 'window_band' IS NULL OR p_requires -> 'window_band' @> to_jsonb(p_bands ->> 'window_band'))
    AND (p_requires -> 'overload'    IS NULL OR (p_requires -> 'overload')  = (p_bands -> 'overload'));
$$;

COMMENT ON FUNCTION public.drift_signal_eligible(JSONB, JSONB) IS
    'Requirement filter of the signal draw: every band a skeleton names must match the run''s current bands; an unnamed band is a wildcard. INTERNAL-class.';

REVOKE ALL    ON FUNCTION public.drift_signal_eligible(JSONB, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.drift_signal_eligible(JSONB, JSONB) TO service_role;


-- ═══════════════════════════════════════════════════════════════════
-- 4. drift_signal_affordable — an option nobody can pay is not an option
-- ═══════════════════════════════════════════════════════════════════
-- The W1 lesson, applied a second time (there: notabwurf at window_remaining == window_cost).
-- An interactive signal whose every option is unpayable would park the run in a scene with no
-- exit — so affordability is part of ELIGIBILITY, not a surprise at resolve time. A skeleton
-- with no payable option is simply not drawn.
--
-- "Payable" is deliberately strict about the window (a Takt you do not have cannot be spent)
-- and permissive about KH/BB (paying your last coherence is a legitimate, terrible choice —
-- it can drop you into a Havarie, and that is the point of a Störung).

CREATE OR REPLACE FUNCTION public.drift_signal_affordable(
    p_option JSONB, p_kh INT, p_bb INT, p_window INT
) RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT COALESCE((p_option #>> '{cost,takt}')::int, 0) <= p_window
       AND COALESCE((p_option #>> '{cost,bb}')::int, 0)   <= p_bb;
$$;

COMMENT ON FUNCTION public.drift_signal_affordable(JSONB, INT, INT, INT) IS
    'Can the run pay this option''s up-front cost? Window and Bandbreite must actually be there; Kohärenz is NOT checked — spending your last coherence is a real (and terrible) choice, and a Störung is allowed to have teeth. Used at DRAW time (a skeleton with no payable option is never shown) and re-checked at resolve. INTERNAL-class.';

REVOKE ALL    ON FUNCTION public.drift_signal_affordable(JSONB, INT, INT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.drift_signal_affordable(JSONB, INT, INT, INT) TO service_role;


-- ═══════════════════════════════════════════════════════════════════
-- 5. drift_signal_prose — {sim} points at a world you can actually reach
-- ═══════════════════════════════════════════════════════════════════
-- KPI-1: the Drift must name real rows of real worlds. The token is filled with a foreign
-- broadcast world from the traveller's own chart — deterministically, so the same signal
-- always names the same world (a rumour that renames its subject on a refetch is not a rumour,
-- it is a bug). Falls back to the anchor world, then to a neutral phrase, so an unseeded chart
-- can never ship a literal "{sim}" to a player.

CREATE OR REPLACE FUNCTION public.drift_signal_prose(
    p_definition JSONB, p_chart_version INT, p_anchor UUID, p_seed TEXT
) RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_prose JSONB := p_definition -> 'prose';
    v_sim   TEXT;
    v_text  TEXT;
    v_key   TEXT;
    v_out   JSONB := '{}'::jsonb;
BEGIN
    IF v_prose IS NULL THEN
        RETURN '{}'::jsonb;
    END IF;

    SELECT s.name INTO v_sim
      FROM drift_chart_nodes n
      JOIN simulations s ON s.id = n.simulation_id
     WHERE n.chart_version = p_chart_version
       AND n.node_type = 'broadcast_rand'
       AND n.simulation_id IS DISTINCT FROM p_anchor
     ORDER BY drift_rand(p_seed || ':sim:' || n.stable_key)
     LIMIT 1;

    IF v_sim IS NULL THEN
        SELECT name INTO v_sim FROM simulations WHERE id = p_anchor;
    END IF;

    FOR v_key, v_text IN SELECT key, value #>> '{}' FROM jsonb_each(v_prose) LOOP
        v_out := v_out || jsonb_build_object(
            v_key,
            replace(v_text, '{sim}', COALESCE(v_sim,
                CASE WHEN v_key LIKE '%_en' THEN 'another world' ELSE 'einer anderen Welt' END))
        );
    END LOOP;

    RETURN v_out;
END;
$$;

COMMENT ON FUNCTION public.drift_signal_prose(JSONB, INT, UUID, TEXT) IS
    'Substitutes {sim} in a drawn signal''s prose with a REAL foreign broadcast world from the traveller''s chart (KPI-1), picked deterministically from the salted seed so the same signal always names the same world. Falls back to the anchor world, then to a neutral phrase — a literal "{sim}" must never reach a player. INTERNAL-class.';

REVOKE ALL    ON FUNCTION public.drift_signal_prose(JSONB, INT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.drift_signal_prose(JSONB, INT, UUID, TEXT) TO service_role;


-- ═══════════════════════════════════════════════════════════════════
-- 6. fn_drift_signal_draw — WHAT the Drift does on a move it was not asked about
-- ═══════════════════════════════════════════════════════════════════
-- Two weighted picks, both salted (264: without the per-run salt the traveller could
-- precompute the deck and simply wait for a good hand — there is no luck to push if you can
-- read the next card):
--   (1) the CLASS, from the tuned per-band mix (drift_tuning.signal_weights) — bent towards
--       Störung while the run stands on a node its own Sondierung tore open (a bust does not
--       merely cost the yield, it CHANGES THE PLACE: the Drift comes through a Riss),
--   (2) the TEMPLATE within the class, from its own per-band weight — filtered by the run's
--       bands (R9) and by whether the traveller can actually pay an option.
--
-- If a class turns up empty after filtering (a battered run in a band where every Störung
-- wants an intact hull), the draw falls back to silence rather than forcing a second class:
-- silence IS content here, and a forced fallback would quietly bias the mix away from what the
-- tuning says.
--
-- Returns NULL when nothing is drawn; otherwise the resolved signal payload.

CREATE OR REPLACE FUNCTION public.fn_drift_signal_draw(
    p_run     UUID,
    p_user    UUID,
    p_band    TEXT,
    p_takt    INT,
    p_bands   JSONB,
    p_kh      INT,
    p_bb      INT,
    p_window  INT,
    p_chart   INT,
    p_anchor  UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_salt      TEXT;
    v_seed      TEXT;
    v_weights   JSONB;
    v_total     INT := 0;
    v_roll      INT;
    v_acc       INT := 0;
    v_class     TEXT;
    v_cand      RECORD;
    v_tpl       RECORD;
    v_rissig    BOOLEAN;
BEGIN
    v_salt := drift_run_salt(p_run);
    v_seed := v_salt || ':' || p_run::text || ':signal:' || p_takt::text;

    -- (1) The class.
    v_weights := drift_tuning_value('signal_weights') -> COALESCE(p_band, 'near');
    IF v_weights IS NULL THEN
        RETURN NULL;
    END IF;

    -- A torn node leaks. The Störung weight rises while the run stands on it. The flag is read
    -- from the run's `sondierung` COLUMN (a column since W2.6/D — it used to be a checkpoint
    -- key that every move had to remember to carry).
    SELECT COALESCE((r.sondierung #>> ARRAY[r.position_node_id::text, 'rissig'])::boolean, FALSE)
      INTO v_rissig
      FROM travel_runs r WHERE r.id = p_run;

    IF v_rissig THEN
        v_weights := v_weights || jsonb_build_object('stoerung',
            COALESCE((v_weights ->> 'stoerung')::int, 0)
            + COALESCE((drift_tuning_value('sondierung_rissig_stoerung_bonus'))::int, 15));
    END IF;

    SELECT COALESCE(sum((value #>> '{}')::int), 0) INTO v_total FROM jsonb_each(v_weights);
    IF v_total <= 0 THEN
        RETURN NULL;
    END IF;

    v_roll := drift_rand_int(v_seed || ':class', 1, v_total);
    FOR v_cand IN SELECT key AS cls, (value #>> '{}')::int AS w
                    FROM jsonb_each(v_weights) ORDER BY key LOOP
        v_acc := v_acc + v_cand.w;
        IF v_roll <= v_acc THEN
            v_class := v_cand.cls;
            EXIT;
        END IF;
    END LOOP;

    IF v_class IS NULL THEN
        RETURN NULL;
    END IF;

    -- (2) The template, weighted within the class. Eligibility = the run's bands AND (for the
    -- interactive classes) at least one option the traveller can pay.
    WITH eligible AS (
        SELECT t.template_key, t.signal_class, t.definition,
               COALESCE((t.band_weights ->> COALESCE(p_band, 'near'))::int, 0) AS w
          FROM travel_signal_templates t
         WHERE t.signal_class = v_class
           AND COALESCE((t.band_weights ->> COALESCE(p_band, 'near'))::int, 0) > 0
           AND drift_signal_eligible(t.requires, p_bands)
           AND (
                t.definition -> 'options' IS NULL
                OR EXISTS (
                    SELECT 1 FROM jsonb_array_elements(t.definition -> 'options') o
                     WHERE drift_signal_affordable(o, p_kh, p_bb, p_window)
                )
           )
    ), running AS (
        -- sum() OVER () is bigint; drift_rand_int takes int — cast here, not at the call site,
        -- so the weighted pick reads as arithmetic and not as plumbing.
        SELECT template_key, signal_class, definition, w,
               sum(w) OVER (ORDER BY template_key
                            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)::int AS acc,
               sum(w) OVER ()::int AS total
          FROM eligible
    )
    SELECT r.template_key, r.signal_class, r.definition INTO v_tpl
      FROM running r
     WHERE r.acc >= drift_rand_int(v_seed || ':tpl', 1,
                                   GREATEST(1, (SELECT max(total) FROM running)))
     ORDER BY r.acc
     LIMIT 1;

    IF v_tpl IS NULL THEN
        RETURN NULL;   -- the class came up empty for this run — the Drift stays quiet
    END IF;

    RETURN jsonb_build_object(
        'template_key', v_tpl.template_key,
        'signal_class', v_tpl.signal_class,
        'takt',         p_takt,
        'bands',        p_bands,
        'rissig',       v_rissig,
        'prose',        drift_signal_prose(v_tpl.definition, p_chart, p_anchor, v_seed),
        -- The display copy of the options: what the panel renders (labels, cost chips, the
        -- "riskant" glyph). Execution re-reads the template from the table, so a tampered
        -- checkpoint can never buy a better outcome.
        'options',      COALESCE((
            SELECT jsonb_agg(o ORDER BY ord)
              FROM jsonb_array_elements(v_tpl.definition -> 'options') WITH ORDINALITY AS t(o, ord)
             WHERE drift_signal_affordable(o, p_kh, p_bb, p_window)
        ), NULL),
        'auto',         v_tpl.definition -> 'auto'
    );
END;
$$;

COMMENT ON FUNCTION public.fn_drift_signal_draw(UUID, UUID, TEXT, INT, JSONB, INT, INT, INT, INT, UUID) IS
    'The per-move signal draw (M1). Class from the tuned per-band mix — bent towards Störung while the run stands on a node its own Sondierung tore open — then template from its own band weight, filtered by the run''s state bands (R9) and by whether an option can actually be paid (an unpayable scene has no exit). Both picks are salted (drift_run_salt, 264): a precomputable deck would delete the push-your-luck. Returns NULL when nothing is drawn — silence IS a class, and a forced fallback would bias the mix away from the tuning. INTERNAL-class: service_role only, reached DEFINER→DEFINER from fn_travel_move.';

REVOKE ALL    ON FUNCTION public.fn_drift_signal_draw(UUID, UUID, TEXT, INT, JSONB, INT, INT, INT, INT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_drift_signal_draw(UUID, UUID, TEXT, INT, JSONB, INT, INT, INT, INT, UUID) TO service_role;


-- ═══════════════════════════════════════════════════════════════════
-- 7. fn_drift_apply_deltas — the closed outcome vocabulary, in ONE place
-- ═══════════════════════════════════════════════════════════════════
-- Every signal outcome (a passive Fund, a resolved Störung option) flows through here. One
-- writer, one set of clamps, one audit trail. Resource clamps are the table's CHECK
-- constraints made explicit: KH and DZ are bounded, BB and window cannot go negative. A
-- skeleton is authored in deltas and can never write an illegal row.
--
-- Since W2.6 it does NOT touch the haul. A Fund inserts its freight (travel_cargo.haul_value)
-- and the haul follows by arithmetic — which is what killed the mirrored snapshot bug: there
-- is no number left for a caller to hold in a local variable and have overwritten.

CREATE OR REPLACE FUNCTION public.fn_drift_apply_deltas(
    p_user   UUID,
    p_run    UUID,
    p_deltas JSONB,
    p_source TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_run       travel_runs%ROWTYPE;
    v_dz_cap    INT;
    v_bb_max    INT;
    v_class     INT;
    v_applied   JSONB := '{}'::jsonb;
    v_grant     JSONB;
    v_slot      INT;
    v_node      RECORD;
    v_marker    TEXT;
    v_markers   JSONB;
    v_pos       TEXT;
    v_salt      TEXT;
    v_award     JSONB;
    v_band      TEXT;
BEGIN
    SELECT * INTO v_run FROM travel_runs WHERE id = p_run FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'fn_drift_apply_deltas: run not found' USING ERRCODE = 'P0002';
    END IF;

    v_dz_cap := COALESCE((drift_tuning_value('dz_p0_cap'))::int, 20);
    SELECT bandwidth_class INTO v_class FROM traveler_profiles WHERE user_id = p_user;
    v_bb_max := COALESCE((drift_tuning_value('bandwidth_class_bb_max')
                          ->> COALESCE(v_class, 1)::text)::int, 11);
    v_salt := drift_run_salt(p_run);

    -- ── Numeric deltas (clamped to the columns' own CHECKs) ──────────────────
    IF p_deltas ? 'kh' THEN
        v_run.kohaerenz := LEAST(100, GREATEST(0, v_run.kohaerenz + (p_deltas ->> 'kh')::int));
        v_applied := v_applied || jsonb_build_object('kh', (p_deltas ->> 'kh')::int);
    END IF;
    IF p_deltas ? 'bb' THEN
        v_run.bandbreite := LEAST(v_bb_max, GREATEST(0, v_run.bandbreite + (p_deltas ->> 'bb')::int));
        v_applied := v_applied || jsonb_build_object('bb', (p_deltas ->> 'bb')::int);
    END IF;
    IF p_deltas ? 'dz' THEN
        v_run.dissonanz := LEAST(v_dz_cap, GREATEST(0, v_run.dissonanz + (p_deltas ->> 'dz')::int));
        v_applied := v_applied || jsonb_build_object('dz', (p_deltas ->> 'dz')::int);
    END IF;
    IF p_deltas ? 'takt' THEN
        v_run.window_remaining := GREATEST(0, v_run.window_remaining + (p_deltas ->> 'takt')::int);
        v_applied := v_applied || jsonb_build_object('takt', (p_deltas ->> 'takt')::int);
    END IF;

    -- ── Siegel: credit only, through the single ledger writer (264) ──────────
    IF p_deltas ? 'siegel' AND (p_deltas ->> 'siegel')::int > 0 THEN
        v_award := fn_drift_award(p_user, p_source, (p_deltas ->> 'siegel')::int, 0, p_run);
        v_applied := v_applied || jsonb_build_object('siegel', (p_deltas ->> 'siegel')::int,
                                                     'siegel_balance', v_award -> 'siegel_balance');
    END IF;

    -- ── Fund freight: the manifest row IS the haul ───────────────────────────
    -- No second booking. travel_cargo.haul_value is one of the three sources of travel_runs.haul
    -- (264/§3.2), so this INSERT raises the haul through the trigger and a later Notabwurf
    -- lowers it again by deleting the row. Nothing has to be kept in step with anything.
    IF p_deltas ? 'cargo_grant' THEN
        v_grant := p_deltas -> 'cargo_grant';
        SELECT COALESCE(max(manifest_slot), -1) + 1 INTO v_slot
          FROM travel_cargo WHERE run_id = p_run;
        INSERT INTO travel_cargo (owner_user_id, run_id, family, vector, manifest_slot, haul_value)
        VALUES (p_user, p_run, v_grant ->> 'family', v_grant ->> 'vector',
                v_slot, (v_grant ->> 'haul')::int);
        v_applied := v_applied || jsonb_build_object('cargo_grant', v_grant);
    END IF;

    -- ── Rumour: one undiscovered node lifted out of the fog (R12) ────────────
    IF p_deltas ? 'rumor_reveal' THEN
        v_band := NULLIF(p_deltas #>> '{rumor_reveal,band}', '');
        SELECT n.id, n.stable_key, n.distance_band INTO v_node
          FROM drift_chart_nodes n
         WHERE n.chart_version = v_run.chart_version
           AND (v_band IS NULL OR n.distance_band = v_band)
           AND NOT EXISTS (
                SELECT 1 FROM traveler_discoveries d
                 WHERE d.user_id = p_user AND d.node_stable_key = n.stable_key)
         ORDER BY drift_rand(v_salt || ':rumor:' || v_run.takt_count::text || ':' || n.stable_key)
         LIMIT 1;

        IF v_node.id IS NOT NULL THEN
            INSERT INTO traveler_discoveries
                (user_id, node_stable_key, chart_version_first_seen, source)
            VALUES (p_user, v_node.stable_key, v_run.chart_version, 'route_knowledge')
            ON CONFLICT (user_id, node_stable_key) DO NOTHING;

            INSERT INTO travel_log_entries (user_id, run_id, takt, kind, node_id, payload)
            VALUES (p_user, p_run, v_run.takt_count, 'rumor', v_node.id,
                    jsonb_build_object('source', p_source, 'stable_key', v_node.stable_key,
                                       'band', v_node.distance_band));
            v_applied := v_applied || jsonb_build_object(
                'rumor_reveal', jsonb_build_object('node_id', v_node.id,
                                                   'band', v_node.distance_band));
        END IF;
        -- No undiscovered node left is NOT an error — the traveller has charted the Drift, and
        -- the rumour simply confirms what they already know.
    END IF;

    -- ── Marker: a mark on THIS node, for the Sondierung to find (268) ────────
    IF p_deltas ? 'marker_add' THEN
        v_marker  := p_deltas ->> 'marker_add';
        v_pos     := v_run.position_node_id::text;
        v_markers := v_run.markers;
        v_run.markers := v_markers || jsonb_build_object(
            v_pos, COALESCE(v_markers -> v_pos, '[]'::jsonb) || to_jsonb(v_marker));
        v_applied := v_applied || jsonb_build_object('marker_add', v_marker);
    END IF;

    -- FILE THE RECEIPT. Every payer writes checkpoint.earnings in the one shape the HUD's
    -- count-up ceremony reads (EarningsBlock, 264) — an Entladung does, a delivered Depesche
    -- does. The signal payer did not, and it is the wave's MOST FREQUENT one: a passive Fund or
    -- Gerücht pays real Siegel on the move itself and opens no panel, so without a receipt the
    -- client has nothing to notice and the ledger strip keeps showing the old balance until
    -- some unrelated act happens to refresh it. Silent money is the emptiness W2 exists to end.
    -- `earnings` is rebuilt per move (fn_travel_move's checkpoint rebuild drops it), so it
    -- always describes the act the traveller just performed and never an older one.
    UPDATE travel_runs SET
        kohaerenz        = v_run.kohaerenz,
        bandbreite       = v_run.bandbreite,
        dissonanz        = v_run.dissonanz,
        window_remaining = v_run.window_remaining,
        markers          = v_run.markers,
        checkpoint       = checkpoint
                           || CASE WHEN v_award IS NULL THEN '{}'::jsonb
                                   ELSE jsonb_build_object('earnings', v_award) END
     WHERE id = p_run
    RETURNING * INTO v_run;

    -- The award is returned SEPARATELY and not left for the caller to fish out of the
    -- checkpoint: fn_travel_move rebuilds the checkpoint after this call and has to know
    -- whether THIS act paid — reading `checkpoint.earnings` back would hand it the receipt of
    -- the PREVIOUS move whenever this one paid nothing, and the HUD would replay a ceremony
    -- for money that did not move.
    RETURN jsonb_build_object('run', to_jsonb(v_run), 'applied', v_applied)
        || CASE WHEN v_award IS NULL THEN '{}'::jsonb
                ELSE jsonb_build_object('earnings', v_award) END;
END;
$$;

COMMENT ON FUNCTION public.fn_drift_apply_deltas(UUID, UUID, JSONB, TEXT) IS
    'The single applier of the closed signal-outcome vocabulary (kh, bb, dz, takt, siegel, cargo_grant, rumor_reveal, marker_add — migration 266''s schema). One writer, one set of clamps (the columns'' own CHECKs made explicit), one place to extend. Siegel goes through fn_drift_award (the only ledger writer) and files an `earnings` receipt, because a passive Fund pays real money and opens no panel — silent money is the emptiness W2 exists to end. A Fund''s freight IS its haul (travel_cargo.haul_value is one of the three sources of travel_runs.haul), so nothing here books the haul a second time — which is what retired the mirrored snapshot bug. INTERNAL-class: service_role only.';

REVOKE ALL    ON FUNCTION public.fn_drift_apply_deltas(UUID, UUID, JSONB, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_drift_apply_deltas(UUID, UUID, JSONB, TEXT) TO service_role;


-- ═══════════════════════════════════════════════════════════════════
-- 8. fn_travel_move — ein Takt, und er sagt endlich etwas
-- ═══════════════════════════════════════════════════════════════════
-- The final form (W2.6/C — it used to live in three files at once).
--
--   (a) PENDING-SIGNAL GUARD: a run standing in a Störung cannot simply walk away from it.
--       Inside the gate only — with the gate closed the key is DRAINED by the checkpoint
--       rebuild instead of trapping the run.
--   (b) M9 DZ-ESCALATION: from dz_late_window.from_takt on, every further move costs extra
--       Dissonanz. The way home is the expensive stretch.
--   (c) THE DRAW: after the move's own costs, before the floor. A passive signal
--       (Fund/Gerücht/Stille) is applied on the spot and logged; an interactive one
--       (Störung/Begegnung) is parked in checkpoint.pending_signal and the run waits.
--   (d) The floor is checked AFTER the passive outcome, because a Fund heavy enough to crack
--       the hull is allowed to crack it — but a move that was ALREADY collapsing draws nothing
--       (the Drift has spoken; a signal panel on top of a Havarie panel is two scenes for one
--       moment).
--   (e) deep_surge fires ONLY with the gate closed — with the Fun-Kern on it is a Störung
--       skeleton (stoerung_frequenzscherung), with a name and an answer.
--
-- The checkpoint rebuild at the bottom is now SAFE: everything run-level is a column
-- (haul_survey, visited, markers, sondierung, overstay, haul_safe), so there is nothing left
-- in the checkpoint that a rebuild could forget. That is the whole of W2.6/D in one statement.

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
    v_survey     INT := 0;
    v_dz_bleed   JSONB;
    v_surge_cfg  JSONB;
    v_scatter    JSONB;
    v_fun_core   BOOLEAN;
    v_overstay   BOOLEAN;
    v_cause      TEXT;
    v_late       JSONB;
    v_bands      JSONB;
    v_overload   BOOLEAN := FALSE;
    v_cargo_n    INT;
    v_slots      INT;
    v_class      INT;
    v_signal     JSONB;
    v_pending    JSONB := NULL;
    v_delta_res  JSONB;
    v_applied    JSONB := NULL;
    v_earnings   JSONB := NULL;
    v_haul       INT;
    v_haul_lost  INT;
    v_collapsing BOOLEAN;
BEGIN
    IF (SELECT auth.uid()) IS DISTINCT FROM p_user THEN
        RAISE EXCEPTION 'fn_travel_move: caller is not the run owner' USING ERRCODE = '42501';
    END IF;

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

    v_fun_core := drift_gate_enabled('drift_fun_core_enabled');
    v_overstay := v_run.overstay;

    -- (a) A scene the traveller has not answered blocks the next move. Gate-off runs ignore a
    -- leftover pending_signal entirely (and the rebuilt checkpoint drops it).
    IF v_fun_core AND v_run.checkpoint ? 'pending_signal' THEN
        RAISE EXCEPTION 'SIGNAL_PENDING' USING ERRCODE = '22023';
    END IF;

    -- Adjacency.
    SELECT weight, permeability INTO v_weight, v_perm FROM drift_chart_edges
     WHERE chart_version = v_run.chart_version
       AND ((from_node = v_run.position_node_id AND to_node = p_to_node)
         OR (to_node   = v_run.position_node_id AND from_node = p_to_node))
     LIMIT 1;
    IF v_weight IS NULL THEN
        RAISE EXCEPTION 'NOT_ADJACENT' USING ERRCODE = '22023';
    END IF;

    -- Frequency multiplier (on-vector vs the affinity-banded off-vector penalty).
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

    -- Pay: Bandbreite if affordable, else Notfrequenz (Kohärenz per edge).
    IF v_run.bandbreite >= v_bb_cost THEN
        v_run.bandbreite := v_run.bandbreite - v_bb_cost;
    ELSE
        v_notfreq := TRUE;
        v_run.kohaerenz := GREATEST(0, v_run.kohaerenz
            - COALESCE((drift_tuning_value('notfreq_kh_per_edge'))::int, 2));
    END IF;

    SELECT distance_band, simulation_id, node_type INTO v_band, v_to_sim, v_to_type
      FROM drift_chart_nodes WHERE id = p_to_node AND chart_version = v_run.chart_version;
    SELECT anchor_simulation_id INTO v_anchor FROM traveler_profiles WHERE user_id = p_user;
    SELECT n.id INTO v_home FROM drift_chart_nodes n
     WHERE n.simulation_id = v_anchor AND n.node_type = 'broadcast_rand'
       AND n.chart_version = v_run.chart_version;

    -- One Takt of the Aufenthaltsfenster (an overstaying run has none left to spend).
    v_run.window_remaining := GREATEST(0, v_run.window_remaining - 1);

    -- Dissonanz by band, capped; above the bleed threshold it erodes Kohärenz.
    v_dz_add := COALESCE((drift_tuning_value('dz_per_move_by_band') ->> COALESCE(v_band, 'near'))::int, 1);
    v_dz_cap := COALESCE((drift_tuning_value('dz_p0_cap'))::int, 74);

    -- (b) M9: the late run costs more. The Drift tightens its grip the longer you stay.
    IF v_fun_core THEN
        v_late := drift_tuning_value('dz_late_window');
        IF v_late IS NOT NULL
           AND (v_run.takt_count + 1) >= COALESCE((v_late ->> 'from_takt')::int, 8) THEN
            v_dz_add := v_dz_add + COALESCE((v_late ->> 'extra')::int, 1);
        END IF;
    END IF;

    -- Overstay tax (M3): staying past the permit is not free — the Bleed notices. This is what
    -- eventually ends an overstay, and it ends it through Kohärenz, not a clock.
    IF v_fun_core AND v_overstay THEN
        v_dz_add := v_dz_add
            + COALESCE((drift_tuning_value('havarie_options') #>> '{ueberziehen,dz_per_takt}')::int, 5);
    END IF;

    v_run.dissonanz := LEAST(v_dz_cap, v_run.dissonanz + v_dz_add);
    v_dz_bleed := drift_tuning_value('dz_kh_bleed');
    IF v_dz_bleed IS NOT NULL AND v_run.dissonanz >= (v_dz_bleed ->> 'threshold')::int THEN
        v_run.kohaerenz := GREATEST(0, v_run.kohaerenz - (v_dz_bleed ->> 'amount')::int);
    END IF;

    -- (e) Deep-Drift surge — the gate-OFF path only. With the Fun-Kern on, the same damage
    -- arrives as `stoerung_frequenzscherung`: named, written, answerable.
    IF NOT v_fun_core AND v_band = 'deep' THEN
        v_surge_cfg := drift_tuning_value('deep_surge');
        IF v_surge_cfg IS NOT NULL AND random() < (v_surge_cfg ->> 'chance')::numeric THEN
            v_surge := TRUE;
            v_run.dissonanz := LEAST(v_dz_cap, v_run.dissonanz + (v_surge_cfg ->> 'dz')::int);
            v_run.kohaerenz := GREATEST(0, v_run.kohaerenz - (v_surge_cfg ->> 'kh')::int);
        END IF;
    END IF;

    -- Vermessung on first arrival (band value + the foreign-dock prize). It lands in
    -- `haul_survey` — the one source of the loose haul that has no other ledger behind it.
    IF NOT (v_run.visited @> to_jsonb(p_to_node::text)) THEN
        v_survey := COALESCE((drift_tuning_value('survey_value_by_band') ->> COALESCE(v_band, 'near'))::int, 0);
        IF v_to_type = 'broadcast_rand' AND v_to_sim IS DISTINCT FROM v_anchor THEN
            v_survey := v_survey + COALESCE((drift_tuning_value('foreign_dock_bonus'))::int, 0);
        END IF;
        v_run.haul_survey := v_run.haul_survey + v_survey;
        v_run.visited     := v_run.visited || to_jsonb(p_to_node::text);
    END IF;

    -- Would this move END the run on its own? (Kohärenz 0 anywhere; an expired window away from
    -- home, unless an overstay permit says otherwise.)
    v_collapsing := v_run.kohaerenz <= 0
        OR (v_run.window_remaining <= 0
            AND NOT (v_fun_core AND v_overstay)
            AND p_to_node IS DISTINCT FROM v_home);

    -- ── (c) THE DRAW ─────────────────────────────────────────────────────────────
    IF v_fun_core AND NOT v_collapsing THEN
        -- Persist the move's state first: the draw's helpers READ AND WRITE the run row (the
        -- rissig flag, the deltas, the markers, the rumour log), and they must see the
        -- post-move numbers.
        --
        -- Before W2.6 this was the site of a P0: `haul` lived in the checkpoint, the caller
        -- held it in a local variable, and fn_drift_apply_deltas re-read it from the COLUMN,
        -- added its grant and wrote it back — silently rolling back the first-arrival
        -- Vermessung of THIS move, while `visited` still recorded the node so it could never
        -- pay again. The haul is DERIVED now (264/§3.2) and nobody holds it in a local, so the
        -- class of bug is gone; the row still has to be persisted, but only because the helpers
        -- read it.
        UPDATE travel_runs SET
            kohaerenz        = v_run.kohaerenz,
            bandbreite       = v_run.bandbreite,
            dissonanz        = v_run.dissonanz,
            window_remaining = v_run.window_remaining,
            position_node_id = p_to_node,
            haul_survey      = v_run.haul_survey,
            visited          = v_run.visited
         WHERE id = p_run;

        SELECT count(*) INTO v_cargo_n FROM travel_cargo WHERE run_id = p_run;
        SELECT bandwidth_class INTO v_class FROM traveler_profiles WHERE user_id = p_user;
        v_slots := COALESCE((drift_tuning_value('manifest_free_slots')
                             ->> COALESCE(v_class, 1)::text)::int, 2);
        v_overload := v_cargo_n > v_slots;

        v_bands := drift_signal_bands(v_run.kohaerenz, v_run.dissonanz,
                                      v_run.window_remaining, v_overload);

        v_signal := fn_drift_signal_draw(
            p_run, p_user, v_band, v_run.takt_count + 1, v_bands,
            v_run.kohaerenz, v_run.bandbreite, v_run.window_remaining,
            v_run.chart_version, v_anchor);

        IF v_signal IS NOT NULL THEN
            IF v_signal ->> 'signal_class' IN ('stoerung', 'begegnung') THEN
                -- The run WAITS. Nothing is applied yet — the decision is the content.
                v_pending := v_signal;
                INSERT INTO travel_telemetry_events (user_id, event_key, run_id, payload)
                VALUES (p_user, 'drift_signal_shown', p_run,
                        jsonb_build_object('template_key', v_signal ->> 'template_key',
                                           'class', v_signal ->> 'signal_class',
                                           'band', v_band));
            ELSE
                -- Passive: applied on the spot, one log line, no modal.
                v_delta_res := fn_drift_apply_deltas(
                    p_user, p_run,
                    COALESCE(v_signal #> '{auto,deltas}', '{}'::jsonb),
                    'signal:' || (v_signal ->> 'template_key'));
                v_applied  := v_delta_res -> 'applied';
                -- Only THIS act's receipt, never the checkpoint's (which still holds the
                -- previous move's, until the rebuild below drops it).
                v_earnings := v_delta_res -> 'earnings';

                -- Re-read: the deltas may have moved KH/BB/DZ/window, the markers and the haul.
                SELECT * INTO v_run FROM travel_runs WHERE id = p_run;

                INSERT INTO travel_log_entries (user_id, run_id, takt, kind, node_id, payload)
                VALUES (p_user, p_run, v_run.takt_count + 1, 'signal', p_to_node,
                        jsonb_build_object(
                            'template_key', v_signal ->> 'template_key',
                            'class',        v_signal ->> 'signal_class',
                            'prose',        v_signal -> 'prose',
                            'outcome',      v_signal -> 'auto',
                            'applied',      v_applied));

                INSERT INTO travel_telemetry_events (user_id, event_key, run_id, payload)
                VALUES (p_user, 'drift_signal_shown', p_run,
                        jsonb_build_object('template_key', v_signal ->> 'template_key',
                                           'class', v_signal ->> 'signal_class',
                                           'band', v_band, 'passive', TRUE));

                -- (d) A find heavy enough to crack the hull is allowed to crack it.
                v_collapsing := v_run.kohaerenz <= 0
                    OR (v_run.window_remaining <= 0
                        AND NOT v_overstay
                        AND p_to_node IS DISTINCT FROM v_home);
            END IF;
        END IF;
    END IF;

    -- The loose haul as it stands NOW. Computed from the local row + the manifest rather than
    -- read off v_run.haul: in the branches that never re-read the row (an interactive signal,
    -- or a move that was collapsing before the draw) v_run.haul is the value from BEFORE this
    -- move's first-arrival Vermessung, and a Havarie panel that under-states what is at risk is
    -- a lie at the worst possible moment. drift_haul_of() is the same arithmetic the column's
    -- trigger uses — there is only ever one definition of the haul.
    v_haul := drift_haul_of(v_run.haul_survey, v_run.sondierung, p_run);

    -- ── The floor ────────────────────────────────────────────────────────────────
    IF v_collapsing THEN
        v_cause := CASE WHEN v_run.kohaerenz <= 0 THEN 'kohaerenz' ELSE 'window' END;

        IF v_fun_core THEN
            -- HAVARIE: the run stops where it is. Nothing is lost yet — the cargo is still
            -- aboard, the haul is still on the books, and the traveller decides.
            UPDATE travel_runs SET
                position_node_id = p_to_node,          -- you are stranded WHERE YOU ARE
                status           = 'havarie',
                bandbreite       = v_run.bandbreite,
                kohaerenz        = v_run.kohaerenz,
                dissonanz        = v_run.dissonanz,
                window_remaining = GREATEST(0, v_run.window_remaining),
                haul_survey      = v_run.haul_survey,
                visited          = v_run.visited,
                takt_count       = takt_count + 1,
                event_seq        = event_seq + 1,
                run_version      = run_version + 1,
                checkpoint       = jsonb_build_object(
                    'havarie', drift_havarie_payload(
                        p_run, v_cause, v_haul, GREATEST(0, v_run.window_remaining)))
            WHERE id = p_run
            RETURNING * INTO v_run;

            INSERT INTO travel_telemetry_events (user_id, event_key, run_id, payload)
            VALUES (p_user, 'drift_decision', p_run,
                jsonb_build_object('kind', 'havarie_opened', 'cause', v_cause));
            INSERT INTO travel_log_entries (user_id, run_id, takt, kind, node_id, payload)
            VALUES (p_user, p_run, v_run.takt_count, 'havarie', p_to_node,
                    jsonb_build_object('cause', v_cause, 'haul_at_risk', v_haul));
            PERFORM travel_audit(p_user, 'travel_havarie_open', 'travel_run', p_run, NULL,
                jsonb_build_object('cause', v_cause, 'haul_at_risk', v_haul,
                                   'signal', v_signal ->> 'template_key'));
            RETURN to_jsonb(v_run);
        END IF;

        -- Gate closed → the P0 snap: home, abandoned, haul forfeit, cargo scattered.
        -- The forfeit goes through the ONE consumer (264/§3.4), which both hands back the
        -- number the receipt needs and empties all three sub-ledgers — so the cargo DELETE the
        -- close-cleanup trigger fires below carries no haul with it.
        UPDATE travel_runs SET
            haul_survey = v_run.haul_survey,
            visited     = v_run.visited
         WHERE id = p_run;
        v_haul_lost := drift_haul_settle(p_run, 0);
        v_scatter   := fn_drift_scatter_cargo(p_run, p_user, v_anchor);

        UPDATE travel_runs SET
            position_node_id = COALESCE(v_home, position_node_id),
            status           = 'abandoned',
            closed_at        = now(),
            bandbreite       = v_run.bandbreite,
            kohaerenz        = v_run.kohaerenz,
            dissonanz        = v_run.dissonanz,
            window_remaining = GREATEST(0, v_run.window_remaining),
            takt_count       = takt_count + 1,
            event_seq        = event_seq + 1,
            run_version      = run_version + 1,
            checkpoint       = jsonb_build_object('closing', drift_closing_payload(
                'kollaps', v_cause, NULL,
                0, v_haul_lost, 0,
                NULL, NULL, NULL, v_scatter, FALSE))
        WHERE id = p_run
        RETURNING * INTO v_run;

        INSERT INTO travel_telemetry_events (user_id, event_key, run_id)
        VALUES (p_user, 'drift_zerfaserung', p_run);
        PERFORM travel_audit(p_user, 'travel_recall', 'travel_run', p_run, NULL,
            jsonb_build_object('reason', v_cause, 'haul_lost', v_haul_lost,
                               'attempted_to', p_to_node,
                               'scattered', COALESCE((v_scatter ->> 'scattered')::int, 0)));
        RETURN to_jsonb(v_run);
    END IF;

    -- ── Advance ──────────────────────────────────────────────────────────────────
    -- The checkpoint is REBUILT — and that is safe now, because everything run-level is a
    -- column. What is rebuilt away is exactly what should be: last_move (of the PREVIOUS
    -- move), a stale earnings receipt, a drained pending_signal, last_signal, last_sondierung,
    -- last_bank, last_havarie. What just happened, not what is true.
    --
    -- `markers` is deliberately NOT in the SET list: fn_drift_apply_deltas may have just added
    -- a Störung's marker to the column, and re-writing v_run's copy would undo it. Columns are
    -- what make that a one-line concern instead of a whitelist.
    UPDATE travel_runs SET
        position_node_id = p_to_node,
        bandbreite       = v_run.bandbreite,
        kohaerenz        = v_run.kohaerenz,
        dissonanz        = v_run.dissonanz,
        window_remaining = v_run.window_remaining,
        haul_survey      = v_run.haul_survey,
        visited          = v_run.visited,
        takt_count       = takt_count + 1,
        event_seq        = event_seq + 1,
        run_version      = run_version + 1,
        checkpoint       = jsonb_build_object(
                'last_move', jsonb_build_object('from', v_run.position_node_id, 'bb_cost', v_bb_cost,
                                                'notfrequenz', v_notfreq, 'dz_add', v_dz_add,
                                                'surge', v_surge, 'survey', v_survey)
                    -- jsonb_build_object emits a NULL-valued key rather than omitting it, so
                    -- building the two signal keys unconditionally would leave "signal": null
                    -- in every gate-off checkpoint. A stray key is exactly how parity rots.
                    || CASE WHEN v_fun_core
                            THEN jsonb_build_object('signal', v_signal -> 'template_key',
                                                    'signal_applied', v_applied)
                            ELSE '{}'::jsonb END)
            || CASE WHEN v_pending IS NOT NULL
                    THEN jsonb_build_object('pending_signal', v_pending)
                    ELSE '{}'::jsonb END
            -- The passive signal's payout receipt survives its own move — and ONLY its own:
            -- v_earnings is what fn_drift_apply_deltas just paid (it hands the award back
            -- explicitly), not what the checkpoint happens to still hold from the last one. A
            -- Fund that pays Siegel and opens no panel is the silent money W2 exists to end; a
            -- ceremony replayed for money that did not move is the opposite mistake.
            || CASE WHEN v_earnings IS NOT NULL
                    THEN jsonb_build_object('earnings', v_earnings)
                    ELSE '{}'::jsonb END
    WHERE id = p_run
    RETURNING * INTO v_run;

    PERFORM travel_audit(p_user, 'travel_move', 'travel_run', p_run, NULL,
        jsonb_build_object('to_node', p_to_node, 'bb_cost', v_bb_cost, 'notfrequenz', v_notfreq,
                           'surge', v_surge, 'haul', v_run.haul, 'takt', v_run.takt_count,
                           'overstay', v_overstay,
                           'signal', v_signal ->> 'template_key'));

    RETURN to_jsonb(v_run);
END;
$$;

COMMENT ON FUNCTION public.fn_travel_move(UUID, UUID, INT, UUID) IS
    'One Takt of travel. PLAYER-class (auth.uid() guard, run_version CAS). With drift_fun_core_enabled: draws a SIGNAL every move (M1) — passive classes apply and log on the spot, interactive ones park in checkpoint.pending_signal and BLOCK the next move until fn_signal_resolve answers; adds the M9 late-window Dissonanz escalation; retires the anonymous deep_surge into the Störung class; opens a Havarie instead of snapping the run shut. Gate off: the 265 behaviour (deep_surge, snap-to-abandoned), and a leftover pending_signal is DRAINED rather than trapping the run. It REBUILDS the checkpoint on every advance — which is safe since W2.6 because every run-level fact (haul_survey, haul_safe, visited, markers, sondierung, overstay) is a COLUMN; the checkpoint holds only what SHOULD be forgotten next move.';

DO $$
BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.fn_travel_move(uuid, uuid, integer, uuid) FROM PUBLIC, anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.fn_travel_move(uuid, uuid, integer, uuid) TO authenticated, service_role';
END $$;


-- ═══════════════════════════════════════════════════════════════════
-- 9. fn_signal_resolve — der Reisende antwortet
-- ═══════════════════════════════════════════════════════════════════
-- The option's COST is paid whatever happens (the HUD promised it on the chip). The check, if
-- any, is rolled from the salted seed. The outcome's deltas go through the single applier. And
-- then the floor is checked again: a Störung that took the last of the hull ends the run in a
-- Havarie — that is what makes it a Störung and not a flavour text.
--
-- Execution reads the option from travel_signal_templates by key, NOT from the checkpoint: the
-- checkpoint copy exists so the panel can render labels and cost chips, and a copy the client
-- can see must never be the copy the server obeys.

CREATE OR REPLACE FUNCTION public.fn_signal_resolve(
    p_user        UUID,
    p_run         UUID,
    p_run_version INT,
    p_option_key  TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_run       travel_runs%ROWTYPE;
    v_pending   JSONB;
    v_tpl       travel_signal_templates%ROWTYPE;
    v_option    JSONB;
    v_cost      JSONB;
    v_check     JSONB;
    v_cfg       JSONB;
    v_affinity  INT;
    v_roll      INT;
    v_total     INT;
    v_success   BOOLEAN := TRUE;
    v_outcome   JSONB;
    v_applied   JSONB;
    v_salt      TEXT;
    v_home      UUID;
    v_anchor    UUID;
    v_cause     TEXT;
BEGIN
    IF (SELECT auth.uid()) IS DISTINCT FROM p_user THEN
        RAISE EXCEPTION 'fn_signal_resolve: caller is not the run owner' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_run FROM travel_runs WHERE id = p_run AND user_id = p_user FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'fn_signal_resolve: run not found' USING ERRCODE = 'P0002';
    END IF;

    v_pending := v_run.checkpoint -> 'pending_signal';

    -- Gate closed → DRAIN, never trap. The run keeps everything it has; only the scene it can
    -- no longer play is cleared, and no CAS token is demanded for the one exit out of a state
    -- the traveller cannot otherwise leave. (This drain is why the endpoint carries no HTTP
    -- gate — a router 404 would answer before the RPC ran and make it dead code. W2.6/A.)
    IF NOT drift_gate_enabled('drift_fun_core_enabled') THEN
        IF v_pending IS NULL THEN
            RAISE EXCEPTION 'GATE_CLOSED' USING ERRCODE = '22023';
        END IF;
        UPDATE travel_runs SET
            checkpoint  = checkpoint - 'pending_signal',
            run_version = run_version + 1
         WHERE id = p_run
        RETURNING * INTO v_run;
        RETURN to_jsonb(v_run) || jsonb_build_object('gate_drained', TRUE);
    END IF;

    IF v_run.status <> 'active' THEN
        RAISE EXCEPTION 'fn_signal_resolve: run is %, not active', v_run.status USING ERRCODE = '22023';
    END IF;
    IF v_run.run_version <> p_run_version THEN
        RAISE EXCEPTION 'RUN_STALE' USING ERRCODE = 'P0001';
    END IF;
    IF v_pending IS NULL THEN
        RAISE EXCEPTION 'NO_PENDING_SIGNAL' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_tpl FROM travel_signal_templates
     WHERE template_key = v_pending ->> 'template_key';
    IF NOT FOUND THEN
        -- The content was republished mid-run and this skeleton is gone. Drain the scene rather
        -- than stranding the run in it — content is republishable, a run in flight is not.
        UPDATE travel_runs SET
            checkpoint  = checkpoint - 'pending_signal',
            run_version = run_version + 1
         WHERE id = p_run
        RETURNING * INTO v_run;
        RETURN to_jsonb(v_run) || jsonb_build_object('signal_vanished', TRUE);
    END IF;

    -- A scene with NO resolvable option left is a trap, and content churn is how a run falls
    -- into one: the pack reseed is a TRUNCATE + re-insert, so an option key renamed (or its
    -- cost raised past what this run can still pay) while a traveller stands in the scene would
    -- leave every button they can see answering 400 — and `pending_signal` blocks the move, the
    -- dig AND the bank, so the only exit would be forfeiting the run. The W1 rule holds: a
    -- scene the traveller cannot leave must drain itself.
    IF NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_tpl.definition -> 'options') o
         WHERE drift_signal_affordable(o, v_run.kohaerenz, v_run.bandbreite,
                                       v_run.window_remaining)
    ) THEN
        UPDATE travel_runs SET
            checkpoint  = checkpoint - 'pending_signal',
            run_version = run_version + 1
         WHERE id = p_run
        RETURNING * INTO v_run;
        RETURN to_jsonb(v_run) || jsonb_build_object('scene_unresolvable', TRUE);
    END IF;

    -- Past this point at least one option IS payable, so a refusal is a real refusal: the
    -- traveller picked something that does not exist, or something they cannot afford while
    -- something else on the panel they can.
    SELECT o INTO v_option
      FROM jsonb_array_elements(v_tpl.definition -> 'options') o
     WHERE o ->> 'key' = p_option_key;
    IF v_option IS NULL THEN
        RAISE EXCEPTION 'UNKNOWN_OPTION' USING ERRCODE = '22023';
    END IF;

    IF NOT drift_signal_affordable(v_option, v_run.kohaerenz, v_run.bandbreite,
                                   v_run.window_remaining) THEN
        RAISE EXCEPTION 'OPTION_UNAFFORDABLE' USING ERRCODE = '22023';
    END IF;

    -- ── The cost: paid whatever the roll says ────────────────────────────────
    v_cost := v_option -> 'cost';
    IF v_cost IS NOT NULL THEN
        UPDATE travel_runs SET
            kohaerenz        = GREATEST(0, kohaerenz - COALESCE((v_cost ->> 'kh')::int, 0)),
            bandbreite       = GREATEST(0, bandbreite - COALESCE((v_cost ->> 'bb')::int, 0)),
            window_remaining = GREATEST(0, window_remaining - COALESCE((v_cost ->> 'takt')::int, 0))
         WHERE id = p_run
        RETURNING * INTO v_run;
    END IF;

    -- ── The check ────────────────────────────────────────────────────────────
    v_check := v_option -> 'check';
    IF v_check IS NOT NULL THEN
        v_cfg  := drift_tuning_value('signal_check');
        v_salt := drift_run_salt(p_run);
        v_affinity := COALESCE((SELECT (affinities ->> (v_check ->> 'vector'))::int
                                  FROM traveler_profiles WHERE user_id = p_user), 0);
        v_roll := drift_rand_int(
            v_salt || ':' || p_run::text || ':check:' || v_run.takt_count::text
                   || ':' || p_option_key,
            1, COALESCE((v_cfg ->> 'dice')::int, 10));
        v_total := v_roll + v_affinity
                 - floor(v_run.dissonanz / COALESCE((v_cfg ->> 'dz_divisor')::int, 10))::int;
        v_success := v_total >= (v_check ->> 'difficulty')::int;
        v_outcome := CASE WHEN v_success THEN v_option -> 'success' ELSE v_option -> 'failure' END;
    ELSE
        v_outcome := v_option -> 'result';
    END IF;

    -- ── The outcome ──────────────────────────────────────────────────────────
    v_applied := fn_drift_apply_deltas(p_user, p_run,
                                       COALESCE(v_outcome -> 'deltas', '{}'::jsonb),
                                       'signal:' || v_tpl.template_key) -> 'applied';

    SELECT * INTO v_run FROM travel_runs WHERE id = p_run;

    INSERT INTO travel_log_entries (user_id, run_id, takt, kind, node_id, payload)
    VALUES (p_user, p_run, v_run.takt_count, 'signal', v_run.position_node_id,
            jsonb_build_object(
                'template_key', v_tpl.template_key,
                'class',        v_tpl.signal_class,
                'prose',        v_pending -> 'prose',
                'option_key',   p_option_key,
                'outcome',      v_outcome,
                'cost',         v_cost,
                'check',        CASE WHEN v_check IS NULL THEN NULL ELSE
                                    jsonb_build_object('vector', v_check ->> 'vector',
                                                       'difficulty', (v_check ->> 'difficulty')::int,
                                                       'roll', v_roll, 'total', v_total,
                                                       'success', v_success) END,
                'applied',      v_applied));

    INSERT INTO travel_telemetry_events (user_id, event_key, run_id, payload)
    VALUES (p_user, 'drift_signal_resolved', p_run,
            jsonb_build_object('template_key', v_tpl.template_key,
                               'class', v_tpl.signal_class,
                               'option', p_option_key,
                               'checked', v_check IS NOT NULL,
                               'success', v_success));

    PERFORM travel_audit(p_user, 'travel_signal_resolve', 'travel_run', p_run, NULL,
        jsonb_build_object('template_key', v_tpl.template_key, 'option', p_option_key,
                           'success', v_success, 'applied', v_applied));

    -- ── The floor, again: a Störung is allowed to end a run ──────────────────
    SELECT anchor_simulation_id INTO v_anchor FROM traveler_profiles WHERE user_id = p_user;
    SELECT n.id INTO v_home FROM drift_chart_nodes n
     WHERE n.simulation_id = v_anchor AND n.node_type = 'broadcast_rand'
       AND n.chart_version = v_run.chart_version;

    IF v_run.kohaerenz <= 0
       OR (v_run.window_remaining <= 0
           AND NOT v_run.overstay
           AND v_run.position_node_id IS DISTINCT FROM v_home) THEN

        v_cause := CASE WHEN v_run.kohaerenz <= 0 THEN 'kohaerenz' ELSE 'window' END;

        UPDATE travel_runs SET
            status      = 'havarie',
            event_seq   = event_seq + 1,
            run_version = run_version + 1,
            checkpoint  = (checkpoint - 'pending_signal')
                || jsonb_build_object('havarie', drift_havarie_payload(
                       p_run, v_cause, v_run.haul, v_run.window_remaining))
         WHERE id = p_run
        RETURNING * INTO v_run;

        INSERT INTO travel_telemetry_events (user_id, event_key, run_id, payload)
        VALUES (p_user, 'drift_decision', p_run,
                jsonb_build_object('kind', 'havarie_opened', 'cause', v_cause,
                                   'from_signal', v_tpl.template_key));
        INSERT INTO travel_log_entries (user_id, run_id, takt, kind, node_id, payload)
        VALUES (p_user, p_run, v_run.takt_count, 'havarie', v_run.position_node_id,
                jsonb_build_object('cause', v_cause, 'haul_at_risk', v_run.haul,
                                   'from_signal', v_tpl.template_key));
        PERFORM travel_audit(p_user, 'travel_havarie_open', 'travel_run', p_run, NULL,
            jsonb_build_object('cause', v_cause, 'haul_at_risk', v_run.haul,
                               'from_signal', v_tpl.template_key));

        RETURN to_jsonb(v_run);
    END IF;

    -- The scene is over: the run is free to move again.
    UPDATE travel_runs SET
        checkpoint  = (checkpoint - 'pending_signal')
            -- The key is `signal_class`, NOT `class`: this block is lifted straight into a typed
            -- field (models/drift.ResolvedSignal) and has to speak the same vocabulary as
            -- `pending_signal` does. A second name for the same fact is how a checkpoint becomes
            -- an undocumented API — and it broke every GET on the run, because the model
            -- validates the whole row, not just the mutation's answer. (test_drift_run_contract
            -- exists to catch the next one.)
            || jsonb_build_object('last_signal', jsonb_build_object(
                   'template_key', v_tpl.template_key,
                   'signal_class', v_tpl.signal_class,
                   'option_key',   p_option_key,
                   'success',      v_success,
                   'outcome',      v_outcome,
                   'applied',      v_applied)),
        event_seq   = event_seq + 1,
        run_version = run_version + 1
     WHERE id = p_run
    RETURNING * INTO v_run;

    RETURN to_jsonb(v_run);
END;
$$;

COMMENT ON FUNCTION public.fn_signal_resolve(UUID, UUID, INT, TEXT) IS
    'Answer a pending Störung/Begegnung (M1). PLAYER-class (auth.uid() guard, run_version CAS, gate-checked in SQL). Pays the option''s up-front cost whatever the roll says (the HUD promised it on the chip), rolls the check from the salted seed (an unsalted roll would be precomputable and there would be no luck to push), applies the outcome through fn_drift_apply_deltas, writes a logbook line + telemetry + audit, and re-checks the floor: a Störung that takes the last of the hull ends the run in a Havarie. Executes from travel_signal_templates, NOT from the checkpoint copy — the copy the client can see must never be the copy the server obeys. Gate closed: DRAINS the pending scene instead of trapping the run in it. Three further self-drains guard the traps content churn can open: a vanished skeleton, a scene whose every option became unpayable, and a stale CAS on the drain path.';

REVOKE ALL    ON FUNCTION public.fn_signal_resolve(UUID, UUID, INT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_signal_resolve(UUID, UUID, INT, TEXT) TO authenticated, service_role;

COMMIT;

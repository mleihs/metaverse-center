-- Migration 239: DRIFT — travel_foundation (P0a substrate)
--
-- Spec: docs/plans/drift-implementation-plan.md §3.1 (table catalog),
--       §4 (travel_audit helper), §5 (RLS posture), §13.2 (phase gates),
--       §10 (hospitality), §19 (P0 vertical slice).
-- Design contract: docs/concepts/drift-zwischenraum-travel-game-concept.md v0.4.
--
-- This is the first of the DRIFT P0a migrations (239→247). It ships the
-- player-state substrate every later package builds on, and lands entirely
-- behind the `drift_p0_enabled=false` gate seeded here — no runtime behavior
-- changes until the gate is raised (plan §22).
--
-- Tables:
--   traveler_profiles        — one per user; clearance / resources / affinities /
--                              the QBN player-quality channel (`qualities`, KPI 5
--                              carve-out). anchor_simulation_id is membership-
--                              required (decision §22.2).
--   travel_runs              — the per-session run row. Numeric resources are CAS
--                              columns (ADR-007); narrative/positional state is the
--                              `checkpoint` jsonb written by the same RPC in the
--                              same transaction (resolves gate-review U1). A
--                              `run_version` optimistic lock governs multi-device
--                              access (plan §6.2) — the dungeon engine's sole-writer
--                              assumption is NOT inherited.
--   travel_telemetry_events  — closed-set, server-written KPI 3/4 instrumentation.
--
-- The 7 bleed vectors (concept §6.1): commerce, language, memory, resonance,
-- architecture, dream, desire. P0 runs on the memory/architecture pair (§19).
--
-- travel_audit() — SQL helper that INSERTs into the existing audit_log, called
-- in-transaction inside every mutating travel RPC so the all-mutations audit rule
-- gets no Python-only escape hatch (finding 7). Design reconciliation (plan §3.1
-- signature vs §5 threat model): the function takes p_user (service_role /
-- scheduler call sites run with auth.uid()=NULL and must pass the acting traveler
-- explicitly), is REVOKEd from anon/authenticated so players cannot reach it to
-- forge a row, and namespace-locks p_action to the `travel_` prefix so even a
-- misuse from an authorized context can only ever write a truthful, travel-scoped
-- audit row. This is the substance of §5 ("a direct call can only ever write a
-- truthful row about the caller") with the §3.1 signature kept intact.
--
-- Cross-migration FKs (deferred by build order): travel_runs.position_node_id and
-- travel_runs.chart_version reference drift_chart_nodes / chart_versions, which are
-- created in migration 240 (`drift_chart`). The FK constraints are added there via
-- ALTER TABLE — declared here as plain columns. Documented in both headers.
--
-- Seeds:
--   platform_settings  — drift_p0..p4_enabled, drift_ai_enabled,
--                        drift_emergency_return, all canonical jsonb `false`
--                        (read fail-closed via parse_setting_bool).
--   simulation_settings — hospitality key `drift_hospitality` = "nur_echos" for
--                        every active template simulation (the 8.7 default as data,
--                        not a code fallback; an absent row reads `geschlossen`,
--                        plan §10).
--
-- Active-view refresh: none required (no changes to agents/buildings/simulations/
-- events columns).


-- ═══════════════════════════════════════════════════════════════════
-- 1. traveler_profiles — one row per user (the persistent Träger record)
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE traveler_profiles (
    user_id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    -- Membership-required anchor (decision §22.2). RESTRICT, not CASCADE: a
    -- traveler's home simulation must not be hard-deleted out from under their
    -- progress; deletion is handled deliberately, never as an FK side-effect.
    anchor_simulation_id  UUID NOT NULL REFERENCES simulations(id) ON DELETE RESTRICT,
    -- Moderated UGC on set/change (plan §15); visible from P1b presence.
    callsign              TEXT UNIQUE,
    callsign_set_at       TIMESTAMPTZ,
    clearance_rank        TEXT NOT NULL DEFAULT 'aspirant'
                              CHECK (clearance_rank IN (
                                  'aspirant',       -- Aspirant
                                  'feldkartograph', -- Feldkartograph
                                  'vermesser',      -- Vermesser
                                  'grenzgaenger',   -- Grenzgänger
                                  'kartograph_1k'   -- Kartograph 1. Klasse
                              )),
    vp                    INTEGER NOT NULL DEFAULT 0 CHECK (vp >= 0),       -- Vermessungspunkte
    siegel                INTEGER NOT NULL DEFAULT 0 CHECK (siegel >= 0),   -- no player-to-player transfer channel exists
    bandwidth_class       INTEGER NOT NULL DEFAULT 1 CHECK (bandwidth_class BETWEEN 1 AND 4),
    -- Frequenzprofil: affinity 0–5 per vector (plan §2.8). All 7 keys present.
    affinities            JSONB NOT NULL DEFAULT
                              '{"commerce":0,"language":0,"memory":0,"resonance":0,"architecture":0,"dream":0,"desire":0}'::jsonb,
    -- QBN player-quality channel (KPI 5 carve-out): scars/threads/flags the
    -- storylet layer reads & writes. Explicitly out of KPI 5's world-state scope;
    -- pack-schema-validated, audited separately.
    qualities             JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Progressive disclosure (plan §2.8): starts with the home pair, grows per the
    -- clearance ladder. Default is the P0 corridor pair; the profile-init RPC
    -- (P0c+) sets it from the anchor sim's dominant bleed vectors.
    unlocked_vectors      TEXT[] NOT NULL DEFAULT ARRAY['memory', 'architecture']::text[],
    zerfaserung_count     INTEGER NOT NULL DEFAULT 0 CHECK (zerfaserung_count >= 0),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_traveler_profiles_anchor ON traveler_profiles (anchor_simulation_id);


-- ═══════════════════════════════════════════════════════════════════
-- 2. travel_runs — the per-session run (CAS resources + checkpoint jsonb)
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE travel_runs (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status                 TEXT NOT NULL DEFAULT 'active'
                               CHECK (status IN (
                                   'active', 'frozen', 'distress',
                                   'finalizing', 'completed', 'abandoned'
                               )),
    -- Optimistic lock for multi-device concurrency (plan §6.2). Every mutating
    -- RPC carries p_run_version and fails RUN_STALE on mismatch.
    run_version            INTEGER NOT NULL DEFAULT 1 CHECK (run_version >= 1),
    -- CAS resource columns (ADR-007). Ranges per plan §2.1.
    kohaerenz              INTEGER NOT NULL DEFAULT 100 CHECK (kohaerenz BETWEEN 0 AND 100),
    bandbreite             INTEGER NOT NULL DEFAULT 0  CHECK (bandbreite >= 0),  -- set to class max by fn_travel_run_open
    dissonanz              INTEGER NOT NULL DEFAULT 0  CHECK (dissonanz BETWEEN 0 AND 100),  -- P0 hard-caps at 74 in the RPCs
    frequency              TEXT NOT NULL DEFAULT 'memory'
                               CHECK (frequency IN (
                                   'commerce', 'language', 'memory', 'resonance',
                                   'architecture', 'dream', 'desire'
                               )),
    position_node_id       UUID,   -- FK → drift_chart_nodes(id) added in migration 240
    scale                  TEXT NOT NULL DEFAULT 'drift'
                               CHECK (scale IN ('drift', 'begehung')),
    begehung_simulation_id UUID REFERENCES simulations(id) ON DELETE SET NULL,
    begehung_zone_id       UUID REFERENCES zones(id) ON DELETE SET NULL,
    -- Aufenthaltsfenster in Takte, not wall-clock (plan §2.6) — freezes on
    -- checkpoint and resumes on re-entry by construction.
    window_remaining       INTEGER NOT NULL DEFAULT 12 CHECK (window_remaining >= 0),
    takt_count             INTEGER NOT NULL DEFAULT 0 CHECK (takt_count >= 0),
    -- Narrative/positional state, written by the same RPC as the resource CAS in
    -- one transaction. Size budget < 16 KB (test-asserted, plan §14.4).
    checkpoint             JSONB NOT NULL DEFAULT '{}'::jsonb,
    event_seq              INTEGER NOT NULL DEFAULT 0 CHECK (event_seq >= 0),  -- orders the event stream (plan §7)
    chart_version          INTEGER,  -- FK → chart_versions(version) added in migration 240
    opened_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at              TIMESTAMPTZ,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Single-active-run-per-user CAS (plan §3.1, §6.1). A second open anywhere
-- collides on this partial unique index; fn_travel_run_open returns the existing
-- run rather than creating a second.
CREATE UNIQUE INDEX uq_travel_runs_single_active
    ON travel_runs (user_id)
    WHERE status IN ('active', 'frozen', 'distress');

CREATE INDEX idx_travel_runs_user_status ON travel_runs (user_id, status);
CREATE INDEX idx_travel_runs_position    ON travel_runs (position_node_id);


-- ═══════════════════════════════════════════════════════════════════
-- 3. travel_telemetry_events — closed-set, server-written KPI instrumentation
-- ═══════════════════════════════════════════════════════════════════
-- Exclusively server-written by the owning RPC/service (plan §14.3). No client
-- endpoint, no client-trusted timing. KPI 3 (first-foreign-dock latency) and
-- KPI 4 (repeat-route attention) read from here.

CREATE TABLE travel_telemetry_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_key   TEXT NOT NULL
                    CHECK (event_key IN (
                        'drift_first_session_start',
                        'drift_first_foreign_dock',
                        'drift_run_opened',
                        'drift_run_closed',
                        'drift_quest_completed',
                        'drift_decision',
                        'drift_zerfaserung',
                        'drift_rescue'
                    )),
    run_id      UUID REFERENCES travel_runs(id) ON DELETE SET NULL,
    payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- KPI 3/4 cohort queries: per-user, per-event-key, newest-first.
CREATE INDEX idx_travel_telemetry_user_key
    ON travel_telemetry_events (user_id, event_key, created_at DESC);

-- 90-day retention sweep (plan §14.4) + cheap time-range scans.
CREATE INDEX idx_travel_telemetry_created_brin
    ON travel_telemetry_events USING brin (created_at);


-- ═══════════════════════════════════════════════════════════════════
-- 4. travel_audit() — in-transaction audit helper (plan §3.1, §4)
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.travel_audit(
    p_user           UUID,
    p_action         TEXT,
    p_entity_type    TEXT,
    p_entity_id      UUID,
    p_simulation_id  UUID,
    p_details        JSONB DEFAULT '{}'::jsonb
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Namespace lock: travel_audit may only ever write `travel_`-prefixed
    -- actions, so even a call from an authorized context cannot forge a
    -- non-travel audit row.
    IF p_action IS NULL OR left(p_action, 7) <> 'travel_' THEN
        RAISE EXCEPTION 'travel_audit: action must be travel_-prefixed, got %', p_action
            USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.audit_log (
        simulation_id, user_id, action, entity_type, entity_id, details
    ) VALUES (
        p_simulation_id, p_user, p_action, p_entity_type, p_entity_id,
        COALESCE(p_details, '{}'::jsonb)
    );
END;
$$;

COMMENT ON FUNCTION public.travel_audit(UUID, TEXT, TEXT, UUID, UUID, JSONB) IS
    'In-transaction audit helper for the DRIFT travel RPC family (plan §3.1/§4). INSERTs one row into audit_log {simulation_id, user_id=p_user, action, entity_type, entity_id, details}. Namespace-locks p_action to the `travel_` prefix (raises 22023 otherwise). SECURITY DEFINER, REVOKEd from anon/authenticated and GRANTed to service_role only: players cannot reach it to forge a row, while player-class RPCs (themselves DEFINER, running as owner) and scheduler/effect RPCs both call it internally and pass the acting traveler as p_user. Called inside every mutating travel RPC so the all-mutations audit rule has no Python-only escape hatch (finding 7).';

REVOKE ALL    ON FUNCTION public.travel_audit(UUID, TEXT, TEXT, UUID, UUID, JSONB) FROM PUBLIC;
REVOKE ALL    ON FUNCTION public.travel_audit(UUID, TEXT, TEXT, UUID, UUID, JSONB) FROM anon;
REVOKE ALL    ON FUNCTION public.travel_audit(UUID, TEXT, TEXT, UUID, UUID, JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.travel_audit(UUID, TEXT, TEXT, UUID, UUID, JSONB) TO service_role;


-- ═══════════════════════════════════════════════════════════════════
-- 5. Updated-at triggers (shared set_updated_at function)
-- ═══════════════════════════════════════════════════════════════════
-- travel_telemetry_events is append-only → created_at only, no updated_at
-- trigger (matches the journal_fragments / journal_palimpsests precedent).

CREATE TRIGGER set_traveler_profiles_updated_at
    BEFORE UPDATE ON traveler_profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_travel_runs_updated_at
    BEFORE UPDATE ON travel_runs
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ═══════════════════════════════════════════════════════════════════
-- 6. Row Level Security (plan §5)
-- ═══════════════════════════════════════════════════════════════════
-- Owner-readable, RPC-only writes. (SELECT auth.uid()) initPlan wrapping per
-- migration 183. Telemetry is backend-only (no authenticated access at all).
-- Discovery FoW, public chart topology and the cross-sim effect tables arrive
-- with their own migrations (240+).

ALTER TABLE traveler_profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_runs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_telemetry_events ENABLE ROW LEVEL SECURITY;

-- traveler_profiles: owner reads own row; all writes via RPC (service_role).
CREATE POLICY traveler_profiles_owner_select
    ON traveler_profiles FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);
CREATE POLICY traveler_profiles_service_role
    ON traveler_profiles FOR ALL TO service_role
    USING (TRUE) WITH CHECK (TRUE);

-- travel_runs: owner reads own rows; all writes via RPC (service_role).
CREATE POLICY travel_runs_owner_select
    ON travel_runs FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);
CREATE POLICY travel_runs_service_role
    ON travel_runs FOR ALL TO service_role
    USING (TRUE) WITH CHECK (TRUE);

-- travel_telemetry_events: backend-only, both directions.
CREATE POLICY travel_telemetry_events_service_role
    ON travel_telemetry_events FOR ALL TO service_role
    USING (TRUE) WITH CHECK (TRUE);


-- ═══════════════════════════════════════════════════════════════════
-- 7. Seeds
-- ═══════════════════════════════════════════════════════════════════

-- Phase gates + kill-switch (plan §13.2). Canonical jsonb `false`, read
-- fail-closed via parse_setting_bool (migration 227 precedent).
INSERT INTO public.platform_settings (setting_key, setting_value, description) VALUES
    ('drift_p0_enabled',       'false'::jsonb, 'DRIFT phase gate P0 (vertical slice). Off → no new runs; in-flight runs freeze, thaw on re-enable.'),
    ('drift_p1_enabled',       'false'::jsonb, 'DRIFT phase gate P1 (worlds + economy/presence). Cumulative: requires P0 on.'),
    ('drift_p2_enabled',       'false'::jsonb, 'DRIFT phase gate P2 (people: companions, full failure loop, rescue/ferry). Requires P1 on.'),
    ('drift_p3_enabled',       'false'::jsonb, 'DRIFT phase gate P3 (weather + frontier, Helm-Modus). Requires P2 on.'),
    ('drift_p4_enabled',       'false'::jsonb, 'DRIFT phase gate P4 (society: traces, seasons, convoys, epoch advisories). Requires P3 on.'),
    ('drift_ai_enabled',       'false'::jsonb, 'DRIFT master AI gate for all generation touchpoints (KPI 6). Off → template/pack fallbacks, zero LLM calls.'),
    ('drift_emergency_return', 'false'::jsonb, 'DRIFT kill-switch. When armed, fn_drift_emergency_return() force-returns all travelers home without resource/cargo loss.')
ON CONFLICT (setting_key) DO NOTHING;

-- Hospitality default as data (plan §10, concept §8.7): nur_echos for every
-- active template simulation. An absent row reads `geschlossen` (fail-closed).
-- Epoch game-instance clones and archived sims are excluded by design.
INSERT INTO public.simulation_settings (simulation_id, category, setting_key, setting_value)
SELECT id, 'drift', 'drift_hospitality', '"nur_echos"'::jsonb
  FROM public.simulations
 WHERE status = 'active'
   AND simulation_type = 'template'
ON CONFLICT (simulation_id, category, setting_key) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════
-- 8. Table comments
-- ═══════════════════════════════════════════════════════════════════

COMMENT ON TABLE traveler_profiles IS
    'One per user: the persistent Träger record (clearance, Siegel/VP, bandwidth class, 7-vector affinities, unlocked vectors, scar/thread qualities). anchor_simulation_id is the membership-required home (decision §22.2). qualities is the QBN player-quality channel (KPI 5 carve-out). See docs/plans/drift-implementation-plan.md §3.1.';

COMMENT ON TABLE travel_runs IS
    'Per-session travel run. Numeric resources (kohaerenz/bandbreite/dissonanz) are CAS columns (ADR-007); narrative/positional state is checkpoint jsonb written by the same RPC in the same transaction (resolves gate-review U1). run_version is the multi-device optimistic lock (plan §6.2). Single-active-run enforced by uq_travel_runs_single_active. position_node_id / chart_version FKs added in migration 240.';

COMMENT ON TABLE travel_telemetry_events IS
    'Closed-set, server-written DRIFT telemetry (plan §14.3). KPI 3 (first-foreign-dock latency) and KPI 4 (repeat-route attention) read from here. No client endpoint; every row corresponds to a server-observed action. BRIN on created_at for the 90-day retention sweep.';

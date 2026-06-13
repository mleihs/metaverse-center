-- Migration 240: DRIFT — drift_chart (P0a chart topology + FoW + honors)
--
-- Spec: docs/plans/drift-implementation-plan.md §3.2, §8 (chart gen/versioning),
--       §5 (RLS), §12.2 (survey integrity), §3.1 (closes the deferred FKs).
-- Design contract: docs/concepts/drift-zwischenraum-travel-game-concept.md v0.4
--       §6 (the chart) — node taxonomy lines 247–253.
--
-- Second DRIFT P0a migration. Ships the shared, versioned chart topology, the
-- per-user fog-of-war layer, and the first-write-wins honor arbitration row.
-- Behind drift_p0_enabled=false (seeded in migration 239) — no runtime change.
--
-- Tables:
--   chart_versions        — one row per generated chart (seed + generator version).
--   drift_chart_nodes     — seeded base topology + runtime overlay rows (wrecks,
--                           storm projections, ghost islands, new broadcast glows).
--                           stable_key survives regeneration (discovery/honor
--                           continuity, §8.2). UNIQUE(chart_version, stable_key).
--   drift_chart_edges     — weighted, per-vector-permeable edges; corridor flag =
--                           Strömungsband; connection_id ties corridors back to
--                           simulation_connections.
--   traveler_discoveries  — per-user FoW, keyed by node_stable_key (not node id) so
--                           it survives chart regeneration. Server-filtered at the
--                           endpoint (§14.4) — undiscovered payloads never ship.
--   chart_honors          — Erstvermessung/Erstkontakt. UNIQUE(kind, node_stable_key)
--                           is the first-write-wins arbitration (C4): fn_survey_deliver's
--                           INSERT either wins or conflicts; the runner-up gets
--                           partial credit, never the flag.
--
-- frequency_mask is a 7-bit field, one bit per bleed vector in the canonical
-- order used everywhere in DRIFT (matches traveler_profiles.affinities key order
-- and the spike's vertex-shader bitmask):
--   bit 0 = commerce, 1 = language, 2 = memory, 3 = resonance,
--   bit 4 = architecture, 5 = dream, 6 = desire.
-- A set bit means the node exists on that vector (Frequenzfenster geometry, §6).
--
-- RLS (§5): chart topology is PUBLIC read (the public landing/spectator surface —
-- broadcasts are public by the public-first contract); writes are backend/
-- scheduler only. FoW is owner-read only. Honors are public read (names on the
-- shared chart), DEFINER-write only.
--
-- Deferred FKs from migration 239 (build order): travel_runs.position_node_id →
-- drift_chart_nodes(id) and travel_runs.chart_version → chart_versions(version)
-- are added here now that their targets exist.
--
-- No chart rows are seeded here — the deterministic generator (P0b) emits the P0
-- region as migration 247. Active-view refresh: none required.


-- ═══════════════════════════════════════════════════════════════════
-- 1. chart_versions
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE chart_versions (
    version           INTEGER PRIMARY KEY,   -- assigned by the generator, not serial
    seed              BIGINT NOT NULL,
    generator_version TEXT NOT NULL,
    applied_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ═══════════════════════════════════════════════════════════════════
-- 2. drift_chart_nodes — seeded base + runtime overlay rows (§8.2)
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE drift_chart_nodes (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chart_version  INTEGER NOT NULL REFERENCES chart_versions(version) ON DELETE CASCADE,
    -- Survives regeneration — discoveries and honors reference this, never id (§8.2).
    stable_key     TEXT NOT NULL,
    node_kind      TEXT NOT NULL CHECK (node_kind IN ('seeded', 'overlay')),
    node_type      TEXT NOT NULL
                       CHECK (node_type IN (
                           'broadcast_rand',          -- Broadcast-Rand: a simulation's dockable edge
                           'relais',                  -- Relais: stable waypoint, free retune
                           'echo_untiefe',            -- Echo-Untiefe: event_echoes pooling ground
                           'geisterinsel',            -- Geisterinsel: never-materialized forge draft
                           'resonanzsturm',           -- Resonanzsturm: mobile substrate-resonance storm (P3)
                           'traeger_wrack',           -- Träger-Wrack: where a player unraveled (P2)
                           'splitterfaenger_revier',  -- Splitterfänger-Revier: predator territory (P3)
                           'interstitial'             -- procedural filler tissue (where exploration lives)
                       )),
    simulation_id  UUID REFERENCES simulations(id) ON DELETE SET NULL,  -- set for broadcast_rand nodes
    -- Viewport-independent, server-generated layout coordinates (§8.1).
    x              DOUBLE PRECISION NOT NULL,
    y              DOUBLE PRECISION NOT NULL,
    frequency_mask INTEGER NOT NULL DEFAULT 127 CHECK (frequency_mask BETWEEN 0 AND 127),  -- 7-bit
    region_cell    TEXT NOT NULL,                                          -- region paging (§14.4)
    distance_band  TEXT NOT NULL CHECK (distance_band IN ('near', 'mid', 'deep')),  -- Dissonanz scaling (§2.1)
    expires_at     TIMESTAMPTZ,                                            -- overlay TTL; NULL = permanent
    payload        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (chart_version, stable_key)
);

CREATE INDEX idx_drift_chart_nodes_region  ON drift_chart_nodes (chart_version, region_cell);
CREATE INDEX idx_drift_chart_nodes_sim     ON drift_chart_nodes (simulation_id);
CREATE INDEX idx_drift_chart_nodes_expires ON drift_chart_nodes (expires_at) WHERE expires_at IS NOT NULL;


-- ═══════════════════════════════════════════════════════════════════
-- 3. drift_chart_edges
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE drift_chart_edges (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chart_version  INTEGER NOT NULL REFERENCES chart_versions(version) ON DELETE CASCADE,
    from_node      UUID NOT NULL REFERENCES drift_chart_nodes(id) ON DELETE CASCADE,
    to_node        UUID NOT NULL REFERENCES drift_chart_nodes(id) ON DELETE CASCADE,
    weight         INTEGER NOT NULL CHECK (weight BETWEEN 1 AND 3),  -- corridor 1 / interstitial 2 / deep 3
    -- Per-vector permeability multiplier (Frequenzfenster geometry, §2.2). The
    -- generator guarantees from_node/to_node share this chart_version.
    permeability   JSONB NOT NULL DEFAULT '{}'::jsonb,
    corridor       BOOLEAN NOT NULL DEFAULT FALSE,  -- Strömungsband
    connection_id  UUID REFERENCES simulation_connections(id) ON DELETE SET NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT drift_chart_edges_no_self_loop CHECK (from_node <> to_node)
);

CREATE INDEX idx_drift_chart_edges_from    ON drift_chart_edges (from_node);
CREATE INDEX idx_drift_chart_edges_to      ON drift_chart_edges (to_node);
CREATE INDEX idx_drift_chart_edges_version ON drift_chart_edges (chart_version);


-- ═══════════════════════════════════════════════════════════════════
-- 4. traveler_discoveries — per-user fog-of-war (§3.2, §14.4)
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE traveler_discoveries (
    user_id                  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    -- Keyed by stable_key, not node id, so the FoW survives chart regeneration.
    node_stable_key          TEXT NOT NULL,
    chart_version_first_seen INTEGER NOT NULL,
    surveyed                 BOOLEAN NOT NULL DEFAULT FALSE,
    survey_delivered         BOOLEAN NOT NULL DEFAULT FALSE,
    source                   TEXT NOT NULL
                                 CHECK (source IN ('scan', 'visit', 'purchase', 'route_knowledge')),
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, node_stable_key)
);

CREATE INDEX idx_traveler_discoveries_user ON traveler_discoveries (user_id);


-- ═══════════════════════════════════════════════════════════════════
-- 5. chart_honors — first-write-wins arbitration (C4, §12.2)
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE chart_honors (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind            TEXT NOT NULL CHECK (kind IN ('erstvermessung', 'erstkontakt')),
    node_stable_key TEXT NOT NULL,
    -- SET NULL on user delete: the honor is a permanent shared-chart record; the
    -- node stays claimed (UNIQUE below is never freed), the holder anonymizes.
    user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    claimed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- The arbitration row: fn_survey_deliver's INSERT either wins or conflicts.
    UNIQUE (kind, node_stable_key)
);


-- ═══════════════════════════════════════════════════════════════════
-- 6. Deferred FKs from migration 239 (targets now exist)
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE travel_runs
    ADD CONSTRAINT fk_travel_runs_position_node
    FOREIGN KEY (position_node_id) REFERENCES drift_chart_nodes(id) ON DELETE SET NULL;

ALTER TABLE travel_runs
    ADD CONSTRAINT fk_travel_runs_chart_version
    FOREIGN KEY (chart_version) REFERENCES chart_versions(version) ON DELETE SET NULL;


-- ═══════════════════════════════════════════════════════════════════
-- 7. Updated-at triggers
-- ═══════════════════════════════════════════════════════════════════
-- chart_versions (applied_at), drift_chart_edges (immutable per version) and
-- chart_honors (claimed once) are append-only → no updated_at trigger.

CREATE TRIGGER set_drift_chart_nodes_updated_at
    BEFORE UPDATE ON drift_chart_nodes
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_traveler_discoveries_updated_at
    BEFORE UPDATE ON traveler_discoveries
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ═══════════════════════════════════════════════════════════════════
-- 8. Row Level Security (plan §5)
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE chart_versions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE drift_chart_nodes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE drift_chart_edges      ENABLE ROW LEVEL SECURITY;
ALTER TABLE traveler_discoveries   ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_honors           ENABLE ROW LEVEL SECURITY;

-- Chart topology: public read (anon + authenticated), backend/scheduler writes.
CREATE POLICY chart_versions_public_select
    ON chart_versions FOR SELECT TO anon, authenticated USING (TRUE);
CREATE POLICY chart_versions_service_role
    ON chart_versions FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY drift_chart_nodes_public_select
    ON drift_chart_nodes FOR SELECT TO anon, authenticated USING (TRUE);
CREATE POLICY drift_chart_nodes_service_role
    ON drift_chart_nodes FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY drift_chart_edges_public_select
    ON drift_chart_edges FOR SELECT TO anon, authenticated USING (TRUE);
CREATE POLICY drift_chart_edges_service_role
    ON drift_chart_edges FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- FoW: owner-read only (the endpoint additionally server-filters); RPC writes.
CREATE POLICY traveler_discoveries_owner_select
    ON traveler_discoveries FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);
CREATE POLICY traveler_discoveries_service_role
    ON traveler_discoveries FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- Honors: public read (names on the shared chart); DEFINER/service_role writes.
CREATE POLICY chart_honors_public_select
    ON chart_honors FOR SELECT TO anon, authenticated USING (TRUE);
CREATE POLICY chart_honors_service_role
    ON chart_honors FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);


-- ═══════════════════════════════════════════════════════════════════
-- 9. Table comments
-- ═══════════════════════════════════════════════════════════════════

COMMENT ON TABLE chart_versions IS
    'One row per generated DRIFT chart (seed + generator_version). Topology rows reference this; regeneration is an explicit fn_apply_chart_version event keyed on stable_key (plan §8.2).';

COMMENT ON TABLE drift_chart_nodes IS
    'Shared chart nodes: seeded base topology (immutable per chart_version) + runtime overlay rows (wrecks/storms/ghost-islands/new broadcast glows, TTL via expires_at). stable_key survives regeneration. frequency_mask is 7-bit (commerce,language,memory,resonance,architecture,dream,desire). Public read (broadcasts are public); backend writes only.';

COMMENT ON TABLE drift_chart_edges IS
    'Weighted chart edges (1 corridor / 2 interstitial / 3 deep Drift). permeability is the per-vector multiplier; corridor=true marks a Strömungsband; connection_id ties corridors to simulation_connections. Public read; backend writes only.';

COMMENT ON TABLE traveler_discoveries IS
    'Per-user fog-of-war, keyed by node_stable_key so it survives chart regeneration. Owner-read only and additionally server-filtered at the endpoint (undiscovered node payloads never ship — survey-economy integrity, plan §14.4). RPC writes only.';

COMMENT ON TABLE chart_honors IS
    'Erstvermessung / Erstkontakt honors. UNIQUE(kind, node_stable_key) is the first-write-wins arbitration (C4): fn_survey_deliver INSERTs and either wins or conflicts (runner-up gets partial credit, never the flag). Public read (names on the shared chart); DEFINER writes only.';

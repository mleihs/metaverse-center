-- Migration 241: DRIFT — travel_quests_cargo (P0a quest + cargo substrate)
--
-- Spec: docs/plans/drift-implementation-plan.md §3.3 (table catalog),
--       §4 (RPC catalog — fn_quest_accept/advance, fn_cargo_acquire/redeem,
--       fn_route_publish/purchase), §5 (RLS posture), §19 (P0 vertical slice).
-- Design contract: docs/concepts/drift-zwischenraum-travel-game-concept.md v0.4
--       §7.8 (Fracht — cargo families & twists), §9.1 (Depeschen quest families).
--
-- Third DRIFT P0a migration. Ships the quest content/instance/participant model
-- and the cargo manifest — the gameplay payload every travel RPC moves, redeems
-- and scatters. Plus the surveyor route-economy tables (P1b RPCs, schema-now so
-- the foundation is one coherent train). Behind drift_p0_enabled=false (seeded in
-- migration 239) — no runtime change until the gate is raised.
--
-- Tables:
--   travel_quest_templates    — pack-authored mechanical skeletons (the dungeon
--                               content-pack model: TRUNCATE + reseed, business
--                               key = template_key). Public read, service_role
--                               write. The 6 Depeschen families (concept §9.1).
--   travel_quest_instances    — a template instantiated against live rows.
--                               entity_refs is the KPI-1 provenance ledger.
--   travel_quest_participants  — per-participant checkpoint/credit. Single-row per
--                               instance until P4 (finding 75); the row survives
--                               drop-out so convoy credit is never lost.
--   travel_cargo              — the slot-based manifest. Frequency-shaped matter:
--                               7 families 1:1 with the 7 bleed vectors; 0–2 twists
--                               from a closed, pack-owned catalog (concept §7.8).
--   traveler_scars            — failure-as-content marks (concept §6.3). Max 3
--                               active is enforced in fn_zerfaserung (P2), not here.
--   published_routes /        — the surveyor route economy (P1b). Schema lands now;
--   route_purchases             the RPCs (fn_route_publish/purchase) arrive in 246.
--
-- ── Non-obvious decision: quest instances reference their template by KEY ──────
-- travel_quest_templates are CONTENT, seeded by the A1.5 pack pipeline, whose
-- generated migrations do `TRUNCATE … RESTART IDENTITY CASCADE` then
-- `INSERT … ON CONFLICT(<business-key>) DO UPDATE` (generate_migration.py:111,
-- truncate=True by default). A uuid surrogate `id` therefore does NOT survive a
-- reseed, and — critically — a hard FK from instances to templates would let
-- `TRUNCATE … CASCADE` wipe live player quest instances on every content republish.
-- So, exactly as the dungeon runtime resolves content by key through the cache and
-- never FK-references a content table (CLAUDE.md rule), travel_quest_instances
-- carries `template_key TEXT NOT NULL` (a soft reference, NO foreign key). The
-- surrogate `id` on travel_quest_templates is a local convenience only; the stable
-- identity is `template_key` (UNIQUE, the reseed conflict target). This reconciles
-- plan §3.3's `template_id` column name → `template_key`.
--
-- ── The two CHECK vocabularies (kept deliberately distinct) ────────────────────
-- Quest `family` (6 values) = the Depeschen template families (concept §9.1):
--   deliver, fetch, survey, investigate, escort, introduce.
-- Cargo `family` (7 values) = frequency-shaped matter, 1:1 with the 7 bleed
--   vectors (concept §7.8); cargo also stores its `vector` explicitly (the bleed
--   vector it rides cheaply on). family↔vector mapping:
--     kontrakte→commerce, idiome→language, erinnerungsstuecke→memory,
--     resonanzkerne→resonance, blaupausen→architecture, traumfracht→dream,
--     sehnsuchtsgut→desire.
-- Cargo `twists` is a jsonb ARRAY drawn from a CLOSED, pack-owned catalog
--   (deklariert, undeklariert, fluechtig, laut, verschraenkt, beschriftet,
--   gefaelscht — concept §7.8). Deliberately NO DB CHECK on the twist values: the
--   catalog is owned by the content pack and validated in pack CI
--   (validate_content_packs.py), exactly like the dungeon effect_params keys — the
--   DB only guards the SHAPE (must be a jsonb array). Encoding twists as a CHECK
--   here would duplicate the pack's source of truth and drift from it.
--
-- ── entity_refs (KPI-1) ───────────────────────────────────────────────────────
-- travel_quest_instances.entity_refs is the KPI-1 ledger: every quest references
-- ≥2 real platform entities ([{kind:'agent',id:…}, {kind:'building',id:…}, …]).
-- The ≥2 CARDINALITY is enforced at the service layer + pack CI (plan §3.3) — NOT
-- as a DB CHECK, because what counts as a valid ref (live agent? building in this
-- sim?) is a join the DB constraint cannot express. The DB guards only the SHAPE
-- (jsonb array). Cargo carries the same provenance as typed FK columns
-- (origin_agent_id/origin_building_id/origin_event_id) so an item's papers are
-- referentially sound.
--
-- RLS (§5): quest templates + published_routes are PUBLIC read (the listing/
-- spectator surface); instances, participants, cargo, scars, route_purchases are
-- OWNER read; all writes are RPC-only (service_role). published_routes royalty
-- credit and route_purchases inserts are DEFINER-only (fn_route_purchase credits
-- another user's account) — modeled as service_role here.
--
-- Active-view refresh: none required (no agents/buildings/simulations/events
-- COLUMN changes — these tables are only FK targets here, not altered).


-- ═══════════════════════════════════════════════════════════════════
-- 1. travel_quest_templates — pack-authored mechanical skeletons
-- ═══════════════════════════════════════════════════════════════════
-- Content, not state. Seeded by the generalized A1.5 pack pipeline (plan §9.1):
-- TRUNCATE + reseed with template_key as the business/conflict key. id is a local
-- convenience surrogate and is NOT stable across reseed — never FK to it.

CREATE TABLE travel_quest_templates (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Stable identity (survives pack reseed); the reseed conflict target. Instances
    -- and cargo reference THIS, never id.
    template_key  TEXT NOT NULL UNIQUE,
    -- The 6 Depeschen template families (concept §9.1).
    family        TEXT NOT NULL
                      CHECK (family IN (
                          'deliver',      -- cargo X from building A to agent B
                          'fetch',        -- acquire vector-cargo from a matching zone
                          'survey',       -- chart N nodes in region R / map zone Z
                          'investigate',  -- establish facts about event E / relations
                          'escort',       -- bring an agent across the Drift
                          'introduce'     -- first contact between two agents (may propose an embassy)
                      )),
    tier          INTEGER NOT NULL DEFAULT 1 CHECK (tier >= 1),
    pack_slug     TEXT NOT NULL,
    -- The mechanical skeleton: checks, costs, rewards, effect vocabulary, selector
    -- binds. Pack-generated; LLM dresses only the surface prose at instantiation.
    definition    JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_travel_quest_templates_family ON travel_quest_templates (family, tier);
CREATE INDEX idx_travel_quest_templates_pack   ON travel_quest_templates (pack_slug);


-- ═══════════════════════════════════════════════════════════════════
-- 2. travel_quest_instances — a template instantiated against live rows
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE travel_quest_instances (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Soft reference to travel_quest_templates.template_key (NO FK — see header:
    -- templates are TRUNCATE-reseeded content; a CASCADE FK would wipe instances).
    template_key      TEXT NOT NULL,
    owner_user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    -- Where the quest lives (offered/active). CASCADE: a hard sim deletion takes
    -- its quest instances with it (instances are worthless without their world).
    simulation_id     UUID NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
    status            TEXT NOT NULL DEFAULT 'offered'
                          CHECK (status IN ('offered', 'active', 'completed', 'failed', 'expired')),
    -- KPI-1 provenance ledger: [{kind:'agent',id:…}, …]. DB guards SHAPE only
    -- (must be a jsonb array); the ≥2 cardinality is enforced at the service layer
    -- + pack CI (plan §3.3) because ref validity is a cross-table join, not a CHECK.
    entity_refs       JSONB NOT NULL DEFAULT '[]'::jsonb
                          CHECK (jsonb_typeof(entity_refs) = 'array'),
    slots             JSONB NOT NULL DEFAULT '{}'::jsonb,  -- resolved selector binds
    clock             JSONB NOT NULL DEFAULT '{}'::jsonb,  -- per-instance deadline/window state
    dressing_cache_key TEXT,                               -- → travel_dressing_cache (migration 242)
    -- Exactly-once effect application (fn_apply_quest_effects CAS on this flag).
    effects_applied   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_travel_quest_instances_owner    ON travel_quest_instances (owner_user_id, status);
CREATE INDEX idx_travel_quest_instances_sim      ON travel_quest_instances (simulation_id);
CREATE INDEX idx_travel_quest_instances_template ON travel_quest_instances (template_key);


-- ═══════════════════════════════════════════════════════════════════
-- 3. travel_quest_participants — per-participant checkpoint/credit
-- ═══════════════════════════════════════════════════════════════════
-- Single-row-per-instance in the P0 schema (finding 75); P4 convoys add rows.
-- Shared-instance convoy state is a VIEW over the initiator's instance; the
-- per-participant credit lives here and SURVIVES drop-out (no CASCADE from the
-- run, only from the instance and the user).

CREATE TABLE travel_quest_participants (
    instance_id  UUID NOT NULL REFERENCES travel_quest_instances(id) ON DELETE CASCADE,
    user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    checkpoint   JSONB NOT NULL DEFAULT '{}'::jsonb,
    credit       JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (instance_id, user_id)
);

CREATE INDEX idx_travel_quest_participants_user ON travel_quest_participants (user_id);


-- ═══════════════════════════════════════════════════════════════════
-- 4. travel_cargo — the slot-based manifest (concept §7.8)
-- ═══════════════════════════════════════════════════════════════════
-- Every row is a one-of-a-kind instance, never a stackable commodity (no market).
-- run_id NULL = anchored at home (Andenken), out of Zerfaserung stake.

CREATE TABLE travel_cargo (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    -- NULL = anchored at home / Andenken; SET NULL on run close re-anchors the item.
    run_id              UUID REFERENCES travel_runs(id) ON DELETE SET NULL,
    -- 7 cargo families, 1:1 with the 7 bleed vectors (concept §7.8).
    family              TEXT NOT NULL
                            CHECK (family IN (
                                'kontrakte',         -- commerce: sealed obligations
                                'idiome',            -- language: untranslatable phrases
                                'erinnerungsstuecke',-- memory: objects that remember elsewhere
                                'resonanzkerne',     -- resonance: harvested at Echo-Untiefen
                                'blaupausen',        -- architecture: buildings that want to exist
                                'traumfracht',       -- dream: volatile, lucid
                                'sehnsuchtsgut'      -- desire: heavy in a way scales don't measure
                            )),
    -- The bleed vector this cargo rides cheaply on (off-vector carriage costs extra
    -- Bandbreite and exposes twists). CHECK mirrors travel_runs.frequency.
    vector              TEXT NOT NULL
                            CHECK (vector IN (
                                'commerce', 'language', 'memory', 'resonance',
                                'architecture', 'dream', 'desire'
                            )),
    -- 0–2 twists from the CLOSED, pack-owned catalog (concept §7.8). DB guards the
    -- SHAPE only (jsonb array); twist VALUES are validated in pack CI, never by a
    -- DB CHECK (the catalog's source of truth is the content pack, not this column).
    twists              JSONB NOT NULL DEFAULT '[]'::jsonb
                            CHECK (jsonb_typeof(twists) = 'array'),
    -- KPI-1 provenance: an item carries its entity references in its papers. SET
    -- NULL so a deleted source agent/building/event clears the ref but keeps the item.
    origin_agent_id     UUID REFERENCES agents(id) ON DELETE SET NULL,
    origin_building_id  UUID REFERENCES buildings(id) ON DELETE SET NULL,
    origin_event_id     UUID REFERENCES events(id) ON DELETE SET NULL,
    -- Cargo bound to a quest (deliver/fetch payload). SET NULL keeps salvaged items.
    quest_instance_id   UUID REFERENCES travel_quest_instances(id) ON DELETE SET NULL,
    manifest_slot       INTEGER CHECK (manifest_slot IS NULL OR manifest_slot >= 0),
    heavy               BOOLEAN NOT NULL DEFAULT FALSE,   -- Sehnsuchtsgut weight class
    spoils_at_takt      INTEGER,                          -- flüchtig: spoils N Takte after leaving its vector
    -- verschränkt: paired counterpart in another world. Self-referential; SET NULL
    -- when the counterpart is consumed/lost (the pairing dissolves, the item stays).
    counterpart_cargo_id UUID REFERENCES travel_cargo(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_travel_cargo_owner ON travel_cargo (owner_user_id);
CREATE INDEX idx_travel_cargo_run   ON travel_cargo (run_id) WHERE run_id IS NOT NULL;
CREATE INDEX idx_travel_cargo_quest ON travel_cargo (quest_instance_id) WHERE quest_instance_id IS NOT NULL;


-- ═══════════════════════════════════════════════════════════════════
-- 5. traveler_scars — failure-as-content marks (concept §6.3)
-- ═══════════════════════════════════════════════════════════════════
-- Acquired on Zerfaserung; band-gated, ritually replaceable. The "max 3 active"
-- rule is enforced in fn_zerfaserung (P2), not as a DB constraint — but no player
-- may carry the same scar_key active twice (a clean shape invariant the RPC can
-- rely on, enforced by the partial unique index below).

CREATE TABLE traveler_scars (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    scar_key     TEXT NOT NULL,
    active       BOOLEAN NOT NULL DEFAULT TRUE,
    acquired_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    shed_at      TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Count-active query (fn_zerfaserung's max-3 check) + the no-duplicate-active
-- invariant in one partial index.
CREATE UNIQUE INDEX uq_traveler_scars_active_key
    ON traveler_scars (user_id, scar_key)
    WHERE active;


-- ═══════════════════════════════════════════════════════════════════
-- 6. published_routes — surveyor route economy listings (P1b)
-- ═══════════════════════════════════════════════════════════════════
-- Schema now; fn_route_publish/purchase RPCs arrive in migration 246. name is
-- moderated UGC (plan §15) and becomes visible in P1b. price is bounded scrip.

CREATE TABLE published_routes (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    surveyor_user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name              TEXT NOT NULL,                      -- moderated UGC (§15)
    edge_keys         TEXT[] NOT NULL,                    -- the surveyed edges composing the route
    price             INTEGER NOT NULL CHECK (price BETWEEN 5 AND 50),  -- Siegel (plan §2.9)
    unique_buyers     INTEGER NOT NULL DEFAULT 0 CHECK (unique_buyers >= 0),
    season            TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_published_routes_surveyor ON published_routes (surveyor_user_id);
CREATE INDEX idx_published_routes_season   ON published_routes (season) WHERE season IS NOT NULL;


-- ═══════════════════════════════════════════════════════════════════
-- 7. route_purchases — per-buyer-once purchase ledger (P1b)
-- ═══════════════════════════════════════════════════════════════════
-- PK (route_id, buyer_user_id) IS the per-buyer-once guarantee. Self-buy
-- (buyer = surveyor) is blocked in fn_route_purchase (a cross-row comparison the
-- PK cannot express). royalty_credited flips once when the royalty is paid.

CREATE TABLE route_purchases (
    route_id          UUID NOT NULL REFERENCES published_routes(id) ON DELETE CASCADE,
    buyer_user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    price_paid        INTEGER NOT NULL CHECK (price_paid >= 0),
    royalty_credited  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (route_id, buyer_user_id)
);

CREATE INDEX idx_route_purchases_buyer ON route_purchases (buyer_user_id);


-- ═══════════════════════════════════════════════════════════════════
-- 8. Updated-at triggers (shared set_updated_at function)
-- ═══════════════════════════════════════════════════════════════════
-- Every table here is mutable (status flips, royalty credit, scar shedding,
-- buyer counts) → all get updated_at maintenance.

CREATE TRIGGER set_travel_quest_templates_updated_at
    BEFORE UPDATE ON travel_quest_templates
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_travel_quest_instances_updated_at
    BEFORE UPDATE ON travel_quest_instances
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_travel_quest_participants_updated_at
    BEFORE UPDATE ON travel_quest_participants
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_travel_cargo_updated_at
    BEFORE UPDATE ON travel_cargo
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_traveler_scars_updated_at
    BEFORE UPDATE ON traveler_scars
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_published_routes_updated_at
    BEFORE UPDATE ON published_routes
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_route_purchases_updated_at
    BEFORE UPDATE ON route_purchases
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ═══════════════════════════════════════════════════════════════════
-- 9. Row Level Security (plan §5)
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE travel_quest_templates    ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_quest_instances    ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_quest_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_cargo              ENABLE ROW LEVEL SECURITY;
ALTER TABLE traveler_scars            ENABLE ROW LEVEL SECURITY;
ALTER TABLE published_routes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_purchases           ENABLE ROW LEVEL SECURITY;

-- Quest templates: public read (the offered-quest listing surface); pack seed only.
CREATE POLICY travel_quest_templates_public_select
    ON travel_quest_templates FOR SELECT TO anon, authenticated USING (TRUE);
CREATE POLICY travel_quest_templates_service_role
    ON travel_quest_templates FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- Quest instances: owner reads own rows; all writes via RPC (service_role).
CREATE POLICY travel_quest_instances_owner_select
    ON travel_quest_instances FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = owner_user_id);
CREATE POLICY travel_quest_instances_service_role
    ON travel_quest_instances FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- Quest participants: participant reads own rows; all writes via RPC.
CREATE POLICY travel_quest_participants_owner_select
    ON travel_quest_participants FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);
CREATE POLICY travel_quest_participants_service_role
    ON travel_quest_participants FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- Cargo: owner reads own rows; all writes via RPC.
CREATE POLICY travel_cargo_owner_select
    ON travel_cargo FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = owner_user_id);
CREATE POLICY travel_cargo_service_role
    ON travel_cargo FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- Scars: owner reads own rows; all writes via RPC.
CREATE POLICY traveler_scars_owner_select
    ON traveler_scars FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);
CREATE POLICY traveler_scars_service_role
    ON traveler_scars FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- Published routes: public read (the route listing); writes (publish + royalty
-- credit) via RPC only. DEFINER credits the surveyor's royalty on others' purchases.
CREATE POLICY published_routes_public_select
    ON published_routes FOR SELECT TO anon, authenticated USING (TRUE);
CREATE POLICY published_routes_service_role
    ON published_routes FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- Route purchases: buyer reads own rows; all writes DEFINER-only (service_role).
CREATE POLICY route_purchases_owner_select
    ON route_purchases FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = buyer_user_id);
CREATE POLICY route_purchases_service_role
    ON route_purchases FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);


-- ═══════════════════════════════════════════════════════════════════
-- 10. Table comments
-- ═══════════════════════════════════════════════════════════════════

COMMENT ON TABLE travel_quest_templates IS
    'Pack-authored DRIFT quest skeletons (the 6 Depeschen families: deliver/fetch/survey/investigate/escort/introduce — concept §9.1). Content, not state: TRUNCATE + reseeded by the generalized A1.5 pack pipeline (plan §9.1) with template_key as the business/conflict key. id is a non-stable local surrogate — instances reference template_key, never id, and never via FK (a CASCADE would wipe live instances on reseed). Public read; service_role write.';

COMMENT ON TABLE travel_quest_instances IS
    'A template instantiated against live platform rows. template_key is a SOFT reference to travel_quest_templates (NO FK by design — see migration header). entity_refs is the KPI-1 provenance ledger (jsonb array; ≥2 cardinality enforced at service + pack CI, not DB — ref validity is a cross-table join). effects_applied is the exactly-once CAS flag for fn_apply_quest_effects. Owner read; RPC write.';

COMMENT ON TABLE travel_quest_participants IS
    'Per-participant quest checkpoint + credit. Single row per instance in the P0 schema (finding 75); P4 convoys add rows. Credit survives drop-out (CASCADE only from the instance and the user, never from a run). Participant read; RPC write.';

COMMENT ON TABLE travel_cargo IS
    'The slot-based travel manifest (concept §7.8). One-of-a-kind instances, never stackable. family (7 values) is 1:1 with the bleed vector in `vector`: kontrakte→commerce, idiome→language, erinnerungsstuecke→memory, resonanzkerne→resonance, blaupausen→architecture, traumfracht→dream, sehnsuchtsgut→desire. twists is a jsonb array from the CLOSED pack-owned catalog (DB guards shape only — pack CI validates values). run_id NULL = anchored at home (Andenken), out of Zerfaserung stake. origin_* are KPI-1 provenance FKs; counterpart_cargo_id is the verschränkt pairing (self-ref). Owner read; RPC write.';

COMMENT ON TABLE traveler_scars IS
    'Failure-as-content marks (concept §6.3), acquired on Zerfaserung, band-gated and ritually replaceable. The "max 3 active" rule lives in fn_zerfaserung (P2), not the DB; uq_traveler_scars_active_key enforces no-duplicate-active-scar per user. Owner read; RPC write.';

COMMENT ON TABLE published_routes IS
    'Surveyor route-economy listings (P1b; fn_route_publish/purchase in migration 246). name is moderated UGC (§15), price is bounded Siegel (5–50). Public read (the listing); writes via RPC only. Schema lands in P0a so the foundation is one coherent migration train.';

COMMENT ON TABLE route_purchases IS
    'Per-buyer-once route purchase ledger; PK (route_id, buyer_user_id) IS the once-guarantee. Self-buy is blocked in fn_route_purchase (a cross-row comparison the PK cannot express). royalty_credited flips once when the surveyor royalty is paid. Buyer read; DEFINER (service_role) write only.';

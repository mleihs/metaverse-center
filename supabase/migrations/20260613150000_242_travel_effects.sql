-- Migration 242: DRIFT — travel_effects (P0a effect landing tables + dressing cache)
--
-- Spec: docs/plans/drift-implementation-plan.md §3.4 (table catalog),
--       §10 (effects & hospitality matrix — the closed 9-effect vocabulary),
--       §5 (RLS posture), §6.4 (dressing cache key spec).
-- Design contract: docs/concepts/drift-zwischenraum-travel-game-concept.md v0.4
--       §11 (the closed effect vocabulary).
--
-- Fourth DRIFT P0a migration. Ships the two world-state landing tables the
-- EffectResolver writes through the single hospitality gate (fn_apply_quest_
-- effects, §10), plus the LLM dressing cache that bounds generation spend.
-- Behind drift_p0_enabled=false (seeded in migration 239) — no runtime change.
--
-- Tables:
--   agent_travel_effects  — persistent/expiring modifiers attached to an agent by
--                           the `grant_agent_effect` resolver effect (§10, home-
--                           only). The landing table for agent-scoped travel impact.
--   zone_modifiers        — TTL'd zone-scoped modifiers from the `zone_modifier`
--                           resolver effect (§10, home-only). source is locked to
--                           'travel_quest' — this is NOT a general zone-modifier store.
--   travel_dressing_cache — content-hash-keyed LLM prose cache (§6.4). A hit = zero
--                           LLM spend; per-user budget rides ai_budget (§9.3).
--
-- ── Why a NEW agent-effect table (finding 15), not agent_dungeon_loot_effects ──
-- The dungeon table is the wrong shape on two counts the schema makes explicit:
--   1. agent_dungeon_loot_effects.effect_type is CHECK-locked to 6 dungeon-only
--      verbs (aptitude_boost, permanent_dungeon_bonus, next_dungeon_bonus,
--      event_modifier, arc_modifier, simulation_modifier) — none describe a
--      travel-quest grant.
--   2. its source_run_id FKs to resonance_dungeon_runs — it is hard-coupled to the
--      dungeon engine's run lifecycle.
-- Reusing it would force travel effects to masquerade as dungeon loot and inherit a
-- dungeon-run FK they have no run for. agent_travel_effects is a clean parallel:
-- source_quest_instance_id FKs the travel instance, and effect_key is open.
--
-- ── effect_key has NO CHECK; zone_modifiers.source DOES (deliberate asymmetry) ──
-- The 9-effect resolver vocabulary (spawn_event, emit_echo, inject_agent_memory,
-- chronicle_mention, grant_agent_effect, zone_modifier, propose_embassy,
-- emit_fragment, bond_event) is what fn_apply_quest_effects DISPATCHES on — it is
-- not stored in these tables. What lands in agent_travel_effects.effect_key is the
-- SPECIFIC granted-modifier key, a content/pack-defined identifier (the buff being
-- granted), exactly like a cargo twist or a dungeon effect_params key: the pack
-- owns that vocabulary and pack CI validates it, so a DB CHECK would duplicate and
-- drift from its authority (the 241 "DB guards shape, pack/CI guards vocabulary"
-- rule). zone_modifiers.source, by contrast, is a PROVENANCE lock, not a content
-- vocabulary: CHECK ('travel_quest') guarantees this table can only ever hold
-- travel-originated modifiers (it is not, and must not become, the platform's
-- general zone-modifier store). The plan annotates exactly this one CHECK.
--
-- ── KPI 5 (no out-of-vocabulary world writes) ─────────────────────────────────
-- Both landing tables are writable by the service_role resolver ONLY (RLS below).
-- Every cross-sim write — quest effects, Zerfaserung scatter (P2), Spuren (P4) —
-- funnels through fn_apply_quest_effects, which validates the hospitality matrix
-- and caps per effect before writing here (§10). There is no player-reachable
-- write path; KPI 5's pack-CI + grep gate enforces the vocabulary upstream.
--
-- RLS (§5): agent_travel_effects + zone_modifiers are SIM-PUBLIC read (world state,
-- per the public-first contract) with service_role-resolver writes only.
-- travel_dressing_cache is BACKEND-ONLY both directions (it is a cost-control
-- cache, never a player surface — travel_telemetry_events precedent from 239).
--
-- FK targets exist: agents/zones (base schema), travel_quest_instances (241).
-- Active-view refresh: none required (no agents/zones COLUMN changes — FK targets
-- only). travel_quest_instances.dressing_cache_key (241) soft-points at
-- travel_dressing_cache.cache_key (no FK — the cache is disposable and TTL-swept).


-- ═══════════════════════════════════════════════════════════════════
-- 1. agent_travel_effects — agent-scoped grant_agent_effect landing table
-- ═══════════════════════════════════════════════════════════════════
-- The home-only `grant_agent_effect` resolver effect (§10) writes here: a modifier
-- attached to one agent, optionally expiring. expires_at NULL = permanent until
-- explicitly cleared. New table, NOT agent_dungeon_loot_effects (finding 15).

CREATE TABLE agent_travel_effects (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id                 UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    -- The specific granted-modifier key (content/pack-defined). NO CHECK by design
    -- (see header): the pack owns the vocabulary; pack CI validates it.
    effect_key               TEXT NOT NULL,
    payload                  JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- NULL = permanent; set = TTL swept by the TravelLifecycleScheduler (§13).
    expires_at               TIMESTAMPTZ,
    -- Provenance to the originating quest instance. SET NULL (not CASCADE): the
    -- effect outlives the quest row; Zerfaserung/Spuren grants pass NULL here.
    source_quest_instance_id UUID REFERENCES travel_quest_instances(id) ON DELETE SET NULL,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_travel_effects_agent   ON agent_travel_effects (agent_id);
CREATE INDEX idx_agent_travel_effects_expires ON agent_travel_effects (expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_agent_travel_effects_source  ON agent_travel_effects (source_quest_instance_id) WHERE source_quest_instance_id IS NOT NULL;


-- ═══════════════════════════════════════════════════════════════════
-- 2. zone_modifiers — TTL'd zone-scoped modifiers (home-only)
-- ═══════════════════════════════════════════════════════════════════
-- The home-only `zone_modifier` resolver effect (§10) writes here. source is a
-- PROVENANCE lock: this table holds travel-originated modifiers only and must not
-- become a general zone-modifier store. expires_at is NOT NULL — every modifier
-- is transient (the resolver always sets a TTL).

CREATE TABLE zone_modifiers (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_id       UUID NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
    modifier_key  TEXT NOT NULL,
    payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
    expires_at    TIMESTAMPTZ NOT NULL,                       -- always TTL'd (§10)
    source        TEXT NOT NULL DEFAULT 'travel_quest'
                      CHECK (source IN ('travel_quest')),     -- provenance lock, not a vocabulary
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_zone_modifiers_zone    ON zone_modifiers (zone_id);
CREATE INDEX idx_zone_modifiers_expires ON zone_modifiers (expires_at);


-- ═══════════════════════════════════════════════════════════════════
-- 3. travel_dressing_cache — content-hash LLM prose cache (§6.4)
-- ═══════════════════════════════════════════════════════════════════
-- cache_key = sha256(template_key · template_version · sorted entity-ref ids ·
-- locale · dissonance_band_bucket) (§6.4). The key is the content identity, so a
-- hit returns identical prose with zero LLM spend. locale is denormalized out of
-- the hash for filtering/debugging. TTL 30 days, swept by the scheduler.

CREATE TABLE travel_dressing_cache (
    cache_key   TEXT PRIMARY KEY,
    prose       JSONB NOT NULL DEFAULT '{}'::jsonb,
    locale      TEXT NOT NULL DEFAULT 'de',
    expires_at  TIMESTAMPTZ NOT NULL,                         -- now() + 30 days at write
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_travel_dressing_cache_expires ON travel_dressing_cache (expires_at);


-- ═══════════════════════════════════════════════════════════════════
-- 4. Updated-at triggers (shared set_updated_at function)
-- ═══════════════════════════════════════════════════════════════════
-- All three are mutable: effects/modifiers may have expires_at extended or be
-- re-resolved; the cache slides its TTL on access (upsert).

CREATE TRIGGER set_agent_travel_effects_updated_at
    BEFORE UPDATE ON agent_travel_effects
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_zone_modifiers_updated_at
    BEFORE UPDATE ON zone_modifiers
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_travel_dressing_cache_updated_at
    BEFORE UPDATE ON travel_dressing_cache
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ═══════════════════════════════════════════════════════════════════
-- 5. Row Level Security (plan §5)
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE agent_travel_effects  ENABLE ROW LEVEL SECURITY;
ALTER TABLE zone_modifiers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_dressing_cache ENABLE ROW LEVEL SECURITY;

-- Agent effects: sim-public read (world state); service_role resolver writes only.
CREATE POLICY agent_travel_effects_public_select
    ON agent_travel_effects FOR SELECT TO anon, authenticated USING (TRUE);
CREATE POLICY agent_travel_effects_service_role
    ON agent_travel_effects FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- Zone modifiers: sim-public read (world state); service_role resolver writes only.
CREATE POLICY zone_modifiers_public_select
    ON zone_modifiers FOR SELECT TO anon, authenticated USING (TRUE);
CREATE POLICY zone_modifiers_service_role
    ON zone_modifiers FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- Dressing cache: backend-only, both directions (cost-control cache, no player
-- surface — travel_telemetry_events precedent).
CREATE POLICY travel_dressing_cache_service_role
    ON travel_dressing_cache FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);


-- ═══════════════════════════════════════════════════════════════════
-- 6. Table comments
-- ═══════════════════════════════════════════════════════════════════

COMMENT ON TABLE agent_travel_effects IS
    'Agent-scoped travel impact: the landing table for the home-only grant_agent_effect resolver effect (plan §10). NEW table, deliberately NOT agent_dungeon_loot_effects (finding 15): that table CHECK-locks effect_type to 6 dungeon verbs and FKs source_run_id to resonance_dungeon_runs. effect_key is open (content/pack-defined granted-modifier key; pack CI validates the vocabulary, no DB CHECK). expires_at NULL = permanent. source_quest_instance_id SET NULL — the effect outlives its quest. Sim-public read; service_role resolver write only.';

COMMENT ON TABLE zone_modifiers IS
    'TTL''d zone-scoped modifiers from the home-only zone_modifier resolver effect (plan §10). source CHECK (''travel_quest'') is a PROVENANCE lock, not a content vocabulary — this table holds travel-originated modifiers only and is not the platform general zone-modifier store. expires_at NOT NULL (every modifier is transient). Sim-public read; service_role resolver write only.';

COMMENT ON TABLE travel_dressing_cache IS
    'Content-hash-keyed LLM dressing cache (plan §6.4): cache_key = sha256(template_key · template_version · sorted entity-ref ids · locale · dissonance_band_bucket). A hit returns identical prose with zero LLM spend; per-user budget rides ai_budget (§9.3). TTL 30 days, scheduler-swept. Backend-only both directions (no player surface). travel_quest_instances.dressing_cache_key (241) soft-references cache_key (no FK — the cache is disposable).';

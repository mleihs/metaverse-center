-- Migration 244: DRIFT — embassy_canon_repair (P0a ambassador linkage + canon fix)
--
-- Spec: docs/plans/drift-implementation-plan.md §3.6. Design contract:
--       drift-…-concept.md v0.4 §8.5 (Madam Lacewing canon), gate-review
--       partial-report findings 1–2 (ambassadors are unlinked name strings).
--
-- Sixth DRIFT P0a migration. UNLIKE 239–243 (schema), this is a DATA migration:
-- it repairs the embassy ambassador canon and back-fills agent_id references so
-- travel quest selectors can key off ambassadors as real entities (KPI 1 cannot be
-- satisfied against bare name strings). No schema change, no gate — it improves the
-- correctness of the EXISTING ambassador-enrichment path (agent_service
-- _enrich_ambassador_flag, which matches embassy_metadata names against agents).
--
-- embassy_metadata shape (jsonb column on `embassies`):
--   { "protocol": …, "ache_point": …,
--     "ambassador_a": { "name", "role", "quirk" },   -- represents simulation_a_id
--     "ambassador_b": { "name", "role", "quirk" } }   -- represents simulation_b_id
-- Ambassadors are bare name strings — no agent_id. This migration adds an agent_id
-- field INTO each ambassador object (plan §3.6: "into embassy_metadata ambassadors")
-- by resolving the name against an agent in the paired simulation. It is a soft
-- reference (a jsonb field, resolved by selectors), not a DB FOREIGN KEY — you
-- cannot FK into a jsonb field, and the existing structure is jsonb by design.
--
-- ── Canon repair: Archivist Mossback → Madam Lacewing (findings 1–2) ───────────
-- The Gaslit Reach retheme renamed its embassy ambassador; embassy_metadata still
-- carries the stale "Archivist Mossback" string, so the enrichment fails to match
-- the real "Madam Lacewing" agent and she is never flagged as ambassador. The fix
-- renames Mossback → Madam Lacewing — but ONLY where the slot's paired simulation
-- actually has a "Madam Lacewing" agent. This scoping (rather than a blanket
-- find-replace) is deliberate and env-robust: it repairs every Gaslit-Reach
-- ambassador slot and CANNOT mislabel a slot for a different world.
--
-- ── Pre-existing scrambling found in the seed data (OUT OF SCOPE — see commit) ─
-- Auditing the 4 Mossback embassies surfaced that one embassy (Cité des Dames ↔
-- Gaslit Reach) has its two ambassadors SWAPPED: "Archivist Mossback" sits in the
-- Cité slot while "Hildegard von Bingen" (a Cité figure) sits in the Gaslit slot;
-- two other embassies pair "Sor Juana"/Station-Null and "Navigator Braun"/Cité —
-- ambassador names that match no agent in their paired sim. These are pre-existing
-- world-seed errors beyond §3.6's documented scope (Mossback→Lacewing). This
-- migration does NOT guess their intended canon: it scopes the rename precisely and
-- leaves the unresolved slots without an agent_id (the back-fill is best-effort).
-- The residual mismatches are reported in the commit message for a separate,
-- explicit canon decision — not silently "fixed" here.
--
-- Idempotent: re-running renames nothing new (no Mossback strings remain in
-- Lacewing-bearing slots) and re-sets the same agent_id values.
-- Active-view refresh: none (no column change). Behind no gate (canon correctness).


-- ═══════════════════════════════════════════════════════════════════
-- 1. Canon repair — Archivist Mossback → Madam Lacewing
-- ═══════════════════════════════════════════════════════════════════
-- Scoped to slots whose paired simulation has a "Madam Lacewing" agent, so the
-- rename can only ever land on a genuine Gaslit-Reach ambassador slot.

UPDATE embassies e
SET embassy_metadata = jsonb_set(e.embassy_metadata, '{ambassador_a,name}', '"Madam Lacewing"'::jsonb)
WHERE e.embassy_metadata->'ambassador_a'->>'name' = 'Archivist Mossback'
  AND EXISTS (
      SELECT 1 FROM agents a
      WHERE a.simulation_id = e.simulation_a_id AND a.name = 'Madam Lacewing'
  );

UPDATE embassies e
SET embassy_metadata = jsonb_set(e.embassy_metadata, '{ambassador_b,name}', '"Madam Lacewing"'::jsonb)
WHERE e.embassy_metadata->'ambassador_b'->>'name' = 'Archivist Mossback'
  AND EXISTS (
      SELECT 1 FROM agents a
      WHERE a.simulation_id = e.simulation_b_id AND a.name = 'Madam Lacewing'
  );


-- ═══════════════════════════════════════════════════════════════════
-- 2. agent_id back-fill — resolve each ambassador name against its paired sim
-- ═══════════════════════════════════════════════════════════════════
-- ambassador_a is matched against an agent in simulation_a_id; ambassador_b
-- against simulation_b_id. Runs AFTER the rename so Madam Lacewing resolves.
-- create_missing=true adds the agent_id key. Slots whose name matches no agent in
-- the paired sim are left without an agent_id (best-effort — selectors LEFT JOIN).

UPDATE embassies e
SET embassy_metadata = jsonb_set(
        e.embassy_metadata, '{ambassador_a,agent_id}', to_jsonb(a.id), true)
FROM agents a
WHERE e.embassy_metadata ? 'ambassador_a'
  AND a.simulation_id = e.simulation_a_id
  AND a.name = e.embassy_metadata->'ambassador_a'->>'name';

UPDATE embassies e
SET embassy_metadata = jsonb_set(
        e.embassy_metadata, '{ambassador_b,agent_id}', to_jsonb(a.id), true)
FROM agents a
WHERE e.embassy_metadata ? 'ambassador_b'
  AND a.simulation_id = e.simulation_b_id
  AND a.name = e.embassy_metadata->'ambassador_b'->>'name';

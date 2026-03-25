-- === MIGRATION 157: Agent Autonomy Bootstrap ===
--
-- Prerequisite for Phase A5 (Default Autonomy ON) from game-systems-integration.md.
-- Without zone/building assignments + autonomy records, heartbeat Phase 9 ticks
-- produce empty results: no needs decay, no mood, no activities, no social interactions.
--
-- This migration ensures ALL agents across ALL simulations have:
--   1. A zone assignment (current_zone_id) — affinity-based matching
--   2. A building assignment (current_building_id) — within assigned zone
--   3. An agent_needs record (sensible defaults, personality extraction refines later)
--   4. An agent_mood record (neutral baseline)
--   5. Bidirectional agent_opinions records (neutral compatibility)
--
-- Design: PostgreSQL-first (ADR-007). All logic in SQL, no Python orchestration.
-- Safety: Fully idempotent — ON CONFLICT DO NOTHING, COALESCE, WHERE NOT EXISTS.
-- Agents already assigned (e.g. Velgarien) are untouched.


-- ── 1. Zone Assignment: system ↔ zone_type affinity + round-robin fallback ──

-- Affinity mapping rationale:
--   politics/military → government, command, administrative zones
--   economy           → industrial, commercial, workshops zones
--   religion          → residential, cultural, habitation, quarters zones
--   media             → residential, commercial zones
--   NULL/unknown      → round-robin distribution across all zones (even spread)

WITH unplaced AS (
  SELECT
    a.id AS agent_id,
    a.simulation_id,
    a.system,
    ROW_NUMBER() OVER (
      PARTITION BY a.simulation_id ORDER BY a.name
    ) - 1 AS agent_idx
  FROM agents a
  WHERE a.deleted_at IS NULL
    AND a.current_zone_id IS NULL
),
zone_list AS (
  SELECT
    z.id AS zone_id,
    z.simulation_id,
    z.zone_type,
    ROW_NUMBER() OVER (
      PARTITION BY z.simulation_id ORDER BY z.created_at, z.id
    ) - 1 AS zone_idx,
    COUNT(*) OVER (PARTITION BY z.simulation_id) AS zone_count
  FROM zones z
),
scored AS (
  -- Score each (agent, zone) pair. DISTINCT ON picks the best zone per agent.
  SELECT DISTINCT ON (u.agent_id)
    u.agent_id,
    zl.zone_id,
    CASE
      -- Politics/Military → government/command zones
      WHEN u.system IN ('politics', 'military')
        AND zl.zone_type IN ('government', 'command', 'administrative')
        THEN 100
      -- Economy → industrial/commercial/workshop zones
      WHEN u.system = 'economy'
        AND zl.zone_type IN ('industrial', 'commercial', 'workshops')
        THEN 100
      -- Religion → residential/cultural/habitation zones
      WHEN u.system = 'religion'
        AND zl.zone_type IN ('residential', 'cultural', 'habitation', 'quarters')
        THEN 100
      -- Media → residential/commercial zones
      WHEN u.system = 'media'
        AND zl.zone_type IN ('residential', 'commercial')
        THEN 100
      -- Round-robin fallback: distribute evenly by index modulo
      WHEN zl.zone_idx = u.agent_idx % zl.zone_count
        THEN 50
      ELSE 0
    END AS affinity
  FROM unplaced u
  JOIN zone_list zl ON u.simulation_id = zl.simulation_id
  ORDER BY u.agent_id, affinity DESC, random()
)
UPDATE agents a
SET current_zone_id = s.zone_id
FROM scored s
WHERE a.id = s.agent_id;


-- ── 2. Building Assignment: within assigned zone, type affinity + round-robin ──

WITH unplaced AS (
  SELECT
    a.id AS agent_id,
    a.simulation_id,
    a.current_zone_id,
    a.system,
    ROW_NUMBER() OVER (
      PARTITION BY a.current_zone_id ORDER BY a.name
    ) - 1 AS agent_idx
  FROM agents a
  WHERE a.deleted_at IS NULL
    AND a.current_zone_id IS NOT NULL
    AND a.current_building_id IS NULL
),
building_list AS (
  SELECT
    b.id AS building_id,
    b.zone_id,
    b.building_type,
    ROW_NUMBER() OVER (
      PARTITION BY b.zone_id ORDER BY b.created_at, b.id
    ) - 1 AS bldg_idx,
    COUNT(*) OVER (PARTITION BY b.zone_id) AS bldg_count
  FROM buildings b
  WHERE b.zone_id IS NOT NULL
    AND b.deleted_at IS NULL
),
scored AS (
  SELECT DISTINCT ON (u.agent_id)
    u.agent_id,
    bl.building_id,
    CASE
      -- Politics/Military → government/military buildings
      WHEN u.system IN ('politics', 'military')
        AND bl.building_type IN ('government', 'military', 'administrative')
        THEN 100
      -- Economy → commercial/industrial buildings
      WHEN u.system = 'economy'
        AND bl.building_type IN ('commercial', 'industrial')
        THEN 100
      -- Religion → cultural/religious buildings
      WHEN u.system = 'religion'
        AND bl.building_type IN ('cultural', 'religious')
        THEN 100
      -- Media → commercial/media buildings
      WHEN u.system = 'media'
        AND bl.building_type IN ('commercial', 'media')
        THEN 100
      -- Round-robin fallback within zone
      WHEN bl.bldg_idx = u.agent_idx % bl.bldg_count
        THEN 50
      ELSE 0
    END AS affinity
  FROM unplaced u
  JOIN building_list bl ON u.current_zone_id = bl.zone_id
  ORDER BY u.agent_id, affinity DESC, random()
)
UPDATE agents a
SET current_building_id = s.building_id
FROM scored s
WHERE a.id = s.agent_id;


-- ── 3. Bootstrap agent_needs: sensible defaults for all agents ──────────────
-- Default decay rates match fn_initialize_agent_autonomy() signature defaults.
-- Personality extraction (LLM-based) can refine decay rates per-agent later.

INSERT INTO agent_needs (agent_id, simulation_id)
SELECT a.id, a.simulation_id
FROM agents a
WHERE a.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM agent_needs n WHERE n.agent_id = a.id
  )
ON CONFLICT (agent_id) DO NOTHING;


-- ── 4. Bootstrap agent_mood: neutral baseline for all agents ────────────────
-- Default resilience/volatility/sociability = 0.5 (midpoint).
-- Personality extraction can refine these per-agent later.

INSERT INTO agent_mood (agent_id, simulation_id)
SELECT a.id, a.simulation_id
FROM agents a
WHERE a.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM agent_mood m WHERE m.agent_id = a.id
  )
ON CONFLICT (agent_id) DO NOTHING;


-- ── 5. Bootstrap agent_opinions: bidirectional pairs for all co-sim agents ──
-- base_compatibility = 0.0 (neutral) for all pairs without personality data.
-- PersonalityExtractionService.initialize_opinions() can refine later when
-- personality_profile JSONB is extracted per-agent.

INSERT INTO agent_opinions (agent_id, target_agent_id, simulation_id, base_compatibility)
SELECT a.id, b.id, a.simulation_id, 0.0
FROM agents a
JOIN agents b
  ON  a.simulation_id = b.simulation_id
  AND a.id != b.id
WHERE a.deleted_at IS NULL
  AND b.deleted_at IS NULL
ON CONFLICT (agent_id, target_agent_id) DO NOTHING;


-- ── 6. Verification comment ─────────────────────────────────────────────────
-- After this migration:
--   SELECT simulation_id, count(*) AS agents,
--          count(current_zone_id) AS with_zone,
--          count(current_building_id) AS with_building
--   FROM agents WHERE deleted_at IS NULL
--   GROUP BY simulation_id ORDER BY simulation_id;
--
-- Expected: with_zone = agents for all sims with zones.
--           with_building = agents for all sims with buildings in zones.
--           Sims without zones/buildings remain unaffected.

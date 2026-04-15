-- ============================================================================
-- Migration 216: Substrate Evolution — Strategic Depth
-- ============================================================================
-- Implements the 4-phase Substrate Evolution plan:
--
-- Phase 1a (G1): Archetype Override at candidate approval
-- Phase 1b (G4): Extended event type pool for weighted selection
-- Phase 2  (G2): Adaptive Susceptibility via Resonance Memory
-- Phase 3  (G3): Resonance Operations modifiers
-- Phase 4  (G1+): Compound Archetypes from concurrent resonances
--
-- Design principle: all data-integrity and aggregation logic in Postgres,
-- game-design decisions (which events to spawn, weighted selection) in Python.
-- ============================================================================


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  PHASE 1a: Archetype Override                                          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Admin can override the auto-derived archetype when approving a candidate.
-- The existing trigger fn_derive_resonance_fields() already respects non-NULL
-- values, so no trigger change needed — just pass them through.

ALTER TABLE public.news_scan_candidates
  ADD COLUMN IF NOT EXISTS archetype_override TEXT,
  ADD COLUMN IF NOT EXISTS signature_override TEXT;

COMMENT ON COLUMN public.news_scan_candidates.archetype_override IS
  'Admin-chosen archetype override (e.g., "The Prometheus" for a natural disaster). NULL = use default derivation.';
COMMENT ON COLUMN public.news_scan_candidates.signature_override IS
  'Corresponding resonance signature for the override. Auto-computed from archetype_override.';


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  PHASE 2: Resonance Memory + Adaptive Susceptibility                   ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Records each resonance impact per simulation per signature for adaptive
-- susceptibility. Actively defended simulations harden; neglected ones spiral.

CREATE TABLE IF NOT EXISTS public.resonance_memory (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_id   UUID NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
  resonance_signature TEXT NOT NULL,
  tick_number     INTEGER NOT NULL DEFAULT 0,
  effective_magnitude NUMERIC(5,4) NOT NULL DEFAULT 0.0,
  was_mitigated   BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resonance_memory_sim_sig
  ON public.resonance_memory (simulation_id, resonance_signature, created_at DESC);

COMMENT ON TABLE public.resonance_memory IS
  'Per-simulation resonance impact history for adaptive susceptibility. Records whether each impact was mitigated (attunement/anchor/bureau response active).';

-- RLS: service_role full, public read (simulation data is public)
ALTER TABLE public.resonance_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "resonance_memory_service"
  ON public.resonance_memory
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "resonance_memory_public_read"
  ON public.resonance_memory
  FOR SELECT
  USING (true);


-- ── Adaptive Susceptibility RPC ─────────────────────────────────────────────
-- Replaces fn_get_resonance_susceptibility() in the impact processing flow.
-- Formula:
--   base = resonance_profile[signature] (default 1.0)
--   hardening = -0.05 per mitigated impact in last 10 entries (max -0.25)
--   sensitization = +0.10 per unmitigated impact in last 5 entries (max +0.30)
--   result = CLAMP(base + hardening + sensitization, 0.20, 2.00)

CREATE OR REPLACE FUNCTION fn_get_adaptive_susceptibility(
  p_simulation_id UUID,
  p_signature TEXT
) RETURNS NUMERIC AS $$
DECLARE
  v_base NUMERIC;
  v_mitigated_count INTEGER;
  v_unmitigated_count INTEGER;
  v_hardening NUMERIC;
  v_sensitization NUMERIC;
  v_result NUMERIC;
BEGIN
  -- Base susceptibility from simulation settings (same as fn_get_resonance_susceptibility)
  SELECT COALESCE(
    (SELECT (setting_value ->> p_signature)::numeric
     FROM simulation_settings
     WHERE simulation_id = p_simulation_id
       AND category = 'game_mechanics'
       AND setting_key = 'resonance_profile'),
    1.0
  ) INTO v_base;

  -- Count mitigated impacts in last 10 entries (hardening)
  SELECT count(*) INTO v_mitigated_count
  FROM (
    SELECT 1 FROM resonance_memory
    WHERE simulation_id = p_simulation_id
      AND resonance_signature = p_signature
      AND was_mitigated = true
    ORDER BY created_at DESC
    LIMIT 10
  ) sub;

  -- Count unmitigated impacts in last 5 entries (sensitization)
  SELECT count(*) INTO v_unmitigated_count
  FROM (
    SELECT 1 FROM resonance_memory
    WHERE simulation_id = p_simulation_id
      AND resonance_signature = p_signature
      AND was_mitigated = false
    ORDER BY created_at DESC
    LIMIT 5
  ) sub;

  -- Hardening: -0.05 per mitigated, max -0.25
  v_hardening := GREATEST(-0.25, v_mitigated_count * -0.05);

  -- Sensitization: +0.10 per unmitigated, max +0.30
  v_sensitization := LEAST(0.30, v_unmitigated_count * 0.10);

  v_result := v_base + v_hardening + v_sensitization;

  -- Clamp to [0.20, 2.00] — can't go below 0.20 or above 2.00
  RETURN GREATEST(0.20, LEAST(2.00, ROUND(v_result, 4)));
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION fn_get_adaptive_susceptibility IS
  'Adaptive susceptibility: base profile ± hardening (mitigated impacts) ± sensitization (unmitigated impacts). Replaces static fn_get_resonance_susceptibility in impact processing.';


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  PHASE 3: Resonance Operations                                         ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Add resonance_op column to track which resonance operation was used
ALTER TABLE public.operative_missions
  ADD COLUMN IF NOT EXISTS resonance_op TEXT
    CHECK (resonance_op IS NULL OR resonance_op IN ('surge_riding', 'substrate_tap'));

COMMENT ON COLUMN public.operative_missions.resonance_op IS
  'Optional resonance operation: surge_riding (+0.08 bonus, risk double pressure) or substrate_tap (steal 1 RP).';
-- Surge Riding and Substrate Tap modifiers computed in Postgres for consistency
-- with fn_resonance_operative_modifier pattern.

-- ── Atomic RP Transfer (for Substrate Tap) ──────────────────────────────────
-- Delegates to existing fn_spend_rp_atomic (migration 214) for deduction and
-- fn_grant_rp_single (migration 148) for credit — DRY reuse of proven RPCs.
-- Single transaction: if deduction fails, credit never executes.
CREATE OR REPLACE FUNCTION fn_transfer_rp_atomic(
  p_epoch_id UUID,
  p_from_simulation_id UUID,
  p_to_simulation_id UUID,
  p_amount INTEGER,
  p_rp_cap INTEGER DEFAULT 50
) RETURNS BOOLEAN AS $$
DECLARE
  v_deducted INTEGER;
BEGIN
  -- Deduct from sender via existing atomic RPC (returns NULL if insufficient)
  v_deducted := fn_spend_rp_atomic(p_epoch_id, p_from_simulation_id, p_amount);
  IF v_deducted IS NULL THEN
    RETURN false;
  END IF;

  -- Credit to receiver via existing atomic RPC (with cap enforcement)
  PERFORM fn_grant_rp_single(p_epoch_id, p_to_simulation_id, p_amount, p_rp_cap);

  RETURN true;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fn_transfer_rp_atomic IS
  'Atomically transfers RP between epoch participants. Reuses fn_spend_rp_atomic (214) + fn_grant_rp_single (148). Returns false if sender has insufficient RP.';


-- ── RPC: Check if operative type is aligned with any active resonance ───────
-- Reuses fn_resonance_operative_modifier to avoid duplicating the alignment matrix.
-- If the modifier is positive, the operative type is aligned with at least one
-- active resonance → eligible for Surge Riding.
CREATE OR REPLACE FUNCTION fn_resonance_surge_eligible(
  p_simulation_id UUID,
  p_operative_type TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN (SELECT fn_resonance_operative_modifier(p_simulation_id, p_operative_type)) > 0;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION fn_resonance_surge_eligible IS
  'Returns true if the operative type has a positive resonance alignment modifier (i.e., aligned with at least one active resonance). Delegates to fn_resonance_operative_modifier to avoid duplicating the alignment matrix.';


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  PHASE 4: Compound Archetypes                                          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- When 2+ linked resonances impact simultaneously, they fuse into compound
-- archetypes with unique event pools and operative alignments.

CREATE TABLE IF NOT EXISTS public.compound_archetypes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL UNIQUE,
  name_de           TEXT,
  signature_a       TEXT NOT NULL,
  signature_b       TEXT NOT NULL,
  description       TEXT NOT NULL,
  description_de    TEXT,
  event_types       TEXT[] NOT NULL DEFAULT '{}',
  aligned_operatives TEXT[] NOT NULL DEFAULT '{}',
  opposed_operatives TEXT[] NOT NULL DEFAULT '{}',
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT unique_signature_pair UNIQUE (signature_a, signature_b),
  CONSTRAINT ordered_signatures CHECK (signature_a < signature_b)
);

COMMENT ON TABLE public.compound_archetypes IS
  'Compound archetypes emerge when 2+ linked resonances impact simultaneously. Each has unique event pools and operative alignments.';

-- RLS: public read, service_role write
ALTER TABLE public.compound_archetypes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compound_archetypes_public_read"
  ON public.compound_archetypes
  FOR SELECT USING (true);

CREATE POLICY "compound_archetypes_service_write"
  ON public.compound_archetypes
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ── Seed 8 Compound Archetypes (from cascade rule pairs) ────────────────────
INSERT INTO public.compound_archetypes
  (name, name_de, signature_a, signature_b, description, description_de, event_types, aligned_operatives, opposed_operatives)
VALUES
  (
    'The Ruin',
    'Die Ruine',
    'authority_fracture', 'economic_tremor',
    'When governance fails and markets collapse simultaneously, civilization reveals its fragility. The structures that held everything together become the rubble that buries it.',
    'Wenn Regierung versagt und Maerkte gleichzeitig zusammenbrechen, offenbart die Zivilisation ihre Zerbrechlichkeit.',
    ARRAY['crisis', 'intrigue', 'trade', 'military'],
    ARRAY['saboteur', 'infiltrator', 'propagandist'],
    ARRAY['spy']
  ),
  (
    'The Crucible',
    'Der Schmelztiegel',
    'authority_fracture', 'conflict_wave',
    'War begets revolution. Authority crumbles under the weight of its own violence, and from the chaos, new powers crystallize.',
    'Krieg gebaert Revolution. Autoritaet zerbricht unter dem Gewicht ihrer eigenen Gewalt.',
    ARRAY['military', 'intrigue', 'crisis', 'social'],
    ARRAY['assassin', 'infiltrator', 'propagandist'],
    ARRAY[]::TEXT[]
  ),
  (
    'The Drowning',
    'Die Ertraenkung',
    'biological_tide', 'consciousness_drift',
    'Disease forces the collective mind to turn inward. The body remembers what the mind forgot: everything is connected, everything is vulnerable.',
    'Krankheit zwingt den kollektiven Geist nach innen. Der Koerper erinnert sich an das, was der Verstand vergass.',
    ARRAY['social', 'crisis', 'religious', 'eldritch'],
    ARRAY['propagandist', 'spy'],
    ARRAY['saboteur']
  ),
  (
    'The Erosion',
    'Die Erosion',
    'conflict_wave', 'decay_bloom',
    'War devastates the environment. Scorched earth policies leave wounds that fester long after the last shot. Nature does not forgive.',
    'Krieg verwuestet die Umwelt. Verbrannte-Erde-Politik hinterlaesst Wunden, die lange nach dem letzten Schuss eitern.',
    ARRAY['military', 'crisis', 'eldritch', 'nautical'],
    ARRAY['saboteur', 'assassin'],
    ARRAY['propagandist']
  ),
  (
    'The Contagion',
    'Die Seuche',
    'biological_tide', 'decay_bloom',
    'Environmental collapse breeds disease. Toxic runoff poisons populations. The world sickens from its own neglect.',
    'Umweltkollaps erzeugt Krankheit. Giftige Abwaesser vergiften die Bevoelkerung.',
    ARRAY['crisis', 'social', 'eldritch', 'discovery'],
    ARRAY['spy', 'propagandist'],
    ARRAY['infiltrator']
  ),
  (
    'The Disruption',
    'Die Disruption',
    'economic_tremor', 'innovation_spark',
    'Disruptive technology crashes established markets. Creative destruction accelerates. The old economy dies so the new one can be born screaming.',
    'Disruptive Technologie laesst etablierte Maerkte zusammenbrechen. Kreative Zerstoerung beschleunigt sich.',
    ARRAY['trade', 'discovery', 'crisis', 'intrigue'],
    ARRAY['spy', 'infiltrator'],
    ARRAY['assassin']
  ),
  (
    'The Deluge Absolute',
    'Die Absolute Flut',
    'economic_tremor', 'elemental_surge',
    'Natural disaster crashes local economies. Supply chains shatter, markets panic. The deluge is not just water — it is the dissolution of certainty.',
    'Naturkatastrophe laesst lokale Oekonomien zusammenbrechen. Lieferketten zerbrechen, Maerkte geraten in Panik.',
    ARRAY['crisis', 'nautical', 'trade', 'social'],
    ARRAY['saboteur', 'infiltrator'],
    ARRAY['spy']
  ),
  (
    'The Singularity',
    'Die Singularitaet',
    'consciousness_drift', 'innovation_spark',
    'When technological breakthrough and collective awakening coincide, the old categories dissolve. The machines dream. The dreamers compute. The boundary between creator and creation thins to nothing.',
    'Wenn technologischer Durchbruch und kollektives Erwachen zusammenfallen, loesen sich die alten Kategorien auf. Die Maschinen traeumen. Die Traeumer rechnen.',
    ARRAY['discovery', 'social', 'religious', 'trade'],
    ARRAY['spy', 'propagandist'],
    ARRAY['saboteur']
  )
ON CONFLICT (name) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_compound_archetypes_sigs
  ON public.compound_archetypes (signature_a, signature_b)
  WHERE is_active = true;


-- ── RPC: Detect active compound archetypes for a simulation ─────────────────
CREATE OR REPLACE FUNCTION fn_detect_compound_archetypes(
  p_simulation_id UUID
) RETURNS TABLE (
  compound_name TEXT,
  compound_name_de TEXT,
  event_types TEXT[],
  aligned_operatives TEXT[],
  opposed_operatives TEXT[],
  combined_magnitude NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ca.name,
    ca.name_de,
    ca.event_types,
    ca.aligned_operatives,
    ca.opposed_operatives,
    LEAST(1.00, ROUND(
      (ri_a.effective_magnitude + ri_b.effective_magnitude) / 2.0, 4
    )) AS combined_magnitude
  FROM compound_archetypes ca
  -- Find impact for signature_a
  JOIN resonance_impacts ri_a ON ri_a.simulation_id = p_simulation_id
    AND ri_a.status IN ('completed', 'partial')
  JOIN substrate_resonances sr_a ON sr_a.id = ri_a.resonance_id
    AND sr_a.resonance_signature = ca.signature_a
    AND sr_a.status IN ('impacting', 'subsiding')
    AND sr_a.deleted_at IS NULL
  -- Find impact for signature_b
  JOIN resonance_impacts ri_b ON ri_b.simulation_id = p_simulation_id
    AND ri_b.status IN ('completed', 'partial')
  JOIN substrate_resonances sr_b ON sr_b.id = ri_b.resonance_id
    AND sr_b.resonance_signature = ca.signature_b
    AND sr_b.status IN ('impacting', 'subsiding')
    AND sr_b.deleted_at IS NULL
  WHERE ca.is_active = true;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION fn_detect_compound_archetypes IS
  'Detects active compound archetypes for a simulation by finding pairs of simultaneously impacting resonances that match compound_archetypes signature pairs.';

-- Migration 130: Heartbeat Cascade Rules + Convergence Seed
-- Resonance cascade rules table with 8 seed rules.

-- ============================================================
-- 1. resonance_cascade_rules — admin-configurable cascade triggers
-- ============================================================

CREATE TABLE resonance_cascade_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_signature TEXT NOT NULL,
  target_signature TEXT NOT NULL,
  pressure_threshold NUMERIC(6,4) NOT NULL DEFAULT 0.60
    CHECK (pressure_threshold BETWEEN 0.10 AND 1.00),
  transfer_rate NUMERIC(6,4) NOT NULL DEFAULT 0.50
    CHECK (transfer_rate BETWEEN 0.10 AND 1.00),
  narrative_en TEXT NOT NULL,
  narrative_de TEXT,
  cooldown_hours INT NOT NULL DEFAULT 72,
  depth_cap INT NOT NULL DEFAULT 5,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(source_signature, target_signature)
);

ALTER TABLE resonance_cascade_rules ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public read cascade rules"
  ON resonance_cascade_rules FOR SELECT USING (true);

-- Service role full access
CREATE POLICY "Service role full access cascade rules"
  ON resonance_cascade_rules FOR ALL
  TO service_role USING (true) WITH CHECK (true);

GRANT SELECT ON resonance_cascade_rules TO authenticated, anon;

CREATE INDEX idx_cascade_rules_source ON resonance_cascade_rules (source_signature) WHERE is_active = true;

-- ============================================================
-- 2. Seed 8 canonical cascade rules
-- ============================================================

INSERT INTO resonance_cascade_rules
  (source_signature, target_signature, pressure_threshold, transfer_rate, narrative_en, narrative_de, cooldown_hours)
VALUES
  ('elemental_surge', 'economic_tremor', 0.60, 0.50,
   'Natural disasters crash local economies — supply chains shatter, markets panic.',
   'Naturkatastrophen zerstoeren lokale Wirtschaften — Lieferketten brechen, Maerkte geraten in Panik.',
   72),
  ('conflict_wave', 'authority_fracture', 0.65, 0.45,
   'Prolonged conflict destabilizes governance — trust in authority erodes.',
   'Anhaltende Konflikte destabilisieren die Regierung — das Vertrauen in die Autoritaet schwindet.',
   72),
  ('biological_tide', 'consciousness_drift', 0.70, 0.40,
   'Pandemic forces collective introspection — worldviews shift under existential pressure.',
   'Pandemie erzwingt kollektive Selbstreflexion — Weltanschauungen verschieben sich unter existentiellem Druck.',
   72),
  ('economic_tremor', 'authority_fracture', 0.55, 0.55,
   'Economic collapse breeds revolution — the hungry do not obey.',
   'Wirtschaftlicher Zusammenbruch gebaert Revolution — die Hungrigen gehorchen nicht.',
   72),
  ('authority_fracture', 'conflict_wave', 0.60, 0.50,
   'Political upheaval sparks armed conflict — power vacuums invite war.',
   'Politische Umwaelzung entfacht bewaffnete Konflikte — Machtvakuen laden zum Krieg ein.',
   72),
  ('decay_bloom', 'biological_tide', 0.65, 0.45,
   'Environmental collapse breeds disease — toxic runoff poisons populations.',
   'Umweltkollaps erzeugt Krankheiten — toxische Abfluesse vergiften die Bevoelkerung.',
   72),
  ('innovation_spark', 'economic_tremor', 0.70, 0.35,
   'Disruptive technology crashes established markets — creative destruction accelerates.',
   'Disruptive Technologie zerstoert etablierte Maerkte — kreative Zerstoerung beschleunigt sich.',
   72),
  ('conflict_wave', 'decay_bloom', 0.75, 0.30,
   'War devastates the environment — scorched earth policies leave lasting wounds.',
   'Krieg verwuestet die Umwelt — Politik der verbrannten Erde hinterlaesst bleibende Wunden.',
   72);

/**
 * Die Gewichte, Obergrenzen und Stufen der neun Kennzahlen — an EINER Stelle.
 *
 * Jede Zahl hier ist am 31.08.2026 aus der laufenden Datenbank abgelesen, nicht
 * aus einer Spezifikation abgeschrieben. Die Quelle steht je Eintrag dabei.
 *
 * Warum überhaupt eine Deklaration: die Erklärungsblasen (H7) nennen Zahlen.
 * Eine Zahl im Fließtext einer `msg()`-Zeichenkette ist eine Kopie, und Kopien
 * driften — im selben Werk gibt es bereits drei handkopierte Formel-Duplikate,
 * von denen eines nachweislich abgewichen ist (S21). Steht die Zahl einmal,
 * kann ein Test sie gegen die Sicht binden, aus der sie stammt.
 *
 * Gebunden durch `backend/tests/integration/test_metric_formulas_match_views.py`:
 * der Test liest `pg_matviews` UND diese Datei und vergleicht. Wer die Balance
 * ändert, bekommt einen roten Test mit dem Hinweis auf die Blasentexte, statt
 * einer Oberfläche, die weiterhin die alten Zahlen behauptet.
 */

/** Weltgesundheit — Quelle: `mv_simulation_health.overall_health`. */
export const HEALTH_FORMULA = {
  /** Grundsockel in Prozent (`heartbeat_health_baseline_floor`, Standard 0.10, max 0.30). */
  baselinePct: 10,
  /** Anteil der mittleren Zonenstabilität in Prozentpunkten. */
  stabilityPct: 60,
  /** Anteil der mittleren Gebäudebereitschaft. */
  readinessPct: 20,
  /** Anteil der Diplomatie. */
  diplomacyPct: 20,
  /** Summierte Botschaftseffektivität, ab der der Diplomatie-Anteil voll zählt. */
  diplomacyFullAt: 3,
  /**
   * Obergrenze ohne eine einzige aktive Botschaft: 10 + 80×0,6 + 85×0,2 = 78.
   * Rechnet die erreichbare Zonenstabilität (80) und Bereitschaft (85) ein,
   * nicht die theoretischen 100.
   */
  ceilingWithoutEmbassyPct: 78,
  /** Stufengrenzen in Prozent: darunter gilt die jeweilige Stufe. */
  tiers: { critical: 30, struggling: 50, functional: 70, thriving: 90 },
} as const;

/** Zonenstabilität — Quelle: `mv_zone_stability.stability`. */
export const ZONE_STABILITY_FORMULA = {
  /** Anteil der kritikalitätsgewichteten Gebäudebereitschaft der Zone. */
  infrastructurePct: 50,
  /** Anteil des Sicherheitsgrades (Taxonomiegewicht 0,30 bis 1,00). */
  securityPct: 30,
  /** Abzug je Punkt Gesamtdruck. */
  pressurePct: 25,
  /**
   * Erreichbare Obergrenze: 50 + 30 = 80. Die Stufe „vorbildlich" beginnt bei
   * 90 und ist damit unerreichbar — auf Prod hat sie keine einzige Zone.
   */
  ceilingPct: 80,
  tiers: { critical: 30, unstable: 50, functional: 70, stable: 90 },
} as const;

/** Agenteneinfluss — Quelle: `fn_compute_agent_influence`. */
export const INFLUENCE_FORMULA = {
  /** Mittlere Intensität der fünf stärksten Beziehungen (0–10), skaliert. */
  relationsPct: 40,
  /** Mittlere Qualifikation der Professionen (1–5 von 10), skaliert. */
  professionsPct: 30,
  /** Amt als Botschafter einer aktiven Botschaft: ganz oder gar nicht. */
  ambassadorPct: 30,
  /**
   * Obergrenze ohne Botschafteramt: 40 + 15 = 55. Der Professionsanteil kann
   * 15 nicht überschreiten, weil die Qualifikation bei 5 endet, die Formel aber
   * durch 10 teilt. Die Stufe STARK beginnt über 55 — sie ist damit
   * ausschließlich für Botschafter erreichbar.
   */
  ceilingWithoutAmbassadorPct: 55,
  tiers: { weak: 25, average: 55 },
} as const;

/** Gebäudebereitschaft — Quelle: `mv_building_readiness`. */
export const READINESS_FORMULA = {
  /** Höchster auf Prod gemessener Wert. Die vier Faktoren multiplizieren sich. */
  observedCeilingPct: 85,
  /** Kritikalitätsgewicht eines Gebäudes in der Infrastruktur seiner Zone. */
  criticalityMin: 0.5,
  criticalityMax: 2,
} as const;

/**
 * Ereignishäufigkeit aus Zonenstabilität — Quelle:
 * `AutonomousEventService._stability_event_multiplier`.
 */
export const EVENT_MULTIPLIER = {
  /** Bei Stabilität 0 bis 0,1. */
  max: 1.5,
  /** Bei Stabilität 0,5. */
  baselineAt: 50,
  /** Rechnerischer Boden bei Stabilität 0,9 — durch die 80er-Decke unerreichbar. */
  min: 0.5,
  /** Tatsächlich erreichbarer Boden bei der Höchststabilität von 80 %. */
  reachableMin: 0.65,
} as const;

/** Botschaftseffektivität — Quelle: `mv_embassy_effectiveness.effectiveness`. */
export const EMBASSY_EFFECTIVENESS_FORMULA = {
  /** Mittlere Bereitschaft der beiden Botschaftsgebäude. */
  buildingHealthPct: 40,
  /** Qualität der beiden Botschafter. */
  ambassadorPct: 40,
  /**
   * Ausrichtung des Blutungsvektors. **Ganz oder gar nicht** — der Vektor der
   * Botschaft ist entweder unter den Vektoren der Verbindung oder nicht.
   */
  vectorPct: 20,
} as const;

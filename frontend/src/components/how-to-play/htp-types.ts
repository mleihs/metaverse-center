/**
 * How-to-Play type definitions for tutorial content and match replays.
 */

export interface OperativeCard {
  type: string;
  rpCost: number;
  deployCycles: number;
  missionCycles: number;
  scoreValue: number;
  description: string;
  effect: string;
  color: string;
}

export interface MatchAction {
  simulation: string;
  action: string;
  rpCost: number;
  target?: string;
  outcome?: string;
  note?: string;
}

export interface CycleData {
  cycle: number;
  phase: string;
  rpAllocated?: number;
  actions: MatchAction[];
  scoreSnapshot?: Record<string, number>;
}

export interface MatchConfig {
  title: string;
  subtitle: string;
  players: string[];
  duration: string;
  cycles: number;
  preset: string;
  description: string;
  specialRules?: string;
  cycleData: CycleData[];
  finalStandings: FinalStanding[];
  keyMoments: string[];
}

export interface FinalStanding {
  rank: number;
  simulation: string;
  composite: number;
  stability: number;
  influence: number;
  sovereignty: number;
  diplomatic: number;
  military: number;
  title?: string;
}

export interface TacticCard {
  title: string;
  category: 'opener' | 'timing' | 'economy' | 'counter' | 'preset';
  description: string;
}

export interface TocSection {
  id: string;
  label: string;
}

export interface BleedVector {
  name: string;
  color: string;
  tags: string[];
  description: string;
}

export interface ScoreDimension {
  key: string;
  name: string;
  color: string;
  formula: string;
  explanation: string;
  title: string;
}

export interface EmbassyInfoCard {
  label: string;
  value: string;
}

export interface NormalizationRule {
  attribute: string;
  normalizedTo: string;
}

export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  highlights: string[];
  details: { category: string; changes: string[] }[];
}

/* ── Balance Analytics types ─────────────────────────── */

export interface EloRating {
  simulation: string;
  rating: number;
  delta: number;
  color: string;
}

export interface StrategyTier {
  tier: string;
  tierColor: string;
  strategies: { name: string; winRate: number; appearances: number; description: string }[];
}

export interface SimulationProfile {
  tag: string;
  name: string;
  color: string;
  eloRating: number;
  winRates: { pc2?: number; pc3: number; pc4: number; pc5: number };
  ciLow: number;
  ciHigh: number;
  strengths: string;
  weakness: string;
}

export interface DimensionVariance {
  name: string;
  color: string;
  stdDev: number;
  maxStd: number;
  status: string;
  contribution: number;
}

export interface HeadToHead {
  rowSim: string;
  colSim: string;
  winRate: number;
  games: number;
}

export interface BalanceInsight {
  label: string;
  value: string;
  description: string;
}

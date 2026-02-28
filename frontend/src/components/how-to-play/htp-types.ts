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

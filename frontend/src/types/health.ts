/* === Bleed & Threshold Types === */

import type { UUID } from './index.js';

export type ThresholdState = 'normal' | 'critical' | 'ascendant';

export interface ActiveBleed {
  source_simulation_id: UUID;
  source_simulation_name: string;
  echo_vector: string;
  echo_strength: number;
  affected_zone_ids: UUID[];
  foreign_theme: { primary: string; font_heading: string };
  lore_fragment: string;
}

export interface BleedStatus {
  active_bleeds: ActiveBleed[];
  bleed_permeability: number;
  fracture_warning: boolean;
  threshold_state: ThresholdState;
  overall_health?: number;
  entropy_cycles_remaining?: number | null;
  effects_suppressed?: boolean;
}

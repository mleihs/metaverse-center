/**
 * Centralized operative type → SVG icon mapping.
 *
 * Eliminates the 4× duplicated emoji maps across epoch components.
 * All icons are styleable via CSS `color` (inherits via `currentColor`).
 */

import type { TemplateResult } from 'lit';
import type { BattleLogEventType, OperativeType } from '../types/index.js';
import { icons } from './icons.js';

type IconFn = (size?: number) => TemplateResult;

const OPERATIVE_ICON_MAP: Record<OperativeType, IconFn> = {
  spy: icons.operativeSpy,
  saboteur: icons.operativeSaboteur,
  propagandist: icons.megaphone,
  assassin: icons.operativeAssassin,
  infiltrator: icons.operativeInfiltrator,
  guardian: icons.operativeGuardian,
};

const BATTLE_EVENT_ICON_MAP: Record<string, IconFn> = {
  operative_deployed: icons.target,
  mission_success: icons.checkCircle,
  mission_failed: icons.xCircle,
  detected: icons.alertTriangle,
  sabotage: icons.explosion,
  propaganda: icons.megaphone,
  assassination: icons.operativeAssassin,
  agent_wounded: icons.droplet,
  alliance_formed: icons.handshake,
  alliance_proposal: icons.handshake,
  alliance_proposal_accepted: icons.checkCircle,
  alliance_proposal_rejected: icons.xCircle,
  alliance_tension_increase: icons.alertTriangle,
  alliance_dissolved_tension: icons.skull,
  alliance_upkeep: icons.gear,
  betrayal: icons.skull,
  phase_change: icons.bolt,
  counter_intel: icons.radar,
  intel_report: icons.clipboard,
  zone_fortified: icons.operativeGuardian,
  player_passed: icons.timer,
  cycle_resolved: icons.bolt,
  cycle_auto_resolved: icons.timer,
  player_afk: icons.timer,
  player_afk_penalty: icons.alertTriangle,
  player_afk_ai_takeover: icons.brain,
};

/** Get SVG icon for an operative type. */
export function getOperativeIcon(type: OperativeType | string, size = 16): TemplateResult {
  const fn = OPERATIVE_ICON_MAP[type as OperativeType];
  return fn ? fn(size) : icons.crossedSwords(size);
}

/** Get SVG icon for a battle log event type. */
export function getBattleEventIcon(type: BattleLogEventType | string, size = 16): TemplateResult {
  const fn = BATTLE_EVENT_ICON_MAP[type];
  return fn ? fn(size) : icons.crossedSwords(size);
}

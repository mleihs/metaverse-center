/**
 * Dungeon Map — room type icon + color mappings.
 *
 * Single source of truth for both SVG node rendering and
 * the HTML room detail panel. Prevents duplication.
 *
 * Pattern: Pure data (like ROOM_SYMBOLS in dungeon-formatters.ts).
 */

import type { SVGTemplateResult } from 'lit';

import { icons } from '../../utils/icons.js';

/** Room type → color CSS variable (all reference design tokens). */
export const ROOM_COLOR: Record<string, string> = {
  combat: 'var(--_phosphor-dim)',
  elite: 'var(--color-warning)',
  encounter: 'var(--color-info)',
  treasure: 'var(--color-ascendant-gold)',
  rest: 'var(--color-success)',
  boss: 'var(--color-danger)',
  entrance: 'var(--_phosphor)',
  exit: 'var(--_phosphor)',
};

/**
 * Room type → icon render function for map nodes.
 *
 * Filled game-icons.net icons (mapCombat, mapTreasure, mapBoss, mapEntrance, mapExit)
 * and existing stroke icons where they read well at 20px (skullBolt, questionCircle,
 * campfire).
 */
export const ROOM_ICON: Record<string, (size: number) => SVGTemplateResult> = {
  combat: icons.mapCombat,
  elite: icons.skullBolt,
  encounter: icons.questionCircle,
  treasure: icons.mapTreasure,
  rest: icons.campfire,
  boss: icons.mapBoss,
  entrance: icons.mapEntrance,
  exit: icons.mapExit,
};

/** Fallback icon for unrevealed / unknown room types. */
export const ROOM_ICON_UNKNOWN = icons.mapUnknown;

/**
 * Resolve the room color for a given room state.
 * Handles revealed, adjacent-unrevealed (depth-risk tint), and fog states.
 */
export function resolveRoomColor(
  roomType: string,
  revealed: boolean,
  adjacent: boolean,
  depth: number,
): string {
  if (revealed) {
    return ROOM_COLOR[roomType] ?? 'var(--_phosphor-dim)';
  }
  if (adjacent) {
    // Depth-based risk gradient for reachable unrevealed rooms
    return depth >= 4
      ? 'var(--color-danger)'
      : depth >= 3
        ? 'var(--color-warning)'
        : 'var(--_phosphor-dim)';
  }
  return 'var(--_phosphor-dim)';
}

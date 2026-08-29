/**
 * Dungeon Map — room type icon + color mappings.
 *
 * Single source of truth for both SVG node rendering and
 * the HTML room detail panel. Prevents duplication.
 *
 * Pattern: Pure data (like ROOM_SYMBOLS in dungeon-formatters.ts).
 */

import { msg } from '@lit/localize';
import type { SVGTemplateResult } from 'lit';

import type { RoomNodeClient } from '../../types/dungeon.js';
import { getRoomTypeLabel } from '../../utils/dungeon-formatters.js';
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
  threshold: 'var(--color-warning)',
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
  threshold: icons.mapThreshold,
};

/** Fallback icon for unrevealed / unknown room types. */
export const ROOM_ICON_UNKNOWN = icons.mapUnknown;

/**
 * Display label for a room node, honouring BOTH stages of the fog.
 *
 * The server fogs in two independent steps (`build_client_state` in
 * `dungeon_checkpoint_service.py`): `revealed` says the room is visible on the
 * map at all, and a separate `scouted` flag decides whether the real type is
 * sent or the placeholder `"?"`. So a room can be perfectly visible, reachable
 * and clickable while its type is still unknown.
 *
 * `getRoomTypeLabel` only knows the first stage. Handed `"?"` with no fallback
 * index it returns the bare `"?"`, which is what reached the map's aria label
 * as "? room 4" and the detail panel's heading as "? #4". Both call sites live
 * in this module's two consumers, so the answer belongs here, next to the icon
 * table that already resolves the same placeholder to ROOM_ICON_UNKNOWN.
 *
 * Returns the TYPE word alone ("Combat", "Unscouted"), not a noun phrase: the
 * three call sites each supply their own frame — "… room 4" for the map's aria
 * label, "… #4" for the panel heading, the bare word for the SVG tooltip.
 */
export function roomNodeLabel(room: RoomNodeClient): string {
  if (!room.revealed) return msg('Unknown');
  if (room.room_type === '?') return msg('Unscouted');
  return getRoomTypeLabel(room.room_type);
}

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

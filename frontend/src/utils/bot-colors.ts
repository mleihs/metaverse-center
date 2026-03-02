/**
 * Shared bot personality accent colors.
 *
 * Centralizes the personality → hex color mapping used across epoch
 * components (BotConfigPanel, EpochLeaderboard, EpochBattleLog).
 */

import type { BotPersonality } from '../types/index.js';

export const PERSONALITY_COLORS: Record<BotPersonality, string> = {
  sentinel: '#4ade80',
  warlord: '#ef4444',
  diplomat: '#a78bfa',
  strategist: '#38bdf8',
  chaos: '#fbbf24',
};

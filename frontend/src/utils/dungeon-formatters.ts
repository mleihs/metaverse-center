/**
 * Resonance Dungeons — Pure formatter functions.
 * Convert dungeon state and API responses into TerminalLine[] output.
 * No API calls, no state manager imports — only data transformation.
 *
 * Pattern: terminal-formatters.ts (pure functions, explicit params, TerminalLine[]).
 */

import { msg } from '@lit/localize';

import type {
  AgentCombatStateClient,
  CombatRoundResult,
  CombatStateClient,
  DungeonClientState,
  EncounterChoiceClient,
  LootItem,
  RoomNodeClient,
  SkillCheckDetail,
} from '../types/dungeon.js';
import type { Agent, AptitudeSet } from '../types/index.js';
import type { TerminalLine } from '../types/terminal.js';
import { OPERATIVE_LABEL } from './operative-constants.js';
import {
  combatDamageLine,
  combatHealLine,
  combatMissLine,
  combatPlayerLine,
  combatSystemLine,
  hintLine,
  responseLine,
  systemLine,
} from './terminal-formatters.js';

// ── Room Type Symbols (ASCII map) ────────────────────────────────────────────

const ROOM_SYMBOLS: Record<string, string> = {
  entrance: 'E',
  combat: 'C',
  elite: '!',
  encounter: '?',
  rest: 'R',
  treasure: 'T',
  boss: 'B',
  exit: '\u21E4', // ⇤
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Get maximum depth in the room graph. Returns 0 for empty rooms. */
function getMaxDepth(rooms: RoomNodeClient[]): number {
  if (rooms.length === 0) return 0;
  return Math.max(...rooms.map(r => r.depth));
}

// ── Condition Display ────────────────────────────────────────────────────────

const CONDITION_LABELS: Record<string, string> = {
  operational: 'OPERATIONAL',
  stressed: 'STRESSED',
  wounded: 'WOUNDED',
  afflicted: 'AFFLICTED',
  captured: 'CAPTURED',
};

/** i18n-aware condition label for UI components (not terminal ASCII). */
export function getConditionLabel(condition: string): string {
  const labels: Record<string, () => string> = {
    operational: () => msg('Operational'),
    stressed: () => msg('Stressed'),
    wounded: () => msg('Wounded'),
    afflicted: () => msg('Afflicted'),
    captured: () => msg('Captured'),
  };
  return labels[condition]?.() ?? condition;
}

/** i18n-aware room type label for UI components. */
export function getRoomTypeLabel(type: string, fallbackIndex?: number): string {
  const labels: Record<string, () => string> = {
    combat: () => msg('Combat'),
    elite: () => msg('Elite'),
    encounter: () => msg('Encounter'),
    treasure: () => msg('Treasure'),
    rest: () => msg('Rest'),
    boss: () => msg('Boss'),
    entrance: () => msg('Entrance'),
    exit: () => msg('Exit'),
  };
  return labels[type]?.() ?? (fallbackIndex !== undefined ? `${msg('Room')} ${fallbackIndex}` : type);
}

// ── Bar Renderers ────────────────────────────────────────────────────────────

function progressBar(current: number, max: number, width = 10): string {
  const filled = Math.round((current / Math.max(max, 1)) * width);
  return '\u2588'.repeat(Math.max(0, filled)) + '\u2591'.repeat(Math.max(0, width - filled));
}

function stressBar(stress: number, width = 10): string {
  const max = 1000;
  const filled = Math.round((Math.min(stress, max) / max) * width);
  return '\u2588'.repeat(Math.max(0, filled)) + '\u2591'.repeat(Math.max(0, width - filled));
}

// ── Dungeon Entry ────────────────────────────────────────────────────────────

export function formatDungeonEntry(
  state: DungeonClientState,
  atmosphereText: string,
): TerminalLine[] {
  const lines: TerminalLine[] = [];

  lines.push(systemLine('\u2550'.repeat(50)));
  lines.push(systemLine(`  RESONANCE DUNGEON \u2014 ${state.archetype.toUpperCase()}`));
  const depthDisplay = getMaxDepth(state.rooms) || '?';
  lines.push(systemLine(`  ${msg('Difficulty')}: ${'*'.repeat(state.difficulty)}${'·'.repeat(5 - state.difficulty)}  ${msg('Depth')}: ${depthDisplay}`));
  lines.push(systemLine('\u2550'.repeat(50)));
  lines.push(responseLine(''));

  if (atmosphereText) {
    lines.push(responseLine(atmosphereText));
    lines.push(responseLine(''));
  }

  // Party summary
  lines.push(systemLine(msg('PARTY:')));
  for (const agent of state.party) {
    const primaryApt = Object.entries(agent.aptitudes)
      .sort(([, a], [, b]) => b - a)[0];
    const aptStr = primaryApt ? `${primaryApt[0].charAt(0).toUpperCase() + primaryApt[0].slice(1)} ${primaryApt[1]}` : '';
    lines.push(responseLine(`  ${agent.agent_name} \u2014 ${aptStr} \u2014 ${CONDITION_LABELS[agent.condition] ?? agent.condition}`));
  }

  lines.push(responseLine(''));
  lines.push(hintLine(msg('Type "map" to see the dungeon layout, "move <room>" to move.')));

  return lines;
}

// ── Dungeon Map (ASCII FTL-style) ────────────────────────────────────────────

export function formatDungeonMap(state: DungeonClientState): TerminalLine[] {
  const lines: TerminalLine[] = [];
  const mxDepth = getMaxDepth(state.rooms);

  lines.push(systemLine(`DUNGEON MAP \u2014 ${state.archetype.toUpperCase()}, ${msg('Depth')} ${state.depth}/${mxDepth}`));
  lines.push(systemLine(''));

  // Group rooms by depth
  const byDepth = new Map<number, RoomNodeClient[]>();
  for (const room of state.rooms) {
    const list = byDepth.get(room.depth) ?? [];
    list.push(room);
    byDepth.set(room.depth, list);
  }

  // Render each depth layer
  for (const [depth, rooms] of [...byDepth.entries()].sort((a, b) => a[0] - b[0])) {
    const roomStrs = rooms.map(r => {
      let symbol: string;
      if (r.current) symbol = '*';
      else if (!r.revealed) symbol = '\u2591';
      else if (r.cleared) symbol = '\u25A0';
      else symbol = ROOM_SYMBOLS[r.room_type] ?? '?';
      return `[${symbol}]`;
    });

    // Pad depth label
    const depthLabel = `D${depth}`;
    lines.push(responseLine(`  ${depthLabel.padEnd(3)} ${roomStrs.join('\u2500\u2500\u2500')}`));

    // Draw vertical connections to next depth
    if (byDepth.has(depth + 1)) {
      const connStrs = rooms.map(r => {
        const hasDown = r.connections.some(c => {
          const target = state.rooms.find(t => t.index === c);
          return target && target.depth === depth + 1;
        });
        return hasDown ? ' \u2502 ' : '   ';
      });
      lines.push(responseLine(`      ${connStrs.join('   ')}`));
    }
  }

  lines.push(systemLine(''));
  lines.push(hintLine(msg('[E]ntrance [C]ombat [!]Elite [?]Unknown [R]est [T]reasure [B]oss')));
  lines.push(hintLine(msg('* Current  \u25A0 Cleared  \u2591 Unrevealed')));

  return lines;
}

// ── Room Entry ───────────────────────────────────────────────────────────────

export function formatRoomEntry(
  room: RoomNodeClient,
  banterText: string | null,
  archetypeState: Record<string, unknown>,
): TerminalLine[] {
  const lines: TerminalLine[] = [];

  // Banter first (agent personality reaction)
  if (banterText) {
    lines.push(responseLine(''));
    lines.push(responseLine(banterText));
  }

  // Room header
  lines.push(responseLine(''));
  lines.push(systemLine(`\u2550\u2550\u2550 ${msg('DEPTH')} ${room.depth} \u2014 ${msg('ROOM')} ${room.index} \u2550\u2550\u2550`));

  // Archetype-specific state (Shadow: visibility)
  if (archetypeState.visibility !== undefined) {
    const vis = archetypeState.visibility as number;
    const maxVis = (archetypeState.max_visibility ?? 3) as number;
    const bar = '\u2588'.repeat(vis) + '\u2591'.repeat(Math.max(0, maxVis - vis));
    lines.push(systemLine(`VISIBILITY: ${bar} [${vis}/${maxVis}]`));
  }

  // Room type header
  const roomType = room.room_type.toUpperCase();
  switch (room.room_type) {
    case 'combat':
      lines.push(systemLine(`[${msg('COMBAT ENCOUNTER')}]`));
      break;
    case 'elite':
      lines.push(systemLine(`[${msg('ELITE ENCOUNTER')}]`));
      break;
    case 'encounter':
      lines.push(systemLine(`[${msg('ENCOUNTER')}]`));
      break;
    case 'rest':
      lines.push(systemLine(`[${msg('REST SITE')}]`));
      lines.push(responseLine(msg('A fragile pocket of stillness in the darkness.')));
      lines.push(hintLine(msg('Use "rest" to recover stress. Risk of ambush.')));
      break;
    case 'treasure':
      lines.push(systemLine(`[${msg('TREASURE')}]`));
      lines.push(responseLine(msg('Something glints in the shadow.')));
      break;
    case 'boss':
      lines.push(systemLine(`[${msg('BOSS CHAMBER')}]`));
      lines.push(responseLine(msg('The darkness is thicker here. Absolute. Intentional.')));
      break;
    case 'exit':
      lines.push(systemLine(`[${msg('EXIT')}]`));
      lines.push(hintLine(msg('Use "retreat" to leave with partial loot.')));
      break;
    default:
      lines.push(systemLine(`[${roomType}]`));
  }

  return lines;
}

// ── Combat Start ─────────────────────────────────────────────────────────────

export function formatCombatStart(
  combat: CombatStateClient,
): TerminalLine[] {
  const lines: TerminalLine[] = [];

  lines.push(systemLine(''));
  lines.push(systemLine(`\u2550\u2550\u2550 ${msg('COMBAT')} \u2014 ${msg('Round')} ${combat.round_num}/${combat.max_rounds} \u2550\u2550\u2550`));
  lines.push(systemLine(''));

  // Enemies
  lines.push(systemLine(msg('ENEMIES:')));
  for (const enemy of combat.enemies) {
    if (!enemy.is_alive) continue;
    const condBar = _enemyConditionBar(enemy.condition_display);
    const threatBadge = `[${enemy.threat_level.toUpperCase()}]`;
    const intentStr = enemy.telegraphed_action
      ? `  ${msg('INTENT')}: \u25BA ${enemy.telegraphed_action.intent}`
      : '';
    lines.push(responseLine(`  ${enemy.name_en} ${condBar} ${threatBadge}${intentStr}`));
  }

  lines.push(systemLine(''));

  // Telegraphed actions summary
  if (combat.telegraphed_actions.length > 0) {
    lines.push(systemLine(msg('ENEMY INTENTIONS:')));
    for (const ta of combat.telegraphed_actions) {
      const threatColor = ta.threat_level === 'critical' ? '!!!' : ta.threat_level === 'high' ? '!!' : ta.threat_level === 'medium' ? '!' : '';
      lines.push(responseLine(`  ${threatColor} ${ta.enemy_name}: ${ta.intent}${ta.target ? ` \u2192 ${ta.target}` : ''}`));
    }
    lines.push(systemLine(''));
  }

  return lines;
}

// ── Combat Planning (ability list per agent) ─────────────────────────────────

export function formatCombatPlanning(
  party: AgentCombatStateClient[],
): TerminalLine[] {
  const lines: TerminalLine[] = [];

  lines.push(systemLine(msg('SELECT ACTIONS:')));
  lines.push(systemLine(''));

  for (const agent of party) {
    if (agent.condition === 'captured') continue;

    const aptEntries = Object.entries(agent.aptitudes).sort(([, a], [, b]) => b - a);
    const primaryApt = aptEntries[0] ? `${aptEntries[0][0]} ${aptEntries[0][1]}` : '';
    lines.push(systemLine(`${agent.agent_name.toUpperCase()} (${primaryApt}) \u2014 ${CONDITION_LABELS[agent.condition] ?? agent.condition}`));

    if (agent.available_abilities.length === 0) {
      lines.push(responseLine(msg('  (no actions available)')));
      continue;
    }

    for (const ability of agent.available_abilities) {
      const cdStr = ability.cooldown_remaining > 0 ? ` [CD: ${ability.cooldown_remaining}]` : '';
      const ultStr = ability.is_ultimate ? ' \u2605' : '';
      const checkStr = ability.check_info ? ` (${ability.check_info})` : '';
      const available = ability.cooldown_remaining === 0;
      const marker = ability.is_ultimate ? '\u2605' : available ? '\u25C9' : '\u25CB';
      lines.push(responseLine(`  ${marker} ${ability.name}${checkStr}${cdStr}${ultStr}`));
      lines.push(responseLine(`    ${ability.description}`));
    }
    lines.push(systemLine(''));
  }

  lines.push(hintLine(msg('Use the COMBAT BAR below or type "attack <agent> <ability> [target]" + "submit".')));

  return lines;
}

// ── Combat Resolution (semantic color-coded battle log) ─────────────────────

export function formatCombatResolution(
  result: CombatRoundResult,
  partyNames?: string[],
): TerminalLine[] {
  const lines: TerminalLine[] = [];
  const party = new Set(partyNames ?? []);

  lines.push(combatSystemLine(`\u2550\u2550\u2550 ${msg('RESOLUTION')} \u2014 ${msg('Round')} ${result.round} \u2550\u2550\u2550`));

  // Separate party actions from enemy actions
  const partyEvents = result.events.filter((e) => party.size === 0 || party.has(e.actor) || e.actor === 'Trap');
  const enemyEvents = result.events.filter((e) => party.size > 0 && !party.has(e.actor) && e.actor !== 'Trap');

  // Party actions
  if (partyEvents.length > 0) {
    lines.push(combatSystemLine(''));
    lines.push(combatSystemLine(msg('PARTY ACTIONS:')));
    for (const event of partyEvents) {
      lines.push(_formatCombatEvent(event, false));
    }
  }

  // Enemy actions
  if (enemyEvents.length > 0) {
    lines.push(combatSystemLine(''));
    lines.push(combatSystemLine(msg('ENEMY ACTIONS:')));
    for (const event of enemyEvents) {
      lines.push(_formatCombatEvent(event, true));
    }
  }

  // Victory / Wipe / Stalemate
  if (result.victory) {
    lines.push(combatHealLine(''));
    lines.push(combatHealLine('\u2550'.repeat(50)));
    lines.push(combatHealLine(`\u2550\u2550\u2550       ${msg('V I C T O R Y')}       \u2550\u2550\u2550`));
    lines.push(combatHealLine('\u2550'.repeat(50)));
  }
  if (result.wipe) {
    lines.push(combatSystemLine(''));
    lines.push(combatSystemLine(`\u2550\u2550\u2550 ${msg('PARTY WIPE')} \u2550\u2550\u2550`));
  }
  if (result.stalemate) {
    lines.push(combatSystemLine(''));
    lines.push(combatSystemLine(`\u2550\u2550\u2550 ${msg('STALEMATE')} \u2550\u2550\u2550`));
  }

  return lines;
}

/** Format a single combat event with semantic color based on context. */
function _formatCombatEvent(event: CombatEvent, isEnemyAction: boolean): TerminalLine {
  const tag = _eventTag(event);
  const summary = `  [${tag}] ${event.actor} \u2192 ${event.action} \u2192 ${event.target}`;

  // Details suffix
  const details: string[] = [];
  if (event.damage > 0) {
    details.push(`${event.damage} ${event.damage === 1 ? 'step' : 'steps'}`);
  }
  if (event.stress !== 0) {
    details.push(`${event.stress > 0 ? '+' : ''}${event.stress} stress`);
  }
  const detailStr = details.length > 0 ? `. ${details.join(', ')}.` : '.';
  const text = `${summary}${detailStr}`;

  // Miss → always dim regardless of actor
  if (!event.hit) return combatMissLine(text);

  // Enemy action → damage (red) for ANY hostile action (condition OR stress)
  if (isEnemyAction && (event.damage > 0 || event.stress > 0)) return combatDamageLine(text);

  // Heal/stress recovery → green
  if (event.stress < 0) return combatHealLine(text);

  // Party action with damage → bright amber hit
  if (!isEnemyAction) return combatPlayerLine(text);

  // Enemy non-damage (defend, etc.) → dim
  return combatMissLine(text);
}

/** Determine display tag for a combat event. */
function _eventTag(event: CombatEvent): string {
  if (!event.hit) return 'MISS';
  if (event.action === 'defend') return 'DEF';
  if (event.action === 'detonate') return 'TRAP';
  if (event.stress < 0) return 'HEAL';
  if (event.damage > 0) return 'HIT';
  return 'ACT';
}

// Re-import type for local use
type CombatEvent = CombatRoundResult['events'][number];

// ── Resolve Check (Darkest Dungeon moment) ───────────────────────────────────

export function formatResolveCheck(
  agentName: string,
  isVirtue: boolean,
  resultName: string,
  effects: string[],
): TerminalLine[] {
  const lines: TerminalLine[] = [];

  lines.push(systemLine(''));
  lines.push(systemLine(`${agentName} ${msg("reaches critical stress")}`));
  lines.push(systemLine(''));
  lines.push(systemLine(`[SYSTEM] \u2550\u2550\u2550 ${msg('RESOLVE CHECK')} \u2550\u2550\u2550`));
  lines.push(systemLine('[SYSTEM]'));
  lines.push(systemLine(`[SYSTEM] ${msg('Resolving')}...`));

  // 3-second dramatic pause is handled by the command handler
  // via delayed line rendering (staggered timestamps)

  if (isVirtue) {
    lines.push(systemLine(''));
    lines.push(systemLine('\u2588'.repeat(40)));
    lines.push(systemLine(`\u2588\u2588     V I R T U E :  ${resultName.toUpperCase()}     \u2588\u2588`));
    lines.push(systemLine('\u2588'.repeat(40)));
  } else {
    lines.push(systemLine(''));
    lines.push(systemLine('\u2591'.repeat(40)));
    lines.push(systemLine(`\u2591\u2591  A F F L I C T I O N :  ${resultName.toUpperCase()}  \u2591\u2591`));
    lines.push(systemLine('\u2591'.repeat(40)));
  }

  lines.push(systemLine(''));
  for (const effect of effects) {
    lines.push(responseLine(`  \u2192 ${effect}`));
  }

  return lines;
}

// ── Encounter Choices ────────────────────────────────────────────────────────

export function formatEncounterChoices(
  descriptionEn: string,
  choices: EncounterChoiceClient[],
  party: AgentCombatStateClient[],
): TerminalLine[] {
  const lines: TerminalLine[] = [];

  // Narrative text
  for (const para of descriptionEn.split('\n')) {
    lines.push(responseLine(para));
  }
  lines.push(responseLine(''));

  // Choices
  for (let i = 0; i < choices.length; i++) {
    const choice = choices[i];
    lines.push(systemLine(`[${i + 1}] ${choice.label_en}`));

    // Aptitude requirements
    if (choice.requires_aptitude) {
      for (const [apt, level] of Object.entries(choice.requires_aptitude)) {
        lines.push(responseLine(`    ${msg('Requires')}: ${apt.charAt(0).toUpperCase() + apt.slice(1)} ${level}`));
      }
    }

    // Check info — which agent can do it best?
    if (choice.check_aptitude) {
      const bestAgent = _findBestAgent(party, choice.check_aptitude);
      if (bestAgent) {
        const aptLevel = bestAgent.aptitudes[choice.check_aptitude] ?? 0;
        lines.push(responseLine(`    ${bestAgent.agent_name} ${msg('volunteers')} (${choice.check_aptitude} ${aptLevel})`));
      }
    }

    if (i < choices.length - 1) {
      lines.push(responseLine(''));
    }
  }

  lines.push(responseLine(''));
  lines.push(hintLine(msg('Type "interact <number>" to choose.')));

  return lines;
}

// ── Skill Check Result ───────────────────────────────────────────────────────

export function formatSkillCheckResult(
  check: SkillCheckDetail,
  narrativeEn: string,
  effects: string[],
): TerminalLine[] {
  const lines: TerminalLine[] = [];

  // Probability breakdown
  const breakdownParts = Object.entries(check.breakdown)
    .map(([key, val]) => `${key}: ${val > 0 ? '+' : ''}${val}%`)
    .join(', ');
  lines.push(systemLine(`[${check.aptitude.toUpperCase()} CHECK \u2014 ${msg('Level')} ${check.level}: ${check.chance}%]`));
  if (breakdownParts) {
    lines.push(systemLine(`  ${breakdownParts}`));
  }
  lines.push(systemLine(''));

  // Rolling bar
  const rollBar = progressBar(check.chance, 100);
  lines.push(systemLine(`${msg('Rolling')}... ${rollBar} ${check.chance}%`));
  lines.push(systemLine(''));

  // Result
  const resultLabel = check.result === 'success'
    ? msg('SUCCESS')
    : check.result === 'partial'
      ? msg('PARTIAL SUCCESS')
      : msg('FAILURE');
  lines.push(systemLine(`${msg('Result')}: ${check.roll} \u2014 ${resultLabel}`));
  lines.push(responseLine(''));

  // Narrative
  if (narrativeEn) {
    for (const para of narrativeEn.split('\n')) {
      lines.push(responseLine(para));
    }
  }

  // Effects
  for (const effect of effects) {
    lines.push(responseLine(`  \u2192 ${effect}`));
  }

  return lines;
}

// ── Loot ─────────────────────────────────────────────────────────────────────

export function formatLootDrop(items: LootItem[]): TerminalLine[] {
  const lines: TerminalLine[] = [];

  lines.push(combatSystemLine(`\u2550\u2550\u2550 ${msg('LOOT FOUND')} \u2550\u2550\u2550`));
  lines.push(systemLine(''));

  const tierMarkers: Record<number, string> = { 1: '\u25C6', 2: '\u2605', 3: '\u2726' };

  for (const item of items) {
    const marker = tierMarkers[item.tier] ?? '\u25C6';
    lines.push(combatHealLine(`  ${marker} ${item.name_en} (${msg('Tier')} ${item.tier})`));
    lines.push(combatHealLine(`    ${item.description_en}`));
  }

  return lines;
}

// ── Scout Result ─────────────────────────────────────────────────────────────

export function formatScoutResult(
  agentName: string,
  revealedRooms: number,
  visibility: number | undefined,
): TerminalLine[] {
  const lines: TerminalLine[] = [];

  lines.push(responseLine(`${agentName} ${msg('scans the surrounding darkness')}...`));

  if (revealedRooms > 0) {
    lines.push(systemLine(`[${msg('OBSERVE SUCCESS')}]`));
    lines.push(responseLine(`  \u2192 ${revealedRooms} ${revealedRooms === 1 ? msg('room revealed') : msg('rooms revealed')}`));
  } else {
    lines.push(systemLine(`[${msg('OBSERVE')}]`));
    lines.push(responseLine(`  \u2192 ${msg('No new rooms to reveal')}`));
  }

  if (visibility !== undefined) {
    lines.push(responseLine(`  \u2192 ${msg('Visibility')}: ${visibility}`));
  }

  lines.push(hintLine(msg('Type "map" to see updated layout.')));

  return lines;
}

// ── Rest Result ──────────────────────────────────────────────────────────────

export function formatRestResult(
  healed: boolean,
  ambushed: boolean,
): TerminalLine[] {
  const lines: TerminalLine[] = [];

  if (ambushed) {
    lines.push(systemLine(`[${msg('AMBUSH')}!]`));
    lines.push(responseLine(msg('The shadows were waiting. Rest interrupted.')));
  } else if (healed) {
    lines.push(systemLine(`[${msg('REST COMPLETE')}]`));
    lines.push(responseLine(msg('A moment of calm. Stress reduced.')));
  } else {
    lines.push(systemLine(`[${msg('REST')}]`));
    lines.push(responseLine(msg('The party rests, but tension lingers.')));
  }

  return lines;
}

// ── Retreat Result ───────────────────────────────────────────────────────────

export function formatRetreatResult(loot: LootItem[]): TerminalLine[] {
  const lines: TerminalLine[] = [];

  lines.push(systemLine(`\u2550\u2550\u2550 ${msg('RETREAT')} \u2550\u2550\u2550`));
  lines.push(responseLine(msg('The party withdraws from the dungeon.')));

  if (loot.length > 0) {
    lines.push(responseLine(''));
    lines.push(systemLine(msg('PARTIAL LOOT:')));
    const tierMarkers: Record<number, string> = { 1: '\u25C6', 2: '\u2605', 3: '\u2726' };
    for (const item of loot) {
      const marker = tierMarkers[item.tier] ?? '\u25C6';
      lines.push(responseLine(`  ${marker} ${item.name_en}`));
    }
  }

  return lines;
}

// ── Dungeon Complete ─────────────────────────────────────────────────────────

/** Pick the right line factory based on agent condition — visual severity. */
function conditionLine(condition: string, content: string): TerminalLine {
  switch (condition) {
    case 'operational': return combatHealLine(content);
    case 'stressed':    return combatPlayerLine(content);
    case 'wounded':
    case 'afflicted':   return combatDamageLine(content);
    case 'captured':    return combatMissLine(content);
    default:            return responseLine(content);
  }
}

export function formatDungeonComplete(
  state: DungeonClientState,
  loot: LootItem[],
): TerminalLine[] {
  const lines: TerminalLine[] = [];
  const maxDepth = getMaxDepth(state.rooms);
  const totalRooms = state.rooms.length;
  const clearedRooms = state.rooms.filter(r => r.cleared).length;
  const W = 50; // box width

  // ── Banner ──
  lines.push(combatSystemLine('\u2550'.repeat(W)));
  lines.push(combatSystemLine('\u2551' + ' '.repeat(W - 2) + '\u2551'));
  lines.push(combatSystemLine(
    '\u2551' + `D U N G E O N   C O M P L E T E`.padStart(Math.floor((W - 2 + 33) / 2)).padEnd(W - 2) + '\u2551',
  ));
  lines.push(combatSystemLine('\u2551' + ' '.repeat(W - 2) + '\u2551'));
  lines.push(combatSystemLine(
    '\u2551' + `${state.archetype.toUpperCase()} \u2014 ${msg('DIFFICULTY')} ${state.difficulty}`.padStart(Math.floor((W - 2 + state.archetype.length + 16) / 2)).padEnd(W - 2) + '\u2551',
  ));
  lines.push(combatSystemLine('\u2551' + ' '.repeat(W - 2) + '\u2551'));
  lines.push(combatSystemLine('\u2550'.repeat(W)));
  lines.push(systemLine(''));

  // ── Expedition Summary ──
  lines.push(combatSystemLine(msg('EXPEDITION SUMMARY')));
  lines.push(responseLine(`  ${msg('Depth Reached').padEnd(18)} ${state.depth} / ${maxDepth}`));
  lines.push(responseLine(`  ${msg('Rooms Cleared').padEnd(18)} ${clearedRooms} / ${totalRooms}`));
  lines.push(systemLine(''));

  // ── Party Status ──
  lines.push(combatSystemLine(msg('PARTY STATUS')));
  const nameWidth = Math.max(...state.party.map(a => a.agent_name.length), 12);
  for (const agent of state.party) {
    const cond = CONDITION_LABELS[agent.condition] ?? agent.condition;
    const bar = stressBar(agent.stress, 10);
    const stressStr = String(agent.stress).padStart(4);
    const label = `  ${agent.agent_name.padEnd(nameWidth)}  ${cond.padEnd(12)} ${stressStr}/1000 ${bar}`;
    lines.push(conditionLine(agent.condition, label));
  }
  lines.push(systemLine(''));

  // ── Spoils ──
  if (loot.length > 0) {
    lines.push(combatSystemLine(msg('SPOILS CLAIMED')));
    const tierMarkers: Record<number, string> = { 1: '\u25C6', 2: '\u2605', 3: '\u2726' };
    for (const item of loot) {
      const marker = tierMarkers[item.tier] ?? '\u25C6';
      lines.push(combatHealLine(`  ${marker} ${item.name_en} \u2014 ${item.description_en}`));
    }
    lines.push(systemLine(''));
  }

  // ── Closing ──
  lines.push(combatMissLine(msg('The darkness recedes. Your agents emerge, changed.')));
  lines.push(combatSystemLine('\u2550'.repeat(W)));

  return lines;
}

// ── Party Wipe ───────────────────────────────────────────────────────────────

export function formatPartyWipe(): TerminalLine[] {
  return [
    systemLine(''),
    systemLine('\u2591'.repeat(50)),
    systemLine(`\u2591\u2591       ${msg('THE DARKNESS TAKES THEM')}       \u2591\u2591`),
    systemLine('\u2591'.repeat(50)),
    systemLine(''),
    responseLine(msg('All agents have fallen. The dungeon claims its due.')),
    systemLine(''),
  ];
}

// ── Combat Stalemate ────────────────────────────────────────────────────────

export function formatCombatStalemate(): TerminalLine[] {
  return [
    systemLine(''),
    systemLine('\u2550'.repeat(50)),
    systemLine(`\u2550\u2550       ${msg('STALEMATE')}       \u2550\u2550`),
    systemLine('\u2550'.repeat(50)),
    systemLine(''),
    responseLine(msg('Combat exceeded maximum rounds. The enemies retreat into the shadows.')),
    responseLine(msg('Room cleared -- no spoils claimed. Stress penalty applied.')),
    systemLine(''),
  ];
}

// ── Dungeon Status ───────────────────────────────────────────────────────────

export function formatDungeonStatus(state: DungeonClientState): TerminalLine[] {
  const lines: TerminalLine[] = [];
  const mxDepth = getMaxDepth(state.rooms);
  const clearedRooms = state.rooms.filter(r => r.cleared).length;

  lines.push(systemLine(`\u2550\u2550\u2550 ${state.archetype.toUpperCase()} \u2014 ${msg('STATUS')} \u2550\u2550\u2550`));
  lines.push(systemLine(''));
  lines.push(responseLine(`${msg('Phase')}: ${state.phase}`));
  lines.push(responseLine(`${msg('Depth')}: ${state.depth}/${mxDepth}`));
  lines.push(responseLine(`${msg('Rooms')}: ${clearedRooms}/${state.rooms.length}`));
  lines.push(responseLine(`${msg('Difficulty')}: ${'*'.repeat(state.difficulty)}`));

  // Archetype-specific
  if (state.archetype_state.visibility !== undefined) {
    const vis = state.archetype_state.visibility as number;
    const maxVis = (state.archetype_state.max_visibility ?? 3) as number;
    lines.push(responseLine(`${msg('Visibility')}: ${'\u2588'.repeat(vis)}${'\u2591'.repeat(Math.max(0, maxVis - vis))} [${vis}/${maxVis}]`));
  }

  lines.push(systemLine(''));
  lines.push(systemLine(msg('PARTY:')));
  for (const agent of state.party) {
    const stressStr = stressBar(agent.stress);
    const condLabel = CONDITION_LABELS[agent.condition] ?? agent.condition;
    lines.push(responseLine(`  ${agent.agent_name}: ${condLabel} | ${msg('Stress')}: ${stressStr} ${agent.stress}`));

    // Active buffs/debuffs
    if (agent.active_buffs.length > 0 || agent.active_debuffs.length > 0) {
      const buffs = agent.active_buffs.map(b => `+${b.name}`);
      const debuffs = agent.active_debuffs.map(d => `-${d.name}`);
      lines.push(responseLine(`    ${[...buffs, ...debuffs].join(', ')}`));
    }
  }

  return lines;
}

// ── Available Dungeons ───────────────────────────────────────────────────────

export function formatAvailableDungeons(
  dungeons: Array<{ archetype: string; signature: string; suggested_difficulty: number; available: boolean }>,
): TerminalLine[] {
  const lines: TerminalLine[] = [];

  if (dungeons.length === 0) {
    lines.push(systemLine(msg('No resonance dungeons available.')));
    lines.push(hintLine(msg('Dungeons appear when Substrate Resonance magnitude is high enough.')));
    return lines;
  }

  lines.push(systemLine(msg('AVAILABLE RESONANCE DUNGEONS:')));
  lines.push(systemLine(''));

  for (const d of dungeons) {
    const availStr = d.available ? '' : ` [${msg('COOLDOWN')}]`;
    lines.push(responseLine(`  ${d.archetype} (${d.signature}) \u2014 ${msg('Suggested')}: ${'*'.repeat(d.suggested_difficulty)}${availStr}`));
  }

  lines.push(responseLine(''));
  lines.push(hintLine(msg('Type "dungeon <archetype>" to enter. Example: dungeon shadow')));

  return lines;
}

// ── Party Picker ─────────────────────────────────────────────────────────────

/**
 * Format an agent picker list for terminal display.
 * Shows numbered agents with top aptitudes for party selection.
 */
export function formatAgentPicker(
  agents: Agent[],
  aptitudeMap: Map<string, AptitudeSet>,
  archetype: string,
): TerminalLine[] {
  const lines: TerminalLine[] = [];

  if (agents.length === 0) {
    lines.push(systemLine(msg('No agents available in this simulation.')));
    return lines;
  }

  lines.push(systemLine(`${msg('AVAILABLE AGENTS FOR')} ${archetype.toUpperCase()}:`));
  lines.push(systemLine(''));

  for (let i = 0; i < agents.length; i++) {
    const agent = agents[i];
    const apts = aptitudeMap.get(agent.id);

    // Build aptitude string: top 3 by level
    let aptStr = '';
    if (apts) {
      const sorted = Object.entries(apts)
        .filter(([, v]) => v > 0)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3);
      aptStr = sorted
        .map(([k, v]) => `${OPERATIVE_LABEL[k as import('../types/index.js').OperativeType] ?? k.toUpperCase()} ${v}`)
        .join(' | ');
    }
    if (!aptStr) aptStr = msg('no aptitudes');

    const num = String(i + 1).padStart(2, ' ');
    lines.push(responseLine(`  ${num}. ${agent.name.padEnd(20)} ${aptStr}`));
  }

  lines.push(systemLine(''));
  lines.push(hintLine(msg('Select 2\u20134 agents: "dungeon <archetype> 1 2 3"')));
  lines.push(hintLine(msg('Auto-pick best party: "dungeon <archetype> auto"')));

  return lines;
}

// ── Private Helpers ──────────────────────────────────────────────────────────

function _enemyConditionBar(display: string): string {
  switch (display) {
    case 'healthy': return progressBar(10, 10, 8);
    case 'damaged': return progressBar(6, 10, 8);
    case 'critical': return progressBar(3, 10, 8);
    case 'defeated': return progressBar(0, 10, 8);
    default: return progressBar(5, 10, 8);
  }
}

function _findBestAgent(
  party: AgentCombatStateClient[],
  aptitude: string,
): AgentCombatStateClient | null {
  let best: AgentCombatStateClient | null = null;
  let bestLevel = -1;
  for (const agent of party) {
    if (agent.condition === 'captured') continue;
    const level = agent.aptitudes[aptitude] ?? 0;
    if (level > bestLevel) {
      bestLevel = level;
      best = agent;
    }
  }
  return best;
}

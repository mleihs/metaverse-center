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
  AnchorText,
  ArchetypeState,
  AvailableDungeonResponse,
  CombatRoundResult,
  CombatStateClient,
  DungeonClientState,
  EncounterChoiceClient,
  EnemyCombatStateClient,
  LootItem,
  RoomNodeClient,
  SkillCheckDetail,
} from '../types/dungeon.js';
import {
  ARCHETYPE_AWAKENING,
  ARCHETYPE_DELUGE,
  ARCHETYPE_ENTROPY,
  ARCHETYPE_MOTHER,
  ARCHETYPE_OVERTHROW,
  ARCHETYPE_PROMETHEUS,
  ARCHETYPE_SHADOW,
  ARCHETYPE_TOWER,
  isAwakeningState,
  isDelugeState,
  isEntropyState,
  isMotherState,
  isOverthrowState,
  isPrometheusState,
  isShadowState,
  isTowerState,
} from '../types/dungeon.js';
import type { Agent, AptitudeSet } from '../types/index.js';
import type { TerminalLine } from '../types/terminal.js';
import { localized } from './locale-fields.js';
import { OPERATIVE_LABEL } from './operative-constants.js';
import {
  combatDamageLine,
  combatHealLine,
  combatMissLine,
  combatPlayerLine,
  combatSystemLine,
  errorLine,
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
  threshold: '\u2503', // ┃ (vertical bar — passage)
};

// ── Loot Tier Markers ───────────────────────────────────────────────────────

/** Unicode markers for loot tiers: ◆ minor, ★ major, ✦ legendary. */
export const LOOT_TIER_MARKERS: Record<number, string> = { 1: '\u25C6', 2: '\u2605', 3: '\u2726' };

// ── Archetype Ambient Texts (data-driven, no code-branching) ────────────────
// Each archetype defines its own scout, boss, rest, and treasure flavor text.
// IMPORTANT: msg() must be called at render time, not module scope (i18n gotcha).
// Using functions that return msg() ensures correct locale resolution.

interface AmbientTexts {
  scout: string;
  boss: string;
  rest: string;
  treasure: string;
}

type AmbientFactory = () => AmbientTexts;

const ARCHETYPE_AMBIENT_FACTORIES: Record<string, AmbientFactory> = {
  [ARCHETYPE_SHADOW]: () => ({
    scout: msg('probes the surrounding darkness'),
    boss: msg('The darkness is thicker here. Absolute. Intentional.'),
    rest: msg('A fragile pocket of stillness in the darkness.'),
    treasure: msg('Something glints in the shadow.'),
  }),
  [ARCHETYPE_TOWER]: () => ({
    scout: msg('surveys the structural layout'),
    boss: msg('The structure shudders. The load-bearing walls are screaming.'),
    rest: msg('A reinforced alcove. The ceiling holds, for now.'),
    treasure: msg('Assets, abandoned in the collapse.'),
  }),
  [ARCHETYPE_ENTROPY]: () => ({
    scout: msg('examines the dissolving patterns'),
    boss: msg('The dissolution accelerates. What remains is not enough.'),
    rest: msg('A pocket of coherence in the decay.'),
    treasure: msg('Something crystallized before it could dissolve.'),
  }),
  [ARCHETYPE_MOTHER]: () => ({
    scout: msg('searches through the suffocating warmth'),
    boss: msg('The embrace tightens. There is no leaving without a wound.'),
    rest: msg('A room that feels like childhood. Almost too safe.'),
    treasure: msg('A gift, left where you would find it. Deliberate.'),
  }),
  [ARCHETYPE_PROMETHEUS]: () => ({
    scout: msg('traces the pathways of stolen knowledge'),
    boss: msg('The light here burns. Knowledge has a cost.'),
    rest: msg('A cooling chamber. The forge rests, briefly.'),
    treasure: msg('An insight, crystallized into form.'),
  }),
  [ARCHETYPE_DELUGE]: () => ({
    scout: msg('reads the current ahead'),
    boss: msg('The water rises. The final chamber is submerged.'),
    rest: msg('An air pocket. The flood pauses, not retreats.'),
    treasure: msg('Salvage, caught in the debris field.'),
  }),
  [ARCHETYPE_AWAKENING]: () => ({
    scout: msg('extends awareness through the layers'),
    boss: msg('Every layer of consciousness converges. The dreamer stirs.'),
    rest: msg('A lucid interval. The boundaries hold, temporarily.'),
    treasure: msg('A fragment of clarity, solid enough to hold.'),
  }),
  [ARCHETYPE_OVERTHROW]: () => ({
    scout: msg('surveys the transparent corridors'),
    boss: msg('The mirrors intensify. Every reflection is a verdict.'),
    rest: msg('A room where the cameras have been covered.'),
    treasure: msg('Files left exposed. Someone wanted these found.'),
  }),
};

/** Get ambient text for an archetype, falling back to Shadow defaults.
 *  msg() is called at invocation time (not module scope) for correct i18n. */
function getAmbient(archetype: string): AmbientTexts {
  const factory = ARCHETYPE_AMBIENT_FACTORIES[archetype] ?? ARCHETYPE_AMBIENT_FACTORIES[ARCHETYPE_SHADOW];
  return factory();
}

// ── Archetype Display Names ─────────────────────────────────────────────────

/** Locale-aware archetype display name (EN key → localized label via msg()). */
export function getArchetypeDisplayName(archetype: string): string {
  switch (archetype) {
    case ARCHETYPE_SHADOW:
      return msg('The Shadow');
    case ARCHETYPE_TOWER:
      return msg('The Tower');
    case ARCHETYPE_ENTROPY:
      return msg('The Entropy');
    case ARCHETYPE_MOTHER:
      return msg('The Devouring Mother');
    case ARCHETYPE_PROMETHEUS:
      return msg('The Prometheus');
    case ARCHETYPE_DELUGE:
      return msg('The Deluge');
    case ARCHETYPE_AWAKENING:
      return msg('The Awakening');
    case ARCHETYPE_OVERTHROW:
      return msg('The Overthrow');
    default:
      return archetype;
  }
}

// ── Water Level Formatters (Deluge) ────────────────────────────────────────

/** Format water level into a stage label. */
export function formatWaterLevel(waterLevel: number): string {
  if (waterLevel >= 100) return msg('SUBMERGED');
  if (waterLevel >= 75) return msg('CRITICAL');
  if (waterLevel >= 50) return msg('RISING');
  if (waterLevel >= 25) return msg('SHALLOW');
  return msg('DRY');
}

/** Format tidal recession countdown. */
export function formatTidalStatus(roomsEntered: number, recessionInterval = 3): string {
  const roomsUntilRecession = recessionInterval - (roomsEntered % recessionInterval);
  if (roomsUntilRecession === recessionInterval && roomsEntered > 0) {
    return msg('Tide receding');
  }
  return `${roomsUntilRecession} ${msg('rooms until recession')}`;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Get maximum depth in the room graph. Returns 0 for empty rooms. */
function getMaxDepth(rooms: RoomNodeClient[]): number {
  if (rooms.length === 0) return 0;
  return Math.max(...rooms.map((r) => r.depth));
}

// ── Centralized Archetype Gauge ─────────────────────────────────────────────

/**
 * Extract label/value/max from any archetype state for gauge rendering.
 * Single source of truth for the 8 archetype-specific numeric gauges.
 * Used by: formatArchetypeGaugeBar, and potentially DungeonHeader.
 */
export function getArchetypeGaugeInfo(
  archetypeState: ArchetypeState,
): { label: string; value: number; max: number } | null {
  if (isShadowState(archetypeState)) {
    return { label: msg('VISIBILITY'), value: archetypeState.visibility, max: archetypeState.max_visibility };
  }
  if (isTowerState(archetypeState)) {
    return { label: msg('STRUCTURAL INTEGRITY'), value: archetypeState.stability, max: archetypeState.max_stability };
  }
  if (isEntropyState(archetypeState)) {
    return { label: msg('DECAY'), value: archetypeState.decay, max: archetypeState.max_decay };
  }
  if (isMotherState(archetypeState)) {
    return { label: msg('PARASITIC ATTACHMENT'), value: archetypeState.attachment, max: archetypeState.max_attachment };
  }
  if (isPrometheusState(archetypeState)) {
    return { label: msg('INSIGHT'), value: archetypeState.insight, max: archetypeState.max_insight };
  }
  if (isDelugeState(archetypeState)) {
    return { label: msg('WATER LEVEL'), value: archetypeState.water_level, max: archetypeState.max_water_level };
  }
  if (isAwakeningState(archetypeState)) {
    return { label: msg('AWARENESS'), value: archetypeState.awareness, max: archetypeState.max_awareness };
  }
  if (isOverthrowState(archetypeState)) {
    return { label: msg('FRACTURE'), value: archetypeState.fracture, max: archetypeState.max_fracture };
  }
  return null;
}

/**
 * Render an archetype gauge as a formatted ASCII bar string.
 * Combines getArchetypeGaugeInfo() data extraction with bar rendering.
 * Returns null if the archetype state has no gauge.
 */
export function formatArchetypeGaugeBar(archetypeState: ArchetypeState): string | null {
  const gauge = getArchetypeGaugeInfo(archetypeState);
  if (!gauge) return null;
  const barWidth = gauge.max <= 10 ? gauge.max : Math.round(gauge.max / 5);
  const filled = gauge.max <= 10 ? gauge.value : Math.round(gauge.value / 5);
  const empty = barWidth - filled;
  const bar =
    '\u2588'.repeat(Math.max(0, filled)) + '\u2591'.repeat(Math.max(0, empty));
  return `${gauge.label}: ${bar} [${gauge.value}/${gauge.max}]`;
}

// ── Enemy HP Approximation ──────────────────────────────────────────────────

/**
 * Map enemy condition string to approximate HP percentage.
 * Single source of truth — used by both terminal formatters and UI components.
 */
const ENEMY_HP_MAP: Record<string, number> = {
  healthy: 100,
  scratched: 70,
  damaged: 50,
  wounded: 30,
  critical: 10,
  defeated: 0,
};

export function getEnemyHpPercent(condition: string): number {
  return ENEMY_HP_MAP[condition] ?? 50;
}

// ── Enemy Name Disambiguation ───────────────────────────────────────────────

/**
 * Build display names for enemies, appending alphabetic suffixes (A, B, C...)
 * when multiple enemies share the same base name.
 * Returns a Map from instance_id to disambiguated display name.
 *
 * Example: two "Shadow Wisp" enemies become "Shadow Wisp A" and "Shadow Wisp B".
 * Enemies with unique names are returned unchanged.
 */
export function buildEnemyDisplayNames(enemies: EnemyCombatStateClient[]): Map<string, string> {
  const nameCounts = new Map<string, number>();
  for (const e of enemies) {
    const name = localized(e, 'name');
    nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
  }

  const nameIndexes = new Map<string, number>();
  const displayNames = new Map<string, string>();

  for (const e of enemies) {
    const name = localized(e, 'name');
    const count = nameCounts.get(name) ?? 1;
    if (count > 1) {
      const idx = nameIndexes.get(name) ?? 0;
      nameIndexes.set(name, idx + 1);
      const suffix = String.fromCharCode(65 + idx); // A, B, C...
      displayNames.set(e.instance_id, `${name} ${suffix}`);
    } else {
      displayNames.set(e.instance_id, name);
    }
  }

  return displayNames;
}

// ── Condition Display ────────────────────────────────────────────────────────

/** i18n-aware condition label. Use `.toUpperCase()` for terminal ASCII contexts. */
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

/** i18n-aware enemy condition label for UI components. */
export function getEnemyConditionLabel(condition: string): string {
  const labels: Record<string, () => string> = {
    healthy: () => msg('healthy'),
    scratched: () => msg('scratched'),
    damaged: () => msg('damaged'),
    wounded: () => msg('wounded'),
    critical: () => msg('critical'),
    defeated: () => msg('defeated'),
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
    threshold: () => msg('Threshold'),
  };
  return (
    labels[type]?.() ?? (fallbackIndex !== undefined ? `${msg('Room')} ${fallbackIndex}` : type)
  );
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

/** Map stress percentage to a descriptive label. */
export function getStressLabel(stressPct: number): string {
  if (stressPct >= 80) return msg('BREAKING');
  if (stressPct >= 60) return msg('CRITICAL');
  if (stressPct >= 40) return msg('STRAINED');
  if (stressPct >= 25) return msg('TENSE');
  if (stressPct >= 10) return msg('UNEASY');
  return '';
}

// ── Dungeon Entry ────────────────────────────────────────────────────────────

export function formatDungeonEntry(
  state: DungeonClientState,
  atmosphereText: string,
): TerminalLine[] {
  const lines: TerminalLine[] = [];

  lines.push(systemLine('\u2550'.repeat(50)));
  lines.push(
    systemLine(
      `  ${msg('RESONANCE DUNGEON')} \u2014 ${getArchetypeDisplayName(state.archetype).toUpperCase()}`,
    ),
  );
  const depthDisplay = getMaxDepth(state.rooms) || '?';
  lines.push(
    systemLine(
      `  ${msg('Difficulty')}: ${'*'.repeat(state.difficulty)}${'·'.repeat(5 - state.difficulty)}  ${msg('Depth')}: ${depthDisplay}`,
    ),
  );
  lines.push(systemLine('\u2550'.repeat(50)));
  lines.push(responseLine(''));

  if (atmosphereText) {
    lines.push(responseLine(atmosphereText));
    lines.push(responseLine(''));
  }

  // Party summary
  lines.push(systemLine(msg('PARTY:')));
  for (const agent of state.party) {
    const primaryApt = Object.entries(agent.aptitudes).sort(([, a], [, b]) => b - a)[0];
    const aptStr = primaryApt
      ? `${primaryApt[0].charAt(0).toUpperCase() + primaryApt[0].slice(1)} ${primaryApt[1]}`
      : '';
    lines.push(
      responseLine(
        `  ${agent.agent_name} \u2014 ${aptStr} \u2014 ${getConditionLabel(agent.condition).toUpperCase()}`,
      ),
    );
  }

  // Archetype protocol briefing — always shown on dungeon entry.
  // The protocol explains the core mechanic (visibility for Shadow,
  // structural integrity for Tower) and is essential context for every run.
  // Players can also recall it mid-run via the "protocol" command.
  lines.push(systemLine(''));
  lines.push(...formatArchetypeBriefing(state.archetype));

  lines.push(responseLine(''));
  lines.push(hintLine(msg('Type "map" to see the dungeon layout, "move <room>" to move.')));

  return lines;
}

/** Protocol briefing data shape. Lazy-evaluated via functions to satisfy i18n (msg() at call time). */
interface ProtocolBriefing {
  title: () => string;
  intro: () => string[];
  bullets: () => string[];
  outro: () => string;
}

/** Data-driven protocol briefings for all 8 archetypes. */
const PROTOCOL_BRIEFINGS: Record<string, ProtocolBriefing> = {
  [ARCHETYPE_SHADOW]: {
    title: () => msg('SHADOW PROTOCOL'),
    intro: () => [
      msg('You descend into the dark. Visibility is your lifeline \u2013'),
      msg('when it fails, the shadows move closer.'),
    ],
    bullets: () => [
      msg('Scout to reveal rooms. Observe to maintain sight.'),
      msg('The darkness drains visibility each floor.'),
      msg('At Visibility 0, enemies strike first. Always.'),
    ],
    outro: () => msg('The darkness does not forgive blindness.'),
  },
  [ARCHETYPE_TOWER]: {
    title: () => msg('STRUCTURAL PROTOCOL'),
    intro: () => [
      msg('The building remembers every footstep as a tremor.'),
      msg('Each floor you ascend weakens the one beneath.'),
    ],
    bullets: () => [
      msg('Structural integrity drains each floor.'),
      msg('Use REINFORCE (Guardian) to restore stability.'),
      msg('At integrity 0, the building collapses. No retreat.'),
    ],
    outro: () => msg('Reinforce what holds you up \u2013 or become what it buries.'),
  },
  [ARCHETYPE_ENTROPY]: {
    title: () => msg('ENTROPY PROTOCOL'),
    intro: () => [
      msg('Everything here is becoming everything else.'),
      msg('Decay accumulates. It does not reverse on its own.'),
    ],
    bullets: () => [
      msg('Decay increases each floor and each combat round.'),
      msg('Enemy contact accelerates decay (contagious).'),
      msg('Use PRESERVE (Guardian) to slow dissolution.'),
      msg('At Decay 100, the party dissolves. No retreat.'),
    ],
    outro: () => msg('Reinforce the differences. Or join the equilibrium.'),
  },
  [ARCHETYPE_MOTHER]: {
    title: () => msg('PARASITIC PROTOCOL'),
    intro: () => [
      msg('The dungeon provides. The provision is the threat.'),
      msg('Everything here heals you. Everything here binds you.'),
    ],
    bullets: () => [
      msg('Attachment rises each floor. The dungeon heals stress in return.'),
      msg('Accepting gifts deepens the bond. Refusing costs stress.'),
      msg('Use SEVER (Guardian) to cut the parasitic attachment.'),
      msg('At Attachment 100, the party is incorporated. No exit.'),
    ],
    outro: () => msg('The warmth is genuine. The warmth is also the trap.'),
  },
  [ARCHETYPE_PROMETHEUS]: {
    title: () => msg('PROMETHEUS PROTOCOL'),
    intro: () => [
      msg('The fire was never meant to be carried. It was meant to be understood.'),
      msg('Every room yields components. Every component is a question about what to build.'),
    ],
    bullets: () => [
      msg('Insight rises with exploration. Deeper rooms yield more.'),
      msg('Components are found in combat, encounters, and treasure rooms.'),
      msg('Craft items at insight thresholds. Each creation costs insight.'),
      msg('The pharmakon accumulates \u2013 the fire that illuminates also burns.'),
      msg('At Insight 100: breakthrough. The forge ignites fully.'),
    ],
    outro: () => msg('What you build here will outlast you. Choose what deserves to exist.'),
  },
  [ARCHETYPE_DELUGE]: {
    title: () => msg('DELUGE PROTOCOL'),
    intro: () => [
      msg('The water rises. Not fast. It has time.'),
      msg('What the flood takes, it keeps. What it spares, it marks.'),
    ],
    bullets: () => [
      msg('Lower floors flood first. They also hold better salvage.'),
      msg('The tide recedes \u2013 briefly \u2013 every 3 rooms.'),
      msg('Each recession is smaller than the last.'),
      msg('Use SEAL (Guardian) to close the breaches.'),
      msg('Use SALVAGE to dive cleared rooms for submerged loot.'),
      msg('At water level 100: submersion. Total loss.'),
    ],
    outro: () => msg('The waterline does not negotiate. Read it, or join it.'),
  },
  [ARCHETYPE_AWAKENING]: {
    title: () => msg('AWAKENING PROTOCOL'),
    intro: () => [
      msg('The collective mind turns over in its sleep.'),
      msg('Something in the architecture recognizes you. Not personally \u2013 collectively.'),
    ],
    bullets: () => [
      msg('Awareness rises with each room. The deeper you go, the faster.'),
      msg('High awareness grants perception \u2013 but erodes certainty.'),
      msg('At Awareness 70: lucid state. The dungeon responds to thought.'),
      msg('Use GROUND (Spy) to reduce awareness. Grounding has a cooldown.'),
      msg('At Awareness 100: dissolution. Complete ego loss.'),
    ],
    outro: () => msg('The dungeon does not read your thoughts. It resonates with them.'),
  },
  [ARCHETYPE_OVERTHROW]: {
    title: () => msg('OVERTHROW PROTOCOL'),
    intro: () => [
      msg('Power changes hands. The old order does not die \u2013 it metamorphoses.'),
      msg('Every NPC is a political actor. Every room is a negotiation.'),
    ],
    bullets: () => [
      msg('Authority fracture rises with each room. Factions shift.'),
      msg('High fracture means betrayals, ambushes, and paranoia.'),
      msg('At Fracture 60: revolution. The old order cracks.'),
      msg('Use RALLY (Propagandist) to reduce fracture. Rally has a cooldown.'),
      msg('At Fracture 100: total collapse. Power vacuum.'),
    ],
    outro: () => msg('The Spiegelpalast shows everyone what they want to see. Not what they are.'),
  },
};

/** Generate archetype-specific protocol briefing. Data-driven: 8 entries, 1 renderer. */
export function formatArchetypeBriefing(archetype: string): TerminalLine[] {
  const briefing = PROTOCOL_BRIEFINGS[archetype] ?? PROTOCOL_BRIEFINGS[ARCHETYPE_SHADOW];
  const lines: TerminalLine[] = [];

  lines.push(combatSystemLine(briefing.title()));
  lines.push(systemLine(''));
  for (const line of briefing.intro()) {
    lines.push(responseLine(line));
  }
  lines.push(systemLine(''));
  for (const bullet of briefing.bullets()) {
    lines.push(systemLine(`\u25C9 ${bullet}`));
  }
  lines.push(systemLine(''));
  lines.push(responseLine(briefing.outro()));

  return lines;
}

// ── Dungeon Map (ASCII FTL-style) ────────────────────────────────────────────

export function formatDungeonMap(state: DungeonClientState): TerminalLine[] {
  const lines: TerminalLine[] = [];
  const mxDepth = getMaxDepth(state.rooms);

  lines.push(
    systemLine(
      `DUNGEON MAP \u2014 ${state.archetype.toUpperCase()}, ${msg('Depth')} ${state.depth}/${mxDepth}`,
    ),
  );
  lines.push(systemLine(''));

  // Index rooms by index for O(1) lookup in connection rendering
  const roomByIndex = new Map(state.rooms.map((r) => [r.index, r]));

  // Group rooms by depth
  const byDepth = new Map<number, RoomNodeClient[]>();
  for (const room of state.rooms) {
    const list = byDepth.get(room.depth) ?? [];
    list.push(room);
    byDepth.set(room.depth, list);
  }

  // Render each depth layer
  for (const [depth, rooms] of [...byDepth.entries()].sort((a, b) => a[0] - b[0])) {
    const roomStrs = rooms.map((r) => {
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
      const connStrs = rooms.map((r) => {
        const hasDown = r.connections.some((c) => {
          const target = roomByIndex.get(c);
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
  archetypeState: ArchetypeState,
  anchorTexts?: AnchorText[] | null,
  barometerText?: string | null,
  archetype?: string,
): TerminalLine[] {
  const lines: TerminalLine[] = [];

  // Banter first (agent personality reaction)
  if (banterText) {
    lines.push(responseLine(''));
    lines.push(responseLine(banterText));
  }

  // Room header
  lines.push(responseLine(''));
  lines.push(
    systemLine(
      `\u2550\u2550\u2550 ${msg('DEPTH')} ${room.depth} \u2014 ${msg('ROOM')} ${room.index} \u2550\u2550\u2550`,
    ),
  );

  // Anchor object text (environmental narrative — part of the room)
  if (anchorTexts && anchorTexts.length > 0) {
    for (const anchor of anchorTexts) {
      const text = localized(anchor, 'text');
      if (text) {
        lines.push(responseLine(''));
        lines.push(responseLine(text));
      }
    }
  }

  // Archetype-specific state gauge (all 8 archetypes via centralized helper)
  const gaugeBar = formatArchetypeGaugeBar(archetypeState);
  if (gaugeBar) {
    lines.push(systemLine(gaugeBar));
  }

  // Barometer text (archetype state → prose narrative, after the numeric bar)
  if (barometerText) {
    lines.push(responseLine(barometerText));
  }

  // Room type header
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
    case 'rest': {
      const amb = getAmbient(archetype ?? '');
      lines.push(systemLine(`[${msg('REST SITE')}]`));
      lines.push(responseLine(amb.rest));
      lines.push(hintLine(msg('Use "rest" to recover stress. Risk of ambush.')));
      break;
    }
    case 'treasure': {
      const amb = getAmbient(archetype ?? '');
      lines.push(systemLine(`[${msg('TREASURE')}]`));
      lines.push(responseLine(amb.treasure));
      break;
    }
    case 'boss': {
      const amb = getAmbient(archetype ?? '');
      lines.push(systemLine(`[${msg('BOSS CHAMBER')}]`));
      lines.push(responseLine(amb.boss));
      break;
    }
    case 'exit':
      lines.push(systemLine(`[${msg('EXIT')}]`));
      lines.push(hintLine(msg('Use "retreat" to leave with partial loot.')));
      break;
    case 'threshold':
      lines.push(systemLine(`[${msg('THRESHOLD')}]`));
      break;
    case 'entrance':
      lines.push(systemLine(`[${msg('ENTRANCE')}]`));
      lines.push(hintLine(msg('Type "map" to view the dungeon layout, "move <number>" to advance.')));
      break;
    default:
      lines.push(systemLine(`[${room.room_type.toUpperCase()}]`));
  }

  return lines;
}

// ── Combat Start ─────────────────────────────────────────────────────────────

export function formatCombatStart(combat: CombatStateClient): TerminalLine[] {
  const lines: TerminalLine[] = [];

  lines.push(systemLine(''));
  lines.push(
    systemLine(
      `\u2550\u2550\u2550 ${msg('COMBAT')} \u2014 ${msg('Round')} ${combat.round_num}/${combat.max_rounds} \u2550\u2550\u2550`,
    ),
  );
  lines.push(systemLine(''));

  // Enemies
  const aliveEnemies = combat.enemies.filter((e) => e.is_alive);
  lines.push(systemLine(msg('ENEMIES:')));
  if (aliveEnemies.length === 0) {
    lines.push(responseLine(`  ${msg('No enemies remaining.')}`));
  }
  for (const enemy of aliveEnemies) {
    const condBar = _enemyConditionBar(enemy.condition_display);
    const threatBadge = `[${enemy.threat_level.toUpperCase()}]`;
    const intentStr = enemy.telegraphed_action
      ? `  ${msg('INTENT')}: \u25BA ${enemy.telegraphed_action.intent}`
      : '';
    lines.push(responseLine(`  ${localized(enemy, 'name')} ${condBar} ${threatBadge}${intentStr}`));
  }

  lines.push(systemLine(''));

  // Telegraphed actions summary
  if (combat.telegraphed_actions.length > 0) {
    lines.push(systemLine(msg('ENEMY INTENTIONS:')));
    for (const ta of combat.telegraphed_actions) {
      const threatColor =
        ta.threat_level === 'critical'
          ? '!!!'
          : ta.threat_level === 'high'
            ? '!!'
            : ta.threat_level === 'medium'
              ? '!'
              : '';
      lines.push(
        responseLine(
          `  ${threatColor} ${ta.enemy_name}: ${ta.intent}${ta.target ? ` \u2192 ${ta.target}` : ''}`,
        ),
      );
    }
    lines.push(systemLine(''));
  }

  return lines;
}

// ── Combat Planning (ability list per agent) ─────────────────────────────────

export function formatCombatPlanning(party: AgentCombatStateClient[]): TerminalLine[] {
  const lines: TerminalLine[] = [];

  // Compact planning summary — the combat bar IS the primary ability UI
  const active = party.filter((a) => a.condition !== 'captured');
  const names = active.map((a) => a.agent_name).join(', ');
  lines.push(systemLine(`${msg('SELECT ACTIONS')}: ${names}`));
  lines.push(
    hintLine(
      msg('Select abilities in the combat bar below. Type "help combat" for commands.'),
    ),
  );

  return lines;
}

// ── Combat Resolution (semantic color-coded battle log) ─────────────────────

export function formatCombatResolution(
  result: CombatRoundResult,
  partyNames?: string[],
): TerminalLine[] {
  const lines: TerminalLine[] = [];
  const party = new Set(partyNames ?? []);

  lines.push(
    combatSystemLine(
      `\u2550\u2550\u2550 ${msg('RESOLUTION')} \u2014 ${msg('Round')} ${result.round} \u2550\u2550\u2550`,
    ),
  );

  // Separate party actions from enemy actions
  const partyEvents = result.events.filter(
    (e) => party.size === 0 || party.has(e.actor) || e.actor === 'Trap',
  );
  const enemyEvents = result.events.filter(
    (e) => party.size > 0 && !party.has(e.actor) && e.actor !== 'Trap',
  );

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
    lines.push(
      combatHealLine(`\u2550\u2550\u2550       ${msg('V I C T O R Y')}       \u2550\u2550\u2550`),
    );
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

/**
 * Visual break between completed round and the next planning phase.
 * Uses ─ (light horizontal) to distinguish from ═ (double) round headers.
 */
export function formatRoundTransition(completedRound: number): TerminalLine[] {
  return [
    combatSystemLine(''),
    combatSystemLine(
      `${'─'.repeat(16)} ${msg('Round')} ${completedRound} ${msg('complete')} ${'─'.repeat(16)}`,
    ),
    combatSystemLine(''),
  ];
}

/** Format a single combat event with semantic color based on context. */
function _formatCombatEvent(event: CombatEvent, isEnemyAction: boolean): TerminalLine {
  const tag = _eventTag(event, isEnemyAction);

  // Prefer bilingual narrative (proper separation of concerns — backend narrates,
  // frontend renders). Fall back to compact actor→action→target for events
  // without narrative (shouldn't happen, but defence-in-depth).
  const narrative = localized(event, 'narrative');
  let text: string;
  if (narrative) {
    text = `  [${tag}] ${narrative}`;
  } else {
    const summary = `  [${tag}] ${event.actor} \u2192 ${event.action} \u2192 ${event.target}`;
    const details: string[] = [];
    if (event.damage > 0) {
      details.push(`${event.damage} ${event.damage === 1 ? msg('step') : msg('steps')}`);
    }
    if (event.stress !== 0) {
      details.push(`${event.stress > 0 ? '+' : ''}${event.stress} ${msg('stress')}`);
    }
    const detailStr = details.length > 0 ? `. ${details.join(', ')}.` : '.';
    text = `${summary}${detailStr}`;
  }

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
function _eventTag(event: CombatEvent, isEnemyAction: boolean): string {
  if (!event.hit) return 'MISS';
  if (event.action === 'defend') return 'DEF';
  if (event.action === 'detonate') return 'TRAP';
  if (event.stress < 0) return 'HEAL';
  if (event.damage > 0) return isEnemyAction ? 'ATK' : 'HIT';
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
  lines.push(systemLine(`${agentName} ${msg('reaches critical stress')}`));
  lines.push(systemLine(''));
  lines.push(systemLine(`[SYSTEM] \u2550\u2550\u2550 ${msg('RESOLVE CHECK')} \u2550\u2550\u2550`));
  lines.push(systemLine('[SYSTEM]'));
  lines.push(systemLine(`[SYSTEM] ${msg('Resolving')}...`));

  // 3-second dramatic pause is handled by the command handler
  // via delayed line rendering (staggered timestamps)

  if (isVirtue) {
    lines.push(systemLine(''));
    lines.push(systemLine('\u2588'.repeat(40)));
    lines.push(
      systemLine(`\u2588\u2588     V I R T U E :  ${resultName.toUpperCase()}     \u2588\u2588`),
    );
    lines.push(systemLine('\u2588'.repeat(40)));
  } else {
    lines.push(systemLine(''));
    lines.push(systemLine('\u2591'.repeat(40)));
    lines.push(
      systemLine(`\u2591\u2591  A F F L I C T I O N :  ${resultName.toUpperCase()}  \u2591\u2591`),
    );
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
    lines.push(systemLine(`[${i + 1}] ${localized(choice, 'label')}`));

    // Aptitude requirements
    if (choice.requires_aptitude) {
      for (const [apt, level] of Object.entries(choice.requires_aptitude)) {
        lines.push(
          responseLine(
            `    ${msg('Requires')}: ${apt.charAt(0).toUpperCase() + apt.slice(1)} ${level}`,
          ),
        );
      }
    }

    // Check info — which agent can do it best?
    if (choice.check_aptitude) {
      const bestAgent = _findBestAgent(party, choice.check_aptitude);
      if (bestAgent) {
        const aptLevel = bestAgent.aptitudes[choice.check_aptitude] ?? 0;
        lines.push(
          responseLine(
            `    ${bestAgent.agent_name} ${msg('volunteers')} (${choice.check_aptitude} ${aptLevel})`,
          ),
        );
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

// ── Threshold Room ──────────────────────────────────────────────────────────

/**
 * Format the Threshold room entry — sparse, literary, with deliberate whitespace.
 * The Threshold is the only room type with this rendering style.
 */
export function formatThresholdEntry(
  description: string,
  choices: EncounterChoiceClient[],
): TerminalLine[] {
  const lines: TerminalLine[] = [];

  // Entry prose — sparse, indented, short lines (header already rendered by formatRoomEntry)
  lines.push(responseLine(''));

  // Split description into sentences for sparse rendering
  const sentences = description.split(/(?<=[.!?])\s+/).filter(Boolean);
  for (const sentence of sentences) {
    lines.push(responseLine(`    ${sentence}`));
  }
  lines.push(responseLine(''));

  // Toll choices — minimal formatting
  lines.push(responseLine(`    ${msg('The Threshold offers three tolls.')}:`));
  lines.push(responseLine(''));

  for (let i = 0; i < choices.length; i++) {
    const choice = choices[i];
    lines.push(systemLine(`    [${i + 1}] ${localized(choice, 'label')}`));
    lines.push(responseLine(`        ${localized(choice, 'description')}`));
    if (i < choices.length - 1) lines.push(responseLine(''));
  }

  lines.push(responseLine(''));
  lines.push(hintLine(msg('Type "interact <number>" to choose.')));
  lines.push(errorLine(msg('This choice cannot be undone.')));

  return lines;
}

// ── Skill Check Result ───────────────────────────────────────────────────────

export function formatSkillCheckResult(
  check: SkillCheckDetail,
  narrativeEn: string,
  effects: string[],
): TerminalLine[] {
  const lines: TerminalLine[] = [];

  // Check header with aptitude, level, and modifier
  const adjustment = check.breakdown?.adjustment ?? 0;
  const modifierStr = adjustment >= 0 ? `+${adjustment}` : `${adjustment}`;
  lines.push(
    systemLine(
      `[${check.aptitude.toUpperCase()} CHECK \u2013 ${msg('Modifier')}: ${modifierStr}]`,
    ),
  );
  lines.push(systemLine(''));

  // Rolling bar — use effective roll (raw + adjustment) for visual feedback
  const effectiveRoll = Math.max(1, Math.min(100, check.roll + adjustment));
  const rollBar = progressBar(effectiveRoll, 100);
  lines.push(systemLine(`${msg('Rolling')}... ${check.roll} (${modifierStr}) = ${effectiveRoll}`));
  lines.push(systemLine(`${rollBar}`));
  lines.push(systemLine(''));

  // Result with transparent outcome thresholds
  const resultLabel =
    check.result === 'success'
      ? msg('SUCCESS')
      : check.result === 'partial'
        ? msg('PARTIAL SUCCESS')
        : msg('FAILURE');
  lines.push(systemLine(`${msg('Result')}: ${effectiveRoll} \u2013 ${resultLabel}`));
  lines.push(responseLine(''));

  // Narrative
  if (narrativeEn) {
    for (const para of narrativeEn.split('\n')) {
      lines.push(responseLine(para));
    }
  }

  // Effects — pre-narrated by backend (bilingual, proper separation of concerns)
  for (const effect of effects) {
    if (effect) lines.push(responseLine(`  \u2192 ${effect}`));
  }

  return lines;
}

// ── Loot ─────────────────────────────────────────────────────────────────────

export function formatLootDrop(items: LootItem[]): TerminalLine[] {
  const lines: TerminalLine[] = [];

  lines.push(combatSystemLine(`\u2550\u2550\u2550 ${msg('LOOT FOUND')} \u2550\u2550\u2550`));
  lines.push(systemLine(''));

  for (const item of items) {
    const marker = LOOT_TIER_MARKERS[item.tier] ?? '\u25C6';
    lines.push(
      combatHealLine(`  ${marker} ${localized(item, 'name')} (${msg('Tier')} ${item.tier})`),
    );
    lines.push(combatHealLine(`    ${localized(item, 'description')}`));
  }

  return lines;
}

// ── Scout Result ─────────────────────────────────────────────────────────────

export function formatScoutResult(
  agentName: string,
  revealedRooms: number,
  visibility: number | undefined | null,
  archetype = '',
): TerminalLine[] {
  const lines: TerminalLine[] = [];

  // Archetype-aware scout text (data-driven)
  const scoutVerb = getAmbient(archetype).scout;
  lines.push(responseLine(`${agentName} ${scoutVerb}...`));

  if (revealedRooms > 0) {
    lines.push(systemLine(`[${msg('SCOUT SUCCESS')}]`));
    lines.push(
      responseLine(
        `  \u2192 ${revealedRooms} ${revealedRooms === 1 ? msg('room revealed') : msg('rooms revealed')}`,
      ),
    );
  } else {
    lines.push(systemLine(`[${msg('SCOUT')}]`));
    lines.push(responseLine(`  \u2192 ${msg('No new rooms to reveal')}`));
  }

  // Only show visibility for Shadow archetype (where it's a real number, not null)
  if (visibility != null && archetype !== ARCHETYPE_TOWER) {
    lines.push(responseLine(`  \u2192 ${msg('Visibility')}: ${visibility}`));
  }

  lines.push(hintLine(msg('Type "map" to see updated layout.')));

  return lines;
}

// ── Rest Result ──────────────────────────────────────────────────────────────

export function formatRestResult(healed: boolean, ambushed: boolean): TerminalLine[] {
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
    for (const item of loot) {
      const marker = LOOT_TIER_MARKERS[item.tier] ?? '\u25C6';
      lines.push(responseLine(`  ${marker} ${localized(item, 'name')}`));
    }
  }

  return lines;
}

// ── Dungeon Complete ─────────────────────────────────────────────────────────

/** Pick the right line factory based on agent condition — visual severity. */
function conditionLine(condition: string, content: string): TerminalLine {
  switch (condition) {
    case 'operational':
      return combatHealLine(content);
    case 'stressed':
      return combatPlayerLine(content);
    case 'wounded':
    case 'afflicted':
      return combatDamageLine(content);
    case 'captured':
      return combatMissLine(content);
    default:
      return responseLine(content);
  }
}

export function formatDungeonComplete(state: DungeonClientState, loot: LootItem[]): TerminalLine[] {
  const lines: TerminalLine[] = [];
  const maxDepth = getMaxDepth(state.rooms);
  const totalRooms = state.rooms.length;
  const clearedRooms = state.rooms.filter((r) => r.cleared).length;
  const W = 50; // box width

  // ── Banner ──
  lines.push(combatSystemLine('\u2550'.repeat(W)));
  lines.push(combatSystemLine(`\u2551${' '.repeat(W - 2)}\u2551`));
  lines.push(
    combatSystemLine(
      '\u2551' +
        `D U N G E O N   C O M P L E T E`.padStart(Math.floor((W - 2 + 33) / 2)).padEnd(W - 2) +
        '\u2551',
    ),
  );
  lines.push(combatSystemLine(`\u2551${' '.repeat(W - 2)}\u2551`));
  lines.push(
    combatSystemLine(
      '\u2551' +
        `${state.archetype.toUpperCase()} \u2014 ${msg('DIFFICULTY')} ${state.difficulty}`
          .padStart(Math.floor((W - 2 + state.archetype.length + 16) / 2))
          .padEnd(W - 2) +
        '\u2551',
    ),
  );
  lines.push(combatSystemLine(`\u2551${' '.repeat(W - 2)}\u2551`));
  lines.push(combatSystemLine('\u2550'.repeat(W)));
  lines.push(systemLine(''));

  // ── Expedition Summary ──
  lines.push(combatSystemLine(msg('EXPEDITION SUMMARY')));
  lines.push(responseLine(`  ${msg('Depth Reached').padEnd(18)} ${state.depth} / ${maxDepth}`));
  lines.push(responseLine(`  ${msg('Rooms Cleared').padEnd(18)} ${clearedRooms} / ${totalRooms}`));
  lines.push(systemLine(''));

  // ── Party Status ──
  lines.push(combatSystemLine(msg('PARTY STATUS')));
  const nameWidth = Math.max(...state.party.map((a) => a.agent_name.length), 12);
  for (const agent of state.party) {
    const cond = getConditionLabel(agent.condition).toUpperCase();
    const bar = stressBar(agent.stress, 10);
    const stressPct = Math.round(agent.stress / 10);
    const stressLabel = getStressLabel(stressPct);
    const stressDisplay = stressLabel ? `${stressPct}% ${stressLabel}` : `${stressPct}%`;
    const label = `  ${agent.agent_name.padEnd(nameWidth)}  ${cond.padEnd(12)} ${stressDisplay.padStart(14)} ${bar}`;
    lines.push(conditionLine(agent.condition, label));
  }
  lines.push(systemLine(''));

  // ── Spoils ──
  if (loot.length > 0) {
    lines.push(combatSystemLine(msg('SPOILS CLAIMED')));
    for (const item of loot) {
      const marker = LOOT_TIER_MARKERS[item.tier] ?? '\u25C6';
      lines.push(
        combatHealLine(
          `  ${marker} ${localized(item, 'name')} \u2014 ${localized(item, 'description')}`,
        ),
      );
    }
    lines.push(systemLine(''));
  }

  // ── Closing (archetype-specific) ──
  const isTowerDungeon = state.archetype === ARCHETYPE_TOWER;
  const closingText = isTowerDungeon
    ? msg('The building settles. Your agents descend \u2013 the stairs hold, this time.')
    : msg(
        'The darkness recedes. Your agents emerge \u2013 not unscathed, but something has been understood.',
      );
  lines.push(combatMissLine(closingText));
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

// ── Loot Distribution (Debrief Terminal) ────────────────────────────────────

/** Effect types that are auto-applied (no player choice). */
export const AUTO_APPLY_EFFECTS = new Set([
  'stress_heal',
  'event_modifier',
  'arc_modifier',
  'dungeon_buff',
]);

/** Human-readable effect type label for the distribution screen. */
function _effectLabel(effectType: string): string {
  const labels: Record<string, () => string> = {
    aptitude_boost: () => msg('Aptitude Boost'),
    memory: () => msg('Shadow Memory'),
    moodlet: () => msg('Dungeon Moodlet'),
    permanent_dungeon_bonus: () => msg('Permanent Bonus'),
    next_dungeon_bonus: () => msg('Next Dungeon Bonus'),
    stress_heal: () => msg('Stress Recovery'),
    event_modifier: () => msg('Event Pressure Reduced'),
    arc_modifier: () => msg('Arc Pressure Reduced'),
  };
  return labels[effectType]?.() ?? effectType;
}

/**
 * Format the loot distribution debrief terminal.
 * Shows after boss victory: auto-applied items dimmed, distributable items
 * with assignment status and suggestion hints.
 */
export function formatLootDistribution(
  state: DungeonClientState,
  loot: LootItem[],
  assignments: Record<string, string>,
  suggestions: Record<string, string>,
): TerminalLine[] {
  const lines: TerminalLine[] = [];
  const W = 50;
  const partyMap = new Map(state.party.map((a) => [a.agent_id, a.agent_name]));

  // ── Banner ──
  lines.push(combatSystemLine('\u2550'.repeat(W)));
  lines.push(combatSystemLine(`\u2551${' '.repeat(W - 2)}\u2551`));
  lines.push(
    combatSystemLine(
      '\u2551' +
        `D E B R I E F   T E R M I N A L`.padStart(Math.floor((W - 2 + 33) / 2)).padEnd(W - 2) +
        '\u2551',
    ),
  );
  lines.push(combatSystemLine(`\u2551${' '.repeat(W - 2)}\u2551`));
  lines.push(combatSystemLine('\u2550'.repeat(W)));
  lines.push(systemLine(''));

  // ── Auto-applied items ──
  const autoItems = loot.filter((i) => AUTO_APPLY_EFFECTS.has(i.effect_type));
  if (autoItems.length > 0) {
    lines.push(combatSystemLine(msg('SYSTEM EFFECTS')));
    for (const item of autoItems) {
      lines.push(
        combatMissLine(
          `  [${msg('AUTO')}] ${_effectLabel(item.effect_type)} \u2014 ${localized(item, 'description')}`,
        ),
      );
    }
    lines.push(systemLine(''));
  }

  // ── Distributable items ──
  const distributable = loot.filter((i) => !AUTO_APPLY_EFFECTS.has(i.effect_type));
  if (distributable.length > 0) {
    lines.push(combatSystemLine(msg('ASSIGN SPOILS')));
    lines.push(systemLine(''));

    for (let i = 0; i < distributable.length; i++) {
      const item = distributable[i];
      const marker = LOOT_TIER_MARKERS[item.tier] ?? '\u25C6';
      const assignedAgentId = assignments[item.id];
      const suggestedAgentId = suggestions[item.id];
      const assignedName = assignedAgentId ? partyMap.get(assignedAgentId) : null;
      const suggestedName = suggestedAgentId ? partyMap.get(suggestedAgentId) : null;

      // Item header: number + marker + name
      lines.push(combatPlayerLine(`  [${i + 1}] ${marker} ${localized(item, 'name')}`));
      lines.push(responseLine(`      ${localized(item, 'description')}`));

      // Assignment status
      if (assignedName) {
        lines.push(combatHealLine(`      \u2192 ${assignedName}`));
      } else {
        const hint = suggestedName ? ` ${msg('Suggested')}: ${suggestedName}` : '';
        lines.push(combatDamageLine(`      [${msg('UNASSIGNED')}]${hint}`));
      }
      lines.push(systemLine(''));
    }
  }

  // ── Party overview (aptitudes for informed assignment) ──
  lines.push(combatSystemLine(msg('PARTY')));
  const nameWidth = Math.max(...state.party.map((a) => a.agent_name.length), 10);
  for (const agent of state.party) {
    if (agent.condition === 'captured') continue;
    const topApts = Object.entries(agent.aptitudes)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([k, v]) => `${k.substring(0, 3).toUpperCase()} ${v}`)
      .join('  ');
    const cond = getConditionLabel(agent.condition).toUpperCase();
    lines.push(
      responseLine(`  ${agent.agent_name.padEnd(nameWidth)}  ${cond.padEnd(12)} ${topApts}`),
    );
  }
  lines.push(systemLine(''));

  // ── Instructions ──
  const unassigned = distributable.filter((i) => !assignments[i.id]).length;
  if (unassigned > 0) {
    lines.push(hintLine(msg('Type "assign <#> <agent_name>" to assign an item.')));
  } else {
    lines.push(combatHealLine(msg('All items assigned. Type "confirm" to finalize.')));
  }

  return lines;
}

// ── Dungeon Status ───────────────────────────────────────────────────────────

export function formatDungeonStatus(state: DungeonClientState): TerminalLine[] {
  const lines: TerminalLine[] = [];
  const mxDepth = getMaxDepth(state.rooms);
  const clearedRooms = state.rooms.filter((r) => r.cleared).length;

  lines.push(
    systemLine(
      `\u2550\u2550\u2550 ${state.archetype.toUpperCase()} \u2014 ${msg('STATUS')} \u2550\u2550\u2550`,
    ),
  );
  lines.push(systemLine(''));
  lines.push(responseLine(`${msg('Phase')}: ${state.phase}`));
  lines.push(responseLine(`${msg('Depth')}: ${state.depth}/${mxDepth}`));
  lines.push(responseLine(`${msg('Rooms')}: ${clearedRooms}/${state.rooms.length}`));
  lines.push(responseLine(`${msg('Difficulty')}: ${'*'.repeat(state.difficulty)}`));

  // Archetype-specific gauge (all 8 archetypes via centralized helper)
  const statusGaugeBar = formatArchetypeGaugeBar(state.archetype_state);
  if (statusGaugeBar) {
    lines.push(responseLine(statusGaugeBar));
  }

  lines.push(systemLine(''));
  lines.push(systemLine(msg('PARTY:')));
  for (const agent of state.party) {
    const stressStr = stressBar(agent.stress);
    const condLabel = getConditionLabel(agent.condition).toUpperCase();
    lines.push(
      responseLine(
        `  ${agent.agent_name}: ${condLabel} | ${msg('Stress')}: ${stressStr} ${agent.stress}`,
      ),
    );

    // Active buffs/debuffs
    if (agent.active_buffs.length > 0 || agent.active_debuffs.length > 0) {
      const buffs = agent.active_buffs.map((b) => `+${b.name}`);
      const debuffs = agent.active_debuffs.map((d) => `-${d.name}`);
      lines.push(responseLine(`    ${[...buffs, ...debuffs].join(', ')}`));
    }
  }

  return lines;
}

// ── Dungeon Help ────────────────────────────────────────────────────────────

/** Format `help dungeon` — lists all dungeon verbs with syntax and aliases. */
export function formatDungeonHelp(): TerminalLine[] {
  const lines: TerminalLine[] = [];
  lines.push(systemLine(msg('RESONANCE DUNGEON COMMANDS:')));
  lines.push(systemLine(''));

  const cmds: [string, string][] = [
    ['dungeon [n|name]', msg('Enter a dungeon (by number or name)')],
    ['move [room]', msg('Move to adjacent room (alias: m)')],
    ['scout [agent]', msg('Reveal adjacent rooms (alias: sc)')],
    ['look', msg('Re-examine current room (alias: l)')],
    ['status', msg('Dungeon status overview')],
    ['map', msg('Show dungeon layout')],
    ['rest', msg('Rest at rest site (alias: r)')],
    ['interact [n]', msg('Choose encounter option (alias: i)')],
    ['attack [agent] [ab]', msg('Select combat ability (alias: a)')],
    ['submit', msg('Execute combat round (alias: sub)')],
    ['retreat', msg('Leave dungeon (hold-to-confirm)')],
    ['protocol', msg('Recall archetype briefing')],
    ['assign [n] [agent]', msg('Assign loot item')],
    ['confirm', msg('Finalize loot distribution')],
  ];

  for (const [syntax, desc] of cmds) {
    lines.push(responseLine(`  ${syntax.padEnd(22)} ${desc}`));
  }

  lines.push(systemLine(''));
  lines.push(systemLine(msg('Archetype-specific:')));
  lines.push(responseLine(`  ${'seal [agent]'.padEnd(22)} ${msg('Seal breach (Deluge only)')}`));
  lines.push(
    responseLine(
      `  ${'salvage [room]'.padEnd(22)} ${msg('Dive for submerged loot (Deluge only)')}`,
    ),
  );

  return lines;
}

// ── Available Dungeons ───────────────────────────────────────────────────────

export function formatAvailableDungeons(dungeons: AvailableDungeonResponse[]): TerminalLine[] {
  const lines: TerminalLine[] = [];

  if (dungeons.length === 0) {
    lines.push(systemLine(msg('No resonance dungeons available.')));
    lines.push(hintLine(msg('Dungeons appear when Substrate Resonance magnitude is high enough.')));
    return lines;
  }

  lines.push(systemLine(msg('AVAILABLE RESONANCE DUNGEONS:')));
  lines.push(systemLine(''));

  for (let i = 0; i < dungeons.length; i++) {
    const d = dungeons[i];
    const badges: string[] = [];
    if (!d.available) badges.push(`[${msg('COOLDOWN')}]`);
    if (d.admin_override) badges.push('[ADMIN]');
    const badgeStr = badges.length > 0 ? ` ${badges.join(' ')}` : '';
    const num = String(i + 1).padStart(2, ' ');
    lines.push(
      responseLine(
        `  [${num}] ${d.archetype} (${d.signature}) \u2013 ${msg('Suggested')}: ${'*'.repeat(d.suggested_difficulty)}${badgeStr}`,
      ),
    );
  }

  lines.push(responseLine(''));
  lines.push(hintLine(msg('Type "dungeon <number>" or "dungeon <name>". Example: dungeon 1')));

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
  lines.push(hintLine('SPY=Spy GRD=Guardian SAB=Saboteur PRP=Propagandist INF=Infiltrator ASN=Assassin'));
  lines.push(systemLine(''));

  for (let i = 0; i < agents.length; i++) {
    const agent = agents[i];
    const apts = aptitudeMap.get(agent.id);

    // Build aptitude string: top 3 by level
    // Generalist agents without explicit aptitudes default to 6 across the board
    const effectiveApts = apts ?? { spy: 6, guardian: 6, saboteur: 6, propagandist: 6, infiltrator: 6, assassin: 6 };
    const sorted = Object.entries(effectiveApts)
      .filter(([, v]) => v > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);
    let aptStr = sorted
      .map(
        ([k, v]) =>
          `${OPERATIVE_LABEL[k as import('../types/index.js').OperativeType] ?? k.toUpperCase()} ${v}`,
      )
      .join(' | ');
    if (!aptStr) aptStr = msg('generalist');

    const num = String(i + 1).padStart(2, ' ');
    lines.push(responseLine(`  ${num}. ${agent.name.padEnd(20)} ${aptStr}`));
  }

  lines.push(systemLine(''));
  lines.push(hintLine(msg('Select 2\u20134 agents: "dungeon 1 2 3"')));
  lines.push(hintLine(msg('Auto-pick best party: "dungeon auto"')));

  return lines;
}

// ── Seal Breach Result (Deluge) ─────────────────────────────────────────────

export function formatSealResult(
  agentName: string,
  waterLevel: number,
  stressCost: number,
  cooldownUntilRoom: number,
): TerminalLine[] {
  const lines: TerminalLine[] = [];
  lines.push(combatSystemLine(msg('SEAL BREACH')));
  lines.push(
    responseLine(`${agentName} ${msg('seals the breach. The water relents \u2013 briefly.')}`),
  );
  lines.push(
    systemLine(`  \u2192 ${msg('Water level')}: ${waterLevel} | ${msg('Stress')}: +${stressCost}`),
  );
  lines.push(hintLine(`${msg('Cooldown until room')} ${cooldownUntilRoom}.`));
  return lines;
}

// ── Ground Result (Awakening) ──────────────────────────────────────────────

export function formatGroundResult(
  agentName: string,
  awareness: number,
  stressCost: number,
  cooldownUntilRoom: number,
): TerminalLine[] {
  const lines: TerminalLine[] = [];
  lines.push(combatSystemLine(msg('GROUND')));
  lines.push(
    responseLine(`${agentName} ${msg('reaches inward. The layers settle \u2013 for now.')}`),
  );
  lines.push(
    systemLine(`  \u2192 ${msg('Awareness')}: ${awareness} | ${msg('Stress')}: +${stressCost}`),
  );
  lines.push(hintLine(`${msg('Cooldown until room')} ${cooldownUntilRoom}.`));
  return lines;
}

// ── Rally Result (Overthrow) ──────────────────────────────────────────────

export function formatRallyResult(
  agentName: string,
  fracture: number,
  stressCost: number,
  cooldownUntilRoom: number,
): TerminalLine[] {
  const lines: TerminalLine[] = [];
  lines.push(combatSystemLine(msg('RALLY')));
  lines.push(
    responseLine(`${agentName} ${msg('speaks. The factions listen \u2013 briefly.')}`),
  );
  lines.push(
    systemLine(`  \u2192 ${msg('Fracture')}: ${fracture} | ${msg('Stress')}: +${stressCost}`),
  );
  lines.push(hintLine(`${msg('Cooldown until room')} ${cooldownUntilRoom}.`));
  return lines;
}

// ── Salvage Result (Deluge) ─────────────────────────────────────────────────

export function formatSalvageResult(
  agentName: string,
  roomIndex: number,
  success: boolean,
  checkResult: string,
  checkValue: number,
  loot: LootItem[],
  waterPenalty?: number,
): TerminalLine[] {
  const lines: TerminalLine[] = [];
  lines.push(combatSystemLine(msg('SALVAGE DIVE')));
  lines.push(
    systemLine(`  ${msg('Room')} [${roomIndex}] | ${msg('Check')}: ${checkResult} (${checkValue})`),
  );

  if (success) {
    lines.push(responseLine(`${agentName} ${msg('surfaces. The water yields something.')}`));
    for (const item of loot) {
      const name = localized(item, 'name') || item.name_en;
      lines.push(systemLine(`  \u25C9 ${name} [T${item.tier}]`));
    }
  } else {
    lines.push(
      responseLine(`${agentName} ${msg('surfaces empty-handed. The water keeps what it took.')}`),
    );
    if (waterPenalty) {
      lines.push(errorLine(`${msg('Water level')} +${waterPenalty}`));
    }
  }
  return lines;
}

// ── Debris Found (Deluge — The Current Carries) ────────────────────────────

export function formatDebrisFound(debris: LootItem): TerminalLine[] {
  const lines: TerminalLine[] = [];
  const name = localized(debris, 'name') || debris.name_en;
  const desc = localized(debris, 'description') || debris.description_en;
  lines.push(systemLine(''));
  lines.push(systemLine(`\u2248 ${msg('THE CURRENT CARRIES')}: ${name}`));
  if (desc) {
    lines.push(responseLine(desc));
  }
  return lines;
}

// ── Private Helpers ──────────────────────────────────────────────────────────

function _enemyConditionBar(display: string): string {
  const hpPct = getEnemyHpPercent(display);
  return progressBar(Math.round(hpPct / 10), 10, 8);
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

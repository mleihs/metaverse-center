/**
 * Resonance Dungeons — Terminal command handlers.
 *
 * Dispatched by terminal-commands.ts when isDungeonMode is true.
 * Handlers import from DungeonStateManager (state) and DungeonApiService (API).
 * Formatters are pure functions from dungeon-formatters.ts.
 *
 * Entry flow (archetype selection, agent picker, disambiguation, run creation)
 * is in dungeon-entry-flow.ts. This module handles the remaining 16 verbs.
 *
 * Pattern: terminal-commands.ts handlers (async, return TerminalLine[]).
 */

import { msg } from '@lit/localize';

import { dungeonApi } from '../services/api/DungeonApiService.js';
import { dungeonAudio } from '../services/DungeonAudioService.js';
import { dungeonState } from '../services/DungeonStateManager.js';
import { captureError } from '../services/SentryService.js';
import { terminalState } from '../services/TerminalStateManager.js';
import type { CombatEvent, CombatSubmission } from '../types/dungeon.js';
import type { CommandContext, TerminalLine } from '../types/terminal.js';
import {
  AUTO_APPLY_EFFECTS,
  formatArchetypeBriefing,
  formatCombatPlanning,
  formatCombatResolution,
  formatCombatStalemate,
  formatCombatStart,
  formatDebrisFound,
  formatDungeonComplete,
  formatDungeonMap,
  formatDungeonStatus,
  formatEncounterChoices,
  formatLootDistribution,
  formatLootDrop,
  formatPartyWipe,
  formatRestResult,
  formatRetreatResult,
  formatRoomEntry,
  formatRoundTransition,
  formatSalvageResult,
  formatScoutResult,
  formatSealResult,
  formatSkillCheckResult,
  formatThresholdEntry,
} from './dungeon-formatters.js';
import { handleDungeonEnter } from './dungeon-entry-flow.js';
import { fuzzyMatch as fuzzyMatchEntities } from './fuzzy-search.js';
import { localized } from './locale-fields.js';
import {
  combatSystemLine,
  errorLine,
  formatInsufficientClearance,
  hintLine,
  responseLine,
  systemLine,
} from './terminal-formatters.js';

/** Fuzzy match a string against a list of names. Returns matched name or null. */
function fuzzyName(query: string, names: string[]): string | null {
  const entities = names.map((n) => ({ id: n, name: n }));
  const matches = fuzzyMatchEntities(query, entities);
  return matches.length > 0 ? matches[0].name : null;
}

// ── Dungeon-Mode Verb Sets & Clearance ───────────────────────────────────────

/**
 * Verbs that OVERRIDE standard commands when in dungeon mode.
 * Outside dungeon mode → return null → fall through to standard COMMAND_REGISTRY.
 * NOTE: 'go' is here because SYNONYM_MAP resolves 'move' → 'go' before dispatcher.
 */
const DUNGEON_OVERRIDE_VERBS = new Set(['move', 'go', 'map', 'look', 'status']);

/**
 * Verbs that ONLY work in dungeon mode. No standard equivalent.
 * Outside dungeon mode → return error message (not null).
 */
const DUNGEON_ONLY_VERBS = new Set([
  'scout',
  'rest',
  'retreat',
  'interact',
  'attack',
  'submit',
  'assign',
  'confirm',
  'protocol',
  'seal',
  'salvage',
  'dive',
]);

/**
 * Required clearance tier per dungeon verb.
 * Tier 1: basic navigation (move/go, map, look, status) — same as zone nav.
 * Tier 2: dungeon-specific actions (dungeon, scout, rest, retreat, interact, attack, submit).
 */
const DUNGEON_VERB_TIER: Record<string, number> = {
  move: 1,
  go: 1,
  map: 1,
  look: 1,
  status: 1,
  dungeon: 2,
  scout: 2,
  rest: 2,
  retreat: 2,
  interact: 2,
  attack: 2,
  submit: 2,
  assign: 2,
  confirm: 2,
  seal: 2,
  salvage: 2,
  dive: 2,
};

/** Verbs that don't trigger their own dramatic SFX — get command-confirm instead. */
const QUIET_VERBS = new Set(['map', 'look', 'status', 'attack', 'assign', 'protocol', 'confirm']);

// ── Main Dispatcher ──────────────────────────────────────────────────────────

/**
 * Dispatch a dungeon-mode command. Called by parseAndExecute before registry lookup.
 *
 * Returns:
 * - TerminalLine[] if handled (command executed or error shown)
 * - null if the verb should fall through to the standard COMMAND_REGISTRY
 *
 * Three verb categories:
 * 1. 'dungeon' — always handled (in/out of dungeon mode)
 * 2. DUNGEON_OVERRIDE_VERBS — handled only when isDungeonMode, else null (fall through)
 * 3. DUNGEON_ONLY_VERBS — handled when isDungeonMode, else return error (no fall through)
 */
export async function dispatchDungeonCommand(
  verb: string,
  _args: string[],
  ctx: CommandContext,
): Promise<TerminalLine[] | null> {
  // Clearance check for dungeon verbs.
  // Three admin-configured modes (platform_settings):
  //   off:      bypass entirely — all dungeon commands available immediately.
  //   standard: tier 2 after 10 commands (default CLEARANCE_THRESHOLDS).
  //   custom:   tier 2 after N commands (only for dungeon verbs, not general tier).
  const requiredTier = DUNGEON_VERB_TIER[verb];
  if (requiredTier !== undefined && !terminalState.dungeonClearanceBypass.value) {
    const clearance = terminalState.effectiveClearance.value;
    // Custom threshold: check command count directly instead of tier level.
    // This avoids polluting the general tier-2 progression (fortify, quarantine, etc.).
    const customThreshold = terminalState.dungeonClearanceThreshold.value;
    const commandCount = terminalState.commandCount.value;
    if (customThreshold !== null && requiredTier === 2) {
      if (clearance < 2 && commandCount < customThreshold) {
        return formatInsufficientClearance(verb, requiredTier, commandCount, customThreshold);
      }
    } else if (clearance < requiredTier) {
      return formatInsufficientClearance(verb, requiredTier);
    }
  }

  // `dungeon` command works in and out of dungeon mode
  if (verb === 'dungeon') {
    return handleDungeonEnter(ctx);
  }

  // Dungeon-only verbs: return error outside dungeon mode (no fall-through)
  if (DUNGEON_ONLY_VERBS.has(verb) && !terminalState.isDungeonMode.value) {
    return [errorLine(msg('Not in a dungeon. Type "dungeon" to enter one.'))];
  }

  // Override verbs: only intercept when in dungeon mode, else fall through
  if (!terminalState.isDungeonMode.value) return null;
  if (!DUNGEON_OVERRIDE_VERBS.has(verb) && !DUNGEON_ONLY_VERBS.has(verb)) return null;

  // Dispatch command and play confirm/error SFX for "quiet" verbs.
  // Commands with dramatic SFX (move, submit, rest, scout, etc.) play their own sounds.
  const result = await _dispatchVerb(verb, ctx);
  if (result !== null && result.length > 0) {
    const hasError = result.some((l) => l.type === 'error');
    if (hasError) {
      dungeonAudio.play('command-error');
    } else if (QUIET_VERBS.has(verb)) {
      dungeonAudio.play('command-confirm');
    }
  }
  return result;
}

/** Internal verb dispatch — extracted so the main dispatcher can inspect the result for SFX. */
async function _dispatchVerb(verb: string, ctx: CommandContext): Promise<TerminalLine[] | null> {
  switch (verb) {
    case 'move':
    case 'go':
      return handleDungeonMove(ctx);
    case 'map':
      return handleDungeonMap();
    case 'look':
      return handleDungeonLook();
    case 'status':
      return handleDungeonStatus();
    case 'scout':
      return handleDungeonScout(ctx);
    case 'rest':
      return handleDungeonRest();
    case 'retreat':
      return handleDungeonRetreat();
    case 'interact':
      return handleDungeonInteract(ctx);
    case 'attack':
      return handleDungeonAttack(ctx);
    case 'submit':
      return handleDungeonSubmit();
    case 'assign':
      return handleDungeonAssign(ctx);
    case 'confirm':
      return handleDungeonConfirm();
    case 'protocol':
      return handleDungeonProtocol();
    case 'seal':
      return handleDungeonSeal(ctx);
    case 'salvage':
    case 'dive':
      return handleDungeonSalvage(ctx);
    default:
      return null;
  }
}

// Re-export startDungeonRun for external consumers (DungeonTerminalView deep-link)
export { startDungeonRun } from './dungeon-entry-flow.js';

// ── Command: move ────────────────────────────────────────────────────────────

async function handleDungeonMove(ctx: CommandContext): Promise<TerminalLine[]> {
  const state = dungeonState.clientState.value;
  const runId = dungeonState.runId.value;
  if (!state || !runId) return [errorLine(msg('No active dungeon.'))];

  if (ctx.args.length === 0) {
    // Show adjacent rooms
    const adjacent = dungeonState.adjacentRooms.value;
    if (adjacent.length === 0) {
      return [systemLine(msg('No adjacent rooms revealed. Try "scout".'))];
    }
    const lines: TerminalLine[] = [systemLine(msg('Adjacent rooms:'))];
    for (const room of adjacent) {
      const typeStr = room.room_type === '?' ? msg('Unknown') : room.room_type;
      const clearedStr = room.cleared ? ` [${msg('cleared')}]` : '';
      lines.push(
        responseLine(`  [${room.index}] ${typeStr} (${msg('depth')} ${room.depth})${clearedStr}`),
      );
    }
    lines.push(hintLine(msg('Type "move <number>" to move to a room.')));
    return lines;
  }

  // Parse room index
  const roomIndex = parseInt(ctx.args[0], 10);
  if (Number.isNaN(roomIndex)) {
    return [errorLine(msg('Invalid room number. Use "move <number>".'))];
  }

  // Validate: is this room adjacent?
  const adjacent = dungeonState.adjacentRooms.value;
  if (!adjacent.some((r) => r.index === roomIndex)) {
    return [errorLine(msg('Cannot reach that room. Move to an adjacent room.'))];
  }

  dungeonState.loading.value = true;
  try {
    const resp = await dungeonApi.moveToRoom(runId, roomIndex);
    if (!resp.success || !resp.data) {
      return [errorLine(resp.error?.message ?? msg('Move failed.'))];
    }

    const result = resp.data;
    dungeonState.applyState(result.state);

    const lines: TerminalLine[] = [];

    // Room entry formatting
    const room = result.state.rooms.find((r) => r.index === result.state.current_room);
    if (room) {
      // SFX: boss reveal vs. normal room enter
      if (room.room_type === 'boss') {
        dungeonAudio.play('boss-reveal');
      } else {
        dungeonAudio.play('room-enter');
      }
      lines.push(
        ...formatRoomEntry(
          room,
          result.banter ? localized(result.banter, 'text') || null : null,
          result.state.archetype_state,
          result.anchor_texts ?? null,
          result.barometer_text ? localized(result.barometer_text, 'text') || null : null,
        ),
      );
    }

    // Debris deposited by the current (Deluge)
    if (result.debris) {
      lines.push(...formatDebrisFound(result.debris));
    }

    // Combat start
    if (result.combat && result.state.combat) {
      dungeonAudio.play('combat-start');
      lines.push(...formatCombatStart(result.state.combat));
      lines.push(...formatCombatPlanning(result.state.party));
    }

    // Threshold toll room — sparse, literary rendering
    if (result.threshold && result.choices) {
      dungeonState.encounterChoices.value = result.choices;
      const thresholdDesc = localized(result, 'description');
      lines.push(...formatThresholdEntry(thresholdDesc, result.choices));
    }

    // Encounter / treasure / rest choices (any room with interactive choices)
    else {
      const encounterDesc = localized(result, 'description');
      if (result.choices && encounterDesc) {
        dungeonState.encounterChoices.value = result.choices;
        lines.push(...formatEncounterChoices(encounterDesc, result.choices, result.state.party));
      } else if (result.encounter === false) {
        // No matching encounter template found — room auto-cleared
        lines.push(responseLine(msg('The room is empty. Whatever was here has moved on.')));
      }
    }

    // Treasure (auto-loot, no choices)
    if (result.treasure && result.auto_loot && result.loot && result.loot.length > 0) {
      dungeonAudio.play('loot-found');
      lines.push(...formatLootDrop(result.loot));
    }

    // Exit available
    if (result.exit_available) {
      lines.push(hintLine(msg('Exit available. Type "retreat" to leave with your loot.')));
    }

    // Check for completion/wipe
    if (result.state.phase === 'completed') {
      dungeonAudio.play('victory');
      lines.push(...formatDungeonComplete(result.state, result.loot ?? []));
      _exitDungeon();
    } else if (result.state.phase === 'wiped') {
      dungeonAudio.play('defeat');
      lines.push(...formatPartyWipe());
      _exitDungeon();
    }

    return lines;
  } catch (err) {
    captureError(err, { source: 'dungeon-commands.handleDungeonMove' });
    const message = err instanceof Error ? err.message : msg('Move failed.');
    return [errorLine(message)];
  } finally {
    dungeonState.loading.value = false;
  }
}

// ── Command: map ─────────────────────────────────────────────────────────────

function handleDungeonMap(): TerminalLine[] {
  const state = dungeonState.clientState.value;
  if (!state) return [errorLine(msg('No active dungeon.'))];
  return formatDungeonMap(state);
}

// ── Command: look ────────────────────────────────────────────────────────────

function handleDungeonLook(): TerminalLine[] {
  const state = dungeonState.clientState.value;
  if (!state) return [errorLine(msg('No active dungeon.'))];

  const room = dungeonState.currentRoom.value;
  if (!room) return [errorLine(msg('Current room unknown.'))];

  const lines = formatRoomEntry(room, null, state.archetype_state);

  // Re-display encounter/threshold choices
  const choices = dungeonState.encounterChoices.value;
  if (state.phase === 'threshold' && choices.length > 0) {
    const desc = localized(state, 'encounter_description');
    lines.push(...formatThresholdEntry(desc, choices));
  } else if ((state.phase === 'encounter' || state.phase === 'rest') && choices.length > 0) {
    const desc = localized(state, 'encounter_description');
    lines.push(...formatEncounterChoices(desc, choices, state.party));
  }

  return lines;
}

// ── Command: status ──────────────────────────────────────────────────────────

function handleDungeonStatus(): TerminalLine[] {
  const state = dungeonState.clientState.value;
  if (!state) return [errorLine(msg('No active dungeon.'))];
  return formatDungeonStatus(state);
}

// ── Command: protocol ────────────────────────────────────────────────────────

function handleDungeonProtocol(): TerminalLine[] {
  const state = dungeonState.clientState.value;
  if (!state) return [errorLine(msg('No active dungeon.'))];
  return formatArchetypeBriefing(state.archetype);
}

// ── Command: scout ───────────────────────────────────────────────────────────

async function handleDungeonScout(ctx: CommandContext): Promise<TerminalLine[]> {
  const state = dungeonState.clientState.value;
  const runId = dungeonState.runId.value;
  if (!state || !runId) return [errorLine(msg('No active dungeon.'))];

  // Find the best spy agent (or specified agent)
  const party = dungeonState.party.value.filter((a) => a.condition !== 'captured');
  if (party.length === 0) return [errorLine(msg('No agents available.'))];

  let agent = party[0];
  if (ctx.args.length > 0) {
    const agentName = ctx.args.join(' ');
    const names = party.map((a) => a.agent_name);
    const matched = fuzzyName(agentName, names);
    if (matched) {
      agent = party.find((a) => a.agent_name === matched) ?? agent;
    } else {
      return [errorLine(`${msg('Unknown agent')}: ${agentName}`)];
    }
  } else {
    // Auto-select highest spy aptitude
    agent = party.reduce((best, a) =>
      (a.aptitudes.spy ?? 0) > (best.aptitudes.spy ?? 0) ? a : best,
    );
  }

  dungeonState.loading.value = true;
  try {
    const resp = await dungeonApi.scout(runId, agent.agent_id);
    if (!resp.success || !resp.data) {
      return [errorLine(resp.error?.message ?? msg('Scout failed.'))];
    }

    dungeonState.applyState(resp.data.state);
    dungeonAudio.play('map-node-reveal');
    const archetype = dungeonState.clientState.value?.archetype ?? '';
    return formatScoutResult(
      agent.agent_name,
      resp.data.revealed_rooms,
      resp.data.visibility,
      archetype,
    );
  } catch (err) {
    captureError(err, { source: 'dungeon-commands.handleDungeonScout' });
    const message = err instanceof Error ? err.message : msg('Scout failed.');
    return [errorLine(message)];
  } finally {
    dungeonState.loading.value = false;
  }
}

// ── Command: rest ────────────────────────────────────────────────────────────

async function handleDungeonRest(): Promise<TerminalLine[]> {
  const state = dungeonState.clientState.value;
  const runId = dungeonState.runId.value;
  if (!state || !runId) return [errorLine(msg('No active dungeon.'))];

  // Validate: current room is a rest site
  const currentRoom = dungeonState.currentRoom.value;
  if (!currentRoom || currentRoom.room_type !== 'rest') {
    return [errorLine(msg('Not at a rest site.'))];
  }

  // Rest all non-captured agents
  const restAgents = dungeonState.party.value
    .filter((a) => a.condition !== 'captured')
    .map((a) => a.agent_id);

  if (restAgents.length === 0) return [errorLine(msg('No agents available to rest.'))];

  dungeonState.loading.value = true;
  try {
    const resp = await dungeonApi.rest(runId, restAgents);
    if (!resp.success || !resp.data) {
      return [errorLine(resp.error?.message ?? msg('Rest failed.'))];
    }

    dungeonState.applyState(resp.data.state);
    if (resp.data.healed) dungeonAudio.play('healing');
    const lines = formatRestResult(resp.data.healed, resp.data.ambushed);

    // If ambushed, combat starts
    if (resp.data.ambushed && resp.data.state.combat) {
      dungeonAudio.play('combat-start');
      lines.push(...formatCombatStart(resp.data.state.combat));
      lines.push(...formatCombatPlanning(resp.data.state.party));
    }

    return lines;
  } catch (err) {
    captureError(err, { source: 'dungeon-commands.handleDungeonRest' });
    const message = err instanceof Error ? err.message : msg('Rest failed.');
    return [errorLine(message)];
  } finally {
    dungeonState.loading.value = false;
  }
}

// ── Command: retreat ─────────────────────────────────────────────────────────

async function handleDungeonRetreat(): Promise<TerminalLine[]> {
  const runId = dungeonState.runId.value;
  if (!runId) return [errorLine(msg('No active dungeon.'))];

  dungeonState.loading.value = true;
  try {
    const resp = await dungeonApi.retreat(runId);
    if (!resp.success || !resp.data) {
      return [errorLine(resp.error?.message ?? msg('Retreat failed.'))];
    }

    const lines = formatRetreatResult(resp.data.loot);
    if (resp.data.rpc_failed) {
      lines.push(
        errorLine(
          resp.data.rpc_error_message ??
            msg('Failed to save retreat. Progress will be recovered on next visit.'),
        ),
      );
    }
    _exitDungeon();
    return lines;
  } catch (err) {
    captureError(err, { source: 'dungeon-commands.handleDungeonRetreat' });
    const message = err instanceof Error ? err.message : msg('Retreat failed.');
    return [errorLine(message)];
  } finally {
    dungeonState.loading.value = false;
  }
}

// ── Command: assign (loot distribution) ─────────────────────────────────────

async function handleDungeonAssign(ctx: CommandContext): Promise<TerminalLine[]> {
  const state = dungeonState.clientState.value;
  const runId = dungeonState.runId.value;
  if (!state || !runId) return [errorLine(msg('No active dungeon.'))];

  if (state.phase !== 'distributing') {
    return [errorLine(msg('Not in distribution phase.'))];
  }

  if (ctx.args.length < 2) {
    return [hintLine(msg('Usage: assign <item#> <agent_name>'))];
  }

  const itemNum = parseInt(ctx.args[0], 10);
  const agentNameInput = ctx.args.slice(1).join(' ').toLowerCase();

  // Find the distributable items (same filter as formatter)
  const autoEffects = AUTO_APPLY_EFFECTS;
  const distributable = (state.pending_loot ?? []).filter((i) => !autoEffects.has(i.effect_type));

  if (Number.isNaN(itemNum) || itemNum < 1 || itemNum > distributable.length) {
    return [errorLine(msg('Invalid item number.'))];
  }

  const lootItem = distributable[itemNum - 1];

  // Fuzzy match agent name (same pattern as attack/encounter commands)
  const operationalNames = state.party
    .filter((a) => a.condition !== 'captured')
    .map((a) => a.agent_name);
  const matchedName = fuzzyName(agentNameInput, operationalNames);
  if (!matchedName) {
    return [errorLine(msg('Agent not found or captured.'))];
  }
  const agent = state.party.find((a) => a.agent_name === matchedName)!;

  try {
    const resp = await dungeonApi.assignLoot(runId, {
      loot_id: lootItem.id,
      agent_id: agent.agent_id,
    });
    if (!resp.success || !resp.data) {
      return [errorLine(resp.error?.message ?? msg('Assignment failed.'))];
    }

    dungeonState.applyState(resp.data.state);

    // Re-render distribution screen with updated assignments
    return formatLootDistribution(
      resp.data.state,
      state.pending_loot ?? [],
      resp.data.state.loot_assignments ?? {},
      resp.data.state.loot_suggestions ?? {},
    );
  } catch (err) {
    captureError(err, { source: 'dungeon-commands.handleDungeonAssign' });
    const message = err instanceof Error ? err.message : msg('Assignment failed.');
    return [errorLine(message)];
  }
}

// ── Command: confirm (finalize distribution) ────────────────────────────────

async function handleDungeonConfirm(): Promise<TerminalLine[]> {
  const state = dungeonState.clientState.value;
  const runId = dungeonState.runId.value;
  if (!state || !runId) return [errorLine(msg('No active dungeon.'))];

  if (state.phase !== 'distributing') {
    return [errorLine(msg('Not in distribution phase.'))];
  }

  // Check all distributable items are assigned
  const autoEffects = AUTO_APPLY_EFFECTS;
  const distributable = (state.pending_loot ?? []).filter((i) => !autoEffects.has(i.effect_type));
  const assignments = state.loot_assignments ?? {};
  const unassigned = distributable.filter((i) => !assignments[i.id]);
  if (unassigned.length > 0) {
    return [errorLine(msg('Not all items assigned. Use "assign" first.'))];
  }

  dungeonState.loading.value = true;
  try {
    const resp = await dungeonApi.confirmDistribution(runId);
    if (!resp.success || !resp.data) {
      return [errorLine(resp.error?.message ?? msg('Confirmation failed.'))];
    }

    // Capture loot BEFORE applying new state (completed state may clear pending_loot)
    const loot = state.pending_loot ?? [];
    dungeonState.applyState(resp.data.state);

    // Show completion banner + exit
    const lines = formatDungeonComplete(resp.data.state, loot);
    _exitDungeon();
    return lines;
  } catch (err) {
    captureError(err, { source: 'dungeon-commands.handleDungeonConfirm' });
    const message = err instanceof Error ? err.message : msg('Confirmation failed.');
    return [errorLine(message)];
  } finally {
    dungeonState.loading.value = false;
  }
}

// ── Command: interact ────────────────────────────────────────────────────────

async function handleDungeonInteract(ctx: CommandContext): Promise<TerminalLine[]> {
  const state = dungeonState.clientState.value;
  const runId = dungeonState.runId.value;
  if (!state || !runId) return [errorLine(msg('No active dungeon.'))];

  if (state.phase !== 'encounter' && state.phase !== 'rest' && state.phase !== 'threshold') {
    return [errorLine(msg('No active encounter.'))];
  }

  if (ctx.args.length === 0) {
    return [hintLine(msg('Type "interact <number>" to choose an option.'))];
  }

  // Map number → actual choice ID from stored encounter choices
  const choices = dungeonState.encounterChoices.value;
  const choiceIndex = parseInt(ctx.args[0], 10);
  if (choices.length === 0) {
    return [errorLine(msg('No encounter choices available. Try "look" first.'))];
  }
  if (Number.isNaN(choiceIndex) || choiceIndex < 1 || choiceIndex > choices.length) {
    return [errorLine(`${msg('Invalid choice')}. ${msg('Choose')} 1-${choices.length}.`)];
  }
  const choice = choices[choiceIndex - 1];

  // Auto-select best agent for skill check (if check_aptitude specified)
  let agentId: string | undefined;
  if (choice.check_aptitude) {
    const party = dungeonState.party.value;
    const candidates = party
      .filter((a) => a.condition !== 'captured')
      .sort(
        (a, b) =>
          (b.aptitudes[choice.check_aptitude!] ?? 0) - (a.aptitudes[choice.check_aptitude!] ?? 0),
      );
    agentId = candidates[0]?.agent_id;
  }

  dungeonState.loading.value = true;
  try {
    const resp = await dungeonApi.submitAction(runId, {
      action_type: 'encounter_choice',
      choice_id: choice.id,
      agent_id: agentId,
    });

    if (!resp.success || !resp.data) {
      return [errorLine(resp.error?.message ?? msg('Interaction failed.'))];
    }

    dungeonState.applyState(resp.data.state);
    const lines: TerminalLine[] = [];

    // Skill check result
    if (resp.data.check) {
      // Use backend-generated narrative effects (bilingual, proper separation of concerns)
      const effects: string[] =
        (localized(resp.data, 'narrative_effects') as unknown as string[]) ??
        Object.entries(resp.data.effects).map(([key, val]: [string, unknown]) => `${key}: ${val}`);
      lines.push(
        ...formatSkillCheckResult(resp.data.check, localized(resp.data, 'narrative'), effects),
      );
    } else {
      // No check — direct result
      const narrative = localized(resp.data, 'narrative');
      if (narrative) {
        lines.push(responseLine(narrative));
      }
    }

    // Boss deployment loop: re-render updated choices if still in encounter phase
    if (resp.data.state.phase === 'encounter' && resp.data.state.encounter_choices?.length) {
      dungeonState.encounterChoices.value = resp.data.state.encounter_choices;
      const desc = localized(resp.data.state, 'encounter_description');
      if (desc) {
        lines.push(
          ...formatEncounterChoices(desc, resp.data.state.encounter_choices, resp.data.state.party),
        );
      }
    }

    // Boss deployment → combat transition
    if (resp.data.combat && resp.data.state.phase === 'combat_planning' && resp.data.state.combat) {
      dungeonAudio.play('combat-start');
      lines.push(...formatCombatStart(resp.data.state.combat));
      lines.push(...formatCombatPlanning(resp.data.state.party));
    }

    // Check for completion/wipe after encounter
    if (resp.data.state.phase === 'completed') {
      dungeonAudio.play('victory');
      lines.push(...formatDungeonComplete(resp.data.state, []));
      _exitDungeon();
    } else if (resp.data.state.phase === 'wiped') {
      dungeonAudio.play('defeat');
      lines.push(...formatPartyWipe());
      _exitDungeon();
    }

    return lines;
  } catch (err) {
    captureError(err, { source: 'dungeon-commands.handleDungeonInteract' });
    const message = err instanceof Error ? err.message : msg('Interaction failed.');
    return [errorLine(message)];
  } finally {
    dungeonState.loading.value = false;
  }
}

// ── Command: attack ──────────────────────────────────────────────────────────

function handleDungeonAttack(ctx: CommandContext): TerminalLine[] {
  const state = dungeonState.clientState.value;
  if (!state) return [errorLine(msg('No active dungeon.'))];

  if (state.phase !== 'combat_planning') {
    return [errorLine(msg('Not in combat planning phase.'))];
  }

  // Syntax: attack <agent> <ability> [target]
  if (ctx.args.length < 2) {
    return [
      errorLine(msg('Usage: attack <agent> <ability> [target]')),
      hintLine(msg('Example: attack Kovacs observe')),
    ];
  }

  const party = dungeonState.party.value.filter(
    (a) => a.condition !== 'captured' && a.available_abilities.length > 0,
  );

  // Fuzzy match agent
  const agentName = ctx.args[0];
  const agentNames = party.map((a) => a.agent_name);
  const matchedAgent = fuzzyName(agentName, agentNames);

  if (!matchedAgent) {
    return [errorLine(`${msg('Unknown agent')}: ${agentName}`)];
  }

  const agent = party.find((a) => a.agent_name === matchedAgent)!;

  // Fuzzy match ability
  const abilityArg = ctx.args[1].toLowerCase();
  const abilityNames = agent.available_abilities
    .filter((a) => a.cooldown_remaining === 0)
    .map((a) => localized(a, 'name'));
  const matchedAbility = fuzzyName(abilityArg, abilityNames);

  if (!matchedAbility) {
    return [errorLine(`${msg('Unknown or unavailable ability')}: ${abilityArg}`)];
  }

  const ability = agent.available_abilities.find((a) => localized(a, 'name') === matchedAbility)!;

  // Optional target (enemy)
  const targetArg = ctx.args.length > 2 ? ctx.args.slice(2).join(' ') : undefined;
  let targetId: string | undefined;

  if (targetArg && state.combat) {
    const enemyNames = state.combat.enemies
      .filter((e) => e.is_alive)
      .map((e) => localized(e, 'name'));
    const matchedEnemy = fuzzyName(targetArg, enemyNames);
    if (matchedEnemy) {
      const enemy = state.combat.enemies.find((e) => localized(e, 'name') === matchedEnemy);
      targetId = enemy?.instance_id;
    }
  }

  // Register selection
  dungeonState.selectAction(agent.agent_id, ability.id, targetId);

  const lines: TerminalLine[] = [
    systemLine(`${matchedAgent} \u2192 ${matchedAbility}${targetId ? ` \u2192 ${targetArg}` : ''}`),
  ];

  // Show selection summary
  const selected = dungeonState.selectedActions.value;
  const totalNeeded = party.length;
  lines.push(hintLine(`${msg('Actions selected')}: ${selected.size}/${totalNeeded}`));

  if (dungeonState.allActionsSelected.value) {
    lines.push(hintLine(msg('All actions selected. Type "submit" to execute.')));
  }

  return lines;
}

// ── Command: submit ──────────────────────────────────────────────────────────

async function handleDungeonSubmit(): Promise<TerminalLine[]> {
  const state = dungeonState.clientState.value;
  const runId = dungeonState.runId.value;
  if (!state || !runId) return [errorLine(msg('No active dungeon.'))];

  if (state.phase !== 'combat_planning') {
    return [hintLine(msg('No combat in progress. Use "move" to continue exploring.'))];
  }

  const selected = dungeonState.selectedActions.value;
  if (selected.size === 0) {
    return [errorLine(msg('No actions selected. Use "attack <agent> <ability>" first.'))];
  }

  const submission: CombatSubmission = {
    actions: Array.from(selected.values()),
  };

  dungeonState.combatSubmitting.value = true;
  try {
    const resp = await dungeonApi.submitCombat(runId, submission);
    if (!resp.success || !resp.data) {
      return [errorLine(resp.error?.message ?? msg('Submission failed.'))];
    }

    dungeonState.applyState(resp.data.state);
    const lines: TerminalLine[] = [];

    if (resp.data.waiting_for_players) {
      lines.push(systemLine(msg('Actions submitted. Waiting for other players...')));
    }

    // Round resolved
    if (resp.data.round_result) {
      const partyNames = dungeonState.party.value.map((a) => a.agent_name);
      // SFX: play dominant combat sound from round events
      _playCombatRoundSfx(resp.data.round_result.events, new Set(partyNames));
      lines.push(...formatCombatResolution(resp.data.round_result, partyNames));

      // Victory → show loot
      if (resp.data.round_result.victory && resp.data.state.phase === 'room_clear') {
        dungeonAudio.play('victory');
        lines.push(combatSystemLine(msg('VICTORY \u2014 ROOM CLEARED')));
        if (resp.data.loot && resp.data.loot.length > 0) {
          dungeonAudio.play('loot-found');
          lines.push(...formatLootDrop(resp.data.loot));
        }
      }

      // Wipe
      if (resp.data.round_result.wipe) {
        dungeonAudio.play('defeat');
        lines.push(...formatPartyWipe());
        if (resp.data.rpc_failed) {
          lines.push(
            errorLine(
              resp.data.rpc_error_message ??
                msg('Failed to save result. Progress will be recovered on next visit.'),
            ),
          );
        }
        _exitDungeon();
      }

      // Stalemate
      if (resp.data.round_result.stalemate) {
        lines.push(...formatCombatStalemate());
      }

      // Next round → visual break, then new round header + planning
      if (resp.data.state.phase === 'combat_planning' && resp.data.state.combat) {
        lines.push(...formatRoundTransition(resp.data.round_result.round));
        lines.push(...formatCombatStart(resp.data.state.combat));
        lines.push(...formatCombatPlanning(resp.data.state.party));
      }
    }

    // Check for distribution phase (boss victory with distributable loot)
    if (resp.data.state.phase === 'distributing') {
      dungeonAudio.play('loot-found');
      lines.push(
        ...formatLootDistribution(
          resp.data.state,
          resp.data.loot ?? [],
          resp.data.state.loot_assignments ?? {},
          resp.data.state.loot_suggestions ?? {},
        ),
      );
    }

    // Check for completion (boss victory — auto-complete path)
    if (resp.data.state.phase === 'completed') {
      dungeonAudio.play('victory');
      lines.push(...formatDungeonComplete(resp.data.state, resp.data.loot ?? []));
      _exitDungeon();
    }

    return lines;
  } catch (err) {
    captureError(err, { source: 'dungeon-commands.handleDungeonSubmit' });
    const message = err instanceof Error ? err.message : msg('Submission failed.');
    return [errorLine(message)];
  } finally {
    dungeonState.combatSubmitting.value = false;
  }
}

// ── Private: Exit Dungeon ────────────────────────────────────────────────────

// ── Command: seal (Deluge only) ─────────────────────────────────────────────

async function handleDungeonSeal(ctx: CommandContext): Promise<TerminalLine[]> {
  const state = dungeonState.clientState.value;
  const runId = dungeonState.runId.value;
  if (!state || !runId) return [errorLine(msg('No active dungeon.'))];

  if (state.archetype !== 'The Deluge') {
    return [errorLine(msg('Seal Breach is only available in Deluge dungeons.'))];
  }

  const party = dungeonState.party.value.filter((a) => a.condition !== 'captured');
  if (party.length === 0) return [errorLine(msg('No agents available.'))];

  let agent = party[0];
  if (ctx.args.length > 0) {
    const agentName = ctx.args.join(' ');
    const names = party.map((a) => a.agent_name);
    const matched = fuzzyName(agentName, names);
    if (matched) {
      agent = party.find((a) => a.agent_name === matched) ?? agent;
    } else {
      return [errorLine(`${msg('Unknown agent')}: ${agentName}`)];
    }
  } else {
    agent = party.reduce((best, a) =>
      (a.aptitudes.guardian ?? 0) > (best.aptitudes.guardian ?? 0) ? a : best,
    );
  }

  dungeonState.loading.value = true;
  try {
    const resp = await dungeonApi.seal(runId, agent.agent_id);
    if (!resp.success || !resp.data) {
      return [errorLine(resp.error?.message ?? msg('Seal Breach failed.'))];
    }

    dungeonState.applyState(resp.data.state);
    return formatSealResult(
      agent.agent_name,
      resp.data.water_level,
      resp.data.stress_cost,
      resp.data.cooldown_until_room,
    );
  } catch (err) {
    captureError(err, { source: 'dungeon-commands.handleDungeonSeal' });
    const message = err instanceof Error ? err.message : msg('Seal Breach failed.');
    return [errorLine(message)];
  } finally {
    dungeonState.loading.value = false;
  }
}

// ── Command: salvage / dive (Deluge only) ───────────────────────────────────

async function handleDungeonSalvage(ctx: CommandContext): Promise<TerminalLine[]> {
  const state = dungeonState.clientState.value;
  const runId = dungeonState.runId.value;
  if (!state || !runId) return [errorLine(msg('No active dungeon.'))];

  if (state.archetype !== 'The Deluge') {
    return [errorLine(msg('Salvage is only available in Deluge dungeons.'))];
  }

  if (ctx.args.length === 0) {
    return [
      errorLine(msg('Specify a room to salvage. Usage: salvage <room_index>')),
      hintLine(msg('Type "map" to see room indices.')),
    ];
  }

  const roomIndex = parseInt(ctx.args[0], 10);
  if (Number.isNaN(roomIndex)) {
    return [errorLine(msg('Invalid room number. Use "salvage <number>".'))];
  }

  const party = dungeonState.party.value.filter((a) => a.condition !== 'captured');
  if (party.length === 0) return [errorLine(msg('No agents available.'))];

  // Auto-select best guardian agent (primary salvage aptitude)
  const agent = party.reduce((best, a) =>
    (a.aptitudes.guardian ?? 0) > (best.aptitudes.guardian ?? 0) ? a : best,
  );

  dungeonState.loading.value = true;
  try {
    const resp = await dungeonApi.salvage(runId, agent.agent_id, roomIndex);
    if (!resp.success || !resp.data) {
      return [errorLine(resp.error?.message ?? msg('Salvage failed.'))];
    }

    dungeonState.applyState(resp.data.state);
    if (resp.data.success && resp.data.loot?.length) dungeonAudio.play('loot-found');
    return formatSalvageResult(
      agent.agent_name,
      roomIndex,
      resp.data.success,
      resp.data.check_result,
      resp.data.check_value,
      resp.data.loot ?? [],
      resp.data.water_penalty,
    );
  } catch (err) {
    captureError(err, { source: 'dungeon-commands.handleDungeonSalvage' });
    const message = err instanceof Error ? err.message : msg('Salvage failed.');
    return [errorLine(message)];
  } finally {
    dungeonState.loading.value = false;
  }
}

// ── Audio Helpers ───────────────────────────────────────────────────────────

/**
 * Play the dominant SFX for a combat round based on its events.
 * Priority: critical-hit > attack-hit > damage-taken > healing.
 * Only one SFX per round to avoid cacophony.
 */
function _playCombatRoundSfx(events: CombatEvent[], partyNames: Set<string>): void {
  let hasPartyHit = false;
  let hasCritical = false;
  let hasDamageTaken = false;
  let hasHealing = false;

  for (const e of events) {
    const isParty = partyNames.has(e.actor);
    if (isParty && e.hit && e.damage > 0) {
      hasPartyHit = true;
      if (e.damage >= 3) hasCritical = true;
    }
    if (!isParty && e.hit && (e.damage > 0 || e.stress > 0)) {
      hasDamageTaken = true;
    }
    if (e.stress < 0) hasHealing = true;
  }

  if (hasCritical) {
    dungeonAudio.play('critical-hit');
  } else if (hasPartyHit) {
    dungeonAudio.play('attack-hit');
  } else if (hasDamageTaken) {
    dungeonAudio.play('damage-taken');
  } else if (hasHealing) {
    dungeonAudio.play('healing');
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function _exitDungeon(): void {
  terminalState.clearDungeon();
  dungeonState.clear();
}

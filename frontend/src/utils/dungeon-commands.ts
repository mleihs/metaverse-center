/**
 * Resonance Dungeons — Terminal command handlers.
 *
 * Dispatched by terminal-commands.ts when isDungeonMode is true.
 * Handlers import from DungeonStateManager (state) and DungeonApiService (API).
 * Formatters are pure functions from dungeon-formatters.ts.
 *
 * Pattern: terminal-commands.ts handlers (async, return TerminalLine[]).
 */

import { msg } from '@lit/localize';

import { appState } from '../services/AppStateManager.js';
import { dungeonApi } from '../services/api/DungeonApiService.js';
import { dungeonState } from '../services/DungeonStateManager.js';
import { captureError } from '../services/SentryService.js';
import { terminalState } from '../services/TerminalStateManager.js';
import type {
  CombatSubmission,
  DungeonRunCreate,
} from '../types/dungeon.js';
import type { CommandContext, TerminalLine } from '../types/terminal.js';
import {
  formatAgentPicker,
  formatAvailableDungeons,
  formatCombatPlanning,
  formatCombatResolution,
  formatCombatStalemate,
  formatCombatStart,
  formatDungeonComplete,
  formatDungeonEntry,
  formatDungeonMap,
  formatDungeonStatus,
  formatEncounterChoices,
  formatLootDrop,
  formatPartyWipe,
  formatRestResult,
  formatRetreatResult,
  formatRoomEntry,
  formatScoutResult,
  formatSkillCheckResult,
} from './dungeon-formatters.js';
import {
  systemLine, hintLine, errorLine, responseLine,
  formatInsufficientClearance,
} from './terminal-formatters.js';
import { fuzzyMatch as fuzzyMatchEntities } from './fuzzy-search.js';

/** Fuzzy match a string against a list of names. Returns matched name or null. */
function fuzzyName(query: string, names: string[]): string | null {
  const entities = names.map(n => ({ id: n, name: n }));
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
  'scout', 'rest', 'retreat', 'interact', 'attack', 'submit',
]);

/**
 * Required clearance tier per dungeon verb.
 * Tier 1: basic navigation (move/go, map, look, status) — same as zone nav.
 * Tier 2: dungeon-specific actions (dungeon, scout, rest, retreat, interact, attack, submit).
 */
const DUNGEON_VERB_TIER: Record<string, number> = {
  move: 1, go: 1, map: 1, look: 1, status: 1,
  dungeon: 2, scout: 2, rest: 2, retreat: 2,
  interact: 2, attack: 2, submit: 2,
};

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
  // Clearance check: respect the tier requirement for this verb
  const requiredTier = DUNGEON_VERB_TIER[verb];
  if (requiredTier !== undefined) {
    const clearance = terminalState.effectiveClearance.value;
    if (clearance < requiredTier) {
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

  switch (verb) {
    case 'move':
    case 'go': return handleDungeonMove(ctx);
    case 'map': return handleDungeonMap();
    case 'look': return handleDungeonLook();
    case 'status': return handleDungeonStatus();
    case 'scout': return handleDungeonScout(ctx);
    case 'rest': return handleDungeonRest();
    case 'retreat': return handleDungeonRetreat();
    case 'interact': return handleDungeonInteract(ctx);
    case 'attack': return handleDungeonAttack(ctx);
    case 'submit': return handleDungeonSubmit();
    default: return null;
  }
}

// ── Command: dungeon ─────────────────────────────────────────────────────────

async function handleDungeonEnter(ctx: CommandContext): Promise<TerminalLine[]> {
  const sid = ctx.simulationId || appState.simulationId.value;
  if (!sid) return [errorLine(msg('No simulation active.'))];

  // Already in a dungeon?
  if (dungeonState.isInDungeon.value) {
    return [
      systemLine(msg('Already in a dungeon.')),
      hintLine(msg('Type "status" for current state, "retreat" to leave.')),
    ];
  }

  // Load available dungeons
  await dungeonState.loadAvailable(sid);
  const available = dungeonState.availableDungeons.value;

  // No args → list available archetypes
  if (ctx.args.length === 0) {
    return formatAvailableDungeons(available);
  }

  // Parse archetype from first arg (fuzzy match against known names)
  const archetypeNames = available.map(d => d.archetype);
  const firstArg = ctx.args[0].toLowerCase();
  const matched = fuzzyName(firstArg, archetypeNames);

  if (!matched) {
    return [
      errorLine(msg('Unknown archetype.')),
      ...formatAvailableDungeons(available),
    ];
  }

  const selectedDungeon = available.find(d => d.archetype.toLowerCase() === matched.toLowerCase());
  if (!selectedDungeon || !selectedDungeon.available) {
    return [errorLine(msg('That dungeon is not available (cooldown active or no resonance).'))];
  }

  // Load agents for the picker (cached after first call)
  await dungeonState.loadPickerAgents(sid);
  if (dungeonState.error.value) {
    return [errorLine(msg('Failed to load agents. Try again.'))];
  }
  const agents = dungeonState.pickerAgents.value;
  const aptMap = dungeonState.pickerAptitudes.value;

  if (agents.length < 2) {
    return [errorLine(msg('Need at least 2 agents for a dungeon party. Recruit more agents first.'))];
  }

  // Remaining args after archetype determine action
  const selectionArgs = ctx.args.slice(1);

  // No selection args → show picker
  if (selectionArgs.length === 0) {
    return formatAgentPicker(agents, aptMap, matched);
  }

  // "auto" → smart-pick top 3 by aggregate aptitude score
  if (selectionArgs[0] === 'auto') {
    const scored = agents.map(a => {
      const apts = aptMap.get(a.id);
      const total = apts ? Object.values(apts).reduce((s, v) => s + v, 0) : 0;
      return { agent: a, score: total };
    });
    scored.sort((a, b) => b.score - a.score);
    const partyIds = scored.slice(0, 3).map(s => s.agent.id);
    return startDungeonRun(sid, {
      archetype: selectedDungeon.archetype as DungeonRunCreate['archetype'],
      party_agent_ids: partyIds,
      difficulty: selectedDungeon.suggested_difficulty,
    });
  }

  // Numeric args → indices into the agent list (1-based)
  const indices = selectionArgs.map(Number).filter(n => !isNaN(n) && n >= 1 && n <= agents.length);
  if (indices.length < 2) {
    return [
      errorLine(msg('Select 2\u20134 agents by number.')),
      ...formatAgentPicker(agents, aptMap, matched),
    ];
  }
  if (indices.length > 4) {
    return [errorLine(msg('Maximum 4 agents per party.'))];
  }

  // Map 1-based indices to agent IDs
  const partyIds = [...new Set(indices)].map(i => agents[i - 1].id);
  if (partyIds.length < 2) {
    return [errorLine(msg('Need at least 2 unique agents.'))];
  }

  return startDungeonRun(sid, {
    archetype: selectedDungeon.archetype as DungeonRunCreate['archetype'],
    party_agent_ids: partyIds,
    difficulty: selectedDungeon.suggested_difficulty,
  });
}

/**
 * Initialize dungeon mode after a run is created (called by external code
 * like DungeonTerminalView or a future agent selection flow).
 */
export async function startDungeonRun(
  simulationId: string,
  body: DungeonRunCreate,
): Promise<TerminalLine[]> {
  dungeonState.loading.value = true;
  try {
    const resp = await dungeonApi.createRun(simulationId, body);
    if (!resp.success || !resp.data) {
      return [errorLine(resp.error?.message ?? msg('Failed to create dungeon run.'))];
    }

    const { run, state } = resp.data;
    dungeonState.applyState(state);
    terminalState.initializeDungeon(String(run.id));

    // Atmosphere text from archetype config (placeholder for now)
    const atmosphereText = '';

    return formatDungeonEntry(state, atmosphereText);
  } catch (err) {
    captureError(err, { source: 'dungeon-commands.startDungeonRun' });
    const message = err instanceof Error ? err.message : msg('Failed to create dungeon run.');
    return [errorLine(message)];
  } finally {
    dungeonState.loading.value = false;
  }
}

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
      lines.push(responseLine(`  [${room.index}] ${typeStr} (${msg('depth')} ${room.depth})${clearedStr}`));
    }
    lines.push(hintLine(msg('Type "move <number>" to move to a room.')));
    return lines;
  }

  // Parse room index
  const roomIndex = parseInt(ctx.args[0], 10);
  if (isNaN(roomIndex)) {
    return [errorLine(msg('Invalid room number. Use "move <number>".'))];
  }

  // Validate: is this room adjacent?
  const adjacent = dungeonState.adjacentRooms.value;
  if (!adjacent.some(r => r.index === roomIndex)) {
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
    const room = result.state.rooms.find(r => r.index === result.state.current_room);
    if (room) {
      lines.push(
        ...formatRoomEntry(
          room,
          result.banter ? (result.banter.text_en ?? null) : null,
          result.state.archetype_state,
        ),
      );
    }

    // Combat start
    if (result.combat && result.state.combat) {
      lines.push(...formatCombatStart(result.state.combat));
      lines.push(...formatCombatPlanning(result.state.party));
    }

    // Encounter
    if (result.encounter && result.choices && result.description_en) {
      lines.push(...formatEncounterChoices(result.description_en, result.choices, result.state.party));
    }

    // Treasure (auto-loot)
    if (result.treasure && result.loot && result.loot.length > 0) {
      lines.push(...formatLootDrop(result.loot));
    }

    // Exit available
    if (result.exit_available) {
      lines.push(hintLine(msg('Exit available. Type "retreat" to leave with your loot.')));
    }

    // Check for completion/wipe
    if (result.state.phase === 'completed') {
      lines.push(...formatDungeonComplete(result.state, result.loot ?? []));
      _exitDungeon();
    } else if (result.state.phase === 'wiped') {
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

  return formatRoomEntry(room, null, state.archetype_state);
}

// ── Command: status ──────────────────────────────────────────────────────────

function handleDungeonStatus(): TerminalLine[] {
  const state = dungeonState.clientState.value;
  if (!state) return [errorLine(msg('No active dungeon.'))];
  return formatDungeonStatus(state);
}

// ── Command: scout ───────────────────────────────────────────────────────────

async function handleDungeonScout(ctx: CommandContext): Promise<TerminalLine[]> {
  const state = dungeonState.clientState.value;
  const runId = dungeonState.runId.value;
  if (!state || !runId) return [errorLine(msg('No active dungeon.'))];

  // Find the best spy agent (or specified agent)
  const party = dungeonState.party.value.filter(a => a.condition !== 'captured');
  if (party.length === 0) return [errorLine(msg('No agents available.'))];

  let agent = party[0];
  if (ctx.args.length > 0) {
    const agentName = ctx.args.join(' ');
    const names = party.map(a => a.agent_name);
    const matched = fuzzyName(agentName, names);
    if (matched) {
      agent = party.find(a => a.agent_name === matched) ?? agent;
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
    return formatScoutResult(agent.agent_name, resp.data.revealed_rooms, resp.data.visibility);
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
    .filter(a => a.condition !== 'captured')
    .map(a => a.agent_id);

  if (restAgents.length === 0) return [errorLine(msg('No agents available to rest.'))];

  dungeonState.loading.value = true;
  try {
    const resp = await dungeonApi.rest(runId, restAgents);
    if (!resp.success || !resp.data) {
      return [errorLine(resp.error?.message ?? msg('Rest failed.'))];
    }

    dungeonState.applyState(resp.data.state);
    const lines = formatRestResult(resp.data.healed, resp.data.ambushed);

    // If ambushed, combat starts
    if (resp.data.ambushed && resp.data.state.combat) {
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

// ── Command: interact ────────────────────────────────────────────────────────

async function handleDungeonInteract(ctx: CommandContext): Promise<TerminalLine[]> {
  const state = dungeonState.clientState.value;
  const runId = dungeonState.runId.value;
  if (!state || !runId) return [errorLine(msg('No active dungeon.'))];

  if (state.phase !== 'encounter') {
    return [errorLine(msg('No active encounter.'))];
  }

  if (ctx.args.length === 0) {
    return [hintLine(msg('Type "interact <number>" to choose an option.'))];
  }

  const choiceId = ctx.args[0];

  dungeonState.loading.value = true;
  try {
    const resp = await dungeonApi.submitAction(runId, {
      action_type: 'encounter_choice',
      choice_id: choiceId,
    });

    if (!resp.success || !resp.data) {
      return [errorLine(resp.error?.message ?? msg('Interaction failed.'))];
    }

    dungeonState.applyState(resp.data.state);
    const lines: TerminalLine[] = [];

    // Skill check result
    if (resp.data.check) {
      const effects = Object.entries(resp.data.effects)
        .map(([key, val]) => `${key}: ${val}`);
      lines.push(...formatSkillCheckResult(resp.data.check, resp.data.narrative_en, effects));
    } else {
      // No check — direct result
      if (resp.data.narrative_en) {
        lines.push(responseLine(resp.data.narrative_en));
      }
    }

    // Check for completion/wipe after encounter
    if (resp.data.state.phase === 'completed') {
      lines.push(...formatDungeonComplete(resp.data.state, []));
      _exitDungeon();
    } else if (resp.data.state.phase === 'wiped') {
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
    a => a.condition !== 'captured' && a.available_abilities.length > 0,
  );

  // Fuzzy match agent
  const agentName = ctx.args[0];
  const agentNames = party.map(a => a.agent_name);
  const matchedAgent = fuzzyName(agentName, agentNames);

  if (!matchedAgent) {
    return [errorLine(`${msg('Unknown agent')}: ${agentName}`)];
  }

  const agent = party.find(a => a.agent_name === matchedAgent)!;

  // Fuzzy match ability
  const abilityArg = ctx.args[1].toLowerCase();
  const abilityNames = agent.available_abilities
    .filter(a => a.cooldown_remaining === 0)
    .map(a => a.name);
  const matchedAbility = fuzzyName(abilityArg, abilityNames);

  if (!matchedAbility) {
    return [errorLine(`${msg('Unknown or unavailable ability')}: ${abilityArg}`)];
  }

  const ability = agent.available_abilities.find(a => a.name === matchedAbility)!;

  // Optional target (enemy)
  const targetArg = ctx.args.length > 2 ? ctx.args.slice(2).join(' ') : undefined;
  let targetId: string | undefined;

  if (targetArg && state.combat) {
    const enemyNames = state.combat.enemies.filter(e => e.is_alive).map(e => e.name_en);
    const matchedEnemy = fuzzyName(targetArg, enemyNames);
    if (matchedEnemy) {
      const enemy = state.combat.enemies.find(e => e.name_en === matchedEnemy);
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
    return [errorLine(msg('Not in combat planning phase.'))];
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
      lines.push(...formatCombatResolution(resp.data.round_result));

      // Victory → loot
      if (resp.data.round_result.victory && resp.data.state.phase === 'room_clear') {
        // Loot will be shown on next state update or separate endpoint
        lines.push(systemLine(msg('Combat won. Room cleared.')));
      }

      // Wipe
      if (resp.data.round_result.wipe) {
        lines.push(...formatPartyWipe());
        _exitDungeon();
      }

      // Stalemate
      if (resp.data.round_result.stalemate) {
        lines.push(...formatCombatStalemate());
      }

      // Next round → show planning again
      if (resp.data.state.phase === 'combat_planning' && resp.data.state.combat) {
        lines.push(...formatCombatStart(resp.data.state.combat));
        lines.push(...formatCombatPlanning(resp.data.state.party));
      }
    }

    // Check for completion
    if (resp.data.state.phase === 'completed') {
      lines.push(...formatDungeonComplete(resp.data.state, []));
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

function _exitDungeon(): void {
  terminalState.clearDungeon();
  dungeonState.clear();
}

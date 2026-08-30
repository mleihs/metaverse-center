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
import type { AgentCombatStateClient, CombatEvent, CombatSubmission } from '../types/dungeon.js';
import type { CommandContext, TerminalLine } from '../types/terminal.js';
import { handleDungeonEnter } from './dungeon-entry-flow.js';
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
  formatGroundResult,
  formatLootDistribution,
  formatLootDrop,
  formatPartyWipe,
  formatRallyResult,
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
import { describeRoom } from './dungeon-room-text.js';
import { fuzzyName, resolveToken } from './fuzzy-search.js';
import { localized, localizedArray } from './locale-fields.js';
import {
  combatSystemLine,
  errorLine,
  formatInsufficientClearance,
  hintLine,
  responseLine,
  systemLine,
} from './terminal-formatters.js';

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
  'ground',
  'rally',
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
  ground: 2,
  rally: 2,
  salvage: 2,
  dive: 2,
  // `protocol` was dispatched (see the switch below) but missing here, and the
  // gate reads `if (requiredTier !== undefined)` — so a verb absent from this
  // table skips the clearance check entirely rather than defaulting to a tier.
  // It was freely usable at clearance 0 (Befund D18).
  // `lint-dungeon-verbs-gated.sh` keeps the two lists in step from now on.
  protocol: 2,
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

  // Bare number shortcut: contextually dispatch to interact or move.
  // Uses the same SFX-aware dispatch pattern as named verbs below.
  if (/^\d+$/.test(verb)) {
    const phase = dungeonState.phase.value;
    let numberResult: TerminalLine[] | null = null;
    if (phase === 'encounter' || phase === 'rest' || phase === 'threshold') {
      numberResult = await _runVerb(() => handleDungeonInteract({ ...ctx, args: [verb] }));
    } else if (phase === 'exploring' || phase === 'room_clear') {
      numberResult = await _runVerb(() => handleDungeonMove({ ...ctx, args: [verb] }));
    }
    if (numberResult !== null) {
      if (numberResult.some((l) => l.type === 'error')) {
        dungeonAudio.play('command-error');
      }
      return numberResult;
    }
  }

  if (!DUNGEON_OVERRIDE_VERBS.has(verb) && !DUNGEON_ONLY_VERBS.has(verb)) return null;

  // Dispatch command and play confirm/error SFX for "quiet" verbs.
  // Commands with dramatic SFX (move, submit, rest, scout, etc.) play their own sounds.
  const result = await _runVerb(() => _dispatchVerb(verb, ctx));
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

/**
 * Hold the busy flag for the whole of one dungeon verb.
 *
 * This used to be ten copies of the same three lines — every handler that
 * talked to the API opened with `dungeonState.loading.value = true` and closed
 * with a `finally` that cleared it. Ten copies of a flag is ten chances to add
 * an eleventh handler without one, and that is precisely what went wrong: the
 * flag was set faithfully everywhere and READ by nobody in the action bar, so
 * a second click landed while the first request was still in flight. The
 * client's phase had not been updated yet, the button was still live, and the
 * engine answered the second request with "Not in encounter phase".
 *
 * One seam instead of ten: every verb passes through here, so a new handler is
 * covered by existing, and the action bar has a single flag to gate on.
 *
 * It wraps the WHOLE verb, not just its network call. A purely local verb like
 * `map` therefore holds the flag for a fraction of a millisecond, which is
 * correct rather than merely harmless — "a command is running" is the property
 * the interface needs, and it is not the same property as "a request is open".
 */
async function _runVerb(run: () => Promise<TerminalLine[] | null>): Promise<TerminalLine[] | null> {
  dungeonState.loading.value = true;
  try {
    return await run();
  } finally {
    dungeonState.loading.value = false;
  }
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
    case 'ground':
      return handleDungeonGround(ctx);
    case 'rally':
      return handleDungeonRally(ctx);
    case 'salvage':
    case 'dive':
      return handleDungeonSalvage(ctx);
    default:
      return null;
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

    // ONE derivation of the room's prose, consumed by both surfaces: the
    // terminal renders it as lines below, the graphical scene reads the very
    // same object off `lastRoomDescription`. Publishing a hand-picked subset
    // here is what made encounter prose and anchor objects invisible in
    // graphical mode (remediation plan A-3).
    const description = room ? describeRoom(room, result.state, result) : null;
    if (description) {
      dungeonState.publishRoomDescription(description);
    }
    if (room && description) {
      // SFX: boss reveal vs. normal room enter
      if (room.room_type === 'boss') {
        dungeonAudio.play('boss-reveal');
      } else {
        dungeonAudio.play('room-enter');
      }
      lines.push(...formatRoomEntry(description, result.state.archetype_state));
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

    // The CHOICES are published independently of the prose. Both surfaces offer
    // them as actions — the graphical HUD as buttons, the terminal as numbered
    // options — and an encounter that arrived without its description text
    // would still be playable. Tying the actions to the presence of prose would
    // make a content gap into a dead end.
    if (result.choices?.length) {
      dungeonState.encounterChoices.value = result.choices;
    }

    // Threshold toll room — sparse, literary rendering. The prose itself comes
    // from the shared description; only the choice list is terminal-specific.
    if (description?.isThreshold && result.choices && description.encounter) {
      lines.push(...formatThresholdEntry(description.encounter, result.choices));
    }

    // Encounter / treasure / rest choices (any room with interactive choices)
    else if (result.choices && description?.encounter) {
      lines.push(
        ...formatEncounterChoices(description.encounter, result.choices, result.state.party),
      );
    } else if (result.encounter === false) {
      // No matching encounter template found — room auto-cleared
      lines.push(responseLine(msg('The room is empty. Whatever was here has moved on.')));
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

  // Same derivation as on entry, minus the texts that only exist at the moment
  // of arrival (banter, anchor prose). `look` must not invent them.
  const description = describeRoom(room, state);
  dungeonState.publishRoomDescription(description);
  const lines = formatRoomEntry(description, state.archetype_state);

  // Re-display encounter/threshold choices
  const choices = dungeonState.encounterChoices.value;
  if (description.encounter && choices.length > 0) {
    lines.push(
      ...(description.isThreshold
        ? formatThresholdEntry(description.encounter, choices)
        : formatEncounterChoices(description.encounter, choices, state.party)),
    );
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

/**
 * Which agent performs a single-actor verb.
 *
 * Four verbs — scout, seal, ground, rally — carried this block verbatim,
 * differing only in the aptitude that drives the automatic pick. Four copies
 * meant four places to change when the party filter or the name match does.
 *
 * With a name in the argument: fuzzy-matched against the party, and a name that
 * does not match is an ERROR rather than a quiet fall back to whoever stands
 * first. Sending the wrong agent through a Deluge breach is not a recoverable
 * mistake, and a typo should not decide it.
 *
 * Without one: the highest `preferred` aptitude in the party.
 */
function resolveActingAgent(
  ctx: CommandContext,
  preferred: string,
): { agent: AgentCombatStateClient } | { error: TerminalLine[] } {
  const party = dungeonState.party.value.filter((a) => a.condition !== 'captured');
  if (party.length === 0) return { error: [errorLine(msg('No agents available.'))] };

  if (ctx.args.length > 0) {
    const requested = ctx.args.join(' ');
    const matched = fuzzyName(
      requested,
      party.map((a) => a.agent_name),
    );
    // `matched` comes out of this very list, so the lookup cannot miss; the old
    // copies carried a `?? party[0]` fallback for a branch that never ran.
    const agent = matched ? party.find((a) => a.agent_name === matched) : undefined;
    if (!agent) return { error: [errorLine(`${msg('Unknown agent')}: ${requested}`)] };
    return { agent };
  }

  return {
    agent: party.reduce((best, a) =>
      (a.aptitudes[preferred] ?? 0) > (best.aptitudes[preferred] ?? 0) ? a : best,
    ),
  };
}

async function handleDungeonScout(ctx: CommandContext): Promise<TerminalLine[]> {
  const state = dungeonState.clientState.value;
  const runId = dungeonState.runId.value;
  if (!state || !runId) return [errorLine(msg('No active dungeon.'))];

  // Find the best spy agent (or specified agent)
  const picked = resolveActingAgent(ctx, 'spy');
  if ('error' in picked) return picked.error;
  const agent = picked.agent;

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
  }
}

// ── Command: rest ────────────────────────────────────────────────────────────

async function handleDungeonRest(): Promise<TerminalLine[]> {
  const state = dungeonState.clientState.value;
  const runId = dungeonState.runId.value;
  if (!state || !runId) return [errorLine(msg('No active dungeon.'))];

  // Validate: current room is a rest site
  const currentRoom = dungeonState.currentRoom.value;
  if (currentRoom?.room_type !== 'rest') {
    return [errorLine(msg('Not at a rest site.'))];
  }

  // Rest all non-captured agents
  const restAgents = dungeonState.party.value
    .filter((a) => a.condition !== 'captured')
    .map((a) => a.agent_id);

  if (restAgents.length === 0) return [errorLine(msg('No agents available to rest.'))];

  try {
    const resp = await dungeonApi.rest(runId, restAgents);
    if (!resp.success || !resp.data) {
      return [errorLine(resp.error?.message ?? msg('Rest failed.'))];
    }

    dungeonState.applyState(resp.data.state);
    if (resp.data.healed) dungeonAudio.play('healing');
    const lines = formatRestResult(resp.data.healed, resp.data.ambushed, resp.data.banter);

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
  }
}

// ── Command: retreat ─────────────────────────────────────────────────────────

async function handleDungeonRetreat(): Promise<TerminalLine[]> {
  const runId = dungeonState.runId.value;
  if (!runId) return [errorLine(msg('No active dungeon.'))];

  try {
    const resp = await dungeonApi.retreat(runId);
    if (!resp.success || !resp.data) {
      return [errorLine(resp.error?.message ?? msg('Retreat failed.'))];
    }

    const lines = formatRetreatResult(resp.data.loot, resp.data.banter);
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
    return [hintLine(msg('Usage: assign <item#> <agent_name> [dimension]'))];
  }

  const itemNum = parseInt(ctx.args[0], 10);

  // Find the distributable items (same filter as formatter)
  const autoEffects = AUTO_APPLY_EFFECTS;
  const distributable = (state.pending_loot ?? []).filter((i) => !autoEffects.has(i.effect_type));

  if (Number.isNaN(itemNum) || itemNum < 1 || itemNum > distributable.length) {
    return [errorLine(msg('Invalid item number.'))];
  }

  const lootItem = distributable[itemNum - 1];

  // ── Separate agent name from optional dimension argument ───────────
  // Big Five dimensions — mirrors BIG_FIVE_DIMENSIONS in
  // backend/models/resonance_dungeon.py:310.  Stable set since 1961.
  const BIG_FIVE = new Set([
    'openness',
    'conscientiousness',
    'extraversion',
    'agreeableness',
    'neuroticism',
  ]);

  const restArgs = ctx.args.slice(1);
  let dimension: string | undefined;

  // If the loot is a personality_modifier AND the last arg is a valid
  // dimension, split it off; otherwise all remaining args form the name.
  if (
    lootItem.effect_type === 'personality_modifier' &&
    restArgs.length >= 2 &&
    BIG_FIVE.has(restArgs[restArgs.length - 1].toLowerCase())
  ) {
    dimension = restArgs.pop()?.toLowerCase();
  }

  const agentNameInput = restArgs.join(' ').toLowerCase();

  // Fuzzy match agent name (same pattern as attack/encounter commands)
  const operationalNames = state.party
    .filter((a) => a.condition !== 'captured')
    .map((a) => a.agent_name);
  const matchedName = fuzzyName(agentNameInput, operationalNames);
  const agent = matchedName ? state.party.find((a) => a.agent_name === matchedName) : undefined;
  if (!agent) {
    return [errorLine(msg('Agent not found or captured.'))];
  }

  // For personality_modifier items: dimension is required (player choice
  // or auto-extracted from effect_params.trait on the backend).
  // If the item's effect_params has a pre-set trait, the backend handles it.
  // If not, the player must specify the dimension.
  if (lootItem.effect_type === 'personality_modifier' && !dimension) {
    // Try to get trait from effect_params (fixed-trait items)
    const fixedTrait = lootItem.effect_params?.trait as string | undefined;
    if (fixedTrait && BIG_FIVE.has(fixedTrait)) {
      dimension = fixedTrait;
    } else {
      return [
        errorLine(msg('This item modifies personality. Specify a Big Five dimension:')),
        hintLine(
          msg(
            'assign <#> <agent> openness|conscientiousness|extraversion|agreeableness|neuroticism',
          ),
        ),
      ];
    }
  }

  try {
    const resp = await dungeonApi.assignLoot(runId, {
      loot_id: lootItem.id,
      agent_id: agent.agent_id,
      ...(dimension ? { dimension } : {}),
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
  const aptitudeKey = choice.check_aptitude;
  if (aptitudeKey) {
    const party = dungeonState.party.value;
    const candidates = party
      .filter((a) => a.condition !== 'captured')
      .sort((a, b) => (b.aptitudes[aptitudeKey] ?? 0) - (a.aptitudes[aptitudeKey] ?? 0));
    agentId = candidates[0]?.agent_id;
  }

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
      // Use backend-generated narrative effects (bilingual, proper separation of concerns).
      // `narrative_effects_en/_de` are `string[]` fields — use the array variant
      // of the locale helper rather than casting the string-returning `localized()`.
      const backendEffects = localizedArray(resp.data, 'narrative_effects');
      const effects: string[] =
        backendEffects.length > 0
          ? backendEffects
          : Object.entries(resp.data.effects).map(
              ([key, val]: [string, unknown]) => `${key}: ${val}`,
            );
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
  // All three tokens can be multi-word: "attack General Wolf Precision Strike Echo Fragment A"
  // Resolution: agent → ability → target, each via resolveToken (longest-prefix-first).
  if (ctx.args.length < 2) {
    return [
      errorLine(msg('Usage: attack <agent> <ability> [target]')),
      hintLine(msg('Example: attack Mueller precision strike sentinel')),
    ];
  }

  const party = dungeonState.party.value.filter(
    (a) => a.condition !== 'captured' && a.available_abilities.length > 0,
  );

  // Step 1: agent (cap prefix length to leave room for ability)
  const agentNames = party.map((a) => a.agent_name);
  const agentResult = resolveToken(ctx.args, agentNames, Math.min(ctx.args.length - 1, 3));
  const agent = agentResult.match
    ? party.find((a) => a.agent_name === agentResult.match)
    : undefined;
  if (!agent) {
    return [errorLine(`${msg('Unknown agent')}: ${ctx.args[0]}`)];
  }

  // Step 2: ability
  if (agentResult.rest.length === 0) {
    return [errorLine(msg('Specify an ability.'))];
  }
  const abilityNames = agent.available_abilities
    .filter((a) => a.cooldown_remaining === 0)
    .map((a) => localized(a, 'name'));
  const abilityResult = resolveToken(agentResult.rest, abilityNames);
  const ability = abilityResult.match
    ? agent.available_abilities.find((a) => localized(a, 'name') === abilityResult.match)
    : undefined;
  if (!ability) {
    return [errorLine(`${msg('Unknown or unavailable ability')}: ${agentResult.rest.join(' ')}`)];
  }

  // Step 3: target (remainder — already multi-word via resolveToken)
  let targetId: string | undefined;
  let resolvedTargetName: string | undefined;

  if (state.combat) {
    const alive = state.combat.enemies.filter((e) => e.is_alive);

    if (abilityResult.rest.length > 0) {
      // Explicit target provided — resolve it
      const enemyNames = alive.map((e) => localized(e, 'name'));
      const { match: matchedEnemy } = resolveToken(abilityResult.rest, enemyNames);
      if (matchedEnemy) {
        const enemy = alive.find((e) => localized(e, 'name') === matchedEnemy);
        targetId = enemy?.instance_id;
        resolvedTargetName = matchedEnemy;
      } else {
        return [errorLine(`${msg('Unknown target')}: ${abilityResult.rest.join(' ')}`)];
      }
    } else if (alive.length > 0 && ability.targets !== 'self' && ability.targets !== 'all_allies') {
      // No target specified for enemy-targeting ability → auto-target first alive enemy.
      // Mirrors DungeonCombatBar auto-target fix.
      targetId = alive[0].instance_id;
      resolvedTargetName = localized(alive[0], 'name');
    }
  }

  // Register selection
  dungeonState.selectAction(agent.agent_id, ability.id, targetId);

  const lines: TerminalLine[] = [
    systemLine(
      `${agentResult.match} \u2192 ${abilityResult.match}${resolvedTargetName ? ` \u2192 ${resolvedTargetName}` : ''}`,
    ),
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
      // Publish for the graphical combat-FX host (second consumer of the state).
      // round_result lives on the submit response, not on the state, so
      // applyState() above never carried it — the FX host reads it from here.
      dungeonState.publishRoundResult(resp.data.round_result);
      const partyNames = dungeonState.party.value.map((a) => a.agent_name);
      // SFX: play dominant combat sound from round events
      _playCombatRoundSfx(resp.data.round_result.events, new Set(partyNames));
      lines.push(...formatCombatResolution(resp.data.round_result, partyNames));

      // The archetype's line for what the round did — a fall, an affliction, a
      // victory. Emitted since the Systemprüfung; without this it would be
      // computed and dropped, which is the defect it was meant to fix.
      const roundBanter = resp.data.banter ? localized(resp.data.banter, 'text') : null;
      if (roundBanter) {
        lines.push(combatSystemLine(''));
        lines.push(combatSystemLine(roundBanter));
      }

      // Victory → show loot
      if (resp.data.round_result.victory && resp.data.state.phase === 'room_clear') {
        dungeonAudio.play('victory');
        lines.push(combatSystemLine(msg('VICTORY \u2013 ROOM CLEARED')));
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

  const picked = resolveActingAgent(ctx, 'guardian');
  if ('error' in picked) return picked.error;
  const agent = picked.agent;

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
  }
}

// ── Command: ground (Awakening only) ────────────────────────────────────────

async function handleDungeonGround(ctx: CommandContext): Promise<TerminalLine[]> {
  const state = dungeonState.clientState.value;
  const runId = dungeonState.runId.value;
  if (!state || !runId) return [errorLine(msg('No active dungeon.'))];

  if (state.archetype !== 'The Awakening') {
    return [errorLine(msg('Ground is only available in Awakening dungeons.'))];
  }

  const picked = resolveActingAgent(ctx, 'spy');
  if ('error' in picked) return picked.error;
  const agent = picked.agent;

  try {
    const resp = await dungeonApi.ground(runId, agent.agent_id);
    if (!resp.success || !resp.data) {
      return [errorLine(resp.error?.message ?? msg('Ground failed.'))];
    }

    dungeonState.applyState(resp.data.state);
    return formatGroundResult(
      agent.agent_name,
      resp.data.awareness,
      resp.data.stress_cost,
      resp.data.cooldown_until_room,
    );
  } catch (err) {
    captureError(err, { source: 'dungeon-commands.handleDungeonGround' });
    const message = err instanceof Error ? err.message : msg('Ground failed.');
    return [errorLine(message)];
  }
}

// ── Command: rally (Overthrow only) ─────────────────────────────────────────

async function handleDungeonRally(ctx: CommandContext): Promise<TerminalLine[]> {
  const state = dungeonState.clientState.value;
  const runId = dungeonState.runId.value;
  if (!state || !runId) return [errorLine(msg('No active dungeon.'))];

  if (state.archetype !== 'The Overthrow') {
    return [errorLine(msg('Rally is only available in Overthrow dungeons.'))];
  }

  const picked = resolveActingAgent(ctx, 'propagandist');
  if ('error' in picked) return picked.error;
  const agent = picked.agent;

  try {
    const resp = await dungeonApi.rally(runId, agent.agent_id);
    if (!resp.success || !resp.data) {
      return [errorLine(resp.error?.message ?? msg('Rally failed.'))];
    }

    dungeonState.applyState(resp.data.state);
    return formatRallyResult(
      agent.agent_name,
      resp.data.fracture,
      resp.data.stress_cost,
      resp.data.cooldown_until_room,
    );
  } catch (err) {
    captureError(err, { source: 'dungeon-commands.handleDungeonRally' });
    const message = err instanceof Error ? err.message : msg('Rally failed.');
    return [errorLine(message)];
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

/**
 * Dungeon entry flow — archetype selection, agent picker, disambiguation, run creation.
 *
 * Extracted from dungeon-commands.ts (H1 audit finding) to isolate the most
 * complex command handler into a dedicated module. The disambiguation logic
 * (M7) is a pure function for direct unit testing.
 *
 * Pattern: dungeon-commands.ts handlers (async, return TerminalLine[]).
 */

import { msg } from '@lit/localize';

import { appState } from '../services/AppStateManager.js';
import { dungeonApi } from '../services/api/DungeonApiService.js';
import { dungeonAudio } from '../services/DungeonAudioService.js';
import { dungeonState } from '../services/DungeonStateManager.js';
import { captureError } from '../services/SentryService.js';
import { terminalState } from '../services/TerminalStateManager.js';
import type { AvailableDungeonResponse, DungeonRunCreate } from '../types/dungeon.js';
import type { CommandContext, TerminalLine } from '../types/terminal.js';
import {
  formatAgentPicker,
  formatAvailableDungeons,
  formatDungeonEntry,
  getArchetypeDisplayName,
} from './dungeon-formatters.js';
import { fuzzyMatch as fuzzyMatchEntities } from './fuzzy-search.js';
import { localized } from './locale-fields.js';
import { errorLine, hintLine, systemLine } from './terminal-formatters.js';

// ── Disambiguation (pure, unit-testable) ────────────────────────────────────

/**
 * Resolve entry arguments into an archetype + remaining selection args.
 *
 * Five disambiguation rules:
 *   1. Non-numeric first arg → archetype name (fuzzy match), rest = agent args
 *   2. Numeric first arg, single arg → archetype by 1-based index
 *   3. Numeric first arg, ≥2 args, pending exists → ALL args = agent indices
 *   4. Numeric first arg, ≥2 args, no pending → first = archetype index, rest = agent args
 *   5. "auto" first arg, pending exists → auto-pick for pending archetype
 *
 * Returns null archetype when no match found.
 */
export function resolveEntryArgs(
  args: string[],
  available: AvailableDungeonResponse[],
  pendingArchetype: string | null,
): { archetype: string | null; selectionArgs: string[] } {
  const firstArg = args[0].toLowerCase();
  const firstArgNum = parseInt(firstArg, 10);
  const isNumeric = !Number.isNaN(firstArgNum) && String(firstArgNum) === firstArg;

  // Rule 5: "dungeon auto" with pending → auto-pick for stored archetype
  if (firstArg === 'auto' && pendingArchetype) {
    return { archetype: pendingArchetype, selectionArgs: ['auto'] };
  }

  // Rule 1: Non-numeric → fuzzy match archetype name
  if (!isNumeric) {
    const archetypeNames = available.map((d) => d.archetype);
    return { archetype: _fuzzyName(firstArg, archetypeNames), selectionArgs: args.slice(1) };
  }

  // Rule 2: Single numeric arg → archetype by 1-based index
  if (args.length === 1) {
    return { archetype: _resolveByIndex(firstArgNum, available), selectionArgs: [] };
  }

  // Rule 3: Multiple numeric args with pending → all are agent indices
  if (pendingArchetype && args.length >= 2) {
    return { archetype: pendingArchetype, selectionArgs: args };
  }

  // Rule 4: Multiple args, no pending → first = archetype index, rest = agents
  return { archetype: _resolveByIndex(firstArgNum, available), selectionArgs: args.slice(1) };
}

// ── Command: dungeon ─────────────────────────────────────────────────────────

export async function handleDungeonEnter(ctx: CommandContext): Promise<TerminalLine[]> {
  const sid = ctx.simulationId || appState.simulationId.value;
  if (!sid) return [errorLine(msg('No simulation active.'))];

  // If not on the dungeon terminal route, navigate there first.
  if (!window.location.pathname.endsWith('/dungeon')) {
    const slug = appState.currentSimulation.value?.slug;
    if (slug) {
      if (ctx.args.length > 0) {
        appState.pendingDungeonArchetype.value = ctx.args[0];
      }
      window.history.pushState({}, '', `/simulations/${slug}/dungeon`);
      window.dispatchEvent(new PopStateEvent('popstate'));
      return [systemLine(msg('Entering dungeon terminal\u2026'))];
    }
  }

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

  // No args → list available archetypes (clears any pending context)
  if (ctx.args.length === 0) {
    dungeonState.pendingArchetypeForPicker.value = null;
    return formatAvailableDungeons(available);
  }

  // ── Resolve via pure disambiguation function ─────────────────────────
  const { archetype: resolvedArchetype, selectionArgs } = resolveEntryArgs(
    ctx.args,
    available,
    dungeonState.pendingArchetypeForPicker.value,
  );

  if (!resolvedArchetype) {
    return [errorLine(msg('Unknown archetype.')), ...formatAvailableDungeons(available)];
  }

  const selectedDungeon = available.find(
    (d) => d.archetype.toLowerCase() === resolvedArchetype.toLowerCase(),
  );
  if (!selectedDungeon?.available) {
    return [errorLine(msg('That dungeon is not available (cooldown active or no resonance).'))];
  }

  // ── Agent loading + selection ─────────────────────────────────────────

  await dungeonState.loadPickerAgents(sid);
  if (dungeonState.error.value) {
    return [errorLine(msg('Failed to load agents. Try again.'))];
  }
  const agents = dungeonState.pickerAgents.value;
  const aptMap = dungeonState.pickerAptitudes.value;

  if (agents.length < 2) {
    return [
      errorLine(msg('Need at least 2 agents for a dungeon party. Recruit more agents first.')),
    ];
  }

  // No selection args → show picker, store pending archetype
  if (selectionArgs.length === 0) {
    dungeonState.pendingArchetypeForPicker.value = resolvedArchetype;
    return formatAgentPicker(agents, aptMap, resolvedArchetype);
  }

  // "auto" → smart-pick top 3 by aggregate aptitude score
  if (selectionArgs[0] === 'auto') {
    dungeonState.pendingArchetypeForPicker.value = null;
    const scored = agents.map((a) => {
      const apts = aptMap.get(a.id);
      const total = apts ? Object.values(apts).reduce((s, v) => s + v, 0) : 0;
      return { agent: a, score: total };
    });
    scored.sort((a, b) => b.score - a.score);
    const partyIds = scored.slice(0, 3).map((s) => s.agent.id);
    return startDungeonRun(sid, {
      archetype: selectedDungeon.archetype as DungeonRunCreate['archetype'],
      party_agent_ids: partyIds,
      difficulty: selectedDungeon.suggested_difficulty,
    });
  }

  // Numeric args → indices into the agent list (1-based)
  const indices = selectionArgs
    .map(Number)
    .filter((n) => !Number.isNaN(n) && n >= 1 && n <= agents.length);
  if (indices.length < 2) {
    dungeonState.pendingArchetypeForPicker.value = resolvedArchetype;
    return [
      errorLine(msg('Select 2\u20134 agents by number.')),
      ...formatAgentPicker(agents, aptMap, resolvedArchetype),
    ];
  }
  if (indices.length > 4) {
    return [errorLine(msg('Maximum 4 agents per party.'))];
  }

  // Map 1-based indices to agent IDs
  const partyIds = [...new Set(indices)].map((i) => agents[i - 1].id);
  if (partyIds.length < 2) {
    return [errorLine(msg('Need at least 2 unique agents.'))];
  }

  dungeonState.pendingArchetypeForPicker.value = null;
  return startDungeonRun(sid, {
    archetype: selectedDungeon.archetype as DungeonRunCreate['archetype'],
    party_agent_ids: partyIds,
    difficulty: selectedDungeon.suggested_difficulty,
  });
}

// ── Run Creation ────────────────────────────────────────────────────────────

/**
 * Initialize dungeon mode after a run is created (called by entry flow
 * or external code like DungeonTerminalView for deep-link entry).
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

    const { run, state, entrance_text } = resp.data;
    dungeonState.applyState(state);
    terminalState.clearOutput();
    terminalState.initializeDungeon(String(run.id), getArchetypeDisplayName(state.archetype));
    dungeonAudio.play('room-enter');

    const atmosphereText = localized(entrance_text, 'text');

    return formatDungeonEntry(state, atmosphereText);
  } catch (err) {
    captureError(err, { source: 'dungeon-entry-flow.startDungeonRun' });
    const message = err instanceof Error ? err.message : msg('Failed to create dungeon run.');
    return [errorLine(message)];
  } finally {
    dungeonState.loading.value = false;
  }
}

// ── Private Helpers ─────────────────────────────────────────────────────────

/** Fuzzy match a string against a list of names. Returns matched name or null. */
function _fuzzyName(query: string, names: string[]): string | null {
  const entities = names.map((n) => ({ id: n, name: n }));
  const matches = fuzzyMatchEntities(query, entities);
  return matches.length > 0 ? matches[0].name : null;
}

/** Resolve a 1-based numeric index to an archetype name from the available list. */
function _resolveByIndex(
  index: number,
  available: AvailableDungeonResponse[],
): string | null {
  if (index < 1 || index > available.length) return null;
  return available[index - 1].archetype;
}

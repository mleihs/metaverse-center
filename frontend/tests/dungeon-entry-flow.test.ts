/**
 * Unit tests for dungeon-entry-flow.ts — resolveEntryArgs.
 *
 * Tests the 5 disambiguation rules for parsing "dungeon <args>"
 * terminal commands into archetype + agent selection arguments.
 * Pure function — no DOM, no API calls.
 */

import { describe, it, expect, vi } from 'vitest';

// Mock Supabase-dependent imports to avoid env var requirement at module level.
// resolveEntryArgs is a pure function — these services are only used by other
// exports in the same module (handleDungeonEnter, etc.).
vi.mock('../src/services/api/DungeonApiService.js', () => ({ dungeonApi: {} }));
vi.mock('../src/services/AppStateManager.js', () => ({
  appState: { simulationId: { value: null }, currentSimulation: { value: null }, pendingDungeonArchetype: { value: null } },
}));
vi.mock('../src/services/DungeonAudioService.js', () => ({ dungeonAudio: {} }));
vi.mock('../src/services/DungeonStateManager.js', () => ({
  dungeonState: { isInDungeon: { value: false }, runId: { value: null } },
}));
vi.mock('../src/services/SentryService.js', () => ({ captureError: vi.fn() }));
vi.mock('../src/services/TerminalStateManager.js', () => ({ terminalState: {} }));

import { resolveEntryArgs } from '../src/utils/dungeon-entry-flow.js';
import type { AvailableDungeonResponse } from '../src/types/dungeon.js';

// ── Test Fixtures ───────────────────────────────────────────────────────────

function makeAvailable(archetype: string): AvailableDungeonResponse {
  return {
    archetype,
    signature: `sig_${archetype.toLowerCase().replace(/\s+/g, '_')}`,
    resonance_id: null,
    magnitude: 0.5,
    susceptibility: 0.5,
    effective_magnitude: 0.5,
    suggested_difficulty: 3,
    suggested_depth: 5,
    last_run_at: null,
    available: true,
  };
}

const available: AvailableDungeonResponse[] = [
  makeAvailable('The Shadow'),
  makeAvailable('The Tower'),
  makeAvailable('The Awakening'),
  makeAvailable('The Devouring Mother'),
  makeAvailable('The Prometheus'),
];

// ── resolveEntryArgs ────────────────────────────────────────────────────────

describe('resolveEntryArgs', () => {
  // Rule 0: no args
  it('returns null archetype for empty args', () => {
    const result = resolveEntryArgs([], available, null);
    expect(result.archetype).toBeNull();
    expect(result.selectionArgs).toEqual([]);
  });

  // Rule 1: non-numeric first arg → fuzzy match archetype name
  it('rule 1: single word fuzzy matches archetype', () => {
    const result = resolveEntryArgs(['shadow'], available, null);
    expect(result.archetype).toBe('The Shadow');
    expect(result.selectionArgs).toEqual([]);
  });

  it('rule 1: multi-word archetype name', () => {
    const result = resolveEntryArgs(['the', 'awakening'], available, null);
    expect(result.archetype).toBe('The Awakening');
    expect(result.selectionArgs).toEqual([]);
  });

  it('rule 1: archetype name followed by numeric agent args', () => {
    const result = resolveEntryArgs(['shadow', '1', '2', '3'], available, null);
    expect(result.archetype).toBe('The Shadow');
    expect(result.selectionArgs).toEqual(['1', '2', '3']);
  });

  it('rule 1: multi-word name followed by agent indices', () => {
    const result = resolveEntryArgs(['devouring', 'mother', '1', '2'], available, null);
    expect(result.archetype).toBe('The Devouring Mother');
    expect(result.selectionArgs).toEqual(['1', '2']);
  });

  it('rule 1: returns null archetype when name not found', () => {
    const result = resolveEntryArgs(['xyzzy'], available, null);
    expect(result.archetype).toBeNull();
    expect(result.selectionArgs).toEqual(['xyzzy']);
  });

  it('rule 1: archetype name followed by "auto"', () => {
    const result = resolveEntryArgs(['shadow', 'auto'], available, null);
    expect(result.archetype).toBe('The Shadow');
    expect(result.selectionArgs).toEqual(['auto']);
  });

  // Rule 2: single numeric arg → archetype by 1-based index
  it('rule 2: single numeric → archetype by index', () => {
    const result = resolveEntryArgs(['1'], available, null);
    expect(result.archetype).toBe('The Shadow');
    expect(result.selectionArgs).toEqual([]);
  });

  it('rule 2: out of range returns null', () => {
    const result = resolveEntryArgs(['99'], available, null);
    expect(result.archetype).toBeNull();
    expect(result.selectionArgs).toEqual([]);
  });

  it('rule 2: index 0 returns null (1-based)', () => {
    const result = resolveEntryArgs(['0'], available, null);
    expect(result.archetype).toBeNull();
    expect(result.selectionArgs).toEqual([]);
  });

  // Rule 3: multiple numeric args with pending → all are agent indices
  it('rule 3: numeric args with pending → all are agent args', () => {
    const result = resolveEntryArgs(['1', '2', '3'], available, 'The Shadow');
    expect(result.archetype).toBe('The Shadow');
    expect(result.selectionArgs).toEqual(['1', '2', '3']);
  });

  it('rule 3: even two numeric args go to agent selection when pending', () => {
    const result = resolveEntryArgs(['4', '5'], available, 'The Tower');
    expect(result.archetype).toBe('The Tower');
    expect(result.selectionArgs).toEqual(['4', '5']);
  });

  // Rule 4: multiple numeric args, no pending → first = archetype index, rest = agents
  it('rule 4: first numeric = archetype index, rest = agent args', () => {
    const result = resolveEntryArgs(['2', '1', '3', '5'], available, null);
    expect(result.archetype).toBe('The Tower'); // index 2
    expect(result.selectionArgs).toEqual(['1', '3', '5']);
  });

  // Rule 5: "auto" with pending
  it('rule 5: "auto" with pending archetype → auto-pick', () => {
    const result = resolveEntryArgs(['auto'], available, 'The Prometheus');
    expect(result.archetype).toBe('The Prometheus');
    expect(result.selectionArgs).toEqual(['auto']);
  });

  it('rule 5: "auto" without pending → no match (non-numeric, not in available)', () => {
    const result = resolveEntryArgs(['auto'], available, null);
    // "auto" is non-numeric, so rule 1 applies — fuzzy match "auto" against archetypes → null
    expect(result.archetype).toBeNull();
  });
});

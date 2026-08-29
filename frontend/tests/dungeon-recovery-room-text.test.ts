/**
 * `tryRecover()` must re-describe the room, not just restore the run.
 *
 * Reloading the page mid-run left the graphical scene blank until the player
 * moved. `applyState()` deliberately does NOT touch `lastRoomDescription` — on
 * a move the prose rides on the move RESPONSE, so applying state must never
 * overwrite the richer arrival text. After a reload there is no move response
 * to carry it, and the scene's only source is that signal.
 *
 * The fix re-derives it from run state alone, which is exactly what `look`
 * does. These tests pin BOTH halves of that contract:
 *
 *   - what recovery restores (room-type ambient, a still-standing encounter),
 *   - what it must NOT invent (banter, anchor prose, barometer — those exist
 *     only at the moment of arrival).
 *
 * The second half matters as much as the first: a recovery that fabricated
 * arrival prose would tell the player their party had just reacted to a room
 * they have been standing in since before the reload.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DungeonClientState, RoomNodeClient } from '../src/types/dungeon.js';

vi.mock('../src/services/AppStateManager.js', () => ({
  appState: { simulationId: { value: 'sim-1' }, currentSimulation: { value: null } },
}));
vi.mock('../src/services/AnalyticsService.js', () => ({
  analyticsService: { trackEvent: vi.fn() },
}));
vi.mock('../src/services/SentryService.js', () => ({ captureError: vi.fn() }));
vi.mock('../src/services/TerminalStateManager.js', () => ({
  terminalState: { appendOutput: vi.fn(), clearDungeon: vi.fn() },
}));
vi.mock('../src/services/api/AgentsApiService.js', () => ({ agentsApi: {} }));

const getState = vi.fn();
vi.mock('../src/services/api/DungeonApiService.js', () => ({
  dungeonApi: {
    getState: (...args: unknown[]) => getState(...args),
  },
}));

const { dungeonState } = await import('../src/services/DungeonStateManager.js');

function room(overrides: Partial<RoomNodeClient> = {}): RoomNodeClient {
  return {
    index: 3,
    depth: 2,
    room_type: 'rest',
    connections: [4],
    cleared: false,
    current: true,
    revealed: true,
    ...overrides,
  };
}

const CHOICE = {
  id: 'c1',
  label_en: 'Push on',
  label_de: 'Weitergehen',
  requires_aptitude: null,
  check_aptitude: null,
  check_difficulty: 0,
};

function state(overrides: Partial<DungeonClientState> = {}): DungeonClientState {
  return {
    run_id: 'run-1',
    archetype: 'The Entropy',
    phase: 'exploring',
    depth: 2,
    current_room: 3,
    rooms: [room()],
    party: [],
    ...overrides,
  } as DungeonClientState;
}

/** Drive the real recovery path: a persisted id plus a state response. */
async function recoverWith(s: DungeonClientState): Promise<boolean> {
  localStorage.setItem('dungeon_active_run', String(s.run_id));
  getState.mockResolvedValue({ success: true, data: s });
  return dungeonState.tryRecover();
}

describe('tryRecover — re-describes the current room', () => {
  beforeEach(() => {
    dungeonState.clear();
    getState.mockReset();
    localStorage.clear();
  });

  it('publishes a description instead of leaving the scene blank', async () => {
    const recovered = await recoverWith(state());

    expect(recovered).toBe(true);
    const d = dungeonState.lastRoomDescription.value;
    expect(d).not.toBeNull();
    // A rest room carries room-type ambient, which lives in state alone.
    expect(d?.ambient).toBeTruthy();
    expect(d?.roomIndex).toBe(3);
    expect(d?.roomType).toBe('rest');
  });

  it('recovers a standing encounter from the checkpointed state', async () => {
    const recovered = await recoverWith(
      state({
        phase: 'encounter',
        rooms: [room({ room_type: 'encounter' })],
        encounter_choices: [CHOICE],
        // `localized()` reads the locale-suffixed fields, not a bare one.
        encounter_description_en: 'The corridor narrows to a seam.',
        encounter_description_de: 'Der Gang verengt sich zu einer Naht.',
      }),
    );

    expect(recovered).toBe(true);
    expect(dungeonState.lastRoomDescription.value?.encounter).toBe(
      'The corridor narrows to a seam.',
    );
  });

  it('does not invent the texts that only exist on arrival', async () => {
    await recoverWith(state());

    const d = dungeonState.lastRoomDescription.value;
    expect(d?.banter).toBeNull();
    expect(d?.anchors).toEqual([]);
    expect(d?.barometer).toBeNull();
  });

  it('leaves the description null when there is no run to recover', async () => {
    const recovered = await dungeonState.tryRecover();

    expect(recovered).toBe(false);
    expect(dungeonState.lastRoomDescription.value).toBeNull();
  });
});

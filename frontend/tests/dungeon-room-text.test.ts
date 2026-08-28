/**
 * describeRoom — the one place that decides which prose belongs to a room.
 *
 * The bug these tests exist for (remediation plan A-3): the decision lived in
 * two places, and only one of them was complete. `formatRoomEntry` assembled
 * banter, anchors, barometer and room-type ambient for the terminal, while
 * `dungeon-commands` separately decided when to show `encounter_description`.
 * The graphical scene got a hand-picked subset — banter and barometer — so 129
 * encounter templates, every anchor object and every ambient line were
 * invisible in graphical mode.
 *
 * What is pinned here is the SELECTION, not the rendering: both surfaces render
 * the same object, so a surface can no longer be missing content by omission.
 */

import { describe, expect, it } from 'vitest';

import type {
  DungeonClientState,
  MoveToRoomResponse,
  RoomNodeClient,
} from '../src/types/dungeon.js';
import { describeRoom } from '../src/utils/dungeon-room-text.js';

function room(overrides: Partial<RoomNodeClient> = {}): RoomNodeClient {
  return {
    index: 3,
    depth: 2,
    room_type: 'encounter',
    connections: [4],
    cleared: false,
    current: true,
    revealed: true,
    ...overrides,
  };
}

function state(overrides: Partial<DungeonClientState> = {}): DungeonClientState {
  return {
    run_id: 'run-1',
    archetype: 'The Shadow',
    signature: 'sig',
    difficulty: 3,
    depth: 5,
    current_room: 3,
    rooms: [],
    party: [],
    archetype_state: { visibility: 2, max_visibility: 3 },
    combat: null,
    phase: 'exploring',
    phase_timer: null,
    ...overrides,
  } as DungeonClientState;
}

const CHOICE = {
  id: 'c1',
  label_en: 'Listen',
  label_de: 'Lauschen',
  requires_aptitude: null,
  check_aptitude: null,
  check_difficulty: 0,
};

describe('describeRoom — on entry (move response)', () => {
  it('carries every text role the move response holds', () => {
    const move: MoveToRoomResponse = {
      banter: { text_en: 'Aranea goes still.', text_de: 'Aranea erstarrt.' },
      anchor_texts: [{ text_en: 'A chair, facing the wall.', text_de: 'Ein Stuhl zur Wand.' }],
      barometer_text: { text_en: 'The dark presses closer.', text_de: 'Das Dunkel rueckt naeher.' },
      description_en: 'Something breathes in the corner.',
      description_de: 'Etwas atmet in der Ecke.',
      choices: [CHOICE],
      state: state(),
    };

    const d = describeRoom(room(), state(), move);

    expect(d.banter).toBe('Aranea goes still.');
    expect(d.anchors).toEqual(['A chair, facing the wall.']);
    expect(d.barometer).toBe('The dark presses closer.');
    expect(d.encounter).toBe('Something breathes in the corner.');
  });

  it('withholds the encounter prose when the room presents no choices', () => {
    const move: MoveToRoomResponse = {
      description_en: 'leftover text from a resolved encounter',
      state: state(),
    };

    expect(describeRoom(room(), state(), move).encounter).toBeNull();
  });

  it('marks a threshold so both surfaces can render it sparser', () => {
    const move: MoveToRoomResponse = {
      threshold: true,
      description_en: 'Three tolls. One road.',
      choices: [CHOICE],
      state: state(),
    };

    const d = describeRoom(room({ room_type: 'threshold' }), state(), move);
    expect(d.isThreshold).toBe(true);
    expect(d.encounter).toBe('Three tolls. One road.');
  });

  it('drops empty anchor entries rather than rendering blanks', () => {
    const move: MoveToRoomResponse = {
      anchor_texts: [{ text_en: '', text_de: '' }, { text_en: 'A shoe.', text_de: 'Ein Schuh.' }],
      state: state(),
    };

    expect(describeRoom(room(), state(), move).anchors).toEqual(['A shoe.']);
  });
});

describe('describeRoom — re-describe (state only)', () => {
  it('recovers the encounter prose from state while choices are pending', () => {
    const s = state({
      phase: 'encounter',
      encounter_choices: [CHOICE],
      encounter_description_en: 'Something breathes in the corner.',
      encounter_description_de: 'Etwas atmet in der Ecke.',
    });

    const d = describeRoom(room(), s);
    expect(d.encounter).toBe('Something breathes in the corner.');
    expect(d.isThreshold).toBe(false);
  });

  it('withholds it once the party has moved past the encounter phase', () => {
    const s = state({
      phase: 'exploring',
      encounter_choices: [CHOICE],
      encounter_description_en: 'Something breathes in the corner.',
    });

    expect(describeRoom(room(), s).encounter).toBeNull();
  });

  it('never invents banter or anchors, which only exist at the moment of entry', () => {
    const d = describeRoom(room(), state());
    expect(d.banter).toBeNull();
    expect(d.anchors).toEqual([]);
    expect(d.barometer).toBeNull();
  });
});

describe('describeRoom — room type', () => {
  it('attaches ambient prose to exactly the three room types that carry one', () => {
    const withAmbient = ['rest', 'treasure', 'boss'];
    for (const type of withAmbient) {
      expect(describeRoom(room({ room_type: type }), state()).ambient).toBeTruthy();
    }
    for (const type of ['combat', 'elite', 'encounter', 'entrance', 'exit', 'threshold']) {
      expect(describeRoom(room({ room_type: type }), state()).ambient).toBeNull();
    }
  });

  it('picks the ambient text of the run archetype', () => {
    const shadow = describeRoom(room({ room_type: 'boss' }), state({ archetype: 'The Shadow' }));
    const deluge = describeRoom(room({ room_type: 'boss' }), state({ archetype: 'The Deluge' }));
    expect(shadow.ambient).not.toBe(deluge.ambient);
  });

  it('falls back to Shadow ambient for an unknown archetype instead of throwing', () => {
    const unknown = describeRoom(room({ room_type: 'rest' }), state({ archetype: 'The Nonesuch' }));
    const shadow = describeRoom(room({ room_type: 'rest' }), state({ archetype: 'The Shadow' }));
    expect(unknown.ambient).toBe(shadow.ambient);
  });

  it('labels every room type and gives an operating hint only where one exists', () => {
    expect(describeRoom(room({ room_type: 'boss' }), state()).typeLabel).toBe('BOSS CHAMBER');
    expect(describeRoom(room({ room_type: 'rest' }), state()).hint).toBeTruthy();
    expect(describeRoom(room({ room_type: 'combat' }), state()).hint).toBeNull();
    // Unrevealed rooms come through as "?" — no label lookup may throw on them.
    expect(describeRoom(room({ room_type: '?' }), state()).typeLabel).toBe('?');
  });

  it("reports the room's own coordinates, not the run depth", () => {
    const d = describeRoom(room({ depth: 2, index: 3 }), state({ depth: 5 }));
    expect(d.depth).toBe(2);
    expect(d.roomIndex).toBe(3);
  });
});

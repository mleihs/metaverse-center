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
import { describeRoom, mergeRoomDescription } from '../src/utils/dungeon-room-text.js';

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
      anchor_texts: [{ text_en: 'A chair, facing the wall.', text_de: 'Ein Stuhl zur Wand.', anchor_id: 'a-1', phase: 'entry' }],
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
      anchor_texts: [{ text_en: '', text_de: '', anchor_id: 'a-1', phase: 'entry' }, { text_en: 'A shoe.', text_de: 'Ein Schuh.', anchor_id: 'a-1', phase: 'entry' }],
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

  it('states the situation during combat, where there are no choices left', () => {
    // The choices were consumed when the party entered the fight. The prose
    // that introduced it is still true, and it is all the scene has to say
    // about a combat room — roomTypeAmbient covers only rest/treasure/boss.
    const s = state({
      phase: 'combat_planning',
      encounter_choices: null,
      encounter_description_en: 'Something ambushes you from the seam.',
      encounter_description_de: 'Etwas ueberfaellt euch aus der Naht.',
    });

    expect(describeRoom(room({ room_type: 'combat' }), s).encounter).toBe(
      'Something ambushes you from the seam.',
    );
  });

  it('leaves entry behaviour untouched — a move into combat keeps its arrival prose', () => {
    // The move response is the authority on entry; only the re-describe paths
    // (look, recovery) reach into state for the situation.
    const s = state({ phase: 'combat_planning', encounter_description_en: 'Ambush.' });
    const move: MoveToRoomResponse = {
      description_en: 'Ignored on entry.',
      state: s,
    };

    expect(describeRoom(room({ room_type: 'combat' }), s, move).encounter).toBeNull();
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

describe('describeRoom — the specific beats the general', () => {
  // The stutter this closes, observed in The Entropy: a rest site printed the
  // room-type ambient "A pocket of coherence in the decay." immediately above
  // its encounter prose "A pocket of slower decay." Two sentences, one
  // observation, and a player who learns to skip both.
  it('drops the room-type ambient while an encounter is present', () => {
    const move: MoveToRoomResponse = {
      banter: null,
      anchor_texts: null,
      barometer_text: null,
      description_en: 'A pocket of slower decay.',
      description_de: 'Eine Tasche langsameren Zerfalls.',
      choices: [CHOICE],
      state: state(),
    } as MoveToRoomResponse;

    const d = describeRoom(room({ room_type: 'rest' }), state({ archetype: 'The Entropy' }), move);

    expect(d.encounter).toBe('A pocket of slower decay.');
    expect(d.ambient).toBeNull();
  });

  it('keeps the ambient when the room presents no situation', () => {
    const d = describeRoom(room({ room_type: 'rest' }), state({ archetype: 'The Entropy' }));

    expect(d.encounter).toBeNull();
    expect(d.ambient).toBe('A pocket of coherence in the decay.');
  });

  it('lets the ambient return once the situation is resolved', () => {
    // After the encounter, run state carries no choices — the general line is
    // all that is left to say about the room, so it comes back.
    const resolved = state({
      archetype: 'The Entropy',
      phase: 'room_clear',
      encounter_choices: [],
    });
    const d = describeRoom(room({ room_type: 'rest' }), resolved);

    expect(d.ambient).toBe('A pocket of coherence in the decay.');
  });
});

describe('mergeRoomDescription — the description survives a second look', () => {
  // The bug: `look` re-derives from run state, which cannot know banter, anchor
  // prose or the barometer. Publishing that impoverished object overwrote the
  // good one, so the room went quiet the moment a player looked twice or
  // resolved its encounter.
  const arrival: MoveToRoomResponse = {
    banter: { text_en: 'Aranea goes still.', text_de: 'Aranea erstarrt.' },
    anchor_texts: [{ text_en: 'A chair, facing the wall.', text_de: 'Ein Stuhl zur Wand.', anchor_id: 'a-1', phase: 'entry' }],
    barometer_text: { text_en: 'The dark presses closer.', text_de: 'Das Dunkel rueckt naeher.' },
    description_en: 'Something breathes in the corner.',
    description_de: 'Etwas atmet in der Ecke.',
    choices: [CHOICE],
    state: state(),
  } as MoveToRoomResponse;

  it('carries the arrival-only prose through a look at the same room', () => {
    const entered = describeRoom(room(), state(), arrival);
    const looked = describeRoom(room(), state({ phase: 'encounter', encounter_choices: [CHOICE] }));

    const merged = mergeRoomDescription(entered, looked);

    expect(merged.banter).toBe('Aranea goes still.');
    expect(merged.anchors).toEqual(['A chair, facing the wall.']);
    expect(merged.barometer).toBe('The dark presses closer.');
  });

  it('lets the encounter go when the party has resolved it', () => {
    // Not an arrival-only field: it is recoverable from state, and the fresh
    // null is the truth. The prose stays, the choices go.
    const entered = describeRoom(room(), state(), arrival);
    const afterwards = describeRoom(room(), state({ phase: 'room_clear', encounter_choices: [] }));

    const merged = mergeRoomDescription(entered, afterwards);

    expect(merged.encounter).toBeNull();
    expect(merged.banter).toBe('Aranea goes still.');
    expect(merged.anchors).toHaveLength(1);
  });

  it('carries nothing into a different room', () => {
    const entered = describeRoom(room({ index: 3 }), state(), arrival);
    const nextRoom = describeRoom(room({ index: 7, depth: 3 }), state({ current_room: 7 }));

    const merged = mergeRoomDescription(entered, nextRoom);

    expect(merged.banter).toBeNull();
    expect(merged.anchors).toEqual([]);
    expect(merged.barometer).toBeNull();
  });

  it('does not overwrite fresh arrival prose with older prose', () => {
    // Re-entering the same room index at a new depth is a different room.
    const first = describeRoom(room({ index: 3, depth: 2 }), state(), arrival);
    const second: MoveToRoomResponse = {
      ...arrival,
      banter: { text_en: 'Kesh swears under his breath.', text_de: 'Kesh flucht leise.' },
    };
    const entered = describeRoom(room({ index: 3, depth: 2 }), state(), second);

    expect(mergeRoomDescription(first, entered).banter).toBe('Kesh swears under his breath.');
  });

  it('takes the new description when there is no standing one', () => {
    const fresh = describeRoom(room(), state());
    expect(mergeRoomDescription(null, fresh)).toBe(fresh);
  });
});

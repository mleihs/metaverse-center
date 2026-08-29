/**
 * Room and operative labels — the two places the map turns a server key into a
 * word a player reads.
 *
 * Both had the same shape of defect: a lookup table plus an ad-hoc fallback,
 * where the fallback was either wrong or missing.
 *
 * `roomNodeLabel` exists because the server fogs in TWO independent steps
 * (`build_client_state`): `revealed` says the node is on the map at all, and a
 * separate `scouted` flag decides whether the real type is sent or the string
 * `"?"`. `getRoomTypeLabel` only knows the first step, so a visible but
 * unscouted room reached the map's aria label as "? room 4" and the detail
 * panel's heading as "? #4".
 *
 * `aptitudeDisplayName` exists because `operativeName` indexes a record of
 * THUNKS: an aptitude key the client has not heard of — a newer server, a
 * content pack naming a new school — evaluated `undefined()` and threw inside a
 * render, taking the whole party panel down rather than one chip.
 */

import { describe, expect, it } from 'vitest';

import { roomNodeLabel } from '../src/components/dungeon/dungeon-map-icons.js';
import type { RoomNodeClient } from '../src/types/dungeon.js';
import {
  aptitudeCode,
  aptitudeDisplayName,
  isOperativeType,
  OPERATIVE_LABEL,
  OPERATIVE_SHORT,
  OPERATIVE_TYPES,
} from '../src/utils/operative-constants.js';

function room(overrides: Partial<RoomNodeClient> = {}): RoomNodeClient {
  return {
    index: 4,
    depth: 2,
    room_type: 'treasure',
    connections: [3, 5],
    cleared: false,
    current: false,
    revealed: true,
    ...overrides,
  };
}

describe('roomNodeLabel', () => {
  it('names the type once the room is scouted', () => {
    expect(roomNodeLabel(room({ room_type: 'treasure' }))).toBe('Treasure');
    expect(roomNodeLabel(room({ room_type: 'boss' }))).toBe('Boss');
  });

  it('says "Unscouted" for a visible room whose type the server withheld', () => {
    // revealed: true, room_type: '?' — the state the two-stage fog produces and
    // the one `getRoomTypeLabel` answered with a bare question mark.
    expect(roomNodeLabel(room({ room_type: '?' }))).toBe('Unscouted');
  });

  it('says "Unknown" for a room that is not on the map yet', () => {
    expect(roomNodeLabel(room({ revealed: false, room_type: '?' }))).toBe('Unknown');
  });

  it('never returns the raw placeholder', () => {
    for (const r of [
      room({ room_type: '?' }),
      room({ room_type: '?', revealed: false }),
      room({ room_type: 'combat', revealed: false }),
    ]) {
      expect(roomNodeLabel(r)).not.toBe('?');
    }
  });
});

describe('aptitude keys from the server', () => {
  it('recognises exactly the six known operative types', () => {
    for (const type of OPERATIVE_TYPES) expect(isOperativeType(type)).toBe(true);
    expect(isOperativeType('cartographer')).toBe(false);
    expect(isOperativeType('')).toBe(false);
    expect(isOperativeType('SPY')).toBe(false);
  });

  it('gives every known type its three-letter code', () => {
    for (const type of OPERATIVE_TYPES) expect(aptitudeCode(type)).toBe(OPERATIVE_LABEL[type]);
  });

  it('produces a three-letter code for an unknown key instead of throwing', () => {
    expect(aptitudeCode('cartographer')).toBe('CAR');
    expect(aptitudeCode('ox')).toBe('OX');
  });

  it('names an unknown key instead of calling undefined', () => {
    // The regression: operativeName('cartographer') was `names[type]()` on a
    // missing entry. A TypeError here takes down the render, not the chip.
    expect(() => aptitudeDisplayName('cartographer')).not.toThrow();
    expect(aptitudeDisplayName('cartographer')).toBe('CARTOGRAPHER');
    expect(aptitudeDisplayName('spy')).toBe('Spy');
  });

  it('keeps the single-letter table ambiguous on purpose, which is why it is not the default', () => {
    // Pinning the collision the party panel used to render: six names, four
    // initials. S went to Spy, so Saboteur reads B and Assassin reads A next to
    // Guardian's G — "A9 G9 P6 B5 S4 I3". The three-letter codes are all
    // distinct, which is the property the panel now depends on.
    const shorts = OPERATIVE_TYPES.map((t) => OPERATIVE_SHORT[t]);
    const codes = OPERATIVE_TYPES.map((t) => OPERATIVE_LABEL[t]);
    expect(new Set(codes).size).toBe(OPERATIVE_TYPES.length);
    expect(shorts).toContain('B'); // saboteur, not S
    expect(shorts.filter((s) => s === 'S')).toHaveLength(1);
  });
});

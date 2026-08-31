/**
 * A chronicle line remembers the room it was written in — permanently.
 *
 * The obvious implementation is to work the room out when the panel renders:
 * ask the store where the party is, label everything with that. It is cheaper,
 * it needs no new state, and it is wrong in a way that only shows up after the
 * party moves: the ENTIRE history relabels itself to wherever they stand now,
 * so a divider that said "Room 02" yesterday says "Room 07" today and the
 * account of the descent stops being an account.
 *
 * So the room is stamped at ABSORPTION and never touched again. These tests pin
 * that, because nothing else can: both implementations look identical for as
 * long as the party stays put, which is exactly how long a quick manual check
 * lasts.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import type { TerminalLine } from '../src/types/terminal.js';

const { terminalState } = await import('../src/services/TerminalStateManager.js');

let counter = 0;
function line(content: string, type: TerminalLine['type'] = 'system'): TerminalLine {
  counter += 1;
  return { id: `l${counter}`, type, content, timestamp: new Date() };
}

describe('chronicle room stamping', () => {
  beforeEach(() => {
    terminalState.clearDungeon();
    terminalState.initializeDungeon('run-1');
    terminalState.setNarrationRoom(null);
  });

  it('stamps each line with the room that was current when it arrived', () => {
    terminalState.setNarrationRoom({ index: 2, roomType: 'rest' });
    terminalState.appendOutput([line('the lamps are still lit')]);

    terminalState.setNarrationRoom({ index: 7, roomType: 'combat' });
    terminalState.appendOutput([line('something moves')]);

    const stamps = terminalState.dungeonNarration.value.map((l) => l.room?.index);
    expect(stamps).toEqual([2, 7]);
  });

  it('does not relabel earlier lines when the party moves on', () => {
    terminalState.setNarrationRoom({ index: 2, roomType: 'rest' });
    terminalState.appendOutput([line('the lamps are still lit')]);

    // The party walks to three further rooms without writing anything.
    terminalState.setNarrationRoom({ index: 3, roomType: 'combat' });
    terminalState.setNarrationRoom({ index: 4, roomType: 'encounter' });
    terminalState.setNarrationRoom({ index: 5, roomType: 'boss' });

    // The line about the lamps is still about room 2. This is the assertion a
    // render-time implementation fails: there it would now read 5.
    expect(terminalState.dungeonNarration.value[0]?.room?.index).toBe(2);
  });

  it('leaves the room null for lines absorbed before any room is known', () => {
    terminalState.appendOutput([line('the door closes behind you')]);
    expect(terminalState.dungeonNarration.value[0]?.room).toBeNull();
  });

  it('forgets the room when the run ends, so the next run cannot inherit it', () => {
    terminalState.setNarrationRoom({ index: 9, roomType: 'boss' });
    terminalState.clearDungeon();
    terminalState.initializeDungeon('run-2');
    terminalState.appendOutput([line('a new descent begins')]);

    expect(terminalState.dungeonNarration.value.at(-1)?.room).toBeNull();
  });
});

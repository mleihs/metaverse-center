/**
 * The chronicle carries everything the terminal carries.
 *
 * The bug these tests exist for: the graphical dungeon ran every command
 * through the same `parseAndExecute` pipeline as the terminal, received the
 * complete `TerminalLine[]` back, and had nowhere to render it. Rolls, check
 * results, loot and the server's refusals were produced and then dropped, so a
 * player who only used the graphical view decided without grounds and never
 * learned the outcome.
 *
 * The fix mirrors the stream at the SINK (`appendOutput`) rather than at any
 * source, and what is pinned here is exactly that property: whatever reaches
 * the terminal buffer reaches the chronicle. Publishing from the dungeon
 * dispatcher instead would have missed the echoed command (added by
 * `parseAndExecute`, outside the dispatcher) and the run-start banner
 * (`startDungeonRun`, which never enters it) – the two cases below stand in for
 * that whole class.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { terminalState } from '../src/services/TerminalStateManager.js';
import type { TerminalLine, TerminalLineType } from '../src/types/terminal.js';

let counter = 0;

function line(type: TerminalLineType, content: string): TerminalLine {
  counter += 1;
  return { id: `l-${counter}`, type, content, timestamp: new Date(0) };
}

/** A move that the server refused, as the pipeline actually produces it. */
const REFUSED_MOVE: TerminalLine[] = [
  line('command', 'move 4'),
  line('error', 'Cannot move in phase: rest'),
];

/** A skill check, as `formatSkillCheckResult` produces it – blank spacer lines
 *  and all, because those are part of what the sink has to carry. */
const SKILL_CHECK: TerminalLine[] = [
  line('command', 'interact 2'),
  line('system', '[INFILTRATOR CHECK – Modifier: +40]'),
  line('system', ''),
  line('system', 'Rolling... 94 (+40) = 100'),
  line('system', 'Result: 100 – SUCCESS'),
  line('response', 'The lock gives without a sound.'),
];

describe('dungeon chronicle parity', () => {
  beforeEach(() => {
    terminalState.clearDungeon();
    terminalState.clearOutput();
    terminalState.outputLines.value = [];
    terminalState.dungeonNarration.value = [];
  });

  it('records nothing before a descent begins', () => {
    terminalState.appendOutput([line('response', 'Bureau standby.')]);
    expect(terminalState.dungeonNarration.value).toHaveLength(0);
  });

  it('carries every line the terminal buffer receives', () => {
    terminalState.initializeDungeon('run-1', 'The Entropy');
    terminalState.appendOutput(SKILL_CHECK);

    const narrated = terminalState.dungeonNarration.value.map((l) => l.content);
    for (const source of SKILL_CHECK) {
      expect(narrated).toContain(source.content);
    }
    expect(terminalState.dungeonNarration.value).toHaveLength(SKILL_CHECK.length);
  });

  it('carries the echoed command, which the dungeon dispatcher never sees', () => {
    terminalState.initializeDungeon('run-1');
    terminalState.appendOutput(REFUSED_MOVE);

    const types = terminalState.dungeonNarration.value.map((l) => l.type);
    expect(types).toEqual(['command', 'error']);
  });

  it('excludes realtime feed chatter', () => {
    terminalState.initializeDungeon('run-1');
    terminalState.appendOutput([
      line('feed', '[INTEL] A courier left the northern gate.'),
      line('response', 'The chamber is quiet.'),
    ]);

    expect(terminalState.dungeonNarration.value.map((l) => l.type)).toEqual(['response']);
  });

  it('keeps the run’s last words, which arrive after the teardown', () => {
    terminalState.initializeDungeon('run-1');
    terminalState.appendOutput([line('command', 'retreat')]);

    // `_exitDungeon()` leaves dungeon mode before the handler's closing lines
    // are appended. Disarming there would drop exactly the loot the player
    // retreated to keep.
    terminalState.clearDungeon();
    terminalState.appendOutput([
      line('combat-system', 'RETREAT'),
      line('response', 'Recovered: Ledger fragment, Brass key'),
    ]);

    const narrated = terminalState.dungeonNarration.value.map((l) => l.content);
    expect(narrated).toContain('RETREAT');
    expect(narrated).toContain('Recovered: Ledger fragment, Brass key');
  });

  it('starts a fresh record for the next descent', () => {
    terminalState.initializeDungeon('run-1');
    terminalState.appendOutput([line('response', 'First descent.')]);
    terminalState.clearDungeon();

    terminalState.initializeDungeon('run-2');
    expect(terminalState.dungeonNarration.value).toHaveLength(0);

    terminalState.appendOutput([line('response', 'Second descent.')]);
    expect(terminalState.dungeonNarration.value.map((l) => l.content)).toEqual([
      'Second descent.',
    ]);
  });

  it('bounds the record so a long descent cannot grow without limit', () => {
    terminalState.initializeDungeon('run-1');
    for (let i = 0; i < 200; i++) {
      terminalState.appendOutput([line('response', `entry ${i}`)]);
    }
    const narration = terminalState.dungeonNarration.value;
    expect(narration.length).toBeLessThanOrEqual(120);
    // The tail is what survives: the newest entries, in order.
    expect(narration[narration.length - 1].content).toBe('entry 199');
  });
});

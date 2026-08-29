/**
 * A check's numbers travel as numbers, not as prose to be re-read.
 *
 * The terminal prints five lines to report a skill check ("[INFILTRATOR CHECK –
 * Modifier: +40]", a roll line, a bar, a result line). The graphical chronicle
 * draws a die instead. The tempting way to build the second surface is to parse
 * the first one's text — and that is exactly the coupling that let the two
 * dungeon views drift apart in the first place.
 *
 * So `formatSkillCheckResult` attaches the values it computed to the header
 * line as `meta`, and marks the lines a widget would replace. What is pinned
 * here: the meta agrees with the text (same numbers, one derivation), and the
 * terminal's output is untouched by the addition.
 */

import { describe, expect, it } from 'vitest';

import type { SkillCheckDetail } from '../src/types/dungeon.js';
import { formatSkillCheckResult } from '../src/utils/dungeon-formatters.js';

function check(overrides: Partial<SkillCheckDetail> = {}): SkillCheckDetail {
  return {
    aptitude: 'infiltrator',
    level: 8,
    chance: 73,
    roll: 94,
    result: 'success',
    breakdown: { adjustment: 40 },
    ...overrides,
  };
}

describe('formatSkillCheckResult', () => {
  it('hands the header line the numbers the text is built from', () => {
    const lines = formatSkillCheckResult(check(), 'The lock gives.', ['-8 Decay']);
    const header = lines.find((l) => l.meta?.kind === 'skill-check');

    expect(header).toBeDefined();
    expect(header?.meta).toEqual({
      kind: 'skill-check',
      aptitude: 'infiltrator',
      level: 8,
      chance: 73,
      roll: 94,
      adjustment: 40,
      effectiveRoll: 100,
      result: 'success',
    });
  });

  it('agrees with its own prose', () => {
    const lines = formatSkillCheckResult(check(), '', []);
    const header = lines.find((l) => l.meta?.kind === 'skill-check');
    const rollText = lines.find((l) => l.content.startsWith('Rolling'));

    // The one thing that must never diverge: the widget and the sentence
    // reporting different numbers for the same roll.
    expect(header?.meta?.kind).toBe('skill-check');
    if (header?.meta?.kind !== 'skill-check') throw new Error('unreachable');
    expect(rollText?.content).toBe(
      `Rolling... ${header.meta.roll} (+${header.meta.adjustment}) = ${header.meta.effectiveRoll}`,
    );
  });

  it('clamps the effective roll the way the printed line does', () => {
    const high = formatSkillCheckResult(check({ roll: 94 }), '', []);
    const low = formatSkillCheckResult(
      check({ roll: 3, breakdown: { adjustment: -40 }, result: 'fail' }),
      '',
      [],
    );

    const headerOf = (lines: ReturnType<typeof formatSkillCheckResult>) => {
      const m = lines.find((l) => l.meta?.kind === 'skill-check')?.meta;
      if (m?.kind !== 'skill-check') throw new Error('no check meta');
      return m;
    };

    expect(headerOf(high).effectiveRoll).toBe(100);
    expect(headerOf(low).effectiveRoll).toBe(1);
    expect(low.find((l) => l.content.startsWith('Rolling'))?.content).toBe(
      'Rolling... 3 (-40) = 1',
    );
  });

  it('marks every line a widget would replace, and nothing else', () => {
    const lines = formatSkillCheckResult(check(), 'The lock gives.', ['-8 Decay']);

    const marked = lines.filter((l) => l.meta?.kind === 'skill-check-part');
    // The block is the header plus five lines the widget subsumes: two
    // spacers, the roll, the bar and the verdict. Narrative and effects stay
    // unmarked, because a die does not say them.
    expect(marked).toHaveLength(5);
    expect(lines.find((l) => l.content === 'The lock gives.')?.meta).toBeUndefined();
    expect(lines.find((l) => l.content.includes('-8 Decay'))?.meta).toBeUndefined();
  });

  it('leaves the terminal reading exactly as before', () => {
    const lines = formatSkillCheckResult(check(), 'The lock gives.', ['-8 Decay']);

    expect(lines.map((l) => l.content)).toEqual([
      '[INFILTRATOR CHECK – Modifier: +40]',
      '',
      'Rolling... 94 (+40) = 100',
      '█'.repeat(10), // progressBar(100, 100)
      '',
      'Result: 100 – SUCCESS',
      '',
      'The lock gives.',
      '  → -8 Decay',
    ]);
  });

  it('reports a missing adjustment as no adjustment, not as NaN', () => {
    const lines = formatSkillCheckResult(
      check({ roll: 55, breakdown: {}, result: 'partial' }),
      '',
      [],
    );
    const meta = lines.find((l) => l.meta?.kind === 'skill-check')?.meta;
    if (meta?.kind !== 'skill-check') throw new Error('no check meta');

    expect(meta.adjustment).toBe(0);
    expect(meta.effectiveRoll).toBe(55);
    expect(meta.result).toBe('partial');
  });
});

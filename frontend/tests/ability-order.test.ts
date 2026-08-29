/**
 * The order abilities appear in on the combat bar.
 *
 * The bug these tests exist for is not a crash but an absence: there was no
 * order. The server builds the list by walking the agent's aptitude DICT and
 * appending universal abilities after the loop, so what a player read was the
 * iteration order of a hash map, with Basic Attack last for no reason other
 * than `extend` being called after the `for`.
 *
 * On a console with a thirty-second timer, position is the cheapest signal
 * there is. What is pinned here is that it now carries meaning: the first tile
 * of a group is one that can actually fire this round, and among those, the
 * one this particular operative is best at.
 */

import { describe, expect, it } from 'vitest';

import type { AbilityOption } from '../src/types/dungeon.js';
import { orderAbilities } from '../src/utils/ability-order.js';

function ability(overrides: Partial<AbilityOption> & { id: string }): AbilityOption {
  return {
    name_en: overrides.id,
    name_de: overrides.id,
    school: 'spy',
    description_en: '',
    description_de: '',
    check_info: null,
    cooldown_remaining: 0,
    is_ultimate: false,
    targets: 'single_enemy',
    ...overrides,
  } as AbilityOption;
}

const APTITUDES = { guardian: 9, spy: 4, saboteur: 1 };

describe('orderAbilities', () => {
  it('puts what the agent is best at first', () => {
    const ordered = orderAbilities(
      [
        ability({ id: 'sab', school: 'saboteur' }),
        ability({ id: 'spy', school: 'spy' }),
        ability({ id: 'grd', school: 'guardian' }),
      ],
      APTITUDES,
    );
    expect(ordered.map((a) => a.id)).toEqual(['grd', 'spy', 'sab']);
  });

  it('puts an ability that cannot fire behind one that can, however good', () => {
    // Guardian 9 is this agent's strongest school, but the ability is cooling.
    // A tile that cannot fire this round must not hold the first place the eye
    // lands — it stays visible (planning the next round needs it) but later.
    const ordered = orderAbilities(
      [
        ability({ id: 'grd-cooling', school: 'guardian', cooldown_remaining: 2 }),
        ability({ id: 'sab-ready', school: 'saboteur' }),
      ],
      APTITUDES,
    );
    expect(ordered.map((a) => a.id)).toEqual(['sab-ready', 'grd-cooling']);
  });

  it('keeps the universal fallback last among the ready', () => {
    const ordered = orderAbilities(
      [
        ability({ id: 'basic', school: 'universal' }),
        ability({ id: 'sab', school: 'saboteur' }),
        ability({ id: 'grd', school: 'guardian' }),
      ],
      APTITUDES,
    );
    expect(ordered.map((a) => a.id)).toEqual(['grd', 'sab', 'basic']);
  });

  it('still ranks readiness above the fallback rule', () => {
    // Basic Attack is ready, everything else is cooling: it leads, because a
    // usable fallback beats an unusable specialism.
    const ordered = orderAbilities(
      [
        ability({ id: 'grd', school: 'guardian', cooldown_remaining: 1 }),
        ability({ id: 'basic', school: 'universal' }),
      ],
      APTITUDES,
    );
    expect(ordered.map((a) => a.id)).toEqual(['basic', 'grd']);
  });

  it('treats a school the agent has no aptitude in as level 0', () => {
    const ordered = orderAbilities(
      [ability({ id: 'unknown', school: 'cartographer' }), ability({ id: 'sab', school: 'saboteur' })],
      APTITUDES,
    );
    expect(ordered.map((a) => a.id)).toEqual(['sab', 'unknown']);
  });

  it('leaves equals in the order the server sent them', () => {
    // Stability matters: two guardian abilities at the same readiness must not
    // swap places between renders, or the console would reshuffle under the
    // player's hand while the timer runs.
    const ordered = orderAbilities(
      [
        ability({ id: 'grd-a', school: 'guardian' }),
        ability({ id: 'grd-b', school: 'guardian' }),
        ability({ id: 'grd-c', school: 'guardian' }),
      ],
      APTITUDES,
    );
    expect(ordered.map((a) => a.id)).toEqual(['grd-a', 'grd-b', 'grd-c']);
  });

  it('does not mutate the array it was given', () => {
    // The input comes from a signal; sorting in place would rewrite the state
    // manager's own copy and make the order depend on how often it rendered.
    const input = [
      ability({ id: 'sab', school: 'saboteur' }),
      ability({ id: 'grd', school: 'guardian' }),
    ];
    const before = input.map((a) => a.id);
    orderAbilities(input, APTITUDES);
    expect(input.map((a) => a.id)).toEqual(before);
  });
});

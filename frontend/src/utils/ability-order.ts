/**
 * The order abilities appear in on the combat bar.
 *
 * WHY THIS EXISTS
 * There was no order. `get_agent_all_abilities` on the server walks the agent's
 * aptitude dict, extends the list per school, and appends the universal
 * abilities afterwards:
 *
 *     for school, level in aptitudes.items():
 *         if level > 0:
 *             result.extend(get_available_abilities(school, level, archetype))
 *     result.extend(get_available_abilities("universal", 0, archetype))
 *
 * So the sequence a player reads is the iteration order of a dictionary, and
 * Basic Attack lands last for no reason other than being appended after the
 * loop. That it happens to be the right place for a fallback is luck.
 *
 * For a console with a thirty-second timer, position is the cheapest signal
 * there is, and spending it on dictionary order wastes it. This module spends
 * it deliberately.
 *
 * THE ORDER, and why each step comes where it does
 *
 *   1. READY BEFORE COOLING. A tile that cannot fire this round must not
 *      occupy the first place the eye lands. Cooling abilities keep their
 *      place in the group rather than being hidden — knowing what will be
 *      available next round is part of planning the current one.
 *   2. THEN WHAT THIS OPERATIVE IS BEST AT. Descending by the agent's own
 *      aptitude in the ability's school. A Guardian 9 sees their guardian
 *      abilities first; the same tile sits elsewhere for a different agent,
 *      which is correct — the console belongs to one operative at a time.
 *   3. UNIVERSAL LAST. Basic Attack has no school and is the fallback every
 *      agent carries. It keeps the position it accidentally had, now because
 *      it is the fallback rather than because of `extend` order.
 *   4. TIES KEEP THEIR INCOMING ORDER. `Array.prototype.sort` is stable, so
 *      two abilities from the same school at the same readiness stay as the
 *      server sent them. Deterministic, and no invented ranking.
 *
 * WHAT IS DELIBERATELY NOT USED: the success chance. It exists only as prose
 * in `check_info` ("Spy 8: 73% success"), and parsing that string is exactly
 * the coupling that let the two dungeon surfaces drift apart in the first
 * place — one surface reading the other's sentences. If the odds should decide
 * the order, the number has to travel as a number; that is a DTO change, and
 * it is noted rather than faked.
 *
 * Pure: no DOM, no signals. See tests/ability-order.test.ts.
 */

import type { AbilityOption } from '../types/dungeon.js';

/** Abilities every agent carries, which belong to no school. */
const UNIVERSAL_SCHOOL = 'universal';

/**
 * Sort one agent's abilities into the order the console presents them.
 *
 * Does not mutate the input: the array arrives from a signal, and sorting it
 * in place would rewrite the state manager's own copy.
 */
export function orderAbilities(
  abilities: readonly AbilityOption[],
  aptitudes: Readonly<Record<string, number>>,
): AbilityOption[] {
  return [...abilities].sort((a, b) => {
    const readyA = a.cooldown_remaining === 0 ? 0 : 1;
    const readyB = b.cooldown_remaining === 0 ? 0 : 1;
    if (readyA !== readyB) return readyA - readyB;

    const universalA = a.school === UNIVERSAL_SCHOOL ? 1 : 0;
    const universalB = b.school === UNIVERSAL_SCHOOL ? 1 : 0;
    if (universalA !== universalB) return universalA - universalB;

    const levelA = aptitudes[a.school] ?? 0;
    const levelB = aptitudes[b.school] ?? 0;
    if (levelA !== levelB) return levelB - levelA;

    return 0;
  });
}

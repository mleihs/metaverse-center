/**
 * What an option demands, and who would step forward — decided once.
 *
 * The bug these tests exist for: the requirement line and the volunteer line
 * were computed inside `formatEncounterChoices`, which produces terminal lines.
 * A terminal player read
 *
 *     [2] Slip past the cordon
 *         Requires: Infiltrator 3
 *         Vera Sandoval volunteers (infiltrator 8)
 *
 * while a graphical player saw "[2] Slip past the cordon" and nothing else. The
 * same decision, made blind — no requirement, no volunteer, no sign that one
 * option was out of reach.
 *
 * Two properties are pinned here. First, the derivation is the SAME for both
 * surfaces, so the two can never name different volunteers. Second, moving it
 * out of the formatter left the terminal's output byte-for-byte as it was.
 */

import { describe, expect, it } from 'vitest';

import type { AgentCombatStateClient, EncounterChoiceClient } from '../src/types/dungeon.js';
import { describeChoices, findBestAgent } from '../src/utils/dungeon-encounter-choices.js';
import { formatEncounterChoices } from '../src/utils/dungeon-formatters.js';

function agent(
  name: string,
  aptitudes: Record<string, number>,
  overrides: Partial<AgentCombatStateClient> = {},
): AgentCombatStateClient {
  return {
    agent_id: `id-${name}`,
    agent_name: name,
    portrait_url: `https://example.test/${name}.png`,
    condition: 'healthy',
    stress: 0,
    stress_threshold: 'normal',
    mood: 0,
    active_buffs: [],
    active_debuffs: [],
    aptitudes,
    available_abilities: [],
    personality_summary: '',
    ...overrides,
  };
}

function choice(overrides: Partial<EncounterChoiceClient> = {}): EncounterChoiceClient {
  return {
    id: 'c1',
    label_en: 'Slip past the cordon',
    label_de: 'An der Absperrung vorbei',
    description_en: null,
    description_de: null,
    requires_aptitude: null,
    check_aptitude: null,
    check_difficulty: 0,
    ...overrides,
  };
}

const PARTY = [
  agent('Vera', { infiltrator: 8, guardian: 2 }),
  agent('Kesh', { infiltrator: 3, guardian: 6 }),
];

describe('findBestAgent', () => {
  it('picks the highest level in the aptitude', () => {
    expect(findBestAgent(PARTY, 'guardian')?.agent_name).toBe('Kesh');
    expect(findBestAgent(PARTY, 'infiltrator')?.agent_name).toBe('Vera');
  });

  it('skips the captured – they are not in the room', () => {
    const party = [agent('Vera', { infiltrator: 8 }, { condition: 'captured' }), PARTY[1]];
    expect(findBestAgent(party, 'infiltrator')?.agent_name).toBe('Kesh');
  });

  it('breaks ties on party order, so both surfaces name the same operative', () => {
    const tied = [agent('Vera', { spy: 5 }), agent('Kesh', { spy: 5 })];
    expect(findBestAgent(tied, 'spy')?.agent_name).toBe('Vera');
  });

  it('still returns someone when nobody has the aptitude at all', () => {
    // Level 0 is a real answer: the attempt is possible and likely to fail.
    expect(findBestAgent(PARTY, 'propagandist')?.agent_name).toBe('Vera');
  });
});

describe('describeChoices', () => {
  it('marks a requirement the party cannot meet, and keeps the option', () => {
    const [described] = describeChoices([choice({ requires_aptitude: { guardian: 9 } })], PARTY);

    expect(described.available).toBe(false);
    expect(described.requirements).toEqual([
      { aptitude: 'guardian', label: 'Guardian', level: 9, best: 6, met: false },
    ]);
  });

  it('meets a requirement the party clears', () => {
    const [described] = describeChoices([choice({ requires_aptitude: { infiltrator: 3 } })], PARTY);
    expect(described.available).toBe(true);
    expect(described.requirements[0].met).toBe(true);
  });

  it('names the volunteer and the difficulty for a checked option', () => {
    const [described] = describeChoices(
      [choice({ check_aptitude: 'infiltrator', check_difficulty: 40 })],
      PARTY,
    );

    expect(described.volunteer).toEqual({
      agentId: 'id-Vera',
      name: 'Vera',
      portraitUrl: 'https://example.test/Vera.png',
      aptitude: 'infiltrator',
      level: 8,
    });
    expect(described.difficulty).toBe(40);
  });

  it('has no volunteer and no difficulty when there is no check', () => {
    const [described] = describeChoices([choice()], PARTY);
    expect(described.volunteer).toBeNull();
    expect(described.difficulty).toBeNull();
  });

  it('numbers options the way the player addresses them', () => {
    const described = describeChoices([choice({ id: 'a' }), choice({ id: 'b' })], PARTY);
    expect(described.map((d) => d.index)).toEqual([1, 2]);
  });
});

describe('formatEncounterChoices', () => {
  it('reads exactly as it did before the derivation moved out', () => {
    const lines = formatEncounterChoices(
      'The cordon holds.\nTwo guards, bored.',
      [
        choice({
          id: 'a',
          label_en: 'Slip past the cordon',
          requires_aptitude: { infiltrator: 3 },
          check_aptitude: 'infiltrator',
          check_difficulty: 40,
        }),
        choice({ id: 'b', label_en: 'Walk up and talk' }),
      ],
      PARTY,
    );

    expect(lines.map((l) => l.content)).toEqual([
      'The cordon holds.',
      'Two guards, bored.',
      '',
      '[1] Slip past the cordon',
      '    Requires: Infiltrator 3',
      '    Vera volunteers (infiltrator 8)',
      '',
      '[2] Walk up and talk',
      '',
      'Type "interact <number>" to choose.',
    ]);
  });

  it('names the same volunteer the HUD would name', () => {
    const choices = [choice({ check_aptitude: 'guardian' })];
    const lines = formatEncounterChoices('x', choices, PARTY);
    const [described] = describeChoices(choices, PARTY);

    expect(lines.some((l) => l.content.includes(`${described.volunteer?.name} volunteers`))).toBe(
      true,
    );
  });
});

/**
 * The four pieces of Forge logic the redesign added or repaired.
 *
 * Each of these encodes a defect that had already shipped:
 *
 * `fanGeometry` — the staging hand used a fixed 20px overlap and a fixed 10°
 * angle. At the Forge's maximum of twelve operatives that laid 200px cards out
 * over 2180px inside a 1200px console, with no wrapping, so the outer cards
 * left the page. The geometry has to come from the width that exists.
 *
 * `conditionDots` / `conditionVariant` — two independent copies of the same
 * mapping lived in `BuildingCard`, and both dropped `pristine` (a value the
 * generator emits) into the `ruined` branch, so a flawless building drew an
 * empty gem and a neutral badge.
 *
 * `agentCardView` — draft agents carry no measured values at all, and the
 * client is forbidden from inventing them
 * (`frontend/scripts/lint-no-aptitude-baseline.sh`). The view must leave the
 * gems and pips empty rather than paint a baseline that looks like data.
 *
 * `estimateForgeCost` — the parameter sliders in phase I and the ignition
 * summary in phase IV must not be able to quote different numbers for the same
 * world.
 */

import { describe, expect, it } from 'vitest';

import {
  agentCardView,
  buildingCardView,
} from '../src/components/forge/forge-card-data.js';
import {
  estimateDraftingMinutes,
  estimateForgeCost,
  fanGeometry,
} from '../src/components/forge/forge-utils.js';
import type {
  ForgeAgentDraft,
  ForgeBuildingDraft,
} from '../src/services/api/ForgeApiService.js';
import { conditionDots, conditionVariant } from '../src/utils/building-condition.js';

const CONSOLE_WIDTH = 1150;

function agent(overrides: Partial<ForgeAgentDraft> = {}): ForgeAgentDraft {
  return {
    name: 'Ilse Vantar',
    gender: 'female',
    system: 'Gildenrat',
    primary_profession: 'Archivist',
    character: 'Guarded, precise.',
    background: 'Raised among the stacks.',
    ...overrides,
  };
}

function building(overrides: Partial<ForgeBuildingDraft> = {}): ForgeBuildingDraft {
  return {
    name: 'The Sunken Registry',
    building_type: 'record_hall',
    description: 'Ledgers stacked to the waterline.',
    building_condition: 'good',
    ...overrides,
  };
}

describe('fanGeometry', () => {
  it('keeps a full twelve-card hand inside the console it is given', () => {
    const count = 12;
    const geo = fanGeometry(count, CONSOLE_WIDTH);
    const width = count * geo.cardWidth - (count - 1) * geo.overlap;

    expect(geo.overflows).toBe(false);
    expect(width).toBeLessThanOrEqual(CONSOLE_WIDTH + 1);
  });

  it('never hides so much of a card that it stops being readable', () => {
    for (const count of [2, 5, 8, 12]) {
      const geo = fanGeometry(count, 400);
      const visibleFraction = (geo.cardWidth - geo.overlap) / geo.cardWidth;
      expect(visibleFraction).toBeGreaterThanOrEqual(0.42 - 1e-9);
    }
  });

  it('steps the card size down before it lets cards disappear', () => {
    expect(fanGeometry(4, CONSOLE_WIDTH).size).toBe('md');
    expect(fanGeometry(12, 700).size).toBe('sm');
  });

  it('tapers angle and arc as the hand grows, so twelve cards are not a wheel', () => {
    const few = fanGeometry(3, CONSOLE_WIDTH);
    const many = fanGeometry(12, CONSOLE_WIDTH);

    expect(many.rotStep).toBeLessThan(few.rotStep);
    expect(many.yStep).toBeLessThan(few.yStep);
    expect(few.rotStep).toBeLessThanOrEqual(10);
  });

  it('reports overflow instead of silently pushing the page sideways', () => {
    expect(fanGeometry(12, 200).overflows).toBe(true);
  });

  it('survives a container it has not measured yet', () => {
    const geo = fanGeometry(6, 0);
    expect(Number.isFinite(geo.overlap)).toBe(true);
    expect(geo.overflows).toBe(false);
  });

  it('lays a single card flat with no overlap', () => {
    expect(fanGeometry(1, CONSOLE_WIDTH).overlap).toBe(0);
  });
});

describe('building condition', () => {
  it('treats pristine as the best condition, not as a ruin', () => {
    expect(conditionDots('pristine')).toBe(3);
    expect(conditionVariant('pristine')).toBe('success');
  });

  it('maps the rest of the generator vocabulary', () => {
    expect(conditionDots('good')).toBe(3);
    expect(conditionDots('fair')).toBe(2);
    expect(conditionDots('poor')).toBe(1);
    expect(conditionDots('ruined')).toBe(0);
  });

  it('omits the gem rather than claiming zero for an unmeasured condition', () => {
    expect(conditionDots(undefined)).toBeNull();
    expect(conditionDots('')).toBeNull();
    expect(conditionDots('splendid')).toBeNull();
  });

  it('ignores case and padding the way the generator writes it', () => {
    expect(conditionDots('  Fair ')).toBe(2);
  });
});

describe('agentCardView', () => {
  it('leaves the stat slots empty because a draft has no measured values', () => {
    const view = agentCardView(agent());

    expect(view.conditionDots).toBeNull();
    expect(view.rarity).toBe('common');
    expect(view).not.toHaveProperty('aptitudes');
  });

  it('surfaces the faction, which the old card threw away', () => {
    expect(agentCardView(agent()).badges).toEqual([{ label: 'Gildenrat' }]);
  });

  it('omits the faction badge rather than showing an empty chip', () => {
    expect(agentCardView(agent({ system: '   ' })).badges).toEqual([]);
  });

  it('marks the card as an agent so it gets the agent anatomy', () => {
    expect(agentCardView(agent()).type).toBe('agent');
  });
});

describe('buildingCardView', () => {
  it('marks the card as a building, which every Forge call site had omitted', () => {
    expect(buildingCardView(building()).type).toBe('building');
  });

  it('drives the condition gem from the real generated value', () => {
    expect(buildingCardView(building({ building_condition: 'poor' })).conditionDots).toBe(1);
  });

  it('humanises the raw enum the generator emits', () => {
    expect(buildingCardView(building()).subtitle).toBe('Record Hall');
  });

  it('carries type and condition as badges', () => {
    const badges = buildingCardView(building()).badges;
    expect(badges).toHaveLength(2);
    expect(badges[1].variant).toBe('success');
  });
});

describe('estimateForgeCost', () => {
  it('counts a banner, one image per entity, and the illustrated lore plates', () => {
    // Mirrors img_total in forge_orchestrator_service.py.
    expect(estimateForgeCost(6, 7).totalImages).toBe(1 + 6 + 7 + 3);
  });

  it('charges one Forge token regardless of size', () => {
    expect(estimateForgeCost(3, 3).tokens).toBe(1);
    expect(estimateForgeCost(12, 12).tokens).toBe(1);
  });
});

describe('estimateDraftingMinutes', () => {
  it('adds up the per-entity durations that were actually measured', () => {
    const durations: Record<string, number> = {
      geography: 60_000,
      agents_entity: 30_000,
      buildings_entity: 30_000,
    };
    // 60s + 6*30s + 7*30s = 450s = 7.5 min, rounded to 8.
    expect(estimateDraftingMinutes(6, 7, (type) => durations[type] ?? 0)).toBe(8);
  });

  it('never promises less than a minute', () => {
    expect(estimateDraftingMinutes(3, 3, () => 0)).toBe(1);
  });
});

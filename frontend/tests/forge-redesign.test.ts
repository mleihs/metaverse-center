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

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  agentCardView,
  buildingCardView,
  cardFrameFromTheme,
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
import {
  activeCardFrame,
  cardFrameFromConfig,
  DEFAULT_CARD_FRAME,
} from '../src/services/card-frame.js';
import { THEME_PRESETS } from '../src/services/theme-presets.js';
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
  /**
   * The fan's real extent, as the browser lays it down: the layout row plus the
   * overhang each outer card gains by turning about its bottom centre.
   */
  function fanExtent(count: number, geo: ReturnType<typeof fanGeometry>): number {
    const rad = (((count - 1) / 2) * geo.rotStep * Math.PI) / 180;
    const half = geo.cardWidth / 2;
    const overhang = half * Math.cos(rad) + geo.cardWidth * (8 / 5) * Math.sin(rad) - half;
    return (geo.cardWidth - geo.overlap) * (count - 1) + geo.cardWidth + 2 * overhang;
  }

  it('keeps a full twelve-card hand inside the console it is given', () => {
    const count = 12;
    const geo = fanGeometry(count, CONSOLE_WIDTH);

    expect(geo.overflows).toBe(false);
    expect(fanExtent(count, geo)).toBeLessThanOrEqual(CONSOLE_WIDTH + 1);
  });

  it('counts the turned outer cards, not their flat width', () => {
    // Six 200px cards fit trivially against flat widths — and measured 1310px
    // on screen inside a 1150px console, because each card turns about its
    // bottom centre and its top corner swings well past the layout box.
    for (const count of [3, 6, 9, 12]) {
      const geo = fanGeometry(count, CONSOLE_WIDTH);
      expect(fanExtent(count, geo)).toBeLessThanOrEqual(CONSOLE_WIDTH + 1);
    }
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

/**
 * The card frame chain, which was dead from end to end.
 *
 * All ten presets in `theme-presets.ts` set `card_frame_texture`,
 * `card_frame_nameplate`, `card_frame_corners` and `card_frame_foil`, and the
 * Darkroom offers 22 options across them — but `THEME_TOKEN_MAP` had no entry
 * for any of them, so `applyConfig` skipped them silently and
 * `<velg-game-card>` never received a value. These tests pin both ends: the
 * service publishes what the config carries, and the Forge reads the same keys
 * out of a draft's theme.
 */
describe('card frame', () => {
  it('reads every frame key a theme config carries', () => {
    expect(
      cardFrameFromConfig({
        card_frame_texture: 'circuits',
        card_frame_nameplate: 'readout',
        card_frame_corners: 'crosshairs',
        card_frame_foil: 'phosphor',
      }),
    ).toEqual({
      texture: 'circuits',
      nameplate: 'readout',
      corners: 'crosshairs',
      foil: 'phosphor',
    });
  });

  it('falls back per key rather than dropping the whole frame', () => {
    const frame = cardFrameFromConfig({ card_frame_texture: 'rivets' });

    expect(frame.texture).toBe('rivets');
    expect(frame.nameplate).toBe(DEFAULT_CARD_FRAME.nameplate);
    expect(frame.corners).toBe(DEFAULT_CARD_FRAME.corners);
    expect(frame.foil).toBe(DEFAULT_CARD_FRAME.foil);
  });

  it('starts every unthemed context on the neutral frame', () => {
    expect(activeCardFrame.value).toEqual(DEFAULT_CARD_FRAME);
  });

  it('reads the same keys the Darkroom writes', () => {
    expect(
      cardFrameFromTheme({
        card_frame_texture: 'illumination',
        card_frame_nameplate: 'cartouche',
        card_frame_corners: 'floral',
        card_frame_foil: 'gilded',
      }),
    ).toEqual({
      texture: 'illumination',
      nameplate: 'cartouche',
      corners: 'floral',
      foil: 'gilded',
    });
  });

  it('gives an unthemed context the neutral frame', () => {
    expect(cardFrameFromTheme({})).toEqual(DEFAULT_CARD_FRAME);
  });

  it('carries every value the presets actually use', () => {
    // A preset naming a treatment the card has no CSS for would render as an
    // unstyled class, which is invisible rather than loud — so the values the
    // presets use are pinned against the sets the Darkroom offers.
    const offered = {
      texture: ['none', 'filigree', 'circuits', 'scanlines', 'rivets', 'illumination'],
      nameplate: ['terminal', 'banner', 'readout', 'plate', 'cartouche'],
      corners: ['none', 'tentacles', 'brackets', 'crosshairs', 'bolts', 'floral'],
      foil: ['holographic', 'aquatic', 'phosphor', 'patina', 'gilded'],
    };

    for (const preset of Object.values(THEME_PRESETS)) {
      const frame = cardFrameFromTheme(preset as Record<string, string>);
      expect(offered.texture).toContain(frame.texture);
      expect(offered.nameplate).toContain(frame.nameplate);
      expect(offered.corners).toContain(frame.corners);
      expect(offered.foil).toContain(frame.foil);
    }
  });
});

/**
 * Every option the Darkroom offers must have a rule that draws it.
 *
 * This is the failure mode the whole frame chain was built out of: a value that
 * reaches the card but has nothing behind it renders as an unstyled class —
 * silently identical to the neutral frame rather than visibly broken. A chip
 * added to the Darkroom without CSS would reintroduce exactly that, and no
 * other test would notice.
 */
describe('frame treatments have styles', () => {
  // Resolved from the Vitest root (frontend/) rather than import.meta.url,
  // which is not a file URL under the happy-dom environment.
  const CARD_CSS = readFileSync(
    resolve(process.cwd(), 'src/components/shared/VelgGameCard.ts'),
    'utf-8',
  );

  // The sets the Darkroom renders as chips (VelgForgeDarkroom._renderChipSelector).
  const OFFERED: Record<string, { prefix: string; values: string[] }> = {
    texture: {
      prefix: 'card--tex-',
      values: ['filigree', 'circuits', 'scanlines', 'rivets', 'illumination'],
    },
    nameplate: {
      prefix: 'card--plate-',
      values: ['terminal', 'banner', 'readout', 'plate', 'cartouche'],
    },
    corners: {
      prefix: 'card--corner-',
      values: ['tentacles', 'brackets', 'crosshairs', 'bolts', 'floral'],
    },
    foil: {
      prefix: 'card--foil-',
      values: ['aquatic', 'phosphor', 'patina', 'gilded'],
    },
  };

  for (const [dimension, { prefix, values }] of Object.entries(OFFERED)) {
    for (const value of values) {
      it(`draws ${dimension} "${value}"`, () => {
        expect(CARD_CSS).toContain(`.${prefix}${value}`);
      });
    }
  }

  it('leaves the neutral values without a rule, by design', () => {
    // `none` and the holographic default are the absence of a treatment: the
    // card renders nothing extra, so a rule for them would be dead weight.
    expect(CARD_CSS).not.toContain('.card--tex-none');
    expect(CARD_CSS).not.toContain('.card--corner-none {');
  });
});

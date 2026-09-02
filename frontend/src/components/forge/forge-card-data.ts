/**
 * Forge draft entities → `<velg-game-card>` view models.
 *
 * ## Why this file refuses to fill every slot on the card
 *
 * The card component can show two stat gems and six aptitude pips. A *drafted*
 * agent has none of the numbers they would need. `ForgeAgentDraft`
 * (`backend/models/forge.py`) carries name, gender, system (the faction), a
 * profession and two prose blocks — and nothing numeric. Aptitudes are assigned
 * to agents only after materialisation, and the Forge has never written a single
 * aptitude row; that is exactly what `frontend/scripts/lint-no-aptitude-baseline.sh`
 * was created to stop being papered over:
 *
 *   > In a simulation with no assigned aptitudes – every simulation the Forge has
 *   > ever generated – those copies painted "SPY 6 · GRD 6 · SAB 6" onto every card.
 *   > The fallback was the defect: it made missing data look like a measurement.
 *
 * So agent draft cards get no gems and no pips. What they do get is the one
 * classification the draft actually carries and the old code discarded: the
 * faction in `system`.
 *
 * Building drafts are the opposite case — `building_condition` is real, produced
 * per building by the generator, and maps onto the right-hand condition gem
 * exactly as the card was designed for.
 */
import { msg, str } from '@lit/localize';
import type { ForgeAgentDraft, ForgeBuildingDraft } from '../../services/api/ForgeApiService.js';
import { cardFrameFromConfig } from '../../services/card-frame.js';
import { conditionDots, conditionVariant } from '../../utils/building-condition.js';
import { t } from '../../utils/locale-fields.js';
import { professionLabel } from '../../utils/profession.js';
import { humanizeEnum } from '../../utils/text.js';
import type { CardBadge, CardRarity, CardType } from '../shared/VelgGameCard.js';

/** Everything a `<velg-game-card>` needs to render one Forge draft entity. */
export interface ForgeCardView {
  type: CardType;
  name: string;
  subtitle: string;
  description: string;
  badges: CardBadge[];
  rarity: CardRarity;
  /** Filled dots (0-3) for the condition gem, or `null` to omit the gem. */
  conditionDots: number | null;
}

/**
 * Draft agents carry no measured values, so every card is `common`.
 *
 * This is deliberate and load-bearing: rarity on this card is defined as a
 * readout of data (embassy status, aptitude ceiling, relationships), and a
 * draft has none of it. Deriving a rarity from the name — as the design
 * prototype does to have something to show — would put a gold foil on a card
 * whose "legendary" means nothing.
 */
const DRAFT_RARITY: CardRarity = 'common';

/** Map a drafted agent onto the card. */
export function agentCardView(agent: ForgeAgentDraft): ForgeCardView {
  const faction = agent.system?.trim();

  return {
    type: 'agent',
    name: agent.name,
    subtitle: professionLabel(t(agent, 'primary_profession')),
    description: t(agent, 'background'),
    badges: faction ? [{ label: faction }] : [],
    rarity: DRAFT_RARITY,
    conditionDots: null,
  };
}

/** Map a drafted building onto the card. */
export function buildingCardView(building: ForgeBuildingDraft): ForgeCardView {
  const badges: CardBadge[] = [];

  const type = t(building, 'building_type');
  if (type) badges.push({ label: humanizeEnum(type) });

  const condition = t(building, 'building_condition');
  if (condition) {
    badges.push({
      label: humanizeEnum(condition),
      variant: conditionVariant(building.building_condition),
    });
  }

  return {
    type: 'building',
    name: building.name,
    subtitle: humanizeEnum(type),
    description: t(building, 'description'),
    badges,
    rarity: DRAFT_RARITY,
    conditionDots: conditionDots(building.building_condition),
  };
}

/**
 * Theme values → the `--card-*` custom properties `<velg-game-card>` reads.
 *
 * The Darkroom is where the simulation's card look is decided, but its live
 * preview rendered a card in the platform's own palette, so every control on
 * that screen appeared to do nothing. Feeding the theme through these variables
 * makes the preview the thing being configured.
 *
 * Only keys the theme actually carries are emitted; the card's own `:host`
 * defaults cover the rest.
 */
export function cardThemeStyle(theme: Record<string, string>): string {
  const map: Record<string, string> = {
    '--card-frame-primary': theme.color_primary,
    '--card-frame-secondary': theme.color_secondary,
    '--card-bg': theme.color_surface,
    '--card-bg-deep': theme.color_background,
    '--card-text': theme.color_text,
    '--card-border-color': theme.color_accent,
    '--card-radius': theme.border_radius,
    '--card-font-heading': theme.font_heading,
    '--card-font-body': theme.font_body,
  };

  return Object.entries(map)
    .filter(([, value]) => Boolean(value))
    .map(([name, value]) => `${name}: ${value}`)
    .join('; ');
}

/**
 * The frame a Forge draft's theme describes.
 *
 * The Forge renders cards for a world that is not themed yet: the Darkroom
 * edits `theme_config` locally on a debounce, and the ignition screen shows a
 * simulation that does not exist. Both hand the card the frame directly instead
 * of waiting for `ThemeService` to publish one. Same mapping as the runtime
 * path, so a preview cannot disagree with the world it previews.
 */
export const cardFrameFromTheme = cardFrameFromConfig;

/** Accessible label for an empty deployment slot, numbered as it is on screen. */
export function emptySlotLabel(index: number, type: CardType): string {
  const position = index + 1;
  if (type === 'agent') return msg(str`Operative slot ${position} – still empty`);
  return msg(str`Structure slot ${position} – still empty`);
}

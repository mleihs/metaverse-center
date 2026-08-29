/**
 * Shared utilities for the Forge console components.
 * Extracted from duplicated implementations across forge phases.
 */
import { msg } from '@lit/localize';
import { html, type TemplateResult } from 'lit';

/**
 * Render a tooltip info bubble with descriptive text and an example.
 * Used by Astrolabe and Darkroom for form field annotations.
 * Requires `forgeInfoBubbleStyles` to be in the component's static styles.
 */
export function renderInfoBubble(text: string, example: string): TemplateResult {
  return html`
    <span class="info-bubble">
      <button class="info-bubble__trigger" type="button" aria-label=${msg('More info')}>i</button>
      <div class="info-bubble__panel">
        <p class="info-bubble__text">${text}</p>
        <p class="info-bubble__example">${example}</p>
      </div>
    </span>
  `;
}

/**
 * Calculate a fan-spread CSS transform for a card at a given index.
 * Cards spread outward from center with rotation and vertical offset.
 *
 * @param index - Card position in the array
 * @param total - Total number of cards
 * @param rotMultiplier - Degrees per position offset (default 12 for anchors, 10 for entity staging)
 * @param yMultiplier - Pixels per position offset (default 8 for anchors, 6 for entity staging)
 */
export function fanRotation(
  index: number,
  total: number,
  rotMultiplier = 12,
  yMultiplier = 8,
): string {
  const center = (total - 1) / 2;
  const rot = (index - center) * rotMultiplier;
  const y = Math.abs(index - center) * yMultiplier;
  return `rotateZ(${rot}deg) translateY(${y}px)`;
}

/** Card widths in px, keyed by the `size` attribute of `<velg-game-card>`. */
const CARD_WIDTH = { xs: 80, sm: 120, md: 200, lg: 280 } as const;

/** The card is 5:8, so its height is this multiple of its width. */
const CARD_ASPECT = 8 / 5;

/**
 * How far a turned card reaches past the edge of the space it is laid out in.
 *
 * Two things make this bigger than intuition suggests. A turned rectangle's
 * upright bounding box is wider than the rectangle, and because the card is
 * tall (5:8) the height term dominates: at 22 degrees a 200px card spans 304px.
 * And the fan turns each card about its **bottom centre**, not its middle, so
 * that extra width is not split evenly — the top corner swings out by the full
 * `h·sin θ` on one side while the other side tucks in.
 *
 * Measured on screen: six cards reached 1310px inside a 1150px console. Against
 * the flat width the fit calculation was 214px optimistic; against a
 * centre-rotation model it was still 110px out. This is the term that matches
 * what the browser actually lays down.
 */
function fanOverhang(cardWidth: number, degrees: number): number {
  const rad = (Math.abs(degrees) * Math.PI) / 180;
  const half = cardWidth / 2;
  return half * Math.cos(rad) + cardWidth * CARD_ASPECT * Math.sin(rad) - half;
}

/** Fraction of a card that must stay visible under its right-hand neighbour. */
const MIN_VISIBLE = 0.42;

/** The overlap the fan uses when there is width to spare — a hand, not a row. */
const RESTING_OVERLAP = 20;

export interface FanGeometry {
  /** `size` attribute to put on each `<velg-game-card>`. */
  size: 'sm' | 'md';
  /** Card width in px for the chosen size. */
  cardWidth: number;
  /** How far each card slides under its left neighbour, in px (>= 0). */
  overlap: number;
  /** Degrees of rotation between neighbouring cards. */
  rotStep: number;
  /** Pixels of vertical lift per step away from the centre of the fan. */
  yStep: number;
  /** True when even the smallest card at maximum overlap cannot fit. */
  overflows: boolean;
}

/**
 * Fit `count` cards into `availableWidth` as a fan.
 *
 * A fixed angle and a fixed overlap only look right at the count they were
 * tuned for. At the Forge's maximum of twelve operatives, 200px cards
 * overlapped by a constant 20px need 2180px — the hand ran roughly a thousand
 * pixels past a 1200px console with no wrapping, so the outer cards simply left
 * the page. Three things scale here instead:
 *
 * - **Overlap** is derived from the width that actually exists, never assumed,
 *   and is capped so at least {@link MIN_VISIBLE} of every card stays readable.
 * - **Card size** steps down from `md` to `sm` when `md` cannot fit inside that
 *   cap, rather than letting cards disappear behind each other.
 * - **Angle and arc** shrink as the count grows, so twelve cards read as a hand
 *   rather than a wheel.
 *
 * When even `sm` at maximum overlap will not fit, `overflows` is set: the caller
 * is expected to let the fan scroll horizontally in its own container instead of
 * pushing the page sideways.
 */
export function fanGeometry(count: number, availableWidth: number): FanGeometry {
  // Angle and arc taper with the count; the caps keep small hands expressive.
  const rotStep = Math.min(10, 52 / Math.max(1, count));
  const yStep = Math.min(5, 26 / Math.max(1, count));

  if (count <= 1) {
    return {
      size: 'md',
      cardWidth: CARD_WIDTH.md,
      overlap: 0,
      rotStep,
      yStep,
      overflows: false,
    };
  }

  // A zero or unmeasured container yields the resting fan rather than a
  // division by zero — the ResizeObserver corrects it on the next frame.
  const available = availableWidth > 0 ? availableWidth : Number.POSITIVE_INFINITY;

  // The outermost card is the most turned, and it is the one that decides
  // where the fan ends.
  const outerTilt = ((count - 1) / 2) * rotStep;

  for (const size of ['md', 'sm'] as const) {
    const cardWidth = CARD_WIDTH[size];
    const maxOverlap = cardWidth * (1 - MIN_VISIBLE);
    // Layout advances by (width - overlap) per card and ends with one full
    // card; both outer cards then reach past that box by their overhang.
    // extent = (w - overlap)·(n-1) + w + 2·overhang, solved for overlap.
    const overhang = fanOverhang(cardWidth, outerTilt);
    const needed = (cardWidth * count + 2 * overhang - available) / (count - 1);

    if (needed <= maxOverlap) {
      const overlap = Math.min(maxOverlap, Math.max(RESTING_OVERLAP, needed));
      return { size, cardWidth, overlap, rotStep, yStep, overflows: false };
    }
  }

  return {
    size: 'sm',
    cardWidth: CARD_WIDTH.sm,
    overlap: CARD_WIDTH.sm * (1 - MIN_VISIBLE),
    rotStep,
    yStep,
    overflows: true,
  };
}

/** CSS transform placing one card within a fan laid out by {@link fanGeometry}. */
export function fanTransform(index: number, total: number, geo: FanGeometry): string {
  return fanRotation(index, total, geo.rotStep, geo.yStep);
}

/**
 * Lore plates that carry an illustration.
 *
 * The lore prompt asks for "2-3 sections [with] an image_slug"
 * (`backend/services/forge_lore_service.py`), so the exact number is not known
 * until the sections come back. The upper bound is used so the preview never
 * promises fewer images than the run produces.
 */
const LORE_IMAGE_ESTIMATE = 3;

export interface ForgeCostEstimate {
  /** Illustrated lore plates, an upper bound. */
  loreImages: number;
  /** Banner + one portrait per agent + one per structure + lore plates. */
  totalImages: number;
  /** Forge tokens the ignition consumes. */
  tokens: number;
}

/**
 * What a run of this size will cost.
 *
 * Shared so the parameter sliders in phase I and the ignition summary in
 * phase IV cannot quote different numbers for the same world. The image count
 * mirrors `img_total` in `forge_orchestrator_service.py`: one banner, one image
 * per agent row, one per building row, plus the illustrated lore plates.
 */
export function estimateForgeCost(agentCount: number, buildingCount: number): ForgeCostEstimate {
  return {
    loreImages: LORE_IMAGE_ESTIMATE,
    totalImages: 1 + agentCount + buildingCount + LORE_IMAGE_ESTIMATE,
    tokens: 1,
  };
}

/**
 * Whole minutes the drafting phase is likely to take, rounded up.
 *
 * Built from the durations the state manager has actually measured on this
 * machine rather than from a constant, so the figure sharpens with use instead
 * of staying wrong.
 */
export function estimateDraftingMinutes(
  agentCount: number,
  buildingCount: number,
  durationFor: (type: string) => number,
): number {
  const ms =
    durationFor('geography') +
    agentCount * durationFor('agents_entity') +
    buildingCount * durationFor('buildings_entity');
  return Math.max(1, Math.round(ms / 60_000));
}

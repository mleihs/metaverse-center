import { css } from 'lit';
import { markerStatusStyles } from '../../shared/marker-styles.js';

/**
 * The status banner of the content-draft surface — one definition, three users.
 *
 * A banner is a tinted box with a status mark above its prose: "View-only
 * draft", "Publish failed", "Sweep complete". This module exists because that
 * block had been written out three times — `VelgContentDraftEditor`,
 * `VelgPublishBatchModal`, `VelgSweepOrphansModal` — down to the same comment,
 * in the very sweep whose commit message said it was applying the shared
 * treatment from `marker-styles.ts`. It was not; it was copying it.
 *
 * So the mark here IS `markerStatusStyles`. The banner supplies only what is
 * its own: the tint on the box, the gap below it, and the severity as a
 * `--marker-color`, which the mark reads back. Nothing about the mark's
 * typography is restated — that is what made three copies drift possible.
 *
 * Usage: `static styles = [draftBannerStyles, css\`…\`]`
 *
 * Markup:
 *   <div class="banner banner--warn">
 *     <p class="banner__title status-mark">…</p>
 *     <p>…</p>
 *   </div>
 *
 * Modifiers: `--warn`, `--error`, `--success`.
 * To tighten the gap below a banner: `.banner { --banner-gap: var(--space-3); }`
 */
export const draftBannerStyles = [
  markerStatusStyles,
  css`
    .banner {
      padding: var(--space-3) var(--space-4);
      margin-bottom: var(--banner-gap, var(--space-4));
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      line-height: 1.55;
    }

    /* The severity is stated twice on purpose: once as the tint of the box,
       once as the colour of the word that names it. The second is the only
       channel a colour-blind reader has. A third statement on the container's
       left edge is what the accent-bar sweep removed. */
    .banner--warn {
      background: color-mix(in srgb, var(--color-warning) 8%, transparent);
      --marker-color: var(--color-warning);
    }

    .banner--error {
      background: color-mix(in srgb, var(--color-danger) 10%, transparent);
      --marker-color: var(--color-danger);
    }

    .banner--success {
      background: color-mix(in srgb, var(--color-success) 10%, transparent);
      --marker-color: var(--color-success);
    }

    .banner__title {
      margin: 0 0 var(--space-1);
    }
  `,
];

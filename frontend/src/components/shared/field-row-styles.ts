import { css } from 'lit';

/**
 * field-row: the label + optional hint + control primitive duplicated
 * across ~8 admin components (`.row`, `.field`, `.controls-row`,
 * `.config-row`, `.cache-card`, `.config-item`) before this module.
 *
 * Hyphenated BEM (`.field-row__*`) avoids collision with
 * `forge-console-styles.ts` — that module already owns `.field__label`,
 * `.field__input`, `.field__textarea` for terminal forms.
 *
 * ## Variants
 *
 *   (default)           horizontal 2-col grid. Label auto-ish width, control
 *                       fills remaining space. Modal / dense-form pattern.
 *   .field-row--stacked vertical — label above control. Resonance form,
 *                       settings panels.
 *   .field-row--inline  single row flex (no forced alignment). Multi-item
 *                       layouts where the consumer decides spacing
 *                       (Cleanup tab has 4 inline children: label, input,
 *                       unit, button).
 *   .field-row--apart   adds `justify-content: space-between` to `--inline`.
 *                       Bluesky / Instagram "label on left, value on right"
 *                       toggle rows.
 *   .field-row--disabled 35% opacity + pointer-events none. Instagram cipher
 *                       sub-rows when the system is inactive.
 *
 * ## Sub-elements
 *
 *   .field-row__label        Brutalist uppercase, primary text color.
 *   .field-row__label--muted Smaller letter-spacing + muted color. Announcement
 *                            / Cleanup / Bluesky pattern.
 *   .field-row__label-group  Flex column that wraps a label + description pair
 *                            in a single grid/flex slot. Bluesky/Instagram
 *                            "label + inline description stacked on the left".
 *   .field-row__hint         Small monospace explanatory text below the label.
 *   .field-row__description  Secondary paragraph (wider, for cards).
 *   .field-row__control      Flex container for the actual control(s). Gaps
 *                            tuned via --tight modifier when needed.
 *
 * ## Designed-in tensions (documented so future sites don't fight the module)
 *
 * - `--inline` deliberately does NOT apply `justify-content: space-between`.
 *   AdminCleanupTab has 4 inline children (label, input, unit, scan button)
 *   where space-between would stretch the middle weirdly; the scan button
 *   uses its own `margin-left: auto` to push right. Consumers that want
 *   space-between add `--apart` explicitly.
 * - `--apart` relies on the control being sized to its content so the
 *   space-between gap has something to distribute. Full-width children
 *   (inputs/selects with `width: 100%` — notably `settingsStyles`
 *   `.settings-form__input` / `__textarea` / `__select`) will stretch
 *   across the flex item, collapsing the gap and pushing the label-group
 *   toward zero width. AdminForgeTab's BYOK panel hit this exact trap
 *   and had to locally override the select to `width: auto`. If you use
 *   `.settings-form__*` chrome inside a `--apart` row, either override
 *   the width or switch to an intrinsically-sized wrapper.
 * - Base `.field-row` includes `position: relative` so consumer z-index works
 *   (AdminInstagramTab's `.config-card::after` scanline overlay requires this).
 * - Mobile (640px) stacks horizontal/inline to single-column. Consumers that
 *   need different mobile behavior override locally — the shared rule wins
 *   only against components that accept it.
 */
export const fieldRowStyles = css`
  .field-row {
    display: grid;
    grid-template-columns: minmax(140px, 180px) 1fr;
    gap: var(--space-4);
    align-items: start;
    position: relative;
  }

  .field-row--stacked {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-1);
  }

  .field-row--inline {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .field-row--apart {
    justify-content: space-between;
  }

  .field-row--disabled {
    opacity: 0.35;
    pointer-events: none;
  }

  .field-row__label {
    font-family: var(--font-brutalist);
    font-weight: var(--font-bold);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: var(--tracking-widest);
    color: var(--color-text-primary);
    line-height: 1.4;
  }

  .field-row__label--muted {
    color: var(--color-text-muted);
    letter-spacing: var(--tracking-wide);
  }

  /* --secondary sits between primary and muted: used for form-field
     labels that should read as labels (not chrome) without the heavier
     primary weight. AdminResonanceFormModal's vertical form uses this. */
  .field-row__label--secondary {
    color: var(--color-text-secondary);
    letter-spacing: var(--tracking-wide);
  }

  .field-row__label-group {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
  }

  .field-row__hint {
    display: block;
    margin-top: var(--space-1);
    font-family: var(--font-mono, monospace);
    font-size: 10px;
    color: var(--color-text-muted);
    text-transform: none;
    letter-spacing: normal;
    font-weight: var(--font-normal);
    line-height: 1.5;
  }

  .field-row__description {
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
    line-height: 1.5;
    margin: 0;
  }

  .field-row__control {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
    min-width: 0;
  }

  .field-row__control--tight {
    gap: var(--space-2);
  }

  @media (max-width: 640px) {
    .field-row {
      grid-template-columns: 1fr;
      gap: var(--space-2);
    }
    .field-row--inline {
      flex-direction: column;
      align-items: stretch;
    }
  }
`;

/**
 * Card-wrapped variant — a bordered container whose internal structure
 * is (label, description, input-row). Used by AdminCachingTab today and
 * AdminHeartbeatTab's `.config-item` after partial migration.
 *
 * `.field-row-card--dirty` = yellow warning border (unsaved edit).
 * `.field-row-card--dirty-amber` = amber variant (forge-adjacent).
 * `.field-row-card--stacked` = flex column for tight internal layouts
 * (Heartbeat's `.config-item`).
 *
 * Consumers keep local classes for chrome unique to the card (number-input
 * styles, value-readout color variants, etc.) — this module provides only
 * the container + the generic label / description / input-row triplet.
 */
export const fieldRowCardStyles = css`
  .field-row-card {
    padding: var(--space-4);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease;
  }

  .field-row-card:hover {
    border-color: var(--color-text-muted);
  }

  .field-row-card--dirty {
    border-color: var(--color-warning);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-warning) 50%, transparent);
  }

  .field-row-card--dirty-amber {
    border-color: var(--color-accent-amber);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-accent-amber) 40%, transparent);
  }

  .field-row-card--stacked {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .field-row-card__label {
    font-family: var(--font-brutalist);
    font-size: var(--text-sm);
    font-weight: var(--font-bold);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--color-text-primary);
    margin: 0 0 var(--space-2) 0;
  }

  .field-row-card__description {
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
    line-height: 1.5;
    margin: 0 0 var(--space-3) 0;
  }

  .field-row-card__input-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
`;

/**
 * Opt-in row separators. Consumers that want the VelgOrphanSweeperSettingsModal
 * look (dashed horizontal lines between each `.field-row`) compose this.
 * Kept separate from `fieldRowStyles` so non-modal pages don't inherit
 * unwanted borders when they just need the layout primitive.
 */
export const fieldRowDividerStyles = css`
  .field-row--divided {
    padding: var(--space-4) 0;
    border-bottom: 1px solid
      var(--color-separator, color-mix(in srgb, var(--color-border) 70%, transparent));
  }

  .field-row--divided:last-of-type {
    border-bottom: none;
  }

  .field-row--dashed {
    border-bottom-style: dashed;
  }
`;

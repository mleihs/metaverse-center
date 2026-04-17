import { css } from 'lit';

/**
 * Shared utility for pairing a heading with an adjacent inline element
 * (typically a <velg-help-tip> or info bubble). Renders the pair as a single
 * flex-flow group so the parent header's `justify-content: space-between`
 * keeps leading elements together on the left and trailing elements on the right.
 *
 * Usage: static styles = [viewHeaderStyles, titleGroupStyles, css`...`];
 *
 * <header class="view__header">
 *   <div class="title-group">
 *     <h1 class="view__title">...</h1>
 *     <velg-help-tip topic="..." label="..."></velg-help-tip>
 *   </div>
 *   <button>...</button>
 * </header>
 */
export const titleGroupStyles = css`
  .title-group {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
  }
`;

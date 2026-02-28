import { css } from 'lit';

/**
 * Shared typography patterns for brutalist labels and section headings.
 *
 * Usage:
 *   static styles = [typographyStyles, css`...`];
 *
 *   <span class="label-brutalist">Label</span>
 */
export const typographyStyles = css`
  .label-brutalist {
    font-family: var(--font-brutalist);
    font-weight: var(--font-black);
    text-transform: uppercase;
    letter-spacing: var(--tracking-brutalist);
    font-size: var(--text-xs);
    color: var(--color-text-muted);
  }
`;

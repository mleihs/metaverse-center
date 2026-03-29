import { css } from 'lit';

/**
 * Accessibility utility styles for Shadow DOM components.
 *
 * Since global CSS cannot penetrate Shadow DOM, these utilities must be
 * imported as shared styles by any component that needs them.
 *
 * Usage:
 *   static styles = [a11yStyles, css`...`];
 *
 *   <span class="visually-hidden">${msg('Opens in new tab')}</span>
 */
export const a11yStyles = css`
  /* ── Screen-Reader Only ──────────────────────────────── */

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  /* ── Skip Link ───────────────────────────────────────── */

  .skip-link {
    position: absolute;
    top: -100%;
    left: var(--space-4);
    z-index: var(--z-top);
    padding: var(--space-2) var(--space-4);
    font-family: var(--font-brutalist);
    font-weight: var(--font-bold);
    font-size: var(--text-sm);
    text-transform: uppercase;
    letter-spacing: var(--tracking-brutalist);
    background: var(--color-primary);
    color: var(--color-text-inverse);
    text-decoration: none;
    border: var(--border-default);
    box-shadow: var(--shadow-md);
  }

  .skip-link:focus {
    top: var(--space-4);
  }

  /* ── Focus Outline (explicit opt-in for non-interactive) */

  .focusable:focus-visible {
    outline: none;
    box-shadow: var(--ring-focus);
  }

`;

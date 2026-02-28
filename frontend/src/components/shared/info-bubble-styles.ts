import { css, html } from 'lit';

/**
 * Shared info bubble styles + render helper for edit modals and settings panels.
 * Usage: static styles = [formStyles, infoBubbleStyles, css`...`];
 * Render: ${renderInfoBubble('Tooltip text')}
 */

/** Render an info bubble with tooltip text. */
export function renderInfoBubble(text: string) {
  return html`
    <span class="info-bubble">
      <span class="info-bubble__icon">i</span>
      <span class="info-bubble__tooltip">${text}</span>
    </span>
  `;
}
export const infoBubbleStyles = css`
  .info-bubble {
    position: relative;
    display: inline-flex;
    align-items: center;
    cursor: help;
    margin-left: var(--space-1);
  }

  .info-bubble__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    font-size: 10px;
    font-weight: 700;
    line-height: 1;
    background: var(--color-text-secondary);
    color: var(--color-surface);
    flex-shrink: 0;
    user-select: none;
  }

  .info-bubble__tooltip {
    display: none;
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    background: var(--color-text-primary);
    color: var(--color-surface);
    padding: var(--space-2) var(--space-3);
    font-family: var(--font-sans);
    font-size: var(--text-xs);
    font-weight: 400;
    text-transform: none;
    letter-spacing: 0;
    line-height: 1.5;
    white-space: normal;
    width: 220px;
    z-index: var(--z-tooltip);
    box-shadow: var(--shadow-md);
    pointer-events: none;
  }

  .info-bubble:hover .info-bubble__tooltip,
  .info-bubble:focus-within .info-bubble__tooltip {
    display: block;
  }
`;

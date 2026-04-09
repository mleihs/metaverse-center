import { css, html, nothing } from 'lit';

import './VelgTooltip.js';

/**
 * Shared info bubble styles + render helper for edit modals and settings panels.
 *
 * The tooltip is rendered via `<velg-tooltip>` which uses `position: fixed`
 * to escape `overflow: hidden` containers (modals, panels, cards).
 *
 * Usage:
 *   static styles = [infoBubbleStyles, css`...`];
 *
 * Basic:
 *   ${renderInfoBubble(msg('Tooltip text'))}
 *
 * With aria-describedby linkage:
 *   <input aria-describedby="tip-ttl" />
 *   ${renderInfoBubble(msg('Cache TTL in seconds'), 'tip-ttl')}
 */

/**
 * Render an info bubble with tooltip text.
 * Delegates to `<velg-tooltip>` for position: fixed overflow-safe rendering.
 * @param text  The tooltip content (should be wrapped in msg() by the caller)
 * @param id    Optional id for aria-describedby linkage (preserved on wrapper)
 */
export function renderInfoBubble(text: string, id?: string) {
  return html`
    <velg-tooltip content=${text} position="below">
      <span
        class="info-bubble"
        id=${id ?? nothing}
      >
        <span class="info-bubble__icon" tabindex="0" aria-label="Info">i</span>
      </span>
    </velg-tooltip>
  `;
}

export const infoBubbleStyles = css`
  .info-bubble {
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
    transition:
      background 0.2s ease,
      box-shadow 0.2s ease;
  }

  .info-bubble__icon:focus-visible {
    outline: 2px solid var(--color-accent-amber);
    outline-offset: 2px;
  }

  .info-bubble:hover .info-bubble__icon,
  .info-bubble:focus-within .info-bubble__icon {
    background: var(--color-accent-amber);
    box-shadow: 0 0 6px
      color-mix(in srgb, var(--color-accent-amber) 30%, transparent);
  }
`;

/**
 * VelgDispatchTicker -- Scrolling news ticker with auto-duplication.
 *
 * Accepts an array of items (text + optional color dot) and renders
 * a continuously scrolling horizontal ticker. Items are duplicated
 * internally for seamless looping. Respects prefers-reduced-motion
 * by wrapping items instead.
 *
 * Extracted from ChronicleFeed wire-ticker.
 *
 * @element velg-dispatch-ticker
 * @attr {number} speed - Scroll duration in seconds (default: 40)
 * @attr {boolean} pause-on-hover - Pause animation on host hover/focus
 *                                  (default: false; opt-in so existing
 *                                  callers keep their continuous scroll).
 */

import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';

export interface TickerItem {
  text: string;
  color?: string;
}

@customElement('velg-dispatch-ticker')
export class VelgDispatchTicker extends LitElement {
  static styles = css`
    :host {
      display: block;
      border-top: 1px solid var(--color-border);
      border-bottom: 1px solid var(--color-border);
      padding: var(--space-2-5, 10px) 0;
      overflow: hidden;
      position: relative;
    }

    .track {
      display: flex;
      gap: 48px;
      width: max-content;
      animation: ticker-scroll var(--_speed, 40s) linear infinite;
    }

    :host([pause-on-hover]:hover) .track,
    :host([pause-on-hover]:focus-within) .track {
      animation-play-state: paused;
    }

    .item {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 11px;
      letter-spacing: 1px;
      color: var(--color-text-muted);
      white-space: nowrap;
      flex-shrink: 0;
    }

    .dot {
      display: inline-block;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      margin-right: 8px;
      vertical-align: middle;
    }

    @keyframes ticker-scroll {
      from { transform: translateX(0); }
      to   { transform: translateX(-50%); }
    }

    @media (prefers-reduced-motion: reduce) {
      .track {
        animation: none;
        flex-wrap: wrap;
        justify-content: center;
        gap: 24px 48px;
      }
    }
  `;

  @property({ type: Array }) items: TickerItem[] = [];
  @property({ type: Number }) speed = 40;
  @property({ type: Boolean, attribute: 'pause-on-hover', reflect: true })
  pauseOnHover = false;

  protected render() {
    if (this.items.length === 0) return nothing;

    // Duplicate items for seamless loop
    const doubled = [...this.items, ...this.items];

    return html`
      <div class="track" style="--_speed: ${this.speed}s">
        ${doubled.map(
          (item) => html`
            <span class="item">
              ${
                item.color
                  ? html`<span class="dot" style="background: ${item.color}"></span>`
                  : nothing
              }
              ${item.text}
            </span>
          `,
        )}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-dispatch-ticker': VelgDispatchTicker;
  }
}

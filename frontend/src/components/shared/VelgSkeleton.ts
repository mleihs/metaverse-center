/**
 * Skeleton loading placeholder with shimmer animation.
 *
 * Variants: text, card, avatar, table-row.
 * Respects prefers-reduced-motion.
 */

import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

export type SkeletonVariant = 'text' | 'card' | 'avatar' | 'table-row';

@customElement('velg-skeleton')
export class VelgSkeleton extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .skeleton {
      background: linear-gradient(
        90deg,
        var(--color-surface-raised) 25%,
        var(--color-surface-hover, rgba(255, 255, 255, 0.06)) 50%,
        var(--color-surface-raised) 75%
      );
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }

    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    /* Text variant */
    .skeleton--text {
      height: 14px;
      width: var(--skeleton-width, 100%);
      border-radius: 2px;
    }

    /* Card variant */
    .skeleton--card {
      height: var(--skeleton-height, 120px);
      width: 100%;
      border-radius: 4px;
      border: var(--border-width-thin) solid var(--color-border-subtle, rgba(255, 255, 255, 0.04));
    }

    /* Avatar variant */
    .skeleton--avatar {
      width: var(--skeleton-size, 40px);
      height: var(--skeleton-size, 40px);
      border-radius: 50%;
    }

    /* Table row variant */
    .skeleton--table-row {
      display: flex;
      gap: var(--space-3);
      align-items: center;
      padding: var(--space-2-5) var(--space-3);
      border-bottom: var(--border-width-thin) solid var(--color-border-subtle, rgba(255, 255, 255, 0.04));
    }

    .skeleton--table-row .cell {
      height: 14px;
      background: inherit;
      background-size: inherit;
      animation: inherit;
      border-radius: 2px;
    }

    .skeleton--table-row .cell:nth-child(1) { width: 40px; flex-shrink: 0; }
    .skeleton--table-row .cell:nth-child(2) { flex: 2; }
    .skeleton--table-row .cell:nth-child(3) { flex: 1; }
    .skeleton--table-row .cell:nth-child(4) { flex: 1; }

    @media (prefers-reduced-motion: reduce) {
      .skeleton {
        animation: none;
        background: var(--color-surface-raised);
      }
    }
  `;

  @property({ type: String }) variant: SkeletonVariant = 'text';
  @property({ type: Number }) count = 1;

  protected render() {
    const items = Array.from({ length: this.count }, (_, i) => i);

    if (this.variant === 'table-row') {
      return html`
        ${items.map(
          () => html`
            <div class="skeleton skeleton--table-row">
              <div class="cell"></div>
              <div class="cell"></div>
              <div class="cell"></div>
              <div class="cell"></div>
            </div>
          `,
        )}
      `;
    }

    return html`
      ${items.map(
        () => html`<div class="skeleton skeleton--${this.variant}"></div>`,
      )}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-skeleton': VelgSkeleton;
  }
}

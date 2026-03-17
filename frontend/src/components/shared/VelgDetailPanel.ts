/**
 * Shared detail panel with loading/error/content states.
 *
 * Slots: header, default (body), footer.
 * Provides skeleton loading, error retry, and mobile-responsive sizing.
 */

import { msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';

export type DetailPanelState = 'loading' | 'error' | 'content';

@customElement('velg-detail-panel')
export class VelgDetailPanel extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .panel {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      padding: var(--space-5);
      border: var(--border-default);
      background: var(--color-surface);
    }

    /* Loading skeleton */
    .skeleton {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      padding: var(--space-5);
    }

    .skeleton__bar {
      height: 14px;
      background: linear-gradient(
        90deg,
        var(--color-surface-raised) 25%,
        var(--color-surface-hover, rgba(255, 255, 255, 0.06)) 50%,
        var(--color-surface-raised) 75%
      );
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: 2px;
    }

    .skeleton__bar--title {
      width: 60%;
      height: 20px;
    }

    .skeleton__bar--text {
      width: 90%;
    }

    .skeleton__bar--short {
      width: 40%;
    }

    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    /* Error state */
    .error {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-8) var(--space-5);
      text-align: center;
    }

    .error__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-base);
      text-transform: uppercase;
      color: var(--color-danger);
      margin: 0;
    }

    .error__message {
      font-family: var(--font-sans);
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
      margin: 0;
    }

    .error__retry {
      padding: var(--space-2) var(--space-4);
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      background: transparent;
      color: var(--color-primary);
      border: var(--border-width-default) solid var(--color-primary);
      cursor: pointer;
      transition: all var(--transition-fast);
      min-height: 44px;
    }

    .error__retry:hover {
      background: var(--color-primary);
      color: var(--color-surface);
    }

    /* Content slots */
    ::slotted([slot='header']) {
      border-bottom: var(--border-default);
      padding-bottom: var(--space-3);
    }

    ::slotted([slot='footer']) {
      border-top: var(--border-default);
      padding-top: var(--space-3);
    }

    @media (max-width: 640px) {
      .panel {
        padding: var(--space-3);
        gap: var(--space-3);
      }

      .skeleton {
        padding: var(--space-3);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .skeleton__bar {
        animation: none;
      }
    }
  `;

  @property({ type: String }) state: DetailPanelState = 'content';
  @property({ type: String }) errorMessage = '';

  private _handleRetry() {
    this.dispatchEvent(new CustomEvent('retry', { bubbles: true, composed: true }));
  }

  protected render() {
    if (this.state === 'loading') {
      return html`
        <div class="skeleton" role="status" aria-label="${msg('Loading')}">
          <div class="skeleton__bar skeleton__bar--title"></div>
          <div class="skeleton__bar skeleton__bar--text"></div>
          <div class="skeleton__bar skeleton__bar--text"></div>
          <div class="skeleton__bar skeleton__bar--short"></div>
        </div>
      `;
    }

    if (this.state === 'error') {
      return html`
        <div class="error" role="alert">
          <h3 class="error__title">${msg('Failed to load')}</h3>
          ${this.errorMessage
            ? html`<p class="error__message">${this.errorMessage}</p>`
            : nothing}
          <button class="error__retry" @click=${this._handleRetry}>
            ${msg('Retry')}
          </button>
        </div>
      `;
    }

    return html`
      <div class="panel">
        <slot name="header"></slot>
        <slot></slot>
        <slot name="footer"></slot>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-detail-panel': VelgDetailPanel;
  }
}

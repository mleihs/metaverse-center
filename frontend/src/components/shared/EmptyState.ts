import { localized, msg } from '@lit/localize';
import { css, html, LitElement, svg } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@localized()
@customElement('velg-empty-state')
export class VelgEmptyState extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--space-4);
      min-height: 200px;
      padding: var(--space-8);
      text-align: center;
    }

    .empty__icon {
      color: var(--color-text-muted);
      animation: empty-icon-enter 500ms var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1)) both;
    }

    .empty__icon svg {
      animation: empty-icon-idle 8s linear infinite 1s;
    }

    @keyframes empty-icon-enter {
      from {
        opacity: 0;
        transform: scale(0.5) rotate(-15deg);
      }
      to {
        opacity: 1;
        transform: scale(1) rotate(0);
      }
    }

    @keyframes empty-icon-idle {
      to { transform: rotate(360deg); }
    }

    .empty__message {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-base);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-secondary);
      max-width: 480px;
      animation: empty-fade-up 400ms var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)) both 150ms;
    }

    @keyframes empty-fade-up {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
    }

    .empty__cta {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-2-5) var(--space-5);
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      background: var(--color-primary);
      color: var(--color-text-inverse);
      border: var(--border-default);
      box-shadow: var(--shadow-md);
      cursor: pointer;
      transition: all var(--transition-fast);
      animation: empty-fade-up 400ms var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)) both 300ms;
    }

    .empty__cta:hover {
      transform: translate(-2px, -2px);
      box-shadow: var(--shadow-lg);
    }

    .empty__cta:active {
      transform: translate(0);
      box-shadow: var(--shadow-pressed);
    }
  `;

  @property({ type: String }) message = msg('Nothing here yet.');
  @property({ type: String, attribute: 'cta-label' }) ctaLabel = '';

  private _placeholderIcon() {
    return svg`
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4" />
        <path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" />
      </svg>
    `;
  }

  private _handleCtaClick(): void {
    this.dispatchEvent(
      new CustomEvent('cta-click', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  protected render() {
    return html`
      <div class="empty">
        <div class="empty__icon">${this._placeholderIcon()}</div>
        <div class="empty__message">${this.message}</div>
        ${
          this.ctaLabel
            ? html`
            <button class="empty__cta" @click=${this._handleCtaClick}>
              ${this.ctaLabel}
            </button>
          `
            : null
        }
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-empty-state': VelgEmptyState;
  }
}

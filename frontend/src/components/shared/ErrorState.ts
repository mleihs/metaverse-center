import { localized, msg } from '@lit/localize';
import { css, html, LitElement, svg } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@localized()
@customElement('velg-error-state')
export class VelgErrorState extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .error {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--space-4);
      min-height: 200px;
      padding: var(--space-8);
      text-align: center;
    }

    .error__icon {
      color: var(--color-danger);
    }

    .error__message {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-base);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-danger);
      max-width: 480px;
    }

    .error__retry {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-2) var(--space-4);
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      background: var(--color-surface-raised);
      color: var(--color-text-primary);
      border: var(--border-default);
      box-shadow: var(--shadow-md);
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .error__retry:hover {
      transform: translate(-2px, -2px);
      box-shadow: var(--shadow-lg);
    }

    .error__retry:active {
      transform: translate(0);
      box-shadow: var(--shadow-pressed);
    }
  `;

  @property({ type: String }) message = msg('An error occurred.');
  @property({ type: Boolean, attribute: 'show-retry' }) showRetry = false;

  private _alertIcon() {
    return svg`
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M12 9v4" />
        <path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0z" />
        <path d="M12 16h.01" />
      </svg>
    `;
  }

  private _handleRetry(): void {
    this.dispatchEvent(
      new CustomEvent('retry', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  protected render() {
    return html`
      <div class="error">
        <div class="error__icon">${this._alertIcon()}</div>
        <div class="error__message">${this.message}</div>
        ${
          this.showRetry
            ? html`
            <button class="error__retry" @click=${this._handleRetry}>
              ${msg('Retry')}
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
    'velg-error-state': VelgErrorState;
  }
}

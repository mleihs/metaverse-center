import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('velg-loading-state')
export class VelgLoadingState extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--space-4);
      min-height: 200px;
      padding: var(--space-8);
    }

    .loading__spinner {
      width: 40px;
      height: 40px;
      border: var(--border-width-thick) solid var(--color-border-light);
      border-top-color: var(--color-primary);
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    .loading__message {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-secondary);
    }
  `;

  @property({ type: String }) message = 'Loading...';

  protected render() {
    return html`
      <div class="loading">
        <div class="loading__spinner"></div>
        ${this.message ? html`<div class="loading__message">${this.message}</div>` : null}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-loading-state': VelgLoadingState;
  }
}

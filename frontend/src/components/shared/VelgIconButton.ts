import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('velg-icon-button')
export class VelgIconButton extends LitElement {
  static styles = css`
    :host {
      display: inline-flex;
    }

    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      padding: 0;
      background: transparent;
      border: var(--border-width-thin) solid var(--color-border-light);
      cursor: pointer;
      color: var(--color-text-secondary);
      transition: all var(--transition-fast);
    }

    button:hover {
      background: var(--color-surface-sunken);
      color: var(--color-text-primary);
    }

    :host([variant='danger']) button:hover {
      background: var(--color-danger-bg);
      color: var(--color-danger);
      border-color: var(--color-danger);
    }

    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      pointer-events: none;
    }
  `;

  @property({ type: String, reflect: true }) variant: 'default' | 'danger' = 'default';
  @property({ type: String }) label = '';
  @property({ type: Boolean }) disabled = false;

  private _handleClick(e: Event): void {
    e.stopPropagation();
    this.dispatchEvent(
      new CustomEvent('icon-click', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  protected render() {
    return html`
      <button
        @click=${this._handleClick}
        title=${this.label || nothing}
        aria-label=${this.label || nothing}
        ?disabled=${this.disabled}
      >
        <slot></slot>
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-icon-button': VelgIconButton;
  }
}

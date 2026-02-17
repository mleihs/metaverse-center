import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@localized()
@customElement('velg-side-panel')
export class VelgSidePanel extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .backdrop {
      position: fixed;
      inset: 0;
      z-index: var(--z-modal);
      display: flex;
      justify-content: flex-end;
      background: rgba(0, 0, 0, 0.4);
      opacity: 0;
      visibility: hidden;
      transition: opacity var(--transition-normal), visibility var(--transition-normal);
    }

    :host([open]) .backdrop {
      opacity: 1;
      visibility: visible;
    }

    .panel {
      width: 100%;
      max-width: var(--side-panel-width, 520px);
      height: 100%;
      display: flex;
      flex-direction: column;
      background: var(--color-surface-raised);
      border-left: var(--border-default);
      box-shadow: var(--shadow-xl);
      transform: translateX(100%);
      transition: transform var(--transition-normal);
      overflow: hidden;
    }

    :host([open]) .panel {
      transform: translateX(0);
    }

    .panel__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      padding: var(--space-4) var(--space-6);
      background: var(--color-surface-header);
      border-bottom: var(--border-medium);
      flex-shrink: 0;
    }

    .panel__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-lg);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      margin: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
      min-width: 0;
    }

    .panel__close {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      padding: 0;
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-lg);
      line-height: 1;
      background: transparent;
      border: var(--border-medium);
      cursor: pointer;
      transition: all var(--transition-fast);
      flex-shrink: 0;
    }

    .panel__close:hover {
      background: var(--color-surface-sunken);
    }

    .panel__body {
      flex: 1;
      overflow-y: auto;
    }

    .panel__footer {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: var(--space-3);
      padding: var(--space-4) var(--space-6);
      border-top: var(--border-medium);
      flex-shrink: 0;
    }
  `;

  @property({ type: Boolean, reflect: true }) open = false;
  @property({ type: String }) panelTitle = '';

  private _boundKeyDown: ((e: KeyboardEvent) => void) | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this._boundKeyDown = this._handleKeyDown.bind(this);
    document.addEventListener('keydown', this._boundKeyDown);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._boundKeyDown) {
      document.removeEventListener('keydown', this._boundKeyDown);
    }
  }

  private _handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && this.open) {
      this._emitClose();
    }
  }

  private _emitClose(): void {
    this.dispatchEvent(
      new CustomEvent('panel-close', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleBackdropClick(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('backdrop')) {
      this._emitClose();
    }
  }

  protected render() {
    return html`
      <div class="backdrop" @click=${this._handleBackdropClick}>
        <div class="panel">
          <div class="panel__header">
            <h2 class="panel__title">${this.panelTitle}</h2>
            <button
              class="panel__close"
              @click=${this._emitClose}
              aria-label=${msg('Close')}
            >
              X
            </button>
          </div>

          <div class="panel__body">
            <slot name="media"></slot>
            <slot name="content"></slot>
          </div>

          <div class="panel__footer">
            <slot name="footer"></slot>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-side-panel': VelgSidePanel;
  }
}

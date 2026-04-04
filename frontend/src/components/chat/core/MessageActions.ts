/**
 * MessageActions — Tactical command strip for chat message interactions.
 *
 * Floating toolbar that materializes on message hover, positioned at the
 * top-right corner of the message row. Glass-frosted backdrop with sharp
 * 1px borders — brutalist HUD element, not a soft tooltip.
 *
 * Actions by sender role:
 *   - Assistant: Copy, Thumbs Up, Thumbs Down, Regenerate
 *   - User: Copy, Edit (re-send from this point)
 *
 * Dispatches typed CustomEvents to parent:
 *   - `action-copy`       — clipboard write handled internally
 *   - `action-thumbs-up`  — requires backend feedback endpoint
 *   - `action-thumbs-down` — requires backend feedback endpoint
 *   - `action-regenerate` — parent re-triggers stream
 *   - `action-edit`       — parent re-populates composer
 *
 * Visibility controlled by parent (ChatMessage) via CSS on the host:
 *   opacity 0 → 1 on .row:hover / .row:focus-within.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import { icons } from '../../../utils/icons.js';

@localized()
@customElement('velg-message-actions')
export class MessageActions extends LitElement {
  static styles = css`
    :host {
      display: inline-flex;
      --_action-bg: color-mix(in srgb, var(--color-surface-raised) 85%, transparent);
      --_action-hover-bg: color-mix(in srgb, var(--color-primary) 12%, var(--color-surface-raised));
      --_action-border: var(--color-border);
      --_action-active-color: var(--color-primary);
      --_action-divider: color-mix(in srgb, var(--color-border) 50%, transparent);
    }

    .strip {
      display: inline-flex;
      align-items: center;
      background: var(--_action-bg);
      border: var(--border-width-thin) solid var(--_action-border);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      box-shadow: var(--shadow-xs);
    }

    .strip__btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      padding: 0;
      background: transparent;
      border: none;
      border-right: var(--border-width-thin) solid var(--_action-divider);
      cursor: pointer;
      color: var(--color-text-secondary);
      transition: all var(--transition-fast);
    }

    .strip__btn:last-child {
      border-right: none;
    }

    .strip__btn:hover {
      background: var(--_action-hover-bg);
      color: var(--color-text-primary);
    }

    .strip__btn:focus-visible {
      outline: none;
      box-shadow: var(--ring-focus);
      z-index: 1;
    }

    .strip__btn:active {
      transform: scale(0.92);
    }

    .strip__btn--active {
      color: var(--_action-active-color);
    }

    /* Copy-confirmed flash */
    .strip__btn--copied {
      color: var(--color-success);
    }

    @media (prefers-reduced-motion: reduce) {
      .strip__btn {
        transition-duration: 0.01ms !important;
      }
      .strip__btn:active {
        transform: none;
      }
    }

    /* Mobile: larger touch targets */
    @media (max-width: 640px) {
      .strip__btn {
        min-width: 36px;
        min-height: 36px;
      }
    }
  `;

  @property({ type: String }) messageId = '';
  @property({ type: String }) senderRole: 'user' | 'assistant' = 'user';
  @property({ type: String }) content = '';

  @state() private _copied = false;

  private _copyTimeout = 0;

  private async _handleCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.content);
      this._copied = true;
      clearTimeout(this._copyTimeout);
      this._copyTimeout = window.setTimeout(() => {
        this._copied = false;
      }, 1500);
    } catch {
      // Fallback: textarea select + copy for insecure contexts
      const ta = document.createElement('textarea');
      ta.value = this.content;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      this._copied = true;
      clearTimeout(this._copyTimeout);
      this._copyTimeout = window.setTimeout(() => {
        this._copied = false;
      }, 1500);
    }
    this._dispatch('action-copy');
  }

  private _handleThumbsUp(): void {
    this._dispatch('action-thumbs-up');
  }

  private _handleThumbsDown(): void {
    this._dispatch('action-thumbs-down');
  }

  private _handleRegenerate(): void {
    this._dispatch('action-regenerate');
  }

  private _handleEdit(): void {
    this._dispatch('action-edit');
  }

  private _dispatch(eventName: string): void {
    this.dispatchEvent(
      new CustomEvent(eventName, {
        detail: { messageId: this.messageId },
        bubbles: true,
        composed: true,
      }),
    );
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this._copyTimeout);
  }

  protected render() {
    const isAssistant = this.senderRole === 'assistant';

    return html`
      <div class="strip" role="toolbar" aria-label=${msg('Message actions')}>
        <button
          class="strip__btn ${this._copied ? 'strip__btn--copied' : ''}"
          @click=${this._handleCopy}
          title=${this._copied ? msg('Copied') : msg('Copy')}
          aria-label=${this._copied ? msg('Copied') : msg('Copy message')}
        >
          ${this._copied ? icons.checkCircle(14) : icons.copy(14)}
        </button>

        ${isAssistant
          ? html`
              <button
                class="strip__btn"
                @click=${this._handleThumbsUp}
                title=${msg('Good response')}
                aria-label=${msg('Rate as good response')}
              >
                ${icons.thumbsUp(14)}
              </button>
              <button
                class="strip__btn"
                @click=${this._handleThumbsDown}
                title=${msg('Poor response')}
                aria-label=${msg('Rate as poor response')}
              >
                ${icons.thumbsDown(14)}
              </button>
              <button
                class="strip__btn"
                @click=${this._handleRegenerate}
                title=${msg('Regenerate')}
                aria-label=${msg('Regenerate response')}
              >
                ${icons.refresh(14)}
              </button>
            `
          : html`
              <button
                class="strip__btn"
                @click=${this._handleEdit}
                title=${msg('Edit')}
                aria-label=${msg('Edit and resend')}
              >
                ${icons.edit(14)}
              </button>
            `}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-message-actions': MessageActions;
  }
}

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, svg } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';

const CHAR_LIMIT = 10000;
const CHAR_WARN_THRESHOLD = 8000;

@localized()
@customElement('velg-message-input')
export class VelgMessageInput extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .input-area {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      padding: var(--space-4);
      border-top: var(--border-medium);
      background: var(--color-surface-raised);
    }

    .input-area__row {
      display: flex;
      align-items: flex-end;
      gap: var(--space-3);
    }

    .input-area__textarea {
      flex: 1;
      min-height: 40px;
      max-height: 120px;
      padding: var(--space-2-5) var(--space-3);
      font-family: var(--font-sans);
      font-size: var(--text-sm);
      line-height: var(--leading-normal);
      color: var(--color-text-primary);
      background: var(--color-surface-sunken);
      border: var(--border-medium);
      resize: none;
      overflow-y: auto;
    }

    .input-area__textarea:focus {
      outline: none;
      border-color: var(--color-border-focus);
      box-shadow: var(--ring-focus);
    }

    .input-area__textarea::placeholder {
      color: var(--color-text-muted);
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
    }

    .input-area__textarea:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .input-area__send {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      min-width: 44px;
      height: 40px;
      padding: var(--space-2) var(--space-3);
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      background: var(--color-primary);
      color: var(--color-text-inverse);
      border: var(--border-default);
      box-shadow: var(--shadow-sm);
      cursor: pointer;
      transition: all var(--transition-fast);
      flex-shrink: 0;
    }

    .input-area__send:hover:not(:disabled) {
      transform: translate(-2px, -2px);
      box-shadow: var(--shadow-md);
    }

    .input-area__send:active:not(:disabled) {
      transform: translate(0);
      box-shadow: var(--shadow-pressed);
    }

    .input-area__send:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .input-area__send svg {
      flex-shrink: 0;
    }

    .input-area__footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 16px;
    }

    .input-area__hint {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    .input-area__counter {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    .input-area__counter--warn {
      color: var(--color-warning-hover);
    }

    .input-area__counter--limit {
      color: var(--color-text-danger);
    }
  `;

  @property({ type: Boolean }) disabled = false;

  @state() private _content = '';
  @state() private _focused = false;

  @query('.input-area__textarea') private _textarea!: HTMLTextAreaElement;

  private _handleInput(e: Event): void {
    const textarea = e.target as HTMLTextAreaElement;
    this._content = textarea.value;
    this._autoResize(textarea);
  }

  private _autoResize(textarea: HTMLTextAreaElement): void {
    textarea.style.height = 'auto';
    const maxHeight = 120;
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
  }

  private _handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this._send();
    }
  }

  private _send(): void {
    const content = this._content.trim();
    if (!content || this.disabled) return;

    this.dispatchEvent(
      new CustomEvent('send-message', {
        detail: { content },
        bubbles: true,
        composed: true,
      }),
    );

    this._content = '';
    if (this._textarea) {
      this._textarea.value = '';
      this._textarea.style.height = 'auto';
    }
  }

  private _renderSendIcon() {
    return svg`
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="square" stroke-linejoin="miter">
        <path d="M10 14l11 -11" />
        <path d="M21 3l-6.5 18a.55 .55 0 0 1 -1 0l-3.5 -7l-7 -3.5a.55 .55 0 0 1 0 -1l18 -6.5" />
      </svg>
    `;
  }

  protected render() {
    const charCount = this._content.length;
    const showCounter = charCount >= CHAR_WARN_THRESHOLD;
    const counterClass =
      charCount >= CHAR_LIMIT
        ? 'input-area__counter input-area__counter--limit'
        : charCount >= CHAR_WARN_THRESHOLD
          ? 'input-area__counter input-area__counter--warn'
          : 'input-area__counter';

    return html`
      <div class="input-area">
        <div class="input-area__row">
          <textarea
            class="input-area__textarea"
            .value=${this._content}
            placeholder=${msg('Type your message...')}
            ?disabled=${this.disabled}
            @input=${this._handleInput}
            @keydown=${this._handleKeyDown}
            @focus=${() => {
              this._focused = true;
            }}
            @blur=${() => {
              this._focused = false;
            }}
            rows="1"
          ></textarea>
          <button
            class="input-area__send"
            ?disabled=${this.disabled || !this._content.trim()}
            @click=${this._send}
          >
            ${this._renderSendIcon()}
          </button>
        </div>
        <div class="input-area__footer">
          <span class="input-area__hint">
            ${this._focused ? msg('Shift+Enter for line break') : ''}
          </span>
          ${showCounter ? html`<span class=${counterClass}>${charCount}/${CHAR_LIMIT}</span>` : null}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-message-input': VelgMessageInput;
  }
}

import { css, html, LitElement } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';

@customElement('velg-message-input')
export class VelgMessageInput extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .input-area {
      display: flex;
      align-items: flex-end;
      gap: var(--space-3);
      padding: var(--space-4);
      border-top: var(--border-medium);
      background: var(--color-surface-raised);
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
      min-width: 72px;
      height: 40px;
      padding: var(--space-2) var(--space-4);
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
  `;

  @property({ type: Boolean }) disabled = false;

  @state() private _content = '';

  @query('.input-area__textarea') private _textarea!: HTMLTextAreaElement;

  private _handleInput(e: Event): void {
    const textarea = e.target as HTMLTextAreaElement;
    this._content = textarea.value;
    this._autoResize(textarea);
  }

  private _autoResize(textarea: HTMLTextAreaElement): void {
    textarea.style.height = 'auto';
    const maxHeight = 120; // 4 lines approx
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

  protected render() {
    return html`
      <div class="input-area">
        <textarea
          class="input-area__textarea"
          .value=${this._content}
          placeholder="Type your message..."
          ?disabled=${this.disabled}
          @input=${this._handleInput}
          @keydown=${this._handleKeyDown}
          rows="1"
        ></textarea>
        <button
          class="input-area__send"
          ?disabled=${this.disabled || !this._content.trim()}
          @click=${this._send}
        >
          Send
        </button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-message-input': VelgMessageInput;
  }
}

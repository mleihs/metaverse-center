/**
 * ChatComposer — Unified message input for Agent Chat and Epoch Chat.
 *
 * Replaces MessageInput.ts + EpochChatPanel's inline input with:
 *   - CSS Grid auto-resize (no JS scrollHeight measurement)
 *   - Configurable char limit with warn/danger tiers
 *   - Shift+Enter hint via :focus-within CSS (no JS focus state)
 *   - Draft persistence integration (debounced saveDraft callback)
 *   - Proper aria-label on textarea
 *   - Sending state disables input + shows visual feedback
 *   - Typing event for realtime indicators
 *
 * Events:
 *   'send-message' — { content: string }
 *   'composer-typing' — (no detail, just a signal for debounced broadcast)
 *   'draft-change' — { content: string } (for parent to persist via chatStore)
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing, svg } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';

const DEFAULT_CHAR_LIMIT = 10000;
const DEFAULT_CHAR_WARN = 8000;

@localized()
@customElement('velg-chat-composer')
export class ChatComposer extends LitElement {
  static styles = css`
    :host {
      display: block;
      --_composer-bg: color-mix(in srgb, var(--color-surface-raised) 80%, transparent);
      --_composer-border: var(--color-border);
      --_composer-focus-border: var(--color-primary);
      --_composer-focus-glow: color-mix(in srgb, var(--color-primary) 20%, transparent);
    }

    /* --- Composer container --- */
    .composer {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      padding: var(--space-4);
      border-top: var(--border-medium);
      background: var(--_composer-bg);
      box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.15);
    }

    /* --- Input row --- */
    .composer__row {
      display: flex;
      align-items: flex-end;
      gap: var(--space-3);
    }

    /* --- CSS Grid auto-resize wrapper ---
     * The ::after pseudo mirrors textarea content in a hidden element.
     * Both occupy the same grid cell, so the cell grows with content.
     * This eliminates JS scrollHeight measurement entirely.
     */
    .composer__grow-wrap {
      display: grid;
      flex: 1;
      min-width: 0;
    }

    .composer__grow-wrap::after,
    .composer__grow-wrap > textarea {
      grid-area: 1 / 1 / 2 / 2;
      font: var(--text-sm) / var(--leading-normal) var(--font-body);
      padding: var(--space-2-5) var(--space-3);
      white-space: pre-wrap;
      word-wrap: break-word;
      min-width: 0;
    }

    .composer__grow-wrap::after {
      content: attr(data-value) ' ';
      visibility: hidden;
      pointer-events: none;
    }

    /* --- Textarea --- */
    .composer__textarea {
      min-height: 40px;
      max-height: 200px;
      overflow-y: auto;
      resize: none;
      color: var(--color-text-primary);
      background: var(--color-surface-sunken);
      border: var(--border-medium);
      font-family: var(--font-body);
      font-size: var(--text-sm);
      line-height: var(--leading-normal);
    }

    .composer__textarea:focus {
      outline: none;
      border-color: var(--_composer-focus-border);
      box-shadow: 0 0 0 3px var(--_composer-focus-glow);
    }

    .composer__textarea::placeholder {
      color: var(--color-text-muted);
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
    }

    .composer__textarea:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* --- Send button --- */
    .composer__send {
      display: flex;
      align-items: center;
      justify-content: center;
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
      transition:
        transform var(--transition-fast),
        box-shadow var(--transition-fast);
      flex-shrink: 0;
    }

    .composer__send:hover:not(:disabled) {
      transform: translate(-2px, -2px);
      box-shadow: var(--shadow-md);
    }

    .composer__send:active:not(:disabled) {
      transform: translate(0);
      box-shadow: var(--shadow-pressed);
    }

    .composer__send:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .composer__send svg {
      flex-shrink: 0;
    }

    /* Sending spinner replaces icon */
    .composer__send--sending {
      pointer-events: none;
    }

    .composer__spinner {
      width: 16px;
      height: 16px;
      border: 2px solid currentColor;
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 600ms linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* --- Footer row --- */
    .composer__footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 16px;
    }

    /* Shift+Enter hint — shown via :focus-within CSS, no JS state needed */
    .composer__hint {
      font-family: var(--font-mono);
      font-size: 10px;
      color: var(--color-text-muted);
      opacity: 0;
      transition: opacity var(--transition-fast);
    }

    .composer:focus-within .composer__hint {
      opacity: 1;
    }

    /* --- Char counter --- */
    .composer__counter {
      font-family: var(--font-mono);
      font-size: 10px;
      color: var(--color-text-muted);
      margin-left: auto;
    }

    .composer__counter--warn {
      color: var(--color-warning-hover);
    }

    .composer__counter--limit {
      color: var(--color-text-danger);
    }

    /* --- Responsive --- */
    @media (max-width: 640px) {
      .composer {
        padding: var(--space-3);
      }

      .composer__textarea {
        min-height: 44px;
        font-size: var(--text-base);
      }

      .composer__send {
        min-width: 44px;
        height: 44px;
      }
    }
  `;

  // --- Properties ---

  @property({ type: Number }) charLimit = DEFAULT_CHAR_LIMIT;
  @property({ type: Number }) charWarn = DEFAULT_CHAR_WARN;
  @property({ type: Boolean }) disabled = false;
  @property({ type: Boolean }) sending = false;
  @property({ type: String }) placeholder = '';
  /** Pre-fill content (e.g. restored draft). */
  @property({ type: String }) initialContent = '';

  // --- Internal state ---

  @state() private _content = '';
  @query('.composer__textarea') private _textarea!: HTMLTextAreaElement;

  private _draftTimeout = 0;

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  connectedCallback(): void {
    super.connectedCallback();
    if (this.initialContent) {
      this._content = this.initialContent;
    }
  }

  disconnectedCallback(): void {
    clearTimeout(this._draftTimeout);
    super.disconnectedCallback();
  }

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  private _handleInput(e: Event): void {
    const textarea = e.target as HTMLTextAreaElement;
    this._content = textarea.value;

    // Update the CSS Grid mirror for auto-resize
    const wrapper = textarea.parentElement;
    if (wrapper) {
      wrapper.dataset.value = textarea.value;
    }

    // Emit typing signal (parent debounces for realtime broadcast)
    this.dispatchEvent(
      new CustomEvent('composer-typing', { bubbles: true, composed: true }),
    );

    // Emit draft change (parent persists via chatStore.saveDraft)
    clearTimeout(this._draftTimeout);
    this._draftTimeout = window.setTimeout(() => {
      this.dispatchEvent(
        new CustomEvent('draft-change', {
          detail: { content: this._content },
          bubbles: true,
          composed: true,
        }),
      );
    }, 500);
  }

  private _handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this._send();
    }
  }

  private _send(): void {
    const content = this._content.trim();
    if (!content || this.disabled || this.sending) return;
    if (content.length > this.charLimit) return;

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
      // Reset CSS Grid mirror
      const wrapper = this._textarea.parentElement;
      if (wrapper) wrapper.dataset.value = '';
    }

    // Clear pending draft timeout
    clearTimeout(this._draftTimeout);
  }

  /** Public: focus the textarea (called by parent after conversation switch). */
  focus(): void {
    this._textarea?.focus();
  }

  /** Public: set content programmatically (e.g. draft restore). */
  setContent(text: string): void {
    this._content = text;
    if (this._textarea) {
      this._textarea.value = text;
      const wrapper = this._textarea.parentElement;
      if (wrapper) wrapper.dataset.value = text;
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  protected render() {
    const charCount = this._content.length;
    const showCounter = charCount >= this.charWarn;
    const isAtLimit = charCount >= this.charLimit;
    const isDisabled = this.disabled || this.sending;
    const canSend = !isDisabled && this._content.trim().length > 0 && !isAtLimit;

    const counterClasses = {
      'composer__counter': true,
      'composer__counter--warn': charCount >= this.charWarn && !isAtLimit,
      'composer__counter--limit': isAtLimit,
    };

    const placeholder = this.placeholder || msg('Type your message...');

    return html`
      <div class="composer">
        <div class="composer__row">
          <div class="composer__grow-wrap" data-value=${this._content}>
            <textarea
              class="composer__textarea"
              .value=${this._content}
              placeholder=${placeholder}
              aria-label=${placeholder}
              ?disabled=${isDisabled}
              @input=${this._handleInput}
              @keydown=${this._handleKeyDown}
              rows="1"
            ></textarea>
          </div>
          <button
            class=${classMap({
              'composer__send': true,
              'composer__send--sending': this.sending,
            })}
            ?disabled=${!canSend}
            @click=${this._send}
            aria-label=${msg('Send message')}
          >
            ${this.sending
              ? html`<div class="composer__spinner"></div>`
              : ChatComposer._sendIcon}
          </button>
        </div>
        <div class="composer__footer">
          <span class="composer__hint">${msg('Shift+Enter for line break')}</span>
          ${showCounter
            ? html`<span class=${classMap(counterClasses)}>${charCount}/${this.charLimit}</span>`
            : nothing}
        </div>
      </div>
    `;
  }

  // ---------------------------------------------------------------------------
  // Static icon (avoid re-creating SVG each render)
  // ---------------------------------------------------------------------------

  private static _sendIcon = svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="square" stroke-linejoin="miter"
      aria-hidden="true">
      <path d="M10 14l11 -11" />
      <path d="M21 3l-6.5 18a.55 .55 0 0 1 -1 0l-3.5 -7l-7 -3.5a.55 .55 0 0 1 0 -1l18 -6.5" />
    </svg>
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-chat-composer': ChatComposer;
  }
}

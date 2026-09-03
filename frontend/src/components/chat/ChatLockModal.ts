/**
 * ChatLockModal — die Passwortabfrage vor dem Verschluss.
 *
 * Drei Anlässe, ein Fenster:
 *   `lock`    — ein Gespräch unter Verschluss legen
 *   `unlock`  — den Verschluss dauerhaft aufheben
 *   `reveal`  — verschlossene Gespräche für diese Sitzung sichtbar machen
 *
 * Das Passwort verlässt die Komponente nur in dem Ereignis, das der Aufrufer
 * abholt; es wird nirgends zwischengespeichert und beim Schliessen gelöscht.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import '../shared/BaseModal.js';

export type ChatLockPurpose = 'lock' | 'unlock' | 'reveal';

@localized()
@customElement('velg-chat-lock-modal')
export class ChatLockModal extends LitElement {
  static styles = css`
    :host {
      display: contents;
    }

    .body {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      padding: var(--space-4);
    }

    .explain {
      font-family: var(--font-bureau, var(--font-prose));
      font-size: var(--text-sm);
      line-height: var(--leading-relaxed);
      color: var(--color-text-secondary);
      margin: 0;
    }

    .label {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      text-transform: var(--label-transform);
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-muted);
    }

    .input {
      width: 100%;
      box-sizing: border-box;
      /* 44 px, damit das Feld auf dem Telefon ein Beruehrungsziel ist und
         nicht nur eine Linie. */
      min-height: 44px;
      padding: var(--space-2) var(--space-3);
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      color: var(--color-text-primary);
      background: var(--color-surface-sunken);
      border: var(--border-medium);
    }

    .input:focus {
      outline: none;
      border-color: var(--color-border-focus);
      box-shadow: var(--ring-focus);
    }

    .error {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-danger);
      margin: 0;
    }

    .footer {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-2);
      padding: var(--space-3) var(--space-4);
      border-top: var(--border-light);
    }

    .btn {
      min-height: 36px;
      padding: var(--space-2) var(--space-4);
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xs);
      text-transform: var(--label-transform);
      letter-spacing: var(--tracking-brutalist);
      border: var(--border-width-default) solid var(--color-border);
      cursor: pointer;
      background: var(--color-surface-raised);
      color: var(--color-text-primary);
    }

    .btn--primary {
      background: var(--color-primary);
      color: var(--color-text-inverse);
      box-shadow: var(--shadow-xs);
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    @media (prefers-reduced-motion: reduce) {
      .btn {
        transition: none;
      }
    }
  `;

  @property({ type: Boolean, reflect: true }) open = false;
  @property({ type: String }) purpose: ChatLockPurpose = 'lock';
  /** Titel des betroffenen Gesprächs — nur zur Orientierung im Text. */
  @property({ type: String }) conversationTitle = '';
  /** Vom Aufrufer gesetzt, wenn der Server das Passwort abgelehnt hat. */
  @property({ type: Boolean }) rejected = false;
  @property({ type: Boolean }) busy = false;

  @state() private _password = '';
  @query('.input') private _input!: HTMLInputElement;

  protected updated(changed: Map<PropertyKey, unknown>): void {
    // Beim Öffnen den Fokus ins Feld, beim Schliessen das Passwort löschen.
    if (changed.has('open')) {
      if (this.open) {
        this.updateComplete.then(() => this._input?.focus());
      } else {
        this._password = '';
      }
    }
    // Nach einer Ablehnung bleibt der Fokus im Feld — die Spezifikation nennt
    // das ausdrücklich, und es ist richtig: wer sich vertippt hat, will
    // weitertippen, nicht erst wieder hinklicken.
    if (changed.has('rejected') && this.rejected) {
      this._password = '';
      this.updateComplete.then(() => this._input?.focus());
    }
  }

  private _title(): string {
    switch (this.purpose) {
      case 'unlock':
        return msg('Remove lock');
      case 'reveal':
        return msg('Unlock');
      default:
        return msg('Lock conversation');
    }
  }

  private _explain(): string {
    switch (this.purpose) {
      case 'unlock':
        return msg(
          'The conversation returns to the normal list and stays visible without a password.',
        );
      case 'reveal':
        return msg(
          'Locked conversations stay visible until you close this tab or lock them again.',
        );
      default:
        return msg(
          'The conversation disappears from the list. It stays readable to you after entering your password – this hides it from people looking at your screen, it does not encrypt it.',
        );
    }
  }

  private _submit(): void {
    if (!this._password || this.busy) return;
    this.dispatchEvent(
      new CustomEvent('lock-submit', {
        detail: { purpose: this.purpose, password: this._password },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _close(): void {
    this._password = '';
    this.dispatchEvent(new CustomEvent('lock-cancel', { bubbles: true, composed: true }));
  }

  protected render() {
    return html`
      <velg-base-modal
        ?open=${this.open}
        modalName="chat-lock"
        @modal-close=${this._close}
      >
        <span slot="header">${this._title()}</span>
        <div class="body">
          <p class="explain">${this._explain()}</p>
          <label class="label" for="lock-password">${msg('Account password')}</label>
          <input
            id="lock-password"
            class="input"
            type="password"
            autocomplete="current-password"
            .value=${this._password}
            ?disabled=${this.busy}
            @input=${(e: Event) => {
              this._password = (e.target as HTMLInputElement).value;
            }}
            @keydown=${(e: KeyboardEvent) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                this._submit();
              }
            }}
          />
          ${
            this.rejected
              ? html`<p class="error" role="alert">
                  ${msg('Password not recognised. The lock stays.')}
                </p>`
              : nothing
          }
        </div>
        <div slot="footer" class="footer">
          <button class="btn" @click=${this._close} ?disabled=${this.busy}>
            ${msg('Cancel')}
          </button>
          <button
            class="btn btn--primary"
            @click=${this._submit}
            ?disabled=${!this._password || this.busy}
          >
            ${this._title()}
          </button>
        </div>
      </velg-base-modal>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-chat-lock-modal': ChatLockModal;
  }
}

/**
 * Der Zustand „nicht freigegeben" — und die Klinke an dieser Tür.
 *
 * Auf Produktion ist das der Normalfall, nicht die Ausnahme: die Politik ist
 * `per_user`, und freigeschaltet war (gemessen am 02.09.2026) NIEMAND. Wer
 * hierher kam, sah bisher ein Formular, dessen „Speichern" mit 403 antwortete
 * — oder, nach der ersten Reparatur, einen ehrlichen Satz ohne Ausweg.
 *
 * Ein ehrlicher Satz ohne Ausweg ist besser als ein Formular, das lügt, aber
 * er ist immer noch eine Tür ohne Klinke. Das hier ist die Klinke.
 */
import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { forgeApi } from '../../services/api/ForgeApiService.js';
import { forgeStateManager } from '../../services/ForgeStateManager.js';
import { captureError } from '../../services/SentryService.js';
import { icons } from '../../utils/icons.js';
import { VelgToast } from '../shared/Toast.js';

@localized()
@customElement('velg-keyring-request')
export class VelgKeyringRequest extends LitElement {
  static styles = css`
    :host {
      display: block;
      --_gold: #a68a2e; /* lint-color-ok — Bureau-Gold wie terminal/BureauTerminal.ts */
      --_gold-bright: #f5c542; /* lint-color-ok */
      --_gold-border: #3d3200; /* lint-color-ok */
      --_gold-bg: #0a0a08; /* lint-color-ok */
    }

    .box {
      border: 1px dashed var(--color-border);
      background: var(--color-surface);
      padding: var(--space-5);
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }

    .title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-secondary);
      margin: 0;
    }

    .body {
      margin: 0;
      font-size: var(--text-sm);
      line-height: var(--leading-relaxed);
      color: var(--color-text-muted);
      max-width: 68ch;
    }

    .reason {
      width: 100%;
      box-sizing: border-box;
      min-height: 72px;
      padding: var(--space-2-5) var(--space-3);
      background: var(--color-surface-sunken);
      border: 1px solid var(--color-border);
      border-radius: var(--border-radius-none);
      color: var(--color-text-primary);
      font-family: var(--font-body, system-ui);
      font-size: var(--text-sm);
      resize: vertical;
    }

    .reason:focus-visible {
      outline: none;
      border-color: var(--color-accent-amber);
      box-shadow: 0 0 0 3px var(--color-accent-amber-glow);
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-3);
    }

    .ask {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      min-height: 40px;
      padding: var(--space-2) var(--space-4);
      background: transparent;
      border: 1px solid var(--_gold);
      color: var(--_gold-bright);
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      cursor: pointer;
      transition: background var(--transition-fast), color var(--transition-fast);
    }

    .ask:hover:not(:disabled) {
      background: var(--_gold);
      color: var(--_gold-bg);
    }

    .ask:focus-visible {
      outline: 2px solid var(--_gold-bright);
      outline-offset: 2px;
    }

    .ask:disabled {
      opacity: 0.4;
      cursor: default;
    }

    .chip {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-1-5) var(--space-3);
      border: 1px solid var(--_gold-border);
      background: var(--_gold-bg);
      color: var(--_gold-bright);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
    }

    .hint {
      font-family: var(--font-prose, serif);
      font-style: italic;
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }
  `;

  /** `none` heisst plattformweit aus — dann gibt es nichts zu beantragen. */
  @property({ type: String }) accessPolicy: 'none' | 'all' | 'per_user' = 'per_user';
  @property({ type: String }) requestStatus: 'pending' | 'approved' | 'rejected' | null = null;

  @state() private _reason = '';
  @state() private _sending = false;

  protected render() {
    const platformOff = this.accessPolicy === 'none';

    return html`
      <div class="box">
        <p class="title">${msg('Running on the project key')}</p>
        <p class="body">
          ${
            platformOff
              ? msg(
                  'Personal keys are switched off across the platform. Every request on this account runs on the project key, and nothing needs to be entered here.',
                )
              : msg(
                  'A personal key is not enabled for this account. Every request runs on the project key – that costs you nothing. If you would rather have your own provider account carry the calls, ask the Bureau.',
                )
          }
        </p>
        ${platformOff ? nothing : this._renderAsk()}
      </div>
    `;
  }

  private _renderAsk() {
    if (this.requestStatus === 'pending') {
      return html`
        <span class="chip">${icons.clipboard(12)} ${msg('Request filed with the Bureau · answer by letter')}</span>
      `;
    }

    return html`
      ${
        this.requestStatus === 'rejected'
          ? html`<p class="hint">
              ${msg('An earlier request was declined. You can ask again – a sentence on what you need it for helps.')}
            </p>`
          : nothing
      }
      <textarea
        class="reason"
        maxlength="1000"
        placeholder=${msg('What do you need it for? One sentence is enough.')}
        aria-label=${msg('Reason for the request')}
        .value=${this._reason}
        @input=${(e: InputEvent) => {
          this._reason = (e.target as HTMLTextAreaElement).value;
        }}
      ></textarea>
      <div class="actions">
        <button class="ask" ?disabled=${this._sending} @click=${this._send}>
          ${icons.diamond(12)} ${this._sending ? msg('Sending...') : msg('Request access')}
        </button>
        <span class="hint">${msg('An administrator decides; you get a letter either way.')}</span>
      </div>
    `;
  }

  private async _send(): Promise<void> {
    if (this._sending) return;
    this._sending = true;
    try {
      const resp = await forgeApi.requestBYOKAccess(this._reason.trim() || undefined);
      if (!resp.success) {
        VelgToast.error(
          (resp.error as { message?: string } | undefined)?.message ??
            msg('The request could not be filed.'),
        );
        return;
      }
      this._reason = '';
      // Der Zustand kommt aus der Geldbörse zurück, nicht aus einem lokalen
      // Merker: sonst zeigte ein Neuladen wieder das Formular, und der Mensch
      // schriebe denselben Antrag ein zweites Mal.
      await forgeStateManager.loadWallet();
      VelgToast.success(msg('Request filed. The Bureau answers by letter.'));
    } catch (err) {
      captureError(err, { source: 'VelgKeyringRequest._send' });
      VelgToast.error(msg('The request could not be filed.'));
    } finally {
      this._sending = false;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-keyring-request': VelgKeyringRequest;
  }
}

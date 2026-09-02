/**
 * Der Schlüsselbund — ein Register aus Anbieter-Karten, nicht ein Formular.
 *
 * Ersetzt `VelgByokPanel`. Was sich ändert, ist nicht nur die Form:
 *
 *  - EINE STIMME. Das alte Panel sprach Spionage („CLEARANCE: UNLIMITED",
 *    „operative credentials", „LANGUAGE RELAY") mitten in einer Akte, die
 *    Bureau spricht. Zwei Stimmen auf einer Seite lesen sich wie zwei
 *    Systeme.
 *  - KEINE VERSPRECHEN. „Unlimited" stand da, während der Anbieter weiter
 *    abrechnete und der Token-Erlass eine getrennte Admin-Entscheidung ist.
 *  - EINE KARTE JE ANBIETER, aus `KEY_PROVIDERS` erzeugt. Ein dritter
 *    Anbieter ist damit ein Eintrag in einem Feld und kein Umbau.
 *  - EIN WEG FÜR DIE, DIE NICHT DÜRFEN. Das ist auf Produktion die Mehrheit.
 *
 * Die Einfüge-Karte oben nimmt einen Schlüssel entgegen, ohne zu fragen,
 * wohin er gehört: das Präfix entscheidet. Wer einen Schlüssel aus einer Mail
 * kopiert, weiss selten auswendig, ob `r8_` Replicate oder OpenRouter ist —
 * die Software weiss es.
 */
import { localized, msg } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { forgeStateManager } from '../../services/ForgeStateManager.js';
import {
  detectProvider,
  KEY_PROVIDERS,
  type KeyProviderId,
  providerNames,
} from '../../utils/key-providers.js';
import { VelgToast } from '../shared/Toast.js';
import './VelgKeyChain.js';
import './VelgKeyringCard.js';
import './VelgKeyringRequest.js';

@localized()
@customElement('velg-keyring')
export class VelgKeyring extends SignalWatcher(LitElement) {
  static styles = css`
    :host {
      display: block;
      container-type: inline-size;
    }

    .keyring {
      display: flex;
      flex-direction: column;
      gap: var(--space-5);
    }

    .lede {
      margin: 0;
      max-width: 68ch;
      font-size: var(--text-sm);
      line-height: var(--leading-relaxed);
      color: var(--color-text-muted);
    }

    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: var(--space-4);
      align-items: start;
    }

    /* Ab drei Spalten wächst die Karte nicht weiter mit — eine Kennung und
       zwei Daten brauchen keine 700px. */
    @container (min-width: 1200px) {
      .cards {
        grid-template-columns: repeat(3, minmax(320px, 560px));
      }
    }

    @container (max-width: 767px) {
      .cards {
        grid-template-columns: 1fr;
      }
    }

    /* ── Einfüge-Karte ────────────────────────────────── */

    .paste {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      border: 1px dashed var(--color-border);
      background: var(--color-surface);
      padding: var(--space-4);
    }

    @container (min-width: 768px) and (max-width: 1199px) {
      .paste {
        grid-column: 1 / -1;
      }
    }

    .paste__title {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-muted);
    }

    .paste__input {
      width: 100%;
      box-sizing: border-box;
      min-height: 44px;
      padding: var(--space-2-5) var(--space-3);
      background: var(--color-surface-sunken);
      border: 1px solid var(--color-border);
      border-radius: var(--border-radius-none);
      color: var(--color-text-primary);
      font-family: var(--font-mono);
      font-size: var(--text-sm);
    }

    .paste__input:focus-visible {
      outline: none;
      border-color: var(--color-accent-amber);
      box-shadow: 0 0 0 3px var(--color-accent-amber-glow);
    }

    .paste__hint {
      font-size: var(--text-xs);
      line-height: var(--leading-relaxed);
      color: var(--color-text-muted);
      margin: 0;
    }

    .paste__error {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-danger);
      margin: 0;
    }

    .paste__note {
      font-family: var(--font-prose, serif);
      font-style: italic;
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      margin: auto 0 0;
    }

    /* ── Token-Erlass ─────────────────────────────────── */

    .waiver {
      border: 1px solid var(--color-accent-amber);
      background: color-mix(in srgb, var(--color-accent-amber) 6%, transparent);
      padding: var(--space-4);
      font-size: var(--text-sm);
      line-height: var(--leading-relaxed);
      color: var(--color-text-secondary);
    }

    .waiver__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-accent-amber);
      margin: 0 0 var(--space-1);
      font-size: var(--text-sm);
    }
  `;

  /** Entwurf je Anbieter, den die Einfüge-Karte in die Zielkarte legt. */
  @state() private _drafts: Partial<Record<KeyProviderId, string>> = {};
  @state() private _pasteError = '';

  protected render() {
    const byok = forgeStateManager.byokStatus.value;
    const allowed = byok.byok_allowed || byok.effective_bypass;

    if (!allowed) {
      return html`
        <velg-keyring-request
          accessPolicy=${byok.access_policy}
          .requestStatus=${byok.request_status}
        ></velg-keyring-request>
      `;
    }

    const hasPersonal = byok.has_openrouter_key || byok.has_replicate_key;

    return html`
      <div class="keyring">
        <p class="lede">
          ${msg('Stored AES-256 encrypted and never shown again. A key is only stored once the provider has confirmed it.')}
        </p>

        <velg-key-chain
          .worldKey=${false}
          .personalKey=${hasPersonal}
          .personalAllowed=${true}
        ></velg-key-chain>

        ${byok.effective_bypass ? this._renderWaiver() : nothing}

        <div class="cards">
          ${KEY_PROVIDERS.map(
            (p, i) => html`
              <velg-keyring-card
                style="--i: ${i}"
                providerId=${p.id}
                draft=${this._drafts[p.id] ?? ''}
                @draft-consumed=${() => this._clearDraft(p.id)}
              ></velg-keyring-card>
            `,
          )}
          ${this._renderPasteCard()}
        </div>
      </div>
    `;
  }

  private _renderWaiver() {
    return html`
      <div class="waiver">
        <p class="waiver__title">${msg('Forge tokens waived')}</p>
        ${msg('Forging costs this account no forge tokens while both keys are on file. The provider still bills you for the calls – the waiver is about the platform’s tokens, not about money.')}
      </div>
    `;
  }

  private _renderPasteCard() {
    return html`
      <div class="paste">
        <span class="paste__title">${msg('Paste a key')}</span>
        <input
          class="paste__input"
          type="password"
          autocomplete="off"
          spellcheck="false"
          placeholder=${msg('sk-or-v1-… or r8_…')}
          aria-label=${msg('Paste a key of any provider')}
          .value=${''}
          @input=${this._onPaste}
        />
        <p class="paste__hint">
          ${msg('Pasting is enough – the prefix decides. Whitespace is stripped.')}
        </p>
        ${this._pasteError ? html`<p class="paste__error">${this._pasteError}</p>` : nothing}
        <p class="paste__note">
          ${msg('Further providers appear here as soon as the platform carries them.')}
        </p>
      </div>
    `;
  }

  private _onPaste(e: InputEvent): void {
    const input = e.target as HTMLInputElement;
    const raw = input.value;
    if (!raw.trim()) {
      this._pasteError = '';
      return;
    }

    const provider = detectProvider(raw);
    if (!provider) {
      this._pasteError = msg(`No known provider. Supported: ${providerNames()}`);
      return;
    }

    // Das Feld wird sofort geleert: der Schlüssel liegt jetzt in der Karte,
    // und zwei Felder mit demselben Geheimnis sind eines zu viel.
    input.value = '';
    this._pasteError = '';
    this._drafts = { ...this._drafts, [provider.id]: raw.replace(/\s+/g, '') };
    VelgToast.info(
      msg(`${provider.name} recognised – the key is waiting in its card for a check.`),
    );
  }

  private _clearDraft(id: KeyProviderId): void {
    if (!this._drafts[id]) return;
    const next = { ...this._drafts };
    delete next[id];
    this._drafts = next;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-keyring': VelgKeyring;
  }
}

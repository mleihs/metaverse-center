/**
 * Dem Bureau melden — der eine Weg, der die Welt des Architekten verlässt.
 *
 * Schritt 4 aus `handoff/schleuse-event-intake.md`. Ein Architekt kann mit
 * einem Signal zweierlei tun: es zu einem Ereignis SEINER Welt machen
 * („nur hier", Kammer ②), oder es dem Bureau vorlegen. Nur das zweite verlässt
 * seine Welt, und er entscheidet dabei NICHTS — er legt vor. Ob daraus eine
 * Resonanz wird, die alle Welten trifft, entscheidet das Bureau.
 *
 * ── WARUM HIER KLASSIFIZIERT WIRD ───────────────────────────────────────────
 *
 * Das Modal fragt nach Kategorie und Wucht, obwohl der Bauplan nur eine
 * Begründung vorsieht. Der Grund ist gemessen: ein gebrowster Artikel trägt
 * KEINE Kategorie und KEINE Magnitude (`fromBrowseArticle` setzt
 * `category: null, magnitude: 0`), und beide sind im Aufruf Pflicht — die
 * Kategorie, weil daraus die Resonanz-Signatur folgt, die Magnitude, weil eine
 * CHECK-Bedingung sie zwischen 0.10 und 1.00 verlangt (Migration 084).
 * Vorbelegt werden sie aus dem Signal, wo es welche gibt; sonst muss der
 * Mensch sie setzen. Das ist keine Formularlast, sondern die Meldung selbst:
 * wer etwas vorlegt, sagt auch, als was.
 *
 * ── WAS HIER NICHT STEHT ────────────────────────────────────────────────────
 *
 * Der Bauplan will die Zeile „Für deine Welt: X effektiv". Die Zahl kommt aus
 * `fn_get_adaptive_susceptibility` und ist über einen Endpunkt erreichbar, der
 * Plattform-Admins vorbehalten ist — ein Architekt hat sie nicht. Statt einer
 * geratenen Zahl steht der wahre Satz: dass die Wirkung das Bureau berechnet.
 */

import { localized, msg, str } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { intakeApi } from '../../services/api/index.js';
import { intakeState } from '../../services/IntakeStateManager.js';
import { captureError } from '../../services/SentryService.js';
import type { SourceCategory } from '../../types/index.js';
import { CATEGORY_RESONANCE, type IntakeSignal, transformRequestOf } from '../../types/intake.js';
import { icons } from '../../utils/icons.js';
import { VelgToast } from '../shared/Toast.js';
import '../shared/BaseModal.js';
import { archetypeLabel } from './intake-labels.js';
import { bureauPaletteStyles, intakeControlStyles } from './intake-styles.js';

/** Die acht Kategorien, in der Reihenfolge der Mapping-Tabelle. */
const CATEGORIES = Object.keys(CATEGORY_RESONANCE) as SourceCategory[];

/** Vorgabe, wenn das Signal keine Magnitude mitbringt. */
const DEFAULT_MAGNITUDE = 0.5;

@localized()
@customElement('velg-intake-flag-modal')
export class VelgIntakeFlagModal extends SignalWatcher(LitElement) {
  static styles = [
    intakeControlStyles,
    bureauPaletteStyles,
    css`
      :host {
        display: block;
        --modal-max-width: min(560px, calc(100vw - 2 * var(--stage-gutter)));
      }

      .body {
        display: flex;
        flex-direction: column;
        gap: var(--space-5);
      }

      .headline {
        font-family: var(--font-prose);
        font-weight: var(--font-semibold);
        font-size: var(--text-md);
        line-height: var(--leading-tight);
        color: var(--color-text-primary);
        margin: 0;
        text-wrap: pretty;
      }

      .meta {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        flex-wrap: wrap;
      }

      .arch {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        letter-spacing: var(--tracking-wider);
        text-transform: var(--label-transform);
        color: var(--color-accent-amber-readable);
      }

      .field {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }

      .chips {
        display: flex;
        gap: var(--space-1-5);
        flex-wrap: wrap;
      }

      .mag {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        flex-wrap: wrap;
      }

      .mag__segs {
        display: flex;
        align-items: flex-end;
        gap: 3px;
        block-size: 22px;
      }

      .mag__seg {
        inline-size: 8px;
        background: var(--color-border);
        border: none;
        padding: 0;
        cursor: pointer;
      }

      .mag__seg--on {
        background: var(--color-accent-amber);
      }

      .mag__seg:focus-visible {
        outline: none;
        box-shadow: var(--ring-focus);
      }

      .mag__value {
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: var(--text-sm);
        color: var(--color-accent-amber-readable);
        font-variant-numeric: tabular-nums;
      }

      textarea {
        inline-size: 100%;
        box-sizing: border-box;
        min-block-size: 96px;
        padding: var(--space-2-5);
        font-family: var(--font-prose);
        font-size: var(--text-sm);
        line-height: var(--leading-relaxed);
        color: var(--color-text-primary);
        background: var(--color-surface);
        border: var(--border-width-thin) solid var(--color-border);
        resize: vertical;
      }

      textarea:focus-visible {
        outline: none;
        border-color: var(--color-accent-amber);
      }

      .fail {
        font-family: var(--font-mono);
        font-size: var(--text-sm);
        color: var(--color-danger);
        margin: 0;
      }

      .foot {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        flex-wrap: wrap;
      }

      .foot__spacer {
        margin-inline-start: auto;
      }

      /*
       * Der Melden-Knopf trägt das Gold des Bureaus, nicht das Bernstein der
       * Plattform. Das ist keine Dekoration: er ist der einzige Knopf dieser
       * Oberfläche, dessen Wirkung woanders eintritt.
       */
      .act--bureau {
        border-color: var(--_bureau-border);
        color: var(--_bureau-text);
        background: var(--_bureau-screen);
      }

      .act--bureau:hover:not(:disabled),
      .act--bureau:focus-visible:not(:disabled) {
        border-color: var(--_bureau-text);
        color: var(--_bureau-text);
      }
    `,
  ];

  @property({ type: Boolean, reflect: true }) open = false;
  @property({ type: String }) simulationId = '';
  @property({ type: String, attribute: 'signal-id' }) signalId = '';

  @state() private _category: SourceCategory | null = null;
  @state() private _magnitude = DEFAULT_MAGNITUDE;
  @state() private _reason = '';
  @state() private _sending = false;
  @state() private _error: string | null = null;

  protected override willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (!changed.has('open') || !this.open) return;
    const signal = this._signal();
    this._category = signal?.category ?? null;
    this._magnitude = signal?.magnitude || DEFAULT_MAGNITUDE;
    this._reason = '';
    this._error = null;
    this._sending = false;
  }

  private _signal(): IntakeSignal | undefined {
    if (!this.signalId) return undefined;
    return intakeState.get(this.signalId);
  }

  private _close(): void {
    this.dispatchEvent(new CustomEvent('modal-close', { bubbles: true, composed: true }));
  }

  private async _send(): Promise<void> {
    const signal = this._signal();
    if (!signal || !this._category || !this._reason.trim()) return;

    this._sending = true;
    this._error = null;
    const request = transformRequestOf(signal);

    try {
      const resp = await intakeApi.flag(this.simulationId, {
        title: request.article_name,
        source_category: this._category,
        magnitude: this._magnitude,
        reason: this._reason.trim(),
        description: signal.abstract,
        article_url: request.article_url,
        article_platform: request.article_platform,
        article_raw_data: request.article_raw_data,
      });

      if (!resp.success) {
        this._error = resp.error?.message ?? msg('The report did not reach the Bureau.');
        VelgToast.error(this._error);
        return;
      }

      /*
       * Die Stufe wird erst NACH der Antwort gesetzt. Ein Signal, das lokal
       * als gemeldet dasteht, während der Aufruf gescheitert ist, wäre die
       * schlimmste Sorte Anzeige: sie sieht aus wie eine Quittung.
       */
      intakeState.toFlagged(signal.id);
      VelgToast.success(
        msg(str`"${request.article_name}" is with the Bureau. It decides what it becomes.`),
      );
      this.dispatchEvent(
        new CustomEvent('intake-flagged', {
          bubbles: true,
          composed: true,
          detail: { signalId: signal.id },
        }),
      );
      this._close();
    } catch (err) {
      captureError(err, { source: 'VelgIntakeFlagModal._send' });
      this._error =
        err instanceof Error ? err.message : msg('The report did not reach the Bureau.');
      VelgToast.error(this._error);
    } finally {
      this._sending = false;
    }
  }

  private _renderCategories() {
    return html`
      <div class="chips">
        ${CATEGORIES.map(
          (c) => html`
            <button
              type="button"
              class="chip ${c === this._category ? 'chip--on' : ''}"
              aria-pressed=${String(c === this._category)}
              @click=${() => {
                this._category = c;
              }}
            >
              ${archetypeLabel(CATEGORY_RESONANCE[c].archetype)}
            </button>
          `,
        )}
      </div>
    `;
  }

  private _renderMagnitude() {
    return html`
      <div class="mag">
        <span class="mag__segs" role="group" aria-label=${msg('Magnitude from 0.1 to 1.0')}>
          ${Array.from({ length: 10 }, (_, i) => {
            const value = Math.round((i + 1) * 10) / 100;
            return html`<button
              type="button"
              class="mag__seg ${value <= this._magnitude + 0.001 ? 'mag__seg--on' : ''}"
              style="block-size:${8 + i * 1.4}px"
              aria-label=${msg(str`Magnitude ${value.toFixed(1)}`)}
              aria-pressed=${String(Math.abs(value - this._magnitude) < 0.001)}
              @click=${() => {
                this._magnitude = value;
              }}
            ></button>`;
          })}
        </span>
        <span class="mag__value">${this._magnitude.toFixed(2)}</span>
        <span class="note">${msg('how large this is in the world outside')}</span>
      </div>
    `;
  }

  protected render() {
    const signal = this._signal();
    const ready = Boolean(this._category) && this._reason.trim().length > 0 && !this._sending;

    return html`
      <velg-base-modal ?open=${this.open} modal-name="intake-flag" @modal-close=${this._close}>
        <span slot="header">${msg('Report to the Bureau')}</span>
        ${
          signal
            ? html`
                <div class="body">
                  <h3 class="headline">${signal.headline}</h3>
                  <div class="meta">
                    <span class="note">${signal.source}</span>
                    ${
                      this._category
                        ? html`<span class="arch">
                            ${icons.resonanceArchetype(
                              CATEGORY_RESONANCE[this._category].signature,
                              12,
                            )}
                            ${archetypeLabel(CATEGORY_RESONANCE[this._category].archetype)}
                          </span>`
                        : nothing
                    }
                  </div>

                  <div class="field">
                    <span class="label">${msg('As what')}</span>
                    ${this._renderCategories()}
                  </div>

                  <div class="field">
                    <span class="label">${msg('Magnitude')}</span>
                    ${this._renderMagnitude()}
                  </div>

                  <div class="field">
                    <label class="label" for="flag-reason">${msg('Why')}</label>
                    <textarea
                      id="flag-reason"
                      .value=${this._reason}
                      placeholder=${msg('What made you pull this one out of the stream?')}
                      @input=${(e: Event) => {
                        this._reason = (e.target as HTMLTextAreaElement).value;
                      }}
                    ></textarea>
                  </div>

                  <p class="prose prose--quiet">
                    ${msg(
                      'You are not deciding that every world feels this. You are putting it in front of the Bureau, which weighs it against each world on its own. Your own world can still take it as an event either way.',
                    )}
                  </p>

                  ${this._error ? html`<p class="fail" role="alert">${this._error}</p>` : nothing}
                </div>
              `
            : html`<p class="note">${msg('This signal is no longer in the airlock.')}</p>`
        }
        <div slot="footer">
          <div class="foot">
            <button type="button" class="act foot__spacer" @click=${this._close}>
              ${msg('Cancel')}
            </button>
            <button
              type="button"
              class="act act--bureau"
              ?disabled=${!ready}
              @click=${this._send}
            >
              ${msg('Report signal')}
            </button>
          </div>
        </div>
      </velg-base-modal>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-intake-flag-modal': VelgIntakeFlagModal;
  }
}

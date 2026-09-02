/**
 * Eine Resonanz auslösen — die eine Handlung, die alle Welten auf einmal trifft.
 *
 * Schritt 4 aus `handoff/schleuse-event-intake.md`, nur für den Admin. Der
 * Architekt sieht diesen Knopf nie; er meldet (`IntakeFlagModal`).
 *
 * ── WARUM DIE TAFEL VOM SERVER KOMMT UND NICHT AUS EINER FORMEL HIER ────────
 *
 * Der Bauplan nennt `eff = min(mag × sus, 1)` und `sus` „aus SubstrateAttunement".
 * Am 02.09.2026 nachgemessen stimmt beides so nicht:
 *
 *   * `sus` kommt aus `fn_get_adaptive_susceptibility` (Migration 216) — dem
 *     Grundwert aus den Welt-Einstellungen plus dem, was die Welt schon
 *     überstanden hat (Härtung −0.05 je abgewehrtem Treffer, Sensibilisierung
 *     +0.10 je ungemildertem). Attunement ist etwas anderes: es ZIEHT hinterher
 *     ab (Tiefe × 0.3), zusammen mit dem Ankerschutz.
 *   * Übersprungen wird unter **0.05**, nicht unter 0.2 (§5 von
 *     `_process_simulation_impact`). Mit 0.2 hätte diese Tafel „übersprungen"
 *     für Welten gemeldet, die getroffen werden.
 *
 * Deshalb rechnet hier nichts. Die Zeilen kommen aus
 * `GET …/candidates/{id}/susceptibility`, und dieser Endpunkt ruft dieselbe
 * Funktion auf, die der Lauf benutzt. Zwei Fassungen einer Formel driften, und
 * die driftende ist immer die, die niemand ausführt.
 *
 * Was die Tafel NICHT weiss, sagt sie: Attunement und Ankerschutz werden erst
 * im Lauf je Welt gelesen und können den Wert nur SENKEN. Die Zahlen sind also
 * Obergrenzen — eine Welt, die hier als getroffen steht, kann noch
 * übersprungen werden, nie umgekehrt.
 *
 * ── WARUM EIN HALTE-KNOPF ───────────────────────────────────────────────────
 *
 * `approveCandidate` legt eine Resonanz an, die nach vier Stunden zuschlägt.
 * Es gibt keinen Weg zurück. Ein Knopf, den man drückt, und einer, den man
 * hält, unterscheiden sich genau in der Sekunde, in der einem einfällt, dass
 * man es nicht wollte.
 */

import { localized, msg, str } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { scannerApi } from '../../services/api/index.js';
import type { SusceptibilityRow } from '../../services/api/ScannerApiService.js';
import { intakeState } from '../../services/IntakeStateManager.js';
import { captureError } from '../../services/SentryService.js';
import { CATEGORY_RESONANCE, type IntakeSignal } from '../../types/intake.js';
import { VelgToast } from '../shared/Toast.js';
import '../shared/BaseModal.js';
import '../shared/VelgHoldButton.js';
import { archetypeLabel } from './intake-labels.js';
import { bureauPaletteStyles, intakeControlStyles } from './intake-styles.js';

/** Wie lange die Resonanz nach dem Auslösen braucht, bis sie zuschlägt. */
const IMPACT_DELAY_HOURS = 4;

/** Wie lange der Knopf gehalten werden will. */
const HOLD_MS = 950;

@localized()
@customElement('velg-intake-resonance-modal')
export class VelgIntakeResonanceModal extends SignalWatcher(LitElement) {
  static styles = [
    intakeControlStyles,
    bureauPaletteStyles,
    css`
      :host {
        display: block;
        --modal-max-width: min(680px, calc(100vw - 2 * var(--stage-gutter)));
      }

      .body {
        display: flex;
        flex-direction: column;
        gap: var(--space-5);
      }

      /* ── Die Depesche ───────────────────────────────────────────────── */

      .dispatch {
        position: relative;
        padding: var(--space-4) var(--space-5);
        background: var(--_bureau-screen);
        border: var(--border-width-thin) solid var(--_bureau-border);
      }

      /*
       * Eckklammern statt eines Balkens. Sie sagen „amtliches Dokument" und
       * sind das Zeichen, das dieses Haus dafür führt (marker-styles.ts,
       * .marker-corners) — hier lokal, weil die Farbe die des Bureaus ist und
       * nicht die der Welt.
       */
      .dispatch__corner {
        position: absolute;
        inline-size: 10px;
        block-size: 10px;
      }

      .dispatch__corner--tl {
        inset-block-start: -1px;
        inset-inline-start: -1px;
        border-block-start: var(--border-width-default) solid var(--color-accent-amber);
        border-inline-start: var(--border-width-default) solid var(--color-accent-amber);
      }

      .dispatch__corner--tr {
        inset-block-start: -1px;
        inset-inline-end: -1px;
        border-block-start: var(--border-width-default) solid var(--color-accent-amber);
        border-inline-end: var(--border-width-default) solid var(--color-accent-amber);
      }

      .dispatch__corner--bl {
        inset-block-end: -1px;
        inset-inline-start: -1px;
        border-block-end: var(--border-width-default) solid var(--color-accent-amber);
        border-inline-start: var(--border-width-default) solid var(--color-accent-amber);
      }

      .dispatch__corner--br {
        inset-block-end: -1px;
        inset-inline-end: -1px;
        border-block-end: var(--border-width-default) solid var(--color-accent-amber);
        border-inline-end: var(--border-width-default) solid var(--color-accent-amber);
      }

      .dispatch__kicker {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        letter-spacing: var(--tracking-widest);
        text-transform: uppercase;
        color: var(--_bureau-dim);
        margin-block-end: var(--space-2);
      }

      .dispatch__text {
        font-family: var(--font-mono);
        font-size: var(--text-sm);
        line-height: var(--leading-relaxed);
        color: var(--_bureau-text);
        margin: 0;
        text-wrap: pretty;
      }

      /* ── Die Tafel ──────────────────────────────────────────────────── */

      .table {
        display: flex;
        flex-direction: column;
        gap: var(--space-1-5);
      }

      .row {
        display: grid;
        grid-template-columns: 1fr 90px 76px;
        align-items: center;
        gap: var(--space-3);
      }

      .row__name {
        font-family: var(--font-mono);
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .row--skip .row__name {
        color: var(--color-text-tertiary);
      }

      .bar {
        block-size: 6px;
        background: var(--color-border-light);
      }

      .bar__fill {
        display: block;
        block-size: 100%;
        background: var(--_eff, var(--color-text-tertiary));
      }

      .row__value {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        color: var(--_eff, var(--color-text-tertiary));
        font-variant-numeric: tabular-nums;
        text-align: end;
      }

      /*
       * Die vier Stufen der Wirkung. Die Grenzen 0.4 und 0.7 sind ANZEIGE —
       * sie sagen dem Auge, wie hart es wird. Die einzige Grenze, die etwas
       * ENTSCHEIDET, ist die Überspring-Schwelle, und die kommt als will_skip
       * vom Server, nicht aus einer Zahl hier.
       */
      .row--skip {
        --_eff: var(--color-text-tertiary);
      }
      .row--low {
        --_eff: var(--color-text-secondary);
      }
      .row--mid {
        --_eff: var(--color-accent-amber);
      }
      .row--high {
        --_eff: var(--color-danger);
      }

      .verdict {
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: var(--text-xs);
        letter-spacing: var(--tracking-brutalist);
        text-transform: uppercase;
        color: var(--color-text-primary);
        margin: 0;
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

      @container (max-width: 460px) {
        .row {
          grid-template-columns: 1fr 60px;
        }
      }
    `,
  ];

  @property({ type: Boolean, reflect: true }) open = false;
  @property({ type: String, attribute: 'signal-id' }) signalId = '';

  @state() private _rows: SusceptibilityRow[] = [];
  @state() private _loading = false;
  @state() private _sending = false;
  @state() private _error: string | null = null;

  protected override willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (!changed.has('open') || !this.open) return;
    this._rows = [];
    this._error = null;
    this._sending = false;
    void this._loadPreview();
  }

  private _signal(): IntakeSignal | undefined {
    if (!this.signalId) return undefined;
    return intakeState.get(this.signalId);
  }

  /**
   * Trägt dieses Signal eine Zeile beim Scanner?
   *
   * Eine Resonanz braucht einen Kandidaten — `approveCandidate` verwandelt
   * genau den. Ein gebrowster Artikel hat keinen (seine Kennung beginnt mit
   * `browse:`), und für ihn ist dieser Weg schlicht nicht da. Das wird gesagt,
   * nicht durch einen toten Knopf angedeutet.
   */
  private _isCandidate(signal: IntakeSignal | undefined): boolean {
    return Boolean(signal) && !signal?.id.startsWith('browse:');
  }

  private async _loadPreview(): Promise<void> {
    const signal = this._signal();
    if (!this._isCandidate(signal) || !signal) return;

    this._loading = true;
    try {
      const resp = await scannerApi.candidateSusceptibility(signal.id);
      if (resp.success && resp.data) {
        this._rows = resp.data;
        return;
      }
      this._error = resp.error?.message ?? msg('The susceptibility table did not load.');
    } catch (err) {
      captureError(err, { source: 'VelgIntakeResonanceModal._loadPreview' });
      this._error =
        err instanceof Error ? err.message : msg('The susceptibility table did not load.');
    } finally {
      this._loading = false;
    }
  }

  private _close(): void {
    this.dispatchEvent(new CustomEvent('modal-close', { bubbles: true, composed: true }));
  }

  private async _raise(): Promise<void> {
    const signal = this._signal();
    if (!signal || this._sending) return;

    this._sending = true;
    this._error = null;
    try {
      const resp = await scannerApi.approveCandidate(signal.id, IMPACT_DELAY_HOURS);
      if (!resp.success) {
        this._error = resp.error?.message ?? msg('The resonance was not raised.');
        VelgToast.error(this._error);
        return;
      }

      intakeState.toResonance(signal.id);
      const hit = this._rows.filter((r) => !r.will_skip).length;
      VelgToast.success(
        msg(str`Resonance raised · reaches ${hit} worlds · impacts in ${IMPACT_DELAY_HOURS} h`),
      );
      this.dispatchEvent(
        new CustomEvent('intake-resonance-raised', {
          bubbles: true,
          composed: true,
          detail: { signalId: signal.id },
        }),
      );
      this._close();
    } catch (err) {
      captureError(err, { source: 'VelgIntakeResonanceModal._raise' });
      this._error = err instanceof Error ? err.message : msg('The resonance was not raised.');
      VelgToast.error(this._error);
    } finally {
      this._sending = false;
    }
  }

  private _rowClass(row: SusceptibilityRow): string {
    if (row.will_skip) return 'row row--skip';
    if (row.effective_magnitude >= 0.7) return 'row row--high';
    if (row.effective_magnitude >= 0.4) return 'row row--mid';
    return 'row row--low';
  }

  private _renderDispatch(signal: IntakeSignal) {
    /*
     * `bureau_dispatch` steht auf dem Kandidaten und ist der Text, den der
     * Scanner beim Klassifizieren erzeugt hat. Fehlt er, wird KEINER erfunden:
     * dann steht die Schlagzeile da, und das Feld sagt, dass es leer ist.
     */
    const raw = signal.raw;
    const dispatch = 'bureau_dispatch' in raw ? raw.bureau_dispatch : null;

    return html`
      <div class="dispatch">
        <span class="dispatch__corner dispatch__corner--tl" aria-hidden="true"></span>
        <span class="dispatch__corner dispatch__corner--tr" aria-hidden="true"></span>
        <span class="dispatch__corner dispatch__corner--bl" aria-hidden="true"></span>
        <span class="dispatch__corner dispatch__corner--br" aria-hidden="true"></span>
        <div class="dispatch__kicker">${msg('Bureau of Substrate Monitoring · dispatch')}</div>
        <p class="dispatch__text">
          ${dispatch || signal.headline}
        </p>
        ${
          dispatch
            ? nothing
            : html`<p class="dispatch__text">
                <em>${msg('The scanner wrote no dispatch for this one.')}</em>
              </p>`
        }
      </div>
    `;
  }

  private _renderTable() {
    if (this._loading) {
      return html`<p class="note">${msg('Weighing the worlds …')}</p>`;
    }
    if (this._rows.length === 0) {
      return html`<p class="note">${msg('No active world answered.')}</p>`;
    }

    const hit = this._rows.filter((r) => !r.will_skip).length;

    return html`
      <div>
        <div class="table" role="list">
          ${this._rows.map(
            (r) => html`
              <div class=${this._rowClass(r)} role="listitem">
                <span class="row__name">${r.simulation_name}</span>
                <span class="bar" aria-hidden="true">
                  <span
                    class="bar__fill"
                    style="inline-size:${Math.round(r.effective_magnitude * 100)}%"
                  ></span>
                </span>
                <span class="row__value">
                  ${r.effective_magnitude.toFixed(2)}
                </span>
              </div>
            `,
          )}
        </div>
        <p class="verdict">
          ${msg(
            str`Reaches ${hit} of ${this._rows.length} worlds · impacts in ${IMPACT_DELAY_HOURS} h · cannot be undone`,
          )}
        </p>
        <p class="prose prose--quiet">
          ${msg(
            'These are upper bounds. Attunement depth and anchor protection are read per world when the resonance lands, and both only lower the number – a world listed here as hit can still be skipped, never the reverse.',
          )}
        </p>
      </div>
    `;
  }

  protected render() {
    const signal = this._signal();
    const entry = signal?.category ? CATEGORY_RESONANCE[signal.category] : null;
    const candidate = this._isCandidate(signal);

    return html`
      <velg-base-modal ?open=${this.open} modal-name="intake-resonance" @modal-close=${this._close}>
        <span slot="header">
          ${msg('Raise a resonance')}
          ${entry ? html` · ${archetypeLabel(entry.archetype)}` : nothing}
        </span>
        ${
          !signal
            ? html`<p class="note">${msg('This signal is no longer in the airlock.')}</p>`
            : html`
                <div class="body">
                  ${this._renderDispatch(signal)}
                  ${
                    candidate
                      ? this._renderTable()
                      : html`<p class="prose">
                          ${msg(
                            'This signal has no row with the scanner, and a resonance is raised from one. Report it to the Bureau instead, or take it as an event of this world.',
                          )}
                        </p>`
                  }
                  ${this._error ? html`<p class="fail" role="alert">${this._error}</p>` : nothing}
                </div>
              `
        }
        <div slot="footer">
          <div class="foot">
            <button type="button" class="act foot__spacer" @click=${this._close}>
              ${msg('Cancel')}
            </button>
            ${
              candidate
                ? html`<velg-hold-button
                    .duration=${HOLD_MS}
                    .label=${msg('Hold to raise')}
                    holding-label=${msg('Holding …')}
                    ?disabled=${this._loading || this._sending}
                    ?executing=${this._sending}
                    @hold-confirmed=${this._raise}
                  ></velg-hold-button>`
                : nothing
            }
          </div>
        </div>
      </velg-base-modal>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-intake-resonance-modal': VelgIntakeResonanceModal;
  }
}

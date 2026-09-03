/**
 * Das Scan-Log — was hereinkam, und was davon durchkam.
 *
 * Zweiter Teil von Schritt 6. Und es schliesst nebenbei eine Lücke, die in
 * Schritt 5 offen bleiben MUSSTE:
 *
 * ── HIER IST DAS RAUSCHEN ───────────────────────────────────────────────────
 *
 * Der Bauplan will in der Sichtung eine klappbare Rausch-Zeile („17.1k soziale
 * Posts ohne Nachrichtenanker"). Sie ist dort nicht gebaut, weil das Backend
 * VOR dem Ablegen filtert: was es verwirft, erreicht die Kandidatenliste nie,
 * und eine Klappe ohne Inhalt ist keine Anzeige.
 *
 * `news_scan_log` ist der Ort, an dem es doch steht. Auf Prod gemessen:
 *
 *     Bluesky            93 gescannt, 21 eingeordnet   ← 72 aussortiert
 *     noaa_alerts        71 gescannt, 71 eingeordnet
 *     usgs_earthquakes   26 / 26 · nasa_eonet 24 / 24 · gdacs 8 / 8
 *
 * Die vier Messdienste liefern ausschliesslich Verwertbares, Bluesky zu drei
 * Vierteln nicht. Genau diese Zahl beantwortet die Frage „lohnt sich diese
 * Quelle", und sie stand bisher nirgends auf dem Schirm.
 *
 * ── DIE SPALTE „ERGEBNIS" — ERST NACH EINEM ECHTEN SCHLÜSSEL ────────────────
 *
 * Bis zum 02.09.2026 zeigte sie nur „eingeordnet / aussortiert", denn
 * `news_scan_log` und `news_scan_candidates` teilten KEINEN Schlüssel: das
 * Kandidatenblatt führte `source_adapter`, aber keine `source_id`. Übrig blieb
 * der Titel — und ein Abgleich darüber lieferte 149 Treffer bei 222 Log-Zeilen
 * und 83 Kandidaten, also ein Kreuzprodukt über wiederholte Überschriften.
 *
 * 🔑 Eine Verknüpfung über ein Feld, das kein Schlüssel IST, liefert
 * zuverlässig Zeilen — nur nicht die richtigen.
 *
 * Migration 343 gibt dem Kandidaten die `source_id` (beide Zeilen entstehen aus
 * DEMSELBEN `ScanResult`, sie wurde nur nie mitgeschrieben) und trägt sie für
 * die 125 von 134 alten Zeilen nach, bei denen (Quelle, Titel) GENAU EINE
 * Protokollzeile trifft. Die neun mehrdeutigen bleiben leer — eine Zuordnung zu
 * raten, um eine Spalte voll zu bekommen, wäre derselbe Fehler in klein.
 *
 * Die Spalte zeigt deshalb jetzt drei Dinge und hält sie auseinander:
 * aussortiert · eingeordnet, aber ohne Kandidat zuzuordnen · und den echten
 * Stand in der Schleuse.
 */

import { localized, msg, str } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { scannerApi } from '../../services/api/index.js';
import type { ScanLogEntry } from '../../services/api/ScannerApiService.js';
import { captureError } from '../../services/SentryService.js';
import type { SourceCategory } from '../../types/index.js';
import { CATEGORY_RESONANCE } from '../../types/intake.js';
import { formatRelativeTime } from '../../utils/date-format.js';
import '../shared/BaseModal.js';
import '../shared/EmptyState.js';
import '../shared/ErrorState.js';
import '../shared/LoadingState.js';
import { archetypeLabel } from './intake-labels.js';
import { intakeControlStyles, intakeToolbarStyles } from './intake-styles.js';

/** Das Maximum des Endpunkts (`Query(ge=1, le=200)`). */
const PAGE_SIZE = 200;

/**
 * Was aus einer Protokollzeile geworden ist, in einem Wort.
 *
 * Drei Fälle, und sie werden AUSEINANDERGEHALTEN, weil sie verschiedene Dinge
 * heissen: aussortiert (die Vorfilterung hat sie verworfen), eingeordnet aber
 * ohne zuordenbaren Kandidaten (`intake_status` ist null — entweder gab es nie
 * einen oder es ist eine der neun mehrdeutigen Zeilen von vor Migration 343),
 * und der echte Stand in der Schleuse.
 */
function outcomeLabel(r: ScanLogEntry): string {
  if (!r.classified) return msg('filtered out');
  switch (r.intake_status) {
    case 'pending':
      return msg('in triage');
    case 'approved':
      return msg('resonance');
    case 'rejected':
      return msg('discarded');
    case 'flagged':
      return msg('reported');
    default:
      return msg('classified');
  }
}

function outcomeClass(r: ScanLogEntry): string {
  if (!r.classified) return 'out--dropped';
  if (r.intake_status === 'rejected') return 'out--dropped';
  if (r.intake_status) return 'out--live';
  return 'out--kept';
}

type LogFilter = 'all' | 'kept' | 'dropped';

@localized()
@customElement('velg-intake-scan-log-modal')
export class VelgIntakeScanLogModal extends SignalWatcher(LitElement) {
  static styles = [
    intakeControlStyles,
    intakeToolbarStyles,
    css`
      :host {
        display: block;
        --modal-max-width: min(1200px, calc(100vw - 2 * var(--stage-gutter)));
        --modal-body-padding: 0;
      }

      .funnels {
        display: flex;
        gap: var(--space-2);
        flex-wrap: wrap;
        margin-inline-start: auto;
      }

      .funnel {
        display: inline-flex;
        align-items: baseline;
        gap: var(--space-1);
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        letter-spacing: var(--tracking-wide);
        text-transform: uppercase;
        padding: var(--space-1) var(--space-2);
        border: var(--border-width-thin) solid var(--color-border-light);
        color: var(--color-text-secondary);
        background: transparent;
        cursor: pointer;
      }

      .funnel:hover,
      .funnel:focus-visible {
        border-color: var(--color-accent-amber);
      }

      .funnel:focus-visible {
        outline: none;
        box-shadow: var(--ring-focus);
      }

      .funnel--on {
        border-color: var(--color-accent-amber);
        color: var(--color-text-primary);
      }

      .funnel__ratio {
        font-variant-numeric: tabular-nums;
        color: var(--color-accent-amber-readable);
      }

      /* Eine Quelle, die alles durchlässt, ist eine andere Nachricht als eine,
         die drei Viertel verwirft. Deshalb trägt der Anteil die Farbe. */
      .funnel__ratio--lossy {
        color: var(--color-danger);
      }

      table {
        inline-size: 100%;
        border-collapse: collapse;
        font-size: var(--text-sm);
      }

      th {
        position: sticky;
        inset-block-start: 0;
        z-index: var(--z-raised);
        text-align: start;
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        font-weight: var(--font-normal);
        letter-spacing: var(--tracking-widest);
        text-transform: uppercase;
        color: var(--color-text-muted);
        padding: var(--space-2) var(--space-3);
        background: var(--color-surface-sunken);
        border-block-end: var(--border-width-thin) solid var(--color-border);
      }

      td {
        padding: var(--space-2) var(--space-3);
        border-block-end: var(--border-width-thin) solid var(--color-border-light);
        color: var(--color-text-secondary);
        vertical-align: top;
      }

      tr:hover td {
        background: var(--color-surface-raised);
      }

      .c-src,
      .c-when,
      .c-mag,
      .c-out {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        white-space: nowrap;
      }

      .c-mag {
        text-align: end;
        font-variant-numeric: tabular-nums;
      }

      .c-title {
        color: var(--color-text-primary);
        inline-size: 100%;
      }

      .c-title a {
        color: inherit;
        text-decoration: none;
      }

      .c-title a:hover,
      .c-title a:focus-visible {
        text-decoration: underline;
        color: var(--color-text-link);
      }

      .out--kept {
        color: var(--color-accent-green);
      }

      .out--dropped {
        color: var(--color-text-muted);
      }

      /* Ein Stand IN der Schleuse ist etwas anderes als „nur eingeordnet". */
      .out--live {
        color: var(--color-accent-amber-readable);
      }

      tr.dropped .c-title {
        color: var(--color-text-muted);
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

      .foot__note {
        flex-basis: 100%;
      }
    `,
  ];

  @property({ type: Boolean, reflect: true }) open = false;

  @state() private _rows: ScanLogEntry[] = [];
  @state() private _total = 0;
  @state() private _loading = false;
  @state() private _error: string | null = null;
  @state() private _filter: LogFilter = 'all';
  @state() private _source: string | null = null;

  protected override willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (!changed.has('open') || !this.open) return;
    this._filter = 'all';
    this._source = null;
    void this._load();
  }

  private async _load(): Promise<void> {
    this._loading = true;
    this._error = null;
    try {
      const resp = await scannerApi.getScanLog({ limit: String(PAGE_SIZE) });
      if (!resp.success || !resp.data) {
        this._error = resp.error?.message ?? msg('The scan log could not be read.');
        return;
      }
      this._rows = resp.data;
      this._total = resp.meta?.total ?? resp.data.length;
    } catch (err) {
      captureError(err, { source: 'VelgIntakeScanLogModal._load' });
      this._error = err instanceof Error ? err.message : msg('The scan log could not be read.');
    } finally {
      this._loading = false;
    }
  }

  private _close(): void {
    this.dispatchEvent(new CustomEvent('modal-close', { bubbles: true, composed: true }));
  }

  /** Je Quelle: wie viel kam herein, wie viel wurde eingeordnet. */
  private _funnels(): { name: string; scanned: number; kept: number }[] {
    const by = new Map<string, { name: string; scanned: number; kept: number }>();
    for (const r of this._rows) {
      const entry = by.get(r.source_name) ?? { name: r.source_name, scanned: 0, kept: 0 };
      entry.scanned += 1;
      if (r.classified) entry.kept += 1;
      by.set(r.source_name, entry);
    }
    return [...by.values()].sort((a, b) => b.scanned - a.scanned);
  }

  private _visible(): ScanLogEntry[] {
    return this._rows.filter((r) => {
      if (this._source && r.source_name !== this._source) return false;
      if (this._filter === 'kept') return r.classified;
      if (this._filter === 'dropped') return !r.classified;
      return true;
    });
  }

  private _renderRow(r: ScanLogEntry) {
    const category = r.source_category as SourceCategory | null;
    const resonance =
      category && CATEGORY_RESONANCE[category] ? CATEGORY_RESONANCE[category] : null;

    return html`
      <tr class=${r.classified ? '' : 'dropped'}>
        <td class="c-src">${r.source_name}</td>
        <td class="c-title">
          ${
            r.url
              ? html`<a href=${r.url} target="_blank" rel="noopener noreferrer">${r.title}</a>`
              : r.title
          }
        </td>
        <td class="c-src">
          ${resonance ? archetypeLabel(resonance.archetype) : html`<span class="note">–</span>`}
        </td>
        <td class="c-mag">${r.magnitude !== null ? r.magnitude.toFixed(2) : '–'}</td>
        <td class="c-when">${formatRelativeTime(r.scanned_at)}</td>
        <td class="c-out ${outcomeClass(r)}">${outcomeLabel(r)}</td>
      </tr>
    `;
  }

  private _renderBody() {
    if (this._loading) {
      return html`<velg-loading-state message=${msg('Reading the scan log')}></velg-loading-state>`;
    }
    if (this._error) {
      return html`<velg-error-state
        message=${this._error}
        show-retry
        @retry=${() => void this._load()}
      ></velg-error-state>`;
    }
    if (this._rows.length === 0) {
      return html`<velg-empty-state
        message=${msg('The scanner has not logged anything yet.')}
      ></velg-empty-state>`;
    }

    const rows = this._visible();

    return html`
      <div class="tools">
        <div class="group" role="group" aria-label=${msg('Outcome')}>
          <span class="label">${msg('Show')}</span>
          ${(
            [
              ['all', msg('everything')],
              ['kept', msg('classified')],
              ['dropped', msg('filtered out')],
            ] as [LogFilter, string][]
          ).map(
            ([key, label]) => html`
              <button
                type="button"
                class="chip ${this._filter === key ? 'chip--on' : ''}"
                aria-pressed=${String(this._filter === key)}
                @click=${() => {
                  this._filter = key;
                }}
              >
                ${label}
              </button>
            `,
          )}
        </div>

        <div class="funnels" role="group" aria-label=${msg('Sources')}>
          ${this._funnels().map((f) => {
            const lossy = f.scanned > 0 && f.kept / f.scanned < 0.5;
            return html`
              <button
                type="button"
                class="funnel ${this._source === f.name ? 'funnel--on' : ''}"
                aria-pressed=${String(this._source === f.name)}
                @click=${() => {
                  this._source = this._source === f.name ? null : f.name;
                }}
              >
                ${f.name}
                <span class="funnel__ratio ${lossy ? 'funnel__ratio--lossy' : ''}">
                  ${f.kept}/${f.scanned}
                </span>
              </button>
            `;
          })}
        </div>
      </div>

      ${
        rows.length === 0
          ? html`<velg-empty-state
              message=${msg('No entry matches this filter.')}
            ></velg-empty-state>`
          : html`
              <table>
                <thead>
                  <tr>
                    <th scope="col">${msg('Source')}</th>
                    <th scope="col">${msg('Title')}</th>
                    <th scope="col">${msg('Archetype')}</th>
                    <th scope="col">${msg('Magnitude')}</th>
                    <th scope="col">${msg('Scanned')}</th>
                    <th scope="col">${msg('Outcome')}</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows.map((r) => this._renderRow(r))}
                </tbody>
              </table>
            `
      }
    `;
  }

  protected render() {
    const shown = this._visible().length;

    return html`
      <velg-base-modal ?open=${this.open} modal-name="intake-scan-log" @modal-close=${this._close}>
        <span slot="header">${msg('Scan log')}</span>
        ${this._renderBody()}
        <div slot="footer">
          <div class="foot">
            <span class="note">
              ${msg(str`${shown} of ${this._rows.length} shown · ${this._total} logged`)}
            </span>
            <button type="button" class="act foot__spacer" @click=${this._close}>
              ${msg('Close')}
            </button>
            <p class="prose prose--quiet foot__note">
              ${msg(
                'This is where the noise is: a line marked "filtered out" came in and never became a candidate. What became of a classified line afterwards is not in here – the log and the candidate sheet share no key, and matching them on the headline would produce rows, just not the right ones.',
              )}
            </p>
          </div>
        </div>
      </velg-base-modal>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-intake-scan-log-modal': VelgIntakeScanLogModal;
  }
}

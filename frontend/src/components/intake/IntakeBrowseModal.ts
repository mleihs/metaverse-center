/**
 * Der Zufluss von Hand — wo ein Architekt selbst etwas hereinholt.
 *
 * ── WARUM ES DIESE DATEI GIBT, OBWOHL SIE IM BAUPLAN NICHT STEHT ────────────
 *
 * Der Bauplan beschreibt die Rollen so: der Admin sieht die Sensorlage und
 * bekommt seinen Zufluss vom Scanner; „der Eingang eines Architekten füllt sich
 * über `loadBrowse`". Gemessen am 02.09.2026:
 *
 *     grep -rn "loadBrowse" frontend/src   →   NUR die Definition selbst
 *
 * **Es gab keinen einzigen Aufrufer.** Die Methode stand seit Schritt 1 da, der
 * Kommentar darüber erklärte ihren Zweck, und kein Knopf im Haus hat sie je
 * ausgelöst. Für einen Architekten war die Schleuse damit ein Brett, dessen
 * erste Kammer sich niemals füllen konnte — der Scanner-Weg hängt am
 * Plattform-Admin, und der Browse-Weg war unerreichbar.
 *
 * 🔑 Eine Methode mit einem guten Kommentar sieht aus wie ein angeschlossenes
 * Merkmal. Die Prüffrage ist nicht „gibt es die Funktion", sondern „ruft sie
 * jemand". Dasselbe Muster wie der `Scan-Log`-Knopf, der zwei Schritte lang ein
 * Ereignis feuerte, das niemand abhörte.
 *
 * ── WAS DER NUTZER HIER ZU SEHEN BEKOMMT, WENN NICHTS GEHT ──────────────────
 *
 * Auf Prod ist der Guardian-Schlüssel tot (401) und NewsAPI hat gar keinen.
 * Seit `a3993cef` beantwortet der Server das nicht mehr mit „External API
 * error. Please try again.", sondern nennt die Einstellung, die erneuert werden
 * muss. Diese View reicht diese Antwort UNVERÄNDERT durch, statt sie durch ein
 * eigenes „Konnte nicht laden" zu ersetzen — sonst wäre der Weg, den wir heute
 * früh freigeräumt haben, an der letzten Stelle wieder zugeschüttet.
 */

import { localized, msg, str } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { intakeState } from '../../services/IntakeStateManager.js';
import type { IntakeSignal } from '../../types/intake.js';
import '../shared/BaseModal.js';
import '../shared/EmptyState.js';
import '../shared/LoadingState.js';
import { intakeControlStyles } from './intake-styles.js';

/**
 * Die Quellen, die der Browse-Weg kennt.
 *
 * Genau zwei, und das ist keine Auswahl aus Bequemlichkeit: der Router
 * (`_resolve_news_service` in `backend/routers/social_trends.py`) kennt
 * `guardian` und `newsapi` und antwortet auf alles andere mit
 * „Unknown source". Eine dritte Kachel hier wäre ein Knopf, der garantiert 400
 * bekommt.
 */
const SOURCES = [
  { id: 'guardian', label: 'The Guardian' },
  { id: 'newsapi', label: 'NewsAPI' },
] as const;

/** Die Ressorts, die der Guardian-Zweig als `section` durchreicht. */
const GUARDIAN_SECTIONS = ['world', 'environment', 'science', 'technology', 'business'] as const;

@localized()
@customElement('velg-intake-browse-modal')
export class VelgIntakeBrowseModal extends SignalWatcher(LitElement) {
  static styles = [
    intakeControlStyles,
    css`
      :host {
        display: block;
        --modal-max-width: min(1100px, calc(100vw - 2 * var(--stage-gutter)));
        --modal-body-padding: 0;
      }

      .tools {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        flex-wrap: wrap;
        padding: var(--space-3) var(--space-5);
        border-block-end: var(--border-width-thin) solid var(--color-border-light);
      }

      .search {
        flex: 1 1 200px;
        min-inline-size: 150px;
        padding: var(--space-2) var(--space-2-5);
        font-family: var(--font-mono);
        font-size: var(--text-sm);
        color: var(--color-text-primary);
        background: var(--color-surface);
        border: var(--border-width-thin) solid var(--color-border);
      }

      .search:focus-visible {
        outline: none;
        border-color: var(--color-accent-amber);
      }

      .group {
        display: flex;
        align-items: center;
        gap: var(--space-1-5);
        flex-wrap: wrap;
      }

      .list {
        display: flex;
        flex-direction: column;
        list-style: none;
        margin: 0;
        padding: 0;
      }

      .item {
        display: grid;
        grid-template-columns: 96px minmax(0, 1fr) auto;
        gap: var(--space-3);
        align-items: center;
        padding: var(--space-3) var(--space-5);
        border-block-end: var(--border-width-thin) solid var(--color-border-light);
      }

      /* Gedimmt ist, was schon aufgenommen IST — nicht, was noch offen ist. */
      .item--done {
        opacity: 0.5;
      }

      .shot {
        aspect-ratio: 16 / 9;
        inline-size: 96px;
        object-fit: cover;
        background: var(--color-surface-sunken);
        border: var(--border-width-thin) solid var(--color-border-light);
      }

      .shot--none {
        aspect-ratio: 16 / 9;
        inline-size: 96px;
        border: var(--border-width-thin) dashed var(--color-border-light);
      }

      .title {
        font-family: var(--font-prose);
        font-weight: var(--font-semibold);
        font-size: var(--text-sm);
        line-height: var(--leading-snug);
        color: var(--color-text-primary);
        margin: 0;
        text-wrap: pretty;
      }

      .meta {
        display: flex;
        gap: var(--space-2);
        flex-wrap: wrap;
        align-items: baseline;
      }

      .fail {
        font-family: var(--font-mono);
        font-size: var(--text-sm);
        color: var(--color-danger);
        margin: 0;
        padding: var(--space-4) var(--space-5);
        text-wrap: pretty;
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

      @media (max-width: 640px) {
        .item {
          grid-template-columns: minmax(0, 1fr);
        }

        .shot,
        .shot--none {
          inline-size: 100%;
        }
      }
    `,
  ];

  @property({ type: Boolean, reflect: true }) open = false;
  @property({ type: String }) simulationId = '';

  @state() private _source: string = SOURCES[0].id;
  @state() private _query = '';
  @state() private _section = '';
  /** Was der letzte Abruf gebracht hat — die IDs, nicht die Artikel. */
  @state() private _fetched: string[] = [];
  @state() private _brokenShots = new Set<string>();

  protected override willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (!changed.has('open') || !this.open) return;
    this._fetched = [];
    this._query = '';
  }

  private _close(): void {
    this.dispatchEvent(new CustomEvent('modal-close', { bubbles: true, composed: true }));
  }

  /**
   * Holen — und die IDs merken, statt die Artikel.
   *
   * `loadBrowse` mischt die Treffer in die EINE Menge des Managers; sie leben
   * ab da dort und nirgends sonst. Eine zweite Liste in dieser Komponente wäre
   * genau die Doppelhaltung, gegen die die Schleuse gebaut ist — sie liefe
   * auseinander, sobald jemand ein Signal weiterschiebt.
   */
  private async _fetch(): Promise<void> {
    if (!this.simulationId) return;
    const before = new Set(intakeState.signals.value.keys());

    await intakeState.loadBrowse(this.simulationId, {
      source: this._source,
      query: this._query.trim() || undefined,
      section: this._source === 'guardian' && this._section ? this._section : undefined,
      limit: 15,
    });

    this._fetched = [...intakeState.signals.value.keys()].filter((id) => !before.has(id));
  }

  private _results(): IntakeSignal[] {
    return this._fetched
      .map((id) => intakeState.get(id))
      .filter((s): s is IntakeSignal => s !== undefined);
  }

  private _renderItem(signal: IntakeSignal) {
    const shot = this._brokenShots.has(signal.id) ? undefined : signal.imageUrl;
    const admitted = signal.stage === 'in';

    return html`
      <li class="item ${admitted ? 'item--done' : ''}">
        ${
          shot
            ? html`<img
                class="shot"
                src=${shot}
                alt=""
                loading="lazy"
                @error=${() => {
                  this._brokenShots = new Set([...this._brokenShots, signal.id]);
                }}
              />`
            : html`<span class="shot--none" aria-hidden="true"></span>`
        }
        <div>
          <h3 class="title">${signal.headline}</h3>
          <div class="meta">
            <span class="note">${signal.source}</span>
            ${
              signal.url
                ? html`<a
                    class="note"
                    href=${signal.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    >${msg('Original')}</a
                  >`
                : nothing
            }
          </div>
        </div>
        ${
          admitted
            ? html`<span class="note">${msg('at the entrance')}</span>`
            : html`<button
                type="button"
                class="act"
                @click=${() => {
                  intakeState.toEntrance(signal.id);
                }}
              >
                ${msg('To the entrance')}
              </button>`
        }
      </li>
    `;
  }

  private _renderBody() {
    if (intakeState.loading.value) {
      return html`<velg-loading-state message=${msg('Fetching articles')}></velg-loading-state>`;
    }

    /*
     * Die Meldung des Servers UNVERÄNDERT. Sie nennt seit `a3993cef` die
     * Einstellung, die erneuert werden muss („guardian refused the configured
     * API key (401) … renew 'guardian_api_key'"). Ein eigenes „Konnte nicht
     * laden" darüberzulegen wäre genau der Rückschritt, den dieser Tag
     * beseitigt hat.
     */
    const error = intakeState.error.value;
    if (error) return html`<p class="fail" role="alert">${error}</p>`;

    const results = this._results();
    if (results.length === 0) {
      return html`<velg-empty-state
        message=${msg('Nothing fetched yet. Pick a source and fetch.')}
      ></velg-empty-state>`;
    }

    return html`<ul class="list">${results.map((s) => this._renderItem(s))}</ul>`;
  }

  protected render() {
    return html`
      <velg-base-modal ?open=${this.open} modal-name="intake-browse" @modal-close=${this._close}>
        <span slot="header">${msg('Fetch by hand')}</span>

        <div class="tools">
          <div class="group" role="group" aria-label=${msg('Source')}>
            ${SOURCES.map(
              (s) => html`
                <button
                  type="button"
                  class="chip ${this._source === s.id ? 'chip--on' : ''}"
                  aria-pressed=${String(this._source === s.id)}
                  @click=${() => {
                    this._source = s.id;
                  }}
                >
                  ${s.label}
                </button>
              `,
            )}
          </div>

          <input
            class="search"
            type="search"
            .value=${this._query}
            placeholder=${msg('Search words, or leave empty for the newest')}
            aria-label=${msg('Search the source')}
            @input=${(e: Event) => {
              this._query = (e.target as HTMLInputElement).value;
            }}
            @keydown=${(e: KeyboardEvent) => {
              if (e.key === 'Enter') void this._fetch();
            }}
          />

          ${
            this._source === 'guardian'
              ? html`
                  <div class="group" role="group" aria-label=${msg('Section')}>
                    <button
                      type="button"
                      class="chip ${this._section === '' ? 'chip--on' : ''}"
                      aria-pressed=${String(this._section === '')}
                      @click=${() => {
                        this._section = '';
                      }}
                    >
                      ${msg('all sections')}
                    </button>
                    ${GUARDIAN_SECTIONS.map(
                      (sec) => html`
                        <button
                          type="button"
                          class="chip ${this._section === sec ? 'chip--on' : ''}"
                          aria-pressed=${String(this._section === sec)}
                          @click=${() => {
                            this._section = sec;
                          }}
                        >
                          ${sec}
                        </button>
                      `,
                    )}
                  </div>
                `
              : nothing
          }

          <button
            type="button"
            class="act act--primary"
            ?disabled=${intakeState.loading.value}
            @click=${this._fetch}
          >
            ${msg('Fetch')}
          </button>
        </div>

        ${this._renderBody()}

        <div slot="footer">
          <div class="foot">
            <span class="note">
              ${msg(str`${this._results().length} fetched`)}
            </span>
            <button type="button" class="act foot__spacer" @click=${this._close}>
              ${msg('Close')}
            </button>
            <p class="prose prose--quiet foot__note">
              ${msg(
                'What you fetch lands in triage, not at the entrance: you asked a source, you did not pick these fifteen. Nothing here is classified yet – magnitude and archetype come from the crucible.',
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
    'velg-intake-browse-modal': VelgIntakeBrowseModal;
  }
}

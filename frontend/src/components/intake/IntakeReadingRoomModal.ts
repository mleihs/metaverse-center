/**
 * Der Lesesaal — den Eingang in Ruhe lesen.
 *
 * Erster Teil von Schritt 6 aus `handoff/schleuse-event-intake.md`. Die
 * Sichtung ist schnell und eng: eine Rangliste, aus der man auswählt. Der
 * Lesesaal ist ihr Gegenstück — was aufgenommen IST, gruppiert, mit Anriss,
 * nebeneinander lesbar, bevor man es in den Schmelztiegel gibt.
 *
 * ── DIE DREI SPALTEN SIND EIN VERGLEICH, DESHALB KEIN MASONRY ───────────────
 *
 * `Wirklichkeit | Klassifikation | Was daraus werden kann` steht in EINER
 * Zeile, weil die mittlere Spalte über die linke urteilt und die rechte aus
 * beiden folgt. Ein Vergleich braucht eine gemeinsame Grundlinie; ein Layout,
 * das Kacheln nach Höhe verschachtelt, gibt genau die auf.
 *
 * ⚠ Das Zeilen-Spannweiten-Raster aus
 * `handoff/schleuse-sensorleiste-kaputt-2026-09-02.md` war für DIESE View
 * vorgesehen („eine Stöberfläche, keine Rangliste"). Es bleibt ungebaut, und
 * das ist eine Entscheidung, die der Nutzer umdrehen darf: der Satz stimmt für
 * das Stöbern, aber der Lesesaal stöbert nicht in Bildern, er stellt drei
 * Angaben nebeneinander. Sobald die rechte Spalte einmal einen fertigen
 * Vorschlag samt Bild trägt, ist die Frage neu zu stellen.
 *
 * ── ZWEI GRUPPIERUNGEN, NICHT DREI ──────────────────────────────────────────
 *
 * Der Bauplan will „Gliedern nach [Ort | Archetyp | Quelle]". **Ort ist nicht
 * gebaut, und zwar aus einem anderen Grund als die abgeschalteten Regler der
 * Sichtung.** Dort fehlt eine Zahl, die das Backend liefern wird (Lücke 2 und
 * 3). Hier fehlt nichts: ein Signal im Eingang HAT keinen Ort. Der Ort entsteht
 * in der Linse des Schmelztiegels, also erst einen Schritt später. Eine
 * Gliederung nach Ort hätte genau eine Gruppe, „ohne Ort", für immer.
 *
 * 🔑 Ein fehlender Wert und ein Wert, den es an dieser Stelle noch gar nicht
 * geben KANN, sehen im Code gleich aus (`undefined`) und verlangen verschiedene
 * Antworten: den einen kündigt man an, den anderen erklärt man.
 */

import { localized, msg, str } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { intakeState } from '../../services/IntakeStateManager.js';
import { CATEGORY_RESONANCE, type IntakeSignal } from '../../types/intake.js';
import { formatRelativeTime } from '../../utils/date-format.js';
import { icons } from '../../utils/icons.js';
import '../shared/BaseModal.js';
import '../shared/EmptyState.js';
import { archetypeLabel } from './intake-labels.js';
import { intakeControlStyles, intakeKindColorStyles, intakeToolbarStyles } from './intake-styles.js';

/** Wonach der Lesesaal gliedern kann. Siehe Kopfkommentar: `zone` fehlt. */
type ReadingGrouping = 'archetype' | 'source';

@localized()
@customElement('velg-intake-reading-room-modal')
export class VelgIntakeReadingRoomModal extends SignalWatcher(LitElement) {
  static styles = [
    intakeControlStyles,
    intakeKindColorStyles,
    intakeToolbarStyles,
    css`
      :host {
        display: block;
        --modal-max-width: min(1500px, calc(100vw - 2 * var(--stage-gutter)));
        --modal-body-padding: 0;
      }

      .group-by {
        display: flex;
        align-items: center;
        gap: var(--space-1-5);
      }

      .summary {
        display: flex;
        gap: var(--space-1-5);
        flex-wrap: wrap;
        margin-inline-start: auto;
      }

      .tally {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        letter-spacing: var(--tracking-wide);
        text-transform: uppercase;
        padding: var(--space-1) var(--space-2);
        border: var(--border-width-thin) solid var(--color-border-light);
        color: var(--color-text-secondary);
      }

      .tally__n {
        color: var(--color-accent-amber-readable);
        font-variant-numeric: tabular-nums;
      }

      .groups {
        display: flex;
        flex-direction: column;
      }

      .group__head {
        position: sticky;
        inset-block-start: 0;
        z-index: var(--z-raised);
        display: flex;
        align-items: baseline;
        gap: var(--space-2);
        padding: var(--space-2) var(--space-5);
        background: var(--color-surface-sunken);
        border-block: var(--border-width-thin) solid var(--color-border-light);
      }

      .group__name {
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: var(--text-sm);
        letter-spacing: var(--tracking-brutalist);
        text-transform: uppercase;
        color: var(--color-text-secondary);
      }

      .group__n {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        color: var(--color-text-muted);
        font-variant-numeric: tabular-nums;
      }

      .group__note {
        margin-inline-start: auto;
      }

      /* ── Die Zeile: drei Spalten, eine Grundlinie ─────────────────────── */

      .row {
        display: grid;
        grid-template-columns: 1.25fr 1fr 1fr;
        gap: var(--space-5);
        padding: var(--space-4) var(--space-5);
        border-block-end: var(--border-width-thin) solid var(--color-border-light);
        align-items: start;
      }

      .col {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        min-inline-size: 0;
      }

      .headline {
        font-family: var(--font-prose);
        font-weight: var(--font-semibold);
        font-size: var(--text-md);
        line-height: var(--leading-snug);
        color: var(--color-text-primary);
        margin: 0;
        text-wrap: pretty;
      }

      .shot {
        aspect-ratio: 16 / 9;
        inline-size: 100%;
        object-fit: cover;
        background: var(--color-surface-sunken);
        border: var(--border-width-thin) solid var(--color-border-light);
      }

      .srcs {
        display: flex;
        gap: var(--space-1);
        flex-wrap: wrap;
        align-items: center;
      }

      .src {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        letter-spacing: var(--tracking-wide);
        text-transform: uppercase;
        padding: 1px var(--space-1);
        border: var(--border-width-thin) solid var(--color-border-light);
        color: var(--_kind);
      }

      .link {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        color: var(--color-text-link);
        text-decoration: none;
      }

      .link:hover,
      .link:focus-visible {
        text-decoration: underline;
      }

      .arch {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        letter-spacing: var(--tracking-wider);
        text-transform: uppercase;
        color: var(--color-accent-amber-readable);
      }

      .mag {
        display: flex;
        align-items: center;
        gap: var(--space-2);
      }

      .mag__bar {
        flex: 1;
        block-size: 4px;
        background: var(--color-border-light);
      }

      .mag__fill {
        block-size: 100%;
        background: var(--color-accent-amber);
      }

      .mag__value {
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: var(--text-xs);
        color: var(--color-accent-amber-readable);
        font-variant-numeric: tabular-nums;
      }

      .mag__value--unmeasured {
        color: var(--color-text-muted);
      }

      .acts {
        display: flex;
        gap: var(--space-2);
        flex-wrap: wrap;
        margin-block-start: var(--space-1);
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

      @media (max-width: 1100px) {
        .row {
          grid-template-columns: minmax(0, 1fr);
          gap: var(--space-3);
        }
      }
    `,
  ];

  @property({ type: Boolean, reflect: true }) open = false;

  @state() private _grouping: ReadingGrouping = 'archetype';
  @state() private _brokenShots = new Set<string>();

  private _close(): void {
    this.dispatchEvent(new CustomEvent('modal-close', { bubbles: true, composed: true }));
  }

  /** Den Schmelztiegel für ein Signal öffnen — die View besitzt das Modal. */
  private _transform(signal: IntakeSignal): void {
    this.dispatchEvent(
      new CustomEvent('intake-transform', {
        bubbles: true,
        composed: true,
        detail: { signalId: signal.id },
      }),
    );
  }

  /** Wie viele Signale je Archetyp im Eingang liegen. */
  private _tallies(): { label: string; signature: string | null; count: number }[] {
    const by = new Map<string, { label: string; signature: string | null; count: number }>();
    for (const s of intakeState.inEntrance.value) {
      const resonance = s.category ? CATEGORY_RESONANCE[s.category] : null;
      const key = resonance?.archetype ?? '';
      const entry = by.get(key);
      if (entry) entry.count += 1;
      else
        by.set(key, {
          label: resonance ? archetypeLabel(resonance.archetype) : msg('Unclassified'),
          signature: resonance?.signature ?? null,
          count: 1,
        });
    }
    return [...by.values()].sort((a, b) => b.count - a.count);
  }

  private _groups(): { name: string; note: string; items: IntakeSignal[] }[] {
    const by = new Map<string, IntakeSignal[]>();
    for (const s of intakeState.inEntrance.value) {
      const key =
        this._grouping === 'source'
          ? s.source
          : s.category
            ? archetypeLabel(CATEGORY_RESONANCE[s.category].archetype)
            : msg('Unclassified');
      const list = by.get(key);
      if (list) list.push(s);
      else by.set(key, [s]);
    }

    return [...by.entries()]
      .map(([name, items]) => {
        const measured = items.filter((s) => s.magnitude > 0);
        const note = measured.length
          ? msg(
              str`strongest ${Math.max(...measured.map((s) => s.magnitude)).toFixed(2)} · ${measured.length} of ${items.length} measured`,
            )
          : msg('none measured yet');
        return { name, note, items: [...items].sort((a, b) => b.magnitude - a.magnitude) };
      })
      .sort((a, b) => b.items.length - a.items.length);
  }

  private _renderReality(signal: IntakeSignal) {
    const shot = this._brokenShots.has(signal.id) ? undefined : signal.imageUrl;
    return html`
      <div class="col">
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
            : nothing
        }
        <h3 class="headline">${signal.headline}</h3>
        ${signal.abstract ? html`<p class="prose">${signal.abstract}</p>` : nothing}
        <div class="srcs">
          ${signal.sources.map(
            (src) => html`<span class="src" data-kind=${signal.sourceKind}>${src.name}</span>`,
          )}
          <span class="note">${formatRelativeTime(signal.observedAt)}</span>
          ${
            signal.url
              ? html`<a
                  class="link"
                  href=${signal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  >${msg('Original')}</a
                >`
              : nothing
          }
        </div>
      </div>
    `;
  }

  private _renderClassification(signal: IntakeSignal) {
    const resonance = signal.category ? CATEGORY_RESONANCE[signal.category] : null;
    return html`
      <div class="col">
        <span class="label">${msg('Classification')}</span>
        ${
          resonance
            ? html`<span class="arch">
                ${icons.resonanceArchetype(resonance.signature, 12)}
                ${archetypeLabel(resonance.archetype)}
              </span>`
            : html`<span class="note">${msg('Not classified – the crucible does it.')}</span>`
        }
        <div class="mag">
          <span class="mag__bar" aria-hidden="true">
            <span class="mag__fill" style="inline-size: ${Math.round(signal.magnitude * 100)}%"
            ></span>
          </span>
          ${
            signal.magnitude > 0
              ? html`<span class="mag__value">${signal.magnitude.toFixed(2)}</span>`
              : html`<span class="mag__value mag__value--unmeasured">${msg('unmeasured')}</span>`
          }
        </div>
        ${signal.classificationNote ? html`<p class="note">${signal.classificationNote}</p>` : nothing}
      </div>
    `;
  }

  /**
   * Die dritte Spalte heisst im Bauplan „Vorschlag für die Welt" und zeigt
   * Titel, Ort, Vektor, Wucht und Zeugen.
   *
   * **Nichts davon existiert an dieser Stelle.** `lens` und `proposal` entstehen
   * im Schmelztiegel, und ein Signal, das sie hat, ist damit in der Quarantäne —
   * also nicht mehr im Eingang und nicht mehr in dieser Liste. Die Spalte kann
   * deshalb nur den WEG anbieten, nicht das Ergebnis. Sie sagt das auch.
   */
  private _renderNext(signal: IntakeSignal) {
    return html`
      <div class="col">
        <span class="label">${msg('What it can become')}</span>
        <p class="prose prose--quiet">
          ${msg(
            'No proposal yet. The crucible writes the title, sets place and vector, and the signal moves on to quarantine.',
          )}
        </p>
        <div class="acts">
          <button type="button" class="act act--primary" @click=${() => this._transform(signal)}>
            ${msg('Transform')}
          </button>
          <button
            type="button"
            class="act"
            @click=${() => {
              intakeState.toTriage(signal.id);
            }}
          >
            ${msg('Back to triage')}
          </button>
          <button
            type="button"
            class="act"
            @click=${() => {
              intakeState.discard(signal.id);
            }}
          >
            ${msg('Discard')}
          </button>
        </div>
      </div>
    `;
  }

  protected render() {
    const items = intakeState.inEntrance.value;
    const waiting = intakeState.inTriage.value.length;

    return html`
      <velg-base-modal
        ?open=${this.open}
        modal-name="intake-reading-room"
        @modal-close=${this._close}
      >
        <span slot="header">${msg(str`Reading room · ${items.length} admitted`)}</span>

        ${
          items.length === 0
            ? html`<velg-empty-state
                message=${msg('The entrance is empty. Admit something from triage first.')}
              ></velg-empty-state>`
            : html`
                <div class="tools">
                  <div class="group-by" role="group" aria-label=${msg('Group by')}>
                    <span class="label">${msg('Group by')}</span>
                    <button
                      type="button"
                      class="chip ${this._grouping === 'archetype' ? 'chip--on' : ''}"
                      aria-pressed=${String(this._grouping === 'archetype')}
                      @click=${() => {
                        this._grouping = 'archetype';
                      }}
                    >
                      ${msg('Archetype')}
                    </button>
                    <button
                      type="button"
                      class="chip ${this._grouping === 'source' ? 'chip--on' : ''}"
                      aria-pressed=${String(this._grouping === 'source')}
                      @click=${() => {
                        this._grouping = 'source';
                      }}
                    >
                      ${msg('Source')}
                    </button>
                  </div>

                  <div class="summary">
                    ${this._tallies().map(
                      (t) => html`
                        <span class="tally">
                          ${t.signature ? icons.resonanceArchetype(t.signature, 11) : nothing}
                          ${t.label} <span class="tally__n">${t.count}</span>
                        </span>
                      `,
                    )}
                  </div>
                </div>

                <div class="groups">
                  ${this._groups().map(
                    (g) => html`
                      <section>
                        <header class="group__head">
                          <h3 class="group__name">${g.name}</h3>
                          <span class="group__n">${g.items.length}</span>
                          <span class="note group__note">${g.note}</span>
                        </header>
                        ${g.items.map(
                          (s) => html`
                            <article class="row">
                              ${this._renderReality(s)} ${this._renderClassification(s)}
                              ${this._renderNext(s)}
                            </article>
                          `,
                        )}
                      </section>
                    `,
                  )}
                </div>
              `
        }

        <div slot="footer">
          <div class="foot">
            <span class="note">
              ${
                waiting > 0
                  ? msg(str`Triage · ${waiting} waiting`)
                  : msg('Triage · nothing waiting')
              }
            </span>
            <p class="prose prose--quiet">
              ${msg(
                'Place and vector are not here: a signal at the entrance has no place yet. It gets one in the crucible.',
              )}
            </p>
            <button type="button" class="act foot__spacer" @click=${this._close}>
              ${msg('Close')}
            </button>
          </div>
        </div>
      </velg-base-modal>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-intake-reading-room-modal': VelgIntakeReadingRoomModal;
  }
}

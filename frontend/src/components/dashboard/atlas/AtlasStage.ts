/**
 * BLATT 01 — Laufender Einsatz. Die Buehne des Atlas-Dashboards.
 *
 * Links steht, was ansteht: Zyklus, Uhr (oder ihr Fehlen), Epochenname,
 * Zyklusleiste, zwei Aktionen. Rechts ein Beleg — das Bild der eigenen Welt im
 * Rahmen, mit Rang, Punkten und drei Kennzahlen darunter.
 *
 * WORIN ER SICH VON DER REDAKTIONELLEN BUEHNE UNTERSCHEIDET
 *   Dort ist das Weltbild ein randloser Grund mit drei Schleiern darueber und
 *   der Schrift darin. Hier ist es eine Figur neben der Schrift. Auf Papier
 *   waere ein abgedunkeltes Vollbild ein Loch in der Seite; ein gerahmtes Bild
 *   mit Nummer ist ein Beleg, und Belege sind, was eine Mappe zeigt.
 *
 * DIE WAHRHEITEN SIND DIESELBEN, UND ZWAR ALLE
 *   Das Design-Paket verlangt es ausdruecklich, und es sind genau die Stellen,
 *   an denen eine Oberflaeche sonst freundlicher waere als die Daten:
 *
 *     - Kein Countdown ohne `cycle_deadline_at`. `null` heisst nicht "kein
 *       Zyklus", sondern "fuer diese Epoche laeuft keine Uhr" — auf Prod bei
 *       allen sieben der Fall. Dann steht dort ein Satz, kein 00:00:00.
 *     - Kein erfundener Nenner. "Orders placed 1/3" ist nicht messbar;
 *       messbar ist ein Ja/Nein (`has_acted_this_cycle`), und das steht da.
 *     - Ohne Beteiligung keine leere Buehne, sondern die Auskunft, dass nichts
 *       ansteht, und der Weg zu den Epochen.
 *
 *   Die Uhr selbst kommt aus `cycle-countdown.ts` — derselbe Controller, den
 *   die redaktionelle Buehne fuehrt.
 *
 * DER SATZ OHNE UHR IST EINE UEBERSCHRIFT, KEIN ETIKETT
 *   "No cycle clock running" folgt `--heading-transform`. Ein Etikett ist ein
 *   Wort ueber einem Wert; hier steht kein Wert, sondern die Auskunft, dass
 *   keiner laeuft. Dieselbe Entscheidung wie in der redaktionellen Buehne.
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { ActiveEpochParticipation } from '../../../types/index.js';
import { navigate } from '../../../utils/navigation.js';
import '../../shared/VelgSurveyLoader.js';
import {
  atlasGridStyles,
  atlasHoverStyles,
  atlasSheetHeadStyles,
} from '../../shared/atlas-sheet-styles.js';
import { stageStyles } from '../../shared/stage-styles.js';
import { CycleCountdown } from '../cycle-countdown.js';

@localized()
@customElement('velg-atlas-stage')
export class VelgAtlasStage extends LitElement {
  static styles = [
    stageStyles,
    atlasSheetHeadStyles,
    atlasHoverStyles,
    atlasGridStyles,
    css`
      :host {
        display: block;
        /*
         * DER CONTAINER SITZT AUF DEM WIRT, NICHT AUF .sheet.
         *
         * Eine Container-Abfrage kann nicht auf das Element passen, das den
         * Container AUFSPANNT — sie fragt immer den naechsten Vorfahren. Stand
         * container-type auf .sheet und eine @container-Regel richtete sich
         * ebenfalls an .sheet, traf sie nie.
         *
         * Gemessen am 03.09.2026: das Blatt stand bei 390 px Breite weiter
         * zweispaltig (113 px und 133 px nebeneinander), obwohl die Regel
         * ausdruecklich eine Spalte verlangte. Kein Fehler, keine Warnung — die
         * Regel war syntaktisch tadellos und ohne Wirkung. Neun Bausteine
         * trugen denselben Bau.
         */
        container-type: inline-size;
        position: relative;
        background: var(--color-surface);
        border-bottom: var(--border-width-thin) solid var(--color-border);
      }

      .sheet {
        position: relative;
        z-index: 1;
        display: grid;
        grid-template-columns: 7fr 5fr;
        gap: var(--space-12);
        align-items: start;
        min-height: 520px;
        padding-block: var(--space-12);
      }

      .headline {
        margin: 0;
        font-family: var(--heading-font);
        font-weight: var(--heading-weight);
        font-size: clamp(44px, 5vw, 76px);
        line-height: 0.95;
        letter-spacing: var(--heading-tracking);
        text-transform: var(--heading-transform);
        color: var(--color-text-primary);
      }

      .headline em {
        font-style: normal;
        color: var(--color-primary);
      }

      /* Die Uhr. Ziffernbreite fest, sonst wackelt die Zeile im Sekundentakt. */
      .clock {
        margin: var(--space-4) 0 0;
        font-family: var(--font-mono);
        font-size: calc(var(--text-2xl) * var(--stage-type-scale));
        font-variant-numeric: tabular-nums;
        letter-spacing: var(--tracking-tight);
        color: var(--color-primary);
      }

      .idle {
        margin: var(--space-4) 0 0;
        font-family: var(--heading-font);
        font-weight: var(--heading-weight);
        font-size: var(--text-xl);
        line-height: var(--leading-tight);
        letter-spacing: var(--heading-tracking);
        text-transform: var(--heading-transform);
        color: var(--color-text-secondary);
      }

      .note {
        margin: var(--space-2) 0 0;
        max-width: 62ch;
        font-family: var(--font-body);
        font-size: var(--text-sm);
        line-height: var(--leading-snug);
        color: var(--color-text-muted);
      }

      .facts {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2) var(--space-6);
        margin: var(--space-6) 0 0;
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        text-transform: var(--label-transform);
        letter-spacing: var(--label-tracking);
        color: var(--color-text-muted);
      }

      .fact--done {
        color: var(--color-success);
      }

      .fact--open {
        color: var(--color-warning);
      }

      /* Die Zyklusleiste. Sie zeigt, WO man steht — auch ohne laufende Uhr,
         denn die Position ist bekannt, nur die Restzeit nicht. */
      .segs {
        display: flex;
        gap: 3px;
        margin-top: var(--space-5);
      }

      .seg {
        flex: 1 1 0;
        height: 6px;
        background: var(--color-border-light);
      }

      .seg--past {
        background: color-mix(in srgb, var(--color-primary) 45%, transparent);
      }

      .seg--now {
        background: var(--color-primary);
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-5);
        margin-top: var(--space-8);
      }

      .cta {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-4) var(--space-8);
        min-height: 44px;
        background: var(--color-primary);
        color: var(--color-text-inverse);
        border: var(--border-width-thin) solid var(--color-border);
        box-shadow: var(--shadow-sm);
        cursor: pointer;
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: var(--text-sm);
        text-transform: var(--label-transform);
        letter-spacing: var(--label-tracking);
      }

      .link {
        background: none;
        border: 0;
        padding: 0;
        min-height: 44px;
        cursor: pointer;
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        text-transform: var(--label-transform);
        letter-spacing: var(--label-tracking);
        color: var(--color-text-muted);
      }

      .cta:focus-visible,
      .link:focus-visible {
        outline: none;
        box-shadow: var(--ring-focus);
      }

      /* ---- Der Beleg ---- */

      .plate {
        position: relative;
        aspect-ratio: 4 / 3;
        overflow: hidden;
        border: var(--border-width-thin) solid var(--color-border);
        box-shadow: var(--shadow-md);
        background: var(--color-surface-sunken);
      }

      .plate img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      .plate__grid {
        position: absolute;
        inset: 0;
        pointer-events: none;
        background-image:
          linear-gradient(var(--color-grid) 1px, transparent 1px),
          linear-gradient(90deg, var(--color-grid) 1px, transparent 1px);
        background-size: calc(var(--grid-size) / 2) calc(var(--grid-size) / 2);
        opacity: calc(var(--theme-polarity, 0) * 0.5);
      }

      .plate__cap {
        position: absolute;
        left: var(--space-3);
        right: var(--space-3);
        bottom: var(--space-3);
        display: flex;
        justify-content: space-between;
        gap: var(--space-3);
        padding: var(--space-1) var(--space-2);
        background: var(--color-surface);
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        text-transform: var(--label-transform);
        letter-spacing: var(--label-tracking);
        color: var(--color-text-primary);
      }

      .stats {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        margin-top: var(--space-4);
        border-top: var(--border-width-thin) solid var(--color-border);
        border-left: var(--border-width-thin) solid var(--color-border);
      }

      .stat {
        padding: var(--space-3);
        border-right: var(--border-width-thin) solid var(--color-border);
        border-bottom: var(--border-width-thin) solid var(--color-border);
      }

      .stat__k {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        text-transform: var(--label-transform);
        letter-spacing: var(--label-tracking);
        color: var(--color-text-muted);
      }

      .stat__v {
        margin-top: var(--space-1);
        font-family: var(--heading-font);
        font-weight: var(--heading-weight);
        font-size: var(--text-xl);
        font-variant-numeric: tabular-nums;
        color: var(--color-text-primary);
      }

      /* ---- Haltepunkte ---- */

      @container (max-width: 1023px) {
        .sheet {
          grid-template-columns: 1fr;
          gap: var(--space-8);
          min-height: 0;
        }

        .plate {
          aspect-ratio: 16 / 9;
        }
      }

      @container (max-width: 767px) {
        .headline {
          font-size: clamp(36px, 9vw, 56px);
        }

        .sheet {
          padding-block: var(--space-8);
        }

        .actions {
          flex-direction: column;
          align-items: stretch;
        }

        .cta {
          justify-content: center;
        }
      }
    `,
  ];

  @property({ attribute: false }) participation: ActiveEpochParticipation | null = null;

  /**
   * Der Abruf laeuft noch.
   *
   * Ohne dieses Merkmal hat `participation === null` ZWEI Bedeutungen — „wird
   * geladen" und „nimmt an nichts teil" — und die Buehne kann sie nicht
   * auseinanderhalten. Sie zeigte deshalb bei jedem Aufruf des Dashboards
   * kurz „nichts verlangt nach dir", bevor die Daten kamen: eine Auskunft,
   * die niemand geprueft hatte. Das ist schlimmer als ein Wartezeichen, denn
   * sie ist nicht nur unfertig, sondern moeglicherweise falsch.
   */
  @property({ type: Boolean, reflect: true }) loading = false;

  private readonly _cycle = new CycleCountdown(this);

  connectedCallback(): void {
    super.connectedCallback();
    this._cycle.watch(this.participation?.cycle_deadline_at);
  }

  protected updated(changed: Map<string, unknown>): void {
    if (changed.has('participation')) {
      this._cycle.watch(this.participation?.cycle_deadline_at);
    }
  }

  protected render() {
    const p = this.participation;

    return html`
      <div class="sheet-grid" aria-hidden="true"></div>
      <div class="sheet stage-container">
        ${this.loading ? this._renderLoading() : p ? this._renderActive(p) : this._renderIdle()}
      </div>
    `;
  }

  /**
   * Waehrend der Abruf laeuft.
   *
   * Der Blattkopf steht schon — er haengt nicht an den Daten, und ein Blatt
   * ohne Kopf saehe aus, als fehle es ganz. Darunter der Vermessungstakt statt
   * einer Aussage: die Buehne sagt, dass sie noch aufnimmt, und behauptet
   * nichts ueber den Bestand.
   */
  private _renderLoading() {
    return html`
      <div>
        <div class="sheet-head">
          <span class="sheet-head__no">${msg('Sheet 01')}</span>
          <span>${msg('Current deployment')}</span>
          <span class="sheet-head__rule"></span>
        </div>
        <velg-survey-loader size="lg" stacked .label=${msg('Surveying your deployment')}>
        </velg-survey-loader>
      </div>
    `;
  }

  /**
   * Ohne laufenden Einsatz.
   *
   * Kein leeres Raster und keine erfundene Zahl: die Buehne sagt, dass nichts
   * ansteht, und zeigt den Weg. Die rechte Spalte bleibt leer — ein Platzhalter
   * waere ein Bild von nichts.
   */
  private _renderIdle() {
    return html`
      <div>
        <div class="sheet-head">
          <span class="sheet-head__no">${msg('Sheet 01')}</span>
          <span>${msg('Current deployment')}</span>
          <span class="sheet-head__rule"></span>
        </div>
        <h1 class="headline">${msg('nothing requires you')}<em>.</em></h1>
        <p class="note">
          ${msg(
            'You are not taking part in any running epoch. Join one, or keep building your worlds.',
          )}
        </p>
        <div class="actions">
          <button class="cta atlas-lift-sm" @click=${() => navigate('/epoch')}>
            ${msg('Browse epochs')} <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    `;
  }

  private _renderActive(p: ActiveEpochParticipation) {
    const running = this._cycle.running;

    return html`
      <div>
        <div class="sheet-head">
          <span class="sheet-head__no">${msg('Sheet 01')}</span>
          <span>
            ${msg(str`Current deployment · ${p.epoch_name} · cycle ${p.current_cycle} / ${p.total_cycles}`)}
          </span>
          <span class="sheet-head__rule"></span>
        </div>

        <h1 class="headline">${p.epoch_name}<em>.</em></h1>

        ${
          running
            ? html`<p
                class="clock"
                role="timer"
                aria-live="off"
                aria-label=${msg(str`${this._cycle.hoursLeft} hours left in this cycle`)}
              >${this._cycle.formatted}</p>`
            : html`
                <p class="idle">${msg('No cycle clock running')}</p>
                <p class="note">
                  ${msg(
                    'This epoch has no cycle deadline set, so nothing is counting down. The cycle advances when the epoch is resolved.',
                  )}
                </p>
              `
        }

        <p class="facts">
          <span>${p.simulation_name}</span>
          <span>${msg(str`RP ${p.current_rp} / ${p.rp_cap}`)}</span>
          ${
            p.has_acted_this_cycle
              ? html`<span class="fact--done">${msg('Acted this cycle')}</span>`
              : html`<span class="fact--open">${msg('Not acted this cycle')}</span>`
          }
        </p>

        ${this._renderSegments(p)}

        <div class="actions">
          <button class="cta atlas-lift-sm" @click=${() => navigate('/epoch')}>
            ${msg('Enter war room')} <span aria-hidden="true">→</span>
          </button>
          <button class="link atlas-arrow" @click=${() => navigate('/epoch')}>
            ${msg('Review standing orders')}
          </button>
        </div>
      </div>

      <div>
        <div class="plate atlas-zoom">
          ${
            p.simulation_banner_url
              ? html`<img src=${p.simulation_banner_url} alt="" loading="lazy" decoding="async" />`
              : nothing
          }
          <div class="plate__grid" aria-hidden="true"></div>
          <span class="plate__cap">
            <span>${msg(str`Fig. 1 · ${p.simulation_name}`)}</span>
            <span>${msg(str`Rank ${p.rank}`)}</span>
          </span>
        </div>

        <div class="stats">
          <div class="stat">
            <div class="stat__k">${msg('Rank')}</div>
            <div class="stat__v">${p.rank}</div>
          </div>
          <div class="stat">
            <div class="stat__k">${msg('Rivals')}</div>
            <div class="stat__v">${p.participant_count}</div>
          </div>
          <div class="stat">
            <div class="stat__k">${msg('Resource points')}</div>
            <div class="stat__v">${p.current_rp}</div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Die Zyklusleiste.
   *
   * Sie zeigt die Position, nicht die Zeit — deshalb steht sie auch dann da,
   * wenn keine Uhr laeuft. Bei einer Epoche ohne Gesamtzahl (0) faellt sie weg:
   * eine Leiste ohne Nenner waere ein erfundener Fortschritt.
   */
  private _renderSegments(p: ActiveEpochParticipation) {
    if (p.total_cycles <= 0) return nothing;

    return html`
      <div class="segs" role="presentation">
        ${Array.from({ length: p.total_cycles }, (_v, i) => {
          const n = i + 1;
          const cls = n < p.current_cycle ? 'seg--past' : n === p.current_cycle ? 'seg--now' : '';
          return html`<span class="seg ${cls}"></span>`;
        })}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-atlas-stage': VelgAtlasStage;
  }
}

/**
 * BLATT 02 — Was Sie verlangt. Die Warteschlange des Atlas-Dashboards.
 *
 * Eine Zeile je laufender Epoche; was noch eine Entscheidung will, steht vorn.
 * Links die Rubrik mit der Zaehlung, rechts die Zellen.
 *
 * DIE ZAEHLUNG IST EINE MESSUNG, KEINE ERMUTIGUNG
 *   "3 von 5 warten auf Ihren Zug" — und wenn nichts wartet, steht das auch da.
 *   Die redaktionelle Fassung macht es genauso; die Formulierung ist von dort
 *   uebernommen, damit die zwei Vorlagen dieselbe Auskunft geben.
 *
 * DIE SORTIERUNG GEHOERT ZUR AUSSAGE
 *   Offene zuerst. Eine Warteschlange, in der das Erledigte oben steht, ist
 *   eine Liste, keine Warteschlange.
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { ActiveEpochParticipation } from '../../../types/index.js';
import { epochStatusLabel } from '../../../utils/enum-labels.js';
import { navigate } from '../../../utils/navigation.js';
import {
  atlasEntranceStyles,
  atlasHoverStyles,
  atlasSheetHeadStyles,
} from '../../shared/atlas-sheet-styles.js';
import { stageStyles } from '../../shared/stage-styles.js';

@localized()
@customElement('velg-atlas-queue')
export class VelgAtlasQueue extends LitElement {
  static styles = [
    atlasEntranceStyles,
    stageStyles,
    atlasSheetHeadStyles,
    atlasHoverStyles,
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
        background: var(--color-surface);
        border-bottom: var(--border-width-thin) solid var(--color-border);
      }

      .sheet {
        padding-block: var(--space-12);
        display: grid;
        grid-template-columns: 3fr 9fr;
        gap: var(--space-10);
        align-items: start;
      }

      h2 {
        margin: 0 0 var(--space-3);
        font-family: var(--heading-font);
        font-weight: var(--heading-weight);
        font-size: calc(var(--text-xl) * var(--stage-type-scale));
        line-height: var(--leading-tight);
        letter-spacing: var(--heading-tracking);
        text-transform: var(--heading-transform);
        color: var(--color-text-primary);
      }

      .lede {
        margin: 0;
        max-width: 34ch;
        font-family: var(--font-body);
        font-size: var(--text-sm);
        line-height: var(--leading-relaxed);
        color: var(--color-text-secondary);
      }

      /* Die Zellen tragen ihre Trennlinie rechts, die letzte keine — sonst
         steht am Ende der Reihe eine Linie ohne Nachbarn. */
      .cells {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        border-top: var(--border-width-thin) solid var(--color-border);
      }

      .cell {
        display: block;
        text-align: left;
        padding: var(--space-6);
        background: none;
        border: none;
        border-right: var(--border-width-thin) solid var(--color-border);
        border-bottom: var(--border-width-thin) solid var(--color-border);
        cursor: pointer;
        color: inherit;
      }

      .cell:last-child {
        border-right: none;
      }

      .cell:focus-visible {
        outline: none;
        box-shadow: var(--ring-focus);
      }

      .cell__top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        text-transform: var(--label-transform);
        letter-spacing: var(--label-tracking);
        color: var(--color-text-muted);
      }

      .flag {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
      }

      .flag__dot {
        width: 6px;
        height: 6px;
        flex: none;
        border-radius: var(--border-radius-full);
      }

      .flag--open {
        color: var(--color-danger);
      }

      .flag--open .flag__dot {
        background: var(--color-danger);
      }

      .flag--done {
        color: var(--color-success);
      }

      .flag--done .flag__dot {
        background: var(--color-success);
      }

      h3 {
        margin: var(--space-3) 0 var(--space-1);
        font-family: var(--heading-font);
        font-weight: var(--heading-weight);
        font-size: var(--text-lg);
        line-height: var(--leading-tight);
        letter-spacing: var(--heading-tracking);
        text-transform: var(--heading-transform);
        color: var(--color-text-primary);
      }

      .context {
        margin: 0;
        font-family: var(--font-body);
        font-size: var(--text-sm);
        line-height: var(--leading-snug);
        color: var(--color-text-secondary);
      }

      .foot {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
        margin-top: var(--space-5);
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        text-transform: var(--label-transform);
        letter-spacing: var(--label-tracking);
        color: var(--color-text-muted);
      }

      .foot__cta {
        color: var(--color-primary);
      }

      @container (max-width: 1023px) {
        .sheet {
          grid-template-columns: 1fr;
          gap: var(--space-6);
        }
      }

      @container (max-width: 767px) {
        .sheet {
          padding-block: var(--space-8);
        }

        /* Eine Spalte: die senkrechte Trennung waere dort eine Linie neben
           nichts, die waagerechte trennt die Zeilen. */
        .cells {
          grid-template-columns: 1fr;
        }

        .cell {
          border-right: none;
        }
      }
    `,
  ];

  @property({ attribute: false }) participations: ActiveEpochParticipation[] = [];

  /** Offene zuerst; sonst ist es eine Liste und keine Warteschlange. */
  private _sorted(): ActiveEpochParticipation[] {
    return [...this.participations].sort(
      (a, b) => Number(a.has_acted_this_cycle) - Number(b.has_acted_this_cycle),
    );
  }

  protected render() {
    const rows = this._sorted();
    if (!rows.length) return nothing;
    const open = rows.filter((p) => !p.has_acted_this_cycle).length;

    return html`
      <div class="sheet stage-container atlas-enter" style="--i: 2">
        <div>
          <div class="sheet-head">
            <span class="sheet-head__no">${msg('Sheet 02')}</span>
            <span>${msg('Requires you')}</span>
            <span class="sheet-head__rule"></span>
          </div>
          <h2>
            ${
              open > 0
                ? msg(str`${open} of ${rows.length} awaiting your move`)
                : msg('nothing awaiting your move')
            }
          </h2>
          <p class="lede">
            ${msg('One row per running epoch. What still wants a decision stands first.')}
          </p>
        </div>

        <div class="cells">${rows.map((p, i) => this._renderCell(p, i))}</div>
      </div>
    `;
  }

  private _renderCell(p: ActiveEpochParticipation, index: number) {
    const open = !p.has_acted_this_cycle;

    return html`
      <button
        class="cell atlas-lift-sm atlas-enter-row"
        style="--j: ${index}"
        @click=${() => navigate('/epoch')}
      >
        <div class="cell__top">
          <span>${p.simulation_name}</span>
          <span class="flag ${open ? 'flag--open' : 'flag--done'}">
            <span class="flag__dot" aria-hidden="true"></span>
            ${open ? msg('Awaiting your move') : msg('Acted')}
          </span>
        </div>

        <h3>${p.epoch_name}</h3>
        <p class="context">
          ${msg(str`${epochStatusLabel(p.epoch_status)} · Cycle ${p.current_cycle} of ${p.total_cycles}`)}
        </p>

        <div class="foot">
          <span>${msg(str`RP ${p.current_rp} / ${p.rp_cap}`)}</span>
          <span class="foot__cta atlas-arrow">
            ${open ? msg('Place orders') : msg('Review')}
            <span aria-hidden="true">→</span>
          </span>
        </div>
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-atlas-queue': VelgAtlasQueue;
  }
}

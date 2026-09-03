/**
 * Die Warteschlange — „was verlangt gerade etwas von mir".
 *
 * ⚠ WARUM HIER KEINE DREI KACHELN STEHEN, WENN ES NICHT DREI GIBT
 *
 * Der Entwurf zeigt ein Raster aus genau drei gleich grossen Zellen und füllt
 * sie mit „2 of 3 orders unplaced", „Ergebnis" und „Fortsetzen". Zwei davon
 * sind im Prototyp erfunden.
 *
 * Was messbar existiert, ist eine Zeile je laufender Epochenteilnahme —
 * mit Zyklus, Rangpunkten, Zustand und der einen binären Angabe, ob in diesem
 * Zyklus schon gehandelt wurde. Wer eine Epoche hat, sieht eine Kachel; wer
 * drei hat, sieht drei. Das Raster ist deshalb `auto-fit` und nicht
 * `repeat(3, 1fr)`: eine leere dritte Zelle wäre ein Versprechen auf eine
 * Aufgabe, die es nicht gibt.
 *
 * ⚠ UND WARUM ES NICHT „ORDERS PLACED 1/3" HEISST
 *
 * Einen Zähler mit Nenner gibt es nicht. `epoch_participants` trägt
 * `has_acted_this_cycle`, ein Ja/Nein. Ein erfundener Nenner wäre dieselbe
 * Sorte Behauptung wie die „47 worlds" des Frontseiten-Entwurfs, aus denen
 * gemessen 16 wurden.
 *
 * ⚠ UND WARUM NICHT „SORTED BY DEADLINE"
 *
 * Weil keine Frist läuft: null von sieben Epochen tragen eine
 * `cycle_deadline_at` (das Uhrwerk ist gebaut, ihm fehlt der Gegenstand —
 * siehe `DashboardStage`). Sortiert wird nach dem, was es gibt: was noch eine
 * Handlung verlangt, steht vorn. Sobald Fristen laufen, entscheidet die Frist
 * innerhalb dieser beiden Gruppen — dafür ist der Vergleich schon gebaut.
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { ActiveEpochParticipation } from '../../types/index.js';
import { epochStatusLabel } from '../../utils/enum-labels.js';
import { navigate } from '../../utils/navigation.js';
import { stageStyles } from '../shared/stage-styles.js';

@localized()
@customElement('velg-dashboard-queue')
export class VelgDashboardQueue extends LitElement {
  static styles = [
    stageStyles,
    css`
      :host {
        --_rule: var(--color-border-light);
        --_cell: var(--color-surface);
        --_cell-hover: color-mix(in srgb, var(--color-text-primary) 3%, var(--color-surface));

        display: block;
        padding-block: var(--space-12);
        border-bottom: var(--border-width-thin) solid var(--_rule);
      }

      :host([hidden]) {
        display: none;
      }

      .kicker {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        margin: 0 0 var(--space-5);
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: var(--text-xs);
        letter-spacing: var(--tracking-widest);
        text-transform: var(--label-transform);
        color: var(--color-accent-amber);
      }

      .kicker::before {
        content: '';
        width: 22px;
        height: 1px;
        background: var(--color-accent-amber);
        flex: 0 0 auto;
      }

      /* auto-fit statt repeat(3, 1fr): siehe Dateikopf. Eine leere Zelle wäre
         ein Versprechen auf eine Aufgabe, die es nicht gibt. */
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: var(--space-3-5);
      }

      .cell {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
        /* min-width: 0 ausdrücklich — die Zelle ist ein Flex-Behälter, und ein
           langer Epochenname darf das Raster nicht sprengen. */
        min-width: 0;
        padding: var(--space-5) var(--space-6);
        border: var(--border-width-thin) solid var(--_rule);
        background: var(--_cell);
        color: inherit;
        text-align: left;
        cursor: pointer;
        transition: background var(--transition-fast);
      }

      .cell:hover,
      .cell:focus-visible {
        background: var(--_cell-hover);
      }

      .cell__top {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: var(--space-4);
      }

      .cell__title {
        min-width: 0;
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: var(--text-sm);
        letter-spacing: var(--tracking-brutalist);
        text-transform: var(--label-transform);
        color: var(--color-text-primary);
      }

      .chip {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        flex: 0 0 auto;
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        letter-spacing: var(--tracking-wider);
        text-transform: var(--label-transform);
        white-space: nowrap;
        color: var(--color-text-quiet);
      }

      .chip__dot {
        width: 6px;
        height: 6px;
        border-radius: var(--border-radius-full);
        background: currentcolor;
        flex: 0 0 auto;
      }

      /* Bernstein blinkt: es ist das einzige, was eine Handlung verlangt. */
      .chip--open {
        color: var(--color-accent-amber);
      }

      .chip--open .chip__dot {
        animation: blink 2.2s ease-in-out infinite;
      }

      .chip--done {
        color: var(--color-accent-green);
      }

      @keyframes blink {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.3;
        }
      }

      .cell__context {
        margin: 0;
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        letter-spacing: var(--tracking-wide);
        color: var(--color-text-quiet);
      }

      .cell__foot {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: var(--space-4);
        margin-top: auto;
        padding-top: var(--space-2);
      }

      .cell__metric {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        letter-spacing: var(--tracking-wider);
        color: var(--color-text-secondary);
        white-space: nowrap;
      }

      .cell__cta {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        flex: 0 0 auto;
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: var(--text-xs);
        letter-spacing: var(--tracking-wider);
        text-transform: var(--label-transform);
        white-space: nowrap;
        color: var(--color-text-quiet);
      }

      .cell__arrow {
        transition: transform var(--transition-normal);
      }

      .cell:hover .cell__cta,
      .cell:focus-visible .cell__cta {
        color: var(--color-accent-amber);
      }

      .cell:hover .cell__arrow,
      .cell:focus-visible .cell__arrow {
        transform: translateX(5px);
      }

      @media (prefers-reduced-motion: reduce) {
        .chip--open .chip__dot,
        .cell__arrow {
          animation: none;
          transition: none;
        }

        .cell:hover .cell__arrow {
          transform: none;
        }
      }
    `,
  ];

  @property({ attribute: false }) participations: ActiveEpochParticipation[] = [];

  /** Offene Handlungen zuerst; innerhalb der Gruppe die frühere Frist zuerst.
   *
   *  Der Fristvergleich steht schon da, obwohl heute keine Frist läuft — er
   *  kostet nichts und greift von selbst, sobald die erste Epoche wieder durch
   *  ihren Übergang geht. Ihn wegzulassen hiesse, ihn später zu vergessen. */
  private _sorted(): ActiveEpochParticipation[] {
    return [...this.participations].sort((a, b) => {
      if (a.has_acted_this_cycle !== b.has_acted_this_cycle) {
        return a.has_acted_this_cycle ? 1 : -1;
      }
      const da = a.cycle_deadline_at ? Date.parse(a.cycle_deadline_at) : Number.POSITIVE_INFINITY;
      const db = b.cycle_deadline_at ? Date.parse(b.cycle_deadline_at) : Number.POSITIVE_INFINITY;
      return da - db;
    });
  }

  protected render() {
    const rows = this._sorted();
    if (!rows.length) return nothing;
    const open = rows.filter((p) => !p.has_acted_this_cycle).length;

    return html`
      <div class="stage-container">
        <p class="kicker">
          ${
            open > 0
              ? msg(str`Requires you // ${open} of ${rows.length} awaiting your move`)
              : msg('Requires you // nothing awaiting your move')
          }
        </p>
        <div class="grid">${rows.map((p) => this._renderCell(p))}</div>
      </div>
    `;
  }

  private _renderCell(p: ActiveEpochParticipation) {
    const open = !p.has_acted_this_cycle;
    return html`
      <button class="cell" @click=${() => navigate('/epoch')}>
        <div class="cell__top">
          <span class="cell__title">${p.epoch_name}</span>
          <span class="chip ${open ? 'chip--open' : 'chip--done'}">
            <span class="chip__dot" aria-hidden="true"></span>
            ${open ? msg('Awaiting your move') : msg('Acted')}
          </span>
        </div>
        <p class="cell__context">
          ${msg(str`${p.simulation_name} · ${epochStatusLabel(p.epoch_status)} · Cycle ${p.current_cycle} of ${p.total_cycles}`)}
        </p>
        <div class="cell__foot">
          <span class="cell__metric">${msg(str`RP ${p.current_rp} / ${p.rp_cap}`)}</span>
          <span class="cell__cta">
            ${open ? msg('Place orders') : msg('Review')}
            <span class="cell__arrow" aria-hidden="true">→</span>
          </span>
        </div>
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-dashboard-queue': VelgDashboardQueue;
  }
}

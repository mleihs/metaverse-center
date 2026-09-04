/**
 * BLATT 00 — Der Schreibtisch. Die Befehlsleiste des Atlas-Dashboards.
 *
 * Eine Zeile, fuenf Angaben und die Uhr: Blattnummer, Splitter, laufende
 * Einsaetze, Substratzustand mit Lebenszeichen, verzeichnete Beben. Sie steht
 * ueber allem anderen und beantwortet die Frage, die man beim Hinsetzen hat —
 * ist etwas passiert, waehrend ich weg war.
 *
 * WARUM DER PULSPUNKT NUR EINEN ZUSTAND HAT
 *   `substrate` ist 'stable' oder 'anomalous'. Der Punkt pulst gruen im ersten
 *   Fall und steht still in Zinnober im zweiten. Ein pulsierender Warnpunkt
 *   waere die falsche Richtung: was pulst, lebt; was gestoert ist, soll
 *   auffallen, indem es aufhoert sich zu bewegen. Dieselbe Logik wie eine
 *   Kontrollleuchte, die im Betrieb blinkt und im Fehlerfall dauerleuchtet.
 *
 * DIE UHR KOMMT VON AUSSEN
 *   Sie wird von `DashboardPage` getaktet, nicht hier. Zwei Uhren auf einer
 *   Seite gehen irgendwann auseinander, und diese Leiste soll nichts wissen
 *   muessen ausser dem, was ihr gereicht wird.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { atlasEntranceStyles, atlasSignalStyles } from '../../shared/atlas-sheet-styles.js';
import { stageStyles } from '../../shared/stage-styles.js';

@localized()
@customElement('velg-atlas-command-strip')
export class VelgAtlasCommandStrip extends LitElement {
  static styles = [
    atlasEntranceStyles,
    stageStyles,
    atlasSignalStyles,
    css`
      :host {
        display: block;
        background: var(--color-surface-raised);
        border-bottom: var(--border-width-thin) solid var(--color-border);
      }

      .strip {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3) var(--space-8);
        padding-block: var(--space-3);
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        text-transform: var(--label-transform);
        letter-spacing: var(--label-tracking);
        color: var(--color-text-muted);
      }

      .facts {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-3) var(--space-8);
      }

      .fact b {
        margin-left: var(--space-2);
        font-weight: var(--font-bold);
        color: var(--color-text-primary);
      }

      .fact--sheet {
        color: var(--color-primary);
      }

      .fact--substrate {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
      }

      /* Gestoert: der Punkt hoert auf zu pulsen und wird Zinnober. Die
         Animation wird ueber das gemeinsame Vokabular abgeschaltet, indem der
         Ring keine bekommt — die Farbe allein waere auf einem Blatt Papier zu
         leise fuer eine Stoerung. */
      .atlas-pulse--off {
        background: var(--color-danger);
      }

      .atlas-pulse--off::after {
        animation: none;
        border-color: var(--color-danger);
        opacity: 0.4;
      }

      .clock {
        font-variant-numeric: tabular-nums;
        color: var(--color-text-secondary);
      }

      @media (max-width: 767px) {
        .strip {
          gap: var(--space-2) var(--space-5);
        }
      }
    `,
  ];

  @property({ type: Number }) shards = 0;
  @property({ type: Number }) activeOps = 0;
  @property({ type: String }) substrate: 'anomalous' | 'stable' = 'stable';
  @property({ type: Number }) tremors = 0;
  @property({ type: String }) clock = '';

  protected render() {
    const stable = this.substrate !== 'anomalous';

    return html`
      <div class="strip stage-container atlas-enter">
        <div class="facts">
          <span class="fact fact--sheet">${msg('Sheet 00 · Operative desk')}</span>
          <span class="fact">${msg('Shards')}<b>${this.shards}</b></span>
          <span class="fact">${msg('Active ops')}<b>${this.activeOps}</b></span>
          <span class="fact fact--substrate">
            ${msg('Substrate')}
            <span
              class="atlas-pulse ${stable ? '' : 'atlas-pulse--off'}"
              aria-hidden="true"
            ></span>
            <b>${stable ? msg('stable') : msg('anomalous')}</b>
          </span>
          <span class="fact">${msg('Tremors on file')}<b>${this.tremors}</b></span>
        </div>
        <span class="clock">${this.clock}</span>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-atlas-command-strip': VelgAtlasCommandStrip;
  }
}

/**
 * Der gemeinsame Wartezustand — an 46 Stellen im Werk.
 *
 * Er zeigte bis zum 04.09.2026 einen Kreisel: ein 40-px-Quadrat mit einer
 * rotierenden Kante. Das ist die Vorgabe jeder Anwendung und sagt nichts ueber
 * diese hier. Seither zeigt er den Vermessungstakt (velg-survey-loader) — ein
 * kleines Feld, das Zelle fuer Zelle abgeschritten wird, wie ein Grundstueck,
 * das jemand gerade aufnimmt.
 *
 * WARUM DIE AENDERUNG HIER STATT AN 46 STELLEN
 *   Weil dieses Bauteil genau dafuer da ist. Jede Ansicht, die schon
 *   velg-loading-state benutzt, bekommt das neue Zeichen ohne eine Zeile
 *   Aenderung — und behaelt ihre eigene Beschriftung, denn die Schnittstelle
 *   (`message`) bleibt dieselbe.
 *
 * WARUM KEIN EIGENER ATLAS-WARTEZUSTAND
 *   Der Takt fragt nirgends nach dem Skin: er nimmt --color-grid,
 *   --color-border und --color-primary wie jede Platte der Mappe. Auf Papier
 *   liest er als Vermessung, auf Phosphor als abtastende Sensorzeile —
 *   dieselbe Bewegung, zwei Lesarten, eine Datei.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './VelgSurveyLoader.js';

@localized()
@customElement('velg-loading-state')
export class VelgLoadingState extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 200px;
      padding: var(--space-8);
    }
  `;

  /**
   * Die Beschriftung. Leer laesst sie weg — der Takt setzt dann selbst eine
   * verborgene fuer den Schirmleser, denn ein Wartezeichen ohne Wort ist fuer
   * einen Schirmleser gar kein Zeichen.
   */
  @property({ type: String }) message = msg('Loading...');

  protected render() {
    return html`
      <div class="loading">
        <velg-survey-loader size="lg" stacked .label=${this.message}></velg-survey-loader>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-loading-state': VelgLoadingState;
  }
}

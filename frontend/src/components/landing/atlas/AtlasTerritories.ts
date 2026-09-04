/**
 * BLATT 04 — Vermessene Gebiete.
 *
 * Vier Welten als Blaetter einer Mappe: Bild im Rahmen, Blattnummer in der
 * Ecke, darunter Zustand, Einwohnerzahl, Name und Beschreibung.
 *
 * DIE UEBERSCHRIFT ZAEHLT, SIE BEHAUPTET NICHT
 *   Der Prototyp schreibt "sixteen worlds in transmission". Sechzehn ist heute
 *   richtig und morgen falsch, und eine Zahl in einer uebersetzten Zeichenkette
 *   wird nie wieder nachgezaehlt. Sie kommt deshalb aus dem Schnappschuss.
 *   Fehlt er, steht die Ueberschrift ohne Zahl da — dieselbe Regel wie im
 *   Buero-Absatz auf Blatt 08.
 *
 * VIER VON SECHZEHN, UND DAS STEHT DABEI
 *   Der Schnappschuss liefert vier Welten fuer die Frontseite. Der Verweis
 *   daneben nennt die Gesamtzahl, damit niemand die vier fuer den ganzen
 *   Bestand haelt.
 *
 * KEIN BILD, KEIN LEERER RAHMEN
 *   `banner_url` ist nullbar. Statt eines grauen Kastens traegt der Rahmen dann
 *   das Vermessungsraster allein — auf einem Kartenblatt ist eine leere,
 *   linierte Flaeche kein Fehler, sondern ein Gebiet, das noch niemand
 *   fotografiert hat.
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { LandingCounts, LandingWorld } from '../../../types/index.js';
import { t } from '../../../utils/locale-fields.js';
import { navigate } from '../../../utils/navigation.js';
import {
  atlasGridStyles,
  atlasHoverStyles,
  atlasSheetHeadStyles,
} from '../../shared/atlas-sheet-styles.js';
import { stageStyles } from '../../shared/stage-styles.js';

@localized()
@customElement('velg-atlas-territories')
export class VelgAtlasTerritories extends LitElement {
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
        padding-block: var(--space-16);
      }

      .head {
        display: flex;
        justify-content: space-between;
        align-items: end;
        gap: var(--space-8);
        margin-bottom: var(--space-8);
      }

      h2 {
        margin: 0;
        font-family: var(--heading-font);
        font-weight: var(--heading-weight);
        font-size: calc(var(--text-2xl) * var(--stage-type-scale));
        line-height: var(--leading-tight);
        letter-spacing: var(--heading-tracking);
        text-transform: var(--heading-transform);
        color: var(--color-text-primary);
      }

      .all {
        flex: 0 0 auto;
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

      .all:focus-visible {
        outline: none;
        box-shadow: var(--ring-focus);
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: var(--space-6);
      }

      .card {
        display: block;
        text-align: left;
        background: none;
        border: 0;
        padding: 0;
        cursor: pointer;
        color: inherit;
      }

      .card:focus-visible {
        outline: none;
        box-shadow: var(--ring-focus);
      }

      .plate {
        position: relative;
        aspect-ratio: 1 / 1;
        overflow: hidden;
        border: var(--border-width-thin) solid var(--color-border);
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
        background-size: calc(var(--grid-size) / 3) calc(var(--grid-size) / 3);
        opacity: calc(var(--theme-polarity, 0) * 0.5);
      }

      .plate__no {
        position: absolute;
        right: var(--space-2);
        top: var(--space-2);
        padding: var(--space-0-5) var(--space-2);
        background: var(--color-surface);
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        /* Wie jedes andere Etikett auf diesem Blatt. Ohne die Zeile war die
           Blattnummer die einzige Mono-Angabe der Seite in Gemischtschrift —
           im Bildschirmfoto sofort als Ausreisser zu sehen. */
        text-transform: var(--label-transform);
        letter-spacing: var(--label-tracking);
        color: var(--color-text-primary);
      }

      /* NICHT space-between, und das ist der Punkt.
         Diese Karte ist die einzige der Mappe ohne Innenabstand: ihr Inhalt
         liegt buendig auf den Spaltenkanten, weil die Platte darueber eine
         gerahmte Abbildung ist und ihr Rahmen die Spalte definiert. Mit
         space-between wurde die Buergerzahl gegen genau diese Kante gedrueckt
         -- gemessen am 04.09.2026: null Pixel zwischen dem letzten Buchstaben
         und der Plattenkante. Bei den Karten eins bis drei folgt darauf eine
         Rasterluecke und es faellt nicht auf; bei der letzten der Reihe folgt
         der Blattrand, und das Wort sieht aus, als sei es hinuntergefallen.

         Die Mappe hat fuer ein Etikettenpaar ohnehin schon eine Grammatik --
         der Blattkopf schreibt "BLATT 04 · VERMESSENE GEBIETE", nebeneinander
         mit Trennpunkt, nicht auseinandergezogen. Die Meta-Zeile folgt ihr
         jetzt. Damit beruehrt nichts mehr die rechte Kante, und die Zeile liest
         als eine Angabe statt als zwei, die sich meiden. */
      .facts {
        display: flex;
        justify-content: flex-start;
        gap: var(--space-2);
        margin-top: var(--space-3);
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        text-transform: var(--label-transform);
        letter-spacing: var(--label-tracking);
        color: var(--color-text-muted);
      }

      .facts__live {
        color: var(--color-success);
      }

      /* Der Trennpunkt gehoert der Zeile, nicht den zwei Angaben: er nimmt
         deshalb den leisesten Ton und ist fuer Vorlesegeraete nicht da. */
      .facts__dot {
        color: var(--color-border);
      }

      h3 {
        margin: var(--space-2) 0 var(--space-1);
        font-family: var(--heading-font);
        font-weight: var(--heading-weight);
        font-size: var(--text-lg);
        line-height: var(--leading-tight);
        letter-spacing: var(--heading-tracking);
        text-transform: var(--heading-transform);
        color: var(--color-text-primary);
      }

      .desc {
        margin: 0;
        font-family: var(--font-body);
        font-size: var(--text-sm);
        line-height: var(--leading-snug);
        color: var(--color-text-secondary);
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      @container (max-width: 1023px) {
        .grid {
          grid-template-columns: 1fr 1fr;
        }
      }

      @container (max-width: 639px) {
        .sheet {
          padding-block: var(--space-10);
        }

        .grid {
          grid-template-columns: 1fr;
        }

        /* Quadratisch untereinander waere eine sehr lange Seite; im Querformat
           bleiben vier Gebiete ein Blatt statt vier Bildschirme. */
        .plate {
          aspect-ratio: 16 / 10;
        }

        .head {
          flex-direction: column;
          align-items: flex-start;
          gap: var(--space-4);
        }
      }
    `,
  ];

  @property({ type: Array, attribute: false }) worlds: LandingWorld[] = [];
  @property({ type: Object, attribute: false }) counts: LandingCounts | null = null;

  protected render() {
    const live = this.counts?.worlds_live ?? null;

    return html`
      <div class="sheet-grid" aria-hidden="true"></div>
      <div class="sheet stage-container">
        <div class="sheet-head">
          <span class="sheet-head__no">${msg('Sheet 04')}</span>
          <span>${msg('Surveyed territories')}</span>
          <span class="sheet-head__rule"></span>
        </div>

        <div class="head">
          <h2>
            ${
              live && live > 0
                ? msg(str`${live} worlds in transmission`)
                : msg('worlds in transmission')
            }
          </h2>
          <button class="all atlas-arrow" @click=${() => navigate('/worlds')}>
            ${live && live > 0 ? msg(str`All ${live} sheets`) : msg('All sheets')}
            <span aria-hidden="true">→</span>
          </button>
        </div>

        <div class="grid">
          ${this.worlds.map((world, index) => this._renderWorld(world, index))}
        </div>
      </div>
    `;
  }

  private _renderWorld(world: LandingWorld, index: number) {
    const sheet = String(index + 1).padStart(2, '0');

    return html`
      <button
        class="card atlas-lift"
        @click=${() => navigate(`/simulations/${world.slug}`)}
      >
        <div class="plate atlas-zoom">
          ${
            world.banner_url
              ? html`<img src=${world.banner_url} alt="" loading="lazy" decoding="async" />`
              : nothing
          }
          <div class="plate__grid" aria-hidden="true"></div>
          <span class="plate__no">${msg(str`Sheet ${sheet}`)}</span>
        </div>

        <p class="facts">
          <span class=${world.transmitting ? 'facts__live' : ''}>
            ${world.transmitting ? msg('Transmitting') : msg('Quiet')}
          </span>
          <span class="facts__dot" aria-hidden="true">·</span>
          <span>${msg(str`${world.agent_count} citizens`)}</span>
        </p>

        <h3>${t(world, 'name')}</h3>
        <p class="desc">${t(world, 'description')}</p>
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-atlas-territories': VelgAtlasTerritories;
  }
}

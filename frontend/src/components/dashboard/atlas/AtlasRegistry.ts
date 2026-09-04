/**
 * BLATT 04 — Von anderen vermessen. Das Weltenregister.
 *
 * Sechs Blaetter aus dem Bestand, darunter eine Zeile, die sagt, wie viele
 * noch da sind.
 *
 * DAS REGISTER ZAEHLT, WAS ANKOMMT
 *   Die Zahl in der Ueberschrift ist `worlds.length` — die Laenge dessen, was
 *   der Abruf geliefert hat, nicht eine Gesamtzahl aus einer anderen Quelle.
 *   Der Abruf holt bis zu hundert; kaeme spaeter eine Blaetterung dazu, waere
 *   diese Zahl still falsch. Deshalb steht sie neben genau den Karten, die sie
 *   zaehlt, und die Restzeile rechnet aus derselben Liste.
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { Simulation } from '../../../types/index.js';
import { simulationThemeLabel } from '../../../utils/enum-labels.js';
import { t } from '../../../utils/locale-fields.js';
import { navigate } from '../../../utils/navigation.js';
import {
  atlasEntranceStyles,
  atlasHoverStyles,
  atlasSheetHeadStyles,
} from '../../shared/atlas-sheet-styles.js';
import { stageStyles } from '../../shared/stage-styles.js';

/** Wie viele Blaetter gezeigt werden. Der Rest begruendet die Zeile darunter. */
const CARD_COUNT = 6;

@localized()
@customElement('velg-atlas-registry')
export class VelgAtlasRegistry extends LitElement {
  static styles = [
    atlasEntranceStyles,
    stageStyles,
    atlasSheetHeadStyles,
    atlasHoverStyles,
    css`
      :host {
        display: block;
        container-type: inline-size;
        /* Blatt 04. Steht am Wirt und nicht an einem Wrapper, weil render()
           hier Kopf und Raster als Geschwister liefert -- beide erben --i von
           hier, und ein Wrapper nur fuer eine Zahl waere ein Layout-Knoten
           ohne Aufgabe. */
        --i: 4;
      }

      .head {
        display: flex;
        justify-content: space-between;
        align-items: end;
        gap: var(--space-6);
        margin-bottom: var(--space-6);
      }

      h2 {
        margin: 0;
        font-family: var(--heading-font);
        font-weight: var(--heading-weight);
        font-size: clamp(26px, 3vw, 34px);
        line-height: var(--leading-tight);
        letter-spacing: var(--heading-tracking);
        text-transform: var(--heading-transform);
        color: var(--color-text-primary);
        /* KEIN white-space: nowrap.
           Der Pruefbericht des Prototyps verlangte, dass die Zahl in Klammern
           nicht allein auf die zweite Zeile rutscht -- das ist ein Verbot fuer
           EINE STELLE, nicht fuer die Zeile. Als nowrap gesetzt hat es am
           04.09.2026 im Dashboard genau das Gegenteil bewirkt: die Spalte des
           Registers ist dort 341 px breit, die deutsche Ueberschrift 432 px,
           und sie lief 43 px unter die rechte Schiene. Die Medienabfrage, die
           es bei 767 px zuruecknimmt, greift nicht -- das Fenster war 1100 px
           breit, eng war die SPALTE. Die Bindung sitzt jetzt dort, wo sie
           hingehoert: als geschuetztes Leerzeichen zwischen dem letzten Wort
           und der Klammer. */
      }

      h2 span {
        color: var(--color-text-muted);
      }

      .link {
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

      .link:focus-visible,
      .card:focus-visible {
        outline: none;
        box-shadow: var(--ring-focus);
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        border-top: var(--border-width-thin) solid var(--color-border);
        border-left: var(--border-width-thin) solid var(--color-border);
      }

      .card {
        display: block;
        text-align: left;
        padding: var(--space-5);
        background: none;
        border: none;
        border-right: var(--border-width-thin) solid var(--color-border);
        border-bottom: var(--border-width-thin) solid var(--color-border);
        cursor: pointer;
        color: inherit;
      }

      /* Eine kleine Platte, damit das Register wie der Rest der Mappe liest:
         ein Blatt zeigt eine Aufnahme, keinen Text allein. Fehlt das Bild,
         bleibt das Raster — ein Gebiet, das noch niemand fotografiert hat. */
      /* display: block ist hier KEIN Beiwerk. Die Platte ist ein <span> --
         richtig so, ein <button> darf nur Phrasing-Inhalt tragen -- und ein
         Span ist inline. Eine Inline-Box ignoriert aspect-ratio UND
         overflow: hidden, und das Bild darin hat mit height: 100% nichts, woran
         es sich messen koennte. Das Bild lief deshalb ungeklippt auf seine
         natuerliche Hoehe und schob Nummer, Meta-Zeile und Namen aus dem Blick:
         man sah nur Bilder. Das Landing-Gegenstueck (AtlasTerritories .plate)
         hat dasselbe CSS und ein <div> im Markup -- deshalb fiel es dort nie
         auf. Gemeldet am 04.09.2026. */
      .card__plate {
        display: block;
        position: relative;
        aspect-ratio: 16 / 9;
        margin-bottom: var(--space-3);
        overflow: hidden;
        border: var(--border-width-thin) solid var(--color-border-light);
        background: var(--color-surface-sunken);
      }

      .card__plate img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      .card__plate span {
        position: absolute;
        inset: 0;
        pointer-events: none;
        background-image:
          linear-gradient(var(--color-grid) 1px, transparent 1px),
          linear-gradient(90deg, var(--color-grid) 1px, transparent 1px);
        background-size: calc(var(--grid-size) / 4) calc(var(--grid-size) / 4);
        opacity: calc(var(--theme-polarity, 0) * 0.5);
      }

      .card__no {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        text-transform: var(--label-transform);
        letter-spacing: var(--label-tracking);
        color: var(--color-primary);
      }

      /* Derselbe Denkfehler wie bei h2, eine Ebene tiefer. Der Pruefbericht
         meinte: eine Angabe darf nicht mitten im Wort brechen. Als nowrap auf
         der ZEILE lief sie bei 170 px Kartenbreite (zwei Spalten in einer
         341-px-Schiene) aus der Karte heraus -- "BENUTZERDEFINIERT 6 BÜRGER"
         passt dort in keiner Sprache. Das Verbot sitzt jetzt auf den beiden
         Angaben, der Umbruch ZWISCHEN ihnen ist erlaubt. Damit braucht es
         keinen Haltepunkt: die Zeile bleibt einzeilig, solange sie passt, und
         bricht genau dann, wenn sie es nicht mehr tut. */
      .card__meta {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        gap: var(--space-1) var(--space-3);
        margin-top: var(--space-3);
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        text-transform: var(--label-transform);
        letter-spacing: var(--label-tracking);
        color: var(--color-text-muted);
      }

      .card__meta > span {
        white-space: nowrap;
      }

      h3 {
        margin: var(--space-2) 0 0;
        font-family: var(--heading-font);
        font-weight: var(--heading-weight);
        font-size: var(--text-md);
        line-height: var(--leading-tight);
        letter-spacing: var(--heading-tracking);
        text-transform: var(--heading-transform);
        color: var(--color-text-primary);
        /* Ein Weltname ist erzeugter Text und kann ein einzelnes langes Wort
           sein -- im Deutschen fast immer. Gemessen auf Prod am 04.09.2026:
           "Staatspathographie" braucht 155 px in einer 129 px breiten Spalte
           und lief 26 px ueber die Kartenkante. Der Fehler war dabei nicht zu
           sehen, WEIL eine ueberlaufende Zeile die Element-Box nicht
           vergroessert: eine Pruefung ueber getBoundingClientRect meldet
           nichts. Die ehrliche Frage ist scrollWidth gegen clientWidth.

           hyphens vor break-word: die Trennung mit Trennstrich ist die
           richtige, break-word faengt nur, was sich nicht trennen laesst. */
        hyphens: auto;
        overflow-wrap: break-word;
      }

      .rest {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: var(--space-4);
        width: 100%;
        padding: var(--space-4) var(--space-5);
        background: none;
        border: none;
        border-bottom: var(--border-width-thin) solid var(--color-border);
        border-left: var(--border-width-thin) solid var(--color-border);
        border-right: var(--border-width-thin) solid var(--color-border);
        cursor: pointer;
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        text-transform: var(--label-transform);
        letter-spacing: var(--label-tracking);
        color: var(--color-text-muted);
      }

      /*
       * HIER MEDIEN- STATT CONTAINER-ABFRAGEN, UND ZWAR AUSNAHMSWEISE.
       *
       * Die Breite dieses Abschnitts entsteht nicht aus seinem Inhalt, sondern
       * aus der Spaltenteilung von .lower in DashboardPage — und die haengt
       * selbst an einer Medienabfrage: ab 1024 px abwaerts stapelt sie, sonst
       * teilt sie 1fr und die 620 px der Schiene.
       *
       * Damit springt die Spalte des Registers am Fenster: gemessen 696 px bei
       * einem 1440er Fenster, 1176 px bei 1920, und bei 1024 abwaerts die volle
       * Breite. Eine Container-Abfrage koennte die 976 px eines gestapelten
       * Tablets nicht von den 1176 px einer Desktop-Spalte unterscheiden und
       * gaebe dem Tablet drei Spalten. Die ehrliche Frage ist hier also
       * tatsaechlich die Fensterbreite — dieselbe, die der Elternteil stellt.
       */
      @media (max-width: 1279px) {
        .grid {
          grid-template-columns: repeat(2, 1fr);
        }
      }

      @media (max-width: 767px) {
        .grid {
          grid-template-columns: 1fr;
        }

        .head {
          flex-direction: column;
          align-items: flex-start;
          gap: var(--space-3);
        }
      }
    `,
  ];

  @property({ attribute: false }) worlds: Simulation[] = [];

  protected render() {
    if (!this.worlds.length) return nothing;
    const shown = this.worlds.slice(0, CARD_COUNT);
    const rest = this.worlds.length - shown.length;

    return html`
      <div class="sheet-head atlas-enter">
        <span class="sheet-head__no">${msg('Sheet 04')}</span>
        <span>${msg('Shard registry')}</span>
        <span class="sheet-head__rule"></span>
      </div>

      <div class="head atlas-enter">
        <!--
          Zwischen der Ueberschrift und der Klammer steht ein GESCHUETZTES
          Leerzeichen (U+00A0), kein gewoehnliches. Es ist im Quelltext nicht
          zu sehen und traegt trotzdem die Regel, die frueher als
          white-space: nowrap auf der ganzen Zeile stand: die Zahl soll beim
          Umbruch nicht allein auf der zweiten Zeile stehen. Wer es durch ein
          normales Leerzeichen ersetzt, bekommt genau das zurueck.
        -->
        <h2>${msg('surveyed by others')} <span>(${this.worlds.length})</span></h2>
        <button class="link atlas-arrow" @click=${() => navigate('/worlds')}>
          ${msg(str`All ${this.worlds.length} sheets`)} <span aria-hidden="true">→</span>
        </button>
      </div>

      <div class="grid">${shown.map((w, i) => this._renderCard(w, i))}</div>

      ${
        rest > 0
          ? html`<button class="rest atlas-arrow" @click=${() => navigate('/worlds')}>
              <!--
                Die Einzahl steht ausserhalb der Zeichenkette, nicht als
                Fragezeichen darin: eine Vorlage mit einer Verzweigung laesst
                sich nicht sinnvoll uebersetzen, weil die Uebersetzerin nicht
                sieht, welcher Zweig gemeint ist. Dafuer gibt es in diesem Werk
                ein eigenes Tor (lint-no-ternary-in-msg.sh).
              -->
              <span>
                ${rest === 1 ? msg('1 more sheet on file') : msg(str`${rest} more sheets on file`)}
              </span>
              <span>${msg('Browse the registry')} <span aria-hidden="true">→</span></span>
            </button>`
          : nothing
      }
    `;
  }

  private _renderCard(world: Simulation, index: number) {
    const sheet = String(index + 1).padStart(2, '0');
    const theme = world.theme ? simulationThemeLabel(world.theme) : '';

    return html`
      <button
        class="card atlas-zoom atlas-enter-row"
        style="--j: ${index}"
        @click=${() => navigate(`/simulations/${world.slug}`)}
      >
        <span class="card__plate">
          ${
            world.banner_url
              ? html`<img src=${world.banner_url} alt="" loading="lazy" decoding="async" />`
              : nothing
          }
          <span aria-hidden="true"></span>
        </span>
        <span class="card__no">${msg(str`Sheet ${sheet}`)}</span>
        <p class="card__meta">
          <span>${theme}</span>
          <span>${msg(str`${world.agent_count ?? 0} citizens`)}</span>
        </p>
        <h3>${t(world, 'name')}</h3>
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-atlas-registry': VelgAtlasRegistry;
  }
}

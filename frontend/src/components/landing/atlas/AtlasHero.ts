/**
 * BLATT 01 — Front. Der erste Bildschirm der Kartenmappe.
 *
 * WORIN ER SICH VOM REDAKTIONELLEN HERO UNTERSCHEIDET
 *   Nicht in der Farbe, sondern im Bau. Die redaktionelle Fassung ist ein
 *   randloses Bild mit vier Schleiern darueber und der Schlagzeile darin. Diese
 *   hier ist ein Blatt: Text in acht Spalten, eine gerahmte FIGUR in vier,
 *   Vermessungsraster dahinter. Ein Bild, das den ganzen Schirm fuellt, ist
 *   eine Buehne; ein Bild in einem Rahmen mit Nummer und Bildunterschrift ist
 *   ein Beleg. Die Kartenmappe zeigt Belege.
 *
 * DIE SCHLAGZEILE PASST SICH IN DIE SPALTE
 *   `12.5cqw` in einem `container-type: inline-size`: die Schriftgroesse
 *   kommt aus der Breite der TEXTSPALTE, nicht aus der des Fensters. Damit
 *   steht die Zeile bei jeder Breite genau randbuendig — das ist der Grund
 *   fuer die Container-Abfrage, nicht Bequemlichkeit. Unter 640 px faellt sie
 *   auf `clamp()` zurueck und darf umbrechen, weil eine randbuendige Zeile auf
 *   einem Telefon nur noch aus zwei Silben bestuende.
 *
 * DIE META-ZEILE STATT EINES LAUFBANDS
 *   Die redaktionelle Fassung laesst unten ein Laufband mit allen Kennzahlen
 *   laufen. Hier steht eine ruhige Zeile aus drei Angaben: Blattnummer,
 *   Massstab und das Lebenszeichen mit der Zahl der sendenden Welten. Ein Blatt
 *   in einer Mappe bewegt sich nicht.
 *
 *   Die Zahl kommt aus dem Schnappschuss und faellt weg, wenn sie 0 ist —
 *   dieselbe Regel wie im Laufband: "0 Welten senden" ist schlechter als
 *   nichts. Ohne Schnappschuss steht dort nur "Signal locked".
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { LandingCounts } from '../../../types/index.js';
import { navigate } from '../../../utils/navigation.js';
import {
  atlasGridStyles,
  atlasHoverStyles,
  atlasSignalStyles,
} from '../../shared/atlas-sheet-styles.js';
import { stageStyles } from '../../shared/stage-styles.js';
import {
  ATLAS_HERO_STEM,
  LANDING_IMAGE_SIZES,
  landingFallbackUrl,
  landingSrcset,
} from '../landing-images.js';
import '../LandingNav.js';

/**
 * Der Jahrgang der Bildmappe — dieselbe Angabe, die im Ablagepfad der Bilder
 * steht (platform/landing/2026-08/). Sie steht als Konstante hier und nicht als
 * Zeichenkette im Markup, damit beim naechsten Bildersatz eine Stelle zu
 * aendern ist und nicht eine gesuchte Zeile.
 */
const LANDING_ASSET_VINTAGE = '2026-08';

@localized()
@customElement('velg-atlas-hero')
export class VelgAtlasHero extends LitElement {
  static styles = [
    stageStyles,
    atlasGridStyles,
    atlasSignalStyles,
    atlasHoverStyles,
    css`
      :host {
        display: block;
        /*
         * ZWEI CONTAINER, INEINANDER, UND SIE BEANTWORTEN VERSCHIEDENE FRAGEN.
         *
         * Der Wirt spannt den Container fuer das BLATT auf: ob Text und Figur
         * neben- oder untereinander stehen, haengt an der Breite des Blattes.
         * .text spannt weiter unten einen zweiten auf, aus dem die Schlagzeile
         * ihre Groesse zieht — dort ist die Frage die Breite der SPALTE.
         *
         * Deshalb loest eine @container-Regel je nach Ziel gegen einen anderen
         * Container auf: .sheet und die Figur gegen den Wirt, .headline gegen
         * .text. Das ist Absicht und der Grund, warum die Regeln fuer die
         * Schlagzeile nicht im selben Block stehen wie die fuer das Blatt.
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
        grid-template-columns: 8fr 4fr;
        gap: var(--space-12);
        align-items: center;
        padding-block: clamp(var(--space-12), 8vw, var(--space-24));
      }

      /* Die Textspalte ist der Container, aus dem die Schlagzeile ihre Groesse
         zieht. Ohne diese Zeile faellt 12.5cqw auf den naechsten Container
         zurueck, und die Zeile richtet sich nach etwas anderem als ihrer
         eigenen Spalte. */
      .text {
        container-type: inline-size;
      }

      .meta {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2) var(--space-8);
        margin: 0 0 var(--space-8);
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        text-transform: var(--label-transform);
        letter-spacing: var(--label-tracking);
        color: var(--color-text-muted);
      }

      .meta b {
        color: var(--color-primary);
        font-weight: var(--font-bold);
      }

      .meta__signal {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
      }

      /*
       * Randbuendig ueber die Spalte. 12.5cqw ist kein gerundeter Wert: bei der
       * Laufweite von Bricolage im Gewicht 300 fuellt die laengere der beiden
       * Zeilen damit die Spalte fast genau aus.
       */
      .headline {
        margin: 0;
        font-family: var(--heading-font);
        font-weight: var(--heading-weight);
        font-size: 12.5cqw;
        line-height: 0.92;
        letter-spacing: var(--heading-tracking);
        text-transform: var(--heading-transform);
        color: var(--color-text-primary);
      }

      .headline span {
        display: block;
      }

      .headline em {
        font-style: normal;
        color: var(--color-primary);
      }

      .bottom {
        display: grid;
        grid-template-columns: 1fr auto;
        align-items: end;
        gap: var(--space-8);
        margin-top: var(--space-10);
      }

      .subline {
        margin: 0;
        max-width: 46ch;
        font-family: var(--font-prose);
        font-size: calc(var(--text-md) * var(--stage-type-scale));
        line-height: var(--leading-relaxed);
        color: var(--color-text-secondary);
        text-wrap: pretty;
      }

      .actions {
        display: flex;
        align-items: center;
        gap: var(--space-6);
      }

      .watch {
        background: none;
        border: 0;
        padding: 0;
        cursor: pointer;
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        text-transform: var(--label-transform);
        letter-spacing: var(--label-tracking);
        color: var(--color-text-muted);
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

      .cta:focus-visible,
      .watch:focus-visible {
        outline: none;
        box-shadow: var(--ring-focus);
      }

      /* ---- Die Figur ---- */

      .fig {
        margin: 0;
      }

      .fig__frame {
        position: relative;
        aspect-ratio: 3 / 4;
        overflow: hidden;
        border: var(--border-width-thin) solid var(--color-border);
        box-shadow: var(--shadow-md);
      }

      /*
       * DAS picture-ELEMENT BRAUCHT SEINE EIGENE GROESSE.
       *
       * Ohne diese Regel steht nur das img auf height: 100% — und 100 % von
       * WAS? Von seinem Elternteil, dem picture, und das ist display: inline
       * ohne Hoehe. Gemessen: der Rahmen stand leer da, nur Raster und
       * Scan-Streifen, das Bild auf null Pixel Hoehe. Kein Fehler in der
       * Konsole, kein fehlgeschlagener Abruf — das Bild war geladen und
       * unsichtbar.
       */
      .fig__frame picture {
        display: block;
        width: 100%;
        height: 100%;
      }

      .fig__frame img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      /*
       * Das Raster liegt AUF dem Bild, nicht dahinter: eine Fotografie in einer
       * Kartenmappe ist eine Aufnahme, ueber die jemand ein Gitter gelegt hat,
       * um sie zu vermessen. Deshalb hier eine zweite Lage statt der
       * Blattflaeche darunter.
       */
      .fig__grid {
        position: absolute;
        inset: 0;
        pointer-events: none;
        background-image:
          linear-gradient(var(--color-grid) 1px, transparent 1px),
          linear-gradient(90deg, var(--color-grid) 1px, transparent 1px);
        background-size: calc(var(--grid-size) / 2) calc(var(--grid-size) / 2);
        opacity: calc(var(--theme-polarity, 0) * 0.55);
      }

      .fig__label {
        position: absolute;
        left: var(--space-3);
        bottom: var(--space-3);
        padding: var(--space-1) var(--space-2);
        background: var(--color-surface);
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        text-transform: var(--label-transform);
        letter-spacing: var(--label-tracking);
        color: var(--color-text-primary);
      }

      figcaption {
        display: flex;
        justify-content: space-between;
        gap: var(--space-4);
        margin-top: var(--space-2);
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        text-transform: var(--label-transform);
        letter-spacing: var(--label-tracking);
        color: var(--color-text-muted);
      }

      /* ---- Haltepunkte nach responsive-spec.md ---- */

      /* Tablet hochkant: gestapelt, die Figur auf 16:9 — hochkant unter dem
         Text waere ein halber Bildschirm Foto vor dem naechsten Blatt. Gegen
         den WIRT, nicht das Fenster: eine Medienabfrage hier hat am 03.09.2026
         dazu gefuehrt, dass das Blatt bei 390 px Blattbreite zweispaltig
         stehenblieb, weil das Fenster 1728 breit war.

         DAS 16:9 HIER HAT EINE EIGENE BILDDATEI. Vom 04. bis 05.09.2026 nicht:
         da traf dieser Rahmen auf die neue 3:4-Quelle, und object-fit: cover
         schnitt 58 % der Zeichnung weg — genau der Beschnitt, gegen den die
         Hochkant-Fassung eingefuehrt worden war. Die source-media-Paare im
         Markup liefern hier die Rolle heroWide, einen beim Ableiten gesetzten
         Zuschnitt. Wer diese Regel aendert, aendert auch Role.aspect in
         derive_landing_images.py — sonst zeigt der Rahmen wieder etwas
         anderes als das Bild.
         (Keine Backticks in diesem Block: sie beenden das css-Template.) */
      @container (max-width: 1023px) {
        .sheet {
          grid-template-columns: 1fr;
          gap: var(--space-8);
        }

        .fig__frame {
          aspect-ratio: 16 / 9;
        }
      }

      /* Diese hier loest gegen .text auf, nicht gegen den Wirt — die
         Schlagzeile richtet sich nach ihrer Spalte. */
      @container (max-width: 639px) {
        .headline {
          font-size: clamp(44px, 14vw, 72px);
          line-height: 1;
        }

        .bottom {
          grid-template-columns: 1fr;
          gap: var(--space-6);
        }

        .actions {
          flex-direction: column-reverse;
          align-items: stretch;
        }

        .cta {
          justify-content: center;
        }
      }
    `,
  ];

  @property({ type: Object, attribute: false }) counts: LandingCounts | null = null;

  /*
   * WARUM VIER <source> STATT ZWEI.
   *
   * <picture> nimmt die ERSTE <source>, deren `media` UND `type` passen. Die
   * beiden schmalen stehen deshalb vorn: unter 1023 px ist der Rahmen 16:9
   * (siehe die @container-Regel oben), und die Hochkant-Quelle wuerde darin
   * unter `object-fit: cover` zu 58 % weggeschnitten. `heroWide` ist derselbe
   * Anmeldesaal, beim Ableiten auf 16:9 zugeschnitten — gemessen 78 KB statt
   * 364 KB, weil ein Telefon nicht mehr Pixel laedt, die es dann wegwirft.
   *
   * Die Umschaltung ist hier eine MEDIENabfrage, waehrend der Entwurf eine
   * Containerabfrage benutzt. Kein Versehen: `<source media>` kennt keine
   * Containerform. Beide stimmen ueberein, solange der Wirt so breit ist wie
   * das Fenster — was fuer die Frontseite gilt und in einer eingebetteten
   * Ansicht nicht mehr.
   */
  protected render() {
    const online = this.counts?.worlds_transmitting ?? 0;

    return html`
      <velg-landing-nav></velg-landing-nav>
      <div class="sheet-grid" aria-hidden="true"></div>

      <div class="sheet stage-container">
        <div class="text">
          <p class="meta">
            <span><b>${msg('Sheet 01')}</b> ${msg('· Front')}</span>
            <span>${msg('Scale 1 : one sentence')}</span>
            <span class="meta__signal">
              <span class="atlas-pulse" aria-hidden="true"></span>
              ${online > 0 ? msg(str`${online} worlds transmitting`) : msg('Signal locked')}
            </span>
          </p>

          <h1 class="headline">
            <span>${msg('living worlds,')}</span>
            <span>${msg('surveyed nightly')}<em>.</em></span>
          </h1>

          <div class="bottom">
            <p class="subline">
              ${msg(
                'A single sentence is enough to begin. What grows from it keeps its own hours, argues with itself, and remembers you longer than you would like.',
              )}
            </p>
            <div class="actions">
              <button class="watch atlas-arrow" @click=${() => navigate('/worlds')}>
                ${msg('Just watch one')} <span aria-hidden="true">→</span>
              </button>
              <button class="cta atlas-lift-sm" @click=${() => navigate('/forge')}>
                ${msg('Forge your world')} <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>
        </div>

        <figure class="fig">
          <div class="fig__frame atlas-scan atlas-zoom">
            <!-- Reihenfolge ist Logik: die erste passende source gewinnt. -->
            <picture>
              <source
                media="(max-width: 1023px)"
                type="image/avif"
                srcset=${landingSrcset(ATLAS_HERO_STEM, 'heroWide', 'avif')}
                sizes=${LANDING_IMAGE_SIZES.heroWide}
              />
              <source
                media="(max-width: 1023px)"
                type="image/webp"
                srcset=${landingSrcset(ATLAS_HERO_STEM, 'heroWide', 'webp')}
                sizes=${LANDING_IMAGE_SIZES.heroWide}
              />
              <source
                type="image/avif"
                srcset=${landingSrcset(ATLAS_HERO_STEM, 'heroPortrait', 'avif')}
                sizes=${LANDING_IMAGE_SIZES.heroPortrait}
              />
              <source
                type="image/webp"
                srcset=${landingSrcset(ATLAS_HERO_STEM, 'heroPortrait', 'webp')}
                sizes=${LANDING_IMAGE_SIZES.heroPortrait}
              />
              <img
                src=${landingFallbackUrl(ATLAS_HERO_STEM, 'heroPortrait')}
                alt=""
                fetchpriority="high"
                decoding="async"
              />
            </picture>
            <div class="fig__grid" aria-hidden="true"></div>
            <span class="fig__label">${msg('Fig. 1 · Intake hall')}</span>
          </div>
          <figcaption>
            <span>${msg('Bureau of Impossible Geography')}</span>
            <span>${LANDING_ASSET_VINTAGE}</span>
          </figcaption>
        </figure>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-atlas-hero': VelgAtlasHero;
  }
}

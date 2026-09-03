/**
 * BLATT 09 — Fundstuecke aus den Akten.
 *
 * Sechs Zettel aus sechs Systemen: eine unbeantwortete Beschwerde, eine
 * Zensus-Fussnote, ein Logbuch, eine Terminal-Zeile um 03:41, eine Zeitung
 * unter dem Falz, ein Einsatzbericht. Keiner erklaert etwas. Zusammen sagen
 * sie, was in diesen Welten fuer einen Ton herrscht — und das ist die einzige
 * Sache, die eine Frontseite nicht behaupten kann, sondern zeigen muss.
 *
 * ZWEI GESTALTEN, NICHT EINE MIT EINER MEDIENABFRAGE DARIN
 *   Ab 900 px klebt der Stapel in einem Wirt von N x 100vh und die oberste
 *   Karte zieht am Scrollfortschritt nach oben ab. Darunter gibt es KEIN
 *   Sticky, sondern ein waagerechtes Schnappband — so verlangt es die
 *   Responsive-Vorgabe, und aus einem harten Grund: ein Sticky-Wirt von
 *   6 x 100vh ist auf einem Telefon eine halbe Minute Scrollen, in der sich
 *   nichts bewegt als sechs Karten. Ein Band, das man wischt, ist dieselbe
 *   Sache in zwei Sekunden.
 *
 *   Die zwei Gestalten sind deshalb auch im JS getrennt: `stackReveal` wird
 *   unter 900 px gar nicht erst aufgesetzt. Ein Beobachter, der Werte auf
 *   Karten schreibt, die in einem Band liegen, waere nicht falsch — er waere
 *   unsichtbar falsch, und irgendwann greift eine Regel doch.
 *
 * BEI prefers-reduced-motion
 *   Ein statischer Faecher: drei Karten sichtbar, versetzt, ohne Bewegung. Der
 *   Rest steht darunter als Liste. Das Blatt verliert seine Choreografie und
 *   behaelt seinen Inhalt, was die richtige Reihenfolge der Verluste ist.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { captureError } from '../../../services/SentryService.js';
import { stackReveal } from '../../../utils/scroll-reveal.js';
import { atlasGridStyles, atlasSheetHeadStyles } from '../../shared/atlas-sheet-styles.js';
import { stageStyles } from '../../shared/stage-styles.js';

/** Ab hier klebt der Stapel; darunter ist es ein Schnappband. */
const STACK_MIN_WIDTH = 900;

interface Finding {
  kind: string;
  ref: string;
  quote: string;
}

@localized()
@customElement('velg-landing-findings')
export class VelgLandingFindings extends LitElement {
  static styles = [
    stageStyles,
    atlasSheetHeadStyles,
    atlasGridStyles,
    css`
      :host {
        display: block;
        border-bottom: var(--border-width-thin) solid var(--color-border);
        /* Die getoente Tafel; die Zettel darauf sind heller. Wie Blatt 03 im
           Prototyp, das denselben Ton nimmt. */
        background: var(--color-surface-raised);
      }

      /* Der Wirt, in dem der Stapel klebt. Die Hoehe kommt aus der Anzahl der
         Karten: eine Fensterhoehe pro Karte plus eine, damit die letzte oben
         auch stehen bleibt, bevor das Blatt endet. */
      .wrap {
        position: relative;
      }

      /* Das Raster klebt mit dem Blatt, nicht mit dem Wirt: der Wirt ist sechs
         Fensterhoehen hoch, ein inset:0-Raster darin waere ein 6-fach hohes
         Gitter, das beim Scrollen mitwandert statt zu stehen. */
      .stage {
        position: sticky;
      }

      .stage {
        position: sticky;
        top: 0;
        height: 100vh;
        display: grid;
        grid-template-columns: 4fr 8fr;
        gap: var(--space-12);
        align-content: center;
        padding-block: var(--space-10);
      }

      .lede h2 {
        margin: 0 0 var(--space-4);
        font-family: var(--heading-font);
        font-weight: var(--heading-weight);
        font-size: calc(var(--text-2xl) * var(--stage-type-scale));
        line-height: var(--leading-tight);
        letter-spacing: var(--heading-tracking);
        text-transform: var(--heading-transform);
        color: var(--color-text-primary);
      }

      .lede p {
        margin: 0;
        max-width: 40ch;
        font-family: var(--font-body);
        font-size: var(--text-sm);
        line-height: var(--leading-relaxed);
        color: var(--color-text-secondary);
      }

      /* Der Fortschritt als Strichreihe. Kein Balken: sechs Striche sagen
         zugleich, wie viele Zettel es gibt, was ein Balken nicht kann. */
      .ticks {
        display: flex;
        gap: var(--space-2);
        margin-top: var(--space-8);
      }

      .tick {
        width: 28px;
        height: 2px;
        border: none;
        padding: 0;
        background: var(--color-border-light);
        cursor: default;
      }

      .tick[data-on='true'] {
        background: var(--color-primary);
      }

      .deck {
        position: relative;
        display: grid;
        place-items: center;
      }

      /*
       * Die Karte. --stack-depth und --stack-shift schreibt stackReveal, die
       * Bewegung steht hier: Tiefe versetzt und verkleinert, Verschiebung zieht
       * die oberste nach oben ab.
       *
       * translate und scale als EIGENE Eigenschaften, nicht als
       * transform-Kurzschreibweise: so kann die Medienabfrage fuer reduzierte
       * Bewegung die eine abschalten und die andere behalten, ohne die ganze
       * Zeile neu zu schreiben.
       */
      /*
       * GLEICHE MASSE, NICHT NUR GLEICHER STIL.
       *
       * Die erste Fassung liess jede Karte so hoch werden wie ihr Text. Im
       * Browser gesehen: alle sechs zeigten ihren Text gleichzeitig, weil eine
       * hoehere Karte unter einer niedrigeren unten hervorschaut, und die
       * Schichtung daran nichts aendert. Ein Stapel besteht aus gleichen
       * Karten; das ist keine Kosmetik, es ist die Bedingung dafuer, dass er
       * als Stapel liest.
       *
       * Die Hoehe ist an das Fenster gebunden, nicht an den laengsten der
       * sechs Texte: der Stapel klebt in einer Fensterhoehe und darf sie nicht
       * ueberragen. Der Inhalt verteilt sich darin mit space-between, so dass
       * Art und Beleg an den Kanten sitzen und das Zitat dazwischen.
       *
       * UND KEIN AUSBLENDEN.
       *   Die zweite Fassung liess die oberste Karte mit
       *   opacity: calc(1 - shift) verschwinden. Im Browser gesehen: der Text
       *   ALLER sechs Karten stand durcheinander, weil die oberste ueber fast
       *   den ganzen Weg halb durchsichtig ist und den Stapel unter sich
       *   zeigt. Sie wandert ohnehin 120vh nach oben aus dem Bild — das
       *   Ausblenden war nie noetig und war genau der Fehler. Eine Karte, die
       *   weggezogen wird, verschwindet nicht, sie geht weg.
       */
      .card {
        position: absolute;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        width: min(440px, 80%, calc((100vh - 64px) * 0.8));
        height: min(58vh, 420px);
        padding: var(--space-8);
        /*
         * --color-surface, NICHT --color-background: letzteres gibt es als
         * Token nicht. color_background ist ein CONFIG-Schluessel, den
         * ThemeService auf --color-surface abbildet — der Name sieht wie ein
         * Token aus und ist keines. Gemessen: die Karte stand auf
         * rgba(0,0,0,0), also durchsichtig, und der Text aller sechs Zettel
         * lag uebereinander. lint-color-tokens.sh sieht rohe Hexwerte, nicht
         * ein var(), das ins Leere zeigt.
         */
        background: var(--color-surface);
        border: var(--border-width-thin) solid var(--color-border);
        box-shadow: var(--shadow-md);
        translate: 0 calc(
            var(--stack-depth, 0) * var(--stack-offset, 18px) - var(--stack-shift, 0) * 120vh
          );
        scale: calc(1 - var(--stack-depth, 0) * var(--stack-scale-step, 0.035));
        z-index: calc(100 - var(--stack-depth, 0));
      }

      .card__kind {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        text-transform: var(--label-transform);
        letter-spacing: var(--label-tracking);
        color: var(--color-primary);
      }

      /*
       * KEIN overflow-y: auto.
       *
       * Es stand hier als Vorsichtsmassnahme fuer ein langes Zitat. Gemessen:
       * die sechs Zitate brauchen 50 bis 76 px in einer Karte von 420 px, und
       * die Kiste lief um genau ZWEI Pixel ueber — ein Rundungsartefakt der
       * Zeilenhoehe. Fuenf von sechs Karten zeigten dafuer eine sichtbare
       * Bildlaufleiste. Eine Vorsichtsmassnahme, die gegen nichts schuetzt und
       * dabei ein Artefakt erzeugt, ist keine.
       */
      .card__quote {
        margin: var(--space-5) 0;
        font-family: var(--font-prose);
        font-size: calc(var(--text-md) * var(--stage-type-scale));
        line-height: var(--leading-snug);
        color: var(--color-text-primary);
      }

      .card__ref {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        letter-spacing: var(--label-tracking);
        color: var(--color-text-muted);
      }

      /* ---- Unter 900px: Schnappband statt Stapel ---- */
      @media (max-width: 899px) {
        .wrap {
          height: auto !important;
        }

        .stage {
          position: static;
          height: auto;
          grid-template-columns: 1fr;
          gap: var(--space-8);
          padding-block: var(--space-10);
        }

        .deck {
          display: flex;
          gap: var(--space-4);
          overflow-x: auto;
          scroll-snap-type: x mandatory;
          /* Der Rand gehoert INS Band, sonst klebt die erste Karte an der
             Kante des Bildschirms. */
          padding-inline: var(--stage-gutter);
          margin-inline: calc(var(--stage-gutter) * -1);
          place-items: stretch;
        }

        .card {
          position: static;
          flex: 0 0 auto;
          width: 320px;
          /* Im Band liegen die Karten nebeneinander, nicht uebereinander —
             dort darf die Hoehe wieder vom Text kommen, und auto laesst sie
             ueber align-items: stretch gleich hoch werden. */
          height: auto;
          scroll-snap-align: center;
          translate: none;
          scale: none;
        }

        .ticks {
          margin-top: var(--space-4);
        }
      }

      @media (max-width: 640px) {
        .card {
          width: 78vw;
        }
      }

      /*
       * Statischer Faecher. Die Bewegung faellt weg, der Versatz bleibt — sonst
       * lagen sechs Karten deckungsgleich uebereinander und man saehe eine.
       */
      @media (prefers-reduced-motion: reduce) {
        .wrap {
          height: auto !important;
        }

        .stage {
          position: static;
          height: auto;
        }

        .deck {
          display: grid;
          gap: var(--space-4);
          place-items: stretch;
        }

        .card {
          position: static;
          width: 100%;
          height: auto;
          translate: none;
          scale: none;
        }
      }
    `,
  ];

  @state() private _top = 0;

  private _release?: () => void;

  /** Sechs Zettel. Reihenfolge ist Absicht: Beschwerde zuerst, Bericht zuletzt. */
  private get _findings(): Finding[] {
    return [
      {
        kind: msg('Complaint · unanswered'),
        ref: msg('Chitinous Mandate · 7-C/221'),
        quote: msg(
          'Your world sneezed and three of mine wrote prophecies about it. Kindly sneeze less, or at least on schedule.',
        ),
      },
      {
        kind: msg('Census footnote'),
        ref: msg('Velgarien · Vol. XII, p. 4'),
        quote: msg(
          'Population 58, of whom 3 disputed, 1 fictional by court order, and 1 who insists on being counted twice on account of her twin who never arrived.',
        ),
      },
      {
        kind: msg('Logbook'),
        ref: msg('Barge Second Postscript · Drift 14'),
        quote: msg(
          'Halfway between two worlds the radio picks up both of their lullabies at once. That is the whole reason I run this route.',
        ),
      },
      {
        kind: msg('Terminal · 03:41'),
        ref: msg('Brine Chancellery · unfiled'),
        quote: msg(
          'I asked where my agent was. It wrote: "Grieving. Third bench from the fountain. Bring bread." I brought bread.',
        ),
      },
      {
        kind: msg('Broadsheet · below the fold'),
        ref: msg('The Brine Ledger · morning ed.'),
        quote: msg(
          'MOON LATE, CHANCELLOR SILENT. Beneath: a poem about the operator. It is not flattering. It scans.',
        ),
      },
      {
        kind: msg('Debrief fragment'),
        ref: msg('Descent authorization #88'),
        quote: msg(
          'Storey by storey the Deluge taught us subtraction. Four went down. The ledger shows three signatures and one water stain.',
        ),
      },
    ];
  }

  protected firstUpdated(): void {
    this._mountStack();
  }

  disconnectedCallback(): void {
    this._release?.();
    this._release = undefined;
    super.disconnectedCallback();
  }

  /**
   * Setzt den Stapel auf — aber nur dort, wo es einen Stapel gibt.
   *
   * Die zwei Bedingungen sind dieselben, die in der CSS das Sticky abschalten.
   * Sie stehen hier ein zweites Mal, weil eine Medienabfrage in CSS nichts
   * davon weiss, dass JS Werte schreibt. Sie auseinanderlaufen zu lassen waere
   * die eigentliche Gefahr: dann rechnete der Beobachter fuer ein Layout, das
   * nicht da ist.
   */
  private _mountStack(): void {
    this._release?.();
    this._release = undefined;

    const narrow = window.matchMedia(`(max-width: ${STACK_MIN_WIDTH - 1}px)`).matches;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (narrow || still) return;

    const wrap = this.renderRoot.querySelector<HTMLElement>('.wrap');
    const cards = [...this.renderRoot.querySelectorAll<HTMLElement>('.card')];
    if (!wrap || cards.length === 0) return;

    // Eine Fensterhoehe pro Karte, plus eine fuer den Stand der letzten.
    wrap.style.height = `${(cards.length + 1) * 100}vh`;

    try {
      this._release = stackReveal(wrap, cards);
    } catch (err) {
      captureError(err, { source: 'VelgLandingFindings._mountStack' });
    }

    /*
     * Die Strichreihe braucht die Nummer der obersten Karte. Sie kommt aus
     * demselben Wert, den stackReveal auf die Karten schreibt, statt aus einer
     * zweiten Rechnung: zwei Rechnungen fuer dieselbe Zahl gehen irgendwann
     * auseinander, und dann zeigt die Reihe eine andere Karte an als die, die
     * oben liegt.
     */
    const readTop = (): void => {
      const idx = cards.findIndex(
        (c) => Number(c.style.getPropertyValue('--stack-depth') || '0') === 0,
      );
      if (idx < 0) return;
      /*
       * Nicht die oberste Karte, sondern die SICHTBARE.
       *
       * Gemessen: bei einem Teilfortschritt von 0,69 stand die erste Karte
       * formal noch oben, war aber zu zwei Dritteln weggezogen — der Leser sah
       * die zweite, und die Strichreihe zeigte die erste. Eine Fortschritts-
       * anzeige, die etwas anderes anzeigt als das, was man liest, ist
       * schlechter als keine.
       *
       * Die halbe Verschiebung ist die Grenze: ab da verdeckt die neue Karte
       * mehr als die alte.
       */
      const shift = Number(cards[idx].style.getPropertyValue('--stack-shift') || '0');
      const visible = Math.min(cards.length - 1, idx + (shift > 0.5 ? 1 : 0));
      if (visible !== this._top) this._top = visible;
    };
    window.addEventListener('scroll', readTop, { passive: true });
    const release = this._release;
    this._release = () => {
      window.removeEventListener('scroll', readTop);
      release?.();
    };
  }

  protected render() {
    const findings = this._findings;

    return html`
      <div class="wrap">
        <div class="stage stage-container">
          <div class="sheet-grid" aria-hidden="true"></div>
          <div class="lede">
            <div class="sheet-head">
              <span class="sheet-head__no">${msg('Sheet 09')}</span>
              <span>${msg('Found in the files')}</span>
              <span class="sheet-head__rule"></span>
            </div>
            <h2>${msg('nobody wrote these for you')}</h2>
            <p>
              ${msg(
                'Six slips from six systems. None of them explains anything. Together they are the only honest answer to what these worlds sound like.',
              )}
            </p>

            <div class="ticks" role="presentation">
              ${findings.map(
                (_f, i) => html`<span class="tick" data-on=${String(i <= this._top)}></span>`,
              )}
            </div>
          </div>

          <div class="deck">
            ${findings.map(
              (f) => html`
                <article class="card">
                  <p class="card__kind">${f.kind}</p>
                  <blockquote class="card__quote">${f.quote}</blockquote>
                  <p class="card__ref">${f.ref}</p>
                </article>
              `,
            )}
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-landing-findings': VelgLandingFindings;
  }
}

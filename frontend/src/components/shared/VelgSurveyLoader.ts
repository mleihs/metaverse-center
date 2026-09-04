/**
 * DER VERMESSUNGSTAKT — das Wartezeichen dieses Werks.
 *
 * Ein Kreisel ist die Vorgabe jeder Anwendung und sagt nichts ueber diese
 * hier. Das Werk ist ein Vermessungsamt: nummerierte Blaetter, Platten,
 * Rasterlinien, Mono-Etiketten. Also wartet es auch so — ein kleines Feld
 * wird Zelle fuer Zelle abgeschritten, in einer Welle von links oben nach
 * rechts unten, wie ein Grundstueck, das jemand gerade aufnimmt.
 *
 * WARUM EIN BAUTEIL FUER BEIDE SKINS UND NICHT EINES JE SKIN
 *   Kein Selektor hier fragt nach dem Skin. Das Feld nimmt --color-grid und
 *   --color-border wie jede Platte, die Zellen --color-primary. Auf dem Papier
 *   liest das als Vermessung, auf dem Phosphor als abtastende Sensorzeile —
 *   dieselbe Bewegung, zwei Lesarten, eine Datei. Ein zweites Bauteil "fuer
 *   Atlas" waere beim ersten Nachschaerfen auseinandergelaufen, und der
 *   Unterschied waere unsichtbar geblieben: beide haetten weiter gewartet.
 *
 * WO ES ERSCHEINT
 *   In velg-loading-state, und damit ohne weiteres Zutun an allen 46 Stellen,
 *   die den gemeinsamen Wartezustand schon benutzen. Direkt eingesetzt wird es
 *   nur dort, wo ein Abschnitt seinen eigenen Rahmen mitbringt und den
 *   Mindestraum von velg-loading-state nicht will — die Buehne des Dashboards
 *   zum Beispiel.
 *
 * WAS DER SCHIRMLESER HOERT
 *   Der Wirt traegt role=status; das Feld ist aria-hidden, weil sechzehn
 *   Zellen nichts zu sagen haben. Gesprochen wird die Beschriftung, und wenn
 *   der Aufrufer keine setzt, eine verborgene Vorgabe — ein Wartezeichen ohne
 *   Wort ist fuer einen Schirmleser gar kein Zeichen.
 *
 * ES GIBT KEINE BACKTICKS IN DIESEN KOMMENTAREN.
 *   Ein Backtick beendet das css-Template, und biome zerlegt danach den
 *   gesamten Block zu JavaScript, ohne zu klagen.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { a11yStyles } from './a11y-styles.js';

/**
 * Die Kantenlaenge des Feldes in Zellen.
 *
 * Vier, nicht drei und nicht fuenf: bei drei ist die Welle nach fuenf
 * Diagonalen vorbei und wirkt wie ein Zucken, bei fuenf wird die einzelne
 * Zelle bei der kleinen Groesse schmaler als der Rasterstrich, den sie
 * teilt — dann sieht man kein Feld mehr, sondern ein Grau.
 */
const KANTE = 4;

/** Die sechzehn Zellen, jede mit ihrer Diagonalen als Staffelindex. */
const ZELLEN: readonly number[] = Array.from({ length: KANTE * KANTE }, (_, i) => {
  const zeile = Math.floor(i / KANTE);
  const spalte = i % KANTE;
  return zeile + spalte;
});

@localized()
@customElement('velg-survey-loader')
export class VelgSurveyLoader extends LitElement {
  static styles = [
    a11yStyles,
    css`
      :host {
        display: inline-flex;
        align-items: center;
        gap: var(--space-3);

        /*
         * Die Zellfarbe wird EINMAL hier gemischt und nicht in der Regel der
         * Zelle: color-mix in einer Regel, die sechzehnmal trifft, rechnet der
         * Browser auch sechzehnmal.
         */
        --_zelle: color-mix(in srgb, var(--color-primary) 85%, transparent);
        --_kante: 44px;
        --_takt: 1600ms;
      }

      :host([size='sm']) {
        --_kante: 26px;
        --_takt: 1300ms;
      }

      :host([size='lg']) {
        --_kante: 72px;
      }

      /* Untereinander statt nebeneinander — fuer den grossen Wartezustand,
         der mittig in einer leeren Flaeche steht. */
      :host([stacked]) {
        flex-direction: column;
        gap: var(--space-4);
      }

      /*
       * Das Feld ist eine Platte wie jede andere in der Mappe: ein Strich
       * ringsum, das Raster darin. Es traegt seine Rasterlinien als
       * Hintergrund und nicht als Luecken zwischen den Zellen, damit das
       * Raster auch dort steht, wo gerade keine Zelle leuchtet.
       */
      .feld {
        flex: 0 0 auto;
        display: grid;
        grid-template-columns: repeat(var(--_kante-zellen), 1fr);
        inline-size: var(--_kante);
        block-size: var(--_kante);
        border: var(--border-width-thin) solid var(--color-border);
        background-image:
          linear-gradient(var(--color-grid) 1px, transparent 1px),
          linear-gradient(90deg, var(--color-grid) 1px, transparent 1px);
        background-size: calc(var(--_kante) / var(--_kante-zellen))
          calc(var(--_kante) / var(--_kante-zellen));
      }

      .zelle {
        background: var(--_zelle);
        opacity: 0;
        animation: zelle-aufnehmen var(--_takt) var(--ease-in-out) infinite;
        /*
         * Der Versatz ist NEGATIV: die Welle startet damit nicht bei null,
         * sondern mitten drin, und das Feld ist im ersten Bild schon in
         * Bewegung. Ein Wartezeichen, das erst nach einer Sekunde etwas tut,
         * sieht in genau der Sekunde aus wie ein Fehler.
         */
        animation-delay: calc(var(--i, 0) * var(--_takt) / -14);
      }

      @keyframes zelle-aufnehmen {
        0%,
        70%,
        100% {
          opacity: 0;
        }
        20%,
        40% {
          opacity: 1;
        }
      }

      .wort {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        text-transform: var(--label-transform);
        letter-spacing: var(--label-tracking);
        color: var(--color-text-muted);
        white-space: nowrap;
      }

      /*
       * Ohne Bewegung bleibt das Feld halb aufgenommen stehen: die Diagonalen
       * bis zur Mitte sind gesetzt, der Rest ist leer. Das ist kein Ersatz
       * fuer die Welle, sondern ihre ehrlichste Standbildfassung — man sieht,
       * dass eine Aufnahme laeuft, ohne dass sich etwas bewegt. Ein
       * vollstaendig leeres Feld saehe aus wie ein Fehler, ein volles wie
       * fertig.
       */
      @media (prefers-reduced-motion: reduce) {
        .zelle {
          animation: none;
          opacity: 0;
        }

        .zelle[data-halb='true'] {
          opacity: 1;
        }
      }
    `,
  ];

  /** Kleiner fuer eine Zeile, groesser fuer eine leere Flaeche. */
  @property({ type: String, reflect: true }) size: 'sm' | 'md' | 'lg' = 'md';

  /** Beschriftung unter oder neben dem Feld. Leer laesst sie weg — der
   *  Schirmleser bekommt dann trotzdem ein Wort, siehe unten. */
  @property({ type: String }) label = '';

  /** Feld und Wort untereinander statt nebeneinander. */
  @property({ type: Boolean, reflect: true }) stacked = false;

  protected render() {
    /*
     * Die Vorgabe steht hier und nicht im Feldinitialisierer: msg() dort
     * wuerde einmal beim Laden des Moduls ausgewertet, also in der Sprache,
     * die beim Modulladen galt — ein Sprachwechsel zur Laufzeit ginge daran
     * vorbei.
     */
    const wort = this.label || msg('Surveying');
    const halb = (KANTE - 1) as number;

    return html`
      <div
        class="feld"
        style="--_kante-zellen: ${KANTE}"
        aria-hidden="true"
      >
        ${ZELLEN.map(
          (diagonale) =>
            html`<span
              class="zelle"
              style="--i: ${diagonale}"
              data-halb=${diagonale <= halb ? 'true' : 'false'}
            ></span>`,
        )}
      </div>
      ${
        this.label
          ? html`<span class="wort">${this.label}</span>`
          : html`<span class="visually-hidden">${wort}</span>`
      }
      ${nothing}
    `;
  }

  /*
   * role und aria-live auf dem WIRT, nicht auf einem Kind: der Wirt ist das,
   * was der Aufrufer in seinen Baum haengt, und ein Live-Bereich, der erst
   * mit dem Bauteil in den Baum kommt, wird zuverlaessiger gemeldet als einer,
   * der innen entsteht.
   */
  connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute('role')) this.setAttribute('role', 'status');
    if (!this.hasAttribute('aria-live')) this.setAttribute('aria-live', 'polite');
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-survey-loader': VelgSurveyLoader;
  }
}

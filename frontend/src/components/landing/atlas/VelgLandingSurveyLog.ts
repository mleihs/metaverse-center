/**
 * BLATT 06 — Vermessungsprotokoll, unbearbeitet.
 *
 * Zwoelf Minuten an einem Dienstag, aus dem Bureau-Terminal der Brine
 * Chancellery. Das Blatt zeigt, was das Spiel auf Strassenhoehe wirklich ist:
 * fuenf Befehle und fuenf Antworten, ohne Erklaerung darunter.
 *
 * WARUM ES DER EINE DUNKLE BLOCK IST
 *   Auf Papier stehen alle anderen Blaetter in Tinte auf Grund. Dieses steht
 *   umgekehrt, weil es ein TERMINAL zeigt, und ein Terminal ist im ganzen
 *   Projekt diegetisch dunkel — das Design-Paket haelt das Terminal
 *   ausdruecklich aus dem Papier-Skin heraus. Es nimmt dafuer
 *   --color-surface-contrast / --color-text-on-contrast, das Paar, das genau
 *   fuer diesen Fall angelegt wurde.
 *
 *   NICHT --color-surface-inverse: das ist eine Plattform-KONSTANTE (weiss),
 *   deren Tinte in _colors.css ausdruecklich als nicht-themebar dokumentiert
 *   ist, und ihre drei Verwendungen benutzen sie als weissen Kamerablitz. Der
 *   dunkle Block hier haette jeden dieser Blitze in einen Schleier verwandelt.
 *
 *   Im Dark-Skin ist das Paar der normale erhoehte Grund — dort ist dieses
 *   Blatt einfach eine Karte, und das ist richtig: ein dunkler Block auf
 *   dunklem Grund waere kein Kontrast, sondern ein Loch.
 *
 * WARUM DIE BEFEHLE ECHT SIND
 *   look · examine · talk · eine freie Zeile im Gespraech · weather. Alle fuenf
 *   stehen in der COMMAND_REGISTRY des Terminals. Ein erfundener Befehl in
 *   einer Vorschau ist ein Versprechen, das die Anwendung nicht halten kann,
 *   und niemand merkt es, bis jemand ihn eintippt.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { atlasSheetHeadStyles } from '../../shared/atlas-sheet-styles.js';
import { stageStyles } from '../../shared/stage-styles.js';

@localized()
@customElement('velg-landing-survey-log')
export class VelgLandingSurveyLog extends LitElement {
  static styles = [
    stageStyles,
    atlasSheetHeadStyles,
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
        background: var(--color-surface-contrast);
        color: var(--color-text-on-contrast);
        border-bottom: var(--border-width-thin) solid var(--color-border);
      }

      .sheet {
        padding-block: var(--space-16);
        display: grid;
        grid-template-columns: 4fr 8fr;
        gap: var(--space-12);
        align-items: start;
      }

      /* Der Blattkopf erbt seine Farbe aus dem gemeinsamen Modul und stuende
         hier auf dunklem Grund zu dunkel. Beide Rollen werden deshalb aus der
         Tinte DIESES Blocks gemischt, nicht aus der der Seite. */
      .sheet-head {
        color: color-mix(in srgb, var(--color-text-on-contrast) 60%, transparent);
      }

      .sheet-head__rule {
        background: color-mix(in srgb, var(--color-text-on-contrast) 25%, transparent);
      }

      .lede h2 {
        margin: 0 0 var(--space-4);
        font-family: var(--heading-font);
        font-weight: var(--heading-weight);
        font-size: calc(var(--text-2xl) * var(--stage-type-scale));
        line-height: var(--leading-tight);
        letter-spacing: var(--heading-tracking);
        text-transform: var(--heading-transform);
        color: var(--color-text-on-contrast);
      }

      .lede p {
        margin: 0;
        max-width: 42ch;
        font-family: var(--font-body);
        font-size: var(--text-sm);
        line-height: var(--leading-relaxed);
        color: color-mix(in srgb, var(--color-text-on-contrast) 72%, transparent);
      }

      .log {
        display: grid;
        gap: var(--space-5);
      }

      /* Befehl links, Antwort rechts. 180px ist keine runde Zahl, sondern die
         Breite, bei der der laengste der fuenf Befehle noch in eine Zeile
         passt — bricht er, verliert die Spalte ihren Sinn als Registerkante. */
      .line {
        display: grid;
        grid-template-columns: 180px 1fr;
        gap: var(--space-5);
        align-items: baseline;
      }

      .line__cmd {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        letter-spacing: var(--label-tracking);
        color: var(--color-primary);
        overflow-wrap: anywhere;
      }

      .line__out {
        margin: 0;
        font-family: var(--font-prose);
        font-size: var(--text-base);
        line-height: var(--leading-relaxed);
        color: var(--color-text-on-contrast);
      }

      /* Der Eingabezeiger. Er blinkt, aber er behauptet nicht, dass man hier
         tippen koennte — deshalb aria-hidden und kein Eingabefeld. */
      .caret {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        font-family: var(--font-mono);
        font-size: var(--text-sm);
        color: var(--color-primary);
      }

      .caret__bar {
        width: 8px;
        height: 1em;
        background: var(--color-primary);
        animation: caret-blink 1100ms steps(1, end) infinite;
      }

      @keyframes caret-blink {
        50% {
          opacity: 0;
        }
      }

      @container (max-width: 1023px) {
        .sheet {
          grid-template-columns: 1fr;
          gap: var(--space-8);
        }

        /* Befehl UEBER die Antwort, nicht daneben: bei einer Spalte unter
           600px blieben von 180px Registerkante und dem Rest keine lesbaren
           Zeilen mehr uebrig. */
        .line {
          grid-template-columns: 1fr;
          gap: var(--space-2);
        }
      }

      @container (max-width: 640px) {
        .sheet {
          padding-block: var(--space-10);
        }

        /* Nie unter 15px Fliesstext, sagt die Responsive-Vorgabe. 18px hier,
           weil dieser Text die Ware ist und nicht die Beschriftung. */
        .line__out {
          font-size: var(--text-md);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .caret__bar {
          animation: none;
        }
      }
    `,
  ];

  protected render() {
    /*
     * Gedankenstriche: en dash (U+2013), nicht em dash. Das Inhalts-Tor
     * lint-llm-content.sh weist U+2014 in msg()-Zeichenketten zurueck, und die
     * Vorlage aus dem Design-Paket trug an zwei Stellen einen.
     */
    const lines: [string, string][] = [
      [
        '> look',
        msg(
          'Chancellery Steps, low water. The steps are dry for the first time in nine days and three clerks are counting them, nervously, as if the number might have changed. Present: Marn Tell, Carapace Assessor.',
        ),
      ],
      [
        '> examine Marn Tell',
        msg(
          'Carapace Assessor · Ledger District · Stress 61 · Mood: grieving. Third bench from the fountain. Has not filed his tide-return; the fountain has noticed.',
        ),
      ],
      [
        '> talk Marn Tell',
        msg(
          'He looks up. "You are not from the Chancellery. Good. They send people to ask about the return, never about the bench."',
        ),
      ],
      [
        msg('you: I brought bread.'),
        msg(
          'He eats without looking at you and says the moon is late. You check. He is right; the moon is eleven minutes late.',
        ),
      ],
      [
        '> weather',
        msg(
          'Fog with opinions, thinning. Tide expected 04:20 – eleven minutes behind the almanac. The Brine Ledger has already set the headline.',
        ),
      ],
    ];

    return html`
      <div class="sheet stage-container">
        <div class="lede">
          <div class="sheet-head">
            <span class="sheet-head__no">${msg('Sheet 06')}</span>
            <span>${msg('Survey log, unedited')}</span>
            <span class="sheet-head__rule"></span>
          </div>
          <h2>${msg('twelve minutes on a Tuesday')}</h2>
          <p>
            ${msg(
              'From the Bureau Terminal of the Brine Chancellery. Nothing here was written for this page; the world wrote it for the operator, who left it unfiled.',
            )}
          </p>
        </div>

        <div class="log">
          ${lines.map(
            ([cmd, out]) => html`
              <div class="line">
                <span class="line__cmd">${cmd}</span>
                <p class="line__out">${out}</p>
              </div>
            `,
          )}
          <div class="caret" aria-hidden="true">
            <span>&gt;</span>
            <span class="caret__bar"></span>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-landing-survey-log': VelgLandingSurveyLog;
  }
}

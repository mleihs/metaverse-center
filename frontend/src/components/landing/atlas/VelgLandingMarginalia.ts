/**
 * BLATT 08 — Marginalien. Ehrliche Bedingungen, Feldfragen, wer die Lichter anlaesst.
 *
 * Das Blatt, das ein Erstbesucher liest, bevor er sich anmeldet: was kostet
 * das, was passiert mit meinen Daten, muss ich jeden Tag da sein. Es steht
 * absichtlich weit unten und absichtlich nicht in Marketingsprache.
 *
 * WARUM EINE ECHTE dl UND KEINE ZWEISPALTIGE div-TABELLE
 *   Sechs Begriffe mit sechs Erklaerungen sind eine Beschreibungsliste, und ein
 *   Screenreader kuendigt sie als solche an ("Liste mit 6 Eintraegen"), springt
 *   von Begriff zu Begriff und liest die Erklaerung als dessen Wert. Mit divs
 *   waere es eine Folge von zwoelf zusammenhanglosen Textblöcken.
 *
 * DIE EINE ZAHL, DIE NICHT IM TEXT STEHEN DARF
 *   Die Vorlage aus dem Design-Paket schreibt: "Velgarien was world number one.
 *   Fifteen more have since filed for existence." Fuenfzehn ist heute richtig
 *   (worlds_live 16) und morgen falsch, und niemand wuerde es merken — eine
 *   Zahl in einer uebersetzten Zeichenkette wird nie wieder nachgezaehlt.
 *   Sie kommt deshalb aus `counts.worlds_live`, dem Schnappschuss, der ohnehin
 *   fuer dieses Blatt geladen wird. Fehlt der Schnappschuss, steht der Satz
 *   ohne Zahl da statt mit einer erfundenen.
 *
 * LAYOUT
 *   Zwei Blattseiten neben einander ab 1024 px (Bedingungen · Fragen), darunter
 *   gestapelt. Unter 640 px steht in der Liste der Begriff UEBER seiner
 *   Erklaerung, weil zwei Spalten dort beide unlesbar schmal wuerden.
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { LandingCounts } from '../../../types/index.js';
import { navigate } from '../../../utils/navigation.js';
import { atlasHoverStyles, atlasSheetHeadStyles } from '../../shared/atlas-sheet-styles.js';
import { stageStyles } from '../../shared/stage-styles.js';

@localized()
@customElement('velg-landing-marginalia')
export class VelgLandingMarginalia extends LitElement {
  static styles = [
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
        border-bottom: var(--border-width-thin) solid var(--color-border);
        background: var(--color-surface);
      }

      .sheet {
        padding-block: var(--space-16);
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--space-12);
        align-items: start;
      }

      h2 {
        margin: 0 0 var(--space-8);
        font-family: var(--heading-font);
        font-weight: var(--heading-weight);
        font-size: calc(var(--text-2xl) * var(--stage-type-scale));
        line-height: var(--leading-tight);
        letter-spacing: var(--heading-tracking);
        text-transform: var(--heading-transform);
        color: var(--color-text-primary);
      }

      .terms {
        margin: 0;
        display: grid;
      }

      .term {
        display: grid;
        grid-template-columns: 1fr 2fr;
        gap: var(--space-5);
        padding-block: var(--space-4);
        border-top: var(--border-width-thin) solid var(--color-border-light);
      }

      .term:last-child {
        border-bottom: var(--border-width-thin) solid var(--color-border-light);
      }

      .term dt {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        text-transform: var(--label-transform);
        letter-spacing: var(--label-tracking);
        line-height: var(--leading-snug);
        color: var(--color-text-primary);
      }

      .term dd {
        margin: 0;
        font-family: var(--font-body);
        font-size: var(--text-sm);
        line-height: var(--leading-relaxed);
        color: var(--color-text-secondary);
      }

      .rubric {
        margin: 0 0 var(--space-5);
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        text-transform: var(--label-transform);
        letter-spacing: var(--label-tracking);
        color: var(--color-text-muted);
      }

      .faq {
        display: grid;
        gap: var(--space-6);
      }

      .faq h3 {
        margin: 0 0 var(--space-2);
        font-family: var(--font-body);
        font-weight: var(--font-semibold);
        font-size: var(--text-base);
        line-height: var(--leading-snug);
        letter-spacing: var(--tracking-normal);
        text-transform: none;
        color: var(--color-text-primary);
      }

      /* Zeilenlaenge Prosa nie ueber 70ch, sagt die Responsive-Vorgabe. */
      .faq p {
        margin: 0;
        max-width: 70ch;
        font-family: var(--font-body);
        font-size: var(--text-sm);
        line-height: var(--leading-relaxed);
        color: var(--color-text-secondary);
      }

      .bureau {
        margin: var(--space-10) 0 var(--space-5);
        max-width: 70ch;
        font-family: var(--font-prose);
        font-size: var(--text-base);
        line-height: var(--leading-relaxed);
        color: var(--color-text-secondary);
      }

      .links {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-6);
      }

      .links a {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        text-transform: var(--label-transform);
        letter-spacing: var(--label-tracking);
        text-decoration: none;
        color: var(--color-text-muted);
        /* 44px Mindestziel fuer den Finger, ohne die Zeile aufzublaehen. */
        min-height: 44px;
        align-items: center;
      }

      @container (max-width: 1023px) {
        .sheet {
          grid-template-columns: 1fr;
          gap: var(--space-10);
        }
      }

      @container (max-width: 640px) {
        .sheet {
          padding-block: var(--space-10);
        }

        .term {
          grid-template-columns: 1fr;
          gap: var(--space-1);
        }
      }
    `,
  ];

  /** Fuer die eine Zahl im Buero-Absatz. Ohne Schnappschuss faellt sie weg. */
  @property({ attribute: false }) counts: LandingCounts | null = null;

  /**
   * Echte Anker, kein Klickhandler allein — dieselbe Regel wie in der
   * SEO-Fussleiste: ein Suchmaschinen-Kriecher folgt keinem Handler. Der
   * Handler faengt den Klick zusaetzlich ab, damit die Anwendung nicht neu
   * laedt. Beides zusammen, nicht eines davon.
   */
  private _internal(href: string, label: string) {
    return html`<a
      class="atlas-arrow"
      href=${href}
      @click=${(e: MouseEvent) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        navigate(href);
      }}
      >${label} <span aria-hidden="true">→</span></a
    >`;
  }

  private _renderBureau() {
    const live = this.counts?.worlds_live ?? null;

    return html`
      <p class="bureau">
        ${msg(
          'Metaverse.Center is built by a very small bureau in Austria, in public, with a changelog nobody asked for and everybody can read. Velgarien was world number one.',
        )}
        ${
          /*
           * Nur wenn es ueberhaupt weitere Welten gibt. Bei worlds_live 1
           * waere "0 more have since filed" schlechter als Schweigen, und bei
           * fehlendem Schnappschuss ist Schweigen die einzige ehrliche Antwort.
           */
          live && live > 1
            ? html`${msg(str`${live - 1} more have since filed for existence.`)}`
            : nothing
        }
      </p>
    `;
  }

  protected render() {
    const terms: [string, string][] = [
      [msg('Forging a world'), msg('Free. One sentence, one philosophy, about four minutes.')],
      [
        msg('Keeping it'),
        msg(
          'Free while it transmits. Worlds that no one visits go quiet; they are never deleted behind your back.',
        ),
      ],
      [
        msg('Playing as text'),
        msg('Free, always. The Terminal is the whole game at street level.'),
      ],
      [
        msg('Epochs and Drift'),
        msg('Free to enter. Cosmetic frames and card backs are the only thing ever sold.'),
      ],
      [
        msg('Your data'),
        msg('Exportable and deletable from the settings page. No trackers on this front page.'),
      ],
      [msg('The code'), msg('Public on GitHub. Read the dice before you roll them.')],
    ];

    const faq: [string, string][] = [
      [
        msg('Is this a game or a toy?'),
        msg(
          'Both, on purpose. The Forge and the Terminal are a worldbuilding toy. Epochs, Dungeons and Drift are games with rules, odds and losses that stick.',
        ),
      ],
      [
        msg('Do I have to be there?'),
        msg(
          'No. Worlds keep their own hours. You return to a chronicle of what happened, not to a penalty for leaving.',
        ),
      ],
      [
        msg('How much is written by a machine?'),
        msg(
          'Everything the world says about itself. Nothing about you is written down that you did not do.',
        ),
      ],
      [
        msg('Can I play with friends?'),
        msg(
          'Yes. Epochs put rival worlds on one map; Drift lets you dock at another operator’s broadcast edge with cargo they did not ask for.',
        ),
      ],
      [
        msg('Phone or desk?'),
        msg('Both. The Terminal is happiest on a keyboard; watching a world is happiest anywhere.'),
      ],
    ];

    return html`
      <div class="sheet stage-container">
        <div>
          <div class="sheet-head">
            <span class="sheet-head__no">${msg('Sheet 08')}</span>
            <span>${msg('Marginalia · Honest terms')}</span>
            <span class="sheet-head__rule"></span>
          </div>
          <h2>${msg('what it costs, and what it does not.')}</h2>

          <dl class="terms">
            ${terms.map(
              ([key, value]) => html`
                <div class="term">
                  <dt>${key}</dt>
                  <dd>${value}</dd>
                </div>
              `,
            )}
          </dl>
        </div>

        <div>
          <p class="rubric">${msg('Field questions')}</p>
          <div class="faq">
            ${faq.map(
              ([question, answer]) => html`
                <div>
                  <h3>${question}</h3>
                  <p>${answer}</p>
                </div>
              `,
            )}
          </div>

          ${this._renderBureau()}

          <div class="links">
            ${this._internal('/chronicles', msg('Chronicle archive'))}
            ${this._internal('/how-to-play', msg('Field manual'))}
            <a
              class="atlas-arrow"
              href="https://github.com/mleihs/velgarien-rebuild"
              target="_blank"
              rel="noopener noreferrer"
              >${msg('GitHub')} <span aria-hidden="true">→</span></a
            >
            <a
              class="atlas-arrow"
              href="https://www.instagram.com/bureau.of.impossible.geography/"
              target="_blank"
              rel="noopener noreferrer"
              >${msg('Instagram')} <span aria-hidden="true">→</span></a
            >
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-landing-marginalia': VelgLandingMarginalia;
  }
}

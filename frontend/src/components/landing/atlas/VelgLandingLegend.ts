/**
 * BLATT 02 — Legende. Was das hier ist.
 *
 * Das kuerzeste Blatt der Mappe und das einzige, das nichts zeigt und nichts
 * verlinkt: ein Absatz und drei Striche. Es sitzt zwischen dem Hero und den
 * sechs Systemen, weil ein Erstbesucher an dieser Stelle zwei Fragen hat, die
 * kein Bild beantwortet — was ist das, und was kostet es mich.
 *
 * WARUM DIE DREI STRICHE NICHT EINE LISTE MIT HAKEN SIND
 *   Sie sagen, was NICHT passiert: keine Tagesserien, keine Energiebalken,
 *   keine Beutekisten. Ein Haken davor haette daraus Merkmale gemacht, die man
 *   bekommt. Die drei Zeichen sind ein leerer Kreis, ein Rechteck und ein
 *   Dreieck — Kartensignaturen, keine Bewertung.
 *
 * LAYOUT
 *   3/6/3 ab 1024 px (Rubrik · Text · Striche), darunter gestapelt mit der
 *   Rubrik oben. Der Haltepunkt ist eine Container-Abfrage, nicht eine
 *   Medienabfrage: das Blatt soll auch dann stapeln, wenn es einmal in einer
 *   engen Spalte steht.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { atlasGridStyles, atlasSheetHeadStyles } from '../../shared/atlas-sheet-styles.js';
import { stageStyles } from '../../shared/stage-styles.js';

@localized()
@customElement('velg-landing-legend')
export class VelgLandingLegend extends LitElement {
  static styles = [
    stageStyles,
    atlasSheetHeadStyles,
    atlasGridStyles,
    css`
      /* position: relative, damit das Raster (inset: 0) sich an diesem Blatt
         ausrichtet. KEIN transform, kein filter, kein contain — die Hausregel
         verbietet einen neuen Enthaltungskontext auf einem Layout-Behaelter,
         und relative allein legt keinen an. */
      :host {
        display: block;
        position: relative;
        border-bottom: var(--border-width-thin) solid var(--color-border);
        background: var(--color-surface);
      }

      .sheet {
        container-type: inline-size;
        padding-block: var(--space-16);
        /* Ueber dem Raster, ohne z-index-Wettlauf: das Raster steht auf 0. */
        position: relative;
        z-index: 1;
      }

      .cols {
        display: grid;
        grid-template-columns: 3fr 6fr 3fr;
        gap: var(--space-10);
        align-items: start;
      }

      .rubric {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        text-transform: var(--label-transform);
        letter-spacing: var(--label-tracking);
        line-height: var(--leading-relaxed);
        color: var(--color-text-muted);
      }

      .rubric b {
        display: block;
        color: var(--color-primary);
        font-weight: var(--font-bold);
      }

      /* Der eine Absatz des Blattes. Gross gesetzt, aber nicht als Ueberschrift:
         er ist ein Satz, der gelesen werden will, keine Zeile, die man
         ueberfliegt. Deshalb Prosa-Schrift und eine Zeilenlaenge, die bei 46
         Zeichen abbricht statt bei der Spaltenbreite. */
      .claim {
        margin: 0;
        max-width: 46ch;
        font-family: var(--font-prose);
        font-size: calc(var(--text-xl) * var(--stage-type-scale));
        line-height: var(--leading-snug);
        color: var(--color-text-primary);
      }

      .claim em {
        font-style: italic;
        color: var(--color-primary);
      }

      .notes {
        margin: 0;
        padding: 0;
        list-style: none;
        display: grid;
        gap: var(--space-4);
      }

      .note {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: var(--space-3);
        align-items: start;
        font-family: var(--font-body);
        font-size: var(--text-sm);
        line-height: var(--leading-snug);
        color: var(--color-text-secondary);
      }

      /* Kartensignatur, keine Bewertung. Fest breit, damit die drei Zeilen
         buendig stehen, auch wenn die Zeichen verschieden breit sind. */
      .note__sym {
        width: 1.2em;
        text-align: center;
        font-family: var(--font-mono);
        color: var(--color-text-muted);
      }

      @container (max-width: 1023px) {
        .cols {
          grid-template-columns: 1fr;
          gap: var(--space-6);
        }

        .claim {
          max-width: 62ch;
        }

        .notes {
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        }
      }

      @container (max-width: 640px) {
        .sheet {
          padding-block: var(--space-10);
        }

        .notes {
          grid-template-columns: 1fr;
        }
      }
    `,
  ];

  protected render() {
    /*
     * Die drei Zeichen stehen bei ihrem Satz und nicht in einer eigenen Liste
     * daneben: ein Zeichen ohne seine Zeile ist bedeutungslos, und eine
     * Uebersetzung, die die Reihenfolge aendert, wuerde sie sonst vertauschen.
     */
    const notes: [string, string][] = [
      ['◌', msg('No daily streaks, no energy bars, no loot boxes.')],
      ['▭', msg('Plays in the browser. Plays as text if you prefer.')],
      ['△', msg('Free to forge. The world decides what happens after.')],
    ];

    return html`
      <div class="sheet-grid" aria-hidden="true"></div>
      <div class="sheet stage-container">
        <div class="sheet-head">
          <span class="sheet-head__no">${msg('Sheet 02')}</span>
          <span>${msg('Legend · What this is')}</span>
          <span class="sheet-head__rule"></span>
        </div>

        <div class="cols">
          <p class="rubric">
            <b>${msg('Legend')}</b>
            ${msg('What this is')}
          </p>

          <p class="claim">
            ${msg(
              'Not a game you win. A world you keep. You write one sentence; a civilization answers with rivers, a census and a founding grudge, and then',
            )}
            <em>${msg('goes on living')}</em>
            ${msg('whether you return or not.')}
          </p>

          <ul class="notes">
            ${notes.map(
              ([sym, text]) => html`
                <li class="note">
                  <span class="note__sym" aria-hidden="true">${sym}</span>
                  <span>${text}</span>
                </li>
              `,
            )}
          </ul>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-landing-legend': VelgLandingLegend;
  }
}

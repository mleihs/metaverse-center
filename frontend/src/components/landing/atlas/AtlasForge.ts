/**
 * BLATT 07 — Ein neues Gebiet anmelden.
 *
 * Das letzte Blatt vor den Marginalien und das einzige, das etwas verlangt:
 * einen Satz. Links steht die Aufforderung, rechts tippt sich ein Beispiel
 * ein, darunter die sechs Philosophien und der Knopf.
 *
 * DAS TIPPWERK IST GETEILT, NICHT NACHGEBAUT
 *   `ForgeTypewriter` aus `landing-forge-engine.ts` — dasselbe Zaehlwerk, das
 *   die redaktionelle Fassung fuehrt, und dieselben zwanzig Beispielsaetze.
 *   Nachgebaut waeren es zwei Uhren mit denselben drei Konstanten, die
 *   irgendwann verschieden schnell laufen.
 *
 *   Das Ereignis `prompt-world` geht dabei vom WIRT aus, also von diesem
 *   Blatt: es sagt Blatt 05, welche Welt gerade getippt wird, damit die
 *   Gewaehrsleute dieser Welt dort markiert werden. Die Frontseite ist der
 *   Ort, an dem die beiden Blaetter voneinander wissen, nicht die Blaetter.
 *
 * DAS FELD IST KEINE EINGABE, UND ES BEHAUPTET AUCH NICHT, EINE ZU SEIN
 *   Kein `<input>`, kein `contenteditable`, kein Fokusring. Ein Eingabefeld,
 *   in das man tippen kann und dessen Inhalt sich unter der Hand aendert,
 *   waere feindselig. Es ist eine Vorschau; wer schreiben will, klickt den
 *   Knopf und bekommt die richtige Maske.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { LandingPrompt } from '../../../types/index.js';
import { navigate } from '../../../utils/navigation.js';
import {
  atlasGridStyles,
  atlasHoverStyles,
  atlasSheetHeadStyles,
} from '../../shared/atlas-sheet-styles.js';
import { stageStyles } from '../../shared/stage-styles.js';
import { ForgeTypewriter, forgeAnchors, forgeEntries } from '../landing-forge-engine.js';

@localized()
@customElement('velg-atlas-forge')
export class VelgAtlasForge extends LitElement {
  static styles = [
    stageStyles,
    atlasSheetHeadStyles,
    atlasHoverStyles,
    atlasGridStyles,
    css`
      :host {
        display: block;
        position: relative;
        background: var(--color-surface);
        border-bottom: var(--border-width-thin) solid var(--color-border);
      }

      .sheet {
        position: relative;
        z-index: 1;
        container-type: inline-size;
        padding-block: var(--space-16);
        display: grid;
        grid-template-columns: 4fr 8fr;
        gap: var(--space-12);
        align-items: start;
      }

      h2 {
        margin: 0;
        font-family: var(--heading-font);
        font-weight: var(--heading-weight);
        font-size: calc(var(--text-3xl) * var(--stage-type-scale));
        line-height: 0.95;
        letter-spacing: var(--heading-tracking);
        text-transform: var(--heading-transform);
        color: var(--color-text-primary);
      }

      h2 span {
        display: block;
      }

      h2 em {
        font-style: normal;
        color: var(--color-primary);
      }

      /* Das Feld. Ein fester Kasten, damit die Zeile beim Tippen nicht die
         halbe Seite auf- und zuschiebt — sie waechst um bis zu vier Zeilen. */
      .prompt {
        display: flex;
        gap: var(--space-3);
        min-height: 150px;
        padding: var(--space-6);
        background: var(--color-surface-raised);
        border: var(--border-width-thin) solid var(--color-border);
        box-shadow: var(--shadow-md);
      }

      .prompt__caret {
        flex: none;
        font-family: var(--font-mono);
        font-size: var(--text-md);
        color: var(--color-primary);
      }

      .prompt__text {
        margin: 0;
        font-family: var(--font-prose);
        font-style: italic;
        font-size: calc(var(--text-md) * var(--stage-type-scale));
        line-height: var(--leading-relaxed);
        color: var(--color-text-primary);
      }

      .prompt__bar {
        display: inline-block;
        width: 9px;
        height: 1em;
        margin-left: 2px;
        vertical-align: text-bottom;
        background: var(--color-primary);
        animation: forge-blink 1100ms steps(1, end) infinite;
      }

      @keyframes forge-blink {
        50% {
          opacity: 0;
        }
      }

      .anchors {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2);
        margin-top: var(--space-5);
      }

      .anchors__label {
        margin-right: var(--space-2);
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        text-transform: var(--label-transform);
        letter-spacing: var(--label-tracking);
        color: var(--color-primary);
      }

      .chip {
        padding: var(--space-2) var(--space-3);
        border: var(--border-width-thin) solid var(--color-border-light);
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        text-transform: var(--label-transform);
        letter-spacing: var(--label-tracking);
        color: var(--color-text-muted);
        transition: border-color var(--transition-fast), color var(--transition-fast);
      }

      .chip--on {
        border-color: var(--color-primary);
        color: var(--color-primary);
      }

      .note {
        margin: var(--space-3) 0 0;
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        text-transform: var(--label-transform);
        letter-spacing: var(--label-tracking);
        color: var(--color-text-muted);
      }

      .foot {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-5);
        margin-top: var(--space-8);
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

      .cta:focus-visible {
        outline: none;
        box-shadow: var(--ring-focus);
      }

      @container (max-width: 1023px) {
        .sheet {
          grid-template-columns: 1fr;
          gap: var(--space-8);
        }
      }

      @container (max-width: 639px) {
        .sheet {
          padding-block: var(--space-10);
        }

        .cta {
          width: 100%;
          justify-content: center;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .prompt__bar {
          animation: none;
        }

        .chip {
          transition: none;
        }
      }
    `,
  ];

  /** Echte Ausgangssaetze aus dem Bestand; leer heisst: die Beispiele laufen. */
  @property({ attribute: false }) prompts: LandingPrompt[] = [];

  private readonly _type = new ForgeTypewriter(this, () => forgeEntries(this.prompts));

  protected render() {
    const anchors = forgeAnchors();

    return html`
      <div class="sheet-grid" aria-hidden="true"></div>
      <div class="sheet stage-container">
        <div>
          <div class="sheet-head">
            <span class="sheet-head__no">${msg('Sheet 07')}</span>
            <span>${msg('Forge a new territory')}</span>
            <span class="sheet-head__rule"></span>
          </div>
          <h2>
            <span>${msg('forge')}</span>
            <span>${msg('yours')}<em>.</em></span>
          </h2>
        </div>

        <div>
          <div class="prompt">
            <span class="prompt__caret" aria-hidden="true">&gt;</span>
            <p class="prompt__text">
              ${this._type.typed}<span class="prompt__bar" aria-hidden="true"></span>
            </p>
          </div>

          <div class="anchors">
            <span class="anchors__label">${msg('Anchor it in a philosophy')}</span>
            ${anchors.map(
              (anchor, index) => html`
                <span class="chip ${index === this._type.anchor ? 'chip--on' : ''}">
                  ${anchor}
                </span>
              `,
            )}
          </div>
          <p class="note">${msg('Required · shapes every citizen’s soul')}</p>

          <div class="foot">
            <button class="cta atlas-lift-sm" @click=${() => navigate('/forge')}>
              ${msg('Forge this world')} <span aria-hidden="true">→</span>
            </button>
            <span class="note">${msg('Free · after that, the world decides')}</span>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-atlas-forge': VelgAtlasForge;
  }
}

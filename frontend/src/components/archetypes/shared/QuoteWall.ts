/**
 * Full-screen quote display — "The Voice" room.
 *
 * Shows a literary quotation with optional original-language text.
 * Designed for dark backgrounds with accent glow.
 */

import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { detailTokenStyles } from './archetype-detail-styles.js';

@customElement('velg-quote-wall')
export class VelgQuoteWall extends LitElement {
  static styles = [
    detailTokenStyles,
    css`
      :host {
      /* Der Akzent als TEXT.
         Acht feste Archetypfarben, und diese Ansicht haengt an der
         Plattform-Route /archetypes/ — nicht unter /simulations/, erbt also
         nie ein Weltthema. Damit ist es ein Problem mit ZWEI festen Gruenden,
         nicht mit zehn: der Seite und dem aufgehellten Panel darueber.

         Sechs der acht bestehen auf beiden. Zwei nicht, und gegen den Panel-
         Grund brauchen sie 18 % statt der 12 %, die die Seite allein verlangt
         haette — der erste Versuch rechnete gegen EINEN Grund und liess zwei
         Stellen bei 4,04 stehen. Genau der Fehler, gegen den die Funktion
         liftForContrast eine Liste nimmt.

         Bei 18 % bleibt der Farbton erkennbar; das ist der Unterschied zu
         einer echten Hebung, die die Identitaet kosten wuerde. */
      --_accent-text: color-mix(in srgb, var(--_accent) 82%, var(--color-text-primary));
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: var(--space-8, 32px) var(--space-6, 24px);
        min-height: 50vh;
      }

      .quote-mark {
        font-family: var(--_font-prose);
        font-size: clamp(4rem, 8vw, 7rem);
        line-height: 1;
        color: var(--_accent);
        opacity: 0.08;
        user-select: none;
        margin-bottom: -1.5rem;
      }

      blockquote {
        margin: 0;
        font-family: var(--_font-prose);
        font-size: var(--_wall-quote-size);
        font-style: italic;
        font-weight: 400;
        line-height: 1.55;
        max-width: 70ch;
        color: var(--color-text-primary, #e5e5e5);
        text-shadow:
          0 0 60px var(--_accent-glow),
          0 2px 4px rgba(0, 0, 0, 0.9);
      }

      .original {
        margin-top: var(--space-4, 16px);
        font-family: var(--_font-prose);
        font-size: calc(var(--_wall-quote-size) * 0.7);
        font-style: italic;
        color: var(--color-text-secondary, #a0a0a0);
        opacity: 0.55;
        max-width: 65ch;
        line-height: 1.5;
      }

      .original-lang {
        font-family: var(--_font-display);
        font-size: var(--_label-size);
        font-style: normal;
        text-transform: uppercase;
        letter-spacing: var(--_label-tracking);
        color: var(--_accent-text);
        opacity: 0.5;
        margin-top: 4px;
      }

      cite {
        display: block;
        margin-top: var(--space-6, 24px);
        font-family: var(--_font-prose);
        font-size: var(--_label-size);
        font-style: normal;
        font-weight: 500;
        letter-spacing: var(--_label-tracking);
        font-variant: small-caps;
        color: var(--_accent-text);
      }
    `,
  ];

  @property() text = '';
  @property() author = '';
  @property() original = '';
  @property() originalLang = '';

  protected render() {
    return html`
      <div class="quote-mark" aria-hidden="true">\u201c</div>
      <blockquote>${this.text}</blockquote>
      ${
        this.original
          ? html`
            <p class="original">${this.original}</p>
            ${this.originalLang ? html`<p class="original-lang">${this.originalLang}</p>` : nothing}
          `
          : nothing
      }
      <cite>\u2013 ${this.author}</cite>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-quote-wall': VelgQuoteWall;
  }
}

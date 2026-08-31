/**
 * Literary influence card — for the "Literary Wall" room.
 *
 * Primary authors get larger cards with quotes; secondary are compact.
 */

import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { detailCardStyles, detailTokenStyles } from './archetype-detail-styles.js';

@customElement('velg-author-card')
export class VelgAuthorCard extends LitElement {
  static styles = [
    detailTokenStyles,
    detailCardStyles,
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
        display: block;
      }

      .card {
        padding: var(--space-4, 16px) var(--space-5, 20px);
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 6px;
        transition: transform 0.3s var(--_ease-dramatic),
          border-color 0.3s var(--_ease-dramatic);
      }

      .card:hover {
        transform: translateY(-2px);
        border-color: var(--_accent-border);
      }

      /* Betonung, nicht Kategorie: die primaere Autorenkarte hebt sich jetzt
         ueber Rahmenfarbe und den brutalistischen Versatzschatten ab — das
         Mittel, das dieses Designsystem dafuer ohnehin fuehrt. */
      :host([primary]) .card {
        border-color: color-mix(in oklch, var(--_accent) 55%, transparent);
        box-shadow: var(--shadow-sm);
      }

      .name {
        font-family: var(--_font-prose);
        font-size: 0.85rem;
        font-weight: 600;
        letter-spacing: 0.02em;
        color: var(--color-text-primary, #e5e5e5);
        margin-bottom: 2px;
      }

      .works {
        font-family: var(--_font-prose);
        font-size: 0.8rem;
        font-style: italic;
        color: var(--_accent-text);
        opacity: 0.8;
        margin-bottom: 8px;
      }

      .divider {
        height: 1px;
        background: rgba(255, 255, 255, 0.06);
        margin-bottom: 8px;
      }

      .concept {
        font-family: var(--_font-prose);
        font-size: 0.88rem;
        line-height: 1.55;
        color: var(--color-text-secondary, #a0a0a0);
      }

      .quote {
        margin-top: 10px;
        font-family: var(--_font-prose);
        font-size: 0.82rem;
        font-style: italic;
        line-height: 1.5;
        color: var(--color-text-primary, #e5e5e5);
        opacity: 0.8;
        padding-left: 12px;
        border-left: 1px solid var(--_accent-border);
      }

      .language {
        margin-top: 8px;
        font-family: var(--_font-prose);
        font-size: 0.65rem;
        font-style: italic;
        color: var(--color-text-muted, #888);
      }
    `,
  ];

  @property() name = '';
  @property() works = '';
  @property() concept = '';
  @property() language = '';
  @property() quote = '';
  @property({ type: Boolean, reflect: true }) primary = false;

  protected render() {
    return html`
      <div class="card">
        <div class="name">${this.name}</div>
        <div class="works">${this.works}</div>
        <div class="divider"></div>
        <div class="concept">${this.concept}</div>
        ${this.quote ? html`<p class="quote">${this.quote}</p>` : nothing}
        <div class="language">${this.language}</div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-author-card': VelgAuthorCard;
  }
}

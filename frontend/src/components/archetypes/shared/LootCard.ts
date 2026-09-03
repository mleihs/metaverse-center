/**
 * Loot item card — glass vitrine style with tier indicator.
 */

import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { detailCardStyles, detailTokenStyles } from './archetype-detail-styles.js';

const TIER_LABELS: Record<number, string> = {
  1: 'Minor',
  2: 'Major',
  3: 'Legendary',
};

@customElement('velg-loot-card')
export class VelgLootCard extends LitElement {
  static styles = [
    detailTokenStyles,
    detailCardStyles,
    css`
      :host { display: block; }

      .card {
        padding: var(--space-4, 16px);
        background: var(--color-overlay-ink);
        border: 1px solid var(--color-overlay-ink-strong);
        border-radius: 6px;
        transition: transform 0.3s var(--_ease-dramatic), border-color 0.3s var(--_ease-dramatic);
      }

      .card:hover {
        transform: translateY(-1px);
        border-color: var(--_accent-border);
      }

      :host([tier="3"]) .card {
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
        border-color: var(--_accent);
        box-shadow: 0 0 calc(16px * var(--glow-strength)) var(--_accent-glow);
      }

      .header {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 6px;
      }

      .name {
        font-family: var(--_font-prose);
        font-size: 0.92rem;
        font-weight: 600;
        letter-spacing: 0.02em;
        color: var(--color-text-primary, #e5e5e5);
      }

      .tier-label {
        font-family: var(--_font-prose);
        font-size: 0.6rem;
        font-style: italic;
        padding: 1px 6px;
        border-radius: 3px;
        background: var(--color-overlay-ink-strong);
        color: var(--color-text-muted, #888);
      }

      :host([tier="2"]) .tier-label {
        color: var(--_accent-text);
        background: color-mix(in oklch, var(--_accent) 10%, transparent);
      }

      :host([tier="3"]) .tier-label {
        color: var(--_accent-text);
        background: color-mix(in oklch, var(--_accent) 15%, transparent);
        border: 1px solid var(--_accent-border);
      }

      .effect {
        font-family: var(--_font-prose);
        font-size: 0.72rem;
        font-style: italic;
        color: var(--_accent-text);
        letter-spacing: 0.04em;
        margin-bottom: 8px;
      }

      .description {
        font-family: var(--_font-prose);
        font-size: 0.88rem;
        font-style: italic;
        line-height: 1.5;
        color: var(--color-text-secondary, #a0a0a0);
      }
    `,
  ];

  @property() name = '';
  @property({ type: Number, reflect: true }) tier: 1 | 2 | 3 = 1;
  @property() effect = '';
  @property() description = '';

  protected render() {
    return html`
      <div class="card">
        <div class="header">
          <span class="name">${this.name}</span>
          <span class="tier-label">Tier ${this.tier} \u00b7 ${TIER_LABELS[this.tier]}</span>
        </div>
        <div class="effect">${this.effect}</div>
        <p class="description">${this.description}</p>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-loot-card': VelgLootCard;
  }
}

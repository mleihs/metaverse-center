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
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 6px;
        transition: transform 0.3s var(--_ease-dramatic), border-color 0.3s var(--_ease-dramatic);
      }

      .card:hover {
        transform: translateY(-1px);
        border-color: var(--_accent-border);
      }

      :host([tier="3"]) .card {
        border-color: var(--_accent);
        box-shadow: 0 0 16px var(--_accent-glow);
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
        background: rgba(255, 255, 255, 0.06);
        color: var(--color-text-muted, #888);
      }

      :host([tier="2"]) .tier-label {
        color: var(--_accent);
        background: color-mix(in oklch, var(--_accent) 10%, transparent);
      }

      :host([tier="3"]) .tier-label {
        color: var(--_accent);
        background: color-mix(in oklch, var(--_accent) 15%, transparent);
        border: 1px solid var(--_accent-border);
      }

      .effect {
        font-family: var(--_font-prose);
        font-size: 0.72rem;
        font-style: italic;
        color: var(--_accent);
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

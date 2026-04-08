/**
 * Enemy display card — "framed portrait" style for the Bestiary room.
 */

import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { detailCardStyles, detailTokenStyles } from './archetype-detail-styles.js';

@customElement('velg-enemy-card')
export class VelgEnemyCard extends LitElement {
  static styles = [
    detailTokenStyles,
    detailCardStyles,
    css`
      :host {
        display: block;
      }

      .frame {
        padding: var(--space-5, 20px);
        background: color-mix(in oklch, var(--color-surface-raised, #111) 92%, var(--_accent) 8%);
        border: 1px solid var(--_accent-border);
        border-radius: 6px;
        transition: transform 0.3s var(--_ease-dramatic), box-shadow 0.3s var(--_ease-dramatic);
      }

      .frame:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      }

      :host([tier="boss"]) .frame {
        border-width: 2px;
        border-color: var(--_accent);
        box-shadow: 0 0 24px var(--_accent-glow);
      }

      :host([tier="elite"]) .frame {
        border-color: var(--_accent);
        border-style: double;
        border-width: 3px;
      }

      .header {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 4px;
      }

      .name {
        font-family: var(--_font-prose);
        font-size: 0.9rem;
        font-weight: 600;
        letter-spacing: 0.02em;
        color: var(--color-text-primary, #e5e5e5);
      }

      .name-de {
        font-family: var(--_font-prose);
        font-size: 0.8rem;
        font-style: italic;
        color: var(--color-text-muted, #888);
        margin-bottom: 8px;
      }

      .divider {
        height: 1px;
        background: var(--_accent-border);
        margin: 8px 0 10px;
      }

      .stats {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 10px;
      }

      .ability {
        font-family: var(--_font-prose);
        font-size: 0.7rem;
        font-weight: 600;
        font-style: italic;
        letter-spacing: 0.02em;
        color: var(--_accent);
        margin-bottom: 10px;
      }

      .description {
        font-family: var(--_font-prose);
        font-size: 0.92rem;
        line-height: 1.6;
        color: var(--color-text-secondary, #a0a0a0);
        font-style: italic;
      }

      :host([tier="boss"]) .description {
        color: var(--color-text-primary, #e5e5e5);
      }
    `,
  ];

  @property() name = '';
  /** Alternate-language name shown as subtitle (DE name in EN mode, EN name in DE mode). */
  @property() nameAlt = '';
  @property({ reflect: true }) tier: 'minion' | 'standard' | 'elite' | 'boss' = 'standard';
  @property({ type: Number }) power = 0;
  @property({ type: Number }) stress = 0;
  @property({ type: Number }) evasion = 0;
  @property() ability = '';
  @property() aptitude = '';
  @property() description = '';

  protected render() {
    return html`
      <div class="frame">
        <div class="header">
          <span class="name">${this.name}</span>
          <span class="tier-badge tier-badge--${this.tier}">${this.tier}</span>
        </div>
        <div class="name-de">${this.nameAlt}</div>
        <div class="divider"></div>
        <div class="stats">
          <span class="stat-chip">PWR ${this.power}</span>
          <span class="stat-chip">STR ${this.stress}</span>
          <span class="stat-chip">EVA ${this.evasion}%</span>
          <span class="stat-chip stat-chip--accent">${this.aptitude}</span>
        </div>
        <div class="ability">Ability: ${this.ability}</div>
        <p class="description">${this.description}</p>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-enemy-card': VelgEnemyCard;
  }
}

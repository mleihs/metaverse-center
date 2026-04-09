/**
 * Encounter preview card — shows narrative encounter with choices.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { LocalizedEncounterChoice as EncounterChoice } from '../dungeon-detail-localized.js';
import { detailCardStyles, detailTokenStyles } from './archetype-detail-styles.js';

@localized()
@customElement('velg-encounter-card')
export class VelgEncounterCard extends LitElement {
  static styles = [
    detailTokenStyles,
    detailCardStyles,
    css`
      :host { display: block; }

      .card {
        padding: var(--space-5, 20px);
        background: color-mix(in oklch, var(--color-surface-raised, #111) 94%, var(--_accent) 6%);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-left: 2px solid var(--_accent);
        border-radius: 4px;
        transition: transform 0.3s var(--_ease-dramatic);
      }

      @media (prefers-reduced-motion: no-preference) {
        .card:hover {
          transform: translateY(-1px);
        }
      }

      .meta {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
      }

      .name {
        font-family: var(--_font-prose);
        font-size: 1rem;
        font-weight: 600;
        letter-spacing: 0.02em;
        color: var(--color-text-primary, #e5e5e5);
      }

      .depth {
        font-family: var(--_font-prose);
        font-size: 0.65rem;
        color: var(--color-text-muted, #888);
        letter-spacing: 0.04em;
      }

      .description {
        font-family: var(--_font-prose);
        font-size: 0.95rem;
        font-style: italic;
        line-height: 1.6;
        color: var(--color-text-secondary, #a0a0a0);
        margin-bottom: 14px;
        max-width: 60ch;
      }

      .choices-header {
        font-family: var(--_font-prose);
        font-size: 0.65rem;
        font-weight: 600;
        font-style: italic;
        letter-spacing: 0.02em;
        color: var(--color-text-muted, #888);
        margin-bottom: 8px;
      }

      .choice {
        display: flex;
        align-items: baseline;
        gap: 8px;
        padding: 6px 0;
        border-top: 1px solid rgba(255, 255, 255, 0.04);
      }

      .choice:first-child { border-top: none; }

      .choice__arrow {
        color: var(--_accent);
        font-size: 0.8rem;
        flex-shrink: 0;
      }

      .choice__text {
        font-family: var(--_font-prose);
        font-size: 0.9rem;
        color: var(--color-text-primary, #e5e5e5);
        flex: 1;
      }

      .choice__meta {
        display: flex;
        gap: 6px;
        flex-shrink: 0;
      }
    `,
  ];

  @property() name = '';
  @property() depth = '';
  @property() type: 'narrative' | 'combat' | 'elite' = 'narrative';
  @property() description = '';
  @property({ type: Array }) choices: EncounterChoice[] = [];

  protected render() {
    return html`
      <div class="card">
        <div class="meta">
          <span class="tier-badge tier-badge--${this.type === 'elite' ? 'elite' : 'standard'}">${this.type}</span>
          <span class="depth">${msg('Depth')} ${this.depth}</span>
        </div>
        <div class="name">${this.name}</div>
        <p class="description">${this.description}</p>
        ${
          this.choices.length
            ? html`
              <div class="choices-header">${msg('Choices')}</div>
              ${this.choices.map(
                (c) => html`
                  <div class="choice">
                    <span class="choice__arrow">\u25b8</span>
                    <span class="choice__text">${c.text}</span>
                    <div class="choice__meta">
                      ${c.aptitude ? html`<span class="stat-chip stat-chip--accent">${c.aptitude}</span>` : nothing}
                      ${c.difficulty ? html`<span class="stat-chip">${c.difficulty}</span>` : nothing}
                    </div>
                  </div>
                `,
              )}
            `
            : nothing
        }
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-encounter-card': VelgEncounterCard;
  }
}

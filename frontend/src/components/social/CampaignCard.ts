import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { Campaign } from '../../types/index.js';
import '../shared/VelgBadge.js';
import { cardStyles } from '../shared/card-styles.js';

@localized()
@customElement('velg-campaign-card')
export class VelgCampaignCard extends LitElement {
  static styles = [
    cardStyles,
    css`
    :host { display: block; }
    .card {
      background: var(--color-surface-raised); border: var(--border-default);
      box-shadow: var(--shadow-md); display: flex; flex-direction: column;
    }
    .card__header {
      padding: var(--space-3) var(--space-4); background: var(--color-surface-header);
      border-bottom: var(--border-medium);
    }
    .card__title { font-family: var(--font-brutalist); font-weight: var(--font-black); font-size: var(--text-md); text-transform: uppercase; letter-spacing: var(--tracking-brutalist); margin: 0; }
    .card__body { padding: var(--space-3) var(--space-4); display: flex; flex-direction: column; gap: var(--space-2); flex: 1; }
    .card__description { font-size: var(--text-sm); color: var(--color-text-secondary); line-height: var(--leading-relaxed); max-height: 60px; overflow: hidden; }
    .card__badges { display: flex; flex-wrap: wrap; gap: var(--space-1-5); }
  `,
  ];

  @property({ type: Object }) campaign!: Campaign;
  @property({ type: String }) simulationId = '';

  private _handleClick(): void {
    this.dispatchEvent(
      new CustomEvent('campaign-click', { detail: this.campaign, bubbles: true, composed: true }),
    );
  }

  protected render() {
    const c = this.campaign;
    if (!c) return html``;

    return html`
      <div class="card" role="button" tabindex="0" @click=${this._handleClick} @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this._handleClick(); } }}>
        <div class="card__header">
          <h3 class="card__title">${c.title}</h3>
        </div>
        <div class="card__body">
          ${c.description ? html`<div class="card__description">${c.description}</div>` : ''}
          <div class="card__badges">
            ${c.campaign_type ? html`<velg-badge variant="primary">${c.campaign_type}</velg-badge>` : ''}
            ${c.urgency_level ? html`<velg-badge variant="warning">${c.urgency_level}</velg-badge>` : ''}
            ${c.is_integrated_as_event ? html`<velg-badge variant="success">${msg('Event')}</velg-badge>` : ''}
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-campaign-card': VelgCampaignCard;
  }
}

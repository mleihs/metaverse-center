import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import type { Building } from '../../types/index.js';
import { icons } from '../../utils/icons.js';
import { buildingAltText } from '../../utils/text.js';
import '../shared/VelgBadge.js';
import '../shared/VelgIconButton.js';
import { cardStyles } from '../shared/card-styles.js';

@localized()
@customElement('velg-building-card')
export class VelgBuildingCard extends LitElement {
  static styles = [
    cardStyles,
    css`
    :host {
      display: block;
    }

    .card {
      display: flex;
      flex-direction: column;
      background: var(--color-surface-raised);
      border: var(--border-default);
      box-shadow: var(--shadow-md);
      overflow: hidden;
    }

    .card__image {
      position: relative;
      width: 100%;
      height: 180px;
      overflow: hidden;
      background: var(--color-surface-sunken);
      border-bottom: var(--border-default);
    }

    .card__image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .card__placeholder {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      color: var(--color-text-muted);
    }

    .card__body {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      padding: var(--space-4);
    }

    .card__name {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-base);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-primary);
      margin: 0;
      line-height: var(--leading-tight);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .card__badges {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      flex-wrap: wrap;
    }

    .card__meta {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      font-family: var(--font-sans);
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
    }

    .card__meta-item {
      display: flex;
      align-items: center;
      gap: var(--space-1);
    }

    .card__actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-4) var(--space-3);
      margin-top: auto;
    }

  `,
  ];

  @property({ attribute: false }) building!: Building;
  @property({ type: Boolean }) compromised = false;

  private _getConditionVariant(condition: string | undefined): string {
    if (!condition) return 'default';
    const normalized = condition.toLowerCase();
    if (normalized === 'good') return 'success';
    if (normalized === 'fair') return 'warning';
    if (normalized === 'poor' || normalized === 'ruined') return 'danger';
    return 'default';
  }

  private _handleClick(): void {
    this.dispatchEvent(
      new CustomEvent('building-click', {
        detail: this.building,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleEdit(e: Event): void {
    e.stopPropagation();
    this.dispatchEvent(
      new CustomEvent('building-edit', {
        detail: this.building,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleDelete(e: Event): void {
    e.stopPropagation();
    this.dispatchEvent(
      new CustomEvent('building-delete', {
        detail: this.building,
        bubbles: true,
        composed: true,
      }),
    );
  }

  protected render() {
    const b = this.building;
    if (!b) return nothing;

    const locationParts: string[] = [];
    if (b.zone?.name) locationParts.push(b.zone.name);
    if (b.city?.name) locationParts.push(b.city.name);
    const locationText = locationParts.join(', ');

    return html`
      <div class="card ${b.special_type === 'embassy' ? 'card--embassy' : ''}" @click=${this._handleClick}>
        <div class="card__image">
          ${
            b.image_url
              ? html`<img
                  src=${b.image_url}
                  alt=${buildingAltText(b)}
                  loading="lazy"
                />`
              : html`<div class="card__placeholder">${icons.building()}</div>`
          }
        </div>

        <div class="card__body">
          <h3 class="card__name">${b.name}</h3>

          <div class="card__badges">
            ${b.building_type ? html`<velg-badge>${b.building_type}</velg-badge>` : nothing}
            ${
              b.building_condition
                ? html`<velg-badge variant=${this._getConditionVariant(b.building_condition)}>
                    ${b.building_condition}
                  </velg-badge>`
                : nothing
            }
            ${b.special_type === 'embassy' ? html`<velg-badge variant="info">${msg('Embassy')}</velg-badge>` : nothing}
            ${this.compromised ? html`<velg-badge variant="danger" title=${msg('Embassy effectiveness reduced by infiltration')}>${msg('Compromised')}</velg-badge>` : nothing}
          </div>

          <div class="card__meta">
            ${
              b.population_capacity != null
                ? html`<span class="card__meta-item">${msg(str`Cap: ${b.population_capacity}`)}</span>`
                : nothing
            }
            ${locationText ? html`<span class="card__meta-item">${locationText}</span>` : nothing}
          </div>
        </div>

        ${
          appState.canEdit.value
            ? html`
              <div class="card__actions">
                <velg-icon-button .label=${msg('Edit building')} @icon-click=${this._handleEdit}>
                  ${icons.edit()}
                </velg-icon-button>
                <velg-icon-button variant="danger" .label=${msg('Delete building')} @icon-click=${this._handleDelete}>
                  ${icons.trash()}
                </velg-icon-button>
              </div>
            `
            : nothing
        }
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-building-card': VelgBuildingCard;
  }
}

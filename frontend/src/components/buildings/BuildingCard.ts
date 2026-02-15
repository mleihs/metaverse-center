import { css, html, LitElement, nothing, svg } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import type { Building } from '../../types/index.js';

@customElement('velg-building-card')
export class VelgBuildingCard extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .card {
      display: flex;
      flex-direction: column;
      background: var(--color-surface-raised);
      border: var(--border-default);
      box-shadow: var(--shadow-md);
      cursor: pointer;
      transition: all var(--transition-fast);
      overflow: hidden;
    }

    .card:hover {
      transform: translate(-2px, -2px);
      box-shadow: var(--shadow-lg);
    }

    .card:active {
      transform: translate(0);
      box-shadow: var(--shadow-pressed);
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
    }

    .card__badges {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      flex-wrap: wrap;
    }

    .card__badge {
      display: inline-flex;
      align-items: center;
      padding: var(--space-0-5) var(--space-2);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      border: var(--border-width-thin) solid var(--color-border);
      background: var(--color-surface-header);
      color: var(--color-text-secondary);
    }

    .card__badge--condition-good {
      background: var(--color-success-bg, #e6f9e6);
      border-color: var(--color-success);
      color: var(--color-success);
    }

    .card__badge--condition-fair {
      background: var(--color-warning-bg, #fff8e1);
      border-color: var(--color-warning);
      color: var(--color-warning);
    }

    .card__badge--condition-poor {
      background: var(--color-danger-bg, #fce4e4);
      border-color: var(--color-danger);
      color: var(--color-danger);
    }

    .card__badge--condition-ruined {
      background: var(--color-danger-bg, #fce4e4);
      border-color: var(--color-danger);
      color: var(--color-danger);
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
      gap: var(--space-2);
      padding: var(--space-2) var(--space-4) var(--space-4);
    }

    .card__action-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-1-5) var(--space-3);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      background: var(--color-surface);
      color: var(--color-text-primary);
      border: var(--border-width-thin) solid var(--color-border);
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .card__action-btn:hover {
      background: var(--color-surface-sunken);
    }

    .card__action-btn--danger:hover {
      background: var(--color-danger);
      color: var(--color-text-inverse);
      border-color: var(--color-danger);
    }
  `;

  @property({ attribute: false }) building!: Building;

  private _buildingIcon() {
    return svg`
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M3 21l18 0" />
        <path d="M5 21v-14l8 -4v18" />
        <path d="M19 21v-10l-6 -4" />
        <path d="M9 9v.01" />
        <path d="M9 12v.01" />
        <path d="M9 15v.01" />
        <path d="M9 18v.01" />
      </svg>
    `;
  }

  private _getConditionClass(condition: string | undefined): string {
    if (!condition) return '';
    const normalized = condition.toLowerCase();
    if (normalized === 'good') return 'card__badge--condition-good';
    if (normalized === 'fair') return 'card__badge--condition-fair';
    if (normalized === 'poor') return 'card__badge--condition-poor';
    if (normalized === 'ruined') return 'card__badge--condition-ruined';
    return '';
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
      <div class="card" @click=${this._handleClick}>
        <div class="card__image">
          ${
            b.image_url
              ? html`<img src=${b.image_url} alt=${b.name} loading="lazy" />`
              : html`<div class="card__placeholder">${this._buildingIcon()}</div>`
          }
        </div>

        <div class="card__body">
          <h3 class="card__name">${b.name}</h3>

          <div class="card__badges">
            ${b.building_type ? html`<span class="card__badge">${b.building_type}</span>` : nothing}
            ${
              b.building_condition
                ? html`<span class="card__badge ${this._getConditionClass(b.building_condition)}">
                    ${b.building_condition}
                  </span>`
                : nothing
            }
          </div>

          <div class="card__meta">
            ${
              b.population_capacity != null
                ? html`<span class="card__meta-item">Cap: ${b.population_capacity}</span>`
                : nothing
            }
            ${locationText ? html`<span class="card__meta-item">${locationText}</span>` : nothing}
          </div>
        </div>

        <div class="card__actions">
          <button class="card__action-btn" @click=${this._handleEdit}>
            Edit
          </button>
          <button class="card__action-btn card__action-btn--danger" @click=${this._handleDelete}>
            Delete
          </button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-building-card': VelgBuildingCard;
  }
}

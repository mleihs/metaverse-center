import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing, svg } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import type { Building } from '../../types/index.js';
import '../shared/Lightbox.js';
import '../shared/VelgBadge.js';
import '../shared/VelgIconButton.js';

@localized()
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
      cursor: pointer;
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

  `;

  @property({ attribute: false }) building!: Building;
  @state() private _lightboxSrc: string | null = null;

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

  private _getConditionVariant(condition: string | undefined): string {
    if (!condition) return 'default';
    const normalized = condition.toLowerCase();
    if (normalized === 'good') return 'success';
    if (normalized === 'fair') return 'warning';
    if (normalized === 'poor' || normalized === 'ruined') return 'danger';
    return 'default';
  }

  private _editIcon() {
    return svg`
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M7 7h-1a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2 -2v-1" />
        <path d="M20.385 6.585a2.1 2.1 0 0 0 -2.97 -2.97l-8.415 8.385v3h3l8.385 -8.415z" />
        <path d="M16 5l3 3" />
      </svg>
    `;
  }

  private _deleteIcon() {
    return svg`
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 7l16 0" />
        <path d="M10 11l0 6" />
        <path d="M14 11l0 6" />
        <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" />
        <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />
      </svg>
    `;
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
              ? html`<img
                  src=${b.image_url}
                  alt=${b.name}
                  loading="lazy"
                  @click=${(e: Event) => {
                    e.stopPropagation();
                    this._lightboxSrc = b.image_url ?? null;
                  }}
                />`
              : html`<div class="card__placeholder">${this._buildingIcon()}</div>`
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
                  ${this._editIcon()}
                </velg-icon-button>
                <velg-icon-button variant="danger" .label=${msg('Delete building')} @icon-click=${this._handleDelete}>
                  ${this._deleteIcon()}
                </velg-icon-button>
              </div>
            `
            : nothing
        }
      </div>

      <velg-lightbox
        .src=${this._lightboxSrc}
        @lightbox-close=${() => {
          this._lightboxSrc = null;
        }}
      ></velg-lightbox>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-building-card': VelgBuildingCard;
  }
}

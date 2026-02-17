import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing, svg } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import { buildingsApi } from '../../services/api/index.js';
import type { Building, BuildingAgentRelation } from '../../types/index.js';
import '../shared/Lightbox.js';
import { panelButtonStyles } from '../shared/panel-button-styles.js';
import '../shared/VelgBadge.js';
import '../shared/VelgSectionHeader.js';
import '../shared/VelgSidePanel.js';

@localized()
@customElement('velg-building-details-panel')
export class VelgBuildingDetailsPanel extends LitElement {
  static styles = [
    panelButtonStyles,
    css`
    :host {
      display: block;
    }

    .panel__image {
      width: 100%;
      height: 240px;
      overflow: hidden;
      background: var(--color-surface-sunken);
      border-bottom: var(--border-default);
    }

    .panel__image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      cursor: pointer;
    }

    .panel__placeholder {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      color: var(--color-text-muted);
    }

    .panel__content {
      display: flex;
      flex-direction: column;
      gap: var(--space-5);
      padding: var(--space-6);
    }

    .panel__section {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .panel__badges {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      flex-wrap: wrap;
    }

    .panel__description {
      font-family: var(--font-sans);
      font-size: var(--text-base);
      line-height: var(--leading-relaxed);
      color: var(--color-text-primary);
      margin: 0;
    }

    .panel__detail-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-3);
    }

    .panel__detail-item {
      display: flex;
      flex-direction: column;
      gap: var(--space-0-5);
    }

    .panel__detail-label {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-muted);
    }

    .panel__detail-value {
      font-family: var(--font-sans);
      font-size: var(--text-sm);
      color: var(--color-text-primary);
    }

    .panel__agents-list {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .panel__agent-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-2) var(--space-3);
      background: var(--color-surface);
      border: var(--border-width-thin) solid var(--color-border-light);
    }

    .panel__agent-name {
      font-family: var(--font-sans);
      font-size: var(--text-sm);
      font-weight: var(--font-semibold);
      color: var(--color-text-primary);
    }

    .panel__agent-role {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-muted);
    }

    .panel__no-agents {
      font-family: var(--font-sans);
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      font-style: italic;
    }
  `,
  ];

  @property({ attribute: false }) building: Building | null = null;
  @property({ type: String }) simulationId = '';
  @property({ type: Boolean, reflect: true }) open = false;

  @state() private _agents: BuildingAgentRelation[] = [];
  @state() private _loadingAgents = false;
  @state() private _lightboxSrc: string | null = null;

  protected willUpdate(changedProperties: Map<PropertyKey, unknown>): void {
    if (changedProperties.has('building') || changedProperties.has('open')) {
      if (this.open && this.building) {
        this._loadAgents();
      } else {
        this._agents = [];
      }
    }
  }

  private async _loadAgents(): Promise<void> {
    if (!this.building || !this.simulationId) return;

    // Use pre-loaded agents if available on the building object
    if (this.building.agents && this.building.agents.length > 0) {
      this._agents = this.building.agents;
      return;
    }

    this._loadingAgents = true;
    try {
      const response = await buildingsApi.getAgents(this.simulationId, this.building.id);
      if (response.success && response.data) {
        this._agents = response.data;
      }
    } catch {
      // Silently fail for agents list
    } finally {
      this._loadingAgents = false;
    }
  }

  private _buildingIcon() {
    return svg`
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="64"
        height="64"
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

  private _handleEdit(): void {
    if (!this.building) return;
    this.dispatchEvent(
      new CustomEvent('building-edit', {
        detail: this.building,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleDelete(): void {
    if (!this.building) return;
    this.dispatchEvent(
      new CustomEvent('building-delete', {
        detail: this.building,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _renderAgents() {
    if (this._loadingAgents) {
      return html`<span class="panel__no-agents">${msg('Loading agents...')}</span>`;
    }

    if (this._agents.length === 0) {
      return html`<span class="panel__no-agents">${msg('No agents assigned to this building.')}</span>`;
    }

    return html`
      <div class="panel__agents-list">
        ${this._agents.map(
          (rel) => html`
            <div class="panel__agent-item">
              <span class="panel__agent-name">
                ${rel.agent?.name ?? msg(str`Agent ${rel.agent_id.slice(0, 8)}...`)}
              </span>
              <span class="panel__agent-role">${rel.relation_type}</span>
            </div>
          `,
        )}
      </div>
    `;
  }

  protected render() {
    const b = this.building;

    return html`
      <velg-side-panel
        .open=${this.open}
        .panelTitle=${msg('Building Details')}
      >
        ${
          b
            ? html`
              <div slot="media">
                <div class="panel__image">
                  ${
                    b.image_url
                      ? html`<img
                          src=${b.image_url}
                          alt=${b.name}
                          @click=${() => {
                            this._lightboxSrc = b.image_url ?? null;
                          }}
                        />`
                      : html`<div class="panel__placeholder">${this._buildingIcon()}</div>`
                  }
                </div>
              </div>

              <div slot="content">
                <div class="panel__content">
                  <div class="panel__section">
                    <velg-section-header>${msg('Identity')}</velg-section-header>
                    <div class="panel__badges">
                      ${
                        b.building_type
                          ? html`<velg-badge>${b.building_type}</velg-badge>`
                          : nothing
                      }
                      ${
                        b.building_condition
                          ? html`<velg-badge variant=${this._getConditionVariant(b.building_condition)}>
                              ${b.building_condition}
                            </velg-badge>`
                          : nothing
                      }
                      ${b.style ? html`<velg-badge>${b.style}</velg-badge>` : nothing}
                    </div>
                  </div>

                  ${
                    b.description
                      ? html`
                        <div class="panel__section">
                          <velg-section-header>${msg('Description')}</velg-section-header>
                          <p class="panel__description">${b.description}</p>
                        </div>
                      `
                      : nothing
                  }

                  <div class="panel__section">
                    <velg-section-header>${msg('Details')}</velg-section-header>
                    <div class="panel__detail-grid">
                      <div class="panel__detail-item">
                        <span class="panel__detail-label">${msg('Population Capacity')}</span>
                        <span class="panel__detail-value">${b.population_capacity ?? 0}</span>
                      </div>
                      ${
                        b.construction_year != null
                          ? html`
                            <div class="panel__detail-item">
                              <span class="panel__detail-label">${msg('Construction Year')}</span>
                              <span class="panel__detail-value">${b.construction_year}</span>
                            </div>
                          `
                          : nothing
                      }
                      ${
                        b.zone?.name
                          ? html`
                            <div class="panel__detail-item">
                              <span class="panel__detail-label">${msg('Zone')}</span>
                              <span class="panel__detail-value">${b.zone.name}</span>
                            </div>
                          `
                          : nothing
                      }
                      ${
                        b.city?.name
                          ? html`
                            <div class="panel__detail-item">
                              <span class="panel__detail-label">${msg('City')}</span>
                              <span class="panel__detail-value">${b.city.name}</span>
                            </div>
                          `
                          : nothing
                      }
                      ${
                        b.address
                          ? html`
                            <div class="panel__detail-item">
                              <span class="panel__detail-label">${msg('Address')}</span>
                              <span class="panel__detail-value">${b.address}</span>
                            </div>
                          `
                          : nothing
                      }
                      ${
                        b.street?.name
                          ? html`
                            <div class="panel__detail-item">
                              <span class="panel__detail-label">${msg('Street')}</span>
                              <span class="panel__detail-value">${b.street.name}</span>
                            </div>
                          `
                          : nothing
                      }
                    </div>
                  </div>

                  <div class="panel__section">
                    <velg-section-header>${msg('Assigned Agents')}</velg-section-header>
                    ${this._renderAgents()}
                  </div>
                </div>
              </div>

              <button slot="footer" class="panel__btn panel__btn--edit" @click=${this._handleEdit}>
                ${msg('Edit')}
              </button>
              <button slot="footer" class="panel__btn panel__btn--danger" @click=${this._handleDelete}>
                ${msg('Delete')}
              </button>
            `
            : nothing
        }
      </velg-side-panel>

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
    'velg-building-details-panel': VelgBuildingDetailsPanel;
  }
}

import { css, html, LitElement, nothing, svg } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import { buildingsApi } from '../../services/api/index.js';
import type { Building, BuildingAgentRelation } from '../../types/index.js';

@customElement('velg-building-details-panel')
export class VelgBuildingDetailsPanel extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .backdrop {
      position: fixed;
      inset: 0;
      z-index: var(--z-modal);
      display: flex;
      justify-content: flex-end;
      background: rgba(0, 0, 0, 0.4);
      opacity: 0;
      visibility: hidden;
      transition: opacity var(--transition-normal), visibility var(--transition-normal);
    }

    .backdrop--open {
      opacity: 1;
      visibility: visible;
    }

    .panel {
      width: 100%;
      max-width: 520px;
      height: 100%;
      display: flex;
      flex-direction: column;
      background: var(--color-surface-raised);
      border-left: var(--border-medium);
      box-shadow: var(--shadow-xl);
      transform: translateX(100%);
      transition: transform var(--transition-normal);
      overflow: hidden;
    }

    .backdrop--open .panel {
      transform: translateX(0);
    }

    .panel__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-4) var(--space-6);
      background: var(--color-surface-header);
      border-bottom: var(--border-medium);
      flex-shrink: 0;
    }

    .panel__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-lg);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      margin: 0;
    }

    .panel__close {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      padding: 0;
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-lg);
      line-height: 1;
      background: transparent;
      border: var(--border-medium);
      cursor: pointer;
      transition: all var(--transition-fast);
      flex-shrink: 0;
    }

    .panel__close:hover {
      background: var(--color-surface-sunken);
    }

    .panel__body {
      flex: 1;
      overflow-y: auto;
      padding: 0;
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

    .panel__section-title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-secondary);
      margin: 0;
      padding-bottom: var(--space-1);
      border-bottom: var(--border-light);
    }

    .panel__badges {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      flex-wrap: wrap;
    }

    .panel__badge {
      display: inline-flex;
      align-items: center;
      padding: var(--space-1) var(--space-2-5);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      border: var(--border-width-thin) solid var(--color-border);
      background: var(--color-surface-header);
      color: var(--color-text-secondary);
    }

    .panel__badge--condition-good {
      background: var(--color-success-bg, #e6f9e6);
      border-color: var(--color-success);
      color: var(--color-success);
    }

    .panel__badge--condition-fair {
      background: var(--color-warning-bg, #fff8e1);
      border-color: var(--color-warning);
      color: var(--color-warning);
    }

    .panel__badge--condition-poor,
    .panel__badge--condition-ruined {
      background: var(--color-danger-bg, #fce4e4);
      border-color: var(--color-danger);
      color: var(--color-danger);
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

    .panel__footer {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-4) var(--space-6);
      border-top: var(--border-medium);
      flex-shrink: 0;
    }

    .panel__btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-2) var(--space-4);
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      border: var(--border-default);
      box-shadow: var(--shadow-md);
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .panel__btn:hover {
      transform: translate(-2px, -2px);
      box-shadow: var(--shadow-lg);
    }

    .panel__btn:active {
      transform: translate(0);
      box-shadow: var(--shadow-pressed);
    }

    .panel__btn--edit {
      background: var(--color-primary);
      color: var(--color-text-inverse);
    }

    .panel__btn--danger {
      background: var(--color-danger);
      color: var(--color-text-inverse);
      border-color: var(--color-danger);
    }

    .panel__btn--danger:hover {
      background: var(--color-danger-hover);
    }

    .panel__no-agents {
      font-family: var(--font-sans);
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      font-style: italic;
    }
  `;

  @property({ attribute: false }) building: Building | null = null;
  @property({ type: String }) simulationId = '';
  @property({ type: Boolean }) open = false;

  @state() private _agents: BuildingAgentRelation[] = [];
  @state() private _loadingAgents = false;

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

  private _getConditionClass(condition: string | undefined): string {
    if (!condition) return '';
    const normalized = condition.toLowerCase();
    if (normalized === 'good') return 'panel__badge--condition-good';
    if (normalized === 'fair') return 'panel__badge--condition-fair';
    if (normalized === 'poor') return 'panel__badge--condition-poor';
    if (normalized === 'ruined') return 'panel__badge--condition-ruined';
    return '';
  }

  private _handleClose(): void {
    this.dispatchEvent(
      new CustomEvent('panel-close', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleBackdropClick(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('backdrop')) {
      this._handleClose();
    }
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
      return html`<span class="panel__no-agents">Loading agents...</span>`;
    }

    if (this._agents.length === 0) {
      return html`<span class="panel__no-agents">No agents assigned to this building.</span>`;
    }

    return html`
      <div class="panel__agents-list">
        ${this._agents.map(
          (rel) => html`
            <div class="panel__agent-item">
              <span class="panel__agent-name">
                ${rel.agent?.name ?? `Agent ${rel.agent_id.slice(0, 8)}...`}
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
      <div
        class="backdrop ${this.open ? 'backdrop--open' : ''}"
        @click=${this._handleBackdropClick}
      >
        <div class="panel">
          <div class="panel__header">
            <h2 class="panel__title">Building Details</h2>
            <button
              class="panel__close"
              @click=${this._handleClose}
              aria-label="Close"
            >
              X
            </button>
          </div>

          ${
            b
              ? html`
                <div class="panel__body">
                  <div class="panel__image">
                    ${
                      b.image_url
                        ? html`<img src=${b.image_url} alt=${b.name} />`
                        : html`<div class="panel__placeholder">${this._buildingIcon()}</div>`
                    }
                  </div>

                  <div class="panel__content">
                    <div class="panel__section">
                      <h3 class="panel__section-title">Identity</h3>
                      <div class="panel__badges">
                        ${
                          b.building_type
                            ? html`<span class="panel__badge">${b.building_type}</span>`
                            : nothing
                        }
                        ${
                          b.building_condition
                            ? html`<span class="panel__badge ${this._getConditionClass(b.building_condition)}">
                                ${b.building_condition}
                              </span>`
                            : nothing
                        }
                        ${b.style ? html`<span class="panel__badge">${b.style}</span>` : nothing}
                      </div>
                    </div>

                    ${
                      b.description
                        ? html`
                          <div class="panel__section">
                            <h3 class="panel__section-title">Description</h3>
                            <p class="panel__description">${b.description}</p>
                          </div>
                        `
                        : nothing
                    }

                    <div class="panel__section">
                      <h3 class="panel__section-title">Details</h3>
                      <div class="panel__detail-grid">
                        <div class="panel__detail-item">
                          <span class="panel__detail-label">Population Capacity</span>
                          <span class="panel__detail-value">${b.population_capacity ?? 0}</span>
                        </div>
                        ${
                          b.construction_year != null
                            ? html`
                              <div class="panel__detail-item">
                                <span class="panel__detail-label">Construction Year</span>
                                <span class="panel__detail-value">${b.construction_year}</span>
                              </div>
                            `
                            : nothing
                        }
                        ${
                          b.zone?.name
                            ? html`
                              <div class="panel__detail-item">
                                <span class="panel__detail-label">Zone</span>
                                <span class="panel__detail-value">${b.zone.name}</span>
                              </div>
                            `
                            : nothing
                        }
                        ${
                          b.city?.name
                            ? html`
                              <div class="panel__detail-item">
                                <span class="panel__detail-label">City</span>
                                <span class="panel__detail-value">${b.city.name}</span>
                              </div>
                            `
                            : nothing
                        }
                        ${
                          b.address
                            ? html`
                              <div class="panel__detail-item">
                                <span class="panel__detail-label">Address</span>
                                <span class="panel__detail-value">${b.address}</span>
                              </div>
                            `
                            : nothing
                        }
                        ${
                          b.street?.name
                            ? html`
                              <div class="panel__detail-item">
                                <span class="panel__detail-label">Street</span>
                                <span class="panel__detail-value">${b.street.name}</span>
                              </div>
                            `
                            : nothing
                        }
                      </div>
                    </div>

                    <div class="panel__section">
                      <h3 class="panel__section-title">Assigned Agents</h3>
                      ${this._renderAgents()}
                    </div>
                  </div>
                </div>

                <div class="panel__footer">
                  <button class="panel__btn panel__btn--edit" @click=${this._handleEdit}>
                    Edit
                  </button>
                  <button class="panel__btn panel__btn--danger" @click=${this._handleDelete}>
                    Delete
                  </button>
                </div>
              `
              : nothing
          }
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-building-details-panel': VelgBuildingDetailsPanel;
  }
}

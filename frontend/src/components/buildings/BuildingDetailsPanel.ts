import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { buildingsApi, embassiesApi, healthApi } from '../../services/api/index.js';
import type {
  Building,
  BuildingAgentRelation,
  BuildingReadiness,
  Embassy,
} from '../../types/index.js';
import { icons } from '../../utils/icons.js';
import { buildingAltText } from '../../utils/text.js';
import '../shared/Lightbox.js';
import { panelButtonStyles } from '../shared/panel-button-styles.js';
import { panelCascadeStyles } from '../shared/panel-cascade-styles.js';
import '../shared/VelgBadge.js';
import '../shared/VelgSectionHeader.js';
import '../shared/VelgSidePanel.js';
import './EmbassyLink.js';

@localized()
@customElement('velg-building-details-panel')
export class VelgBuildingDetailsPanel extends LitElement {
  static styles = [
    panelButtonStyles,
    panelCascadeStyles,
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

    .panel__ambassador {
      padding: var(--space-3);
      background: var(--color-surface-sunken);
      border: var(--border-width-thin) solid var(--color-border-light);
      margin-bottom: var(--space-2);
      cursor: pointer;
      transition: background var(--transition-fast);
    }

    .panel__ambassador:hover {
      background: var(--color-surface-header);
    }

    .panel__ambassador:hover .panel__ambassador-name {
      color: var(--color-primary);
    }

    .panel__ambassador-info {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .panel__ambassador-name {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
    }

    .panel__ambassador-role {
      display: block;
      margin-top: var(--space-1);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      font-style: italic;
    }

    /* --- Readiness section --- */

    .panel__readiness {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }

    .panel__readiness-bar {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }

    .panel__readiness-track {
      flex: 1;
      height: 8px;
      background: var(--color-surface-sunken);
      border: var(--border-width-thin) solid var(--color-border);
      overflow: hidden;
    }

    .panel__readiness-fill {
      height: 100%;
      transition: width 0.6s var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)) 0.4s;
    }

    .panel__readiness-value {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
      min-width: 48px;
      text-align: right;
    }

    .panel__readiness-label {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      padding: var(--space-1) var(--space-2);
    }

    .panel__readiness-label--critical {
      background: var(--color-danger-bg);
      color: var(--color-danger);
    }

    .panel__readiness-label--understaffed {
      background: var(--color-warning-bg);
      color: var(--color-accent);
    }

    .panel__readiness-label--operational {
      background: var(--color-success-bg);
      color: var(--color-success);
    }

    .panel__readiness-label--overcrowded {
      background: var(--color-info-bg);
      color: var(--color-secondary);
    }
  `,
  ];

  @property({ attribute: false }) building: Building | null = null;
  @property({ type: String }) simulationId = '';
  @property({ type: Boolean, reflect: true }) open = false;

  @state() private _agents: BuildingAgentRelation[] = [];
  @state() private _loadingAgents = false;
  @state() private _embassy: Embassy | null = null;
  @state() private _readiness: BuildingReadiness | null = null;
  @state() private _lightboxSrc: string | null = null;
  @state() private _lightboxAlt = '';

  protected willUpdate(changedProperties: Map<PropertyKey, unknown>): void {
    if (changedProperties.has('building') || changedProperties.has('open')) {
      if (this.open && this.building) {
        this._loadAgents();
        this._loadEmbassy();
        this._loadReadiness();
      } else {
        this._agents = [];
        this._embassy = null;
        this._readiness = null;
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

    if (!appState.isAuthenticated.value) return;
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

  private async _loadEmbassy(): Promise<void> {
    if (!this.building || !this.simulationId) return;
    if (this.building.special_type !== 'embassy') {
      this._embassy = null;
      return;
    }
    try {
      const response = await embassiesApi.getForBuilding(this.simulationId, this.building.id);
      if (response.success && response.data) {
        this._embassy = response.data;
      }
    } catch {
      // Embassy data not critical — fail silently
    }
  }

  private async _loadReadiness(): Promise<void> {
    if (!this.building || !this.simulationId) return;
    try {
      const response = await healthApi.listBuildingReadiness(this.simulationId);
      if (response.success && response.data) {
        const buildings = Array.isArray(response.data)
          ? response.data
          : ((response.data as { data?: BuildingReadiness[] }).data ?? []);
        this._readiness =
          buildings.find((b: BuildingReadiness) => b.building_id === this.building?.id) ?? null;
      }
    } catch {
      // Readiness data not critical — fail silently
    }
  }

  private _handleNavigateEmbassy(e: CustomEvent): void {
    const { simulationSlug, buildingId } = e.detail;
    // Navigate to partner building in partner simulation
    window.history.pushState({}, '', `/simulations/${simulationSlug}/buildings`);
    window.dispatchEvent(new PopStateEvent('popstate'));
    // Store building ID to open after navigation
    sessionStorage.setItem('openBuildingId', buildingId);
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

  private _handleEstablishEmbassy(): void {
    if (!this.building) return;
    this.dispatchEvent(
      new CustomEvent('embassy-establish', {
        detail: this.building,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _getLocalAmbassador(): { name: string; role: string } | null {
    if (!this._embassy || !this.building) return null;
    const meta = this._embassy.embassy_metadata;
    if (!meta) return null;

    // simulation_a_id/building_a_id are correctly paired, use simulation to pick ambassador
    const key =
      this.simulationId === this._embassy.simulation_a_id ? 'ambassador_a' : 'ambassador_b';
    const amb = meta[key];
    if (!amb?.name) return null;
    return { name: amb.name, role: amb.role ?? '' };
  }

  private _handleAmbassadorClick(): void {
    const amb = this._getLocalAmbassador();
    if (!amb) return;
    const sim = appState.currentSimulation.value;
    const slug = sim?.slug ?? sim?.id ?? this.simulationId;
    sessionStorage.setItem('openAgentName', amb.name);
    window.history.pushState({}, '', `/simulations/${slug}/agents`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }

  private _renderAmbassador() {
    const amb = this._getLocalAmbassador();
    if (!amb) return nothing;

    return html`
      <div class="panel__ambassador" @click=${this._handleAmbassadorClick}>
        <div class="panel__ambassador-info">
          <span class="panel__ambassador-name">${amb.name}</span>
          <velg-badge variant="warning">${msg('Ambassador')}</velg-badge>
        </div>
        ${amb.role ? html`<span class="panel__ambassador-role">${amb.role}</span>` : nothing}
      </div>
    `;
  }

  private _readinessColor(value: number): string {
    if (value < 0.3) return 'var(--color-danger)';
    if (value < 0.5) return 'var(--color-accent)';
    if (value < 0.8) return 'var(--color-success)';
    return 'var(--color-primary)';
  }

  private _staffingLabelClass(status: string): string {
    const s = status.toLowerCase();
    if (s.includes('critical')) return 'panel__readiness-label--critical';
    if (s.includes('understaffed')) return 'panel__readiness-label--understaffed';
    if (s.includes('overcrowded')) return 'panel__readiness-label--overcrowded';
    return 'panel__readiness-label--operational';
  }

  private _renderReadiness() {
    const r = this._readiness;
    if (!r) return nothing;

    const pct = Math.round(r.readiness * 100);
    const fillColor = this._readinessColor(r.readiness);

    return html`
      <div class="panel__readiness">
        <div class="panel__readiness-bar">
          <div class="panel__readiness-track">
            <div
              class="panel__readiness-fill"
              style="width: ${pct}%; background: ${fillColor}"
            ></div>
          </div>
          <span class="panel__readiness-value" style="color: ${fillColor}">${pct}%</span>
        </div>

        <div class="panel__detail-grid">
          <div class="panel__detail-item">
            <span class="panel__detail-label">${msg('Staffing')}</span>
            <span class="panel__detail-value">
              ${r.assigned_agents} / ${r.population_capacity}
              <span class="panel__readiness-label ${this._staffingLabelClass(r.staffing_status)}">
                ${r.staffing_status}
              </span>
            </span>
          </div>
          <div class="panel__detail-item">
            <span class="panel__detail-label">${msg('Qualification')}</span>
            <span class="panel__detail-value">${(r.qualification_match * 100).toFixed(0)}%</span>
          </div>
          <div class="panel__detail-item">
            <span class="panel__detail-label">${msg('Condition Factor')}</span>
            <span class="panel__detail-value">${r.condition_factor}</span>
          </div>
          <div class="panel__detail-item">
            <span class="panel__detail-label">${msg('Criticality')}</span>
            <span class="panel__detail-value">${r.criticality_weight}x</span>
          </div>
        </div>
      </div>
    `;
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
        .panelTitle=${b?.name ?? msg('Building Details')}
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
                          alt=${buildingAltText(b)}
                          @click=${() => {
                            this._lightboxSrc = b.image_url ?? null;
                            this._lightboxAlt = buildingAltText(b);
                          }}
                        />`
                      : html`<div class="panel__placeholder">${icons.building(64)}</div>`
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
                      ${b.special_type === 'embassy' ? html`<velg-badge variant="info">${msg('Embassy')}</velg-badge>` : nothing}
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

                  ${
                    this._readiness
                      ? html`
                        <div class="panel__section">
                          <velg-section-header>${msg('Operations')}</velg-section-header>
                          ${this._renderReadiness()}
                        </div>
                      `
                      : nothing
                  }

                  ${
                    this._embassy
                      ? html`
                        <div class="panel__section">
                          <velg-section-header>${msg('Embassy Link')}</velg-section-header>
                          ${this._renderAmbassador()}
                          <velg-embassy-link
                            .embassy=${this._embassy}
                            .currentBuildingId=${b.id}
                            @navigate-embassy=${this._handleNavigateEmbassy}
                          ></velg-embassy-link>
                        </div>
                      `
                      : nothing
                  }

                  <div class="panel__section">
                    <velg-section-header>${msg('Assigned Agents')}</velg-section-header>
                    ${this._renderAgents()}
                  </div>
                </div>
              </div>

              ${
                appState.canEdit.value
                  ? html`
                <button slot="footer" class="panel__btn panel__btn--edit" @click=${this._handleEdit}>
                  ${msg('Edit')}
                </button>
                <button slot="footer" class="panel__btn panel__btn--danger" @click=${this._handleDelete}>
                  ${msg('Delete')}
                </button>
              `
                  : nothing
              }
              ${
                appState.canAdmin.value && b.special_type !== 'embassy'
                  ? html`
                <button slot="footer" class="panel__btn panel__btn--generate" @click=${this._handleEstablishEmbassy}>
                  ${msg('Establish Embassy')}
                </button>
              `
                  : nothing
              }
            `
            : nothing
        }
      </velg-side-panel>

      <velg-lightbox
        .src=${this._lightboxSrc}
        .alt=${this._lightboxAlt}
        .caption=${this.building?.name ?? ''}
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

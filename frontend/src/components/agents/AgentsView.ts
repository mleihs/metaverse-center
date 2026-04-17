import { localized, msg, str } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { effect } from '@preact/signals-core';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { agentsApi } from '../../services/api/index.js';
import { forgeStateManager } from '../../services/ForgeStateManager.js';
import { seoService } from '../../services/SeoService.js';
import { applyAgentDetailSeo, applySimulationViewSeo } from '../../services/seo-patterns.js';
import type {
  Agent,
  AgentAptitude,
  ApiResponse,
  AptitudeSet,
  OperativeType,
} from '../../types/index.js';
import { t } from '../../utils/locale-fields.js';
import { updateUrl } from '../../utils/navigation.js';
import { VelgConfirmDialog } from '../shared/ConfirmDialog.js';
import { gridLayoutStyles } from '../shared/grid-layout-styles.js';
import { PaginatedLoaderMixin } from '../shared/PaginatedLoaderMixin.js';
import type { FilterConfig } from '../shared/SharedFilterBar.js';
import { VelgToast } from '../shared/Toast.js';
import { titleGroupStyles } from '../shared/title-group-styles.js';
import { viewHeaderStyles } from '../shared/view-header-styles.js';

import '../shared/SharedFilterBar.js';
import '../shared/Pagination.js';
import '../shared/VelgAptitudeBars.js';
import '../shared/VelgAvatar.js';
import '../shared/VelgHelpTip.js';
import './AgentCard.js';
import './AgentEditModal.js';
import './AgentDetailsPanel.js';
import './VelgRecruitmentOffice.js';

@localized()
@customElement('velg-agents-view')
export class VelgAgentsView extends SignalWatcher(PaginatedLoaderMixin(LitElement)) {
  static styles = [
    viewHeaderStyles,
    titleGroupStyles,
    gridLayoutStyles,
    css`
    :host {
      display: block;
    }

    .entity-grid {
      --grid-min-width: 200px;
      gap: var(--space-5);
    }

    /* Lineup Overview Strip */
    .lineup {
      margin-bottom: var(--space-5);
      border: var(--border-width-thin) solid var(--color-border-light);
      background: var(--color-surface-sunken);
      overflow: hidden;
    }

    .lineup__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-2) var(--space-3);
      border-bottom: var(--border-width-thin) solid var(--color-border-light);
    }

    .lineup__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-muted);
    }

    .lineup__scroll {
      display: flex;
      gap: var(--space-3);
      padding: var(--space-3);
      overflow-x: auto;
      scrollbar-width: thin;
      scrollbar-color: var(--color-border) transparent;
    }

    .lineup__card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-1-5);
      padding: var(--space-2);
      min-width: 100px;
      max-width: 100px;
      cursor: pointer;
      border: var(--border-width-thin) solid transparent;
      transition: all var(--transition-fast);
      opacity: 0;
      animation: lineup-enter 300ms var(--ease-dramatic) forwards;
      animation-delay: calc(var(--i, 0) * 40ms);
    }

    @keyframes lineup-enter {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .lineup__card:hover {
      background: var(--color-surface-header);
      border-color: var(--color-border);
    }

    .lineup__name {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-secondary);
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      width: 100%;
    }

    .lineup__bars {
      width: 100%;
    }

    .lineup__role {
      font-size: 8px;
      color: var(--color-text-muted);
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      width: 100%;
      opacity: 0.8;
    }


    @media (max-width: 480px) {
      .lineup__card {
        min-width: 80px;
        max-width: 80px;
      }

      .lineup__name {
        font-size: 8px;
      }

      .lineup__scroll {
        gap: var(--space-2);
        padding: var(--space-2);
      }

      .entity-grid {
        gap: var(--space-3);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .lineup__card {
        animation: none;
        opacity: 1;
      }
    }
  `,
  ];

  @property({ type: String }) simulationId = '';
  @property({ type: String }) entitySlug = '';

  @state() private _selectedAgent: Agent | null = null;
  @state() private _editAgent: Agent | null = null;
  @state() private _showEditModal = false;
  @state() private _showDetails = false;
  @state() private _aptitudeMap: Map<string, AptitudeSet> = new Map();

  private _disposeImageTracking?: () => void;

  /* ── DataLoaderMixin contract ────────── */

  protected get _agents(): Agent[] {
    return (this._data as Agent[]) ?? [];
  }

  protected async _fetchData(): Promise<ApiResponse<Agent[]>> {
    return agentsApi.list(this.simulationId, this._buildParams());
  }

  protected _getLoadingMessage(): string {
    return msg('Loading agents...');
  }

  protected _getEmptyMessage(): string {
    return msg('No agents found.');
  }

  protected _getErrorFallback(): string {
    return msg('Failed to load agents');
  }

  protected _onDataLoaded(): void {
    this._checkDeepLink();
    this._loadAllAptitudes();
    const sim = appState.currentSimulation.value;
    if (sim) {
      seoService.setCollectionPage({
        name: `${t(sim, 'name')} \u2013 Agents`,
        description: `All agents in the ${t(sim, 'name')} simulation.`,
        url: `https://metaverse.center/simulations/${sim.slug}/agents`,
        numberOfItems: this._total,
      });
    }
  }

  private get _canEdit(): boolean {
    return appState.canEdit.value;
  }

  private get _filterConfigs(): FilterConfig[] {
    const locale = appState.currentSimulation.value?.content_locale ?? 'en';

    const systemTaxonomies = appState.getTaxonomiesByType('system').filter((t) => t.is_active);
    const genderTaxonomies = appState.getTaxonomiesByType('gender').filter((t) => t.is_active);

    return [
      {
        key: 'system',
        label: msg('System'),
        options: systemTaxonomies.map((t) => ({
          value: t.value,
          label: t.label[locale] ?? t.value,
        })),
      },
      {
        key: 'gender',
        label: msg('Gender'),
        options: genderTaxonomies.map((t) => ({
          value: t.value,
          label: t.label[locale] ?? t.value,
        })),
      },
    ];
  }

  connectedCallback(): void {
    super.connectedCallback(); // mixin auto-loads
    this._disposeImageTracking = effect(() => {
      const version = forgeStateManager.imageUpdateVersion.value;
      if (version > 0 && this._agents.length > 0) {
        this._load();
      }
    });
  }

  disconnectedCallback(): void {
    this._disposeImageTracking?.();
    seoService.removeStructuredData();
    super.disconnectedCallback();
  }

  private async _checkDeepLink(): Promise<void> {
    // Slug-based deep link from URL route (primary)
    if (this.entitySlug) {
      const agent = this._agents.find((a) => a.slug === this.entitySlug);
      if (agent) {
        this._openAgentDetail(agent);
        return;
      }
      // Agent not in current page — fetch by slug from API
      try {
        const resp = await agentsApi.getBySlug(this.simulationId, this.entitySlug);
        if (resp.success && resp.data) {
          this._openAgentDetail(resp.data as Agent);
          return;
        }
      } catch {
        // Fall through
      }
    }
    // Legacy name-based deep link (backward compat)
    const agentName = appState.pendingOpenAgentName.value;
    if (!agentName) return;
    appState.pendingOpenAgentName.value = null;

    const agent = this._agents.find((a) => a.name === agentName);
    if (agent) {
      this._openAgentDetail(agent);
    }
  }

  /** Open the agent detail panel and apply entity-specific SEO. Consolidates
   *  the five places that used to set _selectedAgent + _showDetails manually. */
  private _openAgentDetail(agent: Agent): void {
    this._selectedAgent = agent;
    this._showDetails = true;
    const sim = appState.currentSimulation.value;
    if (sim) {
      applyAgentDetailSeo(sim, agent);
    }
  }

  private async _loadAllAptitudes(): Promise<void> {
    if (!this.simulationId) return;

    try {
      const response = await agentsApi.getAllAptitudes(this.simulationId);
      if (response.success && response.data) {
        const map = new Map<string, AptitudeSet>();
        for (const row of response.data as AgentAptitude[]) {
          if (!map.has(row.agent_id)) {
            map.set(row.agent_id, {
              spy: 6,
              guardian: 6,
              saboteur: 6,
              propagandist: 6,
              infiltrator: 6,
              assassin: 6,
            });
          }
          const set = map.get(row.agent_id);
          if (set) set[row.operative_type as OperativeType] = row.aptitude_level;
        }
        this._aptitudeMap = map;
      }
    } catch {
      // Non-critical
    }
  }

  private _renderLineup() {
    if (this._agents.length === 0) return nothing;

    const hasAptitudes = this._aptitudeMap.size > 0;

    return html`
      <div class="lineup">
        <div class="lineup__header">
          <span class="lineup__title">${msg('Lineup Overview')}</span>
        </div>
        <div class="lineup__scroll">
          ${this._agents.map((agent, i) => {
            const aptitudes = hasAptitudes ? this._aptitudeMap.get(agent.id) : null;

            return html`
              <div
                class="lineup__card"
                style="--i: ${i}"
                @click=${() => this._openAgentDetail(agent)}
              >
                <velg-avatar
                  .src=${agent.portrait_image_url ?? ''}
                  .name=${agent.name}
                  size="sm"
                ></velg-avatar>
                <span class="lineup__name">${agent.name}</span>
                ${
                  aptitudes
                    ? html`
                  <div class="lineup__bars">
                    <velg-aptitude-bars
                      .aptitudes=${aptitudes}
                      size="sm"
                    ></velg-aptitude-bars>
                  </div>
                `
                    : agent.primary_profession
                      ? html`
                  <span class="lineup__role">${agent.primary_profession}</span>
                `
                      : nothing
                }
              </div>
            `;
          })}
        </div>
      </div>
    `;
  }

  private _handleAgentClick(e: CustomEvent<Agent>): void {
    this._pushEntityUrl(e.detail);
    this._openAgentDetail(e.detail);
  }

  private _pushEntityUrl(agent: Agent): void {
    const sim = appState.currentSimulation.value;
    if (!sim?.slug || !agent.slug) return;
    updateUrl(`/simulations/${sim.slug}/agents/${agent.slug}`);
  }

  private _pushListUrl(): void {
    const sim = appState.currentSimulation.value;
    if (!sim?.slug) return;
    updateUrl(`/simulations/${sim.slug}/agents`);
  }

  private _handleAgentEdit(e: CustomEvent<Agent>): void {
    this._editAgent = e.detail;
    this._showEditModal = true;
    this._showDetails = false;
  }

  private async _handleAgentDelete(e: CustomEvent<Agent>): Promise<void> {
    const agent = e.detail;

    const confirmed = await VelgConfirmDialog.show({
      title: msg('Delete Agent'),
      message: msg(
        str`Are you sure you want to delete "${agent.name}"? This action cannot be undone.`,
      ),
      confirmLabel: msg('Delete'),
      variant: 'danger',
    });

    if (!confirmed) return;

    try {
      const response = await agentsApi.remove(this.simulationId, agent.id);
      if (response.success) {
        VelgToast.success(msg(str`Agent "${agent.name}" deleted successfully.`));
        this._showDetails = false;
        this._selectedAgent = null;
        this._load();
      } else {
        VelgToast.error(response.error?.message ?? msg('Failed to delete agent.'));
      }
    } catch (err) {
      VelgToast.error(err instanceof Error ? err.message : msg('An unknown error occurred.'));
    }
  }

  private _handleCreateClick(): void {
    this._editAgent = null;
    this._showEditModal = true;
  }

  private _handleAgentSaved(_e: CustomEvent<Agent>): void {
    const isEdit = this._editAgent !== null;
    this._showEditModal = false;
    this._editAgent = null;
    VelgToast.success(
      isEdit ? msg('Agent updated successfully.') : msg('Agent created successfully.'),
    );
    this._load();
  }

  private _handleEditModalClose(): void {
    this._showEditModal = false;
    this._editAgent = null;
  }

  private _handleDetailsPanelClose(): void {
    this._showDetails = false;
    this._selectedAgent = null;
    this._pushListUrl();
    // Revert to list-view meta (title, og:type, og:image) + CollectionPage JSON-LD
    const sim = appState.currentSimulation.value;
    if (sim) {
      applySimulationViewSeo(sim, 'agents');
      seoService.setCollectionPage({
        name: `${t(sim, 'name')} \u2013 Agents`,
        description: `All agents in the ${t(sim, 'name')} simulation.`,
        url: `https://metaverse.center/simulations/${sim.slug}/agents`,
        numberOfItems: this._total,
      });
    }
  }

  private _handleLightboxPrev(): void {
    const idx = this._selectedAgent ? this._agents.indexOf(this._selectedAgent) : -1;
    if (idx > 0) {
      const next = this._agents[idx - 1];
      this._pushEntityUrl(next);
      this._openAgentDetail(next);
    }
  }

  private _handleLightboxNext(): void {
    const idx = this._selectedAgent ? this._agents.indexOf(this._selectedAgent) : -1;
    if (idx >= 0 && idx < this._agents.length - 1) {
      const next = this._agents[idx + 1];
      this._pushEntityUrl(next);
      this._openAgentDetail(next);
    }
  }

  private _handleRecruitmentComplete(): void {
    this._load();
  }

  protected _renderEmptyState() {
    return html`
      <velg-empty-state
        message=${this._getEmptyMessage()}
        cta-label=${this._canEdit ? msg('Create First Agent') : ''}
        @cta-click=${this._handleCreateClick}
      ></velg-empty-state>
    `;
  }

  protected render() {
    return html`
      <section class="view" aria-label=${msg('Agents')}>
        <header class="view__header">
          <div class="title-group">
            <h1 class="view__title">${msg('Agents')}</h1>
            <velg-help-tip
              topic="agents"
              label=${msg('What are agents?')}
            ></velg-help-tip>
          </div>
          ${
            this._canEdit
              ? html`
                <button class="view__create-btn" @click=${this._handleCreateClick}>
                  ${msg('+ Create Agent')}
                </button>
              `
              : nothing
          }
        </header>

        <velg-filter-bar
          .filters=${this._filterConfigs}
          search-placeholder=${msg('Search agents...')}
          @filter-change=${this._handleFilterChange}
        ></velg-filter-bar>

        ${this._renderDataGuard(() => this._renderGrid())}

        <velg-pagination
          .total=${this._total}
          .limit=${this._limit}
          .offset=${this._offset}
          @page-change=${this._handlePageChange}
        ></velg-pagination>
      </section>

      <velg-agent-edit-modal
        .agent=${this._editAgent}
        .simulationId=${this.simulationId}
        ?open=${this._showEditModal}
        @agent-saved=${this._handleAgentSaved}
        @modal-close=${this._handleEditModalClose}
      ></velg-agent-edit-modal>

      <velg-agent-details-panel
        .agent=${this._selectedAgent}
        .simulationId=${this.simulationId}
        ?open=${this._showDetails}
        container="lightbox"
        .totalEntities=${this._agents.length}
        .currentIndex=${this._selectedAgent ? this._agents.indexOf(this._selectedAgent) : 0}
        @panel-close=${this._handleDetailsPanelClose}
        @lightbox-prev=${this._handleLightboxPrev}
        @lightbox-next=${this._handleLightboxNext}
        @agent-edit=${this._handleAgentEdit}
        @agent-delete=${this._handleAgentDelete}
      ></velg-agent-details-panel>
    `;
  }

  private _renderGrid() {
    return html`
      <span class="view__count">${msg(str`${this._total} Agent${this._total !== 1 ? 's' : ''}`)}</span>
      ${this._renderLineup()}
      <div class="entity-grid">
        ${this._agents.map(
          (agent, i) => html`
            <velg-agent-card
              style="--i: ${i}"
              .agent=${agent}
              .aptitudes=${this._aptitudeMap.get(agent.id) ?? null}
              ?generating=${forgeStateManager.imageTrackingSlug.value === (appState.currentSimulation.value?.slug ?? '') && !agent.portrait_image_url}
              @agent-click=${this._handleAgentClick}
              @agent-edit=${this._handleAgentEdit}
              @agent-delete=${this._handleAgentDelete}
            ></velg-agent-card>
          `,
        )}
      </div>

      ${
        this._canEdit
          ? html`
          <velg-recruitment-office
            .simulationId=${this.simulationId}
            .walletBalance=${forgeStateManager.walletBalance.value}
            .hasBypass=${forgeStateManager.hasTokenBypass.value}
            @recruitment-complete=${this._handleRecruitmentComplete}
          ></velg-recruitment-office>
        `
          : nothing
      }
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-agents-view': VelgAgentsView;
  }
}

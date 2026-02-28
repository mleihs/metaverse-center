import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { agentsApi } from '../../services/api/index.js';
import type { Agent } from '../../types/index.js';
import { VelgConfirmDialog } from '../shared/ConfirmDialog.js';
import type { FilterChangeDetail, FilterConfig } from '../shared/SharedFilterBar.js';
import { VelgToast } from '../shared/Toast.js';
import { viewHeaderStyles } from '../shared/view-header-styles.js';

import '../shared/SharedFilterBar.js';
import '../shared/Pagination.js';
import '../shared/LoadingState.js';
import '../shared/ErrorState.js';
import '../shared/EmptyState.js';
import './AgentCard.js';
import './AgentEditModal.js';
import './AgentDetailsPanel.js';

@localized()
@customElement('velg-agents-view')
export class VelgAgentsView extends LitElement {
  static styles = [
    viewHeaderStyles,
    css`
    :host {
      display: block;
    }

    .view__grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: var(--space-5);
    }

    @media (max-width: 640px) {
      .view__grid {
        grid-template-columns: 1fr 1fr;
      }
    }

    @media (max-width: 400px) {
      .view__grid {
        grid-template-columns: 1fr;
      }
    }
  `,
  ];

  @property({ type: String }) simulationId = '';

  @state() private _agents: Agent[] = [];
  @state() private _total = 0;
  @state() private _loading = true;
  @state() private _error: string | null = null;
  @state() private _limit = 25;
  @state() private _offset = 0;
  @state() private _filters: Record<string, string> = {};
  @state() private _search = '';
  @state() private _selectedAgent: Agent | null = null;
  @state() private _editAgent: Agent | null = null;
  @state() private _showEditModal = false;
  @state() private _showDetails = false;

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
    super.connectedCallback();
    if (this.simulationId) {
      this._loadAgents();
    }
  }

  protected willUpdate(changedProperties: Map<PropertyKey, unknown>): void {
    if (changedProperties.has('simulationId') && this.simulationId) {
      this._offset = 0;
      this._loadAgents();
    }
  }

  private async _loadAgents(): Promise<void> {
    if (!this.simulationId) return;

    this._loading = true;
    this._error = null;

    try {
      const params: Record<string, string> = {
        limit: String(this._limit),
        offset: String(this._offset),
      };

      if (this._search) {
        params.search = this._search;
      }

      for (const [key, value] of Object.entries(this._filters)) {
        if (value) {
          params[key] = value;
        }
      }

      const response = await agentsApi.list(this.simulationId, params);

      if (response.success && response.data) {
        this._agents = Array.isArray(response.data) ? response.data : [];
        this._total = response.meta?.total ?? this._agents.length;
        this._checkDeepLink();
      } else {
        this._error = response.error?.message ?? msg('Failed to load agents');
      }
    } catch (err) {
      this._error = err instanceof Error ? err.message : msg('An unknown error occurred');
    } finally {
      this._loading = false;
    }
  }

  private _checkDeepLink(): void {
    const agentName = sessionStorage.getItem('openAgentName');
    if (!agentName) return;
    sessionStorage.removeItem('openAgentName');

    const agent = this._agents.find((a) => a.name === agentName);
    if (agent) {
      this._selectedAgent = agent;
      this._showDetails = true;
    }
  }

  private _handleFilterChange(e: CustomEvent<FilterChangeDetail>): void {
    this._filters = e.detail.filters;
    this._search = e.detail.search;
    this._offset = 0;
    this._loadAgents();
  }

  private _handlePageChange(e: CustomEvent<{ limit: number; offset: number }>): void {
    this._limit = e.detail.limit;
    this._offset = e.detail.offset;
    this._loadAgents();
  }

  private _handleAgentClick(e: CustomEvent<Agent>): void {
    this._selectedAgent = e.detail;
    this._showDetails = true;
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
        this._loadAgents();
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
    this._loadAgents();
  }

  private _handleEditModalClose(): void {
    this._showEditModal = false;
    this._editAgent = null;
  }

  private _handleDetailsPanelClose(): void {
    this._showDetails = false;
    this._selectedAgent = null;
  }

  private _handleRetry(): void {
    this._loadAgents();
  }

  private _handleEmptyCta(): void {
    if (this._canEdit) {
      this._handleCreateClick();
    }
  }

  protected render() {
    return html`
      <div class="view">
        <div class="view__header">
          <h1 class="view__title">${msg('Agents')}</h1>
          ${
            this._canEdit
              ? html`
                <button class="view__create-btn" @click=${this._handleCreateClick}>
                  ${msg('+ Create Agent')}
                </button>
              `
              : nothing
          }
        </div>

        <velg-filter-bar
          .filters=${this._filterConfigs}
          search-placeholder=${msg('Search agents...')}
          @filter-change=${this._handleFilterChange}
        ></velg-filter-bar>

        ${this._renderContent()}

        <velg-pagination
          .total=${this._total}
          .limit=${this._limit}
          .offset=${this._offset}
          @page-change=${this._handlePageChange}
        ></velg-pagination>
      </div>

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
        @panel-close=${this._handleDetailsPanelClose}
        @agent-edit=${this._handleAgentEdit}
        @agent-delete=${this._handleAgentDelete}
      ></velg-agent-details-panel>
    `;
  }

  private _renderContent() {
    if (this._loading) {
      return html`<velg-loading-state message=${msg('Loading agents...')}></velg-loading-state>`;
    }

    if (this._error) {
      return html`
        <velg-error-state
          message=${this._error}
          show-retry
          @retry=${this._handleRetry}
        ></velg-error-state>
      `;
    }

    if (this._agents.length === 0) {
      return html`
        <velg-empty-state
          message=${msg('No agents found.')}
          cta-label=${this._canEdit ? msg('Create First Agent') : ''}
          @cta-click=${this._handleEmptyCta}
        ></velg-empty-state>
      `;
    }

    return html`
      <span class="view__count">${msg(str`${this._total} Agent${this._total !== 1 ? 's' : ''}`)}</span>
      <div class="view__grid">
        ${this._agents.map(
          (agent, i) => html`
            <velg-agent-card
              style="--i: ${i}"
              .agent=${agent}
              @agent-click=${this._handleAgentClick}
              @agent-edit=${this._handleAgentEdit}
              @agent-delete=${this._handleAgentDelete}
            ></velg-agent-card>
          `,
        )}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-agents-view': VelgAgentsView;
  }
}

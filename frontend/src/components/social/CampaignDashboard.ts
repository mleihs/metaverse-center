import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { campaignsApi } from '../../services/api/index.js';
import type { Campaign } from '../../types/index.js';

import { gridLayoutStyles } from '../shared/grid-layout-styles.js';
import '../shared/LoadingState.js';
import '../shared/ErrorState.js';
import '../shared/EmptyState.js';
import '../shared/Pagination.js';
import './CampaignCard.js';
import './CampaignAnalyticsPanel.js';

@localized()
@customElement('velg-campaign-dashboard')
export class VelgCampaignDashboard extends LitElement {
  static styles = [
    gridLayoutStyles,
    css`
    :host { display: block; }
    .campaigns { display: flex; flex-direction: column; gap: var(--space-4); }
    .campaigns__header { display: flex; align-items: center; justify-content: space-between; }
    .campaigns__title { font-family: var(--font-brutalist); font-weight: var(--font-black); font-size: var(--text-2xl); text-transform: uppercase; letter-spacing: var(--tracking-brutalist); margin: 0; }
    .entity-grid { --grid-min-width: 260px; }
  `,
  ];

  @property({ type: String }) simulationId = '';
  @state() private _campaigns: Campaign[] = [];
  @state() private _loading = false;
  @state() private _error: string | null = null;
  @state() private _total = 0;
  @state() private _page = 1;
  @state() private _pageSize = 25;
  @state() private _selectedCampaignId: string | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    if (this.simulationId) {
      this._loadCampaigns();
    }
  }

  protected willUpdate(changedProperties: Map<PropertyKey, unknown>): void {
    if (changedProperties.has('simulationId') && this.simulationId) {
      this._loadCampaigns();
    }
  }

  private async _loadCampaigns(): Promise<void> {
    this._loading = true;
    this._error = null;
    const params: Record<string, string> = {
      limit: String(this._pageSize),
      offset: String((this._page - 1) * this._pageSize),
    };
    const response = await campaignsApi.list(this.simulationId, params);
    if (response.success && response.data) {
      this._campaigns = Array.isArray(response.data) ? response.data : [];
      this._total = response.meta?.total ?? this._campaigns.length;
    } else {
      this._error = response.error?.message || msg('Failed to load campaigns');
    }
    this._loading = false;
  }

  private _handlePageChange(e: CustomEvent<{ page: number }>): void {
    this._page = e.detail.page;
    this._loadCampaigns();
  }

  protected render() {
    return html`
      <div class="campaigns">
        <div class="campaigns__header">
          <h1 class="campaigns__title">${msg('Campaigns')}</h1>
        </div>

        ${this._loading ? html`<velg-loading-state message=${msg('Loading campaigns...')}></velg-loading-state>` : ''}
        ${this._error ? html`<velg-error-state message=${this._error} @retry=${this._loadCampaigns}></velg-error-state>` : ''}
        ${!this._loading && !this._error && this._campaigns.length === 0 ? html`<velg-empty-state message=${msg('No campaigns yet')}></velg-empty-state>` : ''}

        ${this._selectedCampaignId
          ? html`
            <button @click=${() => { this._selectedCampaignId = null; }} style="background:none;border:none;color:var(--color-primary);cursor:pointer;font-size:var(--text-sm);padding:0;">&larr; ${msg('Back to campaigns')}</button>
            <velg-campaign-analytics-panel .simulationId=${this.simulationId} .campaignId=${this._selectedCampaignId}></velg-campaign-analytics-panel>
          `
          : ''}

        ${
          !this._loading && !this._selectedCampaignId && this._campaigns.length > 0
            ? html`
          <div class="entity-grid">
            ${this._campaigns.map((c, i) => html`<velg-campaign-card style="--i: ${i}" .campaign=${c} .simulationId=${this.simulationId} @click=${() => { this._selectedCampaignId = c.id; }}></velg-campaign-card>`)}
          </div>
          <velg-pagination .currentPage=${this._page} .totalItems=${this._total} .pageSize=${this._pageSize} @page-change=${this._handlePageChange}></velg-pagination>
        `
            : ''
        }
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-campaign-dashboard': VelgCampaignDashboard;
  }
}

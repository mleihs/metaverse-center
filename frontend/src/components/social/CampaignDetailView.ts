import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { campaignsApi } from '../../services/api/index.js';
import type { Campaign, CampaignEvent, CampaignMetric } from '../../types/index.js';

import '../shared/LoadingState.js';

@localized()
@customElement('velg-campaign-detail-view')
export class VelgCampaignDetailView extends LitElement {
  static styles = css`
    :host { display: block; }
    .detail { display: flex; flex-direction: column; gap: var(--space-4); }
    .detail__header { display: flex; align-items: center; justify-content: space-between; }
    .detail__title { font-family: var(--font-brutalist); font-weight: var(--font-black); font-size: var(--text-xl); text-transform: uppercase; letter-spacing: var(--tracking-brutalist); margin: 0; }
    .detail__back {
      padding: var(--space-2) var(--space-4); font-family: var(--font-brutalist);
      font-weight: var(--font-bold); font-size: var(--text-sm); text-transform: uppercase;
      background: var(--color-surface-raised); border: var(--border-default);
      cursor: pointer; transition: all var(--transition-fast);
    }
    .detail__back:hover { background: var(--color-surface-header); }
    .detail__section-title { font-family: var(--font-brutalist); font-weight: var(--font-bold); font-size: var(--text-lg); text-transform: uppercase; letter-spacing: var(--tracking-wide); margin: 0; }
    .detail__description { font-size: var(--text-base); color: var(--color-text-secondary); line-height: var(--leading-relaxed); }
    .detail__events { display: flex; flex-direction: column; gap: var(--space-2); }
    .detail__event-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: var(--space-2) var(--space-3); background: var(--color-surface-raised);
      border: var(--border-width-thin) solid var(--color-border-light);
    }
    .detail__metrics { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: var(--space-3); }
    .detail__metric {
      padding: var(--space-3); background: var(--color-surface-raised);
      border: var(--border-default); text-align: center;
    }
    .detail__metric-value { font-family: var(--font-brutalist); font-weight: var(--font-black); font-size: var(--text-2xl); }
    .detail__metric-label { font-size: var(--text-sm); color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: var(--tracking-wide); }
  `;

  @property({ type: String }) simulationId = '';
  @property({ type: String }) campaignId = '';
  @state() private _campaign: Campaign | null = null;
  @state() private _events: CampaignEvent[] = [];
  @state() private _metrics: CampaignMetric[] = [];
  @state() private _loading = false;

  connectedCallback(): void {
    super.connectedCallback();
    this._loadData();
  }

  private async _loadData(): Promise<void> {
    this._loading = true;
    const [campaignRes, eventsRes, metricsRes] = await Promise.all([
      campaignsApi.getById(this.simulationId, this.campaignId),
      campaignsApi.getEvents(this.simulationId, this.campaignId),
      campaignsApi.getMetrics(this.simulationId, this.campaignId),
    ]);

    if (campaignRes.success) this._campaign = campaignRes.data ?? null;
    if (eventsRes.success) this._events = eventsRes.data ?? [];
    if (metricsRes.success) this._metrics = metricsRes.data ?? [];
    this._loading = false;
  }

  private _handleBack(): void {
    this.dispatchEvent(new CustomEvent('back', { bubbles: true, composed: true }));
  }

  protected render() {
    if (this._loading)
      return html`<velg-loading-state message=${msg('Loading campaign...')}></velg-loading-state>`;
    if (!this._campaign) return html``;

    return html`
      <div class="detail">
        <div class="detail__header">
          <h2 class="detail__title">${this._campaign.title}</h2>
          <button class="detail__back" @click=${this._handleBack}>${msg('Back')}</button>
        </div>

        ${this._campaign.description ? html`<p class="detail__description">${this._campaign.description}</p>` : ''}

        <h3 class="detail__section-title">${msg(str`Events (${this._events.length})`)}</h3>
        <div class="detail__events">
          ${this._events.length === 0 ? html`<p style="color: var(--color-text-secondary)">${msg('No events linked.')}</p>` : ''}
          ${this._events.map(
            (e) => html`
            <div class="detail__event-row">
              <span>${(e as CampaignEvent & { events?: { title: string } }).events?.title || e.event_id}</span>
              <span>${e.integration_status}</span>
            </div>
          `,
          )}
        </div>

        <h3 class="detail__section-title">${msg(str`Metrics (${this._metrics.length})`)}</h3>
        <div class="detail__metrics">
          ${this._metrics.length === 0 ? html`<p style="color: var(--color-text-secondary)">${msg('No metrics yet.')}</p>` : ''}
          ${this._metrics.map(
            (m) => html`
            <div class="detail__metric">
              <div class="detail__metric-value">${m.metric_value}</div>
              <div class="detail__metric-label">${m.metric_name}</div>
            </div>
          `,
          )}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-campaign-detail-view': VelgCampaignDetailView;
  }
}

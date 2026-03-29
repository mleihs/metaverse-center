import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { type AIUsageStats, adminApi } from '../../services/api/AdminApiService.js';
import { adminAnimationStyles, adminForgeSectionStyles, adminLoadingStyles } from './admin-shared-styles.js';
import '../shared/VelgMetricCard.js';

/**
 * AdminAIUsageTab -- AI cost visibility dashboard.
 *
 * Displays aggregated usage stats from ai_usage_log (migration 150):
 * total calls, tokens, estimated cost, breakdowns by model/purpose/provider.
 */
@localized()
@customElement('velg-admin-ai-usage-tab')
export class VelgAdminAIUsageTab extends LitElement {
  static styles = [
    adminAnimationStyles,
    adminForgeSectionStyles,
    adminLoadingStyles,
    css`
      .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: var(--space-3);
      }

      .breakdown-table {
        width: 100%;
        border-collapse: collapse;
        font-size: var(--text-sm);
      }

      .breakdown-table th {
        text-align: left;
        color: var(--color-text-secondary);
        font-weight: 500;
        padding: var(--space-2) var(--space-3);
        border-bottom: 1px solid var(--color-border);
        text-transform: uppercase;
        font-size: var(--text-xs);
        letter-spacing: 0.05em;
      }

      .breakdown-table td {
        padding: var(--space-2) var(--space-3);
        border-bottom: 1px solid color-mix(in srgb, var(--color-border) 50%, transparent);
      }

      .breakdown-table td.num {
        text-align: right;
        font-variant-numeric: tabular-nums;
      }

      .period-select {
        background: var(--color-surface-elevated);
        color: var(--color-text-primary);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        padding: var(--space-1) var(--space-2);
        font-family: inherit;
        font-size: var(--text-sm);
      }

      .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .two-col {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--space-6);
      }

      @media (max-width: 900px) {
        .two-col { grid-template-columns: 1fr; }
      }

      .empty-state {
        color: var(--color-text-secondary);
        text-align: center;
        padding: var(--space-8);
        font-style: italic;
      }
    `,
  ];

  @state() private _stats: AIUsageStats | null = null;
  @state() private _loading = true;
  @state() private _days = 30;

  async connectedCallback() {
    super.connectedCallback();
    await this._loadData();
  }

  private async _loadData() {
    this._loading = true;
    const result = await adminApi.getAIUsageStats(this._days);
    if (result.success && result.data) {
      this._stats = result.data;
    }
    this._loading = false;
  }

  private async _onPeriodChange(e: Event) {
    this._days = Number((e.target as HTMLSelectElement).value);
    await this._loadData();
  }

  protected render() {
    if (this._loading) {
      return html`<div class="admin-loading">${msg('Loading AI usage data...')}</div>`;
    }

    const s = this._stats;
    if (!s || s.total_calls === 0) {
      return html`<div class="empty-state">${msg('No AI usage data recorded yet. Usage tracking starts when ai_usage_log receives its first entry.')}</div>`;
    }

    return html`
      <div class="forge-admin">
        <div class="forge-section">
          <div class="section-header">
            <h3 class="forge-section__title">${msg('AI Usage Overview')}</h3>
            <select class="period-select" @change=${this._onPeriodChange}>
              <option value="7" ?selected=${this._days === 7}>7 ${msg('days')}</option>
              <option value="30" ?selected=${this._days === 30}>30 ${msg('days')}</option>
              <option value="90" ?selected=${this._days === 90}>90 ${msg('days')}</option>
            </select>
          </div>
          <div class="stats-grid">
            <velg-metric-card label=${msg('Total Calls')} value=${s.total_calls.toLocaleString()}></velg-metric-card>
            <velg-metric-card label=${msg('Total Tokens')} value=${this._formatTokens(s.total_tokens)}></velg-metric-card>
            <velg-metric-card label=${msg('Est. Cost')} value=${`$${s.total_cost_usd.toFixed(2)}`} variant="warning"></velg-metric-card>
            <velg-metric-card label=${msg('Avg/Call')} value=${`$${s.avg_cost_per_call.toFixed(4)}`}></velg-metric-card>
          </div>
        </div>

        <div class="two-col">
          <div class="forge-section">
            <h3 class="forge-section__title">${msg('By Model')}</h3>
            ${this._renderBreakdownTable(s.by_model, 'model')}
          </div>
          <div class="forge-section">
            <h3 class="forge-section__title">${msg('By Purpose')}</h3>
            ${this._renderBreakdownTable(s.by_purpose, 'purpose')}
          </div>
        </div>

        <div class="two-col">
          <div class="forge-section">
            <h3 class="forge-section__title">${msg('By Provider')}</h3>
            ${this._renderBreakdownTable(s.by_provider, 'provider')}
          </div>
          <div class="forge-section">
            <h3 class="forge-section__title">${msg('Key Sources')}</h3>
            ${this._renderKeySourcesTable(s.key_sources)}
          </div>
        </div>

        ${s.daily_trend.length > 0 ? html`
          <div class="forge-section">
            <h3 class="forge-section__title">${msg('Daily Trend')}</h3>
            ${this._renderDailyTable(s.daily_trend)}
          </div>
        ` : nothing}
      </div>
    `;
  }



  private _formatTokens(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return n.toLocaleString();
  }

  private _renderBreakdownTable(
    items: { calls: number; tokens: number; cost: number }[],
    keyField: string,
  ) {
    if (!items.length) return html`<p class="empty-state">${msg('No data')}</p>`;
    return html`
      <table class="breakdown-table">
        <thead>
          <tr>
            <th scope="col">${keyField}</th>
            <th scope="col">${msg('Calls')}</th>
            <th scope="col">${msg('Tokens')}</th>
            <th scope="col">${msg('Cost')}</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((item) => html`
            <tr>
              <td>${(item as Record<string, unknown>)[keyField]}</td>
              <td class="num">${item.calls.toLocaleString()}</td>
              <td class="num">${this._formatTokens(item.tokens)}</td>
              <td class="num">$${item.cost.toFixed(4)}</td>
            </tr>
          `)}
        </tbody>
      </table>
    `;
  }

  private _renderKeySourcesTable(sources: Record<string, { calls: number; tokens: number; cost: number }>) {
    const entries = Object.entries(sources);
    if (!entries.length) return html`<p class="empty-state">${msg('No data')}</p>`;
    return html`
      <table class="breakdown-table">
        <thead>
          <tr>
            <th scope="col">${msg('Source')}</th>
            <th scope="col">${msg('Calls')}</th>
            <th scope="col">${msg('Cost')}</th>
          </tr>
        </thead>
        <tbody>
          ${entries.map(([source, data]) => html`
            <tr>
              <td>${source}</td>
              <td class="num">${data.calls.toLocaleString()}</td>
              <td class="num">$${data.cost.toFixed(4)}</td>
            </tr>
          `)}
        </tbody>
      </table>
    `;
  }

  private _renderDailyTable(trend: { date: string; calls: number; tokens: number; cost: number }[]) {
    const recent = trend.slice(-14);  // Last 14 days
    return html`
      <table class="breakdown-table">
        <thead>
          <tr>
            <th scope="col">${msg('Date')}</th>
            <th scope="col">${msg('Calls')}</th>
            <th scope="col">${msg('Tokens')}</th>
            <th scope="col">${msg('Cost')}</th>
          </tr>
        </thead>
        <tbody>
          ${recent.map((day) => html`
            <tr>
              <td>${day.date}</td>
              <td class="num">${day.calls.toLocaleString()}</td>
              <td class="num">${this._formatTokens(day.tokens)}</td>
              <td class="num">$${day.cost.toFixed(4)}</td>
            </tr>
          `)}
        </tbody>
      </table>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-admin-ai-usage-tab': VelgAdminAIUsageTab;
  }
}

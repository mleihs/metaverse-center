import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { type AIUsageStats, adminApi } from '../../services/api/AdminApiService.js';
import { formatAmount, formatCount } from '../../utils/kontor-format.js';
import {
  adminAnimationStyles,
  adminForgeSectionStyles,
  adminLoadingStyles,
} from '../shared/admin-shared-styles.js';
import '../shared/VelgMetricCard.js';

/**
 * AdminAIUsageTab -- AI cost visibility dashboard.
 *
 * Displays aggregated usage stats from ai_usage_log (migration 150):
 * total calls, tokens, estimated cost, breakdowns by model/purpose/provider.
 *
 * ── ZWEI KORREKTUREN AM 05.09.2026 ─────────────────────────────────────────
 *
 * 1. **Der Mittelwert traegt seine Zaehlbasis.** Bis Migration 389 stand hier
 *    `avg_cost_per_call.toFixed(4)` ueber einer RPC, die die Summe durch JEDEN
 *    beantworteten Aufruf teilte -- auch durch die 204 von 1 644, die keinen
 *    Betrag tragen. Der angezeigte Wert war dadurch 14,2 % zu niedrig, und die
 *    Summe daneben stimmte die ganze Zeit. Genau deshalb hat es niemand
 *    bemerkt: es gab keine Zahl, die widersprach.
 *
 * 2. **Kein `toFixed` mehr.** `toFixed(4)` zeigt unseren kleinsten gemessenen
 *    Betrag ($0.000012) als `$0.0000` -- eine Null, die keine ist. Die
 *    Betraege laufen jetzt durch `formatAmount` aus `utils/kontor-format.ts`,
 *    dieselbe Funktion wie im Kostenpanel: Rundung nach Groessenordnung,
 *    fester Formatierer, und ein `·` statt einer erfundenen Null.
 *    `toLocaleString()` ist aus demselben Grund weg -- es tauscht mit der
 *    UI-Sprache die Trennzeichen und damit die Zeichenbreiten.
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
        text-transform: var(--label-transform);
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
        <div class="forge-section marker-corners">
          <div class="section-header">
            <h3 class="forge-section__title">${msg('AI Usage Overview')}</h3>
            <select class="period-select" @change=${this._onPeriodChange}>
              <option value="7" ?selected=${this._days === 7}>7 ${msg('days')}</option>
              <option value="30" ?selected=${this._days === 30}>30 ${msg('days')}</option>
              <option value="90" ?selected=${this._days === 90}>90 ${msg('days')}</option>
            </select>
          </div>
          <div class="stats-grid">
            <velg-metric-card label=${msg('Total Calls')} value=${formatCount(s.total_calls)}></velg-metric-card>
            <velg-metric-card label=${msg('Total Tokens')} value=${this._formatTokens(s.total_tokens)}></velg-metric-card>
            <velg-metric-card
              label=${msg('Est. Cost')}
              value=${formatAmount(s.total_cost_usd).text}
              variant="warning"
            ></velg-metric-card>
            <velg-metric-card
              label=${msg('Avg/Call')}
              value=${formatAmount(s.avg_cost_per_call).text}
              sublabel=${this._basisLabel(s)}
            ></velg-metric-card>
          </div>
        </div>

        <div class="two-col">
          <div class="forge-section marker-corners">
            <h3 class="forge-section__title">${msg('By Model')}</h3>
            ${this._renderBreakdownTable(s.by_model, 'model')}
          </div>
          <div class="forge-section marker-corners">
            <h3 class="forge-section__title">${msg('By Purpose')}</h3>
            ${this._renderBreakdownTable(s.by_purpose, 'purpose')}
          </div>
        </div>

        <div class="two-col">
          <div class="forge-section marker-corners">
            <h3 class="forge-section__title">${msg('By Provider')}</h3>
            ${this._renderBreakdownTable(s.by_provider, 'provider')}
          </div>
          <div class="forge-section marker-corners">
            <h3 class="forge-section__title">${msg('Key Sources')}</h3>
            ${this._renderKeySourcesTable(s.key_sources)}
          </div>
        </div>

        ${
          s.daily_trend.length > 0
            ? html`
          <div class="forge-section marker-corners">
            <h3 class="forge-section__title">${msg('Daily Trend')}</h3>
            ${this._renderDailyTable(s.daily_trend)}
          </div>
        `
            : nothing
        }
      </div>
    `;
  }

  private _formatTokens(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    // formatCount statt toLocaleString: derselbe feste Formatierer wie in
    // jeder anderen Zahlenspalte. Eine Tokenzahl, die im Deutschen 15.044.505
    // und im Englischen 15,044,505 heisst, wechselt mit der Sprache ihre
    // Zeichenbreite -- und die Spalte darunter ist tabular-nums.
    return formatCount(n);
  }

  /**
   * Die Zaehlbasis unter dem Mittelwert.
   *
   * Sie ist keine Verzierung: der Mittelwert IST die Summe geteilt durch
   * genau diese Zahl. Ein Mittelwert ohne sie ist eine Behauptung -- und
   * dieser hier war ueber ein Jahr lang die falsche (Migration 389).
   *
   * `avg_cost_basis === 0` heisst „nicht ausgesagt" und nicht „null Zeilen
   * haben beigetragen": eine Datenbank, die Migration 389 noch nicht gesehen
   * hat, liefert das Feld gar nicht. Dann steht hier nichts, statt eine Basis
   * von null zu behaupten.
   */
  private _basisLabel(s: AIUsageStats): string {
    if (!s.avg_cost_basis || !s.avg_cost_of) return '';
    const n = formatCount(s.avg_cost_basis);
    const of = formatCount(s.avg_cost_of);
    return msg(str`n = ${n} of ${of}`);
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
          ${items.map(
            (item) => html`
            <tr>
              <td>${(item as Record<string, unknown>)[keyField]}</td>
              <td class="num">${formatCount(item.calls)}</td>
              <td class="num">${this._formatTokens(item.tokens)}</td>
              <td class="num">${formatAmount(item.cost).text}</td>
            </tr>
          `,
          )}
        </tbody>
      </table>
    `;
  }

  private _renderKeySourcesTable(
    sources: Record<string, { calls: number; tokens: number; cost: number }>,
  ) {
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
          ${entries.map(
            ([source, data]) => html`
            <tr>
              <td>${source}</td>
              <td class="num">${formatCount(data.calls)}</td>
              <td class="num">${formatAmount(data.cost).text}</td>
            </tr>
          `,
          )}
        </tbody>
      </table>
    `;
  }

  /**
   * ⚠ Der Parameter nimmt jetzt den TYP DES DTO, keine eigene Nachbildung.
   *
   * Hier stand `{ date: string; ... }` -- eine zweite, von Hand gepflegte
   * Fassung derselben Form. Die RPC schreibt aber `day` (Migration 152), und
   * so las die Zelle darunter `day.date`: leer, ohne Fehlermeldung, seit es
   * die Tabelle gibt. Eine lokale Nachbildung eines DTO ist genau der Ort, an
   * dem eine Fehlbenennung ueberlebt -- der Typpruefer kann zwei Wahrheiten
   * nicht gegeneinander halten, wenn er beide glaubt.
   */
  private _renderDailyTable(trend: AIUsageStats['daily_trend']) {
    const recent = trend.slice(-14); // Last 14 days
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
          ${recent.map(
            (day) => html`
            <tr>
              <td>${day.day}</td>
              <td class="num">${formatCount(day.calls)}</td>
              <td class="num">${this._formatTokens(day.tokens)}</td>
              <td class="num">${formatAmount(day.cost).text}</td>
            </tr>
          `,
          )}
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

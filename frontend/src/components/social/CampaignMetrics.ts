import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { CampaignMetric } from '../../types/index.js';

@localized()
@customElement('velg-campaign-metrics')
export class VelgCampaignMetrics extends LitElement {
  static styles = css`
    :host { display: block; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: var(--space-3); }
    .metric {
      padding: var(--space-3); background: var(--color-surface-raised);
      border: var(--border-default); text-align: center;
    }
    .metric__value { font-family: var(--font-brutalist); font-weight: var(--font-black); font-size: var(--text-xl); }
    .metric__label { font-size: var(--text-xs); color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: var(--tracking-wide); margin-top: var(--space-1); }
  `;

  @property({ type: Array }) metrics: CampaignMetric[] = [];

  protected render() {
    if (!this.metrics.length)
      return html`<p style="color: var(--color-text-secondary)">${msg('No metrics available')}</p>`;

    return html`
      <div class="metrics">
        ${this.metrics.map(
          (m) => html`
          <div class="metric">
            <div class="metric__value">${m.metric_value}</div>
            <div class="metric__label">${m.metric_name}</div>
          </div>
        `,
        )}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-campaign-metrics': VelgCampaignMetrics;
  }
}

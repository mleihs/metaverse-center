import { localized, msg } from '@lit/localize';
import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import type { FilterChangeDetail } from '../shared/SharedFilterBar.js';

import '../shared/SharedFilterBar.js';

@localized()
@customElement('velg-trend-filter-bar')
export class VelgTrendFilterBar extends LitElement {
  private _handleChange(e: CustomEvent<FilterChangeDetail>): void {
    this.dispatchEvent(
      new CustomEvent('filter-change', { detail: e.detail, bubbles: true, composed: true }),
    );
  }

  protected render() {
    return html`
      <velg-filter-bar
        .filters=${[
          {
            key: 'platform',
            label: msg('Platform'),
            type: 'select' as const,
            options: [
              { value: 'guardian', label: msg('Guardian') },
              { value: 'newsapi', label: msg('NewsAPI') },
            ],
          },
          {
            key: 'sentiment',
            label: msg('Sentiment'),
            type: 'select' as const,
            options: [
              { value: 'positive', label: msg('Positive') },
              { value: 'negative', label: msg('Negative') },
              { value: 'neutral', label: msg('Neutral') },
            ],
          },
          {
            key: 'is_processed',
            label: msg('Processed'),
            type: 'select' as const,
            options: [
              { value: 'true', label: msg('Yes') },
              { value: 'false', label: msg('No') },
            ],
          },
        ]}
        @filter-change=${this._handleChange}
      ></velg-filter-bar>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-trend-filter-bar': VelgTrendFilterBar;
  }
}

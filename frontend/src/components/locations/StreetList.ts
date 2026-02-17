import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { CityStreet } from '../../types/index.js';

@localized()
@customElement('velg-street-list')
export class VelgStreetList extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .list {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--color-surface-raised);
      border: var(--border-default);
      padding: var(--space-3) var(--space-4);
      transition: all var(--transition-fast);
    }

    .item:hover {
      background: var(--color-surface-header);
    }

    .item__name {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-base);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
    }

    .item__meta {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }

    .item__badge {
      display: inline-flex;
      padding: var(--space-0-5) var(--space-2);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      background: var(--color-primary-bg);
      border: var(--border-width-default) solid var(--color-primary);
      color: var(--color-primary);
    }

    .item__length {
      font-size: var(--text-sm);
      color: var(--color-text-muted);
    }
  `;

  @property({ attribute: false }) streets: CityStreet[] = [];

  protected render() {
    return html`
      <div class="list">
        ${this.streets.map(
          (street) => html`
            <div class="item">
              <span class="item__name">${street.name ?? msg('Unnamed Street')}</span>
              <div class="item__meta">
                ${
                  street.street_type
                    ? html`<span class="item__badge">${street.street_type}</span>`
                    : nothing
                }
                ${
                  street.length_km
                    ? html`<span class="item__length">${street.length_km} km</span>`
                    : nothing
                }
              </div>
            </div>
          `,
        )}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-street-list': VelgStreetList;
  }
}

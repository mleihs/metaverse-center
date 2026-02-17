import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { City } from '../../types/index.js';

@localized()
@customElement('velg-city-list')
export class VelgCityList extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: var(--space-4);
    }

    .item {
      background: var(--color-surface-raised);
      border: var(--border-default);
      box-shadow: var(--shadow-md);
      padding: var(--space-4);
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .item:hover {
      transform: translate(-2px, -2px);
      box-shadow: var(--shadow-lg);
    }

    .item:active {
      transform: translate(0);
      box-shadow: var(--shadow-pressed);
    }

    .item__name {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-lg);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      margin: 0 0 var(--space-2);
    }

    .item__description {
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
      line-height: var(--leading-snug);
      margin-bottom: var(--space-2);
    }

    .item__meta {
      font-size: var(--text-sm);
      color: var(--color-text-muted);
    }

    .item__footer {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin-top: var(--space-3);
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
  `;

  @property({ attribute: false }) cities: City[] = [];

  private _handleSelect(city: City): void {
    this.dispatchEvent(
      new CustomEvent('city-select', {
        detail: city,
        bubbles: true,
        composed: true,
      }),
    );
  }

  protected render() {
    return html`
      <div class="list">
        ${this.cities.map(
          (city) => html`
            <div class="item" @click=${() => this._handleSelect(city)}>
              <h3 class="item__name">${city.name}</h3>
              ${
                city.description
                  ? html`<div class="item__description">${city.description}</div>`
                  : nothing
              }
              ${
                city.population
                  ? html`<div class="item__meta">${msg(str`Population: ${city.population.toLocaleString()}`)}</div>`
                  : nothing
              }
              <div class="item__footer">
                ${
                  city.layout_type
                    ? html`<span class="item__badge">${city.layout_type}</span>`
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
    'velg-city-list': VelgCityList;
  }
}

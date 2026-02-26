import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { Simulation, SimulationTheme } from '../../types/index.js';
import '../shared/VelgBadge.js';

const THEME_COLORS: Record<SimulationTheme, string> = {
  dystopian: '#ef4444',
  fantasy: '#f59e0b',
  utopian: '#22c55e',
  scifi: '#06b6d4',
  historical: '#a78bfa',
  custom: '#a855f7',
};

@localized()
@customElement('velg-simulation-card')
export class VelgSimulationCard extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .shard {
      position: relative;
      min-height: 280px;
      border: 2px solid var(--color-gray-700);
      box-shadow: 4px 4px 0 rgba(0, 0, 0, 0.4);
      border-radius: var(--border-radius);
      overflow: hidden;
      cursor: pointer;
      transition: all var(--transition-normal);
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      text-decoration: none;
      color: inherit;
    }

    .shard:hover {
      transform: translate(-2px, -2px);
      box-shadow: 6px 6px 0 rgba(0, 0, 0, 0.5);
      border-color: var(--color-gray-500);
    }

    .shard:hover .shard__bleed {
      opacity: 1;
    }

    .shard:hover .shard__image {
      filter: brightness(0.5);
      transform: scale(1.03);
    }

    .shard:active {
      transform: translate(0);
      box-shadow: 2px 2px 0 rgba(0, 0, 0, 0.3);
    }

    .shard__image {
      position: absolute;
      inset: 0;
      background-size: cover;
      background-position: center;
      filter: brightness(0.4);
      transition: all var(--transition-slow);
    }

    .shard__placeholder {
      position: absolute;
      inset: 0;
      background: var(--color-gray-900);
    }

    .shard__placeholder::after {
      content: '';
      position: absolute;
      inset: 0;
      opacity: 0.15;
      background: repeating-linear-gradient(
        45deg,
        transparent,
        transparent 20px,
        var(--shard-color, #888) 20px,
        var(--shard-color, #888) 21px
      );
    }

    .shard__overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(
        to top,
        rgba(0, 0, 0, 0.92) 0%,
        rgba(0, 0, 0, 0.5) 50%,
        transparent 100%
      );
    }

    .shard__content {
      position: relative;
      z-index: 1;
      padding: var(--space-4) var(--space-5);
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }

    .shard__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2);
    }

    .shard__name {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-lg);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: #fff;
      margin: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    velg-badge {
      flex-shrink: 0;
    }

    .shard__description {
      font-size: var(--text-sm);
      color: rgba(255, 255, 255, 0.7);
      line-height: var(--leading-relaxed);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      margin: 0;
    }

    .shard__stats {
      display: flex;
      gap: var(--space-4);
      padding-top: var(--space-2);
      border-top: 1px solid rgba(255, 255, 255, 0.15);
    }

    .shard__stat {
      display: flex;
      align-items: baseline;
      gap: var(--space-1);
    }

    .shard__stat-value {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-md);
      color: #fff;
    }

    .shard__stat-label {
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: rgba(255, 255, 255, 0.5);
    }

    .shard__enter {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wider);
      color: var(--shard-color, rgba(255, 255, 255, 0.6));
      align-self: flex-end;
      opacity: 0;
      transform: translateY(4px);
      transition: all var(--transition-normal);
    }

    .shard:hover .shard__enter {
      opacity: 1;
      transform: translateY(0);
    }

    .shard__bleed {
      position: absolute;
      inset: 0;
      border: 2px solid var(--shard-color, #888);
      border-radius: var(--border-radius);
      box-shadow:
        inset 0 0 20px var(--shard-color-alpha, rgba(136, 136, 136, 0.2)),
        0 0 15px var(--shard-color-alpha, rgba(136, 136, 136, 0.15));
      opacity: 0;
      transition: opacity var(--transition-normal);
      pointer-events: none;
      z-index: 2;
    }
  `;

  @property({ type: Object }) simulation!: Simulation;

  private _handleClick(e: Event): void {
    e.preventDefault();
    this.dispatchEvent(
      new CustomEvent('simulation-click', {
        detail: this.simulation,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _getThemeVariant(theme: SimulationTheme): string {
    const map: Record<string, string> = {
      dystopian: 'danger',
      fantasy: 'warning',
      utopian: 'success',
      scifi: 'info',
      historical: 'default',
      custom: 'primary',
    };
    return map[theme] ?? 'default';
  }

  protected render() {
    const sim = this.simulation;
    if (!sim) return html``;

    const color = THEME_COLORS[sim.theme] ?? '#888';
    const colorAlpha = `${color}33`;

    return html`
      <a
        href="/simulations/${sim.id}/lore"
        class="shard"
        style="--shard-color: ${color}; --shard-color-alpha: ${colorAlpha}"
        @click=${this._handleClick}
      >
        ${
          sim.banner_url
            ? html`<div class="shard__image" style="background-image: url(${sim.banner_url})" role="img" aria-label="${sim.name} — ${sim.description ?? sim.theme}"></div>`
            : html`<div class="shard__placeholder"></div>`
        }
        <div class="shard__overlay"></div>

        <div class="shard__content">
          <div class="shard__header">
            <h3 class="shard__name">${sim.name}</h3>
            <velg-badge variant=${this._getThemeVariant(sim.theme)}>
              ${sim.theme}
            </velg-badge>
          </div>

          ${sim.description ? html`<p class="shard__description">${sim.description}</p>` : null}

          <div class="shard__stats">
            <div class="shard__stat">
              <span class="shard__stat-value">${sim.agent_count ?? 0}</span>
              <span class="shard__stat-label">${msg('Agents')}</span>
            </div>
            <div class="shard__stat">
              <span class="shard__stat-value">${sim.building_count ?? 0}</span>
              <span class="shard__stat-label">${msg('Buildings')}</span>
            </div>
            <div class="shard__stat">
              <span class="shard__stat-value">${sim.event_count ?? 0}</span>
              <span class="shard__stat-label">${msg('Events')}</span>
            </div>
          </div>

          <span class="shard__enter">${msg('Enter Shard')}&ensp;&rarr;</span>
        </div>

        <div class="shard__bleed"></div>
      </a>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-simulation-card': VelgSimulationCard;
  }
}

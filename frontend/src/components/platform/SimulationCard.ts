import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { Simulation } from '../../types/index.js';
import '../shared/VelgBadge.js';

@localized()
@customElement('velg-simulation-card')
export class VelgSimulationCard extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .card {
      background: var(--color-surface-raised);
      border: var(--border-default);
      box-shadow: var(--shadow-md);
      border-radius: var(--border-radius);
      overflow: hidden;
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .card:hover {
      transform: translate(-2px, -2px);
      box-shadow: var(--shadow-lg);
    }

    .card:active {
      transform: translate(0);
      box-shadow: var(--shadow-pressed);
    }

    .card__header {
      padding: var(--space-3) var(--space-4);
      background: var(--color-surface-header);
      border-bottom: var(--border-medium);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .card__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      text-transform: uppercase;
      font-size: var(--text-md);
      letter-spacing: var(--tracking-brutalist);
      margin: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    velg-badge {
      flex-shrink: 0;
    }

    .card__body {
      padding: var(--space-4);
    }

    .card__theme {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-secondary);
      margin-bottom: var(--space-2);
    }

    .card__description {
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
      line-height: var(--leading-relaxed);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      margin-bottom: var(--space-4);
    }

    .card__stats {
      display: flex;
      gap: var(--space-4);
      border-top: var(--border-light);
      padding-top: var(--space-3);
    }

    .card__stat {
      display: flex;
      flex-direction: column;
      gap: var(--space-0-5);
    }

    .card__stat-value {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-lg);
    }

    .card__stat-label {
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-muted);
    }
  `;

  @property({ type: Object }) simulation!: Simulation;

  private _handleClick(): void {
    this.dispatchEvent(
      new CustomEvent('simulation-click', {
        detail: this.simulation,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _getStatusVariant(status: string): string {
    const map: Record<string, string> = {
      active: 'success',
      draft: 'warning',
      paused: 'info',
      configuring: 'info',
    };
    return map[status] ?? 'default';
  }

  protected render() {
    const sim = this.simulation;
    if (!sim) return html``;

    return html`
      <div class="card" @click=${this._handleClick}>
        <div class="card__header">
          <h3 class="card__title">${sim.name}</h3>
          <velg-badge variant=${this._getStatusVariant(sim.status)}>
            ${sim.status}
          </velg-badge>
        </div>

        <div class="card__body">
          <div class="card__theme">${sim.theme}</div>

          ${sim.description ? html`<div class="card__description">${sim.description}</div>` : null}

          <div class="card__stats">
            <div class="card__stat">
              <span class="card__stat-value">${sim.agent_count ?? '--'}</span>
              <span class="card__stat-label">${msg('Agents')}</span>
            </div>
            <div class="card__stat">
              <span class="card__stat-value">${sim.building_count ?? '--'}</span>
              <span class="card__stat-label">${msg('Buildings')}</span>
            </div>
            <div class="card__stat">
              <span class="card__stat-value">${sim.event_count ?? '--'}</span>
              <span class="card__stat-label">${msg('Events')}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-simulation-card': VelgSimulationCard;
  }
}

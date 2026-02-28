import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';

@customElement('velg-simulation-header')
export class VelgSimulationHeader extends LitElement {
  static styles = css`
    :host {
      display: block;
      background: var(--color-surface-raised);
      border-bottom: var(--border-default);
      padding: var(--space-4) var(--space-6);
    }

    .header {
      display: flex;
      align-items: center;
      gap: var(--space-4);
    }

    .header__name {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xl);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      margin: 0;
      animation: header-name-enter 400ms var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)) both;
    }

    @keyframes header-name-enter {
      from {
        opacity: 0;
        transform: translateX(-8px);
        letter-spacing: 0.2em;
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    .header__badge {
      display: inline-flex;
      align-items: center;
      padding: var(--space-0-5) var(--space-2);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      border: var(--border-default);
      animation: badge-pop 250ms var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1)) both 150ms;
    }

    @keyframes badge-pop {
      from {
        opacity: 0;
        transform: scale(0.7);
      }
    }

    .badge--active {
      background: var(--color-success-bg);
      color: var(--color-text-success);
      border-color: var(--color-success-border);
    }

    .badge--draft {
      background: var(--color-warning-bg);
      color: var(--color-text-warning);
      border-color: var(--color-warning-border);
    }

    .badge--archived {
      background: var(--color-surface-sunken);
      color: var(--color-text-secondary);
    }

    @media (max-width: 640px) {
      :host {
        padding: var(--space-3) var(--space-4);
      }

      .header {
        gap: var(--space-2);
        flex-wrap: wrap;
      }

      .header__name {
        font-size: var(--text-lg);
      }
    }
  `;

  @property({ type: String }) simulationId = '';

  private _getBadgeClass(status: string): string {
    if (status === 'active') return 'badge--active';
    if (status === 'draft' || status === 'configuring') return 'badge--draft';
    return 'badge--archived';
  }

  protected render() {
    const sim = appState.currentSimulation.value;
    if (!sim) return html``;

    return html`
      <div class="header">
        <h2 class="header__name">${sim.name}</h2>
        <span class="header__badge ${this._getBadgeClass(sim.status)}">${sim.status}</span>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-simulation-header': VelgSimulationHeader;
  }
}

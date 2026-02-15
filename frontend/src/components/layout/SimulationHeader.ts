import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import type { Simulation } from '../../types/index.js';

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
  `;

  @property({ type: String }) simulationId = '';
  @state() private _simulation: Simulation | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this._simulation = appState.currentSimulation.value;
  }

  private _getBadgeClass(status: string): string {
    if (status === 'active') return 'badge--active';
    if (status === 'draft' || status === 'configuring') return 'badge--draft';
    return 'badge--archived';
  }

  protected render() {
    const sim = this._simulation;
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

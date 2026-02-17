import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { BaseApiService } from '../../services/api/BaseApiService.js';
import type { ApiResponse, Simulation } from '../../types/index.js';

import './SimulationCard.js';

class SimulationsApiService extends BaseApiService {
  getSimulations(): Promise<ApiResponse<Simulation[]>> {
    return this.get<Simulation[]>('/simulations');
  }
}

const simulationsApi = new SimulationsApiService();

@localized()
@customElement('velg-simulations-dashboard')
export class VelgSimulationsDashboard extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .dashboard-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--space-6);
    }

    .dashboard-title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-2xl);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      margin: 0;
    }

    .btn-create {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-4);
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      background: var(--color-primary);
      color: var(--color-text-inverse);
      border: var(--border-default);
      border-radius: var(--border-radius);
      box-shadow: var(--shadow-md);
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .btn-create:hover {
      transform: translate(-2px, -2px);
      box-shadow: var(--shadow-lg);
    }

    .btn-create:active {
      transform: translate(0);
      box-shadow: var(--shadow-pressed);
    }

    .simulations-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: var(--space-6);
    }

    .loading-state {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 40vh;
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-lg);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-secondary);
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 40vh;
      gap: var(--space-4);
      text-align: center;
    }

    .empty-state__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xl);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-primary);
    }

    .empty-state__text {
      font-size: var(--text-base);
      color: var(--color-text-secondary);
      max-width: 480px;
    }

    .error-state {
      padding: var(--space-4);
      background: var(--color-danger-bg);
      border: var(--border-width-default) solid var(--color-danger-border);
      color: var(--color-text-danger);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
    }
  `;

  @state() private _simulations: Simulation[] = [];
  @state() private _loading = true;
  @state() private _error: string | null = null;

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    await this._loadSimulations();
  }

  private async _loadSimulations(): Promise<void> {
    this._loading = true;
    this._error = null;

    try {
      const response = await simulationsApi.getSimulations();
      if (response.success && response.data) {
        this._simulations = response.data;
        appState.setSimulations(response.data);
      } else {
        this._error = response.error?.message || msg('Failed to load simulations.');
      }
    } catch {
      this._error = msg('An unexpected error occurred while loading simulations.');
    } finally {
      this._loading = false;
    }
  }

  private _handleCreateClick(): void {
    this.dispatchEvent(
      new CustomEvent('navigate', {
        detail: '/new-simulation',
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleSimulationClick(e: CustomEvent<Simulation>): void {
    const simulation = e.detail;
    appState.setCurrentSimulation(simulation);
    window.history.pushState({}, '', `/simulations/${simulation.id}/agents`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }

  protected render() {
    if (this._loading) {
      return html`<div class="loading-state">${msg('Loading Simulations...')}</div>`;
    }

    if (this._error) {
      return html`<div class="error-state">${this._error}</div>`;
    }

    return html`
      <div class="dashboard-header">
        <h1 class="dashboard-title">${msg('Your Simulations')}</h1>
        <button class="btn-create" @click=${this._handleCreateClick}>
          ${msg('+ Create Simulation')}
        </button>
      </div>

      ${
        this._simulations.length === 0
          ? html`
          <div class="empty-state">
            <div class="empty-state__title">${msg('No Simulations Yet')}</div>
            <div class="empty-state__text">
              ${msg('Create your first simulation to start building worlds with agents, buildings, and events.')}
            </div>
            <button class="btn-create" @click=${this._handleCreateClick}>
              ${msg('+ Create Your First Simulation')}
            </button>
          </div>
        `
          : html`
          <div class="simulations-grid">
            ${this._simulations.map(
              (sim) => html`
                <velg-simulation-card
                  .simulation=${sim}
                  @simulation-click=${this._handleSimulationClick}
                ></velg-simulation-card>
              `,
            )}
          </div>
        `
      }
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-simulations-dashboard': VelgSimulationsDashboard;
  }
}

import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import type { Simulation } from '../../types/index.js';

import './UserMenu.js';

@customElement('velg-platform-header')
export class VelgPlatformHeader extends LitElement {
  static styles = css`
    :host {
      display: block;
      height: var(--header-height);
      background: var(--color-surface-header);
      border-bottom: var(--border-default);
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 100%;
      padding: 0 var(--space-6);
    }

    .header__left {
      display: flex;
      align-items: center;
      gap: var(--space-4);
    }

    .header__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-lg);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      cursor: pointer;
    }

    .header__title:hover {
      opacity: 0.8;
    }

    .sim-selector {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .sim-selector__label {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-secondary);
    }

    .sim-selector__select {
      font-family: var(--font-sans);
      font-size: var(--text-sm);
      padding: var(--space-1) var(--space-3);
      border: var(--border-default);
      background: var(--color-surface);
      cursor: pointer;
    }

    .header__right {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }
  `;

  @state() private _simulations: Simulation[] = [];

  connectedCallback(): void {
    super.connectedCallback();
    this._simulations = appState.simulations.value;
  }

  private _handleTitleClick(): void {
    this.dispatchEvent(
      new CustomEvent('navigate', { detail: '/dashboard', bubbles: true, composed: true }),
    );
  }

  private _handleSimulationChange(e: Event): void {
    const select = e.target as HTMLSelectElement;
    const simId = select.value;
    const sim = this._simulations.find((s) => s.id === simId) || null;
    appState.setCurrentSimulation(sim);
    if (sim) {
      this.dispatchEvent(
        new CustomEvent('navigate', {
          detail: `/simulations/${sim.id}/agents`,
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  protected render() {
    const currentSim = appState.currentSimulation.value;

    return html`
      <div class="header">
        <div class="header__left">
          <span class="header__title" @click=${this._handleTitleClick}>Velgarien</span>

          ${
            this._simulations.length > 0
              ? html`
              <div class="sim-selector">
                <span class="sim-selector__label">Simulation:</span>
                <select class="sim-selector__select" @change=${this._handleSimulationChange}>
                  <option value="">-- Select --</option>
                  ${this._simulations.map(
                    (sim) => html`
                      <option value=${sim.id} ?selected=${currentSim?.id === sim.id}>
                        ${sim.name}
                      </option>
                    `,
                  )}
                </select>
              </div>
            `
              : null
          }
        </div>

        <div class="header__right">
          <velg-user-menu></velg-user-menu>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-platform-header': VelgPlatformHeader;
  }
}

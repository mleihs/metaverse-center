import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { themeService } from '../../services/ThemeService.js';

import './SimulationHeader.js';
import './SimulationNav.js';

@customElement('velg-simulation-shell')
export class VelgSimulationShell extends LitElement {
  static styles = css`
    :host {
      display: block;
      min-height: calc(100vh - var(--header-height));
      background-color: var(--color-surface);
      color: var(--color-text-primary);
    }

    .shell {
      display: grid;
      grid-template-rows: auto auto 1fr;
      min-height: 100%;
    }

    .shell__content {
      padding: var(--content-padding);
    }
  `;

  @property({ type: String }) simulationId = '';

  private _appliedSimulationId = '';

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    if (this.simulationId) {
      await this._applyTheme();
    }
  }

  disconnectedCallback(): void {
    themeService.resetTheme(this);
    this._appliedSimulationId = '';
    super.disconnectedCallback();
  }

  protected async willUpdate(changedProperties: Map<PropertyKey, unknown>): Promise<void> {
    if (
      changedProperties.has('simulationId') &&
      this.simulationId &&
      this.simulationId !== this._appliedSimulationId
    ) {
      await this._applyTheme();
    }
  }

  private async _applyTheme(): Promise<void> {
    if (!this.simulationId) return;
    this._appliedSimulationId = this.simulationId;
    await themeService.applySimulationTheme(this.simulationId, this);
  }

  protected render() {
    return html`
      <div class="shell">
        <velg-simulation-header .simulationId=${this.simulationId}></velg-simulation-header>
        <velg-simulation-nav .simulationId=${this.simulationId}></velg-simulation-nav>
        <div class="shell__content">
          <slot></slot>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-simulation-shell': VelgSimulationShell;
  }
}

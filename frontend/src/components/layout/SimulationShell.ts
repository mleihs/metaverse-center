import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import './SimulationHeader.js';
import './SimulationNav.js';

@customElement('velg-simulation-shell')
export class VelgSimulationShell extends LitElement {
  static styles = css`
    :host {
      display: block;
      min-height: calc(100vh - var(--header-height));
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

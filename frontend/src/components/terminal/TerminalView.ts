/**
 * Bureau Terminal — Tab wrapper component.
 *
 * Thin view component for the SimulationShell tab system.
 * Initializes TerminalStateManager, loads zone data, and renders BureauTerminal.
 * Route: /simulations/:slug/terminal
 */

import { localized, msg } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { terminalState } from '../../services/TerminalStateManager.js';
import { initializeTerminalZones } from '../../utils/terminal-initialization.js';
import { terminalTokens, terminalAnimations, terminalWrapperStyles } from '../shared/terminal-theme-styles.js';
import './BureauTerminal.js';

@localized()
@customElement('velg-terminal-view')
export class VelgTerminalView extends SignalWatcher(LitElement) {
  static styles = [
    terminalTokens,
    terminalAnimations,
    terminalWrapperStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        height: calc(100vh - var(--header-height, 64px) - 120px);
        min-height: 400px;
        padding: 0 16px 16px;
      }

      @media (max-width: 640px) {
        :host {
          padding: 0 8px 8px;
          height: calc(100vh - var(--header-height, 64px) - 100px);
        }
      }
    `,
  ];

  @property({ type: String }) simulationId = '';

  @state() private _initialized = false;
  @state() private _error: string | null = null;

  override async connectedCallback(): Promise<void> {
    super.connectedCallback();
    await this._initialize();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    terminalState.dispose();
  }

  private async _initialize(): Promise<void> {
    const sid = this.simulationId || appState.simulationId.value;
    if (!sid) {
      this._error = msg('No simulation context.');
      return;
    }

    try {
      terminalState.initialize(sid);
      await initializeTerminalZones(sid);
      this._initialized = true;
    } catch (err) {
      this._error = err instanceof Error ? err.message : msg('Initialization failed.');
    }
  }

  protected render() {
    if (this._error) {
      return html`<div class="terminal-error">[ERROR] ${this._error}</div>`;
    }

    if (!this._initialized) {
      return html`<div class="terminal-loading">${msg('Establishing secure connection...')}_</div>`;
    }

    return html`
      <div class="terminal-wrapper">
        <velg-bureau-terminal
          .simulationId=${this.simulationId || appState.simulationId.value || ''}
        ></velg-bureau-terminal>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-terminal-view': VelgTerminalView;
  }
}

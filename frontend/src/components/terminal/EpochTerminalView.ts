/**
 * Bureau Terminal — Epoch wrapper component.
 *
 * Thin view component for the EpochCommandCenter tab system.
 * Initializes TerminalStateManager with epoch context (OPERATIONAL MODE),
 * loads zone data for the participant's game_instance simulation,
 * and renders the shared BureauTerminal component.
 *
 * Follows the same pattern as TerminalView.ts (template mode wrapper).
 */

import { localized, msg } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { terminalState } from '../../services/TerminalStateManager.js';
import { locationsApi } from '../../services/api/index.js';
import type {
  EpochParticipant,
  EpochStatus,
  EpochTeam,
} from '../../types/index.js';
import { terminalTokens, terminalAnimations, terminalWrapperStyles } from '../shared/terminal-theme-styles.js';
import './BureauTerminal.js';

@localized()
@customElement('velg-epoch-terminal-view')
export class VelgEpochTerminalView extends SignalWatcher(LitElement) {
  static styles = [
    terminalTokens,
    terminalAnimations,
    terminalWrapperStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        height: calc(100vh - var(--header-height, 64px) - 180px);
        min-height: 400px;
      }

      @media (max-width: 640px) {
        :host {
          height: calc(100vh - var(--header-height, 64px) - 160px);
        }
      }
    `,
  ];

  @property({ type: String }) epochId = '';
  @property({ attribute: false }) participant: EpochParticipant | null = null;
  @property({ attribute: false }) participants: EpochParticipant[] = [];
  @property({ attribute: false }) teams: EpochTeam[] = [];
  @property({ type: String }) epochStatus: EpochStatus = 'lobby';

  @state() private _initialized = false;
  @state() private _error: string | null = null;

  override async connectedCallback(): Promise<void> {
    super.connectedCallback();
    await this._initialize();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    terminalState.clearEpoch();
    terminalState.dispose();
  }

  private async _initialize(): Promise<void> {
    const sid = this.participant?.simulation_id;
    if (!sid || !this.epochId || !this.participant) {
      this._error = msg('No epoch context available.');
      return;
    }

    try {
      // Initialize base terminal state (loads from localStorage for this simulation)
      terminalState.initialize(sid);

      // Initialize epoch context (OPERATIONAL MODE)
      terminalState.initializeEpoch(
        this.epochId,
        this.participant,
        this.participants,
        this.teams,
        this.epochStatus,
      );

      // Fetch zones for the participant's game_instance simulation
      const zonesResp = await locationsApi.listZones(sid);
      if (!zonesResp.success || !zonesResp.data || zonesResp.data.length === 0) {
        this._error = msg('No zones found in this simulation.');
        return;
      }

      terminalState.cacheZones(zonesResp.data);

      // Always validate persisted zone against loaded zones.
      // Game instances have different UUIDs than their source template,
      // so a persisted zone ID from a template session won't match.
      const currentZone = terminalState.currentZoneId.value;
      const zoneIds = new Set(zonesResp.data.map((z) => z.id));
      if (!currentZone || !zoneIds.has(currentZone)) {
        const sorted = [...zonesResp.data].sort((a, b) => a.name.localeCompare(b.name));
        terminalState.setCurrentZone(sorted[0].id);
      }

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
          .simulationId=${this.participant?.simulation_id ?? ''}
        ></velg-bureau-terminal>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-epoch-terminal-view': VelgEpochTerminalView;
  }
}

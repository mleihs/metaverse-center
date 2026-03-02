/**
 * Epoch Lobby Actions — join/leave/start buttons and admin controls
 * shown below the banner when an epoch is selected.
 *
 * Extracted from EpochCommandCenter.
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Epoch, EpochParticipant, Simulation } from '../../types/index.js';

@localized()
@customElement('velg-epoch-lobby-actions')
export class VelgEpochLobbyActions extends LitElement {
  static styles = css`
    :host {
      display: block;
      max-width: var(--container-2xl, 1400px);
      margin: 0 auto;
      padding: 0 var(--space-6);
    }

    /* ── Lobby Actions ─────────────────────── */

    .lobby-actions {
      display: flex;
      gap: var(--space-2);
      margin-top: var(--space-4);
      flex-wrap: wrap;
    }

    .lobby-btn {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-4);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      border: 2px solid;
      cursor: pointer;
      transition: all var(--transition-normal);
    }

    .lobby-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .lobby-btn--join {
      color: var(--color-success);
      border-color: var(--color-success);
      background: transparent;
    }

    .lobby-btn--join:hover:not(:disabled) {
      background: var(--color-success);
      color: var(--color-gray-950);
    }

    .lobby-btn--leave {
      color: var(--color-gray-400);
      border-color: var(--color-gray-600);
      background: transparent;
    }

    .lobby-btn--leave:hover:not(:disabled) {
      border-color: var(--color-gray-400);
      background: var(--color-gray-800);
    }

    .lobby-btn--start {
      color: var(--color-gray-950);
      border-color: var(--color-gray-100);
      background: var(--color-gray-100);
    }

    .lobby-btn--start:hover:not(:disabled) {
      transform: translate(-2px, -2px);
      box-shadow: 4px 4px 0 var(--color-gray-600);
    }

    .lobby-btn--start:active:not(:disabled) {
      transform: translate(0);
      box-shadow: none;
    }

    .lobby-btn--bots {
      color: var(--color-warning);
      border-color: var(--color-warning);
      background: transparent;
    }

    .lobby-btn--bots:hover:not(:disabled) {
      background: color-mix(in srgb, var(--color-warning) 15%, transparent);
      box-shadow: 0 0 10px color-mix(in srgb, var(--color-warning) 20%, transparent);
    }

    .lobby-btn--bots .bot-icon {
      display: inline-block;
      width: 14px;
      height: 14px;
    }

    .lobby-btn--bots .bot-icon svg {
      width: 100%;
      height: 100%;
      fill: currentColor;
    }

    /* ── Admin Controls ────────────────────── */

    .admin-panel {
      margin-top: var(--space-3);
      border: 1px solid var(--color-gray-800);
      overflow: hidden;
    }

    .admin-toggle {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      padding: var(--space-2) var(--space-3);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-warning);
      background: var(--color-gray-900);
      border: none;
      cursor: pointer;
      transition: background var(--transition-normal);
    }

    .admin-toggle:hover {
      background: var(--color-gray-800);
    }

    .admin-toggle__chevron {
      transition: transform var(--transition-normal);
      font-size: var(--text-xs);
    }

    .admin-toggle__chevron--open {
      transform: rotate(180deg);
    }

    .admin-body {
      display: flex;
      gap: var(--space-2);
      flex-wrap: wrap;
      padding: var(--space-3);
      border-top: 1px solid var(--color-gray-800);
      background: var(--color-gray-950);
    }

    .admin-btn {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      padding: var(--space-1-5) var(--space-3);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      border: 1px solid;
      cursor: pointer;
      transition: all var(--transition-normal);
    }

    .admin-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .admin-btn--advance {
      color: var(--color-success);
      border-color: var(--color-success);
      background: transparent;
    }

    .admin-btn--advance:hover:not(:disabled) {
      background: rgba(74 222 128 / 0.15);
    }

    .admin-btn--resolve {
      color: var(--color-warning);
      border-color: var(--color-warning);
      background: transparent;
    }

    .admin-btn--resolve:hover:not(:disabled) {
      background: rgba(245 158 11 / 0.15);
    }

    .admin-btn--cancel {
      color: var(--color-danger);
      border-color: var(--color-danger);
      background: transparent;
    }

    .admin-btn--cancel:hover:not(:disabled) {
      background: rgba(239 68 68 / 0.15);
    }
  `;

  @property({ type: Object }) epoch: Epoch | null = null;
  @property({ type: Object }) myParticipant: EpochParticipant | null = null;
  @property({ type: Array }) participants: EpochParticipant[] = [];
  @property({ type: Array }) simulations: Simulation[] = [];
  @property({ type: String }) userId = '';
  @property({ type: Boolean }) actionLoading = false;

  @state() private _showAdminPanel = false;

  protected render() {
    if (!this.epoch) return nothing;

    const isLobby = this.epoch.status === 'lobby';
    const isActive = ['foundation', 'competition', 'reckoning'].includes(this.epoch.status);
    const isCreator = this.epoch.created_by_id === this.userId;
    const participantSimIds = this.participants.map((p) => p.simulation_id);
    // Only show template simulations for joining (not game instances or archived)
    const joinableSims = this.simulations.filter(
      (s) =>
        !participantSimIds.includes(s.id) &&
        (!s.simulation_type || s.simulation_type === 'template'),
    );

    return html`
      ${
        isLobby
          ? html`
        <div class="lobby-actions">
          ${joinableSims.map(
            (sim) => html`
            <button
              class="lobby-btn lobby-btn--join"
              ?disabled=${this.actionLoading}
              @click=${() => this._onJoinEpoch(sim.id)}
            >+ ${msg(str`Join as ${sim.name}`)}</button>
          `,
          )}
          ${
            this.myParticipant
              ? html`
            <button
              class="lobby-btn lobby-btn--leave"
              ?disabled=${this.actionLoading}
              @click=${this._onLeaveEpoch}
            >${msg('Leave Epoch')}</button>
          `
              : nothing
          }
          ${
            isCreator
              ? html`
            <button
              class="lobby-btn lobby-btn--join"
              @click=${this._onInvitePlayers}
            >${msg('Invite Players')}</button>
            <button
              class="lobby-btn lobby-btn--bots"
              @click=${this._onAddBots}
            >${msg('Add Bots')}</button>
            <button
              class="lobby-btn lobby-btn--start"
              ?disabled=${this.actionLoading || this.participants.length < 2}
              @click=${this._onStartEpoch}
            >${msg('Start Epoch')}</button>
          `
              : nothing
          }
        </div>
      `
          : nothing
      }
      ${
        !isLobby
          ? html`
        <div class="lobby-actions">
          <button class="lobby-btn lobby-btn--join" @click=${this._onCreateEpoch}>
            + ${msg('Create New Epoch')}
          </button>
        </div>
      `
          : nothing
      }
      ${isActive && isCreator ? this._renderAdminControls() : nothing}
    `;
  }

  private _renderAdminControls() {
    if (!this.epoch) return nothing;

    const nextPhaseMap: Record<string, string> = {
      foundation: 'Competition',
      competition: 'Reckoning',
      reckoning: 'Completed',
    };
    const nextPhase = nextPhaseMap[this.epoch.status] ?? '?';

    return html`
      <div class="admin-panel">
        <button class="admin-toggle" @click=${() => {
          this._showAdminPanel = !this._showAdminPanel;
        }}>
          <span>${msg('Admin Controls')}</span>
          <span class="admin-toggle__chevron ${this._showAdminPanel ? 'admin-toggle__chevron--open' : ''}">&#9660;</span>
        </button>
        ${
          this._showAdminPanel
            ? html`
          <div class="admin-body">
            <button
              class="admin-btn admin-btn--advance"
              ?disabled=${this.actionLoading}
              @click=${this._onAdvancePhase}
            >${msg(str`Advance to ${nextPhase}`)}</button>
            <button
              class="admin-btn admin-btn--resolve"
              ?disabled=${this.actionLoading}
              @click=${this._onResolveCycle}
            >${msg('Resolve Cycle')}</button>
            <button
              class="admin-btn admin-btn--cancel"
              ?disabled=${this.actionLoading}
              @click=${this._onCancelEpoch}
            >${msg('Cancel Epoch')}</button>
          </div>
        `
            : nothing
        }
      </div>
    `;
  }

  // ── Event Dispatchers ───────────────────────────

  private _onJoinEpoch(simulationId: string) {
    this.dispatchEvent(
      new CustomEvent('join-epoch', {
        detail: { simulationId },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _onLeaveEpoch() {
    this.dispatchEvent(
      new CustomEvent('leave-epoch', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _onStartEpoch() {
    this.dispatchEvent(
      new CustomEvent('start-epoch', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _onInvitePlayers() {
    this.dispatchEvent(
      new CustomEvent('invite-players', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _onAddBots() {
    this.dispatchEvent(
      new CustomEvent('add-bots', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _onCreateEpoch() {
    this.dispatchEvent(
      new CustomEvent('create-epoch', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _onAdvancePhase() {
    this.dispatchEvent(
      new CustomEvent('advance-phase', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _onResolveCycle() {
    this.dispatchEvent(
      new CustomEvent('resolve-cycle', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _onCancelEpoch() {
    this.dispatchEvent(
      new CustomEvent('cancel-epoch', {
        bubbles: true,
        composed: true,
      }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-epoch-lobby-actions': VelgEpochLobbyActions;
  }
}

/**
 * Epoch Overview Tab — the default tab showing leaderboard preview,
 * quick actions, cycle status, active operations, and battle log preview.
 *
 * Extracted from EpochCommandCenter.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type {
  BattleLogEntry,
  Epoch,
  EpochParticipant,
  LeaderboardEntry,
  OperativeMission,
} from '../../types/index.js';
import './EpochLeaderboard.js';
import './EpochBattleLog.js';
import './EpochReadyPanel.js';
import './EpochPresenceIndicator.js';

@localized()
@customElement('velg-epoch-overview-tab')
export class VelgEpochOverviewTab extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    /* ── Overview Grid ────────────────────────── */

    .overview {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-4);
    }

    @media (max-width: 900px) {
      .overview {
        grid-template-columns: 1fr;
      }
    }

    .panel {
      border: 1px solid var(--color-gray-800);
      background: var(--color-gray-900);
      opacity: 0;
      animation: panel-enter 0.4s ease-out forwards;
    }

    .panel:nth-child(1) { animation-delay: 80ms; }
    .panel:nth-child(2) { animation-delay: 160ms; }
    .panel:nth-child(3) { animation-delay: 240ms; }
    .panel:nth-child(4) { animation-delay: 320ms; }

    @keyframes panel-enter {
      from {
        opacity: 0;
        transform: translateY(10px) scale(0.98);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .panel__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--space-3) var(--space-4);
      border-bottom: 1px solid var(--color-gray-800);
    }

    .panel__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-gray-300);
      margin: 0;
    }

    .panel__body {
      padding: var(--space-4);
    }

    /* ── Quick Actions ────────────────────────── */

    .quick-actions {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .action-btn {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--space-2) var(--space-3);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-gray-200);
      background: var(--color-gray-800);
      border: 1px solid var(--color-gray-700);
      cursor: pointer;
      transition: all var(--transition-normal);
    }

    .action-btn:hover {
      background: var(--color-gray-700);
      transform: translate(-1px, -1px);
      box-shadow: 2px 2px 0 var(--color-gray-900);
    }

    .action-btn:active {
      transform: translate(0, 0);
      box-shadow: none;
      background: var(--color-gray-600);
    }

    .action-btn__cost {
      font-family: var(--font-mono, monospace);
      color: var(--color-success);
    }

    /* ── Mission Card ─────────────────────────── */

    .mission {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-2) 0;
      border-bottom: 1px solid var(--color-gray-850, var(--color-gray-800));
      transition: all var(--transition-normal);
    }

    .mission:hover {
      padding-left: var(--space-2);
      background: rgba(255 255 255 / 0.02);
    }

    .mission:hover .mission__icon {
      transform: scale(1.1) rotate(-3deg);
      border-color: var(--color-gray-500);
    }

    .mission:last-child {
      border-bottom: none;
    }

    .mission__icon {
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: var(--text-base);
      border: 1px solid var(--color-gray-700);
      background: var(--color-gray-800);
      flex-shrink: 0;
      transition: all var(--transition-normal);
    }

    .mission__info {
      flex: 1;
      min-width: 0;
    }

    .mission__type {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
    }

    .mission__detail {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      color: var(--color-gray-500);
    }

    .mission__status {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      padding: 2px 6px;
      border: 1px solid;
    }

    .mission__status--active {
      border-color: var(--color-success);
      color: var(--color-success);
    }

    .mission__status--deploying {
      border-color: var(--color-warning);
      color: var(--color-warning);
    }

    .mission__status--success {
      border-color: var(--color-success);
      color: var(--color-success);
    }

    .mission__status--failed {
      border-color: var(--color-gray-600);
      color: var(--color-gray-500);
    }

    .mission__status--detected {
      border-color: var(--color-danger);
      color: var(--color-danger);
    }

    .mission__recall {
      padding: 2px 6px;
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      text-transform: uppercase;
      color: var(--color-warning);
      border: 1px solid var(--color-warning);
      background: transparent;
      cursor: pointer;
      transition: all var(--transition-normal);
    }

    .mission__recall:hover {
      background: rgba(245 158 11 / 0.15);
    }

    .mission__recall:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    /* ── Empty / Threat ───────────────────────── */

    .empty-hint {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-sm);
      color: var(--color-gray-600);
      text-align: center;
      padding: var(--space-4);
    }

    .threat-count {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      color: var(--color-danger);
      padding: 2px 6px;
      border: 1px solid var(--color-danger);
      animation: threat-blink 2s ease-in-out infinite;
    }

    @keyframes threat-blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  `;

  @property({ type: Object }) epoch: Epoch | null = null;
  @property({ type: Object }) myParticipant: EpochParticipant | null = null;
  @property({ type: Array }) participants: EpochParticipant[] = [];
  @property({ type: Array }) leaderboard: LeaderboardEntry[] = [];
  @property({ type: Array }) missions: OperativeMission[] = [];
  @property({ type: Array }) threats: OperativeMission[] = [];
  @property({ type: Array }) battleLog: BattleLogEntry[] = [];
  @property({ type: Boolean }) actionLoading = false;

  protected render() {
    return html`
      <div class="overview">
        <!-- Leaderboard Preview -->
        <div class="panel">
          <div class="panel__header">
            <h3 class="panel__title">${msg('Leaderboard')}</h3>
          </div>
          <div class="panel__body">
            <velg-epoch-leaderboard
              .entries=${this.leaderboard.slice(0, 5)}
              .epoch=${this.epoch}
              .participants=${this.participants}
              compact
            ></velg-epoch-leaderboard>
          </div>
        </div>

        <!-- Quick Actions -->
        ${
          this.myParticipant && this.epoch?.status !== 'lobby'
            ? html`
            <div class="panel">
              <div class="panel__header">
                <h3 class="panel__title">${msg('Quick Actions')}</h3>
              </div>
              <div class="panel__body">
                <div class="quick-actions">
                  <button class="action-btn" @click=${this._onDeployOperative}>
                    <span>${this.epoch?.status === 'foundation' ? msg('Deploy Guardian') : msg('Deploy Operative')}</span>
                    <span class="action-btn__cost">${this.epoch?.status === 'foundation' ? '3 RP' : '3-8 RP'}</span>
                  </button>
                  <button class="action-btn" @click=${this._onCounterIntel}>
                    <span>${msg('Counter-Intel Sweep')}</span>
                    <span class="action-btn__cost">3 RP</span>
                  </button>
                </div>
              </div>
            </div>
          `
            : this.myParticipant && this.epoch?.status === 'lobby'
              ? html`
            <div class="panel">
              <div class="panel__header">
                <h3 class="panel__title">${msg('Quick Actions')}</h3>
              </div>
              <div class="panel__body">
                <p class="empty-hint">${msg('Waiting for epoch to start. Operations available once the epoch enters foundation phase.')}</p>
              </div>
            </div>
          `
              : html`
            <div class="panel">
              <div class="panel__header">
                <h3 class="panel__title">${msg('Spectating')}</h3>
              </div>
              <div class="panel__body">
                <p class="empty-hint">${msg('You are not participating in this epoch.')}</p>
              </div>
            </div>
          `
        }

        <!-- Cycle Readiness -->
        ${
          this.myParticipant &&
          this.epoch &&
          ['foundation', 'competition', 'reckoning'].includes(this.epoch.status)
            ? html`
            <div class="panel">
              <div class="panel__header">
                <h3 class="panel__title">${msg('Cycle Status')}</h3>
              </div>
              <div class="panel__body">
                <velg-epoch-ready-panel
                  .epochId=${this.epoch.id}
                  .participants=${this.participants}
                  .mySimulationId=${this.myParticipant.simulation_id}
                  .epochStatus=${this.epoch.status}
                ></velg-epoch-ready-panel>
              </div>
            </div>
          `
            : nothing
        }

        <!-- Active Operations -->
        <div class="panel">
          <div class="panel__header">
            <h3 class="panel__title">${msg('Your Operations')}</h3>
            ${
              this.threats.length > 0
                ? html`<span class="threat-count">${this.threats.length} ${msg('threats')}</span>`
                : nothing
            }
          </div>
          <div class="panel__body">
            ${
              this.missions.length > 0
                ? this.missions
                    .filter((m) => ['deploying', 'active'].includes(m.status))
                    .map((m) => this._renderMission(m))
                : html`<p class="empty-hint">${msg('No active operations.')}</p>`
            }
          </div>
        </div>

        <!-- Battle Log Preview -->
        <div class="panel">
          <div class="panel__header">
            <h3 class="panel__title">${msg('Recent Events')}</h3>
          </div>
          <div class="panel__body">
            <velg-epoch-battle-log
              .entries=${this.battleLog.slice(0, 5)}
              .participants=${this.participants}
              compact
            ></velg-epoch-battle-log>
          </div>
        </div>
      </div>
    `;
  }

  private _renderMission(m: OperativeMission) {
    const canRecall = ['deploying', 'active'].includes(m.status);
    return html`
      <div class="mission">
        <div class="mission__icon">${this._getOperativeIcon(m.operative_type)}</div>
        <div class="mission__info">
          <div class="mission__type">
            ${m.operative_type}
            ${m.agents?.name ? html` &middot; ${m.agents.name}` : nothing}
          </div>
          <div class="mission__detail">
            ${
              m.success_probability != null
                ? html`${Math.round(m.success_probability * 100)}% ${msg('success')}`
                : nothing
            }
            ${m.cost_rp ? html` &middot; ${m.cost_rp} RP` : nothing}
          </div>
        </div>
        ${
          canRecall
            ? html`
              <button
                class="mission__recall"
                ?disabled=${this.actionLoading}
                @click=${() => this._onRecallOperative(m.id)}
              >${msg('Recall')}</button>
            `
            : nothing
        }
        <span class="mission__status ${this._getMissionStatusClass(m.status)}">
          ${m.status}
        </span>
      </div>
    `;
  }

  private _getOperativeIcon(type: string): string {
    const icons: Record<string, string> = {
      spy: '\u{1F50D}',
      saboteur: '\u{1F4A3}',
      propagandist: '\u{1F4E2}',
      assassin: '\u{1F5E1}',
      guardian: '\u{1F6E1}',
      infiltrator: '\u{1F47B}',
    };
    return icons[type] || '\u{2694}';
  }

  private _getMissionStatusClass(status: string): string {
    if (['success'].includes(status)) return 'mission__status--success';
    if (['deploying', 'returning'].includes(status)) return 'mission__status--deploying';
    if (['detected', 'captured'].includes(status)) return 'mission__status--detected';
    if (['failed'].includes(status)) return 'mission__status--failed';
    return 'mission__status--active';
  }

  private _onDeployOperative() {
    this.dispatchEvent(
      new CustomEvent('deploy-operative', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _onCounterIntel() {
    this.dispatchEvent(
      new CustomEvent('counter-intel', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _onRecallOperative(missionId: string) {
    this.dispatchEvent(
      new CustomEvent('recall-operative', {
        detail: { missionId },
        bubbles: true,
        composed: true,
      }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-epoch-overview-tab': VelgEpochOverviewTab;
  }
}

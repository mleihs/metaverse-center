/**
 * Epoch Overview Tab — the default tab showing leaderboard preview,
 * quick actions, cycle status, active operations, and battle log preview.
 *
 * Extracted from EpochCommandCenter.
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type {
  BattleLogEntry,
  Epoch,
  EpochParticipant,
  LeaderboardEntry,
  OperativeMission,
} from '../../types/index.js';
import { icons } from '../../utils/icons.js';
import { getOperativeIcon } from '../../utils/operative-icons.js';
import './EpochLeaderboard.js';
import './EpochBattleLog.js';
import './EpochReadyPanel.js';
import './EpochPresenceIndicator.js';
import './EpochIntelDossierTab.js';

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
      position: relative;
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-2) var(--space-3);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-gray-200);
      background:
        linear-gradient(90deg, rgba(255 255 255 / 0.02) 0%, transparent 60%),
        var(--color-gray-800);
      border: 1px solid var(--color-gray-700);
      border-left: 3px solid var(--_accent, var(--color-gray-600));
      cursor: pointer;
      transition:
        transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1),
        box-shadow 200ms ease,
        border-color 150ms ease,
        background 150ms ease;
      overflow: hidden;
    }

    .action-btn::after {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 60%;
      height: 100%;
      background: linear-gradient(
        90deg,
        transparent 0%,
        color-mix(in srgb, var(--_accent) 4%, transparent) 40%,
        color-mix(in srgb, var(--_accent) 8%, transparent) 50%,
        color-mix(in srgb, var(--_accent) 4%, transparent) 60%,
        transparent 100%
      );
      transition: left 0s;
      pointer-events: none;
    }

    .action-btn:hover::after {
      left: 100%;
      transition: left 600ms ease;
    }

    .action-btn:hover {
      transform: translateY(-2px);
      border-color: color-mix(in srgb, var(--_accent) 50%, var(--color-gray-600));
      border-left-color: var(--_accent);
      box-shadow:
        0 4px 12px rgba(0 0 0 / 0.3),
        0 0 20px color-mix(in srgb, var(--_accent) 12%, transparent),
        inset 0 1px 0 rgba(255 255 255 / 0.04);
      background:
        linear-gradient(90deg, color-mix(in srgb, var(--_accent) 6%, transparent) 0%, transparent 50%),
        var(--color-gray-800);
    }

    .action-btn:active {
      transform: translateY(0);
      box-shadow: none;
      background: var(--color-gray-700);
      transition-duration: 50ms;
    }

    .action-btn:focus-visible {
      outline: 2px solid var(--_accent);
      outline-offset: 2px;
    }

    .action-btn--deploy  { --_accent: var(--color-epoch-accent, #f59e0b); }
    .action-btn--sweep   { --_accent: var(--color-info, #38bdf8); }
    .action-btn--fortify { --_accent: var(--color-warning, #f59e0b); }

    .action-btn__icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      color: var(--_accent);
      border: 1px solid color-mix(in srgb, var(--_accent) 25%, var(--color-gray-700));
      background: color-mix(in srgb, var(--_accent) 6%, var(--color-gray-900));
      flex-shrink: 0;
      transition: border-color 150ms ease, box-shadow 200ms ease;
    }

    .action-btn:hover .action-btn__icon {
      border-color: color-mix(in srgb, var(--_accent) 50%, var(--color-gray-600));
      box-shadow: 0 0 8px color-mix(in srgb, var(--_accent) 20%, transparent);
    }

    .action-btn__label {
      flex: 1;
      text-align: left;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .action-btn__cost {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.06em;
      color: var(--color-success);
      padding: 2px 8px;
      border: 1px solid color-mix(in srgb, var(--color-success) 30%, var(--color-gray-700));
      background: color-mix(in srgb, var(--color-success) 5%, transparent);
      white-space: nowrap;
      flex-shrink: 0;
    }

    /* ── Intel Dossier Panel ─────────────────── */

    .intel-panel {
      grid-column: 1 / -1;
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
      color: var(--color-gray-300);
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
      color: var(--color-gray-400);
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
      border-color: var(--color-gray-500);
      color: var(--color-gray-400);
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

    /* ── Fortify Zone ──────────────────────────── */

    .fortify-zones {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      margin-top: var(--space-2);
    }

    .fortify-zone-btn {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--space-2) var(--space-3);
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      color: var(--color-warning);
      background: rgba(245 158 11 / 0.06);
      border: 1px dashed var(--color-warning);
      cursor: pointer;
      transition: all var(--transition-normal);
    }

    .fortify-zone-btn:hover {
      background: rgba(245 158 11 / 0.12);
      border-style: solid;
    }

    .fortify-zone-btn:active {
      background: rgba(245 158 11 / 0.18);
    }

    .fortify-zone-btn:focus-visible {
      outline: 2px solid var(--color-warning);
      outline-offset: 2px;
    }

    .fortify-zone-btn__name {
      font-weight: var(--font-bold);
    }

    .fortify-zone-btn__security {
      font-size: 10px;
      color: var(--color-gray-400);
      text-transform: uppercase;
    }

    .fortify-zone-btn__cost {
      font-family: var(--font-mono, monospace);
      color: var(--color-success);
    }

    .fortify-label {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-warning);
      margin-top: var(--space-2);
    }

    /* ── Fortification Manifest ──────────────── */

    .fort-manifest {
      margin-top: var(--space-3);
      border-top: 1px solid var(--color-gray-800);
      padding-top: var(--space-3);
    }

    .fort-manifest__header {
      position: relative;
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin-bottom: var(--space-2);
      padding: 4px var(--space-2);
    }

    /* Corner bracket decoration */
    .fort-manifest__header::before,
    .fort-manifest__header::after {
      content: '';
      position: absolute;
      width: 6px;
      height: 6px;
      border-color: var(--color-warning);
      border-style: solid;
      opacity: 0.5;
    }

    .fort-manifest__header::before {
      top: 0;
      left: 0;
      border-width: 1px 0 0 1px;
    }

    .fort-manifest__header::after {
      bottom: 0;
      right: 0;
      border-width: 0 1px 1px 0;
    }

    .fort-manifest__label {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-warning);
    }

    .fort-manifest__count {
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      color: var(--color-gray-400);
    }

    .fort-entry {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: 5px var(--space-2);
      margin-bottom: 2px;
      border-left: 2px solid var(--color-warning);
      background: rgba(245 158 11 / 0.04);
      opacity: 0;
      animation: fort-slide 0.3s ease-out forwards;
    }

    .fort-entry:nth-child(2) { animation-delay: 60ms; }
    .fort-entry:nth-child(3) { animation-delay: 120ms; }
    .fort-entry:nth-child(4) { animation-delay: 180ms; }
    .fort-entry:nth-child(5) { animation-delay: 240ms; }

    @keyframes fort-slide {
      from {
        opacity: 0;
        transform: translateX(-6px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    .fort-entry--expired {
      border-left-color: var(--color-gray-700);
      background: transparent;
      animation: none;
    }

    .fort-entry__status {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      flex-shrink: 0;
      background: var(--color-warning);
      box-shadow: 0 0 4px rgba(245 158 11 / 0.5);
      animation: fort-pulse 2.5s ease-in-out infinite;
    }

    .fort-entry--expired .fort-entry__status {
      background: var(--color-gray-500);
      box-shadow: none;
      animation: none;
    }

    @keyframes fort-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    .fort-entry__zone {
      flex: 1;
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      font-weight: bold;
      color: var(--color-warning);
      text-transform: uppercase;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .fort-entry--expired .fort-entry__zone {
      color: var(--color-gray-400);
    }

    .fort-entry__level {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      color: var(--color-gray-400);
      text-transform: uppercase;
      flex-shrink: 0;
    }

    .fort-entry__expiry {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      color: var(--color-gray-400);
      flex-shrink: 0;
      white-space: nowrap;
    }

    .fort-entry__tag {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      padding: 2px 5px;
      border: 1px solid;
      flex-shrink: 0;
    }

    .fort-entry__tag--active {
      color: var(--color-warning);
      border-color: var(--color-warning);
    }

    .fort-entry__tag--expired {
      color: var(--color-gray-400);
      border-color: var(--color-gray-600);
    }

    @media (prefers-reduced-motion: reduce) {
      .action-btn {
        transition: none;
      }

      .action-btn::after {
        display: none;
      }

      .action-btn:hover {
        transform: none;
      }

      .fort-entry {
        opacity: 1;
        animation: none;
      }

      .fort-entry__status {
        animation: none;
      }
    }

    /* ── Empty / Threat ───────────────────────── */

    .empty-hint {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-sm);
      color: var(--color-gray-400);
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
  @property({ type: Array }) zones: Array<{ id: string; name: string; security_level: string }> =
    [];
  @property({ type: Boolean }) actionLoading = false;
  @state() private _showFortifyZones = false;

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
          this.myParticipant &&
          ['foundation', 'competition', 'reckoning'].includes(this.epoch?.status ?? '')
            ? html`
            <div class="panel">
              <div class="panel__header">
                <h3 class="panel__title">${msg('Quick Actions')}</h3>
              </div>
              <div class="panel__body">
                <div class="quick-actions">
                  <button class="action-btn action-btn--deploy" @click=${this._onDeployOperative}>
                    <span class="action-btn__icon" aria-hidden="true">${this.epoch?.status === 'foundation' ? icons.operativeGuardian(16) : icons.deploy(16)}</span>
                    <span class="action-btn__label">${this.epoch?.status === 'foundation' ? msg('Deploy Guardian / Spy') : msg('Deploy Operative')}</span>
                    <span class="action-btn__cost">${this.epoch?.status === 'foundation' ? '3-4 RP' : '3-7 RP'}</span>
                  </button>
                  <button class="action-btn action-btn--sweep" @click=${this._onCounterIntel}>
                    <span class="action-btn__icon" aria-hidden="true">${icons.radar(16)}</span>
                    <span class="action-btn__label">${msg('Counter-Intel Sweep')}</span>
                    <span class="action-btn__cost">4 RP</span>
                  </button>
                  ${
                    this.epoch?.status === 'foundation'
                      ? html`
                    <button class="action-btn action-btn--fortify" aria-expanded="${this._showFortifyZones}" @click=${() => {
                      this._showFortifyZones = !this._showFortifyZones;
                    }}>
                      <span class="action-btn__icon" aria-hidden="true">${icons.fortify(16)}</span>
                      <span class="action-btn__label">${msg('Fortify Zone')}</span>
                      <span class="action-btn__cost">2 RP</span>
                    </button>
                    ${
                      this._showFortifyZones
                        ? html`
                      <p class="fortify-label" id="fortify-label">${msg('Select a zone to fortify')}</p>
                      <div class="fortify-zones" role="group" aria-labelledby="fortify-label">
                        ${this.zones.map(
                          (z) => html`
                          <button
                            class="fortify-zone-btn"
                            @click=${() => this._onFortifyZone(z.id)}
                          >
                            <span>
                              <span class="fortify-zone-btn__name">${z.name}</span>
                              <span class="fortify-zone-btn__security">${z.security_level}</span>
                            </span>
                            <span class="fortify-zone-btn__cost">2 RP</span>
                          </button>
                        `,
                        )}
                        ${this.zones.length === 0 ? html`<p class="empty-hint">${msg('No zones available.')}</p>` : nothing}
                      </div>
                    `
                        : nothing
                    }
                  `
                      : nothing
                  }
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

        <!-- Intel Dossier (inline, compact) -->
        ${
          this.myParticipant &&
          this.epoch &&
          ['foundation', 'competition', 'reckoning'].includes(this.epoch.status)
            ? html`
            <div class="panel intel-panel">
              <velg-epoch-intel-dossier-tab
                compact
                .epoch=${this.epoch}
                .myParticipant=${this.myParticipant}
                .battleLog=${this.battleLog}
                .participants=${this.participants}
              ></velg-epoch-intel-dossier-tab>
            </div>
          `
            : nothing
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
            ${this._renderFortifications()}
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
              .mySimulationId=${this.myParticipant?.simulation_id ?? ''}
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
        <div class="mission__icon">${getOperativeIcon(m.operative_type)}</div>
        <div class="mission__info">
          <div class="mission__type">
            ${m.operative_type}
            ${m.agents?.name ? html` &middot; ${m.agents.name}` : nothing}
            ${m.target_sim?.name ? html` &rarr; ${m.target_sim.name}` : nothing}
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

  private _getMissionStatusClass(status: string): string {
    if (['success'].includes(status)) return 'mission__status--success';
    if (['deploying', 'returning'].includes(status)) return 'mission__status--deploying';
    if (['detected', 'captured'].includes(status)) return 'mission__status--detected';
    if (['failed'].includes(status)) return 'mission__status--failed';
    return 'mission__status--active';
  }

  private _renderFortifications() {
    const mySimId = this.myParticipant?.simulation_id;
    if (!mySimId) return nothing;

    const currentCycle = this.epoch?.current_cycle ?? 1;

    // Extract fortifications from own zone_fortified battle log entries
    const fortEntries = this.battleLog
      .filter((e) => e.event_type === 'zone_fortified' && e.source_simulation_id === mySimId)
      .map((e) => {
        const meta = e.metadata as Record<string, unknown>;
        return {
          zoneName: (meta.zone_name as string) ?? '???',
          newLevel: (meta.new_level as string) ?? '',
          expiresAtCycle: (meta.expires_at_cycle as number) ?? 0,
          isExpired: currentCycle >= ((meta.expires_at_cycle as number) ?? 0),
        };
      });

    if (fortEntries.length === 0) return nothing;

    return html`
      <div class="fort-manifest" role="region" aria-label="${msg('Your fortifications')}">
        <div class="fort-manifest__header">
          <span class="fort-manifest__label">${msg('Defensive Fortifications')}</span>
          <span class="fort-manifest__count">${fortEntries.length}</span>
        </div>
        ${fortEntries.map(
          (f) => html`
          <div class="fort-entry ${f.isExpired ? 'fort-entry--expired' : ''}">
            <span class="fort-entry__status" aria-hidden="true"></span>
            <span class="fort-entry__zone">${f.zoneName}</span>
            <span class="fort-entry__level">${f.newLevel}</span>
            <span class="fort-entry__expiry">${msg(str`cycle ${f.expiresAtCycle}`)}</span>
            <span class="fort-entry__tag ${f.isExpired ? 'fort-entry__tag--expired' : 'fort-entry__tag--active'}">
              ${f.isExpired ? msg('expired') : msg('active')}
            </span>
          </div>
        `,
        )}
      </div>
    `;
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

  private _onFortifyZone(zoneId: string) {
    this.dispatchEvent(
      new CustomEvent('fortify-zone', {
        detail: { zoneId },
        bubbles: true,
        composed: true,
      }),
    );
    this._showFortifyZones = false;
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

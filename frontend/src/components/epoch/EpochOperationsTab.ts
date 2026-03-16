/**
 * Epoch Operations Tab — shows active missions, intelligence, and mission history.
 *
 * Extracted from EpochCommandCenter.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { EpochParticipant, OperativeMission } from '../../types/index.js';
import { getOperativeIcon } from '../../utils/operative-icons.js';

@localized()
@customElement('velg-epoch-operations-tab')
export class VelgEpochOperationsTab extends LitElement {
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

    .panel--full-width {
      grid-column: 1 / -1;
    }

    /* ── Mission Card ─────────────────────────── */

    .mission {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-2) 0;
      border-bottom: 1px solid var(--color-gray-850, var(--color-gray-800));
      border-left: 2px solid transparent;
      transition: all var(--transition-normal);
    }

    .mission--defensive {
      border-left-color: var(--color-success);
    }

    .mission--offensive {
      border-left-color: var(--color-warning);
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

    .mission__narrative {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      color: var(--color-gray-500);
      font-style: italic;
      margin-top: 2px;
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

    /* ── Cycle resolve pulse ── */
    .panel--pulse {
      animation: panel-pulse 0.8s ease-out;
    }

    @keyframes panel-pulse {
      0% { border-color: var(--color-gray-800); box-shadow: none; }
      30% { border-color: var(--color-warning); box-shadow: 0 0 12px rgba(245 158 11 / 0.2); }
      100% { border-color: var(--color-gray-800); box-shadow: none; }
    }

    @media (prefers-reduced-motion: reduce) {
      .panel--pulse { animation: none; }
    }
  `;

  @property({ type: Object }) myParticipant: EpochParticipant | null = null;
  @property({ type: Array }) missions: OperativeMission[] = [];
  @property({ type: Array }) threats: OperativeMission[] = [];
  @property({ type: Boolean }) actionLoading = false;
  @property({ type: Boolean }) cycleJustResolved = false;
  @property({ type: String }) epochStatus = '';

  protected render() {
    if (!this.myParticipant) {
      return html`<p class="empty-hint">${msg('Join the epoch to deploy operatives.')}</p>`;
    }

    const activeMissions = this.missions.filter((m) =>
      ['deploying', 'active', 'returning'].includes(m.status),
    );
    const completedMissions = this.missions.filter((m) =>
      ['success', 'failed', 'detected', 'captured'].includes(m.status),
    );

    const pulseClass = this.cycleJustResolved ? 'panel--pulse' : '';

    return html`
      <div class="overview">
        <div class="panel ${pulseClass}">
          <div class="panel__header">
            <h3 class="panel__title">${msg('Active Missions')} (${activeMissions.length})</h3>
          </div>
          <div class="panel__body">
            ${
              activeMissions.length > 0
                ? activeMissions.map((m) => this._renderMission(m))
                : html`<p class="empty-hint">${msg('No active missions.')}</p>`
            }
          </div>
        </div>

        <div class="panel ${pulseClass}">
          <div class="panel__header">
            <h3 class="panel__title">${msg('Intelligence')}</h3>
            ${
              this.threats.length > 0
                ? html`<span class="threat-count">${this.threats.length} ${msg('detected')}</span>`
                : nothing
            }
          </div>
          <div class="panel__body">
            ${
              this.threats.length > 0
                ? this.threats.map((m) => this._renderMission(m))
                : html`<p class="empty-hint">${msg('No threats detected.')}</p>`
            }
          </div>
        </div>

        <div class="panel panel--full-width ${pulseClass}">
          <div class="panel__header">
            <h3 class="panel__title">${msg('Mission History')} (${completedMissions.length})</h3>
          </div>
          <div class="panel__body">
            ${
              completedMissions.length > 0
                ? completedMissions.map((m) => this._renderMission(m))
                : html`<p class="empty-hint">${msg('No completed missions yet.')}</p>`
            }
          </div>
        </div>
      </div>
    `;
  }

  private _renderMission(m: OperativeMission) {
    const canRecall =
      ['deploying', 'active'].includes(m.status) &&
      !['completed', 'cancelled'].includes(this.epochStatus);
    const isDefensive = m.operative_type === 'guardian';
    const isCompleted = ['success', 'failed', 'detected', 'captured'].includes(m.status);
    const narrative = (m as OperativeMission & { mission_result?: { narrative?: string } })
      .mission_result?.narrative;

    return html`
      <div class="mission ${isDefensive ? 'mission--defensive' : 'mission--offensive'}">
        <div class="mission__icon">${getOperativeIcon(m.operative_type)}</div>
        <div class="mission__info">
          <div class="mission__type">
            ${m.operative_type}
            ${m.agents?.name ? html` &middot; ${m.agents.name}` : nothing}
            ${m.target_sim?.name ? html` &rarr; ${m.target_sim.name}` : nothing}
          </div>
          <div class="mission__detail">
            ${
              m.success_probability != null && m.operative_type !== 'guardian'
                ? html`${Math.round(m.success_probability * 100)}% ${msg('success')}`
                : nothing
            }
            ${m.cost_rp ? html` &middot; ${m.cost_rp} RP` : nothing}
          </div>
          ${isCompleted && narrative ? html`<div class="mission__narrative">${narrative}</div>` : nothing}
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
    'velg-epoch-operations-tab': VelgEpochOperationsTab;
  }
}

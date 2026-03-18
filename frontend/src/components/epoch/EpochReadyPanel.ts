/**
 * EpochReadyPanel — cycle readiness dashboard with segmented progress bar.
 *
 * Shows "4/6 Ready for Resolution" with a segmented bar where each participant
 * is a segment (lit amber = ready, dim = not ready). Participant list with
 * check/dash icons. Toggle button to signal or revoke readiness.
 *
 * Only displayed during active epoch phases (foundation/competition/reckoning).
 */

import { localized, msg } from '@lit/localize';
import { effect } from '@preact/signals-core';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { epochChatApi } from '../../services/api/EpochChatApiService.js';
import { realtimeService } from '../../services/realtime/RealtimeService.js';
import type { EpochParticipant } from '../../types/index.js';
import { VelgToast } from '../shared/Toast.js';

@localized()
@customElement('velg-epoch-ready-panel')
export class VelgEpochReadyPanel extends LitElement {
  static styles = css`
    :host {
      --amber: var(--color-warning);
      --amber-dim: var(--color-warning-hover);
      --amber-glow: color-mix(in srgb, var(--color-warning) 15%, transparent);
      --panel-bg: var(--color-surface-sunken);
      --surface: var(--color-surface);
      --border-dim: var(--color-border);
      --text-bright: var(--color-text-primary);
      --text-mid: var(--color-text-tertiary);
      --text-dim: var(--color-text-muted);
      display: block;
      font-family: var(--font-brutalist, 'Courier New', monospace);
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--space-3, 12px);
    }

    .header__label {
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 2.5px;
      text-transform: uppercase;
      color: var(--text-dim);
    }

    .header__count {
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 1px;
      color: var(--amber);
    }

    /* ── Segmented bar ── */
    .bar {
      display: flex;
      gap: 3px;
      height: 8px;
      margin-bottom: var(--space-3, 12px);
    }

    .bar__seg {
      flex: 1;
      border-radius: 1px;
      transition: background 0.4s, box-shadow 0.4s;
    }

    .bar__seg--ready {
      background: var(--amber);
      box-shadow: 0 0 6px var(--amber-glow);
    }

    .bar__seg--waiting {
      background: var(--border-dim);
    }

    /* ── Sweep animation on cycle resolve ── */
    .bar__seg--sweep {
      animation: seg-sweep 0.6s ease-out forwards;
      animation-delay: calc(var(--seg-i, 0) * 80ms);
    }

    @keyframes seg-sweep {
      0% { background: var(--amber); box-shadow: 0 0 12px var(--amber); }
      100% { background: var(--border-dim); box-shadow: none; }
    }

    /* ── Participant list ── */
    .participants {
      display: flex;
      flex-direction: column;
      gap: 1px;
      margin-bottom: var(--space-3, 12px);
    }

    .participant {
      display: flex;
      align-items: center;
      gap: var(--space-2, 8px);
      padding: var(--space-1, 4px) var(--space-2, 8px);
      background: var(--surface);
      transition: background 0.15s;
    }

    .participant:hover {
      background: var(--surface);
    }

    .participant__icon {
      width: 14px;
      height: 14px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
    }

    .participant__icon--ready {
      color: var(--amber);
    }

    .participant__icon--waiting {
      color: var(--text-dim);
    }

    .participant__name {
      font-size: var(--text-sm, 13px);
      color: var(--text-mid);
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .participant__tag {
      font-size: 9px;
      font-weight: 900;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      padding: 1px 6px;
    }

    .participant__tag--ready {
      color: var(--amber);
      border: 1px solid color-mix(in srgb, var(--amber) 30%, transparent);
    }

    .participant__tag--waiting {
      color: var(--text-dim);
      border: 1px solid var(--border-dim);
    }

    .participant__bot-tag {
      font-size: 8px;
      font-weight: 900;
      letter-spacing: 1px;
      text-transform: uppercase;
      padding: 0 4px;
      color: var(--amber);
      border: 1px solid color-mix(in srgb, var(--amber) 30%, transparent);
    }

    .participant__tag--auto {
      color: var(--text-dim);
      border: 1px solid var(--border-dim);
      font-style: italic;
    }

    .bar__seg--bot {
      background: color-mix(in srgb, var(--amber) 25%, var(--border-dim));
      opacity: 0.6;
    }

    /* ── Toggle button ── */
    .ready-btn {
      width: 100%;
      padding: var(--space-2, 8px) var(--space-4, 16px);
      border: 2px solid;
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 2.5px;
      text-transform: uppercase;
      cursor: pointer;
      transition: all 0.2s;
      background: transparent;
    }

    .ready-btn--signal {
      border-color: var(--amber);
      color: var(--amber);
    }

    .ready-btn--signal:hover:not(:disabled) {
      background: color-mix(in srgb, var(--amber) 10%, transparent);
      box-shadow: 0 0 16px var(--amber-glow);
    }

    .ready-btn--revoke {
      border-color: var(--border-dim);
      color: var(--text-dim);
    }

    .ready-btn--revoke:hover:not(:disabled) {
      border-color: var(--color-danger);
      color: var(--color-danger);
    }

    .ready-btn:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }
  `;

  @property() epochId = '';
  @property({ type: Array }) participants: EpochParticipant[] = [];
  @property() mySimulationId = '';
  @property() epochStatus = '';

  @state() private _readyStates: Record<string, boolean> = {};
  @state() private _toggling = false;
  @state() private _sweeping = false;

  private _disposeEffect?: () => void;

  private _disposeCycleEffect?: () => void;

  connectedCallback() {
    super.connectedCallback();
    this._disposeEffect = effect(() => {
      this._readyStates = realtimeService.readyStates.value;
    });
    this._disposeCycleEffect = effect(() => {
      const resolved = realtimeService.cycleResolved.value;
      if (resolved && resolved.epoch_id === this.epochId) {
        this._triggerSweep();
      }
    });
  }

  disconnectedCallback() {
    this._disposeEffect?.();
    this._disposeCycleEffect?.();
    super.disconnectedCallback();
  }

  private _isActivePhase(): boolean {
    return ['foundation', 'competition', 'reckoning'].includes(this.epochStatus);
  }

  private _getHumans(): EpochParticipant[] {
    return this.participants.filter((p) => !p.is_bot);
  }

  private _getHumanReadyCount(): number {
    return this._getHumans().filter((p) => this._readyStates[p.simulation_id]).length;
  }

  private _isMyReady(): boolean {
    return this._readyStates[this.mySimulationId] ?? false;
  }

  private async _toggleReady() {
    if (this._toggling || !this.mySimulationId) return;
    this._toggling = true;

    const newReady = !this._isMyReady();
    const result = await epochChatApi.setReady(this.epochId, this.mySimulationId, newReady);

    if (result.success) {
      // Optimistic update — Realtime broadcast may not be connected yet
      realtimeService.readyStates.value = {
        ...realtimeService.readyStates.value,
        [this.mySimulationId]: newReady,
      };

      // Handle auto-resolve: backend resolved the cycle because all humans were ready
      const data = result.data as { auto_resolved?: boolean; new_cycle?: number } | undefined;
      if (data?.auto_resolved) {
        const newCycle = data.new_cycle ?? 0;
        // Reset all ready states immediately — backend already set cycle_ready=false
        const resetStates: Record<string, boolean> = {};
        for (const p of this.participants) {
          resetStates[p.simulation_id] = false;
        }
        realtimeService.readyStates.value = resetStates;
        realtimeService.broadcastCycleResolved(this.epochId, newCycle);
        VelgToast.success(msg('All players ready. Cycle resolved automatically.'));
        this._triggerSweep();
      }
    } else {
      VelgToast.error(msg('Failed to update ready signal.'));
    }
    this._toggling = false;
  }

  private _triggerSweep() {
    this._sweeping = true;
    const totalDuration = this.participants.length * 80 + 600;
    setTimeout(() => {
      this._sweeping = false;
    }, totalDuration);
  }

  protected render() {
    if (!this._isActivePhase()) return nothing;

    const humans = this._getHumans();
    const humanReadyCount = this._getHumanReadyCount();
    const myReady = this._isMyReady();

    return html`
      <div class="header">
        <span class="header__label">${msg('Cycle Readiness')}</span>
        <span class="header__count">${humanReadyCount}/${humans.length}</span>
      </div>

      <!-- Segmented progress bar (humans only) -->
      <div class="bar">
        ${humans.map((p, i) => {
          const ready = this._readyStates[p.simulation_id] ?? false;
          const sweepClass = this._sweeping ? 'bar__seg--sweep' : '';
          return html`<div class="bar__seg ${ready ? 'bar__seg--ready' : 'bar__seg--waiting'} ${sweepClass}" style="--seg-i:${i}"></div>`;
        })}
      </div>

      <!-- Participant list -->
      <div class="participants">
        ${this.participants.map((p) => {
          const ready = this._readyStates[p.simulation_id] ?? false;
          const name = (p.simulations as { name: string } | undefined)?.name ?? p.simulation_id;
          if (p.is_bot) {
            return html`
              <div class="participant">
                <span class="participant__icon participant__icon--waiting">\u2014</span>
                <span class="participant__name">${name}<span class="participant__bot-tag">${msg('BOT')}</span></span>
                <span class="participant__tag participant__tag--auto">${msg('Auto')}</span>
              </div>
            `;
          }
          return html`
            <div class="participant">
              <span class="participant__icon ${ready ? 'participant__icon--ready' : 'participant__icon--waiting'}">
                ${ready ? '\u2713' : '\u2014'}
              </span>
              <span class="participant__name">${name}</span>
              <span class="participant__tag ${ready ? 'participant__tag--ready' : 'participant__tag--waiting'}">
                ${ready ? msg('Ready') : msg('Waiting')}
              </span>
            </div>
          `;
        })}
      </div>

      <!-- Toggle button -->
      ${
        this.mySimulationId
          ? html`
          <button
            class="ready-btn ${myReady ? 'ready-btn--revoke' : 'ready-btn--signal'}"
            @click=${this._toggleReady}
            ?disabled=${this._toggling}
          >
            ${myReady ? msg('Revoke Ready') : msg('Signal Ready')}
          </button>
        `
          : nothing
      }
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-epoch-ready-panel': VelgEpochReadyPanel;
  }
}

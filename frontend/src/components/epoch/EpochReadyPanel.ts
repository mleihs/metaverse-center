/**
 * EpochReadyPanel — cycle readiness dashboard with deadline countdown,
 * activity gate, pass-cycle button, and segmented progress bar.
 *
 * Shows countdown timer (when auto-resolve is active), participant readiness
 * with acted/waiting badges, a pass-cycle button for explicit holds, and
 * a ready button gated on has_acted_this_cycle.
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

/** Minutes remaining threshold for danger glow effect. */
const DANGER_THRESHOLD_MIN = 5;

@localized()
@customElement('velg-epoch-ready-panel')
export class VelgEpochReadyPanel extends LitElement {
  static styles = css`
    :host {
      --_amber: var(--color-warning);
      --_amber-dim: var(--color-warning-hover);
      --_amber-glow: color-mix(in srgb, var(--color-warning) 15%, transparent);
      --_danger: var(--color-danger);
      --_danger-glow: color-mix(in srgb, var(--color-danger) 20%, transparent);
      --_success: var(--color-success);
      --_panel-bg: var(--color-surface-sunken);
      --_surface: var(--color-surface);
      --_border-dim: var(--color-border);
      --_text-bright: var(--color-text-primary);
      --_text-mid: var(--color-text-tertiary);
      --_text-dim: var(--color-text-muted);
      display: block;
      font-family: var(--font-brutalist, 'Courier New', monospace);
    }

    /* ── Countdown Timer ── */
    .countdown {
      display: flex;
      align-items: center;
      gap: var(--space-2, 8px);
      margin-bottom: var(--space-3, 12px);
      padding: var(--space-2, 8px);
      border: 1px dashed var(--_border-dim);
      transition: border-color 0.3s, box-shadow 0.3s;
    }

    .countdown--danger {
      border-color: var(--_danger);
      box-shadow: inset 0 0 12px var(--_danger-glow);
      animation: danger-pulse 1.5s ease-in-out infinite;
    }

    @keyframes danger-pulse {
      0%,
      100% {
        box-shadow: inset 0 0 8px var(--_danger-glow);
      }
      50% {
        box-shadow: inset 0 0 20px var(--_danger-glow);
      }
    }

    .countdown__icon {
      font-size: 14px;
      color: var(--_text-dim);
      flex-shrink: 0;
    }

    .countdown--danger .countdown__icon {
      color: var(--_danger);
    }

    .countdown__text {
      font-size: var(--text-xs, 10px);
      font-weight: 900;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: var(--_text-mid);
      flex: 1;
    }

    .countdown--danger .countdown__text {
      color: var(--_danger);
    }

    .countdown__bar {
      flex: 1;
      height: 4px;
      background: var(--_border-dim);
      position: relative;
      overflow: hidden;
    }

    .countdown__fill {
      position: absolute;
      top: 0;
      left: 0;
      height: 100%;
      background: var(--_amber);
      transition: width 1s linear;
    }

    .countdown--danger .countdown__fill {
      background: var(--_danger);
    }

    /* ── Header ── */
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--space-3, 12px);
    }

    .header__label {
      font-size: var(--text-xs, 10px);
      font-weight: 900;
      letter-spacing: 2.5px;
      text-transform: uppercase;
      color: var(--_text-dim);
    }

    .header__count {
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 1px;
      color: var(--_amber);
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
      background: var(--_amber);
      box-shadow: 0 0 6px var(--_amber-glow);
    }

    .bar__seg--waiting {
      background: var(--_border-dim);
    }

    .bar__seg--sweep {
      animation: seg-sweep 0.6s ease-out forwards;
      animation-delay: calc(var(--seg-i, 0) * 80ms);
    }

    @keyframes seg-sweep {
      0% {
        background: var(--_amber);
        box-shadow: 0 0 12px var(--_amber);
      }
      100% {
        background: var(--_border-dim);
        box-shadow: none;
      }
    }

    .bar__seg--bot {
      background: color-mix(in srgb, var(--_amber) 25%, var(--_border-dim));
      opacity: 0.6;
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
      background: var(--_surface);
      transition: background 0.15s;
    }

    .participant:hover {
      background: var(--_surface);
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
      color: var(--_amber);
    }

    .participant__icon--waiting {
      color: var(--_text-dim);
    }

    .participant__name {
      font-size: var(--text-sm, 13px);
      color: var(--_text-mid);
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
      color: var(--_amber);
      border: 1px solid color-mix(in srgb, var(--_amber) 30%, transparent);
    }

    .participant__tag--waiting {
      color: var(--_text-dim);
      border: 1px solid var(--_border-dim);
    }

    .participant__tag--acted {
      color: var(--_success);
      border: 1px solid color-mix(in srgb, var(--_success) 30%, transparent);
    }

    .participant__tag--afk {
      color: var(--_danger);
      border: 1px solid color-mix(in srgb, var(--_danger) 30%, transparent);
    }

    .participant__bot-tag {
      font-size: 8px;
      font-weight: 900;
      letter-spacing: 1px;
      text-transform: uppercase;
      padding: 0 4px;
      color: var(--_amber);
      border: 1px solid color-mix(in srgb, var(--_amber) 30%, transparent);
    }

    .participant__tag--auto {
      color: var(--_text-dim);
      border: 1px solid var(--_border-dim);
      font-style: italic;
    }

    /* ── Buttons ── */
    .actions {
      display: flex;
      gap: var(--space-2, 8px);
    }

    .action-btn {
      flex: 1;
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

    .action-btn:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }

    .action-btn:focus-visible {
      outline: var(--ring-focus);
      outline-offset: 2px;
    }

    .action-btn--pass {
      border-color: var(--_border-dim);
      color: var(--_text-dim);
    }

    .action-btn--pass:hover:not(:disabled) {
      border-color: var(--_text-mid);
      color: var(--_text-mid);
    }

    .action-btn--signal {
      border-color: var(--_amber);
      color: var(--_amber);
    }

    .action-btn--signal:hover:not(:disabled) {
      background: color-mix(in srgb, var(--_amber) 10%, transparent);
      box-shadow: 0 0 16px var(--_amber-glow);
    }

    .action-btn--revoke {
      border-color: var(--_border-dim);
      color: var(--_text-dim);
    }

    .action-btn--revoke:hover:not(:disabled) {
      border-color: var(--_danger);
      color: var(--_danger);
    }

    .gate-hint {
      font-size: var(--text-xs, 10px);
      color: var(--_text-dim);
      letter-spacing: 1px;
      text-align: center;
      margin-top: var(--space-1, 4px);
    }

    @media (prefers-reduced-motion: reduce) {
      *,
      *::before,
      *::after {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
      }
    }
  `;

  @property() epochId = '';
  @property({ type: Array }) participants: EpochParticipant[] = [];
  @property() mySimulationId = '';
  @property() epochStatus = '';
  /** ISO timestamp of cycle deadline (from epoch.cycle_deadline_at) */
  @property() cycleDeadlineAt = '';
  /** ISO timestamp of cycle start (from epoch.cycle_started_at) */
  @property() cycleStartedAt = '';
  /** Auto-resolve mode from epoch config */
  @property() autoResolveMode = 'manual';
  /** Whether action is required before ready */
  @property({ type: Boolean }) requireActionForReady = false;

  @state() private _readyStates: Record<string, boolean> = {};
  @state() private _toggling = false;
  @state() private _passing = false;
  @state() private _sweeping = false;
  @state() private _countdownText = '';
  @state() private _countdownPct = 0;
  @state() private _isDanger = false;

  private _disposeEffect?: () => void;
  private _disposeCycleEffect?: () => void;
  private _countdownTimer?: ReturnType<typeof setInterval>;

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
    this._startCountdown();
  }

  disconnectedCallback() {
    this._disposeEffect?.();
    this._disposeCycleEffect?.();
    this._stopCountdown();
    super.disconnectedCallback();
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has('cycleDeadlineAt') || changed.has('cycleStartedAt')) {
      this._stopCountdown();
      this._startCountdown();
    }
  }

  // ── Countdown logic ───────────────────────────────────

  private _hasDeadline(): boolean {
    return this.autoResolveMode !== 'manual' && !!this.cycleDeadlineAt;
  }

  private _startCountdown() {
    if (!this._hasDeadline()) return;
    this._updateCountdown();
    this._countdownTimer = setInterval(() => this._updateCountdown(), 1000);
  }

  private _stopCountdown() {
    if (this._countdownTimer) {
      clearInterval(this._countdownTimer);
      this._countdownTimer = undefined;
    }
  }

  private _updateCountdown() {
    if (!this.cycleDeadlineAt) return;

    const deadlineMs = new Date(this.cycleDeadlineAt).getTime();
    const remaining = deadlineMs - Date.now();

    if (remaining <= 0) {
      this._countdownText = msg('Resolving...');
      this._countdownPct = 100;
      this._isDanger = true;
      this._stopCountdown();
      return;
    }

    const hours = Math.floor(remaining / 3_600_000);
    const mins = Math.floor((remaining % 3_600_000) / 60_000);
    const secs = Math.floor((remaining % 60_000) / 1000);

    this._countdownText =
      hours > 0 ? `${hours}h ${mins}m` : mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

    // Progress percentage
    if (this.cycleStartedAt) {
      const startMs = new Date(this.cycleStartedAt).getTime();
      const total = deadlineMs - startMs;
      this._countdownPct = total > 0 ? Math.round(((total - remaining) / total) * 100) : 0;
    }

    this._isDanger = remaining < DANGER_THRESHOLD_MIN * 60_000;
  }

  // ── State helpers ─────────────────────────────────────

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

  private _myParticipant(): EpochParticipant | undefined {
    return this.participants.find((p) => p.simulation_id === this.mySimulationId);
  }

  private _hasMyActed(): boolean {
    return this._myParticipant()?.has_acted_this_cycle ?? false;
  }

  private _isReadyGated(): boolean {
    return (
      this.requireActionForReady &&
      this.autoResolveMode !== 'manual' &&
      !this._hasMyActed() &&
      !this._myParticipant()?.is_bot
    );
  }

  // ── Actions ───────────────────────────────────────────

  private async _toggleReady() {
    if (this._toggling || !this.mySimulationId) return;
    this._toggling = true;

    const newReady = !this._isMyReady();
    const result = await epochChatApi.setReady(this.epochId, this.mySimulationId, newReady);

    if (result.success) {
      realtimeService.readyStates.value = {
        ...realtimeService.readyStates.value,
        [this.mySimulationId]: newReady,
      };

      const data = result.data as { auto_resolved?: boolean; new_cycle?: number } | undefined;
      if (data?.auto_resolved) {
        const newCycle = data.new_cycle ?? 0;
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
      const detail = (result as { detail?: string }).detail ?? '';
      if (detail.includes('at least one action')) {
        VelgToast.warning(msg('You must act or pass before signalling ready.'));
      } else {
        VelgToast.error(msg('Failed to update ready signal.'));
      }
    }
    this._toggling = false;
  }

  private async _passCycle() {
    if (this._passing || !this.mySimulationId) return;
    this._passing = true;

    const result = await epochChatApi.passCycle(this.epochId, this.mySimulationId);
    if (result.success) {
      VelgToast.info(msg('Cycle passed. You can now signal ready.'));
      this.dispatchEvent(
        new CustomEvent('player-acted', {
          bubbles: true,
          composed: true,
          detail: { simulation_id: this.mySimulationId },
        }),
      );
    } else {
      VelgToast.error(msg('Failed to pass cycle.'));
    }
    this._passing = false;
  }

  private _triggerSweep() {
    this._sweeping = true;
    const totalDuration = this.participants.length * 80 + 600;
    setTimeout(() => {
      this._sweeping = false;
    }, totalDuration);
  }

  // ── Render ────────────────────────────────────────────

  protected render() {
    if (!this._isActivePhase()) return nothing;

    const humans = this._getHumans();
    const humanReadyCount = this._getHumanReadyCount();
    const myReady = this._isMyReady();
    const readyGated = this._isReadyGated();
    const hasDeadline = this._hasDeadline();

    return html`
      ${hasDeadline ? this._renderCountdown() : nothing}

      <div class="header">
        <span class="header__label">${msg('Cycle Readiness')}</span>
        <span class="header__count">${humanReadyCount}/${humans.length}</span>
      </div>

      <div class="bar">
        ${humans.map((p, i) => {
          const ready = this._readyStates[p.simulation_id] ?? false;
          const sweepClass = this._sweeping ? 'bar__seg--sweep' : '';
          return html`<div
            class="bar__seg ${ready ? 'bar__seg--ready' : 'bar__seg--waiting'} ${sweepClass}"
            style="--seg-i:${i}"
          ></div>`;
        })}
      </div>

      <div class="participants">
        ${this.participants.map((p) => this._renderParticipant(p))}
      </div>

      ${this.mySimulationId ? this._renderActions(myReady, readyGated) : nothing}
    `;
  }

  private _renderCountdown() {
    const dangerClass = this._isDanger ? 'countdown--danger' : '';
    return html`
      <div class="countdown ${dangerClass}" role="timer" aria-label=${msg('Cycle deadline countdown')}>
        <span class="countdown__icon">\u23F1</span>
        <span class="countdown__text">${this._countdownText}</span>
        <div class="countdown__bar">
          <div class="countdown__fill" style="width:${this._countdownPct}%"></div>
        </div>
      </div>
    `;
  }

  private _renderParticipant(p: EpochParticipant) {
    const ready = this._readyStates[p.simulation_id] ?? false;
    const name = (p.simulations as { name: string } | undefined)?.name ?? p.simulation_id;
    const acted = p.has_acted_this_cycle ?? false;
    const afkReplaced = p.afk_replaced_by_ai ?? false;

    if (p.is_bot) {
      return html`
        <div class="participant">
          <span class="participant__icon participant__icon--waiting">\u2014</span>
          <span class="participant__name"
            >${name}${
              afkReplaced
                ? html`<span class="participant__tag participant__tag--afk">${msg('AI')}</span>`
                : html`<span class="participant__bot-tag">${msg('BOT')}</span>`
            }</span
          >
          <span class="participant__tag participant__tag--auto">${msg('Auto')}</span>
        </div>
      `;
    }

    return html`
      <div class="participant">
        <span
          class="participant__icon ${ready ? 'participant__icon--ready' : 'participant__icon--waiting'}"
        >
          ${ready ? '\u2713' : '\u2014'}
        </span>
        <span class="participant__name">${name}</span>
        ${
          acted && !ready
            ? html`<span class="participant__tag participant__tag--acted">${msg('Acted')}</span>`
            : nothing
        }
        <span class="participant__tag ${ready ? 'participant__tag--ready' : 'participant__tag--waiting'}">
          ${ready ? msg('Ready') : msg('Waiting')}
        </span>
      </div>
    `;
  }

  private _renderActions(myReady: boolean, readyGated: boolean) {
    const showPass = this.autoResolveMode !== 'manual' && !this._hasMyActed() && !myReady;

    return html`
      <div class="actions">
        ${
          showPass
            ? html`
              <button
                class="action-btn action-btn--pass"
                @click=${this._passCycle}
                ?disabled=${this._passing}
                aria-label=${msg('Pass this cycle without action')}
              >
                ${this._passing ? msg('Passing...') : msg('Pass')}
              </button>
            `
            : nothing
        }
        <button
          class="action-btn ${myReady ? 'action-btn--revoke' : 'action-btn--signal'}"
          @click=${this._toggleReady}
          ?disabled=${this._toggling || (readyGated && !myReady)}
          aria-label=${myReady ? msg('Revoke ready signal') : msg('Signal ready for cycle resolution')}
        >
          ${myReady ? msg('Revoke Ready') : msg('Signal Ready')}
        </button>
      </div>
      ${
        readyGated && !myReady
          ? html`<div class="gate-hint">${msg('Act or pass before signalling ready')}</div>`
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

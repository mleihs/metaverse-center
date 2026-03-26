import { localized, msg } from '@lit/localize';
import { formatElapsedMs } from '../../utils/date-format.js';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

/**
 * Shared cinematic scan overlay for Forge generation phases.
 * CRT scanlines, sonar sweep, cycling phase labels, signal lock pips, progress bar.
 *
 * When `estimatedDurationMs > 0`, activates time-based mode:
 * - Phases loop endlessly (modulo) instead of stalling on the last
 * - Mission clock + ETA countdown displayed
 * - Asymptotic progress bar that never stalls or hits 100%
 *
 * When `estimatedDurationMs` is 0 (default), behaves identically to the
 * original phase-count-based overlay for backward compatibility.
 */
@localized()
@customElement('velg-forge-scan-overlay')
export class VelgForgeScanOverlay extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    :host(:not([active])) {
      display: none;
    }

    .scan-overlay {
      position: relative;
      background: rgba(3 7 18 / 0.96);
      border: 1px solid rgba(74 222 128 / 0.15);
      padding: var(--space-8) var(--space-6);
      overflow: hidden;
      min-height: 280px;
      height: 100%;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: var(--space-6);
    }

    /* Vertical sonar sweep line */
    .scan-overlay::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 2px;
      height: 100%;
      background: var(--color-success);
      box-shadow:
        0 0 8px var(--color-success),
        0 0 30px rgba(74 222 128 / 0.3),
        4px 0 60px rgba(74 222 128 / 0.08);
      animation: sonar-sweep 3s ease-in-out infinite;
    }

    /* Faint horizontal grid lines */
    .scan-overlay::after {
      content: '';
      position: absolute;
      inset: 0;
      background:
        repeating-linear-gradient(
          0deg,
          transparent,
          transparent 39px,
          rgba(74 222 128 / 0.04) 39px,
          rgba(74 222 128 / 0.04) 40px
        ),
        repeating-linear-gradient(
          90deg,
          transparent,
          transparent 79px,
          rgba(74 222 128 / 0.03) 79px,
          rgba(74 222 128 / 0.03) 80px
        );
      pointer-events: none;
    }

    @keyframes sonar-sweep {
      0% { left: -2px; opacity: 1; }
      100% { left: calc(100% + 2px); opacity: 0.4; }
    }

    /* CRT scanline flicker */
    .scan-overlay__crt {
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 1px,
        rgba(0 0 0 / 0.08) 1px,
        rgba(0 0 0 / 0.08) 2px
      );
      pointer-events: none;
      z-index: 1;
    }

    /* Phase status readout */
    .scan-status {
      position: relative;
      z-index: 2;
      text-align: center;
    }

    .scan-status__label {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.2em;
      color: rgba(74 222 128 / 0.85);
      margin-bottom: var(--space-3);
    }

    .scan-status__phase {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-lg);
      color: var(--color-success);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      text-shadow: 0 0 12px rgba(74 222 128 / 0.5);
      animation: phase-glow 2s ease-in-out infinite;
      min-height: 1.5em;
    }

    @keyframes phase-glow {
      0%, 100% { opacity: 1; text-shadow: 0 0 12px rgba(74 222 128 / 0.5); }
      50% { opacity: 0.85; text-shadow: 0 0 20px rgba(74 222 128 / 0.7); }
    }

    /* Cursor blink after phase text */
    .scan-status__cursor {
      display: inline-block;
      width: 2px;
      height: 1.1em;
      background: var(--color-success);
      margin-left: 4px;
      vertical-align: text-bottom;
      animation: cursor-blink 0.8s steps(1) infinite;
    }

    @keyframes cursor-blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0; }
    }

    /* Signal lock indicators (pips) */
    .scan-locks {
      display: flex;
      gap: var(--space-4);
      position: relative;
      z-index: 2;
    }

    .scan-lock {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-2);
    }

    .scan-lock__pip {
      width: 10px;
      height: 10px;
      border: 1px solid rgba(74 222 128 / 0.3);
      background: transparent;
      transition: all 0.6s cubic-bezier(0.22, 1, 0.36, 1);
    }

    .scan-lock__pip--active {
      background: var(--color-success);
      border-color: var(--color-success);
      box-shadow: 0 0 8px rgba(74 222 128 / 0.6);
    }

    .scan-lock__label {
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: rgba(74 222 128 / 0.85);
      transition: color 0.6s;
    }

    .scan-lock--active .scan-lock__label {
      color: rgba(74 222 128 / 1.0);
    }

    /* Progress bar */
    .scan-progress {
      width: 200px;
      height: 2px;
      background: rgba(74 222 128 / 0.15);
      position: relative;
      z-index: 2;
      overflow: hidden;
    }

    .scan-progress__fill {
      height: 100%;
      background: var(--color-success);
      box-shadow: 0 0 6px var(--color-success);
      transition: width 2s ease-out;
    }

    /* Seed echo — user's seed prompt displayed during scan */
    .scan-seed-echo {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      color: rgba(74 222 128 / 0.7);
      max-width: 400px;
      text-align: center;
      font-style: italic;
      position: relative;
      z-index: 2;
    }

    /* Timer row — time-based mode only */
    .scan-timer {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      position: relative;
      z-index: 2;
    }

    .scan-timer__elapsed {
      color: rgba(74 222 128 / 0.7);
    }

    .scan-timer__eta {
      color: rgba(74 222 128 / 0.5);
    }

    .scan-timer__recalibrating {
      color: rgba(245 158 11 / 0.7);
      animation: recalibrate-pulse 1.5s infinite;
    }

    @keyframes recalibrate-pulse {
      0%, 100% { opacity: 0.7; }
      50% { opacity: 0.3; }
    }

    /* === Recovery mode — amber takeover === */

    :host([recovering]) .scan-overlay {
      border-color: rgba(245 158 11 / 0.2);
      transition: border-color 0.6s ease;
    }

    :host([recovering]) .scan-overlay::before {
      background: var(--color-warning);
      box-shadow:
        0 0 8px var(--color-warning),
        0 0 30px rgba(245 158 11 / 0.3),
        4px 0 60px rgba(245 158 11 / 0.08);
      animation: sonar-sweep 4.5s ease-in-out infinite;
    }

    :host([recovering]) .scan-overlay::after {
      background:
        repeating-linear-gradient(
          0deg,
          transparent,
          transparent 39px,
          rgba(245 158 11 / 0.04) 39px,
          rgba(245 158 11 / 0.04) 40px
        ),
        repeating-linear-gradient(
          90deg,
          transparent,
          transparent 79px,
          rgba(245 158 11 / 0.03) 79px,
          rgba(245 158 11 / 0.03) 80px
        );
    }

    :host([recovering]) .scan-status__label {
      color: rgba(245 158 11 / 0.85);
      transition: color 0.6s ease;
    }

    :host([recovering]) .scan-status__phase {
      color: var(--color-warning);
      text-shadow: 0 0 12px rgba(245 158 11 / 0.5);
      animation: phase-glow-amber 2s ease-in-out infinite;
    }

    @keyframes phase-glow-amber {
      0%, 100% { opacity: 1; text-shadow: 0 0 12px rgba(245 158 11 / 0.5); }
      50% { opacity: 0.85; text-shadow: 0 0 20px rgba(245 158 11 / 0.7); }
    }

    :host([recovering]) .scan-status__cursor {
      background: var(--color-warning);
    }

    :host([recovering]) .scan-seed-echo {
      color: rgba(245 158 11 / 0.5);
      transition: color 0.6s ease;
    }

    /* Pips: all flash amber in recovery */
    :host([recovering]) .scan-lock__pip {
      border-color: rgba(245 158 11 / 0.4);
      background: var(--color-warning);
      box-shadow: 0 0 8px rgba(245 158 11 / 0.5);
      animation: pip-flash 1.2s ease-in-out infinite;
    }

    :host([recovering]) .scan-lock__label {
      color: rgba(245 158 11 / 0.85);
    }

    @keyframes pip-flash {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.2; }
    }

    /* Progress bar: locked at 95%, pulsing amber */
    :host([recovering]) .scan-progress {
      background: rgba(245 158 11 / 0.12);
    }

    :host([recovering]) .scan-progress__fill {
      background: var(--color-warning);
      box-shadow: 0 0 6px var(--color-warning);
      animation: progress-pulse 2s ease-in-out infinite;
    }

    @keyframes progress-pulse {
      0%, 100% { box-shadow: 0 0 6px var(--color-warning); }
      50% { box-shadow: 0 0 14px var(--color-warning), 0 0 24px rgba(245 158 11 / 0.3); }
    }

    :host([recovering]) .scan-timer__elapsed {
      color: rgba(245 158 11 / 0.7);
    }

    .scan-timer__recovering {
      color: rgba(245 158 11 / 0.8);
      animation: recalibrate-pulse 1.5s infinite;
    }

    /* Entity counter ("3 / 6") */
    .scan-entity-counter {
      position: relative;
      z-index: 2;
      font-family: var(--font-mono, monospace);
      font-size: 32px;
      font-weight: 700;
      color: var(--color-success);
      text-shadow: 0 0 16px rgba(74 222 128 / 0.6), 0 0 40px rgba(74 222 128 / 0.2);
      letter-spacing: 0.15em;
      animation: entity-counter-breathe 2.5s ease-in-out infinite;
    }

    @keyframes entity-counter-breathe {
      0%, 100% {
        text-shadow: 0 0 16px rgba(74 222 128 / 0.6), 0 0 40px rgba(74 222 128 / 0.2);
        transform: scale(1);
      }
      50% {
        text-shadow: 0 0 24px rgba(74 222 128 / 0.8), 0 0 60px rgba(74 222 128 / 0.35);
        transform: scale(1.03);
      }
    }

    .scan-entity-counter__current {
      color: var(--color-success);
    }

    .scan-entity-counter__separator {
      color: rgba(74 222 128 / 0.4);
      margin: 0 2px;
    }

    .scan-entity-counter__total {
      color: rgba(74 222 128 / 0.5);
    }

    /* ── Mobile: full-viewport takeover during entity generation ── */

    @media (max-width: 767px) {
      :host([active][entity-mode]) {
        position: fixed !important;
        inset: 0 !important;
        z-index: var(--z-top) !important;
        animation: none !important;
      }

      :host([active][entity-mode]) .scan-overlay {
        min-height: 100vh;
        min-height: 100dvh;
        padding: var(--space-6) var(--space-4);
        border: none;
      }

      :host([active][entity-mode]) .scan-entity-counter {
        font-size: clamp(48px, 15vw, 72px);
        margin: var(--space-4) 0;
      }

      :host([active][entity-mode]) .scan-status__phase {
        font-size: var(--text-sm, 0.875rem);
        max-width: 85vw;
        line-height: 1.4;
      }

      :host([active][entity-mode]) .scan-progress {
        width: 70vw;
        height: 3px;
      }

      :host([active][entity-mode]) .scan-seed-echo {
        display: none;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .scan-overlay::before {
        animation: none;
        left: 0;
        width: 100%;
        height: 2px;
        opacity: 0.5;
      }
      .scan-status__phase {
        animation: none;
        opacity: 1;
      }
      .scan-status__cursor {
        animation: none;
        opacity: 1;
      }
      .scan-timer__recalibrating {
        animation: none;
      }
      :host([recovering]) .scan-lock__pip {
        animation: none;
        opacity: 1;
      }
      :host([recovering]) .scan-progress__fill {
        animation: none;
      }
      :host([recovering]) .scan-status__phase {
        animation: none;
        opacity: 1;
      }
      .scan-timer__recovering {
        animation: none;
      }
      .scan-entity-counter {
        animation: none;
      }
    }
  `;

  @property({ type: Boolean, reflect: true }) active = false;
  @property({ type: Boolean, reflect: true }) recovering = false;
  @property({ type: Array }) phases: string[] = [];
  @property({ type: Number }) phaseInterval = 2500;
  @property({ type: Array }) lockLabels: string[] = [];
  @property({ type: String }) headerLabel = '';
  @property({ type: String }) echoText = '';
  /** Estimated duration in ms. Activates time-based mode (looping phases, timer, ETA). */
  @property({ type: Number }) estimatedDurationMs = 0;
  /** Per-entity progress: current entity index (0-based). -1 = not in entity mode. */
  @property({ type: Number }) entityCurrent = -1;
  /** Per-entity progress: total entities to generate. 0 = not in entity mode. */
  @property({ type: Number }) entityTotal = 0;

  @state() private _scanPhase = 0;
  @state() private _elapsedMs = 0;
  private _scanTimer = 0;
  private _tickTimer = 0;
  private _startTime = 0;

  updated(changed: Map<string, unknown>) {
    if (changed.has('active')) {
      if (this.active) {
        this._scanPhase = 0;
        this._elapsedMs = 0;
        this._startTime = Date.now();
        this._advanceScanPhase();
        this._startTickTimer();
      } else {
        window.clearTimeout(this._scanTimer);
        this._stopTickTimer();
      }
    }
    // Reset per-entity timer when a new entity starts
    if (changed.has('entityCurrent') && this.entityCurrent >= 0) {
      this._startTime = Date.now();
      this._elapsedMs = 0;
    }
    // Reflect entity-mode attribute for mobile CSS takeover
    if (changed.has('entityTotal') || changed.has('entityCurrent')) {
      const isEntityMode = this.entityTotal > 0 && this.entityCurrent >= 0;
      this.toggleAttribute('entity-mode', isEntityMode);
    }
  }

  disconnectedCallback() {
    window.clearTimeout(this._scanTimer);
    this._stopTickTimer();
    super.disconnectedCallback();
  }

  private _startTickTimer() {
    this._stopTickTimer();
    if (this.estimatedDurationMs <= 0) return;
    this._tickTimer = window.setInterval(() => {
      this._elapsedMs = Date.now() - this._startTime;
    }, 1000);
  }

  private _stopTickTimer() {
    if (this._tickTimer) {
      window.clearInterval(this._tickTimer);
      this._tickTimer = 0;
    }
  }

  private _advanceScanPhase() {
    this._scanTimer = window.setTimeout(() => {
      if (!this.active || this.phases.length === 0) return;
      if (this.estimatedDurationMs > 0) {
        // Time-based mode: loop endlessly
        this._scanPhase = (this._scanPhase + 1) % this.phases.length;
      } else {
        // Legacy mode: stop at last phase
        if (this._scanPhase < this.phases.length - 1) {
          this._scanPhase++;
        }
      }
      this._advanceScanPhase();
    }, this.phaseInterval);
  }

  private _progressWidth(): number {
    if (this.recovering) return 95;
    if (this.phases.length === 0) return 0;

    // Entity mode: deterministic base + asymptotic sub-progress within current entity
    if (this.entityTotal > 0 && this.entityCurrent >= 0) {
      const basePercent = (this.entityCurrent / this.entityTotal) * 100;
      // Sub-progress within current entity based on elapsed time vs entity estimate
      if (this.estimatedDurationMs > 0 && this._elapsedMs > 0) {
        const entityElapsed = this._elapsedMs;
        const ratio = entityElapsed / this.estimatedDurationMs;
        const subPercent = ratio <= 0.9
          ? (ratio / 0.9) * 0.9
          : 0.9 + 0.08 * (1 - Math.exp(-(ratio - 0.9) * 2));
        const entitySlice = 100 / this.entityTotal;
        return Math.min(98, basePercent + subPercent * entitySlice);
      }
      return Math.min(98, basePercent);
    }

    if (this.estimatedDurationMs > 0) {
      // Asymptotic progress based on elapsed time vs estimate
      const ratio = this._elapsedMs / this.estimatedDurationMs;
      if (ratio <= 0.9) {
        // Linear 0→90% for the first 90% of estimated time
        return (ratio / 0.9) * 90;
      }
      // Beyond 90%: exponential decay approaching 98%
      const overshoot = ratio - 0.9;
      return 90 + 8 * (1 - Math.exp(-overshoot * 2));
    }

    // Legacy: phase-count-based
    return Math.min(95, (this._scanPhase + 1) * (100 / this.phases.length));
  }

  private _isLockActive(index: number): boolean {
    if (this.phases.length === 0 || this.lockLabels.length === 0) return false;
    // Entity mode: pips fill based on completed entities
    if (this.entityTotal > 0 && this.entityCurrent >= 0) {
      const threshold = Math.floor(((index + 1) * this.entityTotal) / (this.lockLabels.length + 1));
      return this.entityCurrent >= threshold;
    }
    const threshold = Math.floor(((index + 1) * this.phases.length) / (this.lockLabels.length + 1));
    return this._scanPhase >= threshold;
  }


  private _renderTimer() {
    if (this.estimatedDurationMs <= 0 && this.entityTotal <= 0) return nothing;

    if (this.recovering) {
      return html`
        <div class="scan-timer">
          <span class="scan-timer__elapsed">${msg('MISSION CLOCK')}: ${formatElapsedMs(this._elapsedMs)}</span>
          <span class="scan-timer__recovering">${msg('RECOVERING...')}</span>
        </div>
      `;
    }

    // Entity mode: ETA based on remaining entities × per-entity estimate
    if (this.entityTotal > 0 && this.entityCurrent >= 0 && this.estimatedDurationMs > 0) {
      const remaining = (this.entityTotal - this.entityCurrent) * this.estimatedDurationMs;
      return html`
        <div class="scan-timer">
          <span class="scan-timer__elapsed">${msg('MISSION CLOCK')}: ${formatElapsedMs(this._elapsedMs)}</span>
          <span class="scan-timer__eta">ETA: ~${formatElapsedMs(remaining)}</span>
        </div>
      `;
    }

    const remaining = this.estimatedDurationMs - this._elapsedMs;
    const isPastEstimate = remaining <= 0;

    return html`
      <div class="scan-timer">
        <span class="scan-timer__elapsed">${msg('MISSION CLOCK')}: ${formatElapsedMs(this._elapsedMs)}</span>
        ${isPastEstimate
          ? html`<span class="scan-timer__recalibrating">${msg('RECALIBRATING...')}</span>`
          : html`<span class="scan-timer__eta">ETA: ~${formatElapsedMs(remaining)}</span>`
        }
      </div>
    `;
  }

  private _recoveryPhases(): string[] {
    return [
      msg('Verifying Transmission Integrity...'),
      msg('Checking Data Persistence...'),
      msg('Awaiting Server Confirmation...'),
    ];
  }

  protected render() {
    if (!this.active) return nothing;

    const recoveryPhases = this._recoveryPhases();
    const currentPhase = this.recovering
      ? recoveryPhases[this._scanPhase % recoveryPhases.length]
      : (this.phases[this._scanPhase] ?? msg('Processing...'));
    const headerText = this.recovering
      ? msg('Signal Disrupted')
      : this.headerLabel;

    return html`
      <div class="scan-overlay" role="status" aria-live="polite" aria-label=${headerText || msg('Processing')}>
        <div class="scan-overlay__crt"></div>

        ${
          this.echoText && !this.recovering
            ? html`<div class="scan-seed-echo" aria-hidden="true">"${this.echoText}"</div>`
            : nothing
        }

        ${
          this.entityTotal > 0 && this.entityCurrent >= 0 && !this.recovering
            ? html`
          <div class="scan-entity-counter" aria-label="${this.entityCurrent + 1} of ${this.entityTotal}">
            <span class="scan-entity-counter__current">${this.entityCurrent + 1}</span>
            <span class="scan-entity-counter__separator">/</span>
            <span class="scan-entity-counter__total">${this.entityTotal}</span>
          </div>
        `
            : nothing
        }

        <div class="scan-status">
          ${
            headerText
              ? html`<div class="scan-status__label">${headerText}</div>`
              : nothing
          }
          <div class="scan-status__phase">
            ${currentPhase}<span class="scan-status__cursor"></span>
          </div>
        </div>

        ${
          this.lockLabels.length > 0
            ? html`
          <div class="scan-locks">
            ${this.lockLabels.map(
              (label, i) => html`
              <div class="scan-lock ${this._isLockActive(i) ? 'scan-lock--active' : ''}">
                <div class="scan-lock__pip ${this._isLockActive(i) ? 'scan-lock__pip--active' : ''}"></div>
                <span class="scan-lock__label">${label}</span>
              </div>
            `,
            )}
          </div>
        `
            : nothing
        }

        <div class="scan-progress">
          <div class="scan-progress__fill" style="width: ${this._progressWidth()}%"></div>
        </div>

        ${this._renderTimer()}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-forge-scan-overlay': VelgForgeScanOverlay;
  }
}

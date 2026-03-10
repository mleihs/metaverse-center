import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import type { ForgeAgentDraft, ForgeBuildingDraft } from '../../services/api/ForgeApiService.js';

import '../shared/VelgGameCard.js';

/**
 * Cinematic "Dimensional Breach" ceremony after shard materialization.
 * Self-contained 5-stage sequence driven by a timer-based state machine.
 * Accepts data via properties — no coupling to ForgeStateManager.
 *
 * Fires `ceremony-enter` when the user clicks "Enter New Shard".
 */
@localized()
@customElement('velg-forge-ceremony')
export class VelgForgeCeremony extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    /* ── Full-screen ceremony overlay ────────────── */

    .ceremony {
      position: fixed;
      inset: 0;
      z-index: var(--z-modal, 500);
      background:
        radial-gradient(ellipse at center, rgba(245 158 11 / 0.03) 0%, transparent 60%),
        repeating-linear-gradient(
          0deg,
          transparent,
          transparent 59px,
          rgba(245 158 11 / 0.02) 59px,
          rgba(245 158 11 / 0.02) 60px
        ),
        repeating-linear-gradient(
          90deg,
          transparent,
          transparent 59px,
          rgba(245 158 11 / 0.015) 59px,
          rgba(245 158 11 / 0.015) 60px
        ),
        #000;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      gap: var(--space-6, 1.5rem);
    }

    /* Vignette for depth */
    .ceremony::after {
      content: '';
      position: absolute;
      inset: 0;
      background: radial-gradient(ellipse at center, transparent 40%, rgba(0 0 0 / 0.6) 100%);
      pointer-events: none;
      z-index: 0;
    }

    /* ── Stage 1: Blackout + Breach ─────────────── */

    .ceremony__flash {
      position: absolute;
      inset: 0;
      background: #fff;
      opacity: 0;
      pointer-events: none;
      z-index: 10;
    }

    .ceremony--stage-1 .ceremony__flash {
      animation: flash-bang 300ms ease-out forwards;
    }

    @keyframes flash-bang {
      0%   { opacity: 0; }
      10%  { opacity: 0.9; }
      30%  { opacity: 0; }
      100% { opacity: 0; }
    }

    .ceremony__crack {
      position: absolute;
      top: 0;
      left: 50%;
      width: 0;
      height: 100%;
      transform: translateX(-50%);
      background: #f59e0b;
      box-shadow:
        0 0 12px rgba(245 158 11 / 0.6),
        0 0 40px rgba(245 158 11 / 0.3);
      z-index: 2;
      transition: width 0.3s ease-out;
    }

    .ceremony--stage-1 .ceremony__crack {
      width: 2px;
      animation: crack-pulse 1.2s ease-in-out infinite;
    }

    .ceremony--stage-2 .ceremony__crack {
      width: 6px;
    }

    @keyframes crack-pulse {
      0%, 100% { box-shadow: 0 0 12px rgba(245 158 11 / 0.4), 0 0 40px rgba(245 158 11 / 0.15); }
      50%      { box-shadow: 0 0 20px rgba(245 158 11 / 0.8), 0 0 60px rgba(245 158 11 / 0.4); }
    }

    /* CSS shake for stage 1 */
    .ceremony--stage-1 {
      animation: stage-shake 0.15s linear infinite;
    }

    @keyframes stage-shake {
      0%   { transform: translate(0, 0); }
      25%  { transform: translate(1px, -1px); }
      50%  { transform: translate(-1px, 1px); }
      75%  { transform: translate(1px, 1px); }
      100% { transform: translate(-1px, -1px); }
    }

    /* ── CRT Scanlines (all stages) ──────────────── */

    .ceremony__crt {
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
      z-index: 3;
      opacity: 1;
      transition: opacity 1s ease-out;
    }

    .ceremony--stage-5 .ceremony__crt {
      opacity: 0;
    }

    /* ── Stage 2: Dimensional Scan ──────────────── */

    .ceremony__scan {
      position: relative;
      z-index: 4;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-6, 1.5rem);
      opacity: 0;
      transition: opacity 0.4s ease-out;
    }

    .ceremony--stage-2 .ceremony__scan {
      opacity: 1;
    }

    .ceremony--stage-3 .ceremony__scan,
    .ceremony--stage-4 .ceremony__scan,
    .ceremony--stage-5 .ceremony__scan {
      opacity: 0;
      pointer-events: none;
    }

    .ceremony__phase-text {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-lg, 1.125rem);
      color: #f59e0b;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      text-shadow: 0 0 12px rgba(245 158 11 / 0.5);
      min-height: 1.5em;
      text-align: center;
    }

    .ceremony__cursor {
      display: inline-block;
      width: 2px;
      height: 1.1em;
      background: #f59e0b;
      margin-left: 4px;
      vertical-align: text-bottom;
      animation: cursor-blink 0.8s steps(1) infinite;
    }

    @keyframes cursor-blink {
      0%, 100% { opacity: 1; }
      50%      { opacity: 0; }
    }

    /* Signal lock pips */
    .ceremony__locks {
      display: flex;
      gap: var(--space-4, 1rem);
    }

    .ceremony__lock {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-2, 0.5rem);
    }

    .ceremony__pip {
      width: 10px;
      height: 10px;
      border: 1px solid rgba(245 158 11 / 0.3);
      background: transparent;
      transition: all 0.6s cubic-bezier(0.22, 1, 0.36, 1);
    }

    .ceremony__pip--active {
      background: #f59e0b;
      border-color: #f59e0b;
      box-shadow: 0 0 8px rgba(245 158 11 / 0.6);
    }

    .ceremony__lock-label {
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: rgba(245 158 11 / 0.5);
      transition: color 0.6s;
    }

    .ceremony__pip--active + .ceremony__lock-label,
    .ceremony__lock--active .ceremony__lock-label {
      color: rgba(245 158 11 / 1);
    }

    /* Sonar sweep (horizontal, amber) */
    .ceremony__sonar {
      position: absolute;
      top: 0;
      left: 0;
      width: 2px;
      height: 100%;
      background: #f59e0b;
      box-shadow:
        0 0 8px #f59e0b,
        0 0 30px rgba(245 158 11 / 0.3);
      z-index: 1;
      opacity: 0;
    }

    .ceremony--stage-2 .ceremony__sonar {
      opacity: 1;
      animation: sonar-sweep 3s ease-in-out infinite;
    }

    @keyframes sonar-sweep {
      0%   { left: -2px; opacity: 1; }
      100% { left: calc(100% + 2px); opacity: 0.4; }
    }

    /* Particles */
    .ceremony__particles {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 2;
      overflow: hidden;
    }

    .ceremony__particle {
      position: absolute;
      bottom: -10px;
      width: 4px;
      height: 4px;
      background: #f59e0b;
      border-radius: 50%;
      opacity: 0;
      filter: blur(1px);
    }

    .ceremony--stage-2 .ceremony__particle,
    .ceremony--stage-3 .ceremony__particle {
      animation: particle-rise 3s ease-out infinite;
    }

    @keyframes particle-rise {
      0%   { transform: translateY(0); opacity: 0; }
      15%  { opacity: 0.8; }
      85%  { opacity: 0.3; }
      100% { transform: translateY(-100vh); opacity: 0; }
    }

    /* ── Stage 3: Materialization Burst ─────────── */

    .ceremony__burst {
      position: absolute;
      inset: 0;
      background: rgba(245 158 11 / 0);
      z-index: 5;
      pointer-events: none;
    }

    .ceremony--stage-3 .ceremony__burst {
      animation: amber-flash 400ms ease-out forwards;
    }

    @keyframes amber-flash {
      0%   { background: rgba(245 158 11 / 0.3); }
      100% { background: rgba(245 158 11 / 0); }
    }

    .ceremony--stage-3 .ceremony__crack {
      width: 100vw;
      background: transparent;
      box-shadow: none;
      transition: width 0.5s cubic-bezier(0.22, 1, 0.36, 1);
    }

    .ceremony--stage-4 .ceremony__crack,
    .ceremony--stage-5 .ceremony__crack {
      width: 0;
      opacity: 0;
    }

    .ceremony__header {
      position: relative;
      z-index: 6;
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.2em;
      color: rgba(245 158 11 / 0.7);
      opacity: 0;
    }

    .ceremony--stage-3 .ceremony__header,
    .ceremony--stage-4 .ceremony__header,
    .ceremony--stage-5 .ceremony__header {
      opacity: 1;
      transition: opacity 0.6s ease-out 0.2s;
    }

    .ceremony__name {
      position: relative;
      z-index: 6;
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 900;
      font-size: var(--text-4xl, 3rem);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: #fff;
      text-align: center;
      opacity: 0;
      transform: scale(1.5);
      padding: 0 var(--space-4, 1rem);
    }

    .ceremony--stage-3 .ceremony__name,
    .ceremony--stage-4 .ceremony__name,
    .ceremony--stage-5 .ceremony__name {
      opacity: 1;
      transform: scale(1);
      transition: opacity 0.5s ease-out, transform 0.8s var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1));
    }

    .ceremony__name-glow {
      position: absolute;
      inset: -40px;
      background: radial-gradient(ellipse at center, rgba(245 158 11 / 0.15) 0%, transparent 70%);
      z-index: -1;
      animation: name-glow-pulse 2.5s ease-in-out infinite;
    }

    @keyframes name-glow-pulse {
      0%, 100% { opacity: 0.6; transform: scale(1); }
      50%      { opacity: 1; transform: scale(1.05); }
    }

    .ceremony__tagline {
      position: relative;
      z-index: 6;
      font-family: var(--font-mono, monospace);
      font-size: var(--text-sm, 0.875rem);
      color: rgba(245 158 11 / 0.85);
      letter-spacing: 0.05em;
      min-height: 1.5em;
      text-align: center;
      max-width: 500px;
      padding: 0 var(--space-4, 1rem);
    }

    /* ── Stage 4: Asset Reveal ──────────────────── */

    .ceremony__stats {
      position: relative;
      z-index: 6;
      display: flex;
      gap: var(--space-6, 1.5rem);
      opacity: 0;
    }

    .ceremony--stage-4 .ceremony__stats,
    .ceremony--stage-5 .ceremony__stats {
      opacity: 1;
      transition: opacity 0.4s ease-out;
    }

    .ceremony__stat {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-1, 0.25rem);
      opacity: 0;
      transform: translateY(12px);
    }

    .ceremony--stage-4 .ceremony__stat,
    .ceremony--stage-5 .ceremony__stat {
      animation: stat-materialize 0.4s var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)) forwards;
    }

    .ceremony__stat:nth-child(1) { animation-delay: 0ms; }
    .ceremony__stat:nth-child(2) { animation-delay: 400ms; }
    .ceremony__stat:nth-child(3) { animation-delay: 800ms; }

    @keyframes stat-materialize {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .ceremony__stat-number {
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 900;
      font-size: var(--text-2xl, 1.5rem);
    }

    .ceremony__stat-number--agents   { color: var(--color-success, #22c55e); }
    .ceremony__stat-number--buildings { color: #f59e0b; }
    .ceremony__stat-number--zones    { color: var(--color-info, #3b82f6); }

    .ceremony__stat-label {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-gray-400, #9ca3af);
    }

    /* Card fans */
    .ceremony__cards {
      position: relative;
      z-index: 6;
      display: flex;
      justify-content: center;
      gap: 0;
      perspective: 800px;
      flex-wrap: wrap;
      max-width: 90vw;
      opacity: 0;
    }

    .ceremony--stage-4 .ceremony__cards,
    .ceremony--stage-5 .ceremony__cards {
      opacity: 1;
      transition: opacity 0.3s ease-out;
    }

    .ceremony__card {
      margin-left: -6px;
      opacity: 0;
    }

    .ceremony__card:first-child { margin-left: 0; }

    .ceremony--stage-4 .ceremony__card,
    .ceremony--stage-5 .ceremony__card {
      animation: card-deal 0.5s var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)) both;
    }

    @keyframes card-deal {
      from {
        opacity: 0;
        transform: translateY(-30px) scale(0.85);
        filter: brightness(2);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
        filter: brightness(1);
      }
    }

    /* ── Stage 5: Arrival ───────────────────────── */

    .ceremony__enter {
      position: relative;
      z-index: 6;
      opacity: 0;
      transform: translateY(20px);
    }

    .ceremony--stage-5 .ceremony__enter {
      animation: enter-spring 0.5s var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1)) forwards;
    }

    @keyframes enter-spring {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .ceremony__enter-btn {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2, 0.5rem);
      padding: var(--space-3, 0.75rem) var(--space-8, 2rem);
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 900;
      font-size: var(--text-base, 1rem);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #000;
      background: #f59e0b;
      border: 2px solid #f59e0b;
      cursor: pointer;
      transition: all 0.2s ease-out;
      animation: btn-breathe 2.5s ease-in-out infinite;
    }

    @keyframes btn-breathe {
      0%, 100% { box-shadow: 0 0 0px rgba(245 158 11 / 0), 0 0 12px rgba(245 158 11 / 0.2); }
      50%      { box-shadow: 0 0 8px rgba(245 158 11 / 0.4), 0 0 24px rgba(245 158 11 / 0.15); }
    }

    .ceremony__enter-btn:hover {
      background: #fbbf24;
      border-color: #fbbf24;
      transform: translateY(-1px);
    }

    .ceremony__enter-btn:active {
      transform: translateY(0);
    }

    /* ── Reduced Motion ─────────────────────────── */

    @media (prefers-reduced-motion: reduce) {
      .ceremony--stage-1 {
        animation: none;
      }
      .ceremony--stage-1 .ceremony__flash {
        animation: none;
      }
      .ceremony__crack {
        animation: none !important;
      }
      .ceremony--stage-2 .ceremony__sonar {
        animation: none;
        opacity: 0;
      }
      .ceremony--stage-2 .ceremony__particle,
      .ceremony--stage-3 .ceremony__particle {
        animation: none;
      }
      .ceremony--stage-3 .ceremony__burst {
        animation: none;
      }
      .ceremony__name-glow {
        animation: none;
        opacity: 0.6;
      }
      .ceremony__cursor {
        animation: none;
        opacity: 1;
      }
      .ceremony--stage-4 .ceremony__stat,
      .ceremony--stage-5 .ceremony__stat {
        animation: none;
        opacity: 1;
        transform: none;
      }
      .ceremony--stage-4 .ceremony__card,
      .ceremony--stage-5 .ceremony__card {
        animation: none;
        opacity: 1;
      }
      .ceremony--stage-5 .ceremony__enter {
        animation: none;
        opacity: 1;
        transform: none;
      }
      .ceremony__enter-btn {
        animation: none;
        box-shadow: 0 0 12px rgba(245 158 11 / 0.2);
      }
      .ceremony__header {
        opacity: 1;
        transition: none;
      }
    }
  `;

  // ── Public properties ──────────────────────────

  @property() shardName = '';
  @property() slug = '';
  @property() seedPrompt = '';
  @property() anchorTitle = '';
  @property({ type: Array }) agents: ForgeAgentDraft[] = [];
  @property({ type: Array }) buildings: ForgeBuildingDraft[] = [];
  @property({ type: Number }) zoneCount = 0;

  // ── Internal state ─────────────────────────────

  @state() private _stage: 0 | 1 | 2 | 3 | 4 | 5 = 0;
  @state() private _scanPhase = 0;
  @state() private _typedText = '';

  private _timers: ReturnType<typeof setTimeout>[] = [];
  private _typeInterval: ReturnType<typeof setInterval> | null = null;
  private _scanInterval: ReturnType<typeof setInterval> | null = null;

  // ── Phase labels (i18n) ────────────────────────

  private get _phaseLabels(): string[] {
    return [
      msg('Stabilizing Dimensional Anchor...'),
      msg('Weaving Reality Threads...'),
      msg('Calibrating Shard Geometry...'),
      msg('Locking Multiverse Coordinates...'),
    ];
  }

  private get _lockLabels(): string[] {
    return [
      msg('Anchor'),
      msg('Threads'),
      msg('Geometry'),
      msg('Coordinates'),
    ];
  }

  private get _tagline(): string {
    return this.seedPrompt || this.anchorTitle || '';
  }

  // ── Lifecycle ──────────────────────────────────

  connectedCallback() {
    super.connectedCallback();
    this._startCeremony();
  }

  disconnectedCallback() {
    this._cleanup();
    super.disconnectedCallback();
  }

  private _startCeremony() {
    // Check reduced motion preference — skip to final state
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this._stage = 5;
      this._scanPhase = 3;
      this._typedText = this._tagline;
      return;
    }

    // Stage 1: Blackout + Breach (0–2s)
    this._stage = 1;

    // Stage 2: Dimensional Scan (2s–5s)
    this._timers.push(setTimeout(() => {
      this._stage = 2;
      this._startScanCycle();
    }, 2000));

    // Stage 3: Materialization Burst (5s–7s)
    this._timers.push(setTimeout(() => {
      this._stage = 3;
      this._stopScanCycle();
      this._scanPhase = 3; // all pips locked
      this._startTypewriter();
    }, 5000));

    // Stage 4: Asset Reveal (7s–10s)
    this._timers.push(setTimeout(() => {
      this._stage = 4;
    }, 7000));

    // Stage 5: Arrival (10s–12s)
    this._timers.push(setTimeout(() => {
      this._stage = 5;
    }, 10000));
  }

  private _startScanCycle() {
    this._scanPhase = 0;
    this._scanInterval = setInterval(() => {
      if (this._scanPhase < 3) {
        this._scanPhase++;
      }
    }, 750);
  }

  private _stopScanCycle() {
    if (this._scanInterval) {
      clearInterval(this._scanInterval);
      this._scanInterval = null;
    }
  }

  private _startTypewriter() {
    const text = this._tagline;
    if (!text) {
      this._typedText = '';
      return;
    }
    let i = 0;
    this._typedText = '';
    this._typeInterval = setInterval(() => {
      if (i < text.length) {
        this._typedText = text.slice(0, ++i);
      } else {
        if (this._typeInterval) {
          clearInterval(this._typeInterval);
          this._typeInterval = null;
        }
      }
    }, 40);
  }

  private _cleanup() {
    for (const t of this._timers) clearTimeout(t);
    this._timers = [];
    this._stopScanCycle();
    if (this._typeInterval) {
      clearInterval(this._typeInterval);
      this._typeInterval = null;
    }
  }

  // ── Event ──────────────────────────────────────

  private _handleEnter() {
    this.dispatchEvent(new CustomEvent('ceremony-enter', { bubbles: true, composed: true }));
  }

  // ── Render ─────────────────────────────────────

  protected render() {
    if (this._stage === 0) return nothing;

    const allCards = [
      ...this.agents.map(a => ({ name: a.name, subtitle: a.primary_profession, type: 'agent' as const })),
      ...this.buildings.map(b => ({ name: b.name, subtitle: b.building_type, type: 'building' as const })),
    ];

    return html`
      <div
        class="ceremony ceremony--stage-${this._stage}"
        role="status"
        aria-live="polite"
        aria-label=${msg('Materialization Complete')}
      >
        <!-- Flash overlay -->
        <div class="ceremony__flash"></div>

        <!-- CRT scanlines -->
        <div class="ceremony__crt"></div>

        <!-- Amber crack -->
        <div class="ceremony__crack"></div>

        <!-- Amber burst overlay (stage 3) -->
        <div class="ceremony__burst"></div>

        <!-- Sonar sweep -->
        <div class="ceremony__sonar"></div>

        <!-- Particles -->
        <div class="ceremony__particles">
          ${[0, 1, 2, 3, 4, 5, 6, 7].map(
            i => html`
            <div
              class="ceremony__particle"
              style="left: ${12 + i * 11}%; animation-delay: ${i * 0.35}s; width: ${3 + (i % 3)}px; height: ${3 + (i % 3)}px;"
            ></div>
          `,
          )}
        </div>

        <!-- Stage 2: Scan readout -->
        <div class="ceremony__scan">
          <div class="ceremony__phase-text">
            ${this._phaseLabels[this._scanPhase] ?? ''}<span class="ceremony__cursor"></span>
          </div>
          <div class="ceremony__locks">
            ${this._lockLabels.map(
              (label, i) => html`
              <div class="ceremony__lock ${i <= this._scanPhase ? 'ceremony__lock--active' : ''}">
                <div class="ceremony__pip ${i <= this._scanPhase ? 'ceremony__pip--active' : ''}"></div>
                <span class="ceremony__lock-label">${label}</span>
              </div>
            `,
            )}
          </div>
        </div>

        <!-- Stage 3+: Header + Shard name -->
        <div class="ceremony__header">${msg('Materialization Complete')}</div>
        <div class="ceremony__name">
          <div class="ceremony__name-glow"></div>
          ${this.shardName}
        </div>

        <!-- Stage 3+: Tagline typewriter -->
        ${this._tagline
          ? html`<div class="ceremony__tagline">${this._typedText}<span class="ceremony__cursor"></span></div>`
          : nothing}

        <!-- Stage 4+: Stats -->
        <div class="ceremony__stats">
          <div class="ceremony__stat">
            <span class="ceremony__stat-number ceremony__stat-number--agents">${this.agents.length}</span>
            <span class="ceremony__stat-label">${msg('Agents')}</span>
          </div>
          <div class="ceremony__stat">
            <span class="ceremony__stat-number ceremony__stat-number--buildings">${this.buildings.length}</span>
            <span class="ceremony__stat-label">${msg('Buildings')}</span>
          </div>
          <div class="ceremony__stat">
            <span class="ceremony__stat-number ceremony__stat-number--zones">${this.zoneCount}</span>
            <span class="ceremony__stat-label">${msg('Zones')}</span>
          </div>
        </div>

        <!-- Stage 4+: Card fans -->
        ${allCards.length > 0
          ? html`
          <div class="ceremony__cards">
            ${allCards.map(
              (c, i) => html`
              <div class="ceremony__card" style="animation-delay: ${i * 120}ms">
                <velg-game-card
                  .name=${c.name}
                  .subtitle=${c.subtitle}
                  .rarity=${'common'}
                  theme="brutalist"
                  size="sm"
                ></velg-game-card>
              </div>
            `,
            )}
          </div>
        `
          : nothing}

        <!-- Stage 5: Enter button -->
        <div class="ceremony__enter">
          <button class="ceremony__enter-btn" @click=${this._handleEnter}>
            ${msg('Enter New Shard')} &ensp; &rarr;
          </button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-forge-ceremony': VelgForgeCeremony;
  }
}

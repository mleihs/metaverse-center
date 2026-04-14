import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { epochsApi } from '../../services/api/index.js';
import type { BattleLogEntry, BattleSummary, Sitrep } from '../../types/index.js';
import { formatTime } from '../../utils/date-format.js';
import { icons } from '../../utils/icons.js';
import '../shared/LoadingState.js';

const EVENT_COLORS: Record<string, string> = {
  operative_deployed: 'var(--color-warning)',
  mission_success: 'var(--color-success)',
  mission_failed: 'var(--color-danger)',
  detected: 'var(--color-danger)',
  captured: 'var(--color-danger)',
  sabotage: 'var(--color-warning)',
  propaganda: 'var(--color-epoch-influence)',
  assassination: 'var(--color-danger)',
  infiltration: 'var(--color-info)',
  alliance_formed: 'var(--color-info)',
  alliance_dissolved: 'var(--color-warning)',
  betrayal: 'var(--color-danger)',
  phase_change: 'var(--color-warning)',
  counter_intel: 'var(--color-info)',
  building_damaged: 'var(--color-danger)',
  agent_wounded: 'var(--color-danger)',
  rp_allocated: 'var(--color-text-muted)',
  zone_fortified: 'var(--color-warning)',
  alliance_proposal: 'var(--color-epoch-accent)',
  alliance_proposal_accepted: 'var(--color-success)',
  alliance_proposal_rejected: 'var(--color-danger)',
  alliance_tension_increase: 'var(--color-warning)',
  alliance_dissolved_tension: 'var(--color-danger)',
  alliance_upkeep: 'var(--color-text-muted)',
  player_passed: 'var(--color-text-muted)',
  cycle_resolved: 'var(--color-warning)',
  cycle_auto_resolved: 'var(--color-warning)',
  player_afk: 'var(--color-text-muted)',
  player_afk_penalty: 'var(--color-danger)',
  player_afk_ai_takeover: 'var(--color-info)',
  intel_report: 'var(--color-info)',
};

const PHASE_COLORS: Record<string, string> = {
  foundation: 'var(--color-success)',
  competition: 'var(--color-warning)',
  reckoning: 'var(--color-danger)',
  completed: 'var(--color-text-muted)',
  lobby: 'var(--color-info)',
  cancelled: 'var(--color-icon)',
};

@localized()
@customElement('velg-war-room-panel')
export class VelgWarRoomPanel extends LitElement {
  static styles = css`
    :host {
      display: block;
      background: var(--color-surface-sunken);
      color: var(--color-text-primary);
      position: relative;
      --_scanline-dark: color-mix(in srgb, var(--color-surface) 3%, transparent);
      --_hi-dim: color-mix(in srgb, var(--color-text-primary) 2%, transparent);
      --_hi-faint: color-mix(in srgb, var(--color-text-primary) 3%, transparent);
    }

    /* Scanline texture overlay */
    :host::after {
      content: '';
      position: absolute;
      inset: 0;
      pointer-events: none;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 2px,
        var(--_scanline-dark) 2px,
        var(--_scanline-dark) 4px
      );
      z-index: 1;
    }

    .war-room {
      position: relative;
      z-index: 2;
      display: flex;
      flex-direction: column;
      gap: var(--space-5);
      padding: var(--space-5);
    }

    /* ── Header ────────────────────────── */

    .wr-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2px solid var(--color-border);
      padding-bottom: var(--space-4);
    }

    .wr-header__left {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }

    .wr-header__icon {
      color: var(--color-danger);
      opacity: 0.8;
    }

    .wr-header__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xl);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      margin: 0;
    }

    .phase-badge {
      font-size: var(--text-xs);
      font-family: var(--font-brutalist);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      padding: 2px 8px;
      border-radius: 2px;
      border: 1px solid currentColor;
      opacity: 0.9;
    }

    .cycle-nav {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .cycle-nav__btn {
      background: var(--color-surface-raised);
      border: 1px solid var(--color-border);
      color: var(--color-text-tertiary);
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      border-radius: 2px;
      font-size: var(--text-sm);
      transition: background 0.15s, color 0.15s;
    }

    .cycle-nav__btn:hover:not(:disabled) {
      background: var(--color-surface-raised);
      color: var(--color-text-primary);
    }

    .cycle-nav__btn:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }

    .cycle-nav__btn:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: 1px;
    }

    .cycle-nav__label {
      font-family: var(--font-brutalist);
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      min-width: 70px;
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    /* ── Summary Stats ─────────────────── */

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: var(--space-3);
    }

    .stat-box {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-top: 2px solid var(--stat-color, var(--color-border));
      padding: var(--space-3) var(--space-4);
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      animation: statEnter 0.35s ease-out both;
    }

    .stat-box:nth-child(1) { --stat-color: var(--color-info); animation-delay: 0ms; }
    .stat-box:nth-child(2) { --stat-color: var(--color-success); animation-delay: 60ms; }
    .stat-box:nth-child(3) { --stat-color: var(--color-danger); animation-delay: 120ms; }
    .stat-box:nth-child(4) { --stat-color: var(--color-warning); animation-delay: 180ms; }

    .stat-box__value {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-2xl);
      line-height: 1;
      color: var(--stat-color);
      font-variant-numeric: tabular-nums;
    }

    .stat-box__label {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    @keyframes statEnter {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* ── SITREP Section ────────────────── */

    .sitrep {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      padding: 0;
      overflow: hidden;
    }

    .sitrep__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-3) var(--space-4);
      border-bottom: 1px solid var(--color-border);
      background: var(--_hi-dim);
    }

    .sitrep__stamp {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .sitrep__stamp-text {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--color-danger);
      border: 1px solid var(--color-danger);
      padding: 1px 6px;
      opacity: 0.7;
    }

    .sitrep__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-text-tertiary);
      margin: 0;
    }

    .sitrep__actions {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .sitrep__btn {
      background: var(--color-surface-raised);
      border: 1px solid var(--color-border);
      color: var(--color-text-tertiary);
      font-size: var(--text-xs);
      padding: 3px 10px;
      cursor: pointer;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-family: var(--font-brutalist);
      transition: background 0.15s;
    }

    .sitrep__btn:hover {
      background: var(--color-surface-raised);
    }

    .sitrep__btn:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: 1px;
    }

    .sitrep__body {
      padding: var(--space-4);
      font-family: 'Courier New', Courier, monospace;
      font-size: var(--text-sm);
      line-height: 1.7;
      color: var(--color-text-tertiary);
      white-space: pre-wrap;
      min-height: 80px;
    }

    .sitrep__generating {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      color: var(--color-text-muted);
      font-family: var(--font-brutalist);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .pulse-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--color-warning);
      animation: pulse 1.2s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 0.3; transform: scale(0.8); }
      50% { opacity: 1; transform: scale(1.2); }
    }

    /* ── Battle Log ────────────────────── */

    .battle-log {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .battle-log__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-text-muted);
      margin: 0;
      padding-bottom: var(--space-2);
    }

    .battle-log__list {
      max-height: 500px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 2px;
      scrollbar-width: thin;
      scrollbar-color: var(--color-border) transparent;
    }

    .bl-entry {
      display: flex;
      gap: var(--space-3);
      padding: var(--space-2) var(--space-3);
      background: var(--color-surface);
      border-left: 3px solid var(--entry-color, var(--color-border));
      animation: entrySlide 0.3s ease-out both;
      position: relative;
    }

    .bl-entry--betrayal {
      border-left-width: 4px;
    }

    .bl-entry--phase {
      background: linear-gradient(90deg, var(--_hi-faint), transparent);
      border-left-width: 4px;
      padding: var(--space-3);
    }

    .allied-intel-badge {
      display: inline-block;
      font-family: var(--font-brutalist);
      font-size: 8px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-info);
      border: 1px solid var(--color-info-border);
      background: var(--color-info-bg);
      padding: 1px 6px;
      margin-left: var(--space-1);
      vertical-align: middle;
    }

    .bl-entry__time {
      font-size: 10px;
      color: var(--color-icon);
      white-space: nowrap;
      min-width: 50px;
      padding-top: 2px;
      font-variant-numeric: tabular-nums;
    }

    .bl-entry__body {
      flex: 1;
      min-width: 0;
    }

    .bl-entry__type {
      font-size: 10px;
      color: var(--entry-color, var(--color-text-muted));
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 2px;
    }

    .bl-entry__narrative {
      font-size: var(--text-sm);
      color: var(--color-text-tertiary);
      line-height: 1.4;
    }

    .bl-cycle-divider {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-text-muted);
      padding: var(--space-2) 0;
      border-bottom: 1px dashed var(--color-border);
      margin-top: var(--space-2);
    }

    @keyframes entrySlide {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .empty-state {
      color: var(--color-text-muted);
      font-size: var(--text-sm);
      text-align: center;
      padding: var(--space-6);
    }

    /* ── Reduced motion ────────────────── */

    @media (prefers-reduced-motion: reduce) {
      .stat-box,
      .bl-entry {
        animation: none;
      }
      .pulse-dot {
        animation: none;
        opacity: 1;
      }
    }
  `;

  @property({ type: String }) epochId = '';
  @property({ type: Number }) currentCycle = 1;
  @property({ type: String }) simulationId = '';
  @property({ type: String }) status = '';

  @state() private _selectedCycle = 1;
  @state() private _summary: BattleSummary | null = null;
  @state() private _sitrep: Sitrep | null = null;
  @state() private _entries: BattleLogEntry[] = [];
  @state() private _loading = false;
  @state() private _sitrepLoading = false;
  @state() private _sitrepRevealed = '';
  @state() private _animatedStats = { deployed: 0, successes: 0, failures: 0, detections: 0 };

  private _typewriterTimer = 0;
  private _counterFrame = 0;

  connectedCallback(): void {
    super.connectedCallback();
    this._selectedCycle = this.currentCycle;
    if (this.epochId) this._loadAll();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    clearInterval(this._typewriterTimer);
    if (this._counterFrame) cancelAnimationFrame(this._counterFrame);
  }

  protected willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('epochId') && this.epochId) {
      this._selectedCycle = this.currentCycle;
      this._loadAll();
    }
    if (changed.has('currentCycle') && this.currentCycle) {
      this._selectedCycle = this.currentCycle;
    }
  }

  private async _loadAll(): Promise<void> {
    this._loading = true;
    await Promise.all([this._loadSummary(), this._loadBattleLog()]);
    this._loading = false;
  }

  private async _loadSummary(): Promise<void> {
    // Cycle 0 = aggregate across all cycles (migration 212)
    const res = await epochsApi.getCycleSummary(
      this.epochId,
      0,
      this.simulationId || undefined,
    );
    if (res.success && res.data) {
      this._summary = res.data as BattleSummary;
      this._animateCounters();
    }
  }

  private async _loadBattleLog(): Promise<void> {
    const params: Record<string, string> = { limit: '100' };
    if (this.simulationId) params.simulation_id = this.simulationId;
    const res = await epochsApi.getBattleLog(this.epochId, params);
    if (res.success && res.data) {
      this._entries = (Array.isArray(res.data) ? res.data : []) as BattleLogEntry[];
    }
  }

  private async _loadSitrep(): Promise<void> {
    this._sitrepLoading = true;
    this._sitrepRevealed = '';
    this._sitrep = null;
    clearInterval(this._typewriterTimer);

    const res = await epochsApi.getSitrep(
      this.epochId,
      this._selectedCycle,
      this.simulationId || undefined,
    );
    if (res.success && res.data) {
      this._sitrep = res.data as Sitrep;
      this._typewriterReveal(this._sitrep.sitrep);
    }
    this._sitrepLoading = false;
  }

  private _typewriterReveal(text: string): void {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      this._sitrepRevealed = text;
      return;
    }
    let idx = 0;
    this._typewriterTimer = window.setInterval(() => {
      idx += 2; // 2 chars at a time for speed
      this._sitrepRevealed = text.slice(0, idx);
      if (idx >= text.length) clearInterval(this._typewriterTimer);
    }, 15);
  }

  private _animateCounters(): void {
    if (!this._summary) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const targets = {
      deployed: this._summary.missions_deployed,
      successes: this._summary.successes,
      failures: this._summary.failures,
      detections: this._summary.detections,
    };
    if (reduced) {
      this._animatedStats = { ...targets };
      return;
    }
    const dur = 600;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / dur, 1);
      const e = 1 - (1 - t) ** 3;
      this._animatedStats = {
        deployed: Math.round(targets.deployed * e),
        successes: Math.round(targets.successes * e),
        failures: Math.round(targets.failures * e),
        detections: Math.round(targets.detections * e),
      };
      if (t < 1) this._counterFrame = requestAnimationFrame(tick);
    };
    this._counterFrame = requestAnimationFrame(tick);
  }

  private _changeCycle(delta: number): void {
    const next = this._selectedCycle + delta;
    if (next < 0 || next > this.currentCycle) return;
    this._selectedCycle = next;
    this._sitrep = null;
    this._sitrepRevealed = '';
    clearInterval(this._typewriterTimer);
    // Stats are aggregate (cycle=0), not per-cycle — no reload needed.
    // Cycle nav only controls SITREP generation.
  }

  private _renderHeader() {
    const phaseColor = PHASE_COLORS[this.status] || 'var(--color-text-muted)';
    return html`
      <div class="wr-header">
        <div class="wr-header__left">
          <span class="wr-header__icon">${icons.crossedSwords(22)}</span>
          <h2 class="wr-header__title">${msg('War Room')}</h2>
          ${
            this.status
              ? html`<span class="phase-badge" style="color: ${phaseColor}">${this.status}</span>`
              : nothing
          }
        </div>
        <div class="cycle-nav">
          <button
            class="cycle-nav__btn"
            @click=${() => this._changeCycle(-1)}
            ?disabled=${this._selectedCycle <= 0}
            aria-label=${msg('Previous cycle')}
          >&#9664;</button>
          <span class="cycle-nav__label">${msg('Cycle')} ${this._selectedCycle}</span>
          <button
            class="cycle-nav__btn"
            @click=${() => this._changeCycle(1)}
            ?disabled=${this._selectedCycle >= this.currentCycle}
            aria-label=${msg('Next cycle')}
          >&#9654;</button>
        </div>
      </div>
    `;
  }

  private _renderSummary() {
    return html`
      <div class="summary-grid" role="group" aria-label=${msg('Cycle statistics')}>
        <div class="stat-box">
          <span class="stat-box__value">${this._animatedStats.deployed}</span>
          <span class="stat-box__label">${icons.target(12)} ${msg('Deployed')}</span>
        </div>
        <div class="stat-box">
          <span class="stat-box__value">${this._animatedStats.successes}</span>
          <span class="stat-box__label">${icons.radar(12)} ${msg('Successes')}</span>
        </div>
        <div class="stat-box">
          <span class="stat-box__value">${this._animatedStats.failures}</span>
          <span class="stat-box__label">${icons.skull(12)} ${msg('Failures')}</span>
        </div>
        <div class="stat-box">
          <span class="stat-box__value">${this._animatedStats.detections}</span>
          <span class="stat-box__label">${icons.alertTriangle(12)} ${msg('Detections')}</span>
        </div>
      </div>
    `;
  }

  private _renderSitrep() {
    return html`
      <div class="sitrep">
        <div class="sitrep__header">
          <div class="sitrep__stamp">
            <span class="sitrep__stamp-text">${msg('Intel')}</span>
            <h3 class="sitrep__title">${msg('Situation Report')}</h3>
          </div>
          <div class="sitrep__actions">
            <button
              class="sitrep__btn"
              @click=${this._loadSitrep}
              ?disabled=${this._sitrepLoading}
              aria-label=${msg('Generate situation report')}
            >${this._sitrep ? msg('Regenerate') : msg('Generate SITREP')}</button>
          </div>
        </div>
        <div class="sitrep__body">
          ${
            this._sitrepLoading
              ? html`<span class="sitrep__generating"><span class="pulse-dot"></span> ${msg('Generating...')}</span>`
              : this._sitrepRevealed
                ? this._sitrepRevealed
                : html`<span style="color: var(--color-text-muted)">${msg('Click Generate SITREP to request an intelligence briefing for this cycle.')}</span>`
          }
        </div>
      </div>
    `;
  }

  private _renderBattleLog() {
    if (!this._entries.length) {
      return html`
        <div class="battle-log">
          <h3 class="battle-log__title">${msg('Battle Log')}</h3>
          <div class="empty-state">${msg('No battle log entries yet')}</div>
        </div>
      `;
    }

    // Group by cycle
    const byCycle = new Map<number, BattleLogEntry[]>();
    for (const e of this._entries) {
      const c = e.cycle_number;
      if (!byCycle.has(c)) byCycle.set(c, []);
      byCycle.get(c)?.push(e);
    }
    const sortedCycles = [...byCycle.keys()].sort((a, b) => b - a);

    let entryIdx = 0;

    return html`
      <div class="battle-log">
        <h3 class="battle-log__title">${msg('Battle Log')}</h3>
        <div class="battle-log__list" role="log" aria-label=${msg('Battle events')}>
          ${sortedCycles.map((cycle) => {
            const entries = byCycle.get(cycle) ?? [];
            return html`
              <div class="bl-cycle-divider">${msg('Cycle')} ${cycle}</div>
              ${entries.map((entry) => {
                const color = EVENT_COLORS[entry.event_type] || 'var(--color-border)';
                const isPhase = entry.event_type === 'phase_change';
                const isBetrayal = entry.event_type === 'betrayal';
                const isAlliedIntel = !!(entry.metadata as Record<string, unknown> | undefined)
                  ?.allied_intel;
                const delay = entryIdx * 50;
                entryIdx++;
                return html`
                  <div
                    class="bl-entry ${isPhase ? 'bl-entry--phase' : ''} ${isBetrayal ? 'bl-entry--betrayal' : ''}"
                    style="--entry-color: ${color}; animation-delay: ${delay}ms"
                  >
                    <span class="bl-entry__time">${formatTime(entry.created_at)}</span>
                    <div class="bl-entry__body">
                      <div class="bl-entry__type">
                        ${entry.event_type.replace(/_/g, ' ')}
                        ${isAlliedIntel ? html`<span class="allied-intel-badge" title=${msg('Intelligence shared through your alliance')}>${msg('ALLIED INTEL')}</span>` : nothing}
                      </div>
                      <div class="bl-entry__narrative">${entry.narrative}</div>
                    </div>
                  </div>
                `;
              })}
            `;
          })}
        </div>
      </div>
    `;
  }

  protected render() {
    if (this._loading) {
      return html`<velg-loading-state message=${msg('Loading war room...')}></velg-loading-state>`;
    }

    return html`
      <div class="war-room">
        ${this._renderHeader()}
        ${this._renderSummary()}
        ${this._renderSitrep()}
        ${this._renderBattleLog()}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-war-room-panel': VelgWarRoomPanel;
  }
}

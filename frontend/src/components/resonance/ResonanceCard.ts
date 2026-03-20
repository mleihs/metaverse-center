import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { appState } from '../../services/AppStateManager.js';
import { resonanceApi } from '../../services/api/index.js';
import type { Resonance, ResonanceImpact } from '../../types/index.js';
import { icons } from '../../utils/icons.js';

/** Human-readable archetype labels. */
const ARCHETYPE_LABELS: Record<string, string> = {
  economic_tremor: 'The Tower',
  conflict_wave: 'The Shadow',
  biological_tide: 'The Devouring Mother',
  elemental_surge: 'The Deluge',
  authority_fracture: 'The Overthrow',
  innovation_spark: 'The Prometheus',
  consciousness_drift: 'The Awakening',
  decay_bloom: 'The Entropy',
};

/** Resolved impact with simulation metadata. */
interface ResolvedImpact extends ResonanceImpact {
  _simName: string;
  _simSlug: string;
}

@localized()
@customElement('resonance-card')
export class ResonanceCard extends LitElement {
  static styles = css`
    :host {
      display: block;
      contain: content;
    }

    /* ── Card Shell ─────────────────────────────────────────── */

    .card {
      position: relative;
      background: var(--color-surface);
      border: var(--border-default);
      padding: var(--space-4);
      cursor: pointer;
      transition:
        transform var(--duration-normal) var(--ease-out),
        box-shadow var(--duration-normal) var(--ease-out);
      overflow: hidden;
      opacity: 0;
      animation: card-enter var(--duration-entrance, 350ms)
        var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)) forwards;
      animation-delay: calc(var(--i, 0) * var(--duration-stagger, 40ms));
    }

    .card::before {
      content: '';
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 2px,
        rgba(128, 128, 128, 0.06) 2px,
        rgba(128, 128, 128, 0.06) 4px
      );
      pointer-events: none;
      z-index: 1;
    }

    .card:hover {
      transform: translate(-2px, -2px);
      box-shadow: var(--shadow-lg);
    }

    .card:active {
      transform: translate(0);
      box-shadow: var(--shadow-pressed);
    }

    .card:focus-visible {
      outline: none;
      box-shadow: var(--ring-focus);
    }

    .card.status-impacting {
      border-color: var(--color-danger);
      animation: card-enter var(--duration-entrance, 350ms)
          var(--ease-dramatic) forwards,
        impacting-border 2s ease-in-out infinite;
      animation-delay: calc(var(--i, 0) * var(--duration-stagger, 40ms)), 0s;
    }

    .card.status-detected {
      border-color: var(--color-info);
    }

    .card.status-subsiding {
      border-color: var(--color-warning);
    }

    .card.status-archived {
      border-color: var(--color-border-light);
      opacity: 0.7;
    }

    /* ── Header ────────────────────────────────────────────── */

    .header {
      display: flex;
      align-items: flex-start;
      gap: var(--space-3);
      margin-bottom: var(--space-3);
    }

    .icon-wrap {
      flex-shrink: 0;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: var(--border-width-default) solid var(--color-border);
      background: var(--color-surface-sunken);
      color: var(--color-text-primary);
      transition: color var(--transition-normal), border-color var(--transition-normal);
    }

    .status-impacting .icon-wrap {
      color: var(--color-danger);
      border-color: var(--color-danger);
      animation: icon-glow 2s ease-in-out infinite;
    }

    .status-detected .icon-wrap {
      color: var(--color-info);
      border-color: var(--color-info);
    }

    .status-subsiding .icon-wrap {
      color: var(--color-warning);
      border-color: var(--color-warning);
    }

    .title-block {
      flex: 1;
      min-width: 0;
    }

    .archetype-label {
      font-family: var(--font-prose);
      font-size: var(--text-xs);
      font-weight: var(--font-medium);
      color: var(--color-text-secondary);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wider);
      line-height: var(--leading-none);
      margin-bottom: var(--space-1);
    }

    .title {
      font-family: var(--font-brutalist);
      font-size: var(--text-sm);
      font-weight: var(--font-bold);
      color: var(--color-text-primary);
      line-height: var(--leading-tight);
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }

    /* ── Status + Countdown Row ────────────────────────────── */

    .meta-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2);
      margin-bottom: var(--space-3);
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      padding: var(--space-0-5) var(--space-2);
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wider);
      border: var(--border-width-thin) solid;
    }

    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: var(--border-radius-full);
      flex-shrink: 0;
    }

    .status-detected .status-badge {
      border-color: var(--color-info);
      color: var(--color-info);
    }
    .status-detected .status-dot {
      background: var(--color-info);
      animation: status-pulse 1.5s ease-in-out infinite alternate;
    }

    .status-impacting .status-badge {
      border-color: var(--color-danger);
      color: var(--color-danger);
      background: var(--color-danger-bg);
    }
    .status-impacting .status-dot {
      background: var(--color-danger);
      animation: status-pulse 0.8s ease-in-out infinite alternate;
    }

    .status-subsiding .status-badge {
      border-color: var(--color-warning);
      color: var(--color-warning);
    }
    .status-subsiding .status-dot {
      background: var(--color-warning);
    }

    .status-archived .status-badge {
      border-color: var(--color-border-light);
      color: var(--color-text-muted);
    }
    .status-archived .status-dot {
      background: var(--color-text-muted);
    }

    .countdown {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
      letter-spacing: var(--tracking-wide);
      white-space: nowrap;
    }

    .countdown.urgent {
      color: var(--color-danger);
      animation: countdown-tick 1s steps(1) infinite;
    }

    /* ── Magnitude Gauge ───────────────────────────────────── */

    .magnitude {
      margin-bottom: var(--space-3);
    }

    .magnitude-label {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: var(--space-1);
    }

    .magnitude-label span {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wider);
    }

    .magnitude-value {
      font-weight: var(--font-bold);
      color: var(--color-text-primary);
    }

    .magnitude-track {
      height: 6px;
      background: var(--color-surface-sunken);
      border: var(--border-width-thin) solid var(--color-border-light);
      position: relative;
      overflow: hidden;
    }

    .magnitude-fill {
      height: 100%;
      transition: width 600ms var(--ease-dramatic);
      position: relative;
    }

    .magnitude-fill.low {
      background: linear-gradient(90deg, var(--color-info), var(--color-info));
    }
    .magnitude-fill.medium {
      background: linear-gradient(90deg, var(--color-primary), var(--color-primary-hover));
    }
    .magnitude-fill.high {
      background: linear-gradient(90deg, var(--color-danger), var(--color-danger));
    }

    .magnitude-fill::after {
      content: '';
      position: absolute;
      right: 0;
      top: 0;
      bottom: 0;
      width: 12px;
      background: inherit;
      filter: brightness(1.3);
      animation: magnitude-pulse 2s ease-in-out infinite;
    }

    /* ── Event Type Chips ──────────────────────────────────── */

    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-1);
      margin-bottom: var(--space-3);
    }

    .chip {
      padding: var(--space-0-5) var(--space-1-5);
      font-family: var(--font-mono);
      font-size: 0.6rem;
      text-transform: uppercase;
      letter-spacing: var(--tracking-wider);
      color: var(--color-text-secondary);
      background: var(--color-surface-sunken);
      border: var(--border-width-thin) solid var(--color-border-light);
      white-space: nowrap;
    }

    /* ── Bureau Dispatch ───────────────────────────────────── */

    .dispatch {
      border-top: var(--border-width-thin) solid var(--color-border-light);
      padding-top: var(--space-2);
    }

    .dispatch-toggle {
      display: flex;
      align-items: center;
      gap: var(--space-1-5);
      background: none;
      border: none;
      padding: 0;
      cursor: pointer;
      font-family: var(--font-prose);
      font-size: var(--text-xs);
      font-style: italic;
      color: var(--color-text-muted);
      transition: color var(--transition-fast);
      width: 100%;
      text-align: left;
    }

    .dispatch-toggle:hover {
      color: var(--color-text-secondary);
    }

    .dispatch-toggle:focus-visible {
      outline: none;
      box-shadow: var(--ring-focus);
    }

    .dispatch-chevron {
      transition: transform var(--duration-normal) var(--ease-out);
      flex-shrink: 0;
    }

    .dispatch-chevron.expanded {
      transform: rotate(90deg);
    }

    .dispatch-content {
      overflow: hidden;
      max-height: 0;
      transition: max-height var(--duration-slow) var(--ease-dramatic);
    }

    .dispatch-content.expanded {
      max-height: 600px;
    }

    .dispatch-text {
      font-family: var(--font-prose);
      font-size: var(--text-xs);
      line-height: var(--leading-relaxed);
      color: var(--color-text-secondary);
      padding-top: var(--space-2);
      white-space: pre-wrap;
    }

    /* ── Footer ────────────────────────────────────────────── */

    .footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: var(--space-3);
      padding-top: var(--space-2);
      border-top: var(--border-width-thin) solid var(--color-border-light);
    }

    .impact-toggle {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
      background: none;
      border: none;
      padding: 0;
      cursor: pointer;
      transition: color var(--transition-fast);
    }

    .impact-toggle:hover {
      color: var(--color-text-primary);
    }

    .impact-toggle:focus-visible {
      outline: none;
      box-shadow: var(--ring-focus);
    }

    .impact-toggle strong {
      color: var(--color-text-primary);
    }

    .impact-toggle__chevron {
      transition: transform var(--duration-normal) var(--ease-out);
      flex-shrink: 0;
    }

    .impact-toggle__chevron.expanded {
      transform: rotate(90deg);
    }

    .process-btn {
      padding: var(--space-1) var(--space-2);
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wider);
      color: var(--color-primary-text, var(--color-text-inverse));
      background: var(--color-primary);
      border: var(--border-width-default) solid var(--color-border);
      cursor: pointer;
      transition:
        background var(--transition-fast),
        transform var(--transition-fast),
        box-shadow var(--transition-fast);
    }

    .process-btn:hover {
      background: var(--color-primary-hover);
      transform: translate(-1px, -1px);
      box-shadow: var(--shadow-sm);
    }

    .process-btn:active {
      transform: translate(0);
      box-shadow: var(--shadow-pressed);
    }

    .process-btn:focus-visible {
      outline: none;
      box-shadow: var(--ring-focus);
    }

    /* ── Impact Panel ──────────────────────────────────────── */

    .impact-panel {
      overflow: hidden;
      max-height: 0;
      transition: max-height var(--duration-slow) var(--ease-dramatic);
    }

    .impact-panel.expanded {
      max-height: 800px;
    }

    .impact-list {
      padding-top: var(--space-3);
    }

    .impact-list__header {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding-bottom: var(--space-2);
      margin-bottom: var(--space-1);
      border-bottom: var(--border-width-thin) solid var(--color-border-light);
    }

    .impact-list__label {
      font-family: var(--font-brutalist);
      font-size: 0.6rem;
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-widest);
      color: var(--color-text-muted);
      flex: 1;
    }

    .impact-list__col {
      font-family: var(--font-mono);
      font-size: 0.55rem;
      text-transform: uppercase;
      letter-spacing: var(--tracking-wider);
      color: var(--color-text-muted);
      text-align: right;
      flex-shrink: 0;
    }

    .impact-list__col--mag {
      width: 56px;
    }

    .impact-list__col--events {
      width: 44px;
    }

    /* ── Impact Row ────────────────────────────────────────── */

    .impact-row {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-1-5) 0;
      border-bottom: var(--border-width-thin) solid
        color-mix(in srgb, var(--color-border-light) 40%, transparent);
      cursor: pointer;
      transition: background var(--transition-fast);
      opacity: 0;
      animation: impact-row-enter 250ms var(--ease-dramatic) forwards;
      animation-delay: calc(var(--row-i, 0) * 50ms);
    }

    .impact-row:last-child {
      border-bottom: none;
    }

    .impact-row:hover {
      background: var(--color-surface-sunken);
    }

    .impact-row__status {
      width: 5px;
      height: 5px;
      border-radius: var(--border-radius-full);
      flex-shrink: 0;
    }

    .impact-row__status--completed {
      background: var(--color-success);
    }

    .impact-row__status--pending,
    .impact-row__status--generating {
      background: var(--color-warning);
      animation: status-pulse 1.5s ease-in-out infinite alternate;
    }

    .impact-row__status--failed {
      background: var(--color-danger);
    }

    .impact-row__status--skipped {
      background: var(--color-text-muted);
    }

    .impact-row__name {
      flex: 1;
      min-width: 0;
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      transition: color var(--transition-fast);
    }

    .impact-row:hover .impact-row__name {
      color: var(--color-primary-text, var(--color-info));
    }

    .impact-row__mag {
      width: 56px;
      display: flex;
      align-items: center;
      gap: var(--space-1);
      flex-shrink: 0;
      justify-content: flex-end;
    }

    .impact-row__mag-bar {
      width: 28px;
      height: 3px;
      background: var(--color-surface-sunken);
      border: var(--border-width-thin) solid
        color-mix(in srgb, var(--color-border-light) 50%, transparent);
      overflow: hidden;
      flex-shrink: 0;
    }

    .impact-row__mag-fill {
      height: 100%;
    }

    .impact-row__mag-fill.low {
      background: var(--color-info);
    }
    .impact-row__mag-fill.medium {
      background: var(--color-primary);
    }
    .impact-row__mag-fill.high {
      background: var(--color-danger);
    }

    .impact-row__mag-val {
      font-family: var(--font-mono);
      font-size: 0.6rem;
      color: var(--color-text-secondary);
      min-width: 20px;
      text-align: right;
    }

    .impact-row__events {
      width: 44px;
      font-family: var(--font-mono);
      font-size: 0.6rem;
      color: var(--color-text-muted);
      text-align: right;
      flex-shrink: 0;
    }

    .impact-row__arrow {
      flex-shrink: 0;
      color: var(--color-text-muted);
      opacity: 0;
      transform: translateX(-4px);
      transition:
        opacity var(--transition-fast),
        transform var(--transition-fast);
    }

    .impact-row:hover .impact-row__arrow {
      opacity: 1;
      transform: translateX(0);
    }

    /* ── Impact Loading ────────────────────────────────────── */

    .impact-loading {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-3) 0;
    }

    .impact-loading__dots {
      display: flex;
      gap: 3px;
    }

    .impact-loading__dot {
      width: 4px;
      height: 4px;
      background: var(--color-text-muted);
      border-radius: var(--border-radius-full);
      animation: loading-dot 1s ease-in-out infinite;
    }

    .impact-loading__dot:nth-child(2) {
      animation-delay: 150ms;
    }

    .impact-loading__dot:nth-child(3) {
      animation-delay: 300ms;
    }

    .impact-loading__text {
      font-family: var(--font-mono);
      font-size: 0.6rem;
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: var(--tracking-widest);
    }

    .impact-empty {
      padding: var(--space-3) 0;
      font-family: var(--font-prose);
      font-size: var(--text-xs);
      font-style: italic;
      color: var(--color-text-muted);
    }

    /* ── Keyframes ─────────────────────────────────────────── */

    @keyframes card-enter {
      from {
        opacity: 0;
        transform: translateY(12px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes status-pulse {
      from { transform: scale(1); opacity: 1; }
      to { transform: scale(1.6); opacity: 0.4; }
    }

    @keyframes icon-glow {
      0%, 100% { filter: drop-shadow(0 0 2px currentColor); }
      50% { filter: drop-shadow(0 0 8px currentColor); }
    }

    @keyframes impacting-border {
      0%, 100% { border-color: var(--color-danger); }
      50% { border-color: color-mix(in srgb, var(--color-danger) 50%, transparent); }
    }

    @keyframes magnitude-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }

    @keyframes countdown-tick {
      50% { opacity: 0.6; }
    }

    @keyframes impact-row-enter {
      from {
        opacity: 0;
        transform: translateX(-6px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    @keyframes loading-dot {
      0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
      40% { opacity: 1; transform: scale(1); }
    }

    @media (prefers-reduced-motion: reduce) {
      .card,
      .status-dot,
      .icon-wrap,
      .magnitude-fill::after,
      .countdown.urgent,
      .impact-row,
      .impact-loading__dot {
        animation: none !important;
      }
      .card,
      .impact-row {
        opacity: 1;
      }
    }
  `;

  @property({ type: Object }) resonance!: Resonance;
  @property({ type: Number }) impactCount = 0;
  @property({ type: Boolean }) showProcessButton = false;

  @state() private _dispatchExpanded = false;
  @state() private _impactsExpanded = false;
  @state() private _impacts: ResolvedImpact[] = [];
  @state() private _impactsLoading = false;
  @state() private _impactsLoaded = false;
  @state() private _countdown = '';
  private _countdownTimer?: ReturnType<typeof setInterval>;

  connectedCallback(): void {
    super.connectedCallback();
    this._startCountdown();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._countdownTimer) clearInterval(this._countdownTimer);
  }

  private _startCountdown(): void {
    this._updateCountdown();
    this._countdownTimer = setInterval(() => this._updateCountdown(), 1000);
  }

  private _updateCountdown(): void {
    if (!this.resonance?.impacts_at) return;
    const target = new Date(this.resonance.impacts_at).getTime();
    const diff = target - Date.now();
    if (diff <= 0) {
      this._countdown = '';
      return;
    }
    const hours = Math.floor(diff / 3_600_000);
    const mins = Math.floor((diff % 3_600_000) / 60_000);
    const secs = Math.floor((diff % 60_000) / 1000);
    this._countdown = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  private _handleClick(): void {
    this.dispatchEvent(
      new CustomEvent('resonance-click', {
        detail: this.resonance,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleProcess(e: Event): void {
    e.stopPropagation();
    this.dispatchEvent(
      new CustomEvent('resonance-process', {
        detail: this.resonance.id,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _toggleDispatch(e: Event): void {
    e.stopPropagation();
    this._dispatchExpanded = !this._dispatchExpanded;
  }

  private async _toggleImpacts(e: Event): Promise<void> {
    e.stopPropagation();
    this._impactsExpanded = !this._impactsExpanded;
    if (this._impactsExpanded && !this._impactsLoaded) {
      await this._loadImpacts();
    }
  }

  private async _loadImpacts(): Promise<void> {
    this._impactsLoading = true;
    try {
      const res = await resonanceApi.listImpacts(this.resonance.id);
      if (res.success && res.data) {
        const sims = appState.simulations.value;
        this._impacts = res.data.map((impact) => {
          const sim = sims.find((s) => s.id === impact.simulation_id);
          return {
            ...impact,
            _simName: sim?.name ?? impact.simulation_id.slice(0, 8),
            _simSlug: sim?.slug ?? '',
          };
        });
        // Sort by effective_magnitude descending
        this._impacts.sort((a, b) => b.effective_magnitude - a.effective_magnitude);
        this._impactsLoaded = true;
      }
    } catch {
      // Silently handle – panel just stays empty
    } finally {
      this._impactsLoading = false;
    }
  }

  private _navigateToSim(e: Event, slug: string): void {
    e.stopPropagation();
    if (!slug) return;
    window.history.pushState({}, '', `/simulations/${slug}/events`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }

  private _getMagnitudeClass(mag?: number): string {
    const m = mag ?? this.resonance.magnitude;
    if (m <= 0.4) return 'low';
    if (m <= 0.7) return 'medium';
    return 'high';
  }

  private _statusLabel(status: string): string {
    switch (status) {
      case 'detected':
        return msg('Detected');
      case 'impacting':
        return msg('Impacting');
      case 'subsiding':
        return msg('Subsiding');
      case 'archived':
        return msg('Archived');
      default:
        return status;
    }
  }

  protected render() {
    if (!this.resonance) return nothing;

    const r = this.resonance;
    const statusClass = `status-${r.status}`;
    const magPct = Math.round(r.magnitude * 100);
    const isUrgent =
      r.status === 'detected' &&
      this._countdown !== '' &&
      new Date(r.impacts_at).getTime() - Date.now() < 3_600_000;

    return html`
      <div
        class=${classMap({ card: true, [statusClass]: true })}
        tabindex="0"
        role="article"
        aria-label=${`${r.archetype ?? 'Resonance'}: ${r.title ?? 'Unknown'}`}
        @click=${this._handleClick}
        @keydown=${(e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this._handleClick();
          }
        }}
      >
        <!-- Header -->
        <div class="header">
          <div class="icon-wrap" aria-hidden="true">
            ${icons.resonanceArchetype(r.resonance_signature, 20)}
          </div>
          <div class="title-block">
            <div class="archetype-label">
              ${ARCHETYPE_LABELS[r.resonance_signature] ?? r.archetype}
            </div>
            <div class="title">${r.title}</div>
          </div>
        </div>

        <!-- Status + Countdown -->
        <div class="meta-row">
          <span class="status-badge">
            <span class="status-dot"></span>
            ${this._statusLabel(r.status)}
          </span>
          ${
            this._countdown
              ? html`<span class=${classMap({ countdown: true, urgent: isUrgent })}
                aria-label=${msg('Time until impact')}
              >${this._countdown}</span>`
              : r.status === 'impacting'
                ? html`<span class="countdown urgent">${msg('IMPACTING')}</span>`
                : nothing
          }
        </div>

        <!-- Magnitude -->
        <div class="magnitude">
          <div class="magnitude-label">
            <span>${msg('Magnitude')}</span>
            <span class="magnitude-value">${r.magnitude.toFixed(2)}</span>
          </div>
          <div class="magnitude-track" role="meter" aria-valuenow=${magPct} aria-valuemin="0" aria-valuemax="100"
            aria-label=${msg('Tremor magnitude')}>
            <div class="magnitude-fill ${this._getMagnitudeClass()}"
              style="width: ${magPct}%"></div>
          </div>
        </div>

        <!-- Event Type Chips -->
        ${
          r.affected_event_types?.length
            ? html`<div class="chips" aria-label=${msg('Affected event types')}>
              ${r.affected_event_types.map(
                (t) => html`<span class="chip">${t.replace(/_/g, ' ')}</span>`,
              )}
            </div>`
            : nothing
        }

        <!-- Bureau Dispatch -->
        ${
          r.bureau_dispatch
            ? html`<div class="dispatch">
              <button class="dispatch-toggle"
                @click=${this._toggleDispatch}
                aria-expanded=${this._dispatchExpanded}
                aria-controls="dispatch-content">
                <span class="dispatch-chevron ${this._dispatchExpanded ? 'expanded' : ''}"
                  aria-hidden="true">${icons.chevronRight(10)}</span>
                ${msg('Bureau Dispatch')}
              </button>
              <div id="dispatch-content"
                class=${classMap({ 'dispatch-content': true, expanded: this._dispatchExpanded })}>
                <div class="dispatch-text">${
                  this._dispatchExpanded
                    ? r.bureau_dispatch
                    : `${r.bureau_dispatch.slice(0, 120)}...`
                }</div>
              </div>
            </div>`
            : nothing
        }

        <!-- Footer -->
        <div class="footer">
          ${
            this.impactCount > 0
              ? html`<button class="impact-toggle"
                @click=${this._toggleImpacts}
                aria-expanded=${this._impactsExpanded}
                aria-controls="impact-panel">
                <span class="impact-toggle__chevron ${this._impactsExpanded ? 'expanded' : ''}"
                  aria-hidden="true">${icons.chevronRight(10)}</span>
                ${icons.substrateTremor(12)}
                <strong>${this.impactCount}</strong> ${msg('impacts')}
              </button>`
              : html`<span class="impact-toggle">
                ${icons.substrateTremor(12)}
                <strong>0</strong> ${msg('impacts')}
              </span>`
          }
          ${
            this.showProcessButton && r.status === 'detected'
              ? html`<button class="process-btn"
                @click=${this._handleProcess}
                aria-label=${msg('Process impact across simulations')}>
                ${msg('Process')}
              </button>`
              : nothing
          }
        </div>

        <!-- Impact Panel -->
        <div id="impact-panel"
          class=${classMap({ 'impact-panel': true, expanded: this._impactsExpanded })}>
          ${this._impactsExpanded ? this._renderImpactList() : nothing}
        </div>
      </div>
    `;
  }

  private _renderImpactList() {
    if (this._impactsLoading) {
      return html`
        <div class="impact-list">
          <div class="impact-loading">
            <div class="impact-loading__dots">
              <span class="impact-loading__dot"></span>
              <span class="impact-loading__dot"></span>
              <span class="impact-loading__dot"></span>
            </div>
            <span class="impact-loading__text">${msg('Scanning affected shards...')}</span>
          </div>
        </div>
      `;
    }

    if (this._impacts.length === 0) {
      return html`
        <div class="impact-list">
          <div class="impact-empty">${msg('No impact records found.')}</div>
        </div>
      `;
    }

    return html`
      <div class="impact-list">
        <div class="impact-list__header">
          <span class="impact-list__label">${msg('Affected Shards')}</span>
          <span class="impact-list__col impact-list__col--mag">${msg('Mag')}</span>
          <span class="impact-list__col impact-list__col--events">${msg('Evts')}</span>
        </div>
        ${this._impacts.map(
          (impact, i) => html`
            <div class="impact-row"
              style="--row-i: ${i}"
              role="link"
              tabindex="0"
              aria-label="${impact._simName} – ${msg('magnitude')} ${impact.effective_magnitude.toFixed(2)}"
              @click=${(e: Event) => this._navigateToSim(e, impact._simSlug)}
              @keydown=${(e: KeyboardEvent) => {
                if (e.key === 'Enter') this._navigateToSim(e, impact._simSlug);
              }}>
              <span class="impact-row__status impact-row__status--${impact.status}"></span>
              <span class="impact-row__name">${impact._simName}</span>
              <span class="impact-row__mag">
                <span class="impact-row__mag-bar">
                  <span class="impact-row__mag-fill ${this._getMagnitudeClass(impact.effective_magnitude)}"
                    style="width: ${Math.round(impact.effective_magnitude * 100)}%"></span>
                </span>
                <span class="impact-row__mag-val">${impact.effective_magnitude.toFixed(2)}</span>
              </span>
              <span class="impact-row__events">${impact.spawned_event_ids?.length ?? 0}</span>
              <span class="impact-row__arrow" aria-hidden="true">${icons.chevronRight(10)}</span>
            </div>
          `,
        )}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'resonance-card': ResonanceCard;
  }
}

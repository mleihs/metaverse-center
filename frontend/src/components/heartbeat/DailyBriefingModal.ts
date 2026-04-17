/**
 * DailyBriefingModal — Classified Daily Substrate Dispatch.
 *
 * A once-per-day modal that summarizes 24h of heartbeat activity for a
 * simulation. Styled as a classified intelligence dispatch handed to a
 * Bureau operative — scanline texture, corner brackets, classification
 * stamp, health hero element, arc pressure bars.
 *
 * Dismissed via localStorage with a date-scoped key. Auto-dismisses
 * after 30 seconds with a visible progress bar.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import { t } from '../../utils/locale-fields.js';
import { navigate } from '../../utils/navigation.js';
import { focusFirstElement, trapFocus } from '../shared/focus-trap.js';
import '../shared/VelgDispatchStamp.js';
import { dispatchStyles } from '../shared/dispatch-styles.js';
import './AutonomyBriefingSection.js';

const AUTO_DISMISS_MS = 120_000;
const EXIT_DURATION_MS = 300;

interface BriefingWeatherZone {
  zone_name: string;
  narrative_en: string;
  narrative_de: string;
  temperature: number;
  categories: string[];
}

interface BriefingData {
  health: {
    overall_health?: number;
    health_label?: string;
    avg_zone_stability?: number;
    avg_readiness?: number;
  };
  entries_24h: number;
  entry_type_counts: Record<string, number>;
  critical_events: number;
  positive_events: number;
  active_arcs: number;
  arc_details: Array<{
    arc_type: string;
    primary_signature: string;
    status: string;
    pressure: number;
  }>;
  weather_zones?: BriefingWeatherZone[];
}

@localized()
@customElement('velg-daily-briefing')
export class VelgDailyBriefing extends LitElement {
  static styles = [
    dispatchStyles,
    css`
    /* ─────────────────────────────────────────────────────
     * PIN TO PLATFORM-DARK TOKENS
     * Simulation themes override color tokens on the shell.
     * This overlay must always render in the platform-dark
     * palette, so we re-assert the :root defaults from
     * _colors.css on :host, making all var() references
     * resolve to the dark values regardless of sim theme.
     * ───────────────────────────────────────────────────── */

    :host {
      display: block;

      /* Re-assert platform-dark defaults (from _colors.css :root) */
      --color-surface: #0a0a0a;
      --color-surface-sunken: #060606;
      --color-surface-raised: #111111;
      --color-surface-overlay: #111111;
      --color-text-primary: #e5e5e5;
      --color-text-secondary: #a0a0a0;
      --color-text-muted: #888888;
      --color-text-inverse: #0a0a0a;
      --color-border: #333333;
      --color-border-light: #222222;
      --color-primary: #f59e0b;
      --color-primary-hover: #fbbf24;
      --color-accent-amber: #f59e0b;
    }

    /* ── Backdrop ───────────────────────────────────────── */

    .backdrop {
      position: fixed;
      inset: 0;
      z-index: var(--z-modal);
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.78);
      opacity: 0;
      visibility: hidden;
      transition:
        opacity var(--duration-slow, 300ms) var(--ease-default),
        visibility var(--duration-slow, 300ms) var(--ease-default);
    }

    .backdrop--open {
      opacity: 1;
      visibility: visible;
    }

    /* ── Dispatch container ─────────────────────────────── */
    /* Override shared .dispatch: modal uses transition-based entrance, not animation */

    .dispatch {
      position: relative;
      width: 100%;
      max-width: 480px;
      max-height: 85vh;
      max-height: 85dvh;
      display: flex;
      flex-direction: column;
      gap: 0;
      padding: 0;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      box-shadow:
        0 0 0 1px rgba(255, 255, 255, 0.04),
        0 24px 64px rgba(0, 0, 0, 0.7);
      overflow: hidden;
      animation: none;
      transform: translateY(20px) scale(0.97);
      opacity: 0;
      transition:
        transform var(--duration-entrance, 350ms) var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)),
        opacity var(--duration-entrance, 350ms) var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1));
    }

    .backdrop--open .dispatch {
      transform: translateY(0) scale(1);
      opacity: 1;
    }

    .dispatch--exiting {
      transform: translateY(-10px) scale(0.98) !important;
      opacity: 0 !important;
      transition:
        transform ${EXIT_DURATION_MS}ms var(--ease-in),
        opacity ${EXIT_DURATION_MS}ms var(--ease-in) !important;
    }

    /* Corner brackets — classified document framing */
    .dispatch::before,
    .dispatch::after {
      content: '';
      position: absolute;
      width: 14px;
      height: 14px;
      border-color: var(--color-primary);
      border-style: solid;
      opacity: 0.5;
      pointer-events: none;
      z-index: 4;
    }

    .dispatch::before {
      top: -1px;
      left: -1px;
      border-width: 2px 0 0 2px;
    }

    .dispatch::after {
      bottom: -1px;
      right: -1px;
      border-width: 0 2px 2px 0;
    }

    /* Additional corner brackets (bottom-left, top-right) */
    .dispatch__corner-bl,
    .dispatch__corner-tr {
      position: absolute;
      width: 14px;
      height: 14px;
      border-color: var(--color-primary);
      border-style: solid;
      opacity: 0.5;
      pointer-events: none;
      z-index: 4;
    }

    .dispatch__corner-tr {
      top: -1px;
      right: -1px;
      border-width: 2px 2px 0 0;
    }

    .dispatch__corner-bl {
      bottom: -1px;
      left: -1px;
      border-width: 0 0 2px 2px;
    }

    /* Scanline texture overlay */
    .dispatch__scanlines {
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 2px,
        rgba(255, 255, 255, 0.015) 2px,
        rgba(255, 255, 255, 0.015) 4px
      );
      pointer-events: none;
      z-index: 1;
    }

    /* Watermark positioning */
    .dispatch__watermark-wrap {
      z-index: 0;
    }

    /* ── Header ─────────────────────────────────────────── */

    .dispatch__header {
      position: relative;
      padding: var(--space-4) var(--space-5) var(--space-3);
      border-bottom: 1px solid var(--color-border-light);
      z-index: 3;
    }

    .dispatch__title {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-black);
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--color-text-primary);
      margin: 0;
    }

    .dispatch__subtitle {
      font-family: var(--font-mono);
      font-size: 9px;
      letter-spacing: 0.08em;
      color: var(--color-text-muted);
      margin-top: var(--space-1);
    }

    /* Classification stamp positioning */
    .dispatch__stamp-wrap {
      position: absolute;
      top: var(--space-3);
      right: var(--space-4);
      z-index: 3;
    }

    /* ── Body ───────────────────────────────────────────── */

    .dispatch__body {
      flex: 1;
      overflow-y: auto;
      padding: var(--space-5);
      position: relative;
      z-index: 3;
    }

    /* ── Health Hero ────────────────────────────────────── */

    .health {
      margin-bottom: var(--space-5);
    }

    .health__label {
      font-family: var(--font-brutalist);
      font-size: 9px;
      font-weight: var(--font-bold);
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: var(--color-text-muted);
      margin-bottom: var(--space-2);
    }

    .health__bar-wrap {
      position: relative;
      height: 32px;
      background: var(--color-surface-sunken);
      border: 1px solid var(--color-border);
      overflow: hidden;
    }

    .health__bar {
      height: 100%;
      transition: width 600ms var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1));
    }

    .health__bar--critical {
      background: linear-gradient(90deg, var(--color-danger) 0%, var(--color-danger-bg) 100%);
    }

    .health__bar--warning {
      background: linear-gradient(90deg, var(--color-warning) 0%, var(--color-warning-bg) 100%);
    }

    .health__bar--good {
      background: linear-gradient(90deg, var(--color-success) 0%, var(--color-success-bg) 100%);
    }

    .health__bar--excellent {
      background: linear-gradient(90deg, var(--color-primary) 0%, var(--color-primary-bg) 100%);
    }

    .health__overlay {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 var(--space-3);
      pointer-events: none;
    }

    .health__percent {
      font-family: var(--font-brutalist);
      font-size: var(--text-lg);
      font-weight: var(--font-black);
      color: var(--color-text-primary);
      text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
    }

    .health__badge {
      font-family: var(--font-brutalist);
      font-size: 9px;
      font-weight: var(--font-black);
      letter-spacing: 0.15em;
      text-transform: uppercase;
      padding: 2px 8px;
      background: rgba(0, 0, 0, 0.6);
      border: 1px solid;
    }

    .health__badge--critical {
      color: var(--color-danger);
      border-color: var(--color-danger-border);
    }

    .health__badge--warning {
      color: var(--color-warning);
      border-color: var(--color-warning-border);
    }

    .health__badge--good {
      color: var(--color-success);
      border-color: var(--color-success-border);
    }

    .health__badge--excellent {
      color: var(--color-primary);
      border-color: var(--color-primary-bg);
    }

    /* ── Stat Grid ──────────────────────────────────────── */

    .stats {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-2);
      margin-bottom: var(--space-5);
    }

    /* ── Weather Section ─────────────────────────────────── */

    .weather-section {
      margin-bottom: var(--space-4);
    }

    .weather-zone {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: var(--space-1) var(--space-3);
      padding: var(--space-2) 0;
      border-bottom: 1px solid var(--color-border-light);
    }

    .weather-zone:last-child {
      border-bottom: none;
    }

    .weather-zone__name {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-text-primary);
    }

    .weather-zone__temp {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      text-align: right;
    }

    .weather-zone__narrative {
      grid-column: 1 / -1;
      font-family: var(--font-body);
      font-size: 11px;
      line-height: 1.4;
      color: var(--color-text-secondary);
    }

    /* ── Arc Details ────────────────────────────────────── */

    .arcs {
      margin-bottom: var(--space-4);
    }

    .arc {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-2) 0;
      border-bottom: 1px solid var(--color-border-light);
    }

    .arc:last-child {
      border-bottom: none;
    }

    .arc__name {
      flex: 1;
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0;
    }

    .arc__pressure-wrap {
      width: 60px;
      height: 6px;
      background: var(--color-surface-sunken);
      flex-shrink: 0;
      overflow: hidden;
    }

    .arc__pressure-bar {
      height: 100%;
      background: var(--color-text-secondary);
      transition: width 400ms var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1));
    }

    .arc__pressure-bar--high {
      background: var(--color-warning);
    }

    .arc__pressure-bar--critical {
      background: var(--color-danger);
    }

    .arc__value {
      font-family: var(--font-mono);
      font-size: 10px;
      color: var(--color-text-muted);
      width: 32px;
      text-align: right;
      flex-shrink: 0;
    }

    /* ── Footer ─────────────────────────────────────────── */

    .dispatch__footer {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-5) var(--space-4);
      border-top: 1px solid var(--color-border-light);
      position: relative;
      z-index: 3;
    }

    .btn {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-black);
      letter-spacing: 0.12em;
      text-transform: uppercase;
      padding: var(--space-2) var(--space-4);
      cursor: pointer;
      transition:
        background var(--duration-fast, 100ms) ease,
        color var(--duration-fast, 100ms) ease,
        border-color var(--duration-fast, 100ms) ease,
        transform var(--duration-fast, 100ms) ease,
        box-shadow var(--duration-fast, 100ms) ease;
    }

    .btn:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
    }

    .btn--primary {
      flex: 1;
      background: var(--color-primary);
      color: var(--color-text-inverse);
      border: 1px solid var(--color-primary);
    }

    .btn--primary:hover {
      background: var(--color-primary-hover);
      transform: translate(-1px, -1px);
      box-shadow: 2px 2px 0 var(--color-primary);
    }

    .btn--primary:active {
      transform: translate(0);
      box-shadow: none;
    }

    .btn--ghost {
      flex: 1;
      background: transparent;
      color: var(--color-text-secondary);
      border: 1px solid var(--color-border);
    }

    .btn--ghost:hover {
      color: var(--color-primary);
      border-color: var(--color-primary);
    }

    /* ── Auto-dismiss progress bar ──────────────────────── */

    .dispatch__progress {
      position: absolute;
      bottom: 0;
      left: 0;
      height: 2px;
      width: 100%;
      background: var(--color-primary);
      z-index: 5;
      transform-origin: left;
      animation: briefing-progress-decay ${AUTO_DISMISS_MS}ms linear forwards;
    }

    @keyframes briefing-progress-decay {
      from { transform: scaleX(1); }
      to { transform: scaleX(0); }
    }

    .dispatch__progress--paused {
      animation-play-state: paused;
    }

    /* ── Reduced motion ─────────────────────────────────── */

    @media (prefers-reduced-motion: reduce) {
      .dispatch {
        transform: none;
        opacity: 1;
        transition: none;
      }

      .dispatch--exiting {
        transform: none !important;
        transition: opacity ${EXIT_DURATION_MS}ms ease !important;
      }

      .dispatch__progress {
        animation: none;
        transform: scaleX(0);
      }

      .health__bar {
        transition: none;
      }

      .arc__pressure-bar {
        transition: none;
      }
    }

    /* ── Mobile ──────────────────────────────────────────── */

    @media (max-width: 640px) {
      .dispatch {
        max-width: none;
        margin: var(--space-3);
        max-height: 90vh;
        max-height: 90dvh;
      }

      .dispatch__header {
        padding: var(--space-3) var(--space-4) var(--space-2);
      }

      .dispatch__body {
        padding: var(--space-4);
      }

      .dispatch__footer {
        flex-direction: column;
        padding: var(--space-3) var(--space-4);
      }

      .btn--primary,
      .btn--ghost {
        width: 100%;
        text-align: center;
      }

      .stats {
        grid-template-columns: 1fr 1fr;
        gap: var(--space-1-5, 6px);
      }

      .dispatch-stat {
        padding: var(--space-2);
      }

      .health__percent {
        font-size: var(--text-base);
      }
    }
  `,
  ];

  @property({ type: String }) simulationId = '';
  @property({ type: String }) simulationSlug = '';
  @property({ type: Object }) briefingData: BriefingData | null = null;

  @state() private _open = false;
  @state() private _exiting = false;
  @state() private _progressPaused = false;

  private _autoDismissTimer?: ReturnType<typeof setTimeout>;
  private _boundKeyDown = this._handleKeyDown.bind(this);

  private get _storageKey(): string {
    const today = new Date().toISOString().split('T')[0];
    return `briefing_dismissed_${today}`;
  }

  private get _isDismissedToday(): boolean {
    return !!localStorage.getItem(this._storageKey);
  }

  connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('keydown', this._boundKeyDown);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this._boundKeyDown);
    this._clearAutoDismiss();
    document.body.style.overflow = '';
  }

  protected updated(changedProperties: Map<PropertyKey, unknown>): void {
    if (changedProperties.has('briefingData')) {
      if (this.briefingData && !this._isDismissedToday) {
        this._show();
      }
    }
  }

  private _show(): void {
    this._open = true;
    this._exiting = false;
    document.body.style.overflow = 'hidden';
    this._startAutoDismiss();
    focusFirstElement(this.shadowRoot);
  }

  private _startAutoDismiss(): void {
    this._clearAutoDismiss();
    this._autoDismissTimer = setTimeout(() => {
      this._dismiss();
    }, AUTO_DISMISS_MS);
  }

  private _clearAutoDismiss(): void {
    if (this._autoDismissTimer) {
      clearTimeout(this._autoDismissTimer);
      this._autoDismissTimer = undefined;
    }
  }

  private _dismiss(): void {
    if (!this._open || this._exiting) return;
    this._exiting = true;
    this._clearAutoDismiss();
    localStorage.setItem(this._storageKey, '1');

    setTimeout(() => {
      this._open = false;
      this._exiting = false;
      document.body.style.overflow = '';
      this.dispatchEvent(new CustomEvent('briefing-dismissed', { bubbles: true, composed: true }));
    }, EXIT_DURATION_MS);
  }

  private _navigate(): void {
    this._clearAutoDismiss();
    localStorage.setItem(this._storageKey, '1');
    const slug = this.simulationSlug || this.simulationId;
    this._exiting = true;

    setTimeout(() => {
      this._open = false;
      this._exiting = false;
      document.body.style.overflow = '';
      this.dispatchEvent(new CustomEvent('briefing-dismissed', { bubbles: true, composed: true }));
      navigate(`/simulations/${slug}/pulse`);
    }, EXIT_DURATION_MS);
  }

  private _handleKeyDown(e: KeyboardEvent): void {
    if (!this._open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      this._dismiss();
      return;
    }
    if (e.key === 'Tab') {
      trapFocus(e, this.shadowRoot?.querySelector('.dispatch'), this);
    }
  }

  private _handleBackdropClick(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('backdrop')) {
      this._dismiss();
    }
  }

  private _handleMouseEnter(): void {
    this._progressPaused = true;
    this._clearAutoDismiss();
  }

  private _handleMouseLeave(): void {
    this._progressPaused = false;
    this._startAutoDismiss();
  }

  /* ── Health classification helpers ── */

  private _healthTier(pct: number): 'critical' | 'warning' | 'good' | 'excellent' {
    if (pct < 25) return 'critical';
    if (pct < 50) return 'warning';
    if (pct < 80) return 'good';
    return 'excellent';
  }

  private _timestamp(): string {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  }

  /* ── Render ── */

  protected render() {
    if (!this._open || !this.briefingData) return nothing;

    const data = this.briefingData;
    const health = data.health;
    const pct = Math.round((health.overall_health ?? 0) * 100);
    const tier = this._healthTier(pct);
    const label = (health.health_label ?? 'unknown').toUpperCase();

    return html`
      <div
        class="backdrop ${this._open ? 'backdrop--open' : ''}"
        @click=${this._handleBackdropClick}
      >
        <div
          class="dispatch ${this._exiting ? 'dispatch--exiting' : ''}"
          role="dialog"
          aria-modal="true"
          aria-labelledby="briefing-title"
          @mouseenter=${this._handleMouseEnter}
          @mouseleave=${this._handleMouseLeave}
        >
          <div class="dispatch__scanlines" aria-hidden="true"></div>
          <velg-dispatch-stamp class="dispatch__watermark-wrap" variant="watermark" text="CLASSIFIED"></velg-dispatch-stamp>
          <span class="dispatch__corner-tr" aria-hidden="true"></span>
          <span class="dispatch__corner-bl" aria-hidden="true"></span>

          <!-- Header -->
          <div class="dispatch__header">
            <h2 class="dispatch__title" id="briefing-title">
              ${msg('Daily Substrate Dispatch')}
            </h2>
            <div class="dispatch__subtitle">${this._timestamp()} // BUREAU SIGNALS DIVISION</div>
            <velg-dispatch-stamp class="dispatch__stamp-wrap" variant="badge" tone="danger" text=${msg('Classified')}></velg-dispatch-stamp>
          </div>

          <!-- Body -->
          <div class="dispatch__body">
            ${this._renderHealth(pct, tier, label)}
            ${this._renderStats(data)}
            ${data.arc_details.length > 0 ? this._renderArcs(data.arc_details) : nothing}
            ${data.weather_zones?.length ? this._renderWeather(data.weather_zones) : nothing}

            <!-- Agent Autonomy Report (if enabled) -->
            <velg-autonomy-briefing
              .simulationId=${this.simulationId}
            ></velg-autonomy-briefing>
          </div>

          <!-- Footer -->
          <div class="dispatch__footer">
            <button class="btn btn--primary" @click=${this._dismiss}>
              ${msg('Acknowledge')}
            </button>
            <button class="btn btn--ghost" @click=${this._navigate}>
              ${msg('View Chronicle')} →
            </button>
          </div>

          <!-- Auto-dismiss progress bar -->
          <div
            class="dispatch__progress ${this._progressPaused ? 'dispatch__progress--paused' : ''}"
            aria-hidden="true"
          ></div>
        </div>
      </div>
    `;
  }

  private _renderHealth(pct: number, tier: string, label: string) {
    return html`
      <div class="health">
        <div class="health__label">${msg('Health Status')}</div>
        <div
          class="health__bar-wrap"
          role="meter"
          aria-label=${msg('Overall health')}
          aria-valuenow=${pct}
          aria-valuemin=${0}
          aria-valuemax=${100}
        >
          <div
            class="health__bar health__bar--${tier}"
            style="width: ${pct}%"
          ></div>
          <div class="health__overlay">
            <span class="health__percent">${pct}%</span>
            <span class="health__badge health__badge--${tier}">${label}</span>
          </div>
        </div>
      </div>
    `;
  }

  private _renderStats(data: BriefingData) {
    return html`
      <div class="dispatch-section-label">${msg('24h Activity')}</div>
      <div class="stats">
        <div class="dispatch-stat">
          <div class="dispatch-stat__value dispatch-stat__value--critical">${data.critical_events}</div>
          <div class="dispatch-stat__label">${msg('critical')}</div>
        </div>
        <div class="dispatch-stat">
          <div class="dispatch-stat__value dispatch-stat__value--positive">${data.positive_events}</div>
          <div class="dispatch-stat__label">${msg('positive')}</div>
        </div>
        <div class="dispatch-stat">
          <div class="dispatch-stat__value dispatch-stat__value--neutral">${data.entries_24h}</div>
          <div class="dispatch-stat__label">${msg('total entries')}</div>
        </div>
        <div class="dispatch-stat">
          <div class="dispatch-stat__value dispatch-stat__value--accent">${data.active_arcs}</div>
          <div class="dispatch-stat__label">${msg('active arcs')}</div>
        </div>
      </div>
    `;
  }

  private _renderWeather(zones: BriefingWeatherZone[]) {
    return html`
      <div class="weather-section">
        <div class="dispatch-section-label">${msg('Ambient Conditions')}</div>
        ${zones.map((zone) => {
          const narrative = t(
            { narrative: zone.narrative_en, narrative_de: zone.narrative_de },
            'narrative',
          ) as string;
          return html`
            <div class="weather-zone">
              <span class="weather-zone__name">${zone.zone_name}</span>
              <span class="weather-zone__temp">${zone.temperature}°C</span>
              <div class="weather-zone__narrative">${narrative}</div>
            </div>
          `;
        })}
      </div>
    `;
  }

  private _renderArcs(arcs: BriefingData['arc_details']) {
    return html`
      <div class="arcs">
        <div class="dispatch-section-label">${msg('Active Narrative Arcs')}</div>
        ${arcs.map((arc) => {
          const pressure = arc.pressure ?? 0;
          const pct = Math.round(pressure * 100);
          const barTier = pressure >= 0.7 ? '--critical' : pressure >= 0.4 ? '--high' : '';
          return html`
            <div class="arc">
              <span class="arc__name" title="${arc.arc_type}/${arc.primary_signature}">
                ${arc.arc_type}/${arc.primary_signature}
              </span>
              <div
                class="arc__pressure-wrap"
                role="meter"
                aria-label="${arc.arc_type}/${arc.primary_signature} ${msg('pressure')}"
                aria-valuenow=${pct}
                aria-valuemin=${0}
                aria-valuemax=${100}
              >
                <div
                  class="arc__pressure-bar ${barTier ? `arc__pressure-bar${barTier}` : ''}"
                  style="width: ${pct}%"
                ></div>
              </div>
              <span class="arc__value">${pressure.toFixed(2)}</span>
            </div>
          `;
        })}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-daily-briefing': VelgDailyBriefing;
  }
}

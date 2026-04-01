import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { appState } from '../../services/AppStateManager.js';
import { resonanceApi } from '../../services/api/index.js';
import type { Resonance, ResonanceImpact } from '../../types/index.js';
import { formatDateTime } from '../../utils/date-format.js';
import { icons } from '../../utils/icons.js';
import { panelButtonStyles } from '../shared/panel-button-styles.js';
import { panelCascadeStyles } from '../shared/panel-cascade-styles.js';
import '../shared/EntityLightbox.js';
import '../shared/VelgSectionHeader.js';

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
@customElement('velg-resonance-details-panel')
export class VelgResonanceDetailsPanel extends LitElement {
  static styles = [
    panelButtonStyles,
    panelCascadeStyles,
    css`
      :host {
        display: block;
      }

      /* ── Dossier Hero (media slot) ──────────────────────────── */

      .dossier {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: var(--space-5);
        padding: var(--space-6);
        background: var(--color-surface-sunken);
        position: relative;
        overflow: hidden;
        box-sizing: border-box;
      }

      .dossier::before {
        content: '';
        position: absolute;
        inset: 0;
        background: repeating-linear-gradient(
          0deg,
          transparent,
          transparent 2px,
          rgba(128, 128, 128, 0.05) 2px,
          rgba(128, 128, 128, 0.05) 4px
        );
        pointer-events: none;
        z-index: 1;
      }

      /* Archetype seal */
      .dossier__seal {
        position: relative;
        z-index: 2;
        width: 100px;
        height: 100px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 3px solid var(--color-border);
        background: var(--color-surface);
        box-shadow:
          0 0 0 6px var(--color-surface-sunken),
          0 0 0 8px var(--color-border-light);
        transition:
          border-color var(--transition-normal),
          color var(--transition-normal);
      }

      .dossier__seal--detected {
        border-color: var(--color-info);
        color: var(--color-info);
      }

      .dossier__seal--impacting {
        border-color: var(--color-danger);
        color: var(--color-danger);
        animation: seal-pulse 2s ease-in-out infinite;
      }

      .dossier__seal--subsiding {
        border-color: var(--color-warning);
        color: var(--color-warning);
      }

      .dossier__seal--archived {
        border-color: var(--color-border-light);
        color: var(--color-text-muted);
      }

      /* Status badge in hero */
      .dossier__status {
        position: relative;
        z-index: 2;
        display: inline-flex;
        align-items: center;
        gap: var(--space-1-5);
        padding: var(--space-1) var(--space-3);
        font-family: var(--font-brutalist);
        font-size: var(--text-xs);
        font-weight: var(--font-bold);
        text-transform: uppercase;
        letter-spacing: var(--tracking-widest);
        border: var(--border-width-default) solid;
      }

      .dossier__status--detected {
        border-color: var(--color-info);
        color: var(--color-info);
      }

      .dossier__status--impacting {
        border-color: var(--color-danger);
        color: var(--color-danger);
        background: var(--color-danger-bg);
      }

      .dossier__status--subsiding {
        border-color: var(--color-warning);
        color: var(--color-warning);
      }

      .dossier__status--archived {
        border-color: var(--color-border-light);
        color: var(--color-text-muted);
      }

      .dossier__status-dot {
        width: 7px;
        height: 7px;
        border-radius: var(--border-radius-full);
        background: currentColor;
      }

      .dossier__status--detected .dossier__status-dot {
        animation: status-pulse 1.5s ease-in-out infinite alternate;
      }

      .dossier__status--impacting .dossier__status-dot {
        animation: status-pulse 0.8s ease-in-out infinite alternate;
      }

      /* Magnitude gauge in hero */
      .dossier__magnitude {
        position: relative;
        z-index: 2;
        width: 100%;
        max-width: 240px;
      }

      .dossier__mag-label {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        margin-bottom: var(--space-1);
      }

      .dossier__mag-label span {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wider);
      }

      .dossier__mag-value {
        font-weight: var(--font-bold);
        color: var(--color-text-primary);
        font-size: var(--text-base);
      }

      .dossier__mag-track {
        height: 12px;
        background: var(--color-surface);
        border: var(--border-width-default) solid var(--color-border-light);
        position: relative;
        overflow: hidden;
      }

      .dossier__mag-fill {
        height: 100%;
        transition: width 600ms var(--ease-dramatic);
        position: relative;
      }

      .dossier__mag-fill.low {
        background: linear-gradient(90deg, var(--color-info), var(--color-info));
      }
      .dossier__mag-fill.medium {
        background: linear-gradient(90deg, var(--color-primary), var(--color-primary-hover));
      }
      .dossier__mag-fill.high {
        background: linear-gradient(90deg, var(--color-danger), var(--color-danger));
      }

      .dossier__mag-fill::after {
        content: '';
        position: absolute;
        right: 0;
        top: 0;
        bottom: 0;
        width: 16px;
        background: inherit;
        filter: brightness(1.3);
        animation: magnitude-pulse 2s ease-in-out infinite;
      }

      /* Countdown in hero */
      .dossier__countdown {
        position: relative;
        z-index: 2;
        font-family: var(--font-mono);
        font-size: var(--text-lg);
        font-weight: var(--font-bold);
        color: var(--color-text-secondary);
        letter-spacing: var(--tracking-widest);
      }

      .dossier__countdown.urgent {
        color: var(--color-danger);
        animation: countdown-tick 1s steps(1) infinite;
      }

      /* Source category stamp */
      .dossier__source {
        position: relative;
        z-index: 2;
        font-family: var(--font-mono);
        font-size: 0.6rem;
        text-transform: uppercase;
        letter-spacing: var(--tracking-widest);
        color: var(--color-text-muted);
        padding: var(--space-0-5) var(--space-2);
        border: var(--border-width-thin) solid var(--color-border-light);
        background: var(--color-surface);
      }

      /* ── Content Sections ───────────────────────────────────── */

      .panel__content {
        display: flex;
        flex-direction: column;
        gap: var(--space-5);
        padding: var(--space-6);
      }

      .panel__section {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }

      .panel__description {
        font-family: var(--font-body);
        font-size: var(--text-base);
        line-height: var(--leading-relaxed);
        color: var(--color-text-primary);
        margin: 0;
      }

      .panel__dispatch {
        font-family: var(--font-prose);
        font-size: var(--text-sm);
        line-height: var(--leading-relaxed);
        color: var(--color-text-secondary);
        white-space: pre-wrap;
        margin: 0;
        padding: var(--space-3);
        background: var(--color-surface-sunken);
        border-left: 3px solid var(--color-border);
      }

      /* Event type chips */
      .panel__chips {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-1-5);
      }

      .panel__chip {
        padding: var(--space-1) var(--space-2);
        font-family: var(--font-mono);
        font-size: 0.65rem;
        text-transform: uppercase;
        letter-spacing: var(--tracking-wider);
        color: var(--color-text-secondary);
        background: var(--color-surface-sunken);
        border: var(--border-width-thin) solid var(--color-border-light);
        white-space: nowrap;
      }

      /* ── Impact Table ───────────────────────────────────────── */

      .impact-table {
        display: flex;
        flex-direction: column;
      }

      .impact-table__header {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-2) 0;
        border-bottom: var(--border-width-default) solid var(--color-border);
      }

      .impact-table__col {
        font-family: var(--font-brutalist);
        font-size: 0.6rem;
        font-weight: var(--font-bold);
        text-transform: uppercase;
        letter-spacing: var(--tracking-widest);
        color: var(--color-text-muted);
      }

      .impact-table__col--shard {
        flex: 1;
        min-width: 0;
      }

      .impact-table__col--mag {
        width: 72px;
        text-align: right;
        flex-shrink: 0;
      }

      .impact-table__col--events {
        width: 44px;
        text-align: right;
        flex-shrink: 0;
      }

      .impact-table__col--status {
        width: 56px;
        text-align: right;
        flex-shrink: 0;
      }

      /* Impact rows */
      .impact-row {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-2) 0;
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

      .impact-row:focus-visible {
        outline: none;
        box-shadow: var(--ring-focus);
      }

      .impact-row__dot {
        width: 6px;
        height: 6px;
        border-radius: var(--border-radius-full);
        flex-shrink: 0;
      }

      .impact-row__dot--completed {
        background: var(--color-success);
      }

      .impact-row__dot--pending,
      .impact-row__dot--generating {
        background: var(--color-warning);
        animation: status-pulse 1.5s ease-in-out infinite alternate;
      }

      .impact-row__dot--failed {
        background: var(--color-danger);
      }

      .impact-row__dot--skipped {
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
        width: 72px;
        display: flex;
        align-items: center;
        gap: var(--space-1);
        flex-shrink: 0;
        justify-content: flex-end;
      }

      .impact-row__mag-bar {
        width: 36px;
        height: 4px;
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
        font-size: 0.65rem;
        color: var(--color-text-secondary);
        min-width: 24px;
        text-align: right;
      }

      .impact-row__events {
        width: 44px;
        font-family: var(--font-mono);
        font-size: 0.65rem;
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

      /* Loading + empty states */
      .impact-loading {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-4) 0;
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
        padding: var(--space-4) 0;
        font-family: var(--font-prose);
        font-size: var(--text-sm);
        font-style: italic;
        color: var(--color-text-muted);
      }

      /* ── Timeline section ───────────────────────────────────── */

      .panel__timeline {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }

      .timeline-entry {
        display: flex;
        align-items: baseline;
        gap: var(--space-3);
      }

      .timeline-entry__label {
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: var(--text-xs);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
        color: var(--color-text-muted);
        flex-shrink: 0;
        min-width: 80px;
      }

      .timeline-entry__value {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
      }

      /* ── Keyframes ──────────────────────────────────────────── */

      @keyframes seal-pulse {
        0%,
        100% {
          box-shadow:
            0 0 0 6px var(--color-surface-sunken),
            0 0 0 8px var(--color-border-light),
            0 0 12px color-mix(in srgb, var(--color-danger) 20%, transparent);
        }
        50% {
          box-shadow:
            0 0 0 6px var(--color-surface-sunken),
            0 0 0 8px var(--color-border-light),
            0 0 24px color-mix(in srgb, var(--color-danger) 40%, transparent);
        }
      }

      @keyframes status-pulse {
        from {
          transform: scale(1);
          opacity: 1;
        }
        to {
          transform: scale(1.6);
          opacity: 0.4;
        }
      }

      @keyframes magnitude-pulse {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.3;
        }
      }

      @keyframes countdown-tick {
        50% {
          opacity: 0.6;
        }
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
        0%,
        80%,
        100% {
          opacity: 0.3;
          transform: scale(0.8);
        }
        40% {
          opacity: 1;
          transform: scale(1);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .dossier__seal--impacting,
        .dossier__status-dot,
        .dossier__countdown.urgent,
        .dossier__mag-fill::after,
        .impact-row,
        .impact-loading__dot {
          animation: none !important;
        }
        .impact-row {
          opacity: 1;
        }
      }
    `,
  ];

  @property({ attribute: false }) resonance: Resonance | null = null;
  @property({ type: Boolean, reflect: true }) open = false;
  @property({ type: Number }) totalEntities = 0;
  @property({ type: Number }) currentIndex = 0;

  @state() private _impacts: ResolvedImpact[] = [];
  @state() private _impactsLoading = false;
  @state() private _countdown = '';
  private _countdownTimer?: ReturnType<typeof setInterval>;
  private _loadedResonanceId = '';

  connectedCallback(): void {
    super.connectedCallback();
    this._startCountdown();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._countdownTimer) clearInterval(this._countdownTimer);
  }

  protected willUpdate(changedProperties: Map<PropertyKey, unknown>): void {
    if (changedProperties.has('resonance') || changedProperties.has('open')) {
      if (this.open && this.resonance) {
        if (this.resonance.id !== this._loadedResonanceId) {
          this._loadImpacts();
        }
        this._startCountdown();
      } else {
        this._impacts = [];
        this._loadedResonanceId = '';
        if (this._countdownTimer) clearInterval(this._countdownTimer);
      }
    }
  }

  private _startCountdown(): void {
    if (this._countdownTimer) clearInterval(this._countdownTimer);
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

  private async _loadImpacts(): Promise<void> {
    if (!this.resonance) return;
    this._impactsLoading = true;
    this._loadedResonanceId = this.resonance.id;
    try {
      const res = await resonanceApi.listImpacts(this.resonance.id);
      if (res.success && res.data) {
        this._impacts = res.data
          .map((impact) => ({
            ...impact,
            _simName: impact.simulation_name ?? impact.simulation_id.slice(0, 8),
            _simSlug: impact.simulation_slug ?? '',
          }))
          .sort((a, b) => b.effective_magnitude - a.effective_magnitude);
      }
    } catch {
      // Impact data not critical
    } finally {
      this._impactsLoading = false;
    }
  }

  private _getMagnitudeClass(mag?: number): string {
    if (this.resonance?.magnitude_class && mag === undefined) {
      return this.resonance.magnitude_class;
    }
    const m = mag ?? this.resonance?.magnitude ?? 0;
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

  private _navigateToSim(slug: string): void {
    if (!slug) return;
    window.history.pushState({}, '', `/simulations/${slug}/events`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }

  private _handleProcess(): void {
    if (!this.resonance) return;
    this.dispatchEvent(
      new CustomEvent('resonance-process', {
        detail: this.resonance.id,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleEdit(): void {
    if (!this.resonance) return;
    this.dispatchEvent(
      new CustomEvent('resonance-edit', {
        detail: this.resonance,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private get _isPlatformAdmin(): boolean {
    return appState.isPlatformAdmin?.value ?? false;
  }

  // ── Render ──

  private _renderMedia() {
    const r = this.resonance;
    if (!r) return nothing;
    const magPct = Math.round(r.magnitude * 100);
    const isUrgent =
      r.status === 'detected' &&
      this._countdown !== '' &&
      new Date(r.impacts_at).getTime() - Date.now() < 3_600_000;

    return html`
      <div slot="media">
        <div class="dossier">
          <!-- Archetype seal -->
          <div class="dossier__seal dossier__seal--${r.status}">
            ${icons.resonanceArchetype(r.resonance_signature, 48)}
          </div>

          <!-- Status badge -->
          <span class="dossier__status dossier__status--${r.status}">
            <span class="dossier__status-dot"></span>
            ${this._statusLabel(r.status)}
          </span>

          <!-- Magnitude gauge -->
          <div class="dossier__magnitude">
            <div class="dossier__mag-label">
              <span>${msg('Magnitude')}</span>
              <span class="dossier__mag-value">${r.magnitude.toFixed(2)}</span>
            </div>
            <div
              class="dossier__mag-track"
              role="meter"
              aria-valuenow=${magPct}
              aria-valuemin="0"
              aria-valuemax="100"
              aria-label=${msg('Tremor magnitude')}
            >
              <div
                class="dossier__mag-fill ${this._getMagnitudeClass()}"
                style="width: ${magPct}%"
              ></div>
            </div>
          </div>

          <!-- Countdown -->
          ${
            this._countdown
              ? html`<span
                class=${classMap({
                  dossier__countdown: true,
                  urgent: isUrgent,
                })}
                aria-label=${msg('Time until impact')}
                >${this._countdown}</span
              >`
              : r.status === 'impacting'
                ? html`<span class="dossier__countdown urgent"
                  >${msg('IMPACTING')}</span
                >`
                : nothing
          }

          <!-- Source category -->
          ${
            r.source_category
              ? html`<span class="dossier__source"
                >${r.source_category.replace(/_/g, ' ')}</span
              >`
              : nothing
          }
        </div>
      </div>
    `;
  }

  private _renderContent() {
    const r = this.resonance;
    if (!r) return nothing;

    return html`
      <div slot="content">
        <div class="panel__content">
          <!-- Classification -->
          <div class="panel__section">
            <velg-section-header
              >${ARCHETYPE_LABELS[r.resonance_signature] ?? r.archetype}</velg-section-header
            >
            <p class="panel__description">${r.title}</p>
          </div>

          <!-- Description -->
          ${
            r.description
              ? html`
                <div class="panel__section">
                  <velg-section-header
                    >${msg('Description')}</velg-section-header
                  >
                  <p class="panel__description">${r.description}</p>
                </div>
              `
              : nothing
          }

          <!-- Bureau Dispatch -->
          ${
            r.bureau_dispatch
              ? html`
                <div class="panel__section">
                  <velg-section-header
                    >${msg('Bureau Dispatch')}</velg-section-header
                  >
                  <p class="panel__dispatch">${r.bureau_dispatch}</p>
                </div>
              `
              : nothing
          }

          <!-- Affected Event Types -->
          ${
            r.affected_event_types?.length
              ? html`
                <div class="panel__section">
                  <velg-section-header
                    >${msg('Affected Event Types')}</velg-section-header
                  >
                  <div class="panel__chips">
                    ${r.affected_event_types.map(
                      (t) =>
                        html`<span class="panel__chip"
                          >${t.replace(/_/g, ' ')}</span
                        >`,
                    )}
                  </div>
                </div>
              `
              : nothing
          }

          <!-- Affected Shards (impact table) -->
          <div class="panel__section">
            <velg-section-header
              >${msg('Affected Shards')}</velg-section-header
            >
            ${this._renderImpactTable()}
          </div>

          <!-- Timeline -->
          <div class="panel__section">
            <velg-section-header>${msg('Timeline')}</velg-section-header>
            <div class="panel__timeline">
              <div class="timeline-entry">
                <span class="timeline-entry__label"
                  >${msg('Detected')}</span
                >
                <span class="timeline-entry__value"
                  >${formatDateTime(r.detected_at)}</span
                >
              </div>
              <div class="timeline-entry">
                <span class="timeline-entry__label"
                  >${msg('Impacts at')}</span
                >
                <span class="timeline-entry__value"
                  >${formatDateTime(r.impacts_at)}</span
                >
              </div>
              ${
                r.subsides_at
                  ? html`
                    <div class="timeline-entry">
                      <span class="timeline-entry__label"
                        >${msg('Subsides at')}</span
                      >
                      <span class="timeline-entry__value"
                        >${formatDateTime(r.subsides_at)}</span
                      >
                    </div>
                  `
                  : nothing
              }
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private _renderImpactTable() {
    if (this._impactsLoading) {
      return html`
        <div class="impact-loading">
          <div class="impact-loading__dots">
            <span class="impact-loading__dot"></span>
            <span class="impact-loading__dot"></span>
            <span class="impact-loading__dot"></span>
          </div>
          <span class="impact-loading__text"
            >${msg('Scanning affected shards...')}</span
          >
        </div>
      `;
    }

    if (this._impacts.length === 0) {
      return html`<div class="impact-empty">
        ${msg('No impact records found.')}
      </div>`;
    }

    return html`
      <div class="impact-table">
        <div class="impact-table__header">
          <span class="impact-table__col impact-table__col--shard"
            >${msg('Shard')}</span
          >
          <span class="impact-table__col impact-table__col--mag"
            >${msg('Mag')}</span
          >
          <span class="impact-table__col impact-table__col--events"
            >${msg('Evts')}</span
          >
          <span class="impact-table__col impact-table__col--status"
            >${msg('Status')}</span
          >
        </div>
        ${this._impacts.map(
          (impact, i) => html`
            <div
              class="impact-row"
              style="--row-i: ${i}"
              role="link"
              tabindex="0"
              aria-label="${impact._simName} – ${msg('magnitude')} ${impact.effective_magnitude.toFixed(2)}"
              @click=${() => this._navigateToSim(impact._simSlug)}
              @keydown=${(e: KeyboardEvent) => {
                if (e.key === 'Enter') this._navigateToSim(impact._simSlug);
              }}
            >
              <span
                class="impact-row__dot impact-row__dot--${impact.status}"
              ></span>
              <span class="impact-row__name">${impact._simName}</span>
              <span class="impact-row__mag">
                <span class="impact-row__mag-bar">
                  <span
                    class="impact-row__mag-fill ${this._getMagnitudeClass(impact.effective_magnitude)}"
                    style="width: ${Math.round(impact.effective_magnitude * 100)}%"
                  ></span>
                </span>
                <span class="impact-row__mag-val"
                  >${impact.effective_magnitude.toFixed(2)}</span
                >
              </span>
              <span class="impact-row__events"
                >${impact.spawned_event_ids?.length ?? 0}</span
              >
              <span class="impact-row__arrow" aria-hidden="true"
                >${icons.chevronRight(10)}</span
              >
            </div>
          `,
        )}
      </div>
    `;
  }

  private _renderFooter() {
    if (!this._isPlatformAdmin) return nothing;

    return html`
      ${
        this.resonance?.status === 'detected'
          ? html`<button
            slot="footer"
            class="panel__btn panel__btn--generate"
            @click=${this._handleProcess}
          >
            ${msg('Process')}
          </button>`
          : nothing
      }
      <button
        slot="footer"
        class="panel__btn panel__btn--edit"
        @click=${this._handleEdit}
      >
        ${msg('Edit')}
      </button>
    `;
  }

  protected render() {
    if (!this.resonance) return nothing;

    const title = this.resonance.title ?? msg('Resonance Details');

    return html`
      <velg-entity-lightbox
        .open=${this.open}
        .panelTitle=${title}
        .totalEntities=${this.totalEntities}
        .currentIndex=${this.currentIndex}
      >
        ${this._renderMedia()} ${this._renderContent()} ${this._renderFooter()}
      </velg-entity-lightbox>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-resonance-details-panel': VelgResonanceDetailsPanel;
  }
}

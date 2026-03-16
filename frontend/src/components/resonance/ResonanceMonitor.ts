import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { appState } from '../../services/AppStateManager.js';
import { resonanceApi } from '../../services/api/index.js';
import type { Resonance, ResonanceSignature } from '../../types/index.js';
import { icons } from '../../utils/icons.js';
import './ResonanceCard.js';
import './ResonanceDetailsPanel.js';

const SIGNATURE_LABELS: Record<string, string> = {
  economic_tremor: 'Economic Tremor',
  conflict_wave: 'Conflict Wave',
  biological_tide: 'Biological Tide',
  elemental_surge: 'Elemental Surge',
  authority_fracture: 'Authority Fracture',
  innovation_spark: 'Innovation Spark',
  consciousness_drift: 'Consciousness Drift',
  decay_bloom: 'Decay Bloom',
};

type StatusFilter = 'all' | 'detected' | 'impacting' | 'subsiding';

@localized()
@customElement('resonance-monitor')
export class ResonanceMonitor extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    /* ── Monitor Shell ─────────────────────────────────────── */

    .monitor {
      border: var(--border-default);
      background: var(--color-surface);
      overflow: hidden;
    }

    /* ── Header ────────────────────────────────────────────── */

    .monitor-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-3) var(--space-4);
      background: var(--color-surface-inverse);
      color: var(--color-text-inverse);
      position: relative;
      overflow: hidden;
    }

    .monitor-header::after {
      content: '';
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 3px,
        rgba(255, 255, 255, 0.02) 3px,
        rgba(255, 255, 255, 0.02) 6px
      );
      pointer-events: none;
      animation: scanline-drift 8s linear infinite;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      z-index: 1;
    }

    .header-icon {
      display: flex;
      align-items: center;
      color: var(--color-text-inverse);
      animation: tremor-wave 3s ease-in-out infinite;
    }

    .header-title {
      font-family: var(--font-brutalist);
      font-size: var(--text-sm);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-widest);
    }

    .active-count {
      z-index: 1;
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-gray-400);
    }

    .count-number {
      color: var(--color-text-inverse);
      font-weight: var(--font-bold);
    }

    /* ── Filter Bar ────────────────────────────────────────── */

    .filter-bar {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-4);
      border-bottom: var(--border-light);
      flex-wrap: wrap;
    }

    .filter-chips {
      display: flex;
      gap: var(--space-1);
    }

    .filter-chip {
      padding: var(--space-0-5) var(--space-2);
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-medium);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wider);
      color: var(--color-text-secondary);
      background: none;
      border: var(--border-width-thin) solid var(--color-border-light);
      cursor: pointer;
      transition:
        background var(--transition-fast),
        color var(--transition-fast),
        border-color var(--transition-fast);
    }

    .filter-chip:hover {
      background: var(--color-surface-sunken);
      color: var(--color-text-primary);
    }

    .filter-chip:focus-visible {
      outline: none;
      box-shadow: var(--ring-focus);
    }

    .filter-chip.active {
      background: var(--color-primary);
      color: var(--color-primary-text, var(--color-text-inverse));
      border-color: var(--color-primary-text, var(--color-text-inverse));
    }

    .filter-separator {
      width: 1px;
      height: 20px;
      background: var(--color-border-light);
      flex-shrink: 0;
    }

    .signature-select {
      padding: var(--space-0-5) var(--space-2);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
      background: var(--color-surface);
      border: var(--border-width-thin) solid var(--color-border-light);
      cursor: pointer;
      appearance: none;
      padding-right: var(--space-5);
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 6px center;
    }

    .signature-select:focus-visible {
      outline: none;
      box-shadow: var(--ring-focus);
    }

    /* ── Timeline ──────────────────────────────────────────── */

    .timeline {
      padding: var(--space-4);
    }

    .cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: var(--space-4);
    }

    @media (max-width: 640px) {
      .cards-grid {
        grid-template-columns: 1fr;
      }
    }

    /* ── States ────────────────────────────────────────────── */

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--space-12) var(--space-4);
      text-align: center;
    }

    .empty-icon {
      color: var(--color-text-muted);
      margin-bottom: var(--space-4);
      animation: quiet-breathe 4s ease-in-out infinite;
    }

    .empty-text {
      font-family: var(--font-bureau);
      font-size: var(--text-base);
      font-style: italic;
      color: var(--color-text-muted);
      max-width: 28ch;
      line-height: var(--leading-relaxed);
    }

    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--space-10) var(--space-4);
      gap: var(--space-4);
    }

    .loading-wave {
      width: 120px;
      height: 32px;
      overflow: hidden;
    }

    .loading-wave svg {
      color: var(--color-text-muted);
      animation: wave-scan 2s linear infinite;
    }

    .loading-text {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: var(--tracking-widest);
      animation: loading-blink 1.2s steps(1) infinite;
    }

    .error-state {
      padding: var(--space-6) var(--space-4);
      text-align: center;
    }

    .error-text {
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      color: var(--color-danger);
    }

    .retry-btn {
      margin-top: var(--space-3);
      padding: var(--space-1) var(--space-3);
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wider);
      color: var(--color-primary-text, var(--color-text-inverse));
      background: var(--color-primary);
      border: var(--border-width-default) solid var(--color-border);
      cursor: pointer;
    }

    .retry-btn:focus-visible {
      outline: none;
      box-shadow: var(--ring-focus);
    }

    /* ── Keyframes ─────────────────────────────────────────── */

    @keyframes scanline-drift {
      from { background-position-y: 0; }
      to { background-position-y: 6px; }
    }

    @keyframes tremor-wave {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-2px); }
      50% { transform: translateX(2px); }
      75% { transform: translateX(-1px); }
    }

    @keyframes quiet-breathe {
      0%, 100% { opacity: 0.4; transform: scale(1); }
      50% { opacity: 0.7; transform: scale(1.05); }
    }

    @keyframes wave-scan {
      from { transform: translateX(-40px); }
      to { transform: translateX(40px); }
    }

    @keyframes loading-blink {
      50% { opacity: 0; }
    }

    @media (prefers-reduced-motion: reduce) {
      .monitor-header::after,
      .header-icon,
      .empty-icon,
      .loading-wave svg,
      .loading-text {
        animation: none !important;
      }
    }
  `;

  @state() private _resonances: Resonance[] = [];
  @state() private _impactCounts: Record<string, number> = {};
  @state() private _loading = true;
  @state() private _error = '';
  @state() private _statusFilter: StatusFilter = 'all';
  @state() private _signatureFilter: ResonanceSignature | '' = '';
  @state() private _selectedResonance: Resonance | null = null;
  @state() private _showDetails = false;
  private _refreshTimer?: ReturnType<typeof setInterval>;

  connectedCallback(): void {
    super.connectedCallback();
    this._loadData();
    this._refreshTimer = setInterval(() => this._loadData(), 60_000);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._refreshTimer) clearInterval(this._refreshTimer);
  }

  private async _loadData(): Promise<void> {
    try {
      const params: Record<string, string> = { limit: '50' };
      if (this._statusFilter !== 'all') {
        params.status = this._statusFilter;
      }
      if (this._signatureFilter) {
        params.signature = this._signatureFilter;
      }

      const res = await resonanceApi.list(params);
      if (res.success && res.data) {
        this._resonances = res.data;
        this._error = '';

        // Load impact counts for each resonance
        const counts: Record<string, number> = {};
        for (const r of res.data) {
          try {
            const impactRes = await resonanceApi.listImpacts(r.id);
            counts[r.id] = impactRes.data?.length ?? 0;
          } catch {
            counts[r.id] = 0;
          }
        }
        this._impactCounts = counts;
      } else {
        this._error = res.error?.message ?? 'Failed to load resonances';
      }
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'Network error';
    } finally {
      this._loading = false;
    }
  }

  private _setStatusFilter(filter: StatusFilter): void {
    this._statusFilter = filter;
    this._loading = true;
    this._loadData();
  }

  private _setSignatureFilter(e: Event): void {
    this._signatureFilter = (e.target as HTMLSelectElement).value as ResonanceSignature | '';
    this._loading = true;
    this._loadData();
  }

  private async _handleProcess(e: CustomEvent): Promise<void> {
    const resonanceId = e.detail as string;
    try {
      await resonanceApi.processImpact(resonanceId, { generate_narratives: true });
      await this._loadData();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'Processing failed';
    }
  }

  private _handleResonanceClick(e: CustomEvent<Resonance>): void {
    this._selectedResonance = e.detail;
    this._showDetails = true;
  }

  private _handleDetailsPanelClose(): void {
    this._showDetails = false;
    this._selectedResonance = null;
  }

  private _handleLightboxPrev(): void {
    const list = this._filteredResonances;
    const idx = list.findIndex((r) => r.id === this._selectedResonance?.id);
    if (idx > 0) {
      this._selectedResonance = list[idx - 1];
    }
  }

  private _handleLightboxNext(): void {
    const list = this._filteredResonances;
    const idx = list.findIndex((r) => r.id === this._selectedResonance?.id);
    if (idx >= 0 && idx < list.length - 1) {
      this._selectedResonance = list[idx + 1];
    }
  }

  private get _isPlatformAdmin(): boolean {
    return appState.isPlatformAdmin?.value ?? false;
  }

  private get _filteredResonances(): Resonance[] {
    return this._resonances;
  }

  protected render() {
    const activeCount = this._resonances.filter(
      (r) => r.status === 'detected' || r.status === 'impacting',
    ).length;

    return html`
      <div class="monitor" role="region" aria-label=${msg('Substrate Tremor Monitor')}>
        <!-- Header -->
        <div class="monitor-header">
          <div class="header-left">
            <span class="header-icon" aria-hidden="true">
              ${icons.substrateTremor(20)}
            </span>
            <span class="header-title">${msg('Substrate Tremor Monitor')}</span>
          </div>
          <div class="active-count">
            <span class="count-number">${activeCount}</span>
            ${msg('active')}
          </div>
        </div>

        <!-- Filters -->
        <div class="filter-bar">
          <div class="filter-chips" role="tablist" aria-label=${msg('Filter by status')}>
            ${this._renderFilterChip('all', msg('All'))}
            ${this._renderFilterChip('detected', msg('Detected'))}
            ${this._renderFilterChip('impacting', msg('Impacting'))}
            ${this._renderFilterChip('subsiding', msg('Subsiding'))}
          </div>
          <div class="filter-separator"></div>
          <select
            class="signature-select"
            @change=${this._setSignatureFilter}
            aria-label=${msg('Filter by signature')}
          >
            <option value="">${msg('All signatures')}</option>
            ${Object.entries(SIGNATURE_LABELS).map(
              ([key, label]) =>
                html`<option value=${key} ?selected=${this._signatureFilter === key}>
                  ${label}
                </option>`,
            )}
          </select>
        </div>

        <!-- Content -->
        <div class="timeline">
          ${
            this._loading
              ? this._renderLoading()
              : this._error
                ? this._renderError()
                : this._filteredResonances.length === 0
                  ? this._renderEmpty()
                  : this._renderCards()
          }
        </div>
      </div>

      <velg-resonance-details-panel
        .resonance=${this._selectedResonance}
        ?open=${this._showDetails}
        .totalEntities=${this._filteredResonances.length}
        .currentIndex=${
          this._selectedResonance
            ? this._filteredResonances.findIndex((r) => r.id === this._selectedResonance?.id)
            : 0
        }
        @panel-close=${this._handleDetailsPanelClose}
        @lightbox-prev=${this._handleLightboxPrev}
        @lightbox-next=${this._handleLightboxNext}
        @resonance-process=${this._handleProcess}
      ></velg-resonance-details-panel>
    `;
  }

  private _renderFilterChip(filter: StatusFilter, label: string) {
    return html`
      <button
        class=${classMap({ 'filter-chip': true, active: this._statusFilter === filter })}
        role="tab"
        aria-selected=${this._statusFilter === filter}
        @click=${() => this._setStatusFilter(filter)}
      >${label}</button>
    `;
  }

  private _renderCards() {
    return html`
      <div class="cards-grid">
        ${this._filteredResonances.map(
          (r, i) => html`
            <resonance-card
              style="--i: ${i}"
              .resonance=${r}
              .impactCount=${this._impactCounts[r.id] ?? 0}
              .showProcessButton=${this._isPlatformAdmin}
              @resonance-click=${this._handleResonanceClick}
              @resonance-process=${this._handleProcess}
            ></resonance-card>
          `,
        )}
      </div>
    `;
  }

  private _renderEmpty() {
    return html`
      <div class="empty-state">
        <span class="empty-icon" aria-hidden="true">
          ${icons.substrateTremor(40)}
        </span>
        <p class="empty-text">${msg('The substrate is quiet. For now.')}</p>
      </div>
    `;
  }

  private _renderLoading() {
    return html`
      <div class="loading-state">
        <div class="loading-wave" aria-hidden="true">
          ${icons.substrateTremor(120)}
        </div>
        <span class="loading-text">${msg('Scanning substrate...')}</span>
      </div>
    `;
  }

  private _renderError() {
    return html`
      <div class="error-state">
        <p class="error-text">${this._error}</p>
        <button class="retry-btn" @click=${() => {
          this._loading = true;
          this._loadData();
        }}>
          ${msg('Retry')}
        </button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'resonance-monitor': ResonanceMonitor;
  }
}

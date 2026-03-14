import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { connectionsApi } from '../../services/api/index.js';
import type { GazetteEntry } from '../../types/index.js';
import { icons } from '../../utils/icons.js';
import '../shared/LoadingState.js';

const VECTOR_COLORS: Record<string, string> = {
  commerce: '#d4a843',
  language: '#5bbcd6',
  memory: '#a78bfa',
  resonance: '#f472b6',
  architecture: '#d97706',
  dream: '#6366f1',
  desire: '#dc2626',
};

@localized()
@customElement('velg-bleed-gazette-sidebar')
export class VelgBleedGazetteSidebar extends LitElement {
  static styles = css`
    :host {
      display: block;
      width: 320px;
      max-height: 100%;
      overflow-y: auto;
      background: var(--color-gray-950);
      color: var(--color-gray-200);
      scrollbar-width: thin;
      scrollbar-color: var(--color-gray-800) transparent;
      border-left: 1px solid var(--color-gray-800);
    }

    /* ── Header ────────────────────────── */

    .gazette-header {
      position: sticky;
      top: 0;
      z-index: 3;
      background: var(--color-gray-950);
      border-bottom: 1px solid var(--color-gray-800);
      padding: var(--space-4);
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }

    .gazette-header__top {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .gazette-header__bureau {
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.18em;
      color: var(--color-gray-500);
      margin: 0;
    }

    .gazette-header__controls {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .pulse-indicator {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--color-success);
      animation: livePulse 2s ease-in-out infinite;
    }

    @keyframes livePulse {
      0%, 100% { opacity: 0.3; }
      50% { opacity: 1; }
    }

    .collapse-btn {
      background: none;
      border: 1px solid var(--color-gray-700);
      color: var(--color-gray-400);
      width: 22px;
      height: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 10px;
      border-radius: 2px;
      transition: color 0.15s;
    }

    .collapse-btn:hover { color: var(--color-gray-200); }
    .collapse-btn:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 1px; }

    .gazette-header__title {
      font-family: Georgia, 'Times New Roman', serif;
      font-weight: 700;
      font-size: var(--text-base);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--color-gray-200);
      margin: 0;
    }

    .gazette-header__rule {
      width: 40px;
      height: 1px;
      background: var(--color-gray-700);
      margin-top: var(--space-1);
    }

    /* ── Dispatch List ─────────────────── */

    .dispatches {
      display: flex;
      flex-direction: column;
      gap: 1px;
      padding: var(--space-2);
    }

    .dispatches--collapsed {
      display: none;
    }

    /* ── Dispatch Card (base) ──────────── */

    .dispatch {
      background: var(--color-gray-900);
      background-image: linear-gradient(135deg, rgba(255, 248, 230, 0.02), transparent);
      border: 1px solid var(--color-gray-800);
      padding: var(--space-3);
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      position: relative;
      animation: dispatchEnter 0.35s ease-out both;
    }

    .dispatch::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 3px;
      height: 100%;
      background: var(--dispatch-accent, var(--color-gray-700));
    }

    /* ── Echo Completed ────────────────── */

    .dispatch--echo::before {
      animation: echoRipple 2.5s ease-in-out infinite;
    }

    @keyframes echoRipple {
      0%, 100% { opacity: 0.5; }
      50% { opacity: 1; }
    }

    .dispatch__route {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-size: var(--text-xs);
      color: var(--color-gray-300);
    }

    .dispatch__sim-name {
      font-family: Georgia, 'Times New Roman', serif;
      font-weight: 600;
      font-size: var(--text-xs);
      max-width: 100px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .dispatch__arrow {
      color: var(--color-gray-600);
      font-size: 10px;
      flex-shrink: 0;
    }

    .dispatch__vector-tag {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      padding: 1px 5px;
      border-radius: 1px;
      border: 1px solid currentColor;
      opacity: 0.85;
      flex-shrink: 0;
    }

    .dispatch__strength {
      display: flex;
      gap: 2px;
      align-items: center;
    }

    .strength-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      border: 1px solid var(--color-gray-600);
    }

    .strength-dot--filled {
      background: var(--dispatch-accent, var(--color-gray-400));
      border-color: var(--dispatch-accent, var(--color-gray-400));
    }

    /* ── Embassy Change ────────────────── */

    .dispatch--embassy {
      text-align: center;
    }

    .dispatch__seal {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      border: 2px solid var(--color-gray-600);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto;
      color: var(--color-gray-500);
    }

    .dispatch__seal-text {
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 7px;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      color: var(--color-gray-500);
      margin-top: var(--space-1);
    }

    .dispatch__embassy-names {
      font-family: Georgia, 'Times New Roman', serif;
      font-size: var(--text-xs);
      color: var(--color-gray-300);
    }

    /* ── Phase Change ──────────────────── */

    .dispatch--phase {
      text-align: center;
      border: 1px solid var(--color-warning);
      animation: dispatchEnter 0.35s ease-out both, phasePulse 3s ease-in-out infinite;
    }

    .dispatch--phase::before {
      display: none;
    }

    @keyframes phasePulse {
      0%, 100% { border-color: var(--color-gray-800); }
      50% { border-color: var(--color-warning); }
    }

    .dispatch__phase-rules {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .dispatch__phase-rule {
      flex: 1;
      height: 1px;
      background: var(--color-gray-700);
    }

    .dispatch__phase-label {
      font-family: var(--font-brutalist, Georgia, serif);
      font-weight: 700;
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-warning);
      white-space: nowrap;
    }

    /* ── Shared card elements ──────────── */

    .dispatch__narrative {
      font-family: 'Courier New', Courier, monospace;
      font-size: 11px;
      line-height: 1.6;
      color: var(--color-gray-400);
    }

    .dispatch__filed {
      font-size: 9px;
      color: var(--color-gray-600);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-variant-numeric: tabular-nums;
    }

    .dispatch__icon {
      color: var(--dispatch-accent, var(--color-gray-500));
      opacity: 0.6;
    }

    /* ── Empty ─────────────────────────── */

    .empty {
      text-align: center;
      padding: var(--space-6);
      color: var(--color-gray-600);
      font-family: Georgia, 'Times New Roman', serif;
      font-size: var(--text-sm);
      font-style: italic;
    }

    @keyframes dispatchEnter {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @media (prefers-reduced-motion: reduce) {
      .dispatch,
      .dispatch--phase {
        animation: none;
      }
      .dispatch--echo::before,
      .pulse-indicator {
        animation: none;
        opacity: 1;
      }
    }
  `;

  @state() private _entries: GazetteEntry[] = [];
  @state() private _loading = false;
  @state() private _collapsed = false;

  private _pollTimer = 0;

  connectedCallback(): void {
    super.connectedCallback();
    this._load();
    this._pollTimer = window.setInterval(() => this._load(), 60_000);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    clearInterval(this._pollTimer);
  }

  private async _load(): Promise<void> {
    if (this._loading) return;
    this._loading = this._entries.length === 0;
    const res = await connectionsApi.getBleedGazette(20);
    if (res.success && res.data) {
      this._entries = (Array.isArray(res.data) ? res.data : []) as GazetteEntry[];
    }
    this._loading = false;
  }

  private _formatFiled(iso: string): string {
    try {
      const d = new Date(iso);
      const h = String(d.getUTCHours()).padStart(2, '0');
      const m = String(d.getUTCMinutes()).padStart(2, '0');
      return `FILED: ${h}:${m} UTC`;
    } catch {
      return '';
    }
  }

  private _strengthDots(strength: number | null | undefined) {
    if (strength == null) return nothing;
    const filled = Math.max(1, Math.min(5, Math.round(strength * 5)));
    const dots = [];
    for (let i = 0; i < 5; i++) {
      dots.push(
        html`<span class="strength-dot ${i < filled ? 'strength-dot--filled' : ''}" aria-hidden="true"></span>`,
      );
    }
    return html`<span class="dispatch__strength" aria-label="${msg('Strength')}: ${filled}/5">${dots}</span>`;
  }

  private _renderEcho(entry: GazetteEntry, idx: number) {
    const vecColor = VECTOR_COLORS[entry.echo_vector || ''] || 'var(--color-gray-500)';
    return html`
      <div
        class="dispatch dispatch--echo"
        style="--dispatch-accent: ${vecColor}; animation-delay: ${idx * 60}ms"
      >
        <div class="dispatch__route">
          <span class="dispatch__icon" aria-hidden="true">${icons.antenna(14)}</span>
          ${entry.source_simulation
            ? html`<span class="dispatch__sim-name">${entry.source_simulation.name}</span>`
            : nothing}
          <span class="dispatch__arrow" aria-hidden="true">&#10142;</span>
          ${entry.target_simulation
            ? html`<span class="dispatch__sim-name">${entry.target_simulation.name}</span>`
            : nothing}
        </div>
        <div class="dispatch__route">
          ${entry.echo_vector
            ? html`<span class="dispatch__vector-tag" style="color: ${vecColor}">${entry.echo_vector}</span>`
            : nothing}
          ${this._strengthDots(entry.strength)}
        </div>
        <div class="dispatch__narrative">${entry.narrative}</div>
        <div class="dispatch__filed">${this._formatFiled(entry.created_at)}</div>
      </div>
    `;
  }

  private _renderEmbassy(entry: GazetteEntry, idx: number) {
    return html`
      <div
        class="dispatch dispatch--embassy"
        style="--dispatch-accent: var(--color-info); animation-delay: ${idx * 60}ms"
      >
        <div class="dispatch__seal" aria-hidden="true">${icons.handshake(20)}</div>
        <div class="dispatch__seal-text" aria-hidden="true">${msg('Established')}</div>
        <div class="dispatch__embassy-names">
          ${entry.source_simulation?.name || '???'}
          &thinsp;&harr;&thinsp;
          ${entry.target_simulation?.name || '???'}
        </div>
        <div class="dispatch__narrative">${entry.narrative}</div>
        <div class="dispatch__filed">${this._formatFiled(entry.created_at)}</div>
      </div>
    `;
  }

  private _renderPhase(entry: GazetteEntry, idx: number) {
    return html`
      <div class="dispatch dispatch--phase" style="animation-delay: ${idx * 60}ms">
        <div class="dispatch__phase-rules">
          <span class="dispatch__phase-rule" aria-hidden="true"></span>
          <span class="dispatch__phase-label">${icons.megaphone(12)} ${msg('Phase Transition')}</span>
          <span class="dispatch__phase-rule" aria-hidden="true"></span>
        </div>
        <div class="dispatch__narrative">${entry.narrative}</div>
        <div class="dispatch__filed">${this._formatFiled(entry.created_at)}</div>
      </div>
    `;
  }

  private _renderEntry(entry: GazetteEntry, idx: number) {
    switch (entry.entry_type) {
      case 'echo_completed':
        return this._renderEcho(entry, idx);
      case 'embassy_change':
        return this._renderEmbassy(entry, idx);
      case 'phase_change':
        return this._renderPhase(entry, idx);
      default:
        return this._renderEcho(entry, idx);
    }
  }

  protected render() {
    return html`
      <div class="gazette-header">
        <div class="gazette-header__top">
          <p class="gazette-header__bureau">${msg('Bureau of Impossible Geography')}</p>
          <div class="gazette-header__controls">
            <span class="pulse-indicator" aria-hidden="true"></span>
            <button
              class="collapse-btn"
              @click=${() => { this._collapsed = !this._collapsed; }}
              aria-label=${this._collapsed ? msg('Expand dispatch log') : msg('Collapse dispatch log')}
              aria-expanded=${!this._collapsed}
            >${this._collapsed ? '\u25BC' : '\u25B2'}</button>
          </div>
        </div>
        <h2 class="gazette-header__title">${msg('Dispatch Log')}</h2>
        <div class="gazette-header__rule" aria-hidden="true"></div>
      </div>

      ${this._loading
        ? html`<velg-loading-state message=${msg('Receiving dispatches...')}></velg-loading-state>`
        : html`
          <div class="dispatches ${this._collapsed ? 'dispatches--collapsed' : ''}">
            ${this._entries.length === 0
              ? html`<div class="empty">${msg('No dispatches on file')}</div>`
              : this._entries.map((e, i) => this._renderEntry(e, i))}
          </div>
        `}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-bleed-gazette-sidebar': VelgBleedGazetteSidebar;
  }
}

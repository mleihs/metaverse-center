/**
 * MapBattleFeed — scrolling battle narrative ticker at the bottom of the map.
 *
 * Fetches public battle log entries across all active epochs.
 * Refreshes every 30 seconds. Hidden at ≤768px.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { connectionsApi } from '../../services/api/index.js';
import type { BattleLogEntry } from '../../types/index.js';

/** Battle log event type → dot color (semantic tokens for inline style binding) */
const EVENT_TYPE_COLORS: Record<string, string> = {
  mission_success: 'var(--color-success)',
  mission_failed: 'var(--color-danger)',
  detected: 'var(--color-primary)',
  captured: 'var(--color-primary)',
  sabotage: 'var(--color-danger)',
  propaganda: '#a78bfa', // lint-color-ok
  assassination: 'var(--color-danger)',
  infiltration: 'var(--color-info)',
  alliance_formed: 'var(--color-info)',
  alliance_dissolved: '#f97316', // lint-color-ok
  betrayal: 'var(--color-danger)',
  phase_change: 'var(--color-text-muted)',
  epoch_start: 'var(--color-success)',
  epoch_end: 'var(--color-text-muted)',
  rp_allocated: 'var(--color-text-muted)',
};

@localized()
@customElement('velg-map-battle-feed')
export class VelgMapBattleFeed extends LitElement {
  static styles = css`
    :host {
      display: block;
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 44px;
      z-index: var(--z-raised);
      pointer-events: none;
    }

    .feed {
      display: flex;
      align-items: center;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      overflow: hidden;
      padding: 0 var(--space-4, 16px);
      gap: var(--space-3, 12px);
    }

    .feed__label {
      font-family: var(--font-brutalist, monospace);
      font-weight: 900;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--color-danger);
      flex-shrink: 0;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .feed__dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--color-danger);
      animation: feed-dot-pulse 1.5s ease-in-out infinite;
    }

    @keyframes feed-dot-pulse {
      0%, 100% { opacity: 0.4; }
      50% { opacity: 1; }
    }

    .feed__scroll {
      flex: 1;
      overflow: hidden;
      white-space: nowrap;
    }

    .feed__track {
      display: inline-flex;
      gap: var(--space-6, 24px);
      animation: feed-scroll 60s linear infinite;
    }

    @keyframes feed-scroll {
      0% { transform: translateX(0); }
      100% { transform: translateX(-50%); }
    }

    .feed__item {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-family: var(--font-mono, monospace);
      font-size: 11px;
      color: var(--color-text-secondary);
    }

    .feed__type-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .feed__empty {
      font-family: var(--font-mono, monospace);
      font-size: 11px;
      color: var(--color-text-muted);
    }

    @media (max-width: 768px) {
      :host { display: none; }
    }

    @media (prefers-reduced-motion: reduce) {
      .feed__track { animation: none; }
      .feed__scroll { overflow-x: auto; pointer-events: auto; }
      .feed__dot { animation: none; opacity: 1; }
    }
  `;

  @state() private _entries: BattleLogEntry[] = [];
  private _refreshTimer: ReturnType<typeof setInterval> | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this._loadFeed();
    this._refreshTimer = setInterval(() => this._loadFeed(), 30000);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._refreshTimer) {
      clearInterval(this._refreshTimer);
      this._refreshTimer = null;
    }
  }

  private async _loadFeed() {
    const resp = await connectionsApi.getBattleFeed(20);
    if (resp.success && resp.data) {
      this._entries = resp.data as BattleLogEntry[];
    }
  }

  protected render() {
    return html`
      <div class="feed">
        <div class="feed__label">
          <span class="feed__dot"></span>
          ${msg('LIVE')}
        </div>
        <div class="feed__scroll">
          ${
            this._entries.length > 0
              ? html`
              <div class="feed__track">
                ${this._entries.map((e) => this._renderItem(e))}
                <!-- Duplicate for seamless loop -->
                ${this._entries.map((e) => this._renderItem(e))}
              </div>
            `
              : html`<span class="feed__empty">${msg('No active battles')}</span>`
          }
        </div>
      </div>
    `;
  }

  private _renderItem(entry: BattleLogEntry) {
    const color = EVENT_TYPE_COLORS[entry.event_type] ?? 'var(--color-text-muted)';
    return html`
      <span class="feed__item">
        <span class="feed__type-dot" style="background: ${color}"></span>
        ${entry.narrative}
      </span>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-map-battle-feed': VelgMapBattleFeed;
  }
}

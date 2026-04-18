/**
 * MapLeaderboardPanel — epoch leaderboard overlay triggered from map node click.
 *
 * Shows ranked scores with 5-dimension mini-bars for a specific epoch.
 * Uses VelgSidePanel as the shell.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { epochsApi } from '../../services/api/EpochsApiService.js';
import type { LeaderboardEntry } from '../../types/index.js';
import { SCORE_DIMENSION_COLORS } from './map-data.js';

import '../shared/VelgSidePanel.js';

const DIMS: { key: keyof LeaderboardEntry; label: string; color: string }[] = [
  { key: 'stability', label: 'STA', color: SCORE_DIMENSION_COLORS.stability },
  { key: 'influence', label: 'INF', color: SCORE_DIMENSION_COLORS.influence },
  { key: 'sovereignty', label: 'SOV', color: SCORE_DIMENSION_COLORS.sovereignty },
  { key: 'diplomatic', label: 'DIP', color: SCORE_DIMENSION_COLORS.diplomatic },
  { key: 'military', label: 'MIL', color: SCORE_DIMENSION_COLORS.military },
];

@localized()
@customElement('velg-map-leaderboard-panel')
export class VelgMapLeaderboardPanel extends LitElement {
  static styles = css`
    .leaderboard {
      padding: var(--space-4, 16px);
    }

    .leaderboard__title {
      font-family: var(--font-brutalist, monospace);
      font-weight: 900;
      font-size: var(--text-lg, 18px);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-text-primary);
      margin: 0 0 var(--space-4, 16px);
    }

    .entry {
      display: flex;
      flex-direction: column;
      gap: var(--space-2, 8px);
      padding: var(--space-3, 12px);
      border: 1px solid var(--color-border);
      background: var(--color-surface-raised);
      margin-bottom: var(--space-3, 12px);
    }

    .entry__header {
      display: flex;
      align-items: center;
      gap: var(--space-3, 12px);
    }

    .entry__rank {
      font-family: var(--font-brutalist, monospace);
      font-weight: 900;
      font-size: var(--text-xl, 20px);
      color: var(--color-text-muted);
      min-width: 28px;
      text-align: center;
    }

    .entry__rank--1 { color: var(--color-primary); }
    .entry__rank--2 { color: #94a3b8; } /* lint-color-ok */
    .entry__rank--3 { color: #b45309; } /* lint-color-ok */

    .entry__name {
      font-family: var(--font-brutalist, monospace);
      font-weight: 700;
      font-size: var(--text-sm, 14px);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-text-primary);
      flex: 1;
    }

    .entry__composite {
      font-family: var(--font-mono, monospace);
      font-weight: 700;
      font-size: var(--text-sm, 14px);
      color: var(--color-text-secondary);
    }

    .entry__bars {
      display: grid;
      grid-template-columns: 30px 1fr 28px;
      gap: 2px 6px;
      align-items: center;
    }

    .bar-label {
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .bar-track {
      height: 5px;
      background: rgba(255, 255, 255, 0.06);
    }

    .bar-fill {
      height: 100%;
      transition: width 0.3s ease;
    }

    .bar-value {
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      color: var(--color-text-secondary);
      text-align: right;
    }

    .empty {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-sm, 14px);
      color: var(--color-text-muted);
      text-align: center;
      padding: var(--space-8, 32px) 0;
    }
  `;

  @property({ type: String }) epochId: string | null = null;
  @property({ type: Boolean }) open = false;

  @state() private _entries: LeaderboardEntry[] = [];
  @state() private _loading = false;

  protected updated(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('epochId') && this.epochId) {
      this._loadLeaderboard();
    }
  }

  private async _loadLeaderboard() {
    if (!this.epochId) return;
    this._loading = true;
    const resp = await epochsApi.getLeaderboard(
      this.epochId,
      appState.isAuthenticated.value ? 'member' : 'public',
    );
    if (resp.success && resp.data) {
      this._entries = resp.data as LeaderboardEntry[];
    }
    this._loading = false;
  }

  private _handleClose() {
    this.dispatchEvent(new CustomEvent('panel-close', { bubbles: true, composed: true }));
  }

  protected render() {
    if (!this.open) return nothing;

    return html`
      <velg-side-panel .open=${this.open} @panel-close=${this._handleClose}>
        <div slot="content" class="leaderboard">
          <h3 class="leaderboard__title">${msg('Leaderboard')}</h3>
          ${
            this._loading
              ? html`<div class="empty">${msg('Loading...')}</div>`
              : this._entries.length === 0
                ? html`<div class="empty">${msg('No scores available')}</div>`
                : this._entries.map((e) => this._renderEntry(e))
          }
        </div>
      </velg-side-panel>
    `;
  }

  private _renderEntry(entry: LeaderboardEntry) {
    const rankClass = entry.rank <= 3 ? `entry__rank--${entry.rank}` : '';
    return html`
      <div class="entry">
        <div class="entry__header">
          <span class="entry__rank ${rankClass}">#${entry.rank}</span>
          <span class="entry__name">${entry.simulation_name}</span>
          <span class="entry__composite">${Math.round(entry.composite)}</span>
        </div>
        <div class="entry__bars">
          ${DIMS.map((d) => {
            const val = Math.round((entry[d.key] as number) ?? 0);
            return html`
              <span class="bar-label">${d.label}</span>
              <div class="bar-track">
                <div class="bar-fill" style="width: ${Math.min(100, val)}%; background: ${d.color}"></div>
              </div>
              <span class="bar-value">${val}</span>
            `;
          })}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-map-leaderboard-panel': VelgMapLeaderboardPanel;
  }
}

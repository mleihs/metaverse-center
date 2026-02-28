/**
 * Epoch Leaderboard — sortable score table with per-dimension bars.
 *
 * Shows rank, simulation name, composite score, and 5 dimension bars
 * (stability, influence, sovereignty, diplomatic, military).
 * Supports a `compact` mode for overview panel embedding.
 *
 * Microanimations: staggered row entrance, bar grow on mount, hover lift.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import type { Epoch, LeaderboardEntry } from '../../types/index.js';

type SortKey =
  | 'rank'
  | 'composite'
  | 'stability'
  | 'influence'
  | 'sovereignty'
  | 'diplomatic'
  | 'military';

@localized()
@customElement('velg-epoch-leaderboard')
export class VelgEpochLeaderboard extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    /* ── Table ────────────────────────────── */

    .table {
      width: 100%;
      border-collapse: collapse;
    }

    .table th {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-gray-500);
      text-align: left;
      padding: var(--space-2) var(--space-2);
      border-bottom: 2px solid var(--color-gray-800);
      cursor: pointer;
      user-select: none;
      transition: color var(--transition-fast);
      white-space: nowrap;
    }

    .table th:hover {
      color: var(--color-gray-300);
    }

    .table th--sorted {
      color: var(--color-gray-100);
    }

    .table th.rank-col {
      width: 40px;
      text-align: center;
    }

    .table th.score-col {
      width: 60px;
      text-align: right;
    }

    .table th.bar-col {
      width: 100px;
    }

    /* ── Rows ─────────────────────────────── */

    .row {
      border-bottom: 1px solid var(--color-gray-850, var(--color-gray-800));
      transition: all var(--transition-normal);
      opacity: 0;
      transform: translateX(-8px);
      animation: row-enter 0.4s ease-out forwards;
    }

    .row:hover {
      background: rgba(255 255 255 / 0.03);
      transform: translateX(2px);
    }

    @keyframes row-enter {
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    .row td {
      padding: var(--space-2) var(--space-2);
      vertical-align: middle;
    }

    /* ── Rank ─────────────────────────────── */

    .rank {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-base);
      text-align: center;
      width: 40px;
    }

    .rank--1 { color: var(--color-warning); }
    .rank--2 { color: var(--color-gray-400); }
    .rank--3 { color: var(--color-warning-hover); }

    /* ── Simulation Info ──────────────────── */

    .sim {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .sim__name {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-gray-100);
    }

    .sim__team {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      color: var(--color-gray-500);
    }

    .sim__title {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      color: var(--color-warning);
      font-style: italic;
    }

    /* ── Composite Score ──────────────────── */

    .composite {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-lg);
      text-align: right;
      color: var(--color-gray-100);
      min-width: 50px;
    }

    /* ── Dimension Bars ───────────────────── */

    .dim-cell {
      width: 100px;
    }

    .dim-bar {
      position: relative;
      height: 6px;
      background: var(--color-gray-800);
      overflow: hidden;
    }

    .dim-bar__fill {
      position: absolute;
      inset: 0;
      transform-origin: left;
      transform: scaleX(0);
      transition: transform 0.8s cubic-bezier(0.22, 1, 0.36, 1);
    }

    :host([animated]) .dim-bar__fill {
      transform: scaleX(var(--fill, 0));
    }

    .dim-bar__fill--stability   { background: var(--color-success); }
    .dim-bar__fill--influence   { background: #a78bfa; }
    .dim-bar__fill--sovereignty { background: var(--color-info); }
    .dim-bar__fill--diplomatic  { background: var(--color-warning); }
    .dim-bar__fill--military    { background: var(--color-danger); }

    .dim-label {
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      color: var(--color-gray-600);
      margin-top: 2px;
      display: flex;
      justify-content: space-between;
    }

    /* ── Compact mode ─────────────────────── */

    :host([compact]) .table th.bar-col,
    :host([compact]) .dim-cell {
      display: none;
    }

    :host([compact]) .table th {
      padding: var(--space-1) var(--space-2);
    }

    :host([compact]) .row td {
      padding: var(--space-1) var(--space-2);
    }

    :host([compact]) .sim__title,
    :host([compact]) .sim__team {
      display: none;
    }

    /* ── Sort indicator ───────────────────── */

    .sort-arrow {
      display: inline-block;
      margin-left: 4px;
      transition: transform var(--transition-fast);
    }

    .sort-arrow--asc { transform: rotate(180deg); }

    /* ── Responsive ───────────────────────── */

    @media (max-width: 768px) {
      .dim-cell,
      .table th.bar-col {
        display: none;
      }
    }
  `;

  @property({ type: Array }) entries: LeaderboardEntry[] = [];
  @property({ type: Object }) epoch: Epoch | null = null;
  @property({ type: Boolean, reflect: true }) compact = false;

  @state() private _sortKey: SortKey = 'rank';
  @state() private _sortAsc = true;

  private _animated = false;

  protected updated(changed: PropertyValues) {
    super.updated(changed);
    if (changed.has('entries') && this.entries.length > 0 && !this._animated) {
      // Trigger bar animation after first paint
      requestAnimationFrame(() => {
        this.setAttribute('animated', '');
        this._animated = true;
      });
    }
  }

  private _sort(key: SortKey) {
    if (this._sortKey === key) {
      this._sortAsc = !this._sortAsc;
    } else {
      this._sortKey = key;
      this._sortAsc = key === 'rank';
    }
  }

  private _getSorted(): LeaderboardEntry[] {
    const sorted = [...this.entries];
    const key = this._sortKey;
    const dir = this._sortAsc ? 1 : -1;
    sorted.sort((a, b) => {
      const av = a[key] ?? 0;
      const bv = b[key] ?? 0;
      return (av > bv ? 1 : av < bv ? -1 : 0) * dir;
    });
    return sorted;
  }

  private _getDimensionTitle(entry: LeaderboardEntry): string | undefined {
    return (
      entry.stability_title ??
      entry.influence_title ??
      entry.sovereignty_title ??
      entry.diplomatic_title ??
      entry.military_title
    );
  }

  protected render() {
    if (this.entries.length === 0) {
      return html`<p style="
        font-family: var(--font-mono, monospace);
        font-size: var(--text-sm);
        color: var(--color-gray-600);
        text-align: center;
        padding: var(--space-4);
      ">${msg('No scores recorded yet.')}</p>`;
    }

    const sorted = this._getSorted();
    const maxDim = this._getMaxDimensionValue();

    return html`
      <table class="table">
        ${
          this.compact
            ? nothing
            : html`
            <thead>
              <tr>
                <th class="rank-col" @click=${() => this._sort('rank')}>
                  #${this._renderSortArrow('rank')}
                </th>
                <th @click=${() => this._sort('rank')}>
                  ${msg('Simulation')}
                </th>
                <th class="score-col" @click=${() => this._sort('composite')}>
                  ${msg('Score')}${this._renderSortArrow('composite')}
                </th>
                <th class="bar-col" @click=${() => this._sort('stability')}>
                  ${msg('Stab')}${this._renderSortArrow('stability')}
                </th>
                <th class="bar-col" @click=${() => this._sort('influence')}>
                  ${msg('Infl')}${this._renderSortArrow('influence')}
                </th>
                <th class="bar-col" @click=${() => this._sort('sovereignty')}>
                  ${msg('Sovr')}${this._renderSortArrow('sovereignty')}
                </th>
                <th class="bar-col" @click=${() => this._sort('diplomatic')}>
                  ${msg('Dipl')}${this._renderSortArrow('diplomatic')}
                </th>
                <th class="bar-col" @click=${() => this._sort('military')}>
                  ${msg('Milt')}${this._renderSortArrow('military')}
                </th>
              </tr>
            </thead>
          `
        }
        <tbody>
          ${sorted.map((entry, i) => this._renderRow(entry, i, maxDim))}
        </tbody>
      </table>
    `;
  }

  private _renderSortArrow(key: SortKey) {
    if (this._sortKey !== key) return nothing;
    return html`<span class="sort-arrow ${this._sortAsc ? 'sort-arrow--asc' : ''}">▼</span>`;
  }

  private _renderRow(entry: LeaderboardEntry, index: number, maxDim: number) {
    const delay = index * 60;
    const title = this._getDimensionTitle(entry);
    const rankClass = entry.rank <= 3 ? `rank--${entry.rank}` : '';

    return html`
      <tr class="row" style="animation-delay: ${delay}ms">
        <td><span class="rank ${rankClass}">${entry.rank}</span></td>
        <td>
          <div class="sim">
            <span class="sim__name">${entry.simulation_name}</span>
            ${entry.team_name ? html`<span class="sim__team">${entry.team_name}</span>` : nothing}
            ${title ? html`<span class="sim__title">"${title}"</span>` : nothing}
          </div>
        </td>
        <td><span class="composite">${entry.composite.toFixed(1)}</span></td>
        ${this._renderDimBar('stability', entry.stability, maxDim, delay + 200)}
        ${this._renderDimBar('influence', entry.influence, maxDim, delay + 260)}
        ${this._renderDimBar('sovereignty', entry.sovereignty, maxDim, delay + 320)}
        ${this._renderDimBar('diplomatic', entry.diplomatic, maxDim, delay + 380)}
        ${this._renderDimBar('military', entry.military, maxDim, delay + 440)}
      </tr>
    `;
  }

  private _renderDimBar(dim: string, value: number, max: number, delay: number) {
    const fill = max > 0 ? value / max : 0;

    return html`
      <td class="dim-cell">
        <div class="dim-bar">
          <div
            class="dim-bar__fill dim-bar__fill--${dim}"
            style="--fill: ${fill}; transition-delay: ${delay}ms"
          ></div>
        </div>
        <div class="dim-label">
          <span>${value.toFixed(0)}</span>
        </div>
      </td>
    `;
  }

  private _getMaxDimensionValue(): number {
    if (this.entries.length === 0) return 100;
    let max = 0;
    for (const e of this.entries) {
      max = Math.max(max, e.stability, e.influence, e.sovereignty, e.diplomatic, e.military);
    }
    return Math.max(max, 1);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-epoch-leaderboard': VelgEpochLeaderboard;
  }
}

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
import { css, html, LitElement, nothing, type PropertyValues, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import type { Epoch, EpochParticipant, LeaderboardEntry } from '../../types/index.js';
import { PERSONALITY_COLORS } from '../../utils/bot-colors.js';
import { icons } from '../../utils/icons.js';

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
      color: var(--color-text-muted);
      text-align: left;
      padding: var(--space-2) var(--space-2);
      border-bottom: 2px solid var(--color-border-light);
      cursor: pointer;
      user-select: none;
      transition: color var(--transition-fast);
      white-space: nowrap;
    }

    .table th:hover {
      color: var(--color-text-tertiary);
    }

    .table th--sorted {
      color: var(--color-text-primary);
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
      border-bottom: 1px solid var(--color-border-light);
      transition: all var(--transition-normal);
      opacity: 0;
      transform: translateX(-8px);
      animation: row-enter 0.4s ease-out forwards;
    }

    .row:hover {
      background: rgba(255 255 255 / 0.03);
      transform: translateX(2px);
    }

    .row--self {
      background: rgba(245 158 11 / 0.06);
      border-left: 3px solid var(--color-epoch-accent);
    }

    .row--self:hover {
      background: rgba(245 158 11 / 0.10);
    }

    .self-badge {
      display: inline-block;
      font-family: var(--font-brutalist);
      font-weight: 900;
      font-size: 8px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-epoch-accent);
      border: 1px solid var(--color-epoch-accent);
      padding: 0 4px;
      margin-left: 4px;
      vertical-align: middle;
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
    .rank--2 { color: var(--color-text-muted); }
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
      color: var(--color-text-primary);
    }

    .sim__team {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      color: var(--color-text-muted);
    }

    .sim__title {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      color: var(--color-warning);
      font-style: italic;
    }

    .sim__traitor {
      display: inline-block;
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-danger);
      border: 1px solid var(--color-danger);
      padding: 0 4px;
      margin-left: 4px;
      vertical-align: middle;
    }

    .sim__alliance {
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      color: var(--color-success);
    }

    /* ── Bot indicator ─────────────────────── */

    .sim__bot {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      padding: 0 5px;
      margin-left: 4px;
      vertical-align: middle;
      border: 1px solid;
    }

    .sim__bot svg {
      width: 10px;
      height: 10px;
      fill: currentColor;
    }

    .sim__bot--sentinel { color: ${unsafeCSS(PERSONALITY_COLORS.sentinel)}; border-color: ${unsafeCSS(PERSONALITY_COLORS.sentinel)}; }
    .sim__bot--warlord { color: ${unsafeCSS(PERSONALITY_COLORS.warlord)}; border-color: ${unsafeCSS(PERSONALITY_COLORS.warlord)}; }
    .sim__bot--diplomat { color: ${unsafeCSS(PERSONALITY_COLORS.diplomat)}; border-color: ${unsafeCSS(PERSONALITY_COLORS.diplomat)}; }
    .sim__bot--strategist { color: ${unsafeCSS(PERSONALITY_COLORS.strategist)}; border-color: ${unsafeCSS(PERSONALITY_COLORS.strategist)}; }
    .sim__bot--chaos { color: ${unsafeCSS(PERSONALITY_COLORS.chaos)}; border-color: ${unsafeCSS(PERSONALITY_COLORS.chaos)}; }

    .sim__difficulty {
      font-family: var(--font-mono, monospace);
      font-size: 8px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      padding: 0 3px;
      margin-left: 2px;
      vertical-align: middle;
    }

    .sim__difficulty--easy { color: var(--color-success); }
    .sim__difficulty--medium { color: var(--color-warning); }
    .sim__difficulty--hard { color: var(--color-danger); }

    /* ── Composite Score ──────────────────── */

    .composite {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-lg);
      text-align: right;
      color: var(--color-text-primary);
      min-width: 50px;
    }

    /* ── Dimension Bars ───────────────────── */

    .dim-cell {
      width: 100px;
    }

    .dim-bar {
      position: relative;
      height: 6px;
      background: var(--color-surface-raised);
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
    .dim-bar__fill--influence   { background: var(--color-epoch-influence); }
    .dim-bar__fill--sovereignty { background: var(--color-info); }
    .dim-bar__fill--diplomatic  { background: var(--color-warning); }
    .dim-bar__fill--military    { background: var(--color-danger); }

    .dim-label {
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      color: var(--color-text-muted);
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

    .table-wrapper {
      width: 100%;
    }

    @media (max-width: 768px) {
      .table-wrapper {
        overflow-x: visible;
      }

      thead {
        display: none;
      }

      .table {
        display: block;
      }

      tbody {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }

      .row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-3);
        border: var(--border-width-thin, 1px) solid var(--color-border-subtle, rgba(255,255,255,0.06));
        border-bottom: var(--border-width-thin, 1px) solid var(--color-border-subtle, rgba(255,255,255,0.06));
        border-radius: var(--radius-sm, 4px);
        background: var(--color-surface-raised, rgba(255,255,255,0.03));
        transform: none;
      }

      .row:hover {
        transform: none;
      }

      .row--self {
        border-left: 3px solid var(--color-epoch-accent);
      }

      .row td {
        display: block;
        padding: 0;
        border: none;
      }

      /* Rank — prominent leading number */
      .row td:first-child {
        display: flex;
        align-items: center;
        min-width: 32px;
      }

      .row td:first-child .rank {
        font-size: var(--text-xl);
        width: auto;
      }

      /* Simulation name — takes remaining first-line space */
      .row td:nth-child(2) {
        flex: 1;
        min-width: 0;
      }

      /* Composite score — right-aligned on first line */
      .row td:nth-child(3) {
        display: flex;
        align-items: center;
      }

      .row td:nth-child(3) .composite {
        font-size: var(--text-lg);
      }

      /* Dimension bar cells — flow into a compact horizontal row */
      .dim-cell {
        display: block;
        width: calc(20% - var(--space-1, 4px));
        flex: 1 1 0%;
        min-width: 0;
      }

      .dim-bar {
        height: 4px;
      }

      .dim-label {
        font-size: 8px;
      }
    }
  `;

  @property({ type: Array }) entries: LeaderboardEntry[] = [];
  @property({ type: Object }) epoch: Epoch | null = null;
  @property({ type: Array }) participants: EpochParticipant[] = [];
  @property({ type: Boolean, reflect: true }) compact = false;
  @property({ attribute: 'my-simulation-id' }) mySimulationId = '';

  @state() private _sortKey: SortKey = 'rank';
  @state() private _sortAsc = true;

  private _animated = false;
  private _rafId = 0;

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._rafId) cancelAnimationFrame(this._rafId);
  }

  protected updated(changed: PropertyValues) {
    super.updated(changed);
    if (changed.has('entries') && this.entries.length > 0 && !this._animated) {
      // Trigger bar animation after first paint
      this._rafId = requestAnimationFrame(() => {
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

  private _getBotParticipant(entry: LeaderboardEntry): EpochParticipant | undefined {
    return this.participants.find((p) => p.simulation_id === entry.simulation_id && p.is_bot);
  }

  private _getBotIcon(personality: string) {
    const iconMap: Record<string, () => unknown> = {
      sentinel: icons.botSentinel,
      warlord: icons.botWarlord,
      diplomat: icons.botDiplomat,
      strategist: icons.botStrategist,
      chaos: icons.botChaos,
    };
    return iconMap[personality]?.() ?? nothing;
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
        color: var(--color-text-muted);
        text-align: center;
        padding: var(--space-4);
      ">${msg('No scores recorded yet.')}</p>`;
    }

    const sorted = this._getSorted();
    const maxDim = this._getMaxDimensionValue();

    return html`
      <div class="table-wrapper">
      <table class="table">
        ${
          this.compact
            ? nothing
            : html`
            <thead>
              <tr>
                <th class="rank-col" role="columnheader" tabindex="0" aria-sort=${this._sortKey === 'rank' ? (this._sortAsc ? 'ascending' : 'descending') : 'none'} @click=${() => this._sort('rank')} @keydown=${(
                  e: KeyboardEvent,
                ) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this._sort('rank');
                  }
                }}>
                  #${this._renderSortArrow('rank')}
                </th>
                <th role="columnheader" tabindex="0" aria-sort=${this._sortKey === 'rank' ? (this._sortAsc ? 'ascending' : 'descending') : 'none'} @click=${() => this._sort('rank')} @keydown=${(
                  e: KeyboardEvent,
                ) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this._sort('rank');
                  }
                }}>
                  ${msg('Simulation')}
                </th>
                <th class="score-col" role="columnheader" tabindex="0" aria-sort=${this._sortKey === 'composite' ? (this._sortAsc ? 'ascending' : 'descending') : 'none'} @click=${() => this._sort('composite')} @keydown=${(
                  e: KeyboardEvent,
                ) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this._sort('composite');
                  }
                }}>
                  ${msg('Score')}${this._renderSortArrow('composite')}
                </th>
                <th class="bar-col" role="columnheader" tabindex="0" aria-sort=${this._sortKey === 'stability' ? (this._sortAsc ? 'ascending' : 'descending') : 'none'} @click=${() => this._sort('stability')} @keydown=${(
                  e: KeyboardEvent,
                ) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this._sort('stability');
                  }
                }}>
                  <span title=${msg('Stability')} aria-label=${msg('Stability')}>${msg('Stab')}</span>${this._renderSortArrow('stability')}
                </th>
                <th class="bar-col" role="columnheader" tabindex="0" aria-sort=${this._sortKey === 'influence' ? (this._sortAsc ? 'ascending' : 'descending') : 'none'} @click=${() => this._sort('influence')} @keydown=${(
                  e: KeyboardEvent,
                ) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this._sort('influence');
                  }
                }}>
                  <span title=${msg('Influence')} aria-label=${msg('Influence')}>${msg('Infl')}</span>${this._renderSortArrow('influence')}
                </th>
                <th class="bar-col" role="columnheader" tabindex="0" aria-sort=${this._sortKey === 'sovereignty' ? (this._sortAsc ? 'ascending' : 'descending') : 'none'} @click=${() => this._sort('sovereignty')} @keydown=${(
                  e: KeyboardEvent,
                ) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this._sort('sovereignty');
                  }
                }}>
                  <span title=${msg('Sovereignty')} aria-label=${msg('Sovereignty')}>${msg('Sovr')}</span>${this._renderSortArrow('sovereignty')}
                </th>
                <th class="bar-col" role="columnheader" tabindex="0" aria-sort=${this._sortKey === 'diplomatic' ? (this._sortAsc ? 'ascending' : 'descending') : 'none'} @click=${() => this._sort('diplomatic')} @keydown=${(
                  e: KeyboardEvent,
                ) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this._sort('diplomatic');
                  }
                }}>
                  <span title=${msg('Diplomacy')} aria-label=${msg('Diplomacy')}>${msg('Dipl')}</span>${this._renderSortArrow('diplomatic')}
                </th>
                <th class="bar-col" role="columnheader" tabindex="0" aria-sort=${this._sortKey === 'military' ? (this._sortAsc ? 'ascending' : 'descending') : 'none'} @click=${() => this._sort('military')} @keydown=${(
                  e: KeyboardEvent,
                ) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this._sort('military');
                  }
                }}>
                  <span title=${msg('Military')} aria-label=${msg('Military')}>${msg('Milt')}</span>${this._renderSortArrow('military')}
                </th>
              </tr>
            </thead>
          `
        }
        <tbody>
          ${sorted.map((entry, i) => this._renderRow(entry, i, maxDim))}
        </tbody>
      </table>
      </div>
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

    const hasBetrayal = (entry.betrayal_penalty ?? 0) > 0;
    const allyCount = entry.ally_count ?? 0;
    const botPart = this._getBotParticipant(entry);
    const botPlayer = botPart?.bot_players;
    const personality = botPlayer?.personality ?? '';
    const difficulty = botPlayer?.difficulty ?? '';

    const isSelf = this.mySimulationId && entry.simulation_id === this.mySimulationId;

    return html`
      <tr class="row ${isSelf ? 'row--self' : ''}" style="animation-delay: ${delay}ms">
        <td><span class="rank ${rankClass}">${entry.rank}</span></td>
        <td>
          <div class="sim">
            <span class="sim__name">
              ${entry.simulation_name}
              ${isSelf ? html`<span class="self-badge" aria-label=${msg('Your simulation')}>${msg('YOU')}</span>` : nothing}
              ${hasBetrayal ? html`<span class="sim__traitor">${msg('Traitor')}</span>` : nothing}
              ${botPlayer ? html`<span class="sim__bot sim__bot--${personality}">${this._getBotIcon(personality)}BOT</span><span class="sim__difficulty sim__difficulty--${difficulty}">${difficulty}</span>` : nothing}
            </span>
            ${entry.team_name ? html`<span class="sim__team">${entry.team_name}${allyCount > 0 ? html`<span class="sim__alliance"> (+${allyCount * 10}%)</span>` : nothing}</span>` : nothing}
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

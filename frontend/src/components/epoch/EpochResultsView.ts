/**
 * Epoch Results View — DECLASSIFIED victory/results screen.
 *
 * Dramatic reveal of final epoch standings with:
 * - "OPERATION CONCLUDED" header with DECLASSIFIED watermark
 * - Top-3 podium with gold/silver/bronze accents
 * - Score count-up animations (typewriter)
 * - Statistics grid with staggered entrance
 * - MVP award cards with TCG-style borders
 * - Per-metric dimension bars with animated comparison
 *
 * Respects prefers-reduced-motion for all animations.
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { epochsApi } from '../../services/api/EpochsApiService.js';
import type {
  Epoch,
  EpochParticipant,
  LeaderboardEntry,
  MVPAward,
  ParticipantStats,
} from '../../types/index.js';
import { icons } from '../../utils/icons.js';

@localized()
@customElement('velg-epoch-results-view')
export class VelgEpochResultsView extends LitElement {
  static styles = css`
    :host {
      display: block;
      --gold: var(--color-primary);
      --silver: #94a3b8; /* lint-color-ok */
      --bronze: #d97706; /* lint-color-ok */
      --declassified-red: var(--color-danger);
      --_self-bg: color-mix(in srgb, var(--color-primary) 6%, transparent);
      max-width: var(--container-2xl, 1400px);
      margin-inline: auto;
      padding-inline: var(--content-padding, var(--space-4));
    }

    /* ═══════════════════════════════════════════
       HEADER — OPERATION CONCLUDED
       ═══════════════════════════════════════════ */

    .header {
      position: relative;
      text-align: center;
      padding: var(--space-8) var(--space-4) var(--space-6);
      border-bottom: 3px solid var(--color-border);
      overflow: hidden;
      opacity: 0;
      animation: header-reveal 1.2s cubic-bezier(0.22, 1, 0.36, 1) 0.3s forwards;
    }

    @keyframes header-reveal {
      0% { opacity: 0; transform: translateY(-30px); }
      60% { opacity: 1; }
      100% { opacity: 1; transform: translateY(0); }
    }

    .header__watermark {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-12deg);
      font-family: var(--font-brutalist);
      font-weight: 900;
      font-size: clamp(48px, 10vw, 96px);
      text-transform: uppercase;
      letter-spacing: 0.15em;
      color: var(--declassified-red);
      opacity: 0;
      animation: stamp-slam 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 1.0s forwards;
      pointer-events: none;
      user-select: none;
      text-shadow: 0 0 30px var(--color-danger-border);
      border: 4px solid var(--declassified-red);
      padding: 4px 24px;
      white-space: nowrap;
    }

    @keyframes stamp-slam {
      0% { opacity: 0; transform: translate(-50%, -50%) rotate(-12deg) scale(3); }
      50% { opacity: 0.18; }
      100% { opacity: 0.12; transform: translate(-50%, -50%) rotate(-12deg) scale(1); }
    }

    .header__title {
      font-family: var(--font-brutalist);
      font-weight: 900;
      font-size: clamp(24px, 4vw, 36px);
      text-transform: uppercase;
      letter-spacing: 0.2em;
      color: var(--color-text-primary);
      margin: 0 0 var(--space-2);
      position: relative;
    }

    .header__subtitle {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      letter-spacing: 0.05em;
    }

    .header__divider {
      width: 120px;
      height: 2px;
      background: linear-gradient(90deg, transparent, var(--gold), transparent);
      margin: var(--space-3) auto 0;
      opacity: 0;
      animation: line-grow 0.8s ease-out 1.5s forwards;
    }

    @keyframes line-grow {
      from { opacity: 0; transform: scaleX(0); }
      to { opacity: 1; transform: scaleX(1); }
    }

    /* ═══════════════════════════════════════════
       PODIUM — TOP 3
       ═══════════════════════════════════════════ */

    .podium {
      display: flex;
      justify-content: center;
      align-items: flex-end;
      gap: var(--space-4);
      padding: var(--space-8) var(--space-4) var(--space-6);
      perspective: 600px;
    }

    @media (max-width: 640px) {
      .podium {
        flex-direction: column;
        align-items: center;
      }
    }

    .podium__entry {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-4) var(--space-5);
      border: 2px solid var(--color-border);
      background: var(--color-surface);
      min-width: 160px;
      position: relative;
      overflow: hidden;
      opacity: 0;
      transform: translateY(40px);
    }

    .podium__entry--1 {
      order: 2;
      border-color: var(--gold);
      animation: podium-rise 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 1.8s forwards;
      z-index: 3;
    }
    .podium__entry--2 {
      order: 1;
      border-color: var(--silver);
      animation: podium-rise 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 2.2s forwards;
      z-index: 2;
    }
    .podium__entry--3 {
      order: 3;
      border-color: var(--bronze);
      animation: podium-rise 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 2.5s forwards;
      z-index: 1;
    }

    @keyframes podium-rise {
      0% { opacity: 0; transform: translateY(40px) rotateX(15deg); }
      60% { opacity: 1; }
      100% { opacity: 1; transform: translateY(0) rotateX(0); }
    }

    .podium__glow {
      position: absolute;
      inset: 0;
      pointer-events: none;
      opacity: 0.08;
    }

    .podium__entry--1 .podium__glow {
      background: radial-gradient(ellipse at center top, var(--gold) 0%, transparent 65%);
    }
    .podium__entry--2 .podium__glow {
      background: radial-gradient(ellipse at center top, var(--silver) 0%, transparent 65%);
    }
    .podium__entry--3 .podium__glow {
      background: radial-gradient(ellipse at center top, var(--bronze) 0%, transparent 65%);
    }

    .podium__rank {
      font-family: var(--font-brutalist);
      font-weight: 900;
      font-size: 40px;
      line-height: 1;
    }

    .podium__entry--1 .podium__rank { color: var(--gold); }
    .podium__entry--2 .podium__rank { color: var(--silver); }
    .podium__entry--3 .podium__rank { color: var(--bronze); }

    .podium__name {
      font-family: var(--font-brutalist);
      font-weight: 700;
      font-size: var(--text-base);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-text-primary);
      text-align: center;
    }

    .podium__score {
      font-family: var(--font-brutalist);
      font-weight: 900;
      font-size: var(--text-2xl);
      color: var(--color-text-secondary);
      font-variant-numeric: tabular-nums;
    }

    .podium__title {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      font-style: italic;
      color: var(--gold);
      letter-spacing: 0.05em;
    }

    .podium__team {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      color: var(--color-text-muted);
    }

    /* ═══════════════════════════════════════════
       STATS GRID
       ═══════════════════════════════════════════ */

    .section {
      padding: var(--space-6) var(--space-4);
      border-top: 1px solid var(--color-border);
    }

    .section__title {
      font-family: var(--font-brutalist);
      font-weight: 900;
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: 0.2em;
      color: var(--color-text-muted);
      margin: 0 0 var(--space-4);
      display: flex;
      align-items: center;
      gap: var(--space-2);
      opacity: 0;
      animation: fade-up 0.5s ease-out forwards;
    }

    .section__title::after {
      content: '';
      flex: 1;
      height: 1px;
      background: var(--color-surface-raised);
    }

    @keyframes fade-up {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: var(--space-3);
    }

    .stat-card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      padding: var(--space-4);
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      opacity: 0;
      transform: translateY(12px);
      animation: stat-enter 0.5s ease-out forwards;
      position: relative;
      overflow: hidden;
    }

    .stat-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: var(--stat-accent, var(--color-border));
    }

    @keyframes stat-enter {
      to { opacity: 1; transform: translateY(0); }
    }

    .stat-card__value {
      font-family: var(--font-brutalist);
      font-weight: 900;
      font-size: var(--text-3xl);
      line-height: 1;
      color: var(--color-text-primary);
      font-variant-numeric: tabular-nums;
    }

    .stat-card__label {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .stat-card__bar {
      height: 4px;
      background: var(--color-surface-raised);
      margin-top: var(--space-2);
      overflow: hidden;
    }

    .stat-card__bar-fill {
      height: 100%;
      transform-origin: left;
      transform: scaleX(0);
      transition: transform 1.2s cubic-bezier(0.22, 1, 0.36, 1);
    }

    :host([revealed]) .stat-card__bar-fill {
      transform: scaleX(var(--fill, 0));
    }

    .stat-card--ops { --stat-accent: var(--color-info); }
    .stat-card--ops .stat-card__bar-fill { background: var(--color-info); }
    .stat-card--success { --stat-accent: var(--color-success); }
    .stat-card--success .stat-card__bar-fill { background: var(--color-success); }
    .stat-card--detected { --stat-accent: var(--color-danger); }
    .stat-card--detected .stat-card__bar-fill { background: var(--color-danger); }
    .stat-card--rate { --stat-accent: var(--gold); }
    .stat-card--rate .stat-card__bar-fill { background: var(--gold); }

    /* ═══════════════════════════════════════════
       MVP AWARDS
       ═══════════════════════════════════════════ */

    .mvp-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: var(--space-4);
    }

    .mvp-card {
      position: relative;
      background: var(--color-surface);
      border: 2px solid var(--color-border);
      padding: var(--space-4);
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      opacity: 0;
      transform: translateY(16px) scale(0.95);
      animation: mvp-enter 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
      overflow: hidden;
      transition: border-color var(--transition-normal), transform var(--transition-normal);
    }

    .mvp-card:hover {
      border-color: var(--gold);
      transform: translateY(-2px);
    }

    @keyframes mvp-enter {
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    .mvp-card__glow {
      position: absolute;
      top: -40px;
      right: -40px;
      width: 100px;
      height: 100px;
      background: radial-gradient(circle, var(--gold) 0%, transparent 70%);
      opacity: 0.06;
      pointer-events: none;
    }

    .mvp-card__title {
      font-family: var(--font-brutalist);
      font-weight: 900;
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: 0.15em;
      color: var(--gold);
    }

    .mvp-card__sim {
      font-family: var(--font-brutalist);
      font-weight: 700;
      font-size: var(--text-base);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-text-primary);
    }

    .mvp-card__desc {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      line-height: 1.5;
    }

    .mvp-card__value {
      font-family: var(--font-brutalist);
      font-weight: 900;
      font-size: var(--text-lg);
      color: var(--color-text-secondary);
      font-variant-numeric: tabular-nums;
    }

    .mvp-card__badge {
      position: absolute;
      top: var(--space-2);
      right: var(--space-2);
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--gold);
    }

    /* ═══════════════════════════════════════════
       DIMENSION COMPARISON
       ═══════════════════════════════════════════ */

    .dimension-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: var(--space-4);
    }

    .dim-card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      padding: var(--space-3);
      opacity: 0;
      animation: fade-up 0.5s ease-out forwards;
    }

    .dim-card__label {
      font-family: var(--font-brutalist);
      font-weight: 700;
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--dim-color, var(--color-text-muted));
      margin-bottom: var(--space-2);
    }

    .dim-card__winner {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      color: var(--dim-color);
      font-style: italic;
      margin-bottom: var(--space-2);
    }

    .dim-card__entry {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin-bottom: 4px;
    }

    .dim-card__name {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      color: var(--color-text-muted);
      width: 80px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex-shrink: 0;
    }

    .dim-card__bar-track {
      flex: 1;
      height: 6px;
      background: var(--color-surface-raised);
      overflow: hidden;
    }

    .dim-card__bar-fill {
      height: 100%;
      background: var(--dim-color, var(--color-text-muted));
      transform-origin: left;
      transform: scaleX(0);
      transition: transform 1s cubic-bezier(0.22, 1, 0.36, 1);
    }

    :host([revealed]) .dim-card__bar-fill {
      transform: scaleX(var(--fill, 0));
    }

    .dim-card__val {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      color: var(--color-text-tertiary);
      width: 30px;
      text-align: right;
      flex-shrink: 0;
    }

    .dim-card--stability { --dim-color: var(--color-success); }
    .dim-card--influence { --dim-color: var(--color-epoch-influence); }
    .dim-card--sovereignty { --dim-color: var(--color-info); }
    .dim-card--diplomatic { --dim-color: var(--gold); }
    .dim-card--military { --dim-color: var(--color-danger); }

    /* ═══════════════════════════════════════════
       FULL STANDINGS TABLE
       ═══════════════════════════════════════════ */

    .standings-table {
      width: 100%;
      border-collapse: collapse;
    }

    .standings-table th {
      font-family: var(--font-brutalist);
      font-weight: 700;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-text-muted);
      text-align: left;
      padding: var(--space-2);
      border-bottom: 2px solid var(--color-border);
    }

    .standings-table td {
      padding: var(--space-2);
      border-bottom: 1px solid var(--color-border);
      vertical-align: middle;
    }

    .standings-row {
      opacity: 0;
      animation: fade-up 0.4s ease-out forwards;
    }

    .standings-row--self {
      background: var(--_self-bg);
    }

    .standings-rank {
      font-family: var(--font-brutalist);
      font-weight: 900;
      font-size: var(--text-base);
      text-align: center;
      width: 40px;
    }
    .standings-rank--1 { color: var(--gold); }
    .standings-rank--2 { color: var(--silver); }
    .standings-rank--3 { color: var(--bronze); }

    .standings-name {
      font-family: var(--font-brutalist);
      font-weight: 700;
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-text-primary);
    }

    .standings-title {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      font-style: italic;
      color: var(--gold);
    }

    .standings-composite {
      font-family: var(--font-brutalist);
      font-weight: 900;
      font-size: var(--text-lg);
      text-align: right;
      color: var(--color-text-primary);
      font-variant-numeric: tabular-nums;
    }

    .standings-dim {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    /* ═══════════════════════════════════════════
       LOADING
       ═══════════════════════════════════════════ */

    .loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-4);
      padding: var(--space-8);
    }

    .loading__spinner {
      width: 32px;
      height: 32px;
      border: 3px solid var(--color-border);
      border-top-color: var(--gold);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    .loading__text {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-sm);
      color: var(--color-text-muted);
    }

    /* ═══════════════════════════════════════════
       WIDESCREEN
       ═══════════════════════════════════════════ */

    @media (min-width: 2560px) {
      :host { max-width: var(--container-max, 1600px); }
    }

    /* ═══════════════════════════════════════════
       REDUCED MOTION
       ═══════════════════════════════════════════ */

    @media (prefers-reduced-motion: reduce) {
      .header,
      .header__watermark,
      .header__divider,
      .podium__entry,
      .section__title,
      .stat-card,
      .mvp-card,
      .dim-card,
      .standings-row {
        animation-duration: 0.01s !important;
        animation-delay: 0s !important;
      }

      .stat-card__bar-fill,
      .dim-card__bar-fill {
        transition-duration: 0.01s !important;
      }
    }
  `;

  @property({ type: Object }) epoch: Epoch | null = null;
  @property({ type: Array }) participants: EpochParticipant[] = [];
  @property({ type: String }) mySimulationId = '';

  @state() private _loading = true;
  @state() private _standings: LeaderboardEntry[] = [];
  @state() private _stats: ParticipantStats[] = [];
  @state() private _awards: MVPAward[] = [];

  override connectedCallback() {
    super.connectedCallback();
    if (this.epoch?.id) {
      this._loadResults();
    }
  }

  override updated(changed: Map<string, unknown>) {
    super.updated(changed);
    if (changed.has('epoch') && this.epoch?.id) {
      this._loadResults();
    }
  }

  private async _loadResults() {
    if (!this.epoch) return;
    this._loading = true;

    const resp = await epochsApi.getResultsSummary(this.epoch.id);
    if (resp.success && resp.data) {
      this._standings = resp.data.standings ?? [];
      this._stats = resp.data.participant_stats ?? [];
      this._awards = resp.data.mvp_awards ?? [];
    }

    this._loading = false;

    // Trigger bar animations after paint
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.setAttribute('revealed', '');
      });
    });
  }

  // ── Helpers ─────────────────────────────────

  private _getMyStats(): ParticipantStats | undefined {
    return this._stats.find((s) => s.simulation_id === this.mySimulationId);
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

  // ── Render ──────────────────────────────────

  protected render() {
    if (this._loading) {
      return html`
        <div class="loading">
          <div class="loading__spinner"></div>
          <span class="loading__text">${msg('Declassifying results...')}</span>
        </div>
      `;
    }

    if (this._standings.length === 0) {
      return html`
        <div class="loading">
          <span class="loading__text">${msg('No results available for this epoch.')}</span>
        </div>
      `;
    }

    const top3 = this._standings.slice(0, 3);
    const myStats = this._getMyStats();

    return html`
      ${this._renderHeader()}
      ${this._renderPodium(top3)}
      ${myStats ? this._renderMyStats(myStats) : nothing}
      ${this._awards.length > 0 ? this._renderAwards() : nothing}
      ${this._renderDimensionComparison()}
      ${this._renderFullStandings()}
    `;
  }

  private _renderHeader() {
    return html`
      <div class="header">
        <div class="header__watermark">${msg('DECLASSIFIED')}</div>
        <h2 class="header__title">${msg('OPERATION CONCLUDED')}</h2>
        <p class="header__subtitle">
          ${this.epoch?.name ?? ''}
          &nbsp;&middot;&nbsp;
          ${msg(str`${this._standings.length} combatants`)}
          &nbsp;&middot;&nbsp;
          ${msg(str`${this.epoch?.current_cycle ?? 0} cycles`)}
        </p>
        <div class="header__divider"></div>
      </div>
    `;
  }

  private _renderPodium(top3: LeaderboardEntry[]) {
    return html`
      <div class="podium">
        ${top3.map(
          (entry) => html`
            <div class="podium__entry podium__entry--${entry.rank}">
              <div class="podium__glow"></div>
              <span class="podium__rank">${entry.rank}</span>
              <span class="podium__name">${entry.simulation_name}</span>
              <span class="podium__score">${entry.composite.toFixed(1)}</span>
              ${
                this._getDimensionTitle(entry)
                  ? html`<span class="podium__title">"${this._getDimensionTitle(entry)}"</span>`
                  : nothing
              }
              ${
                entry.team_name
                  ? html`<span class="podium__team">${entry.team_name}</span>`
                  : nothing
              }
            </div>
          `,
        )}
      </div>
    `;
  }

  private _renderMyStats(stats: ParticipantStats) {
    const maxOps = Math.max(...this._stats.map((s) => s.total_operations), 1);

    return html`
      <div class="section">
        <h3 class="section__title" style="animation-delay: 3.0s">
          ${msg('YOUR OPERATION REPORT')}
        </h3>
        <div class="stats-grid">
          <div class="stat-card stat-card--ops" style="animation-delay: 3.2s">
            <span class="stat-card__value">${stats.total_operations}</span>
            <span class="stat-card__label">${msg('Total Operations')}</span>
            <div class="stat-card__bar">
              <div class="stat-card__bar-fill"
                style="--fill: ${stats.total_operations / maxOps}; transition-delay: 3.5s"></div>
            </div>
          </div>
          <div class="stat-card stat-card--success" style="animation-delay: 3.4s">
            <span class="stat-card__value">${stats.successes}</span>
            <span class="stat-card__label">${msg('Successful')}</span>
            <div class="stat-card__bar">
              <div class="stat-card__bar-fill"
                style="--fill: ${stats.total_operations > 0 ? stats.successes / stats.total_operations : 0}; transition-delay: 3.7s"></div>
            </div>
          </div>
          <div class="stat-card stat-card--detected" style="animation-delay: 3.6s">
            <span class="stat-card__value">${stats.detections}</span>
            <span class="stat-card__label">${msg('Detected / Captured')}</span>
            <div class="stat-card__bar">
              <div class="stat-card__bar-fill"
                style="--fill: ${stats.total_operations > 0 ? stats.detections / stats.total_operations : 0}; transition-delay: 3.9s"></div>
            </div>
          </div>
          <div class="stat-card stat-card--rate" style="animation-delay: 3.8s">
            <span class="stat-card__value">${Math.round(stats.success_rate * 100)}%</span>
            <span class="stat-card__label">${msg('Success Rate')}</span>
            <div class="stat-card__bar">
              <div class="stat-card__bar-fill"
                style="--fill: ${stats.success_rate}; transition-delay: 4.1s"></div>
            </div>
          </div>
          ${
            stats.counter_intel_sweeps
              ? html`
            <div class="stat-card stat-card--ops" style="animation-delay: 4.0s">
              <span class="stat-card__value">${stats.counter_intel_sweeps}</span>
              <span class="stat-card__label">${msg('Counter-Intel Sweeps')}</span>
            </div>
          `
              : nothing
          }
          ${
            stats.fortifications
              ? html`
            <div class="stat-card stat-card--ops" style="animation-delay: 4.2s">
              <span class="stat-card__value">${stats.fortifications}</span>
              <span class="stat-card__label">${msg('Zone Fortifications')}</span>
            </div>
          `
              : nothing
          }
        </div>
      </div>
    `;
  }

  private _renderAwards() {
    return html`
      <div class="section">
        <h3 class="section__title" style="animation-delay: 4.2s">
          ${msg('COMMENDATIONS')}
        </h3>
        <div class="mvp-grid">
          ${this._awards.map(
            (award, i) => html`
              <div class="mvp-card" style="animation-delay: ${4.4 + i * 0.2}s">
                <div class="mvp-card__glow"></div>
                <span class="mvp-card__badge">${icons.trophy(20)}</span>
                <span class="mvp-card__title">${award.title}</span>
                <span class="mvp-card__sim">${award.simulation_name}</span>
                <span class="mvp-card__desc">${award.description}</span>
                <span class="mvp-card__value">${typeof award.value === 'number' ? (award.value.toFixed?.(1) ?? award.value) : award.value}</span>
              </div>
            `,
          )}
        </div>
      </div>
    `;
  }

  private _renderDimensionComparison() {
    const dims = [
      { key: 'stability', label: msg('Stability') },
      { key: 'influence', label: msg('Influence') },
      { key: 'sovereignty', label: msg('Sovereignty') },
      { key: 'diplomatic', label: msg('Diplomacy') },
      { key: 'military', label: msg('Military') },
    ] as const;

    return html`
      <div class="section">
        <h3 class="section__title" style="animation-delay: 5.0s">
          ${msg('DIMENSION ANALYSIS')}
        </h3>
        <div class="dimension-grid">
          ${dims.map((dim, di) => {
            const max = Math.max(...this._standings.map((s) => (s[dim.key] as number) ?? 0), 1);
            const winner = this._standings.reduce((a, b) =>
              ((a[dim.key] as number) ?? 0) > ((b[dim.key] as number) ?? 0) ? a : b,
            );

            return html`
                <div class="dim-card dim-card--${dim.key}" style="animation-delay: ${5.2 + di * 0.15}s">
                  <div class="dim-card__label">${dim.label}</div>
                  <div class="dim-card__winner">${winner.simulation_name}</div>
                  ${this._standings.slice(0, 5).map(
                    (s, si) => html`
                      <div class="dim-card__entry">
                        <span class="dim-card__name">${s.simulation_name}</span>
                        <div class="dim-card__bar-track">
                          <div class="dim-card__bar-fill"
                            style="--fill: ${max > 0 ? (s[dim.key] as number) / max : 0}; transition-delay: ${5.5 + di * 0.15 + si * 0.08}s"></div>
                        </div>
                        <span class="dim-card__val">${((s[dim.key] as number) ?? 0).toFixed(0)}</span>
                      </div>
                    `,
                  )}
                </div>
              `;
          })}
        </div>
      </div>
    `;
  }

  private _renderFullStandings() {
    return html`
      <div class="section">
        <h3 class="section__title" style="animation-delay: 6.0s">
          ${msg('FINAL STANDINGS')}
        </h3>
        <table class="standings-table">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">${msg('Simulation')}</th>
              <th scope="col" style="text-align:right">${msg('Score')}</th>
              <th scope="col" style="text-align:right">${msg('Stab')}</th>
              <th scope="col" style="text-align:right">${msg('Infl')}</th>
              <th scope="col" style="text-align:right">${msg('Sovr')}</th>
              <th scope="col" style="text-align:right">${msg('Dipl')}</th>
              <th scope="col" style="text-align:right">${msg('Milt')}</th>
            </tr>
          </thead>
          <tbody>
            ${this._standings.map(
              (s, i) => html`
                <tr class="standings-row ${s.simulation_id === this.mySimulationId ? 'standings-row--self' : ''}"
                  style="animation-delay: ${6.2 + i * 0.08}s">
                  <td>
                    <span class="standings-rank ${s.rank <= 3 ? `standings-rank--${s.rank}` : ''}">
                      ${s.rank}
                    </span>
                  </td>
                  <td>
                    <div>
                      <span class="standings-name">${s.simulation_name}</span>
                      ${
                        this._getDimensionTitle(s)
                          ? html`<br><span class="standings-title">"${this._getDimensionTitle(s)}"</span>`
                          : nothing
                      }
                    </div>
                  </td>
                  <td class="standings-composite">${s.composite.toFixed(1)}</td>
                  <td class="standings-dim">${s.stability.toFixed(0)}</td>
                  <td class="standings-dim">${s.influence.toFixed(0)}</td>
                  <td class="standings-dim">${s.sovereignty.toFixed(0)}</td>
                  <td class="standings-dim">${s.diplomatic.toFixed(0)}</td>
                  <td class="standings-dim">${s.military.toFixed(0)}</td>
                </tr>
              `,
            )}
          </tbody>
        </table>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-epoch-results-view': VelgEpochResultsView;
  }
}

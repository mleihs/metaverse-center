/**
 * How to Play — War Room (Phase 4)
 *
 * Competitive tactics, worked-out match replays, 200-game balance analytics,
 * demo epoch walkthrough, and version changelog.
 *
 * Military-console aesthetic AMPLIFIED: CRT scanlines, "EYES ONLY" hero,
 * classified badges, corner bracket reticles on chart containers.
 *
 * Architecture: VelgTabs for 5 content panels, lazy-loaded ECharts for
 * Intelligence tab, IntersectionObserver for chart reveal animations.
 *
 * Uses --font-brutalist (Courier 700) for headings, --font-prose (Spectral 500)
 * for body text. All colors from design tokens. All strings in msg().
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { analyticsService } from '../../services/AnalyticsService.js';
import { seoService } from '../../services/SeoService.js';
import '../shared/Lightbox.js';
import '../shared/VelgTabs.js';
import type { TabDef } from '../shared/VelgTabs.js';
import { getDemoSteps } from './htp-content-demo.js';
import { getMatches } from './htp-content-matches.js';
import {
  getBalanceInsights,
  getChangelog,
  getDimensionVariance,
  getEloRatings,
  getHeadToHeadData,
  getSimulationProfiles,
  getStrategyTiers,
  getTactics,
} from './htp-content-rules.js';
import {
  htpBackStyles,
  htpFooterNavStyles,
  htpHeroStyles,
  htpReducedMotionBase,
} from './htp-shared-styles.js';
import { htpStyles } from './htp-styles.js';
import type {
  ChangelogEntry,
  CycleData,
  DemoStep,
  FinalStanding,
  MatchConfig,
  SimulationProfile,
  StrategyTier,
  TacticCard,
} from './htp-types.js';

/* ── Constants ────────────────────────────────────────── */

const TAB_KEYS = {
  TACTICS: 'tactics',
  MATCHES: 'matches',
  INTEL: 'intel',
  DEMO: 'demo',
  UPDATES: 'updates',
} as const;

/** Simulation hex colors for ECharts (exception: documented in design-tokens.md). */
const SIM_HEX: Record<string, string> = {
  Speranza: '#d4a24e',
  'The Gaslit Reach': '#6bcb77',
  Velgarien: '#e74c3c',
  'Nova Meridian': '#a78bfa',
  'Station Null': '#67e8f9',
};

/* ── Component ────────────────────────────────────────── */

@localized()
@customElement('velg-how-to-play-war-room')
export class HowToPlayWarRoom extends LitElement {
  /* ── Styles ──────────────────────────────────────── */

  static styles = [
    htpHeroStyles,
    htpBackStyles,
    htpFooterNavStyles,
    htpReducedMotionBase,
    htpStyles,
    css`
      :host {
        display: block;
        color: var(--color-text-primary);
        --_accent: var(--color-primary);
      }

      .war-room {
        max-width: var(--container-lg);
        margin: 0 auto;
        padding: var(--space-8) var(--content-padding) var(--space-16);
      }

      /* ── Tab area ──────────────────────────────── */

      .war-room__tabs {
        margin-bottom: var(--space-8);
        border-bottom: 1px solid var(--color-border);
      }

      .war-room__panel {
        min-height: 400px;
        animation: panelIn var(--duration-normal, 200ms) var(--ease-out, ease-out);
      }

      @keyframes panelIn {
        from {
          opacity: 0;
          transform: translateY(6px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      /* ── Hero override — amplified military ──── */

      .hero {
        position: relative;
        overflow: hidden;
        border-bottom: 3px solid var(--color-primary);
      }

      .hero__classification {
        letter-spacing: 0.2em;
      }

      /* ── Footer nav ────────────────────────────── */

      .war-room__footer {
        margin-top: var(--space-12);
        padding-top: var(--space-8);
        border-top: 1px solid var(--color-border);
      }

      /* ── Reduced motion ────────────────────────── */

      @media (prefers-reduced-motion: reduce) {
        .war-room__panel {
          animation: none;
        }
      }

      /* ── Responsive ────────────────────────────── */

      @media (max-width: 768px) {
        .war-room {
          padding: var(--space-4) var(--content-padding) var(--space-12);
        }
      }
    `,
  ];

  /* ── State ──────────────────────────────────────── */

  @state() private _activeTab: string = TAB_KEYS.TACTICS;
  @state() private _expandedMatches = new Set<number>();
  @state() private _expandedUpdates = new Set<number>();
  @state() private _lightboxSrc: string | null = null;
  @state() private _lightboxAlt = '';
  @state() private _lightboxCaption = '';

  private _chartObserver: IntersectionObserver | null = null;
  private _echartsLoaded = false;

  /* ── Lifecycle ──────────────────────────────────── */

  connectedCallback(): void {
    super.connectedCallback();
    seoService.setTitle([msg('War Room'), msg('How to Play')]);
    seoService.setDescription(
      msg(
        'Competitive tactics, worked-out match replays, and 200-game balance analytics for metaverse.center epochs.',
      ),
    );
    seoService.setCanonical('/how-to-play/competitive');
    seoService.setBreadcrumbs([
      { name: msg('Home'), url: 'https://metaverse.center/' },
      { name: msg('How to Play'), url: 'https://metaverse.center/how-to-play' },
      { name: msg('War Room'), url: 'https://metaverse.center/how-to-play/competitive' },
    ]);
    analyticsService.trackPageView('/how-to-play/competitive', document.title);

    // Deep link via hash
    const hash = window.location.hash.slice(1);
    if (hash && Object.values(TAB_KEYS).includes(hash as (typeof TAB_KEYS)[keyof typeof TAB_KEYS])) {
      this._activeTab = hash;
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._chartObserver?.disconnect();
  }

  protected updated(): void {
    if (this._activeTab === TAB_KEYS.INTEL) {
      this._loadEcharts();
      this.updateComplete.then(() => this._setupChartObserver());
    }
  }

  /* ── Tab Management ─────────────────────────────── */

  private _getTabs(): TabDef[] {
    return [
      { key: TAB_KEYS.TACTICS, label: msg('Tactics') },
      { key: TAB_KEYS.MATCHES, label: msg('Matches') },
      { key: TAB_KEYS.INTEL, label: msg('Intelligence'), group: 'data' },
      { key: TAB_KEYS.DEMO, label: msg('Demo Run'), group: 'data' },
      { key: TAB_KEYS.UPDATES, label: msg('Updates') },
    ];
  }

  private _handleTabChange(e: CustomEvent<{ key: string }>): void {
    this._activeTab = e.detail.key;
    window.history.replaceState(null, '', `#${e.detail.key}`);
    this.renderRoot.querySelector('.war-room__panel')?.scrollTo(0, 0);
  }

  /* ── Main Render ────────────────────────────────── */

  protected render() {
    return html`
      <a class="back" href="/how-to-play" @click=${this._handleNavClick}>
        <span class="back__arrow" aria-hidden="true">\u25C2</span> ${msg('How to Play')}
      </a>

      ${this._renderHero()}

      <div class="war-room">
        <div class="war-room__tabs">
          <velg-tabs
            .tabs=${this._getTabs()}
            .active=${this._activeTab}
            @tab-change=${this._handleTabChange}
          ></velg-tabs>
        </div>

        <div class="war-room__panel" role="tabpanel" id="tabpanel-${this._activeTab}">
          ${this._renderActivePanel()}
        </div>

        <nav class="war-room__footer footer-nav">
          <a class="footer-nav__link" href="/how-to-play/guide" @click=${this._handleNavClick}>
            \u25C2 ${msg('Game Guide')}
          </a>
          <a class="footer-nav__link" href="/how-to-play/quickstart" @click=${this._handleNavClick}>
            ${msg('Quick Start')} \u25B8
          </a>
        </nav>
      </div>

      <velg-lightbox
        .src=${this._lightboxSrc}
        .alt=${this._lightboxAlt}
        .caption=${this._lightboxCaption}
        @lightbox-close=${this._closeLightbox}
      ></velg-lightbox>
    `;
  }

  /* ── Hero ──────────────────────────────────────── */

  private _renderHero() {
    return html`
      <div class="hero">
        <div class="hero__scanlines"></div>
        <div class="hero__inner">
          <div class="hero__classification">${msg('Eyes Only')}</div>
          <h1 class="hero__title">${msg('War Room')}</h1>
          <p class="hero__sub">${msg('Tactics, Intelligence & Battle Records')}</p>
          <div class="hero__line"></div>
        </div>
      </div>
    `;
  }

  /* ── Panel Router ──────────────────────────────── */

  private _renderActivePanel(): TemplateResult {
    switch (this._activeTab) {
      case TAB_KEYS.TACTICS:
        return this._renderTactics();
      case TAB_KEYS.MATCHES:
        return this._renderMatches();
      case TAB_KEYS.INTEL:
        return this._renderIntelligence();
      case TAB_KEYS.DEMO:
        return this._renderDemoRun();
      case TAB_KEYS.UPDATES:
        return this._renderUpdates();
      default:
        return this._renderTactics();
    }
  }

  /* ── Section Header Helper ─────────────────────── */

  private _renderSectionHeader(num: string, title: string) {
    return html`
      <div class="section__divider">
        <span class="section__number">${num}</span>
        <div class="section__rule"></div>
      </div>
      <h2 class="section__title">${title}</h2>
    `;
  }

  /* ═══════════════════════════════════════════════════
   *  TAB 1: TACTICS & STRATEGIES
   * ═══════════════════════════════════════════════════ */

  private _renderTactics() {
    const tactics = getTactics();
    return html`
      <section class="section" id="tactics">
        ${this._renderSectionHeader('T-1', msg('Tactics & Strategies'))}
        <p class="section__text">
          ${msg(
            'Proven strategies for each phase, economy management, counter-play patterns, and preset-specific approaches. Study these before your first deployment.',
          )}
        </p>

        <div class="tactics-grid">
          ${tactics.map((t, i) => this._renderTacticCard(t, i))}
        </div>
      </section>
    `;
  }

  private _renderTacticCard(tactic: TacticCard, index: number) {
    return html`
      <div class="tactic-card tactic-card--${tactic.category}" style="--i: ${index}">
        <div class="tactic-card__header">
          <span class="tactic-card__title">${tactic.title}</span>
          <span class="tactic-card__badge tactic-card__badge--${tactic.category}">${tactic.category}</span>
        </div>
        <div class="tactic-card__desc">${tactic.description}</div>
      </div>
    `;
  }

  /* ═══════════════════════════════════════════════════
   *  TAB 2: EXAMPLE MATCHES
   * ═══════════════════════════════════════════════════ */

  private _renderMatches() {
    const matches = getMatches();
    return html`
      <section class="section" id="matches">
        ${this._renderSectionHeader('T-2', msg('Example Matches'))}
        <p class="section__text">
          ${msg(
            'Five fully worked-out matches showing different strategies, presets, and mechanics in action. Expand each match to see cycle-by-cycle replays.',
          )}
        </p>

        ${matches.map((m, i) => this._renderMatch(m, i))}
      </section>
    `;
  }

  private _renderMatch(match: MatchConfig, index: number) {
    const expanded = this._expandedMatches.has(index);

    return html`
      <div class="match">
        <div
          class="match__header"
          role="button"
          tabindex="0"
          aria-expanded=${expanded}
          @click=${() => this._toggleMatch(index)}
          @keydown=${(e: KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              this._toggleMatch(index);
            }
          }}
        >
          <div class="match__title-group">
            <h3 class="match__title">${match.title}</h3>
            <span class="match__subtitle">${match.subtitle}</span>
          </div>
          <div class="match__meta">
            <span class="match__meta-tag">${match.duration}</span>
            <span class="match__meta-tag">${match.preset}</span>
            <span class="match__meta-tag">${msg(str`${match.players.length}P`)}</span>
          </div>
          <span class="match__toggle ${expanded ? 'match__toggle--open' : ''}">\u25BC</span>
        </div>

        ${expanded ? this._renderMatchBody(match) : nothing}
      </div>
    `;
  }

  private _renderMatchBody(match: MatchConfig) {
    return html`
      <div class="match__body">
        <div class="match__desc">${match.description}</div>

        ${match.specialRules
          ? html`<div class="callout callout--warn">
              <div class="callout__label">${msg('Special Rules')}</div>
              <div class="callout__text">${match.specialRules}</div>
            </div>`
          : nothing}

        <div class="match__players">
          ${match.players.map((p) => html`<span class="match__player">${p}</span>`)}
        </div>

        ${this._renderCycleTable(match.cycleData)} ${this._renderStandings(match.finalStandings)}
        ${this._renderKeyMoments(match.keyMoments)}
      </div>
    `;
  }

  private _renderCycleTable(cycles: CycleData[]) {
    return html`
      <div>
        <div class="cycles-label">${msg('Cycle-by-Cycle Replay')}</div>
        <div class="cycles-wrap">
          <table class="cycles-table">
            <thead>
              <tr>
                <th>${msg('Cycle')}</th>
                <th>${msg('Phase')}</th>
                <th>${msg('Simulation')}</th>
                <th>${msg('Action')}</th>
                <th>RP</th>
                <th>${msg('Notes')}</th>
              </tr>
            </thead>
            <tbody>
              ${cycles.flatMap((c) => this._renderCycleRows(c))}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  private _renderCycleRows(cycle: CycleData): TemplateResult[] {
    if (cycle.actions.length === 0) {
      return [
        html`
          <tr>
            <td>${cycle.cycle}</td>
            <td><span class="cycle-phase cycle-phase--${cycle.phase}">${cycle.phase}</span></td>
            <td colspan="4" style="color: var(--color-text-muted); font-style: italic;">
              ${cycle.scoreSnapshot
                ? html`${msg('Final scores')}:
                    ${Object.entries(cycle.scoreSnapshot).map(
                      ([name, score]) => html`<strong>${name}</strong>: ${score} `,
                    )}`
                : msg('No actions')}
            </td>
          </tr>
        `,
      ];
    }

    return cycle.actions.map(
      (a, i) => html`
        <tr>
          <td>${i === 0 ? cycle.cycle : ''}</td>
          <td>
            ${i === 0
              ? html`<span class="cycle-phase cycle-phase--${cycle.phase}">${cycle.phase}</span>`
              : ''}
          </td>
          <td>${a.simulation}</td>
          <td>
            <span class="${a.outcome ? `outcome--${a.outcome}` : ''}">${a.action}</span>
            ${a.target ? html` \u2192 <em>${a.target}</em>` : nothing}
          </td>
          <td>${a.rpCost > 0 ? `-${a.rpCost}` : ''}</td>
          <td>${a.note ? html`<span class="cycle-note">${a.note}</span>` : ''}</td>
        </tr>
      `,
    );
  }

  private _renderStandings(standings: FinalStanding[]) {
    return html`
      <div>
        <div class="standings-label">${msg('Final Standings')}</div>
        <div class="cycles-wrap">
          <table class="standings-table">
            <thead>
              <tr>
                <th>#</th>
                <th>${msg('Simulation')}</th>
                <th>${msg('Composite')}</th>
                <th>${msg('Stab')}</th>
                <th>${msg('Infl')}</th>
                <th>${msg('Sovr')}</th>
                <th>${msg('Dipl')}</th>
                <th>${msg('Milt')}</th>
              </tr>
            </thead>
            <tbody>
              ${standings.map(
                (s) => html`
                  <tr>
                    <td><span class="standings-rank standings-rank--${s.rank}">${s.rank}</span></td>
                    <td>
                      ${s.simulation}
                      ${s.title ? html`<br /><span class="standings-title">"${s.title}"</span>` : nothing}
                    </td>
                    <td class="standings-composite">${s.composite}</td>
                    <td>${s.stability}</td>
                    <td>${s.influence}</td>
                    <td>${s.sovereignty}</td>
                    <td>${s.diplomatic}</td>
                    <td>${s.military}</td>
                  </tr>
                `,
              )}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  private _renderKeyMoments(moments: string[]) {
    return html`
      <div>
        <div class="moments-label">${msg('Key Moments')}</div>
        <ul class="moments-list">
          ${moments.map((m) => html`<li>${m}</li>`)}
        </ul>
      </div>
    `;
  }

  /* ═══════════════════════════════════════════════════
   *  TAB 3: INTELLIGENCE REPORT
   * ═══════════════════════════════════════════════════ */

  private _renderIntelligence() {
    const elo = getEloRatings();
    const profiles = getSimulationProfiles();
    const tiers = getStrategyTiers();
    const dims = getDimensionVariance();
    const insights = getBalanceInsights();

    return html`
      <section class="section" id="intel">
        ${this._renderSectionHeader('T-3', msg('Intelligence Report'))}
        <p class="section__text">
          ${msg(
            'Compiled from 200 simulated epoch games (50 per player count, 2P through 5P) using v2.1 balance tuning. All data drawn from automated Monte Carlo simulation against the live game engine. 188 games produced valid results (12 empty leaderboards excluded).',
          )}
        </p>

        <div class="callout callout--info" style="margin-bottom: var(--space-8)">
          <div class="callout__label">${msg('Methodology')}</div>
          <div class="callout__text">
            ${msg(
              'Each game randomizes scoring preset weights, strategy assignments, and player pairings. Elo ratings use K-factor scaling for multi-player games. Statistical significance tested via chi-squared, Fisher exact, and bootstrap confidence intervals (10,000 iterations).',
            )}
          </div>
        </div>

        <!-- Elo Power Rankings -->
        <div class="analytics-sub">
          <h3 class="analytics-sub__title">${msg('Elo Power Rankings')}</h3>
          <p class="analytics-sub__desc">
            ${msg(
              'Elo ratings computed from all 188 valid games. Multi-player games decomposed into pairwise matchups (winner beats each loser). All ratings start at 1500.',
            )}
          </p>
          <div class="elo-chart">
            ${elo.map(
              (e) => html`
                <div class="elo-row">
                  <span class="elo-row__label" style="color: ${e.color}">${e.simulation}</span>
                  <div class="elo-row__track">
                    <div
                      class="elo-row__fill"
                      style="background: ${e.color}; --w: ${(e.rating - 1400) / 180}"
                    ></div>
                  </div>
                  <span class="elo-row__value">${e.rating}</span>
                  <span
                    class="elo-row__delta ${e.delta >= 0 ? 'elo-row__delta--up' : 'elo-row__delta--down'}"
                  >
                    ${e.delta >= 0 ? '+' : ''}${e.delta}
                  </span>
                </div>
              `,
            )}
          </div>
        </div>

        ${this._renderIntelChart(
          'CLASSIFIED',
          msg('Simulation Performance Radar'),
          'SIGINT-4',
          this._buildRadarOption(),
          '350px',
        )}

        <!-- Simulation Dossiers -->
        <div class="analytics-sub">
          <h3 class="analytics-sub__title">${msg('Simulation Dossiers')}</h3>
          <p class="analytics-sub__desc">
            ${msg(
              'Win rates per player count, 95% bootstrap confidence intervals, and competitive profile for each simulation. Theoretical fair rates: 50% (2P), 33% (3P), 25% (4P), 20% (5P).',
            )}
          </p>
          <div class="profile-grid">
            ${profiles.map((p, i) => this._renderProfileCard(p, i))}
          </div>
        </div>

        ${this._renderIntelChart(
          'CLASSIFIED',
          msg('Win Rate Evolution by Player Count'),
          'HUMINT-3',
          this._buildWinRateLineOption(),
          '320px',
        )}
        ${this._renderIntelChart(
          'RESTRICTED',
          msg('Head-to-Head Matrix (2P Duels)'),
          'COMINT-2',
          this._buildHeatmapOption(),
          '350px',
        )}

        <!-- Strategy Tier List -->
        <div class="analytics-sub">
          <h3 class="analytics-sub__title">${msg('Strategy Tier List')}</h3>
          <p class="analytics-sub__desc">
            ${msg(
              'Win rates with Wilson score 95% confidence intervals. Ordered by observed effectiveness across all player counts and presets.',
            )}
          </p>
          <div class="strat-tiers">
            ${tiers.map((t) => this._renderStratTier(t))}
          </div>
        </div>

        ${this._renderIntelChart(
          'TOP SECRET',
          msg('Strategy Effectiveness (Wilson 95% CI)'),
          'MASINT-5',
          this._buildStrategyBarOption(),
          '320px',
        )}

        <!-- Dimension Impact -->
        <div class="analytics-sub">
          <h3 class="analytics-sub__title">${msg('Scoring Dimension Impact')}</h3>
          <p class="analytics-sub__desc">
            ${msg(
              'Standard deviation measures how much each scoring dimension differentiates between players within a game. Higher variance = more decisive. All five dimensions are now active in v2.1 (up from only 2 in v2).',
            )}
          </p>
          <div class="impact-chart">
            ${dims.map(
              (d) => html`
                <div class="impact-row">
                  <span class="impact-row__label" style="color: ${d.color}">${d.name}</span>
                  <div class="impact-row__track">
                    <div
                      class="impact-row__fill"
                      style="background: ${d.color}; --w: ${d.stdDev / d.maxStd}"
                    ></div>
                  </div>
                  <span class="impact-row__std">\u03C3 ${d.stdDev}</span>
                  <span class="impact-row__status" style="color: ${d.color}; border-color: ${d.color}">
                    ${d.status}
                  </span>
                </div>
              `,
            )}
          </div>
        </div>

        <!-- Statistical Verdict -->
        <div class="analytics-sub">
          <h3 class="analytics-sub__title">${msg('Statistical Verdict')}</h3>
          <p class="analytics-sub__desc">
            ${msg(
              'Key findings from chi-squared tests, bootstrap analysis, and game-theoretic Nash equilibrium computation.',
            )}
          </p>
          <div class="verdict-grid">
            ${insights.map(
              (ins, i) => html`
                <div class="verdict-card" style="--i: ${i}">
                  <span class="verdict-card__label">${ins.label}</span>
                  <span class="verdict-card__value">${ins.value}</span>
                  <span class="verdict-card__desc">${ins.description}</span>
                </div>
              `,
            )}
          </div>
        </div>

        <div class="callout callout--info" style="margin-bottom: var(--space-6)">
          <div class="callout__label">${msg('Data Provenance')}</div>
          <div class="callout__text">
            ${msg(
              'All analytics data reflects v2.1 baseline (188 valid games from 200 simulated). The v2.2 balance changes above are informed by this analysis. Future simulation runs will validate v2.2 impact.',
            )}
          </div>
        </div>

        <div class="callout callout--warn">
          <div class="callout__label">${msg('v2.2 Balance Changes Applied')}</div>
          <div class="callout__text">
            ${msg(
              'The ci_defensive dominance (64% win rate) and dead infiltrator (1.9%) identified above have been addressed in v2.2: guardian penalty reduced to 6%/15% cap, guardian cost raised to 4 RP, counter-intel to 4 RP, infiltrator buffed (65% reduction, 5 RP, +3 influence), RP economy expanded to 12/cycle and 40 cap. See the Updates section for full changelog.',
            )}
          </div>
        </div>

        <div class="callout callout--tip">
          <div class="callout__label">${msg('What This Means For Players')}</div>
          <div class="callout__text">
            ${msg(
              'All simulations are competitively viable. Choose any simulation \u2014 your skill and strategy matter more than your faction. With v2.2, offensive and hybrid strategies should be more viable alongside defensive play. The expanded RP economy enables multi-pronged approaches.',
            )}
          </div>
        </div>
      </section>
    `;
  }

  /* ── Intel sub-renders ─────────────────────────── */

  private _renderIntelChart(
    classification: string,
    title: string,
    grade: string,
    option: Record<string, unknown>,
    height: string,
  ) {
    return html`
      <div class="intel-chart">
        <div class="intel-chart__scanlines"></div>
        <div class="intel-chart__header">
          <span class="intel-chart__classification">${classification}</span>
          <span class="intel-chart__title">${title}</span>
          <span class="intel-chart__grade">${grade}</span>
        </div>
        <velg-echarts-chart .option=${option} height=${height} aria-label=${title}></velg-echarts-chart>
      </div>
    `;
  }

  private _renderProfileCard(profile: SimulationProfile, index: number) {
    const rates = [
      { label: '2P', value: profile.winRates.pc2 },
      { label: '3P', value: profile.winRates.pc3 },
      { label: '4P', value: profile.winRates.pc4 },
      { label: '5P', value: profile.winRates.pc5 },
    ];

    return html`
      <div class="profile-card" style="border-top-color: ${profile.color}; --i: ${index}">
        <div class="profile-card__header">
          <span class="profile-card__tag" style="color: ${profile.color}; border-color: ${profile.color}">
            ${profile.tag}
          </span>
          <span class="profile-card__name">${profile.name}</span>
          <span class="profile-card__elo">${profile.eloRating}</span>
        </div>
        <div class="profile-card__body">
          <div class="profile-card__rates">
            ${rates.map(
              (r) => html`
                <div class="profile-card__rate">
                  <span class="profile-card__rate-label">${r.label}</span>
                  <span
                    class="profile-card__rate-value ${r.value == null ? 'profile-card__rate-value--na' : ''}"
                    style="${r.value != null ? `color: ${profile.color}` : ''}"
                  >
                    ${r.value != null ? `${r.value}%` : 'N/A'}
                  </span>
                </div>
              `,
            )}
          </div>
          <div class="profile-card__ci">
            <span class="profile-card__ci-label">95% CI</span>
            <div class="profile-card__ci-track">
              <div
                class="profile-card__ci-fill"
                style="background: ${profile.color}; left: ${profile.ciLow}%; right: ${100 - profile.ciHigh}%"
              ></div>
            </div>
            <span class="profile-card__ci-range">${profile.ciLow}% \u2013 ${profile.ciHigh}%</span>
          </div>
          <div class="profile-card__text">
            <span class="profile-card__text-label" style="color: var(--color-success)">${msg('Strengths')}</span>
            <span class="profile-card__text-value">${profile.strengths}</span>
          </div>
          <div class="profile-card__text">
            <span class="profile-card__text-label" style="color: var(--color-danger)">${msg('Weakness')}</span>
            <span class="profile-card__text-value">${profile.weakness}</span>
          </div>
        </div>
      </div>
    `;
  }

  private _renderStratTier(tier: StrategyTier) {
    return html`
      <div class="strat-tier">
        <div class="strat-tier__badge" style="color: ${tier.tierColor}; border-color: ${tier.tierColor}">
          ${tier.tier}
        </div>
        <div class="strat-tier__entries">
          ${tier.strategies.map(
            (s) => html`
              <div class="strat-entry">
                <div class="strat-entry__header">
                  <span class="strat-entry__name">${s.name}</span>
                  <span class="strat-entry__meta">
                    <span style="color: ${tier.tierColor}">${s.winRate}%</span>
                    <span>n=${s.appearances}</span>
                  </span>
                </div>
                <div class="strat-entry__bar">
                  <div
                    class="strat-entry__fill"
                    style="background: ${tier.tierColor}; --w: ${s.winRate / 100}"
                  ></div>
                </div>
                <div class="strat-entry__desc">${s.description}</div>
              </div>
            `,
          )}
        </div>
      </div>
    `;
  }

  /* ── Chart Builders ────────────────────────────── */

  private _buildRadarOption(): Record<string, unknown> {
    const profiles = getSimulationProfiles();
    return {
      tooltip: {},
      legend: { bottom: 0, textStyle: { color: '#94a3b8', fontSize: 10 } },
      radar: {
        indicator: [
          { name: '2P', max: 80 },
          { name: '3P', max: 55 },
          { name: '4P', max: 35 },
          { name: '5P', max: 30 },
        ],
        shape: 'polygon',
        radius: '60%',
      },
      series: [
        {
          type: 'radar',
          data: profiles.map((p) => ({
            name: p.name,
            value: [p.winRates.pc2 ?? 0, p.winRates.pc3, p.winRates.pc4, p.winRates.pc5],
            areaStyle: { opacity: 0.08 },
            lineStyle: { width: 2 },
            itemStyle: { color: SIM_HEX[p.name] },
            symbol: 'circle',
            symbolSize: 6,
          })),
        },
      ],
      animationDuration: 800,
      animationEasing: 'cubicOut',
    };
  }

  private _buildWinRateLineOption(): Record<string, unknown> {
    const profiles = getSimulationProfiles();
    return {
      tooltip: { trigger: 'axis' },
      legend: { bottom: 0, textStyle: { color: '#94a3b8', fontSize: 10 } },
      grid: { top: 30, right: 20, bottom: 60, left: 50 },
      xAxis: { type: 'category', data: ['2P', '3P', '4P', '5P'], boundaryGap: false },
      yAxis: {
        type: 'value',
        name: 'Win Rate %',
        min: 0,
        max: 70,
        nameTextStyle: { color: '#94a3b8' },
      },
      series: [
        {
          name: 'Fair Rate',
          type: 'line',
          data: [50, 33.3, 25, 20],
          lineStyle: { type: 'dashed', color: '#475569', width: 1.5 },
          symbol: 'diamond',
          symbolSize: 6,
          itemStyle: { color: '#475569' },
          z: 1,
        },
        ...profiles.map((p) => ({
          name: p.name,
          type: 'line' as const,
          data: [p.winRates.pc2 ?? null, p.winRates.pc3, p.winRates.pc4, p.winRates.pc5],
          connectNulls: false,
          symbol: 'circle',
          symbolSize: 8,
          lineStyle: { width: 2.5 },
          itemStyle: { color: SIM_HEX[p.name] ?? '#94a3b8' },
          emphasis: { lineStyle: { width: 4 } },
        })),
      ],
      animationDuration: 1000,
      animationEasing: 'cubicOut',
    };
  }

  private _buildHeatmapOption(): Record<string, unknown> {
    const h2h = getHeadToHeadData();
    const simNames = ['Speranza', 'The Gaslit Reach', 'Velgarien', 'Station Null'];
    const simLabels = ['SP', 'GR', 'V', 'SN'];

    const matrixData: [number, number, number][] = [];
    for (const d of h2h) {
      const row = simNames.indexOf(d.rowSim);
      const col = simNames.indexOf(d.colSim);
      if (row >= 0 && col >= 0) matrixData.push([col, row, d.winRate]);
    }
    for (let i = 0; i < 4; i++) matrixData.push([i, i, 50]);

    return {
      tooltip: {
        formatter: (params: { value: [number, number, number] }) => {
          if (params.value[0] === params.value[1]) return `${simNames[params.value[1]]} (self)`;
          return `${simNames[params.value[1]]} vs ${simNames[params.value[0]]}: ${params.value[2]}%`;
        },
      },
      grid: { top: 10, right: 90, bottom: 40, left: 90 },
      xAxis: {
        type: 'category',
        data: simLabels,
        position: 'top',
        splitArea: {
          show: true,
          areaStyle: { color: ['transparent', 'rgba(30, 41, 59, 0.3)'] },
        },
        axisLabel: { fontWeight: 'bold' },
      },
      yAxis: {
        type: 'category',
        data: simLabels,
        splitArea: {
          show: true,
          areaStyle: { color: ['transparent', 'rgba(30, 41, 59, 0.3)'] },
        },
        axisLabel: { fontWeight: 'bold' },
      },
      visualMap: {
        min: 25,
        max: 75,
        calculable: false,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        inRange: { color: ['#1a3a5c', '#1e293b', '#5c2a1a'] },
        textStyle: { color: '#94a3b8' },
      },
      series: [
        {
          type: 'heatmap',
          data: matrixData,
          label: {
            show: true,
            formatter: (params: { value: [number, number, number] }) =>
              params.value[0] === params.value[1] ? '\u2014' : `${params.value[2]}%`,
            color: '#e2e8f0',
            fontSize: 13,
            fontWeight: 'bold',
          },
          itemStyle: { borderColor: '#0f172a', borderWidth: 2 },
        },
      ],
      animationDuration: 600,
    };
  }

  private _buildStrategyBarOption(): Record<string, unknown> {
    const tiers = getStrategyTiers();
    const tierHex: Record<string, string> = {
      S: '#d4a24e',
      A: '#6bcb77',
      B: '#67e8f9',
      C: '#94a3b8',
      F: '#e74c3c',
    };

    const strategies = tiers.flatMap((t) =>
      t.strategies.map((s) => ({ ...s, color: tierHex[t.tier] ?? '#94a3b8', tier: t.tier })),
    );
    strategies.sort((a, b) => b.winRate - a.winRate);

    const z = 1.96;
    const withCI = strategies.map((s) => {
      const p = s.winRate / 100;
      const n = s.appearances;
      const denom = 1 + (z * z) / n;
      const center = (p + (z * z) / (2 * n)) / denom;
      const margin = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
      return {
        ...s,
        ciLow: Math.max(0, (center - margin) * 100),
        ciHigh: Math.min(100, (center + margin) * 100),
      };
    });

    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { top: 20, right: 20, bottom: 80, left: 50 },
      xAxis: {
        type: 'category',
        data: withCI.map((s) => s.name),
        axisLabel: { rotate: 35, fontSize: 9 },
      },
      yAxis: { type: 'value', name: 'Win %', max: 80, nameTextStyle: { color: '#94a3b8' } },
      series: [
        {
          type: 'bar',
          data: withCI.map((s) => ({
            value: s.winRate,
            itemStyle: { color: s.color, opacity: 0.85 },
          })),
          barWidth: '55%',
        },
        {
          type: 'custom',
          data: withCI.map((s, i) => [i, s.ciLow, s.ciHigh]),
          renderItem: (_params: unknown, api: Record<string, (v: unknown) => unknown>) => {
            const catIdx = api.value(0) as number;
            const low = api.value(1) as number;
            const high = api.value(2) as number;
            const lowPt = api.coord([catIdx, low]) as number[];
            const highPt = api.coord([catIdx, high]) as number[];
            const x = lowPt[0];
            const hw = 5;
            return {
              type: 'group',
              children: [
                {
                  type: 'line',
                  shape: { x1: x, y1: highPt[1], x2: x, y2: lowPt[1] },
                  style: { stroke: '#94a3b8', lineWidth: 1 },
                },
                {
                  type: 'line',
                  shape: { x1: x - hw, y1: highPt[1], x2: x + hw, y2: highPt[1] },
                  style: { stroke: '#94a3b8', lineWidth: 1 },
                },
                {
                  type: 'line',
                  shape: { x1: x - hw, y1: lowPt[1], x2: x + hw, y2: lowPt[1] },
                  style: { stroke: '#94a3b8', lineWidth: 1 },
                },
              ],
            };
          },
          z: 10,
        },
      ],
      animationDuration: 800,
    };
  }

  /* ═══════════════════════════════════════════════════
   *  TAB 4: DEMO RUN
   * ═══════════════════════════════════════════════════ */

  private _renderDemoRun() {
    const steps = getDemoSteps();
    const phases: DemoStep['phase'][] = [
      'lobby',
      'draft',
      'foundation',
      'competition',
      'reckoning',
      'completed',
    ];
    const phaseLabels: Record<string, string> = {
      lobby: msg('Lobby'),
      draft: msg('Draft'),
      foundation: msg('Foundation'),
      competition: msg('Competition'),
      reckoning: msg('Reckoning'),
      completed: msg('Completed'),
    };

    return html`
      <section class="section" id="demo">
        ${this._renderSectionHeader('T-4', msg('Demo Run'))}
        <p class="section__text">
          ${msg(
            'A complete epoch walkthrough from creation to final standings. Follow along to see every phase, decision point, and outcome in a real 2-player match: Velgarien (human) vs. The Gaslit Reach (Strategist bot).',
          )}
        </p>

        <div class="demo-timeline">
          ${phases.map(
            (p) => html`
              <div class="demo-timeline__node demo-timeline__node--${p}">
                <div class="demo-timeline__pip"></div>
                <span class="demo-timeline__label">${phaseLabels[p]}</span>
              </div>
            `,
          )}
          <div class="demo-timeline__track"></div>
        </div>

        <div class="demo-steps">
          ${steps.map((step, i) => this._renderDemoStep(step, i))}
        </div>
      </section>
    `;
  }

  private _renderDemoStep(step: DemoStep, index: number) {
    return html`
      <div class="demo-step" style="--i: ${index}">
        <div class="demo-step__gutter">
          <span class="demo-step__index">${String(index + 1).padStart(2, '0')}</span>
          <span class="demo-step__phase demo-step__phase--${step.phase}">${step.phase}</span>
        </div>

        <div class="demo-step__body">
          <h3 class="demo-step__title">${step.title}</h3>

          ${step.image
            ? html`
                <button
                  class="demo-evidence"
                  @click=${() => this._openLightbox(step.image ?? '', step.imageAlt ?? step.title, step.title)}
                  aria-label=${msg('Enlarge screenshot')}
                >
                  <img
                    class="demo-evidence__img"
                    src=${step.image}
                    alt=${step.imageAlt ?? step.title}
                    loading="lazy"
                    decoding="async"
                  />
                  <span class="demo-evidence__stamp">${msg('EXHIBIT')}</span>
                  <span class="demo-evidence__enlarge">${msg('ENLARGE')}</span>
                </button>
              `
            : nothing}

          <p class="demo-step__narration">${step.narration}</p>

          ${step.detail ? html`<p class="demo-step__detail">${step.detail}</p>` : nothing}

          ${step.readout
            ? html`
                <div class="demo-readout">
                  ${step.readout.map(
                    (r) => html`
                      <div class="demo-readout__cell">
                        <span class="demo-readout__label">${r.label}</span>
                        <span class="demo-readout__value">${r.value}</span>
                      </div>
                    `,
                  )}
                </div>
              `
            : nothing}

          ${step.tip
            ? html`
                <div class="callout callout--tip" style="margin-top: var(--space-3)">
                  <div class="callout__label">${msg('Tactical Tip')}</div>
                  <div class="callout__text">${step.tip}</div>
                </div>
              `
            : nothing}

          ${step.warning
            ? html`
                <div class="callout callout--warn" style="margin-top: var(--space-3)">
                  <div class="callout__label">${msg('Warning')}</div>
                  <div class="callout__text">${step.warning}</div>
                </div>
              `
            : nothing}
        </div>
      </div>
    `;
  }

  /* ═══════════════════════════════════════════════════
   *  TAB 5: UPDATES & CHANGELOG
   * ═══════════════════════════════════════════════════ */

  private _renderUpdates() {
    const entries = getChangelog();
    return html`
      <section class="section" id="updates">
        ${this._renderSectionHeader('T-5', msg('Updates & Changelog'))}
        <p class="section__text">
          ${msg(
            'Balance patches and game mechanic changes are documented here. Each update includes detailed change notes and the reasoning behind adjustments.',
          )}
        </p>

        ${entries.map((entry, i) => this._renderChangelogEntry(entry, i))}
      </section>
    `;
  }

  private _renderChangelogEntry(entry: ChangelogEntry, index: number) {
    const expanded = this._expandedUpdates.has(index);
    return html`
      <div class="match">
        <div
          class="match__header"
          role="button"
          tabindex="0"
          aria-expanded=${expanded}
          @click=${() => this._toggleUpdate(index)}
          @keydown=${(e: KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              this._toggleUpdate(index);
            }
          }}
        >
          <div class="match__title-group">
            <h3 class="match__title">
              <span class="match__meta-tag">${entry.version}</span>
              ${entry.title}
            </h3>
            <span class="match__subtitle">${entry.date}</span>
          </div>
          <span class="match__toggle ${expanded ? 'match__toggle--open' : ''}">\u25BC</span>
        </div>

        ${expanded
          ? html`
              <div class="match__body">
                <ul class="moments-list">
                  ${entry.highlights.map((h) => html`<li>${h}</li>`)}
                </ul>

                ${entry.details.map(
                  (d) => html`
                    <div style="margin-top: var(--space-3)">
                      <div class="standings-label">${d.category}</div>
                      <ul class="moments-list">
                        ${d.changes.map((c) => html`<li>${c}</li>`)}
                      </ul>
                    </div>
                  `,
                )}
              </div>
            `
          : nothing}
      </div>
    `;
  }

  /* ── Helpers ────────────────────────────────────── */

  private _toggleMatch(index: number): void {
    const next = new Set(this._expandedMatches);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    this._expandedMatches = next;
  }

  private _toggleUpdate(index: number): void {
    const next = new Set(this._expandedUpdates);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    this._expandedUpdates = next;
  }

  private _openLightbox(src: string, alt: string, caption: string): void {
    this._lightboxSrc = src;
    this._lightboxAlt = alt;
    this._lightboxCaption = caption;
  }

  private _closeLightbox(): void {
    this._lightboxSrc = null;
    this._lightboxCaption = '';
  }

  private _loadEcharts(): void {
    if (!this._echartsLoaded) {
      import('../shared/EchartsChart.js');
      this._echartsLoaded = true;
    }
  }

  private _setupChartObserver(): void {
    this._chartObserver?.disconnect();
    this._chartObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).dataset.revealed = '';
            this._chartObserver?.unobserve(entry.target);
          }
        }
      },
      { rootMargin: '0px', threshold: 0.05 },
    );
    const charts = this.renderRoot.querySelectorAll('.intel-chart');
    for (const chart of charts) {
      this._chartObserver.observe(chart);
    }
  }

  private _handleNavClick(e: MouseEvent): void {
    e.preventDefault();
    const href = (e.currentTarget as HTMLAnchorElement).getAttribute('href');
    if (href) {
      this.dispatchEvent(
        new CustomEvent('navigate', { detail: href, bubbles: true, composed: true }),
      );
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-how-to-play-war-room': HowToPlayWarRoom;
  }
}

/**
 * How to Play — Classified Operations Manual
 *
 * Full-page tutorial/rulebook for the Epochs competitive layer.
 * Dark military-console aesthetic: scan-line textures, terminal readouts,
 * brutalist headings, monospace data tables. Feels like a declassified
 * tactical briefing, not a help page.
 *
 * Sticky sidebar TOC with scroll-spy. Expandable match replays.
 * Fully responsive — sidebar collapses to horizontal strip on mobile.
 */

import { localized, msg, str } from '@lit/localize';
import { html, LitElement, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { analyticsService } from '../../services/AnalyticsService.js';
import { seoService } from '../../services/SeoService.js';
import '../shared/EchartsChart.js';
import { getMatches } from './htp-content-matches.js';
import {
  getBalanceInsights,
  getBleedThresholdRules,
  getBleedVectors,
  getChangelog,
  getDimensionVariance,
  getEchoLifecycle,
  getEchoStrengthFormula,
  getEloRatings,
  getEmbassyInfo,
  getHeadToHeadData,
  getNormalizationRules,
  getOperativeCards,
  getPhases,
  getRpRules,
  getScoreDimensions,
  getScorePresets,
  getSimulationProfiles,
  getStrategyTiers,
  getSuccessFormula,
  getTactics,
  getTocSections,
} from './htp-content-rules.js';
import { htpStyles } from './htp-styles.js';
import type {
  BleedVector,
  ChangelogEntry,
  CycleData,
  FinalStanding,
  MatchConfig,
  OperativeCard,
  SimulationProfile,
  StrategyTier,
  TacticCard,
  TocSection,
} from './htp-types.js';

@localized()
@customElement('velg-how-to-play')
export class VelgHowToPlay extends LitElement {
  /* ── Styles ─────────────────────────────────────────── */

  static styles = [htpStyles];

  /* ── State ──────────────────────────────────────── */

  @state() private _activeSection = 'epochs';
  @state() private _expandedMatches = new Set<number>();
  @state() private _expandedUpdates = new Set<number>();

  private _observer: IntersectionObserver | null = null;
  private _chartObserver: IntersectionObserver | null = null;

  /* ── Lifecycle ──────────────────────────────────── */

  connectedCallback() {
    super.connectedCallback();
    seoService.setTitle([msg('How to Play')]);
    seoService.setDescription(
      msg(
        'Learn how Epochs work: competitive PvP, operatives, scoring dimensions, alliances, and bleed mechanics.',
      ),
    );
    analyticsService.trackPageView('/how-to-play', 'How to Play');
    this._injectFaqSchema();
    this.updateComplete.then(() => {
      this._setupScrollSpy();
      this._setupChartObserver();
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._observer?.disconnect();
    this._chartObserver?.disconnect();
    seoService.removeStructuredData();
  }

  private _injectFaqSchema() {
    seoService.setStructuredData({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'What is an Epoch in metaverse.center?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'An Epoch is a competitive PvP match where simulation owners deploy operatives, form alliances, and compete across five scoring dimensions: stability, influence, sovereignty, diplomatic, and military.',
          },
        },
        {
          '@type': 'Question',
          name: 'How does scoring work in Epochs?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Scores are computed each cycle across five dimensions derived from your simulation health, zone stability, building readiness, embassy effectiveness, and military operations. The composite score determines your final ranking.',
          },
        },
        {
          '@type': 'Question',
          name: 'What are operatives and how do I deploy them?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Operatives are agents you deploy against rival simulations. There are six types: Spy (intelligence), Saboteur (building damage), Propagandist (event creation), Assassin (ambassador blocking), Guardian (defense), and Infiltrator (embassy weakening). Each costs Resource Points (RP) to deploy.',
          },
        },
        {
          '@type': 'Question',
          name: 'Can I form alliances with other players?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. Teams can be formed during an Epoch for shared diplomatic bonuses. However, betrayal is possible — attacking an ally dissolves the alliance and may incur score penalties if detected.',
          },
        },
        {
          '@type': 'Question',
          name: 'What is the Bleed mechanic?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Bleed is the cross-simulation echo system. High-impact events can "bleed" through connections to other simulations, creating transformed echoes. Embassies and connection strength amplify bleed probability.',
          },
        },
        {
          '@type': 'Question',
          name: 'How are game instances created for Epochs?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'When an Epoch starts, each participating template simulation is cloned into a balanced game instance with normalized agent counts, building conditions, and security levels. Templates remain untouched.',
          },
        },
        {
          '@type': 'Question',
          name: 'What changed in the latest balance update?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Version 2.1 adds real game state effects to all 6 operative types: spies reveal target intel (zone security + guardian count), saboteurs downgrade zone security tiers, and guardians were rebalanced from -10%/guardian (cap 25%) to -8%/guardian (cap 20%). Scoring dimensions were activated: stability reacts to sabotage and assassination, influence rewards propaganda and espionage more, and diplomatic bonuses from alliances increased to +15%.',
          },
        },
        {
          '@type': 'Question',
          name: 'How are game instances balanced for fair competition?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Game instances are normalized when an epoch starts: agents capped at 6, buildings at 8, all conditions set to good, capacities to 30, qualifications to 5, and zone security distributed as 1x high, 2x medium, 1x low. Embassies are auto-generated between all participants. This ensures every simulation starts on equal footing.',
          },
        },
      ],
    });
  }

  private _setupScrollSpy() {
    const sections = this.renderRoot.querySelectorAll('.section[id]');
    if (!sections.length) return;

    this._observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this._activeSection = entry.target.id;
          }
        }
      },
      { rootMargin: '-20% 0px -70% 0px' },
    );

    for (const section of sections) {
      this._observer.observe(section);
    }
  }

  private _scrollToSection(id: string) {
    const el = (this.renderRoot as ShadowRoot).getElementById(id);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  private _toggleMatch(index: number) {
    const next = new Set(this._expandedMatches);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    this._expandedMatches = next;
  }

  private _toggleUpdate(index: number) {
    const next = new Set(this._expandedUpdates);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    this._expandedUpdates = next;
  }

  /* ── Render ─────────────────────────────────────── */

  protected render() {
    const toc = getTocSections();

    return html`
      ${this._renderHero()}

      <div class="layout">
        ${this._renderToc(toc)}

        <main class="content">
          ${this._renderEpochs()}
          ${this._renderGettingStarted()}
          ${this._renderPhases()}
          ${this._renderRp()}
          ${this._renderOperatives()}
          ${this._renderEmbassies()}
          ${this._renderScoring()}
          ${this._renderAlliances()}
          ${this._renderBleed()}
          ${this._renderTactics()}
          ${this._renderMatches()}
          ${this._renderUpdates()}
          ${this._renderAnalytics()}
        </main>
      </div>
    `;
  }

  /* ── Hero ────────────────────────────────────────── */

  private _renderHero() {
    return html`
      <div class="hero">
        <div class="hero__scanlines"></div>
        <div class="hero__inner">
          <div class="hero__classification">${msg('Eyes Only')}</div>
          <h1 class="hero__title">${msg('How to Play')}</h1>
          <p class="hero__sub">${msg('Classified Operations Manual')}</p>
          <div class="hero__line"></div>
        </div>
      </div>
    `;
  }

  /* ── TOC ─────────────────────────────────────────── */

  private _renderToc(sections: TocSection[]) {
    return html`
      <nav class="toc">
        <div class="toc__label">${msg('Contents')}</div>
        <ul class="toc__list">
          ${sections.map(
            (s) => html`
              <li>
                <a
                  class="toc__link ${this._activeSection === s.id ? 'toc__link--active' : ''}"
                  @click=${() => this._scrollToSection(s.id)}
                >${s.label}</a>
              </li>
            `,
          )}
        </ul>
      </nav>
    `;
  }

  /* ── Section 1: Epochs ───────────────────────────── */

  private _renderSectionHeader(num: string, title: string) {
    return html`
      <div class="section__divider">
        <span class="section__number">${num}</span>
        <div class="section__rule"></div>
      </div>
      <h2 class="section__title">${title}</h2>
    `;
  }

  private _renderEpochs() {
    return html`
      <section class="section" id="epochs">
        ${this._renderSectionHeader('01', msg('What is an Epoch?'))}
        <p class="section__text">
          ${msg('An Epoch is a competitive season where simulations battle across five dimensions: Stability, Influence, Sovereignty, Diplomatic, and Military. Each epoch is time-limited, divided into phases, and scored in real time. Deploy operatives, forge alliances, sabotage rivals, and climb the leaderboard. Anyone can spectate; only participants can act.')}
        </p>

        <div class="callout callout--info">
          <div class="callout__label">${msg('Game Instances')}</div>
          <div class="callout__text">
            ${msg('When an epoch starts, every participating simulation is cloned into a balanced "game instance." Your original simulation (the template) is never modified. All gameplay happens on the clone. When the epoch ends, game instances are archived and your template remains intact.')}
          </div>
        </div>
      </section>
    `;
  }

  /* ── Section 2: Getting Started ──────────────────── */

  private _renderGettingStarted() {
    const rules = getNormalizationRules();
    return html`
      <section class="section" id="getting-started">
        ${this._renderSectionHeader('02', msg('Getting Started'))}
        <p class="section__text">
          ${msg('Any simulation owner can create an epoch. Other players join by accepting an invitation or entering the lobby before it closes.')}
        </p>

        <div class="callout callout--tip">
          <div class="callout__label">${msg('Creating an Epoch')}</div>
          <div class="callout__text">
            ${msg('Open the Epoch Command Center from your simulation, choose a scoring preset, set the cycle duration, and launch. You can invite players via email \u2014 each invitation includes a lore-flavored dossier generated by AI.')}
          </div>
        </div>

        <div class="callout callout--info">
          <div class="callout__label">${msg('Joining an Epoch')}</div>
          <div class="callout__text">
            ${msg('Accept an email invitation (click the link in the dossier) or navigate to an open epoch in the lobby phase and click Join. You select which simulation to enter with.')}
          </div>
        </div>

        <p class="section__text" style="margin-top: var(--space-4)">
          ${msg('To ensure fair competition, all simulations are normalized when the epoch starts:')}
        </p>

        <div class="readout">
          ${rules.map(
            (r) => html`
              <div class="readout__cell">
                <span class="readout__label">${r.attribute}</span>
                <span class="readout__value">${r.normalizedTo}</span>
              </div>
            `,
          )}
        </div>

        <div class="callout callout--warn">
          <div class="callout__label">${msg('Equal Footing')}</div>
          <div class="callout__text">
            ${msg('Normalization means a brand-new simulation has the same competitive potential as a fully developed one. Strategy and timing matter more than preparation.')}
          </div>
        </div>
      </section>
    `;
  }

  /* ── Section 3: Phases ───────────────────────────── */

  private _renderPhases() {
    const phases = getPhases();
    return html`
      <section class="section" id="phases">
        ${this._renderSectionHeader('03', msg('Phases & Timeline'))}
        <p class="section__text">
          ${msg('Every epoch progresses through 5 phases. Each phase changes what actions are available and how scores are calculated.')}
        </p>
        <div class="phases">
          ${phases.map(
            (p, i) => html`
              <div class="phase">
                <div class="phase__dot-row">
                  <div class="phase__track ${i === 0 ? 'phase__track--hidden' : ''}"></div>
                  <div class="phase__dot" style="border-color: ${p.color}; background: ${p.color}"></div>
                  <div class="phase__track ${i === phases.length - 1 ? 'phase__track--hidden' : ''}"></div>
                </div>
                <span class="phase__name" style="color: ${p.color}">${p.name}</span>
                <span class="phase__desc">${p.description}</span>
              </div>
            `,
          )}
        </div>
      </section>
    `;
  }

  /* ── Section 4: Resonance Points ─────────────────── */

  private _renderRp() {
    const rules = getRpRules();
    return html`
      <section class="section" id="rp">
        ${this._renderSectionHeader('04', msg('Resonance Points (RP)'))}
        <p class="section__text">
          ${msg('RP is your action economy. Every cycle, each participant receives RP to spend on deploying operatives or running counter-intelligence sweeps. Unspent RP carries over, capped at 30.')}
        </p>
        <div class="readout">
          ${rules.map(
            (r) => html`
              <div class="readout__cell">
                <span class="readout__label">${r.label}</span>
                <span class="readout__value">${r.value}</span>
              </div>
            `,
          )}
        </div>
      </section>
    `;
  }

  /* ── Section 5: Operatives ───────────────────────── */

  private _renderOperatives() {
    const ops = getOperativeCards();
    return html`
      <section class="section" id="operatives">
        ${this._renderSectionHeader('05', msg('Operatives'))}
        <p class="section__text">
          ${msg('Six operative types, each with different costs, timings, and effects. Choose wisely — RP is scarce.')}
        </p>

        <div class="ops-grid">
          ${ops.map((op, i) => this._renderOpCard(op, i))}
        </div>

        <div class="callout callout--info">
          <div class="callout__label">${msg('Success Probability')}</div>
          <div class="callout__text">${msg('Every mission is resolved with a probability roll:')}</div>
          <div class="formula">${getSuccessFormula()}</div>
          <div class="callout__text">${msg('Clamped to [0.05, 0.95]. Guardians reduce success by 8% each (max \u221220%). Embassy infiltration reduces effectiveness by 50%.')}</div>
        </div>

        <div class="callout callout--danger">
          <div class="callout__label">${msg('Mission Outcomes')}</div>
          <div class="callout__text">
            ${msg('Three possible outcomes: Success \u2014 the mission completes and its effect is applied. Failed \u2014 the mission fails silently, no penalty. Detected \u2014 the mission fails AND you lose 3 military score. Detection is rolled separately: if the success roll fails AND a second roll also fails, the operative is caught.')}
          </div>
        </div>
      </section>
    `;
  }

  private _renderOpCard(op: OperativeCard, index: number) {
    return html`
      <div class="op-card" style="border-left-color: ${op.color}; --i: ${index}">
        <div class="op-card__header">
          <span class="op-card__name">${op.type}</span>
          <span class="op-card__cost" style="color: ${op.color}">
            ${op.rpCost}<span class="op-card__cost-label">RP</span>
          </span>
        </div>

        <div class="op-card__stats">
          <div class="op-card__stat">
            <span class="op-card__stat-label">${msg('Deploy')}</span>
            <span class="op-card__stat-value">${op.deployCycles === 0 ? msg('Instant') : msg(str`${op.deployCycles} cycle`)}</span>
          </div>
          <div class="op-card__stat">
            <span class="op-card__stat-label">${msg('Duration')}</span>
            <span class="op-card__stat-value">${op.missionCycles === 0 ? msg('Permanent') : msg(str`${op.missionCycles} cycles`)}</span>
          </div>
          <div class="op-card__stat">
            <span class="op-card__stat-label">${msg('Score')}</span>
            <span class="op-card__stat-value">+${op.scoreValue}</span>
          </div>
        </div>

        <div class="op-card__desc">${op.description}</div>
        <div class="op-card__effect">${op.effect}</div>
      </div>
    `;
  }

  /* ── Section 6: Embassies ───────────────────────── */

  private _renderEmbassies() {
    const info = getEmbassyInfo();
    return html`
      <section class="section" id="embassies">
        ${this._renderSectionHeader('06', msg('Embassies & Ambassadors'))}
        <p class="section__text">
          ${msg('Embassies are diplomatic buildings that connect two simulations. They serve as deployment channels for operatives, boost diplomatic scoring, and increase bleed echo strength. Every embassy has an ambassador \u2014 a designated agent who represents your simulation abroad.')}
        </p>

        <div class="readout">
          ${info.map(
            (r) => html`
              <div class="readout__cell">
                <span class="readout__label">${r.label}</span>
                <span class="readout__value">${r.value}</span>
              </div>
            `,
          )}
        </div>

        <div class="callout callout--tip">
          <div class="callout__label">${msg('Ambassador Role')}</div>
          <div class="callout__text">
            ${msg('Ambassadors are high-value targets. An assassin can block ambassador status for 3 cycles, crippling your embassy effectiveness. An infiltrator reduces embassy effectiveness by 50% for 3 cycles. Protect your ambassadors with guardians in embassy zones.')}
          </div>
        </div>

        <div class="callout callout--warn">
          <div class="callout__label">${msg('Embassy Defense')}</div>
          <div class="callout__text">
            ${msg('Embassy effectiveness directly feeds into the operative success formula (+embassy_eff \u00D7 0.15) and the diplomatic score dimension (sum(eff) \u00D7 10). Losing embassy effectiveness hurts both your offense and your score.')}
          </div>
        </div>
      </section>
    `;
  }

  /* ── Section 7: Scoring ──────────────────────────── */

  private _renderScoring() {
    const presets = getScorePresets();
    const scoreDims = getScoreDimensions();
    const dims: { name: string; color: string; key: string }[] = [
      { name: msg('Stability'), color: 'var(--color-success)', key: 'stability' },
      { name: msg('Influence'), color: 'var(--color-epoch-influence)', key: 'influence' },
      { name: msg('Sovereignty'), color: 'var(--color-info)', key: 'sovereignty' },
      { name: msg('Diplomatic'), color: 'var(--color-warning)', key: 'diplomatic' },
      { name: msg('Military'), color: 'var(--color-danger)', key: 'military' },
    ];
    const balanced = presets[0]?.weights || {};

    return html`
      <section class="section" id="scoring">
        ${this._renderSectionHeader('07', msg('Scoring System'))}
        <p class="section__text">
          ${msg('Scores are computed across 5 dimensions, normalized against other participants, then weighted by the epoch preset to produce a composite score. Highest composite wins.')}
        </p>

        <div class="dim-bars">
          ${dims.map(
            (d) => html`
              <div class="dim-row">
                <span class="dim-row__label" style="color: ${d.color}">${d.name}</span>
                <div class="dim-row__bar">
                  <div class="dim-row__fill" style="background: ${d.color}; --w: ${(balanced[d.key] || 20) / 40}"></div>
                </div>
                <span class="dim-row__value">${balanced[d.key] || 20}%</span>
              </div>
            `,
          )}
        </div>

        <table class="presets-table">
          <thead>
            <tr>
              <th>${msg('Preset')}</th>
              <th>${msg('Stab')}</th>
              <th>${msg('Infl')}</th>
              <th>${msg('Sovr')}</th>
              <th>${msg('Dipl')}</th>
              <th>${msg('Milt')}</th>
            </tr>
          </thead>
          <tbody>
            ${presets.map(
              (p) => html`
                <tr>
                  <td>${p.name}</td>
                  <td>${p.weights.stability}%</td>
                  <td>${p.weights.influence}%</td>
                  <td>${p.weights.sovereignty}%</td>
                  <td>${p.weights.diplomatic}%</td>
                  <td>${p.weights.military}%</td>
                </tr>
              `,
            )}
          </tbody>
        </table>

        ${scoreDims.map(
          (d) => html`
            <div class="dim-block" style="border-left-color: ${d.color}">
              <div class="dim-block__header">
                <span class="dim-block__name">${d.name}</span>
                <span class="dim-title" style="color: ${d.color}; border-color: ${d.color}">${d.title}</span>
              </div>
              <div class="dim-block__formula">${d.formula}</div>
              <div class="dim-block__explanation">${d.explanation}</div>
            </div>
          `,
        )}

        <div class="callout callout--tip">
          <div class="callout__label">${msg('Dimension Titles')}</div>
          <div class="callout__text">
            ${msg('The winner of each dimension receives a title displayed on the leaderboard. Score highest in Stability to earn "The Unshaken," dominate Influence for "The Resonant," and so on. Titles persist after the epoch ends.')}
          </div>
        </div>
      </section>
    `;
  }

  /* ── Section 8: Alliances ────────────────────────── */

  private _renderAlliances() {
    return html`
      <section class="section" id="alliances">
        ${this._renderSectionHeader('08', msg('Alliances & Diplomacy'))}
        <p class="section__text">
          ${msg('Form teams with other simulations. Allies share no direct resources, but gain diplomatic scoring bonuses and can coordinate strikes. Embassies serve as deployment channels for operatives.')}
        </p>

        <div class="callout callout--tip">
          <div class="callout__label">${msg('Alliance Bonus')}</div>
          <div class="callout__text">
            ${msg('Each active ally gives +15% to your diplomatic score. A 3-member alliance means each member gets +30% diplomatic.')}
          </div>
        </div>

        <div class="callout callout--danger">
          <div class="callout__label">${msg('Betrayal')}</div>
          <div class="callout__text">
            ${msg('If allow_betrayal is enabled, allied simulations can attack each other. But beware: if a betrayal mission is detected, the entire alliance dissolves and the betrayer receives a \u221225% diplomatic score penalty. With the Diplomat preset (35% diplomatic weight), this is catastrophic.')}
          </div>
        </div>
      </section>
    `;
  }

  /* ── Section 9: Bleed ────────────────────────────── */

  private _renderBleed() {
    const vectors = getBleedVectors();
    const thresholdRules = getBleedThresholdRules();
    const lifecycle = getEchoLifecycle();
    return html`
      <section class="section" id="bleed">
        ${this._renderSectionHeader('09', msg('Bleed & Echoes'))}
        <p class="section__text">
          ${msg('The Bleed is the cross-simulation influence that connects the multiverse. When an event occurs in one simulation, it may "bleed" into connected simulations as an echo \u2014 a weaker copy that carries thematic resonance. Bleed is the engine that drives the Influence and Sovereignty dimensions.')}
        </p>

        <p class="section__text" style="margin-top: var(--space-3)">
          ${msg('Every echo travels through one of seven vectors. The vector determines which event tags resonate, amplifying or dampening the echo strength.')}
        </p>

        <div class="vector-grid">
          ${vectors.map((v, i) => this._renderVectorCard(v, i))}
        </div>

        <div class="callout callout--info">
          <div class="callout__label">${msg('Echo Strength Formula')}</div>
          <div class="callout__text">${msg("Each echo's strength is calculated as:")}</div>
          <div class="formula">${getEchoStrengthFormula()}</div>
          <div class="callout__text">
            ${msg('Embassy effectiveness boosts echo strength by up to 30%. Each matching tag adds 20% (max 3 tags). Cascaded echoes weaken exponentially via the decay factor. Unstable source zones bleed louder.')}
          </div>
        </div>

        <p class="section__text" style="margin-top: var(--space-4)">
          ${msg("Not every event triggers a bleed. The event's impact level must meet or exceed the modified threshold:")}
        </p>

        <div class="readout">
          ${thresholdRules.map(
            (r) => html`
              <div class="readout__cell">
                <span class="readout__label">${r.label}</span>
                <span class="readout__value">${r.value}</span>
              </div>
            `,
          )}
        </div>

        <p class="section__text" style="margin-top: var(--space-4)">
          ${msg('Echoes follow a lifecycle from creation to resolution:')}
        </p>

        <div class="lifecycle">
          ${lifecycle.map(
            (step, i) => html`
              ${i > 0 ? html`<span class="lifecycle__arrow">\u25B8</span>` : nothing}
              <div class="lifecycle__step">
                <div class="lifecycle__dot" style="background: ${step.color}"></div>
                <span class="lifecycle__name" style="color: ${step.color}">${step.name}</span>
              </div>
            `,
          )}
        </div>

        <div class="callout callout--danger">
          <div class="callout__label">${msg('Cascade Depth')}</div>
          <div class="callout__text">
            ${msg('An echo can itself trigger further bleeds in other simulations \u2014 a cascade. Default max depth is 2. Each cascade level multiplies by the decay factor (default 0.6), so a depth-2 echo has only 36% of the original strength. During Reckoning, max depth increases by 1.')}
          </div>
        </div>

        <div class="callout callout--warn">
          <div class="callout__label">${msg('Reckoning Amplification')}</div>
          <div class="callout__text">
            ${msg("During the Reckoning phase, the bleed threshold drops by 2 and cascade depth increases by 1. Events that wouldn't bleed during Competition suddenly punch through. Sovereignty scores can shift dramatically in the final cycles.")}
          </div>
        </div>

        <div class="callout callout--tip">
          <div class="callout__label">${msg('Sovereignty Impact')}</div>
          <div class="callout__text">
            ${msg('Your sovereignty score is 100 \u00D7 (1 \u2212 bleed_impact / total_impact). Every incoming echo and propagandist event erodes your sovereignty. Defend against bleed by maintaining stable zones (reduces target instability bonus) and protecting your embassies (reduces echo strength multiplier).')}
          </div>
        </div>
      </section>
    `;
  }

  private _renderVectorCard(vector: BleedVector, index: number) {
    return html`
      <div class="vector-card" style="border-left-color: ${vector.color}; --i: ${index}">
        <span class="vector-card__name" style="color: ${vector.color}">${vector.name}</span>
        <div class="vector-card__desc">${vector.description}</div>
        <div class="vector-tags">
          ${vector.tags.map((t) => html`<span class="vector-tag">${t}</span>`)}
        </div>
      </div>
    `;
  }

  /* ── Section 10: Tactics ─────────────────────────── */

  private _renderTactics() {
    const tactics = getTactics();
    return html`
      <section class="section" id="tactics">
        ${this._renderSectionHeader('10', msg('Tactics & Strategies'))}
        <p class="section__text">
          ${msg('Proven strategies for each phase, economy management, counter-play patterns, and preset-specific approaches. Study these before your first deployment.')}
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

  /* ── Section 11: Matches ─────────────────────────── */

  private _renderMatches() {
    const matches = getMatches();
    return html`
      <section class="section" id="matches">
        ${this._renderSectionHeader('11', msg('Example Matches'))}
        <p class="section__text">
          ${msg('Five fully worked-out matches showing different strategies, presets, and mechanics in action. Expand each match to see cycle-by-cycle replays.')}
        </p>

        ${matches.map((m, i) => this._renderMatch(m, i))}
      </section>
    `;
  }

  private _renderMatch(match: MatchConfig, index: number) {
    const expanded = this._expandedMatches.has(index);

    return html`
      <div class="match">
        <div class="match__header"
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
          <span class="match__toggle ${expanded ? 'match__toggle--open' : ''}">▼</span>
        </div>

        ${expanded ? this._renderMatchBody(match) : nothing}
      </div>
    `;
  }

  private _renderMatchBody(match: MatchConfig) {
    return html`
      <div class="match__body">
        <div class="match__desc">${match.description}</div>

        ${
          match.specialRules
            ? html`<div class="callout callout--warn">
              <div class="callout__label">${msg('Special Rules')}</div>
              <div class="callout__text">${match.specialRules}</div>
            </div>`
            : nothing
        }

        <div class="match__players">
          ${match.players.map((p) => html`<span class="match__player">${p}</span>`)}
        </div>

        ${this._renderCycleTable(match.cycleData)}
        ${this._renderStandings(match.finalStandings)}
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
          <td colspan="4" style="color: var(--color-gray-500); font-style: italic;">
            ${
              cycle.scoreSnapshot
                ? html`${msg('Final scores')}: ${Object.entries(cycle.scoreSnapshot)
                    .map(([name, score]) => html`<strong>${name}</strong>: ${score} `)
                    .join('')}`
                : msg('No actions')
            }
          </td>
        </tr>
      `,
      ];
    }

    return cycle.actions.map(
      (a, i) => html`
        <tr>
          <td>${i === 0 ? cycle.cycle : ''}</td>
          <td>${i === 0 ? html`<span class="cycle-phase cycle-phase--${cycle.phase}">${cycle.phase}</span>` : ''}</td>
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
                      ${s.title ? html`<br><span class="standings-title">"${s.title}"</span>` : nothing}
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

  /* -- Section 12: Updates & Changelog -------------- */

  private _renderUpdates() {
    const entries = getChangelog();
    return html`
      <section class="section" id="updates">
        ${this._renderSectionHeader('12', msg('Updates & Changelog'))}
        <p class="section__text">
          ${msg('Balance patches and game mechanic changes are documented here. Each update includes detailed change notes and the reasoning behind adjustments.')}
        </p>

        ${entries.map((entry, i) => this._renderChangelogEntry(entry, i))}
      </section>
    `;
  }

  private _renderChangelogEntry(entry: ChangelogEntry, index: number) {
    const expanded = this._expandedUpdates.has(index);
    return html`
      <div class="match">
        <div class="match__header"
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
          <span class="match__toggle ${expanded ? 'match__toggle--open' : ''}">&#x25BC;</span>
        </div>

        ${
          expanded
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
            : nothing
        }
      </div>
    `;
  }
  /* ── Section 13: Intelligence Report ─────────────── */

  private _renderAnalytics() {
    const elo = getEloRatings();
    const profiles = getSimulationProfiles();
    const tiers = getStrategyTiers();
    const dims = getDimensionVariance();
    const insights = getBalanceInsights();

    return html`
      <section class="section" id="analytics">
        ${this._renderSectionHeader('13', msg('Intelligence Report'))}
        <p class="section__text">
          ${msg('Compiled from 200 simulated epoch games (50 per player count, 2P through 5P) using v2.1 balance tuning. All data drawn from automated Monte Carlo simulation against the live game engine. 188 games produced valid results (12 empty leaderboards excluded).')}
        </p>

        <div class="callout callout--info" style="margin-bottom: var(--space-8)">
          <div class="callout__label">${msg('Methodology')}</div>
          <div class="callout__text">
            ${msg('Each game randomizes scoring preset weights, strategy assignments, and player pairings. Elo ratings use K-factor scaling for multi-player games. Statistical significance tested via chi-squared, Fisher exact, and bootstrap confidence intervals (10,000 iterations).')}
          </div>
        </div>

        <!-- Elo Power Rankings -->
        <div class="analytics-sub">
          <h3 class="analytics-sub__title">${msg('Elo Power Rankings')}</h3>
          <p class="analytics-sub__desc">
            ${msg('Elo ratings computed from all 188 valid games. Multi-player games decomposed into pairwise matchups (winner beats each loser). All ratings start at 1500.')}
          </p>
          <div class="elo-chart">
            ${elo.map(
              (e) => html`
                <div class="elo-row">
                  <span class="elo-row__label" style="color: ${e.color}">${e.simulation}</span>
                  <div class="elo-row__track">
                    <div class="elo-row__fill" style="background: ${e.color}; --w: ${(e.rating - 1400) / 180}"></div>
                  </div>
                  <span class="elo-row__value">${e.rating}</span>
                  <span class="elo-row__delta ${e.delta >= 0 ? 'elo-row__delta--up' : 'elo-row__delta--down'}">
                    ${e.delta >= 0 ? '+' : ''}${e.delta}
                  </span>
                </div>
              `,
            )}
          </div>
        </div>

        ${this._renderIntelChart('CLASSIFIED', msg('Simulation Performance Radar'), 'SIGINT-4', this._buildRadarOption(), '350px')}

        <!-- Simulation Dossiers -->
        <div class="analytics-sub">
          <h3 class="analytics-sub__title">${msg('Simulation Dossiers')}</h3>
          <p class="analytics-sub__desc">
            ${msg('Win rates per player count, 95% bootstrap confidence intervals, and competitive profile for each simulation. Theoretical fair rates: 50% (2P), 33% (3P), 25% (4P), 20% (5P).')}
          </p>
          <div class="profile-grid">
            ${profiles.map((p, i) => this._renderProfileCard(p, i))}
          </div>
        </div>

        ${this._renderIntelChart('CLASSIFIED', msg('Win Rate Evolution by Player Count'), 'HUMINT-3', this._buildWinRateLineOption(), '320px')}
        ${this._renderIntelChart('RESTRICTED', msg('Head-to-Head Matrix (2P Duels)'), 'COMINT-2', this._buildHeatmapOption(), '350px')}

        <!-- Strategy Tier List -->
        <div class="analytics-sub">
          <h3 class="analytics-sub__title">${msg('Strategy Tier List')}</h3>
          <p class="analytics-sub__desc">
            ${msg('Win rates with Wilson score 95% confidence intervals. Ordered by observed effectiveness across all player counts and presets.')}
          </p>
          <div class="strat-tiers">
            ${tiers.map((t) => this._renderStratTier(t))}
          </div>
        </div>

        ${this._renderIntelChart('TOP SECRET', msg('Strategy Effectiveness (Wilson 95% CI)'), 'MASINT-5', this._buildStrategyBarOption(), '320px')}

        <!-- Dimension Impact -->
        <div class="analytics-sub">
          <h3 class="analytics-sub__title">${msg('Scoring Dimension Impact')}</h3>
          <p class="analytics-sub__desc">
            ${msg('Standard deviation measures how much each scoring dimension differentiates between players within a game. Higher variance = more decisive. All five dimensions are now active in v2.1 (up from only 2 in v2).')}
          </p>
          <div class="impact-chart">
            ${dims.map(
              (d) => html`
                <div class="impact-row">
                  <span class="impact-row__label" style="color: ${d.color}">${d.name}</span>
                  <div class="impact-row__track">
                    <div class="impact-row__fill" style="background: ${d.color}; --w: ${d.stdDev / d.maxStd}"></div>
                  </div>
                  <span class="impact-row__std">\u03C3 ${d.stdDev}</span>
                  <span class="impact-row__status" style="color: ${d.color}; border-color: ${d.color}">${d.status}</span>
                </div>
              `,
            )}
          </div>
        </div>

        <!-- Statistical Verdict -->
        <div class="analytics-sub">
          <h3 class="analytics-sub__title">${msg('Statistical Verdict')}</h3>
          <p class="analytics-sub__desc">
            ${msg('Key findings from chi-squared tests, bootstrap analysis, and game-theoretic Nash equilibrium computation.')}
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
            ${msg('All analytics data reflects v2.1 baseline (188 valid games from 200 simulated). The v2.2 balance changes above are informed by this analysis. Future simulation runs will validate v2.2 impact.')}
          </div>
        </div>

        <div class="callout callout--warn">
          <div class="callout__label">${msg('v2.2 Balance Changes Applied')}</div>
          <div class="callout__text">
            ${msg('The ci_defensive dominance (64% win rate) and dead infiltrator (1.9%) identified above have been addressed in v2.2: guardian penalty reduced to 6%/15% cap, guardian cost raised to 4 RP, counter-intel to 4 RP, infiltrator buffed (65% reduction, 5 RP, +3 influence), RP economy expanded to 12/cycle and 40 cap. See the Updates section for full changelog.')}
          </div>
        </div>

        <div class="callout callout--tip">
          <div class="callout__label">${msg('What This Means For Players')}</div>
          <div class="callout__text">
            ${msg('All simulations are competitively viable. Choose any simulation \u2014 your skill and strategy matter more than your faction. With v2.2, offensive and hybrid strategies should be more viable alongside defensive play. The expanded RP economy enables multi-pronged approaches.')}
          </div>
        </div>
      </section>
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
          <span class="profile-card__tag" style="color: ${profile.color}; border-color: ${profile.color}">${profile.tag}</span>
          <span class="profile-card__name">${profile.name}</span>
          <span class="profile-card__elo">${profile.eloRating}</span>
        </div>
        <div class="profile-card__body">
          <div class="profile-card__rates">
            ${rates.map(
              (r) => html`
                <div class="profile-card__rate">
                  <span class="profile-card__rate-label">${r.label}</span>
                  <span class="profile-card__rate-value ${r.value == null ? 'profile-card__rate-value--na' : ''}"
                    style="${r.value != null ? `color: ${profile.color}` : ''}">
                    ${r.value != null ? `${r.value}%` : 'N/A'}
                  </span>
                </div>
              `,
            )}
          </div>
          <div class="profile-card__ci">
            <span class="profile-card__ci-label">95% CI</span>
            <div class="profile-card__ci-track">
              <div class="profile-card__ci-fill" style="background: ${profile.color}; left: ${profile.ciLow}%; right: ${100 - profile.ciHigh}%"></div>
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
        <div class="strat-tier__badge" style="color: ${tier.tierColor}; border-color: ${tier.tierColor}">${tier.tier}</div>
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
                  <div class="strat-entry__fill" style="background: ${tier.tierColor}; --w: ${s.winRate / 100}"></div>
                </div>
                <div class="strat-entry__desc">${s.description}</div>
              </div>
            `,
          )}
        </div>
      </div>
    `;
  }

  /* ── ECharts: Observer + Option Builders ────────── */

  private _setupChartObserver(): void {
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
        <velg-echarts-chart .option=${option} height=${height}></velg-echarts-chart>
      </div>
    `;
  }

  /** Radar: simulation win-rate profiles across player counts. */
  private _buildRadarOption(): Record<string, unknown> {
    const profiles = getSimulationProfiles();
    const SIM_HEX: Record<string, string> = {
      Speranza: '#d4a24e',
      'Capybara Kingdom': '#6bcb77',
      Velgarien: '#e74c3c',
      'Nova Meridian': '#a78bfa',
      'Station Null': '#67e8f9',
    };
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

  /** Line chart: win rate by player count with dashed fair-rate reference. */
  private _buildWinRateLineOption(): Record<string, unknown> {
    const profiles = getSimulationProfiles();
    const SIM_HEX: Record<string, string> = {
      Speranza: '#d4a24e',
      'Capybara Kingdom': '#6bcb77',
      Velgarien: '#e74c3c',
      'Nova Meridian': '#a78bfa',
      'Station Null': '#67e8f9',
    };
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

  /** Heatmap: 2P head-to-head pairwise win rates. */
  private _buildHeatmapOption(): Record<string, unknown> {
    const h2h = getHeadToHeadData();
    const simNames = ['Speranza', 'Capybara Kingdom', 'Velgarien', 'Station Null'];
    const simLabels = ['SP', 'CK', 'V', 'SN'];

    const matrixData: [number, number, number][] = [];
    for (const d of h2h) {
      const row = simNames.indexOf(d.rowSim);
      const col = simNames.indexOf(d.colSim);
      if (row >= 0 && col >= 0) matrixData.push([col, row, d.winRate]);
    }
    // Diagonal = 50% (self-matchup, neutral)
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

  /** Bar chart: strategy win rates with Wilson 95% CI error bars. */
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

    // Wilson score 95% CIs
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
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
      },
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
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-how-to-play': VelgHowToPlay;
  }
}

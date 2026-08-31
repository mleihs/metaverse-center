import { localized, msg, str } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import type { ForgeLoreSection } from '../../services/api/ForgeApiService.js';
import { agentsApi, buildingsApi } from '../../services/api/index.js';
import { localeService } from '../../services/i18n/locale-service.js';
import { captureError } from '../../services/SentryService.js';
import type { Agent, AgentAptitude, Building, OperativeType } from '../../types/index.js';
import { conditionVariant } from '../../utils/building-condition.js';
import { t } from '../../utils/locale-fields.js';
import { navigate } from '../../utils/navigation.js';
import {
  OPERATIVE_COLORS,
  OPERATIVE_TYPES,
  operativeName,
} from '../../utils/operative-constants.js';
import { pluralCount } from '../../utils/text.js';
import {
  extractThreatLevel,
  fetchRawLoreSections,
  isClassifiedSection,
  mapLoreSectionsForLocale,
} from '../lore/lore-content.js';
import { markerSelectionStyles } from '../shared/marker-styles.js';
import { stageStyles } from '../shared/stage-styles.js';
import '../shared/VelgGameCard.js';
import '../shared/LoadingState.js';
import '../shared/ErrorState.js';

/**
 * How deep the two collection reads go.
 *
 * The strips show eight each, but the rail's duty list is the top three BY
 * APTITUDE SUM across the whole roster — ranking the first eight rows the API
 * happened to return would be a different claim wearing the same words. Sixty
 * covers every world on the record with room to spare; a world larger than that
 * ranks what it fetched, and the strip still says how many there are in total.
 */
const FETCH_LIMIT = 60;

/** How many operatives the roster strip deals before it sends the reader on. */
const ROSTER_LIMIT = 8;
/** How many buildings the footprint strip shows before it sends the reader on. */
const FOOTPRINT_LIMIT = 8;
/** The rail's duty list — three is a shift, not a ranking table. */
const ON_DUTY_LIMIT = 3;

/**
 * A threat reading, reduced to the three states the rail can draw.
 *
 * `extractThreatLevel` returns 1–10 off the ARCANUM ZETA body. The masthead and
 * the rail both need a colour and a segment count, and both must agree, so the
 * reduction happens once, here, rather than twice with different cut points.
 */
type ThreatBand = 'calm' | 'elevated' | 'critical';

interface RailThreat {
  band: ThreatBand;
  label: string;
  segments: number;
}

interface RosterEntry {
  agent: Agent;
  sum: number;
  best: { type: OperativeType; value: number };
  legendary: boolean;
}

@localized()
@customElement('velg-simulation-overview')
export class VelgSimulationOverview extends SignalWatcher(LitElement) {
  static styles = [
    stageStyles,
    markerSelectionStyles,
    css`
    :host {
      display: block;
      background: var(--color-surface-sunken);

      /* ── Tier 3 ─────────────────────────────────────────────────────── */
      --_kicker-tracking: calc(var(--tracking-widest) * 3);
      --_rail-width: 400px;
      /*
       * The prototype's quietest greys sit at roughly 2.8:1 on this ground and
       * fail AA. Every dim value here is mixed up until it clears 4.5:1 — the
       * neutral is unchanged, only the level. See
       * handoff/simulation-views/DESIGN-AUTORITAET.md, point 4.
       */
      --_dim: var(--color-text-quiet);
    }

    @media (min-width: 1920px) {
      :host {
        --_rail-width: 440px;
      }
    }

    /* ── Layout ──────────────────────────────────────────────────────── */

    .overview {
      display: grid;
      grid-template-columns: minmax(0, 1fr) var(--_rail-width);
      gap: var(--space-10);
      padding-block: var(--space-10);
    }

    @media (max-width: 1100px) {
      .overview {
        grid-template-columns: minmax(0, 1fr);
      }
    }

    .strip {
      padding-block-end: var(--space-12);
    }

    /* ── Shared card chrome ──────────────────────────────────────────── */

    .panel {
      border: var(--border-width-thin) solid var(--color-border-light);
      background: var(--color-surface);
    }

    .kicker {
      font-family: var(--font-brutalist);
      font-size: var(--text-2xs);
      font-weight: var(--font-bold);
      letter-spacing: var(--_kicker-tracking);
      text-transform: uppercase;
      color: var(--color-accent-amber-readable);
    }

    .head {
      margin: 0;
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      letter-spacing: var(--tracking-brutalist);
      text-transform: uppercase;
      color: var(--color-text-primary);
      line-height: var(--leading-tight);
    }

    /*
     * Prose is Spectral, and that is not a preference — the register, the
     * kickers and the labels are the Bureau talking ABOUT the world; an epigraph,
     * a dossier excerpt and an anchor question are the world talking. Two voices,
     * two faces. See DESIGN-AUTORITAET.md, point 1.
     */
    .prose {
      font-family: var(--font-bureau, var(--font-prose));
      color: var(--color-text-secondary);
      margin: 0;
      text-wrap: pretty;
    }

    .link {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      letter-spacing: calc(var(--tracking-widest) * 2.5);
      text-transform: uppercase;
      color: var(--color-accent-amber-readable);
      background: none;
      border: none;
      padding: 0;
      cursor: pointer;
    }

    .link:hover {
      color: var(--color-accent-amber);
    }

    .link__arrow {
      display: inline-block;
      transition: translate var(--transition-normal);
    }

    .link:hover .link__arrow {
      translate: 5px 0;
    }

    /* ── Anchor card ─────────────────────────────────────────────────── */

    .anchor {
      display: flex;
      gap: var(--space-7);
      align-items: baseline;
      padding: var(--space-6) var(--space-7);
      margin-block-end: var(--space-9);
    }

    .anchor__id {
      flex: 0 0 190px;
    }

    /*
     * The influence is an attribution, so it is set like one: mono, quiet, and
     * allowed to wrap. Some of these run to three lines of citation.
     */
    .anchor__influence {
      margin-block: var(--space-2) 0;
      font-family: var(--font-mono);
      font-size: var(--text-2xs);
      line-height: var(--leading-relaxed);
      letter-spacing: var(--tracking-wide);
      color: var(--_dim);
    }

    .anchor--bare .anchor__id {
      flex: 0 0 auto;
    }

    .anchor__question {
      font-style: italic;
      font-size: var(--text-md);
      line-height: var(--leading-snug);
    }

    @media (max-width: 700px) {
      .anchor {
        flex-direction: column;
        gap: var(--space-4);
      }

      .anchor__id {
        flex: none;
      }
    }

    /* ── Dossier teaser ──────────────────────────────────────────────── */

    .dossier {
      padding: var(--space-7) var(--space-8);
    }

    .dossier__head {
      margin-block: var(--space-2) var(--space-4);
      font-size: var(--text-xl);
    }

    .dossier__excerpt {
      font-size: var(--text-base);
      line-height: var(--leading-relaxed);
      margin-block-end: var(--space-5);
      display: -webkit-box;
      -webkit-line-clamp: 3;
      line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .dossier__foot {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--space-5);
      flex-wrap: wrap;
    }

    .meta {
      font-family: var(--font-mono);
      font-size: var(--text-2xs);
      letter-spacing: calc(var(--tracking-widest) * 2);
      text-transform: uppercase;
      color: var(--_dim);
    }

    /* ── Rail ────────────────────────────────────────────────────────── */

    .rail {
      display: flex;
      flex-direction: column;
      gap: var(--space-7);
      min-width: 0;
    }

    .rail__panel {
      padding: var(--space-5) var(--space-6);
    }

    .rail__row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: var(--space-3);
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      letter-spacing: var(--tracking-wide);
      text-transform: uppercase;
      color: var(--color-text-quiet);
    }

    .rail__row b {
      color: var(--color-text-primary);
      font-weight: var(--font-bold);
    }

    .rail__stack {
      display: flex;
      flex-direction: column;
      gap: var(--space-2-5);
      margin-block-start: var(--space-4);
    }

    .threat__value {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      letter-spacing: var(--tracking-wide);
      text-transform: uppercase;
      color: var(--_threat, var(--color-accent-amber));
    }

    .threat__segments {
      display: flex;
      gap: var(--space-1);
      margin-block: var(--space-3) var(--space-5);
    }

    .threat__seg {
      flex: 1;
      height: 8px;
      background: var(--color-surface-raised);
    }

    .threat__seg--on {
      background: var(--_threat, var(--color-accent-amber));
    }

    /* ── Signals ─────────────────────────────────────────────────────── */

    .signals {
      display: flex;
      flex-direction: column;
      gap: var(--border-width-thin);
      background: var(--color-border-light);
      border: var(--border-width-thin) solid var(--color-border-light);
      margin-block-start: var(--space-3);
    }

    .signal {
      display: grid;
      grid-template-columns: 10px minmax(0, 1fr) auto;
      gap: var(--space-3);
      align-items: center;
      background: var(--color-surface);
      padding: var(--space-3) var(--space-3-5);
    }

    .signal__dot {
      width: 7px;
      height: 7px;
      border-radius: var(--border-radius-full);
      background: var(--_signal, var(--color-text-muted));
    }

    .signal__text {
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .signal__age {
      font-family: var(--font-mono);
      font-size: var(--text-2xs);
      color: var(--_dim);
      text-align: right;
    }

    /* ── On duty ─────────────────────────────────────────────────────── */

    .duty {
      display: grid;
      grid-template-columns: 38px minmax(0, 1fr) auto;
      gap: var(--space-3);
      align-items: center;
      padding: var(--space-1) var(--space-0-5);
      text-align: start;
      background: none;
      border: none;
      cursor: pointer;
    }

    .duty:hover .duty__name {
      color: var(--color-accent-amber-readable);
    }

    .duty__thumb {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 38px;
      height: 38px;
      box-sizing: border-box;
      border: var(--border-width-thin) solid
        color-mix(in srgb, var(--_tint, var(--color-border)) 45%, transparent);
      background-color: var(--color-surface-raised);
      background-size: cover;
      background-position: center 20%;
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      /* NICHT --_tint: die Rollenfarbe ist Text, sobald sie hier steht, und
         als Text traegt sie nicht. Siehe .duty__sum. */
      color: var(--color-text-secondary);
    }

    .duty__name {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      letter-spacing: var(--tracking-wide);
      text-transform: uppercase;
      color: var(--color-text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      transition: color var(--transition-fast);
    }

    .duty__role {
      font-size: var(--text-2xs);
      letter-spacing: var(--tracking-wide);
      text-transform: uppercase;
      /* Gemessen 2,98 : 1 auf heller Welt-Flaeche. --color-text-muted faellt in
         hellen Themes von sich aus durch; -quiet mischt zu text-primary. */
      color: var(--color-text-quiet);
      margin-block-start: var(--space-0-5);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .duty__sum {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      /*
       * Die Rollenfarbe faerbte hier die Zahl. Gemessen am 31.08.2026 gegen
       * die vier Plattform-Gruende:
       *
       *   als TEXT (4,5:1)   14 von 24 Paarungen fallen durch
       *   als MARKE (3,0:1)   6 von 24
       *
       * Das ist keine schlechte Palettenwahl, sondern strukturell: guardian
       * steht bei 7,80 auf Schwarz und 2,24 auf Creme. Keine sechs Farben
       * koennen auf hellem UND dunklem Grund Text sein — eine Farbe, die auf
       * dem einen traegt, faellt auf dem anderen durch, per Konstruktion.
       *
       * Also traegt die Farbe kuenftig nur noch die Marke (der Rahmen des
       * Daumens, 3:1), und die Rolle steht im Namen der Schaltflaeche in
       * Worten. Auch die Themen-Hebung in ThemeService (Schritt 1b) haette
       * das hier NICHT erreicht: --_tint ist ein Inline-Wert, kein Token.
       */
      color: var(--color-text-primary);
      font-variant-numeric: tabular-nums;
    }

    .rail__foot {
      margin-block-start: auto;
      padding-block-start: var(--space-3-5);
    }

    /* ── Strips ──────────────────────────────────────────────────────── */

    .strip__head {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: var(--space-5);
      margin-block-end: var(--space-4);
      flex-wrap: wrap;
    }

    .strip__title {
      font-size: var(--text-lg);
      margin-block-start: var(--space-1-5);
    }

    .strip__count {
      color: var(--_dim);
      font-size: var(--text-sm);
    }

    .strip__grid {
      display: grid;
      gap: var(--space-3-5);
    }

    .strip__grid--roster {
      grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
    }

    .strip__grid--footprint {
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    }

    /*
     * The deal: cards arrive one after another, left to right. The delay is
     * capped by the card count, not by the clock, so a 40-agent world does not
     * spend two seconds dealing a strip that only shows eight.
     */
    velg-game-card {
      animation: deal var(--duration-slower) var(--ease-out) both;
      animation-delay: calc(var(--i, 0) * var(--duration-cascade));
    }

    @keyframes deal {
      from {
        opacity: 0;
        translate: 0 14px;
      }
      to {
        opacity: 1;
        translate: 0 0;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      velg-game-card {
        animation: none;
      }

      .link__arrow {
        transition: none;
      }
    }
  `,
  ];

  @property({ type: String }) simulationId = '';

  @state() private _loading = true;
  @state() private _error: string | null = null;
  @state() private _agents: Agent[] = [];
  @state() private _aptitudes: AgentAptitude[] = [];
  @state() private _buildings: Building[] = [];
  @state() private _lore: ForgeLoreSection[] = [];

  private _loadedFor = '';

  protected updated(): void {
    if (this.simulationId && this.simulationId !== this._loadedFor) {
      this._loadedFor = this.simulationId;
      void this._load();
    }
  }

  /**
   * One pass, four reads, and none of them blocking the others.
   *
   * The strips and the rail draw from the same three collections, so fetching
   * them per-panel would mean the same agent list over the wire three times.
   * `allSettled` rather than `all`: a world without lore still has a roster, and
   * a missing dossier must not blank the page that was supposed to introduce it.
   */
  private async _load(): Promise<void> {
    this._loading = true;
    this._error = null;
    const mode = appState.currentSimulationMode.value;
    const id = this.simulationId;

    const [agents, aptitudes, buildings, lore] = await Promise.allSettled([
      agentsApi.list(id, mode, { limit: String(FETCH_LIMIT) }),
      agentsApi.getAllAptitudes(id, mode),
      buildingsApi.list(id, mode, { limit: String(FETCH_LIMIT) }),
      fetchRawLoreSections(id),
    ]);

    if (agents.status === 'fulfilled' && agents.value.success) {
      this._agents = agents.value.data ?? [];
    } else if (agents.status === 'rejected') {
      captureError(agents.reason, { source: 'VelgSimulationOverview._load.agents' });
      this._error = msg('Could not load this world.');
    }

    if (aptitudes.status === 'fulfilled' && aptitudes.value.success) {
      this._aptitudes = aptitudes.value.data ?? [];
    } else if (aptitudes.status === 'rejected') {
      captureError(aptitudes.reason, { source: 'VelgSimulationOverview._load.aptitudes' });
    }

    if (buildings.status === 'fulfilled' && buildings.value.success) {
      this._buildings = buildings.value.data ?? [];
    } else if (buildings.status === 'rejected') {
      captureError(buildings.reason, { source: 'VelgSimulationOverview._load.buildings' });
    }

    if (lore.status === 'fulfilled') {
      this._lore = lore.value ?? [];
    } else {
      captureError(lore.reason, { source: 'VelgSimulationOverview._load.lore' });
    }

    this._loading = false;
  }

  private _go(tab: string): void {
    const slug = appState.currentSimulation.value?.slug ?? this.simulationId;
    navigate(`/simulations/${slug}/${tab}`);
  }

  /* ── Derivations ───────────────────────────────────────────────────── */

  /** Aptitude rows folded onto their agent, once, for every consumer below. */
  private get _roster(): RosterEntry[] {
    const byAgent = new Map<string, Map<OperativeType, number>>();
    for (const row of this._aptitudes) {
      let set = byAgent.get(row.agent_id);
      if (!set) {
        set = new Map<OperativeType, number>();
        byAgent.set(row.agent_id, set);
      }
      set.set(row.operative_type, row.aptitude_level);
    }

    return this._agents.map((agent) => {
      const set = byAgent.get(agent.id) ?? new Map<OperativeType, number>();
      let sum = 0;
      let best: { type: OperativeType; value: number } = { type: OPERATIVE_TYPES[0], value: 0 };
      for (const type of OPERATIVE_TYPES) {
        const value = set.get(type) ?? 0;
        sum += value;
        if (value > best.value) best = { type, value };
      }
      /*
       * Legendary is a claim about the operative, not about the layout: either
       * the world sent them out as its ambassador, or one aptitude reached 9.
       * Both are facts on the record; neither is a count of how many cards the
       * strip would like to make gold.
       */
      const legendary = !!agent.is_ambassador || best.value >= 9;
      return { agent, sum, best, legendary };
    });
  }

  private get _onDuty(): RosterEntry[] {
    return [...this._roster].sort((a, b) => b.sum - a.sum).slice(0, ON_DUTY_LIMIT);
  }

  private get _sections() {
    return mapLoreSectionsForLocale(this._lore.filter((s) => !isClassifiedSection(s)));
  }

  private get _classifiedCount(): number {
    return this._lore.filter(isClassifiedSection).length;
  }

  /**
   * The threat reading, or nothing.
   *
   * It is parsed out of ARCANUM ZETA's prose, so a world whose dossier has not
   * been written has no reading — and the rail then says so instead of drawing
   * an empty five-segment bar, which would read as "calm" to every visitor.
   */
  private get _threat(): RailThreat | null {
    const zeta = this._lore.find((s) => s.arcanum === 'ZETA');
    if (!zeta) return null;
    const reading = extractThreatLevel(zeta.body);
    if (!reading) return null;

    if (reading.level <= 3) return { band: 'calm', label: msg('Calm'), segments: 1 };
    if (reading.level <= 7) return { band: 'elevated', label: msg('Elevated'), segments: 3 };
    return { band: 'critical', label: msg('Critical'), segments: 5 };
  }

  private _threatColor(band: ThreatBand): string {
    if (band === 'calm') return 'var(--color-success)';
    if (band === 'critical') return 'var(--color-danger)';
    return 'var(--color-accent-amber)';
  }

  private _initials(name: string): string {
    return name
      .split(' ')
      .map((w) => w[0] ?? '')
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  private _tint(entry: RosterEntry): string {
    return entry.legendary
      ? 'var(--color-accent-amber)'
      : (OPERATIVE_COLORS[entry.best.type] ?? 'var(--color-text-muted)');
  }

  /* ── Render ────────────────────────────────────────────────────────── */

  protected render() {
    if (this._loading) {
      return html`<velg-loading-state message=${msg('Opening the file...')}></velg-loading-state>`;
    }
    if (this._error) {
      return html`<velg-error-state
        message=${this._error}
        show-retry
        @retry=${() => void this._load()}
      ></velg-error-state>`;
    }

    return html`
      <div class="overview stage-container">
        <div>${this._renderAnchor()} ${this._renderDossier()}</div>
        ${this._renderRail()}
      </div>
      ${this._renderRoster()} ${this._renderFootprint()}
    `;
  }

  /**
   * The anchor: the question the world was built to ask.
   *
   * Two things measured on the eight backfilled worlds shaped this card, and
   * both contradict the prototype:
   *
   * 1. The anchor's TITLE is the world's own name. Materialization assigns
   *    `anchor->>'title'` to `simulations.name`, so printing it here would set
   *    the world's name twice on one screen, forty pixels apart. The left
   *    column carries the LITERARY INFLUENCE instead — a real field, and the
   *    one a reader actually gains something from ("Bakhtin, Rabelais and His
   *    World"). Where a world has no influence on file, the column collapses
   *    and the question takes the full width.
   * 2. `core_question_de` is sometimes null while `core_question` is not, so
   *    the German build falls back to the English sentence rather than
   *    rendering an empty quotation mark.
   *
   * No question, no card. An invented premise is worse than an absence — a
   * visitor cannot tell one from the other.
   */
  private _renderAnchor() {
    const anchor = appState.currentSimulation.value?.philosophical_anchor;
    if (!anchor) return nothing;

    const de = localeService.currentLocale !== 'en';
    const question = (de && anchor.core_question_de) || anchor.core_question;
    if (!question) return nothing;
    const influence = (de && anchor.literary_influence_de) || anchor.literary_influence;

    return html`
      <section class="panel anchor ${influence ? '' : 'anchor--bare'}">
        <div class="anchor__id">
          <div class="kicker">${msg('Philosophical anchor')}</div>
          ${influence ? html`<p class="anchor__influence">${influence}</p>` : nothing}
        </div>
        <p class="prose anchor__question">“${question}”</p>
      </section>
    `;
  }

  private _renderDossier() {
    const sections = this._sections;
    const first = sections[0];
    if (!first) return nothing;

    const excerpt = first.body.replace(/\s+/g, ' ').trim();
    const sealed = this._classifiedCount;

    return html`
      <section class="panel dossier">
        <div class="kicker">${msg('Public record')}</div>
        <h2 class="head dossier__head">${first.title}</h2>
        <p class="prose dossier__excerpt">${excerpt}</p>
        <div class="dossier__foot">
          <button class="link" @click=${() => this._go('lore')}>
            ${msg('Open dossier')} <span class="link__arrow" aria-hidden="true">→</span>
          </button>
          <span class="meta">
            ${pluralCount(sections.length, msg('section'), msg('sections'))}
            ${sealed ? html` · ${pluralCount(sealed, msg('classified'), msg('classified'))}` : nothing}
          </span>
        </div>
      </section>
    `;
  }

  private _renderRail() {
    const sim = appState.currentSimulation.value;
    const threat = this._threat;

    return html`
      <aside class="rail">
        <section class="panel rail__panel">
          <div class="kicker">${msg('Bureau status')}</div>
          ${
            threat
              ? html`
                <div style="--_threat: ${this._threatColor(threat.band)}">
                  <div class="rail__row" style="margin-block-start: var(--space-4)">
                    <span>${msg('Threat level')}</span>
                    <span class="threat__value">${threat.label}</span>
                  </div>
                  <div
                    class="threat__segments"
                    role="img"
                    aria-label="${msg('Threat level')}: ${threat.label}"
                  >
                    ${[1, 2, 3, 4, 5].map(
                      (n) =>
                        html`<span
                          class="threat__seg ${n <= threat.segments ? 'threat__seg--on' : ''}"
                        ></span>`,
                    )}
                  </div>
                </div>
              `
              : html`
                <p class="meta" style="margin-block: var(--space-4) var(--space-5)">
                  ${msg('No reading on file')}
                </p>
              `
          }
          <div class="rail__stack" style="margin-block-start: 0">
            <div class="rail__row">
              <span>${msg('Agents')}</span><b>${this._agents.length}</b>
            </div>
            <div class="rail__row">
              <span>${msg('Buildings')}</span><b>${this._buildings.length}</b>
            </div>
            ${
              typeof sim?.last_heartbeat_tick === 'number'
                ? html`<div class="rail__row">
                    <span>${msg('Cycle')}</span><b>${sim.last_heartbeat_tick}</b>
                  </div>`
                : nothing
            }
          </div>
        </section>

        <section class="panel rail__panel" style="display:flex; flex-direction:column; flex:1">
          <div class="kicker">${msg('On duty')}</div>
          <div class="rail__stack">
            ${
              this._onDuty.length
                ? this._onDuty.map((entry) => this._renderDuty(entry))
                : html`<p class="meta">${msg('No operatives on the roll')}</p>`
            }
          </div>
          <div class="rail__foot">
            <button class="link" @click=${() => this._go('agents')}>
              ${msg('Full roster')} <span class="link__arrow" aria-hidden="true">↓</span>
            </button>
          </div>
        </section>
      </aside>
    `;
  }

  private _renderDuty(entry: RosterEntry) {
    const { agent } = entry;
    const tint = this._tint(entry);
    /*
     * The portrait is a computed background, never <img src=…>: a hole in a
     * src attribute makes the browser fetch the page's own URL as an image
     * before the value lands. Handoff §4.10, and it is a project-wide rule.
     */
    const thumb = agent.portrait_image_url
      ? `--_tint: ${tint}; background-image: url('${agent.portrait_image_url}')`
      : `--_tint: ${tint}`;

    return html`
      <button
        class="duty"
        style="--_tint: ${tint}"
        aria-label=${msg(str`${agent.name}, strongest as ${operativeName(entry.best.type)}, ${entry.sum} in total`)}
        @click=${() => this._go('agents')}
      >
        <span class="duty__thumb" style=${thumb} aria-hidden="true">
          ${agent.portrait_image_url ? '' : this._initials(agent.name)}
        </span>
        <span style="min-width: 0">
          <span class="duty__name">${agent.name}</span>
          <span class="duty__role">${t(agent, 'primary_profession')}</span>
        </span>
        <span class="duty__sum">${entry.sum}</span>
      </button>
    `;
  }

  private _renderRoster() {
    if (!this._agents.length) return nothing;
    const shown = this._roster.slice(0, ROSTER_LIMIT);

    return html`
      <section class="strip stage-container">
        <div class="strip__head">
          <div>
            <div class="kicker">${msg('Agents')}</div>
            <h2 class="head strip__title">
              ${msg('Roster')} <span class="strip__count">${this._agents.length}</span>
            </h2>
          </div>
          <button class="link" @click=${() => this._go('agents')}>
            ${msg('Open agents')} <span class="link__arrow" aria-hidden="true">→</span>
          </button>
        </div>
        <div class="strip__grid strip__grid--roster">
          ${shown.map(
            (entry, i) => html`
              <velg-game-card
                style="--i: ${i}"
                type="agent"
                size="xs"
                rarity=${entry.legendary ? 'legendary' : entry.best.value >= 7 ? 'rare' : 'common'}
                .name=${entry.agent.name}
                .imageUrl=${entry.agent.portrait_image_url ?? ''}
                .subtitle=${t(entry.agent, 'primary_profession')}
                .primaryStat=${entry.sum}
                .secondaryStat=${entry.best.value}
                @click=${() => this._go('agents')}
              ></velg-game-card>
            `,
          )}
        </div>
      </section>
    `;
  }

  private _renderFootprint() {
    if (!this._buildings.length) return nothing;
    const shown = this._buildings.slice(0, FOOTPRINT_LIMIT);

    return html`
      <section class="strip stage-container">
        <div class="strip__head">
          <div>
            <div class="kicker">${msg('Buildings')}</div>
            <h2 class="head strip__title">
              ${msg('Footprint')} <span class="strip__count">${this._buildings.length}</span>
            </h2>
          </div>
          <button class="link" @click=${() => this._go('buildings')}>
            ${msg('Open buildings')} <span class="link__arrow" aria-hidden="true">→</span>
          </button>
        </div>
        <div class="strip__grid strip__grid--footprint">
          ${shown.map((building, i) => {
            /*
             * CONDITION, not occupancy — and that is a measurement, not a
             * preference.
             *
             * The handoff draws the state mark from the capacity RATIO. That
             * ratio has no numerator anywhere on this platform. Measured on
             * production, 2026-08-31:
             *
             *     building_agent_relations WHERE relation_type='lives_at'   0 rows
             *     buildings with population_capacity > 0                  219
             *     buildings with a building_condition                     324 of 324
             *
             * Nobody lives anywhere, so `agents?.length ?? 0` is not a count of
             * zero residents — it is the absence of a count, wearing a zero.
             * Feeding it to `occupancyLevel` would paint "nearly empty" onto
             * every one of those 219 buildings: not a missing reading but a
             * false one, which is worse. Adding a `resident_count` to the DTO
             * would return 0 for all 324 and build an instrument for a quantity
             * that does not exist.
             *
             * `building_condition` exists on every building on the record, and
             * it is what a reader of a footprint actually wants to know. The
             * capacity bar is dropped for the same reason: a bar drawn from an
             * absent numerator always reads empty.
             */
            const condition = building.building_condition;
            const variant = conditionVariant(condition);
            return html`
              <velg-game-card
                style="--i: ${i}"
                type="building"
                size="sm"
                .name=${building.name}
                .imageUrl=${building.image_url ?? ''}
                .subtitle=${t(building, 'building_type')}
                .badges=${condition ? [{ label: t(building, 'building_condition'), variant }] : []}
                @click=${() => this._go('buildings')}
              ></velg-game-card>
            `;
          })}
        </div>
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-simulation-overview': VelgSimulationOverview;
  }
}

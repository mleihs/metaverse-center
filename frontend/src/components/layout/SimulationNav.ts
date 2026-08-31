import { localized, msg, str } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { driftStatus } from '../../services/DriftStatusService.js';
import { forgeStateManager } from '../../services/ForgeStateManager.js';
import { icons } from '../../utils/icons.js';
import { navigate } from '../../utils/navigation.js';
import { DEFAULT_TAB } from '../../utils/sim-view-imports.js';
import { markerSelectionStyles } from '../shared/marker-styles.js';

/**
 * Canon groups. `core` tabs are always in the bar; `more` tabs live in the
 * register that opens from it. The split is a decision about what a world is
 * FOR — the nine core entries are the ones a reader of a world needs (its
 * record, its people, its places, its paper, its history, what happened, and
 * the two ways in), the rest are instruments an operator reaches for.
 *
 * It is deliberately NOT a measured-width split. A bar that decides at runtime
 * which tabs fit puts the same label in a different place on two screens, and
 * the reader loses the one thing a register is good at: the position of a thing
 * is where it was last time.
 */
type NavGroup = 'core' | 'more';

interface NavTab {
  label: string;
  path: string;
  group: NavGroup;
  /** Desktop bar shows labels only (handoff §2). The icon is for the mobile menu. */
  icon: () => TemplateResult;
  requireAdmin?: boolean;
  /** Only show this tab if the named setting_key is 'true' in appState.settings. */
  requireSetting?: string;
  /** Only show this tab if this predicate returns true. For platform-level phase gates
   *  that live outside appState.settings (e.g. DRIFT's drift_p0_enabled). The predicate
   *  may read a signal — it runs during render, so the nav stays reactive. */
  requireFlag?: () => boolean;
}

function getTabs(): NavTab[] {
  return [
    // ── Core: the world as a document, in reading order ──
    { label: msg('Overview'), path: 'overview', group: 'core', icon: () => icons.compassRose(14) },
    { label: msg('Lore'), path: 'lore', group: 'core', icon: () => icons.book(14) },
    { label: msg('Agents'), path: 'agents', group: 'core', icon: () => icons.users(14) },
    { label: msg('Buildings'), path: 'buildings', group: 'core', icon: () => icons.building(14) },
    { label: msg('Broadsheet'), path: 'broadsheet', group: 'core', icon: () => icons.columns(14) },
    {
      label: msg('Chronicle'),
      path: 'chronicle',
      group: 'core',
      icon: () => icons.newspaper(14),
      requireSetting: 'show_chronicle',
    },
    { label: msg('Events'), path: 'events', group: 'core', icon: () => icons.bolt(14) },
    { label: msg('Terminal'), path: 'terminal', group: 'core', icon: () => icons.terminal(14) },
    { label: msg('Dungeon'), path: 'dungeon', group: 'core', icon: () => icons.dungeonDepth(14) },

    // ── More: instruments, in the register ──
    { label: msg('Health'), path: 'health', group: 'more', icon: () => icons.heartbeat(14) },
    { label: msg('Pulse'), path: 'pulse', group: 'more', icon: () => icons.radar(14) },
    { label: msg('Bonds'), path: 'bonds', group: 'more', icon: () => icons.handshake(14) },
    { label: msg('Chat'), path: 'chat', group: 'more', icon: () => icons.messageCircle(14) },
    { label: msg('Social'), path: 'social', group: 'more', icon: () => icons.megaphone(14) },
    { label: msg('Locations'), path: 'locations', group: 'more', icon: () => icons.mapPin(14) },
    { label: msg('Atlas'), path: 'atlas', group: 'more', icon: () => icons.compassRose(14) },
    {
      label: msg('Drift'),
      path: 'drift',
      group: 'more',
      icon: () => icons.antenna(14),
      requireFlag: () => driftStatus.enabled.value,
    },
    {
      label: msg('Settings'),
      path: 'settings',
      group: 'more',
      icon: () => icons.gear(14),
      requireAdmin: true,
    },
  ];
}

@localized()
@customElement('velg-simulation-nav')
export class VelgSimulationNav extends SignalWatcher(LitElement) {
  static styles = [
    markerSelectionStyles,
    css`
    :host {
      display: block;
      /*
       * The bar sits one step BELOW the page, so the active tab — which carries
       * --color-surface — reads as the sheet in front of it. That is the whole
       * depth cue in a register; there is no shadow and no border on the tab.
       */
      background: var(--color-surface-sunken);
      border-bottom: var(--border-default);

      /* ── Tier 3 ─────────────────────────────────────────────────────── */

      /*
       * 0.2em at 10px = 2px, the handoff's tracking for register labels. It is
       * derived from --tracking-widest rather than written as a literal so a
       * theme that widens the scale widens this with it.
       */
      --_register-tracking: calc(var(--tracking-widest) * 2);

      /*
       * The context line. The prototype picks a mid grey on the sunken ground;
       * measured, that pairing is 2.80:1 and fails AA for text this size. Mixing
       * 90% of --color-text-muted over the same ground gives 4.79:1 — the same
       * neutral, the same quietness, and legible. The design handoff defers to AA
       * here by its own Definition of Done; see
       * handoff/simulation-views/DESIGN-AUTORITAET.md, point 4.
       */
      --_context-text: color-mix(in srgb, var(--color-text-muted) 90%, var(--color-surface-sunken));

      /* Hairline between register cells — half a step below --color-border-light. */
      --_register-rule: color-mix(in srgb, var(--color-border-light) 70%, var(--color-surface));

      /*
       * The content column this bar aligns to. The register's first LABEL must
       * land on the same x as the page content below it, which is why the tab's
       * own inline padding is subtracted from the gutter rather than added to it.
       */
      --_bar-measure: var(--stage-measure, 1920px);
    }

    .instance-badge {
      display: flex;
      align-items: center;
      gap: var(--space-1);
      padding: var(--space-1) var(--space-6);
      background: var(--color-epoch-influence);
      /*
       * Measured: --color-text-primary on this violet is 2.16:1 — a near-white
       * label on a light ground. The badge is a filled chip, so its text takes
       * the inverse (7.27:1), the same way every other filled chip does.
       */
      color: var(--color-text-inverse);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
    }

    /* ── The bar ─────────────────────────────────────────────────────── */

    /*
     * Two elements, and they must stay two: the register SCROLLS, so anything
     * absolutely positioned inside it would be clipped by that overflow. The
     * dropdown therefore hangs off .nav, which is the positioned ancestor and
     * has no overflow of its own.
     */
    .nav {
      position: relative;
    }

    .nav__scroll {
      display: flex;
      align-items: stretch;
      /*
       * max() rather than a media query: below the measure this is the plain
       * gutter, above it the bar centres its content on the same column as the
       * page. Chrome stays full-bleed either way — the background is on :host.
       */
      padding-inline: max(var(--space-6), calc((100% - var(--_bar-measure)) / 2 - var(--space-4)));
      overflow-x: auto;
      /* Scrollability without a visible bar: the fallback for long locales. */
      scrollbar-width: none;
      -ms-overflow-style: none;
    }

    .nav__scroll::-webkit-scrollbar {
      display: none;
    }

    /* ── A register cell ─────────────────────────────────────────────── */

    .nav__tab {
      position: relative;
      display: flex;
      align-items: center;
      gap: var(--space-2);

      /*
       * The clipping bug, and why the fix is these two lines and not one.
       *
       * Eleven of fourteen tabs showed a truncated word in the German build —
       * GEBÄUD, GESUNDHE, EREIGNISS, BINDUNGE, SOZIALE, TERMINA, DUNGEO,
       * EINSTELLUNG — with no ellipsis and no wrap. The cause was an interaction
       * between two rules that each look harmless:
       *
       *   .nav__scroll  overflow-x: auto    scroll when it gets tight
       *   .nav__tab     overflow: hidden    for a ::before gradient
       *
       * A flex child has min-width: auto, which normally stops it being squeezed
       * below its content — but that automatic minimum only holds while overflow
       * is visible. overflow: hidden sets it to zero. So the tabs shrank
       * instead of overflowing the bar, and the scroller above never engaged.
       *
       * flex: 0 0 auto states the intent directly instead of relying on the
       * automatic minimum, and the ::before gradient that needed the clipping is
       * gone with the icons. Below 640px the bar hides and the menu takes over.
       */
      flex: 0 0 auto;
      white-space: nowrap;

      padding: var(--space-3) var(--space-4);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      line-height: var(--leading-normal);
      text-transform: uppercase;
      letter-spacing: var(--_register-tracking);
      color: var(--color-text-muted);
      background: transparent;
      border: none;
      cursor: pointer;
      text-decoration: none;
      transition:
        background var(--transition-normal),
        color var(--transition-normal);

      /* Staggered entrance, one cell after another, left to right. */
      opacity: 0;
      animation: nav-enter var(--duration-entrance) var(--ease-out) forwards;
      animation-delay: calc(var(--i, 0) * var(--duration-stagger));
    }

    .nav__tab:hover {
      background: var(--color-surface-raised);
      color: var(--color-text-primary);
    }

    .nav__tab:focus-visible {
      outline: 2px solid var(--color-accent-amber);
      outline-offset: -2px;
    }

    /*
     * Active: amber label on the page surface, underscored. The 2px rule is
     * drawn as an inset shadow rather than a border so it costs no layout and
     * cannot shift the neighbouring cells — and it is a BOTTOM edge on a tab,
     * the one place the no-edge-bar tabu does not reach: the tabu is about a
     * coloured slab down the LEFT of a card standing in for a category.
     */
    .nav__tab--active,
    .nav__tab--active:hover {
      color: var(--color-accent-amber);
      background: var(--color-surface);
      box-shadow: inset 0 -2px 0 var(--color-accent-amber);
    }

    /*
     * The ◈ before "Overview". Ornament, not an icon: it names nothing, it marks
     * the tab you land on. It lives outside msg() so no translation carries it.
     */
    .nav__mark {
      /*
       * Measured at 4.03:1 on --color-accent-amber-dim, just under AA. The mark
       * now simply matches the label it stands beside when idle (5.72:1) and
       * turns amber with it when active — it was never meant to be a second
       * colour, only a second shape.
       */
      color: var(--color-text-muted);
      font-size: 1.1em;
      line-height: 1;
    }

    .nav__tab--active .nav__mark {
      color: var(--color-accent-amber);
    }

    /* ── The "More" register ─────────────────────────────────────────── */

    .nav__more[aria-expanded='true'] {
      color: var(--color-accent-amber);
      background: var(--color-surface);
    }

    .nav__caret {
      font-size: 0.9em;
      line-height: 1;
    }

    .nav__menu {
      position: absolute;
      top: 100%;
      right: 0;
      z-index: var(--z-dropdown);
      display: grid;
      grid-template-columns: repeat(3, 170px);
      background: var(--color-surface);
      border: var(--border-width-thin) solid var(--color-border);
      box-shadow: var(--shadow-lg);
      animation: menu-drop var(--duration-normal) var(--ease-out) both;
    }

    .nav__menu .nav__tab {
      /* Inside the register the cells are rows, not a bar: no entrance stagger. */
      opacity: 1;
      animation: none;
      border-bottom: var(--border-width-thin) solid var(--_register-rule);
    }

    /* ── Trailing context ────────────────────────────────────────────── */

    .nav__spacer {
      flex: 1 1 auto;
      min-width: var(--space-6);
    }

    .nav__context {
      display: inline-flex;
      align-items: center;
      flex: 0 0 auto;
      padding-inline: var(--space-4);
      font-family: var(--font-mono);
      font-size: calc(var(--text-xs) * 0.9);
      letter-spacing: var(--_register-tracking);
      text-transform: uppercase;
      color: var(--_context-text);
      white-space: nowrap;
    }

    /* ── Badge dots ──────────────────────────────────────────────────── */

    .nav__badge {
      position: absolute;
      top: var(--space-1-5);
      right: var(--space-1-5);
      width: 6px;
      height: 6px;
      border-radius: var(--border-radius-full);
      background: var(--color-accent-amber);
      animation: badge-pulse 2s ease-in-out infinite;
      pointer-events: none;
    }

    .mobile-menu__badge {
      width: 5px;
      height: 5px;
      border-radius: var(--border-radius-full);
      background: var(--color-accent-amber);
      flex-shrink: 0;
      margin-left: auto;
      animation: badge-pulse 2s ease-in-out infinite;
    }

    /* ── Keyframes ───────────────────────────────────────────────────── */

    @keyframes nav-enter {
      from {
        opacity: 0;
        translate: 0 6px;
      }
      to {
        opacity: 1;
        translate: 0 0;
      }
    }

    @keyframes menu-drop {
      from {
        opacity: 0;
        translate: 0 -6px;
      }
      to {
        opacity: 1;
        translate: 0 0;
      }
    }

    @keyframes badge-pulse {
      0%,
      100% {
        opacity: 0.6;
      }
      50% {
        opacity: 1;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .nav__tab,
      .nav__menu {
        animation: none;
        opacity: 1;
        translate: none;
      }

      .nav__badge,
      .mobile-menu__badge {
        animation: none;
        opacity: 1;
      }
    }

    /* ── Mobile: hamburger menu (unchanged behaviour, restyled active) ── */

    .mobile-bar {
      display: none;
    }

    .mobile-menu {
      display: none;
    }

    @media (max-width: 640px) {
      .nav {
        display: none;
      }

      .mobile-bar {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        padding: var(--space-2) var(--space-4);
      }

      .mobile-bar__hamburger {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 44px;
        height: 44px;
        background: transparent;
        border: var(--border-default);
        cursor: pointer;
        color: var(--color-text-primary);
        transition: background var(--transition-fast);
        flex-shrink: 0;
        padding: 0;
      }

      .mobile-bar__hamburger:hover {
        background: var(--color-surface-raised);
      }

      .mobile-bar__current {
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: var(--text-sm);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
        color: var(--color-accent-amber);
      }

      .mobile-menu {
        display: none;
        flex-direction: column;
        border-top: var(--border-default);
        background: var(--color-surface);
      }

      .mobile-menu--open {
        display: flex;
      }

      .mobile-menu__item {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        padding: var(--space-3) var(--space-4);
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: var(--text-sm);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
        color: var(--color-text-muted);
        text-decoration: none;
        border: none;
        background: transparent;
        cursor: pointer;
        transition:
          color var(--transition-fast),
          background var(--transition-fast);
        min-height: 44px;
      }

      .mobile-menu__item:hover {
        background: var(--color-surface-raised);
        color: var(--color-text-primary);
      }

      /*
       * The active row used to be marked by border-left: 3px solid in the
       * accent colour — the exact device the 2026-08-31 handoff forbids
       * platform-wide. It now carries is-selected from the shared marking
       * vocabulary, like every other current-item in the app.
       */
      .mobile-menu__item--active {
        color: var(--color-accent-amber);
      }

      .mobile-menu__icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 20px;
      }
    }
  `,
  ];

  @property({ type: String }) simulationId = '';
  @state() private _activeTab = DEFAULT_TAB;
  @state() private _menuOpen = false;

  private _boundClickOutside: ((e: MouseEvent) => void) | null = null;
  private _boundKeyDown: ((e: KeyboardEvent) => void) | null = null;
  private _boundDetectActiveTab: (() => void) | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this._detectActiveTab();
    // Resolve the DRIFT phase gate (drift_p0_enabled) so the Drift tab appears once the
    // public state confirms it is live. Idempotent + self-observing — never rejects.
    void driftStatus.ensureLoaded();
    this._boundClickOutside = this._handleClickOutside.bind(this);
    this._boundKeyDown = this._handleKeyDown.bind(this);
    this._boundDetectActiveTab = () => this._detectActiveTab();
    document.addEventListener('click', this._boundClickOutside);
    document.addEventListener('keydown', this._boundKeyDown);
    window.addEventListener('popstate', this._boundDetectActiveTab);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._boundClickOutside) {
      document.removeEventListener('click', this._boundClickOutside);
    }
    if (this._boundKeyDown) {
      document.removeEventListener('keydown', this._boundKeyDown);
    }
    if (this._boundDetectActiveTab) {
      window.removeEventListener('popstate', this._boundDetectActiveTab);
    }
  }

  /**
   * Read the active tab off the URL.
   *
   * Matched on the segment after the simulation id, not with `includes()`: a
   * substring test asks whether the string contains `/lore` ANYWHERE, which a
   * deep link such as `/simulations/x/lore/some-entity` satisfies for the right
   * reason and a future `/simulations/x/atlas/lore-overlay` would satisfy for
   * the wrong one. The segment is what the router dispatches on, so it is what
   * this should read.
   */
  private _detectActiveTab(): void {
    const segments = window.location.pathname.split('/').filter(Boolean);
    const simIndex = segments.indexOf('simulations');
    const segment = simIndex >= 0 ? segments[simIndex + 2] : undefined;
    const tab = getTabs().find((t) => t.path === segment);
    this._activeTab = tab ? tab.path : DEFAULT_TAB;
  }

  private get _slug(): string {
    return appState.currentSimulation.value?.slug ?? this.simulationId;
  }

  private _handleTabClick(e: Event, tab: NavTab): void {
    e.preventDefault();
    this._activeTab = tab.path;
    this._menuOpen = false;
    navigate(`/simulations/${this._slug}/${tab.path}`);
  }

  private _toggleMenu(e: Event): void {
    e.stopPropagation();
    this._menuOpen = !this._menuOpen;
  }

  private _handleClickOutside(e: MouseEvent): void {
    if (!this._menuOpen) return;
    const path = e.composedPath();
    if (!path.includes(this)) {
      this._menuOpen = false;
    }
  }

  private _handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && this._menuOpen) {
      this._menuOpen = false;
    }
  }

  private get _visibleTabs(): NavTab[] {
    return getTabs().filter((tab) => {
      if (tab.requireAdmin && !appState.canAdmin.value) return false;
      if (tab.requireSetting) {
        const setting = appState.settings.value.find((s) => s.setting_key === tab.requireSetting);
        if (!setting || String(setting.setting_value) !== 'true') return false;
      }
      if (tab.requireFlag && !tab.requireFlag()) return false;
      return true;
    });
  }

  /**
   * The bar, the pin and the register — resolved together, because they are one
   * partition of one list and computing them apart is how a tab ends up in two
   * places or in none.
   *
   * The pin: when the active tab belongs to the register it is lifted out and
   * shown in the bar, immediately before "More". Without it, opening a chat and
   * then looking at the bar shows nine tabs, none of them current — the reader
   * cannot see where they are. The lifted tab LEAVES the register rather than
   * appearing twice, so the count on the button keeps telling the truth about
   * what opening it would reveal.
   */
  private get _partition(): { bar: NavTab[]; pinned: NavTab | null; register: NavTab[] } {
    const visible = this._visibleTabs;
    const bar = visible.filter((t) => t.group === 'core');
    const register = visible.filter((t) => t.group === 'more');
    const pinIndex = register.findIndex((t) => t.path === this._activeTab);
    if (pinIndex === -1) return { bar, pinned: null, register };
    const pinned = register[pinIndex];
    return { bar, pinned, register: register.filter((_, i) => i !== pinIndex) };
  }

  private get _activeLabel(): string {
    const tab = this._visibleTabs.find((t) => t.path === this._activeTab);
    return tab?.label ?? '';
  }

  private get _isGameInstance(): boolean {
    return appState.currentSimulation.value?.simulation_type === 'game_instance';
  }

  private get _badgedTabs(): Set<string> {
    const badged = new Set<string>();

    // Forge feature badges (existing)
    if (appState.canEdit.value && this.simulationId) {
      for (const path of forgeStateManager.getUnpurchasedTabPaths(this.simulationId)) {
        badged.add(path);
      }
    }

    // Heartbeat activity badges — show on pulse/events/health/bonds if new ticks since last visit
    if (this.simulationId) {
      const sim = appState.currentSimulation.value;
      const lastHeartbeat = sim?.last_heartbeat_at;
      if (lastHeartbeat) {
        const heartbeatTabs = ['pulse', 'events', 'health', 'bonds'];
        for (const tab of heartbeatTabs) {
          if (tab === this._activeTab) {
            // Currently viewing — mark as visited
            localStorage.setItem(`nav_visited_${this.simulationId}_${tab}`, lastHeartbeat);
          } else {
            const lastVisited = localStorage.getItem(`nav_visited_${this.simulationId}_${tab}`);
            if (!lastVisited || lastVisited < lastHeartbeat) {
              badged.add(tab);
            }
          }
        }
      }
    }

    return badged;
  }

  /**
   * The trailing readout: where this world stands, in two facts it can prove.
   *
   * The prototype shows "Cycle 7 · Epoch active". Both halves are read off the
   * record rather than assumed — `last_heartbeat_tick` is the number of the last
   * tick that actually ran, and the second half is the simulation's own status,
   * prefixed with "Epoch" only when this really is an epoch instance. A world
   * that is paused says paused; nothing here claims motion it cannot show.
   */
  private get _contextLine(): string {
    const sim = appState.currentSimulation.value;
    if (!sim) return '';

    const statusLabels: Record<string, () => string> = {
      draft: () => msg('Draft'),
      configuring: () => msg('Configuring'),
      active: () => msg('Active'),
      paused: () => msg('Paused'),
      archived: () => msg('Archived'),
    };
    const status = statusLabels[sim.status]?.() ?? sim.status;
    const isEpoch = sim.simulation_type === 'game_instance' && !!sim.epoch_id;
    /*
     * `str` rather than concatenation, and not only because biome asks: gluing
     * a translated word onto a translated word hands the translator two halves
     * and no sentence. German puts them in this order, but the phrase has to be
     * one unit for a language that would not.
     */
    const state = isEpoch ? msg(str`Epoch ${status.toLocaleLowerCase()}`) : status;

    const tick = sim.last_heartbeat_tick;
    if (typeof tick !== 'number') return state;
    return `${msg('Cycle')} ${tick} · ${state}`;
  }

  private _renderTab(tab: NavTab, index: number, badged: Set<string>, inRegister: boolean) {
    const active = this._activeTab === tab.path;
    return html`
      <a
        href="/simulations/${this._slug}/${tab.path}"
        class="nav__tab ${active ? 'nav__tab--active' : ''}"
        style="--i: ${index}"
        aria-current=${active ? 'page' : nothing}
        @click=${(e: Event) => this._handleTabClick(e, tab)}
      >
        ${
          tab.path === DEFAULT_TAB && !inRegister
            ? html`<span class="nav__mark" aria-hidden="true">◈</span>`
            : nothing
        }
        <span class="nav__label">${tab.label}</span>
        ${
          badged.has(tab.path)
            ? html`<span class="nav__badge" aria-label=${msg('New activity')}></span>`
            : nothing
        }
      </a>
    `;
  }

  protected render() {
    const { bar, pinned, register } = this._partition;
    const badged = this._badgedTabs;
    const context = this._contextLine;
    // Continuous stagger across bar, pin and the "More" button — one cascade.
    let i = 0;

    return html`
      ${
        this._isGameInstance
          ? html`<div class="instance-badge">${icons.bolt(12)} ${msg('Game Instance')}</div>`
          : ''
      }
      <!-- Desktop: the register -->
      <div class="nav">
        <nav class="nav__scroll" role="navigation" aria-label=${msg('Simulation navigation')}>
          ${bar.map((tab) => this._renderTab(tab, i++, badged, false))}
          ${pinned ? this._renderTab(pinned, i++, badged, false) : nothing}
          ${
            register.length
              ? html`
                <button
                  class="nav__tab nav__more"
                  style="--i: ${i++}"
                  aria-expanded=${this._menuOpen}
                  aria-haspopup="true"
                  aria-label=${msg('More sections')}
                  @click=${this._toggleMenu}
                >
                  <span class="nav__label">${msg('More')} (${register.length})</span>
                  <span class="nav__caret" aria-hidden="true">${this._menuOpen ? '▴' : '▾'}</span>
                </button>
              `
              : nothing
          }
          <span class="nav__spacer"></span>
          ${context ? html`<span class="nav__context">${context}</span>` : nothing}
        </nav>
        ${
          this._menuOpen && register.length
            ? html`
              <div class="nav__menu">
                ${register.map((tab) => this._renderTab(tab, 0, badged, true))}
              </div>
            `
            : nothing
        }
      </div>

      <!-- Mobile: hamburger bar + dropdown -->
      <div class="mobile-bar">
        <button
          class="mobile-bar__hamburger"
          @click=${this._toggleMenu}
          aria-label=${msg('Navigation menu')}
          aria-expanded=${this._menuOpen}
        >
          ${this._menuOpen ? icons.close(18) : icons.menu(20)}
        </button>
        <span class="mobile-bar__current">${this._activeLabel}</span>
      </div>
      <div class="mobile-menu ${this._menuOpen ? 'mobile-menu--open' : ''}">
        ${this._visibleTabs.map(
          (tab) => html`
            <a
              class="mobile-menu__item ${
                this._activeTab === tab.path ? 'mobile-menu__item--active is-selected' : ''
              }"
              href="/simulations/${this._slug}/${tab.path}"
              @click=${(e: Event) => this._handleTabClick(e, tab)}
            >
              <span class="mobile-menu__icon">${tab.icon()}</span>
              ${tab.label}
              ${badged.has(tab.path) ? html`<span class="mobile-menu__badge"></span>` : nothing}
            </a>
          `,
        )}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-simulation-nav': VelgSimulationNav;
  }
}

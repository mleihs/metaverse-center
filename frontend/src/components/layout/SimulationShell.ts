import { localized, msg } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { healthApi } from '../../services/api/HealthApiService.js';
import { heartbeatApi } from '../../services/api/HeartbeatApiService.js';
import { simulationsApi } from '../../services/api/SimulationsApiService.js';
import { forgeStateManager } from '../../services/ForgeStateManager.js';
import { themeService } from '../../services/ThemeService.js';
import type { BleedStatus, ThresholdState } from '../../types/health.js';
import { icons } from '../../utils/icons.js';

import '../bleed/BleedPalimpsestOverlay.js';
import '../forge/VelgBureauDispatch.js';
import '../forge/VelgBureauNotice.js';
import '../heartbeat/DailyBriefingModal.js';
import '../health/AscendancyAura.js';
import '../health/DesperateActionsPanel.js';
import '../health/EntropyOverlay.js';
import '../health/EntropyTimer.js';
import '../shared/SvgFilters.js';
import '../shared/PlatformFooter.js';
import './SimulationHeader.js';
import './SimulationNav.js';

/** Map tab path segments to localized labels. */
function getTabLabel(path: string): string {
  const labels: Record<string, () => string> = {
    lore: () => msg('Lore'),
    agents: () => msg('Agents'),
    buildings: () => msg('Buildings'),
    chronicle: () => msg('Chronicle'),
    health: () => msg('Health'),
    events: () => msg('Events'),
    chat: () => msg('Chat'),
    social: () => msg('Social'),
    locations: () => msg('Locations'),
    terminal: () => msg('Terminal'),
    settings: () => msg('Settings'),
  };
  return labels[path]?.() ?? path.charAt(0).toUpperCase() + path.slice(1);
}

@localized()
@customElement('velg-simulation-shell')
export class VelgSimulationShell extends SignalWatcher(LitElement) {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      min-height: calc(100vh - var(--header-height));
      background-color: var(--color-surface);
      color: var(--color-text-primary);
    }

    /* Shadow DOM doesn't inherit global box-sizing reset */
    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    .shell {
      display: flex;
      flex-direction: column;
      flex: 1;
      background-color: var(--color-surface);
    }

    /* ── Breadcrumb Bar ── */

    .breadcrumb {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-6);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      letter-spacing: var(--tracking-wider);
      color: var(--color-text-muted);
      background: var(--color-surface-sunken);
      border-bottom: 1px solid var(--color-border);
      overflow-x: auto;
      white-space: nowrap;
      scrollbar-width: none;
    }

    .breadcrumb::-webkit-scrollbar {
      display: none;
    }

    .breadcrumb__sep {
      color: color-mix(in srgb, var(--color-text-muted) 40%, transparent);
      user-select: none;
      flex-shrink: 0;
    }

    .breadcrumb__link {
      color: var(--color-text-muted);
      text-decoration: none;
      cursor: pointer;
      background: none;
      border: none;
      font: inherit;
      letter-spacing: inherit;
      padding: var(--space-0-5) 0;
      transition: color 0.15s ease;
      flex-shrink: 0;
    }

    .breadcrumb__link:hover {
      color: var(--color-primary);
    }

    .breadcrumb__link:focus-visible {
      outline: 1px solid var(--color-primary);
      outline-offset: 2px;
    }

    .breadcrumb__current {
      color: var(--color-text-secondary);
      text-transform: uppercase;
      flex-shrink: 0;
    }

    /* ── Simulation Switcher ── */

    .breadcrumb__switcher {
      position: relative;
      flex-shrink: 0;
    }

    .breadcrumb__trigger {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      color: var(--color-text-muted);
      cursor: pointer;
      background: none;
      border: none;
      font: inherit;
      letter-spacing: inherit;
      padding: var(--space-0-5) var(--space-1) var(--space-0-5) 0;
      transition: color 0.2s ease;
    }

    .breadcrumb__trigger:hover {
      color: var(--color-primary);
    }

    .breadcrumb__trigger:focus-visible {
      outline: 1px solid var(--color-primary);
      outline-offset: 2px;
    }

    .breadcrumb__trigger svg {
      opacity: 0.5;
      transition:
        transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1),
        opacity 0.15s ease;
    }

    .breadcrumb__trigger:hover svg {
      opacity: 1;
    }

    .breadcrumb__trigger[aria-expanded="true"] svg {
      transform: rotate(180deg);
      opacity: 1;
    }

    /* ── Dropdown Panel ── */

    .breadcrumb__dropdown {
      position: fixed;
      z-index: var(--z-raised);
      min-width: 220px;
      max-width: 340px;
      max-height: 300px;
      overflow-y: auto;
      background: color-mix(in srgb, var(--color-surface-elevated, var(--color-surface)) 92%, transparent);
      backdrop-filter: blur(12px) saturate(1.3);
      -webkit-backdrop-filter: blur(12px) saturate(1.3);
      border: 1px solid color-mix(in srgb, var(--color-primary) 20%, var(--color-border));
      border-top: 2px solid var(--color-primary);
      box-shadow:
        0 8px 32px rgba(0, 0, 0, 0.4),
        0 0 1px rgba(0, 0, 0, 0.3),
        inset 0 1px 0 color-mix(in srgb, var(--color-primary) 6%, transparent);
      padding: var(--space-1) 0;

      /* Entrance animation */
      animation: dropdown-enter 0.2s cubic-bezier(0.22, 1, 0.36, 1) both;
      transform-origin: top left;
    }

    @keyframes dropdown-enter {
      from {
        opacity: 0;
        transform: translateY(-4px) scaleY(0.96);
      }
      to {
        opacity: 1;
        transform: translateY(0) scaleY(1);
      }
    }

    .breadcrumb__dropdown::-webkit-scrollbar {
      width: 3px;
    }

    .breadcrumb__dropdown::-webkit-scrollbar-track {
      background: transparent;
    }

    .breadcrumb__dropdown::-webkit-scrollbar-thumb {
      background: color-mix(in srgb, var(--color-primary) 30%, transparent);
      border-radius: 2px;
    }

    /* Firefox thin scrollbar */
    .breadcrumb__dropdown {
      scrollbar-width: thin;
      scrollbar-color: color-mix(in srgb, var(--color-primary) 30%, transparent) transparent;
    }

    /* ── Dropdown Options ── */

    .breadcrumb__option {
      position: relative;
      display: block;
      width: 100%;
      padding: var(--space-2) var(--space-3) var(--space-2) var(--space-3);
      background: none;
      border: none;
      border-left: 2px solid transparent;
      font: inherit;
      letter-spacing: inherit;
      color: var(--color-text-secondary);
      text-align: left;
      cursor: pointer;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      transition:
        background 0.15s ease,
        color 0.15s ease,
        border-color 0.15s ease,
        padding-left 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);

      /* Staggered entrance */
      opacity: 0;
      animation: option-enter 0.2s ease forwards;
    }

    @keyframes option-enter {
      from {
        opacity: 0;
        transform: translateX(-6px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    .breadcrumb__option:hover,
    .breadcrumb__option:focus-visible {
      background: color-mix(in srgb, var(--color-primary) 10%, transparent);
      color: var(--color-primary);
      border-left-color: var(--color-primary);
      padding-left: var(--space-4);
    }

    .breadcrumb__option:focus-visible {
      outline: none;
    }

    .breadcrumb__option[aria-current="true"] {
      color: var(--color-primary);
      border-left-color: var(--color-primary);
      background: color-mix(in srgb, var(--color-primary) 6%, transparent);
    }

    .shell__content {
      flex: 1;
      width: 100%;
      padding: var(--content-padding);
      min-width: 0;
      max-width: var(--container-2xl, 1400px);
      margin-inline: auto;
    }

    @media (max-width: 640px) {
      .breadcrumb {
        padding: var(--space-1-5) var(--space-4);
        font-size: 9px;
      }
    }

    /* ── Threshold State Modifiers ── */

    /* Entropy filter via ::after overlay — avoids CSS filter on .shell which
       breaks position:fixed for all descendants (modals, lightboxes, overlays).
       Per CSS spec, filter != none creates a new containing block for fixed elements. */
    :host(.shell--critical) .shell {
      position: relative;
    }

    :host(.shell--critical) .shell::after {
      content: '';
      position: fixed;
      inset: 0;
      z-index: var(--z-raised);
      pointer-events: none;
      animation: entropy-drift 12s ease-in-out infinite;
    }

    @keyframes entropy-drift {
      0%, 100% {
        backdrop-filter: saturate(0.3) brightness(0.85) sepia(0.06) hue-rotate(-25deg);
      }
      50% {
        backdrop-filter: saturate(0.2) brightness(0.75) sepia(0.15) hue-rotate(-35deg);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      :host(.shell--critical) .shell::after {
        animation: none;
        backdrop-filter: saturate(0.25) brightness(0.8) sepia(0.1) hue-rotate(-30deg);
      }
    }

    /* ── Fracture Banner (outside .shell for fixed positioning) ── */

    .fracture-banner {
      padding: var(--space-1-5, 6px) var(--space-4, 16px);
      background: rgba(10, 0, 0, 0.95);
      border-bottom: 1px solid var(--color-accent-amber);
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs, 12px);
      letter-spacing: var(--tracking-wider, 0.05em);
      color: var(--color-accent-amber);
      white-space: nowrap;
      overflow: hidden;
      pointer-events: auto;
    }

    .fracture-banner__text {
      display: inline-block;
      animation: fracture-banner-scroll 20s linear infinite;
    }

    @keyframes fracture-banner-scroll {
      0% { transform: translateX(100%); }
      100% { transform: translateX(-100%); }
    }
    :host(.shell--critical) {
      --color-surface-raised: var(--color-surface-raised-critical);
    }
    :host(.shell--ascendant) {
      --color-surface-raised: var(--color-surface-raised-ascendant);
    }

    .shell__overlays {
      position: relative;
    }

    @media (min-width: 2560px) {
      :host {
        background:
          radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.3) 100%),
          var(--color-surface);
      }
      .shell__content {
        max-width: var(--container-max, 1600px);
      }
    }
  `;

  @property({ type: String }) simulationId = '';
  @property({ type: String }) view = 'lore';

  @state() private _dispatchOpen = false;
  @state() private _bureauNoticeVisible = false;
  @state() private _simSwitcherOpen = false;
  @state() private _dropdownPos = { top: 0, left: 0 };
  @state() private _bleedStatus: BleedStatus | null = null;
  @state() private _thresholdState: ThresholdState = 'normal';
  @state() private _briefingData: Record<string, unknown> | null = null;
  private _focusedIndex = -1;

  private _appliedSimulationId = '';
  private _bureauNoticeTimer?: ReturnType<typeof setTimeout>;
  private _bleedPollTimer?: ReturnType<typeof setInterval>;
  private _boundCloseDropdown = (e: MouseEvent) => this._onOutsideClick(e);
  private _boundKeyDown = (e: KeyboardEvent) => this._onKeyDown(e);

  private get _isEpoch(): boolean {
    const sim = appState.currentSimulation.value;
    return sim?.simulation_type === 'game_instance' && !!sim.epoch_id;
  }

  /* ── Entropy deceleration ── */
  private _previousThresholdState: ThresholdState = 'normal';
  private _hasPlayedDeceleration = false;
  private _decelerationFrame?: ReturnType<typeof requestAnimationFrame>;

  /* ── Text corruption + card distortion ── */
  private _scrambleTimer?: ReturnType<typeof setTimeout>;
  private _cardShakeTimer?: ReturnType<typeof setTimeout>;

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    this.addEventListener('open-bureau-dispatch', this._handleOpenBureauDispatch);
    if (this.simulationId) {
      await this._applyTheme();
      this._fetchBleedStatus();
      this._startBleedPolling();
      this._initBureauDispatch();
      this._fetchDailyBriefing();
    }
    // Ensure simulations list is populated for the breadcrumb switcher.
    // On direct navigation / page refresh, the dashboard hasn't mounted
    // yet, so appState.simulations may be empty. Works for guests too
    // (simulationsApi.list() uses public endpoint when unauthenticated).
    if (appState.simulations.value.length === 0) {
      const result = await simulationsApi.list();
      if (result.success && result.data) {
        appState.setSimulations(result.data);
      }
    }
  }

  private async _fetchDailyBriefing(): Promise<void> {
    if (!this.simulationId) return;
    const today = new Date().toISOString().split('T')[0];
    const key = `briefing_dismissed_${today}`;
    if (localStorage.getItem(key)) return;

    const result = await heartbeatApi.getDailyBriefing(this.simulationId);
    if (result.success && result.data) {
      const data = result.data as Record<string, unknown>;
      if ((data.entries_24h as number) > 0) {
        this._briefingData = data;
      }
    }
  }

  private _handleBriefingDismissed(): void {
    this._briefingData = null;
  }

  private _initBureauDispatch(): void {
    if (!appState.canEdit.value) return;
    // Load feature statuses for badge dots + dispatch status
    void forgeStateManager.loadAllFeatureStatuses(this.simulationId);
    // Show non-blocking notice strip (not modal) on first visit
    const key = `bureau_dispatch_seen_${this.simulationId}`;
    if (!localStorage.getItem(key)) {
      this._bureauNoticeVisible = true;
      this._bureauNoticeTimer = setTimeout(() => {
        this._dismissBureauNotice();
      }, 10_000);
    }
  }

  private _dismissBureauNotice(): void {
    this._bureauNoticeVisible = false;
    localStorage.setItem(`bureau_dispatch_seen_${this.simulationId}`, '1');
    if (this._bureauNoticeTimer) {
      clearTimeout(this._bureauNoticeTimer);
      this._bureauNoticeTimer = undefined;
    }
  }

  private _openDispatchFromNotice(): void {
    this._dismissBureauNotice();
    this._dispatchOpen = true;
  }

  private _handleDispatchClose(): void {
    this._dispatchOpen = false;
    const key = `bureau_dispatch_seen_${this.simulationId}`;
    localStorage.setItem(key, '1');
  }

  private _handleDispatchNavigate(e: CustomEvent<{ tab: string }>): void {
    this._dispatchOpen = false;
    const key = `bureau_dispatch_seen_${this.simulationId}`;
    localStorage.setItem(key, '1');
    const slug = appState.currentSimulation.value?.slug ?? this.simulationId;
    this.dispatchEvent(
      new CustomEvent('navigate', {
        detail: `/simulations/${slug}/${e.detail.tab}`,
        bubbles: true,
        composed: true,
      }),
    );
    // Sync nav highlight after route change (URL updated synchronously by router)
    queueMicrotask(() => {
      this.shadowRoot
        ?.querySelector<HTMLElement & { _detectActiveTab?: () => void }>('velg-simulation-nav')
        ?._detectActiveTab?.();
    });
  }

  private _handleOpenBureauDispatch = (): void => {
    this._dispatchOpen = true;
  };

  disconnectedCallback(): void {
    document.removeEventListener('click', this._boundCloseDropdown);
    document.removeEventListener('keydown', this._boundKeyDown);
    this.removeEventListener('open-bureau-dispatch', this._handleOpenBureauDispatch);
    if (this._bureauNoticeTimer) clearTimeout(this._bureauNoticeTimer);
    themeService.resetTheme(this);
    this._appliedSimulationId = '';
    this._stopBleedPolling();
    this._clearEntropyTokens();
    this._stopScramble();
    this._clearCardTilts();
    if (this._decelerationFrame) cancelAnimationFrame(this._decelerationFrame);
    appState.setBleedStatus(null);
    super.disconnectedCallback();
  }

  protected async willUpdate(changedProperties: Map<PropertyKey, unknown>): Promise<void> {
    if (
      changedProperties.has('simulationId') &&
      this.simulationId &&
      this.simulationId !== this._appliedSimulationId
    ) {
      await this._applyTheme();
      this._fetchBleedStatus();
      this._startBleedPolling();
    }
  }

  private async _applyTheme(): Promise<void> {
    if (!this.simulationId) return;
    this._appliedSimulationId = this.simulationId;
    await themeService.applySimulationTheme(this.simulationId, this);
  }

  private async _fetchBleedStatus(): Promise<void> {
    if (!this.simulationId) return;
    const result = await healthApi.getBleedStatus(this.simulationId);
    if (result.success && result.data) {
      this._bleedStatus = result.data;
      appState.setBleedStatus(result.data);
      this._thresholdState = appState.thresholdState.value;
      this._applyThresholdClasses();
    }
  }

  private _applyThresholdClasses(): void {
    const wasCritical = this._previousThresholdState === 'critical';
    const isCritical = this._thresholdState === 'critical';

    this.classList.toggle('shell--critical', isCritical);
    this.classList.toggle('shell--ascendant', this._thresholdState === 'ascendant');

    // Entering critical: play deceleration hero moment + start scramble
    if (isCritical && !wasCritical && !this._hasPlayedDeceleration) {
      this._playDeceleration();
      this._startScramble();
    } else if (isCritical && !this._hasPlayedDeceleration) {
      // Already critical on load — instant ×3
      this._applyEntropyTokens(3);
      this._hasPlayedDeceleration = true;
      this._startScramble();
    }

    // Leaving critical: clear entropy tokens + stop scramble
    if (!isCritical && wasCritical) {
      this._clearEntropyTokens();
      this._stopScramble();
      this._hasPlayedDeceleration = false;
    }

    this._previousThresholdState = this._thresholdState;
  }

  /* ── Deceleration sequence ── */

  private _playDeceleration(): void {
    this._hasPlayedDeceleration = true;
    const totalSteps = 30;
    const totalDuration = 3000;
    const stepMs = totalDuration / totalSteps;
    let step = 0;

    const tick = () => {
      step++;
      // Ease-out: quick start, gradual end
      const t = step / totalSteps;
      const eased = 1 - (1 - t) * (1 - t);
      const multiplier = 1 + eased * 2; // 1→3

      this._applyEntropyTokens(multiplier);

      if (step < totalSteps) {
        setTimeout(() => {
          this._decelerationFrame = requestAnimationFrame(tick);
        }, stepMs);
      }
    };
    this._decelerationFrame = requestAnimationFrame(tick);
  }

  private _applyEntropyTokens(mult: number): void {
    // Override core animation duration tokens with entropy multiplier
    const baseDurations: Record<string, number> = {
      '--duration-fast': 100,
      '--duration-normal': 200,
      '--duration-slow': 300,
      '--duration-slower': 500,
      '--duration-entrance': 350,
      '--duration-stagger': 40,
      '--duration-cascade': 60,
    };
    for (const [token, baseMs] of Object.entries(baseDurations)) {
      this.style.setProperty(token, `${Math.round(baseMs * mult)}ms`);
    }
  }

  private _clearEntropyTokens(): void {
    const tokens = [
      '--duration-fast',
      '--duration-normal',
      '--duration-slow',
      '--duration-slower',
      '--duration-entrance',
      '--duration-stagger',
      '--duration-cascade',
    ];
    for (const token of tokens) {
      this.style.removeProperty(token);
    }
  }

  /* ── Text corruption (entropy scramble) ── */

  private static _GLITCH_CHARS = '▓░▒█╪╫╬┼╳⌧∅';

  private _startScramble(): void {
    this._stopScramble();
    this._scheduleNextScramble();
    this._scheduleNextCardShake();
    this._applyCardTilts();
  }

  private _stopScramble(): void {
    if (this._scrambleTimer) {
      clearTimeout(this._scrambleTimer);
      this._scrambleTimer = undefined;
    }
    if (this._cardShakeTimer) {
      clearTimeout(this._cardShakeTimer);
      this._cardShakeTimer = undefined;
    }
    this._clearCardTilts();
  }

  private _scheduleNextScramble(): void {
    this._scrambleTimer = setTimeout(
      () => {
        this._scrambleRandomLetter();
        this._scheduleNextScramble();
      },
      1500 + Math.random() * 3000,
    );
  }

  private _scrambleRandomLetter(): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const textNodes: Text[] = [];
    this._collectTextNodes(this, textNodes, 0);
    if (!textNodes.length) return;

    const targetNode = textNodes[Math.floor(Math.random() * textNodes.length)];
    const text = targetNode.textContent ?? '';

    // Find non-whitespace character positions
    const candidates: number[] = [];
    for (let i = 0; i < text.length; i++) {
      if (text[i] !== ' ' && text[i] !== '\n' && text[i] !== '\t') {
        candidates.push(i);
      }
    }
    if (!candidates.length) return;

    const pos = candidates[Math.floor(Math.random() * candidates.length)];
    const glyphs = VelgSimulationShell._GLITCH_CHARS;
    const glitch = glyphs[Math.floor(Math.random() * glyphs.length)];
    const originalFull = text;

    targetNode.textContent = text.slice(0, pos) + glitch + text.slice(pos + 1);

    // Restore after 200-600ms — only if text hasn't been changed by a re-render
    const expectedCorrupted = text.slice(0, pos) + glitch + text.slice(pos + 1);
    setTimeout(
      () => {
        if (targetNode.textContent === expectedCorrupted) {
          targetNode.textContent = originalFull;
        }
      },
      200 + Math.random() * 400,
    );
  }

  private _collectTextNodes(root: Node, nodes: Text[], depth: number): void {
    if (depth > 8 || nodes.length > 80) return;

    if (root instanceof Text) {
      const text = root.textContent?.trim();
      if (text && text.length >= 3) {
        nodes.push(root);
      }
      return;
    }

    // Descend into shadow DOMs
    if (root instanceof Element && root.shadowRoot) {
      for (const child of root.shadowRoot.childNodes) {
        this._collectTextNodes(child, nodes, depth + 1);
      }
    }

    for (const child of root.childNodes) {
      this._collectTextNodes(child, nodes, depth + 1);
    }
  }

  /* ── Card distortion (entropy tilt + shake) ── */

  private _findCards(): Element[] {
    const cards: Element[] = [];
    const cardTags = new Set(['VELG-GAME-CARD', 'VELG-BUILDING-CARD', 'VELG-AGENT-CARD']);

    const walk = (root: Element, depth: number) => {
      if (depth > 6 || cards.length > 30) return;

      if (cardTags.has(root.tagName)) {
        cards.push(root);
        return; // Don't walk inside cards
      }

      // Walk shadow DOM children
      if (root.shadowRoot) {
        for (const child of root.shadowRoot.querySelectorAll('*')) {
          if (child instanceof Element) walk(child, depth + 1);
        }
      }

      // Walk light DOM children (covers slotted content)
      for (const child of root.children) {
        walk(child, depth + 1);
      }
    };
    walk(this, 0);
    return cards;
  }

  private _applyCardTilts(): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cards = this._findCards();
    for (const card of cards) {
      const el = card as HTMLElement;
      const tilt = (Math.random() - 0.5) * 5; // -2.5deg to +2.5deg
      el.style.transition = 'none';
      el.style.transform = `rotate(${tilt.toFixed(2)}deg)`;
    }
  }

  private _clearCardTilts(): void {
    const cards = this._findCards();
    for (const card of cards) {
      const el = card as HTMLElement;
      el.style.transition = '';
      el.style.transform = '';
    }
  }

  private _scheduleNextCardShake(): void {
    this._cardShakeTimer = setTimeout(
      () => {
        this._shakeRandomCard();
        this._scheduleNextCardShake();
      },
      3000 + Math.random() * 5000,
    );
  }

  private _shakeRandomCard(): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cards = this._findCards();
    if (!cards.length) return;

    const card = cards[Math.floor(Math.random() * cards.length)] as HTMLElement;
    const baseTilt = parseFloat(card.style.transform?.match(/rotate\((.+)deg\)/)?.[1] || '0');

    // Brief flicker: opacity dip + micro-shake
    card.style.transition = 'none';
    const shake = async () => {
      const steps = [
        { r: baseTilt + 3, o: 0.6 },
        { r: baseTilt - 2, o: 0.8 },
        { r: baseTilt + 1.5, o: 0.65 },
        { r: baseTilt - 0.5, o: 0.9 },
        { r: baseTilt, o: 1 },
      ];
      for (const step of steps) {
        card.style.transform = `rotate(${step.r.toFixed(2)}deg)`;
        card.style.opacity = String(step.o);
        await new Promise((r) => setTimeout(r, 60));
      }
      // Snap to new tilt — no easing
      const newTilt = (Math.random() - 0.5) * 5;
      card.style.transform = `rotate(${newTilt.toFixed(2)}deg)`;
      card.style.opacity = '1';
    };
    shake();
  }

  private _startBleedPolling(): void {
    this._stopBleedPolling();
    this._bleedPollTimer = setInterval(() => this._fetchBleedStatus(), 60_000);
  }

  private _stopBleedPolling(): void {
    if (this._bleedPollTimer) {
      clearInterval(this._bleedPollTimer);
      this._bleedPollTimer = undefined;
    }
  }

  private _navigate(path: string, e: Event): void {
    e.preventDefault();
    this.dispatchEvent(
      new CustomEvent('navigate', { detail: path, bubbles: true, composed: true }),
    );
  }

  /* ── Dropdown lifecycle ── */

  private _openSwitcher(): void {
    this._simSwitcherOpen = true;
    this._focusedIndex = -1;
    document.addEventListener('click', this._boundCloseDropdown);
    document.addEventListener('keydown', this._boundKeyDown);
  }

  private _closeSwitcher(): void {
    this._simSwitcherOpen = false;
    this._focusedIndex = -1;
    document.removeEventListener('click', this._boundCloseDropdown);
    document.removeEventListener('keydown', this._boundKeyDown);
  }

  private _toggleSimSwitcher(e: Event): void {
    e.stopPropagation();
    if (this._simSwitcherOpen) {
      this._closeSwitcher();
    } else {
      // Compute dropdown position from trigger's bounding rect
      const trigger = e.currentTarget as HTMLElement;
      const rect = trigger.getBoundingClientRect();
      this._dropdownPos = { top: rect.bottom + 4, left: rect.left };
      this._openSwitcher();
    }
  }

  private _onOutsideClick(e: MouseEvent): void {
    if (!e.composedPath().includes(this)) {
      this._closeSwitcher();
    }
  }

  /* ── Keyboard navigation ── */

  private _onKeyDown(e: KeyboardEvent): void {
    if (!this._simSwitcherOpen) return;

    const sims = appState.simulations.value;
    const count = sims.length;
    if (!count) return;

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        this._closeSwitcher();
        // Return focus to trigger
        this.shadowRoot?.querySelector<HTMLButtonElement>('.breadcrumb__trigger')?.focus();
        break;
      case 'ArrowDown':
        e.preventDefault();
        this._focusedIndex = (this._focusedIndex + 1) % count;
        this._focusOption();
        break;
      case 'ArrowUp':
        e.preventDefault();
        this._focusedIndex = this._focusedIndex <= 0 ? count - 1 : this._focusedIndex - 1;
        this._focusOption();
        break;
      case 'Home':
        e.preventDefault();
        this._focusedIndex = 0;
        this._focusOption();
        break;
      case 'End':
        e.preventDefault();
        this._focusedIndex = count - 1;
        this._focusOption();
        break;
      case 'Enter':
        if (this._focusedIndex >= 0 && this._focusedIndex < count) {
          e.preventDefault();
          this._selectSimulation(sims[this._focusedIndex].slug, e);
        }
        break;
    }
  }

  private _focusOption(): void {
    requestAnimationFrame(() => {
      const options = this.shadowRoot?.querySelectorAll<HTMLButtonElement>('.breadcrumb__option');
      options?.[this._focusedIndex]?.focus();
    });
  }

  private _selectSimulation(slug: string, e: Event): void {
    this._closeSwitcher();
    this._navigate(`/simulations/${slug}/${this.view}`, e);
  }

  /* ── Render ── */

  private _renderSimSwitcher(simName: string) {
    const sims = appState.simulations.value;
    const currentId = appState.currentSimulation.value?.id;
    const hasSwitchTargets = sims.length > 1 || (sims.length === 1 && sims[0].id !== currentId);

    if (!hasSwitchTargets) {
      const slug = appState.currentSimulation.value?.slug ?? this.simulationId;
      return html`
        <button
          class="breadcrumb__link"
          @click=${(e: Event) => this._navigate(`/simulations/${slug}/lore`, e)}
        >${simName}</button>
      `;
    }

    return html`
      <div class="breadcrumb__switcher">
        <button
          class="breadcrumb__trigger"
          aria-expanded=${this._simSwitcherOpen ? 'true' : 'false'}
          aria-haspopup="listbox"
          @click=${(e: Event) => this._toggleSimSwitcher(e)}
        >
          ${simName}
          ${icons.chevronDown(10)}
        </button>
        ${
          this._simSwitcherOpen
            ? html`
              <div
                class="breadcrumb__dropdown"
                role="listbox"
                aria-label=${msg('Switch simulation')}
                style="top: ${this._dropdownPos.top}px; left: ${this._dropdownPos.left}px"
              >
                ${sims.map(
                  (s, i) => html`
                    <button
                      class="breadcrumb__option"
                      role="option"
                      style="animation-delay: ${i * 0.03}s"
                      aria-selected=${s.id === currentId ? 'true' : 'false'}
                      aria-current=${s.id === currentId ? 'true' : 'false'}
                      tabindex=${this._focusedIndex === i ? '0' : '-1'}
                      @click=${(e: Event) => this._selectSimulation(s.slug, e)}
                    >${s.name}</button>
                  `,
                )}
              </div>
            `
            : nothing
        }
      </div>
    `;
  }

  private _renderBreadcrumb() {
    const sim = appState.currentSimulation.value;
    const simName = sim?.name ?? '';
    const viewLabel = getTabLabel(this.view);
    const sep = html`<span class="breadcrumb__sep">//</span>`;

    return html`
      <nav class="breadcrumb" aria-label=${msg('Breadcrumb')}>
        <button
          class="breadcrumb__link"
          @click=${(e: Event) => this._navigate('/dashboard', e)}
        >${msg('Dashboard')}</button>
        ${sep}
        ${
          simName
            ? html`
              ${this._renderSimSwitcher(simName)}
              ${sep}
            `
            : ''
        }
        <span class="breadcrumb__current">${viewLabel}</span>
      </nav>
    `;
  }

  protected render() {
    const hasBleeds = this._bleedStatus && this._bleedStatus.active_bleeds.length > 0;
    const isCritical = this._thresholdState === 'critical';
    const isAscendant = this._thresholdState === 'ascendant';

    return html`
      <velg-svg-filters></velg-svg-filters>
      <div class="shell">
        ${this._bleedStatus?.fracture_warning ? this._renderFractureBanner() : nothing}
        <velg-simulation-header .simulationId=${this.simulationId} ?introHexagon=${this._bureauNoticeVisible}></velg-simulation-header>
        ${
          this._bureauNoticeVisible
            ? html`
          <velg-bureau-notice
            @notice-dismiss=${this._dismissBureauNotice}
            @notice-open-dispatch=${this._openDispatchFromNotice}
          ></velg-bureau-notice>
        `
            : nothing
        }
        ${this._renderBreadcrumb()}
        <velg-simulation-nav .simulationId=${this.simulationId}></velg-simulation-nav>
        <div class="shell__content shell__overlays">
          ${
            hasBleeds
              ? html`<velg-bleed-palimpsest-overlay
                .bleedStatus=${this._bleedStatus}
                .simulationId=${this.simulationId}
              ></velg-bleed-palimpsest-overlay>`
              : nothing
          }
          ${
            isCritical
              ? html`<velg-entropy-overlay
                .active=${true}
                .healthPercent=${Math.round((this._bleedStatus?.bleed_permeability ?? 0) * 100)}
                .overallHealth=${this._bleedStatus?.overall_health ?? 0.5}
              ></velg-entropy-overlay>`
              : nothing
          }
          ${
            isAscendant
              ? html`<velg-ascendancy-aura .active=${true}></velg-ascendancy-aura>`
              : nothing
          }
          <slot></slot>
        </div>
      </div>
      ${
        isCritical
          ? html`
            ${
              this._isEpoch
                ? html`<velg-entropy-timer
                  .cyclesRemaining=${this._bleedStatus?.entropy_cycles_remaining ?? null}
                ></velg-entropy-timer>`
                : nothing
            }
            <velg-desperate-actions-panel
              .simulationId=${this.simulationId}
            ></velg-desperate-actions-panel>
          `
          : nothing
      }
      ${
        this._briefingData
          ? html`
        <velg-daily-briefing
          .simulationId=${this.simulationId}
          .simulationSlug=${appState.currentSimulation.value?.slug ?? this.simulationId}
          .briefingData=${this._briefingData}
          @briefing-dismissed=${this._handleBriefingDismissed}
        ></velg-daily-briefing>
      `
          : nothing
      }
      ${
        appState.canEdit.value
          ? html`
        <velg-bureau-dispatch
          .simulationId=${this.simulationId}
          ?open=${this._dispatchOpen}
          @dispatch-close=${this._handleDispatchClose}
          @dispatch-navigate=${this._handleDispatchNavigate}
        ></velg-bureau-dispatch>
      `
          : nothing
      }
      <velg-platform-footer></velg-platform-footer>
    `;
  }

  private _renderFractureBanner() {
    const bleeds = this._bleedStatus?.active_bleeds ?? [];
    const source = bleeds[0]?.source_simulation_name ?? '???';
    const integrity = Math.round((1 - (this._bleedStatus?.bleed_permeability ?? 0)) * 100);

    return html`
      <div class="fracture-banner" role="alert" aria-live="assertive">
        <span class="fracture-banner__text">
          BUREAU NOTICE // BLEED THRESHOLD EXCEEDED //
          ${source} → ${msg('THIS SIMULATION')} //
          SIGNAL INTEGRITY: ${integrity}% //
          BUREAU NOTICE // BLEED THRESHOLD EXCEEDED //
          ${source} → ${msg('THIS SIMULATION')} //
          SIGNAL INTEGRITY: ${integrity}%
        </span>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-simulation-shell': VelgSimulationShell;
  }
}

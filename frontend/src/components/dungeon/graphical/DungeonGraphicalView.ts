/**
 * Dungeon Graphical View — the graphical rendering of a Resonance Dungeon,
 * running in parallel to the terminal HUD (Phase 1 of the rollout).
 *
 * Core idea: "the archetype meter IS the environment". The single
 * server-authoritative resource meter is normalized by the pure resolver
 * (utils/dungeon-environment.ts) into one pressure signal that drives a
 * CSS scene backdrop — rising water, closing darkness, structural collapse,
 * decay, ember heat, fragmentation, deja-vu flicker, parasitic pulse.
 *
 * This view is a SECOND CONSUMER of dungeonState. Zero game logic lives here:
 *   - reads dungeonState signals (server-authoritative)
 *   - embeds the existing HUD components VERBATIM (header / party / map /
 *     quick-actions / combat-bar / enemy-panel) as overlays — they are
 *     self-contained SignalWatchers
 *   - routes their 'terminal-command' events through the same command
 *     pipeline as the terminal view (parseAndExecute)
 *
 * The combat juice (PixiJS) and generated enemy/backdrop imagery arrive in
 * Phases 2–3. The scene backdrop here is pure CSS (no canvas yet), so the
 * light-DOM/Pixi host is deferred to a dedicated child component in Phase 2.
 *
 * Lifecycle mirrors DungeonTerminalView: it must init terminal state + zones
 * and run recovery itself, because a persisted 'graphical' preference can mount
 * this view first without the terminal view ever mounting.
 *
 * Loaded via dynamic import() from <velg-dungeon-view> (code-split).
 *
 * Pattern: DungeonTerminalView.ts (SignalWatcher, forced-dark, command routing).
 */

import { localized, msg, str } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import { appState } from '../../../services/AppStateManager.js';
import { dungeonState } from '../../../services/DungeonStateManager.js';
import { captureError } from '../../../services/SentryService.js';
import { terminalState } from '../../../services/TerminalStateManager.js';
import type {
  AgentCombatStateClient,
  AvailableDungeonResponse,
  Condition,
  DungeonPhase,
  DungeonRunCreate,
  PendingOrder,
} from '../../../types/dungeon.js';
import type { Agent, AptitudeSet } from '../../../types/index.js';
import type { TerminalLine } from '../../../types/terminal.js';
import { abilityIntent, abilityPictogramUrl } from '../../../utils/ability-pictograms.js';
import { dungeonBackdropUrl } from '../../../utils/dungeon-backdrop-data.js';
import { dungeonEnemyArtUrl } from '../../../utils/dungeon-enemy-art.js';
import {
  autoPickPartyIds,
  checkPartyComposition,
  partyCompositionWarningText,
  startDungeonRun,
} from '../../../utils/dungeon-entry-flow.js';
import { type FxProfile, resolveDungeonEnvironment } from '../../../utils/dungeon-environment.js';
import {
  adminUnlockedLabel,
  buildEnemyDisplayNames,
  describeEnemy,
  type EnemyFacts,
  getArchetypeBriefing,
  getArchetypeDisplayName,
  resonanceMagnitudeLabel,
  topAptitudes,
} from '../../../utils/dungeon-formatters.js';
import { icons } from '../../../utils/icons.js';
import { localized as localizedValue } from '../../../utils/locale-fields.js';
import { OPERATIVE_LABEL } from '../../../utils/operative-constants.js';
import { parseAndExecute } from '../../../utils/terminal-commands.js';
import { initializeTerminalZones } from '../../../utils/terminal-initialization.js';
import { getInitials } from '../../../utils/text.js';
import { VelgToast } from '../../shared/Toast.js';
import '../../shared/EmptyState.js';
import '../../shared/Lightbox.js';
import '../../shared/LoadingState.js';
import '../../shared/VelgAvatar.js';
import {
  terminalAnimations,
  terminalComponentTokens,
  terminalTokens,
} from '../../shared/terminal-theme-styles.js';
import '../DungeonExpeditionLog.js';
import '../DungeonCombatBar.js';
import '../DungeonEnemyPanel.js';
import '../DungeonHeader.js';
import '../DungeonMap.js';
import '../DungeonPartyPanel.js';
import '../DungeonQuickActions.js';
import '../DungeonViewToggle.js';
import { dungeonGraphicalStyles } from './dungeon-graphical-styles.js';
import './DungeonChronicle.js';
import './DungeonCombatFx.js';
import type { RoomDescription } from '../../../utils/dungeon-room-text.js';

/** localStorage key for the map-rail collapsed preference (client-only UI
 *  state, like the view-mode key — never reset by applyState()/clear()). */
const RAIL_COLLAPSED_STORAGE_KEY = 'dungeon_map_rail_collapsed';

/** Viewport width below which the map rail may collapse. Mirrors the
 *  `max-width: 1199px` media query in dungeon-graphical-styles.ts, where the
 *  HUD drops from three columns to one. Above it the rail costs the stage
 *  nothing it cannot spare, so the handoff strikes the control (README §4.1:
 *  "bei fehlender Platznot kein UX-Wert"). */
const RAIL_COLLAPSE_MEDIA = '(max-width: 1199px)';

/** Localized meter labels per fx profile (resolver returns no user strings). */
function meterLabelFor(fx: FxProfile): string {
  switch (fx) {
    case 'water':
      return msg('Water Level');
    case 'darkness':
      // The readout bar fills with PRESSURE (full = worst). For The Shadow,
      // pressure rises as visibility drains, so the rising bar is the encroaching
      // gloom, not visibility itself — labelling it "Visibility" would read backwards
      // (empty bar at full sight). Name the threat that rises.
      return msg('Gloom');
    case 'decay':
      return msg('Decay');
    case 'tilt':
      // Same inversion as darkness: The Tower's pressure rises as stability is lost,
      // so the rising bar is structural instability, not stability.
      return msg('Instability');
    case 'pulse':
      return msg('Attachment');
    case 'forge':
      return msg('Insight');
    case 'shards':
      return msg('Fracture');
    case 'flicker':
      return msg('Awareness');
    default:
      return msg('Resonance');
  }
}

@localized()
@customElement('velg-dungeon-graphical-view')
export class VelgDungeonGraphicalView extends SignalWatcher(LitElement) {
  static styles = [
    terminalTokens,
    terminalComponentTokens,
    terminalAnimations,
    dungeonGraphicalStyles,
  ];

  @property({ type: String }) simulationId = '';

  @state() private _initialized = false;
  @state() private _error: string | null = null;
  /** Whether the left map rail is collapsed to a thin strip (reclaiming scene
   *  width). Client-only UI preference, persisted to localStorage and never
   *  touched by applyState()/clear() — mirrors viewMode. */
  @state() private _railCollapsed = this._getPersistedRailCollapsed();
  /** Whether the viewport is narrow enough for that preference to apply.
   *
   *  The collapse is a small-screen affordance, and on desktop it is now gone.
   *  Removing only the BUTTON would have been the shallower fix and a real bug:
   *  the preference outlives the session in localStorage, so a viewer who
   *  collapsed the rail on a phone would meet a 40px strip on a desktop with no
   *  control to reopen it. The preference is therefore kept and made inert —
   *  narrow viewports behave exactly as before. */
  @state() private _railCollapsible = false;
  /** Backdrop URL that failed to load (local storage missing the asset, 404,
   *  etc.) → fall back to the CSS-only chamber for that URL. Keyed by URL so a
   *  new archetype's backdrop is retried. */
  @state() private _failedBackdrop: string | null = null;

  /** Art URLs that failed to load, so the creature falls back to its silhouette
   *  instead of leaving a broken box in the band. A Set rather than the
   *  backdrop's single slot: a fight holds up to four distinct creatures, and
   *  one missing asset must not blank the others. Replaced, never mutated —
   *  Lit compares by reference. */
  @state() private _failedEnemyArt: ReadonlySet<string> = new Set();
  /** Creature currently enlarged from the band, or null. */
  @state() private _enemyArtLightbox: { url: string; facts: EnemyFacts } | null = null;
  /** Backdrop URLs that have painted at least once. Keyed by URL so moving
   *  between archetypes re-shows the skeleton for an image not yet seen, while
   *  a cached one appears without a flash of placeholder. */
  @state() private _decodedBackdrops: ReadonlySet<string> = new Set();
  /** Archetype whose party is being assembled in the graphical picker. Null =
   *  show the archetype grid; non-null = show the agent picker. This replaces
   *  the terminal-only agent picker so a run can start entirely from the
   *  graphical lobby (no terminal toggle required). */
  @state() private _pickerArchetype: string | null = null;
  /** Agent IDs selected for the descent party (2–4 required to begin). */
  @state() private _pickerSelection: string[] = [];
  /** True while the create-run request is in flight (disables the controls). */
  @state() private _startingRun = false;
  /**
   * The descent that just ended, held so its outcome can be read.
   *
   * `_exitDungeon()` (dungeon-commands.ts) tears the run down BEFORE the
   * handler's closing lines — the victory block, the loot list, the wipe — are
   * appended. The terminal does not mind: its scrollback is the outcome screen.
   * The graphical view had no scrollback, so `isInDungeon` flipped false and
   * render() swapped to the lobby in the same tick, and a player never saw how
   * their run ended. This holds the last known run so the view can show it.
   *
   * View-local on purpose: the shared state model is not wrong, and the
   * terminal must keep behaving exactly as it does (DungeonView's standing
   * contract). The panel is a SECOND RENDERER of the chronicle stream, which is
   * the same principle the chronicle itself is built on.
   */
  @state() private _endedRun: { archetype: string; phase: DungeonPhase } | null = null;

  /** Rolling copy of the run state, so the tick that nulls it still knows what
   *  ended. Not @state — it feeds `_endedRun`, which is what renders. */
  private _lastRunSnapshot: { archetype: string; phase: DungeonPhase } | null = null;

  private _wakeLock: WakeLockReleasable | null = null;
  private _resizeObserver: ResizeObserver | null = null;
  private _railMedia: MediaQueryList | null = null;
  private readonly _onRailMediaChange = (event: MediaQueryListEvent): void => {
    this._railCollapsible = event.matches;
  };

  override async connectedCallback(): Promise<void> {
    super.connectedCallback();
    // Measure the host's real top offset (below the global header + simulation
    // header/nav) so the view fills exactly to the viewport bottom. Re-measure
    // on viewport resize — the chrome above can change height (responsive,
    // theme, alpha build-strip). rAF defers the first read past initial layout.
    requestAnimationFrame(() => this._measureHostOffset());
    this._resizeObserver = new ResizeObserver(() => this._measureHostOffset());
    this._resizeObserver.observe(document.documentElement);
    // Optional chaining, not a guard: happy-dom supplies no matchMedia, and a
    // missing one must leave the rail expanded (the desktop shape), never throw.
    this._railMedia = globalThis.matchMedia?.(RAIL_COLLAPSE_MEDIA) ?? null;
    if (this._railMedia) {
      this._railCollapsible = this._railMedia.matches;
      this._railMedia.addEventListener('change', this._onRailMediaChange);
    }
    await this._initialize();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
    this._railMedia?.removeEventListener('change', this._onRailMediaChange);
    this._railMedia = null;
    this._releaseWakeLock();
    terminalState.clearDungeon();
    terminalState.dispose();
  }

  /**
   * Watch for the run ending under us.
   *
   * Reading the signals here keeps them tracked by SignalWatcher, so the flip
   * is observed in the same update that would otherwise have shown the lobby.
   */
  protected willUpdate(): void {
    const state = dungeonState.clientState.value;
    if (state) {
      this._lastRunSnapshot = { archetype: state.archetype, phase: state.phase };
      if (this._endedRun) this._endedRun = null;
      return;
    }
    // clientState went null while we were showing a scene: the run just ended.
    if (this._lastRunSnapshot && !this._endedRun) {
      this._endedRun = this._lastRunSnapshot;
      this._lastRunSnapshot = null;
    }
  }

  /** Dismiss the outcome and return to the archetype grid. */
  private _dismissOutcome(): void {
    this._endedRun = null;
  }

  /** A backdrop has painted: drop the skeleton standing in for it. Replaced,
   *  never mutated — Lit compares by reference (same rule as _failedEnemyArt). */
  private _markBackdropReady(url: string): void {
    if (this._decodedBackdrops.has(url)) return;
    this._decodedBackdrops = new Set([...this._decodedBackdrops, url]);
  }

  /** Couple the host height to its real top offset (see the `:host` height
   *  rule). Measured only at rest — once the view fits, the page no longer
   *  scrolls, so a scrolled reading would be a transient we skip. */
  private _measureHostOffset(): void {
    if (window.scrollY > 4) return;
    const top = Math.round(this.getBoundingClientRect().top);
    if (top > 0) this.style.setProperty('--_host-offset', `${top}px`);
  }

  // ── Initialization (mirrors DungeonTerminalView) ─────────────────────────

  private async _initialize(): Promise<void> {
    const sid = this.simulationId || appState.simulationId.value;
    if (!sid) {
      this._error = msg('No simulation context.');
      return;
    }
    try {
      terminalState.initialize(sid);
      await initializeTerminalZones(sid);

      const recovered = await dungeonState.tryRecover();
      if (recovered) {
        const runId = dungeonState.runId.value;
        if (runId) {
          terminalState.initializeDungeon(
            runId,
            getArchetypeDisplayName(dungeonState.clientState.value?.archetype ?? ''),
          );
          await this._acquireWakeLock();
        }
      } else {
        await dungeonState.loadAvailable(sid);
      }
      this._initialized = true;

      // Deep-link: auto-select archetype from detail page bridge.
      const pendingArchetype = appState.pendingDungeonArchetype.value;
      if (pendingArchetype && !dungeonState.isInDungeon.value) {
        appState.pendingDungeonArchetype.value = null;
        await this.updateComplete;
        await this._runCommand(`dungeon ${pendingArchetype}`);
      }
    } catch (err) {
      this._error = err instanceof Error ? err.message : msg('Initialization failed.');
      captureError(err, { source: 'VelgDungeonGraphicalView._initialize' });
    }
  }

  // ── Wake Lock ────────────────────────────────────────────────────────────

  private async _acquireWakeLock(): Promise<void> {
    try {
      if ('wakeLock' in navigator) {
        this._wakeLock = await (
          navigator as Navigator & {
            wakeLock: { request(type: string): Promise<WakeLockReleasable> };
          }
        ).wakeLock.request('screen');
      }
    } catch (err) {
      captureError(err, { source: 'VelgDungeonGraphicalView._acquireWakeLock' });
    }
  }

  private _releaseWakeLock(): void {
    if (this._wakeLock) {
      this._wakeLock
        .release()
        .catch((err) => captureError(err, { source: 'VelgDungeonGraphicalView._releaseWakeLock' }));
      this._wakeLock = null;
    }
  }

  // ── Map rail ─────────────────────────────────────────────────────────────
  // The dungeon map (room DAG) is the primary navigation surface — it lives in
  // a persistent left rail at its native ~320px width. Clicking a room node
  // dispatches a `terminal-command` move that the .dungeon-hud @terminal-command
  // handler routes through the same pipeline. The rail can be collapsed to a
  // thin strip to reclaim scene width; the preference persists in localStorage.

  /** The preference AND the room for it. One source for the HUD class and the
   *  rail renderer, so the 40px column and the strip control can never disagree. */
  private get _railIsCollapsed(): boolean {
    return this._railCollapsed && this._railCollapsible;
  }

  private _toggleRail(): void {
    this._railCollapsed = !this._railCollapsed;
    this._persistRailCollapsed(this._railCollapsed);
  }

  private _getPersistedRailCollapsed(): boolean {
    try {
      return globalThis.localStorage?.getItem(RAIL_COLLAPSED_STORAGE_KEY) === 'true';
    } catch (err) {
      captureError(err, { source: 'VelgDungeonGraphicalView._getPersistedRailCollapsed' });
      return false;
    }
  }

  private _persistRailCollapsed(collapsed: boolean): void {
    try {
      globalThis.localStorage?.setItem(RAIL_COLLAPSED_STORAGE_KEY, collapsed ? 'true' : 'false');
    } catch (err) {
      captureError(err, { source: 'VelgDungeonGraphicalView._persistRailCollapsed' });
    }
  }

  // ── Command routing (same pipeline as the terminal view) ─────────────────

  private _handleTerminalCommand(e: CustomEvent<string>): void {
    e.stopPropagation();
    void this._runCommand(e.detail);
  }

  private async _runCommand(command: string): Promise<void> {
    if (!command) return;
    terminalState.isLoading.value = true;
    try {
      const lines = await parseAndExecute(command);
      this._absorb(lines);
    } catch (err) {
      captureError(err, { source: 'VelgDungeonGraphicalView._runCommand', command });
      VelgToast.error(err instanceof Error ? err.message : msg('Command failed.'));
    } finally {
      terminalState.isLoading.value = false;
    }
  }

  /**
   * The single sink for command output in this view.
   *
   * `appendOutput` keeps the terminal buffer in sync (so toggling back to the
   * terminal shows a continuous session) and, in dungeon mode, mirrors the same
   * lines into the chronicle. Both call sites go through here so neither can
   * quietly grow a path that renders nowhere — which is exactly how the rolls
   * and results went missing in the first place.
   *
   * A refusal from the server ("Cannot move in phase: rest") also gets a toast.
   * The chronicle records it, but a player looking at the stage would otherwise
   * see a button do nothing at all. NOT captureError: a refused move is the
   * game answering, not a defect — the Sentry path stays reserved for the
   * thrown exceptions the callers already handle.
   */
  private _absorb(lines: TerminalLine[]): void {
    terminalState.appendOutput(lines);
    const refusal = lines.find((line) => line.type === 'error');
    if (refusal?.content) VelgToast.error(refusal.content);
  }

  // ── Agent picker (graphical lobby → party assembly → run start) ────────────

  /** Open the party picker for an archetype. Loads the roster lazily (cached
   *  in dungeonState until clear()). */
  private async _openPicker(archetype: string): Promise<void> {
    this._pickerArchetype = archetype;
    this._pickerSelection = [];
    const sid = this.simulationId || appState.simulationId.value || '';
    if (!sid) return;
    try {
      await dungeonState.loadPickerAgents(sid);
    } catch (err) {
      captureError(err, { source: 'VelgDungeonGraphicalView._openPicker', command: archetype });
      VelgToast.error(msg('Failed to load agents.'));
    }
  }

  private _closePicker(): void {
    this._pickerArchetype = null;
    this._pickerSelection = [];
  }

  /** Toggle an agent in/out of the party. Caps the party at 4. */
  private _toggleAgent(agentId: string): void {
    const sel = this._pickerSelection;
    if (sel.includes(agentId)) {
      this._pickerSelection = sel.filter((id) => id !== agentId);
    } else if (sel.length < 4) {
      this._pickerSelection = [...sel, agentId];
    }
  }

  /** Auto-pick the top 3 agents by aggregate aptitude — same heuristic as the
   *  terminal `dungeon <archetype> auto` path (shared autoPickPartyIds). */
  private _autoSelect(): void {
    this._pickerSelection = autoPickPartyIds(
      dungeonState.pickerAgents.value,
      dungeonState.pickerAptitudes.value,
    );
  }

  /** Start the run with the selected party. startDungeonRun applies the new
   *  state, so isInDungeon flips true and render() swaps to the scene. */
  private async _beginRun(): Promise<void> {
    const archetype = this._pickerArchetype;
    const party = this._pickerSelection;
    if (!archetype || party.length < 2 || this._startingRun) return;
    const sid = this.simulationId || appState.simulationId.value || '';
    if (!sid) return;
    const dungeon = dungeonState.availableDungeons.value.find((d) => d.archetype === archetype);
    if (!dungeon) return;

    this._startingRun = true;
    terminalState.isLoading.value = true;
    try {
      const lines = await startDungeonRun(sid, {
        archetype: archetype as DungeonRunCreate['archetype'],
        party_agent_ids: party,
        difficulty: dungeon.suggested_difficulty,
      });
      this._absorb(lines);
      this._closePicker();
    } catch (err) {
      captureError(err, { source: 'VelgDungeonGraphicalView._beginRun', command: archetype });
      VelgToast.error(err instanceof Error ? err.message : msg('Failed to begin the descent.'));
    } finally {
      this._startingRun = false;
      terminalState.isLoading.value = false;
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  protected render() {
    if (this._error) {
      return html`<div class="gview-error">[ERROR] ${this._error}</div>`;
    }
    if (!this._initialized) {
      return html`<div class="gview-loading">${msg('Rendering descent...')}</div>`;
    }
    const sid = this.simulationId || appState.simulationId.value || '';
    if (dungeonState.isInDungeon.value) return this._renderScene();
    if (this._endedRun) return this._renderOutcome(this._endedRun);
    return this._renderLobby(sid);
  }

  private _renderScene() {
    const archetype = dungeonState.clientState.value?.archetype ?? '';
    const env = resolveDungeonEnvironment(archetype, dungeonState.archetypeState.value);
    const inCombat = dungeonState.isInCombat.value;
    const description = dungeonState.lastRoomDescription.value;
    const meterLabel = meterLabelFor(env.fxProfile);
    const accent = ACCENT_BY_FX[env.fxProfile];
    const backdropUrl = dungeonBackdropUrl(archetype);
    const showArt = backdropUrl !== null && backdropUrl !== this._failedBackdrop;
    // The aim, read once for the whole scene: the spotlight class, the hint bar
    // and the two bands all derive from this one value rather than each asking
    // the store again. (README §4.6 — one data source, three anchors.)
    const pending = dungeonState.pendingOrder.value;

    return html`
      <div
        class="dungeon-hud ${this._railIsCollapsed ? 'dungeon-hud--rail-collapsed' : ''} ${
          inCombat ? 'dungeon-hud--combat' : ''
        }"
        @terminal-command=${this._handleTerminalCommand}
      >
        <div class="dungeon-hud__header" role="banner" aria-label=${msg('Dungeon status')}>
          <velg-dungeon-header></velg-dungeon-header>
          <div class="gview-toggle">
            <velg-dungeon-view-toggle></velg-dungeon-view-toggle>
          </div>
        </div>

        ${this._renderRail()}

        <div class="dungeon-hud__main" role="main" aria-label=${msg('Dungeon scene')}>
          <div
            class="scene ${pending ? `scene--aiming scene--aiming-${pending.scope}` : ''}"
            data-tier=${env.tier}
            style="--_pressure:${env.pressure01};--_fx-accent:${accent}"
          >
            ${this._renderAimBar(pending)}
            <div class="scene__backdrop" data-fx=${env.fxProfile} aria-hidden="true">
              <div class="scene__plane"></div>
            </div>
            ${
              showArt
                ? html`<div class="scene__art" aria-hidden="true">
                  ${
                    this._decodedBackdrops.has(backdropUrl)
                      ? nothing
                      : html`<div class="scene__skeleton"></div>`
                  }
                  <img
                    class="scene__art-img"
                    src=${backdropUrl}
                    alt=""
                    decoding="async"
                    @load=${() => this._markBackdropReady(backdropUrl)}
                    @error=${() => {
                      this._failedBackdrop = backdropUrl;
                      captureError(new Error(`Dungeon backdrop failed to load: ${backdropUrl}`), {
                        source: 'VelgDungeonGraphicalView._renderScene',
                      });
                    }}
                  />
                </div>`
                : html`
                  <div class="scene__floor" aria-hidden="true"></div>
                  <div class="scene__motes" aria-hidden="true"></div>
                `
            }
            ${this._renderEnemies()}
            ${this._renderParty()}
            ${
              // The flood is a GRID child, not a plane inside the backdrop: it
              // is the one profile anchored to the floor, and it shares row 4
              // with the chamber panel (both pinned — see .scene__flood).
              env.fxProfile === 'water'
                ? html`<div class="scene__flood" aria-hidden="true"></div>`
                : nothing
            }
            <div class="scene__alarm" aria-hidden="true"></div>

            <velg-dungeon-combat-fx></velg-dungeon-combat-fx>

            <!-- The number was reachable only through the aria-label: no
                 visible figure, and no title either, so a sighted player could
                 read the bar's length and nothing else. A hover tooltip would
                 have been the smaller fix and the wrong one — it is unreachable
                 on touch, and this meter is the archetype's central pressure
                 reading. It travels as a number, next to the word it belongs
                 to. -->
            <div
              class="scene__readout"
              aria-label=${`${meterLabel} ${Math.round(env.pressure01 * 100)}%`}
            >
              <span class="scene__readout-head">
                <span>${meterLabel}</span>
                <span class="scene__readout-value" aria-hidden="true"
                  >${Math.round(env.pressure01 * 100)}%</span
                >
              </span>
              <div class="scene__readout-bar">
                <div class="scene__readout-fill"></div>
              </div>
            </div>

            ${this._renderChamberText(description)}
          </div>
        </div>

        <velg-lightbox
          .src=${this._enemyArtLightbox?.url ?? null}
          .alt=${this._enemyArtLightbox?.facts.spoken ?? ''}
          .caption=${this._enemyArtLightbox?.facts.spoken ?? ''}
          @lightbox-close=${() => {
            this._enemyArtLightbox = null;
          }}
        ></velg-lightbox>

        <div class="dungeon-hud__side">
          <div class="dungeon-hud__party" role="complementary" aria-label=${msg('Party status')}>
            <velg-dungeon-party-panel></velg-dungeon-party-panel>
          </div>
          <div
            class="dungeon-hud__chronicle"
            role="complementary"
            aria-label=${msg('Chronicle of the descent')}
          >
            <velg-dungeon-chronicle></velg-dungeon-chronicle>
          </div>
        </div>

        <div class="dungeon-hud__actions" role="toolbar" aria-label=${msg('Actions')}>
          ${
            inCombat
              ? html`<velg-dungeon-combat-bar compact></velg-dungeon-combat-bar>`
              : html`<velg-dungeon-quick-actions></velg-dungeon-quick-actions>`
          }
        </div>
      </div>
    `;
  }

  /** Persistent left navigation rail hosting the room DAG at its native sidebar
   *  width. Collapses to a thin strip to reclaim scene width. The map dispatches
   *  `terminal-command` move events that bubble to the .dungeon-hud handler. */
  private _renderRail() {
    if (this._railIsCollapsed) {
      return html`
        <div class="dungeon-hud__rail" role="region" aria-label=${msg('Dungeon map')}>
          <div class="rail-strip">
            <button
              class="rail-expand-btn rail-expand-btn--vertical"
              @click=${this._toggleRail}
              aria-label=${msg('Show dungeon map')}
              aria-expanded="false"
            >
              <span class="rail-expand-btn__map">${icons.dungeonMap(16)}</span>
              <span>${msg('Map')}</span>
            </button>
          </div>
        </div>
      `;
    }
    return html`
      <div class="dungeon-hud__rail" role="region" aria-label=${msg('Dungeon map')}>
        ${
          // Omitted rather than hidden: `.rail-header` carries `display: flex`,
          // which outranks the UA rule behind the `hidden` attribute inside a
          // shadow root — the button would have stayed visible and only looked
          // handled. No header row on desktop also returns its 5px of padding
          // to the map.
          this._railCollapsible
            ? html`
                <div class="rail-header">
                  <button
                    class="rail-collapse-btn"
                    @click=${this._toggleRail}
                    aria-label=${msg('Hide dungeon map')}
                    aria-expanded="true"
                  >
                    <span class="rail-collapse-btn__icon">${icons.chevronRight(12)}</span>
                    <span>${msg('Hide')}</span>
                  </button>
                </div>
              `
            : nothing
        }
        <velg-dungeon-map persistent></velg-dungeon-map>
      </div>
    `;
  }

  /** In-scene party presence: the operatives standing in the chamber. Reads the
   *  same server-authoritative party signal the side panel uses; condition tints
   *  each figure's halo so health reads from the stage alone. */
  /**
   * The hint bar: what the stage is waiting for, in words, while an aim is
   * pending.
   *
   * A spotlight alone says "something changed"; it does not say what to do, and
   * a player who arrives at a dimmed party band mid-fight has no way to guess
   * that Escape is the way out. The bar names the ability, the scope and the
   * exit. It is `aria-live` because the state it announces is entered by a
   * click somewhere else entirely — down in the combat bar.
   */
  private _renderAimBar(pending: PendingOrder | null) {
    if (!pending) return nothing;
    const agent = dungeonState.party.value.find((a) => a.agent_id === pending.agent_id);
    const ability = agent?.available_abilities.find((ab) => ab.id === pending.ability_id) ?? null;
    const abilityName = ability ? localizedValue(ability, 'name') : pending.ability_id;

    return html`
      <div class="aimbar" role="status" aria-live="polite">
        <span class="aimbar__text">
          ${
            pending.scope === 'enemy'
              ? msg(str`Choose a target for ${abilityName}`)
              : msg(str`Choose whom to support with ${abilityName}`)
          }
        </span>
        <button
          class="aimbar__cancel"
          type="button"
          @click=${() => dungeonState.cancelTargeting()}
        >
          ${msg('Esc')} <span aria-hidden="true">\u2715</span>
        </button>
      </div>
    `;
  }

  private _renderParty() {
    const party = dungeonState.party.value;
    if (party.length === 0) return nothing;
    const pending = dungeonState.pendingOrder.value;
    const selected = dungeonState.selectedActions.value;
    const aimingAllies = pending?.scope === 'ally';
    const enemyNames = dungeonState.combat.value
      ? buildEnemyDisplayNames(dungeonState.combat.value.enemies)
      : new Map<string, string>();

    // No longer aria-hidden as a whole: while an aim is pending these figures
    // are the choice itself, and a decorative band cannot be one. The name and
    // the order travel on the button's label; the purely atmospheric parts
    // (beam, pool) stay hidden.
    return html`
      <div class="scene__party" data-fx-band="party">
        ${party.map((agent: AgentCombatStateClient, i: number) => {
          const portrait = agent.portrait_url;
          const order = selected.get(agent.agent_id);
          const ability = order
            ? (agent.available_abilities.find((ab) => ab.id === order.ability_id) ?? null)
            : null;
          const abilityName = ability ? localizedValue(ability, 'name') : null;
          const targetName = order?.target_id
            ? (enemyNames.get(order.target_id) ??
              party.find((a) => a.agent_id === order.target_id)?.agent_name ??
              null)
            : null;
          // Only a living ally other than the aiming operative can receive aid.
          const selectable =
            aimingAllies && agent.agent_id !== pending?.agent_id && agent.condition !== 'captured';
          const pictogram = order ? abilityPictogramUrl(order.ability_id) : null;
          const orderIntent = ability ? abilityIntent(ability.targets) : 'strike';

          return html`
            <div
              class="op ${agent.condition === 'captured' ? 'op--down' : ''} ${
                selectable ? 'op--selectable' : ''
              } ${pending && !selectable ? 'op--muted' : ''}"
              style="--i:${i};--_cond:${CONDITION_RING[agent.condition]}"
            >
              ${
                // Anchor 1 of the placed order: the command card, standing over
                // the operative who will carry it out. Cause and effect in one
                // place — the alternative is a list somewhere else that the
                // player has to hold against the stage in their head.
                abilityName
                  ? html`<div class="op__order" data-intent=${orderIntent}>
                      ${
                        // Pictogram as a MASK, tinted by the intent cluster —
                        // never an <img>, so a missing file cannot leave a
                        // broken box on the stage. The colour comes from a
                        // data attribute and a CSS rule, the way the combat
                        // bar already does it, rather than a second colour
                        // table living in TypeScript.
                        pictogram
                          ? html`<span
                              class="op__order-glyph"
                              aria-hidden="true"
                              style="--_mask:url(${pictogram})"
                            ></span>`
                          : nothing
                      }
                      <span class="op__order-text"
                        >${targetName ? `${abilityName} \u2192 ${targetName}` : abilityName}</span
                      >
                      <button
                        class="op__order-drop"
                        type="button"
                        @click=${() => this._withdrawOrder(agent.agent_id)}
                        aria-label=${msg(str`Withdraw ${agent.agent_name}'s order`)}
                      >
                        <span aria-hidden="true">\u2715</span>
                      </button>
                    </div>`
                  : nothing
              }
              ${
                selectable
                  ? html`<button
                      class="op__pick"
                      type="button"
                      @click=${() => this._placeOnTarget(agent.agent_id)}
                      aria-label=${msg(str`Support ${agent.agent_name}`)}
                    ></button>`
                  : nothing
              }
              <div class="op__figure" aria-hidden="true">
                <div class="op__beam"></div>
                <div class="op__disc">
                  ${
                    portrait
                      ? html`<img src=${portrait} alt="" />`
                      : html`<span class="op__mono">${getInitials(agent.agent_name)}</span>`
                  }
                </div>
                <div class="op__pool"></div>
              </div>
              <span class="op__name" aria-hidden="true">${agent.agent_name}</span>
            </div>
          `;
        })}
      </div>
    `;
  }

  /**
   * Anchor 2: the "in your sights" tag on a creature, carrying a small portrait
   * of every operative aimed at it.
   *
   * Portraits rather than a count, and this is the acceptance criterion of
   * §4.6: two operatives on one creature must read as two faces. A number ("2")
   * would say how many but not who, and "who" is the whole question a player
   * asks when deciding whether a creature is already handled. The list comes
   * from `ordersByTarget`, which is derived from the orders themselves, so it
   * cannot say two while the strip says one.
   */
  private _renderSightsTag(
    targetId: string,
    ordersByTarget: ReadonlyMap<string, readonly string[]>,
    party: readonly AgentCombatStateClient[],
    targetName: string,
  ) {
    const attackerIds = ordersByTarget.get(targetId);
    if (!attackerIds || attackerIds.length === 0) return nothing;
    const attackers = attackerIds
      .map((id) => party.find((a) => a.agent_id === id))
      .filter((a): a is AgentCombatStateClient => a !== undefined);
    if (attackers.length === 0) return nothing;

    const names = attackers.map((a) => a.agent_name).join(', ');
    return html`
      <div
        class="foe__sights"
        title=${msg(str`${names} – aimed at ${targetName}`)}
        aria-label=${msg(str`${names} – aimed at ${targetName}`)}
      >
        <span class="foe__sights-label">${msg('In sights')}</span>
        <span class="foe__sights-faces" aria-hidden="true">
          ${attackers.map(
            (a) => html`
              <span class="foe__sights-face" title=${a.agent_name}>
                ${
                  a.portrait_url
                    ? html`<img src=${a.portrait_url} alt="" />`
                    : html`<span>${getInitials(a.agent_name)}</span>`
                }
              </span>
            `,
          )}
        </span>
      </div>
    `;
  }

  /** Place the pending order on a target. The store clears the aim itself. */
  private _placeOnTarget(targetId: string): void {
    const pending = dungeonState.pendingOrder.value;
    if (!pending) return;
    dungeonState.selectAction(pending.agent_id, pending.ability_id, targetId);
  }

  /** Withdraw a placed order from any of its three anchors. */
  private _withdrawOrder(agentId: string): void {
    dungeonState.deselectAction(agentId);
  }

  /** Retire one creature's art after a failed load and fall back to its
   *  silhouette. Observed once per URL, not once per render: the Set already
   *  suppresses the repeat, and a declared-but-unreachable asset is a real
   *  content/storage mismatch (the pack claims a path the bucket does not
   *  serve) that should not disappear silently. */
  private _markEnemyArtFailed(url: string) {
    if (this._failedEnemyArt.has(url)) return;
    this._failedEnemyArt = new Set([...this._failedEnemyArt, url]);
    captureError(new Error(`Enemy scene art failed to load: ${url}`), {
      source: 'VelgDungeonGraphicalView._markEnemyArtFailed',
    });
  }

  /** In-scene hostile band. Enemy data exists ONLY inside dungeonState.combat
   *  (neither RoomNodeClient nor the state manager carries room occupants), so
   *  this band is necessarily combat-scoped — showing hostiles on room entry
   *  would need a backend DTO change first. Zero game logic: every value here
   *  is server-resolved. */
  private _renderEnemies() {
    const combat = dungeonState.combat.value;
    if (!combat || combat.enemies.length === 0) return nothing;

    // Reuse the panel's naming so a duplicate pair reads as "Wisp A" / "Wisp B"
    // in BOTH surfaces instead of drifting apart.
    const displayNames = buildEnemyDisplayNames(combat.enemies);
    const pending = dungeonState.pendingOrder.value;
    const aimingEnemies = pending?.scope === 'enemy';
    // Anchor 2 reads this and nothing else. Two operatives aimed at one
    // creature therefore MUST show two portraits — there is no per-creature
    // counter that could have been incremented once and forgotten.
    const ordersByTarget = dungeonState.ordersByTarget.value;
    const party = dungeonState.party.value;

    return html`
      <div
        class="scene__enemies"
        data-fx-band="foes"
        role="list"
        aria-label=${msg('Hostiles')}
      >
        ${combat.enemies.map((enemy, i) => {
          const geom = FOE_GEOMETRY[enemy.threat_level] ?? FOE_GEOMETRY.standard;
          const cond = FOE_CONDITION[enemy.condition_display] ?? FOE_CONDITION_FALLBACK;
          const dead = !enemy.is_alive;
          const action = dead ? null : enemy.telegraphed_action;
          const intent = action
            ? (FOE_INTENT[action.threat_level] ?? 'var(--color-warning)')
            : 'var(--color-warning)';
          const artUrl = dungeonEnemyArtUrl(enemy.image_path);
          const showArt = artUrl !== null && !this._failedEnemyArt.has(artUrl);
          const displayName = displayNames.get(enemy.instance_id) ?? enemy.name_en;
          const facts = describeEnemy(enemy, displayName);
          return html`
            <div
              class="foe ${dead ? 'foe--dead' : ''} ${
                aimingEnemies && !dead ? 'foe--selectable' : ''
              } ${pending && (dead || !aimingEnemies) ? 'foe--muted' : ''}"
              role="listitem"
              data-tier=${enemy.threat_level}
              style="--i:${i};--_cond:${cond.tint};--_wear:${cond.wear};--_intent:${intent};--_foe-scale:${geom.scale};--_foe-glow:${geom.scale};--_foe-ratio:${geom.ratio};--_foe-shape:${geom.shape};--_foe-eye-top:${geom.eyeTop}"
            >
              ${
                action
                  ? html`<div class="foe__intent" aria-hidden="true">
                      ${icons.alertTriangle(8)}
                      <span class="foe__intent-text">${action.intent}</span>
                    </div>`
                  : nothing
              }
              ${this._renderSightsTag(enemy.instance_id, ordersByTarget, party, displayName)}
              ${
                aimingEnemies && !dead
                  ? html`<button
                      class="foe__pick"
                      type="button"
                      @click=${() => this._placeOnTarget(enemy.instance_id)}
                      aria-label=${msg(str`Target ${displayName}`)}
                    ></button>`
                  : nothing
              }
              <div class="foe__figure ${showArt ? '' : 'foe__figure--silhouette'}">
                ${
                  showArt
                    ? html`<img
                      class="foe__art"
                      src=${artUrl}
                      alt=""
                      decoding="async"
                      @error=${() => this._markEnemyArtFailed(artUrl)}
                    />`
                    : html`
                      <div class="foe__body"></div>
                      <div class="foe__eyes"></div>
                    `
                }
                <div class="foe__pool"></div>
                <button
                  class="foe__probe"
                  type="button"
                  ?disabled=${!showArt}
                  aria-label=${facts.spoken}
                  title=${facts.spoken}
                  @click=${() => showArt && artUrl && this._openEnemyArt(artUrl, facts)}
                ></button>
              </div>
              <span class="foe__name" aria-hidden="true">
                ${
                  FOE_RANK[enemy.threat_level]
                    ? html`<span class="foe__rank">${FOE_RANK[enemy.threat_level]}</span>`
                    : nothing
                }${displayName}
              </span>
              <span class="foe__facts" aria-hidden="true">${facts.line}</span>
            </div>
          `;
        })}
      </div>
    `;
  }

  /**
   * The account of a finished descent.
   *
   * Shown in place of the lobby for as long as the player wants it. The record
   * on the right is the same `<velg-dungeon-chronicle>` the HUD uses, reading
   * the same buffer — `terminalState.clearDungeon()` deliberately leaves the
   * chronicle standing so the closing lines, which are appended after the run
   * is torn down, are still in it.
   */
  private _renderOutcome(ended: { archetype: string; phase: DungeonPhase }) {
    const wiped = ended.phase === 'wiped';
    const completed = ended.phase === 'completed';
    const verdict = wiped
      ? msg('Party lost')
      : completed
        ? msg('Descent complete')
        : msg('Withdrawn');
    const note = wiped
      ? msg('No one came back up. What they carried stayed down there with them.')
      : completed
        ? msg('The resonance is spent. Everything the party carried out is theirs.')
        : msg('The party left early and kept what it had already taken.');
    // Colour carries the verdict; --_verdict feeds the panel's top rule and title.
    const verdictColor = wiped
      ? 'var(--color-danger)'
      : completed
        ? 'var(--color-success)'
        : 'var(--_phosphor)';

    return html`
      <div class="dungeon-lobby">
        <div class="outcome">
          <div class="outcome__verdict" style="--_verdict:${verdictColor}">
            <span class="outcome__label">${msg('Descent ended')}</span>
            <span class="outcome__title">${verdict}</span>
            <span class="outcome__archetype">${getArchetypeDisplayName(ended.archetype)}</span>
            <p class="outcome__note">${note}</p>
            <button class="outcome__btn" type="button" @click=${this._dismissOutcome}>
              ${msg('Return to the lobby')}
            </button>
          </div>
          <div
            class="outcome__record"
            role="region"
            aria-label=${msg('Chronicle of the descent')}
          >
            <velg-dungeon-chronicle></velg-dungeon-chronicle>
          </div>
        </div>
      </div>
    `;
  }

  private _renderLobby(_simulationId: string) {
    const available = dungeonState.availableDungeons.value;
    const loading = dungeonState.loading.value;

    // Archetype chosen → assemble the party in-view (no terminal needed).
    if (this._pickerArchetype) {
      return html`<div class="dungeon-lobby">${this._renderPicker()}</div>`;
    }

    return html`
      <div class="dungeon-lobby">
        <div>
          <div class="lobby-titlebar">
            <div class="lobby-info__title">${msg('Resonance Dungeons')}</div>
            <velg-dungeon-view-toggle></velg-dungeon-view-toggle>
          </div>
          ${
            loading
              ? html`<velg-loading-state message=${msg('Scanning resonance frequencies...')}></velg-loading-state>`
              : available.length > 0
                ? this._renderAvailableGrid(available)
                : html`<velg-empty-state
                  message=${msg('No dungeon archetypes detected in this simulation.')}
                ></velg-empty-state>`
          }
        </div>
        ${
          !loading && available.length > 0
            ? html`<div class="lobby-hint">${msg('Select an archetype to begin the descent.')}</div>`
            : nothing
        }
        <div class="lobby-register">
          <velg-dungeon-expedition-log
            .simulationId=${_simulationId}
          ></velg-dungeon-expedition-log>
        </div>
      </div>
    `;
  }

  private _renderAvailableGrid(dungeons: AvailableDungeonResponse[]) {
    return html`
      <div class="lobby-grid" role="list" aria-label=${msg('Available dungeons')}>
        ${dungeons.map((d) => {
          const artUrl = dungeonBackdropUrl(d.archetype);
          const magnitude = resonanceMagnitudeLabel(d);
          return html`
            <div
              class="lobby-card ${
                d.available ? 'lobby-card--available' : 'lobby-card--unavailable'
              }"
              role=${d.available ? 'button' : 'listitem'}
              tabindex=${d.available ? '0' : '-1'}
              aria-label=${
                d.available
                  ? `${msg('Enter')} ${getArchetypeDisplayName(d.archetype)}`
                  : getArchetypeDisplayName(d.archetype)
              }
              @click=${() => d.available && this._openPicker(d.archetype)}
              @keydown=${(e: KeyboardEvent) => {
                if (d.available && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  void this._openPicker(d.archetype);
                }
              }}
            >
              ${
                // The archetype's own establishing shot — the same image the
                // landing page and the detail view already use, and the one the
                // scene paints behind the run. Without it the five cards were
                // indistinguishable rectangles over 500 px of empty space,
                // differing in nothing but a name.
                artUrl
                  ? html`<img
                    class="lobby-card__art"
                    src=${artUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    aria-hidden="true"
                  />`
                  : nothing
              }
              <span class="lobby-card__name">${getArchetypeDisplayName(d.archetype)}</span>
              <span class="lobby-card__brief"
                >${getArchetypeBriefing(d.archetype).intro.join(' ')}</span
              >
              <span class="lobby-card__meta">
                ${
                  magnitude
                    ? html`<span>${magnitude}</span>`
                    : html`<span class="lobby-card__origin">${adminUnlockedLabel()}</span>`
                }
                <span>${msg('Difficulty')}: ${d.suggested_difficulty}</span>
                <span>${msg('Depth')}: ${d.suggested_depth + 1}</span>
              </span>
            </div>
          `;
        })}
      </div>
    `;
  }

  // ── Agent picker render ───────────────────────────────────────────────────

  private _renderPicker() {
    const archetype = this._pickerArchetype ?? '';
    const loading = dungeonState.loading.value;
    const agents = dungeonState.pickerAgents.value;
    const count = this._pickerSelection.length;
    const canBegin = count >= 2 && count <= 4 && !this._startingRun;
    // Non-blocking composition warning (shared with the terminal entry flow):
    // surfaces once a viable party is selected but misses the archetype's
    // critical aptitude — informational, never gates BEGIN DESCENT.
    const warning =
      count >= 2
        ? checkPartyComposition(
            archetype,
            this._pickerSelection,
            dungeonState.pickerAptitudes.value,
          )
        : null;

    return html`
      <div class="picker">
        <div class="picker__head">
          <button
            class="picker__back"
            type="button"
            aria-label=${msg('Back to archetypes')}
            ?disabled=${this._startingRun}
            @click=${this._closePicker}
          >
            <span class="picker__back-icon">${icons.chevronRight(14)}</span> ${msg('Back')}
          </button>
          <div class="picker__title">
            ${getArchetypeDisplayName(archetype)} <span>// ${msg('Assemble party')}</span>
          </div>
        </div>

        ${
          loading && agents.length === 0
            ? html`<velg-loading-state message=${msg('Mustering operatives...')}></velg-loading-state>`
            : agents.length < 2
              ? html`<velg-empty-state
                  message=${msg('Need at least 2 agents for a dungeon party. Recruit more agents first.')}
                ></velg-empty-state>`
              : this._renderPickerRoster(agents)
        }

        ${
          warning
            ? html`
                <div class="picker__warn" role="status">
                  <span class="picker__warn-icon" aria-hidden="true"
                    >${icons.alertTriangle(13)}</span
                  >
                  <span>${partyCompositionWarningText(warning)}</span>
                </div>
              `
            : nothing
        }

        ${
          agents.length >= 2
            ? html`
                <div class="picker__footer">
                  <span class="picker__count" aria-live="polite">
                    ${msg('Party')}: ${count}/4
                    ${
                      // "0/4" states the ceiling; the floor is 2, and a player
                      // who picks one agent and presses BEGIN gets no
                      // explanation for why nothing happens.
                      count < 2
                        ? html`<span class="picker__count-need">
                            ${msg('at least 2')}
                          </span>`
                        : nothing
                    }
                  </span>
                  <div class="picker__actions">
                    <button
                      class="picker__btn"
                      type="button"
                      ?disabled=${this._startingRun}
                      @click=${this._autoSelect}
                    >
                      ${msg('Auto-select')}
                    </button>
                    <button
                      class="picker__btn picker__btn--primary"
                      type="button"
                      ?disabled=${!canBegin}
                      @click=${this._beginRun}
                    >
                      ${this._startingRun ? msg('Descending...') : msg('Begin descent')}
                    </button>
                  </div>
                </div>
              `
            : nothing
        }
      </div>
    `;
  }

  private _renderPickerRoster(agents: Agent[]) {
    const aptitudes = dungeonState.pickerAptitudes.value;
    return html`
      <div class="picker-grid" role="group" aria-label=${msg('Select party members')}>
        ${agents.map((agent) => {
          const selected = this._pickerSelection.includes(agent.id);
          const atCap = this._pickerSelection.length >= 4 && !selected;
          return html`
            <button
              class="picker-card ${selected ? 'picker-card--selected' : ''}"
              type="button"
              role="checkbox"
              aria-checked=${selected ? 'true' : 'false'}
              ?disabled=${atCap || this._startingRun}
              @click=${() => this._toggleAgent(agent.id)}
            >
              <velg-avatar
                class="picker-card__avatar"
                size="full"
                .src=${agent.portrait_image_url ?? ''}
                .name=${agent.name}
              ></velg-avatar>
              <span class="picker-card__body">
                <span class="picker-card__name">${agent.name}</span>
                <span class="picker-card__apts">
                  ${this._renderAptChips(
                    aptitudes.levels.get(agent.id),
                    aptitudes.baselineAgentIds.has(agent.id),
                  )}
                </span>
              </span>
              <span class="picker-card__check" aria-hidden="true">
                ${selected ? icons.checkCircle(14) : nothing}
              </span>
            </button>
          `;
        })}
      </div>
    `;
  }

  /** Enlarge one creature. The band is the enemy list in graphical mode, so
   *  "look closer" belongs to it — and the caption carries the same facts the
   *  figure announces, from the same description. */
  private _openEnemyArt(url: string, facts: EnemyFacts): void {
    this._enemyArtLightbox = { url, facts };
  }

  /**
   * The chamber's prose, in the scene.
   *
   * Renders the WHOLE room description the shared selector produced — the same
   * object, in the same reading order, that the terminal turns into lines.
   * Until now this box showed banter and a barometer line only, so 129
   * encounter templates, every anchor object and every room-type ambient line
   * were written for a surface that never displayed them.
   *
   * The parts are typographically distinct because they speak with different
   * voices: the room describes itself (ambient, anchors), the situation
   * confronts the party (encounter — the one whose choices appear as buttons in
   * the action bar below), an operative reacts (banter), and the meter reports
   * (barometer). Same content as the terminal, different register.
   */
  private _renderChamberText(description: RoomDescription | null) {
    const waiting = html`<div class="chamber chamber--empty">
      ${msg('The chamber waits. Choose your next move.')}
    </div>`;
    if (!description) return waiting;

    const { ambient, anchors, encounter, banter, barometer, isThreshold, typeLabel } = description;
    if (!ambient && anchors.length === 0 && !encounter && !banter && !barometer) return waiting;

    // NARRATIVE ORDER, not the order the data arrives in. Someone walking into
    // a room hears their companion react, registers what kind of place it is,
    // sees it, sees what is in it, and only then faces the situation. The
    // previous order opened with two grey paragraphs of scenery and put the
    // operative's remark — the only human voice in the frame — last, below the
    // very situation it was reacting to.
    return html`
      <div class="chamber" role="status" aria-live="polite">
        <div class="chamber__measure">
          ${banter ? html`<p class="chamber__banter">${banter}</p>` : nothing}
          ${typeLabel ? html`<p class="chamber__mark">${typeLabel}</p>` : nothing}
          ${ambient ? html`<p class="chamber__ambient">${ambient}</p>` : nothing}
          ${anchors.map((text) => html`<p class="chamber__anchor">${text}</p>`)}
          ${
            encounter
              ? html`<div
                class="chamber__encounter ${isThreshold ? 'chamber__encounter--threshold' : ''}"
              >
                ${encounter.split('\n').map((para) => html`<p>${para}</p>`)}
              </div>`
              : nothing
          }
          ${barometer ? html`<p class="chamber__barometer">${barometer}</p>` : nothing}
        </div>
      </div>
    `;
  }

  /**
   * Top-3 aptitudes as compact chips (shared computation with the terminal
   * picker formatter via topAptitudes).
   *
   * Three distinct states, none of them faked: assigned values, the server's
   * baseline marked as baseline, and genuinely absent data. The chips and the
   * composition warning below them read the same AptitudeIndex, so they can no
   * longer disagree.
   */
  private _renderAptChips(apts: AptitudeSet | undefined, isBaseline: boolean) {
    const top = topAptitudes(apts);
    if (top.length === 0) {
      return html`<span class="apt-chip apt-chip--unknown">${msg('No aptitude data')}</span>`;
    }
    return [
      ...top.map(
        ([k, v]) =>
          html`<span class="apt-chip ${isBaseline ? 'apt-chip--baseline' : ''}"
            >${OPERATIVE_LABEL[k] ?? k.toUpperCase()} ${v}</span
          >`,
      ),
      isBaseline
        ? html`<span class="apt-chip apt-chip--unknown" title=${msg('No aptitudes assigned – showing the baseline combat uses')}>${msg('baseline')}</span>`
        : nothing,
    ];
  }
}

/** Figure geometry per enemy threat tier (minion | standard | elite | boss —
 *  the EnemyInstance scale, NOT the TelegraphedAction low/medium/high/critical
 *  scale). `w`/`h` size the figure box for BOTH representations, so a boss
 *  looms over a minion whether it is drawn as art or as an outline.
 *
 *  `shape` and `eyeTop` belong to the SILHOUETTE path only — the fallback for a
 *  creature with no published art, or whose art failed to load. Creature art
 *  brings its own outline and its own face. */
/**
 * How large a creature stands in the band, by threat tier.
 *
 * `scale` is a FRACTION OF THE ENEMY BAND's height, not an absolute size. The
 * first version of this table was written for clip-path silhouettes, where an
 * abstract shape still reads at 30 px, and used viewport-width clamps
 * (`clamp(52px, 6vw, 76px)`). When the silhouettes were replaced by keyed
 * photographic art the sizes were carried over unchanged — so two minions stood
 * in the band at roughly 30 x 50 px, unreadable below 2x magnification, with a
 * condition halo as large as the creature and about 85 % of the band empty.
 *
 * Viewport width was the wrong reference to begin with: it says nothing about
 * how tall the stage actually is. Scaling against the band means a creature
 * keeps its proportion to the scene on any display, and the band fills.
 *
 * `ratio` (width / height) applies to the SILHOUETTE fallback only, which needs
 * an explicit box for its polygon. The published art carries its own aspect
 * ratio — the cutouts are mass-cropped, so a wisp is narrow and a warden broad
 * — and the figure box takes its width from the image.
 *
 * If these fractions grow, `SCENE_EDGE` in scripts/ingest_dungeon_enemy_art.py
 * must grow with them: the published rendition is sized for the largest a
 * creature is ever drawn. The size is part of the stored path, so the coupling
 * is visible rather than implied.
 */
/**
 * Rank marks. A creature's threat tier used to be expressed by SIZE alone — and
 * between a 44px minion and a 55px elite in a cramped band, nobody can see a
 * difference. Into the Breach's rule applies here: the player must know what is
 * dangerous BEFORE it acts, and size is not a readable channel at this scale.
 *
 * Empty for the two ordinary tiers on purpose: a mark on everything marks
 * nothing.
 */
const FOE_RANK: Record<string, string> = {
  minion: '',
  standard: '',
  elite: '\u25C6',
  boss: '\u2726',
};

const FOE_GEOMETRY: Record<
  string,
  { scale: number; ratio: number; shape: string; eyeTop: string }
> = {
  minion: {
    scale: 0.56,
    ratio: 0.6,
    shape: 'polygon(50% 0%, 72% 26%, 66% 100%, 34% 100%, 28% 26%)',
    eyeTop: '22%',
  },
  standard: {
    scale: 0.72,
    ratio: 0.62,
    shape: 'polygon(50% 0%, 74% 18%, 80% 52%, 70% 100%, 30% 100%, 20% 52%, 26% 18%)',
    eyeTop: '17%',
  },
  elite: {
    scale: 0.86,
    ratio: 0.6,
    shape:
      'polygon(50% 0%, 66% 10%, 88% 30%, 78% 56%, 72% 100%, 28% 100%, 22% 56%, 12% 30%, 34% 10%)',
    eyeTop: '14%',
  },
  boss: {
    scale: 1,
    ratio: 0.68,
    shape:
      'polygon(50% 4%, 62% 10%, 78% 0%, 74% 20%, 96% 34%, 84% 58%, 78% 100%, 22% 100%, 16% 58%, 4% 34%, 26% 20%, 22% 0%, 38% 10%)',
    eyeTop: '15%',
  },
};

/** Enemy condition -> how the creature reads in the band.
 *
 *  `tint` is remaining menace: a fresh hostile burns danger-red, a spent one
 *  greys out. It colours the silhouette, the floor pool and the name.
 *
 *  `wear` is the same scale as a 0..1 scalar, driving the desaturation and
 *  dimming of the ART variant — a photograph cannot be recoloured the way a
 *  silhouette can, so it loses blood instead. One table feeds both, so the two
 *  representations can never disagree about how hurt a creature looks.
 *
 *  All SIX states the backend emits are listed. `EnemyInstance.condition_display`
 *  (backend/models/combat.py) buckets the remaining/max ratio into healthy >0.8,
 *  scratched >0.6, damaged >0.4, wounded >0.2, critical, defeated — the previous
 *  four-entry map silently dropped `scratched` and `wounded` through its
 *  fallback, so a creature at 70 % and at 30 % both looked untouched. */
const FOE_CONDITION: Record<string, { tint: string; wear: number }> = {
  healthy: { tint: 'var(--color-danger)', wear: 0 },
  scratched: { tint: 'var(--color-danger)', wear: 0.14 },
  damaged: { tint: 'var(--color-warning)', wear: 0.34 },
  wounded: { tint: 'var(--color-warning)', wear: 0.54 },
  critical: { tint: 'var(--color-primary)', wear: 0.74 },
  defeated: { tint: 'var(--color-text-muted)', wear: 1 },
};

/** Unknown condition string: treat as unhurt rather than as debris, so a future
 *  backend state degrades into "menacing" instead of into "already dead". */
const FOE_CONDITION_FALLBACK = FOE_CONDITION.healthy;

/** TelegraphedAction threat scale -> intent-marker colour. */
const FOE_INTENT: Record<string, string> = {
  low: 'var(--color-info)',
  medium: 'var(--color-warning)',
  high: 'var(--color-danger)',
  critical: 'var(--color-danger)',
};

/** Condition → halo color for in-scene party figures (mirrors the side-panel
 *  CONDITION_COLOR map in DungeonPartyPanel). */
const CONDITION_RING: Record<Condition, string> = {
  operational: 'var(--color-success)',
  stressed: 'var(--color-warning)',
  wounded: 'var(--color-danger)',
  afflicted: 'var(--color-danger)',
  captured: 'var(--color-text-muted)',
};

/** Per-fx accent color (token-based; drives backdrop tint + readout fill). */
const ACCENT_BY_FX: Record<FxProfile, string> = {
  water: 'var(--color-info)',
  darkness: 'var(--color-text-muted)',
  decay: 'var(--color-success)',
  tilt: 'var(--color-warning)',
  pulse: 'var(--color-danger)',
  forge: 'var(--color-warning)',
  shards: 'var(--color-warning)',
  flicker: 'var(--color-info)',
  neutral: 'var(--color-primary)',
};

interface WakeLockReleasable {
  release(): Promise<void>;
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-dungeon-graphical-view': VelgDungeonGraphicalView;
  }
}

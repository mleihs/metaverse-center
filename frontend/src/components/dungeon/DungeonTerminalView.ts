/**
 * Dungeon Terminal View — route entry and layout shell for Resonance Dungeons.
 *
 * Pattern: EpochTerminalView.ts (wraps BureauTerminal with context-specific HUD).
 * The terminal is ALWAYS the primary interaction layer. HUD components (header,
 * quick actions, party panel) supplement it when a dungeon run is active.
 *
 * Layout states:
 *   - No active dungeon: terminal-themed lobby (available archetypes + terminal)
 *   - Active dungeon: grid HUD (header + terminal + party sidebar + quick actions)
 *
 * Lifecycle:
 *   connectedCallback → initialize terminal → try dungeon recovery → load available
 *   disconnectedCallback → release Wake Lock → clean up dungeon mode
 *
 * Route: /simulations/:slug/dungeon
 */

import { localized, msg } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';

import { appState } from '../../services/AppStateManager.js';
import { dungeonState } from '../../services/DungeonStateManager.js';
import { captureError } from '../../services/SentryService.js';
import { terminalState } from '../../services/TerminalStateManager.js';
import type { AvailableDungeonResponse } from '../../types/dungeon.js';
import { getArchetypeDisplayName } from '../../utils/dungeon-formatters.js';
import { icons } from '../../utils/icons.js';
import { parseAndExecute } from '../../utils/terminal-commands.js';
import { systemLine } from '../../utils/terminal-formatters.js';
import { initializeTerminalZones } from '../../utils/terminal-initialization.js';
import {
  terminalAnimations,
  terminalComponentTokens,
  terminalTokens,
  terminalWrapperStyles,
} from '../shared/terminal-theme-styles.js';
import type { VelgBureauTerminal } from '../terminal/BureauTerminal.js';
import '../terminal/BureauTerminal.js';
import './DungeonCombatBar.js';
import './DungeonEnemyPanel.js';
import './DungeonHeader.js';
import './DungeonMap.js';
import './DungeonPartyPanel.js';
import './DungeonAudioSettings.js';
import './DungeonQuickActions.js';

@localized()
@customElement('velg-dungeon-terminal-view')
export class VelgDungeonTerminalView extends SignalWatcher(LitElement) {
  static styles = [
    terminalTokens,
    terminalComponentTokens,
    terminalAnimations,
    terminalWrapperStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: calc(100vh - var(--header-height, 64px) - var(--sim-nav-height, 48px));
        min-height: 400px;
        padding: 0 16px 16px;
        box-sizing: border-box;

        /* Force platform-dark tokens regardless of simulation theme.
           Dungeon HUD must always be dark — sim themes (e.g. Velgarien brutalist)
           override --color-surface to #fff which breaks all amber-on-dark contrast
           in Header, Map, Party Panel, and Quick Actions. */
        --color-surface: #0a0a0a; /* lint-color-ok */
        --color-surface-raised: #111111; /* lint-color-ok */
        --color-text-primary: #e5e5e5; /* lint-color-ok */
        --color-text-secondary: #a0a0a0; /* lint-color-ok */
        --color-text-muted: #888888; /* lint-color-ok */
        --color-border: #333333; /* lint-color-ok */
        background: var(--color-surface);
      }

      /* ── HUD Grid Layout (active dungeon) ── */
      .dungeon-hud {
        display: grid;
        grid-template-rows: auto 1fr auto auto;
        grid-template-columns: 1fr 280px;
        flex: 1;
        min-height: 0;
        gap: 0;
      }

      .dungeon-hud__header {
        grid-column: 1 / -1;
        grid-row: 1;
      }

      .dungeon-hud__main {
        grid-column: 1;
        grid-row: 2;
        display: flex;
        flex-direction: column;
        min-height: 250px;
        overflow-y: auto;
      }

      .dungeon-hud__party {
        grid-column: 2;
        grid-row: 2;
        overflow-y: auto;
        border-left: 1px dashed color-mix(in srgb, var(--_border) 40%, transparent);
        padding: 8px;
        font-family: var(--_mono);
        font-size: 10px;
        color: var(--_phosphor-dim);
        background: var(--color-surface);
      }

      .dungeon-hud__map {
        grid-column: 1 / -1;
        grid-row: 3;
      }

      .dungeon-hud__actions {
        grid-column: 1 / -1;
        grid-row: 4;
        /* Stack above DesperateActionsPanel (position:fixed z-index:20) which
           otherwise intercepts clicks on dungeon action buttons at viewport bottom. */
        position: relative;
        z-index: 21;
      }

      /* ── Lobby Layout (no active dungeon) ── */
      .dungeon-lobby {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 0;
      }

      .lobby-info {
        padding: 12px;
        border: 1px dashed color-mix(in srgb, var(--_border) 50%, transparent);
        background: color-mix(in srgb, var(--_screen-bg) 85%, transparent);
        margin-bottom: 0;
        font-family: var(--_mono);
        font-size: 11px;
        color: var(--_phosphor-dim);
      }

      .lobby-info__title {
        font-family: var(--font-brutalist, var(--_mono));
        font-weight: 700;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 1.5px;
        color: var(--_phosphor);
        margin-bottom: 8px;
      }

      .lobby-info__hint {
        font-size: 10px;
        opacity: 0.7;
        margin-top: 8px;
      }

      .lobby-dungeons {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin-top: 8px;
      }

      .lobby-dungeon {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 10px;
        border: 1px solid color-mix(in srgb, var(--_border) 30%, transparent);
        font-family: var(--_mono);
        font-size: 11px;
        color: var(--_phosphor-dim);
      }

      .lobby-dungeon__name {
        font-weight: 600;
        color: var(--_phosphor);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .lobby-dungeon__meta {
        display: flex;
        gap: 12px;
        font-size: 10px;
        opacity: 0.7;
      }

      .lobby-dungeon--unavailable {
        opacity: 0.4;
      }

      /* ── Mobile ── */
      @media (max-width: 767px) {
        :host {
          padding: 0 8px 8px;
          height: calc(100vh - var(--header-height, 64px) - var(--sim-nav-height, 48px));
        }

        .dungeon-hud {
          grid-template-columns: 1fr;
        }

        .dungeon-hud__party {
          grid-column: 1;
          grid-row: unset;
          max-height: 80px;
          border-left: none;
          border-top: 1px dashed color-mix(in srgb, var(--_border) 40%, transparent);
          overflow-x: auto;
          overflow-y: hidden;
        }

        .dungeon-hud__map,
        .dungeon-hud__actions {
          grid-column: 1;
        }
      }

      @media (max-width: 640px) {
        .lobby-dungeon {
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
        }
      }

      /* ── Map: hidden in grid at <1200px (FAB + dialog instead) ── */
      @media (max-width: 1199px) {
        .dungeon-hud__map {
          display: none;
        }
      }

      /* ── Medium screens (1200–1439px): map as sidebar below party ── */
      @media (min-width: 1200px) and (max-width: 1439px) {
        .dungeon-hud__map {
          grid-column: 2;
          grid-row: 3;
          border-left: 1px dashed color-mix(in srgb, var(--_border) 40%, transparent);
          border-top: 1px dashed color-mix(in srgb, var(--_border) 30%, transparent);
          overflow-y: auto;
          min-height: 0;
        }
        .dungeon-hud__actions {
          grid-column: 1;
        }
      }

      /* ── Large screens (1440px+): 3-column layout ── */
      @media (min-width: 1440px) {
        .dungeon-hud {
          grid-template-rows: auto 1fr auto;
          grid-template-columns: 1fr 300px 260px;
        }
        .dungeon-hud__map {
          grid-column: 3;
          grid-row: 2;
          border-left: 1px dashed color-mix(in srgb, var(--_border) 40%, transparent);
          overflow-y: auto;
          min-height: 0;
        }
        .dungeon-hud__actions {
          grid-column: 1 / 3;
          grid-row: 3;
        }
      }

      /* ── 4K / Ultra-wide ── */
      @media (min-width: 2560px) {
        .dungeon-hud {
          grid-template-columns: 1fr 380px 320px;
        }

        .dungeon-hud__party {
          padding: 10px;
        }
      }

      /* ── Map FAB (floating action button, <1200px only) ── */
      .map-fab {
        display: none;
        position: fixed;
        bottom: 80px;
        right: 24px;
        z-index: 50;
        align-items: center;
        gap: 6px;
        padding: 8px 14px;
        border: 1px solid color-mix(in srgb, var(--_phosphor) 50%, transparent);
        background: color-mix(in srgb, var(--_screen-bg) 95%, black);
        color: var(--_phosphor);
        font-family: var(--font-brutalist, var(--_mono));
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1px;
        cursor: pointer;
        backdrop-filter: blur(4px);
      }

      .map-fab:hover {
        border-color: var(--_phosphor);
        box-shadow: 0 0 8px color-mix(in srgb, var(--_phosphor-glow) 40%, transparent);
      }

      .map-fab:focus-visible {
        outline: 1px solid var(--_phosphor);
        outline-offset: 2px;
      }

      @media (max-width: 1199px) {
        .map-fab {
          display: flex;
        }
      }

      @media (max-width: 767px) {
        .map-fab {
          bottom: 72px;
          right: 12px;
          padding: 6px 10px;
          font-size: 9px;
        }
      }

      /* ── Map Dialog (<1200px overlay) ── */
      .map-dialog {
        border: 1px solid color-mix(in srgb, var(--_phosphor) 40%, transparent);
        background: color-mix(in srgb, var(--_screen-bg) 98%, black);
        color: var(--_phosphor);
        padding: 0;
        max-width: min(90vw, 600px);
        max-height: 80vh;
        width: 100%;
      }

      .map-dialog::backdrop {
        background: rgba(0, 0, 0, 0.75);
        backdrop-filter: blur(2px);
      }

      .map-dialog__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        border-bottom: 1px dashed color-mix(in srgb, var(--_border) 40%, transparent);
        font-family: var(--font-brutalist, var(--_mono));
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1.5px;
        color: var(--_phosphor-dim);
      }

      .map-dialog__close {
        border: none;
        background: none;
        color: var(--_phosphor-dim);
        cursor: pointer;
        padding: 4px;
        font-size: 16px;
        line-height: 1;
      }

      .map-dialog__close:hover {
        color: var(--_phosphor);
      }

      @media (max-width: 767px) {
        .map-dialog {
          max-width: 100vw;
          max-height: 100vh;
          width: 100vw;
          height: 100vh;
          margin: 0;
          border: none;
        }
      }

      /* ── Audio Settings Dialog ── */
      .audio-dialog {
        border: 1px solid color-mix(in srgb, var(--_phosphor) 40%, transparent);
        background: color-mix(in srgb, var(--_screen-bg) 98%, black);
        color: var(--_phosphor);
        padding: 0;
        max-width: min(90vw, 360px);
        width: 100%;
      }

      .audio-dialog::backdrop {
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(2px);
      }

      .audio-dialog__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        border-bottom: 1px dashed color-mix(in srgb, var(--_border) 40%, transparent);
        font-family: var(--font-brutalist, var(--_mono));
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1.5px;
        color: var(--_phosphor-dim);
      }

      .audio-dialog__close {
        border: none;
        background: none;
        color: var(--_phosphor-dim);
        cursor: pointer;
        padding: 4px;
        font-size: 16px;
        line-height: 1;
      }

      .audio-dialog__close:hover {
        color: var(--_phosphor);
      }
    `,
  ];

  @property({ type: String }) simulationId = '';

  @query('velg-bureau-terminal') private _terminal?: VelgBureauTerminal;
  @query('.map-dialog') private _mapDialog?: HTMLDialogElement;
  @query('.audio-dialog') private _audioDialog?: HTMLDialogElement;

  @state() private _initialized = false;
  @state() private _error: string | null = null;

  private _wakeLock: WakeLockSentinel | null = null;

  override async connectedCallback(): Promise<void> {
    super.connectedCallback();
    await this._initialize();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._releaseWakeLock();
    terminalState.clearDungeon();
    terminalState.dispose();
  }

  // ── Initialization ──────────────────────────────────────────────────────

  private async _initialize(): Promise<void> {
    const sid = this.simulationId || appState.simulationId.value;
    if (!sid) {
      this._error = msg('No simulation context.');
      return;
    }

    try {
      // 1. Initialize terminal state + zones
      terminalState.initialize(sid);
      await initializeTerminalZones(sid);

      // 2. Try to recover active dungeon from localStorage
      const recovered = await dungeonState.tryRecover();

      if (recovered) {
        // Active dungeon found — sync terminal mode + acquire wake lock
        terminalState.initializeDungeon(
          dungeonState.runId.value!,
          getArchetypeDisplayName(dungeonState.clientState.value?.archetype ?? ''),
        );
        await this._acquireWakeLock();
      } else {
        // No active dungeon — load available archetypes for lobby
        await dungeonState.loadAvailable(sid);
      }

      this._initialized = true;
    } catch (err) {
      this._error = err instanceof Error ? err.message : msg('Initialization failed.');
    }
  }

  // ── Wake Lock (prevents screen sleep during dungeon runs) ───────────────

  private async _acquireWakeLock(): Promise<void> {
    try {
      if ('wakeLock' in navigator) {
        this._wakeLock = await (
          navigator as Navigator & {
            wakeLock: { request(type: string): Promise<WakeLockSentinel> };
          }
        ).wakeLock.request('screen');
      }
    } catch {
      // Non-critical — silently fail (battery saver, permissions, etc.)
    }
  }

  private _releaseWakeLock(): void {
    if (this._wakeLock) {
      this._wakeLock.release().catch(() => {});
      this._wakeLock = null;
    }
  }

  // ── Terminal Command Forwarding ──────────────────────────────────────────
  // Catches 'terminal-command' events from dungeon HUD components
  // (QuickActions, Map, CombatBar) and executes them through the command
  // pipeline. Required because these components are siblings of BureauTerminal
  // in the shadow DOM — composed events bubble upward, not sideways.

  private async _handleTerminalCommand(e: CustomEvent<string>): Promise<void> {
    e.stopPropagation();
    const command = e.detail;
    if (!command) return;

    terminalState.isLoading.value = true;
    try {
      const lines = await parseAndExecute(command);
      terminalState.appendOutput(lines);
    } catch (err) {
      captureError(err, { source: 'DungeonTerminalView._handleTerminalCommand', command });
      terminalState.appendOutput([
        systemLine(`[ERROR] ${err instanceof Error ? err.message : 'Command failed.'}`),
      ]);
    } finally {
      terminalState.isLoading.value = false;
      // Force scroll: async operations (move, combat) change layout via
      // applyState, which can shift scroll position and set _userScrolled
      // before the output lines are appended. Reset and scroll.
      this._terminal?.forceScrollToBottom();
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────

  protected render() {
    if (this._error) {
      return html`<div class="terminal-error">[ERROR] ${this._error}</div>`;
    }

    if (!this._initialized) {
      return html`<div class="terminal-loading">${msg('Initializing dungeon interface...')}_</div>`;
    }

    const sid = this.simulationId || appState.simulationId.value || '';
    const inDungeon = dungeonState.isInDungeon.value;

    if (inDungeon) {
      return this._renderHUD(sid);
    }

    return this._renderLobby(sid);
  }

  /** Active dungeon: grid HUD layout with header, terminal, sidebar, actions.
   *  @terminal-command on the HUD div catches events from all dungeon
   *  components (QuickActions, Map, CombatBar) and routes them through
   *  the command pipeline via _handleTerminalCommand. */
  private _renderHUD(simulationId: string) {
    const inCombat = dungeonState.isInCombat.value;

    return html`
      <div class="dungeon-hud" @terminal-command=${this._handleTerminalCommand} @toggle-audio-settings=${this._openAudioDialog}>
        <div class="dungeon-hud__header" role="banner" aria-label=${msg('Dungeon status')}>
          <velg-dungeon-header></velg-dungeon-header>
        </div>
        <div class="dungeon-hud__main" role="main" aria-label=${msg('Terminal')}>
          ${inCombat ? html`<velg-dungeon-enemy-panel></velg-dungeon-enemy-panel>` : nothing}
          <div class="terminal-wrapper">
            <velg-bureau-terminal .simulationId=${simulationId} .dungeonMode=${true}></velg-bureau-terminal>
          </div>
        </div>
        <div class="dungeon-hud__party" role="complementary" aria-label=${msg('Party status')}>
          <velg-dungeon-party-panel></velg-dungeon-party-panel>
        </div>
        <div class="dungeon-hud__map" role="region" aria-label=${msg('Dungeon map')}>
          <velg-dungeon-map persistent></velg-dungeon-map>
        </div>
        <div class="dungeon-hud__actions" role="toolbar" aria-label=${msg('Actions')}>
          ${
            inCombat
              ? html`<velg-dungeon-combat-bar></velg-dungeon-combat-bar>`
              : html`<velg-dungeon-quick-actions></velg-dungeon-quick-actions>`
          }
        </div>
      </div>

      <button
        class="map-fab"
        @click=${this._openMapDialog}
        aria-label=${msg('Open dungeon map')}
      >
        ${icons.dungeonMap(16)}
        <span>${msg('Map')}</span>
      </button>

      <dialog
        class="map-dialog"
        @close=${() => this.requestUpdate()}
        @click=${this._onMapDialogBackdropClick}
      >
        <div class="map-dialog__header">
          <span>${msg('Dungeon Map')}</span>
          <button
            class="map-dialog__close"
            @click=${() => this._mapDialog?.close()}
            aria-label=${msg('Close map')}
          >&times;</button>
        </div>
        <velg-dungeon-map persistent></velg-dungeon-map>
      </dialog>

      <dialog
        class="audio-dialog"
        @close=${() => this.requestUpdate()}
        @click=${this._onAudioDialogBackdropClick}
      >
        <div class="audio-dialog__header">
          <span>${msg('Audio Settings')}</span>
          <button
            class="audio-dialog__close"
            @click=${() => this._audioDialog?.close()}
            aria-label=${msg('Close audio settings')}
          >&times;</button>
        </div>
        <velg-dungeon-audio-settings></velg-dungeon-audio-settings>
      </dialog>
    `;
  }

  private _openMapDialog(): void {
    this._mapDialog?.showModal();
  }

  /** Close dialog when clicking backdrop (outside content area). */
  private _onMapDialogBackdropClick(e: MouseEvent): void {
    if (e.target === this._mapDialog) {
      this._mapDialog?.close();
    }
  }

  private _openAudioDialog(): void {
    this._audioDialog?.showModal();
  }

  private _onAudioDialogBackdropClick(e: MouseEvent): void {
    if (e.target === this._audioDialog) {
      this._audioDialog?.close();
    }
  }

  /** No active dungeon: info panel with available archetypes + terminal below. */
  private _renderLobby(simulationId: string) {
    const available = dungeonState.availableDungeons.value;
    const loading = dungeonState.loading.value;

    return html`
      <div class="dungeon-lobby">
        <div class="lobby-info">
          <div class="lobby-info__title">${msg('Resonance Dungeons')}</div>
          ${
            loading
              ? html`<span>${msg('Scanning resonance frequencies...')}</span>`
              : available.length > 0
                ? this._renderAvailableList(available)
                : html`<span>${msg('No dungeon archetypes detected in this simulation.')}</span>`
          }
          <div class="lobby-info__hint">
            ${msg("Type 'dungeon' in the terminal to start a run.")}
          </div>
        </div>
        <div class="terminal-wrapper" style="flex:1;min-height:0">
          <velg-bureau-terminal .simulationId=${simulationId}></velg-bureau-terminal>
        </div>
      </div>
    `;
  }

  /** Available archetype list for the lobby info panel. */
  private _renderAvailableList(dungeons: AvailableDungeonResponse[]) {
    return html`
      <div class="lobby-dungeons" role="list" aria-label=${msg('Available dungeons')}>
        ${dungeons.map(
          (d) => html`
            <div
              class="lobby-dungeon ${d.available ? '' : 'lobby-dungeon--unavailable'}"
              role="listitem"
            >
              <span class="lobby-dungeon__name">${getArchetypeDisplayName(d.archetype)}</span>
              <span class="lobby-dungeon__meta">
                <span>${msg('Magnitude')}: ${d.effective_magnitude.toFixed(1)}</span>
                <span>${msg('Difficulty')}: ${d.suggested_difficulty}</span>
                <span>${msg('Depth')}: ${d.suggested_depth + 1}</span>
                ${
                  d.last_run_at
                    ? html`<span>${msg('Last run')}: ${new Date(d.last_run_at).toLocaleDateString()}</span>`
                    : nothing
                }
              </span>
            </div>
          `,
        )}
      </div>
    `;
  }
}

// Wake Lock API types (not yet in all TS libs)
interface WakeLockSentinel {
  readonly released: boolean;
  readonly type: string;
  release(): Promise<void>;
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-dungeon-terminal-view': VelgDungeonTerminalView;
  }
}

/**
 * Dungeon View — parallel-view wrapper for Resonance Dungeons.
 *
 * Renders EITHER the terminal HUD (<velg-dungeon-terminal-view>) OR the
 * graphical scene (<velg-dungeon-graphical-view>) based on
 * dungeonState.viewMode, plus a small overlay toggle to switch between them.
 *
 * Design contract:
 *   - The terminal view is left byte-for-byte unchanged; this wrapper is
 *     transparent to its layout (`:host { display: contents }`) and the toggle
 *     is an absolutely-positioned overlay, never injected into the terminal.
 *   - The graphical view (incl. PixiJS in later phases) is code-split via
 *     dynamic import() so terminal-only users pay no bundle cost.
 *   - Both views are second consumers of the same server-authoritative state;
 *     switching modes changes nothing about the run.
 *
 * Mounted from app-shell at the /simulations/:id/dungeon route.
 *
 * Pattern: SignalWatcher view shell (DungeonTerminalView.ts).
 */

import { localized } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import { dungeonState } from '../../services/DungeonStateManager.js';
import { captureError } from '../../services/SentryService.js';
import './DungeonTerminalView.js';
import './DungeonViewToggle.js';

@localized()
@customElement('velg-dungeon-view')
export class VelgDungeonView extends SignalWatcher(LitElement) {
  static styles = [
    css`
      :host {
        /* Transparent to layout so the terminal view renders exactly as it
           would unwrapped. The toggle below uses position: fixed and therefore
           does not need a positioned host. */
        display: contents;
      }

      /* Terminal only. The graphical view puts the toggle in the flow of its
         own header instead — as a fixed overlay it sat on top of the first
         operative in the party column, which is exactly the spot a player
         reads while deciding. The terminal's layout is left untouched (this
         wrapper's standing contract), so there the overlay stays. */
      .view-toggle {
        position: fixed;
        top: calc(var(--header-height, 60px) + var(--sim-nav-height, 48px) + 8px);
        right: 20px;
        z-index: var(--z-raised, 10);
      }

      @media (max-width: 640px) {
        .view-toggle {
          top: calc(var(--header-height, 52px) + var(--sim-nav-height, 44px) + 6px);
          right: 12px;
        }
      }
    `,
  ];

  /** Simulation slug/id, forwarded to whichever view is active. */
  @property({ type: String }) simulationId = '';

  /** True once the code-split graphical view module has been imported. */
  @state() private _graphicalLoaded = false;

  /** Guards against duplicate import() calls. */
  private _graphicalLoading = false;

  protected willUpdate(): void {
    // Lazy-load the graphical bundle the first time it is requested.
    if (dungeonState.viewMode.value === 'graphical' && !this._graphicalLoaded) {
      void this._loadGraphical();
    }
  }

  private async _loadGraphical(): Promise<void> {
    if (this._graphicalLoading || this._graphicalLoaded) return;
    this._graphicalLoading = true;
    try {
      await import('./graphical/DungeonGraphicalView.js');
      this._graphicalLoaded = true;
    } catch (err) {
      captureError(err, { source: 'DungeonView._loadGraphical' });
      // Fall back to the terminal view so the dungeon stays playable.
      dungeonState.setViewMode('terminal');
    } finally {
      this._graphicalLoading = false;
    }
  }

  protected render() {
    const graphical = dungeonState.viewMode.value === 'graphical';
    return html`
      ${
        graphical && this._graphicalLoaded
          ? html`<velg-dungeon-graphical-view
            .simulationId=${this.simulationId}
          ></velg-dungeon-graphical-view>`
          : graphical
            ? nothing
            : html`<velg-dungeon-terminal-view
              .simulationId=${this.simulationId}
            ></velg-dungeon-terminal-view>`
      }
      ${
        graphical
          ? nothing
          : html`<div class="view-toggle">
            <velg-dungeon-view-toggle></velg-dungeon-view-toggle>
          </div>`
      }
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-dungeon-view': VelgDungeonView;
  }
}

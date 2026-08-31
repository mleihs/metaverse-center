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
import { themeService } from '../../services/ThemeService.js';
import { PLATFORM_DARK_CONFIG } from '../../services/theme-presets.js';
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

  connectedCallback(): void {
    super.connectedCallback();
    /*
     * Re-assert platform-dark for the WHOLE dungeon subtree.
     *
     * README §Grundsätze: "Simulation-Themes: Inhalte theme-fähig,
     * Plattform-Chrome bleibt immer dunkel/amber." A dungeon HUD is an
     * instrument, not content — §4.2 and §4.5 of the design package even name
     * its ground literally (`rgba(10,10,8,.85)`, `rgba(5,9,13,.78)`).
     *
     * WHY HERE AND NOT IN CSS, WHICH IS WHERE IT WAS
     * Both views used to carry an identical hand-written `:host` block that
     * forced eleven tokens back to their platform values with eleven
     * `lint-color-ok` pragmas each. Two copies of one truth, and the copy was
     * INCOMPLETE in the same way the block's own comment warns against ("Any
     * token a CHILD component may read has to be in this block"): it pinned
     * surfaces, text and borders, but not the five status colours — which the
     * children read 245 times. Measured against the pinned ground, across the
     * ten sim presets:
     *
     *     --color-primary       1.06:1  (brutalist)   fails in 5/11
     *     --color-text-inverse  1.91:1  (on amber)    fails in 4/11
     *     --color-danger        2.35:1  (illuminated) fails in 4/11
     *     --color-info          2.46:1  (illuminated) fails in 3/11
     *     --color-success       3.09:1  (illuminated) fails in 2/11
     *     --color-warning       3.88:1  (arc-raiders) fails in 2/11
     *
     * `applyConfig` closes all six and every derived Tier-2 token with them:
     * ThemeService re-derives `--color-{status}-{bg,glow,border,hover}`,
     * `--color-text-quiet` and friends on the host it writes to, because a
     * `color-mix()` inside a custom property resolves where it is DECLARED —
     * inheriting them from the themed shell would have carried the world's
     * colours down into a pinned-dark subtree.
     *
     * Same mechanism, same config object and same reasoning as DriftView:566,
     * which solved this exact problem for the Zwischenraum first.
     * `PLATFORM_DARK_CONFIG` is bound to `:root` by
     * `tests/drift-platform-theme.test.ts`, so the values cannot drift.
     *
     * Applied on this wrapper because it is the single root of BOTH views and
     * of the toggle; custom properties inherit across shadow boundaries, and
     * `display: contents` does not affect that. The element is destroyed on
     * route change, taking its inline tokens with it — no teardown, and never
     * `resetTheme`, which would remove the shell's shared custom-CSS element.
     */
    themeService.applyConfig(PLATFORM_DARK_CONFIG, this);
  }

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

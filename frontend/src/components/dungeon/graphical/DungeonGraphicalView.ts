/**
 * Dungeon Graphical View — the second, graphical rendering of a Resonance
 * Dungeon, built in parallel to the terminal HUD.
 *
 * Phase 0 (this file): a minimal, code-split placeholder that proves the
 * view-switch wiring end-to-end. It is a read-only second consumer of the
 * server-authoritative `dungeonState` — zero game logic lives here. Later
 * phases grow this into the Pixi scene-host ("meter = environment"),
 * combat juice, and generated imagery (see docs/plans/graphical-dungeon-rollout.md).
 *
 * Loaded via dynamic import() from <velg-dungeon-view> so terminal-only users
 * never pay the graphical bundle (incl. PixiJS, added in Phase 2).
 *
 * Pattern: DungeonTerminalView.ts (SignalWatcher, forced-dark tokens).
 */

import { localized, msg } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import { dungeonState } from '../../../services/DungeonStateManager.js';
import { getArchetypeDisplayName } from '../../../utils/dungeon-formatters.js';
import { icons } from '../../../utils/icons.js';
import {
  terminalAnimations,
  terminalComponentTokens,
  terminalTokens,
} from '../../shared/terminal-theme-styles.js';

@localized()
@customElement('velg-dungeon-graphical-view')
export class VelgDungeonGraphicalView extends SignalWatcher(LitElement) {
  static styles = [
    terminalTokens,
    terminalComponentTokens,
    terminalAnimations,
    css`
      :host {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: calc(100vh - var(--header-height, 64px) - var(--sim-nav-height, 48px));
        min-height: 400px;
        padding: 0 16px 16px;
        box-sizing: border-box;

        /* Force platform-dark tokens regardless of simulation theme — same
           rationale as DungeonTerminalView: sim themes (e.g. Velgarien
           brutalist) override --color-surface to white and break contrast. */
        --color-surface: #0a0a0a; /* lint-color-ok */
        --color-surface-raised: #111111; /* lint-color-ok */
        --color-text-primary: #e5e5e5; /* lint-color-ok */
        --color-text-secondary: #a0a0a0; /* lint-color-ok */
        --color-text-muted: #888888; /* lint-color-ok */
        --color-border: #333333; /* lint-color-ok */
        background: var(--color-surface);
        font-family: var(--_mono);
        color: var(--_phosphor-dim);
      }

      .stage {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 16px;
        text-align: center;
        border: 1px dashed color-mix(in srgb, var(--_border) 70%, transparent);
        padding: 32px;
      }

      .stage__icon {
        color: var(--_phosphor);
        opacity: 0.8;
        animation: pulse-glow 2.4s ease-in-out infinite;
      }

      .stage__title {
        font-family: var(--font-brutalist, var(--_mono));
        font-weight: 700;
        font-size: 18px;
        text-transform: uppercase;
        letter-spacing: 2px;
        color: var(--_phosphor);
        margin: 0;
      }

      .stage__sub {
        font-size: 12px;
        max-width: 46ch;
        line-height: 1.6;
        color: var(--_phosphor-dim);
      }

      .status {
        display: flex;
        flex-wrap: wrap;
        gap: 8px 16px;
        justify-content: center;
        margin-top: 8px;
        font-size: 11px;
        letter-spacing: 1px;
      }

      .status__item {
        display: inline-flex;
        gap: 6px;
      }

      .status__key {
        color: var(--_phosphor-faint, var(--color-text-muted));
        text-transform: uppercase;
      }

      .status__val {
        color: var(--_phosphor);
      }

      @keyframes pulse-glow {
        0%,
        100% {
          opacity: 0.55;
        }
        50% {
          opacity: 1;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .stage__icon {
          animation: none;
        }
      }
    `,
  ];

  /** Simulation slug/id — forwarded for parity with the terminal view. */
  @property({ type: String }) simulationId = '';

  protected render() {
    const inDungeon = dungeonState.isInDungeon.value;
    const archetype = dungeonState.clientState.value?.archetype ?? null;
    const phase = dungeonState.phase.value;
    const depth = dungeonState.clientState.value?.depth ?? null;

    return html`
      <div class="stage" role="status" aria-live="polite">
        <div class="stage__icon">${icons.image(56)}</div>
        <h2 class="stage__title">${msg('Graphical Descent')}</h2>
        <p class="stage__sub">
          ${msg(
            'The graphical dungeon is under construction. Your run continues uninterrupted – switch back to Terminal to play. This view reads the same live state.',
          )}
        </p>
        ${
          inDungeon
            ? html`
              <div class="status">
                <span class="status__item">
                  <span class="status__key">${msg('Archetype')}</span>
                  <span class="status__val"
                    >${archetype ? getArchetypeDisplayName(archetype) : '—'}</span
                  >
                </span>
                <span class="status__item">
                  <span class="status__key">${msg('Phase')}</span>
                  <span class="status__val">${phase ?? '—'}</span>
                </span>
                <span class="status__item">
                  <span class="status__key">${msg('Depth')}</span>
                  <span class="status__val">${depth ?? '—'}</span>
                </span>
              </div>
            `
            : html`<div class="status">
              <span class="status__item">
                <span class="status__val">${msg('No active run')}</span>
              </span>
            </div>`
        }
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-dungeon-graphical-view': VelgDungeonGraphicalView;
  }
}

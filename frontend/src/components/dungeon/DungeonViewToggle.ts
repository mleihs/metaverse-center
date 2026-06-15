/**
 * Dungeon View Toggle — switches between the terminal HUD and the graphical
 * scene rendering of a Resonance Dungeon.
 *
 * Placement: rendered as a small overlay control by <velg-dungeon-view> (the
 * parallel-view wrapper), NOT injected into DungeonTerminalView's header. This
 * keeps the terminal view byte-for-byte unchanged.
 *
 * State: reads + writes dungeonState.viewMode (server-authoritative state is
 * untouched — this is a pure UI preference).
 *
 * Pattern: DungeonAudioSettings.ts (SignalWatcher, terminal tokens, no API).
 */

import { localized, msg } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import type { DungeonViewMode } from '../../services/DungeonStateManager.js';
import { dungeonState } from '../../services/DungeonStateManager.js';
import { icons } from '../../utils/icons.js';
import { terminalComponentTokens, terminalTokens } from '../shared/terminal-theme-styles.js';

@localized()
@customElement('velg-dungeon-view-toggle')
export class VelgDungeonViewToggle extends SignalWatcher(LitElement) {
  static styles = [
    terminalTokens,
    terminalComponentTokens,
    css`
      :host {
        display: inline-flex;
        font-family: var(--_mono);
      }

      .toggle {
        display: inline-flex;
        align-items: stretch;
        border: 1px solid color-mix(in srgb, var(--_border) 70%, transparent);
        background: color-mix(in srgb, var(--_surface, var(--color-surface)) 88%, transparent);
        box-shadow: var(--shadow-sm);
      }

      .toggle__btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        min-height: 32px;
        border: none;
        background: transparent;
        color: var(--_phosphor-dim);
        font-family: var(--font-brutalist, var(--_mono));
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1.5px;
        cursor: pointer;
        transition: color var(--transition-fast), background var(--transition-fast);
      }

      .toggle__btn:hover {
        color: var(--_phosphor);
        background: color-mix(in srgb, var(--_phosphor) 8%, transparent);
      }

      .toggle__btn[aria-pressed='true'] {
        color: var(--color-text-inverse);
        background: var(--_phosphor);
      }

      .toggle__btn + .toggle__btn {
        border-left: 1px solid color-mix(in srgb, var(--_border) 70%, transparent);
      }

      .toggle__btn:focus-visible {
        outline: 2px solid var(--_phosphor);
        outline-offset: -2px;
      }

      .toggle__label {
        display: inline-block;
      }

      @media (max-width: 640px) {
        .toggle__label {
          display: none;
        }
        .toggle__btn {
          padding: 6px 10px;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .toggle__btn {
          transition: none;
        }
      }
    `,
  ];

  private _select(mode: DungeonViewMode): void {
    dungeonState.setViewMode(mode);
  }

  protected render() {
    const mode = dungeonState.viewMode.value;
    return html`
      <div class="toggle" role="group" aria-label=${msg('Dungeon view mode')}>
        <button
          type="button"
          class="toggle__btn"
          aria-pressed=${mode === 'terminal'}
          title=${msg('Terminal view')}
          @click=${() => this._select('terminal')}
        >
          ${icons.terminal(13)}<span class="toggle__label">${msg('Terminal')}</span>
        </button>
        <button
          type="button"
          class="toggle__btn"
          aria-pressed=${mode === 'graphical'}
          title=${msg('Graphical view')}
          @click=${() => this._select('graphical')}
        >
          ${icons.image(13)}<span class="toggle__label">${msg('Graphical')}</span>
        </button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-dungeon-view-toggle': VelgDungeonViewToggle;
  }
}

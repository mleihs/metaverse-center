/**
 * Dungeon Enemy Panel -- threat display with telegraphed intents.
 *
 * Into the Breach-inspired: shows enemy state and their planned actions so
 * players can counter-strategize during the combat planning phase.
 * Visible during all combat phases (planning, resolving, outcome).
 *
 * Data: reads dungeonState.combat (enemies + telegraphed_actions).
 * Reuses VelgBadge for threat level indicators.
 *
 * Pattern: DungeonPartyPanel.ts (signal-reactive, terminal aesthetic).
 */

import { localized, msg } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';

import { dungeonState } from '../../services/DungeonStateManager.js';
import type {
  EnemyCombatStateClient,
  TelegraphedAction,
} from '../../types/dungeon.js';
import {
  terminalComponentTokens,
  terminalTokens,
} from '../shared/terminal-theme-styles.js';
import '../shared/VelgBadge.js';

/** Threat level to VelgBadge variant. */
const THREAT_BADGE: Record<string, string> = {
  low: 'info',
  medium: 'warning',
  high: 'danger',
  critical: 'danger',
};

@localized()
@customElement('velg-dungeon-enemy-panel')
export class VelgDungeonEnemyPanel extends SignalWatcher(LitElement) {
  static styles = [
    terminalTokens,
    terminalComponentTokens,
    css`
      :host {
        display: block;
      }

      .panel {
        padding: 6px 8px;
        border: 1px solid color-mix(in srgb, var(--_border) 40%, transparent);
        border-bottom: 1px dashed color-mix(in srgb, var(--_border) 50%, transparent);
        background: color-mix(in srgb, var(--_screen-bg) 85%, transparent);
      }

      .panel__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 4px;
      }

      .panel__title {
        font-family: var(--font-brutalist, var(--_mono));
        font-weight: 700;
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 1.5px;
        color: var(--color-danger);
      }

      .panel__round {
        font-family: var(--_mono);
        font-size: 9px;
        color: var(--_phosphor-dim);
        letter-spacing: 0.5px;
      }

      .enemies {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }

      /* -- Enemy Card -- */
      .enemy {
        flex: 1;
        min-width: 140px;
        display: flex;
        flex-direction: column;
        gap: 3px;
        padding: 4px 6px;
        border: 1px solid color-mix(in srgb, var(--_border) 20%, transparent);
        background: color-mix(in srgb, var(--_screen-bg) 50%, transparent);
      }

      .enemy--dead {
        opacity: 0.25;
      }

      .enemy__header {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .enemy__name {
        font-family: var(--_mono);
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.3px;
        color: var(--_phosphor);
      }

      .enemy--dead .enemy__name {
        text-decoration: line-through;
        color: var(--_phosphor-dim);
      }

      .enemy__threat velg-badge {
        --text-xs: 7px;
        --space-0-5: 1px;
        --space-2: 3px;
        --tracking-wide: 0.05em;
      }

      .enemy__condition {
        font-family: var(--_mono);
        font-size: 8px;
        color: var(--_phosphor-dim);
        margin-left: auto;
        flex-shrink: 0;
      }

      /* -- Intent (telegraphed action) -- */
      .intent {
        display: flex;
        align-items: flex-start;
        gap: 4px;
        padding: 2px 0;
        font-family: var(--_mono);
        font-size: 9px;
        line-height: 1.3;
        color: var(--_phosphor-dim);
      }

      .intent__marker {
        flex-shrink: 0;
        font-size: 8px;
        line-height: 1.5;
      }

      .intent__marker--low { color: var(--color-info); }
      .intent__marker--medium { color: var(--color-warning); }
      .intent__marker--high { color: var(--color-danger); }
      .intent__marker--critical { color: var(--color-danger); font-weight: 700; }

      .intent__text {
        flex: 1;
      }

      .intent__target {
        color: var(--_phosphor);
        font-weight: 600;
      }

      /* -- Animations (opt-in: prefers-reduced-motion: no-preference) -- */
      @media (prefers-reduced-motion: no-preference) {
        .intent__marker--critical {
          animation: threat-pulse 1s ease-in-out infinite;
        }

        .enemy {
          transition: opacity var(--duration-fast, 150ms);
        }
      }

      @keyframes threat-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.25; }
      }

      /* -- Mobile (<=767px) -- */
      @media (max-width: 767px) {
        .panel {
          padding: 4px 6px;
        }

        .enemies {
          flex-wrap: nowrap;
          overflow-x: auto;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
        }

        .enemies::-webkit-scrollbar {
          display: none;
        }

        .enemy {
          min-width: 100px;
          max-width: 160px;
          flex-shrink: 0;
        }

        .intent {
          font-size: 8px;
        }
      }

      /* -- Extra-small (<=640px) -- */
      @media (max-width: 640px) {
        .enemy__condition {
          display: none;
        }

        .intent {
          display: none;
        }
      }

      /* -- Large screens (1440px+) -- */
      @media (min-width: 1440px) {
        .enemy {
          min-width: 160px;
          padding: 5px 8px;
        }

        .enemy__name {
          font-size: 11px;
        }

        .intent {
          font-size: 10px;
        }
      }

      /* -- 4K / Ultra-wide (2560px+) -- */
      @media (min-width: 2560px) {
        .panel {
          padding: 8px 12px;
        }

        .panel__title {
          font-size: 10px;
          letter-spacing: 2px;
        }

        .panel__round {
          font-size: 10px;
        }

        .enemies {
          gap: 6px;
        }

        .enemy {
          padding: 6px 10px;
        }

        .enemy__name {
          font-size: 12px;
        }

        .enemy__condition {
          font-size: 9px;
        }

        .intent {
          font-size: 11px;
        }

        .enemy__threat velg-badge {
          --text-xs: 8px;
          --space-0-5: 2px;
          --space-2: 4px;
        }
      }
    `,
  ];

  // -- Render ---------------------------------------------------------------

  protected render() {
    const combat = dungeonState.combat.value;
    if (!combat || combat.enemies.length === 0) return nothing;

    return html`
      <div class="panel" role="region" aria-label=${msg('Enemy status')}>
        <div class="panel__header">
          <span class="panel__title">${msg('Hostiles')}</span>
          <span class="panel__round">
            ${msg('Round')} ${combat.round_num}/${combat.max_rounds}
          </span>
        </div>
        <div class="enemies" role="list" aria-label=${msg('Enemies')}>
          ${combat.enemies.map((enemy) => this._renderEnemy(enemy))}
        </div>
      </div>
    `;
  }

  private _renderEnemy(enemy: EnemyCombatStateClient) {
    const variant = THREAT_BADGE[enemy.threat_level] ?? 'default';
    const isDead = !enemy.is_alive;

    return html`
      <div
        class="enemy ${isDead ? 'enemy--dead' : ''}"
        role="listitem"
        aria-label=${`${enemy.name_en} ${isDead ? msg('defeated') : enemy.condition_display}`}
      >
        <div class="enemy__header">
          <span class="enemy__name">${enemy.name_en}</span>
          <span class="enemy__threat">
            <velg-badge variant=${variant}>
              ${enemy.threat_level.toUpperCase()}
            </velg-badge>
          </span>
          <span class="enemy__condition">${enemy.condition_display}</span>
        </div>
        ${!isDead && enemy.telegraphed_action
          ? this._renderIntent(enemy.telegraphed_action)
          : nothing}
      </div>
    `;
  }

  private _renderIntent(action: TelegraphedAction) {
    const marker =
      action.threat_level === 'critical'
        ? '\u25C6\u25C6'
        : action.threat_level === 'high'
          ? '\u25C6'
          : '\u25B8';

    return html`
      <div class="intent" aria-label=${`${msg('Intent')}: ${action.intent}`}>
        <span
          class="intent__marker intent__marker--${action.threat_level}"
          aria-hidden="true"
        >${marker}</span>
        <span class="intent__text">
          ${action.intent}${action.target
            ? html` <span class="intent__target">\u2192 ${action.target}</span>`
            : nothing}
        </span>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-dungeon-enemy-panel': VelgDungeonEnemyPanel;
  }
}

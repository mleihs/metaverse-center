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
import type { EnemyCombatStateClient, TelegraphedAction } from '../../types/dungeon.js';
import {
  buildEnemyDisplayNames,
  getEnemyConditionLabel,
  getEnemyHpPercent,
} from '../../utils/dungeon-formatters.js';
import { terminalComponentTokens, terminalTokens } from '../shared/terminal-theme-styles.js';
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

      .enemy__threat {
        display: inline-flex;
        align-items: center;
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
        margin-left: auto;
        flex-shrink: 0;
      }

      /* 5-state condition color coding */
      .enemy__condition--healthy { color: var(--color-success); }
      .enemy__condition--scratched { color: color-mix(in oklch, var(--color-success) 50%, var(--color-warning)); }
      .enemy__condition--damaged { color: var(--color-warning); }
      .enemy__condition--wounded { color: color-mix(in oklch, var(--color-warning) 40%, var(--color-danger)); }
      .enemy__condition--critical { color: var(--color-danger); font-weight: 700; }
      .enemy__condition--defeated { color: var(--_phosphor-dim); }

      /* Diagnostic HP bar — 2px, terminal aesthetic */
      .enemy__hp-bar {
        height: 2px;
        background: color-mix(in srgb, var(--_border) 30%, transparent);
      }
      .enemy__hp-fill {
        height: 100%;
        transition: width 300ms ease-out, background-color 300ms;
      }
      .enemy__hp-fill--healthy { background: var(--color-success); }
      .enemy__hp-fill--scratched { background: color-mix(in oklch, var(--color-success) 50%, var(--color-warning)); }
      .enemy__hp-fill--damaged { background: var(--color-warning); }
      .enemy__hp-fill--wounded { background: color-mix(in oklch, var(--color-warning) 40%, var(--color-danger)); }
      .enemy__hp-fill--critical { background: var(--color-danger); }

      /* BOSS badge — phosphor burn glow */
      .enemy__threat--boss velg-badge {
        text-shadow: 0 0 6px var(--color-danger-glow);
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

        .enemy__threat--boss velg-badge {
          animation: boss-burn 3s ease-in-out infinite;
        }

        /* Signal disruption on hit */
        .enemy--hit {
          animation: signal-disrupt 200ms steps(3);
        }

        /* Phosphor decay on defeat */
        .enemy--dying {
          animation: phosphor-decay 500ms ease-out forwards;
        }
      }

      @keyframes threat-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.25; }
      }

      @keyframes boss-burn {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }

      @keyframes signal-disrupt {
        0%, 100% { transform: none; opacity: 1; }
        25% { transform: translateX(2px); opacity: 0.6; }
        50% { transform: translateX(-1px); opacity: 0.8; }
        75% { transform: translateX(1px); opacity: 0.7; }
      }

      @keyframes phosphor-decay {
        0% { opacity: 1; filter: brightness(1); }
        30% { opacity: 0.8; filter: brightness(1.5); }
        100% { opacity: 0.15; filter: brightness(0.5); }
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

        .intent__text {
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

  // -- Memo guard for display names (avoids rebuilding Map on every signal tick) --

  private _lastEnemies: readonly EnemyCombatStateClient[] | null = null;
  private _cachedDisplayNames: Map<string, string> = new Map();

  private _getDisplayNames(enemies: readonly EnemyCombatStateClient[]): Map<string, string> {
    if (enemies !== this._lastEnemies) {
      this._lastEnemies = enemies;
      this._cachedDisplayNames = buildEnemyDisplayNames(enemies as EnemyCombatStateClient[]);
    }
    return this._cachedDisplayNames;
  }

  // -- Render ---------------------------------------------------------------

  protected render() {
    const combat = dungeonState.combat.value;
    if (!combat || combat.enemies.length === 0) return nothing;

    const displayNames = this._getDisplayNames(combat.enemies);

    return html`
      <div class="panel" role="region" aria-label=${msg('Enemy status')}>
        <div class="panel__header">
          <span class="panel__title">${msg('Hostiles')}</span>
          <span class="panel__round">
            ${msg('Round')} ${combat.round_num}/${combat.max_rounds}
          </span>
        </div>
        <div class="enemies" role="list" aria-label=${msg('Enemies')}>
          ${combat.enemies.map((enemy) => this._renderEnemy(enemy, displayNames))}
        </div>
      </div>
    `;
  }

  private _renderEnemy(enemy: EnemyCombatStateClient, displayNames: Map<string, string>) {
    const variant = THREAT_BADGE[enemy.threat_level] ?? 'default';
    const isDead = !enemy.is_alive;
    const isBoss = enemy.threat_level === 'critical';
    const cond = enemy.condition_display;
    const displayName = displayNames.get(enemy.instance_id) ?? enemy.name_en;

    // HP fill percentage (centralized condition → percent mapping)
    const hpPct = getEnemyHpPercent(cond);

    return html`
      <div
        class="enemy ${isDead ? 'enemy--dead' : ''}"
        role="listitem"
        aria-label=${`${displayName} ${isDead ? msg('defeated') : cond}`}
      >
        <div class="enemy__header">
          <span class="enemy__name">${displayName}</span>
          <span class="enemy__threat ${isBoss ? 'enemy__threat--boss' : ''}">
            <velg-badge variant=${variant}>
              ${enemy.threat_level.toUpperCase()}
            </velg-badge>
          </span>
          <span class="enemy__condition enemy__condition--${cond}">${getEnemyConditionLabel(cond)}</span>
        </div>
        ${
          !isDead
            ? html`
          <div class="enemy__hp-bar">
            <div
              class="enemy__hp-fill enemy__hp-fill--${cond}"
              style="width: ${hpPct}%"
            ></div>
          </div>
        `
            : nothing
        }
        ${
          !isDead && enemy.telegraphed_action
            ? this._renderIntent(enemy.telegraphed_action)
            : nothing
        }
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
          ${action.intent}${
            action.target
              ? html` <span class="intent__target">\u2192 ${action.target}</span>`
              : nothing
          }
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

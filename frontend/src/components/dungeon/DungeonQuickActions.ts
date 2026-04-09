/**
 * Dungeon Quick Actions — phase-driven action buttons below the terminal.
 *
 * Buttons change based on dungeon phase. Each button dispatches a terminal
 * command via the 'terminal-command' CustomEvent (same code path as typing).
 * Written Realms hybrid: click = type command + execute, teaching syntax naturally.
 *
 * Phase → button mapping:
 *   exploring     → [Scout, Map, Look, Status, Retreat]
 *   room_clear    → [Move to Room X, ...] (adjacent rooms)
 *   encounter     → [Look] (choices rendered in terminal as numbered options)
 *   rest          → [Rest All, Move to ...]
 *   treasure      → [Examine Loot, Move to ...]
 *   exit          → [Leave Dungeon, Move to ...]
 *   combat_*      → [Status] (DungeonCombatBar replaces this in Phase 5)
 *   completed/wiped → phase label only
 *
 * Button CSS: shared terminalActionStyles (also used by TerminalQuickActions).
 * Pattern: TerminalQuickActions.ts (dispatch via CustomEvent).
 */

import { localized, msg } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';

import { dungeonState } from '../../services/DungeonStateManager.js';
import type { DungeonPhase } from '../../types/dungeon.js';
import { AUTO_APPLY_EFFECTS, getRoomTypeLabel } from '../../utils/dungeon-formatters.js';
import { localized as localizedField } from '../../utils/locale-fields.js';
import {
  terminalActionStyles,
  terminalComponentTokens,
  terminalTokens,
} from '../shared/terminal-theme-styles.js';
import '../shared/VelgHoldButton.js';

@localized()
@customElement('velg-dungeon-quick-actions')
export class VelgDungeonQuickActions extends SignalWatcher(LitElement) {
  static styles = [
    terminalTokens,
    terminalComponentTokens,
    terminalActionStyles,
    css`
      :host {
        display: block;
      }

      /* ── Room-type risk colors on move buttons ── */
      .action-btn--room-combat {
        border-color: color-mix(in srgb, var(--color-danger) 60%, transparent) !important;
        color: var(--color-danger) !important;
      }
      .action-btn--room-elite {
        border-color: color-mix(in srgb, var(--color-danger) 80%, transparent) !important;
        color: var(--color-danger) !important;
      }
      .action-btn--room-boss {
        border-color: var(--color-danger) !important;
        color: var(--color-danger) !important;
        font-weight: 700 !important;
      }
      .action-btn--room-encounter {
        border-color: color-mix(in srgb, var(--color-warning) 60%, transparent) !important;
        color: var(--color-warning) !important;
      }
      .action-btn--room-treasure {
        border-color: color-mix(in srgb, var(--color-success) 60%, transparent) !important;
        color: var(--color-success) !important;
      }
      .action-btn--room-rest {
        border-color: color-mix(in srgb, var(--color-success) 60%, transparent) !important;
        color: var(--color-success) !important;
      }
      .action-btn--room-exit {
        border-color: color-mix(in srgb, var(--_phosphor) 60%, transparent) !important;
        color: var(--_phosphor) !important;
      }
      .action-btn--room-unknown {
        border-color: color-mix(in srgb, var(--_phosphor-dim) 40%, transparent) !important;
        color: var(--_phosphor-dim) !important;
      }

      /* Depth-based risk shimmer for unknown rooms */
      .action-btn--risk-high {
        border-color: color-mix(in srgb, var(--color-warning) 50%, transparent) !important;
        color: var(--color-warning) !important;
      }
      .action-btn--risk-extreme {
        border-color: color-mix(in srgb, var(--color-danger) 40%, transparent) !important;
        color: color-mix(in srgb, var(--color-danger) 80%, var(--color-warning)) !important;
      }

      /* ── Hold button terminal theming ── */
      velg-hold-button {
        --hold-btn-fill: var(--color-danger-bg, color-mix(in srgb, var(--color-danger) 20%, transparent));
        --hold-btn-color: var(--_phosphor-dim);
        --hold-btn-border: 1px dashed color-mix(in srgb, var(--_border) 70%, transparent);
        font-family: var(--_mono);
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.5px;
      }
    `,
  ];

  private _dispatch(command: string): void {
    this.dispatchEvent(
      new CustomEvent('terminal-command', {
        detail: command,
        bubbles: true,
        composed: true,
      }),
    );
  }

  protected render() {
    const phase = dungeonState.phase.value;
    if (!phase) return nothing;

    return html`
      <div class="actions" role="toolbar" aria-label=${msg('Dungeon actions')}>
        ${this._renderPhaseButtons(phase)}
      </div>
    `;
  }

  private _renderPhaseButtons(phase: DungeonPhase) {
    switch (phase) {
      case 'exploring':
        return html`
          <button class="action-btn action-btn--tier2" @click=${() => this._dispatch('scout')}>
            ${msg('Scout')}
          </button>
          <button class="action-btn" @click=${() => this._dispatch('map')}>
            ${msg('Map')}
          </button>
          <button class="action-btn" @click=${() => this._dispatch('look')}>
            ${msg('Look')}
          </button>
          <button class="action-btn" @click=${() => this._dispatch('status')}>
            ${msg('Status')}
          </button>
          <button class="action-btn" @click=${() => this._dispatch('protocol')}>
            ${msg('Protocol')}
          </button>
          ${this._renderRetreatButton()}
        `;

      case 'room_clear':
        return this._renderMoveButtons();

      case 'encounter':
      case 'threshold':
        return this._renderEncounterButtons();

      case 'rest':
        return html`
          <button class="action-btn action-btn--primary" @click=${() => this._dispatch('rest')}>
            ${msg('Rest All')}
          </button>
          ${this._renderMoveButtons()}
        `;

      case 'treasure':
        return html`
          <button class="action-btn action-btn--primary" @click=${() => this._dispatch('look')}>
            ${msg('Examine Loot')}
          </button>
          ${this._renderMoveButtons()}
        `;

      case 'exit':
        return html`
          <button class="action-btn action-btn--primary" @click=${() => this._dispatch('retreat')}>
            ${msg('Leave Dungeon')}
          </button>
          ${this._renderMoveButtons()}
        `;

      case 'combat_planning':
      case 'combat_resolving':
      case 'combat_outcome':
      case 'boss':
        // Combat UI handled by DungeonCombatBar (rendered by DungeonTerminalView).
        return nothing;

      case 'distributing':
        return this._renderDistributionButtons();

      case 'completed':
      case 'retreated':
      case 'wiped':
        return html` <span class="phase-label">${msg('Dungeon ended')}</span> `;

      default:
        return html`
          <button class="action-btn" @click=${() => this._dispatch('look')}>
            ${msg('Look')}
          </button>
          <button class="action-btn" @click=${() => this._dispatch('status')}>
            ${msg('Status')}
          </button>
        `;
    }
  }

  /** Render assignment + confirm buttons for loot distribution phase. */
  private _renderDistributionButtons() {
    const state = dungeonState.clientState.value;
    if (!state?.pending_loot) return nothing;

    const distributable = state.pending_loot.filter((i) => !AUTO_APPLY_EFFECTS.has(i.effect_type));
    const assignments = state.loot_assignments ?? {};
    const suggestions = state.loot_suggestions ?? {};
    const party = state.party.filter((a) => a.condition !== 'captured');

    // Find first unassigned item
    const nextItem = distributable.find((i) => !assignments[i.id]);
    const nextIndex = nextItem ? distributable.indexOf(nextItem) + 1 : -1;

    if (nextItem) {
      // Show agent buttons for the next unassigned item
      const suggestedId = suggestions[nextItem.id];
      return html`
        <span class="phase-label">${nextItem.name_en}:</span>
        ${party.map(
          (agent) => html`
            <button
              class="action-btn ${agent.agent_id === suggestedId ? 'action-btn--primary' : ''}"
              @click=${() => this._dispatch(`assign ${nextIndex} ${agent.agent_name}`)}
            >
              \u2192 ${agent.agent_name}
            </button>
          `,
        )}
      `;
    }

    // All assigned — show confirm button
    return html`
      <button
        class="action-btn action-btn--primary"
        @click=${() => this._dispatch('confirm')}
      >
        ${msg('Confirm Distribution')}
      </button>
    `;
  }

  /** Render interact buttons for encounter choices (BUG-04 fix). */
  private _renderEncounterButtons() {
    const choices = dungeonState.encounterChoices.value;
    if (choices.length === 0) {
      return html`
        <button class="action-btn" @click=${() => this._dispatch('look')}>
          ${msg('Look')}
        </button>
        <button class="action-btn" @click=${() => this._dispatch('status')}>
          ${msg('Status')}
        </button>
      `;
    }
    return html`
      ${choices.map(
        (choice, i) => html`
          <button
            class="action-btn action-btn--primary"
            @click=${() => this._dispatch(`interact ${i + 1}`)}
          >
            [${i + 1}] ${localizedField(choice, 'label')}
          </button>
        `,
      )}
      <button class="action-btn" @click=${() => this._dispatch('look')}>
        ${msg('Look')}
      </button>
    `;
  }

  private _renderRetreatButton() {
    return html`
      <velg-hold-button
        .label=${msg('Retreat')}
        .holdingLabel=${msg('HOLD\u2026')}
        aria-label=${msg('Hold to retreat')}
        @hold-confirmed=${() => this._dispatch('retreat')}
      ></velg-hold-button>
    `;
  }

  /** Path labels for differentiating rooms at the same depth. */
  private static readonly _PATH_LABELS = ['\u03b1', '\u03b2', '\u03b3', '\u03b4'];

  /**
   * Render move buttons for each adjacent room.
   *
   * Three UX enhancements over plain "??? D2" buttons:
   * 1. Path labels (\u03b1/\u03b2) differentiate rooms at the same depth
   * 2. Risk colors based on room type (red=combat, green=rest/treasure, amber=encounter)
   * 3. Depth-based risk for unknown rooms (deeper = warmer border color)
   */
  private _renderMoveButtons() {
    const adjacent = dungeonState.adjacentRooms.value;
    if (adjacent.length === 0) return nothing;

    // Group by depth to assign path labels within each depth tier
    const byDepth = new Map<number, typeof adjacent>();
    for (const room of adjacent) {
      const arr = byDepth.get(room.depth) ?? [];
      arr.push(room);
      byDepth.set(room.depth, arr);
    }

    return adjacent.map((room) => {
      const isRevealed = room.room_type !== '?';
      const sameDepthRooms = byDepth.get(room.depth) ?? [];
      const pathIdx = sameDepthRooms.indexOf(room);
      const pathLabel =
        sameDepthRooms.length > 1
          ? ` ${VelgDungeonQuickActions._PATH_LABELS[pathIdx] ?? pathIdx + 1}`
          : '';

      // Risk CSS class: room-type color if known, depth-risk if unknown
      let riskClass = '';
      if (isRevealed) {
        riskClass = `action-btn--room-${room.room_type}`;
      } else if (room.depth >= 4) {
        riskClass = 'action-btn--risk-extreme';
      } else if (room.depth >= 3) {
        riskClass = 'action-btn--risk-high';
      } else {
        riskClass = 'action-btn--room-unknown';
      }

      // Button label: full info if scouted, path label + depth if fog
      const label = isRevealed
        ? `${getRoomTypeLabel(room.room_type, room.index)} D${room.depth}`
        : `D${room.depth}${pathLabel}`;

      return html`
        <button
          class="action-btn action-btn--primary ${riskClass}"
          @click=${() => this._dispatch(`move ${room.index}`)}
        >
          ${msg('Move')} \u2192 ${label}
        </button>
      `;
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-dungeon-quick-actions': VelgDungeonQuickActions;
  }
}

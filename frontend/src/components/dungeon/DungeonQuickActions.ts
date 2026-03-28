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
import { terminalActionStyles, terminalComponentTokens, terminalTokens } from '../shared/terminal-theme-styles.js';

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
          <button class="action-btn action-btn--tier2" @click=${() => this._dispatch('retreat')}>
            ${msg('Retreat')}
          </button>
        `;

      case 'room_clear':
        return this._renderMoveButtons();

      case 'encounter':
        // Encounter choices rendered in terminal as numbered options (type `interact 1`).
        // Quick actions provide navigation fallback.
        return html`
          <button class="action-btn" @click=${() => this._dispatch('look')}>
            ${msg('Look')}
          </button>
          <button class="action-btn" @click=${() => this._dispatch('status')}>
            ${msg('Status')}
          </button>
        `;

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

    const distributable = state.pending_loot.filter(i => !AUTO_APPLY_EFFECTS.has(i.effect_type));
    const assignments = state.loot_assignments ?? {};
    const suggestions = state.loot_suggestions ?? {};
    const party = state.party.filter(a => a.condition !== 'captured');

    // Find first unassigned item
    const nextItem = distributable.find(i => !assignments[i.id]);
    const nextIndex = nextItem ? distributable.indexOf(nextItem) + 1 : -1;

    if (nextItem) {
      // Show agent buttons for the next unassigned item
      const suggestedId = suggestions[nextItem.id];
      return html`
        <span class="phase-label">${nextItem.name_en}:</span>
        ${party.map(
          agent => html`
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

  /** Render move buttons for each adjacent revealed room. */
  private _renderMoveButtons() {
    const adjacent = dungeonState.adjacentRooms.value;
    if (adjacent.length === 0) return nothing;

    return adjacent.map(
      (room) => html`
        <button
          class="action-btn action-btn--primary"
          @click=${() => this._dispatch(`move ${room.index}`)}
        >
          ${msg('Move')} \u2192 ${getRoomTypeLabel(room.room_type, room.index)}
        </button>
      `,
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-dungeon-quick-actions': VelgDungeonQuickActions;
  }
}

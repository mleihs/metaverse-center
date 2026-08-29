/**
 * Dungeon Room Panel — slide-in detail panel for map node inspection.
 *
 * Appears when a revealed room node is clicked. Shows:
 *   - Room type icon + label
 *   - Room status (cleared, current, locked)
 *   - Depth indicator
 *   - "Move Here" action button (only for adjacent rooms)
 *
 * Separates exploration (inspecting the map) from action (entering a room).
 * Dispatches `terminal-command` for move, `room-deselect` to close.
 *
 * Pattern: DungeonQuickActions.ts (terminal-command dispatch, action button styling).
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import type { RoomNodeClient } from '../../types/dungeon.js';
import { icons } from '../../utils/icons.js';
import { terminalComponentTokens, terminalTokens } from '../shared/terminal-theme-styles.js';
import { ROOM_ICON, ROOM_ICON_UNKNOWN, roomNodeLabel } from './dungeon-map-icons.js';

// ── Component ───────────────────────────────────────────────────────────────

@localized()
@customElement('velg-dungeon-room-panel')
export class VelgDungeonRoomPanel extends LitElement {
  @property({ type: Object }) room: RoomNodeClient | null = null;
  @property({ type: Boolean }) adjacent = false;
  @property({ type: Boolean }) current = false;
  /** Index of the room the party is standing in, for the "no route" reason. */
  @property({ type: Number }) currentIndex: number | null = null;

  static styles = [
    terminalTokens,
    terminalComponentTokens,
    css`
      :host {
        display: block;
        pointer-events: auto;
      }

      .panel {
        background: color-mix(in srgb, var(--_screen-bg) 96%, transparent);
        border: 1px solid color-mix(in srgb, var(--_phosphor) 40%, transparent);
        padding: 10px 12px;
        font-family: var(--_mono);
        font-size: 10px;
        color: var(--_phosphor-dim);
        max-width: 220px;
        backdrop-filter: blur(4px);
      }

      /* ── Header row ── */
      .panel__header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
      }

      .panel__icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        color: var(--_phosphor);
        flex-shrink: 0;
      }

      .panel__title {
        font-family: var(--font-brutalist, var(--_mono));
        font-weight: 700;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: var(--_phosphor);
        flex: 1;
        min-width: 0;
      }

      .panel__close {
        border: none;
        background: none;
        color: var(--_phosphor-dim);
        cursor: pointer;
        padding: 2px;
        font-size: 14px;
        line-height: 1;
        flex-shrink: 0;
      }

      .panel__close:hover {
        color: var(--_phosphor);
      }

      .panel__close:focus-visible {
        outline: 1px solid var(--_phosphor);
        outline-offset: 1px;
      }

      /* ── Info rows ── */
      .panel__row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 3px 0;
        border-bottom: 1px solid color-mix(in srgb, var(--_border) 20%, transparent);
      }

      .panel__row:last-of-type {
        border-bottom: none;
      }

      .panel__label {
        text-transform: uppercase;
        letter-spacing: 0.5px;
        opacity: 0.6;
        font-size: 9px;
      }

      .panel__value {
        font-weight: 600;
        color: var(--_phosphor);
      }

      .panel__value--cleared {
        color: var(--color-success);
      }

      .panel__value--current {
        color: var(--_phosphor);
      }

      .panel__value--danger {
        color: var(--color-danger);
      }

      /* ── Action button ── */
      .panel__action {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        width: 100%;
        margin-top: 10px;
        padding: 7px 14px;
        font-family: var(--font-brutalist, var(--_mono));
        font-weight: 700;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 1.5px;
        background: transparent;
        color: var(--_phosphor);
        border: 1px solid var(--_phosphor-dim);
        cursor: pointer;
        transition: all 150ms;
      }

      .panel__action:hover {
        border-color: var(--_phosphor);
        background: color-mix(in srgb, var(--_phosphor) 8%, transparent);
      }

      .panel__action:active {
        transform: scale(0.97);
      }

      .panel__action:focus-visible {
        outline: 2px solid var(--_phosphor);
        outline-offset: 2px;
      }

      .panel__action--danger {
        color: var(--color-danger);
        border-color: color-mix(in srgb, var(--color-danger) 50%, transparent);
      }

      .panel__action--danger:hover {
        border-color: var(--color-danger);
        background: color-mix(in srgb, var(--color-danger) 8%, transparent);
      }

      /* ── Standing note ──
         The bottom slot when there is no action to offer. It carries the same
         leading icon column as the action button, so the slot keeps one shape
         whether it holds a verb or a refusal, and the panel never ends on a
         blank edge that reads as a button failing to render. */
      .panel__note {
        display: grid;
        grid-template-columns: 14px 1fr;
        align-items: start;
        gap: 2px 6px;
        margin: 10px 0 0;
        padding-top: 8px;
        border-top: 1px dashed color-mix(in srgb, var(--_border) 45%, transparent);
        font-size: 9px;
        line-height: 1.5;
        color: var(--_phosphor-dim);
      }

      .panel__note-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        margin-top: 1px;
      }

      .panel__note-head {
        display: block;
        font-family: var(--font-brutalist, var(--_mono));
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: var(--_phosphor);
      }

      .panel__note--locked {
        color: var(--color-text-secondary);
      }

      .panel__note--locked .panel__note-head {
        color: color-mix(in srgb, var(--color-danger) 70%, var(--_phosphor));
      }

      @media (prefers-reduced-motion: no-preference) {
        .panel {
          animation: panel-slide-in 200ms var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)) both;
        }

        .panel__action:hover {
          box-shadow: 0 0 8px color-mix(in srgb, var(--_phosphor-glow) 30%, transparent);
        }
      }

      @keyframes panel-slide-in {
        from { opacity: 0; transform: translateY(-8px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `,
  ];

  // ── Render ──────────────────────────────────────────────────────────────

  protected render() {
    const { room, current } = this;
    if (!room) return nothing;

    const iconFn = ROOM_ICON[room.room_type] ?? ROOM_ICON_UNKNOWN;
    const isBoss = room.room_type === 'boss';

    // Status text
    let statusText: string;
    let statusClass = '';
    if (current) {
      statusText = msg('Current');
      statusClass = 'panel__value--current';
    } else if (room.cleared) {
      statusText = msg('Cleared');
      statusClass = 'panel__value--cleared';
    } else if (isBoss) {
      statusText = msg('Active');
      statusClass = 'panel__value--danger';
    } else {
      statusText = msg('Unexplored');
    }

    return html`
      <div class="panel" role="dialog" aria-label=${msg('Room details')}>
        <!-- Header -->
        <div class="panel__header">
          <span class="panel__icon">${iconFn(18)}</span>
          <span class="panel__title">
            ${roomNodeLabel(room)} #${room.index}
          </span>
          <button
            class="panel__close"
            @click=${this._close}
            aria-label=${msg('Close')}
          >&times;</button>
        </div>

        <!-- Info rows -->
        <div class="panel__row">
          <span class="panel__label">${msg('Status')}</span>
          <span class="panel__value ${statusClass}">${statusText}</span>
        </div>
        <div class="panel__row">
          <span class="panel__label">${msg('Depth')}</span>
          <span class="panel__value">${room.depth}</span>
        </div>

        <!-- Bottom slot: an action, or the reason there is none -->
        ${this._renderAction(isBoss)}
      </div>
    `;
  }

  /**
   * The bottom of the panel always says something.
   *
   * It used to be `adjacent && !current ? button : nothing` with no else
   * branch. Click a room two corridors away and the panel named it, gave its
   * depth, and then stopped: nothing separated "you cannot go there" from "the
   * button has not rendered yet". At any moment most of the map is in that
   * state, so silence was the common case rather than the edge one, and the
   * player had to infer a rule the interface never stated.
   *
   * A locked option that names its lock is the convention the encounter
   * choices already follow (utils/dungeon-encounter-choices.ts). Same idea,
   * same reason: knowing what you cannot do is part of knowing where you are.
   */
  private _renderAction(isBoss: boolean) {
    if (this.current) {
      return html`
        <p class="panel__note">
          <span class="panel__note-icon">${icons.mapPin(12)}</span>
          <span>${msg('Your operatives are standing here.')}</span>
        </p>
      `;
    }

    if (!this.adjacent) {
      return html`
        <p class="panel__note panel__note--locked">
          <span class="panel__note-icon">${icons.lock(12)}</span>
          <span>
            <span class="panel__note-head">${msg('Not reachable')}</span>
            ${this._noRouteReason()}
          </span>
        </p>
      `;
    }

    return html`
      <button
        class="panel__action ${isBoss ? 'panel__action--danger' : ''}"
        @click=${this._moveToRoom}
      >
        ${icons.footprints(14)}
        ${isBoss ? msg('Enter Boss Room') : msg('Move Here')}
      </button>
    `;
  }

  /**
   * Why the room cannot be entered, as concretely as the data allows.
   *
   * The reason is always the same one — the room is not among the current
   * room's connections — but naming the room the party actually stands in
   * turns a rule into a fact the player can check against the map.
   */
  private _noRouteReason(): string {
    return this.currentIndex === null
      ? msg('No passage leads to it from where the party stands.')
      : msg(str`No passage leads to it from room #${this.currentIndex}.`);
  }

  // ── Handlers ────────────────────────────────────────────────────────────

  private _close(): void {
    this.dispatchEvent(
      new CustomEvent('room-deselect', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _moveToRoom(): void {
    if (!this.room) return;
    this.dispatchEvent(
      new CustomEvent('terminal-command', {
        detail: `move ${this.room.index}`,
        bubbles: true,
        composed: true,
      }),
    );
    // Close panel after dispatching
    this._close();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-dungeon-room-panel': VelgDungeonRoomPanel;
  }
}

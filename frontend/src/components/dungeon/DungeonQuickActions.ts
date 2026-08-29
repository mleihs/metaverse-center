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
import {
  ARCHETYPE_AWAKENING,
  ARCHETYPE_DELUGE,
  ARCHETYPE_OVERTHROW,
  type DungeonPhase,
} from '../../types/dungeon.js';
import { type ChoiceDescriptor, describeChoices } from '../../utils/dungeon-encounter-choices.js';
import { AUTO_APPLY_EFFECTS, getRoomTypeLabel } from '../../utils/dungeon-formatters.js';
import {
  terminalActionStyles,
  terminalComponentTokens,
  terminalTokens,
} from '../shared/terminal-theme-styles.js';
import '../shared/VelgHoldButton.js';

// ── Room-type risk styling via CSS custom properties ───────────────────────
// Sets --_btn-color, --_btn-border, --_btn-weight on the button element,
// which the shared .action-btn rule reads via fallback values.

const _ROOM_TYPE_STYLES: Record<string, string> = {
  combat:
    '--_btn-color: var(--color-danger); --_btn-border: color-mix(in srgb, var(--color-danger) 60%, transparent)',
  elite:
    '--_btn-color: var(--color-danger); --_btn-border: color-mix(in srgb, var(--color-danger) 80%, transparent)',
  boss: '--_btn-color: var(--color-danger); --_btn-border: var(--color-danger); --_btn-weight: 700',
  encounter:
    '--_btn-color: var(--color-warning); --_btn-border: color-mix(in srgb, var(--color-warning) 60%, transparent)',
  treasure:
    '--_btn-color: var(--color-success); --_btn-border: color-mix(in srgb, var(--color-success) 60%, transparent)',
  rest: '--_btn-color: var(--color-success); --_btn-border: color-mix(in srgb, var(--color-success) 60%, transparent)',
  exit: '--_btn-color: var(--_phosphor); --_btn-border: color-mix(in srgb, var(--_phosphor) 60%, transparent)',
};

const _RISK_UNKNOWN_STYLE =
  '--_btn-color: var(--_phosphor-dim); --_btn-border: color-mix(in srgb, var(--_phosphor-dim) 40%, transparent)';
const _RISK_HIGH_STYLE =
  '--_btn-color: var(--color-warning); --_btn-border: color-mix(in srgb, var(--color-warning) 50%, transparent)';
const _RISK_EXTREME_STYLE =
  '--_btn-color: color-mix(in srgb, var(--color-danger) 80%, var(--color-warning)); --_btn-border: color-mix(in srgb, var(--color-danger) 40%, transparent)';

function _roomTypeStyle(roomType: string): string {
  return _ROOM_TYPE_STYLES[roomType] ?? _RISK_UNKNOWN_STYLE;
}

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

      /* The standing group sits apart from the phase actions: a separator and
         auto margin push it to the trailing edge, so "what can I do here" and
         "what is always available" never read as one undifferentiated row. */
      .actions__standing {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        margin-left: auto;
        padding-left: 10px;
        border-left: 1px dashed color-mix(in srgb, var(--_border) 55%, transparent);
      }
      @media (max-width: 640px) {
        .actions__standing {
          margin-left: 0;
          padding-left: 0;
          border-left: none;
          width: 100%;
          padding-top: 6px;
          border-top: 1px dashed color-mix(in srgb, var(--_border) 55%, transparent);
        }
      }

      /* Room-type risk colors are set via --_btn-color / --_btn-border / --_btn-weight
         custom properties on each button's style attribute (see _renderMoveButtons).
         This avoids !important overrides against the shared terminalActionStyles. */

      /* ── Encounter options ──
         The one place in a run where the player weighs something, so these are
         not chips. Each card carries what the terminal has always printed and
         the HUD never did: the requirement, whether the party meets it, and who
         would step forward. An option out of reach stays VISIBLE and states its
         lock (Disco Elysium's convention) — knowing what you cannot do is part
         of knowing where you are. Hiding it would leave a player wondering
         whether the option existed at all. */
      .choices {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        flex: 1;
      }
      .choice {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 168px;
        max-width: 300px;
        flex: 1 1 200px;
        padding: 7px 9px;
        text-align: left;
        background: transparent;
        border: 1px solid color-mix(in srgb, var(--_border) 70%, transparent);
        border-left: 3px solid var(--_phosphor-dim);
        color: var(--_phosphor-dim);
        font-family: var(--_mono);
        cursor: pointer;
        transition:
          border-color var(--transition-fast, 100ms ease),
          background var(--transition-fast, 100ms ease),
          color var(--transition-fast, 100ms ease);
      }
      .choice:hover:not(:disabled) {
        color: var(--_phosphor);
        border-color: var(--_phosphor-dim);
        border-left-color: var(--_phosphor);
        background: color-mix(in srgb, var(--_phosphor) 6%, transparent);
      }
      .choice:focus-visible {
        outline: 2px solid var(--_phosphor);
        outline-offset: 2px;
      }
      .choice:disabled {
        cursor: not-allowed;
        border-left-color: color-mix(in srgb, var(--color-danger) 55%, transparent);
        opacity: 0.72;
      }
      .choice__label {
        display: flex;
        align-items: baseline;
        gap: 6px;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.4px;
        color: var(--_phosphor);
        text-transform: none;
      }
      .choice:disabled .choice__label {
        color: var(--_phosphor-dim);
      }
      .choice__index {
        flex: none;
        font-weight: 700;
        opacity: 0.6;
      }
      /* Who steps forward — the single most useful line on the card, because it
         names the aptitude the roll will actually use. */
      .choice__volunteer {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 10px;
        color: var(--color-text-secondary);
      }
      .choice__portrait {
        flex: none;
        width: 16px;
        height: 16px;
        object-fit: cover;
        border: 1px solid color-mix(in srgb, var(--_border) 80%, transparent);
      }
      .choice__apt {
        opacity: 0.75;
        font-variant-numeric: tabular-nums;
      }
      .choice__reqs {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 8px;
        font-size: 9px;
        letter-spacing: 0.4px;
        text-transform: uppercase;
      }
      .choice__req {
        color: color-mix(in srgb, var(--color-success) 85%, var(--_phosphor));
      }
      .choice__req--unmet {
        color: var(--color-danger);
        font-weight: 700;
      }

      @media (max-width: 640px) {
        .choice {
          max-width: none;
          flex-basis: 100%;
          min-height: 44px;
        }
      }

      /* Salvage is addressed per room, so it reads as one labelled group of
         room numbers rather than a row of identical verbs. */
      .salvage {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding-left: 8px;
        border-left: 1px dashed color-mix(in srgb, var(--_border) 55%, transparent);
      }
      .salvage__label {
        font-family: var(--_mono);
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 1px;
        text-transform: uppercase;
        color: var(--_phosphor-dim);
      }
      .salvage__room {
        min-width: 26px;
        padding: 5px 7px;
        font-variant-numeric: tabular-nums;
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

    // Two groups: what this phase offers, and what is always true of a run.
    const ended = phase === 'completed' || phase === 'retreated' || phase === 'wiped';
    return html`
      <div class="actions" role="toolbar" aria-label=${msg('Dungeon actions')}>
        ${this._renderPhaseButtons(phase)}
        ${ended ? nothing : this._renderStandingActions()}
      </div>
    `;
  }

  /**
   * Actions that do not belong to a phase: describe the run, or leave it.
   *
   * They used to live inside the phase switch and appeared in `exploring` only.
   * Every other playable phase — room_clear after a won fight, encounter,
   * threshold, rest, treasure — offered no Status, no Protocol and above all no
   * Retreat. In the terminal a player could still type the command; the
   * graphical mode has no buffer to type into, so the action was simply
   * unavailable there. Leaving with the loot you have is precisely the decision
   * a battered party wants after clearing a room, and it was the one the screen
   * would not let them make.
   *
   * The server has never restricted it: `retreat` carries no phase check and
   * cancels a running combat timer on its way out.
   */
  private _renderStandingActions() {
    return html`
      ${this._renderArchetypeActions()}
      <div class="actions__standing">
        <button class="action-btn" @click=${() => this._dispatch('status')}>
          ${msg('Status')}
        </button>
        <button class="action-btn" @click=${() => this._dispatch('protocol')}>
          ${msg('Protocol')}
        </button>
        ${this._renderRetreatButton()}
      </div>
    `;
  }

  /**
   * The archetype's own verb — the one lever that lowers its gauge.
   *
   * `seal` (Deluge), `ground` (Awakening) and `rally` (Overthrow) had ZERO
   * occurrences in the button surface: a terminal player could type them, a
   * graphical player could not reach them at all, so three of eight archetypes
   * were only half playable there. Nothing new is decided here — the buttons
   * dispatch the same verbs through the same `terminal-command` path.
   *
   * Cooldowns are NOT anticipated client-side. The server owns them (it answers
   * with `cooldown_until_room`) and the run state carries no current-cooldown
   * field, so guessing would either grey out a usable lever or promise one that
   * is spent. Its refusal is now visible — the chronicle records it and a toast
   * says it — which is the honest authority rather than a second, weaker one.
   */
  private _renderArchetypeActions() {
    const archetype = dungeonState.clientState.value?.archetype;
    if (!archetype) return nothing;

    if (archetype === ARCHETYPE_DELUGE) {
      return html`
        <button
          class="action-btn action-btn--primary"
          title=${msg('Send a Guardian to seal a breach. Costs stress, then goes on cooldown.')}
          @click=${() => this._dispatch('seal')}
        >
          ${msg('Seal Breach')}
        </button>
        ${this._renderSalvageButtons()}
      `;
    }
    if (archetype === ARCHETYPE_AWAKENING) {
      return html`
        <button
          class="action-btn action-btn--primary"
          title=${msg('Anchor the party in the waking layer. Costs stress, then goes on cooldown.')}
          @click=${() => this._dispatch('ground')}
        >
          ${msg('Ground')}
        </button>
      `;
    }
    if (archetype === ARCHETYPE_OVERTHROW) {
      return html`
        <button
          class="action-btn action-btn--primary"
          title=${msg('Send a Propagandist to hold the faction together. Costs stress, then goes on cooldown.')}
          @click=${() => this._dispatch('rally')}
        >
          ${msg('Rally')}
        </button>
      `;
    }
    return nothing;
  }

  /**
   * Salvage needs a room, so it needs one control per room.
   *
   * The terminal answers "salvage <room_index>" and tells the player to read
   * the map for numbers. A graphical player has no line to type into, so the
   * rooms are enumerated instead — the ones already cleared and left behind,
   * which is what there is to recover from. No eligibility rule is invented
   * here beyond that: if the server declines a particular room, it says so and
   * the chronicle shows the answer.
   */
  private _renderSalvageButtons() {
    const salvageable = dungeonState.rooms.value.filter(
      (room) => room.revealed && room.cleared && !room.current,
    );
    if (salvageable.length === 0) return nothing;

    return html`
      <span class="salvage">
        <span class="salvage__label">${msg('Salvage')}</span>
        ${salvageable.map(
          (room) => html`
            <button
              class="action-btn salvage__room"
              title=${`${msg('Salvage')} ${getRoomTypeLabel(room.room_type, room.index)}`}
              @click=${() => this._dispatch(`salvage ${room.index}`)}
            >
              ${room.index}
            </button>
          `,
        )}
      </span>
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
        `;

      case 'room_clear':
        return this._renderMoveButtons();

      case 'encounter':
      case 'threshold':
        return this._renderEncounterButtons();

      case 'rest':
        // Move buttons excluded: backend rejects moves during rest phase.
        // After "rest" command, phase transitions to room_clear → move buttons appear.
        return html`
          <button class="action-btn action-btn--primary" @click=${() => this._dispatch('rest')}>
            ${msg('Rest All')}
          </button>
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

    // Same derivation the terminal prints from — neither surface can name a
    // different volunteer or read a requirement differently.
    const described = describeChoices(choices, dungeonState.party.value);

    return html`
      <div class="choices">
        ${described.map((choice) => this._renderChoice(choice))}
      </div>
      <button class="action-btn" @click=${() => this._dispatch('look')}>
        ${msg('Look')}
      </button>
    `;
  }

  private _renderChoice(choice: ChoiceDescriptor) {
    const blocked = choice.requirements.filter((r) => !r.met);
    // The accessible name says the whole card, including the lock, because a
    // screen reader user gets the label first and the detail lines after.
    const label = blocked.length
      ? `${choice.label} – ${msg('Out of reach')}: ${blocked
          .map((r) => `${r.label} ${r.level}`)
          .join(', ')}`
      : choice.label;

    return html`
      <button
        class="choice"
        type="button"
        ?disabled=${!choice.available}
        aria-label=${label}
        title=${choice.description ?? label}
        @click=${() => this._dispatch(`interact ${choice.index}`)}
      >
        <span class="choice__label">
          <span class="choice__index">[${choice.index}]</span>
          <span>${choice.label}</span>
        </span>
        ${
          choice.volunteer
            ? html`<span class="choice__volunteer">
              ${
                choice.volunteer.portraitUrl
                  ? html`<img
                    class="choice__portrait"
                    src=${choice.volunteer.portraitUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />`
                  : nothing
              }
              <span>${choice.volunteer.name}</span>
              <span class="choice__apt">
                ${choice.volunteer.aptitude} ${choice.volunteer.level}
              </span>
            </span>`
            : nothing
        }
        ${
          choice.requirements.length
            ? html`<span class="choice__reqs">
              ${choice.requirements.map(
                (req) => html`<span class="choice__req ${req.met ? '' : 'choice__req--unmet'}">
                  ${req.label} ${req.level}${req.met ? '' : ` (${msg('have')} ${req.best})`}
                </span>`,
              )}
            </span>`
            : nothing
        }
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

      // Risk styling via CSS custom properties (no !important needed)
      const riskStyle = isRevealed
        ? _roomTypeStyle(room.room_type)
        : room.depth >= 4
          ? _RISK_EXTREME_STYLE
          : room.depth >= 3
            ? _RISK_HIGH_STYLE
            : _RISK_UNKNOWN_STYLE;

      // Button label: full info if scouted, path label + depth if fog
      const clearedTag = room.cleared ? ' \u2713' : '';
      const label = isRevealed
        ? `${getRoomTypeLabel(room.room_type, room.index)} D${room.depth}${pathLabel}${clearedTag}`
        : `D${room.depth}${pathLabel}`;

      return html`
        <button
          class="action-btn action-btn--primary"
          style=${riskStyle}
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

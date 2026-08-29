/**
 * Dungeon Chronicle — the account of the descent, in the graphical HUD.
 *
 * WHY THIS EXISTS
 * The graphical dungeon runs every command through the same `parseAndExecute`
 * pipeline as the terminal and receives the same complete `TerminalLine[]` back
 * — it simply had nowhere to render it. Dice rolls, check results, loot drops
 * and the server's refusals ("Cannot move in phase: rest") were all produced
 * and then dropped on the floor. A player who only ever used the graphical view
 * decided without grounds and never learned the outcome.
 *
 * So this is not a second formatter. It is a second RENDERER of the one stream
 * (`terminalState.dungeonNarration`), which means every formatter written from
 * here on appears in both surfaces without anyone remembering to. That is the
 * same contract `utils/dungeon-room-text.ts` established for room prose: one
 * derivation, two surfaces.
 *
 * FORM
 * Not a terminal with a picture behind it. Disco Elysium's column feed is the
 * model — the player skims a stack of short, strongly typed entries rather than
 * reading a wall. A `command` line opens a BEAT: the player's own action, set as
 * a dim stub, with everything that action caused indented beneath it. Beats are
 * separated by a hairline, so "what I did / what happened" is legible at a
 * glance in a 340px column.
 *
 * The empty state is one inline line rather than <velg-empty-state>: this is a
 * log rail inside a HUD, not a data view, and the shared component's centred
 * card would break the column. There is no loading state — the source is a
 * signal, never a fetch.
 *
 * Pattern: BureauTerminal.ts owns the canonical line-type palette; the five
 * combat roles and the error/hint treatments are kept recognisably the same
 * here so a player switching views reads the same colours for the same things.
 */

import { localized, msg } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';

import { terminalState } from '../../../services/TerminalStateManager.js';
import type { TerminalLine } from '../../../types/terminal.js';
import { icons } from '../../../utils/icons.js';

/** Distance from the bottom (px) still counted as "following the stream". */
const STICK_THRESHOLD_PX = 40;

/** One player action and everything it caused. */
interface Beat {
  /** The echoed command that opened this beat; null for the run's opening. */
  readonly command: TerminalLine | null;
  readonly lines: TerminalLine[];
  /** Stable key for lit's repeat(). */
  readonly key: string;
}

/**
 * Group the flat stream into beats.
 *
 * Blank lines are dropped: the terminal uses `systemLine('')` for vertical
 * rhythm in a 500-line scrollback, and reproducing that in a narrow column
 * would leave more air than text. Spacing here is the feed's own.
 */
function toBeats(lines: TerminalLine[]): Beat[] {
  const beats: Beat[] = [];
  let current: Beat | null = null;

  for (const line of lines) {
    if (line.type === 'command') {
      current = { command: line, lines: [], key: line.id };
      beats.push(current);
      continue;
    }
    if (!line.content.trim()) continue;
    if (!current) {
      current = { command: null, lines: [], key: `opening-${line.id}` };
      beats.push(current);
    }
    current.lines.push(line);
  }

  return beats.filter((beat) => beat.command !== null || beat.lines.length > 0);
}

@localized()
@customElement('velg-dungeon-chronicle')
export class VelgDungeonChronicle extends SignalWatcher(LitElement) {
  static styles = [
    css`
      :host {
        /* Tier 3 — the HUD's amber phosphor, plus the two status roles the
           combat palette needs. Declared here rather than pulled from
           terminalComponentTokens because this component also needs the
           danger/success pair, and one :host block is easier to read than two. */
        --_phosphor: var(--color-accent-amber);
        --_phosphor-dim: var(--color-accent-amber-dim);
        --_phosphor-glow: var(--color-accent-amber-glow);
        --_danger: var(--color-danger);
        --_success: var(--color-success);
        --_border: var(--color-border);
        --_text-dim: var(--color-text-muted);
        --_mono: var(--font-mono, 'SF Mono', 'Fira Code', 'Cascadia Code', monospace);

        display: flex;
        flex-direction: column;
        min-height: 0;
        overflow: hidden;
      }

      /* ── Header: a brutalist plate with a hairline under it ── */
      .chron__head {
        flex: none;
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: var(--space-2, 8px);
        padding: var(--space-1-5, 6px) var(--space-2, 8px) var(--space-1, 4px);
        border-bottom: 1px dashed color-mix(in srgb, var(--_border) 55%, transparent);
      }
      .chron__title {
        font-family: var(--font-brutalist, var(--_mono));
        font-size: var(--text-xs, 10px);
        font-weight: var(--font-bold, 700);
        text-transform: uppercase;
        letter-spacing: var(--tracking-brutalist, 0.08em);
        color: var(--_phosphor);
      }
      .chron__count {
        font-family: var(--_mono);
        font-size: 9px;
        letter-spacing: var(--tracking-wide, 0.025em);
        color: var(--_text-dim);
        font-variant-numeric: tabular-nums;
      }

      /* ── Stream ── */
      .chron__stream {
        flex: 1 1 0;
        min-height: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
        padding: var(--space-2, 8px);
        display: flex;
        flex-direction: column;
        gap: var(--space-2-5, 10px);
      }
      .chron__stream::-webkit-scrollbar {
        width: 6px;
      }
      .chron__stream::-webkit-scrollbar-track {
        background: transparent;
      }
      .chron__stream::-webkit-scrollbar-thumb {
        background: color-mix(in srgb, var(--_phosphor) 22%, transparent);
      }
      .chron__stream::-webkit-scrollbar-thumb:hover {
        background: color-mix(in srgb, var(--_phosphor) 40%, transparent);
      }

      .chron__empty {
        font-family: var(--_mono);
        font-size: 11px;
        font-style: italic;
        line-height: var(--leading-normal, 1.5);
        color: var(--_text-dim);
        padding: var(--space-2, 8px) 0;
      }

      /* ── Beat: one action and its consequences ── */
      .beat {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .beat + .beat {
        padding-top: var(--space-2-5, 10px);
        border-top: 1px solid color-mix(in srgb, var(--_border) 40%, transparent);
      }

      .beat__cmd {
        display: flex;
        align-items: center;
        gap: 4px;
        font-family: var(--font-brutalist, var(--_mono));
        font-size: 9px;
        font-weight: var(--font-bold, 700);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wider, 0.05em);
        color: color-mix(in srgb, var(--_phosphor) 62%, transparent);
      }
      .beat__cmd svg {
        flex: none;
        opacity: 0.7;
      }
      .beat__cmd-text {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      /* Consequences sit under the action, inset by the chevron's width so the
         hierarchy reads without a second border. */
      .beat__body {
        display: flex;
        flex-direction: column;
        gap: 1px;
        padding-left: 12px;
      }
      .beat--opening .beat__body {
        padding-left: 0;
      }

      /* ── Entries, by line type. Same colour vocabulary as BureauTerminal. ── */
      .entry {
        font-family: var(--_mono);
        font-size: 11px;
        line-height: var(--leading-normal, 1.5);
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        color: var(--_phosphor-dim);
      }
      .entry--response {
        color: color-mix(in srgb, var(--color-text-primary) 78%, transparent);
      }
      .entry--system {
        color: var(--_phosphor);
        letter-spacing: var(--tracking-wide, 0.025em);
      }
      .entry--art {
        font-size: 9px;
        line-height: var(--leading-tight, 1.25);
        color: var(--_phosphor);
      }
      .entry--hint {
        font-style: italic;
        color: color-mix(in srgb, var(--_text-dim) 85%, transparent);
      }
      .entry--error {
        color: color-mix(in srgb, var(--_danger) 82%, var(--_phosphor));
        font-weight: var(--font-semibold, 600);
        padding-left: var(--space-1-5, 6px);
        border-left: 2px solid color-mix(in srgb, var(--_danger) 70%, transparent);
      }
      .entry--combat-player {
        color: var(--_phosphor);
        font-weight: var(--font-semibold, 600);
      }
      .entry--combat-miss {
        color: var(--_text-dim);
        font-style: italic;
        opacity: 0.62;
      }
      .entry--combat-damage {
        color: var(--_danger);
        font-weight: var(--font-semibold, 600);
      }
      .entry--combat-heal {
        color: var(--_success);
        font-weight: var(--font-semibold, 600);
      }
      .entry--combat-system {
        color: var(--_phosphor);
        font-weight: var(--font-bold, 700);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide, 0.025em);
      }

      /* ── "Jump to latest": only offered when the player has scrolled away
           and the stream has moved on without them. ── */
      .chron__jump {
        flex: none;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--space-1, 4px);
        margin: 0 var(--space-2, 8px) var(--space-1-5, 6px);
        padding: var(--space-1, 4px) var(--space-2, 8px);
        border: 1px solid color-mix(in srgb, var(--_phosphor) 45%, transparent);
        background: color-mix(in srgb, var(--color-surface) 88%, transparent);
        color: var(--_phosphor);
        font-family: var(--font-brutalist, var(--_mono));
        font-size: 9px;
        font-weight: var(--font-bold, 700);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wider, 0.05em);
        cursor: pointer;
        transition: background var(--transition-fast, 100ms ease);
      }
      .chron__jump:hover {
        background: color-mix(in srgb, var(--_phosphor) 12%, transparent);
      }
      .chron__jump:focus-visible {
        outline: 2px solid var(--_phosphor);
        outline-offset: 2px;
      }

      /* ── Motion: a new beat settles in rather than snapping. ── */
      @media (prefers-reduced-motion: no-preference) {
        .beat--newest {
          animation: chron-settle var(--duration-entrance, 350ms) var(--ease-settle, ease-out);
        }
        @keyframes chron-settle {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: none;
          }
        }
      }

      /* ── The column collapses to a short rail on narrow screens. ── */
      @media (max-width: 1199px) {
        .chron__stream {
          gap: var(--space-2, 8px);
        }
      }
    `,
  ];

  /** True while the player is following the bottom of the stream. */
  @state() private _stuck = true;
  /** True when entries arrived while the player was reading further up. */
  @state() private _unseen = false;

  private _lastCount = 0;

  protected updated(): void {
    const stream = this.renderRoot.querySelector<HTMLElement>('.chron__stream');
    if (!stream) return;

    const count = terminalState.dungeonNarration.value.length;
    const grew = count > this._lastCount;
    this._lastCount = count;
    if (!grew) return;

    if (this._stuck) {
      stream.scrollTop = stream.scrollHeight;
      if (this._unseen) this._unseen = false;
    } else if (!this._unseen) {
      this._unseen = true;
    }
  }

  private _onScroll(e: Event): void {
    const el = e.currentTarget as HTMLElement;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const stuck = distance <= STICK_THRESHOLD_PX;
    if (stuck !== this._stuck) this._stuck = stuck;
    if (stuck && this._unseen) this._unseen = false;
  }

  private _jumpToLatest(): void {
    const stream = this.renderRoot.querySelector<HTMLElement>('.chron__stream');
    if (!stream) return;
    stream.scrollTop = stream.scrollHeight;
    this._stuck = true;
    this._unseen = false;
  }

  protected render() {
    const lines = terminalState.dungeonNarration.value;
    const beats = toBeats(lines);

    return html`
      <div class="chron__head">
        <span class="chron__title">${msg('Chronicle')}</span>
        ${beats.length > 0 ? html`<span class="chron__count">${beats.length}</span>` : nothing}
      </div>

      <div
        class="chron__stream"
        role="log"
        aria-live="polite"
        aria-label=${msg('Chronicle of the descent')}
        @scroll=${this._onScroll}
      >
        ${
          beats.length === 0
            ? html`<p class="chron__empty">
              ${msg('Nothing has happened yet. Your actions and their outcomes appear here.')}
            </p>`
            : repeat(
                beats,
                (beat) => beat.key,
                (beat, i) => this._renderBeat(beat, i === beats.length - 1),
              )
        }
      </div>

      ${
        this._unseen
          ? html`<button
            class="chron__jump"
            type="button"
            @click=${this._jumpToLatest}
          >
            ${icons.chevronDown(11)} ${msg('Latest')}
          </button>`
          : nothing
      }
    `;
  }

  private _renderBeat(beat: Beat, newest: boolean) {
    const classes = ['beat', beat.command ? '' : 'beat--opening', newest ? 'beat--newest' : '']
      .filter(Boolean)
      .join(' ');

    return html`
      <div class=${classes}>
        ${
          beat.command
            ? html`<div class="beat__cmd">
              ${icons.chevronRight(10)}
              <span class="beat__cmd-text">${beat.command.content}</span>
            </div>`
            : nothing
        }
        <div class="beat__body">
          ${beat.lines.map((line) => this._renderEntry(line))}
        </div>
      </div>
    `;
  }

  private _renderEntry(line: TerminalLine) {
    return html`<div class="entry entry--${line.type}">${line.content}</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-dungeon-chronicle': VelgDungeonChronicle;
  }
}

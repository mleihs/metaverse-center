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
import type { TerminalLine, TerminalLineMeta } from '../../../types/terminal.js';
import { icons } from '../../../utils/icons.js';
import { a11yStyles } from '../../shared/a11y-styles.js';

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
    a11yStyles,
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
        /* Toward the surface, not toward the transparent keyword. Mixing a colour with
           transparent does not dim it, it makes it TRANSLUCENT — the result
           depends on whatever the layer happens to sit on, and here that was a
           backdrop image, so the measured value was 2.14 : 1, the worst line in
           the dungeon. Mixing toward the surface names the same visual dimming
           as an opaque colour that can actually be measured. 78% clears AA. */
        color: color-mix(in srgb, var(--_phosphor) 78%, var(--color-surface));
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
        /* Same correction as .beat__cmd: opaque against the surface instead of
           translucent against whatever is behind it. */
        color: color-mix(in srgb, var(--_text-dim) 92%, var(--color-surface));
      }
      .entry--error {
        color: color-mix(in srgb, var(--_danger) 82%, var(--_phosphor));
        font-weight: var(--font-semibold, 600);
        /* Doppelung: die Zeile steht bereits in Gefahrenfarbe und halbfett.
           Der Einzug bleibt, damit Fehler im Strom hervortreten. */
        padding-left: var(--space-1-5, 6px);
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

      /* ── The check: the roll a decision actually turned on ──
         The terminal prints five lines to say this ("[INFILTRATOR CHECK –
         Modifier: +40]", "Rolling... 94 (+40) = 100", a bar, "Result: 100 –
         SUCCESS"). Those numbers ride along the header line as structured data,
         so this draws them instead of re-reading the prose. Baldur's Gate 3's
         order is the one that reads: the raw die first, then the modifier
         arriving to change it, then the sum, then the verdict. */
      .check {
        margin: var(--space-1, 4px) 0 var(--space-1-5, 6px);
        padding: var(--space-2, 8px);
        border: 1px solid color-mix(in srgb, var(--_outcome, var(--_phosphor)) 42%, transparent);
        border-left-width: 3px;
        background: color-mix(in srgb, var(--_outcome, var(--_phosphor)) 6%, transparent);
      }
      .check__apt {
        font-family: var(--font-brutalist, var(--_mono));
        font-size: 9px;
        font-weight: var(--font-bold, 700);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wider, 0.05em);
        color: var(--_phosphor-dim);
      }
      .check__math {
        display: flex;
        align-items: center;
        gap: var(--space-1-5, 6px);
        margin-top: var(--space-1, 4px);
        font-family: var(--_mono);
        font-variant-numeric: tabular-nums;
      }
      .check__die {
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 34px;
        padding: 3px 6px;
        border: 1px solid color-mix(in srgb, var(--_phosphor) 55%, transparent);
        font-size: 15px;
        font-weight: var(--font-bold, 700);
        line-height: 1.1;
        color: var(--_phosphor);
      }
      .check__mod {
        font-size: 11px;
        font-weight: var(--font-semibold, 600);
        color: var(--_text-dim);
      }
      .check__mod--up {
        color: var(--_success);
      }
      .check__mod--down {
        color: var(--_danger);
      }
      .check__sum {
        margin-left: auto;
        font-size: 15px;
        font-weight: var(--font-bold, 700);
        color: var(--_outcome, var(--_phosphor));
      }
      /* The same 0..100 magnitude the terminal draws as an ASCII bar. */
      .check__track {
        position: relative;
        height: 3px;
        margin-top: var(--space-1-5, 6px);
        background: color-mix(in srgb, var(--_border) 80%, transparent);
        overflow: hidden;
      }
      .check__fill {
        position: absolute;
        inset: 0 auto 0 0;
        width: var(--_roll-pct, 0%);
        background: var(--_outcome, var(--_phosphor));
      }
      .check__verdict {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: var(--space-2, 8px);
        margin-top: var(--space-1-5, 6px);
        font-family: var(--font-brutalist, var(--_mono));
        font-size: 10px;
        font-weight: var(--font-bold, 700);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wider, 0.05em);
        color: var(--_outcome, var(--_phosphor));
      }
      .check__odds {
        font-family: var(--_mono);
        font-size: 9px;
        font-weight: var(--font-normal, 400);
        letter-spacing: var(--tracking-normal, 0);
        text-transform: none;
        color: var(--_text-dim);
        font-variant-numeric: tabular-nums;
      }

      /* The sequence: die, then the modifier arriving, then the sum, then the
         verdict. Delays only — no layout jump, so a slow frame cannot leave a
         gap where a number will be. */
      @media (prefers-reduced-motion: no-preference) {
        .check__die {
          animation: check-drop 220ms var(--ease-slam, ease-out) both;
        }
        .check__mod {
          animation: check-arrive 240ms var(--ease-settle, ease-out) 200ms both;
        }
        .check__sum {
          animation: check-land 220ms var(--ease-slam, ease-out) 420ms both;
        }
        .check__fill {
          animation: check-sweep 420ms var(--ease-out, ease-out) 420ms both;
        }
        .check__verdict {
          animation: check-verdict 260ms var(--ease-settle, ease-out) 620ms both;
        }
        @keyframes check-drop {
          from {
            opacity: 0;
            transform: translateY(-5px) scale(0.9);
          }
          to {
            opacity: 1;
            transform: none;
          }
        }
        @keyframes check-arrive {
          from {
            opacity: 0;
            transform: translateX(10px);
          }
          to {
            opacity: 1;
            transform: none;
          }
        }
        @keyframes check-land {
          from {
            opacity: 0;
            transform: scale(1.25);
          }
          to {
            opacity: 1;
            transform: none;
          }
        }
        @keyframes check-sweep {
          from {
            width: 0%;
          }
        }
        @keyframes check-verdict {
          from {
            opacity: 0;
            transform: translateY(3px);
          }
          to {
            opacity: 1;
            transform: none;
          }
        }
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
    // The check widget says what the five text lines say. Draw it once, drop
    // the lines it replaces — the terminal keeps printing all five unchanged.
    if (line.meta?.kind === 'skill-check-part') return nothing;
    if (line.meta?.kind === 'skill-check') return this._renderCheck(line.meta);
    return html`<div class="entry entry--${line.type}">${line.content}</div>`;
  }

  private _renderCheck(check: Extract<TerminalLineMeta, { kind: 'skill-check' }>) {
    const verdict =
      check.result === 'success'
        ? msg('Success')
        : check.result === 'partial'
          ? msg('Partial success')
          : msg('Failure');
    // Colour is the verdict. `--_outcome` drives the frame, the sum, the track
    // and the band together, so the whole block reads as one answer.
    const outcome =
      check.result === 'success'
        ? 'var(--_success)'
        : check.result === 'partial'
          ? 'var(--color-warning)'
          : 'var(--_danger)';
    const signed = check.adjustment >= 0 ? `+${check.adjustment}` : `${check.adjustment}`;
    const modClass =
      check.adjustment > 0 ? 'check__mod--up' : check.adjustment < 0 ? 'check__mod--down' : '';

    return html`
      <div class="check" style="--_outcome:${outcome};--_roll-pct:${check.effectiveRoll}%">
        <span class="visually-hidden">
          ${check.aptitude} ${check.level}: ${check.roll} ${signed} = ${check.effectiveRoll}.
          ${verdict}.
        </span>
        <div aria-hidden="true">
          <div class="check__apt">${check.aptitude} ${check.level}</div>
          <div class="check__math">
            <span class="check__die">${check.roll}</span>
            <span class="check__mod ${modClass}">${signed}</span>
            <span class="check__sum">${check.effectiveRoll}</span>
          </div>
          <div class="check__track"><div class="check__fill"></div></div>
          <div class="check__verdict">
            <span>${verdict}</span>
            <span class="check__odds">${check.chance}%</span>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-dungeon-chronicle': VelgDungeonChronicle;
  }
}

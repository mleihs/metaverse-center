/**
 * Bureau Terminal — Core CRT terminal component.
 *
 * Cold War-era intelligence terminal aesthetic: amber phosphor on black,
 * scanline drift, phosphor persistence on new text, chromatic aberration
 * on headers. All visual effects gated behind prefers-reduced-motion.
 *
 * Architecture: LitElement + Preact Signals. Uses terminal-commands.ts
 * for parsing and terminal-formatters.ts for output formatting.
 *
 * Accessibility: role="log" output, aria-live regions, keyboard navigation,
 * screen reader mode strips all CRT effects.
 */

import { localized, msg } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement, nothing, type PropertyValues } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { classMap } from 'lit/directives/class-map.js';
import { terminalState } from '../../services/TerminalStateManager.js';
import { heartbeatApi } from '../../services/api/index.js';
import { appState } from '../../services/AppStateManager.js';
import { parseAndExecute, getBootSequence, getReentrySequence } from '../../utils/terminal-commands.js';
import { formatFeedEntry } from '../../utils/terminal-formatters.js';
import {
  terminalTokens,
  terminalAnimations,
} from '../shared/terminal-theme-styles.js';
import type { TerminalLine } from '../../types/terminal.js';
import './TerminalQuickActions.js';

// ── Constants ──────────────────────────────────────────────────────────────

const FEED_POLL_INTERVAL_MS = 30_000;
const BOOT_LINE_DELAY_MS = 80;
const MAX_SCROLL_TOLERANCE = 60;

// ── Component ──────────────────────────────────────────────────────────────

@localized()
@customElement('velg-bureau-terminal')
export class VelgBureauTerminal extends SignalWatcher(LitElement) {
  static styles = [
    terminalTokens,
    terminalAnimations,
    css`
      /* ── Host ── */
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
        /* CRT terminals are ALWAYS dark regardless of simulation theme.
           Hard amber palette ensures WCAG AA contrast (>4.5:1) on near-black bg.
           lint-color-ok: CRT emulation requires fixed dark palette, cannot use theme tokens. */
        --_phosphor: #f59e0b; /* lint-color-ok */
        --_phosphor-dim: #d97706; /* lint-color-ok */
        --_phosphor-glow: #fbbf2480; /* lint-color-ok */
        --_screen-bg: #0a0a08; /* lint-color-ok */
        --_surface: #12120e; /* lint-color-ok */
        --_border: #3d3200; /* lint-color-ok */
        --_text: #f5c542; /* lint-color-ok */
        --_text-dim: #a68a2e; /* lint-color-ok */
        --_mono: var(--font-mono, 'SF Mono', 'Fira Code', 'Cascadia Code', monospace);
        --_danger: #ef4444; /* lint-color-ok */
        --_success: #22c55e; /* lint-color-ok */
      }

      /* ── Terminal Frame ── */
      .terminal {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 0;
        background: var(--_screen-bg);
        border: 1px solid var(--_border);
        position: relative;
        overflow: hidden;
      }

      /* Corner brackets — military HUD framing */
      .terminal::before,
      .terminal::after {
        content: '';
        position: absolute;
        width: 14px;
        height: 14px;
        border-color: var(--_phosphor);
        border-style: solid;
        pointer-events: none;
        z-index: 4;
      }
      .terminal::before {
        top: -1px; left: -1px;
        border-width: 2px 0 0 2px;
      }
      .terminal::after {
        top: -1px; right: -1px;
        border-width: 2px 2px 0 0;
      }

      .terminal__bottom-corners {
        position: absolute;
        bottom: -1px;
        left: 0;
        right: 0;
        height: 0;
        pointer-events: none;
        z-index: 4;
      }
      .terminal__bottom-corners::before,
      .terminal__bottom-corners::after {
        content: '';
        position: absolute;
        width: 14px;
        height: 14px;
        border-color: var(--_phosphor);
        border-style: solid;
      }
      .terminal__bottom-corners::before {
        bottom: 0; left: -1px;
        border-width: 0 0 2px 2px;
      }
      .terminal__bottom-corners::after {
        bottom: 0; right: -1px;
        border-width: 0 2px 2px 0;
      }

      /* ── Scanline Overlay ── */
      .terminal__scanlines {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 3;
        opacity: 0.4;
      }

      @media (prefers-reduced-motion: no-preference) {
        .terminal__scanlines {
          background: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            color-mix(in srgb, var(--_phosphor) 3%, transparent) 2px,
            color-mix(in srgb, var(--_phosphor) 3%, transparent) 4px
          );
          animation: scanline-drift 8s linear infinite;
        }

        @keyframes scanline-drift {
          0% { background-position: 0 0; }
          100% { background-position: 0 4px; }
        }
      }

      /* ── Screen Curvature (subtle barrel distortion) ── */
      @media (prefers-reduced-motion: no-preference) {
        .terminal__screen {
          /* Subtle vignette on edges simulating CRT curvature */
          box-shadow: inset 0 0 80px color-mix(in srgb, black 40%, transparent);
        }
      }

      /* ── Output Area ── */
      .terminal__screen {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 16px 20px;
        scroll-behavior: smooth;
        position: relative;
        z-index: 2;
      }

      .terminal__screen::-webkit-scrollbar {
        width: 6px;
      }
      .terminal__screen::-webkit-scrollbar-track {
        background: transparent;
      }
      .terminal__screen::-webkit-scrollbar-thumb {
        background: color-mix(in srgb, var(--_phosphor) 25%, transparent);
        border-radius: 3px;
      }
      .terminal__screen::-webkit-scrollbar-thumb:hover {
        background: color-mix(in srgb, var(--_phosphor) 40%, transparent);
      }

      /* ── Terminal Lines ── */
      .line {
        font-family: var(--_mono);
        font-size: 13px;
        line-height: 1.6;
        white-space: pre-wrap;
        word-break: break-word;
        color: var(--_phosphor-dim);
        padding: 1px 0;
      }

      /* Phosphor glow on text */
      @media (prefers-reduced-motion: no-preference) {
        .line {
          text-shadow: 0 0 3px color-mix(in srgb, var(--_phosphor-glow) 50%, transparent);
        }
      }

      /* Line type variants */
      .line--command {
        color: var(--_phosphor);
        font-weight: 600;
      }

      @media (prefers-reduced-motion: no-preference) {
        .line--command {
          text-shadow: 0 0 6px var(--_phosphor-glow);
        }
      }

      .line--system {
        color: var(--_phosphor);
        letter-spacing: 0.5px;
      }

      @media (prefers-reduced-motion: no-preference) {
        .line--system {
          text-shadow:
            0 0 4px var(--_phosphor-glow),
            -0.4px 0 color-mix(in srgb, var(--_danger) 6%, transparent),
            0.4px 0 color-mix(in srgb, var(--_success) 6%, transparent);
        }
      }

      .line--error {
        color: color-mix(in srgb, var(--_danger) 80%, var(--_phosphor));
      }

      @media (prefers-reduced-motion: no-preference) {
        .line--error {
          text-shadow: 0 0 6px color-mix(in srgb, var(--_danger) 40%, transparent);
        }
      }

      .line--feed {
        color: var(--_text-dim);
        font-size: 12px;
      }

      .line--hint {
        color: var(--_phosphor-dim);
        font-style: italic;
        font-size: 12px;
      }

      /* Phosphor persistence — new lines appear bright then settle */
      @media (prefers-reduced-motion: no-preference) {
        .line--fresh {
          animation: phosphor-persist 1.2s ease-out;
        }

        @keyframes phosphor-persist {
          0% {
            filter: brightness(1.8);
            text-shadow: 0 0 12px var(--_phosphor-glow);
          }
          100% {
            filter: brightness(1);
          }
        }
      }

      /* ── Input Area ── */
      .terminal__input-area {
        display: flex;
        align-items: center;
        padding: 8px 20px 12px;
        border-top: 1px solid color-mix(in srgb, var(--_border) 50%, transparent);
        background: color-mix(in srgb, var(--_surface) 30%, var(--_screen-bg));
        position: relative;
        z-index: 2;
      }

      .terminal__prompt {
        font-family: var(--_mono);
        font-size: 13px;
        font-weight: 700;
        color: var(--_phosphor);
        white-space: nowrap;
        margin-right: 4px;
        flex-shrink: 0;
      }

      @media (prefers-reduced-motion: no-preference) {
        .terminal__prompt {
          text-shadow: 0 0 8px var(--_phosphor-glow);
        }
      }

      .terminal__input {
        flex: 1;
        background: transparent;
        border: none;
        outline: none;
        font-family: var(--_mono);
        font-size: 13px;
        color: var(--_phosphor);
        caret-color: var(--_phosphor);
        padding: 4px 0;
        min-width: 0;
      }

      .terminal__input::placeholder {
        color: color-mix(in srgb, var(--_phosphor-dim) 40%, transparent);
      }

      /* Block cursor simulation via caret when focused */
      @media (prefers-reduced-motion: no-preference) {
        .terminal__input:focus {
          text-shadow: 0 0 4px var(--_phosphor-glow);
        }
      }

      /* ── Loading indicator ── */
      .terminal__loading {
        font-family: var(--_mono);
        font-size: 13px;
        color: var(--_phosphor-dim);
        padding: 2px 0;
      }

      @media (prefers-reduced-motion: no-preference) {
        .terminal__loading {
          animation: cursor-blink 1s step-end infinite;
        }
      }

      /* ── Status Bar ── */
      .terminal__status {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 4px 20px;
        font-family: var(--_mono);
        font-size: 10px;
        letter-spacing: 1px;
        text-transform: uppercase;
        color: var(--_text-dim);
        border-top: 1px solid color-mix(in srgb, var(--_border) 30%, transparent);
        background: color-mix(in srgb, var(--_surface) 20%, var(--_screen-bg));
        position: relative;
        z-index: 2;
      }

      .terminal__status-zone {
        max-width: 50%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .terminal__status-resources {
        display: flex;
        gap: 12px;
      }

      /* ── Boot Sequence ── */
      @media (prefers-reduced-motion: no-preference) {
        .line--boot {
          opacity: 0;
          animation: boot-reveal 200ms ease-out forwards;
        }

        @keyframes boot-reveal {
          0% {
            opacity: 0;
            filter: brightness(2);
          }
          50% {
            opacity: 1;
            filter: brightness(1.5);
          }
          100% {
            opacity: 1;
            filter: brightness(1);
          }
        }
      }

      /* ── Responsive ── */
      @media (max-width: 640px) {
        .terminal__screen {
          padding: 12px 14px;
        }
        .terminal__input-area {
          padding: 8px 14px 10px;
        }
        .line {
          font-size: 12px;
        }
        .terminal__input,
        .terminal__prompt {
          font-size: 14px;
        }
        .terminal__input {
          min-height: 44px;
        }
        .terminal__status {
          padding: 4px 14px;
        }
      }

      /* ── Announce region (screen readers only) ── */
      .sr-announce {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }
    `,
  ];

  // ── Properties ───────────────────────────────────────────────────────────

  @property({ type: String }) simulationId = '';

  /** When true, hides the terminal's own quick-action buttons (dungeon provides its own). */
  @property({ type: Boolean }) dungeonMode = false;

  // ── Internal State ───────────────────────────────────────────────────────

  @state() private _historyIndex = -1;
  @state() private _historyBuffer = '';
  @state() private _userScrolled = false;
  @state() private _bootComplete = false;
  @state() private _announcement = '';

  // ── DOM Refs ─────────────────────────────────────────────────────────────

  @query('.terminal__screen') private _screen!: HTMLDivElement;
  @query('.terminal__input') private _input!: HTMLInputElement;

  // ── Feed Polling ─────────────────────────────────────────────────────────

  private _feedInterval: ReturnType<typeof setInterval> | null = null;
  private _freshLineIds = new Set<string>();
  /** Track heartbeat entry IDs already shown to prevent duplicates. */
  private _seenFeedEntryIds = new Set<string>();
  /** Track narrative text already shown to prevent semantically identical feed spam. */
  private _seenFeedNarratives = new Set<string>();

  // ── Lifecycle ────────────────────────────────────────────────────────────

  override connectedCallback(): void {
    super.connectedCallback();
    this._startFeedPolling();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._stopFeedPolling();
  }

  override async firstUpdated(): Promise<void> {
    // Focus input
    await this.updateComplete;
    this._focusInput();

    // Boot sequence for first visit, re-entry for returning users
    if (!terminalState.onboarded.value) {
      await this._playBootSequence();
    } else {
      // Returning user — output was cleared on navigation. Show compact re-entry.
      if (terminalState.outputLines.value.length === 0) {
        terminalState.appendOutput(getReentrySequence());
      }
      this._bootComplete = true;
    }
  }

  override updated(changes: PropertyValues): void {
    super.updated(changes);

    // Auto-scroll when new output arrives
    if (!this._userScrolled) {
      this._scrollToBottom();
    }
  }

  // ── Boot Sequence ────────────────────────────────────────────────────────

  private async _playBootSequence(): Promise<void> {
    const lines = getBootSequence();
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      // Show all at once
      terminalState.appendOutput(lines);
      terminalState.completeOnboarding();
      this._bootComplete = true;
      return;
    }

    // Staggered reveal
    for (let i = 0; i < lines.length; i++) {
      await new Promise<void>((resolve) => setTimeout(resolve, BOOT_LINE_DELAY_MS));
      this._freshLineIds.add(lines[i].id);
      terminalState.appendLine(lines[i]);
      this._scrollToBottom();
    }

    terminalState.completeOnboarding();
    this._bootComplete = true;
  }

  // ── Input Handling ───────────────────────────────────────────────────────

  private async _handleKeyDown(e: KeyboardEvent): Promise<void> {
    if (e.key === 'Enter') {
      e.preventDefault();
      const value = this._input.value;
      this._input.value = '';
      this._historyIndex = -1;
      this._historyBuffer = '';

      if (!value.trim()) return;

      terminalState.isLoading.value = true;
      try {
        const lines = await parseAndExecute(value);
        // Mark new lines as fresh for phosphor effect
        for (const line of lines) {
          this._freshLineIds.add(line.id);
        }
        terminalState.appendOutput(lines);

        // Clear fresh markers after animation
        setTimeout(() => {
          this._freshLineIds.clear();
          this.requestUpdate();
        }, 1300);
      } catch (err) {
        console.error('[BureauTerminal] Command error:', err);
        const { systemLine: sysLine } = await import('../../utils/terminal-formatters.js');
        terminalState.appendOutput([
          sysLine(`[ERROR] ${err instanceof Error ? err.message : 'Command failed.'}`),
        ]);
      } finally {
        terminalState.isLoading.value = false;
        this._userScrolled = false;
        this._scrollToBottom();
      }
      return;
    }

    // Command history navigation
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      this._navigateHistory(-1);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this._navigateHistory(1);
      return;
    }
  }

  private _navigateHistory(direction: -1 | 1): void {
    const history = terminalState.commandHistory.value;
    if (history.length === 0) return;

    if (this._historyIndex === -1 && direction === -1) {
      // Save current input as buffer
      this._historyBuffer = this._input.value;
      this._historyIndex = history.length - 1;
    } else {
      const newIndex = this._historyIndex + direction;
      if (newIndex < 0 || newIndex >= history.length) {
        // Restore buffer
        this._historyIndex = -1;
        this._input.value = this._historyBuffer;
        return;
      }
      this._historyIndex = newIndex;
    }

    this._input.value = history[this._historyIndex];
    // Move cursor to end
    requestAnimationFrame(() => {
      this._input.setSelectionRange(this._input.value.length, this._input.value.length);
    });
  }

  // ── Quick Action Handler ─────────────────────────────────────────────────

  private async _handleQuickAction(e: CustomEvent<string>): Promise<void> {
    const command = e.detail;
    if (!command) return;

    // Type it into input and execute
    if (this._input) this._input.value = command;
    terminalState.isLoading.value = true;
    try {
      const lines = await parseAndExecute(command);
      for (const line of lines) {
        this._freshLineIds.add(line.id);
      }
      terminalState.appendOutput(lines);
      setTimeout(() => {
        this._freshLineIds.clear();
        this.requestUpdate();
      }, 1300);
    } catch (err) {
      // Surface errors visibly in terminal
      console.error('[BureauTerminal] Quick action error:', err);
      const { systemLine: sysLine } = await import('../../utils/terminal-formatters.js');
      terminalState.appendOutput([
        sysLine(`[ERROR] ${err instanceof Error ? err.message : 'Command failed.'}`),
      ]);
    } finally {
      terminalState.isLoading.value = false;
      if (this._input) this._input.value = '';
      this._userScrolled = false;
      this._scrollToBottom();
      this._focusInput();
    }
  }

  // ── Scroll Management ────────────────────────────────────────────────────

  private _handleScroll(): void {
    if (!this._screen) return;
    const { scrollTop, scrollHeight, clientHeight } = this._screen;
    this._userScrolled = scrollHeight - scrollTop - clientHeight > MAX_SCROLL_TOLERANCE;
  }

  private _scrollToBottom(): void {
    requestAnimationFrame(() => {
      if (this._screen) {
        this._screen.scrollTop = this._screen.scrollHeight;
      }
    });
  }

  // ── Focus Management ─────────────────────────────────────────────────────

  private _focusInput(): void {
    requestAnimationFrame(() => {
      if (this._input) this._input.focus();
    });
  }

  /** Click on the screen area re-focuses input. */
  private _handleScreenClick(): void {
    this._focusInput();
  }

  // ── Feed Polling ─────────────────────────────────────────────────────────

  private _startFeedPolling(): void {
    this._feedInterval = setInterval(() => this._pollFeed(), FEED_POLL_INTERVAL_MS);
  }

  private _stopFeedPolling(): void {
    if (this._feedInterval) {
      clearInterval(this._feedInterval);
      this._feedInterval = null;
    }
  }

  private async _pollFeed(): Promise<void> {
    const sid = appState.simulationId.value;
    if (!sid) return;

    const filter = terminalState.feedFilter.value;
    if (filter === 'off') return;

    try {
      const params: Record<string, string> = { limit: '10' };

      const resp = await heartbeatApi.listEntries(sid, params);
      if (!resp.success || !resp.data || resp.data.length === 0) return;

      const currentZoneId = terminalState.currentZoneId.value;
      const feedLines: TerminalLine[] = [];

      for (const entry of resp.data) {
        // Deduplicate by entry ID: skip entries we've already shown
        if (this._seenFeedEntryIds.has(entry.id)) continue;
        this._seenFeedEntryIds.add(entry.id);

        // Skip peacetime system_notes (flavor text that repeats every tick)
        const meta = entry.metadata as Record<string, unknown> | undefined;
        if (entry.entry_type === 'system_note' && meta?.peacetime) continue;

        // Content dedup: skip entries with identical narrative to one already shown
        // (e.g., repeated "An uneasy calm" from different ticks with different UUIDs)
        const narrative = entry.narrative_en ?? '';
        if (narrative && this._seenFeedNarratives.has(narrative)) continue;
        if (narrative) this._seenFeedNarratives.add(narrative);

        // Skip weather in feed if already handled by boot/look
        if (entry.entry_type === 'ambient_weather' && filter !== 'weather' && filter !== 'all') {
          continue;
        }

        const line = formatFeedEntry(entry, currentZoneId);
        if (!line) continue;

        // Apply feed filter
        if (filter !== 'all') {
          const channelLower = line.channel?.toLowerCase() ?? '';
          if (channelLower !== filter && !(filter === 'intel' && channelLower === 'distant')) {
            continue;
          }
        }

        feedLines.push(line);
      }

      if (feedLines.length > 0) {
        terminalState.appendOutput(feedLines);

        // Announce for screen readers
        this._announcement = msg('New intelligence feed entries received.');
        setTimeout(() => { this._announcement = ''; }, 3000);
      }

      // Cap seen sets to prevent memory leak
      if (this._seenFeedEntryIds.size > 200) {
        const arr = Array.from(this._seenFeedEntryIds);
        this._seenFeedEntryIds = new Set(arr.slice(arr.length - 100));
      }
      if (this._seenFeedNarratives.size > 200) {
        const arr = Array.from(this._seenFeedNarratives);
        this._seenFeedNarratives = new Set(arr.slice(arr.length - 100));
      }
    } catch (err) {
      // Network errors from setInterval-driven polling are non-critical.
      // Log for debugging but don't surface to the user — retry on next interval.
      console.debug('[BureauTerminal] Feed poll failed, will retry:', err);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  private _renderLine(line: TerminalLine) {
    const classes = {
      line: true,
      [`line--${line.type}`]: true,
      'line--fresh': this._freshLineIds.has(line.id),
      'line--boot': line.type === 'system' && !this._bootComplete,
    };

    return html`<div
      class=${classMap(classes)}
      .style=${line.type === 'system' && !this._bootComplete
        ? `animation-delay: ${(this._getBootIndex(line)) * BOOT_LINE_DELAY_MS}ms`
        : ''}
    >${line.content}</div>`;
  }

  private _getBootIndex(line: TerminalLine): number {
    const lines = terminalState.outputLines.value;
    return lines.indexOf(line);
  }

  private _renderPrompt() {
    const conv = terminalState.conversationMode.value;
    if (conv) {
      return `[${conv.agentName}] > `;
    }
    return '> ';
  }

  protected render() {
    const lines = terminalState.outputLines.value;
    const isLoading = terminalState.isLoading.value;
    const zone = terminalState.currentZone.value;
    const ops = terminalState.operationsPoints.value;
    const intel = terminalState.intelPoints.value;
    const clearance = terminalState.effectiveClearance.value;
    const inConversation = terminalState.isInConversation.value;

    return html`
      <div class="terminal">
        <div class="terminal__scanlines"></div>

        <div
          class="terminal__screen"
          role="log"
          aria-live="polite"
          aria-label=${msg('Terminal output')}
          @scroll=${this._handleScroll}
          @click=${this._handleScreenClick}
        >
          ${repeat(lines, (l) => l.id, (l) => this._renderLine(l))}
          ${isLoading ? html`<div class="terminal__loading" aria-hidden="true">_</div>` : nothing}
        </div>

        <div class="terminal__input-area">
          <span class="terminal__prompt" aria-hidden="true">${this._renderPrompt()}</span>
          <input
            class="terminal__input"
            type="text"
            aria-label=${inConversation
              ? msg('Message to agent')
              : msg('Terminal command input')}
            placeholder=${this._bootComplete
              ? (inConversation ? msg('Type your message...') : msg('Enter command...'))
              : ''}
            ?disabled=${!this._bootComplete}
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            @keydown=${this._handleKeyDown}
          />
        </div>

        <div class="terminal__status">
          <span class="terminal__status-zone">
            ${zone ? zone.name.toUpperCase() : msg('NO SECTOR')}
          </span>
          <div class="terminal__status-resources">
            <span>LVL ${clearance}</span>
            <span>OPS ${ops}/3</span>
            <span>INT ${intel}/2</span>
          </div>
        </div>

        <div class="terminal__bottom-corners"></div>
      </div>

      ${this.dungeonMode ? nothing : html`
        <velg-terminal-quick-actions
          .clearanceLevel=${clearance}
          .inConversation=${inConversation}
          .epochMode=${terminalState.isEpochMode.value}
          @terminal-command=${this._handleQuickAction}
        ></velg-terminal-quick-actions>
      `}

      <!-- Screen reader announcements -->
      <div class="sr-announce" role="status" aria-live="assertive">
        ${this._announcement}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-bureau-terminal': VelgBureauTerminal;
  }
}

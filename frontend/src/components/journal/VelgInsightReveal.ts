/**
 * VelgInsightReveal — the crystallization ceremony overlay.
 *
 * Implements the 2200 ms choreography of design-direction §5.4: a dim
 * beat that lets the canvas settle, a silent draw window where the
 * lines sequence in (rendered by the parent canvas), an Insight-frame
 * fade, a letter-by-letter typewriter, and a final chime. Skippable
 * via Space or Escape to t = 2200 ms — the skip collapses timing, never
 * the outcome.
 *
 * Load-bearing choices:
 *
 *   1. Typewriter, not scramble. Scramble codes "generated"; typewriter
 *      codes "authored" (design-direction §5.4 + §7 "Alpha-suite
 *      scramble NOT used for Insight reveal"). The Insight is the
 *      journal speaking back to the user — Philemon, not summary —
 *      and must feel written, not produced.
 *
 *   2. No modal, no full-screen dim. The overlay covers the canvas
 *      only. Principle 12 + §5.4 "Reveal happens on the canvas itself".
 *
 *   3. Screen-reader parity via a single announce-on-complete. The
 *      aria-live region emits the full Insight only when typing
 *      finishes — mid-animation announcements would be noise. Plan
 *      §5.4 screen-reader clause.
 *
 *   4. Dim overlay is a `::before` pseudo-element; it uses only
 *      `opacity` transitions. CLAUDE.md forbids `filter` on layout
 *      containers, and the parent `.canvas` is one, so we never touch
 *      its filter-stack.
 *
 *   5. Respect `prefers-reduced-motion`. Per plan §9, non-informational
 *      animations collapse to 0.01 ms while the state-carrying
 *      transitions (final text reveal, chime) fire immediately.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

const TIMING = {
  DIM_IN: 180,
  LINE_WINDOW_END: 900,
  FRAME_IN_END: 1100,
  TYPE_START: 1100,
  TOTAL: 2200,
} as const;

@localized()
@customElement('velg-insight-reveal')
export class VelgInsightReveal extends LitElement {
  static styles = css`
    :host {
      position: absolute;
      inset: 0;
      display: block;
      pointer-events: auto;
      --_accent: var(--color-accent-amber);
      --_rule: color-mix(in srgb, var(--color-accent-amber) 60%, var(--color-border));
      --_ink: color-mix(in srgb, var(--color-text-primary) 92%, transparent);
    }

    .dim {
      position: absolute;
      inset: 0;
      background: color-mix(in srgb, var(--color-surface-sunken) 70%, transparent);
      opacity: 0;
      transition: opacity 180ms var(--ease-out);
      z-index: 1;
    }

    .dim--visible {
      opacity: 1;
    }

    .frame {
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      width: min(640px, 86%);
      padding: var(--space-6) var(--space-7);
      background: var(--color-surface-raised);
      border: 1px solid var(--_rule);
      border-left: 4px solid var(--_accent);
      box-shadow: var(--shadow-lg);
      z-index: 2;
      opacity: 0;
      /* translateY is animated via a separate transform step on the frame
         leaf — the wrapper already owns -50% / -50% centring, and this
         extra translate is folded into the same matrix for the entrance. */
      transition:
        opacity 200ms var(--ease-out),
        transform 200ms var(--ease-out);
    }

    .frame--visible {
      opacity: 1;
      transform: translate(-50%, -50%) translateY(0);
    }

    .frame--hidden {
      transform: translate(-50%, calc(-50% + 4px));
    }

    .frame__label {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-muted);
      margin: 0 0 var(--space-3);
    }

    .frame__text {
      font-family: var(--font-brutalist);
      font-size: var(--text-md);
      font-weight: var(--font-medium);
      line-height: 1.65;
      letter-spacing: 0.005em;
      color: var(--_ink);
      margin: 0;
      min-height: 1em;
      white-space: pre-wrap;
    }

    .frame__caret {
      display: inline-block;
      width: 0.6em;
      background: var(--_accent);
      color: var(--_accent);
      margin-left: 2px;
      animation: caret-blink 600ms steps(2) infinite;
    }

    .frame__caret--hidden {
      visibility: hidden;
    }

    @keyframes caret-blink {
      50% {
        opacity: 0;
      }
    }

    .sr-only {
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

    .skip-hint {
      position: absolute;
      bottom: var(--space-3);
      left: 50%;
      transform: translateX(-50%);
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-muted);
      opacity: 0;
      transition: opacity 300ms var(--ease-out);
      z-index: 3;
    }

    .skip-hint--visible {
      opacity: 0.7;
    }

    @media (prefers-reduced-motion: reduce) {
      .dim,
      .frame {
        transition-duration: 0.01ms;
      }
      .frame__caret {
        animation: none;
      }
    }
  `;

  /** The full Insight text to reveal. Passed by the parent canvas. */
  @property({ type: String }) insight = '';

  /** Whether the ceremony should run. Setting true from false kicks off
   * the timeline. */
  @property({ type: Boolean }) active = false;

  @state() private _dimVisible = false;
  @state() private _frameVisible = false;
  @state() private _typedText = '';
  @state() private _typingComplete = false;
  @state() private _announceText = '';
  @state() private _skipHintVisible = false;

  private _timers: number[] = [];
  private _typewriterTimer: number | null = null;
  private _prefersReducedMotion = false;

  connectedCallback(): void {
    super.connectedCallback();
    this._prefersReducedMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    document.addEventListener('keydown', this._onKeyDown);
    if (this.active) this._start();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this._onKeyDown);
    this._clearTimers();
  }

  willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('active')) {
      if (this.active) {
        this._start();
      } else {
        this._clearTimers();
      }
    }
  }

  private _onKeyDown = (e: KeyboardEvent): void => {
    if (!this.active) return;
    if (e.key === ' ' || e.key === 'Escape') {
      e.preventDefault();
      this._skip();
    }
  };

  private _clearTimers(): void {
    for (const t of this._timers) window.clearTimeout(t);
    this._timers = [];
    if (this._typewriterTimer !== null) {
      window.clearTimeout(this._typewriterTimer);
      this._typewriterTimer = null;
    }
  }

  private _start(): void {
    this._clearTimers();
    this._dimVisible = false;
    this._frameVisible = false;
    this._typedText = '';
    this._typingComplete = false;
    this._announceText = '';
    this._skipHintVisible = false;

    if (this._prefersReducedMotion) {
      // Collapse to final state; still emit reveal-complete so the
      // parent can unmount this overlay.
      this._dimVisible = true;
      this._frameVisible = true;
      this._typedText = this.insight;
      this._typingComplete = true;
      this._announceText = this.insight;
      this._timers.push(window.setTimeout(() => this._complete(), 20));
      return;
    }

    // t=0: kick off dim fade-in on the next frame so the transition
    // picks up the class change.
    this._timers.push(
      window.setTimeout(() => {
        this._dimVisible = true;
      }, 0),
    );

    // Skip hint materialises after ~700 ms so the beat never feels
    // like the overlay is waiting on user input.
    this._timers.push(
      window.setTimeout(() => {
        this._skipHintVisible = true;
      }, 700),
    );

    // t=900-1100: insight frame becomes visible.
    this._timers.push(
      window.setTimeout(() => {
        this._frameVisible = true;
      }, TIMING.LINE_WINDOW_END),
    );

    // t=1100: begin typewriter. The per-char interval is tuned so the
    // full string completes by t=2200 when the Insight is medium-length;
    // very long strings bound to ~30 cps.
    this._timers.push(
      window.setTimeout(() => {
        this._startTypewriter();
      }, TIMING.TYPE_START),
    );
  }

  private _startTypewriter(): void {
    const full = this.insight;
    const available = TIMING.TOTAL - TIMING.TYPE_START;
    // Per-char interval: fit within the reveal window, but never faster
    // than ~30 cps (33 ms / char) to preserve the "authored" feel.
    const perChar = Math.max(33, Math.floor(available / Math.max(full.length, 1)));
    let i = 0;
    const step = () => {
      i += 1;
      this._typedText = full.slice(0, i);
      if (i < full.length) {
        this._typewriterTimer = window.setTimeout(step, perChar);
      } else {
        this._typingComplete = true;
        this._announceText = full;
        // Total ceremony time is honoured even if typewriter finishes
        // slightly early: use a small grace before firing complete.
        this._timers.push(window.setTimeout(() => this._complete(), 120));
      }
    };
    this._typewriterTimer = window.setTimeout(step, perChar);
  }

  private _skip(): void {
    this._clearTimers();
    this._dimVisible = true;
    this._frameVisible = true;
    this._typedText = this.insight;
    this._typingComplete = true;
    this._announceText = this.insight;
    this._timers.push(window.setTimeout(() => this._complete(), 30));
  }

  private _complete(): void {
    this.dispatchEvent(new CustomEvent('reveal-complete', { bubbles: true, composed: true }));
  }

  protected render() {
    return html`
      <div class=${`dim ${this._dimVisible ? 'dim--visible' : ''}`} aria-hidden="true"></div>
      <div
        class=${`frame ${this._frameVisible ? 'frame--visible' : 'frame--hidden'}`}
        role="presentation"
      >
        <p class="frame__label">${msg('Insight')}</p>
        <p class="frame__text">
          ${this._typedText}<span
            class=${`frame__caret ${this._typingComplete ? 'frame__caret--hidden' : ''}`}
            aria-hidden="true"
            >&nbsp;</span
          >
        </p>
      </div>
      <p
        class=${`skip-hint ${this._skipHintVisible && !this._typingComplete ? 'skip-hint--visible' : ''}`}
        aria-hidden="true"
      >
        ${msg('Press Space to skip')}
      </p>
      <div class="sr-only" role="status" aria-live="assertive">${this._announceText}</div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-insight-reveal': VelgInsightReveal;
  }
}

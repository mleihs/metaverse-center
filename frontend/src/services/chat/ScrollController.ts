/**
 * ScrollController — Lit Reactive Controller for scroll management.
 *
 * Keeps a message feed pinned to its newest entry while a person reads at the
 * bottom, and gets out of the way the moment they scroll up to read history.
 *
 * WHY THIS IS A MEASUREMENT AND NOT AN OBSERVER
 *
 * The first version answered "has the user scrolled up?" by combining an
 * IntersectionObserver on a sentinel with a one-shot `_ignoreNextScroll` flag.
 * Both halves were wrong in the same way — they are ASYNCHRONOUS answers to a
 * synchronous question:
 *
 *   1. `IntersectionObserver` delivers its verdict a frame or more later. Every
 *      streamed token grew the feed and pushed the sentinel out of view, so the
 *      flag routinely read "not at bottom" while the person had not moved at
 *      all.
 *   2. `_ignoreNextScroll` swallowed exactly ONE scroll event. A single
 *      `scrollTo({behavior: 'smooth'})` emits dozens. Every event after the
 *      first was read as a person scrolling away.
 *
 * Together they latched `userScrolledUp = true` and never let go: from then on
 * auto-scroll was dead for the rest of the conversation, and the only way back
 * was to scroll down by hand — once per message, which is exactly the symptom
 * that was reported.
 *
 * The replacement asks the element directly, in the scroll handler, with no
 * intervening frame:
 *
 *   distance = scrollHeight - scrollTop - clientHeight
 *
 * and treats a person as having left only when the feed ALSO moved upward.
 * That second half is what makes it robust: growing content never moves
 * `scrollTop` up, and a programmatic scroll to the bottom only ever moves it
 * down — so neither can be mistaken for someone reaching for the wheel.
 *
 * Usage:
 *   class MyChat extends LitElement {
 *     private _scroll = new ScrollController(this);
 *
 *     protected willUpdate(changed: Map<string, unknown>) {
 *       if (changed.has('messages')) this._scroll.requestAutoScroll('smooth');
 *       if (changed.has('streamContent')) this._scroll.requestAutoScroll('instant');
 *     }
 *
 *     protected firstUpdated() {
 *       this._scroll.attach(this.renderRoot.querySelector('.feed'));
 *     }
 *
 *     render() {
 *       return html`
 *         <div class="feed">…</div>
 *         ${this._scroll.userScrolledUp
 *           ? html`<button @click=${() => this._scroll.scrollToBottom()}>↓</button>`
 *           : nothing}
 *       `;
 *     }
 *   }
 */

import type { ReactiveController, ReactiveControllerHost } from 'lit';

/**
 * How far above the last line still counts as "reading the newest message", in
 * pixels. Not zero: sub-pixel layout, a scrollbar's rounding and the feed's own
 * bottom padding leave a few pixels that no wheel ever produced, and demanding
 * an exact 0 would drop the pin at random.
 */
const BOTTOM_SLACK = 64;

/**
 * How far the feed must travel upward before it counts as intent. One pixel of
 * jitter is a rounding artefact; this is a deliberate movement.
 */
const UPWARD_INTENT = 8;

/** Honour the platform's reduced-motion setting for every animated scroll. */
function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export class ScrollController implements ReactiveController {
  /** Whether the newest message is in view. */
  isAtBottom = true;

  /** Whether the person has scrolled up to read history (blocks auto-scroll). */
  userScrolledUp = false;

  private _host: ReactiveControllerHost;
  private _container: HTMLElement | null = null;
  private _lastScrollTop = 0;

  /** Pending auto-scroll — set by requestAutoScroll(), consumed by hostUpdated(). */
  private _pendingBehavior: ScrollBehavior | null = null;

  constructor(host: ReactiveControllerHost) {
    this._host = host;
    host.addController(this);
  }

  // --- Lifecycle --------------------------------------------------------

  hostDisconnected(): void {
    this._teardown();
  }

  hostUpdated(): void {
    // Only scroll when explicitly requested (a new message, a streamed token),
    // never on an unrelated re-render — a reaction chip must not move the page.
    if (this._pendingBehavior && !this.userScrolledUp && this._container) {
      const behavior = this._pendingBehavior;
      this._pendingBehavior = null;
      this._performScroll(behavior);
    }
  }

  // --- Public API -------------------------------------------------------

  /** Attach the scrollable container element. */
  attach(el: Element | null | undefined): void {
    if (!el || el === this._container) return;
    this._container?.removeEventListener('scroll', this._onScroll);
    this._container = el as HTMLElement;
    this._lastScrollTop = this._container.scrollTop;
    this._container.addEventListener('scroll', this._onScroll, { passive: true });
  }

  /** Programmatic scroll to the newest message. Re-pins the feed. */
  scrollToBottom(behavior: ScrollBehavior = 'smooth'): void {
    this.userScrolledUp = false;
    this.isAtBottom = true;
    this._performScroll(behavior);
    this._host.requestUpdate();
  }

  /** Snap to the newest message without animation. */
  snapToBottom(): void {
    this.scrollToBottom('instant');
  }

  /**
   * Request an auto-scroll on the next hostUpdated() cycle, so the DOM is laid
   * out before anything moves.
   *
   * Pass `'instant'` for content that grows continuously — a streamed answer
   * restarts the request many times per second, and a smooth animation would be
   * cancelled and restarted before it ever arrived, leaving the view trailing
   * the text. `'smooth'` belongs to discrete events: a message appearing.
   */
  requestAutoScroll(behavior: ScrollBehavior = 'smooth'): void {
    // An instant request outranks a pending smooth one: whoever asked for
    // instant is following live content and must not be animated.
    if (this._pendingBehavior === 'instant' && behavior !== 'instant') return;
    this._pendingBehavior = behavior;
  }

  /** Distance in px between the current position and the end of the feed. */
  get distanceFromBottom(): number {
    const el = this._container;
    if (!el) return 0;
    return el.scrollHeight - el.scrollTop - el.clientHeight;
  }

  // --- Internal ---------------------------------------------------------

  private _performScroll(behavior: ScrollBehavior): void {
    const el = this._container;
    if (!el) return;
    const effective = prefersReducedMotion() ? 'instant' : behavior;
    requestAnimationFrame(() => {
      const target = this._container;
      if (!target) return;
      target.scrollTo({ top: target.scrollHeight, behavior: effective });
    });
  }

  private readonly _onScroll = (): void => {
    const el = this._container;
    if (!el) return;

    const previous = this._lastScrollTop;
    const current = el.scrollTop;
    this._lastScrollTop = current;

    const wasAtBottom = this.isAtBottom;
    const wasScrolledUp = this.userScrolledUp;

    const distance = el.scrollHeight - current - el.clientHeight;
    this.isAtBottom = distance <= BOTTOM_SLACK;

    if (this.isAtBottom) {
      // Back within reach of the newest message — by wheel, by the button, or
      // by an auto-scroll finishing. However it happened, the feed is pinned.
      this.userScrolledUp = false;
    } else if (current < previous - UPWARD_INTENT) {
      // Away from the bottom AND travelling upward. Growing content cannot do
      // this, and neither can a scroll toward the end, so this is a person.
      this.userScrolledUp = true;
    }

    if (wasAtBottom !== this.isAtBottom || wasScrolledUp !== this.userScrolledUp) {
      this._host.requestUpdate();
    }
  };

  private _teardown(): void {
    this._container?.removeEventListener('scroll', this._onScroll);
    this._container = null;
  }
}

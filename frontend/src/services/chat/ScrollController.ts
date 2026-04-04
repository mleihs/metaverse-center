/**
 * ScrollController — Lit Reactive Controller for scroll management.
 *
 * Encapsulates scroll-to-bottom, "user scrolled up" detection via
 * IntersectionObserver, and auto-scroll on new messages. Replaces the
 * duplicated _scrollToBottom() + requestAnimationFrame calls in both
 * ChatWindow and EpochChatPanel.
 *
 * Usage:
 *   class MyChat extends LitElement {
 *     private _scroll = new ScrollController(this);
 *
 *     render() {
 *       return html`
 *         <div class="feed" ${ref(el => this._scroll.attach(el))}>
 *           ${messages.map(m => html`...`)}
 *           <div class="scroll-anchor" ${ref(el => this._scroll.attachAnchor(el))}></div>
 *         </div>
 *         ${!this._scroll.isAtBottom ? html`<button @click=${() => this._scroll.scrollToBottom()}>↓</button>` : nothing}
 *       `;
 *     }
 *   }
 */

import type { ReactiveController, ReactiveControllerHost } from 'lit';

export class ScrollController implements ReactiveController {
  /** Whether the scroll anchor sentinel is visible (= user is at bottom). */
  isAtBottom = true;

  /** Whether the user has manually scrolled up (blocks auto-scroll). */
  userScrolledUp = false;

  private _host: ReactiveControllerHost;
  private _container: HTMLElement | null = null;
  private _anchor: HTMLElement | null = null;
  private _observer: IntersectionObserver | null = null;
  private _ignoreNextScroll = false;

  /** Pending auto-scroll request — set by requestAutoScroll(), consumed by hostUpdated(). */
  private _pendingAutoScroll = false;

  constructor(host: ReactiveControllerHost) {
    this._host = host;
    host.addController(this);
  }

  // --- Lifecycle --------------------------------------------------------

  hostConnected(): void {
    // Observer is set up when anchor is attached (may happen after connect)
  }

  hostDisconnected(): void {
    this._teardown();
  }

  hostUpdated(): void {
    // Only auto-scroll when explicitly requested (e.g. new message added)
    // This prevents unwanted scrolling on unrelated re-renders.
    if (this._pendingAutoScroll && !this.userScrolledUp && this._container) {
      this._pendingAutoScroll = false;
      this._performScroll('instant');
    }
  }

  // --- Public API -------------------------------------------------------

  /** Attach the scrollable container element. Call via ref() directive. */
  attach(el: Element | undefined): void {
    if (!el || el === this._container) return;
    // Remove old listener
    this._container?.removeEventListener('scroll', this._onScroll);
    this._container = el as HTMLElement;
    this._container.addEventListener('scroll', this._onScroll, {
      passive: true,
    });
  }

  /** Attach the sentinel element at the bottom of the feed. */
  attachAnchor(el: Element | undefined): void {
    if (!el || el === this._anchor) return;
    this._anchor = el as HTMLElement;
    this._setupObserver();
  }

  /** Programmatic scroll to bottom. Resets userScrolledUp state. */
  scrollToBottom(behavior: ScrollBehavior = 'smooth'): void {
    this.userScrolledUp = false;
    this._performScroll(behavior);
    this._host.requestUpdate();
  }

  /** Snap to bottom instantly without animation. */
  snapToBottom(): void {
    this.scrollToBottom('instant');
  }

  /**
   * Request auto-scroll on the next hostUpdated() cycle.
   * Call this when new messages are added. The scroll happens in
   * hostUpdated() so the DOM is fully rendered before scrolling.
   */
  requestAutoScroll(): void {
    this._pendingAutoScroll = true;
  }

  // --- Internal ---------------------------------------------------------

  private _performScroll(behavior: ScrollBehavior): void {
    if (!this._container) return;
    this._ignoreNextScroll = true;
    requestAnimationFrame(() => {
      this._container?.scrollTo({
        top: this._container.scrollHeight,
        behavior,
      });
    });
  }

  private readonly _onScroll = (): void => {
    if (this._ignoreNextScroll) {
      this._ignoreNextScroll = false;
      return;
    }
    // If user scrolled and we're not at the bottom, mark as scrolled up
    if (!this.isAtBottom) {
      this.userScrolledUp = true;
      this._host.requestUpdate();
    }
  };

  private _setupObserver(): void {
    this._observer?.disconnect();
    if (!this._anchor || !this._container) return;

    this._observer = new IntersectionObserver(
      entries => {
        const wasAtBottom = this.isAtBottom;
        this.isAtBottom = entries[0]?.isIntersecting ?? false;

        // If user scrolled back to bottom manually, reset the flag
        if (this.isAtBottom && this.userScrolledUp) {
          this.userScrolledUp = false;
        }

        if (wasAtBottom !== this.isAtBottom) {
          this._host.requestUpdate();
        }
      },
      { root: this._container, threshold: 0.1 },
    );

    this._observer.observe(this._anchor);
  }

  private _teardown(): void {
    this._observer?.disconnect();
    this._observer = null;
    this._container?.removeEventListener('scroll', this._onScroll);
    this._container = null;
    this._anchor = null;
  }
}

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

/**
 * Wie viele ruhige Bilder das Ende gehalten haben muss, bevor das Nachfuehren
 * aufhoert. Drei, nicht eines: eine Kachel kann in einem Bild wachsen und im
 * naechsten die darunter mitziehen.
 */
const SETTLE_STABLE_FRAMES = 3;

/**
 * Obergrenze des Nachfuehrens. Ein Boden, der nach anderthalb Sekunden immer
 * noch wandert, wandert nicht wegen des Layouts, und eine Schleife ohne Ende
 * waere schlimmer als ein Ende, das ein Stueck zu hoch liegt.
 */
const SETTLE_MAX_FRAMES = 90;

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
  private _resizeObserver: ResizeObserver | null = null;
  private _settleFrame: number | null = null;

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
    this._detachContainer();
    this._container = el as HTMLElement;
    this._lastScrollTop = this._container.scrollTop;
    this._container.addEventListener('scroll', this._onScroll, { passive: true });

    /*
     * WARUM DAS SCROLLEN NACH EINEM NEULADEN NICHT REICHTE.
     *
     * Beim Oeffnen wird korrekt ans Ende gerollt — und danach treffen die
     * Portraits ein. Ein `<img>` ohne bekannte Groesse ist im Augenblick des
     * Rollens 0 px hoch und waechst erst mit seinen Bytes; jedes geladene Bild
     * schiebt den Boden ein Stueck weiter nach unten, unter der Ansicht
     * hindurch. Der Rollbefehl war also richtig und traf trotzdem daneben,
     * weil das Ziel sich nach ihm noch bewegt hat.
     *
     * `load` steigt nicht auf, also wird es in der ERFASSUNGS-Phase gehoert.
     * Und nur solange die Ansicht angeheftet ist: wer Geschichte liest, will
     * nicht von einem nachgeladenen Bild ans Ende gerissen werden.
     */
    this._container.addEventListener('load', this._onContentSettled, { capture: true });

    // Fenster- oder Panelgroesse aendert `clientHeight` und damit, wo „unten"
    // liegt. Dasselbe Argument, anderer Anlass.
    if (typeof ResizeObserver === 'function') {
      this._resizeObserver = new ResizeObserver(this._onContentSettled);
      this._resizeObserver.observe(this._container);
    }
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
      this._holdBottom();
    });
  }

  /**
   * Das Ende halten, solange der Boden noch wandert.
   *
   * WARUM DAS NOETIG IST — und warum der ResizeObserver es nicht sah.
   *
   * `.message-item` traegt "content-visibility: auto" mit
   * "contain-intrinsic-size: auto 80px". Jede Nachricht ausserhalb des Bildes
   * ist damit 80 px hoch, bis sie tatsaechlich gerendert wird. Beim OEFFNEN
   * ist nichts gerendert, also ist jede Kachel 80 px — und die echten sind
   * 150 bis 300. Der Rollbefehl trifft eine "scrollHeight", die um die Summe
   * dieser Differenzen zu klein ist. Auf Prod gemessen blieben so **1712 px**
   * stehen: ein paar Nachrichten ueber dem Ende, genau wie gemeldet.
   *
   * Der vorhandene ResizeObserver konnte das nicht auffangen, weil er den
   * BEHAELTER beobachtet. Dessen Kasten aendert sich beim Fenstergroessen-
   * wechsel — dafuer wurde er gebaut, das steht auch so im Kommentar. Waechst
   * dagegen der INHALT, bleibt der Behaelter exakt gleich gross; nur
   * "scrollHeight" steigt, und darauf feuert kein ResizeObserver.
   *
   * Deshalb hier kein Beobachter, sondern das Einzige, was diese Aenderung
   * meldet: "scrollHeight" selbst, ueber ein paar Bilder hinweg. Beendet
   * wird, sobald die Hoehe steht — oder wenn ein Mensch nach oben rollt, denn
   * dann ist das Ende nicht mehr gewollt.
   */
  private _holdBottom(): void {
    if (this._settleFrame !== null) return;

    let quiet = 0;
    let total = 0;
    let lastHeight = -1;

    const step = (): void => {
      const el = this._container;
      if (!el || this.userScrolledUp || total++ >= SETTLE_MAX_FRAMES) {
        this._settleFrame = null;
        return;
      }
      const height = el.scrollHeight;
      if (height !== lastHeight) {
        lastHeight = height;
        quiet = 0;
        // Ohne Animation: hier wird nichts verfolgt, hier wird eine Position
        // gehalten. Der Browser begrenzt den Wert selbst auf das Maximum.
        el.scrollTop = height;
      } else if (++quiet >= SETTLE_STABLE_FRAMES) {
        this._settleFrame = null;
        return;
      }
      this._settleFrame = requestAnimationFrame(step);
    };

    this._settleFrame = requestAnimationFrame(step);
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

  /**
   * Etwas hat sich gesetzt (ein Bild, eine Groesse). Stand die Ansicht am Ende,
   * muss sie dort BLEIBEN — ohne Animation, denn hier wird nichts gefolgt,
   * hier wird eine Position gehalten.
   */
  private readonly _onContentSettled = (): void => {
    if (this.userScrolledUp || !this._container) return;
    this._performScroll('instant');
  };

  private _detachContainer(): void {
    if (this._settleFrame !== null) {
      cancelAnimationFrame(this._settleFrame);
      this._settleFrame = null;
    }
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
    this._container?.removeEventListener('scroll', this._onScroll);
    this._container?.removeEventListener('load', this._onContentSettled, { capture: true });
  }

  private _teardown(): void {
    this._detachContainer();
    this._container = null;
  }
}

/**
 * ChatFeed — Unified message list for Agent Chat and Epoch Chat.
 *
 * Replaces MessageList.ts with:
 *   - O(1) participant lookup via Map (was O(N) Array.find)
 *   - Timezone-aware date grouping via Intl.DateTimeFormat
 *   - Timeline interleaving of event references at their timestamp
 *   - ScrollController for auto-scroll + "scrolled up" detection
 *   - content-visibility: auto for off-screen rendering perf
 *   - role="log" + aria-live="polite" for screen readers
 *   - repeat() directive with stable message IDs (no DOM churn on prepend)
 *   - Scroll-to-bottom FAB when user has scrolled up
 *
 * Does NOT apply filter/transform/will-change on the container
 * (breaks position: fixed for modals — CLAUDE.md mandate).
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';
import type { TypingUser } from '../../../services/chat/ChatSessionStore.js';
import type { Participant, TimelineItem } from '../../../services/chat/chat-types.js';
import { ScrollController } from '../../../services/chat/ScrollController.js';
import { captureError } from '../../../services/SentryService.js';
import type { ChatEventReference, ChatMessage } from '../../../types/index.js';
import { formatDate, formatDateLabel } from '../../../utils/date-format.js';
import { icons } from '../../../utils/icons.js';

import '../../shared/VelgAvatar.js';
import './ChatMessage.js';
import './TypingIndicator.js';

// ---------------------------------------------------------------------------
// Date comparison — timezone-aware via Intl.DateTimeFormat
// ---------------------------------------------------------------------------

const _dayFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function isSameDay(a: string, b: string): boolean {
  try {
    return _dayFormatter.format(new Date(a)) === _dayFormatter.format(new Date(b));
  } catch (err) {
    captureError(err, { source: 'chat-feed.isSameDay' });
    return false;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

@localized()
@customElement('velg-chat-feed')
export class ChatFeed extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      position: relative;
    }

    /* --- Scrollable feed container --- */
    .feed {
      flex: 1;
      overflow-y: auto;
      /* Der Browser darf hier NICHT selbst ankern. Sein Scroll-Anchoring haelt
         irgendein sichtbares Element fest, wenn Hoehen darueber sich aendern —
         das ist der gemeldete Sprung „ein paar Nachrichten nach oben". Safari
         kennt die Eigenschaft ohnehin nicht; die Heftung macht der
         ScrollController selbst, auf allen Browsern gleich. */
      overflow-anchor: none;
      overscroll-behavior-y: contain;
      display: flex;
      flex-direction: column;
      /* Cockpit rule: the WINDOW takes every pixel the shell gives it, but
         the CONVERSATION keeps a reading measure. Centring the padding
         instead of the box is what lets the scrollbar and the background
         stay at the far edge while the words stay legible at 2560px. */
      padding-block: var(--space-4);
      padding-inline: max(var(--space-6), calc((100% - 1080px) / 2));
      gap: 0;
    }

    /*
     * Der Inhalt als eigener Kasten — der einzige Grund dafuer ist messbar:
     * die Klasse .feed ist flex: 1, ihre Hoehe kommt vom Elternelement und
     * aendert sich nie, wenn Nachrichten dazukommen. Ein ResizeObserver auf ihr
     * wartet auf ein Ereignis, das es nicht gibt. Dieser Kasten waechst mit dem
     * Verlauf, und genau ihn beobachtet der ScrollController.
     *
     * flex: 0 0 auto und dieselbe Flex-Achse wie vorher: die Kinder behalten
     * ihre Flex-Semantik, also auch das negative margin-top von .message-item,
     * das in normalem Blockfluss kollabieren wuerde.
     * (Kein Backtick in einem css-Kommentar: er beendet das Template.)
     */
    .feed__content {
      display: flex;
      flex-direction: column;
      gap: 0;
      flex: 0 0 auto;
    }

    /* --- Load-more sentinel --- */
    .feed__load-more {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-3) 0;
      min-height: 32px;
    }

    .feed__load-more-spinner {
      width: 16px;
      height: 16px;
      border: 2px solid var(--color-border-light);
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 600ms linear infinite;
    }

    .feed__load-more-btn {
      background: none;
      border: var(--border-default);
      padding: var(--space-1-5) var(--space-3);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-quiet);
      cursor: pointer;
      transition: color var(--transition-fast), border-color var(--transition-fast);
    }

    .feed__load-more-btn:hover {
      color: var(--color-text-primary);
      border-color: var(--color-border-focus);
    }

    .feed__load-more-btn:focus-visible {
      outline: none;
      box-shadow: var(--ring-focus);
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* --- Date separator --- */
    .date-separator {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      margin: var(--space-5) 0 var(--space-3);
      user-select: none;
    }

    .date-separator:first-child {
      margin-top: 0;
    }

    .date-separator__line {
      flex: 1;
      height: 0;
      border: none;
      border-top: var(--border-width-thin) dashed var(--color-border-light);
    }

    .date-separator__label {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-quiet);
      white-space: nowrap;
      flex-shrink: 0;
      text-transform: var(--label-transform);
      letter-spacing: 0.05em;
    }

    /* --- Event reference card (interleaved in timeline) --- */
    .event-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-1);
      margin: var(--space-4) 0;
      user-select: none;
    }

    .event-card__label {
      display: flex;
      align-items: center;
      gap: var(--space-1-5);
      font-family: var(--font-mono);
      font-size: 10px;
      color: var(--color-text-quiet);
      text-transform: var(--label-transform);
      letter-spacing: var(--tracking-brutalist);
    }

    .event-card__label svg {
      color: var(--color-info);
    }

    .event-card__body {
      padding: var(--space-3) var(--space-4);
      /* Akzent auf dem ganzen Rahmen; der Kasten war ohnehin umrandet.
         Gestrichelt, weil die Karte kein Beitrag im Gespraech ist, sondern
         ein Verweis nach draussen - dieselbe Unterscheidung, die der
         Zyklus-Teiler oben mit derselben Strichelung trifft. */
      border: var(--border-width-thin) dashed
        color-mix(in srgb, var(--color-accent-amber) 45%, var(--color-border));
      background: color-mix(in srgb, var(--color-accent-amber) 6%, var(--color-surface-sunken));
      text-align: center;
      max-width: 560px;
      width: 100%;
      transition: background var(--transition-fast);
    }

    .event-card__body:hover {
      background: color-mix(in srgb, var(--color-accent-amber) 10%, var(--color-surface-sunken));
    }

    .event-card__title {
      font-family: var(--font-bureau, var(--font-prose));
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      color: var(--color-text-primary);
    }

    .event-card__desc {
      font-family: var(--font-body);
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
      line-height: var(--leading-snug);
      margin-top: var(--space-1);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .event-card__meta {
      font-family: var(--font-mono);
      font-size: 10px;
      color: var(--color-text-quiet);
      margin-top: var(--space-1);
    }

    /* --- Message items --- */
    .message-item {
      /* Die Aktionsleiste haengt um --chat-actions-lift ueber der Blase
         (ChatMessage.ts). "content-visibility: auto" bringt Paint-Containment
         mit: was ausserhalb DIESER Box gemalt wird, faellt weg.

         Am 03.09.2026 auf Prod nachgemessen — und es fehlten genau zwei
         Pixel:

             Kachel oben    491,1
             Leiste oben    489,1

         Zwei Pixel sind der ganze obere Rahmenstrich. Er war nie unsichtbar,
         er war abgeschnitten; deshalb half auch keine Farbe. Der Nutzer hat
         ihn dreimal gemeldet.

         Polster nach innen, Rand nach aussen, derselbe Wert: die Box wird
         oben groesser, die Kachel bleibt stehen, wo sie stand. Ein Wert, kein
         Zahlenpaar, das auseinanderlaufen kann. */
      --chat-actions-lift: 18px;
      content-visibility: auto;
      contain-intrinsic-size: auto 80px;
      padding-top: var(--chat-actions-lift);
      margin-top: calc(var(--chat-actions-lift) * -1);
    }

    /* --- Scroll-to-bottom FAB --- */
    .scroll-fab {
      position: absolute;
      bottom: var(--space-4);
      left: 50%;
      translate: -50% 0;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border: var(--border-default);
      background: var(--color-surface-raised);
      color: var(--color-text-secondary);
      box-shadow: var(--shadow-sm);
      cursor: pointer;
      opacity: 0;
      pointer-events: none;
      transition:
        opacity var(--transition-fast),
        transform var(--transition-fast),
        box-shadow var(--transition-fast);
    }

    .scroll-fab--visible {
      opacity: 1;
      pointer-events: auto;
    }

    .scroll-fab:hover {
      background: var(--color-surface);
      color: var(--color-text-primary);
      transform: translate(-2px, -2px);
      box-shadow: var(--shadow-md);
    }

    .scroll-fab:active {
      transform: translate(0);
      box-shadow: var(--shadow-pressed);
    }

    .scroll-fab:focus-visible {
      outline: none;
      box-shadow: var(--ring-focus);
    }

    .scroll-fab svg {
      width: 16px;
      height: 16px;
    }

    /* --- Empty state --- */
    .empty {
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 1;
      min-height: 200px;
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: var(--label-transform);
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-quiet);
    }

    /* --- Conversation starters (empty state with suggestions) --- */
    .starters {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex: 1;
      padding: var(--space-8);
      gap: var(--space-4);
    }

    .starters__heading {
      font-family: var(--font-mono);
      font-size: 10px;
      text-transform: var(--label-transform);
      letter-spacing: 0.15em;
      color: var(--color-text-quiet);
      opacity: 0.6;
    }

    .starters__list {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      width: 100%;
      max-width: 420px;
    }

    .starters__btn {
      display: block;
      width: 100%;
      padding: var(--space-3) var(--space-4);
      font-family: var(--font-body);
      font-size: var(--text-sm);
      line-height: var(--leading-snug);
      color: var(--color-text-secondary);
      text-align: left;
      background: var(--color-surface-sunken);
      border: var(--border-width-thin) solid var(--color-border);
      cursor: pointer;
      transition: all var(--transition-fast);
      /* Staggered entrance */
      opacity: 0;
      transform: translateY(6px);
      animation: starter-enter 300ms var(--ease-dramatic) forwards;
    }

    .starters__btn:nth-child(1) { animation-delay: 100ms; }
    .starters__btn:nth-child(2) { animation-delay: 180ms; }
    .starters__btn:nth-child(3) { animation-delay: 260ms; }
    .starters__btn:nth-child(4) { animation-delay: 340ms; }

    @keyframes starter-enter {
      to { opacity: 1; transform: translateY(0); }
    }

    .starters__btn:hover {
      background: var(--color-surface-raised);
      color: var(--color-text-primary);
      border-color: var(--color-border-focus);
    }

    .starters__btn:focus-visible {
      outline: none;
      box-shadow: var(--ring-focus);
    }

    .starters__btn:active {
      transform: scale(0.98);
    }

    @media (prefers-reduced-motion: reduce) {
      .starters__btn {
        animation: none;
        opacity: 1;
        transform: none;
      }
      .starters__btn:active {
        transform: none;
      }
    }

    @media (max-width: 640px) {
      .starters {
        padding: var(--space-4);
      }
      .starters__list {
        max-width: 100%;
      }
    }

    /* --- Responsive --- */
    @media (max-width: 640px) {
      .feed {
        padding: var(--space-3);
      }

      .empty {
        min-height: 120px;
        padding: var(--space-4);
      }

      .event-card__body {
        max-width: 100%;
      }
    }
  `;

  // --- Properties ---

  @property({ type: Array }) messages: ChatMessage[] = [];
  @property({ type: Array }) participants: Participant[] = [];
  @property({ type: Array }) eventReferences: ChatEventReference[] = [];
  @property({ type: String }) currentUserId = '';
  @property({ type: String }) currentUserName = '';
  @property({ type: Boolean }) streaming = false;
  @property({ type: String }) streamContent = '';
  @property({ type: String }) conversationLocale = 'de';
  @property({ type: Array }) typingUsers: TypingUser[] = [];
  @property({ type: Boolean }) hasMore = false;
  @property({ type: Boolean }) loading = false;
  /** ID of the agent currently streaming (from agent_start event). Used for avatar lookup. */
  @property({ type: String }) streamingParticipantId = '';
  /** Custom empty-state message (defaults to generic prompt). */
  @property({ type: String }) emptyMessage = '';
  /** Contextual conversation starters for empty conversations. */
  @property({ type: Array }) starters: string[] = [];

  // --- Controllers ---

  private _scroll = new ScrollController(this);

  // --- Derived state (cached per render) ---

  private _participantMap = new Map<string, Participant>();
  private _prevParticipants: Participant[] = [];

  /** Memoized timeline — rebuilt only when messages or events change. */
  private _timelineCache: TimelineItem[] = [];
  private _timelineCacheMessages: ChatMessage[] = [];
  private _timelineCacheEvents: ChatEventReference[] = [];

  /** Cached streaming message — re-created only when content changes. */
  private _streamMsgCache: ChatMessage | null = null;
  private _streamContentCache = '';

  // ---------------------------------------------------------------------------
  // Timeline construction
  // ---------------------------------------------------------------------------

  /**
   * Build a merged, sorted timeline of messages, events, and date separators.
   * Memoized — returns cached result if messages and events haven't changed.
   */
  private _buildTimeline(): TimelineItem[] {
    // Rebuild participant map only when the reference changes
    if (this.participants !== this._prevParticipants) {
      this._prevParticipants = this.participants;
      this._participantMap.clear();
      for (const p of this.participants) {
        this._participantMap.set(p.id, p);
      }
    }

    // Memoize: skip expensive sort+grouping if inputs unchanged
    if (
      this.messages === this._timelineCacheMessages &&
      this.eventReferences === this._timelineCacheEvents &&
      this._timelineCache.length > 0
    ) {
      return this._timelineCache;
    }
    this._timelineCacheMessages = this.messages;
    this._timelineCacheEvents = this.eventReferences;

    // Merge messages and events into a single sortable stream
    type Sortable =
      | { ts: string; kind: 'message'; message: ChatMessage; idx: number }
      | { ts: string; kind: 'event'; event: ChatEventReference };

    const items: Sortable[] = [];

    for (let i = 0; i < this.messages.length; i++) {
      items.push({
        ts: this.messages[i].created_at,
        kind: 'message',
        message: this.messages[i],
        idx: i,
      });
    }

    for (const evt of this.eventReferences) {
      items.push({
        ts: evt.referenced_at,
        kind: 'event',
        event: evt,
      });
    }

    items.sort((a, b) => a.ts.localeCompare(b.ts));

    // Walk sorted items, insert date separators, compute grouping
    const timeline: TimelineItem[] = [];
    let prevTs: string | null = null;
    let prevSenderId: string | null = null;
    let prevSenderRole: string | null = null;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // Date separator
      if (!prevTs || !isSameDay(prevTs, item.ts)) {
        timeline.push({
          kind: 'date',
          date: item.ts,
          label: formatDateLabel(item.ts),
        });
        prevSenderId = null;
        prevSenderRole = null;
      }

      if (item.kind === 'event') {
        timeline.push({ kind: 'event', event: item.event });
        prevSenderId = null;
        prevSenderRole = null;
      } else {
        const m = item.message;
        const senderId =
          m.sender_role === 'user' ? '__user__' : (m.agent_id ?? m.agent?.id ?? '__unknown__');
        const sameGroup =
          prevSenderId === senderId &&
          prevSenderRole === m.sender_role &&
          prevTs !== null &&
          isSameDay(prevTs, m.created_at);

        // Look ahead to determine lastInGroup (O(1) via index)
        const nextItem = items[i + 1];
        let nextIsSameSender = false;
        if (nextItem?.kind === 'message') {
          const nm = nextItem.message;
          const nextSenderId =
            nm.sender_role === 'user' ? '__user__' : (nm.agent_id ?? nm.agent?.id ?? '__unknown__');
          nextIsSameSender =
            nextSenderId === senderId &&
            nm.sender_role === m.sender_role &&
            isSameDay(m.created_at, nm.created_at);
        }

        timeline.push({
          kind: 'message',
          message: m,
          grouped: sameGroup,
          lastInGroup: !nextIsSameSender,
        });

        prevSenderId = senderId;
        prevSenderRole = m.sender_role;
      }

      prevTs = item.ts;
    }

    this._timelineCache = timeline;
    return timeline;
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  protected render() {
    if (this.messages.length === 0 && this.eventReferences.length === 0 && !this.streaming) {
      // Show contextual starters if available, otherwise generic prompt
      if (this.starters.length > 0) {
        return html`
          <div class="starters">
            <span class="starters__heading">${msg('Conversation openers')}</span>
            <div class="starters__list">
              ${this.starters.map(
                (text) => html`
                  <button
                    class="starters__btn"
                    @click=${() => this._handleStarterClick(text)}
                  >${text}</button>
                `,
              )}
            </div>
          </div>
        `;
      }
      return html`<div class="empty">${this.emptyMessage || msg('No messages yet. Start the conversation.')}</div>`;
    }

    const timeline = this._buildTimeline();

    return html`
      <div
        class="feed"
        role="log"
        aria-live="polite"
        aria-label=${msg('Conversation messages')}
      >
        <div class="feed__content">
        ${
          this.hasMore
            ? html`
              <div class="feed__load-more">
                ${
                  this.loading
                    ? html`<div class="feed__load-more-spinner"></div>`
                    : html`
                      <button
                        class="feed__load-more-btn"
                        @click=${this._handleLoadMore}
                      >
                        ${msg('Load older messages')}
                      </button>
                    `
                }
              </div>
            `
            : nothing
        }

        ${repeat(
          timeline,
          (item) => this._timelineKey(item),
          (item) => this._renderTimelineItem(item),
        )}

        ${
          this.streaming && this.streamContent
            ? html`
              <velg-chat-message
                .message=${this._getStreamMsg()}
                .participant=${this._getStreamingParticipant()}
                ?streaming=${true}
                ?lastInGroup=${true}
              ></velg-chat-message>
            `
            : nothing
        }

        ${
          this.typingUsers.length > 0
            ? html`<velg-typing-indicator .users=${this.typingUsers}></velg-typing-indicator>`
            : nothing
        }

        </div>
      </div>

      <button
        class=${classMap({
          'scroll-fab': true,
          'scroll-fab--visible': !this._scroll.isAtBottom,
        })}
        @click=${() => this._scroll.scrollToBottom()}
        aria-label=${msg('Scroll to bottom')}
      >
        ${icons.chevronDown(16)}
      </button>
    `;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  protected willUpdate(changed: Map<string, unknown>): void {
    // A streamed answer grows many times per second. Animating each growth
    // would cancel and restart the same scroll before it ever arrived, and the
    // view would trail the text it is supposed to follow — so live content is
    // followed instantly and only discrete events get the animation.
    if (changed.has('streamContent')) {
      this._scroll.requestAutoScroll('instant');
    }

    if (changed.has('messages')) {
      // Opening a conversation loads its whole history at once. Animating from
      // the first message to the last would scroll through weeks of text; there
      // is nothing to follow there, only a destination.
      const previous = changed.get('messages');
      const isFirstLoad = !Array.isArray(previous) || previous.length === 0;
      this._scroll.requestAutoScroll(isFirstLoad ? 'instant' : 'smooth');
    }

    if (changed.has('typingUsers')) {
      this._scroll.requestAutoScroll('smooth');
    }
  }

  protected firstUpdated(): void {
    const feed = this.renderRoot.querySelector('.feed') as HTMLElement | null;
    // Beide: der Behaelter rollt, aber nur der Inhalt WAECHST — und nur an
    // seinem Wachsen laesst sich erkennen, dass das Ende weitergewandert ist.
    const content = this.renderRoot.querySelector('.feed__content') as HTMLElement | null;
    this._scroll.attach(feed, content);
  }

  // ---------------------------------------------------------------------------
  // Timeline rendering helpers
  // ---------------------------------------------------------------------------

  private _timelineKey(item: TimelineItem): string {
    switch (item.kind) {
      case 'message':
        return item.message.id;
      case 'event':
        return `evt-${item.event.id}`;
      case 'date':
        return `date-${item.date}`;
    }
  }

  private _renderTimelineItem(item: TimelineItem): TemplateResult {
    switch (item.kind) {
      case 'date':
        return this._renderDateSeparator(item.label);
      case 'event':
        return this._renderEventCard(item.event);
      case 'message':
        return this._renderMessage(item);
    }
  }

  private _renderDateSeparator(label: string): TemplateResult {
    return html`
      <div class="date-separator" role="separator">
        <span class="date-separator__line"></span>
        <span class="date-separator__label">${label}</span>
        <span class="date-separator__line"></span>
      </div>
    `;
  }

  private _renderEventCard(evt: ChatEventReference): TemplateResult {
    const meta = [
      evt.event_type ?? '',
      evt.impact_level != null ? `Impact ${evt.impact_level}/10` : '',
      evt.occurred_at ? formatDate(evt.occurred_at) : '',
    ]
      .filter(Boolean)
      .join(' \u00B7 ');

    return html`
      <div class="event-card" role="note">
        <span class="event-card__label">
          ${icons.calendar(12)}
          ${msg('Event Referenced')}
        </span>
        <div class="event-card__body">
          <div class="event-card__title">${evt.event_title}</div>
          ${
            evt.event_description
              ? html`<div class="event-card__desc">${evt.event_description}</div>`
              : nothing
          }
          ${meta ? html`<div class="event-card__meta">${meta}</div>` : nothing}
        </div>
      </div>
    `;
  }

  private _renderMessage(item: TimelineItem & { kind: 'message' }): TemplateResult {
    const m = item.message;
    const senderId =
      m.sender_role === 'user' ? this.currentUserId : (m.agent_id ?? m.agent?.id ?? '');
    const participant = this._participantMap.get(senderId);

    return html`
      <div
        class="message-item"
        style=${styleMap({
          'contain-intrinsic-size': item.grouped ? 'auto 48px' : 'auto 80px',
        })}
      >
        <velg-chat-message
          .message=${m}
          .participant=${participant}
          .currentUserId=${this.currentUserId}
          .currentUserName=${this.currentUserName}
          ?grouped=${item.grouped}
          ?lastInGroup=${item.lastInGroup}
        ></velg-chat-message>
      </div>
    `;
  }

  // ---------------------------------------------------------------------------
  // Streaming message cache
  // ---------------------------------------------------------------------------

  /** Look up the participant for the currently streaming agent. Falls back to first participant. */
  private _getStreamingParticipant(): Participant | undefined {
    if (this.streamingParticipantId) {
      return this._participantMap.get(this.streamingParticipantId);
    }
    // Fallback: first participant (single-agent conversations)
    return this._participantMap.values().next().value;
  }

  /** Stable timestamp for the streaming message — set once when streaming starts. */
  private _streamStartedAt = '';

  /**
   * Return streaming message, re-creating only when content changes.
   * Lit uses === for .property dirty checking, so same-reference objects
   * won't trigger child re-renders. We create a new object when content
   * changes (which happens per token during streaming) but reuse the
   * cached object for intermediate parent re-renders where content is stable.
   */
  private _getStreamMsg(): ChatMessage {
    if (this.streamContent !== this._streamContentCache || !this._streamMsgCache) {
      // Detect new stream: content restarted (shorter than cache = buffer was reset)
      const isNewStream =
        !this._streamStartedAt || this.streamContent.length < this._streamContentCache.length;
      if (isNewStream) {
        this._streamStartedAt = new Date().toISOString();
      }
      this._streamContentCache = this.streamContent;
      this._streamMsgCache = {
        id: '__stream__',
        conversation_id: '',
        sender_role: 'assistant',
        content: this.streamContent,
        created_at: this._streamStartedAt,
        metadata: { locale: this.conversationLocale },
      };
    }
    return this._streamMsgCache;
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  private _handleLoadMore(): void {
    this.dispatchEvent(new CustomEvent('load-older', { bubbles: true, composed: true }));
  }

  private _handleStarterClick(text: string): void {
    this.dispatchEvent(
      new CustomEvent('send-starter', {
        detail: { content: text },
        bubbles: true,
        composed: true,
      }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-chat-feed': ChatFeed;
  }
}

/**
 * ChatMessage — Single message in the unified chat feed.
 *
 * Handles both user and assistant messages with:
 *   - Role-based alignment and styling (user=right, assistant=left)
 *   - Agent accent color via oklch color-mix (per-agent unique palette)
 *   - Avatar display via VelgAvatar (only on last-in-group)
 *   - Sender label (first-in-group only, brutalist typography)
 *   - Timestamp (last-in-group only, mono precision)
 *   - Grouping: tight margin for consecutive same-sender messages
 *   - Optimistic message opacity reduction
 *   - Streaming cursor animation
 *   - Hover surface shift for future message actions
 *
 * Consumed by ChatFeed via repeat() directive with stable message IDs.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';
import type { OptimisticChatMessage } from '../../../services/chat/ChatSessionStore.js';
import type { Participant } from '../../../services/chat/chat-types.js';
import type { ChatMessage as ChatMessageData } from '../../../types/index.js';
import { moodRingColor } from '../../../utils/agent-colors.js';
import { formatRelativeTimeVerbose } from '../../../utils/date-format.js';
import { agentAltText } from '../../../utils/text.js';

import '../../shared/VelgAvatar.js';
import './ChatBubble.js';
import './MessageActions.js';
import './ReactionBar.js';

@localized()
@customElement('velg-chat-message')
export class ChatMessage extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    /* --- Message row (avatar + content column) --- */
    .row {
      display: flex;
      gap: var(--space-3);
      max-width: 80%;
      margin-top: var(--space-4);
      position: relative;
      /* Entrance animation via @starting-style */
      opacity: 1;
      transform: translateY(0) translateX(0);
      transition:
        opacity var(--duration-entrance, 350ms) var(--ease-dramatic),
        transform var(--duration-entrance, 350ms) var(--ease-dramatic);
    }

    @starting-style {
      .row { opacity: 0; transform: translateY(8px); }
      .row--user { transform: translateX(12px); }
      .row--assistant { transform: translateX(-12px); }
    }

    @media (prefers-reduced-motion: reduce) {
      .row { transition-duration: 0.01ms !important; }
    }

    .row--grouped {
      margin-top: var(--space-2);
    }

    /* Subtle separator when the speaking agent changes */
    .row:not(.row--grouped)::after {
      content: '';
      position: absolute;
      top: calc(-1 * var(--space-2));
      left: 0;
      right: 0;
      height: 1px;
      background: var(--color-border-light);
    }

    /* Suppress separator on the very first message */
    :host(:first-child) .row::after {
      display: none;
    }

    .row--user {
      align-self: flex-end;
      flex-direction: row-reverse;
      margin-left: auto;
    }

    .row--assistant {
      align-self: flex-start;
      flex-direction: row;
    }

    .row--optimistic {
      animation: optimistic-pulse 1.5s ease-in-out infinite;
    }

    @keyframes optimistic-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    /* Hover surface shift — subtle readiness for message actions */
    .row::before {
      content: '';
      position: absolute;
      inset: calc(-1 * var(--space-1)) calc(-1 * var(--space-2));
      border-radius: 4px;
      background: transparent;
      transition: background var(--transition-fast);
      pointer-events: none;
      z-index: -1;
    }

    .row:hover::before {
      background: color-mix(in oklch, var(--color-text-primary) 3%, transparent);
    }

    /* --- Message actions toolbar (hover-reveal) --- */
    /* Default hidden state lives in MessageActions :host — parent only handles
       positioning and reveal conditions. :host has lower specificity than
       these selectors, so reveal overrides correctly. */
    velg-message-actions {
      position: absolute;
      top: -12px;
      transition:
        opacity var(--transition-fast),
        visibility var(--transition-fast);
      z-index: 2;
    }

    .row--assistant velg-message-actions {
      right: var(--space-2);
    }

    .row--user velg-message-actions {
      left: var(--space-2);
    }

    .row:hover velg-message-actions,
    .row:focus-within velg-message-actions,
    velg-message-actions[copied] {
      opacity: 1;
      visibility: visible;
      pointer-events: auto;
    }

    @media (prefers-reduced-motion: reduce) {
      velg-message-actions {
        transition-duration: 0.01ms !important;
      }
    }

    /* --- Avatar column --- */
    .avatar {
      width: 32px;
      height: 32px;
      flex-shrink: 0;
      align-self: flex-end;
      overflow: visible; /* Allow mood ring to extend beyond avatar bounds */
    }

    .avatar-spacer {
      width: 32px;
      flex-shrink: 0;
    }

    .avatar--user {
      /* User gets a small styled initial badge */
    }

    .avatar--user velg-avatar {
      --color-surface-sunken: var(--color-primary);
    }

    /* --- Content column --- */
    .content {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .content--user {
      align-items: flex-end;
    }

    .content--assistant {
      align-items: flex-start;
    }

    /* --- Sender label (first-in-group only) --- */
    .sender {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      margin-bottom: var(--space-1);
      user-select: none;
    }

    .sender--user {
      color: var(--color-text-secondary);
    }

    .sender--assistant {
      color: var(--_accent, var(--color-text-secondary));
    }

    /* Bot badge for system participants (epoch bots) */
    .sender__badge {
      display: inline-block;
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-size: 8px;
      font-weight: 900;
      letter-spacing: 1px;
      text-transform: uppercase;
      padding: 0 4px;
      margin-left: 4px;
      color: var(--color-warning);
      border: var(--border-width-thin, 1px) solid color-mix(in srgb, var(--color-warning) 40%, transparent);
      vertical-align: middle;
    }

    /* --- Timestamp (last-in-group only) --- */
    .time {
      font-family: var(--font-mono);
      font-size: 10px;
      color: var(--color-text-muted);
      margin-top: var(--space-1);
      user-select: none;
    }

    /* --- Responsive --- */
    @media (max-width: 640px) {
      .row {
        max-width: 90%;
      }

      .avatar {
        width: 28px;
        height: 28px;
      }

      .avatar-spacer {
        width: 28px;
      }
    }
  `;

  // --- Properties ---

  @property({ type: Object }) message!: ChatMessageData;
  @property({ type: Object }) participant?: Participant;
  @property({ type: String }) currentUserId = '';
  @property({ type: String }) currentUserName = '';
  @property({ type: Boolean }) grouped = false;
  @property({ type: Boolean }) lastInGroup = false;
  @property({ type: Boolean }) streaming = false;

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------

  /** Message content language for WCAG 3.1.2 (Language of Parts). */
  private _getMessageLang(): string {
    const meta = this.message.metadata as Record<string, unknown> | undefined;
    if (meta?.locale && typeof meta.locale === 'string') return meta.locale;
    return document.documentElement.lang || 'en';
  }

  /** Sender display name — single source of truth for render, aria, sender label. */
  private get _senderName(): string {
    return this.message.sender_role === 'user'
      ? msg('You')
      : (this.participant?.name ?? this.message.agent?.name ?? msg('Agent'));
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  protected render() {
    const m = this.message;
    const isUser = m.sender_role === 'user';
    const isOptimistic = !!(m as OptimisticChatMessage)._optimistic;
    const showSender = !this.grouped;
    const showAvatar = this.lastInGroup;
    const showTime = this.lastInGroup;

    // Agent accent color via participant or fallback
    const accentColor = this.participant?.accentColor ?? '';
    const hostStyle = accentColor ? ({ '--_accent': accentColor } as Record<string, string>) : {};

    const rowClasses = {
      row: true,
      'row--user': isUser,
      'row--assistant': !isUser,
      'row--grouped': this.grouped,
      'row--optimistic': isOptimistic,
    };

    const timeLabel = formatRelativeTimeVerbose(m.created_at);

    const messageLang = this._getMessageLang();

    return html`
      <div
        class=${classMap(rowClasses)}
        style=${styleMap(hostStyle)}
        role="article"
        lang="${messageLang}"
        aria-label="${this._senderName}, ${timeLabel}"
      >
        ${this._renderAvatar(isUser, showAvatar)}
        <div class="content ${isUser ? 'content--user' : 'content--assistant'}">
          ${showSender ? this._renderSender(isUser) : nothing}
          <velg-chat-bubble
            .content=${m.content}
            .senderRole=${m.sender_role}
            .accentColor=${accentColor}
            ?streaming=${this.streaming}
            ?plainText=${this.participant?.role === 'player'}
          ></velg-chat-bubble>
          ${
            !isOptimistic && (m.reactions?.length ?? 0) > 0
              ? html`<velg-reaction-bar
                .messageId=${m.id}
                .reactions=${m.reactions ?? []}
              ></velg-reaction-bar>`
              : nothing
          }
          ${
            showTime
              ? html`<span class="time">${formatRelativeTimeVerbose(m.created_at)}</span>`
              : nothing
          }
        </div>
        ${
          isOptimistic
            ? nothing
            : html`
          <velg-message-actions
            .messageId=${m.id}
            .senderRole=${m.sender_role}
            .content=${m.content}
          ></velg-message-actions>
        `
        }
      </div>
    `;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private _renderAvatar(isUser: boolean, show: boolean) {
    if (!show) {
      return html`<div class="avatar-spacer"></div>`;
    }

    if (isUser) {
      return html`
        <div class="avatar avatar--user">
          <velg-avatar
            .name=${this.currentUserName || this._senderName}
            size="sm"
          ></velg-avatar>
        </div>
      `;
    }

    const src = this.participant?.avatarUrl ?? this.message.agent?.portrait_image_url ?? '';
    const mood =
      this.participant?.moodScore != null ? moodRingColor(this.participant.moodScore) : '';

    return html`
      <div class="avatar">
        <velg-avatar
          .src=${src}
          .name=${this._senderName}
          .moodColor=${mood}
          alt=${agentAltText({ name: this._senderName })}
          size="sm"
          clickable
          @avatar-click=${this._handleAvatarClick}
        ></velg-avatar>
      </div>
    `;
  }

  private _renderSender(isUser: boolean) {
    const isBot = !isUser && this.participant?.role === 'system';

    return html`
      <span class=${classMap({
        sender: true,
        'sender--user': isUser,
        'sender--assistant': !isUser,
      })}>
        ${this._senderName}${isBot ? html`<span class="sender__badge">BOT</span>` : nothing}
      </span>
    `;
  }

  private _handleAvatarClick(e: CustomEvent): void {
    // Bubble up for lightbox handling in parent
    this.dispatchEvent(
      new CustomEvent('avatar-click', {
        detail: e.detail,
        bubbles: true,
        composed: true,
      }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-chat-message': ChatMessage;
  }
}

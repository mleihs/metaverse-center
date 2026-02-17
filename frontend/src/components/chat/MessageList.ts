import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { AgentBrief, ChatEventReference, ChatMessage } from '../../types/index.js';
import '../shared/Lightbox.js';
import '../shared/VelgAvatar.js';

const AGENT_COLORS = [
  'var(--color-primary)',
  'var(--color-info)',
  'var(--color-success)',
  'var(--color-warning)',
];

@localized()
@customElement('velg-message-list')
export class VelgMessageList extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .messages {
      display: flex;
      flex-direction: column;
      padding: var(--space-4) var(--space-6);
    }

    /* --- Date separator --- */
    .date-separator {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      margin: var(--space-4) 0;
    }

    .date-separator__line {
      flex: 1;
      height: 0;
      border: none;
      border-top: var(--border-width-thin) solid var(--color-border-light);
    }

    .date-separator__label {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      white-space: nowrap;
      flex-shrink: 0;
    }

    /* --- Event reference separator --- */
    .event-separator {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-1);
      margin: var(--space-4) 0;
    }

    .event-separator__label {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
    }

    .event-separator__card {
      padding: var(--space-2) var(--space-4);
      border: var(--border-default);
      background: var(--color-surface-sunken);
      text-align: center;
    }

    .event-separator__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-primary);
    }

    .event-separator__meta {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    /* --- Message row (avatar + bubble) --- */
    .message-row {
      display: flex;
      gap: var(--space-3);
      max-width: 80%;
      margin-top: var(--space-4);
    }

    .message-row--grouped {
      margin-top: var(--space-1);
    }

    .message-row--user {
      align-self: flex-end;
      flex-direction: row-reverse;
    }

    .message-row--assistant {
      align-self: flex-start;
      flex-direction: row;
    }

    /* --- Avatars --- */
    .message__avatar {
      width: 32px;
      height: 32px;
      flex-shrink: 0;
      align-self: flex-end;
    }

    .message__avatar-spacer {
      width: 32px;
      flex-shrink: 0;
    }

    .message__avatar-placeholder--user {
      background: var(--color-primary);
      color: var(--color-text-inverse);
      border-color: var(--color-primary);
    }

    /* --- Bubble content --- */
    .message__content {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .message__content--user {
      align-items: flex-end;
    }

    .message__content--assistant {
      align-items: flex-start;
    }

    .message__sender {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-secondary);
      margin-bottom: var(--space-1);
    }

    .message__bubble {
      padding: var(--space-3) var(--space-4);
      font-family: var(--font-sans);
      font-size: var(--text-sm);
      line-height: var(--leading-normal);
      word-break: break-word;
      white-space: pre-wrap;
    }

    .message__bubble--user {
      background: var(--color-primary);
      color: var(--color-text-inverse);
      border: var(--border-default);
    }

    .message__bubble--assistant {
      background: var(--color-surface-raised);
      color: var(--color-text-primary);
      border: var(--border-medium);
    }

    .message__bubble--agent-colored {
      border-left-width: 3px;
      border-left-style: solid;
    }

    .message__time {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      margin-top: var(--space-1);
    }

    .empty {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 200px;
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-muted);
    }
  `;

  @property({ type: Array }) messages: ChatMessage[] = [];
  @property({ type: String }) agentName = 'Agent';
  @property({ type: String }) agentPortraitUrl = '';
  @state() private _lightboxSrc: string | null = null;
  /** All agents in the conversation — used for multi-agent attribution */
  @property({ type: Array }) agents: AgentBrief[] = [];
  /** Event references to show as in-chat separators */
  @property({ type: Array }) eventReferences: ChatEventReference[] = [];

  private _formatTime(dateString: string): string {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return msg('Just now');
      if (diffMins < 60) return msg(str`${diffMins}m ago`);
      if (diffHours < 24) return msg(str`${diffHours}h ago`);
      if (diffDays < 7) return msg(str`${diffDays}d ago`);

      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  }

  private _isSameDay(a: string, b: string): boolean {
    try {
      const da = new Date(a);
      const db = new Date(b);
      return (
        da.getFullYear() === db.getFullYear() &&
        da.getMonth() === db.getMonth() &&
        da.getDate() === db.getDate()
      );
    } catch {
      return false;
    }
  }

  private _formatDateLabel(dateString: string): string {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const diffDays = Math.round((today.getTime() - target.getTime()) / 86400000);

      if (diffDays === 0) return msg('Today');
      if (diffDays === 1) return msg('Yesterday');

      return date.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '';
    }
  }

  /** Get agent color by position in agents array */
  private _getAgentColor(agentId: string | undefined): string {
    if (!agentId || this.agents.length <= 1) return '';
    const idx = this.agents.findIndex((a) => a.id === agentId);
    return idx >= 0 ? AGENT_COLORS[idx % AGENT_COLORS.length] : AGENT_COLORS[0];
  }

  /** Find agent info for a message */
  private _getMessageAgent(message: ChatMessage): AgentBrief | undefined {
    // Use embedded agent if available
    if (message.agent) return message.agent;
    // Find by agent_id in conversation agents
    if (message.agent_id) {
      return this.agents.find((a) => a.id === message.agent_id);
    }
    // Fallback: first agent (for old messages without agent_id)
    if (message.sender_role === 'assistant' && this.agents.length > 0) {
      return this.agents[0];
    }
    return undefined;
  }

  /** Check if messages should be grouped (same sender AND same agent) */
  private _isSameGroupSender(a: ChatMessage, b: ChatMessage): boolean {
    if (a.sender_role !== b.sender_role) return false;
    if (a.sender_role === 'user') return true;
    // For assistant messages, only group if same agent
    return (a.agent_id ?? a.agent?.id) === (b.agent_id ?? b.agent?.id);
  }

  private _renderAvatar(
    isUser: boolean,
    showAvatar: boolean,
    agent: AgentBrief | undefined,
  ): TemplateResult {
    if (!showAvatar) {
      return html`<div class="message__avatar-spacer"></div>`;
    }

    if (isUser) {
      return html`
        <div class="message__avatar">
          <div class="message__avatar-placeholder message__avatar-placeholder--user">
            ${msg('You').slice(0, 2).toUpperCase()}
          </div>
        </div>
      `;
    }

    const portraitUrl = agent?.portrait_image_url ?? this.agentPortraitUrl;
    const name = agent?.name ?? this.agentName;

    if (portraitUrl) {
      return html`
        <div class="message__avatar">
          <velg-avatar
            .src=${portraitUrl}
            .name=${name}
            size="sm"
            clickable
            @avatar-click=${(e: CustomEvent) => {
              this._lightboxSrc = (e.detail as { src: string }).src;
            }}
          ></velg-avatar>
        </div>
      `;
    }

    return html`
      <div class="message__avatar">
        <velg-avatar .name=${name} size="sm"></velg-avatar>
      </div>
    `;
  }

  private _renderDateSeparator(dateString: string): TemplateResult {
    return html`
      <div class="date-separator">
        <span class="date-separator__line"></span>
        <span class="date-separator__label">${this._formatDateLabel(dateString)}</span>
        <span class="date-separator__line"></span>
      </div>
    `;
  }

  private _renderEventSeparator(ref: ChatEventReference): TemplateResult {
    return html`
      <div class="event-separator">
        <span class="event-separator__label">${msg('Event Referenced')}</span>
        <div class="event-separator__card">
          <div class="event-separator__title">${ref.event_title}</div>
          <div class="event-separator__meta">
            ${ref.event_type ?? ''} ${ref.impact_level != null ? `\u00B7 Impact ${ref.impact_level}/10` : ''}
            ${ref.occurred_at ? `\u00B7 ${this._formatDate(ref.occurred_at)}` : ''}
          </div>
        </div>
      </div>
    `;
  }

  private _formatDate(dateString: string): string {
    try {
      return new Date(dateString).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  }

  protected render() {
    if (this.messages.length === 0) {
      return html`<div class="empty">${msg('No messages yet. Start the conversation.')}</div>`;
    }

    const isMultiAgent = this.agents.length > 1;
    const items: TemplateResult[] = [];

    // Insert event reference separators at the top
    if (this.eventReferences.length > 0) {
      for (const ref of this.eventReferences) {
        items.push(this._renderEventSeparator(ref));
      }
    }

    for (let i = 0; i < this.messages.length; i++) {
      const message = this.messages[i];
      const prev = i > 0 ? this.messages[i - 1] : null;
      const next = i < this.messages.length - 1 ? this.messages[i + 1] : null;

      // Date separator
      if (!prev || !this._isSameDay(prev.created_at, message.created_at)) {
        items.push(this._renderDateSeparator(message.created_at));
      }

      const isUser = message.sender_role === 'user';
      const agent = isUser ? undefined : this._getMessageAgent(message);
      const senderLabel = isUser ? msg('You') : (agent?.name ?? this.agentName);

      const sameSenderAsPrev = prev !== null && this._isSameGroupSender(prev, message);
      const sameSenderAsNext = next !== null && this._isSameGroupSender(message, next);
      const isGrouped = sameSenderAsPrev && this._isSameDay(prev.created_at, message.created_at);
      const isLastInGroup =
        !sameSenderAsNext ||
        (next !== null && !this._isSameDay(message.created_at, next.created_at));

      const showAvatar = isLastInGroup;
      const showSender = !isGrouped;
      const showTime = isLastInGroup;

      // Agent color for multi-agent
      const agentColor =
        isMultiAgent && !isUser ? this._getAgentColor(message.agent_id ?? agent?.id) : '';
      const colorStyle = agentColor ? `border-left-color: ${agentColor}` : '';
      const colorClass = agentColor ? 'message__bubble--agent-colored' : '';

      items.push(html`
        <div class="message-row message-row--${message.sender_role} ${isGrouped ? 'message-row--grouped' : ''}">
          ${this._renderAvatar(isUser, showAvatar, agent)}
          <div class="message__content message__content--${message.sender_role}">
            ${showSender ? html`<div class="message__sender">${senderLabel}</div>` : null}
            <div
              class="message__bubble message__bubble--${message.sender_role} ${colorClass}"
              style=${colorStyle}
            >
              ${message.content}
            </div>
            ${showTime ? html`<div class="message__time">${this._formatTime(message.created_at)}</div>` : null}
          </div>
        </div>
      `);
    }

    return html`
      <div class="messages">${items}</div>
      <velg-lightbox
        .src=${this._lightboxSrc}
        @lightbox-close=${() => {
          this._lightboxSrc = null;
        }}
      ></velg-lightbox>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-message-list': VelgMessageList;
  }
}

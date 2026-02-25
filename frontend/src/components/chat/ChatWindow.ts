import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, svg, type TemplateResult } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { chatApi } from '../../services/api/index.js';
import type {
  AgentBrief,
  ChatConversation,
  ChatEventReference,
  ChatMessage,
} from '../../types/index.js';
import { VelgToast } from '../shared/Toast.js';

import '../shared/Lightbox.js';
import '../shared/VelgAvatar.js';
import './MessageList.js';
import './MessageInput.js';

@localized()
@customElement('velg-chat-window')
export class VelgChatWindow extends LitElement {
  static styles = css`
    :host {
      display: block;
      height: 100%;
    }

    .window {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .window__header {
      display: flex;
      flex-direction: column;
      background: var(--color-surface-header);
      border-bottom: var(--border-medium);
      flex-shrink: 0;
    }

    .window__header-main {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-3) var(--space-4);
    }

    .window__header-left {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      min-width: 0;
    }

    /* Portrait stack */
    .header__portraits {
      display: flex;
      flex-shrink: 0;
    }

    .header__portrait-overflow {
      width: 32px;
      height: 32px;
      background: var(--color-primary);
      color: var(--color-text-inverse);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-left: -8px;
      flex-shrink: 0;
      border: var(--border-width-default) solid var(--color-surface);
    }

    .window__header-info {
      min-width: 0;
    }

    .window__agent-name {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-base);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .window__sub-info {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    .window__header-actions {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      flex-shrink: 0;
    }

    .window__action-btn {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      padding: var(--space-1-5) var(--space-2);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      background: transparent;
      color: var(--color-text-secondary);
      border: var(--border-width-thin) solid var(--color-border);
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .window__action-btn:hover {
      background: var(--color-surface-sunken);
      color: var(--color-text-primary);
    }

    .window__action-btn--active {
      background: var(--color-primary-bg);
      border-color: var(--color-primary);
      color: var(--color-primary);
    }

    .window__action-btn svg {
      flex-shrink: 0;
    }

    /* Event reference bar */
    .window__events-bar {
      display: flex;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-4);
      overflow-x: auto;
      border-top: var(--border-light);
      background: var(--color-surface-sunken);
    }

    .event-card {
      display: flex;
      flex-direction: column;
      gap: var(--space-0-5);
      padding: var(--space-2) var(--space-3);
      border: var(--border-light);
      background: var(--color-surface);
      min-width: 180px;
      max-width: 240px;
      flex-shrink: 0;
    }

    .event-card__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-1);
    }

    .event-card__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
      min-width: 0;
    }

    .event-card__remove {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      padding: 0;
      background: transparent;
      color: var(--color-text-muted);
      border: none;
      cursor: pointer;
      font-size: var(--text-sm);
      flex-shrink: 0;
    }

    .event-card__remove:hover {
      color: var(--color-text-danger);
    }

    .event-card__meta {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    .window__messages {
      flex: 1;
      overflow-y: auto;
      scroll-behavior: smooth;
    }

    .window__empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      gap: var(--space-4);
      padding: var(--space-8);
      text-align: center;
    }

    .window__empty-title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-lg);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-secondary);
    }

    .window__empty-text {
      font-family: var(--font-sans);
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      max-width: 360px;
    }

    .window__loading {
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 1;
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-muted);
    }

    .window__sending-indicator {
      padding: var(--space-2) var(--space-4);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      border-top: var(--border-light);
    }

    .window__typing-indicator {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-4);
    }

    .window__typing-label {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    .window__typing-bubble {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: var(--space-2) var(--space-3);
      background: var(--color-surface-sunken);
      border: var(--border-width-thin) solid var(--color-border-light);
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      color: var(--color-text-muted);
    }

    .window__typing-dot {
      width: 6px;
      height: 6px;
      background: var(--color-text-muted);
      border-radius: 50%;
      animation: typing-pulse 1.4s ease-in-out infinite;
    }

    .window__typing-dot:nth-child(2) {
      animation-delay: 0.2s;
    }

    .window__typing-dot:nth-child(3) {
      animation-delay: 0.4s;
    }

    @keyframes typing-pulse {
      0%, 60%, 100% {
        opacity: 0.3;
        transform: scale(0.8);
      }
      30% {
        opacity: 1;
        transform: scale(1);
      }
    }
  `;

  @property({ type: Object }) conversation: ChatConversation | null = null;
  @property({ type: String }) simulationId = '';

  @state() private _messages: ChatMessage[] = [];
  @state() private _loading = false;
  @state() private _sending = false;
  @state() private _aiTyping = false;
  @state() private _showEventsBar = false;
  @state() private _lightboxSrc: string | null = null;

  @query('.window__messages') private _messagesContainer!: HTMLElement;

  private _previousConversationId: string | null = null;

  protected updated(changedProperties: Map<PropertyKey, unknown>): void {
    if (changedProperties.has('conversation')) {
      const newId = this.conversation?.id ?? null;
      if (newId !== this._previousConversationId) {
        this._previousConversationId = newId;
        this._showEventsBar = false;
        if (newId) {
          this._loadMessages();
        } else {
          this._messages = [];
        }
      }
    }
  }

  private async _loadMessages(): Promise<void> {
    if (!this.conversation || !this.simulationId) return;

    this._loading = true;
    this._messages = [];

    try {
      const response = await chatApi.getMessages(this.simulationId, this.conversation.id, {
        page_size: '100',
      });

      if (response.success && response.data) {
        this._messages = Array.isArray(response.data) ? response.data : [];
        this._scrollToBottom();
      } else {
        VelgToast.error(response.error?.message ?? msg('Failed to load messages.'));
      }
    } catch {
      VelgToast.error(msg('An unexpected error occurred while loading messages.'));
    } finally {
      this._loading = false;
    }
  }

  private _scrollToBottom(): void {
    requestAnimationFrame(() => {
      if (this._messagesContainer) {
        this._messagesContainer.scrollTop = this._messagesContainer.scrollHeight;
      }
    });
  }

  private _typingTimeout: ReturnType<typeof setTimeout> | null = null;

  private async _handleSendMessage(e: CustomEvent<{ content: string }>): Promise<void> {
    if (!this.conversation || !this.simulationId || this._sending) return;

    const { content } = e.detail;
    this._sending = true;

    // Optimistic: add user message immediately
    const optimisticMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      conversation_id: this.conversation.id,
      sender_role: 'user',
      content,
      created_at: new Date().toISOString(),
    };
    this._messages = [...this._messages, optimisticMessage];
    this._scrollToBottom();

    // Show typing indicator after a short delay
    this._typingTimeout = setTimeout(() => {
      this._aiTyping = true;
    }, 300);

    try {
      const response = await chatApi.sendMessage(this.simulationId, this.conversation.id, {
        content,
        generate_response: true,
      });

      if (response.success) {
        await this._loadMessages();
      } else {
        this._messages = this._messages.filter((m) => m.id !== optimisticMessage.id);
        VelgToast.error(response.error?.message ?? msg('Failed to send message.'));
      }
    } catch {
      this._messages = this._messages.filter((m) => m.id !== optimisticMessage.id);
      VelgToast.error(msg('An unexpected error occurred while sending the message.'));
    } finally {
      if (this._typingTimeout) {
        clearTimeout(this._typingTimeout);
        this._typingTimeout = null;
      }
      this._sending = false;
      this._aiTyping = false;
    }
  }

  /** Get agents from conversation (prefer agents[], fallback to single agent) */
  private _getAgents(): AgentBrief[] {
    if (this.conversation?.agents && this.conversation.agents.length > 0) {
      return this.conversation.agents;
    }
    if (this.conversation?.agent) {
      return [
        {
          id: this.conversation.agent.id,
          name: this.conversation.agent.name,
          portrait_image_url: this.conversation.agent.portrait_image_url,
        },
      ];
    }
    return [];
  }

  private _getAgentDisplayName(): string {
    const agents = this._getAgents();
    if (agents.length === 0) return msg('Agent');
    if (agents.length === 1) return agents[0].name;
    if (agents.length === 2) return `${agents[0].name}, ${agents[1].name}`;
    return `${agents[0].name}, ${agents[1].name} +${agents.length - 2}`;
  }

  private _toggleEventsBar(): void {
    this._showEventsBar = !this._showEventsBar;
  }

  private _handleAddAgent(): void {
    this.dispatchEvent(
      new CustomEvent('open-agent-selector', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleOpenEventPicker(): void {
    this.dispatchEvent(
      new CustomEvent('open-event-picker', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleRemoveEventRef(ref: ChatEventReference): void {
    this.dispatchEvent(
      new CustomEvent('remove-event-ref', {
        detail: ref,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _renderPinIcon() {
    return svg`
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="square" stroke-linejoin="miter">
        <path d="M9 4v6l-2 4v2h10v-2l-2-4V4" />
        <line x1="12" y1="16" x2="12" y2="21" />
        <line x1="8" y1="4" x2="16" y2="4" />
      </svg>
    `;
  }

  private _renderAddAgentIcon() {
    return svg`
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="square" stroke-linejoin="miter">
        <path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0-8 0" />
        <path d="M6 21v-2a4 4 0 0 1 4-4h3" />
        <line x1="19" y1="14" x2="19" y2="20" />
        <line x1="16" y1="17" x2="22" y2="17" />
      </svg>
    `;
  }

  private _renderPortraitStack(): TemplateResult {
    const agents = this._getAgents();
    const maxVisible = 4;
    const visible = agents.slice(0, maxVisible);
    const overflow = agents.length - maxVisible;

    return html`
      <div class="header__portraits">
        ${visible.map((agent, i) =>
          agent.portrait_image_url
            ? html`<velg-avatar
                .src=${agent.portrait_image_url}
                .name=${agent.name}
                size="sm"
                clickable
                @avatar-click=${(e: CustomEvent) => {
                  this._lightboxSrc = (e.detail as { src: string }).src;
                }}
                style="margin-left: ${i > 0 ? '-8px' : '0'}"
              ></velg-avatar>`
            : html`<velg-avatar
                .name=${agent.name}
                size="sm"
                style="margin-left: ${i > 0 ? '-8px' : '0'}"
              ></velg-avatar>`,
        )}
        ${overflow > 0 ? html`<div class="header__portrait-overflow">+${overflow}</div>` : null}
      </div>
    `;
  }

  private _renderEventsBar(): TemplateResult | null {
    const refs = this.conversation?.event_references ?? [];
    if (!this._showEventsBar) return null;

    if (refs.length === 0) {
      return html`
        <div class="window__events-bar">
          <button class="window__action-btn" @click=${this._handleOpenEventPicker}>
            + ${msg('Add Event')}
          </button>
        </div>
      `;
    }

    return html`
      <div class="window__events-bar">
        ${refs.map(
          (ref) => html`
            <div class="event-card">
              <div class="event-card__header">
                <div class="event-card__title">${ref.event_title}</div>
                <button class="event-card__remove" @click=${() => this._handleRemoveEventRef(ref)}>
                  &times;
                </button>
              </div>
              <div class="event-card__meta">
                ${ref.event_type ?? ''} ${ref.impact_level != null ? `\u00B7 ${ref.impact_level}/10` : ''}
              </div>
            </div>
          `,
        )}
        <button class="window__action-btn" @click=${this._handleOpenEventPicker}>+</button>
      </div>
    `;
  }

  private _renderNoConversation() {
    return html`
      <div class="window__empty">
        <div class="window__empty-title">${msg('Select a Conversation')}</div>
        <div class="window__empty-text">
          ${msg('Choose a conversation from the list or start a new one by selecting an agent.')}
        </div>
      </div>
    `;
  }

  protected render() {
    if (!this.conversation) {
      return this._renderNoConversation();
    }

    const agents = this._getAgents();
    const agentCount = agents.length;
    const displayName = this._getAgentDisplayName();
    const isArchived = this.conversation.status === 'archived';
    const eventRefCount = this.conversation.event_references?.length ?? 0;
    const hasEventsBar = this._showEventsBar;

    // Typing indicator text
    const typingText =
      agentCount > 1
        ? msg(str`${agentCount} agents are responding...`)
        : msg(str`${displayName} is typing...`);

    // Sub info
    const subInfo =
      agentCount > 1
        ? msg(str`${agentCount} agents \u00B7 ${this.conversation.message_count} messages`)
        : msg(str`${this.conversation.message_count} messages`);

    return html`
      <div class="window">
        <div class="window__header">
          <div class="window__header-main">
            <div class="window__header-left">
              ${this._renderPortraitStack()}
              <div class="window__header-info">
                <div class="window__agent-name">${displayName}</div>
                <div class="window__sub-info">
                  ${isArchived ? msg('Archived') : subInfo}
                </div>
              </div>
            </div>
            <div class="window__header-actions">
              <button
                class="window__action-btn ${hasEventsBar ? 'window__action-btn--active' : ''}"
                @click=${this._toggleEventsBar}
                title=${msg('Events')}
              >
                ${this._renderPinIcon()} ${eventRefCount > 0 ? eventRefCount : ''}
              </button>
              <button
                class="window__action-btn"
                @click=${this._handleAddAgent}
                title=${msg('Add Agent')}
              >
                ${this._renderAddAgentIcon()}
              </button>
            </div>
          </div>

          ${this._renderEventsBar()}
        </div>

        ${
          this._loading
            ? html`<div class="window__loading">${msg('Loading messages...')}</div>`
            : html`
              <div class="window__messages">
                <velg-message-list
                  .messages=${this._messages}
                  .agentName=${agents[0]?.name ?? msg('Agent')}
                  .agentPortraitUrl=${agents[0]?.portrait_image_url ?? ''}
                  .agents=${agents}
                  .eventReferences=${this.conversation.event_references ?? []}
                ></velg-message-list>
              </div>
            `
        }

        ${this._sending && !this._aiTyping ? html`<div class="window__sending-indicator">${msg('Sending...')}</div>` : null}

        ${
          this._aiTyping
            ? html`
              <div class="window__typing-indicator">
                <span class="window__typing-label">${typingText}</span>
                <div class="window__typing-bubble">
                  <span class="window__typing-dot"></span>
                  <span class="window__typing-dot"></span>
                  <span class="window__typing-dot"></span>
                </div>
              </div>
            `
            : null
        }

        ${
          appState.isAuthenticated.value
            ? html`
          <velg-message-input
            ?disabled=${this._sending || this._aiTyping || isArchived}
            @send-message=${this._handleSendMessage}
          ></velg-message-input>
        `
            : null
        }
      </div>

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
    'velg-chat-window': VelgChatWindow;
  }
}

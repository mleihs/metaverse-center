import { localized, msg, str } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement, svg, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { chatApi } from '../../services/api/index.js';
import { chatStore } from '../../services/chat/ChatSessionStore.js';
import { streamChatResponse } from '../../services/chat/ChatStreamConsumer.js';
import type { Participant } from '../../services/chat/chat-types.js';
import type {
  AgentBrief,
  ChatConversation,
  ChatEventReference,
  ChatMessage,
} from '../../types/index.js';
import { agentAltText } from '../../utils/text.js';
import { VelgToast } from '../shared/Toast.js';

import '../shared/Lightbox.js';
import '../shared/VelgAvatar.js';
import './core/ChatFeed.js';
import './core/ChatComposer.js';

@localized()
@customElement('velg-chat-window')
export class VelgChatWindow extends SignalWatcher(LitElement) {
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
      overflow: hidden;
      min-height: 0;
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
      font-family: var(--font-body);
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

    @media (max-width: 640px) {
      .window__header-main {
        padding: var(--space-2) var(--space-3);
      }

      .window__agent-name {
        font-size: var(--text-sm);
      }

      .window__events-bar {
        padding: var(--space-2) var(--space-3);
      }

      .event-card {
        min-width: 140px;
        max-width: 200px;
        padding: var(--space-1-5) var(--space-2);
      }

      .window__empty {
        padding: var(--space-4);
        gap: var(--space-3);
      }

      .window__empty-title {
        font-size: var(--text-base);
      }

      .window__empty-text {
        font-size: var(--text-sm);
      }

      .window__sending-indicator {
        padding: var(--space-2) var(--space-3);
      }

      .header__portrait-overflow {
        width: 28px;
        height: 28px;
      }
    }
  `;

  @property({ type: Object }) conversation: ChatConversation | null = null;
  @property({ type: String }) simulationId = '';

  @state() private _messages: ChatMessage[] = [];
  @state() private _loading = false;
  @state() private _sending = false;
  @state() private _showEventsBar = false;
  @state() private _lightboxSrc: string | null = null;
  @state() private _lightboxAlt = '';

  private _previousConversationId: string | null = null;

  protected updated(changedProperties: Map<PropertyKey, unknown>): void {
    if (changedProperties.has('conversation')) {
      const newId = this.conversation?.id ?? null;
      if (newId !== this._previousConversationId) {
        // Abort any active stream from the previous conversation
        this._streamAbort?.abort();
        this._streamAbort = null;
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
      } else {
        VelgToast.error(response.error?.message ?? msg('Failed to load messages.'));
      }
    } catch {
      VelgToast.error(msg('An unexpected error occurred while loading messages.'));
    } finally {
      this._loading = false;
    }
  }

  private _streamAbort: AbortController | null = null;

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._streamAbort?.abort();
    this._streamAbort = null;
  }

  private async _handleSendMessage(e: CustomEvent<{ content: string }>): Promise<void> {
    if (!this.conversation || !this.simulationId || this._sending) return;

    const { content } = e.detail;
    const conversationId = this.conversation.id;
    const session = chatStore.getOrCreate(conversationId);
    this._sending = true;

    // Optimistic: add user message immediately
    const tempId = chatStore.addOptimistic(conversationId, content, conversationId);
    this._messages = [...session.messages.value];

    // Abort any previous stream
    this._streamAbort?.abort();
    this._streamAbort = new AbortController();

    session.streaming.value = true;
    session.streamBuffer.value = '';

    // Track whether the server confirmed the user message (saved to DB).
    // If yes, a non-streaming fallback must NOT re-send the message.
    let userMessageConfirmed = false;

    try {
      await streamChatResponse(this.simulationId, conversationId, content, {
        onUserConfirmed: (confirmedMsg) => {
          userMessageConfirmed = true;
          chatStore.confirmOptimistic(conversationId, tempId, confirmedMsg);
          this._messages = [...session.messages.value];
        },
        onAgentStart: () => {
          session.streamBuffer.value = '';
        },
        onToken: (_agentId, token) => {
          chatStore.appendStreamChunk(conversationId, token);
        },
        onAgentDone: (_agentId, savedMsg) => {
          chatStore.finalizeStream(conversationId, savedMsg);
          this._messages = [...session.messages.value];
          // For group chat: keep streaming for next agent
          session.streaming.value = true;
          session.streamBuffer.value = '';
        },
        onError: (error) => {
          VelgToast.error(error);
        },
        signal: this._streamAbort.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // User navigated away or conversation changed — silent
      } else if (userMessageConfirmed) {
        // Stream broke after user message was saved — reload to show
        // whatever was persisted, do NOT re-send
        VelgToast.error(msg('Connection lost during response. Reloading messages.'));
        await this._loadMessages();
      } else {
        // Stream endpoint not available (404 during deploy) — fall back
        // to non-streaming. The user message was NOT saved yet.
        chatStore.removeOptimistic(conversationId, tempId);
        try {
          const response = await chatApi.sendMessage(this.simulationId, conversationId, {
            content,
            generate_response: true,
          });
          if (response.success) {
            await this._loadMessages();
          } else {
            VelgToast.error(response.error?.message ?? msg('Failed to send message.'));
          }
        } catch {
          VelgToast.error(msg('An unexpected error occurred while sending the message.'));
        }
      }
    } finally {
      this._sending = false;
      session.streaming.value = false;
      session.streamBuffer.value = '';
      this._streamAbort = null;
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

  /** Map agent briefs to ChatFeed's Participant interface. */
  private _buildParticipants(): Participant[] {
    return this._getAgents().map((a) => ({
      id: a.id,
      name: a.name,
      avatarUrl: a.portrait_image_url,
      role: 'agent' as const,
    }));
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
                  this._lightboxAlt = agentAltText(agent);
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

    const agentCount = this._getAgents().length;
    const displayName = this._getAgentDisplayName();
    const isArchived = this.conversation.status === 'archived';
    const eventRefCount = this.conversation.event_references?.length ?? 0;
    const hasEventsBar = this._showEventsBar;

    // Sub info
    const subInfo =
      agentCount > 1
        ? msg(str`${agentCount} agents \u00B7 ${this.conversation.message_count} messages`)
        : msg(str`${this.conversation.message_count} messages`);

    // Streaming state from ChatSessionStore (reactive via SignalWatcher)
    const session = chatStore.getOrCreate(this.conversation.id);
    const participants = this._buildParticipants();

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
                <velg-chat-feed
                  .messages=${this._messages}
                  .participants=${participants}
                  .eventReferences=${this.conversation.event_references ?? []}
                  .currentUserId=${appState.user.value?.id ?? ''}
                  .streaming=${session.streaming.value}
                  .streamContent=${session.streamBuffer.value}
                  .typingUsers=${session.typingUsers.value}
                  .hasMore=${session.hasMore.value}
                  .loading=${this._loading}
                ></velg-chat-feed>
              </div>
            `
        }

        ${this._sending && !session.streaming.value ? html`<div class="window__sending-indicator">${msg('Sending...')}</div>` : null}

        ${
          appState.isAuthenticated.value
            ? html`
          <velg-chat-composer
            ?disabled=${this._sending || session.streaming.value || isArchived}
            @send-message=${this._handleSendMessage}
          ></velg-chat-composer>
        `
            : null
        }
      </div>

      <velg-lightbox
        .src=${this._lightboxSrc}
        .alt=${this._lightboxAlt}
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

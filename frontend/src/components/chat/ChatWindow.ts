import { css, html, LitElement } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { chatApi } from '../../services/api/index.js';
import type { ChatConversation, ChatMessage, PaginatedResponse } from '../../types/index.js';
import { VelgToast } from '../shared/Toast.js';

import './MessageList.js';
import './MessageInput.js';

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
      align-items: center;
      justify-content: space-between;
      padding: var(--space-3) var(--space-4);
      background: var(--color-surface-header);
      border-bottom: var(--border-medium);
      flex-shrink: 0;
    }

    .window__agent-name {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-base);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-primary);
    }

    .window__status {
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
  `;

  @property({ type: Object }) conversation: ChatConversation | null = null;
  @property({ type: String }) simulationId = '';

  @state() private _messages: ChatMessage[] = [];
  @state() private _loading = false;
  @state() private _sending = false;

  @query('.window__messages') private _messagesContainer!: HTMLElement;

  private _previousConversationId: string | null = null;

  protected updated(changedProperties: Map<PropertyKey, unknown>): void {
    if (changedProperties.has('conversation')) {
      const newId = this.conversation?.id ?? null;
      if (newId !== this._previousConversationId) {
        this._previousConversationId = newId;
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
        const paginated = response.data as PaginatedResponse<ChatMessage>;
        this._messages = paginated.data ?? [];
        this._scrollToBottom();
      } else {
        VelgToast.error(response.error?.message ?? 'Failed to load messages.');
      }
    } catch {
      VelgToast.error('An unexpected error occurred while loading messages.');
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

    try {
      const response = await chatApi.sendMessage(this.simulationId, this.conversation.id, {
        content,
      });

      if (response.success && response.data) {
        // The API may return both the user message confirmation and assistant response.
        // Replace the optimistic message and add any new messages.
        // For simplicity, reload all messages to get the latest state.
        await this._loadMessages();
      } else {
        // Remove optimistic message on error
        this._messages = this._messages.filter((m) => m.id !== optimisticMessage.id);
        VelgToast.error(response.error?.message ?? 'Failed to send message.');
      }
    } catch {
      this._messages = this._messages.filter((m) => m.id !== optimisticMessage.id);
      VelgToast.error('An unexpected error occurred while sending the message.');
    } finally {
      this._sending = false;
    }
  }

  private _renderNoConversation() {
    return html`
      <div class="window__empty">
        <div class="window__empty-title">Select a Conversation</div>
        <div class="window__empty-text">
          Choose a conversation from the list or start a new one by selecting an agent.
        </div>
      </div>
    `;
  }

  protected render() {
    if (!this.conversation) {
      return this._renderNoConversation();
    }

    const agentName = this.conversation.agent?.name ?? 'Agent';
    const isArchived = this.conversation.status === 'archived';

    return html`
      <div class="window">
        <div class="window__header">
          <div class="window__agent-name">${agentName}</div>
          <div class="window__status">
            ${isArchived ? 'Archived' : `${this.conversation.message_count} messages`}
          </div>
        </div>

        ${
          this._loading
            ? html`<div class="window__loading">Loading messages...</div>`
            : html`
              <div class="window__messages">
                <velg-message-list
                  .messages=${this._messages}
                  .agentName=${agentName}
                ></velg-message-list>
              </div>
            `
        }

        ${
          this._sending
            ? html`<div class="window__sending-indicator">Agent is responding...</div>`
            : null
        }

        <velg-message-input
          ?disabled=${this._sending || isArchived}
          @send-message=${this._handleSendMessage}
        ></velg-message-input>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-chat-window': VelgChatWindow;
  }
}

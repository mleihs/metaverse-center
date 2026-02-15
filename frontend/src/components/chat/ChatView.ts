import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { chatApi } from '../../services/api/index.js';
import type { Agent, ChatConversation } from '../../types/index.js';
import { VelgToast } from '../shared/Toast.js';

import './ConversationList.js';
import './ChatWindow.js';
import './AgentSelector.js';

@customElement('velg-chat-view')
export class VelgChatView extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .chat-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--space-4);
    }

    .chat-title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-2xl);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      margin: 0;
    }

    .chat-layout {
      display: grid;
      grid-template-columns: 300px 1fr;
      height: calc(100vh - var(--header-height) - 120px);
      min-height: 500px;
      border: var(--border-default);
    }

    .sidebar {
      display: flex;
      flex-direction: column;
      border-right: var(--border-medium);
      overflow: hidden;
    }

    .sidebar__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-3) var(--space-4);
      background: var(--color-surface-header);
      border-bottom: var(--border-medium);
      flex-shrink: 0;
    }

    .sidebar__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-secondary);
    }

    .sidebar__new-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-1-5) var(--space-3);
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      background: var(--color-primary);
      color: var(--color-text-inverse);
      border: var(--border-medium);
      box-shadow: var(--shadow-xs);
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .sidebar__new-btn:hover {
      transform: translate(-1px, -1px);
      box-shadow: var(--shadow-sm);
    }

    .sidebar__new-btn:active {
      transform: translate(0);
      box-shadow: var(--shadow-pressed);
    }

    .sidebar__list {
      flex: 1;
      overflow-y: auto;
    }

    .main-area {
      overflow: hidden;
    }
  `;

  @property({ type: String }) simulationId = '';

  @state() private _conversations: ChatConversation[] = [];
  @state() private _selectedConversation: ChatConversation | null = null;
  @state() private _loading = true;
  @state() private _error: string | null = null;
  @state() private _showAgentSelector = false;

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    await this._loadConversations();
  }

  private async _loadConversations(): Promise<void> {
    if (!this.simulationId) return;

    this._loading = true;
    this._error = null;

    try {
      const response = await chatApi.listConversations(this.simulationId);
      if (response.success && response.data) {
        this._conversations = response.data;
      } else {
        this._error = response.error?.message ?? 'Failed to load conversations.';
      }
    } catch {
      this._error = 'An unexpected error occurred while loading conversations.';
    } finally {
      this._loading = false;
    }
  }

  private _handleConversationSelect(e: CustomEvent<ChatConversation>): void {
    this._selectedConversation = e.detail;
  }

  private async _handleConversationArchive(e: CustomEvent<ChatConversation>): Promise<void> {
    const conversation = e.detail;

    try {
      const response = await chatApi.archiveConversation(this.simulationId, conversation.id);
      if (response.success) {
        VelgToast.success('Conversation archived.');
        // Update the conversation in the list
        this._conversations = this._conversations.map((c) =>
          c.id === conversation.id ? { ...c, status: 'archived' as const } : c,
        );
        // If the archived conversation was selected, deselect it
        if (this._selectedConversation?.id === conversation.id) {
          this._selectedConversation = {
            ...this._selectedConversation,
            status: 'archived',
          };
        }
      } else {
        VelgToast.error(response.error?.message ?? 'Failed to archive conversation.');
      }
    } catch {
      VelgToast.error('An unexpected error occurred while archiving the conversation.');
    }
  }

  private _handleNewConversation(): void {
    this._showAgentSelector = true;
  }

  private async _handleAgentSelected(e: CustomEvent<Agent>): Promise<void> {
    const agent = e.detail;
    this._showAgentSelector = false;

    try {
      const response = await chatApi.createConversation(this.simulationId, {
        agent_id: agent.id,
        title: `Chat with ${agent.name}`,
      });

      if (response.success && response.data) {
        // Add the agent reference to the new conversation for display
        const newConversation: ChatConversation = {
          ...response.data,
          agent,
        };
        this._conversations = [newConversation, ...this._conversations];
        this._selectedConversation = newConversation;
        VelgToast.success(`Conversation started with ${agent.name}.`);
      } else {
        VelgToast.error(response.error?.message ?? 'Failed to create conversation.');
      }
    } catch {
      VelgToast.error('An unexpected error occurred while creating the conversation.');
    }
  }

  private _handleModalClose(): void {
    this._showAgentSelector = false;
  }

  protected render() {
    if (this._loading) {
      return html`
        <div class="chat-header">
          <h1 class="chat-title">Chat</h1>
        </div>
        <velg-loading-state message="Loading conversations..."></velg-loading-state>
      `;
    }

    if (this._error) {
      return html`
        <div class="chat-header">
          <h1 class="chat-title">Chat</h1>
        </div>
        <velg-error-state
          .message=${this._error}
          show-retry
          @retry=${this._loadConversations}
        ></velg-error-state>
      `;
    }

    return html`
      <div class="chat-header">
        <h1 class="chat-title">Chat</h1>
      </div>

      <div class="chat-layout">
        <div class="sidebar">
          <div class="sidebar__header">
            <div class="sidebar__title">Conversations</div>
            <button class="sidebar__new-btn" @click=${this._handleNewConversation}>
              + New
            </button>
          </div>
          <div class="sidebar__list">
            <velg-conversation-list
              .conversations=${this._conversations}
              .selectedId=${this._selectedConversation?.id ?? ''}
              @conversation-select=${this._handleConversationSelect}
              @conversation-archive=${this._handleConversationArchive}
            ></velg-conversation-list>
          </div>
        </div>

        <div class="main-area">
          <velg-chat-window
            .conversation=${this._selectedConversation}
            .simulationId=${this.simulationId}
          ></velg-chat-window>
        </div>
      </div>

      <velg-agent-selector
        .simulationId=${this.simulationId}
        .open=${this._showAgentSelector}
        @agent-selected=${this._handleAgentSelected}
        @modal-close=${this._handleModalClose}
      ></velg-agent-selector>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-chat-view': VelgChatView;
  }
}

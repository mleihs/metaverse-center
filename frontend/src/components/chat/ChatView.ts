import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { chatApi } from '../../services/api/index.js';
import type {
  Agent,
  ChatConversation,
  ChatEventReference,
  Event as SimEvent,
} from '../../types/index.js';
import { VelgConfirmDialog } from '../shared/ConfirmDialog.js';
import { VelgToast } from '../shared/Toast.js';

import './ConversationList.js';
import './ChatWindow.js';
import './AgentSelector.js';
import './EventPicker.js';

@localized()
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
  @state() private _agentSelectorMode: 'create' | 'add' = 'create';
  @state() private _showEventPicker = false;

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
        this._error = response.error?.message ?? msg('Failed to load conversations.');
      }
    } catch {
      this._error = msg('An unexpected error occurred while loading conversations.');
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
        VelgToast.success(msg('Conversation archived.'));
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
        VelgToast.error(response.error?.message ?? msg('Failed to archive conversation.'));
      }
    } catch {
      VelgToast.error(msg('An unexpected error occurred while archiving the conversation.'));
    }
  }

  private async _handleConversationDelete(e: CustomEvent<ChatConversation>): Promise<void> {
    const conversation = e.detail;
    const agentNames = conversation.agents?.map((a) => a.name) ?? [];
    const agentName =
      agentNames.length > 0
        ? agentNames.slice(0, 3).join(', ')
        : (conversation.agent?.name ?? msg('Agent'));

    const confirmed = await VelgConfirmDialog.show({
      title: msg('Delete Conversation'),
      message: msg(
        str`Are you sure you want to permanently delete the conversation with ${agentName}? All messages will be lost.`,
      ),
      confirmLabel: msg('Delete'),
      variant: 'danger',
    });

    if (!confirmed) return;

    try {
      const response = await chatApi.deleteConversation(this.simulationId, conversation.id);
      if (response.success) {
        VelgToast.success(msg('Conversation deleted.'));
        this._conversations = this._conversations.filter((c) => c.id !== conversation.id);
        if (this._selectedConversation?.id === conversation.id) {
          this._selectedConversation = null;
        }
      } else {
        VelgToast.error(response.error?.message ?? msg('Failed to delete conversation.'));
      }
    } catch {
      VelgToast.error(msg('An unexpected error occurred while deleting the conversation.'));
    }
  }

  private _handleNewConversation(): void {
    this._agentSelectorMode = 'create';
    this._showAgentSelector = true;
  }

  private async _handleAgentsSelected(e: CustomEvent<Agent[]>): Promise<void> {
    const agents = e.detail;
    this._showAgentSelector = false;

    if (this._agentSelectorMode === 'add') {
      await this._addAgentsToConversation(agents);
      return;
    }

    // Create new conversation with selected agents
    const agentIds = agents.map((a) => a.id);
    const names = agents.map((a) => a.name);
    const title =
      names.length === 1
        ? msg(str`Chat with ${names[0]}`)
        : msg(
            str`Group: ${names.slice(0, 3).join(', ')}${names.length > 3 ? ` +${names.length - 3}` : ''}`,
          );

    try {
      const response = await chatApi.createConversation(this.simulationId, {
        agent_ids: agentIds,
        title,
      });

      if (response.success && response.data) {
        const agentBriefs = agents.map((a) => ({
          id: a.id,
          name: a.name,
          portrait_image_url: a.portrait_image_url,
        }));
        const newConversation: ChatConversation = {
          ...response.data,
          agents: agentBriefs,
        };
        this._conversations = [newConversation, ...this._conversations];
        this._selectedConversation = newConversation;
        VelgToast.success(
          names.length === 1
            ? msg(str`Conversation started with ${names[0]}.`)
            : msg(str`Group conversation started with ${names.length} agents.`),
        );
      } else {
        VelgToast.error(response.error?.message ?? msg('Failed to create conversation.'));
      }
    } catch {
      VelgToast.error(msg('An unexpected error occurred while creating the conversation.'));
    }
  }

  private async _addAgentsToConversation(agents: Agent[]): Promise<void> {
    if (!this._selectedConversation) return;

    for (const agent of agents) {
      try {
        const response = await chatApi.addAgent(
          this.simulationId,
          this._selectedConversation.id,
          agent.id,
        );
        if (!response.success) {
          VelgToast.error(response.error?.message ?? msg(str`Failed to add ${agent.name}.`));
        }
      } catch {
        VelgToast.error(msg(str`Failed to add ${agent.name}.`));
      }
    }

    // Reload conversations to get updated agent lists
    await this._loadConversations();
    // Re-select the current conversation with updated data
    if (this._selectedConversation) {
      const updated = this._conversations.find(
        (c) => c.id === (this._selectedConversation as ChatConversation).id,
      );
      if (updated) this._selectedConversation = updated;
    }
    VelgToast.success(msg(str`${agents.length} agent(s) added.`));
  }

  private _handleOpenAgentSelector(): void {
    this._agentSelectorMode = 'add';
    this._showAgentSelector = true;
  }

  private _handleOpenEventPicker(): void {
    this._showEventPicker = true;
  }

  private async _handleEventSelected(e: CustomEvent<SimEvent>): Promise<void> {
    if (!this._selectedConversation) return;
    const event = e.detail;
    this._showEventPicker = false;

    try {
      const response = await chatApi.addEventReference(
        this.simulationId,
        this._selectedConversation.id,
        event.id,
      );
      if (response.success && response.data) {
        // Update conversation's event_references locally
        const refs = [...(this._selectedConversation.event_references ?? []), response.data];
        this._selectedConversation = {
          ...this._selectedConversation,
          event_references: refs,
        };
        VelgToast.success(msg(str`Event "${event.title}" referenced.`));
      } else {
        VelgToast.error(response.error?.message ?? msg('Failed to reference event.'));
      }
    } catch {
      VelgToast.error(msg('An unexpected error occurred.'));
    }
  }

  private async _handleRemoveEventRef(e: CustomEvent<ChatEventReference>): Promise<void> {
    if (!this._selectedConversation) return;
    const ref = e.detail;

    try {
      const response = await chatApi.removeEventReference(
        this.simulationId,
        this._selectedConversation.id,
        ref.event_id,
      );
      if (response.success) {
        const refs = (this._selectedConversation.event_references ?? []).filter(
          (r) => r.event_id !== ref.event_id,
        );
        this._selectedConversation = {
          ...this._selectedConversation,
          event_references: refs,
        };
      } else {
        VelgToast.error(response.error?.message ?? msg('Failed to remove event reference.'));
      }
    } catch {
      VelgToast.error(msg('An unexpected error occurred.'));
    }
  }

  private _handleModalClose(): void {
    this._showAgentSelector = false;
    this._showEventPicker = false;
  }

  protected render() {
    if (this._loading) {
      return html`
        <div class="chat-header">
          <h1 class="chat-title">${msg('Chat')}</h1>
        </div>
        <velg-loading-state message=${msg('Loading conversations...')}></velg-loading-state>
      `;
    }

    if (this._error) {
      return html`
        <div class="chat-header">
          <h1 class="chat-title">${msg('Chat')}</h1>
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
        <h1 class="chat-title">${msg('Chat')}</h1>
      </div>

      <div class="chat-layout">
        <div class="sidebar">
          <div class="sidebar__header">
            <div class="sidebar__title">${msg('Conversations')}</div>
            <button class="sidebar__new-btn" @click=${this._handleNewConversation}>
              ${msg('+ New')}
            </button>
          </div>
          <div class="sidebar__list">
            <velg-conversation-list
              .conversations=${this._conversations}
              .selectedId=${this._selectedConversation?.id ?? ''}
              @conversation-select=${this._handleConversationSelect}
              @conversation-archive=${this._handleConversationArchive}
              @conversation-delete=${this._handleConversationDelete}
            ></velg-conversation-list>
          </div>
        </div>

        <div class="main-area"
          @open-agent-selector=${this._handleOpenAgentSelector}
          @open-event-picker=${this._handleOpenEventPicker}
          @remove-event-ref=${this._handleRemoveEventRef}
        >
          <velg-chat-window
            .conversation=${this._selectedConversation}
            .simulationId=${this.simulationId}
          ></velg-chat-window>
        </div>
      </div>

      <velg-agent-selector
        .simulationId=${this.simulationId}
        .open=${this._showAgentSelector}
        .mode=${this._agentSelectorMode}
        .excludeAgentIds=${this._selectedConversation?.agents?.map((a) => a.id) ?? []}
        @agents-selected=${this._handleAgentsSelected}
        @modal-close=${this._handleModalClose}
      ></velg-agent-selector>

      <velg-event-picker
        .simulationId=${this.simulationId}
        .open=${this._showEventPicker}
        .referencedEventIds=${this._selectedConversation?.event_references?.map((r) => r.event_id) ?? []}
        @event-selected=${this._handleEventSelected}
        @modal-close=${this._handleModalClose}
      ></velg-event-picker>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-chat-view': VelgChatView;
  }
}

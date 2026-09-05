import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { chatApi } from '../../services/api/index.js';
import { chatLock } from '../../services/chat/ChatLockService.js';
import { captureError } from '../../services/SentryService.js';
import type {
  Agent,
  ChatConversation,
  ChatEventReference,
  ConversationContinueHours,
  ConversationNotifyMode,
  Event as SimEvent,
} from '../../types/index.js';
import { VelgConfirmDialog } from '../shared/ConfirmDialog.js';
import { VelgToast } from '../shared/Toast.js';

import { type ChatLockFailure, lockFailureFrom } from './ChatLockModal.js';
import './ChatLockModal.js';
import './ConversationList.js';
import './ChatWindow.js';
import './AgentSelector.js';
import './EventPicker.js';

@localized()
@customElement('velg-chat-view')
export class VelgChatView extends LitElement {
  static styles = css`
    :host {
      /* Das EINE Kopfmass beider Spalten.
       *
       * Links die Gespraechsliste, rechts der Kopf der Unterhaltung — sie
       * standen auf verschiedenen Hoehen, weil jede ihre eigene aus ihrem
       * Inhalt bezog. Hier steht sie einmal, und beide Schattenwurzeln erben
       * sie: Custom Properties gehen durch die Schattengrenze.
       *
       * Zusammengesetzt statt geraten: Innenabstand oben und unten
       * (--space-3), das Portraet dazwischen (32 px) und die trennende Kante.
       * Wer eines davon aendert, bekommt die neue Hoehe geschenkt. */
      --chat-header-h: calc(var(--space-3) * 2 + 32px + var(--border-width-default));
      display: block;
      overflow: hidden;
      max-width: 100vw;
    }

    .chat-layout {
      display: grid;
      /* Sidebar scales with viewport: 280px minimum, 22vw fluid, 380px cap */
      grid-template-columns: clamp(280px, 22vw, 380px) 1fr;
      height: calc(100vh - var(--header-height) - 180px);
      height: calc(100dvh - var(--header-height) - 180px);
      min-height: 500px;
      border: var(--border-default);
      box-shadow: var(--shadow-sm);
      animation: layout-enter var(--duration-entrance, 350ms) var(--ease-dramatic) both;
    }

    @keyframes layout-enter {
      from { opacity: 0; }
    }

    @media (prefers-reduced-motion: reduce) {
      .chat-layout { animation-duration: 0.01ms !important; }
    }

    .sidebar {
      display: flex;
      flex-direction: column;
      border-right: var(--border-medium);
      overflow: hidden;
    }






    .sidebar__list {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
    }

    .main-area {
      overflow: hidden;
    }

    .sign-in-banner {
      padding: var(--space-3) var(--space-4);
      background: var(--color-info-bg);
      border-bottom: 1px solid var(--color-info-border);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
      text-align: center;
    }

    .sign-in-banner a {
      color: var(--color-text-link);
      text-decoration: underline;
      cursor: pointer;
      font-weight: var(--font-bold);
    }

    /* ── Mobile back button ─────────────────────────── */

    .mobile-back {
      display: none;
    }

    /* === Mobile: screen-swap sidebar ↔ chat === */

    @media (max-width: 640px) {
      .chat-layout {
        grid-template-columns: 1fr;
        height: calc(100vh - var(--header-height) - 196px);
        height: calc(100dvh - var(--header-height) - 196px);
        min-height: 0;
      }

      /* Show sidebar full-height when no conversation is selected */
      .sidebar {
        border-right: none;
        max-height: none;
      }

      .sidebar__list {
        max-height: none;
      }

      /* Screen-swap: when a conversation is selected, hide sidebar, show chat */
      .chat-layout--has-conversation .sidebar {
        display: none;
      }

      .chat-layout:not(.chat-layout--has-conversation) .main-area {
        display: none;
      }

      /* Back button visible on mobile in chat view */
      .mobile-back {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-2) var(--space-3);
        background: var(--color-surface-header);
        border: none;
        border-bottom: var(--border-light);
        color: var(--color-text-secondary);
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: var(--text-xs);
        text-transform: var(--label-transform);
        letter-spacing: var(--tracking-brutalist);
        cursor: pointer;
        width: 100%;
        flex-shrink: 0;
        transition: color var(--transition-fast);
      }

      .mobile-back:hover {
        color: var(--color-text-primary);
      }

      .main-area {
        min-height: 0;
      }
    }
  `;

  @property({ type: String }) simulationId = '';

  @state() private _lockModalOpen = false;
  @state() private _lockPurpose: 'lock' | 'unlock' | 'reveal' = 'lock';
  @state() private _lockTarget: ChatConversation | null = null;
  @state() private _lockFailure: ChatLockFailure = '';
  @state() private _lockBusy = false;

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

  protected willUpdate(changedProperties: Map<PropertyKey, unknown>): void {
    if (changedProperties.has('simulationId') && this.simulationId) {
      this._loadConversations();
    }
  }

  private async _loadConversations(): Promise<void> {
    if (!this.simulationId) return;

    this._loading = true;
    this._error = null;

    try {
      const response = await chatApi.listConversations(
        this.simulationId,
        appState.currentSimulationMode.value,
      );
      if (response.success && response.data) {
        this._conversations = response.data;
      } else {
        this._error = response.error?.message ?? msg('Failed to load conversations.');
      }
    } catch (err) {
      captureError(err, { source: 'ChatView._loadConversations' });
      this._error = msg('An unexpected error occurred while loading conversations.');
    } finally {
      this._loading = false;
    }
  }

  private _handleConversationSelect(e: CustomEvent<ChatConversation>): void {
    this._selectedConversation = e.detail;
  }

  private _handleConversationArchive(e: CustomEvent<ChatConversation>): Promise<void> {
    return this._setConversationStatus(e.detail, 'archived');
  }

  private _handleConversationUnarchive(e: CustomEvent<ChatConversation>): Promise<void> {
    return this._setConversationStatus(e.detail, 'active');
  }

  /**
   * Beiseitelegen und Hervorholen sind dieselbe Handlung in zwei Richtungen.
   *
   * Sie stand vorher nur in einer, und zwar auf der ganzen Strecke: kein
   * Dienst, keine Route, kein Knopf. Wer versehentlich archivierte, dem bot
   * die Liste an dem Gespraech nur noch das Loeschen an — auf „das wollte ich
   * nicht" antwortete die Anwendung mit „dann zerstoere es".
   *
   * KEINE Rueckfrage, mit Absicht: eine Handlung, die sich mit einem Klick
   * zuruecknehmen laesst, braucht keine. Bewacht gehoert, was NICHT
   * umkehrbar ist — und das ist hier das Loeschen, das seine Rueckfrage schon
   * hat. Die Umkehrbarkeit ist der bessere Schutz als die Nachfrage.
   */
  private async _setConversationStatus(
    conversation: ChatConversation,
    status: 'active' | 'archived',
  ): Promise<void> {
    try {
      const response = await chatApi.setConversationStatus(
        this.simulationId,
        conversation.id,
        status,
      );
      if (response.success) {
        VelgToast.success(
          status === 'archived' ? msg('Conversation archived.') : msg('Conversation back in the file.'),
        );
        this._conversations = this._conversations.map((c) =>
          c.id === conversation.id ? { ...c, status } : c,
        );
        if (this._selectedConversation?.id === conversation.id) {
          this._selectedConversation = { ...this._selectedConversation, status };
        }
      } else {
        VelgToast.error(
          response.error?.message ??
            (status === 'archived'
              ? msg('Failed to archive conversation.')
              : msg('The conversation could not be brought back.')),
        );
      }
    } catch (err) {
      captureError(err, { source: 'ChatView._setConversationStatus' });
      VelgToast.error(msg('An unexpected error occurred while filing the conversation.'));
    }
  }

  private async _handleConversationRename(
    e: CustomEvent<{ conversation: ChatConversation; title: string }>,
  ): Promise<void> {
    const { conversation, title } = e.detail;

    try {
      const response = await chatApi.renameConversation(this.simulationId, conversation.id, title);
      if (response.success) {
        // Update the conversation in the list
        this._conversations = this._conversations.map((c) =>
          c.id === conversation.id ? { ...c, title } : c,
        );
        // Update selected if it's the same conversation
        if (this._selectedConversation?.id === conversation.id) {
          this._selectedConversation = { ...this._selectedConversation, title };
        }
      } else {
        VelgToast.error(response.error?.message ?? msg('Failed to rename conversation.'));
      }
    } catch (err) {
      captureError(err, { source: 'ChatView._handleConversationRename' });
      VelgToast.error(msg('An unexpected error occurred while renaming the conversation.'));
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
    } catch (err) {
      captureError(err, { source: 'ChatView._handleConversationDelete' });
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
        ? names[0]
        : names.length === 2
          ? `${names[0]}, ${names[1]}`
          : `${names[0]}, ${names[1]} +${names.length - 2}`;

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
    } catch (err) {
      captureError(err, { source: 'ChatView._handleAgentsSelected' });
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
      } catch (err) {
        captureError(err, {
          source: 'ChatView._addAgentsToConversation',
          agentName: agent.name,
        });
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
    } catch (err) {
      captureError(err, { source: 'ChatView._handleEventSelected' });
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
    } catch (err) {
      captureError(err, { source: 'ChatView._handleRemoveEventRef' });
      VelgToast.error(msg('An unexpected error occurred.'));
    }
  }

  private _handleModalClose(): void {
    this._showAgentSelector = false;
    this._showEventPicker = false;
  }

  // ── Verschluss ───────────────────────────────────────────────────────

  private _handleLockRequest(
    e: CustomEvent<{
      conversation: ChatConversation | null;
      purpose: 'lock' | 'unlock' | 'reveal';
    }>,
  ): void {
    this._lockPurpose = e.detail.purpose;
    this._lockTarget = e.detail.conversation;
    this._lockFailure = '';
    this._lockModalOpen = true;
  }

  private _closeLockModal(): void {
    this._lockModalOpen = false;
    this._lockFailure = '';
    this._lockTarget = null;
  }

  private async _handleLockSubmit(
    e: CustomEvent<{ purpose: 'lock' | 'unlock' | 'reveal'; password: string }>,
  ): Promise<void> {
    const { purpose, password } = e.detail;
    this._lockBusy = true;
    this._lockFailure = '';
    try {
      if (purpose === 'reveal') {
        const resp = await chatApi.reauth(password);
        if (!resp.success || !resp.data) {
          this._lockFailure = lockFailureFrom(resp.error);
          return;
        }
        chatLock.grant(resp.data.valid_for_seconds);
        this._closeLockModal();
        return;
      }

      const target = this._lockTarget;
      if (!target) {
        this._closeLockModal();
        return;
      }
      const resp = await chatApi.setConversationLock(
        this.simulationId,
        target.id,
        purpose === 'lock',
        password,
      );
      if (!resp.success) {
        this._lockFailure = lockFailureFrom(resp.error);
        return;
      }
      // Den Bestand vor Ort nachziehen statt neu zu laden: die Liste soll in
      // derselben Bewegung verschwinden, in der das Modal schliesst.
      this._conversations = this._conversations.map((c) =>
        c.id === target.id ? { ...c, locked: purpose === 'lock' } : c,
      );
      if (purpose === 'lock' && this._selectedConversation?.id === target.id) {
        // Ein verschlossenes Gespraech darf nicht offen stehen bleiben.
        this._selectedConversation = this._conversations.find((c) => !c.locked) ?? null;
      }
      this._closeLockModal();
    } catch (err) {
      captureError(err, { source: 'ChatView._handleLockSubmit' });
      this._lockFailure = 'error';
    } finally {
      this._lockBusy = false;
    }
  }

  /**
   * Der Faden hat seine Fortsetzungs-Einstellung geaendert.
   *
   * Das Fenster schreibt sie schon optimistisch in SEINE Kopie; hier wird die
   * Liste nachgezogen. Ohne das faellt der Stand beim naechsten Wechsel des
   * Gespraechs zurueck — die Liste ist die Quelle, aus der `.conversation`
   * neu gesetzt wird, und eine Kopie, die den neueren Wert nicht kennt,
   * ueberschreibt ihn stillschweigend.
   *
   * Derselbe Weg wie beim Verschluss (`_handleLockSubmit`): vor Ort nachziehen
   * statt neu zu laden.
   */
  private _handleContinuationChanged(
    e: CustomEvent<{
      conversationId: string;
      continues_without_user: boolean;
      notify: ConversationNotifyMode;
      interval_hours: ConversationContinueHours;
    }>,
  ): void {
    const { conversationId, continues_without_user, notify, interval_hours } = e.detail;
    this._conversations = this._conversations.map((c) =>
      c.id === conversationId
        ? {
            ...c,
            continues_without_user,
            continue_notify: notify,
            continue_interval_hours: interval_hours,
          }
        : c,
    );
    if (this._selectedConversation?.id === conversationId) {
      this._selectedConversation = {
        ...this._selectedConversation,
        continues_without_user,
        continue_notify: notify,
        continue_interval_hours: interval_hours,
      };
    }
  }

  protected render() {
    if (this._loading) {
      return html`
        <velg-loading-state message=${msg('Loading conversations...')}></velg-loading-state>
      `;
    }

    if (this._error) {
      return html`
        <velg-error-state
          .message=${this._error}
          show-retry
          @retry=${this._loadConversations}
        ></velg-error-state>
      `;
    }

    return html`
      <div class="chat-layout ${this._selectedConversation ? 'chat-layout--has-conversation' : ''}">
        <div class="sidebar" role="complementary" aria-label=${msg('Conversation list')}>
          ${
            !appState.isAuthenticated.value
              ? html`
            <div class="sign-in-banner">
              ${msg('Sign in to start conversations and chat with agents')}
            </div>
          `
              : null
          }
          <div class="sidebar__list">
            <velg-conversation-list
              .conversations=${this._conversations}
              .selectedId=${this._selectedConversation?.id ?? ''}
              ?readonly=${!appState.isAuthenticated.value}
              @conversation-select=${this._handleConversationSelect}
              @conversation-archive=${this._handleConversationArchive}
              @conversation-unarchive=${this._handleConversationUnarchive}
              @conversation-delete=${this._handleConversationDelete}
              @conversation-rename=${this._handleConversationRename}
              @conversation-new=${this._handleNewConversation}
              @conversation-lock-request=${this._handleLockRequest}
            ></velg-conversation-list>
          </div>
        </div>

        <div class="main-area" role="main" aria-label=${msg('Chat')}
          @open-agent-selector=${this._handleOpenAgentSelector}
          @conversation-lock-request=${this._handleLockRequest}
          @conversation-continuation-changed=${this._handleContinuationChanged}
          @open-event-picker=${this._handleOpenEventPicker}
          @remove-event-ref=${this._handleRemoveEventRef}
        >
          <button
            class="mobile-back"
            @click=${() => {
              this._selectedConversation = null;
            }}
            aria-label=${msg('Back to conversations')}
          >\u2190 ${msg('Conversations')}</button>
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

      <velg-chat-lock-modal
        ?open=${this._lockModalOpen}
        .purpose=${this._lockPurpose}
        .conversationTitle=${this._lockTarget?.title ?? ''}
        .failure=${this._lockFailure}
        ?busy=${this._lockBusy}
        @lock-submit=${this._handleLockSubmit}
        @lock-cancel=${this._closeLockModal}
      ></velg-chat-lock-modal>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-chat-view': VelgChatView;
  }
}

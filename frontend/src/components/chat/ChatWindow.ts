import { localized, msg, str } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { appState } from '../../services/AppStateManager.js';
import { agentAutonomyApi, agentsApi, chatApi } from '../../services/api/index.js';
import { chatAudio } from '../../services/ChatAudioService.js';
import {
  exportJSON as exportChatJSON,
  exportMarkdown as exportChatMarkdown,
} from '../../services/chat/ChatExporter.js';
import { chatStore } from '../../services/chat/ChatSessionStore.js';
import { streamChatResponse, streamRegenerate } from '../../services/chat/ChatStreamConsumer.js';
import type { Participant } from '../../services/chat/chat-types.js';
import { realtimeService } from '../../services/realtime/RealtimeService.js';
import { captureError } from '../../services/SentryService.js';
import type { Agent, AgentBrief, ChatConversation, ChatEventReference } from '../../types/index.js';
import { agentAccentColor } from '../../utils/agent-colors.js';
import { icons } from '../../utils/icons.js';
import { VelgToast } from '../shared/Toast.js';

import '../agents/AgentDetailsPanel.js';
import '../shared/EmptyState.js';
import '../shared/LoadingState.js';
import '../shared/VelgAgentTip.js';
import '../shared/VelgAvatar.js';
import '../shared/VelgTooltip.js';
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
      box-shadow: var(--shadow-xs);
      flex-shrink: 0;
      z-index: 1;
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

    /* Portrait stack — spaced for border visibility on dark theme */
    .header__portraits {
      display: flex;
      flex-shrink: 0;
      gap: var(--space-2);
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

    .window__action-btn:focus-visible {
      outline: none;
      box-shadow: var(--ring-focus);
    }

    .window__action-btn--active {
      background: var(--color-primary-bg);
      border-color: var(--color-primary);
      color: var(--color-primary);
    }

    .window__action-btn svg {
      flex-shrink: 0;
    }

    /* Event reference bar — always rendered, toggled via max-height */
    .window__events-bar {
      display: flex;
      gap: var(--space-2);
      padding: 0 var(--space-4);
      overflow: hidden;
      border-top: var(--border-light);
      background: var(--color-surface-sunken);
      max-height: 0;
      opacity: 0;
      transition:
        max-height var(--transition-normal, 250ms) var(--ease-out, ease-out),
        opacity var(--transition-fast, 150ms) var(--ease-out, ease-out),
        padding var(--transition-normal, 250ms) var(--ease-out, ease-out);
    }

    .window__events-bar--open {
      max-height: 120px;
      opacity: 1;
      padding: var(--space-2) var(--space-4);
      overflow-x: auto;
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
      display: flex;
      flex-direction: column;
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

    /* ── Export menu ─────────────────────────────────── */

    .export-wrapper {
      position: relative;
    }

    .export-menu {
      position: absolute;
      top: 100%;
      right: 0;
      margin-top: var(--space-1);
      background: var(--color-surface-raised);
      border: var(--border-medium);
      box-shadow: var(--shadow-md);
      z-index: 10;
      min-width: 140px;
      display: flex;
      flex-direction: column;
      animation: export-menu-enter 150ms var(--ease-out, ease-out) both;
    }

    @keyframes export-menu-enter {
      from { opacity: 0; transform: translateY(-4px); }
    }

    .export-menu__item {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-secondary);
      background: transparent;
      border: none;
      cursor: pointer;
      width: 100%;
      text-align: left;
      transition: all var(--transition-fast);
    }

    .export-menu__item:hover {
      background: var(--color-surface-sunken);
      color: var(--color-text-primary);
    }

    @media (max-width: 640px) {
      .window__header-main {
        padding: var(--space-2) var(--space-3);
      }

      .window__agent-name {
        font-size: var(--text-sm);
      }

      .window__events-bar--open {
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

    @media (max-width: 400px) {
      .window__header-actions {
        gap: var(--space-1);
      }

      .window__action-btn {
        padding: var(--space-1);
        min-width: 28px;
        min-height: 28px;
        justify-content: center;
      }
    }
  `;

  @property({ type: Object }) conversation: ChatConversation | null = null;
  @property({ type: String }) simulationId = '';

  @state() private _loading = false;
  @state() private _sending = false;
  @state() private _showEventsBar = false;
  @state() private _detailAgent: Agent | null = null;
  @state() private _streamingAgentId = '';
  @state() private _restoredDraft = '';
  @state() private _starters: string[] = [];

  /** Cached agent moods — fetched on conversation init, keyed by agent ID. */
  private _agentMoods = new Map<string, { score: number; emotion: string }>();
  /** Memoized participants — rebuilt only when conversation agents or moods change. */
  private _cachedParticipants: Participant[] = [];
  private _cachedParticipantKey = '';
  private _previousConversationId: string | null = null;

  protected updated(changedProperties: Map<PropertyKey, unknown>): void {
    if (changedProperties.has('conversation')) {
      const newId = this.conversation?.id ?? null;
      if (newId !== this._previousConversationId) {
        // Abort any active stream from the previous conversation
        this._streamAbort?.abort();
        this._streamAbort = null;

        // Leave previous conversation's realtime channels
        if (this._previousConversationId) {
          realtimeService.leaveConversation();
        }

        this._previousConversationId = newId;
        this._showEventsBar = false;
        this._restoredDraft = newId ? chatStore.restoreDraft(newId) : '';
        // Track active session for LRU eviction
        chatStore.setActive(newId);
        if (newId) {
          this._initConversation(newId);
        }
      }
    }
  }

  /**
   * Load messages via REST first, then join realtime channel with replay.
   * Order matters: REST load captures current state, replay catches the gap
   * between REST response and channel subscription.
   */
  private async _initConversation(conversationId: string): Promise<void> {
    // Load messages and agent moods in parallel
    this._starters = [];
    await Promise.all([this._loadMessages(), this._fetchAgentMoods()]);
    // Guard: conversation may have changed during async load
    if (this._previousConversationId !== conversationId) return;
    // Derive replay timestamp from latest loaded message
    const session = chatStore.getOrCreate(conversationId);
    const msgs = session.messages.value;
    // Fetch starters for empty conversations (non-blocking)
    if (msgs.length === 0) {
      this._fetchStarters(conversationId);
    }
    const latestTs =
      msgs.length > 0 ? new Date(msgs[msgs.length - 1].created_at).getTime() : Date.now();
    realtimeService.joinConversation(conversationId, latestTs, (messageId) => {
      this._handleRealtimeReactionChanged(conversationId, messageId);
    });
  }

  /** Fetch contextual conversation starters for the empty state (non-blocking). */
  private async _fetchStarters(conversationId: string): Promise<void> {
    if (!this.simulationId) return;
    try {
      const locale = document.documentElement.lang || 'de';
      const response = await chatApi.getStarters(this.simulationId, conversationId, locale);
      // Guard: conversation may have changed during fetch
      if (this._previousConversationId !== conversationId) return;
      if (response.success && Array.isArray(response.data)) {
        this._starters = response.data;
      }
    } catch (err) {
      captureError(err, { source: 'ChatWindow._fetchStarters' });
    }
  }

  /** Fetch mood data for all agents in this conversation (parallel, non-blocking). */
  private async _fetchAgentMoods(): Promise<void> {
    if (!this.simulationId) return;
    const agents = this._getAgents();
    if (agents.length === 0) return;

    const results = await Promise.allSettled(
      agents.map((a) => agentAutonomyApi.getAgentMood(this.simulationId, a.id)),
    );
    this._agentMoods.clear();
    results.forEach((r, i) => {
      if (r.status === 'fulfilled' && r.value?.data) {
        this._agentMoods.set(agents[i].id, {
          score: r.value.data.mood_score,
          emotion: r.value.data.dominant_emotion,
        });
      }
    });
    // Trigger re-render so participants get updated mood data
    this.requestUpdate();
  }

  /**
   * Handle realtime reaction_changed broadcast from DB trigger 180.
   * Fetches fresh reaction summaries and updates the store.
   */
  private async _handleRealtimeReactionChanged(
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    if (!this.simulationId || this.conversation?.id !== conversationId) return;
    try {
      const response = await chatApi.getReactions(this.simulationId, conversationId, messageId);
      if (response.success && response.data) {
        chatStore.updateMessageReactions(conversationId, messageId, response.data);
      }
    } catch (err) {
      // Reaction display will catch up on next interaction — fetch is
      // fire-and-forget from a realtime broadcast.
      captureError(err, { source: 'ChatWindow._handleRealtimeReactionChanged' });
    }
  }

  private async _loadMessages(): Promise<void> {
    if (!this.conversation || !this.simulationId) return;
    const conversationId = this.conversation.id;

    this._loading = true;
    chatStore.setMessages(conversationId, []);

    try {
      const response = await chatApi.getMessages(
        this.simulationId,
        conversationId,
        appState.currentSimulationMode.value,
        { page_size: '100' },
      );

      if (response.success && response.data) {
        const messages = Array.isArray(response.data) ? response.data : [];
        chatStore.setMessages(conversationId, messages);
      } else {
        VelgToast.error(response.error?.message ?? msg('Failed to load messages.'));
      }
    } catch (err) {
      captureError(err, { source: 'ChatWindow._loadMessages' });
      VelgToast.error(msg('An unexpected error occurred while loading messages.'));
    } finally {
      this._loading = false;
    }
  }

  private _streamAbort: AbortController | null = null;

  private _closeExportMenuBound = () => {
    this._showExportMenu = false;
  };
  private _closeExportMenuOnEscapeBound = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this._showExportMenu) {
      this._showExportMenu = false;
    }
  };

  override connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('click', this._closeExportMenuBound);
    document.addEventListener('keydown', this._closeExportMenuOnEscapeBound);
  }

  override disconnectedCallback(): void {
    document.removeEventListener('click', this._closeExportMenuBound);
    document.removeEventListener('keydown', this._closeExportMenuOnEscapeBound);
    super.disconnectedCallback();
    this._streamAbort?.abort();
    this._streamAbort = null;
    realtimeService.leaveConversation();
  }

  private async _handleSendMessage(e: CustomEvent<{ content: string }>): Promise<void> {
    if (!this.conversation || !this.simulationId || this._sending || this._loading) return;

    const { content } = e.detail;
    const conversationId = this.conversation.id;
    const session = chatStore.getOrCreate(conversationId);
    this._sending = true;

    // Clear typing indicator for this user immediately
    const user = appState.user.value;
    if (user) {
      realtimeService.broadcastStopTyping(user.id);
    }

    // Clear draft immediately on send
    chatStore.clearDraft(conversationId);

    // Optimistic: add user message immediately (SignalWatcher triggers re-render)
    const tempId = chatStore.addOptimistic(conversationId, content, conversationId);
    chatAudio.play('message-sent');

    // Abort any previous stream
    this._streamAbort?.abort();
    this._streamAbort = new AbortController();

    session.streaming.value = true;
    session.streamBuffer.value = '';

    // Track whether the server confirmed the user message (saved to DB).
    // If yes, a non-streaming fallback must NOT re-send the message.
    let userMessageConfirmed = false;
    const cbs = this._streamCallbacks(conversationId, session);

    try {
      await streamChatResponse(this.simulationId, conversationId, content, {
        onUserConfirmed: (confirmedMsg) => {
          userMessageConfirmed = true;
          chatStore.confirmOptimistic(conversationId, tempId, confirmedMsg);
        },
        ...cbs,
        signal: this._streamAbort.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // User navigated away or conversation changed — silent
      } else if (userMessageConfirmed) {
        // Stream broke after user message was saved — reload to show
        // whatever was persisted, do NOT re-send
        VelgToast.error(msg('Connection lost during response. Reloading messages.'));
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
        } catch (fallbackErr) {
          captureError(fallbackErr, { source: 'ChatWindow._handleSendMessage.nonStreamFallback' });
          VelgToast.error(msg('An unexpected error occurred while sending the message.'));
        }
      }
    } finally {
      this._sending = false;
      this._streamingAgentId = '';
      session.streaming.value = false;
      session.streamBuffer.value = '';
      this._streamAbort = null;

      // Stream complete sound — only on success, not on error/abort
      if (!cbs.hadError && userMessageConfirmed) {
        chatAudio.play('stream-complete');
      }

      // After any stream error, reload messages from DB to reflect actual state.
      // Guard: only reload if the conversation hasn't changed during the stream.
      if (cbs.hadError && userMessageConfirmed && this._previousConversationId === conversationId) {
        await this._loadMessages();
      }
    }
  }

  private async _handleRegenerate(): Promise<void> {
    if (!this.conversation || !this.simulationId || this._sending) return;

    const conversationId = this.conversation.id;
    const session = chatStore.getOrCreate(conversationId);

    this._sending = true;
    this._streamAbort?.abort();
    this._streamAbort = new AbortController();
    session.streaming.value = true;
    session.streamBuffer.value = '';

    try {
      await streamRegenerate(this.simulationId, conversationId, {
        ...this._streamCallbacks(conversationId, session),
        signal: this._streamAbort.signal,
      });
    } catch (err) {
      if (!(err instanceof Error && err.name === 'AbortError')) {
        VelgToast.error(msg('Failed to regenerate response.'));
      }
    } finally {
      this._sending = false;
      this._streamingAgentId = '';
      session.streaming.value = false;
      session.streamBuffer.value = '';
      this._streamAbort = null;
      await this._loadMessages();
    }
  }

  /** Shared streaming callbacks for send + regenerate flows.
   *  All callbacks are guarded against stale conversation (user switched away mid-stream). */
  private _streamCallbacks(
    conversationId: string,
    session: ReturnType<typeof chatStore.getOrCreate>,
  ) {
    let errorOccurred = false;
    const isStale = () => this._previousConversationId !== conversationId;
    return {
      onAgentStart: (agentId: string) => {
        if (isStale()) return;
        this._streamingAgentId = agentId;
        session.streaming.value = true;
        session.streamBuffer.value = '';
        chatAudio.play('typing-start');
      },
      onToken: (_agentId: string, token: string) => {
        if (isStale()) return;
        chatStore.appendStreamChunk(conversationId, token);
      },
      onAgentDone: (_agentId: string, savedMsg: import('../../types/index.js').ChatMessage) => {
        if (isStale()) return;
        if (!savedMsg?.id || !savedMsg.content?.trim()) {
          session.streaming.value = false;
          session.streamBuffer.value = '';
          return;
        }
        chatStore.finalizeStream(conversationId, savedMsg);
        // streaming stays false after finalizeStream — onAgentStart
        // re-enables it for the next agent in group chat.
        if (document.hidden) chatAudio.play('message-received');
      },
      onError: (error: string) => {
        errorOccurred = true;
        if (!isStale()) {
          // Clear streaming state immediately to remove ghost bubble.
          // For group chat: next agent's onAgentStart re-enables streaming.
          session.streaming.value = false;
          session.streamBuffer.value = '';
          VelgToast.error(error);
        }
      },
      get hadError() {
        return errorOccurred;
      },
    };
  }

  private _handleDraftChange(e: CustomEvent<{ content: string }>): void {
    if (!this.conversation) return;
    chatStore.saveDraft(this.conversation.id, e.detail.content);
  }

  private _handleComposerTyping(): void {
    if (!this.conversation) return;
    const user = appState.user.value;
    if (!user) return;
    realtimeService.broadcastTyping(
      this.conversation.id,
      user.id,
      user.user_metadata?.display_name ?? user.email ?? 'User',
    );
  }

  private async _handleLoadOlder(): Promise<void> {
    if (!this.conversation || !this.simulationId) return;
    const convId = this.conversation.id;
    await chatStore.loadOlder(convId, async (before) => {
      const response = await chatApi.getMessages(
        this.simulationId,
        convId,
        appState.currentSimulationMode.value,
        { page_size: '50', before },
      );
      if (response.success && Array.isArray(response.data)) {
        return response.data;
      }
      return [];
    });
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

  /** Map agent briefs to ChatFeed's Participant interface with accent colors + mood.
   *  Memoized — returns same array reference if inputs haven't changed. */
  private _buildParticipants(): Participant[] {
    // Build a cache key from agent IDs + mood scores (cheapest change detection)
    const agents = this._getAgents();
    const key = agents
      .map((a) => {
        const m = this._agentMoods.get(a.id);
        return `${a.id}:${m?.score ?? ''}`;
      })
      .join(',');

    if (key === this._cachedParticipantKey) return this._cachedParticipants;

    this._cachedParticipantKey = key;
    this._cachedParticipants = agents.map((a) => {
      const mood = this._agentMoods.get(a.id);
      return {
        id: a.id,
        name: a.name,
        avatarUrl: a.portrait_image_url,
        accentColor: agentAccentColor(a.id),
        moodScore: mood?.score,
        moodEmotion: mood?.emotion,
        role: 'agent' as const,
      };
    });
    return this._cachedParticipants;
  }

  private _getAgentDisplayName(): string {
    const agents = this._getAgents();
    if (agents.length === 0) return msg('Agent');
    if (agents.length === 1) return agents[0].name;
    if (agents.length === 2) return `${agents[0].name}, ${agents[1].name}`;
    return `${agents[0].name}, ${agents[1].name} +${agents.length - 2}`;
  }

  private async _handleReactionToggle(
    e: CustomEvent<{ messageId: string; emoji: string }>,
  ): Promise<void> {
    if (!this.conversation || !this.simulationId) return;
    const { messageId, emoji } = e.detail;

    const response = await chatApi.toggleReaction(
      this.simulationId,
      this.conversation.id,
      messageId,
      emoji,
    );

    if (!response.success) {
      VelgToast.error(response.error?.message ?? msg('Failed to toggle reaction.'));
      return;
    }

    // Refresh reactions for this message from the server
    const reactionsResp = await chatApi.getReactions(
      this.simulationId,
      this.conversation.id,
      messageId,
    );

    if (reactionsResp.success && reactionsResp.data) {
      chatStore.updateMessageReactions(this.conversation.id, messageId, reactionsResp.data);
    }
  }

  private async _openAgentDetails(agentId: string): Promise<void> {
    if (!this.simulationId) return;
    try {
      const response = await agentsApi.getById(
        this.simulationId,
        agentId,
        appState.currentSimulationMode.value,
      );
      if (response.success && response.data) {
        this._detailAgent = response.data;
      }
    } catch (err) {
      captureError(err, { source: 'ChatWindow._openAgentDetails' });
      VelgToast.error(msg('Failed to load agent details.'));
    }
  }

  private _toggleEventsBar(): void {
    this._showEventsBar = !this._showEventsBar;
  }

  private _handleExportMarkdown(): void {
    if (!this.conversation) return;
    const session = chatStore.getOrCreate(this.conversation.id);
    exportChatMarkdown(this.conversation, session.messages.value);
  }

  private _handleExportJSON(): void {
    if (!this.conversation) return;
    const session = chatStore.getOrCreate(this.conversation.id);
    exportChatJSON(this.conversation, session.messages.value);
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

  @state() private _showExportMenu = false;

  private _toggleExportMenu(e: Event): void {
    e.stopPropagation();
    this._showExportMenu = !this._showExportMenu;
    if (this._showExportMenu) {
      // Focus first menu item after render
      this.updateComplete.then(() => {
        const first = this.shadowRoot?.querySelector<HTMLElement>('.export-menu__item');
        first?.focus();
      });
    }
  }

  /** Keyboard navigation for export menu: arrow keys, Tab trap, Escape to close. */
  private _handleExportMenuKeydown(e: KeyboardEvent): void {
    const items = Array.from(
      this.shadowRoot?.querySelectorAll<HTMLElement>('.export-menu__item') ?? [],
    );
    if (items.length === 0) return;
    const current = items.indexOf(e.target as HTMLElement);

    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowRight': {
        e.preventDefault();
        const next = (current + 1) % items.length;
        items[next].focus();
        break;
      }
      case 'ArrowUp':
      case 'ArrowLeft': {
        e.preventDefault();
        const prev = (current - 1 + items.length) % items.length;
        items[prev].focus();
        break;
      }
      case 'Tab': {
        // Trap focus within menu
        e.preventDefault();
        const next = e.shiftKey
          ? (current - 1 + items.length) % items.length
          : (current + 1) % items.length;
        items[next].focus();
        break;
      }
      case 'Escape':
        this._showExportMenu = false;
        // Return focus to trigger button
        this.shadowRoot?.querySelector<HTMLElement>('.export-wrapper .window__action-btn')?.focus();
        break;
    }
  }

  private _renderPinIcon() {
    return icons.pin(14);
  }

  private _renderAddAgentIcon() {
    return icons.userPlus(14);
  }

  private _renderDownloadIcon() {
    return icons.download(14);
  }

  private _renderPortraitStack(): TemplateResult {
    const agents = this._getAgents();
    const maxVisible = 4;
    const visible = agents.slice(0, maxVisible);
    const overflow = agents.length - maxVisible;

    return html`
      <div class="header__portraits">
        ${visible.map((agent) =>
          agent.portrait_image_url
            ? html`<velg-avatar
                .src=${agent.portrait_image_url}
                .name=${agent.name}
                size="sm"
                clickable
                @avatar-click=${() => this._openAgentDetails(agent.id)}
              ></velg-avatar>`
            : html`<velg-avatar
                .name=${agent.name}
                size="sm"
                clickable
                @avatar-click=${() => this._openAgentDetails(agent.id)}
              ></velg-avatar>`,
        )}
        ${
          overflow > 0
            ? html`<velg-tooltip position="below">
              <div class="header__portrait-overflow">+${overflow}</div>
              <velg-agent-tip slot="tip" .agents=${agents.slice(maxVisible)}></velg-agent-tip>
            </velg-tooltip>`
            : null
        }
      </div>
    `;
  }

  private _renderEventsBar(): TemplateResult {
    const refs = this.conversation?.event_references ?? [];
    const barClasses = {
      'window__events-bar': true,
      'window__events-bar--open': this._showEventsBar,
    };

    if (refs.length === 0) {
      return html`
        <div class=${classMap(barClasses)}>
          <button class="window__action-btn" @click=${this._handleOpenEventPicker}>
            + ${msg('Add Event')}
          </button>
        </div>
      `;
    }

    return html`
      <div class=${classMap(barClasses)}>
        ${refs.map(
          (ref) => html`
            <div class="event-card">
              <div class="event-card__header">
                <div class="event-card__title">${ref.event_title}</div>
                <button
                  class="event-card__remove"
                  @click=${() => this._handleRemoveEventRef(ref)}
                  title=${msg('Remove event reference')}
                  aria-label=${msg('Remove event reference')}
                >
                  &times;
                </button>
              </div>
              <div class="event-card__meta">
                ${ref.event_type ?? ''} ${ref.impact_level != null ? `\u00B7 ${ref.impact_level}/10` : ''}
              </div>
            </div>
          `,
        )}
        <button
          class="window__action-btn"
          @click=${this._handleOpenEventPicker}
          title=${msg('Add event reference')}
          aria-label=${msg('Add event reference')}
        >+</button>
      </div>
    `;
  }

  private _renderNoConversation() {
    return html`
      <velg-empty-state
        message=${msg('Choose a conversation from the list or start a new one by selecting an agent.')}
      ></velg-empty-state>
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
            <div class="window__header-actions" role="toolbar" aria-label=${msg('Chat actions')}>
              <button
                class="window__action-btn ${hasEventsBar ? 'window__action-btn--active' : ''}"
                @click=${this._toggleEventsBar}
                aria-label=${msg('Events')}
                aria-pressed=${hasEventsBar ? 'true' : 'false'}
              >
                ${this._renderPinIcon()} ${eventRefCount > 0 ? eventRefCount : ''}
              </button>
              <button
                class="window__action-btn"
                @click=${this._handleAddAgent}
                aria-label=${msg('Add Agent')}
              >
                ${this._renderAddAgentIcon()}
              </button>
              <div class="export-wrapper">
                <button
                  class="window__action-btn"
                  @click=${this._toggleExportMenu}
                  aria-label=${msg('Export conversation')}
                  aria-haspopup="true"
                  aria-expanded=${this._showExportMenu ? 'true' : 'false'}
                >
                  ${this._renderDownloadIcon()}
                </button>
                ${
                  this._showExportMenu
                    ? html`
                    <div class="export-menu" role="menu"
                      @click=${(e: Event) => e.stopPropagation()}
                      @keydown=${this._handleExportMenuKeydown}
                    >
                      <button
                        class="export-menu__item"
                        role="menuitem"
                        @click=${() => {
                          this._handleExportMarkdown();
                          this._showExportMenu = false;
                        }}
                      >${msg('Markdown')}</button>
                      <button
                        class="export-menu__item"
                        role="menuitem"
                        @click=${() => {
                          this._handleExportJSON();
                          this._showExportMenu = false;
                        }}
                      >${msg('JSON')}</button>
                    </div>
                  `
                    : null
                }
              </div>
            </div>
          </div>

          ${this._renderEventsBar()}
        </div>

        ${
          this._loading
            ? html`<velg-loading-state message=${msg('Loading messages...')}></velg-loading-state>`
            : html`
              <div class="window__messages"
                @reaction-toggle=${this._handleReactionToggle}
                @action-regenerate=${this._handleRegenerate}
                @send-starter=${this._handleSendMessage}
              >
                <velg-chat-feed
                  .messages=${session.messages.value}
                  .participants=${participants}
                  .eventReferences=${this.conversation.event_references ?? []}
                  .currentUserId=${appState.user.value?.id ?? ''}
                  .currentUserName=${appState.user.value?.user_metadata?.display_name ?? appState.user.value?.email ?? ''}
                  .streaming=${session.streaming.value}
                  .streamContent=${session.streamBuffer.value}
                  .streamingParticipantId=${this._streamingAgentId}
                  .typingUsers=${realtimeService.chatTypingUsers.value}
                  .starters=${this._starters}
                  .hasMore=${session.hasMore.value}
                  .loading=${this._loading}
                  .conversationLocale=${this.conversation.locale ?? 'de'}
                  @load-older=${this._handleLoadOlder}
                ></velg-chat-feed>
              </div>
            `
        }

        ${this._sending && !session.streaming.value ? html`<div class="window__sending-indicator">${msg('Sending...')}</div>` : null}

        ${
          appState.isAuthenticated.value
            ? html`
          <velg-chat-composer
            ?disabled=${this._sending || this._loading || session.streaming.value || isArchived}
            .initialContent=${this._restoredDraft}
            @send-message=${this._handleSendMessage}
            @composer-typing=${this._handleComposerTyping}
            @draft-change=${this._handleDraftChange}
          ></velg-chat-composer>
        `
            : null
        }
      </div>

      <velg-agent-details-panel
        .agent=${this._detailAgent}
        .simulationId=${this.simulationId}
        ?open=${!!this._detailAgent}
        container="lightbox"
        @panel-close=${() => {
          this._detailAgent = null;
        }}
      ></velg-agent-details-panel>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-chat-window': VelgChatWindow;
  }
}

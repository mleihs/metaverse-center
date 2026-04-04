/**
 * ChatSessionStore — Unified chat state manager using Preact Signals.
 *
 * Single source of truth for all chat state. Replaces 14+ scattered @state()
 * properties across ChatWindow and EpochChatPanel with session-scoped signals.
 *
 * Architecture:
 *   - Each conversation/channel gets its own ChatSession (lazy-created)
 *   - Signals inside sessions drive Lit reactivity via SignalWatcher mixin
 *   - batch() prevents intermediate renders on multi-signal updates
 *   - Immutable array/object refs ensure Lit change detection fires
 *
 * Consumption pattern:
 *   const session = chatStore.getOrCreate(conversationId);
 *   // In SignalWatcher component: session.messages.value → auto-rerender
 */

import { type Signal, batch, signal } from '@preact/signals-core';

import type { ChatMessage } from '../../types/index.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Transient flag for optimistic messages not yet confirmed by the server. */
export interface OptimisticChatMessage extends ChatMessage {
  readonly _optimistic?: boolean;
}

/** Someone currently typing — agent or player, context-agnostic. */
export interface TypingUser {
  readonly id: string;
  readonly name: string;
  /** Agent-specific typing phrase, e.g. "consults the archives..." */
  readonly phrase?: string;
}

/** Reactive state bag for a single chat session (conversation or channel). */
export interface ChatSession {
  readonly messages: Signal<OptimisticChatMessage[]>;
  readonly loading: Signal<boolean>;
  readonly sending: Signal<boolean>;
  readonly streaming: Signal<boolean>;
  readonly streamBuffer: Signal<string>;
  readonly hasMore: Signal<boolean>;
  readonly unread: Signal<number>;
  readonly draft: Signal<string>;
  readonly typingUsers: Signal<TypingUser[]>;
  readonly error: Signal<string | null>;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const DRAFT_KEY_PREFIX = 'velg-chat-draft-';

export class ChatSessionStore {
  private readonly _sessions = new Map<string, ChatSession>();

  // --- Session lifecycle ------------------------------------------------

  /** Get existing session or create a fresh one with default signals. */
  getOrCreate(sessionId: string): ChatSession {
    let session = this._sessions.get(sessionId);
    if (!session) {
      session = this._createSession();
      this._sessions.set(sessionId, session);
    }
    return session;
  }

  /** Check if a session exists without creating one. */
  has(sessionId: string): boolean {
    return this._sessions.has(sessionId);
  }

  /** Dispose a session, releasing its signals. */
  dispose(sessionId: string): void {
    this._sessions.delete(sessionId);
  }

  /** Dispose ALL sessions (e.g. on logout). */
  disposeAll(): void {
    this._sessions.clear();
  }

  // --- Message management -----------------------------------------------

  /** Add a message, deduplicating by ID. */
  addMessage(sessionId: string, message: OptimisticChatMessage): void {
    const session = this.getOrCreate(sessionId);
    const existing = session.messages.value;
    if (!existing.some(m => m.id === message.id)) {
      session.messages.value = [...existing, message];
    }
  }

  /** Replace all messages (e.g. after initial load or full refresh). */
  setMessages(sessionId: string, messages: ChatMessage[]): void {
    const session = this.getOrCreate(sessionId);
    session.messages.value = messages;
  }

  /**
   * Insert an optimistic user message before the server confirms.
   * Returns the temporary ID for later reconciliation via confirmOptimistic().
   */
  addOptimistic(
    sessionId: string,
    content: string,
    conversationId: string,
  ): string {
    const tempId = `temp-${Date.now()}`;
    const optimistic: OptimisticChatMessage = {
      id: tempId,
      conversation_id: conversationId,
      sender_role: 'user',
      content,
      created_at: new Date().toISOString(),
      _optimistic: true,
    };
    this.addMessage(sessionId, optimistic);
    return tempId;
  }

  /** Remove an optimistic message (e.g. on send error — rollback). */
  removeOptimistic(sessionId: string, tempId: string): void {
    const session = this.getOrCreate(sessionId);
    session.messages.value = session.messages.value.filter(
      m => m.id !== tempId,
    );
  }

  /** Replace an optimistic message with the server-confirmed version. */
  confirmOptimistic(
    sessionId: string,
    tempId: string,
    confirmed: ChatMessage,
  ): void {
    const session = this.getOrCreate(sessionId);
    session.messages.value = session.messages.value.map(m =>
      m.id === tempId ? confirmed : m,
    );
  }

  // --- Streaming --------------------------------------------------------

  /** Append a chunk to the stream buffer (for SSE token-by-token display). */
  appendStreamChunk(sessionId: string, chunk: string): void {
    const session = this.getOrCreate(sessionId);
    session.streamBuffer.value += chunk;
  }

  /** Finalize streaming: persist buffer as a real message, reset stream state. */
  finalizeStream(sessionId: string, message: ChatMessage): void {
    const session = this.getOrCreate(sessionId);
    batch(() => {
      session.streaming.value = false;
      session.streamBuffer.value = '';
      this.addMessage(sessionId, message);
    });
  }

  // --- Draft persistence ------------------------------------------------

  /** Save draft to signal + localStorage. Callers should debounce (~500ms). */
  saveDraft(sessionId: string, text: string): void {
    const session = this.getOrCreate(sessionId);
    session.draft.value = text;
    try {
      localStorage.setItem(`${DRAFT_KEY_PREFIX}${sessionId}`, text);
    } catch {
      // localStorage full or unavailable — signal still holds the value
    }
  }

  /** Restore draft from localStorage (called on mount). */
  restoreDraft(sessionId: string): string {
    try {
      return localStorage.getItem(`${DRAFT_KEY_PREFIX}${sessionId}`) ?? '';
    } catch {
      return '';
    }
  }

  /** Clear draft from signal + localStorage. */
  clearDraft(sessionId: string): void {
    const session = this.getOrCreate(sessionId);
    session.draft.value = '';
    try {
      localStorage.removeItem(`${DRAFT_KEY_PREFIX}${sessionId}`);
    } catch {
      // ignore — non-critical
    }
  }

  // --- Unread tracking --------------------------------------------------

  /** Reset unread counter (e.g. when user views the conversation). */
  markRead(sessionId: string): void {
    const session = this.getOrCreate(sessionId);
    session.unread.value = 0;
  }

  /** Increment unread counter (e.g. on incoming realtime message). */
  incrementUnread(sessionId: string): void {
    const session = this.getOrCreate(sessionId);
    session.unread.value += 1;
  }

  // --- Pagination -------------------------------------------------------

  /**
   * Load older messages via callback. Manages loading + hasMore state.
   * The callback receives the oldest message's created_at as cursor.
   */
  async loadOlder(
    sessionId: string,
    loadFn: (before: string) => Promise<ChatMessage[]>,
  ): Promise<void> {
    const session = this.getOrCreate(sessionId);
    const oldest = session.messages.value[0];
    if (!oldest || session.loading.value) return;

    session.loading.value = true;
    try {
      const older = await loadFn(oldest.created_at);
      batch(() => {
        if (older.length === 0) {
          session.hasMore.value = false;
        } else {
          session.messages.value = [...older, ...session.messages.value];
        }
      });
    } catch (err) {
      session.error.value =
        err instanceof Error ? err.message : 'Failed to load messages';
    } finally {
      session.loading.value = false;
    }
  }

  // --- Typing indicators ------------------------------------------------

  /** Set the full typing users list for a session. */
  setTypingUsers(sessionId: string, users: TypingUser[]): void {
    const session = this.getOrCreate(sessionId);
    session.typingUsers.value = users;
  }

  // --- Internal ---------------------------------------------------------

  private _createSession(): ChatSession {
    return {
      messages: signal<OptimisticChatMessage[]>([]),
      loading: signal(false),
      sending: signal(false),
      streaming: signal(false),
      streamBuffer: signal(''),
      hasMore: signal(true),
      unread: signal(0),
      draft: signal(''),
      typingUsers: signal<TypingUser[]>([]),
      error: signal<string | null>(null),
    };
  }
}

/** Singleton store — consumed by all chat components via SignalWatcher. */
export const chatStore = new ChatSessionStore();

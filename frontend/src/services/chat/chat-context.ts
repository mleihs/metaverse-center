/**
 * Chat Context — @lit/context definitions for session scoping.
 *
 * Nested components (ChatFeed > ChatMessage > ChatBubble) access the active
 * ChatSession via context instead of prop-drilling. Signals INSIDE the context
 * value drive granular reactivity — consumers with SignalWatcher react to
 * signal changes without needing `subscribe: true` on the context consumer.
 *
 * Provider: ChatPanel / ChatShell (sets context on conversation switch)
 * Consumers: ChatFeed, ChatMessage, ChatBubble, ChatComposer, TypingIndicator
 */

import { createContext } from '@lit/context';

import type { ChatSession } from './ChatSessionStore.js';

/**
 * Context key for the active chat session.
 * The value contains Preact Signals — components with SignalWatcher
 * automatically re-render when signal values change.
 */
export const chatSessionContext =
  createContext<ChatSession>('chat-session');

/**
 * Context key for the current user's ID.
 * Used by ChatMessage to determine alignment (own vs. other).
 */
export const chatUserContext =
  createContext<string>('chat-current-user');

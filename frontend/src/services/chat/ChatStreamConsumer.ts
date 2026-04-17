/**
 * SSE streaming consumer for chat AI responses.
 *
 * Uses fetch() with POST (not EventSource — that API doesn't support
 * POST or custom auth headers). Reads the response body via
 * ReadableStream and parses SSE event/data lines incrementally.
 */

import type { ChatMessage } from '../../types/index.js';
import { appState } from '../AppStateManager.js';
import { captureError } from '../SentryService.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StreamCallbacks {
  onUserConfirmed: (message: ChatMessage) => void;
  onAgentStart: (agentId: string, agentName: string, index: number, total: number) => void;
  onToken: (agentId: string, token: string) => void;
  onAgentDone: (agentId: string, message: ChatMessage) => void;
  onError: (error: string) => void;
  signal?: AbortSignal;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Stream an AI chat response via the SSE endpoint.
 *
 * Sends the user message, then reads the SSE stream token-by-token,
 * dispatching typed callbacks for each event. Returns when the stream
 * is complete (done event) or aborted.
 *
 * @throws On network errors or non-200 responses (caller should
 *         fall back to non-streaming sendMessage).
 */
export async function streamChatResponse(
  simulationId: string,
  conversationId: string,
  content: string,
  callbacks: StreamCallbacks,
): Promise<void> {
  const url = `/api/v1/simulations/${simulationId}/chat/conversations/${conversationId}/messages/stream`;

  const response = await _authenticatedPost(url, {
    body: JSON.stringify({
      content,
      sender_role: 'user',
      generate_response: true,
    }),
    signal: callbacks.signal,
    errorLabel: 'Stream',
  });

  await _consumeSSEStream(response, callbacks);
}

/**
 * Stream a regenerate request (re-trigger AI generation without new user message).
 * Uses the same SSE protocol as streamChatResponse but hits the regenerate endpoint.
 */
export async function streamRegenerate(
  simulationId: string,
  conversationId: string,
  callbacks: Omit<StreamCallbacks, 'onUserConfirmed'> & { signal?: AbortSignal },
): Promise<void> {
  const url = `/api/v1/simulations/${simulationId}/chat/conversations/${conversationId}/regenerate`;

  const response = await _authenticatedPost(url, {
    signal: callbacks.signal,
    errorLabel: 'Regenerate',
  });

  // Regenerate has no user_confirmed event — provide no-op
  await _consumeSSEStream(response, { ...callbacks, onUserConfirmed: () => {} });
}

// ---------------------------------------------------------------------------
// Shared internals
// ---------------------------------------------------------------------------

/** Authenticated POST fetch with error handling. */
async function _authenticatedPost(
  url: string,
  opts: { body?: string; signal?: AbortSignal; errorLabel: string },
): Promise<Response> {
  const token = appState.accessToken.value;
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: opts.body,
    signal: opts.signal,
  });

  if (!response.ok) {
    const text = await response.text().catch((err) => {
      // Body read failures are rare but legitimate (stream aborted, malformed chunked response).
      captureError(err, { source: 'chat-stream-consumer._authenticatedPost.readBody' });
      return 'Unknown error';
    });
    throw new Error(`${opts.errorLabel} request failed (${response.status}): ${text}`);
  }

  return response;
}

/** Read an SSE response body and dispatch parsed events to callbacks. */
async function _consumeSSEStream(response: Response, callbacks: StreamCallbacks): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Response body is not readable');
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by double newlines
      const parts = buffer.split('\n\n');

      // Last element may be incomplete — keep it in the buffer.
      // `String.prototype.split(separator)` never returns an empty array
      // (even ''.split('\n\n') → ['']), so pop() always yields a string;
      // `?? ''` is a type-safety belt if a future refactor ever breaks
      // that invariant (e.g. filtering parts before pop).
      buffer = parts.pop() ?? '';

      for (const part of parts) {
        _dispatchSSEBlock(part, callbacks);
      }
    }

    // Process any remaining data in buffer
    if (buffer.trim()) {
      _dispatchSSEBlock(buffer, callbacks);
    }
  } finally {
    reader.releaseLock();
  }
}

// ---------------------------------------------------------------------------
// SSE parsing
// ---------------------------------------------------------------------------

/**
 * Parse a single SSE block (lines between double-newlines) and dispatch
 * the appropriate callback.
 */
function _dispatchSSEBlock(block: string, callbacks: StreamCallbacks): void {
  let eventType = '';
  let dataStr = '';

  for (const line of block.split('\n')) {
    if (line.startsWith('event: ')) {
      eventType = line.slice(7);
    } else if (line.startsWith('data: ')) {
      dataStr = line.slice(6);
    }
    // Skip SSE comments (lines starting with ':') and empty lines
  }

  if (!eventType || !dataStr) return;

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(dataStr);
  } catch (err) {
    captureError(err, {
      source: 'ChatStreamConsumer.parseSSEFrame',
      eventType: eventType ?? 'unknown',
      dataStrPreview: dataStr.slice(0, 120),
    });
    return;
  }

  switch (eventType) {
    case 'user_confirmed':
      callbacks.onUserConfirmed(data.message as ChatMessage);
      break;

    case 'agent_start':
      callbacks.onAgentStart(
        data.agent_id as string,
        data.agent_name as string,
        data.index as number,
        data.total as number,
      );
      break;

    case 'token':
      callbacks.onToken(data.agent_id as string, data.content as string);
      break;

    case 'agent_done':
      if (data.message) {
        callbacks.onAgentDone(data.agent_id as string, data.message as ChatMessage);
      }
      break;

    case 'error':
      callbacks.onError((data.error as string) ?? 'Unknown streaming error');
      break;

    case 'done':
      // Stream complete — nothing to dispatch, the Promise will resolve
      break;
  }
}

/**
 * SSE streaming consumer for chat AI responses.
 *
 * Uses fetch() with POST (not EventSource — that API doesn't support
 * POST or custom auth headers). Reads the response body via
 * ReadableStream and parses SSE event/data lines incrementally.
 */

import { appState } from '../AppStateManager.js';
import type { ChatMessage } from '../../types/index.js';

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
  const token = appState.accessToken.value;
  if (!token) {
    callbacks.onError('Not authenticated');
    return;
  }

  const url = `/api/v1/simulations/${simulationId}/chat/conversations/${conversationId}/messages/stream`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      content,
      sender_role: 'user',
      generate_response: true,
    }),
    signal: callbacks.signal,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => 'Unknown error');
    throw new Error(`Stream request failed (${response.status}): ${text}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  // SSE parsing state — accumulates partial lines across chunk boundaries
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by double newlines
      const parts = buffer.split('\n\n');

      // Last element may be incomplete — keep it in the buffer
      buffer = parts.pop()!;

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
// SSE parsing (internal)
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
  } catch {
    return; // Malformed JSON — skip silently
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
      callbacks.onAgentDone(data.agent_id as string, data.message as ChatMessage);
      break;

    case 'error':
      callbacks.onError((data.error as string) ?? 'Unknown streaming error');
      break;

    case 'done':
      // Stream complete — nothing to dispatch, the Promise will resolve
      break;
  }
}

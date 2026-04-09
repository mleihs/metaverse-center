/**
 * Unit tests for SSE stream parsing logic from ChatStreamConsumer.
 *
 * Tests the _dispatchSSEBlock and _consumeSSEStream patterns by
 * recreating the pure parsing logic (the private functions are not
 * exported, so we replicate the parser and test the contract).
 */

import { describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '../src/types/index.js';

// ---------------------------------------------------------------------------
// Replicate the SSE parser logic from ChatStreamConsumer.ts
// (lines 156-210, _dispatchSSEBlock)
// ---------------------------------------------------------------------------

interface StreamCallbacks {
  onUserConfirmed: (message: ChatMessage) => void;
  onAgentStart: (agentId: string, agentName: string, index: number, total: number) => void;
  onToken: (agentId: string, token: string) => void;
  onAgentDone: (agentId: string, message: ChatMessage) => void;
  onError: (error: string) => void;
}

function parseSSEBlock(block: string, callbacks: StreamCallbacks): void {
  let eventType = '';
  let dataStr = '';

  for (const line of block.split('\n')) {
    if (line.startsWith('event: ')) {
      eventType = line.slice(7);
    } else if (line.startsWith('data: ')) {
      dataStr = line.slice(6);
    }
  }

  if (!eventType || !dataStr) return;

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(dataStr);
  } catch {
    return; // Malformed JSON — skip
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
      callbacks.onError(data.error as string);
      break;
    case 'done':
      // Stream complete — no callback needed
      break;
  }
}

function parseSSEStream(raw: string, callbacks: StreamCallbacks): void {
  const parts = raw.split('\n\n');
  for (const part of parts) {
    if (part.trim()) parseSSEBlock(part, callbacks);
  }
}

// ---------------------------------------------------------------------------
// Mock callbacks factory
// ---------------------------------------------------------------------------

function mockCallbacks(): StreamCallbacks & {
  calls: Record<string, unknown[][]>;
} {
  const calls: Record<string, unknown[][]> = {};
  const track = (name: string) =>
    vi.fn((...args: unknown[]) => {
      if (!calls[name]) calls[name] = [];
      calls[name].push(args);
    });
  return {
    onUserConfirmed: track('onUserConfirmed') as StreamCallbacks['onUserConfirmed'],
    onAgentStart: track('onAgentStart') as StreamCallbacks['onAgentStart'],
    onToken: track('onToken') as StreamCallbacks['onToken'],
    onAgentDone: track('onAgentDone') as StreamCallbacks['onAgentDone'],
    onError: track('onError') as StreamCallbacks['onError'],
    calls,
  };
}

// ===========================================================================
// Tests
// ===========================================================================

describe('SSE Block Parsing', () => {
  it('parses user_confirmed event', () => {
    const cb = mockCallbacks();
    const msg = { id: 'm1', content: 'Hello', sender_role: 'user' };
    parseSSEBlock(`event: user_confirmed\ndata: ${JSON.stringify({ message: msg })}`, cb);
    expect(cb.calls.onUserConfirmed).toHaveLength(1);
    expect(cb.calls.onUserConfirmed[0][0]).toEqual(msg);
  });

  it('parses agent_start event', () => {
    const cb = mockCallbacks();
    parseSSEBlock(
      `event: agent_start\ndata: ${JSON.stringify({
        agent_id: 'a1',
        agent_name: 'Commander Voss',
        index: 0,
        total: 2,
      })}`,
      cb,
    );
    expect(cb.calls.onAgentStart).toHaveLength(1);
    expect(cb.calls.onAgentStart[0]).toEqual(['a1', 'Commander Voss', 0, 2]);
  });

  it('parses token event', () => {
    const cb = mockCallbacks();
    parseSSEBlock(
      `event: token\ndata: ${JSON.stringify({ agent_id: 'a1', content: 'The ' })}`,
      cb,
    );
    expect(cb.calls.onToken).toHaveLength(1);
    expect(cb.calls.onToken[0]).toEqual(['a1', 'The ']);
  });

  it('parses agent_done event', () => {
    const cb = mockCallbacks();
    const msg = { id: 'm2', content: 'Full response', sender_role: 'assistant' };
    parseSSEBlock(
      `event: agent_done\ndata: ${JSON.stringify({ agent_id: 'a1', message: msg })}`,
      cb,
    );
    expect(cb.calls.onAgentDone).toHaveLength(1);
    expect(cb.calls.onAgentDone[0]).toEqual(['a1', msg]);
  });

  it('parses error event', () => {
    const cb = mockCallbacks();
    parseSSEBlock(
      `event: error\ndata: ${JSON.stringify({ error: 'Internal error' })}`,
      cb,
    );
    expect(cb.calls.onError).toHaveLength(1);
    expect(cb.calls.onError[0][0]).toBe('Internal error');
  });

  it('ignores done event (no callback)', () => {
    const cb = mockCallbacks();
    parseSSEBlock(`event: done\ndata: ${JSON.stringify({})}`, cb);
    // No callbacks should fire for done
    expect(Object.keys(cb.calls)).toHaveLength(0);
  });

  it('ignores block with missing event type', () => {
    const cb = mockCallbacks();
    parseSSEBlock(`data: ${JSON.stringify({ foo: 'bar' })}`, cb);
    expect(Object.keys(cb.calls)).toHaveLength(0);
  });

  it('ignores block with missing data', () => {
    const cb = mockCallbacks();
    parseSSEBlock('event: token', cb);
    expect(Object.keys(cb.calls)).toHaveLength(0);
  });

  it('ignores malformed JSON', () => {
    const cb = mockCallbacks();
    parseSSEBlock('event: token\ndata: {not valid json}', cb);
    expect(Object.keys(cb.calls)).toHaveLength(0);
  });

  it('ignores SSE comments', () => {
    const cb = mockCallbacks();
    parseSSEBlock(
      `: this is a comment\nevent: token\ndata: ${JSON.stringify({ agent_id: 'a1', content: 'x' })}`,
      cb,
    );
    expect(cb.calls.onToken).toHaveLength(1);
  });
});

describe('Full SSE Stream Parsing', () => {
  it('parses multiple events separated by double newlines', () => {
    const cb = mockCallbacks();
    const raw = [
      `event: agent_start\ndata: ${JSON.stringify({ agent_id: 'a1', agent_name: 'Voss', index: 0, total: 1 })}`,
      `event: token\ndata: ${JSON.stringify({ agent_id: 'a1', content: 'Hello' })}`,
      `event: token\ndata: ${JSON.stringify({ agent_id: 'a1', content: ' world' })}`,
      `event: agent_done\ndata: ${JSON.stringify({ agent_id: 'a1', message: { id: 'm1', content: 'Hello world' } })}`,
      `event: done\ndata: ${JSON.stringify({})}`,
    ].join('\n\n');

    parseSSEStream(raw, cb);

    expect(cb.calls.onAgentStart).toHaveLength(1);
    expect(cb.calls.onToken).toHaveLength(2);
    expect(cb.calls.onAgentDone).toHaveLength(1);
  });

  it('handles group chat with multiple agents', () => {
    const cb = mockCallbacks();
    const raw = [
      `event: user_confirmed\ndata: ${JSON.stringify({ message: { id: 'u1' } })}`,
      `event: agent_start\ndata: ${JSON.stringify({ agent_id: 'a1', agent_name: 'Voss', index: 0, total: 2 })}`,
      `event: token\ndata: ${JSON.stringify({ agent_id: 'a1', content: 'First' })}`,
      `event: agent_done\ndata: ${JSON.stringify({ agent_id: 'a1', message: { id: 'm1' } })}`,
      `event: agent_start\ndata: ${JSON.stringify({ agent_id: 'a2', agent_name: 'Reeves', index: 1, total: 2 })}`,
      `event: token\ndata: ${JSON.stringify({ agent_id: 'a2', content: 'Second' })}`,
      `event: agent_done\ndata: ${JSON.stringify({ agent_id: 'a2', message: { id: 'm2' } })}`,
      `event: done\ndata: ${JSON.stringify({})}`,
    ].join('\n\n');

    parseSSEStream(raw, cb);

    expect(cb.calls.onUserConfirmed).toHaveLength(1);
    expect(cb.calls.onAgentStart).toHaveLength(2);
    expect(cb.calls.onToken).toHaveLength(2);
    expect(cb.calls.onAgentDone).toHaveLength(2);
  });

  it('handles error mid-stream', () => {
    const cb = mockCallbacks();
    const raw = [
      `event: agent_start\ndata: ${JSON.stringify({ agent_id: 'a1', agent_name: 'Voss', index: 0, total: 1 })}`,
      `event: token\ndata: ${JSON.stringify({ agent_id: 'a1', content: 'Start...' })}`,
      `event: error\ndata: ${JSON.stringify({ error: 'Generation failed' })}`,
    ].join('\n\n');

    parseSSEStream(raw, cb);

    expect(cb.calls.onAgentStart).toHaveLength(1);
    expect(cb.calls.onToken).toHaveLength(1);
    expect(cb.calls.onError).toHaveLength(1);
    expect(cb.calls.onError[0][0]).toBe('Generation failed');
  });
});

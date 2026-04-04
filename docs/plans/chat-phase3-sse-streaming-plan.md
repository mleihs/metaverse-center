# Phase 3: SSE Streaming + Typing Indicators — IMPLEMENTED

> **Status:** ALL 10 STEPS COMPLETE (2026-04-04, 5 commits: 96a6ace, 47b33f9, 7736368, 68cff49, a111ded)
>
> This plan was used as the implementation spec and is now archived for reference.
> See `memory/chat-redesign-session-handoff.md` for the full post-implementation summary.

## Context

Users currently wait 10-30+ seconds with only bouncing dots while AI agents respond. Phase 3 replaces this with token-by-token streaming, showing the response as it's generated. This is the highest-impact UX improvement in the chat redesign.

Phases 0-2 are DONE. Phase 1b (wiring ChatWindow to new components) was skipped and becomes a prerequisite here because ChatFeed already has streaming support built in, while the old MessageList does not.

**Deployment:** Railway (backend) + Supabase.com (DB + Realtime). All changes must work with Railway's HTTP/2→HTTP/1.1 demux and Supabase cloud's `realtime.send()`.

---

## Critical Implementation Details (Preserved from Deep Dive)

### Backend Key Facts
- **FastAPI 0.135.1** — `EventSourceResponse` is just `StreamingResponse` with `media_type = "text/event-stream"`. Import: `from fastapi.responses import EventSourceResponse`. It's a marker class, NOT a magic encoder.
- **httpx 0.28.1** — Streaming via `async with client.stream("POST", url, json=payload, headers=headers) as response: async for line in response.aiter_lines():`
- **OpenRouter SSE format**: `data: {"choices":[{"delta":{"content":"token"}}]}`. Comments start with `: OPENROUTER PROCESSING`. End marker: `data: [DONE]`. Usage in final chunk's top-level `usage` field (NOT in delta).
- **OpenRouterService** (`backend/services/external/openrouter.py`): `OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"`, headers need `Authorization`, `Content-Type`, `HTTP-Referer`, `X-Title`. `TIMEOUT_SECONDS = 60`.
- **ChatAIService._generate_single_response()** (line 48): checks `settings.forge_mock_mode` first (line 85). Streaming method MUST also check mock mode.
- **ChatAIService._generate_single_response()** builds system prompt from: template variables (line 100), mood context (line 104), language instruction (line 109), extra_context (line 112). Messages = `[{"role": "system", "content": system_prompt}, *history_messages]` (line 115).
- **chat_service.py send_message()** lines 296-300: REDUNDANT `last_message_at` update — the DB trigger `update_conversation_stats()` (migration `20260215000009_triggers.sql` lines 8-17) already handles `message_count + 1` AND `last_message_at = NEW.created_at`. The Python code must be removed.
- **ExternalServiceResolver** (`backend/services/external_service_resolver.py`): `get_ai_provider_config()` returns object with `openrouter_api_key`.
- **ModelResolver** (`backend/services/model_resolver.py`): `ResolvedModel` dataclass with `model_id`, `temperature`, `max_tokens`, `source`.
- **No `response_model=`** on any endpoint. Return type annotation is the source of truth. The streaming endpoint returns `EventSourceResponse` directly (no `SuccessResponse` wrapper).

### Frontend Key Facts
- **SignalWatcher** mixin: `import { SignalWatcher } from '@lit-labs/preact-signals'`. Used by 26+ components. Pattern: `class Foo extends SignalWatcher(LitElement)`.
- **ChatSessionStore** (`frontend/src/services/chat/ChatSessionStore.ts`): Singleton `chatStore`. Methods: `appendStreamChunk(sessionId, chunk)` (line 151), `finalizeStream(sessionId, message)` (line 157 — uses `batch()`), `addOptimistic()`, `confirmOptimistic()`, `removeOptimistic()`.
- **ChatFeed** (`frontend/src/components/chat/core/ChatFeed.ts`): Props: `messages`, `participants: Participant[]`, `eventReferences`, `currentUserId`, `streaming: boolean`, `streamContent: string`, `typingUsers: TypingUser[]`, `hasMore`, `loading`. Streaming renders at line 459: `this._getStreamMsg()` creates virtual message with `id: '__stream__'`, `sender_role: 'assistant'`. Uses first participant for avatar (`this._participantMap.values().next().value`). Has `ScrollController` that auto-scrolls on `messages`/`streamContent`/`typingUsers` changes (line 496).
- **Participant** type (`frontend/src/services/chat/chat-types.ts`): `{ id: string, name: string, avatarUrl?: string, accentColor?: string, role: 'agent' | 'player' | 'system' }`.
- **ChatComposer** (`frontend/src/components/chat/core/ChatComposer.ts`): Events: `send-message` (detail: `{ content: string }`), `composer-typing` (no detail), `draft-change` (detail: `{ content: string }`). Props: `disabled`, `charLimit` (default 10000), `charWarn` (default 8000), `draft`.
- **ChatBubble** (`frontend/src/components/chat/core/ChatBubble.ts`): Already has `.bubble--streaming::after` cursor animation (line 77). Accepts `streaming: boolean` prop.
- **ChatWindow** (`frontend/src/components/chat/ChatWindow.ts`): Currently imports `'./MessageList.js'` (line 17), `'./MessageInput.js'` (line 18). Uses `@state() _messages`, `_loading`, `_sending`, `_aiTyping`. `_handleSendMessage()` at line 432 calls `chatApi.sendMessage()`. Renders `velg-message-list` at line 701 and `velg-message-input` at line 732.
- **RealtimeService** (`frontend/src/services/realtime/RealtimeService.ts`): Pattern for broadcast channels — `supabase.channel(topic, { config: { private: true } }).on('broadcast', { event: name }, handler).subscribe()`. Deduplicates by message ID. Has epoch chat + team chat + presence + status channels. No agent chat channels yet.
- **BaseApiService** uses `appState.accessToken.value` for auth. SSE consumer needs same token but via raw `fetch()` — BaseApiService's `handleResponse()` expects JSON, can't handle SSE.
- **supabase-js v2.95.3** (confirmed in node_modules) — broadcast replay available.
- **No `@lit/context` wired yet** — Phase 1 created `chat-context.ts` but it's not consumed. ChatWindow passes props directly.

### Postgres Key Facts
- **Existing trigger on chat_messages**: `trg_chat_messages_stats` → `update_conversation_stats()` (migration 009). Updates `message_count + 1` and `last_message_at`. Returns `NEW`.
- **Existing broadcast trigger on epoch_chat_messages**: `trg_broadcast_epoch_chat` → `broadcast_epoch_chat()` (migration `20260301000000_037_epoch_realtime.sql`). Uses `SECURITY DEFINER`, `RETURN NULL`. Pattern: `PERFORM realtime.send(payload, event, topic, private)`.
- **Last migration number**: 178. Next: 179.
- **`realtime.send()` signature**: `realtime.send(payload jsonb, event text, topic text, private boolean)`.

---

## Step 1: Wire ChatWindow to New Components (Phase 1b)

**Why:** ChatFeed has `streaming`, `streamContent`, `typingUsers` props. Old MessageList does not. This is the prerequisite for all streaming work.

### Files Modified
- `frontend/src/components/chat/ChatWindow.ts`
  - Replace `velg-message-list` → `velg-chat-feed`
  - Replace `velg-message-input` → `velg-chat-composer`
  - Add `SignalWatcher` mixin, migrate from `@state()` to `ChatSessionStore` signals
  - Wire `streaming`, `streamContent`, `typingUsers` props from session signals
  - Remove inline typing indicator HTML (replaced by `velg-typing-indicator` inside ChatFeed)
  - Keep header/events-bar unchanged
  - Wire `send-message` from ChatComposer → `_handleSendMessage()`
  - Wire `composer-typing` event
  - Build `participants: Participant[]` from `conversation.agents`

**Must invoke `frontend-design` skill before writing component code.**

### Verification
- Open Agent Chat, send a message → response appears same as before
- Event references still render inside ChatFeed timeline
- Date separators appear
- Scroll-to-bottom works
- `tsc --noEmit` + `ruff check` clean

---

## Step 2: OpenRouter `stream_completion()` Method

### File Modified
- `backend/services/external/openrouter.py`

### Method Signature
```python
async def stream_completion(
    self,
    model: str,
    messages: list[dict[str, str]],
    *,
    temperature: float = 0.7,
    max_tokens: int = 1024,
) -> AsyncIterator[StreamChunk]:
```

### `StreamChunk` Dataclass
```python
@dataclass
class StreamChunk:
    content: str = ""
    finish_reason: str | None = None
    usage: dict | None = None  # only in final chunk
    error: str | None = None
```

### Implementation
- Add `"stream": True` to payload
- Use `httpx.AsyncClient.stream("POST", ...)` context manager
- Parse SSE lines: skip `: OPENROUTER PROCESSING` comments, `data: [DONE]`
- Extract `choices[0].delta.content` per chunk
- Yield `StreamChunk(content=token)` per token
- On final chunk: extract `usage` from response, set `self.last_usage`
- On error chunk (`finish_reason: "error"`): yield `StreamChunk(error=...)`
- Same retry logic as `generate()` for initial connection failures
- Timeout: `TIMEOUT_SECONDS` for connection, no read timeout (streaming)

### Railway Compatibility
- httpx streaming works fine over HTTP/1.1
- No special config needed

---

## Step 3: ChatAIService Streaming Methods

### File Modified
- `backend/services/chat_ai_service.py`

### Refactoring: Extract `_build_generation_context()`
DRY helper that extracts the shared prompt assembly logic from `_generate_single_response()`:
```python
async def _build_generation_context(
    self, *, conversation_id, agent, simulation, locale,
    prompt_template, extra_variables, extra_context,
) -> tuple[str, list[dict[str, str]]]:
    """Build system prompt + message history. Shared by streaming and non-streaming."""
    # Returns (system_prompt, history_messages_with_system)
```

### New Method: `stream_single_response()`
```python
async def stream_single_response(
    self, *, conversation_id, agent, simulation, locale,
    prompt_template, model, history_messages,
    extra_variables=None, extra_context="", extra_metadata=None,
) -> AsyncIterator[SSEEvent]:
    """Yield SSE events for a single agent's streaming response."""
```

Yields:
1. `agent_start` event (agent_id, agent_name, index, total)
2. N x `token` events (agent_id, content)
3. Persists complete message to DB
4. Logs AI usage
5. `agent_done` event (agent_id, message=saved_message_dict)

### New Method: `stream_response()` (single-agent, public)
```python
async def stream_response(self, conversation_id, user_message) -> AsyncIterator[SSEEvent]:
```
- Loads conversation, agent, simulation, locale, memories, prompt, model
- Yields from `stream_single_response()`
- Fire-and-forget memory extraction (same as non-streaming)

### New Method: `stream_group_response()` (multi-agent, public)
```python
async def stream_group_response(self, conversation_id, user_message) -> AsyncIterator[SSEEvent]:
```
- Same setup as `generate_group_response()`
- Sequential: for each agent, yield from `stream_single_response()`
- Each agent sees previous agents' completed responses in history

### SSEEvent Type
```python
@dataclass
class SSEEvent:
    event: str  # "agent_start", "token", "agent_done", "user_confirmed", "done", "error"
    data: dict
```

---

## Step 4: ChatService Streaming Orchestration

### File Modified
- `backend/services/chat_service.py`

### New Method: `stream_ai_response()`
```python
@staticmethod
async def stream_ai_response(
    supabase, simulation_id, conversation_id, user_message_content,
) -> AsyncIterator[SSEEvent]:
```
- Resolves AI config (same as `generate_ai_response()`)
- Determines single vs. group
- Dispatches to `ChatAIService.stream_response()` or `stream_group_response()`
- Yields all SSE events from the AI service

### Cleanup: Remove Redundant `last_message_at` Update
- `send_message()` lines 298-300 manually update `last_message_at`
- DB trigger `update_conversation_stats()` (migration 009) already does this
- **Remove the Python update** -- put logic where it belongs (Postgres)

---

## Step 5: SSE Streaming Router Endpoint

### File Modified
- `backend/routers/chat.py`

### New Endpoint
```python
@router.post(
    "/conversations/{conversation_id}/messages/stream",
    status_code=200,
)
@limiter.limit(RATE_LIMIT_AI_CHAT)
async def stream_message(
    request: Request,
    simulation_id: UUID,
    conversation_id: UUID,
    body: MessageCreate,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> EventSourceResponse:
```

### Implementation
1. Verify ownership
2. Save user message via `_service.send_message()`
3. Audit log
4. Yield `user_confirmed` event with saved user message (for optimistic reconciliation)
5. Yield all events from `_service.stream_ai_response()`
6. Yield `done` event
7. On exception: yield `error` event, log
8. Check `request.is_disconnected()` between agent responses for early termination

### SSE Format
```
event: user_confirmed\ndata: {"message": {...}}\n\n
event: agent_start\ndata: {"agent_id": "...", "agent_name": "...", "index": 0, "total": 1}\n\n
event: token\ndata: {"agent_id": "...", "content": "tok"}\n\n
event: agent_done\ndata: {"agent_id": "...", "message": {...}}\n\n
event: done\ndata: {}\n\n
```

### Railway Compatibility
- SSE over HTTP/1.1 works natively on Railway
- Add `X-Accel-Buffering: no` header (Nginx proxy compatibility)
- `Cache-Control: no-cache, no-store` header
- Keep-alive: yield SSE comment (`: keepalive\n\n`) every 15s during long operations
- Non-streaming endpoint remains unchanged as fallback

---

## Step 6: Postgres Chat Message Broadcast Trigger

**Why:** "Logik, die in Postgres sein sollte, in Postgres implementiert wird." Follows the epoch chat pattern (migration 037).

### New File
- `supabase/migrations/20260404100000_179_chat_message_broadcast.sql`

### SQL
```sql
-- Migration 179: Chat message broadcast -- Supabase Realtime trigger
-- Broadcasts new agent chat messages to the conversation's Realtime channel.
-- Follows the epoch_chat pattern from migration 037.

CREATE OR REPLACE FUNCTION broadcast_chat_message()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM realtime.send(
    jsonb_build_object(
      'id', NEW.id,
      'conversation_id', NEW.conversation_id,
      'sender_role', NEW.sender_role,
      'content', NEW.content,
      'agent_id', NEW.agent_id,
      'metadata', NEW.metadata,
      'created_at', NEW.created_at
    ),
    'new_message',
    'chat:' || NEW.conversation_id::text || ':messages',
    true
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_broadcast_chat_message
  AFTER INSERT ON chat_messages
  FOR EACH ROW EXECUTE FUNCTION broadcast_chat_message();
```

### Supabase.com Compatibility
- `realtime.send()` is available on all Supabase plans
- Private channels require authenticated subscription
- Topic naming follows existing convention: `chat:{conversationId}:messages`
- Payload uses `jsonb_build_object` (not `to_jsonb(NEW)`) to control exactly which fields are broadcast

---

## Step 7: Frontend SSE Consumer

### New File
- `frontend/src/services/chat/ChatStreamConsumer.ts`

### API
```typescript
export interface SSEEvent {
  event: string;
  data: Record<string, unknown>;
}

export async function streamChatResponse(
  simulationId: string,
  conversationId: string,
  content: string,
  options: {
    onUserConfirmed: (message: ChatMessage) => void;
    onAgentStart: (agentId: string, agentName: string, index: number, total: number) => void;
    onToken: (agentId: string, token: string) => void;
    onAgentDone: (agentId: string, message: ChatMessage) => void;
    onError: (error: string) => void;
    signal?: AbortSignal;
  },
): Promise<void>
```

### Implementation
- Uses `fetch()` with POST (not EventSource API -- that doesn't support POST or auth headers)
- Reads via `response.body!.getReader()` + `TextDecoder({ stream: true })`
- Parses SSE format: splits on `\n\n`, extracts `event:` and `data:` lines
- Calls appropriate callback per event type
- AbortController support for navigation/cancellation
- Token from `appState.accessToken.value`

---

## Step 8: Wire Streaming into ChatWindow

### File Modified
- `frontend/src/components/chat/ChatWindow.ts`

### Changes to `_handleSendMessage()`
```typescript
// 1. Optimistic message via ChatSessionStore
const tempId = chatStore.addOptimistic(conversationId, content, conversationId);

// 2. Set streaming state
session.streaming.value = true;
session.streamBuffer.value = '';

// 3. Create AbortController
this._streamAbort = new AbortController();

// 4. Stream via SSE
await streamChatResponse(simulationId, conversationId, content, {
  onUserConfirmed: (msg) => chatStore.confirmOptimistic(conversationId, tempId, msg),
  onAgentStart: (agentId, name) => {
    session.streamBuffer.value = '';
    // Update streaming agent info for ChatFeed participant display
  },
  onToken: (agentId, token) => chatStore.appendStreamChunk(conversationId, token),
  onAgentDone: (agentId, msg) => {
    chatStore.finalizeStream(conversationId, msg);
    // For group chat: reset buffer for next agent
    session.streaming.value = agents.length > 1; // Keep streaming for next agent
  },
  onError: (error) => { session.error.value = error; },
  signal: this._streamAbort.signal,
});

// 5. Final cleanup
session.streaming.value = false;
```

### Non-Streaming Fallback
If `streamChatResponse` throws (e.g., 404 during rolling deploy), fall back to existing `chatApi.sendMessage()`.

### AbortController Cleanup
- Store `_streamAbort` on component
- Abort in `disconnectedCallback()` (user navigates away)
- Abort when conversation changes

---

## Step 9: Typing Indicators via Supabase Broadcast

### File Modified
- `frontend/src/services/realtime/RealtimeService.ts`

### New Methods
```typescript
joinConversation(conversationId: string): void
leaveConversation(conversationId: string): void
broadcastTyping(conversationId: string, userId: string, userName: string): void
```

### Channel
- Name: `chat:{conversationId}:typing`
- Event: `typing`
- Payload: `{ user_id, name, at: Date.now() }`
- Private: true

### Typing Signal
- Add `chatTypingUsers` signal to RealtimeService
- On `typing` event: add/refresh user, auto-clear after 3s
- ChatWindow passes `realtimeService.chatTypingUsers.value` to ChatFeed's `typingUsers` prop

### Integration in ChatWindow
- On `composer-typing` event from ChatComposer → call `realtimeService.broadcastTyping()`
- On conversation change → `joinConversation()` / `leaveConversation()`
- Debounce typing broadcast: max 1 per 2s

### No DB Logic Needed
Typing state is inherently transient -- pure Broadcast, no triggers or tables.

---

## Step 10: Reconnection + Broadcast Replay

### File Modified
- `frontend/src/services/realtime/RealtimeService.ts`

### Broadcast Replay
supabase-js v2.95.3 supports broadcast replay. When joining a conversation channel:
```typescript
supabase.channel(`chat:${conversationId}:messages`, {
  config: {
    private: true,
    broadcast: { replay: { since: lastTimestamp, limit: 25 } },
  },
})
```

### SSE Reconnection
- If SSE stream drops mid-response, the partially streamed content is lost
- On SSE error during streaming: show error toast, reset streaming state
- User can re-send the message (the partially generated AI response was NOT saved to DB -- persistence happens only after full completion)
- No auto-retry of SSE streams (would cause duplicate AI generation)

---

## Commit Sequence

1. **Step 1:** "feat(chat): Wire ChatWindow to ChatFeed + ChatComposer (Phase 1b migration)"
2. **Steps 2-5:** "feat(chat): SSE streaming backend -- OpenRouter stream_completion, ChatAIService streaming, /messages/stream endpoint"
3. **Step 6:** "feat(chat): Postgres broadcast trigger for chat_messages + remove redundant last_message_at update"
4. **Steps 7-8:** "feat(chat): Frontend SSE consumer + ChatWindow streaming integration"
5. **Steps 9-10:** "feat(chat): Typing indicators via Supabase Broadcast + reconnection handling"

---

## Verification

### Backend
- `cd /Users/mleihs/Dev/velgarien-rebuild && python3 -m ruff check backend/` -- clean
- `python3 -m ruff format --check backend/` -- clean

### Frontend
- `cd frontend && npx tsc --noEmit` -- clean
- `bash frontend/scripts/lint-color-tokens.sh` -- clean
- `bash frontend/scripts/lint-llm-content.sh` -- clean

### E2E Testing
1. Open Agent Chat, send message → tokens stream in real-time
2. Group chat (2+ agents) → agents respond sequentially, each streaming
3. Navigate away mid-stream → AbortController cancels cleanly
4. Network disconnect during stream → error toast, no partial message saved
5. Typing indicator appears when composing
6. New messages from other tabs appear via broadcast
7. Railway deploy: SSE works through Railway proxy
8. Non-streaming fallback: if `/messages/stream` returns 404, falls back to existing endpoint

### DB
- `supabase migration up` -- migration 179 applies cleanly
- Insert into `chat_messages` → broadcast received on `chat:{convId}:messages` channel
- `message_count` and `last_message_at` still update via trigger 009 (not Python)

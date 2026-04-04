# Chat System Redesign — Unified Agent Chat + Epoch Chat

> **Status:** Phase 0-6 COMPLETE — Phase 7 (Game-Specific Features) next  
> **Scope:** Full redesign of Agent Chat + Epoch Chat into a unified, premium chat system  
> **Components affected:** 7 frontend, 3 backend services, 1 router, 1 model file  
> **New components:** ~12 frontend, ~3 backend  
> **Phase 6 completed:** 2026-04-04 — ConversationList (search/pinned/date groups/rename), ChatExporter, draft auto-save, reaction realtime, rename endpoint  
> **Phase 5 completed:** 2026-04-04 — MessageActions, ReactionBar, Migration 180, 9 icons, reaction RPCs  
> **Research basis:** 12 parallel research strands (300+ sources), architecture audit  

---

## Table of Contents

1. [Architecture Audit — Current State](#1-architecture-audit--current-state)
2. [Design Vision](#2-design-vision)
3. [Shared Component Architecture — Unified Chat Core](#3-shared-component-architecture--unified-chat-core)
4. [Phase 0: Backend Refactoring (Foundation)](#4-phase-0-backend-refactoring-foundation)
5. [Phase 1: Unified Chat Core Components](#5-phase-1-unified-chat-core-components)
6. [Phase 2: Rich Message Rendering](#6-phase-2-rich-message-rendering)
7. [Phase 3: SSE Streaming + Typing Indicators](#7-phase-3-sse-streaming--typing-indicators)
8. [Phase 4: Command System + Search](#8-phase-4-command-system--search)
9. [Phase 5: Message Actions + Reactions](#9-phase-5-message-actions--reactions)
10. [Phase 6: Conversation Management + Export](#10-phase-6-conversation-management--export)
11. [Phase 7: Game-Specific Features](#11-phase-7-game-specific-features)
12. [Phase 8: Performance + Polish](#12-phase-8-performance--polish)
13. [Design Tokens & Visual Language](#13-design-tokens--visual-language)
14. [Accessibility Contract](#14-accessibility-contract)
15. [Migration Strategy](#15-migration-strategy)
16. [Dependencies & New Packages](#16-dependencies--new-packages)
17. [File Inventory](#17-file-inventory)
18. [Addendum A: Lit Reactive Controllers](#18-addendum-a-lit-reactive-controllers)
19. [Addendum B: Modern CSS Platform APIs](#19-addendum-b-modern-css-platform-apis)
20. [Addendum C: Open Source Chat Code Patterns](#20-addendum-c-open-source-chat-code-patterns)
21. [Addendum D: OpenRouter Streaming + Supabase Realtime Production Guide](#21-addendum-d-openrouter-streaming--supabase-realtime-production-guide)
22. [Research Sources](#22-research-sources)

---

## 1. Architecture Audit — Current State

### Scores

| Component | Quality | Key Issue |
|-----------|---------|-----------|
| `chat_service.py` | 7/10 | Duplicated `_load_*` methods, missing ownership checks |
| `chat_ai_service.py` | 6/10 | 60% code duplication between single/group generate, no streaming |
| `routers/chat.py` | 7/10 | Business logic leaking (agent count → method dispatch) |
| `models/chat.py` | 8/10 | Missing fields for AI metadata (tokens, model, duration) |
| `EpochChatPanel.ts` | 5/10 | 14 duplicated state props, 4 separate effect subscriptions |
| `ChatWindow.ts` | 5.5/10 | Massive duplication with EpochChatPanel, fragile typing indicator |
| `MessageList.ts` | 6.5/10 | O(N) agent lookup per message, timezone-naive date comparison |
| `MessageInput.ts` | 7.5/10 | Hard-coded limits, no shared controller pattern |

### Critical Issues Found

**Backend:**

1. **Code duplication in `ChatAIService`** — `generate_response()` and `generate_group_response()` share ~60% identical logic (loading conversation, building message history, calling OpenRouter). Must merge into `_generate_single_response()` helper.

2. **Business logic in router** — Router decides single vs. group based on agent count (lines 114-136). This belongs in a service method.

3. **No streaming** — All AI responses are blocking. Group chat with 3 agents = 3+ minute wait with zero feedback. This is the #1 UX pain point.

4. **Missing ownership validation** — `ChatService` doesn't verify conversation belongs to requesting user. Security boundary leak.

5. **No token accounting** — `MAX_MEMORY_MESSAGES = 50` hard-coded, no consideration of model context window limits.

6. **Mock mode inline** — `if settings.forge_mock_mode` scattered across both generate methods instead of being a decorator/middleware.

**Frontend:**

7. **Massive duplication between Agent Chat and Epoch Chat** — Input state management, send logic, focus restoration, optimistic updates, scroll-to-bottom all implemented independently in both. Copy-paste architecture.

8. **No shared chat state manager** — Each component reinvents pagination, loading, error handling, unread tracking.

9. **Markdown not rendered** — `renderSafeMarkdown()` utility exists but is NOT used in chat messages. Agent responses show raw markdown literally (asterisks, backticks visible).

10. **Agent lookup O(N) per message** — `MessageList._getMessageAgent()` does `Array.find()` per message instead of `Map` lookup.

11. **Timezone-naive date comparison** — `_isSameDay()` doesn't consider user timezone.

12. **Event references static** — Shown at top regardless of when they were referenced. Should be interleaved in the timeline.

### What's Good (Preserve)

- Batch loading pattern in `list_conversations()` — 2 queries instead of N+1
- Mood context injection in AI service — Sophisticated emotional state
- Event reference concept — Contextualizing conversations with simulation events
- Optimistic message insertion pattern — Correct UX, needs refinement
- Rate limiting on AI endpoints
- Existing design token system — Complete color/animation/spacing/typography

---

## 2. Design Vision

### Inspiration Sources

**From Zulip:**
- Topic-based threading with colored recipient bars for visual scanning
- 80+ keyboard shortcuts with vim-style navigation
- Pill-based search with 15+ composable operators
- Sliding DOM window (250 messages) instead of virtual scrolling
- Copy button on code blocks via ClipboardJS
- Smart compose box with formatting toolbar, preview mode, saved snippets
- Server-side markdown rendering with rich custom extensions (mentions, spoilers, polls, math)

**From Discord:**
- Slash command autocomplete with parameter types and fuzzy search
- Components V2 structured message format (sections, thumbnails, galleries, containers)
- Right-click context menu with full action set
- Embed cards with colored side borders, structured fields, thumbnails
- Inline message editing with `(edited)` indicator
- `highlight.js` for code block syntax highlighting
- Reaction pills with count + hover to see who reacted
- Thread sidebar panel pattern

**From ChatGPT/Claude/Gemini:**
- Full-width AI response cards (not bubbles) for rich content
- Streaming with blinking cursor
- Conversation branching on edit/regenerate
- Collapsible reasoning traces
- Copy/regenerate/thumbs hover toolbar per message
- Follow-up suggestion chips

**From Disco Elysium (Game-Specific):**
- 24 skill personalities with hand-painted portraits and distinct voices
- Twitter-inspired scrolling text column
- Skill-check visual markers with dice roll UI
- Polyphonic internal conversation (multiple voices in one stream)

### Visual Direction

**Dark glassmorphism with brutalist typography** — extending the existing design system:

```
Surface hierarchy:
  Base:     var(--color-surface)         #0a0a0a
  Glass:    rgba(255, 255, 255, 0.04)    on ::after overlay, NOT on layout container
  Raised:   var(--color-surface-raised)  #111111
  Input:    rgba(255, 255, 255, 0.06)    subtle distinction

Message differentiation:
  User:     Right-aligned, --color-primary at 12% opacity, 3px right border
  Agent:    Left-aligned, full-width card, 3px left border in agent color
  System:   Centered, muted, no border
  Event:    Full-width card with --color-info accent

Typography:
  Messages: var(--font-body) at var(--text-sm), --leading-normal
  Agent:    var(--font-brutalist) name label, --tracking-brutalist
  Code:     var(--font-mono), highlight.js theme matched to design tokens
  Time:     var(--text-xs), var(--color-text-muted)
```

**Critical CSS rule:** No `backdrop-filter`, `filter`, `transform`, `will-change`, or `contain: paint` on layout containers (shells, panels). Glass effects use `::after` pseudo-elements on leaf nodes only. This prevents broken `position: fixed` modals/lightboxes (documented in CLAUDE.md).

---

## 3. Shared Component Architecture — Unified Chat Core

The central refactoring insight: **Agent Chat and Epoch Chat are the same system with different data sources.** Both have messages, input, send logic, scroll management, typing indicators, and unread tracking. The redesign unifies them into a shared component library.

### Component Tree (Target Architecture)

```
┌─────────────────────────────────────────────────────────┐
│  ChatShell (layout orchestrator)                        │
│  ┌──────────┐  ┌──────────────────────────────────────┐ │
│  │ ChatSide │  │ ChatPanel                            │ │
│  │ bar      │  │ ┌────────────────────────────────────┐│ │
│  │          │  │ │ ChatHeader                        ││ │
│  │ Conver-  │  │ │ (title, agents, actions)          ││ │
│  │ sation   │  │ ├────────────────────────────────────┤│ │
│  │ List     │  │ │ ChatFeed                          ││ │
│  │          │  │ │ (messages, events, separators)    ││ │
│  │ Search   │  │ │ ┌─────────────────────────────┐   ││ │
│  │          │  │ │ │ ChatMessage (per message)   │   ││ │
│  │ Filters  │  │ │ │ ├─ ChatBubble              │   ││ │
│  │          │  │ │ │ │  ├─ MarkdownRenderer     │   ││ │
│  │          │  │ │ │ │  ├─ CodeBlock            │   ││ │
│  │          │  │ │ │ │  └─ MessageActions       │   ││ │
│  │          │  │ │ │ ├─ ChatAvatar              │   ││ │
│  │          │  │ │ │ └─ ReactionBar             │   ││ │
│  │          │  │ │ └─────────────────────────────┘   ││ │
│  │          │  │ ├────────────────────────────────────┤│ │
│  │          │  │ │ ChatComposer                      ││ │
│  │          │  │ │ (input, commands, formatting)     ││ │
│  │          │  │ └────────────────────────────────────┘│ │
│  └──────────┘  └──────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Shared vs. Specialized

| Component | Shared | Agent Chat adds | Epoch Chat adds |
|-----------|--------|-----------------|-----------------|
| `ChatFeed` | Messages, scroll, grouping, separators | Event reference interleaving | Channel tabs (epoch/team) |
| `ChatMessage` | Avatar, bubble, timestamp, actions | Multi-agent colors, agent name | Team badge, player name |
| `ChatBubble` | Markdown rendering, code blocks | Agent personality styling | Military HUD styling |
| `ChatComposer` | Input, send, keyboard, char limit | Event picker, agent selector | Channel-scoped sending |
| `ChatHeader` | Title, participants, action buttons | Agent portraits, event bar | Epoch status, ready button |
| `MessageActions` | Copy, reactions | Regenerate, branch, edit | — |
| `TypingIndicator` | Animated dots, name | Agent-specific phrases | Player names |

### State Architecture (Preact Signals)

```typescript
// NEW: frontend/src/services/chat/ChatSessionStore.ts

import { signal, computed, batch } from '@preact/signals-core';

export interface ChatSession {
  id: string;
  messages: signal<ChatMessage[]>;
  loading: signal<boolean>;
  sending: signal<boolean>;
  streaming: signal<boolean>;
  streamBuffer: signal<string>;
  hasMore: signal<boolean>;
  unread: signal<number>;
  draft: signal<string>;
  typing: signal<TypingUser[]>;
  error: signal<string | null>;
}

export class ChatSessionStore {
  private _sessions = new Map<string, ChatSession>();

  getOrCreate(sessionId: string): ChatSession;
  addMessage(sessionId: string, message: ChatMessage): void;
  appendStreamChunk(sessionId: string, chunk: string): void;
  markRead(sessionId: string): void;
  loadOlder(sessionId: string, api: ChatApiLike): Promise<void>;
  saveDraft(sessionId: string, text: string): void;  // → localStorage
  restoreDraft(sessionId: string): string;
}

export const chatStore = new ChatSessionStore();
```

This replaces:
- `ChatWindow._messages`, `._loading`, `._sending`, `._aiTyping`
- `EpochChatPanel._epochMessages`, `._teamMessages`, `._sending`, `._unreadEpoch`, etc.
- All 4 separate effect subscriptions in EpochChatPanel

---

## 4. Phase 0: Backend Refactoring (Foundation) ✅ COMPLETE (2026-04-04, 351f779)

> Fix architecture issues before adding features. No new features in this phase.

### 0.1 Merge ChatAIService Generate Methods

**File:** `backend/services/chat_ai_service.py`

Extract shared logic into `_generate_single_response()`:

```python
async def _generate_single_response(
    self, supabase, conversation_id: str, agent: AgentBrief,
    message_history: list[dict], event_context: str | None,
    locale: str, *, group_instruction: str | None = None
) -> MessageResponse:
    """Core generation logic for a single agent response."""
    # 1. Load agent memory (top_k=8)
    # 2. Build system prompt (agent.system_prompt + language + events + group)
    # 3. Inject mood context
    # 4. Call OpenRouter
    # 5. Store response + extract memories
    # 6. Log AI usage
    # 7. Return MessageResponse

async def generate_response(self, supabase, conversation_id, ...):
    agent = agents[0]
    history = await self._load_history(...)
    return await self._generate_single_response(
        supabase, conversation_id, agent, history, event_context, locale
    )

async def generate_group_response(self, supabase, conversation_id, ...):
    history = await self._load_history(...)
    responses = []
    for agent in agents:
        resp = await self._generate_single_response(
            supabase, conversation_id, agent, history, event_context, locale,
            group_instruction=self._build_group_instruction(agent, agents)
        )
        history.append({"role": "assistant", "content": resp.content})
        responses.append(resp)
    return responses
```

### 0.2 Move Orchestration to Service

**File:** `backend/routers/chat.py` → `backend/services/chat_service.py`

Move the agent-count dispatch logic out of the router:

```python
# chat_service.py — NEW method
@staticmethod
async def generate_ai_response(
    supabase, conversation_id: str, user_message: MessageResponse,
    simulation_id: str, locale: str
) -> list[MessageResponse]:
    """Orchestrate AI response generation (single or group)."""
    agents = await ChatService._load_conversation_agents(supabase, str(conversation_id))
    
    resolver = ExternalServiceResolver(supabase, simulation_id)
    ai_config = await resolver.get_ai_provider_config()
    chat_ai = ChatAIService(ai_config)
    
    if len(agents) > 1:
        return await chat_ai.generate_group_response(supabase, conversation_id, ...)
    else:
        resp = await chat_ai.generate_response(supabase, conversation_id, ...)
        return [resp]
```

Router becomes thin:
```python
# routers/chat.py
if body.generate_response:
    responses = await ChatService.generate_ai_response(
        supabase, str(conversation_id), user_msg, str(simulation_id), locale
    )
```

### 0.3 Deduplicate _load_* Methods

**File:** `backend/services/chat_service.py`

Extract shared helpers:

```python
@staticmethod
async def _batch_load_agents(supabase, conversation_ids: list[str]) -> dict[str, list[AgentBrief]]:
    """Batch load agents for multiple conversations. Returns {conv_id: [AgentBrief]}."""
    # Single query, indexed by conversation_id

@staticmethod
async def _batch_load_event_refs(supabase, conversation_ids: list[str]) -> dict[str, list[EventReferenceResponse]]:
    """Batch load event references. Returns {conv_id: [EventReferenceResponse]}."""
    # Single query, indexed by conversation_id
```

Used by both `list_conversations()` and `create_conversation()`.

### 0.4 Add Ownership Validation

**File:** `backend/services/chat_service.py`

```python
@staticmethod
async def _verify_ownership(supabase, conversation_id: str, user_id: str) -> None:
    """Verify user owns this conversation. Raises 404 if not found/owned."""
    result = await supabase.table("chat_conversations") \
        .select("id") \
        .eq("id", conversation_id) \
        .eq("user_id", user_id) \
        .maybe_single() \
        .execute()
    if not result.data:
        raise HTTPException(404, "Conversation not found")
```

### 0.5 Normalize Response Type

**File:** `backend/models/chat.py`

```python
class ChatAIResponseResult(BaseModel):
    """Unified response for AI-generated messages."""
    user_message: MessageResponse
    assistant_messages: list[MessageResponse]
```

Always returns a list, eliminating the `MessageResponse | list[MessageResponse]` union.

### 0.6 Add AI Metadata to MessageResponse

**File:** `backend/models/chat.py`

```python
class MessageResponse(BaseModel):
    # ... existing fields ...
    model_used: str | None = None        # e.g., "anthropic/claude-sonnet-4"
    token_count: int | None = None       # Total tokens consumed
    generation_ms: int | None = None     # Response time in milliseconds
```

### 0.7 Extract Mock Mode Decorator

**File:** `backend/services/chat_ai_service.py`

```python
def mock_if_enabled(func):
    """Decorator: return mock response if forge_mock_mode is active."""
    @functools.wraps(func)
    async def wrapper(self, *args, **kwargs):
        if settings.forge_mock_mode:
            return self._generate_mock_response(...)
        return await func(self, *args, **kwargs)
    return wrapper
```

---

## 5. Phase 1: Unified Chat Core Components ✅ COMPLETE (2026-04-04)

> Extract shared components. Both Agent Chat and Epoch Chat consume these.
>
> **Implementation notes (2026-04-04):**
> - 10 new files created (4 services, 6 components), 1 existing file fixed (markdown.ts)
> - @lit/context@^1.1.6 installed as dependency
> - Self-audit found+fixed 8 issues (1 critical: PURIFY_CONFIG, 2 high: O(N²) + object alloc)
> - ScrollController uses `requestAutoScroll()` pattern instead of auto-scroll on every update
> - CSS Grid auto-resize replaces JS scrollHeight in ChatComposer
> - Streaming message uses content-change caching (Lit === dirty check)
> - Follow-ups: agentAltText i18n, content-visibility intrinsic sizes, streaming agent ID, chat tests

### 1.1 ChatSessionStore (State Manager)

**New file:** `frontend/src/services/chat/ChatSessionStore.ts`

Single source of truth for all chat state. Replaces 14+ `@state()` properties scattered across components.

```typescript
import { signal, computed, batch, effect } from '@preact/signals-core';

export interface ChatSession {
  readonly messages: Signal<ChatMessage[]>;
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

export class ChatSessionStore {
  private _sessions = new Map<string, ChatSession>();

  getOrCreate(sessionId: string): ChatSession {
    if (!this._sessions.has(sessionId)) {
      this._sessions.set(sessionId, this._createSession());
    }
    return this._sessions.get(sessionId)!;
  }

  addMessage(sessionId: string, message: ChatMessage): void {
    const session = this.getOrCreate(sessionId);
    const existing = session.messages.value;
    // Deduplicate by ID
    if (!existing.some(m => m.id === message.id)) {
      session.messages.value = [...existing, message];
    }
  }

  addOptimistic(sessionId: string, content: string, senderId: string): string {
    const tempId = `temp-${Date.now()}`;
    this.addMessage(sessionId, {
      id: tempId, content, sender_role: 'user', sender_id: senderId,
      created_at: new Date().toISOString(), _optimistic: true,
    });
    return tempId;
  }

  removeOptimistic(sessionId: string, tempId: string): void {
    const session = this.getOrCreate(sessionId);
    session.messages.value = session.messages.value.filter(m => m.id !== tempId);
  }

  appendStreamChunk(sessionId: string, chunk: string): void {
    const session = this.getOrCreate(sessionId);
    session.streamBuffer.value += chunk;
  }

  saveDraft(sessionId: string, text: string): void {
    const session = this.getOrCreate(sessionId);
    session.draft.value = text;
    localStorage.setItem(`velg-chat-draft-${sessionId}`, text);
  }

  restoreDraft(sessionId: string): string {
    return localStorage.getItem(`velg-chat-draft-${sessionId}`) ?? '';
  }

  clearDraft(sessionId: string): void {
    const session = this.getOrCreate(sessionId);
    session.draft.value = '';
    localStorage.removeItem(`velg-chat-draft-${sessionId}`);
  }

  markRead(sessionId: string): void {
    const session = this.getOrCreate(sessionId);
    session.unread.value = 0;
  }

  async loadOlder(sessionId: string, loadFn: (before: string) => Promise<ChatMessage[]>): Promise<void> {
    const session = this.getOrCreate(sessionId);
    const oldest = session.messages.value[0];
    if (!oldest || session.loading.value) return;
    
    session.loading.value = true;
    try {
      const older = await loadFn(oldest.created_at);
      if (older.length === 0) {
        session.hasMore.value = false;
      } else {
        session.messages.value = [...older, ...session.messages.value];
      }
    } finally {
      session.loading.value = false;
    }
  }

  dispose(sessionId: string): void {
    this._sessions.delete(sessionId);
  }
}

export const chatStore = new ChatSessionStore();
```

### 1.2 ChatFeed (Message List)

**New file:** `frontend/src/components/chat/core/ChatFeed.ts`

Replaces both `MessageList.ts` (agent) and the message rendering in `EpochChatPanel.ts`.

Key improvements over current `MessageList`:
- **Agent lookup via Map** instead of `Array.find()` per message
- **Timezone-aware date comparison** using `Intl.DateTimeFormat`
- **Timeline interleaving** — events inserted at their `referenced_at` timestamp
- **`role="log"` + `aria-live="polite"`** for screen reader support
- **`@starting-style`** for message entrance animations (pure CSS, no JS)
- **Scroll anchoring** via `overflow-anchor` + sentinel element
- **IntersectionObserver** for "scroll to bottom" FAB and history loading

```typescript
@customElement('velg-chat-feed')
export class ChatFeed extends LitElement {
  @property({ type: Array }) messages: ChatMessage[] = [];
  @property({ type: Array }) participants: Participant[] = [];    // Agents or Players
  @property({ type: Array }) eventReferences: EventReference[] = [];
  @property({ type: String }) currentUserId = '';
  @property({ type: Boolean }) streaming = false;
  @property({ type: String }) streamContent = '';
  @property({ type: Array }) typingUsers: TypingUser[] = [];
  @property({ type: Boolean }) hasMore = false;

  // Derived: Map<id, Participant> for O(1) lookup
  private _participantMap = new Map<string, Participant>();

  // Scroll management
  private _isAtBottom = true;
  private _bottomObserver?: IntersectionObserver;

  // Timeline: merged messages + events, sorted by timestamp
  private get _timeline(): TimelineItem[] { ... }
}
```

### 1.3 ChatMessage (Single Message)

**New file:** `frontend/src/components/chat/core/ChatMessage.ts`

Unified message component for all chat contexts:

```typescript
@customElement('velg-chat-message')
export class ChatMessage extends LitElement {
  @property({ type: Object }) message!: ChatMessageData;
  @property({ type: Object }) sender?: Participant;
  @property({ type: Boolean }) grouped = false;       // Same sender as previous
  @property({ type: Boolean }) lastInGroup = false;    // Last from this sender
  @property({ type: String }) accentColor = '';        // Agent/team color
  @property({ type: Boolean }) showActions = false;    // Hover state from parent

  // Renders: avatar + bubble + timestamp + reactions + actions
}
```

### 1.4 ChatBubble (Message Content Rendering)

**New file:** `frontend/src/components/chat/core/ChatBubble.ts`

Handles markdown rendering, code blocks, streaming content:

```typescript
@customElement('velg-chat-bubble')
export class ChatBubble extends LitElement {
  @property({ type: String }) content = '';
  @property({ type: String }) senderRole: 'user' | 'assistant' | 'system' = 'user';
  @property({ type: Boolean }) streaming = false;

  // User messages: plain text (white-space: pre-wrap)
  // Assistant messages: renderSafeMarkdown() with extended tag set
  // Streaming: re-parse accumulated text per RAF frame + blinking cursor
}
```

### 1.5 ChatComposer (Unified Input)

**New file:** `frontend/src/components/chat/core/ChatComposer.ts`

Replaces both `MessageInput.ts` and EpochChatPanel's inline input:

```typescript
@customElement('velg-chat-composer')
export class ChatComposer extends LitElement {
  @property({ type: Number }) charLimit = 10000;
  @property({ type: Number }) charWarn = 8000;
  @property({ type: Boolean }) disabled = false;
  @property({ type: Boolean }) sending = false;
  @property({ type: String }) placeholder = '';
  @property({ type: Boolean }) enableCommands = false;   // Slash commands
  @property({ type: Boolean }) enableFormatting = false;  // Bold/italic/code toolbar

  // Events: 'send-message', 'typing', 'command-invoke'
  // Features: auto-resize (CSS Grid trick), draft persistence, Shift+Enter
  // Keyboard: Ctrl+B bold, Ctrl+I italic, Ctrl+E code (when enableFormatting)
}
```

**Auto-resize technique** (CSS Grid trick, not JS `scrollHeight`):

```css
.composer-wrapper {
  display: grid;
}
.composer-wrapper::after,
.composer-wrapper > textarea {
  grid-area: 1 / 1 / 2 / 2;
  font: inherit;
  padding: var(--space-3) var(--space-4);
  white-space: pre-wrap;
  word-wrap: break-word;
}
.composer-wrapper::after {
  content: attr(data-value) ' ';
  visibility: hidden;
}
.composer-wrapper > textarea {
  resize: none;
  min-height: 44px;
  max-height: 200px;
  overflow-y: auto;
  field-sizing: content; /* Progressive enhancement */
}
```

### 1.6 ChatHeader

**New file:** `frontend/src/components/chat/core/ChatHeader.ts`

```typescript
@customElement('velg-chat-header')
export class ChatHeader extends LitElement {
  @property({ type: String }) title = '';
  @property({ type: Array }) participants: Participant[] = [];
  @property({ type: Boolean }) showSearch = false;

  // Slots: 'actions' (right side), 'subtitle' (below title)
  // Features: participant avatars (VelgAvatar), overflow "+N", search toggle
}
```

### 1.7 TypingIndicator

**New file:** `frontend/src/components/chat/core/TypingIndicator.ts`

Extracted from inline implementation in both ChatWindow and EpochChatPanel:

```typescript
@customElement('velg-typing-indicator')
export class TypingIndicator extends LitElement {
  @property({ type: Array }) users: TypingUser[] = [];
  @property({ type: String }) customPhrase = '';  // "General Kael ponders your question..."

  // 3 bouncing dots + name(s) text
  // role="status" aria-live="polite" for accessibility
  // prefers-reduced-motion: static dots with varying opacity
}
```

---

## 6. Phase 2: Rich Message Rendering ✅ COMPLETE

> **Implemented 2026-04-04.** 2 new files, 2 modified, 2 npm deps. Self-audit: 3 issues found & fixed.
> Key deviations from plan: (1) Separate `Marked` instances instead of global `marked.use()` to avoid polluting `renderSafeMarkdown`. (2) LIFO walkTokens ordering to preserve raw code for copy button. (3) `@layer hljs` for cascade isolation. (4) `msg('Copy')` i18n instead of hardcoded English.

### 2.1 Extend Markdown Rendering

**File:** `frontend/src/utils/markdown.ts`

Extend existing `renderSafeMarkdown()` with chat-specific features:

```typescript
import { marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import DOMPurify from 'dompurify';

// Extended tag allowlist for chat
const CHAT_PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'h2', 'h3', 'h4', 'p', 'br', 'strong', 'em', 'del',
    'ul', 'ol', 'li', 'a', 'blockquote',
    'pre', 'code', 'span',           // Code blocks + syntax highlighting
    'table', 'thead', 'tbody', 'tr', 'th', 'td',  // GFM tables
    'details', 'summary',             // Collapsible sections
    'hr',
  ],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'data-code', 'data-lang'],
};

// Integrate highlight.js via marked-highlight
marked.use(markedHighlight({
  langPrefix: 'hljs language-',
  highlight(code: string, lang: string) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  }
}));

// Custom renderer for code blocks with copy button
marked.use({
  renderer: {
    code(token) {
      return `
        <div class="code-block">
          <div class="code-block__header">
            <span class="code-block__lang">${token.lang || ''}</span>
            <button class="code-block__copy" data-code="${encodeURIComponent(token.text)}">
              ${msg('Copy')}
            </button>
          </div>
          <pre><code class="hljs">${token.text}</code></pre>
        </div>`;
    }
  },
  hooks: {
    postprocess(html: string) {
      return DOMPurify.sanitize(html, CHAT_PURIFY_CONFIG) as string;
    }
  }
});

export function renderChatMarkdown(text: string): DirectiveResult {
  return unsafeHTML(marked.parse(text) as string);
}
```

### 2.2 highlight.js Integration

**Approach:** Dynamic language loading with `adoptedStyleSheets` for Shadow DOM theming.

```typescript
// frontend/src/utils/code-highlight.ts

import hljs from 'highlight.js/lib/core';

// Pre-register common languages
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import sql from 'highlight.js/lib/languages/sql';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import css from 'highlight.js/lib/languages/css';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('json', json);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('css', css);

// Theme CSS as adoptedStyleSheet (shared across all shadow roots)
import hljsThemeCSS from './hljs-dark-theme.css?raw';

export const hljsStyleSheet = new CSSStyleSheet();
hljsStyleSheet.replaceSync(hljsThemeCSS);

export { hljs };
```

**Theme:** Custom dark theme using design tokens:

```css
/* frontend/src/utils/hljs-dark-theme.css */
.hljs {
  background: var(--color-surface-sunken);
  color: var(--color-text-primary);
}
.hljs-keyword { color: #c792ea; }
.hljs-string  { color: #c3e88d; }
.hljs-number  { color: #f78c6c; }
.hljs-comment { color: var(--color-text-muted); font-style: italic; }
.hljs-title   { color: #82aaff; }
.hljs-attr    { color: #ffcb6b; }
.hljs-built_in { color: #89ddff; }
```

### 2.3 Code Block Copy-to-Clipboard

Delegated click handler on the ChatBubble's rendered markdown container:

```typescript
// In ChatBubble, after render
firstUpdated() {
  this.renderRoot.querySelector('.bubble-content')?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.code-block__copy');
    if (!btn) return;
    const code = decodeURIComponent(btn.getAttribute('data-code') || '');
    navigator.clipboard.writeText(code).then(() => {
      btn.textContent = msg('Copied!');
      setTimeout(() => { btn.textContent = msg('Copy'); }, 2000);
    });
  });
}
```

### 2.4 Markdown Styles for Shadow DOM

```css
/* Scoped within ChatBubble */
.bubble-content p { margin: 0 0 0.5em; }
.bubble-content p:last-child { margin-bottom: 0; }
.bubble-content strong { font-weight: var(--font-bold); }
.bubble-content em { font-style: italic; }

.bubble-content blockquote {
  border-left: 3px solid var(--color-primary);
  padding-left: var(--space-3);
  margin: var(--space-2) 0;
  color: var(--color-text-secondary);
}

.bubble-content code:not(.hljs) {
  background: var(--color-surface-sunken);
  padding: 0.15em 0.4em;
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 0.9em;
}

.code-block {
  margin: var(--space-2) 0;
  border: var(--border-light);
  border-radius: 6px;
  overflow: hidden;
}
.code-block__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-1) var(--space-3);
  background: var(--color-surface-sunken);
  border-bottom: var(--border-light);
}
.code-block__lang {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  text-transform: uppercase;
}
.code-block__copy {
  font-family: var(--font-brutalist);
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: var(--tracking-brutalist);
}
.code-block__copy:hover {
  color: var(--color-primary);
}
.code-block pre {
  margin: 0;
  padding: var(--space-3);
  overflow-x: auto;
}

.bubble-content table {
  border-collapse: collapse;
  width: 100%;
  margin: var(--space-2) 0;
}
.bubble-content th, .bubble-content td {
  padding: var(--space-1) var(--space-2);
  border: var(--border-light);
  text-align: left;
}
.bubble-content th {
  font-family: var(--font-brutalist);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: var(--tracking-brutalist);
  background: var(--color-surface-sunken);
}
```

---

## 7. Phase 3: SSE Streaming + Typing Indicators

> This is the highest-impact UX improvement. Currently users wait 10-30+ seconds with only bouncing dots.

### 3.1 Backend: SSE Endpoint

**New file:** `backend/services/chat_stream_service.py`

```python
import asyncio
import json
import time

from fastapi.responses import StreamingResponse

class ChatStreamService:
    """Server-Sent Events for AI chat response streaming."""

    @staticmethod
    async def stream_response(
        supabase, conversation_id: str, user_message: MessageResponse,
        agents: list[AgentBrief], ai_config: dict, locale: str
    ) -> StreamingResponse:
        async def event_stream():
            for i, agent in enumerate(agents):
                # Signal which agent is responding
                yield _sse_event("agent_start", {
                    "agent_id": str(agent.id),
                    "agent_name": agent.name,
                    "index": i,
                    "total": len(agents),
                })

                # Stream tokens from OpenRouter
                async for chunk in openrouter.stream_completion(
                    model=ai_config["model"],
                    messages=message_history,
                    system_prompt=system_prompt,
                ):
                    yield _sse_event("token", {
                        "agent_id": str(agent.id),
                        "content": chunk,
                    })

                # Signal completion for this agent
                yield _sse_event("agent_done", {
                    "agent_id": str(agent.id),
                    "message": stored_message.dict(),
                })

            yield _sse_event("done", {})

        return StreamingResponse(
            event_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",  # Nginx compatibility
            },
        )

def _sse_event(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"
```

**Router addition:**

```python
@router.post("/conversations/{conversation_id}/messages/stream")
async def stream_message(
    simulation_id: UUID, conversation_id: UUID,
    body: MessageCreate,
    supabase = Depends(get_supabase),
    user = Depends(get_current_user),
    _role = Depends(require_role("member")),
):
    """Stream AI response via SSE. Non-streaming fallback remains at POST /messages."""
    ...
```

### 3.2 Frontend: Stream Consumer

**New file:** `frontend/src/services/chat/ChatStreamConsumer.ts`

```typescript
export async function* consumeSSE(
  url: string, body: object, token: string
): AsyncGenerator<SSEEvent> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) throw new Error(`Stream failed: ${response.status}`);

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() || '';

    for (const raw of events) {
      const eventMatch = raw.match(/^event: (.+)$/m);
      const dataMatch = raw.match(/^data: (.+)$/m);
      if (eventMatch && dataMatch) {
        yield {
          event: eventMatch[1],
          data: JSON.parse(dataMatch[1]),
        };
      }
    }
  }
}
```

### 3.3 Streaming Markdown Rendering

**Approach:** Re-parse accumulated text per `requestAnimationFrame` (Option A from research — simplest, `marked` is fast enough for chat message lengths).

```typescript
// In ChatBubble
private _pendingText = '';
private _rafId = 0;

onStreamChunk(chunk: string): void {
  this._pendingText += chunk;
  if (!this._rafId) {
    this._rafId = requestAnimationFrame(() => {
      this._rafId = 0;
      this._renderedHtml = renderChatMarkdown(this._pendingText);
      this.requestUpdate();
    });
  }
}
```

**Blinking cursor during stream:**

```css
:host([streaming]) .bubble-content::after {
  content: '';
  display: inline-block;
  width: 2px;
  height: 1.1em;
  background: var(--color-primary);
  margin-left: 2px;
  vertical-align: text-bottom;
  animation: blink 1s steps(1) infinite;
}

@keyframes blink {
  50% { opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  :host([streaming]) .bubble-content::after {
    animation: none;
    opacity: 1;
  }
}
```

### 3.4 Typing Indicators via Supabase Broadcast

```typescript
// In ChatComposer — send typing indicator
private _typingDebounce = 0;

private _onInput(e: InputEvent): void {
  // ... existing input handling ...

  // Broadcast typing (debounced 2s)
  if (!this._typingDebounce) {
    this.dispatchEvent(new CustomEvent('typing', { bubbles: true }));
    this._typingDebounce = window.setTimeout(() => {
      this._typingDebounce = 0;
    }, 2000);
  }
}
```

```typescript
// In ChatPanel — Supabase Broadcast channel
const channel = supabase.channel(`chat:${conversationId}`);

channel.on('broadcast', { event: 'typing' }, ({ payload }) => {
  const session = chatStore.getOrCreate(conversationId);
  // Add/refresh typing user
  const users = session.typingUsers.value.filter(u => u.id !== payload.user_id);
  users.push({ id: payload.user_id, name: payload.name, at: Date.now() });
  session.typingUsers.value = users;

  // Auto-clear after 3s
  setTimeout(() => {
    session.typingUsers.value = session.typingUsers.value.filter(
      u => u.id !== payload.user_id
    );
  }, 3000);
});
```

---

## 8. Phase 4: Command System + Search

### 4.1 Command Registry

**New file:** `frontend/src/services/chat/CommandRegistry.ts`

Inspired by Discord's slash command system:

```typescript
export interface ChatCommand {
  name: string;                          // e.g., 'help'
  description: () => string;             // msg() wrapped for i18n
  category: 'general' | 'agent' | 'export' | 'debug';
  args?: CommandArg[];
  execute: (ctx: CommandContext) => Promise<void>;
}

export interface CommandArg {
  name: string;
  type: 'string' | 'number' | 'agent' | 'format';
  required: boolean;
  choices?: { label: string; value: string }[];
}

export class CommandRegistry {
  private _commands = new Map<string, ChatCommand>();

  register(command: ChatCommand): void { ... }
  search(query: string): ChatCommand[] { /* fuzzy match */ }
  get(name: string): ChatCommand | undefined { ... }
  list(category?: string): ChatCommand[] { ... }
}

export const commandRegistry = new CommandRegistry();
```

**Built-in commands:**

| Command | Description | Category |
|---------|-------------|----------|
| `/help` | Show available commands | general |
| `/clear` | Clear conversation (with confirm) | general |
| `/search <query>` | Search messages in conversation | general |
| `/export [md\|json]` | Export conversation | export |
| `/summarize` | AI-generated summary | agent |
| `/context` | Show current event references + agent info | agent |
| `/lore <topic>` | Ask agent about simulation lore | agent |
| `/mood` | Show agent's current mood/disposition | agent |

### 4.2 Command Palette (Autocomplete Overlay)

**New file:** `frontend/src/components/chat/core/CommandPalette.ts`

```typescript
@customElement('velg-command-palette')
export class CommandPalette extends LitElement {
  @property({ type: String }) query = '';
  @property({ type: Array }) results: ChatCommand[] = [];
  @property({ type: Number }) selectedIndex = 0;

  // Positioned absolutely above the composer input
  // Arrow keys navigate, Enter selects, Escape dismisses
  // Fuzzy search matching on command name + description
  // Category grouping with headers
}
```

**CSS positioning:**

```css
:host {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  max-height: 300px;
  overflow-y: auto;
  background: var(--color-surface-raised);
  border: var(--border-medium);
  border-bottom: none;
  border-radius: 8px 8px 0 0;
  box-shadow: var(--shadow-md);
  z-index: 10;
}
```

### 4.3 Conversation Search

**New file:** `frontend/src/components/chat/core/ChatSearchBar.ts`

Inspired by Zulip's pill-based search with composable operators:

```typescript
@customElement('velg-chat-search')
export class ChatSearchBar extends LitElement {
  @property({ type: Array }) messages: ChatMessage[] = [];
  @property({ type: Boolean }) open = false;
  @state() private _query = '';
  @state() private _results: SearchResult[] = [];
  @state() private _selectedIndex = 0;

  // Client-side full-text search through loaded messages
  // Highlight matching text via <mark> elements
  // Up/down arrows navigate results, Enter jumps to message
  // Escape closes search bar

  // Search operators (inspired by Zulip):
  // from:<agent_name>  — Filter by sender
  // has:code           — Messages containing code blocks
  // has:event          — Messages with event references
  // before:<date>      — Date filtering
}
```

**Search highlight integration:**

```typescript
// In ChatBubble — when search is active
@property({ type: String }) searchHighlight = '';

private _renderContent(): TemplateResult {
  let html = renderChatMarkdown(this.content);
  if (this.searchHighlight) {
    // Wrap matches in <mark> (post-render, before DOMPurify)
    html = highlightSearchTerms(html, this.searchHighlight);
  }
  return html;
}
```

### 4.4 Keyboard Shortcuts

Implemented as a mixin or controller on `ChatShell`:

| Shortcut | Action | Scope |
|----------|--------|-------|
| `Ctrl+K` / `Cmd+K` | Open conversation search | Global |
| `Ctrl+F` / `Cmd+F` | Open message search | Chat panel |
| `Ctrl+/` / `Cmd+/` | Show shortcut help | Global |
| `Escape` | Close search/command palette/modal | Context |
| `Alt+Up/Down` | Navigate conversations | Sidebar |
| `Ctrl+Shift+N` | New conversation | Global |
| `Ctrl+B` | Bold (in composer) | Composer |
| `Ctrl+I` | Italic (in composer) | Composer |
| `Ctrl+E` | Inline code (in composer) | Composer |
| `Enter` | Send message | Composer |
| `Shift+Enter` | New line | Composer |

---

## 9. Phase 5: Message Actions + Reactions

### 5.1 Message Actions Toolbar

**New file:** `frontend/src/components/chat/core/MessageActions.ts`

Appears on hover over messages (inspired by ChatGPT/Discord):

```typescript
@customElement('velg-message-actions')
export class MessageActions extends LitElement {
  @property({ type: String }) messageId = '';
  @property({ type: String }) senderRole: 'user' | 'assistant' = 'user';
  @property({ type: String }) content = '';

  // Actions for assistant messages:
  //   Copy, Thumbs Up, Thumbs Down, Regenerate
  // Actions for user messages:
  //   Copy, Edit (re-send from this point)
  // All messages:
  //   Bookmark, Copy Link

  // Position: absolute, top-right corner of message bubble
  // Animation: fade-in on parent hover, 150ms transition
}
```

**CSS for hover reveal:**

```css
/* In ChatMessage */
.message-row {
  position: relative;
}
.message-row:hover velg-message-actions,
.message-row:focus-within velg-message-actions {
  opacity: 1;
  pointer-events: auto;
}
velg-message-actions {
  position: absolute;
  top: -12px;
  right: var(--space-2);
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--transition-fast);
}
```

### 5.2 Reaction System

**Backend model:**

```python
# models/chat.py
class MessageReaction(BaseModel):
    id: UUID
    message_id: UUID
    user_id: UUID
    emoji: str              # Unicode emoji or short code
    created_at: datetime

class ReactionSummary(BaseModel):
    emoji: str
    count: int
    reacted_by_me: bool
```

**DB migration:**

```sql
CREATE TABLE chat_message_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    emoji TEXT NOT NULL CHECK (char_length(emoji) <= 8),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (message_id, user_id, emoji)
);

-- RLS
ALTER TABLE chat_message_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own reactions" ON chat_message_reactions
    FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Anyone can read reactions" ON chat_message_reactions
    FOR SELECT USING (true);
```

**Frontend component:**

**New file:** `frontend/src/components/chat/core/ReactionBar.ts`

```typescript
@customElement('velg-reaction-bar')
export class ReactionBar extends LitElement {
  @property({ type: Array }) reactions: ReactionSummary[] = [];
  @property({ type: String }) messageId = '';

  // Renders reaction pills: [emoji count] [emoji count] [+]
  // Click existing reaction toggles own vote
  // [+] button opens compact emoji picker (6-8 preset emojis)
  // Hover on reaction pill shows who reacted (tooltip)
}
```

**Preset emoji set:** `['👍', '👎', '❤️', '🔥', '🎯', '💡', '⚔️', '🏰']`
— Last two are game-themed.

---

## 10. Phase 6: Conversation Management + Export

### 6.1 Enhanced Conversation Sidebar

**Refactored file:** `frontend/src/components/chat/ConversationList.ts`

Improvements:
- **Search/filter bar** using `SharedFilterBar` component
- **Unread badges** with count (reusing `RealtimeService` pattern)
- **Pinned conversations** (top section, max 5)
- **Date grouping** (Today, Yesterday, This Week, Older)
- **Conversation rename** (inline edit on double-click)
- **Drag-to-reorder** (pinned section only)

### 6.2 Conversation Export

**New file:** `frontend/src/services/chat/ChatExporter.ts`

Client-side generation (no backend needed for Markdown/JSON):

```typescript
export class ChatExporter {
  static toMarkdown(conversation: ChatConversation, messages: ChatMessage[]): string {
    const lines: string[] = [];
    lines.push(`# ${conversation.title || 'Conversation'}`);
    lines.push(`> Agents: ${conversation.agents.map(a => a.name).join(', ')}`);
    lines.push(`> Date: ${formatDate(conversation.created_at)}`);
    lines.push('');

    for (const msg of messages) {
      const sender = msg.sender_role === 'user' ? 'You' : msg.agent?.name || 'Agent';
      lines.push(`**${sender}** — *${formatRelativeTimeVerbose(msg.created_at)}*`);
      lines.push(msg.content);
      lines.push('');
    }

    return lines.join('\n');
  }

  static toJSON(conversation: ChatConversation, messages: ChatMessage[]): string {
    return JSON.stringify({ conversation, messages }, null, 2);
  }

  static download(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
```

### 6.3 Draft Auto-Save

Integrated into `ChatSessionStore` (Phase 1) — saves to `localStorage` debounced 500ms:

```typescript
// In ChatComposer
private _draftTimeout = 0;

private _onInput(e: InputEvent): void {
  const text = (e.target as HTMLTextAreaElement).value;
  this._text = text;

  clearTimeout(this._draftTimeout);
  this._draftTimeout = window.setTimeout(() => {
    chatStore.saveDraft(this.sessionId, text);
  }, 500);
}

connectedCallback(): void {
  super.connectedCallback();
  this._text = chatStore.restoreDraft(this.sessionId);
}
```

---

## 11. Phase 7: Game-Specific Features

### 7.1 Agent Personality in Chat

Each agent gets a personality-driven chat experience:

**Visual differentiation:**
- Agent name in `var(--font-brutalist)` with agent-specific accent color
- Left border on agent messages in agent color (existing pattern, keep)
- Agent portrait with mood indicator overlay (colored ring: green=positive, amber=neutral, red=hostile)

**Agent-specific typing phrases** (replace generic "is typing..."):

```typescript
// Defined per agent archetype or as agent metadata
const TYPING_PHRASES: Record<string, string[]> = {
  strategist: ['considers the implications...', 'reviews the tactical situation...'],
  scholar:    ['consults the archives...', 'cross-references the data...'],
  rebel:      ['formulates a response...', 'challenges the premise...'],
  mystic:     ['communes with deeper truths...', 'reads the resonance...'],
};
```

**Agent-specific conversation starters** (empty state):

```typescript
// Per agent, contextual starters tied to recent simulation events
const starters = await chatApi.getConversationStarters(simulationId, agentId);
// Returns: ["Ask me about the uprising in District 7", "What's my take on the latest decree?", ...]
```

### 7.2 Agent Mood Indicator

**Backend:**

```python
class AgentMoodResponse(BaseModel):
    agent_id: UUID
    mood: str           # neutral, curious, amused, concerned, hostile, cryptic
    intensity: float    # 0.0-1.0
    influenced_by: str | None  # "recent events" / "conversation tone"
```

**Frontend:** Colored ring on agent avatar:

```css
.avatar-mood-ring {
  position: absolute;
  inset: -3px;
  border-radius: 50%;
  border: 2px solid var(--mood-color);
  animation: mood-pulse 3s ease-in-out infinite;
}

@keyframes mood-pulse {
  0%, 100% { opacity: 0.6; }
  50%      { opacity: 1; }
}
```

### 7.3 Event Reference Interleaving

Instead of showing events statically at the top, interleave them in the message timeline:

```typescript
// In ChatFeed
private get _timeline(): TimelineItem[] {
  const items: TimelineItem[] = [
    ...this.messages.map(m => ({ type: 'message' as const, data: m, ts: m.created_at })),
    ...this.eventReferences.map(r => ({ type: 'event' as const, data: r, ts: r.referenced_at })),
  ];
  return items.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
}
```

Event references render as full-width cards with simulation context:

```css
.event-ref-card {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: color-mix(in srgb, var(--color-info) 8%, transparent);
  border-left: 3px solid var(--color-info);
  border-radius: 0 6px 6px 0;
  margin: var(--space-2) 0;
}
```

### 7.4 Sound Effects

Leverage existing Howler.js audio system (`dungeon-audio-phase1`):

| Event | Sound | Condition |
|-------|-------|-----------|
| Message sent | Soft click | Always |
| Message received | Subtle chime | Tab not focused |
| Agent starts typing | Faint hum | First agent in group |
| Streaming complete | Soft ding | After streaming finishes |

Respect audio settings from the existing settings panel.

---

## 12. Phase 8: Performance + Polish

### 8.1 Scroll Management

**Approach:** Native `overflow-anchor` (not virtual scrolling) — sufficient for <5000 messages per conversation.

```css
.feed-container {
  overflow-y: auto;
  overflow-anchor: none;
  scroll-behavior: smooth;
}
.scroll-anchor {
  overflow-anchor: auto;
  height: 1px;
}
```

**"New messages" FAB:** IntersectionObserver on sentinel element:

```typescript
private _setupScrollObserver(): void {
  const sentinel = this.renderRoot.querySelector('.scroll-anchor')!;
  this._bottomObserver = new IntersectionObserver(
    ([entry]) => {
      this._isAtBottom = entry.isIntersecting;
      if (this._isAtBottom) {
        chatStore.markRead(this.sessionId);
      }
    },
    { root: this.renderRoot.querySelector('.feed-container'), threshold: 0 }
  );
  this._bottomObserver.observe(sentinel);
}
```

### 8.2 Message Entrance Animations

**CSS-only with `@starting-style`** (no JS timing):

```css
.message-row {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 250ms var(--ease-dramatic),
              transform 250ms var(--ease-dramatic);

  @starting-style {
    opacity: 0;
    transform: translateY(8px);
  }
}

.message-row[data-self] {
  @starting-style {
    transform: translateX(12px);
  }
}

.message-row:not([data-self]) {
  @starting-style {
    transform: translateX(-12px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .message-row {
    transition-duration: 0.01ms !important;
  }
}
```

### 8.3 Lazy Image Loading

All avatar images use `loading="lazy"`. IntersectionObserver for images within messages:

```typescript
// In ChatBubble — for embedded images
private _lazyObserver = new IntersectionObserver(
  ([entry]) => {
    if (entry.isIntersecting) {
      const img = entry.target as HTMLImageElement;
      img.src = img.dataset.src!;
      this._lazyObserver.disconnect();
    }
  },
  { rootMargin: '200px' }
);
```

### 8.4 `repeat` Directive with Stable Keys

```typescript
// In ChatFeed
render() {
  return html`
    <div class="feed-container" role="log" aria-live="polite">
      <div class="history-sentinel"></div>
      ${repeat(
        this._timeline,
        (item) => item.type === 'message' ? item.data.id : `event-${item.data.id}`,
        (item) => item.type === 'message'
          ? this._renderMessage(item.data)
          : this._renderEventCard(item.data)
      )}
      <div class="scroll-anchor"></div>
    </div>
    ${this.typingUsers.length > 0
      ? html`<velg-typing-indicator .users=${this.typingUsers}></velg-typing-indicator>`
      : nothing}
  `;
}
```

### 8.5 RAF-Throttled Stream Rendering

Already specified in Phase 3 — `requestAnimationFrame` batching for streaming tokens.

---

## 13. Design Tokens & Visual Language

All new components MUST use the existing three-tier color token system. No raw `#hex` or `rgba()`.

### Chat-Specific Component Tokens

Defined in `:host` of each component using `color-mix()` from Tier 1/2:

```css
/* ChatBubble */
:host {
  --_bubble-user-bg: color-mix(in srgb, var(--color-primary) 12%, transparent);
  --_bubble-agent-bg: var(--color-surface-raised);
  --_bubble-system-bg: transparent;
  --_bubble-border-width: 3px;
}

/* ChatFeed */
:host {
  --_feed-separator-color: var(--color-border-light);
  --_feed-date-label-color: var(--color-text-muted);
}

/* ChatComposer */
:host {
  --_composer-bg: color-mix(in srgb, var(--color-surface-raised) 80%, transparent);
  --_composer-border: var(--color-border);
  --_composer-focus-border: var(--color-primary);
  --_composer-focus-glow: color-mix(in srgb, var(--color-primary) 20%, transparent);
}

/* MessageActions */
:host {
  --_action-bg: var(--color-surface-raised);
  --_action-hover-bg: color-mix(in srgb, var(--color-primary) 10%, var(--color-surface-raised));
  --_action-border: var(--color-border);
}
```

### Agent Color Palette

Retain existing `AGENT_COLORS` array for multi-agent border colors. Extend with mood-derived accent:

```typescript
// Existing pattern — keep
const AGENT_COLORS = [
  'var(--color-primary)',    // #f59e0b amber
  'var(--color-info)',       // #3b82f6 blue
  'var(--color-success)',    // #22c55e green
  '#a855f7',                // purple
  '#ec4899',                // pink
  '#14b8a6',                // teal
  '#f97316',                // orange
  '#6366f1',                // indigo
];
```

---

## 14. Accessibility Contract

### WCAG AA Requirements

| Requirement | Implementation |
|-------------|---------------|
| `role="log"` on feed | `ChatFeed` container |
| `aria-live="polite"` | Feed container + typing indicator |
| `role="status"` | Typing indicator, streaming indicator |
| Focus management | Focus composer after send, focus message after action |
| Keyboard navigation | All actions reachable via keyboard |
| Contrast 4.5:1 | All text tokens meet this (verified in design-tokens.md) |
| `prefers-reduced-motion` | All animations respect this query |
| Screen reader labels | All icon buttons have `aria-label` via `msg()` |
| Focus visible | All interactive elements show focus ring |
| No keyboard traps | Escape closes all overlays, focus returns to trigger |

### Specific Chat A11y

```html
<!-- Chat feed -->
<div role="log" aria-label="${msg('Conversation messages')}" aria-live="polite">

<!-- Each message -->
<div role="article" aria-label="${senderName}, ${formattedTime}">

<!-- Typing indicator -->
<div role="status" aria-label="${msg('{name} is typing', { name })}">

<!-- Command palette -->
<div role="listbox" aria-label="${msg('Available commands')}">

<!-- Search results -->
<div role="search" aria-label="${msg('Search messages')}">
```

---

## 15. Migration Strategy

### Approach: Component-by-Component Replacement

NOT a big-bang rewrite. Each new component replaces its predecessor one at a time.

### Step-by-Step

1. **Phase 0** — Backend refactoring. Zero frontend changes. All existing tests must pass.

2. **Phase 1** — Create new core components in `frontend/src/components/chat/core/`. Old components remain in `frontend/src/components/chat/`. Both coexist.

3. **Phase 1b** — Wire `ChatView.ts` to use new `ChatFeed` + `ChatComposer` instead of `MessageList` + `MessageInput`. Verify feature parity.

4. **Phase 1c** — Wire `EpochChatPanel.ts` to use new `ChatFeed` + `ChatComposer` with channel-specific config. Verify feature parity.

5. **Phase 2-8** — Incremental feature additions. Each phase is independently deployable.

6. **Cleanup** — Delete old `MessageList.ts`, `MessageInput.ts`, inline rendering from `EpochChatPanel.ts`. Update imports.

### Feature Parity Checklist (Before Deleting Old Components)

- [ ] Multi-agent conversations with color coding
- [ ] Message grouping (same sender, same day)
- [ ] Date separators
- [ ] Event reference display
- [ ] Typing indicator
- [ ] Optimistic message insertion
- [ ] Conversation list with archive/delete
- [ ] Agent selector modal
- [ ] Event picker modal
- [ ] Auto-resize textarea
- [ ] Character limit with warnings
- [ ] Lightbox for agent portraits
- [ ] Epoch chat: channel tabs (epoch/team)
- [ ] Epoch chat: unread badges per channel
- [ ] Epoch chat: load older messages
- [ ] Epoch chat: disabled state when epoch closed

---

## 16. Dependencies & New Packages

### New Dependencies

| Package | Purpose | Size (gzip) | Status |
|---------|---------|-------------|--------|
| `marked-highlight` | Code highlighting in marked | ~2 kB | Stable, by markedjs team |
| `highlight.js` | Syntax highlighting engine | ~12 kB core | Stable, 23M weekly downloads |

### Already Available (No New Deps)

| Package | Used For |
|---------|----------|
| `marked` (^17.0.5) | Markdown parsing |
| `dompurify` (^3.3.3) | HTML sanitization |
| `lit` | Web Components framework |
| `@preact/signals-core` | State management |
| `@supabase/supabase-js` | Realtime, broadcast, presence |
| `howler` | Audio system (Phase 7 sounds) |

### Explicitly NOT Adding

| Package | Reason |
|---------|--------|
| `@lit-labs/virtualizer` | Not needed for <5000 messages; native scroll anchoring sufficient |
| `Shiki` | 250 kB WASM, too heavy for chat; highlight.js is better fit |
| `markdown-it` / `unified` | `marked` already installed, switching adds no value |
| `streaming-markdown` | Option A (re-parse via RAF) is simpler and sufficient |
| `sse-starlette` | FastAPI's built-in `StreamingResponse` is sufficient |

---

## 17. File Inventory

### New Files

```
frontend/src/
├── components/chat/core/
│   ├── ChatFeed.ts              # Unified message list (replaces MessageList + EpochChatPanel inline)
│   ├── ChatMessage.ts           # Single message row (avatar + bubble + time + actions)
│   ├── ChatBubble.ts            # Message content renderer (markdown, code, streaming)
│   ├── ChatComposer.ts          # Unified input (replaces MessageInput + Epoch inline)
│   ├── ChatHeader.ts            # Title + participants + actions
│   ├── TypingIndicator.ts       # Animated typing display
│   ├── MessageActions.ts        # Hover action toolbar (copy, react, regenerate)
│   ├── ReactionBar.ts           # Emoji reaction pills
│   ├── CommandPalette.ts        # Slash command autocomplete overlay
│   └── ChatSearchBar.ts         # Message search with operators
├── services/chat/
│   ├── ChatSessionStore.ts      # Preact Signals state manager
│   ├── ChatStreamConsumer.ts    # SSE stream consumer
│   ├── ChatExporter.ts          # Markdown/JSON export
│   └── CommandRegistry.ts       # Slash command registry
├── utils/
│   ├── code-highlight.ts        # highlight.js setup + dynamic loading
│   └── hljs-dark-theme.css      # Custom highlight.js theme

backend/
├── services/
│   └── chat_stream_service.py   # SSE streaming service
```

### Modified Files

```
frontend/src/
├── components/chat/
│   ├── ChatView.ts              # Wire to new core components
│   ├── ChatWindow.ts            # Wire to ChatFeed + ChatComposer
│   └── ConversationList.ts      # Enhanced sidebar (search, pins, unread)
├── components/epoch/
│   └── EpochChatPanel.ts        # Wire to ChatFeed + ChatComposer
├── services/api/
│   └── ChatApiService.ts        # Add streaming endpoint, reactions, search
├── utils/
│   └── markdown.ts              # Extend with chat-specific rendering

backend/
├── services/
│   ├── chat_service.py          # Dedup helpers, add orchestration method, ownership
│   └── chat_ai_service.py       # Merge generate methods, add streaming
├── routers/
│   └── chat.py                  # Thin down, add stream endpoint
├── models/
│   └── chat.py                  # Add AI metadata, reactions, mood models
```

### Deleted Files (After Migration Complete)

```
frontend/src/components/chat/
├── MessageList.ts               # Replaced by ChatFeed
├── MessageInput.ts              # Replaced by ChatComposer
```

---

## 18. Addendum A: Lit Reactive Controllers

> Researched: Lit 3 Reactive Controllers, @lit/context, @lit/task, Preact Signals integration patterns.

### Key Architecture Decisions

**Use Reactive Controllers (not mixins) for shared behavior.** Controllers are "has-a" composition — multiple instances per component, independently testable, no prototype pollution. Mixins are "is-a" inheritance — only for cross-cutting concerns that change how the component works (like `SignalWatcher`).

### Controllers to Build

#### ScrollController
Encapsulates scroll-to-bottom, "user scrolled up" detection via IntersectionObserver, scroll restoration. Replaces raw `_scrollToBottom()` + `requestAnimationFrame` calls in both EpochChatPanel and ChatWindow.

- `isAtBottom: boolean` — sentinel element visibility via IntersectionObserver
- `userScrolledUp: boolean` — tracks manual scroll via scroll event handler
- `scrollToBottom(behavior)` — programmatic scroll via RAF
- `snapToBottom()` — reset user-scrolled state + scroll
- Lifecycle: observer setup in `hostConnected`, cleanup in `hostDisconnected`
- Auto-scroll in `hostUpdated` when user hasn't scrolled up

#### KeyboardController
Registry of key bindings with scope support (global vs host-scoped).

- `KeyBinding { key, ctrl?, shift?, alt?, meta?, handler, scope: 'global' | 'host' }`
- Global bindings on `document`, scoped bindings check `shadowRoot.activeElement`
- `addBinding()`/`removeBinding()` for dynamic shortcuts
- `enabled` property to temporarily disable (during modal focus)

#### IntersectionController
For "load older messages" trigger and lazy image loading.

- Observes a sentinel element, fires callback on intersection
- `rootMargin: '200px'` for pre-loading before visible

#### SignalEffectController
Replaces manual `_disposeEpochEffect` / `_disposeTeamEffect` / etc. bookkeeping:

```typescript
class SignalEffectController implements ReactiveController {
  private _disposers: (() => void)[] = [];
  constructor(host, effects: (() => void)[]) { host.addController(this); }
  hostConnected() { this._disposers = this._effects.map(fn => effect(fn)); }
  hostDisconnected() { this._disposers.forEach(d => d()); this._disposers = []; }
}
```

### @lit/context for Session Scoping

Use when decomposing chat into nested components (ChatFeed > ChatMessage > ChatBubble). Put Preact Signals **inside** context values — consumers with `SignalWatcher` react to signal changes without needing `subscribe: true`. Best of both worlds: context for scoping, signals for granular reactivity.

### @lit/task for Async Loading

Use `Task` controller for message history loading. Key benefit: built-in `AbortSignal` that cancels in-flight requests when args change (e.g., conversation switch). Eliminates race conditions in current `_loadMessages()`.

### Lit Template Directives

- **`repeat()`** with stable message IDs — prevents DOM churn on prepend (loading history)
- **`keyed()`** for channel switching — full teardown/recreate of ChatFeed on channel change, resetting controllers
- Event delegation via single click handler on feed container with `data-msg-id` / `data-action` attributes

---

## 19. Addendum B: Modern CSS Platform APIs

> Researched: 10 modern CSS APIs with browser support data, Shadow DOM compatibility, and chat-specific recommendations.

### USE NOW (Production Ready)

| Feature | Support | Impact for Chat | Code Savings |
|---------|---------|-----------------|--------------|
| **Popover API** | ~97% | Reaction picker, command palette, context menus | Eliminates positioning JS |
| **`<dialog>` element** | ~97% | Replace BaseModal + ConfirmDialog + focus-trap.ts | Delete ~300 lines |
| **`content-visibility: auto`** | ~95% | 50-70% render savings for message lists | 2 lines of CSS |
| **`color-mix()` in oklch** | ~94% | Agent-specific color palettes from one variable | Replaces JS color utils |
| **CSS Nesting** | ~96% | 20-30% CSS verbosity reduction | Cleaner component styles |
| **`@layer`** | ~96% | Isolate highlight.js theme, manage override priority | Organized cascade |
| **`@starting-style` + `transition-behavior`** | ~93% | CSS-only show/hide animations | Delete animation JS |

### USE WITH `@supports` (Progressive Enhancement)

| Feature | Support | Impact |
|---------|---------|--------|
| **CSS Anchor Positioning** | ~90% | Position action toolbars, tooltips relative to messages |
| **Scroll-driven animations** | ~78% | Scroll progress indicator, message fade-in on scroll |

### Key Migration: BaseModal → `<dialog>`

Native `<dialog>` provides built-in focus trap (background becomes `inert`), Escape-to-close, `::backdrop` styling, `role="dialog"` implicit, top-layer rendering (no z-index). Animated with `@starting-style` + `transition-behavior: allow-discrete` — pure CSS entry/exit. Replaces `BaseModal.ts` (~240 lines) + `focus-trap.ts` entirely.

### Key Performance Win: `content-visibility: auto`

```css
.message-item {
  content-visibility: auto;
  contain-intrinsic-size: auto 100px;
}
```

Two lines of CSS → browser skips layout/paint/style for off-screen messages. 50-70% initial render improvement. Works with Ctrl+F search (unlike virtual scrolling). `auto` in `contain-intrinsic-size` remembers actual height after first render.

### Agent Color Theming with OKLCH

```css
.message {
  --_accent: oklch(0.65 var(--agent-chroma) var(--agent-hue));
  --_surface: color-mix(in oklch, var(--_accent) 8%, var(--color-surface));
  --_border: color-mix(in oklch, var(--_accent) 40%, var(--color-border));
}
```

One CSS custom property per agent (hue + chroma) → entire derived palette via `color-mix()`. Perceptually uniform — consistent visual weight across all agent colors.

---

## 20. Addendum C: Open Source Chat Code Patterns

> Analyzed: Element Web, Rocket.Chat, Zulip, Open WebUI, LibreChat, Chatbot UI, LobeChat (7 codebases, 300k+ combined stars).

### Top 5 Transferable Patterns

**1. RAF throttling for streaming renders (Open WebUI)**
`requestAnimationFrame` batching prevents dropped frames during fast token arrival. Without it → KaTeX-500-times-per-second problem. Ensures max 1 rebuild per 16ms frame.

**2. Two-tier change detection during streaming (Open WebUI)**
Fast path: check only `content` and `done` fields (fires 99% during streaming). Slow path: full JSON comparison for metadata changes. Avoids expensive deep comparison on every token.

**3. Anchor-based scroll restoration (Element Web)**
Records which message is visible + offset, not absolute scroll position. On DOM mutation, finds same message and applies `scrollBy(0, diff)`. Correct approach for dynamic content — absolute positions break on prepend.

**4. Clean stream consumer utility (Chatbot UI)**
`getReader() → while loop → TextDecoder({ stream: true }) → callback → AbortController`. Pure utility function, not embedded in components. Portable and testable.

**5. Conversation tree via parentMessageId (LibreChat/Open WebUI)**
Messages store `parentMessageId` forming N-ary tree. Editing creates fork. Regenerating creates sibling. `SiblingSwitch` component shows `current/total` with prev/next nav. Thread reconstruction: walk backward to root, reverse.

### Anti-Patterns to Avoid

- **Element Web scroll bugs:** Custom `ScrollPanel` fights browser native scroll → 5+ major open issues. Lesson: prefer native `overflow-anchor` + IntersectionObserver over custom scroll management.
- **Rocket.Chat memory leaks:** 1.2GB → 3GB after 15K messages. Caused by reactive system holding references. Lesson: always clean up signal subscriptions + channel subscriptions.
- **LobeChat startup cost:** 28+ Zustand stores → 3-5x slower chat window opening. Lesson: lazy-initialize stores per conversation, not globally.
- **Chatbot UI single-context:** All state in one React Context → unnecessary re-renders everywhere. Lesson: scope state by session/conversation, not globally.

### Streaming Markdown: The Consensus Approach

Every project handles this differently. The practical consensus:
- Re-parse accumulated text per RAF frame (Option A) — sufficient for typical message lengths
- `marked.lexer()` for token-level parsing + rAF throttle (Open WebUI)
- Error boundary around markdown renderer (LibreChat) — prevents render crash from malformed partial markdown
- Scope expensive operations (KaTeX, syntax highlighting) to the **active streaming message** only, never the full conversation

---

## 21. Addendum D: OpenRouter Streaming + Supabase Realtime Production Guide

> Researched: OpenRouter streaming API format, FastAPI 0.135.1 SSE, Supabase Realtime architecture, production deployment on Railway.

### OpenRouter Streaming Key Facts

- **Chunk format:** `data: {"choices":[{"delta":{"content":"token"}}]}`
- **Usage always in final chunk** (no need for `stream_options: { include_usage: true }`)
- **SSE comments** (`: OPENROUTER PROCESSING`) sent as keep-alive heartbeats
- **Mid-stream errors:** HTTP status stays 200, error arrives as data chunk with `finish_reason: "error"`
- **Generation stats:** Query `GET /api/v1/generation?id={X-Generation-Id}` for cost/latency post-hoc
- **Stream cancellation:** Works with OpenAI/Anthropic/Fireworks/Together. NOT supported by Groq/Modal/Google (still billed)

### FastAPI: Use Built-in EventSourceResponse

FastAPI 0.135.1+ includes native SSE via `EventSourceResponse`. Benefits over sse-starlette:
- Rust-side Pydantic serialization → higher throughput
- Built-in 15-second keep-alive pings
- Automatic `Cache-Control: no-cache` + `X-Accel-Buffering: no`
- `request.is_disconnected()` for client disconnect detection

### Supabase Realtime: Broadcast + DB Triggers > postgres_changes

**Critical:** `postgres_changes` is single-threaded and checks RLS for every subscriber on every change (100 subscribers × 1 insert = 100 RLS checks). Does NOT scale.

**Recommended pattern:** Use `realtime.send()` inside a `SECURITY DEFINER` trigger on `chat_messages` INSERT:

```sql
CREATE OR REPLACE FUNCTION broadcast_chat_message()
RETURNS trigger SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM realtime.send(
    jsonb_build_object('id', NEW.id, 'content', NEW.content, ...),
    'new_message',
    'chat:' || NEW.conversation_id::text || ':messages',
    true  -- private channel
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
```

### Broadcast Replay (Reconnection)

Since supabase-js v2.74.0+, broadcast supports replay of missed messages:

```typescript
const channel = supabase.channel('chat:conv:messages', {
  config: { private: true, broadcast: { replay: { since: lastTimestamp, limit: 25 } } },
});
```

Replayed messages include `meta.replayed: true`. Persist for 3 days.

### Rate Limits (Pro Plan)

| Metric | Limit |
|--------|-------|
| Concurrent connections | 500 |
| Messages/second | 500 |
| Channels per connection | 100 |
| Presence keys per object | 10 |
| Broadcast payload | 3 MB |

**Mitigation:** Batch streaming token broadcasts every 100ms (not per-token). Use 1 channel per conversation (multiplex by event name). Throttle typing indicators to max 1 per 3 seconds.

### Multi-Agent Sequential Streaming

Stream agents one-by-one. SSE events: `agent_start` → N × `token` → `agent_done` (per agent). If one agent fails, emit `agent_error` with partial content and continue to next agent. Frontend renders each agent's response in its own bubble with streaming cursor.

### Deployment: Railway

- Set `UVICORN_TIMEOUT_KEEP_ALIVE=120`
- Railway demuxes HTTP/2 to HTTP/1.1 internally — SSE works fine
- Idle timeout ~60s — FastAPI's 15s ping handles this
- Single worker for SSE (or sticky sessions with multiple workers)

---

## 22. Research Sources

### Chat UI Design (40+ sources)
- ChatGPT, Claude.ai, Gemini, Perplexity, Character.ai, Poe — platform analysis
- Smashing Magazine: Design Patterns for AI Interfaces (2025)
- MultitaskAI: Innovative Chat UI Design Trends 2025
- BricxLabs: 16 Chat UI Design Patterns
- Dribbble/Behance: 60+ dark-theme chat UI concepts
- LukeW: Alternative Chat UI Layout (dual-pane)

### Zulip Deep Dive
- Source: `message_list_view.ts`, `hotkey.ts`, `search.ts`, `unread.ts`, `compose_ui.ts`
- Topic threading model, 80+ keyboard shortcuts, pill-based search
- Sliding DOM window (250 msgs), Handlebars → TypeScript migration
- Custom Python-Markdown extensions (mentions, spoilers, polls, math)

### Discord Deep Dive
- Components V2 (March 2025): 17 component types, 40 per message
- Slash commands: 500ms autocomplete, 25 suggestions, 11 option types
- Performance: FastList → FlashList → FastestList, MessageLite (35% improvement)
- ScyllaDB migration: 40-125ms → 15ms p99 latency
- highlight.js for code, embed card structure

### Implementation Techniques
- `marked` + `marked-highlight` + `DOMPurify` for safe markdown
- highlight.js with `adoptedStyleSheets` for Shadow DOM
- CSS `@starting-style` for entrance animations (no JS)
- CSS Grid trick for auto-resize textarea
- `overflow-anchor` for scroll pinning
- `IntersectionObserver` for lazy loading + scroll detection
- `requestAnimationFrame` batching for stream rendering
- Supabase Broadcast for typing indicators
- SSE via `fetch` + `ReadableStream` (not `EventSource` — no auth header support)

### AI Chat UX
- NNGroup: 3-5 conversation starters optimal
- Character.ai: Group chat up to 10 AI + 10 humans, PipSqueak model
- Disco Elysium: 24 skill personalities, polyphonic inner voice
- Inworld AI: 200ms response time, emotional adaptation
- DeepSeek R1: Collapsible reasoning traces
- Streamdown 2.2: Streaming markdown rendering

### Game-Specific
- Disco Elysium UI: Twitter-inspired scrolling column, hand-painted portraits
- AI Dungeon: Undo/Redo/Retry/Edit for narrative pruning
- Intra LLM text adventure: XML dialogue markup, authentic incomplete information
- RPG Maker/Unity: Letter-by-letter animation, branching dialogue trees

### Lit 3 Advanced Patterns (Addendum A)
- Lit Reactive Controllers docs + API reference
- @lit/context (graduated from labs) — Context Protocol
- @lit/task — async data loading with AbortSignal
- @lit-labs/preact-signals — SignalWatcher, watch() directive
- Adobe Spectrum Web Components — controller patterns
- Lit community discussions #3126, #3362, #4115

### Modern CSS Platform APIs (Addendum B)
- MDN: Popover API, CSS Anchor Positioning, View Transitions, content-visibility, dialog, color-mix(), @starting-style
- Chrome Developers: Anchor Positioning, Scroll-Driven Animations, Entry/Exit Animations
- Smashing Magazine: Cascade Layers, Transitioning Top-Layer Entries
- Evil Martians: OKLCH in CSS
- web.dev: content-visibility performance, baseline entry animations

### Open Source Chat Codebases (Addendum C)
- Element Web (matrix-react-sdk) — ScrollPanel, EventTile, TimelinePanel architecture
- Rocket.Chat — Hook composition, triple observer pagination
- Zulip — Fixed DOM window (400 msgs), typeahead lazy evaluation, TypeScript migration
- Open WebUI — RAF streaming throttle, two-tier change detection, streaming-markdown
- LibreChat — Conversation tree model, SSE with token refresh, branching
- Chatbot UI — Clean stream consumer, anti-scroll-interrupt pattern
- LobeChat — Zustand slice architecture, Virtua virtual scrolling, operation-based streaming

### OpenRouter + Supabase Realtime (Addendum D)
- OpenRouter API: Streaming, Error Handling, Generation Stats, Tool Calling
- FastAPI SSE: EventSourceResponse (v0.135.0+), keep-alive, disconnect detection
- Supabase Realtime: Broadcast, Presence, DB triggers, replay, rate limits
- Railway deployment: HTTP/2 demux, timeout configuration

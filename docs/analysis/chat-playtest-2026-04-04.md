# Chat System Playtest Report -- 2026-04-04

**Tester:** Claude (WebMCP automated)
**Environment:** Production (https://metaverse.center)
**Simulation:** Velgarien
**Conversation:** Doktor Fenn, Elena Voss +1 (3 agents, 13 messages)
**Browser:** Playwright Chrome 146, macOS
**Viewports tested:** 1440x900, 640x900, 375x812

---

## Summary

**38 issues found** (3 Critical, 5 High, 10 Medium, 4 Mobile, 10 Additional observations + 6 CSS measurements).
The chat system is **functionally operational** (search, pin, rename, export all work) but **visually far from production-ready**. The two most critical systemic issues are:
1. **Broken layout model** -- page-level scroll instead of chat-internal scroll (C1/C2/C3)
2. **User message bubble rendering** -- black ghost block, no border-radius, harsh appearance (H1)

These two alone account for the "unpolished" impression. Fixing them transforms the chat from "prototype" to "beta". The AI content quality issues (H3/H4/H5) are separate and require backend/prompt changes.

---

## CRITICAL -- Layout Breaking

### C1. Message feed does not scroll independently
**Severity:** Critical
**Component:** `ChatView.ts` / `ChatWindow.ts`
**Description:** The entire page scrolls including the site footer. The message feed should scroll within its own container (overflow-y: auto) while the header and composer remain fixed.
**Impact:** Composer is not visible when reading messages at the top. User must scroll the entire page to reach the input.
**Fix:** Chat container needs `display: flex; flex-direction: column; height: calc(100vh - header)`. Message feed gets `flex: 1; overflow-y: auto`. Composer gets `flex-shrink: 0`.

### C2. Composer not sticky at bottom
**Severity:** Critical
**Component:** `ChatWindow.ts`
**Description:** The composer ("TYPE YOUR MESSAGE...") scrolls with the page content instead of staying fixed at the bottom of the chat area.
**Impact:** Users cannot type messages while reading earlier parts of the conversation.
**Related to:** C1 -- same root cause (no flex layout on chat container).

### C3. Footer visible below chat
**Severity:** Critical
**Component:** `ChatView.ts`
**Description:** The full site footer (Discover, Worldbuilding, AI Characters...) is visible below the chat area. A chat view should fill 100% of available height.
**Impact:** Wastes vertical space, looks unfinished.

---

## HIGH -- Visual Quality

### H1. User message bubble -- black ghost block above text
**Severity:** High
**Component:** `ChatBubble.ts` `.bubble--user`
**Description:** Every user message bubble has a ~30px black rectangle above the actual text content. The bubble is 86px tall for a single-line message (~20px text), leaving 42px of unexplained space (padding is only 12px top + 12px bottom = 24px).
**Root cause data:**
- `background: rgb(0, 0, 0)` -- pure black
- `borderRadius: 0px` -- completely square corners
- `padding: 12px 16px`
- `children: []` -- content via slot, ghost space likely from slot wrapper or `::before`
**Screenshots:** playtest-chat-09-full-top.png, playtest-chat-11-user-bubble-detail.png
**Fix:** Investigate slot content in ChatBubble shadow DOM. Add border-radius (8-12px). Consider changing bg to `var(--color-surface-raised)` or `var(--color-primary)` with proper contrast.

### H2. Small unreadable dark rectangle next to user message timestamps
**Severity:** High
**Component:** `ChatMessage.ts` / `MessageActions.ts`
**Description:** A small (~20x20px) dark rectangle appears next to every user message timestamp (e.g. next to "17. Feb., 10:41"). It's the `velg-message-actions` container rendering at 58x30px even when not hovered, but only partially visible.
**Fix:** MessageActions should have `visibility: hidden` or `opacity: 0` by default, only showing on hover.

### H3. AI Chain-of-Thought leak in message content
**Severity:** High
**Component:** AI Pipeline / Chat streaming
**Description:** Elena Voss message at 10:47 displays raw AI reasoning: "(Der User wiederholt dieselbe Frage, offenbar unzufrieden mit der vorherigen Antwort oder sucht nach einer klaren Handlungsanweisung. Zwei Aspekte: 1. Was tun mit der Brutzeitverschiebung? 2. Die tanzenden Bananen.)" followed by multiple paragraphs of internal reasoning before the actual response.
**Impact:** Breaks immersion completely. Users see the AI "thinking out loud."
**Fix:** System prompt needs `<think>` tag stripping or the streaming handler needs to filter CoT blocks.

### H4. Raw agent name tags in message text
**Severity:** High
**Component:** Chat renderer / AI Pipeline
**Description:** Messages contain raw `[Doktor Fenn]:` and `[Elena Voss]:` prefixes inline in the text. These should either be stripped by the frontend renderer or prevented in the system prompt.
**Examples:**
- `[Doktor Fenn]: [Doktor Fenn]:` (doubled!)
- `[Elena Voss]: [Doktor Fenn]:` (attribution confusion)
**Fix:** Frontend: strip `[AgentName]:` prefixes from message content. Backend: improve group chat prompt to prevent these tags.

### H5. Attribution mismatch in group chat
**Severity:** High
**Component:** AI Pipeline
**Description:** In group conversations, a single agent's response contains dialog from multiple agents. A "Doktor Fenn" message includes `[Elena Voss]:` sections with her dialog. This means one API response contains both agents' contributions, but is attributed to only one.
**Impact:** Confusing -- Elena Voss appears to speak under Doktor Fenn's name header.
**Fix:** Either split multi-agent responses into separate messages, or visually indicate quoted speech from other agents.

---

## MEDIUM -- Polish & UX

### M1. No visual feedback on Copy button
**Severity:** Medium
**Component:** `MessageActions.ts`
**Description:** Clicking "Copy message" produces no visual feedback (no toast, no icon change, no checkmark animation). The user has no confirmation that the copy succeeded.
**Fix:** Toggle icon to checkmark for 2s, or show brief "Copied!" tooltip.

### M2. ThumbsUp/Down is dead UI
**Severity:** Medium
**Component:** `MessageActions.ts`
**Description:** ThumbsUp and ThumbsDown buttons dispatch a `message-feedback` event, but nothing handles it. No backend endpoint, no DB table, no visual state change. Clicking produces zero effect.
**Fix:** Either implement minimal backend (Follow-up #15) or remove buttons until Phase 7. Dead UI is worse than missing UI.

### M3. ConversationList does not fill available height
**Severity:** Medium
**Component:** `ConversationList.ts`
**Description:** The sidebar has empty space below the conversation entries. Should stretch to match the chat area height.
**Fix:** Apply `flex: 1` or `min-height` to the list container.

### M4. Inconsistent spacing between messages
**Severity:** Medium
**Component:** `ChatMessage.ts`
**Description:** The gap between consecutive messages varies. Messages from the same timestamp block have different spacing than messages from different timestamps.
**Fix:** Standardize margin-bottom on `.row` elements.

### M5. No visual separator between different agents
**Severity:** Medium
**Component:** `ChatMessage.ts`
**Description:** When the speaking agent changes (e.g., Doktor Fenn -> Elena Voss -> General Wolf), there's no visual break other than the name label. In long conversations this makes it hard to scan who said what.
**Fix:** Add subtle separator line or extra spacing when `sender` changes between consecutive messages.

### M6. Italic stage directions not visually distinct
**Severity:** Medium
**Component:** `ChatBubble.ts`
**Description:** The italic stage directions (e.g., *mit gleichmassiger, emotionsloser Stimme*) run inline with the dialog text. No indent, no background change, no block formatting. Hard to distinguish in long messages.
**Fix:** Consider wrapping `<em>` blocks in a subtle visual container (lighter bg, indent, or smaller font size).

### M7. DELETE button without confirmation
**Severity:** Medium
**Component:** `ConversationList.ts`
**Description:** The "DELETE" button on conversation hover is a one-click destructive action with no confirmation dialog and no undo. Sits right next to "ARCHIVE".
**Fix:** Add confirmation dialog ("Delete this conversation? This cannot be undone.") or implement soft-delete with undo.

### M8. Export dropdown has no visual container
**Severity:** Medium
**Component:** `ChatWindow.ts` export menu
**Description:** The export dropdown (Markdown/JSON) appears as floating text without a clear container background, border, or shadow. It overlaps the first user message bubble, creating visual confusion.
**Fix:** Add `background: var(--color-surface-raised); border: var(--border-default); box-shadow: var(--shadow-lg)` to the dropdown.

### M9. Pin icon too small and barely visible
**Severity:** Medium
**Component:** `ConversationList.ts`
**Description:** The pin/unpin icon in the conversation list is tiny with no hover background. Not clearly interactive.
**Fix:** Add hover background, increase icon size, or add tooltip.

### M10. Rename input shows truncated name
**Severity:** Medium
**Component:** `ConversationList.ts`
**Description:** Double-click rename shows "FENN, ELENA VOSS" instead of the full "Doktor Fenn, Elena Voss +1". The "Doktor" prefix and "+1" suffix are missing from the editable input.
**Fix:** Pass the full conversation title to the rename input, not a truncated version.

---

## MOBILE -- Responsiveness (640px / 375px)

### MOB1. ConversationList not collapsible on mobile
**Severity:** High
**Component:** `ChatView.ts`
**Description:** At 640px, the conversation list stacks vertically above the chat area, consuming ~200px of vertical space. There's no way to collapse/hide it.
**Fix:** Implement slide-in drawer pattern or auto-hide sidebar on mobile with a hamburger toggle.

### MOB2. Double header display
**Severity:** Medium
**Component:** `ChatView.ts`
**Description:** The conversation title appears both in the sidebar item AND in the chat header directly below. Redundant information wastes precious mobile space.
**Fix:** Hide the sidebar conversation item when that conversation is selected on mobile.

### MOB3. Chat header layout breaks at 375px
**Severity:** High
**Component:** `ChatWindow.ts`
**Description:** At iPhone width (375px), the chat header title ("DOKTOR FEN...") is truncated and the action buttons (Events, Add Agent, Export) wrap to a second row, looking disconnected from the header.
**Fix:** Stack action buttons into a single overflow menu on narrow viewports.

### MOB4. No navigation back on mobile
**Severity:** High
**Component:** Simulation shell
**Description:** The simulation tab navigation (Lore, Agents, Buildings...) is not visible at 640px/375px. No back button, no breadcrumb interaction. Users are trapped in the chat view.
**Fix:** Add mobile navigation (hamburger menu or back arrow).

---

## Functional Test Results

| Feature | Status | Notes |
|---------|--------|-------|
| ConversationList display | PASS | Sidebar, search, date groups work |
| Search filter | PASS | Filters by agent name correctly |
| Pin conversation | PASS | Moves to "Pinned" section, toggles to Unpin |
| Inline rename | PASS | Double-click activates input, Escape cancels |
| Open conversation | PASS | Messages load, header shows agent info |
| Message hover toolbar | PASS | Shows on hover with correct buttons |
| Copy message | PARTIAL | Copies to clipboard but no visual feedback |
| ThumbsUp/Down | PASS (no crash) | Does nothing (expected, no backend) |
| Export Markdown | PASS | Downloads .md file |
| Export JSON | NOT TESTED | |
| Draft auto-save | NOT TESTED | Only 1 conversation, cannot switch to verify |
| Streaming/Send | NOT TESTED | Would send real message to production |
| Mobile 640px | FAIL | Multiple layout issues |
| Mobile 375px | FAIL | Header breaks, no navigation |

---

## Priority Fix Order

1. **C1+C2+C3** -- Fix chat layout model (flex container, internal scroll, sticky composer)
2. **H1** -- Fix user bubble ghost block + border-radius + bg color
3. **H2** -- Hide message actions container when not hovered
4. **MOB1+MOB3+MOB4** -- Mobile responsive overhaul
5. **H3+H4+H5** -- AI pipeline content quality (CoT stripping, tag removal, attribution)
6. **M1+M8** -- Copy feedback + Export dropdown styling
7. **M2** -- Remove dead ThumbsUp/Down or implement
8. **M7** -- Delete confirmation dialog

---

## Files to Modify

| File | Bugs |
|------|------|
| `frontend/src/components/chat/ChatView.ts` | C1, C3, MOB1, MOB2 |
| `frontend/src/components/chat/ChatWindow.ts` | C2, M8 |
| `frontend/src/components/chat/core/ChatBubble.ts` | H1, M6 |
| `frontend/src/components/chat/core/ChatMessage.ts` | H2, M4, M5 |
| `frontend/src/components/chat/core/MessageActions.ts` | M1, M2 |
| `frontend/src/components/chat/ConversationList.ts` | M3, M7, M9, M10, MOB1 |
| `backend/services/chat_service.py` | H3, H4, H5 (prompt engineering) |

---

## Additional Observations (Ultrathink Pass)

### A1. "CHAT" heading above chat area is redundant
The page title "CHAT" (h1) sits between the simulation nav and the chat container. It consumes ~60px of vertical space and provides no value -- the user already clicked the Chat tab and sees the breadcrumb "// CHAT". Remove it or collapse it into the chat header.

### A2. Agent bubbles have left border accent but user bubbles have right border accent
Agent messages: blue/teal left border on the bubble. User messages: orange right border (from `border-right: var(--_bubble-border-width) solid var(--color-primary)`). This asymmetry is intentional but the user bubble's overall dark/harsh appearance drowns out the subtle border accent. The agent bubbles look polished; the user bubbles look like debug rectangles.

### A3. Event Referenced card is well-designed but orphaned
The "EVENT REFERENCED" card between messages (Kryo-Vogel) has good visual design (orange left border, clear typography). However, it sits between two messages without clear visual connection to either. Should it be indented or connected to the preceding message?

### A4. "Load older messages" button styling
The button is a plain outlined rectangle centered at the top. Functional but stark -- no icon, no loading state indicator, no visual hint about how many older messages exist.

### A5. Avatar stacking in conversation header
The three agent avatars in the chat header overlap correctly (z-index stacking). However, clicking them navigates to agent profiles -- this is undiscoverable. No cursor change, no tooltip, no hover effect visible in screenshots.

### A6. User avatar is a plain letter "Y"
The user avatar shows just the letter "Y" (first letter of "You") in a plain circle. Other chat applications show the user's profile picture or initials of their actual name. "Y" for "You" is a poor choice -- it should show "M" for Matthias or use a profile image.

### A7. Composer lacks character count or multi-line affordance
The composer textarea shows "TYPE YOUR MESSAGE..." placeholder and "Shift+Enter for line break" hint, but there's no visual indication of max length, no expanding behavior shown, and the single-line appearance doesn't hint at multi-line support.

### A8. Event strip in header area is confusing
Below the chat header, there's an event strip showing "Kryo-Vogel in Nordlicht verlegen Brutzeit..." with a close button and a "+" button. Its purpose is unclear -- is it a filter? A context pin? The strip takes ~50px of vertical space. The "x" and "+" buttons have no labels/tooltips.

### A9. "Gruppe: Doktor Fenn, Elena Voss" subtitle in ConversationList
The subtitle shows "Gruppe:" prefix which is German in a potentially mixed-language interface. Should use `msg()` for i18n. Also, the group label duplicates the title information.

### A10. Conversation item shows date without year
"17. Feb." in the sidebar -- for conversations from the current year this is fine, but older conversations need year disambiguation. The date format should include year when the conversation is older than the current year.

---

## CSS Measurements (from evaluate)

### User Message Bubble (ChatBubble `.bubble--user`)
```
background: rgb(0, 0, 0)           -- PROBLEM: pure black, too harsh
borderRadius: 0px                   -- PROBLEM: no rounding, looks blocky
padding: 12px 16px                  -- acceptable
width: 232px (for short message)    -- auto-sized, OK
height: 86px (for 1-line text)      -- PROBLEM: 42px unexplained (see H1)
border-right: solid var(--color-primary) -- orange accent, barely visible on black
```

### MessageActions Container
```
width: 58px
height: 30px
position: relative to message
visibility: always rendered         -- PROBLEM: should be hidden by default
```

### Chat Layout Structure
```
ChatView
  └─ complementary "Conversation list"  -- sidebar, no flex-grow
  └─ main "Chat"                        -- no overflow containment
       └─ header (agent info + toolbar)
       └─ event strip
       └─ log "Conversation messages"   -- no overflow-y: auto
       └─ composer                      -- not sticky
contentinfo (footer)                    -- visible below chat
```

---

## Implementation Notes for Fix Session (Context Carry-Over)

### Ghost Block Root Cause Hypothesis (H1)
The `.bubble--user` has `white-space: pre-wrap`. The slotted content from ChatMessage passes text via `<slot>`. If the Lit template has whitespace/newlines between the `<velg-chat-bubble>` tags, `pre-wrap` renders those as vertical space. The `children: []` in the shadow DOM confirms content comes via slot, not direct children. **Check the ChatMessage template for whitespace around the bubble slot content.** Also check if there's a `::before` pseudo-element on `.bubble` or `.bubble--user` adding height.

Additionally: The bubble is 232x86px for "Jo, wie geht es euch heute?" (~180px of text). With padding 12+12=24px vertical, that leaves 62px for content height. Single line at ~16px font = ~20px line-height. So ~42px is unaccounted. Could be: (a) whitespace in slot, (b) a `<p>` or `<div>` wrapper with margins, (c) the `<slot>` element itself having default styling.

### Key Architecture Facts (from memory/handoff)
- **ChatSessionStore** is the single source of truth. ChatWindow has NO local `_messages` state.
- `_initConversation()` loads REST first, THEN joins realtime channel with replay timestamp + reaction callback.
- `confirmOptimistic()` handles broadcast-first race condition.
- **Popover API** in Shadow DOM: must use `popoverTargetElement` JS property, NOT `popovertarget` HTML attribute (Shadow DOM limitation).
- **Reactions** batch-loaded + realtime via `chat:{conv}:reactions` channel.
- **Draft persistence**: localStorage key `velg-chat-draft-{conversationId}`, restored on conversation switch, cleared on send.
- **Pinned conversations**: localStorage key `velg-chat-pinned`, purely client-side, max 5.
- **Export**: Client-side only via `ChatExporter.ts`. Markdown export produced filename `gruppe-doktor-fenn-elena-voss.md`.
- **RealtimeService** manages 3 channels per conversation: typing, messages, reactions.
- **`@starting-style`** on ChatMessage `.row` needs `transition` property, not `animation`.

### Exact File Paths (verified by Explore agent)
```
frontend/src/components/chat/ChatView.ts          -- outer layout (sidebar + chat)
frontend/src/components/chat/ChatWindow.ts         -- header + message feed + composer + export menu
frontend/src/components/chat/ConversationList.ts   -- sidebar: search, pin, rename, date groups
frontend/src/components/chat/core/ChatBubble.ts    -- bubble styling (.bubble, .bubble--user, .bubble--assistant)
frontend/src/components/chat/core/ChatMessage.ts   -- message row layout, avatar, sender, timestamp, actions
frontend/src/components/chat/core/ChatComposer.ts  -- textarea, send button, draft restore
frontend/src/components/chat/core/MessageActions.ts -- hover toolbar (copy, thumbs, regen, edit)
frontend/src/components/chat/core/ReactionBar.ts   -- emoji reaction pills
frontend/src/services/chat/ChatExporter.ts         -- markdown + JSON export
frontend/src/services/chat/ChatSessionStore.ts     -- signal-based state management
frontend/src/services/realtime/RealtimeService.ts  -- realtime channel management
frontend/src/services/api/ChatApiService.ts        -- REST API calls
backend/routers/chat.py                            -- PUT /conversations/{id}/title, etc.
backend/services/chat_service.py                   -- rename_conversation(), business logic
backend/models/chat.py                             -- ConversationUpdate(title: str)
```

### Exact CSS From Source (ChatBubble.ts, verified by Explore agent)
```css
/* Line 42 */
.bubble {
  padding: var(--space-3) var(--space-4);  /* 12px 16px */
}

/* Lines 53-59 */
.bubble--user {
  background: var(--_bubble-user-bg);      /* resolves to rgb(0,0,0) */
  color: var(--color-text-inverse);
  border: var(--border-default);
  border-right: var(--_bubble-border-width) solid var(--color-primary);
  white-space: pre-wrap;                   /* SUSPECT for ghost block */
}

/* Line 312-314 (mobile) */
@media (max-width: 640px) {
  .bubble {
    padding: var(--space-2-5) var(--space-3);
  }
}
```

### ChatMessage Layout (from source)
- User messages: `.content--user` uses `align-items: flex-end` (right-aligned)
- User avatar: `.avatar--user` shows "Y" letter (first char of "You")
- ReactionBar renders below bubble when `m.reactions?.length > 0` -- this is the dark rectangle the user saw, BUT it only shows when reactions exist. The OTHER dark rectangle is the MessageActions container (58x30px).
- MessageActions has buttons rendered but should be visibility-hidden until hover

### Group Chat AI Issues (H3/H4/H5)
The group chat prompt likely tells the AI to respond as multiple agents in a single response. This produces:
1. `[AgentName]:` prefixes that leak into the displayed text
2. One message attributed to Agent A containing Agent B's dialog
3. Sometimes CoT reasoning leaks (Elena Voss 10:47)

**Two-pronged fix needed:**
- **Backend**: Strip `[AgentName]:` prefixes before storing. Or better: split multi-agent response into separate DB messages (one per agent).
- **Frontend fallback**: Regex strip `/^\[[\w\s]+\]:\s*/` from message content display.
- **Prompt engineering**: Add `Never prefix your response with your name in brackets.` to the chat system prompt.

### Layout Fix Strategy (C1+C2+C3)
The fix is a single architectural change in ChatView + ChatWindow:

```
ChatView (the page-level component)
  should set: height: calc(100vh - <header+nav height>); display: flex;
  
  ConversationList (left): flex-shrink: 0; width: 300px; overflow-y: auto;
  ChatWindow (right): flex: 1; display: flex; flex-direction: column;
    Header: flex-shrink: 0;
    EventStrip: flex-shrink: 0;
    MessageFeed: flex: 1; overflow-y: auto;  <-- THIS IS THE KEY
    Composer: flex-shrink: 0;
```

This single change fixes C1 (independent scroll), C2 (sticky composer), C3 (no footer visible), and M3 (sidebar height).

**IMPORTANT: Before applying, verify the CURRENT layout in ChatView.ts.** The component likely already has some flex/grid setup. The fix needs to work WITH the SimulationShell height constraints. Key question: does the SimulationShell already set a max-height on the content area? If yes, ChatView just needs to fill it. If no, ChatView needs to calculate height itself.

Also check: the `<h1>Chat</h1>` heading (A1) sits BETWEEN the SimulationShell nav and the ChatView container. If it's part of the ChatView template, removing it is trivial. If it's injected by the shell, it needs a different approach. The heading consumes ~60px that the chat desperately needs.

### Ghost Block Deep-Dive (H1) -- Verification Steps
The fix session MUST start by reading ChatMessage.ts template to check:

1. **Whitespace in template literal** around `<velg-chat-bubble>`:
   ```html
   <!-- BAD: newlines inside tag become whitespace with pre-wrap -->
   <velg-chat-bubble class="bubble--user">
     ${content}
   </velg-chat-bubble>
   
   <!-- GOOD: no extra whitespace -->
   <velg-chat-bubble class="bubble--user">${content}</velg-chat-bubble>
   ```

2. **Slot content wrapper**: Does ChatMessage wrap the message text in a `<p>`, `<div>`, or `<span>` with its own margins? The accessibility snapshot showed `generic [ref=e284]: Jo, wie geht es euch heute?` as a child of the content div. That `generic` element might have default margins.

3. **`::before` or `::after` pseudo-elements** on `.bubble` or `.bubble--user` -- check if design tokens or the base styles inject any decorative pseudo-elements.

4. **The `<slot>` element inside ChatBubble shadow DOM** -- does it have explicit styling? Some frameworks add default styling to slots.

5. **`line-height` mismatch**: If `.bubble` has `line-height: 1.6` or similar, a single line of text at 16px font would render at 25.6px. With padding 24px that's 49.6px. But the bubble is 86px, so even with generous line-height there's still ~36px unexplained. Likely a combination of factors.

### MessageActions Visibility Fix (H2) -- Approach
The current MessageActions component renders its toolbar always. The CSS likely has:
```css
:host { opacity: 0; transition: opacity 0.15s; }
/* Then the parent ChatMessage does: */
.row:hover velg-message-actions { opacity: 1; }
```
But based on the screenshot, the container is visible (dark bg rectangle). Possible causes:
- The opacity transition isn't applied
- The component has a background-color that shows even at opacity 0 (if using `visibility` instead)
- The background is on a child element that doesn't inherit opacity

Check: Does MessageActions have a `background` on its `:host` or inner container? If so, it needs `visibility: hidden` on `:host` (not just opacity) because background paints at any opacity > 0.

### Composer Behavior Notes
- Send button is `disabled` when textarea is empty (verified via snapshot: `[disabled]`)
- Shift+Enter hint text "Shift+Enter for line break" renders below the composer
- The composer textarea has no visible border/focus state in the screenshots -- check if there's a focus ring
- On 375px mobile, the composer layout looks OK (textarea + send button side by side)

### State Left By Playtest
- **Conversation is PINNED** (I pinned it during testing). Should be unpinned if the user doesn't want it pinned.
- **No messages were sent** -- production data is untouched.
- **Markdown export was downloaded** to `.playwright-mcp/gruppe-doktor-fenn-elena-voss.md`.
- **Browser viewport was reset to 1440x900** after mobile testing.

### Phase 7 Spec Reference
Next planned phase: **Phase 7 (Game-Specific Features)** in `docs/plans/chat-redesign-plan.md` Section 11 (~line 1470). Includes: Agent Personality, Mood Indicator, Event Interleaving, Sound. The bugs found here should be fixed BEFORE Phase 7 starts.

### Open Follow-ups (from memory/chat-redesign-session-handoff.md)
| # | Item | Severity | Phase |
|---|------|----------|-------|
| 8 | Session disposal on conversation switch (memory leak) | Medium | 7+ |
| 9 | EpochChatPanel _loadHistory race condition | Medium | 7+ |
| 10 | Channel subscription error handling | Medium | 7+ |
| 13 | EpochChatPanel visual polish pass | Low | 7+ |
| 15 | ThumbsUp/Down backend -- needs `chat_message_feedback` table | Low | 7+ |
| 16 | Edit action handler -- re-populate composer | Low | 7+ |
| 17 | Regenerate action handler | Low | 7+ |

---

## Screenshots

All screenshots saved as `playtest-chat-{01-20}-*.png` in project root.
Key screenshots:
- `playtest-chat-02-chat-view.png` -- Initial chat view with empty state
- `playtest-chat-03-conversation-open.png` -- Conversation opened, messages visible
- `playtest-chat-04-message-hover.png` -- Hover toolbar on agent message
- `playtest-chat-07-user-message-detail.png` -- User bubble zoomed (H1)
- `playtest-chat-08-search-fenn.png` -- Search filter working
- `playtest-chat-10-full-page.png` -- Full page showing footer below chat (C1/C3)
- `playtest-chat-11-user-bubble-detail.png` -- User bubble ghost block detail (H1)
- `playtest-chat-12-second-user-msg.png` -- Composer overlap (C2)
- `playtest-chat-13-middle-messages.png` -- Middle conversation, agent tags visible (H4)
- `playtest-chat-14-bottom-messages.png` -- Footer visible below chat (C3)
- `playtest-chat-15-pin-hover.png` -- Pin icon on hover
- `playtest-chat-16-pinned.png` -- Pinned section active
- `playtest-chat-17-rename-mode.png` -- Inline rename input active
- `playtest-chat-18-export-menu.png` -- Export dropdown overlap (M8)
- `playtest-chat-19-mobile-640.png` -- Mobile 640px issues (MOB*)
- `playtest-chat-20-mobile-375.png` -- Mobile 375px breakage (MOB3)

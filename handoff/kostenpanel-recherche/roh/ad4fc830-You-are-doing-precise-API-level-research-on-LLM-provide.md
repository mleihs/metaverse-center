# AUFTRAG

You are doing precise API-level research on LLM provider primitives. Load web tools first: ToolSearch query "select:WebSearch,WebFetch". Today is September 2026. Note: there is a `claude-api` skill available that documents the Anthropic API — invoke it (Skill tool, skill name "claude-api") for the Anthropic parts rather than guessing.

THE QUESTION: at the PROVIDER API level, is there a supported way to mark "this assistant message was spoken by a DIFFERENT assistant/character than the one now replying"? This matters because in a multi-character conversation every past character turn is an `assistant` message, and the model may read another character's words as its own.

Investigate precisely, with citations to official API reference docs:

**1. The OpenAI `name` field on messages**
- Chat Completions API: `messages[].name` — what does the official reference say it is for? Historical wording ("An optional name for the participant. Provides the model information to differentiate between participants of the same role."). Is it allowed on `system`, `user`, AND `assistant` messages? Constraints on allowed characters (^[a-zA-Z0-9_-]+$?) — was there a validation error for spaces/non-ASCII?
- Does it actually AFFECT the model? Look for: OpenAI cookbook mentions, the chat markup / ChatML history (`<|im_start|>user name=...`), community/engineering reports testing whether `name` changes behavior, and whether newer models were trained on it. Find evidence either way.
- Responses API (t

---

## Provider-Level Findings: "Different Speaker" Markers & Trailing System Messages

Method note: quotes below are either (a) pulled directly from raw source (HTML/JSON I fetched and grepped myself — highest confidence) or (b) summarized by WebFetch's intermediary model from a fetched page (flagged **[paraphrase]** — could contain summarization drift). Anything from a community forum is flagged **(reported)**, not **(official)**. Anything I could not verify this session is flagged explicitly.

---

### 1. OpenAI

**`name` field, Chat Completions API** — historically documented (verified via DeepSeek's identical OpenAI-compatible schema, official docs, and multiple corroborating community quotes):
> "An optional name for the participant. Provides the model information to differentiate between participants of the same role."

- Allowed on `system`, `user`, and `assistant` message objects (confirmed via [DeepSeek's official docs](https://api-docs.deepseek.com/api/create-chat-completion/), which mirror the OpenAI schema field-for-field on all three role types).
- Character constraint: **(reported)**, and inconsistent across sources/time — one 2026 [OpenAI community thread](https://community.openai.com/t/weird-regex-on-message-name-field/1356753) quotes the validator error as `does not match pattern '^[^\s<|\\/>]+$'` (rejects whitespace, `<`, `|`, `\`, `/`, `>`); an older thread cites `^[a-zA-Z0-9_-]{1,64}$`. Spaces reliably 400. I could not pin down which regex is current — flag as unverified-exact, but "no spaces, restricted charset" is solid across both.
- **Does it actually steer the model?** Unverified either way this session. No OpenAI cookbook page or documented empirical study surfaced. The `<|im_start|>role name=X` ChatML rendering is **(reported/folklore)** — plausible and consistent with the field's purpose, but I did not find an official ChatML spec doc to cite verbatim, and OpenAI never fully published one.
- **Responses API**: `name` is **not supported** — confirmed via two independent [community threads](https://community.openai.com/t/clarification-on-missing-name-field-in-responses-api-and-handling-multi-persona-multi-user-dialogues/1365804) [(1154818)](https://community.openai.com/t/dealing-with-multiple-participants-using-the-responses-api-message-name/1154818): sending it returns an invalid-request error. **(reported, but consistent/empirical — multiple users independently hit the same error)**. No `name` replacement, no multi-participant primitive documented. Community workaround: hand-rolled prefixes like `[Joe]` in message text, with the explicit caveat (quoted) that "the AI won't completely trust that it was not simply typed by the user." I did not verify `conversation`/`previous_response_id` behavior re: multi-participant — unverified, out of scope of what I could confirm.
- **OpenAI-compatible providers**: DeepSeek documents and accepts `name` identically (confirmed). I found **no** GitHub issues or docs this session confirming Azure OpenAI, vLLM, Together, OpenRouter, Groq, or Mistral drop it — my searches were inconclusive. **Explicitly unverified — do not treat as confirmed either way.**

**OpenAI Agents SDK (handoffs)**: [docs](https://openai.github.io/openai-agents-python/handoffs/) state, quoted:
> "When a handoff occurs, it's as though the new agent takes over the conversation, and gets to see the entire previous conversation history."
No mention of marking prior agents' turns as distinct from the new agent's own — **[paraphrase]**, but the core claim (full history, no distinguishing marker) is the load-bearing part and matches the rest of this investigation's pattern.

**OpenAI Realtime API**: no multi-agent/persona-handoff or `name`/participant concept found on the [guide page](https://developers.openai.com/api/docs/guides/realtime) — single-assistant-per-session model.

---

### 2. Anthropic Messages API

**No `name` field** — confirmed directly against the official reference ([platform.claude.com/docs/en/api/messages](https://platform.claude.com/docs/en/api/messages)):
> "Each input message must be an object with a `role` and `content`."
Only `role` and `content`. No participant-identity field of any kind.

**No system role in `messages[]`** — confirmed, quoted directly:
> "there is no `"system"` role for input messages in the Messages API." System prompts go through the top-level `system` parameter.

**Alternation rule — this directly matters for the multi-character problem**, quoted:
> "Our models are trained to operate on alternating `user` and `assistant` conversational turns... Consecutive `user` or `assistant` turns in your request will be combined into a single turn."
This means the API does **not** reject or preserve two consecutive `assistant` turns from two different characters as separate objects — it **merges them into one combined turn**. That's a second, independent way character voices bleed together beyond just "no name field": even if you send Character A's and Character B's replies as back-to-back `assistant` messages, Anthropic collapses them before the model ever sees a boundary.

**Prefill (the actual documented mechanism for "speak as X")** — confirmed via [Claude's prompting best-practices page](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices), "Migrating away from prefilled responses" section, quoted in full:
> "Starting with Claude 4.6 models and Claude Mythos Preview, prefilled responses (providing a partial assistant message for Claude to continue from) on the last assistant turn are no longer supported. Requests with prefilled assistant messages to these models return a 400 error... Earlier models continue to support prefills, and **adding assistant messages elsewhere in the conversation is not affected**."
Two load-bearing facts:
1. The classic technique of prefilling the *live* assistant turn with `"Alice: "` to force the model to speak as Alice is **dead on current-generation models** (Opus 5, Sonnet 5, Fable 5/5.1, Mythos 5/5.1, Opus 4.6/4.7/4.8, Sonnet 4.6) — 400 error. Still works on Sonnet 4.5, Haiku 4.5, Opus 4.5 and older.
2. Historical `assistant`-role turns anywhere *else* in the transcript (i.e., your multi-character history) are **unaffected** — structurally fine, just still unlabeled per the alternation-merge issue above.

**Trailing system message — the closest thing any provider offers, and it's Anthropic's**: current API docs (surfaced via the bundled `claude-api` skill, itself sourced from Anthropic's own docs) document **mid-conversation system messages**: append `{"role": "system", "content": "..."}` directly into `messages[]` (not the top-level `system` field) on **Claude Opus 5, Opus 4.8, Fable 5, Fable 5.1, Mythos 5, Mythos 5.1** (not Sonnet 5), no beta header required. Constraints: must follow a `user` message (or an `assistant` message that ended in server-tool use), and must be either the **last entry in `messages`** or followed by an `assistant` turn — it cannot be `messages[0]`. This is functionally exactly "post-history instructions, right before the reply" — but it's a *system-authority* channel (for operator instructions, not per-character identity), not a per-turn speaker tag.

**No official multi-character/multi-speaker prompting guide found.** The prompting docs cover "Give Claude a role" (single system-prompt persona) and "Structure prompts with XML tags" (for document/content structuring, not dialogue-participant structuring) — no dedicated Anthropic guidance on representing multiple AI characters was found this session; flag as **not found**, not as "doesn't exist."

---

### 3. Google Gemini

Verified directly against the official REST reference ([ai.google.dev/api/generate-content](https://ai.google.dev/api/generate-content)), quoted:
> "A `Content` includes a `role` field designating the producer of the Content and a `parts` field... `role` string Optional. The producer of the content. **Must be either 'user' or 'model'.**"

The `Content` object's full JSON shape is only `{"parts": [...], "role": string}` — **no `name` field, confirmed by the schema itself.**

`systemInstruction` is confirmed **top-level only**, quoted from the `GenerateContentRequest` schema:
> "`systemInstruction` object (`Content`) Optional. Developer set system instruction(s)." — a sibling field to `contents[]`, not an entry inside it. Since `contents[].role` only accepts `user`/`model`, there is no way to place a `system`-role entry inside the conversation array at all — no trailing system message is possible structurally.

**Multi-speaker**: confirmed **TTS-only**. [Speech generation docs](https://ai.google.dev/gemini-api/docs/speech-generation): "For multi-speaker audio, you'll need a `multi_speaker_voice_config` object with each speaker (up to 2) configured as a `speaker_voice_config`." This is audio synthesis, unrelated to chat/text generation or the `contents[]` structure.

---

### 4. Open-weight chat templates — trailing system message, verified against raw `chat_template` Jinja (fetched and grepped directly, not summarized)

| Model | Source | System message must be first? | What happens to a trailing/non-first `system`-role message? |
|---|---|---|---|
| **Llama 3.3-70B-Instruct** | `unsloth/Llama-3.3-70B-Instruct` tokenizer_config.json | Yes — only `messages[0]` is extracted into the canonical system block, which is **always emitted** right after BOS (empty if absent) | **Not hoisted, not rejected.** The generic per-message loop renders every remaining message as `<\|start_header_id\|>' + message['role'] + '<\|end_header_id\|>...'` — since `message['role']` is used literally, a later `system`-role entry (including a trailing one) still renders with a `system` header tag at that position. Syntactically supported; whether the model was trained to treat a *non-first* system tag as authoritative is a separate, unverifiable question. |
| **Qwen2.5-7B-Instruct** / **Qwen3-8B** | Qwen HF repos, same pattern in both | Yes for the canonical block | Same as Llama: condition `(message.role == "user") or (message.role == "system" and not loop.first)` renders with **`'<\|im_start\|>' + message.role + ...`** — role tag stays literally `system`, not converted to `user`. (Correction: an earlier WebFetch-summarized pass on this same file mis-paraphrased this as "becomes a regular user message" — the raw Jinja shows the role string is preserved.) |
| **Mistral-7B-Instruct-v0.3** | `mistralai/Mistral-7B-Instruct-v0.3` | Yes, strictly | **Hard template error.** A pre-loop validator raises `raise_exception("After the optional system message, conversation roles must alternate user/assistant/...")` for anything that isn't `user`/`assistant`/`tool` outside position 0, and the loop's final `else` branch raises `raise_exception("Only user and assistant roles are supported, with the exception of an initial optional system message!")`. A trailing `system` role **errors at render time**, it does not silently degrade. (Also notable: the position-0 system content isn't prepended at the top — it's spliced into the **last** `[INST]...[/INST]` block via `{%- if loop.last and system_message is defined %}`, i.e. Mistral v0.3's *own* template moves it next to the final user turn.) |
| **Mistral-Small-24B-Instruct-2501** | `mistralai/Mistral-Small-24B-Instruct-2501` | No | **Explicitly supported anywhere**, including trailing: `{%- elif message['role'] == 'system' %}{{- '[SYSTEM_PROMPT]' + message['content'] + '[/SYSTEM_PROMPT]' }}`. Every `system`-role message, regardless of position, renders as its own `[SYSTEM_PROMPT]...[/SYSTEM_PROMPT]` block right where it sits. This is the one concretely verified case of a model whose chat template natively supports a genuine trailing/post-history system instruction. |
| **Gemma-2-9b-it** | `unsloth/gemma-2-9b-it` | N/A — no system concept at all | `{% if messages[0]['role'] == 'system' %}{{ raise_exception('System role not supported') }}{% endif %}` — hard error if system is first. The template has no other branch that treats `role == 'system'` specially; Gemma's chat format (`<start_of_turn>user/model`) has no system-turn concept by design, position notwithstanding. |

---

### 5. Trailing-system-message summary across everything checked

| Provider/format | Schema allows system after history? | Actually rendered/honored as instruction there? |
|---|---|---|
| Anthropic Messages API (top-level `system`) | No | N/A — no `system` role in `messages[]` at all |
| **Anthropic mid-conversation `role:"system"` in `messages[]`** | **Yes** (Opus 5, Opus 4.8, Fable 5/5.1, Mythos 5/5.1; not Sonnet 5) | Yes — documented, GA, no beta header |
| OpenAI Chat Completions | Schema doesn't positionally forbid it (unverified this session whether behaviorally honored there) | Unverified |
| OpenAI Responses API | Unverified this session | Unverified |
| Google Gemini | **No** — `systemInstruction` is a separate top-level field, `contents[].role` only accepts `user`/`model` | N/A |
| Llama 3.x template | Renders, tag preserved | Unverified whether model attends to it there (template-only claim) |
| Qwen 2.5/3 template | Renders, tag preserved | Same caveat |
| Mistral-7B-Instruct-v0.3 | **Hard template error** | N/A |
| Mistral-Small-24B-Instruct-2501 | **Yes, natively** | Template treats it identically regardless of position |
| Gemma 2 | No system concept, period | N/A |

---

## Bottom line for the engineering decision

1. **No provider offers a supported "this assistant turn was a different character" marker at the wire-protocol level today.** OpenAI *had* one (`name` on Chat Completions messages) but killed it in the Responses API with no replacement, and its actual effect on model behavior was never empirically verified in what I found. Anthropic never had one at all, and its API additionally **merges consecutive same-role turns**, actively destroying any manual boundary you tried to insert. Gemini's schema (`role: user|model` only, no name) rules it out structurally.
2. The one thing that is real, current, and load-bearing for a multi-character architecture: **Anthropic's mid-conversation `{"role": "system", ...}` message**, which can legally be the very last entry in `messages[]` before generation, on Opus 5/4.8, Fable 5/5.1, Mythos 5/5.1 (not Sonnet 5, no beta header). That's an operator/authority channel, not a per-character tag — but it is the only officially documented "instruction after the transcript, immediately before the reply" primitive found across every provider checked.
3. Prefilling a character name onto the live assistant turn — the classic community workaround — is **dead on every current-generation Claude model** (400 error since Claude 4.6). It still works on Sonnet 4.5/Haiku 4.5/Opus 4.5 and earlier, and (per OpenAI's model-spec/community reports, unverified this session for current models) may still work informally on some OpenAI-family models via forced assistant-turn continuation, though OpenAI's Responses API has no first-class prefill concept either.
4. If you need a genuinely reliable multi-character marker today, the empirically-safest option — not investigated above but implied by every finding — is to encode the speaker identity **inside the message content itself** (e.g., a leading `[CharacterName]:` token or XML-style tag) rather than relying on any protocol-level field, since no provider's field-level mechanism is both (a) currently supported and (b) confirmed to reliably steer model attribution.
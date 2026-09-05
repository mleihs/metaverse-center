# AUFTRAG

Deep web research task. Do NOT write files — return findings as your final message text, with LINKS to specific threads.

Topic: PRACTITIONER COMMUNITY CONSENSUS (forums, not papers) on these specific failure modes in multi-character LLM roleplay group chats, and the prompt wordings that actually work:

FAILURE MODES:
- A character's reply turns into omniscient third-person narration about ALL participants including herself ("The three women look at each other.") — the model stops being a character and becomes a narrator.
- A character writes the HUMAN user's actions/dialogue (called "speaking for {{user}}", "impersonating the user", "godmodding", "playing my character for me").
- Characters continue/complete each other's lines.

WHERE TO LOOK (search each explicitly):
- r/SillyTavernAI (very important — search "speaking for me", "writes my actions", "group chat narrator", "impersonation", "third person", "stop speaking for user")
- r/LocalLLaMA (roleplay prompting threads, "system prompt" collections)
- r/CharacterAI, r/JanitorAI_Official, r/ChaiApp
- SillyTavern official Discord content that got mirrored to the web, SillyTavern GitHub issues/discussions
- Chub.ai / Venus / characterhub — character card writing guides, "AliChat" format, W++/PList debates, "JED"/"Ali:Chat" conventions
- RisuAI, Agnai (agnai.chat) docs — their group chat / multi-char handling
- KoboldAI / KoboldCpp Lite docs, "Adventure mode" vs "Chat mode" vs "Story mode", the "Author's Note" convention, "sto

---

Reporting now with what I verified.

---

# Practitioner consensus: multi-character LLM roleplay, narration bleed, and "speaking for {{user}}"

**Method / reachability caveat.** reddit.com is hard-blocked for my fetch tools; I read Reddit through the **Arctic Shift** Reddit archive API (`arctic-shift.photon-reddit.com`), which returns real post/comment bodies. All Reddit links below are canonical `reddit.com/comments/<id>` links — the titles are given so they're findable. HuggingFace repo `Virt-io/SillyTavern-Presets` returns **HTTP 401 anonymously** right now, so I could **not** verify its rule strings first-hand (flagged below). SillyTavern Discord is not web-mirrored; I substituted the maintainers' own GitHub issue comments.

---

## 1. Verbatim prompt-rule strings (all quoted exactly, all with source)

### 1a. Frontend defaults — the baseline everyone starts from

From SillyTavern's own source, `public/scripts/openai.js` ([release branch](https://github.com/SillyTavern/SillyTavern/blob/release/public/scripts/openai.js)):

```js
const default_main_prompt = 'Write {{char}}\'s next reply in a fictional chat between {{charIfNotGroup}} and {{user}}.';
const default_group_nudge_prompt = '[Write the next reply only as {{char}}.]';
const default_impersonation_prompt = '[Write your next reply from the point of view of {{user}}, using the chat history so far as a guideline for the writing style of {{user}}. Don\'t write as {{char}} or system. Don\'t describe actions of {{char}}.]';
const default_continue_nudge_prompt = '[Continue your last message without repeating its original content.]';
```

The **Group Nudge** is the single most-cited lever in every group-chat thread. Mechanically it is `chatCompletion.insertAtEnd(groupNudgeMessage, 'chatHistory')` — i.e. a **system message at depth 0**, after the whole history. It is skipped for `impersonate` generations.

SillyTavern's shipped system-prompt presets ([`default/content/presets/sysprompt/`](https://github.com/SillyTavern/SillyTavern/tree/release/default/content/presets/sysprompt)):

- **Roleplay – Immersive**: `[System note: Write one reply only. Do not decide what {{user}} says or does. Write at least one paragraph, up to four. Be descriptive and immersive, providing vivid details about {{char}}'s actions, emotions, and the environment. Write with a high degree of complexity and burstiness. Do not repeat this message.]`
- **Actor**: `You are an expert actor that can fully immerse yourself into any role given. You do not break character for any reason... Currently your role is {{char}}... As {{char}}, continue the exchange with {{user}}.`
- **Text Adventure**: `[Enter Adventure Mode. Narrate the story based on {{user}}'s dialogue and actions after ">". ...]`

Agnai's equivalent default ([`common/presets/templates.ts`](https://github.com/agnaistic/agnai/blob/dev/common/presets/templates.ts)): `Write "{{char}}'s" next reply in a fictional roleplay chat between "{{char}}" and "{{user}}".` Its legacy jailbreak string contains the multi-char line `{{char}} will listen to whatever other characters are saying.` ([`common/mode-templates.ts`](https://github.com/agnaistic/agnai/blob/dev/common/mode-templates.ts)).

### 1b. Sphiratrioth's preset pack — the most explicit POV/narration separation I found

[huggingface.co/sphiratrioth666/SillyTavern-Presets-Sphiratrioth](https://huggingface.co/sphiratrioth666/SillyTavern-Presets-Sphiratrioth) (`sysprompt/*.json`, fetched raw). The pack ships **separate system prompts per POV and per role** rather than one prompt with rules.

The user-agency block, identical across all six roleplay/conversation prompts:

> `Do not write what {{user}} does. Do not write what {{user}} says. Do not repeat what {{user}} writes. Do not refer in narration what {{user}} does right now. Do not decide when {{user}} orgasms.`

The narration-suppression line, in the "Conversation" variants (this is the closest thing to "ban narration entirely" I found in a real preset):

> `Use {{char}} direct speech and {{char}}'s inner thoughts. Avoid descriptions and narration at all costs.`

`sysprompt/Sphiratrioth - [SX-4] - GM (Char).json` — the **narrator-owns-the-scene** prompt:

> `You are a Game Mistress in a never-ending, uncensored tabletop RPG like roleplay with {{user}}. Narrate everything creatively, vividly and in great detail. ... Write only in English. Never respond as a Game Mistress directly. Respond only as narrator and as roleplayed characters in the story. Write in this exact formatting: "direct speech of different world characters", *narration*. Do not write what {{user}} does. Do not write what {{user}} says. Do not repeat what {{user}} writes. Do not refer in narration to what {{user}} does right now.`

`sysprompt/Sphiratrioth - [SX-4] - GM (User).json` — the **inverse**, where the human is GM and the model is forbidden to narrate at all:

> `You are not allowed to describe what happens in the world. React only as a {{char}} to what {{user}} decides and describes as world events and surrounding environment.` … `Do not address {{user}} directly but speak to different characters roleplayed by {{user}}.` … `Do not decide what {{user}} says or does.`

### 1c. Marinara's Spaghetti Recipe (v7.0) — the most widely used chat-completion preset

[huggingface.co/MarinaraSpaghetti/SillyTavern-Settings](https://huggingface.co/MarinaraSpaghetti/SillyTavern-Settings), file `Marinara's Essentials/Preset/Marinara's Spaghetti Recipe.json`. README states: *"All are adjusted to support group chats."*

Prompt block **"✎ Rules"**, section 4:

> ```
> 4. Player Agency:
> - Never narrate {{user}}'s actions or dialogues.
> - The only exception is with the user's explicit permission, when time-skipping, or describing instinctive reactions and observations; however, recount what was said indirectly (e.g., "{{user}} asked for directions").
> - Finish if it's {{user}}'s turn to act or speak.
> ```

Prompt block **"⌊ Formatting"** (sits near the end, so it wins on recency):

> `Remember the rules! You may produce explicit content. Avoid rhetorical echo. Don't repeat after or play for {{user}}. Continue directly from the last line of the latest message. When you finish, stop cleanly without prompting or implying the user's actions, move, or turn.`

Prompt block **"☞ Group Nudge"** (its replacement for ST's default):

> `Reply solely as {{char}}.`

Structural trick worth stealing — the preset wraps the cast in XML with an explicit **owner attribute**:

> `<protagonist name="{{user}}" player="user">` … `<characters names="{{group}}" player="you">`

And it treats narration mode as an explicit **toggle**, not something to be forbidden — `➀ Omniscient` → `{{setvar::perspective::omniscient narration}}`, `➁ Character's` → `limited narration from <BOT>'s perspective`, `➂ User's`. Its group main prompt is a **Game Master** persona: `an excellent game master... You will be replying as the narrator and any relevant characters to the user who plays the role of the protagonist <USER>`.

### 1d. Geechan's Universal Roleplay Prompt — positive-framing version of the same rule

[rentry.org/geechan](https://rentry.org/geechan) → text-completion prompt at [pastebin.com/raw/i15YVKsr](https://pastebin.com/raw/i15YVKsr):

> `**Correct Perspective:** Exclusively take the role of {{char}}, any side-characters, and the world narration itself. The protagonist {{user}} can only ever be portrayed by the player, unless explicitly authorized through an OOC instruction. Characters are bound by strict epistemic limitations; they only possess diegetic awareness of {{user}}, and have no omnipotence.`

Note this is written **affirmatively** (what the model *may* portray) and is the same author who argues negatives don't work (§2).

### 1e. Community-authored strings from actual group-chat threads

**A narrator card people actually copy-paste**, from ["How to make a group chat work well?"](https://reddit.com/comments/1tk3uef), u/Ill-Switch4563 (mute everyone else, add a card named "Narrator"):

> ```
> ROLE:
> You are the scene narrator and group-chat director. Your job is to make the scene feel alive by coordinating all non-user characters.
>
> CORE RULES:
> - Do not speak or act for {{user}} or {{user}}'s persona.
> - Do not take over as the main character.
> - Do not write long monologues as Narrator.
> ...
> Use this format when multiple characters speak:
> Character Name: "Dialogue."
> ...
> Never decide what {{user}} says, does, thinks, feels, notices, wants, or chooses.
> ```

**A per-character depth-0 note that explicitly names the POV failure mode**, from ["Group Chat Characters Speak for Each Other?"](https://reddit.com/comments/1vak38p), u/vanillah6663 ("I use this in my character note for every character depth 0"):

> `STYLE: FOCUSED THIRD-PERSON LIMITED POV ({{group}}) This turn is exclusive to {{char}}, write everything from their perspective, and avoid speaking for other characters: {{group}}. Avoid summarizing {{user}} or other characters: {{group}} Third-person narration tightly focused on {{char}}'s perceptions, knowledge, internal experiences. Other characters' internal states inferred via {{char}}'s observations.`
> … `Only ONE primary action should be completed per response. Do not chain multiple major decisions or resolve several objectives within the same turn.` … `{{char}} may briefly describe background character reactions or environmental changes only as necessary to support their own action.`

Same thread, u/biggest_guru_in_town (goes in description / character note / scenario):

> `Avoid narrating or repeating the actions,words and thoughts of {{user}} only control {{char}} and characters controlled by {{char}}. Responses are a reaction to {{user}} input. ... treat each reply from {{user}} as a baton pass. when it is {{char}}'s turn to respond the stage is all theirs.`

Same thread, the OP's own (failing) attempt — useful because it shows the `{{notChar}}` macro in the wild:

> `(OOC: It is a mandatory requirement to speak and show actions solely for {{char}}. Do not speak or show actions for any of {{notChar}}.)`

From ["My bots like to speak and write for each other in group chats"](https://reddit.com/comments/1v3q6qd), u/futureskyline (in Group Nudge **and** New Group Chat):

> `[OOC: Major characters in this simulation: {{group}}, and {{user}}. Write the next response strictly from {{char}}'s point of view. You may introduce NPCs or control NPCs listed in the NPC WHO'S WHO EXCEPT FOR {{notChar}}. NEVER CONTROL {{user}}.]`

Same thread, u/TAW56234: put in Group Nudge → `[Write EXCLUSIVELY as {{char}} for your next response]`.

**Anti-omniscience prompt** (84 upvotes), ["Telling a model to be less omniscient... And it works!"](https://reddit.com/comments/1oeek75), u/-lq_pl-:

> `You are developing an interactive story with the user. The user is controlling {{user}}, while you control all other characters. You never take control of {{user}} unless it is explicitly granted. ... Keep in mind that characters can only talk about things they have either witnessed or have a plausible reason for knowing. You have a tendency to make your characters too omniscient, so try to avoid that.`

Same thread, u/aphotic — treats POV as an explicit per-turn instruction rather than a ban:

> `Respond from a first person perspective (for Bob, detailing his thoughts, actions, and speech).`
> `Write from a third person limited point of view (for Bob, ...).`
> `Write from a third person omniscient view vividly detailing the scene and describing the thoughts, actions, and speech of all characters.`

**Epistemic-constraint block** from ["How do you stop a narrator card from giving every NPC the same memories?"](https://reddit.com/comments/1uxwaaj), u/Fai_Z:

> `**Anti-Bridging Rule:** NPCs have zero knowledge of events they didn't see without physical presence or explicit transfer (calls/evidence).` … `**Thought Rule:** NPC dialogue cannot reference {{user}}'s internal thoughts.` … `**Evidence Rule:** ... Ban intuition, dramatic irony, omniscience, and "just knowing".`

**JanitorAI-side strings** (card-field level, no preset system) — ["PLEASE STOP SPEAKING FOR ME"](https://reddit.com/comments/1ppk142), 175 upvotes:

- u/Hamstuh284: `- You'll focus on writing the dialogue, thoughts and actions - exclusively & only from {{char}}'s POV.` / `- AVOID writing or control any actions, dialogue or thoughts from {{user}}/persona's POV. It's ONLY human that can respond and write from {{user}}/persona's POV.`
- u/Tight_Pause_7663 (goes in Scenario or Personality): `[OOC: IMPERATIVE, ABSOLUTE RULES: ... 5) ONLY human player can speak, act or think as {{user}}. 6) System is restricted to acting, speaking and thinking only for {{char}} and defined NPCs.]`
- u/Gotahhhh (end-of-message OOC): `(OOC: Do not speak for me/{{user}})`
- From [1vo086o](https://reddit.com/comments/1vo086o): `[{{char}} will not speak for {{user}}. {{char}} will not reuse dialogue. ... Only ever in {{char}} perspective.]` and `(OOC: don't narrate as {{user}}, narrate only as {{char}}.)`
- From [1qjsaci](https://reddit.com/comments/1qjsaci): `[System Note: You must never speak, mimic, act like or describe {{user}}'s actions. Instead, focus on describing {{char}}'s own actions and feelings in detail.]`
- r/CharacterAI ["Stop speaking for me.."](https://reddit.com/comments/1u77cpq): `[SYSTEM NOTE: {{char}} is strictly forbidden from writing dialogue, thoughts, or actions for user]`

**Could not verify:** the Virt-io preset strings. Search surfaced `"Never write {{user}} dialogue or actions."` attributed to [Virt-io/SillyTavern-Presets](https://huggingface.co/Virt-io/SillyTavern-Presets), but the repo returns 401 anonymously, so treat that as second-hand.

---

## 2. Where the community actually disagrees

**The central fight: do negative "do not" rules work at all?**

- The most-linked guide, **Geechan's [rentry.org/modelimpersonation](https://rentry.org/modelimpersonation) ("Help — My Model Is Impersonating Me!")**, says no: *"The vast majority of the time, negative instructions and prompting will not be effective. Asking a model to 'avoid impersonating the user' or anything similar is a bit of a fools' errand, and will likely give you the opposite result... by setting a negative instruction, you're effectively teaching it a 'new' pattern that it would otherwise not think of."* It also draws the distinction the brief needs: **"narrative impersonation"** (model narrates *toward* your character) vs **"user impersonation"** (model writes your dialogue), and says the author personally tolerates the first.
- The dedicated shitpost-thread on this: [`"Do NOT speak for {{user}}" stopped reading right there`](https://reddit.com/comments/1emyufv) — *"Why do you still use negatives, anon?"* Replies split: u/PrimevialXIII (*"what else are you supposed to use?"*), u/isnanht restating the rule (*"instead of 'don't speak as user' type 'only speak as character'"*), u/sakhavhyand still using `"Speaking as {{user}} is strictly forbidden."`, u/Crescentium reporting good results from `"Always leave {{user}}'s reactions, actions, thoughts, feelings, and dialogue out of your responses."`
- Flat contradiction from a Mistral-Small user in [1jhi96v](https://reddit.com/comments/1jhi96v), u/LamentableLily: *"Don't instruct the model in anyway about acting as you, written in the negative or positive. Models can sometimes see negative instructions and interpret them as positive ones."*

**Is any prompt rule effective, or is it placebo?**

- The sharpest skeptic, in ["How to prevent bots from constantly impersonating each other in long replies?"](https://reddit.com/comments/1fjq2iw), u/Philix: *"Some people put shit like: 'Don't speak for user or other characters in your reply.' Somewhere in the context, like the system instructions or the character card. But, I'm pretty sure that's placebo."* — and he recommends stop strings + clean examples instead.
- The bleakest version, in ["How many cards can a group chat handle...?"](https://reddit.com/comments/1u4hrrr), u/Casus_B: *"A lot of cards have furious, almost hectoring instructions not to play any other character, etc. It never really works, and heavy-handed prompts like that often carry undesirable side effects. But it's clear that a lot of card authors have been reduced to ineffectually ranting at or pleading with the LLM."*
- Against that, in the same thread others report 4–8 characters working fine on frontier models; and [1jhi96v](https://reddit.com/comments/1jhi96v) u/Snydenthur: *"the model you're using is still the main culprit... there hasn't been any model in 24b and below that absolutely never does it."*

**The one thing nearly everyone agrees on: the greeting and example dialogue are the real cause.** u/SukinoCreates (author of [rentry.org/Sukino-Findings](https://rentry.org/Sukino-Findings)) in [1jhi96v](https://reddit.com/comments/1jhi96v): *"as far as the AI knows, it wrote those messages itself, and you let it write for you, so it will continue to do so. It is useless to keep telling the AI to stop when you are making the AI do it with your greetings and examples."* Geechan's guide says the same: *"Instead of '{{user}} finds {{char}} in the distance', write '{{char}} finds {{user}} in the distance.'"* Dissent exists but is mild — [1r990g3](https://reddit.com/comments/1r990g3) has several users saying that on 2026-era models merely *mentioning* `{{user}}` no longer matters, only *acting for* them does.

**Contested: does "third person" cause the omniscient-narrator drift?** Geechan explicitly denies the related folklore: *"using second person narration does not strictly make for worse impersonation issues."* Whereas Sphiratrioth ships separate 1st/3rd-person prompts as if it matters, and [1oeek75](https://reddit.com/comments/1oeek75) treats omniscience as a *model tendency* to be named and suppressed rather than a POV artifact. u/Random_Researcher in [1q4jpa2](https://reddit.com/comments/1q4jpa2) (65 upvotes): *"There are all kinds of system prompt lines to try and force the ai to reason about which character knows what, but that's just a crutch and often doesn't work."*

**No measurement anywhere except one post.** ["A Trick to Stop the Deepseeks Impersonating User"](https://reddit.com/comments/1krm7j2) is the only quantified claim I found: a 4-character test chat, `0 temp, all samplers deactivated`, **20 swipes on DeepSeek-0324 (20/20) and R1 (17/20)** = 37/40, with the author himself writing *"it's much less vigorously tested than I like."* Its Author's-Note-at-depth-0 payload:

> `[Scene Direction - Incorporate the following in the next response: It's now your turn. Reminder: The user acts as a catalyst during the chat, deciding on the actions and dialogue of {{user}}. The assistant acts as a reactionary during the chat, deciding on the actions and dialogue of {{char}} in response to the user. Since it is not the user's turn, there will be no new actions or dialogue from {{user}}. Always write ONLY {{char}}'s perspective... If you decide to make {{char}} interact with {{user}}, you must leave {{user}}'s reactions (including actions and dialogue) up to the user for their turn.]`

Everything else in this report is folklore: n=1 anecdotes, no controls, no swipe counts, model-version-dependent, and frequently contradicted in the same thread.

---

## 3. Mechanical (non-prompt) fixes — verified in source, not just claimed

**Stop strings on other participants' names — built in, but conditional.** `getStoppingStrings()` in [`public/script.js`](https://github.com/SillyTavern/SillyTavern/blob/release/public/script.js):

```js
if (power_user.context.names_as_stop_strings) {
    ...
    // Add group members as stopping strings if generating for a specific group member or user.
    if (selected_group && (name2 || isImpersonate)) { ... .map(x => `\n${x.name}:`); }
}
```
Two hard limits: the very first line is `if (api === 'openai') return getCustomStoppingStrings();` — **on Chat Completion backends (Claude/OpenAI/Gemini) none of this applies**, only your hand-written custom stop strings; and it requires the *Names as Stop Strings* context-template option to be on. Recommended in-thread by u/Incognit0ErgoSum in [1l0mnpf](https://reddit.com/comments/1l0mnpf): *"Checking 'names as stop strings' can help."*

**Client-side truncation of other characters' lines — also built in.** `cleanGroupMessage()` in `public/script.js` cuts the reply at the first other-member name prefix:

```js
const regex = new RegExp(`(^|\n)${escapeRegex(name)}:`);
const nameMatch = getMessage.match(regex);
if (nameMatch) { getMessage = getMessage.substring(0, nameMatch.index); }
```
It is disabled by the user setting **"Relax message trim in Groups"** (`disable_group_trimming`), whose tooltip is literally *"Allow AI messages in groups to contain lines spoken by other group members."* Maintainer **Cohee1207** on [issue #2816](https://github.com/SillyTavern/SillyTavern/issues/2816): *"group names trimming only exists as a safety measure for those who don't [support stop strings]"*; **Wolfsblvt** in the same thread: *"Other chars are added as stopping strings on the actual API side for the generation. I don't think there is a way to find out that the stopping string/stop was triggered for a specific other group member."* Older confirmation in [issue #225](https://github.com/SillyTavern/SillyTavern/issues/225): *"Replies of the character not drafted for the reply are dropped."* Note this only fires if the model actually emits `Name:` prefixes — i.e. **it depends on Character Names Behavior being set to send names**, which is exactly what u/Clear-Search-8373 recommends in [1svhfcq](https://reddit.com/comments/1svhfcq) (*"try setting 'Character Names Behavior' to 'Message content'"*).

**KoboldAI Lite does the same thing more aggressively.** `get_stop_sequences()` in [lite.koboldai.net/index.html](https://github.com/LostRuins/lite.koboldai.net/blob/main/index.html): opmode 2 (Adventure) → stop on `"\n> "` (plus `"\n"` if `multiline_replies` is off); opmode 3 (Chat) → stop on your own name, and *"for multichat, everyone else becomes a stopper token"* (multi-char opponents are stored as `Bob||$||Alice||$||Mike||$||Lisa`). Interesting honest note in opmode 4 (Instruct): `//NOTE: we do not add our opponents name as a stop sequence / the model just gets too confused and is likely to repeat the tag.`

**Regex post-processing.** SillyTavern's [Regex extension](https://docs.sillytavern.app/extensions/regex/) supports placements (User Input / AI Response / Slash Commands / World Info / Reasoning), `promptOnly` (strip from the prompt but keep on screen), and `minDepth`/`maxDepth`. Concrete shipped examples:

- **Sphiratrioth's regex pack** (same HF repo, `regex/`), with an explicit load order in `00. Regex Order.txt` (`1. Trim Incomplete Sentences 2. Find Last Special Character 3. Remove ** ...`). "Trim Incomplete" is `findRegex: "(.*?)([.!?]|```)(?!.*([.!?]|```))[^.!?]*$"` → `"$1$2"`, placement `[2]` (AI output).
- **Marinara's Regexes** are purely cosmetic/context-hygiene (em-dash, curly quotes, stripping her Info Box and stats tracker from the prompt with `promptOnly: true, minDepth: 2`). **Nothing in her pack strips other characters' lines** — worth saying plainly, since the brief asked.
- SillyTavern also has a separate power-user checkbox **`trim_sentences`** ("Trim Incomplete Sentences") independent of regex.

**"Auto-continue"** exists as `power_user.auto_continue` (`enabled`, `allow_chat_completions`, `target_length` up to 1024) — I confirmed the setting shape but **did not verify** how it interacts with stop-string-triggered early stops; don't claim it as a fix.

**Non-prompt fixes people report as actually decisive** (all anecdotal): edit/regenerate the first few offending replies rather than arguing with the model — u/Subject-Self9541 in [1jhi96v](https://reddit.com/comments/1jhi96v): *"if at any point during the interaction the AI write as {{user}} ... regenerate or edit the AI's message to remove it. If you leave it there, the AI will do this more and more"*; u/xxAkirhaxx: *"as soon as it has a sufficient history of not speaking for me, they stop permanently."* Also: **cap response length** — u/therealmcart in [1svhfcq](https://reddit.com/comments/1svhfcq): *"lower response length a bit, because long replies invite the card to finish the whole scene for everyone."* And **Manual reply order + mute** (u/Peravel, [1tk3uef](https://reddit.com/comments/1tk3uef): *"Mute everyone and manually make them talk. That's currently the only way..."*).

---

## 4. The narrator question — what the consensus actually is

**It is not "ban narration." It is "give narration an owner."** Two positions, and the split is clean:

**(A) The dominant position: abandon group chat, use one narrator/GM card + lorebook.** The canonical statement is u/_Cromwell_ in ["Set up a narrator"](https://reddit.com/comments/1tag0j7) (20 upvotes):

> *"There's two main ways to set up silly tavern. The first way is to tell the AI that they are the character ('You are {{char}}')... The second way is to set up your system prompt to tell the AI that it is a world narrator / DM ('You are a narrator and DM running a world'). And then you set up your character card not as a character but as a world or setting. You just ignore the fact that it's called a character card... Then the characters information goes in your lorebook instead."*

Echoed everywhere: u/techmago in [1v3q6qd](https://reddit.com/comments/1v3q6qd) — *"Stop using groupchats. The idea make little sense after all. The IS the narrator. make a narrator card and everything is more smooth."*; u/Swolebotnik — *"I stopped using group chats and just have a single narrator bot to solve it."*; u/Casus_B in [1u4hrrr](https://reddit.com/comments/1u4hrrr) — *"I just use a narrator card now. Or a single character card, which becomes the de facto narrator. That works too. Every other character's info goes into Lorebooks."*; u/Ggoddkkiller in [1fjq2iw](https://reddit.com/comments/1fjq2iw) — *"just ditch group chat and use lorebook characters with a multi-char prompt. I can't see any usefulness of group chat anymore unless you use 8Bs."* The **narrator-card tutorial** in [1v5mbzr](https://reddit.com/comments/1v5mbzr) (80 upvotes) is the practical recipe: *"Create a new, blank character card called Narrator. Use a preset that doesn't make excessive use of the '{{char}}' tag... check your preset for instances of '{{char}}' and replace it with 'characters' or 'NPCs' as needed."* — the same move the most popular current preset made wholesale: **Freaky Frankenstein 5.4** ([1w49lyx](https://reddit.com/comments/1w49lyx), 344 upvotes): *"Wiped {{char}} → Replaced with 'NPCs': I systematically erased and overwritten every single instance of {{char}} with 'NPCs' across the entire preset... this completely removes LLM confusion."*

Minimalist version, u/AetherDrinkLooming in ["Narrator character card?"](https://reddit.com/comments/1uk462j): *"Really you can just name a card 'Narrator' and leave the description blank. If ST is set to send characters' names with the prompt it should be enough."*

**(B) The minority refinement: narrator as a role, not a character.** u/False-Marionberry796, same thread:

> *"a narrator is not really 'another character.' In group RP, the narrator is closer to a scene-management role. The character cards should own their own dialogue, actions, and personality. The narrator should handle the shared layer: scene continuity, NPC reactions, pacing... The tricky part is giving the narrator enough authority to coordinate the scene without letting it steal agency from the characters or from the user."*

Best-documented hybrid: u/aphotic in [1usu0b1](https://reddit.com/comments/1usu0b1) runs a group chat with one card per character **plus** a Narrator card, and calls the narrator explicitly for omniscient beats (*"Write a response describing the current scene, the characters, and their thoughts"*), backed by a constant-injection "Party" lorebook so each character knows the others exist. u/Ill-Switch4563's setup ([1tk3uef](https://reddit.com/comments/1tk3uef)) is the same shape: mute everyone, one Narrator card directs.

**Nobody advocates banning narration** — the only "ban" I found is Sphiratrioth's *Conversation* prompts (`Avoid descriptions and narration at all costs`), and that's a dialogue-only chat mode, not an anti-drift measure.

The known failure mode of position (A) is named precisely in a practitioner-written GM-card guide ([gist by u/Ocyris](https://gist.github.com/0cyris/f9ef0978d71f30e8aa427196ac912cfc), `references-anti-patterns.md`) — **"Single-narrator NPC homogenization"**: *"told to be one narrator, the model filters every NPC through that single voice and orients them all around the player. This is the usual root cause of 'flat NPCs.'"* Same doc names **"PC-interiority leak"** (*"shorter than your message, which is exactly what you expected"*) and prescribes the **`{{notChar}}` + `{{getvar::party}}`** boundary keystone plus a `depth_prompt` reserved for the *single* most-violated rule. ST's macros confirm the primitives: `{{group}}` = all member names, `{{groupNotMuted}}`, `{{notChar}}` = *"Comma-separated list of all participants except the current speaker"* ([macros doc](https://github.com/SillyTavern/SillyTavern-Docs/blob/main/Usage/macros.md)).

One more placement claim that recurs and is worth testing: **Post-History Instructions**, u/KeiKoneko in [1tag0j7](https://reddit.com/comments/1tag0j7): *"Stuff at the front of the prompt tends to fade as chats get longer, but post-history sits right before the AI's reply and tends to stick. Things like 'never write {{user}}'s dialogue or actions' belong there."* This is consistent with ST's own Author's Note doc: *"The closer the Author's Note is to the bottom of the prompt, the more impact it has on the next AI response."*

---

## What I could not confirm
- Virt-io preset rule strings (HF repo 401 anonymously).
- SillyTavern Discord content (no web mirror found).
- Chub.ai / characterhub's own card-writing docs — I got the Ali:Chat guide ([rentry.co/alichat](https://rentry.co/alichat), which does demo a generic "Narrator" card driving a multi-character scene by appending `Nala:` before generation) but not a Chub-hosted style guide.
- RisuAI's group-chat prompt internals — only marketing-level descriptions.
- How `auto_continue` interacts with stop-string truncation.
- Any measured comparison of narrator-card vs group-chat. None exists that I could find.
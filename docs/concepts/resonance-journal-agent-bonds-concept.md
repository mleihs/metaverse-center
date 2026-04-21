# Resonance Journal & Agent Bonds — Detailed Concept Document

**Date**: 2026-04-16
**Status**: Concept — ready for review
**Priority**: Next major feature(s)
**Research basis**: 50+ games, platforms, literary works, and academic sources

---

## Table of Contents

1. [Research Foundation & Design Principles](#1-research-foundation--design-principles)
2. [The Resonance Journal — Detailed Design](#2-the-resonance-journal--detailed-design)
3. [Agent Bonds — Detailed Design](#3-agent-bonds--detailed-design)
4. [The Intersection — How Both Systems Compose](#4-the-intersection--how-both-systems-compose)
5. [Ethical Design Commitments](#5-ethical-design-commitments)
6. [Implementation Sketch](#6-implementation-sketch)
7. [Research Sources](#7-research-sources)

---

## 1. Research Foundation & Design Principles

### 1.1 The Problem Statement

Velgarien has three powerful game loops — Resonance Dungeons (burst PvE), Epochs (competitive seasons), and Living-World Simulations (sandbox stewardship). Each is mechanically rich. But:

- **Weak coupling**: Dungeon loot declares effects (building repair, aptitude boosts) but the application chain is incomplete. Epoch intel doesn't feed back into dungeon design. The Forge doesn't integrate with playable systems.
- **No daily engagement hook**: All engagement is event-driven (epoch cycles) or self-directed (sandbox). Nothing creates a "check in tomorrow" rhythm.
- **Thin player identity**: No persistent progression. Each epoch is a fresh start. Achievements are cosmetic. The player's "save file" is a list of simulations owned and badges earned.
- **Managerial, not emotional**: The simulation has a gorgeous internal metabolism (needs, mood, moodlets, opinions, autonomous events) but the player interacts with it as a city planner, not a caretaker.

### 1.2 Design Principles Extracted from Research

From 50+ sources across games, literature, philosophy, and design theory, we extract these governing principles:

#### For the Resonance Journal

| # | Principle | Source | Mechanic |
|---|-----------|--------|----------|
| J1 | **Knowledge as material, not record** | Cultist Simulator | Lore fragments are combinable, spendable, transformable — not just entries to read |
| J2 | **Graph over list** | Outer Wilds | Connections between entries matter more than entries themselves |
| J3 | **Dual-phase commitment** | Disco Elysium | Internalizing knowledge costs something before it pays off |
| J4 | **Batch validation** | Return of the Obra Dinn | Reward confident synthesis, not individual guesses |
| J5 | **Qualities as dual-use** | Fallen London / Sunless Skies | Every journal entry is both narrative state and mechanical currency |
| J6 | **Cross-system feeding** | Hades / GW2 Wizard's Vault | Every game loop writes to the same journal without any single loop feeling mandatory |
| J7 | **Absence as design** | FromSoftware | Interpretive gaps that the player and community fill |
| J8 | **Constellation over chronology** | Walter Benjamin / Aby Warburg | Meaning through juxtaposition of fragments across time, not sequential narrative |
| J9 | **Expand options, not power** | Loop Hero / Deep Rock Galactic / Balatro | Meta-progression unlocks alternative playstyles, not stat boosts |
| J10 | **The journal transforms the journaler** | Jung's Red Book / Basho | The act of recording changes the recorder. Late entries should differ from early ones |

#### For Agent Bonds

| # | Principle | Source | Mechanic |
|---|-----------|--------|----------|
| B1 | **Persistence creates responsibility** | Tamagotchi / Stardew Valley | The agent exists when you're not looking |
| B2 | **Scarcity creates meaning** | Persona 5 / Fire Emblem | Limited bond slots force you to choose who matters |
| B3 | **Decay invites ritual, not punishment** | Neko Atsume / Animal Crossing | "What changed while I was away?" not "What did I lose?" |
| B4 | **Observation creates attachment** | Nier: Automata / RimWorld | Watching behavior is more powerful than interaction menus |
| B5 | **Constraint creates intimacy** | Kind Words / 80 Days | Short messages feel more personal than long ones |
| B6 | **State reflection beats state reporting** | Undertale / Celeste | "I haven't seen the sky in days" > "Mood: lonely, Stress: 7" |
| B7 | **Friction represents feeling** | Florence / Signs of the Sojourner | Interaction mechanics mirror the emotional state of the relationship |
| B8 | **Farewell creates meaning** | Spiritfarer / Pyre | The knowledge that a bond may end makes it precious |
| B9 | **I-Thou over I-It** | Martin Buber | The bond measures quality of attention, not frequency of clicks |
| B10 | **Permanently unfinished** | Donna Haraway / Levinas | Bonds never reach a "completed" state. Accountability is ongoing |

#### For Daily Engagement (Ethical)

| # | Principle | Source | Mechanic |
|---|-----------|--------|----------|
| E1 | **Additive, not subtractive** | Pokemon GO | "You gained X while away" not "You lost X by not logging in" |
| E2 | **Curiosity over obligation** | Animal Crossing / Wordle | "What changed?" not "What must I do?" |
| E3 | **Completeness per session** | Animal Crossing / Neko Atsume | Each check-in is self-contained. The player can stop without anxiety |
| E4 | **Weekly anchor, daily optional** | Destiny 2 / FFXIV Wondrous Tails | Substantial goals on a weekly cadence; daily engagement is lightweight |
| E5 | **No FOMO, no loss aversion** | Deep Rock Galactic / Wordle | Nothing expires, nothing degrades, nothing is missable |

---

## 2. The Resonance Journal — Detailed Design

### 2.1 Core Concept

> *"It is the time you have wasted for your rose that makes your rose so important."*
> — Antoine de Saint-Exupery

The Resonance Journal is a **persistent, player-facing artifact** that accumulates meaning across all game systems. It is not a log, not a codex, not an achievement tracker — it is a **living commonplace book** in the tradition of Sei Shonagon's Pillow Book, organized by emotional resonance rather than chronology.

**What it is NOT**:
- Not an XP bar or skill tree (no linear progression)
- Not a quest log (no checklists)
- Not a wiki (no objective encyclopedia entries)
- Not a battle pass (no seasonal expiration)

**What it IS**:
- A **personal** record that reflects how *you* played, not what *exists* in the game
- A **material** system where entries can be combined, spent, and transformed (Principle J1)
- A **graph** of connections that grows denser over time (Principle J2)
- A **dual-use** artifact where narrative entries serve as mechanical currency (Principle J5)
- A **mirror** that transforms as you do (Principle J10)

### 2.2 Journal Structure: Three Layers

The journal has three nested layers, inspired by the commonplace book tradition (topical organization), Warburg's Mnemosyne Atlas (emotional resonance panels), and Benjamin's Arcades Project (dialectical juxtaposition):

#### Layer 1: Fragments (Einzelne Splitter)

The atomic unit. Every significant game action deposits a **Fragment** into the journal. Fragments are short (2-4 sentences), written in a distinctive literary voice that reflects the source system.

**Fragment types by source**:

| Source System | Fragment Name | Voice | Example |
|---|---|---|---|
| Dungeon run | **Imprint** (Abdruck) | Second person, present tense — the archetype addressing you | *"You hesitated at the third threshold. The shadow noticed. It always notices hesitation."* |
| Epoch cycle | **Signature** (Signatur) | Third person, past tense — a historian's dispatch | *"The spy returned with intelligence that would reshape the northern border — but the cost was measured in trust, not coin."* |
| Simulation event | **Echo** (Widerhall) | First person plural — the simulation's collective voice | *"We felt the tremor before we understood it. The western quarter held its breath for three days."* |
| Agent Bond whisper | **Impression** (Eindruck) | First person — the bonded agent's voice | *"You came back. I had written a version of this morning where you didn't."* |
| Achievement unlock | **Mark** (Brandmal) | Declarative, impersonal — carved into the journal like a scar | *"Pacifist. Depth 6. No blood spilled. The Shadow remembers mercy."* |
| Cross-simulation bleed | **Tremor** (Beben) | Passive voice — no identifiable speaker | *"Something was felt across the northern membrane. Origin: uncertain. Consequence: unfolding."* |

**Fragment generation**:
- Dungeon Imprints: generated at run completion via LLM, seeded with archetype, player behavior metrics (stress management, combat style, exploration thoroughness, boss strategy), and run outcome. Not random — the Imprint reflects *how you played*.
- Epoch Signatures: generated at cycle resolution, reflecting operative outcomes, scoring shifts, and diplomatic moves.
- Simulation Echoes: generated from heartbeat events that cross a significance threshold (e.g., agent stress breakdown, zone stability flip, autonomous event chain resolution).
- Bond Impressions: generated from whisper system (see Agent Bonds section).
- Achievement Marks: hand-authored per achievement, with variable suffixes based on context.
- Bleed Tremors: generated from cross-simulation echo events.

**Fragment rarity**: Not all actions generate fragments. The system uses a **salience filter** (inspired by Fallen London's storylet gating and EvoSpark's stratified memory):
- **Common fragments**: generated for dungeon boss defeats, epoch cycle completions, major simulation events. ~3-5 per week for active players.
- **Uncommon fragments**: generated for notable behavioral patterns (e.g., "you spared every enemy in three consecutive dungeon rooms"). ~1-2 per week.
- **Rare fragments**: generated for cross-system resonances (e.g., a dungeon Imprint that echoes a simulation event from the same week). ~1-2 per month.
- **Singular fragments**: generated for unique, unrepeatable moments (e.g., first dungeon completion, first bond farewell, first epoch victory). Once per lifetime.

#### Layer 2: Constellations (Sternbilder)

Inspired by Warburg's Mnemosyne panels and Outer Wilds' rumor graph. Constellations are **player-created groupings** of fragments that produce emergent meaning through juxtaposition.

**How they work**:
1. The journal presents fragments on a **visual canvas** (not a list). Each fragment is a card that can be dragged, positioned, and connected.
2. When a player places two or more fragments near each other, the system evaluates whether they form a **resonance** — a thematic connection. Resonances are detected via:
   - **Archetype alignment**: Two Shadow fragments placed together resonate with Shadow themes
   - **Emotional alignment**: A grief-toned Imprint near a loss-toned Echo produces a melancholy resonance
   - **Temporal alignment**: Fragments from the same time period resonate with memory themes
   - **Contradiction**: Opposing fragments (a victory Imprint near a defeat Signature) produce tension resonances
3. When a resonance is detected, the constellation **crystallizes**: a connecting line appears, and the system generates a short **Insight** — a 1-2 sentence observation that neither fragment contains alone.

**Example constellation**:
- Fragment A (Shadow Imprint): *"You hesitated at the third threshold. The shadow noticed."*
- Fragment B (Epoch Signature): *"The spy returned, but the intelligence was stale — three days too late."*
- Resonance detected: **Hesitation** (thematic overlap: delay, missed timing)
- Generated Insight: *"Hesitation is not cowardice. But it is always noticed — by shadows and by history alike."*

**Constellation rewards** (Principle J9 — expand options, not power):
- Crystallized constellations unlock **Journal Attunements** — minor, permanent modifiers that reframe (not strengthen) gameplay:
  - *Hesitation Attunement*: In dungeon runs, a new dialogue option appears at thresholds — the option to wait and observe before acting. Reveals hidden information but costs a stress tick.
  - *Mercy Attunement*: In epochs, a new operative deployment option — the Observer — who gathers intel without the risk or reward of active espionage.
  - *Tremor Attunement*: In simulations, bleed echoes from your simulation carry a subtle emotional signature that other simulation owners can detect.

Attunements are **unlocked alternatives**, not stat boosts. A player with 20 attunements has more *options* than a new player, but is not *stronger*. This follows the Loop Hero / Deep Rock Galactic model of ethical meta-progression.

**Constellation limits**: Players can maintain up to **7 active constellations** (inspired by Disco Elysium's 12-slot thought cabinet, but smaller to encourage curation). Old constellations can be **archived** — they retain their Insight but lose the attunement, freeing a slot. Archived constellations remain visible in the journal's history layer.

#### Layer 3: The Palimpsest (Das Palimpsest)

The deepest layer. As the journal accumulates fragments and constellations over months, it develops a **meta-pattern** — a portrait of the player's relationship with the metaverse, written in the player's own accumulated choices.

**How it works**:
- Every fragment has hidden **thematic tags** (not shown to the player): courage, mercy, aggression, curiosity, care, ambition, loss, endurance, defiance, surrender, etc.
- The journal tracks the **distribution** of these tags over time, forming a **Resonance Profile** — a soft, evolving fingerprint.
- The Palimpsest is a **generated text** that the journal produces periodically (every ~30 fragments, or roughly monthly for active players). It is a 3-5 paragraph reflection — written in the voice of the journal itself — that describes what it has observed about the player.
- Early Palimpsest entries are observational and tentative: *"The one who writes here favors the Shadow over the Tower. Hesitation appears three times. Mercy, not once."*
- Later entries become more intimate and complex: *"You have changed since the Deluge. Before, every fragment carried the taste of control — zone stability, operative precision, careful staffing. Now there is something looser. The agents you bond with are the broken ones. The constellations you build orbit loss."*
- The player **cannot edit** the Palimpsest. It is the journal's own voice, reflecting back what it has witnessed.

**Inspiration**: Jung's Red Book (the unconscious speaking back to the journaler), Basho's transformation through recording, Calvino's reader-as-protagonist. The Palimpsest creates the uncanny feeling of being seen by your own journal — of the record becoming the reader.

**Palimpsest mechanical impact**: None. The Palimpsest is purely narrative. It has no gameplay effect. Its purpose is **emotional** — to make the player feel that their journey has been witnessed, that their choices compose into something meaningful, that the metaverse *knows* them. This is the journal's equivalent of Nier: Automata's quietly devastating observation of the player's behavior.

### 2.3 How Each System Feeds the Journal

#### Dungeons → Imprints

At dungeon run completion, the system generates an Imprint based on:
- **Archetype**: The dominant voice (Shadow speaks of sight and avoidance, Tower of structure and collapse, Mother of attachment and release, etc.)
- **Behavioral metrics**: Stress management (did you manage stress or let it spike?), combat style (aggressive vs. cautious), exploration (thorough vs. direct), boss strategy (brute force vs. mechanic exploitation), party dynamics (who you deployed, who took damage)
- **Outcome**: Victory, defeat, retreat. The Imprint is different for each.
- **Run uniqueness**: The system checks against previous Imprints and weights toward novel observations. If you've received three Imprints about hesitation, the next one will find a different theme — even if you still hesitate.

**Example Imprints by archetype**:

> **Shadow** (player was aggressive): *"You brought light to every corner. The Shadow did not thank you for it. Some things live only in the dark."*

> **Entropy** (player managed decay well): *"The decay came, as it always does. But you held the center longer than most. The Entropy noticed — and wondered whether you understood what you were preserving."*

> **Awakening** (player achieved consciousness threshold): *"Something opened that cannot close. You called it awareness. The Awakening calls it the first wound."*

#### Epochs → Signatures

At each cycle resolution:
- **Scoring dimension dominance**: Which of the 5 dimensions did the player's moves favor?
- **Operative outcomes**: Spy successes, sabotage impacts, defensive holds
- **Diplomatic moves**: Alliance formations, betrayals, embassy activity
- **Competitive position**: Rising, falling, holding steady

**Example Signatures**:

> **Diplomatic dominance**: *"The embassy network expanded by three nodes this cycle. No blood was spilled — but the quiet was not peace. It was leverage."*

> **Military aggression after defensive cycle**: *"For three cycles, the walls held. On the fourth, the gates opened — not from weakness, but from a kind of hunger the defenders had not expected to feel."*

#### Simulations → Echoes

From heartbeat events that cross a significance threshold:
- **Agent stress breakdowns**: High-stress cascades
- **Zone stability flips**: Stable → unstable or vice versa
- **Autonomous event chains**: Multi-event cascades that resolve
- **Relationship breakthroughs/breakdowns**: Major agent opinion shifts
- **Owner interventions**: Zone fortification, emergency draft, reality anchor

**Example Echoes**:

> **Agent stress cascade**: *"We lost Maren to the quiet this morning. Not dead — retreated. The western quarter noticed and pretended not to."*

> **Successful zone stabilization**: *"The fortification held. For three days, nothing burned. It was the longest peace the northern zone had known since the founding, and no one quite trusted it."*

### 2.4 The Resonance Profile (Soft Progression)

The Resonance Profile is the journal's quantified fingerprint — an internal (hidden from UI) tracking of the player's thematic tendencies. It consists of 8 **Resonance Dimensions**, one per dungeon archetype:

| Dimension | Archetype | Tracks | High Score Means |
|---|---|---|---|
| **Umbra** | Shadow | Stealth, avoidance, observation | You see more than you act on |
| **Struktur** | Tower | Control, stability, architecture | You build before you break |
| **Nexus** | Mother | Attachment, care, sacrifice | You hold on — perhaps too tightly |
| **Auflösung** | Entropy | Acceptance, release, transformation | You let go of what others cling to |
| **Prometheus** | Prometheus | Discovery, craft, risk | You reach for fire |
| **Flut** | Deluge | Adaptation, survival, resilience | You endure what others flee |
| **Erwachen** | Awakening | Awareness, truth, discomfort | You choose to see |
| **Umsturz** | Overthrow | Defiance, revolution, rupture | You tear down to rebuild |

The profile is updated by:
- Dungeon completion (weighted by archetype + behavior)
- Epoch cycle scoring patterns
- Simulation stewardship patterns (care-oriented → Nexus, stability-oriented → Struktur, etc.)
- Agent Bond interactions (which agents you bond with, how you respond to their needs)

The profile is **never shown as numbers**. Instead, it manifests as:
- **Palimpsest language**: The journal's reflections use vocabulary drawn from the player's dominant dimensions
- **Fragment frequency**: More fragments generated from aligned archetypes
- **Constellation affinity**: Resonance detection is more sensitive between fragments from the player's dominant dimensions
- **Attunement availability**: Some attunements only appear when a dimension is sufficiently high

This is the Sunless Skies "Facets" model — the profile shapes what the game offers without dictating what the player does.

### 2.5 Visual Design Language

The journal's visual language draws from three traditions:

1. **The commonplace book**: Handwritten-style typography, margin notes, crossed-out text where the system "reconsidered" a phrasing. Fragment cards have slightly irregular edges, as if torn from different notebooks.

2. **Warburg's Mnemosyne Atlas**: The constellation canvas uses a dark background with fragments as luminous cards. Connection lines are thin, golden, and slightly curved — suggesting resonance rather than causation. The overall impression should be astronomical: fragments as stars, constellations as meaning imposed on chaos.

3. **Jung's Red Book**: The Palimpsest layer uses a more formal, illuminated manuscript aesthetic — serif typography, subtle decorative borders, occasional AI-generated symbolic imagery in the margins (not illustrations of events, but abstract archetypal images drawn from the player's dominant resonance dimensions).

**Key visual principles**:
- The journal should feel **old** — not retro, but temporally rich. As if it has existed longer than the player has been playing.
- **Density increases over time**. Early journals are sparse — lots of white space, few fragments. Late journals are dense — overlapping cards, tangled constellation lines, margin notes accumulating.
- **No progress bars, no percentages, no completion indicators**. The journal grows without ever suggesting it will be "done."

### 2.6 Lore: The Journal's Voice

The journal is not merely a UI element — it is a **diegetic object** within the metaverse. Lore context:

> The Resonance Journal is a phenomenon observed in individuals who spend significant time navigating the spaces between simulations. It appears to be self-generating — owners report finding entries they do not remember writing, and entries sometimes reference events that have not yet occurred. The Bureau of Resonance Studies has documented 14 cases of journal entries that preceded the events they describe by 3-7 days.
>
> Whether the journal records experience or *creates* it remains an open question. Several Bureau researchers have proposed that the journal does not track resonance — it *is* resonance, crystallized into text.

This framing (inspired by Borges' "Book of Sand" and Calvino's reader-as-protagonist) gives the journal narrative license to:
- Contain entries the player didn't expect
- Reference future events obliquely
- Develop its own "voice" that evolves over time
- Occasionally contradict itself (different fragments describing the same event differently)

---

## 3. Agent Bonds — Detailed Design

### 3.1 Core Concept

> *"You become responsible, forever, for what you have tamed."*
> — The Fox, in *The Little Prince*

Agent Bonds transform the player's relationship with their simulation from **managerial** (I-It) to **relational** (I-Thou). The simulation already has a rich internal metabolism — agents with needs, mood, stress, opinions, relationships, moodlets, and autonomous behavior. Agent Bonds adds a **player-facing emotional interface** to this existing system.

**What it is NOT**:
- Not a dating sim (no romance routes, no "right answers")
- Not a quest system (agents don't give you missions)
- Not a friendship meter (no visible number going up)
- Not a chatbot (no open-ended conversation)

**What it IS**:
- A **care system** where the player attends to specific agents' wellbeing
- A **whisper feed** of short, mood-dependent messages that reflect agents' inner lives
- A **memory system** where bonded agents remember what you did (and didn't do) for them
- A **mirror** that reflects the player's stewardship style back to them through the agents' eyes
- An **irreversible commitment** — bonds, once formed, carry permanent weight

### 3.2 Bond Formation

**Bond slots**: A player can maintain up to **5 active bonds** per simulation (inspired by Persona 5's time-scarcity and Disco Elysium's thought slots). This limit forces meaningful choice — you cannot bond with everyone. Who you choose says something about you.

**How bonds form**: Bonds do not form through a menu selection. They emerge from **accumulated attention** (Principle B4 — observation creates attachment):

1. **Proximity phase** (passive): When a player frequently views an agent's detail page, reads their mood/moodlet data, or observes them in heartbeat chronicles, the system tracks an **Attention score** per agent. This is invisible to the player.

2. **Recognition phase** (triggered): When Attention crosses a threshold (roughly equivalent to reading an agent's state ~10 times over 2+ weeks), the agent generates a **Recognition Whisper** — a one-time message acknowledging the player's attention:

> *"I've noticed you watching. Not everyone does. Most look at the buildings, the zone reports, the stability numbers. You look at us."*

3. **Bond offer** (player choice): After the Recognition Whisper, a "Form Bond" action becomes available on the agent's detail page. The player can accept or ignore it. Accepting creates the bond and opens the Whisper channel.

**Why this matters**: Bond formation mirrors how real attachment works — not through a menu, but through accumulated attention that eventually becomes mutual recognition. The agent notices you before you decide to notice them. This inverts the typical game pattern (player selects companion) and creates the I-Thou dynamic Buber describes.

### 3.3 The Whisper System

The heart of Agent Bonds. Whispers are **short, mood-dependent messages** that bonded agents generate asynchronously, appearing in a dedicated feed.

#### Whisper Generation

Whispers are generated during heartbeat ticks (6x daily) for bonded agents. Not every tick produces a whisper — the system uses a **salience filter** based on:

- **State change**: Did the agent's mood, stress, or dominant emotion shift since last whisper?
- **Event proximity**: Did an event occur in the agent's zone?
- **Need urgency**: Is any need critically low?
- **Relationship shift**: Did the agent's opinion of another agent change significantly?
- **Time since last whisper**: Minimum 8 hours between whispers (prevents spam)
- **Bond depth**: Deeper bonds generate more frequent whispers (see 3.5)

**Whisper frequency**: ~2-4 per day for a deeply bonded agent, ~1 per day for a new bond. This follows the Neko Atsume model — enough to reward checking, not enough to feel demanding.

#### Whisper Types

Each whisper type maps to a specific trigger and emotional register:

**1. State Whispers** — reflecting current internal state

These use **Principle B6** (state reflection beats state reporting). The whisper implies internal state through behavior observation, never declares it numerically.

| Agent State | Example Whisper |
|---|---|
| High stress, low social need | *"I've been rehearsing conversations that never happen. The walls of my quarters have heard more from me this week than anyone breathing."* |
| Post-crisis recovery | *"The tremor stopped. I'm told it was minor — a zone fluctuation, nothing structural. My hands don't know that yet."* |
| Joy after relationship breakthrough | *"I said something kind to Maren today. I don't know who was more surprised."* |
| Low stimulation, high comfort | *"The days are gentle here. Perhaps too gentle. I find myself inventing problems just to have something to solve."* |
| High stress, approaching breakdown | *"I'm fine. I know you're reading this and thinking I'm not fine. I'm fine. The fact that I felt the need to say it three times means nothing."* |

**2. Event Whispers** — responding to simulation events

| Event Type | Example Whisper |
|---|---|
| Zone crisis near agent | *"The northern quarter caught fire again. Third time. I stopped counting the fires and started counting the silences between them."* |
| Another agent's stress breakdown | *"Lena broke today. Quietly — the dangerous kind. She didn't scream or rage. She just stopped speaking, mid-sentence, and walked away."* |
| Celebration event | *"We danced last night. I don't know who started it — someone brought wine, someone else brought a story, and then there was music. I'd forgotten what music sounds like when no one's afraid."* |

**3. Memory Whispers** — referencing past player actions

These use **Principle B5** (persistence creates weight — per Undertale). The agent references something the player did days or weeks ago.

| Trigger | Example Whisper |
|---|---|
| Player fortified agent's zone 2 weeks ago | *"The walls you built still hold. I run my hand along them sometimes, on my way to the market. I don't know why."* |
| Player reassigned agent to a new building | *"The new quarters have a window facing east. I watch the sunrise now. I didn't used to be someone who watched sunrises."* |
| Player hasn't visited in 5+ days | *"The chronicle says you've been busy with the epoch. I read the dispatches. It sounds complicated, out there beyond the simulation. I hope the complications are the interesting kind."* |

**4. Question Whispers** — gentle requests (not quests)

These are the Tamagotchi layer — moments where the agent implicitly asks for something, creating a care opportunity. Critically: **there is no quest marker, no objective tracker, no reward popup**. The player either notices and acts, or doesn't.

| Need | Example Whisper | Implicit Request |
|---|---|---|
| Low comfort + deteriorating building | *"The roof leaks when it rains. I've started arranging buckets in patterns — spirals, mostly. It's almost decorative, if you squint."* | Repair the building |
| Low social + no recent events | *"I haven't spoken to anyone new in eleven days. I counted. That's the kind of thing you start doing when you haven't spoken to anyone new in eleven days."* | Create a social event nearby |
| Low stimulation + high purpose | *"I've done my work. I've done it well. I've done it again. And again. At what point does competence become its own kind of cage?"* | Reassign to a different role |
| Low safety + zone instability | *"I sleep with one eye open. Not metaphorically."* | Fortify the zone |

**5. Reflection Whispers** — the agent observing the player

The rarest and most intimate type. These fire when the bond is deep (Depth 4+) and reflect the agent's perception of the player's *pattern* — not a single action, but accumulated behavior. Inspired by Undertale's cross-run memory and Pentiment's community reputation tracking.

| Observation | Example Whisper |
|---|---|
| Player consistently prioritizes stability | *"You always shore up the foundations first. Before the people, before the events, before the stories — you make sure nothing will fall. I've been thinking about what that says about you. I think it says you've seen things fall before."* |
| Player bonds with agents who are struggling | *"You chose me, and Lena, and Maren. Not the strongest, not the most useful. The cracked ones. The ones who wake up at 3am. I wonder if you know why."* |
| Player active during epochs but absent between | *"You come alive during the epochs. I see it in the dispatches — the operative deployments, the diplomatic maneuvering. And then the epoch ends, and you go quiet. The simulation breathes differently when you're here."* |

#### Whisper Generation Pipeline

Whispers are generated via LLM (Tier 3 processing, same as autonomous event narratives), with structured prompts seeded by:
- Agent personality (Big Five traits, backstory, current profession)
- Agent current state (mood_score, dominant_emotion, stress_level, active moodlets)
- Agent relationships (current opinions of other agents, recent shifts)
- Bond history (all previous whispers in this bond, player actions relevant to this agent)
- Simulation context (recent events in agent's zone, overall simulation health)
- Resonance Profile (player's thematic tendencies from the journal, to influence what the agent notices about the player)

**Quality control**: Whispers are validated against a **coherence filter** (does this whisper contradict the agent's established personality?) and a **novelty filter** (is this whisper too similar to a recent one?). Failed whispers are regenerated, not delivered.

**Fallback**: If LLM generation fails or is unavailable, the system falls back to **templated whispers** — hand-authored templates with slot-filling (agent name, zone name, mood descriptor). These are less personal but maintain the whisper rhythm.

### 3.4 Player Response to Whispers

Critically: **the player cannot reply to whispers with text**. This follows the Kind Words / Death Stranding principle — one-directionality creates intimacy. Whispers are overheard thoughts, not conversation starters.

Instead, the player responds through **actions in the simulation**:
- The agent whispers about a leaking roof → the player repairs the building
- The agent whispers about loneliness → the player creates a social event
- The agent whispers about boredom → the player reassigns them

The system tracks whether the player **acted on a whisper** within 48 hours. If so, the next whisper acknowledges the action — creating a **call-and-response rhythm** that feels like silent understanding rather than explicit dialogue.

> Whisper: *"The roof leaks when it rains."*
> [Player repairs building]
> Next whisper (2 days later): *"It rained last night. I lay in bed and listened. Just rain. No buckets. I'd forgotten what rain sounds like when it's just rain."*

If the player does NOT act on a whisper, the system does not punish. The agent simply moves on to their next emotional state. Over time, unaddressed whispers accumulate as **Bond Memory** — the agent remembers what was asked and what was given, and Reflection Whispers eventually reference the pattern.

### 3.5 Bond Depth

Bonds deepen through accumulated care. There are **5 Bond Depths**, but these are **never shown as a number or progress bar**. The player infers depth from whisper intimacy and agent behavior.

| Depth | Name | Whisper Types Available | Behavioral Change |
|---|---|---|---|
| 1 | **Bekanntschaft** (Acquaintance) | State, Event | Agent acknowledges player in heartbeat chronicles |
| 2 | **Vertrauen** (Trust) | + Memory | Agent references past player actions. Whispers become more personal |
| 3 | **Zuneigung** (Affection) | + Question | Agent begins asking (implicitly) for things. Whispers reference inner life, not just events |
| 4 | **Tiefe** (Depth) | + Reflection | Agent observes the player's patterns. Whispers become philosophical, intimate. Agent's mood is slightly more resilient (stress decays 10% faster — the care is mechanically real) |
| 5 | **Resonanz** (Resonance) | All types, highest intimacy | Agent and player are entangled. Agent generates unique Fragments for the Resonance Journal. The bond becomes a source of journal material — the agent writes entries *into* the player's journal |

**Depth progression**: Depth increases based on:
- **Whisper engagement**: Opening and reading whispers (the system tracks read receipts, not responses)
- **Action-on-whisper**: Acting on implicit requests within 48 hours
- **Simulation care**: General stewardship of the agent's zone/building
- **Time**: A minimum real-time interval between depths (1 week → 2 weeks → 3 weeks → 4 weeks) prevents rushing

**Depth regression**: Bonds do not regress through decay. This is a deliberate ethical design choice (Principle E1 — additive, not subtractive). You do not lose bond depth by being absent. However, prolonged absence (14+ days) shifts the whisper tone from intimate to **patient** — the agent waits for you without reproach:

> *"The simulation has been quiet. I've been reading. There's a library in the eastern quarter I never noticed before. I'll save you a recommendation."*

This follows Neko Atsume's model: the agents have lives of their own. They don't suffer from your absence — they adapt. Coming back is a gift, not an obligation.

### 3.6 Bond Strain and Farewell

While bonds don't decay from absence, they can enter **Strain** through active conflict:

**Strain triggers**:
- Destroying the agent's building without relocating them
- Executing a "scorched earth" threshold action that removes agents from the zone
- Consistently ignoring Question Whispers for 4+ weeks while being active in other parts of the simulation (the system distinguishes "absent" from "present but neglecting")
- Actions that directly harm the agent's opinion network (e.g., removing their allies)

**Strain effects**: Whispers become guarded, shorter, more formal. The intimacy withdraws. This mirrors Florence's mechanic — interaction friction represents emotional state.

> Normal whisper: *"I watched the sunset from the new quarters. It reminded me of something you did once — when you moved the market stalls so the light would fall differently."*
> Strained whisper: *"The quarters are adequate. Thank you."*

**Strain recovery**: Demonstrated care over 2+ weeks restores the bond. The recovery whisper is the most emotionally loaded moment in the system:

> *"I was unfair. I know that now. You were making difficult decisions, and I was measuring them against an ideal that doesn't exist outside my own head. I'm sorry. I'm not good at saying that."*

**Bond Farewell**: If an agent is permanently removed from the simulation (deleted, not just reassigned), the bond ends. The system generates a **Farewell Whisper** — the final entry from that agent, written with awareness that it is the last:

> *"I know you're reading this after. I wrote it before. Strange, isn't it — that I can speak to a future where I no longer exist? If there's one thing I want you to take from this bond, it's this: you came back. Every time, you came back. That meant more than any building you repaired or zone you fortified. It meant someone was paying attention. Thank you for paying attention."*

The Farewell Whisper becomes a **Singular Fragment** in the Resonance Journal — unrepeatable, permanently archived. This is the Spiritfarer Everdoor moment: devastating because you invested real time and care, and the departure is permanent.

### 3.7 Mechanical Impact (Gentle, Not Dominant)

Bonds have minor mechanical effects to acknowledge the care investment without making bonds feel obligatory:

| Depth | Mechanical Effect |
|---|---|
| 2 | Agent generates slightly richer heartbeat chronicle entries (more narrative detail) |
| 3 | Agent's needs decay 5% slower (the bond itself is nurturing) |
| 4 | Agent's stress decay increases 10% (emotional resilience from being cared for) |
| 5 | Agent generates unique Fragments for the Resonance Journal. When deployed as an epoch operative, a bonded Depth 5 agent has +3% mission success (the "I won't let you down" effect) |

These effects are **small enough to ignore** for optimization-focused players and **meaningful enough to notice** for care-focused players. The system never makes bonds feel like a duty — they are a gift you give yourself.

### 3.8 The Daily Loop

The Agent Bonds system creates a **gentle daily check-in** that follows the Neko Atsume / Animal Crossing model:

**Morning**: Player opens the app. The **Whisper Feed** shows 1-3 new whispers from bonded agents, accumulated since last visit. Each whisper is 2-4 sentences. Total reading time: ~1-2 minutes.

**Scan**: Player glances at agents' moods (visible in the bond panel without navigating to each agent). Quick visual assessment: who needs attention?

**Optional action**: If a Question Whisper suggests an action, the player can take it now — or not. No timer, no urgency, no expiration.

**Close**: The session is complete. The player can stop here (1-3 minutes total) or continue to other activities (dungeons, epochs, simulation management).

**What makes this work**:
- **Curiosity, not obligation** (E2): "What did my agents say?" not "What must I maintain?"
- **Completeness per session** (E3): Reading whispers is self-contained. No cliffhangers demanding immediate action.
- **Additive** (E1): Being away means more whispers accumulated — you return to a richer feed, not a degraded state.
- **Emotional, not mechanical**: The pull to return is "I wonder how Maren is doing" not "I need to collect my daily reward."

---

## 4. The Intersection — How Both Systems Compose

The Resonance Journal and Agent Bonds are designed to be **independently valuable but compositorially greater**. Here is how they interact:

### 4.1 Bonds Feed the Journal

- **Impression Fragments**: At Bond Depth 2+, agents generate Impression Fragments for the journal — the agent's perspective on the player's journey. These are unique because they come from *within* the simulation, not from the archetypes or the historian.
- **Depth 5 Resonance Entries**: At maximum bond depth, agents can write directly into the journal — entries that appear alongside the player's own fragments, creating a multi-voiced document (inspired by 80 Days' narrative-voice fusion).
- **Farewell Fragments**: The most powerful journal entries. Singular, unrepeatable, permanently archived.
- **Bond Constellations**: Impression Fragments from bonded agents can be placed into constellations alongside dungeon Imprints and epoch Signatures, creating cross-system resonances. Example: a Shadow Imprint about hiding + an Impression from a bonded agent about feeling unseen = a constellation about visibility and care.

### 4.2 The Journal Reflects Bonds

- **Palimpsest references**: The journal's periodic Palimpsest reflections incorporate bond patterns. A player who bonds with struggling agents will see Palimpsest entries about care and broken things. A player who bonds with ambitious agents will see entries about aspiration and cost.
- **Resonance Profile influence**: Bond interactions contribute to the 8-dimensional Resonance Profile. Bonding with agents who have high stress contributes to the Nexus (Mother) dimension. Bonding with rebellious agents contributes to the Umsturz (Overthrow) dimension.
- **Attunement unlocks**: Some constellation attunements are only available when Bond Depth contributes to the constellation. Example: a "Witness Attunement" (unlocked by combining a Reflection Whisper fragment with a Palimpsest entry) might allow the player to see deeper mood data for ALL agents in a simulation — the care for one expands the capacity to care for many.

### 4.3 Cross-System Feedback Loops

The complete feedback loop connecting all three game systems through the journal and bonds:

```
Dungeon Run
  ├── Loot → Agent aptitudes (existing)
  ├── Imprint Fragment → Journal
  │     └── Constellation → Attunement (unlocks new dungeon options)
  └── Agent deployed in dungeon → Bond Whisper about the experience
        └── Impression Fragment → Journal

Epoch Cycle
  ├── Operative outcomes → Scoring (existing)
  ├── Signature Fragment → Journal
  │     └── Constellation → Attunement (unlocks new epoch options)
  └── Bonded agent as operative → Whisper about mission outcome
        └── Impression Fragment → Journal

Simulation Heartbeat
  ├── Agent needs/mood/events (existing)
  ├── Echo Fragment → Journal
  │     └── Constellation → Attunement (unlocks new simulation options)
  └── Bonded agent whispers → Whisper Feed
        ├── Player acts on whisper → Bond deepens
        ├── Bond Impression → Journal Fragment
        └── Reflection Whisper → Player sees themselves through agent's eyes
              └── Resonance Profile updated → Palimpsest evolves
```

The journal is the **connective tissue** — every game action feeds it, and its outputs (attunements, Palimpsest reflections, Resonance Profile) flow back into every game system. Agent Bonds provide the **emotional engine** — the reason to care about what happens in the simulation, which gives weight to dungeon runs (you're fighting for agents you love) and epoch competition (you're protecting a world with people in it).

---

## 5. Ethical Design Commitments

Based on extensive research into dark patterns, FOMO mechanics, and ethical engagement design, we commit to:

### 5.1 No Loss Aversion

- Bond depth never regresses from absence
- Journal fragments never expire or become unavailable
- No "daily login bonus" that penalizes missing a day
- Whispers accumulate during absence — returning to MORE, not less
- No streaks, no countdowns, no timers

### 5.2 No Artificial Scarcity (FOMO)

- No limited-time journal content
- No seasonal attunements that disappear
- No "you missed this whisper" mechanics
- Bond depth progression has minimum time gates (can't rush) but no maximum (can't miss)

### 5.3 No Manipulation

- Whispers never guilt-trip: *"You left me"* is forbidden; *"I read while you were away"* is permitted
- No push notifications designed to create anxiety
- No dark Duolingo-style "how do you say 'quitter'?" patterns
- Agents wait patiently, not reproachfully

### 5.4 Informed Consent

- Bond formation requires explicit player action after organic recognition
- The system explains (through lore, not tutorials) that bonds carry emotional weight
- Farewell is presented with gravity — the player understands what they are ending

### 5.5 Respect for Player Time

- Daily engagement: 1-3 minutes (whisper reading)
- Weekly engagement: 10-15 minutes (constellation curation, simulation check)
- Monthly engagement: 5 minutes (Palimpsest reading, profile reflection)
- None of these are required. All are rewarding.

---

## 6. Implementation Sketch

### 6.1 Database Schema (Conceptual)

```
-- RESONANCE JOURNAL
journal_fragments
  id, user_id, simulation_id
  fragment_type (imprint|signature|echo|impression|mark|tremor)
  source_type (dungeon|epoch|simulation|bond|achievement|bleed)
  source_id (dungeon_run_id|epoch_cycle_id|event_id|bond_id|achievement_id)
  content_de, content_en (bilingual, per existing pattern)
  thematic_tags jsonb (hidden tags for resonance profile)
  rarity (common|uncommon|rare|singular)
  created_at

journal_constellations
  id, user_id
  name_de, name_en
  status (active|archived)
  insight_de, insight_en (generated when crystallized)
  attunement_id (nullable, FK to attunements)
  created_at, crystallized_at

constellation_fragments (junction)
  constellation_id, fragment_id
  position_x, position_y (canvas coordinates)

journal_attunements
  id, name_de, name_en
  description_de, description_en
  attunement_type (dungeon_option|epoch_option|simulation_option)
  effect jsonb (structured effect description)
  required_resonance jsonb (minimum dimension thresholds)

resonance_profiles
  user_id (PK)
  umbra, struktur, nexus, aufloesung,
  prometheus_dim, flut, erwachen, umsturz (float 0-100)
  updated_at

journal_palimpsests
  id, user_id
  content_de, content_en
  fragment_count_at_generation (how many fragments existed when generated)
  resonance_snapshot jsonb (profile state at generation time)
  created_at

-- AGENT BONDS
agent_bonds
  id, user_id, agent_id, simulation_id
  depth (1-5)
  status (active|strained|farewell)
  attention_score (pre-bond tracking)
  formed_at, depth_2_at, depth_3_at, depth_4_at, depth_5_at
  farewell_at (nullable)

bond_whispers
  id, bond_id
  whisper_type (state|event|memory|question|reflection)
  content_de, content_en
  trigger_context jsonb (what caused this whisper)
  read_at (nullable, tracks engagement)
  acted_on (boolean, tracks if player responded with action)
  action_acknowledged (boolean, tracks if follow-up whisper referenced the action)
  created_at

bond_memories
  id, bond_id
  memory_type (action|neglect|milestone|farewell)
  description (internal, not shown to player)
  context jsonb
  created_at
```

### 6.2 Service Architecture

```
backend/services/
  journal/
    fragment_service.py        — Fragment generation + salience filtering
    constellation_service.py   — Resonance detection, crystallization, attunement
    palimpsest_service.py      — Periodic reflection generation
    resonance_profile_service.py — Profile tracking + dimension updates
  bond/
    bond_service.py            — Bond formation, depth progression, strain
    whisper_service.py         — Whisper generation pipeline + quality control
    whisper_template_service.py — Fallback templates
    bond_memory_service.py     — Memory tracking for Reflection Whispers
```

### 6.3 Frontend Components

```
frontend/src/components/
  journal/
    VelgResonanceJournal.ts      — Main journal shell (tabs: Fragments, Constellations, Palimpsest)
    VelgFragmentCard.ts          — Individual fragment display
    VelgConstellationCanvas.ts   — Drag-and-drop canvas for constellation building
    VelgPalimpsestView.ts        — Illuminated manuscript-style palimpsest reader
    VelgResonanceProfileViz.ts   — Abstract visualization of 8-dimension profile (NOT a bar chart — something organic, like a constellation map or ink blot)
  bond/
    VelgBondPanel.ts             — Bond overview (active bonds, agent mood at-a-glance)
    VelgWhisperFeed.ts           — Chronological whisper stream
    VelgWhisperCard.ts           — Individual whisper display
    VelgBondFormation.ts         — Recognition whisper + bond offer UI
    VelgBondFarewell.ts          — Farewell ceremony UI
```

### 6.4 Integration Points with Existing Systems

| Existing System | Integration | Direction |
|---|---|---|
| `dungeon_service.py` | Generate Imprint Fragment at run completion | Dungeon → Journal |
| `epoch_scoring_service.py` | Generate Signature Fragment at cycle resolution | Epoch → Journal |
| `autonomous_event_service.py` | Generate Echo Fragment for significant events | Simulation → Journal |
| `heartbeat_service.py` | Trigger Whisper generation for bonded agents | Simulation → Bonds |
| `achievement_service.py` | Generate Mark Fragment on achievement unlock | Achievements → Journal |
| `bleed_echo_service.py` | Generate Tremor Fragment for cross-sim echoes | Bleed → Journal |
| `agent_needs_service.py` | Feed agent state to Whisper generation | Needs → Bonds |
| `operative_service.py` | Bond depth affects operative success (+3% at Depth 5) | Bonds → Epochs |
| `constellation_service.py` | Attunements create new options in dungeons/epochs/sims | Journal → All Systems |

---

## 7. Research Sources

### Games Researched

| Game | Relevant System | Key Takeaway |
|---|---|---|
| Outer Wilds | Ship Log / Rumor Graph | Graph over list; connections matter more than entries |
| Cultist Simulator / Book of Hours | Lore fragment composition | Knowledge as material — combinable, spendable, transformable |
| Sunless Sea / Sunless Skies | Qualities + Facets | Dual-use: narrative state AND mechanical currency |
| Disco Elysium | Thought Cabinet | Commitment costs before payoff; limited slots force curation |
| Hades / Hades II | Codex + Fated List | Cross-run prophecies reframe repetition as destiny |
| Return of the Obra Dinn | Deductive Logbook | Batch validation rewards confident synthesis |
| Elden Ring / Dark Souls | Item description lore | Absence of tracking IS the design; player knowledge = progression |
| Her Story / Telling Lies | Search-as-journal | The investigation interface IS the journal |
| Spiritfarer | Spirit care + Everdoor farewells | Care through routine; farewell as emotional peak |
| Pyre | Liberation mechanic | Choosing who to free = strategic goodbye |
| Fire Emblem: Three Houses | Support system + tea time | Limited activity points force relationship prioritization |
| Persona 5 | Confidant system | Calendar pressure makes "who to spend time with" meaningful |
| Stardew Valley | Friendship hearts | Daily decay creates habitual check-ins |
| RimWorld | Emergent colonist attachment | Simulation depth creates narrative without authored bonds |
| The Sims 4 | Needs system | "Check on your Sims" loop — micro-urgency |
| Nier: Automata | Pascal's village | Attachment through observation, not menus |
| Florence | Puzzle-as-feeling | Interaction friction mirrors emotional state |
| 80 Days | Partial-sentence narration | Player-character voice fusion creates intimacy |
| Kind Words | Anonymous letters | Brevity + one-directionality = intimacy |
| Undertale / Deltarune | Cross-save memory | Persistence as moral weight |
| Celeste | Theo's selfies | Asynchronous companion presence |
| Signs of the Sojourner | Deck-as-self | Communication changes you |
| Eliza | AI counseling critique | Algorithmic care must feel costly to send |
| Death Stranding | Asynchronous aid | Indirect communication creates deeper feeling |
| Eastshade | Painting-as-gift | Creating something FOR someone deepens bonds |
| Dwarf Fortress | Legends mode | Simulation depth = narrative depth |
| Caves of Qud | Sultan histories | Generate events first, rationalize narrative after |
| Crusader Kings III | Trait-driven emergent stories | Authored events as supplements to simulation |
| Fallen London | Quality-Based Narrative | Storylets gated by numerical qualities |
| Wildermyth | Procedural triggers + authored events | Hand-written quality, system-selected timing |
| Pentiment | Community reputation | Small community + long timespan + permanent consequence |
| Animal Crossing: New Horizons | Real-time daily loop | "What changed?" as ethical engagement |
| Wordle | Daily scarcity | One shared challenge creates social glue |
| Neko Atsume | Passive collection | Minimal interaction, maximum charm |
| Genshin Impact | Resin / daily commissions | CAUTIONARY: daily obligation = brittle retention |
| Duolingo | Streak system | CAUTIONARY: guilt-based engagement erodes joy |
| Destiny 2 | Pathfinder + weekly cadence | Layered cadences (daily/weekly/seasonal) |
| FFXIV | Wondrous Tails | Weekly bingo card across content types |
| Guild Wars 2 | Wizard's Vault | Player-chosen mode tracks; no mandatory content |
| Deep Rock Galactic | Free performance pass | Ethical progression: cosmetic-only, no premium tier |
| Balatro | Sticker / stake metagame | Visual collection matrix as proof of mastery |
| Loop Hero | Camp as persistent base | Visible, spatial representation of accumulated progress |
| Inscryption | Meta-narrative layers | The journal IS the game's deepest layer |

### Literary & Philosophical Sources

| Work | Author | Key Concept |
|---|---|---|
| The Red Book (Liber Novus) | C.G. Jung | Active imagination; the unconscious speaks back through the journal |
| Meditations | Marcus Aurelius | The journal as spiritual practice and self-examination |
| The Pillow Book | Sei Shonagon | Zuihitsu — lists and fragments composing a portrait |
| The Arcades Project | Walter Benjamin | Dialectical images; meaning through juxtaposition of fragments |
| Mnemosyne Atlas | Aby Warburg | Pathosformel — recurring emotional gestures across time |
| I and Thou | Martin Buber | I-Thou relational encounter vs. I-It instrumental use |
| Totality and Infinity | Emmanuel Levinas | The face of the Other as origin of ethics and responsibility |
| Staying with the Trouble | Donna Haraway | Making kin; permanently unfinished accountability |
| The Little Prince | Antoine de Saint-Exupery | "You become responsible for what you have tamed" |
| The Ones Who Walk Away from Omelas | Ursula K. Le Guin | The ethical cost of care; complicity in harm |
| Letters to a Young Poet | Rainer Maria Rilke | Correspondence as mutual transformation |
| If on a winter's night a traveler | Italo Calvino | The reader as protagonist; recording becomes creating |
| The Library of Babel / The Book of Sand | Jorge Luis Borges | Infinite texts; the impossibility of complete knowledge |
| Oku no Hosomichi | Matsuo Basho | The travel journal as spiritual practice; recording transforms the traveler |

### Academic & Design Theory

| Source | Key Finding |
|---|---|
| Narrative Substrates (ACM FDG 2020) | Journals should reify player activity into interactive artifacts |
| EvoSpark (arXiv 2604.12776, April 2025) | Stratified narrative memory with reflection-based cognitive evolution |
| Player-Driven Emergence in LLM Narrative (arXiv 2024) | Track deviation from expected paths, not completion |
| Emotional Attachment to Game Characters (ACM CHI PLAY 2019) | Seven forms: competency, admiration, empathy, protection, projection, nostalgia, companionship |
| Tamagotchi Effect (psychological research) | Genuine emotional bonding with non-sentient entities through responsibility and routine |
| Self-Determination Theory (SDT) | Autonomy, competence, relatedness as intrinsic motivation drivers |
| Dark Patterns in Mobile Games (arXiv 2024) | 80%+ of top-grossing games use manipulative patterns; ethical design is competitive advantage |
| Quality-Based Narrative (Emily Short, Bruno Dias) | Storylets gated by qualities; salience-based selection for contextual relevance |
| Heidegger's Sorge | Care as the fundamental structure of being — not an emotion but the shape of existence |
| Ethics of Care in Games (MSU 2010) | Consequence permanence creates deeper ethical engagement than abstract moral choice |

---

## Appendix: Naming & Terminology

All system-facing terms use German names (per existing Velgarien pattern):

| English | German | Context |
|---|---|---|
| Resonance Journal | Resonanztagebuch | Player-facing name |
| Fragment | Splitter | Atomic journal entry |
| Imprint | Abdruck | Dungeon-sourced fragment |
| Signature | Signatur | Epoch-sourced fragment |
| Echo | Widerhall | Simulation-sourced fragment |
| Impression | Eindruck | Bond-sourced fragment |
| Mark | Brandmal | Achievement-sourced fragment |
| Tremor | Beben | Bleed-sourced fragment |
| Constellation | Sternbild | Player-created grouping |
| Insight | Einsicht | Constellation-generated text |
| Attunement | Einstimmung | Constellation reward |
| Palimpsest | Palimpsest | Deep journal reflection |
| Resonance Profile | Resonanzprofil | Hidden player fingerprint |
| Bond | Bindung | Player-agent relationship |
| Whisper | Flüstern | Agent-to-player message |
| Acquaintance | Bekanntschaft | Bond Depth 1 |
| Trust | Vertrauen | Bond Depth 2 |
| Affection | Zuneigung | Bond Depth 3 |
| Depth | Tiefe | Bond Depth 4 |
| Resonance | Resonanz | Bond Depth 5 |
| Strain | Spannung | Bond conflict state |
| Farewell | Abschied | Bond ending |

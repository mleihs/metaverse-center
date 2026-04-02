---
title: "Resonance Dungeons -- The Threshold Room Type"
version: "1.0"
date: "2026-04-02"
type: concept
status: draft
lang: en
tags: [dungeon, room-type, threshold, liminality, game-design, narrative]
research-basis: "Jungian threshold guardians, Turner's liminality theory, Trophy Dark ring structure, Hades Chaos Gates, Inscryption sacrifice altars, medieval barbican architecture, Ellsberg paradox (ambiguity aversion), Kahneman loss aversion"
---

# The Threshold -- Room Type Concept

> Perspectives: Senior Game Designer, Literary Architect, UX Psychologist, Narrative Systems Engineer
>
> Research: Liminal space theory (Victor Turner), threshold guardians in mythology (Janus, Cerberus, Sphinx), sacrifice mechanics in Trophy Dark / Hades / Inscryption, defensive castle architecture (barbicans, portcullises, murder holes), irrevocable choice psychology (Ellsberg paradox, Kahneman loss aversion).

---

## Executive Summary

The Threshold is a **liminal room type** placed immediately before the boss encounter. It is not a room -- it is a *state of passage*. The player must pay a toll to proceed. All options are bad. There is no combat, no puzzle, no randomness -- only a deliberate, irrevocable choice that tests the player's judgment when it is most fatigued.

### Why This Matters

The dungeon currently escalates through *quantity* (more combat, harder enemies). The Threshold escalates through *quality of decision*. It is the moment the dungeon asks: *what are you willing to lose to see what comes next?*

In a text-based terminal, this room has no equivalent in graphical games. The screen empties. Lines shorten. Whitespace grows. The CRT hum becomes the dominant presence. The player *reads their own hesitation* in the blinking cursor.

---

## 1. Placement Rules

- **Guaranteed**: One Threshold per run, always the room immediately before the boss.
- **Never**: More than once per run. Never at depth < 3. Never as a random room type.
- **Generator**: Not weighted in `ARCHETYPE_ROOM_DISTRIBUTIONS`. Injected by the generator after all content layers, before the boss layer. The boss room's sole parent connection is the Threshold.
- **Map appearance**: Unique icon (a vertical line with a horizontal bar -- a stylised door lintel). Visible but unlabelled until scouted. Once revealed, the room type reads "THRESHOLD" in the map panel.

---

## 2. The Three Tolls

The player enters the Threshold and receives three encounter choices. Each is always available. Each is always bad. The design exploits the **Ellsberg paradox**: one toll has known cost and unknown reward; another has unknown cost and known reward; the third defers all cost.

### 2.1 Blood Toll (Tangible Sacrifice)

**What the player sees:**
> *The passage demands a price in flesh. One of your operatives must bear the wound.*

**Mechanic:**
- The player selects one party member.
- That agent takes **one condition step down** (e.g. Operational -> Bruised, Bruised -> Wounded).
- The agent cannot be healed until after the boss fight.
- The boss encounter receives no additional modifiers.

**Design rationale:** Honest, calculable pain. The player knows exactly what they lose. Appeals to players who prefer to calculate and optimise. The Guardian aptitude check determines whether the wound is distributed (Guardian >= 5: spread as stress across party instead of condition on one agent).

**Archetype flavour (examples):**
- Shadow: *"The darkness asks for your sight. One eye, closed forever -- or closed until dawn."*
- Tower: *"The foundation demands a stone. Which of your pillars can bear the loss?"*
- Deluge: *"The water asks for breath. One lungful, given freely."*

### 2.2 Memory Toll (Intangible Sacrifice)

**What the player sees:**
> *The passage demands a price in thought. Something you carry will be forgotten. You will not know what was taken.*

**Mechanic:**
- A **random positive modifier** is silently removed from the party state. This could be:
  - A loot item's passive effect (the item remains but its bonus disappears)
  - An accumulated archetype benefit (e.g. 20 points of insight erased for Prometheus)
  - A cleared-room bonus that was granting a persistent buff
- The player is told: *"Something has been taken."* -- nothing more.
- The terminal does NOT reveal what was lost. The player must notice the absence themselves (or never notice at all).

**Design rationale:** Exploits ambiguity aversion. Most players will avoid this because the unknown is more frightening than a known wound. But mechanically, this is often the cheapest toll -- the removed modifier might be one the player never used. The terror is psychological, not mathematical. Trophy Dark's genius applied: the loss is *narrated as sensation*, not as a stat change.

**Archetype flavour:**
- Shadow: *"A memory darkens. You have forgotten something. What it was -- you cannot say."*
- Entropy: *"Dissolution takes a thought. The shape of something you knew is... less, now."*
- Devouring Mother: *"She whispers: I will carry that for you. You do not need it. Let me hold it."*

### 2.3 Defiance (Refuse the Toll)

**What the player sees:**
> *You may pass without tribute. The passage does not compel you. But the passage remembers.*

**Mechanic:**
- No immediate cost.
- The boss encounter difficulty is **silently increased by +1** (applied as an enemy power multiplier in `DIFFICULTY_MULTIPLIERS`).
- Additionally, the boss gains **one extra ability** (chosen from the archetype's boss ability pool).
- The player is NOT told what changed. They will feel it when the boss is harder than expected.

**Design rationale:** Deferred punishment. Appeals to players who believe they can outplay any encounter. The Kahneman insight: people underestimate future losses. The barbican architecture insight: the player walks forward freely, and the portcullis drops behind them -- the trap was always the forward momentum.

**Archetype flavour:**
- Tower: *"The Tower does not beg. Pass, then. The upper floors have been informed."*
- Prometheus: *"The fire does not ask twice. But fire has a memory longer than yours."*
- Shadow: *"The darkness steps aside. It does not need to ask. It already took what it wanted."*

---

## 3. Terminal Rendering

The Threshold's text rendering is **radically different** from every other room type. The design principle: *the room is mostly silence*.

### 3.1 Entry Text

When the player enters (via `move`), the terminal does NOT immediately show choices. Instead:

```
> move 7

    ...

    The corridor ends.

    Not in a wall. Not in a door.
    In a stillness.

    The air is different here. Thicker.
    The echo of your footsteps returns
    a fraction of a second late.

    You have reached the Threshold.

    ...

    [THRESHOLD -- DEPTH 5]
    What lies beyond requires passage.
    Passage requires a price.

    Type "look" to see the toll.
```

**Key rendering rules:**
- **4-space indent** on all narrative lines (not the standard 0-indent of combat/system lines)
- **Extra blank lines** between paragraphs (2x the normal gap)
- **No ASCII art**, no banners, no `══════` dividers
- **Ellipsis lines** (`...`) as breathing pauses
- **Short lines** -- no line longer than 45 characters
- The `[THRESHOLD]` system line appears AFTER the prose, not before

### 3.2 Choice Presentation

When the player types `look` (or the choices auto-display after a brief pause):

```
    The Threshold offers three tolls.

    [1] Blood Toll
        A wound, freely given. One operative
        takes one condition step. Known cost.

    [2] Memory Toll
        Something forgotten. You will not know
        what was taken. Unknown cost.

    [3] Defiance
        Pass without tribute. The passage
        remembers. Deferred cost.

    Type "interact <number>" to choose.
    This choice cannot be undone.
```

**Key rendering rules:**
- Each choice has a **one-line label** (bold/system styling) and a **2-line description** (response styling, indented)
- The final hint line includes `This choice cannot be undone.` -- the only red/warning-coloured text in the room
- No skill check requirements shown (unlike rest encounters)
- No party status shown -- the Threshold strips context

### 3.3 Resolution Text

After choosing, the terminal renders a **brief, final** passage:

**Blood Toll (example, Shadow archetype):**
```
    LEDGER.EXE steps forward.

    The darkness touches their shoulder.
    When it withdraws, something is different.

    LEDGER.EXE: Operational -> Bruised

    The passage opens.

    Type "move" to enter the final chamber.
```

**Memory Toll:**
```
    You close your eyes.

    When you open them, the passage is open.
    Something is lighter. Something is gone.
    You cannot name it.

    The passage opens.

    Type "move" to enter the final chamber.
```

**Defiance:**
```
    You walk through.

    Nothing stops you. Nothing touches you.
    The air closes behind you like water.

    Somewhere ahead, something adjusts.

    The passage opens.

    Type "move" to enter the final chamber.
```

---

## 4. Archetype-Specific Threshold Identities

Each archetype's Threshold has a distinct *voice* -- the toll-keeper's personality changes. The room description, choice text, and resolution prose all shift.

| Archetype | Threshold Identity | Voice | Blood Toll Target |
|-----------|-------------------|-------|-------------------|
| The Shadow | The Absence | Cold, factual, inevitable | Visibility (permanent -1 max) |
| The Tower | The Foundation | Stern, architectural, structural | Stability (permanent -10 max) |
| The Entropy | The Gradient | Gentle, almost kind, entropic | Decay (immediate +15) |
| The Devouring Mother | The Embrace | Warm, maternal, suffocating | Attachment (immediate +20) |
| The Prometheus | The Forge | Feverish, demanding, inspired | Insight components (lose one) |
| The Deluge | The Current | Patient, inexorable, tidal | Water level (immediate +15) |
| The Overthrow | The Proclamation | Political, rhetorical, accusatory | Morale (party-wide stress +30) |
| The Awakening | The Mirror | Quiet, reflective, honest | Memory (lose a banter callback) |

---

## 5. Technical Implementation

### 5.1 Room Type

```python
# In dungeon_generator.py -- RoomType union
RoomType = Literal[
    "entrance", "combat", "encounter", "elite",
    "rest", "treasure", "exit", "boss",
    "threshold",  # NEW
]
```

### 5.2 Generator Placement

```python
# After content layers, before boss layer:
threshold = RoomNode(
    index=idx,
    depth=depth,  # Same depth as boss minus 1
    room_type="threshold",
    connections=[],
)
rooms.append(threshold)
# Connect last content layer -> threshold -> boss
_connect_layers(rooms, prev_layer, [threshold.index])
boss.connections.append(threshold.index)
threshold.connections.append(boss.index)
```

The Threshold replaces the direct connection between the last content layer and the boss. It becomes the only path to the boss -- a chokepoint by design (barbican architecture).

### 5.3 Encounter Template

The Threshold is not a standard encounter template from the DB. It is a **hardcoded encounter** in `dungeon_encounters.py` with archetype-specific text variants. This is intentional: the Threshold is a structural element of every run, not a random content piece.

```python
THRESHOLD_CHOICES = [
    EncounterChoice(
        id="threshold_blood",
        label_en="Blood Toll",
        label_de="Blutzoll",
        description_en="A wound, freely given. One operative takes one condition step.",
        description_de="Eine Wunde, freiwillig gegeben. Ein Operative erleidet eine Zustandsstufe.",
        check_aptitude=None,  # No skill check -- pure choice
    ),
    EncounterChoice(
        id="threshold_memory",
        label_en="Memory Toll",
        label_de="Erinnerungszoll",
        description_en="Something forgotten. You will not know what was taken.",
        description_de="Etwas Vergessenes. Du wirst nicht wissen, was genommen wurde.",
        check_aptitude=None,
    ),
    EncounterChoice(
        id="threshold_defiance",
        label_en="Defiance",
        label_de="Trotz",
        description_en="Pass without tribute. The passage remembers.",
        description_de="Passiere ohne Tribut. Der Durchgang erinnert sich.",
        check_aptitude=None,
    ),
]
```

### 5.4 Resolution Handler

In `dungeon_engine_service.py`, the Threshold choice resolution:

```python
async def _resolve_threshold_choice(
    instance: DungeonInstance,
    choice_id: str,
    agent_id: str | None,
) -> dict:
    if choice_id == "threshold_blood":
        # Player must have selected an agent
        agent = next(a for a in instance.party if a.agent_id == agent_id)
        agent.condition = step_condition_down(agent.condition)
        # Mark as threshold-wounded (cannot heal until boss cleared)
        agent.status_effects.append("threshold_wound")

    elif choice_id == "threshold_memory":
        # Remove a random positive modifier silently
        _apply_memory_toll(instance)

    elif choice_id == "threshold_defiance":
        # Flag for boss difficulty increase
        instance.archetype_state["_threshold_defiance"] = True

    instance.phase = "room_clear"
    instance.rooms[instance.current_room].cleared = True
    instance.rooms_cleared += 1
```

### 5.5 Boss Difficulty Modifier

In the boss combat setup (`_enter_combat_room` or equivalent):

```python
if instance.archetype_state.get("_threshold_defiance"):
    # Defiance toll: boss gets +1 effective difficulty
    enemy_power_mult *= 1.25
    # Boss gains one extra ability from the archetype pool
    extra_ability = random.choice(ARCHETYPE_BOSS_EXTRA_ABILITIES[instance.archetype])
    boss_template.special_abilities.append(extra_ability)
```

### 5.6 Frontend: Special Formatter

In `dungeon-formatters.ts`, a dedicated formatter for threshold text:

```typescript
export function formatThresholdEntry(archetype: string): TerminalLine[] {
  // Sparse, indented, literary rendering
  // Uses responseLine with 4-space indent prefix
  // Extra blank lines between paragraphs
  // Archetype-specific prose from THRESHOLD_TEXT registry
}
```

### 5.7 Map Icon

In `dungeon-map-icons.ts`:

```typescript
ROOM_ICON['threshold'] = (size: number) => svg`
  <svg ...>
    <!-- Stylised door lintel: vertical lines with horizontal bar -->
    <line x1="6" y1="2" x2="6" y2="${size-2}" stroke="currentColor" stroke-width="2"/>
    <line x1="${size-6}" y1="2" x2="${size-6}" y2="${size-2}" stroke="currentColor" stroke-width="2"/>
    <line x1="4" y1="4" x2="${size-4}" y2="4" stroke="currentColor" stroke-width="2"/>
  </svg>
`;
```

Colour: `var(--color-warning)` -- amber, distinct from combat (red) and rest (green).

---

## 6. SFX

New sound: `threshold-enter` -- a low, sustained tone that fades in slowly (1.5s). Not a stinger, not a blip. A pressure change. Sourced from Kenney Impact Sounds `impactBell_heavy_003` (0.65s) with reverb tail extension, or a new CC0 sample: deep bell with long decay.

The Threshold is the only room that plays its SFX on *entry*, not on action. The sound begins before the text appears.

---

## 7. Balance Considerations

### 7.1 Blood Toll Must Hurt But Not Kill

One condition step on a healthy agent (Operational -> Bruised) is survivable but meaningful. On an already-wounded agent (Wounded -> Critical), it's devastating. The player's choice of *which* agent to sacrifice adds tactical depth.

**Safeguard:** If all agents are Critical or worse, the Blood Toll option text changes to: *"The passage sees you have nothing left to give. The Blood Toll is waived."* -- and it becomes a free pass. The dungeon shows mercy only when there is nothing left to take.

### 7.2 Memory Toll Must Be Felt Eventually

The removed modifier should be one the player has *actively benefited from* at least once during the run. Silent removal of an unused modifier feels like nothing. The system should prioritise removing the highest-value active modifier.

### 7.3 Defiance Must Be Tempting

The +1 difficulty on the boss must be significant enough that defiance is a real gamble, but not so crushing that it's never viable. The extra boss ability should be dramatic but not instant-kill. Target: Defiance should feel like "I'll deal with it" -- and then in the boss fight, the player thinks "I should have paid."

---

## 8. Cross-Run Memory (Phase 2)

In a future phase, the Threshold remembers across runs:

- If the player chose Blood Toll in their last run, the Threshold greets them: *"You paid in blood last time. The passage remembers your honesty."* -- and offers a slightly cheaper Blood Toll (stress instead of condition).
- If they chose Defiance, the Threshold is colder: *"You refused last time. The passage does not forget."* -- and the Defiance option now also adds +10 stress to the party.
- If they chose Memory Toll, the Threshold is curious: *"You paid in thought. Did you notice what was taken? Do you still not know?"*

This creates a meta-narrative across runs that rewards engagement with the mechanic over optimisation.

---

## 9. Why This Works in Text

The Threshold exploits every advantage of the text medium:

1. **Whitespace as atmosphere** -- the empty screen IS the liminal space
2. **Unreliable narration** -- "Something has been taken" (Memory Toll) is terrifying in text, trivial in graphics
3. **Pacing control** -- short lines, long pauses, the blinking cursor as the threshold guardian
4. **Irrevocable text** -- once the choice scrolls past, it's gone. No undo. The terminal enforces permanence.
5. **Archetype voice** -- each Threshold speaks in the archetype's literary register, making each run's threshold feel unique

The Threshold is the room where the dungeon stops being a game and becomes a story.

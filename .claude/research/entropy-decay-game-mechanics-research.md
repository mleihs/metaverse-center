# Entropy, Decay & Degradation Mechanics in Dungeon Crawlers and Roguelikes

## Research Purpose

Game design precedent research for **The Entropy** dungeon archetype (`decay_bloom` resonance signature) in the Resonance Dungeons system. This document catalogs real-world implementations of entropy, decay, and degradation mechanics across 12+ games, extracting design patterns applicable to a phase-based, terminal-aesthetic dungeon crawler.

---

## 1. DARKEST DUNGEON -- Stress, Light, and Affliction

### 1.1 The Light Meter (Torch Degradation)

The light meter is a 0-100 scale that degrades continuously as the party explores.

**Light Levels and Thresholds:**

| Level | Range | Key Effects |
|---|---|---|
| Radiant | 76-100 | +15% scouting chance, +25% party surprise chance, minimal stress, no loot bonus |
| Dim | 51-75 | Minor penalties begin, slight stress increase |
| Shadowy | 26-50 | Moderate danger, +2-3% hero crit chance, increased loot |
| Dark | 1-25 | High risk, enemy accuracy/damage increase, substantial loot bonuses |
| Pitch Black | 0 | 75% chance of 2 bonus loot from battles, 95% chance of extra curio loot, +40-50% stress damage, shuffled party position on ambush, chance to spawn miniboss |

**Degradation Rate:** -1 per explored corridor segment, -6 per new room (-7 in Stygian/Bloodmoon). Torches restore +25 light each. Certain abilities (Vestal, Crusader) raise light; certain enemy abilities lower it. Players can also manually lower light in increments of 25.

**Why It Works (Design Analysis):**
- **Risk-reward gradient, not binary:** The system is not on/off. Each threshold band offers different tradeoffs. Players constantly recalibrate.
- **Player agency over degradation:** You can use torches to fight the decay, manually lower light for better loot, or ride the gradient. The degradation is *manageable*, not inevitable.
- **Economic pressure:** Torches cost gold. Bringing more torches means fewer healing items or food. The entropy mechanic creates a resource allocation decision *before the dungeon even starts*.
- **Information degradation:** Lower light reduces scouting (you see less of the map ahead). This is information entropy -- the game literally gives you less data as things decay.

### 1.2 The Stress System

A 0-200 gauge representing psychological degradation.

**Stress Sources (Accumulation):**
- Entering dungeons (scaled by difficulty and hero resolve level)
- Traversing corridors (ambient stress)
- Walking backwards
- Enemies' critical strikes and dedicated stress attacks
- Trap encounters
- Failed curio interactions
- Party starvation (no food)
- Witnessing allies reach Death's Door or die
- Negative quirks and trinket drawbacks amplify all stress damage
- Low light levels multiply stress intake

**Critical Thresholds:**

| Threshold | Effect |
|---|---|
| 100 | **Resolve Test**: 75% chance of Affliction, 25% chance of Virtue |
| 200 | **Heart Attack**: Hero drops to Death's Door. If already on Death's Door, instant death |

**Affliction System (7 base + 2 DLC):**

All afflictions impose: -15% to all resistances (Stun, Blight, Bleed, Disease, Debuff, Move, Trap) and -10% max HP.

| Affliction | Unique Stat Changes | Behavioral Effects |
|---|---|---|
| Fearful | -25% DMG, +10 DODGE, +2 SPD | May pass turn, move to back, stress party |
| Paranoid | -25% DMG, +10 DODGE, +2 SPD | Refuses healing/buffs/items, may attack allies |
| Selfish | -5 ACC, -10% DMG, +5 DODGE | Steals loot from curios |
| Masochistic | -15 DODGE | Attacks self, moves forward, marks self |
| Abusive | -5 ACC, +20% DMG, -15 DODGE | High stress to party, may attack allies |
| Hopeless | -5 ACC, -5 DODGE, -3 SPD | Refuses most commands, self-harm |
| Irrational | -5 ACC, -10% DMG, -5 DODGE, +2 SPD | Random curio interactions, unpredictable |

**Key design insight:** Afflictions do not just debuff the hero -- they cause the hero to *disobey commands* and *stress other party members*. This is degradation of *player agency*, not just stats. The afflicted hero becomes an unreliable element that cascading-damages the party's psychological stability.

**Virtue System (Counterpoint):**

5 virtues, each with +25% to all resistances. 25% base chance (modifiable by trinkets/quirks up to ~70%).

| Virtue | Effect |
|---|---|
| Stalwart | +15% PROT, +8% Death Blow Resist, chance to self-reduce stress |
| Courageous | -33% stress intake, +2 SPD, chance to reduce party stress |
| Powerful | +33% DMG, chance to buff party damage |
| Vigorous | Randomly heals 5 HP per turn |
| Focused | +5 ACC, chance to buff party accuracy |

Becoming Virtuous resets stress to 45 and reduces party stress.

**Why It Works:**
- **Stress is a second health bar with cascading consequences.** Unlike HP (which is binary -- alive or dead), stress degrades *behavior* before it kills.
- **The Resolve Test is a dramatic moment.** 75/25 affliction/virtue creates genuine tension. Virtue feels like a miracle; affliction feels earned.
- **Afflictions create emergent narrative.** A Paranoid hero refusing healing while the party is dying creates stories players remember.
- **Multiple relief valves exist.** Town facilities, camping skills, abilities, critical hits, rest rooms. Stress is manageable -- but management costs resources.

### 1.3 Darkest Dungeon 2 -- Flame and Loathing

DD2 evolved the light mechanic into the **Flame** (0-100 scale representing hope) and **Loathing** (0-4 phases representing entropy).

- **Flame** starts at 100, degrades while traveling, affects combat difficulty
- **Loathing** increases when traversing roads with "Oblivion Tears" and at certain nodes
- **Loathing decreases** when winning battles -- combat pushes back against entropy
- At high Loathing: Flame degrades faster, battles become harder, negative events increase

**Design insight:** The relationship between Flame and Loathing creates a *feedback loop* where failure accelerates entropy but success can reverse it. This is more dynamic than DD1's strictly-decaying torch.

---

## 2. HADES -- Chaos Boons (Curse-Then-Blessing)

### The Mechanic

Chaos gates offer boons that impose a **temporary curse** (3-4 encounters) followed by a **permanent blessing** for the rest of the run. The player sacrifices short-term power for long-term gain.

### Complete Curse List (13 types):

| Curse | Effect |
|---|---|
| Maimed | Take damage when using Attack |
| Flayed | Take damage when using Special |
| Addled | Take damage when using Cast |
| Pauper | Cannot earn Obols (money) |
| Abyssal | Increased trap damage |
| Atrophic | Max health temporarily decreased |
| Caustic | Killing enemies spawns Inferno-Bombs targeting you |
| Enshrouded | Cannot see chamber rewards for next rooms |
| Excruciating | Increased enemy damage |
| Halted | Dash range shortened |
| Roiling | More enemies in next encounters |
| Slippery | Bloodstone (Cast) reclaim time increased |
| Slothful | Movement speed reduced |

**Safety Mechanic:** Maimed, Flayed, and Addled cannot reduce health below 1 HP. The animation and sound still play (psychological effect), but no fatal damage. This prevents curse-stacking from creating unwinnable states.

**Blessings** include permanent bonuses to Attack damage, Special damage, Cast damage, health, dash distance, and more. Blessings stack additively and cannot be upgraded or sold.

### Duration Nuance

Curses last for a number of *encounters* (rooms with enemies), not *chambers*. Shops, Pom rooms, and story rooms do not count. This means the actual calendar duration of a curse depends on the path chosen, creating a secondary decision about routing.

### Why It Works:
- **Voluntary degradation.** The player *chooses* to be weakened. This transforms entropy from punishment to investment.
- **Temporal framing.** Knowing the curse will end makes it tolerable. The countdown creates anticipation.
- **Type diversity creates different costs.** Maimed punishes aggressive builds; Enshrouded punishes information-dependent routing. Different curses tax different playstyles.
- **Stacking opportunity.** Taking multiple Chaos boons creates a high-risk-high-reward playstyle where you're very weak mid-run but very strong late-run.

---

## 3. SLAY THE SPIRE -- Deck Pollution as Entropy

### The Mechanic

Curse cards are unplayable negative cards that persist in the player's deck between combats. They dilute hand draws, reduce effective choices per turn, and often impose additional penalties.

### Complete Curse Card List (14 cards):

| Curse | Effect |
|---|---|
| Ascender's Bane | Unplayable. Cannot be removed. (Ascension 10+) |
| Clumsy | Unplayable. Ethereal (discards at end of turn) |
| Curse of the Bell | Unplayable. (From Calling Bell relic) |
| Decay | At end of turn, take 2 damage |
| Doubt | At start of turn, gain 1 Weak |
| Injury | Unplayable |
| Necronomicurse | Unplayable. Cannot be removed |
| Normality | Cannot play more than 3 cards this turn |
| Pain | Whenever another card is played, lose 1 HP |
| Parasite | If removed from deck, lose 3 Max HP |
| Pride | At end of combat, add a copy of Pride to draw pile |
| Regret | At end of turn, lose HP equal to cards in hand |
| Shame | At end of turn, gain 1 Frail |
| Writhe | Unplayable. Automatically appears in opening hand |

### Sources of Curses:
- **Events** (risky choices that reward power but add a curse)
- **Chests** (some contain cursed relics)
- **Relics** (e.g., Calling Bell grants 3 relics but adds 3 curses)
- **Enemy abilities** (some bosses add curses to deck mid-combat)

### Removal Mechanisms:
- **Shop removal** (costs gold -- same gold that could remove basic Strike/Defend cards)
- **Events** (some offer curse removal as a choice)
- **Blue Candle relic** (allows playing curses at cost of 1 HP, exhausting them)

### Relics That Interact With Curses:
- **Du-Vu Doll**: +1 Strength per curse in deck (rewards keeping curses)
- **Darkstone Periapt**: +6 Max HP when gaining a curse
- **Omamori**: Negates next 2 curses obtained

### Why It Works:
- **Deck pollution is information entropy.** Your deck is your capability space. Curses reduce the probability of drawing useful cards -- they don't remove abilities, they make them *less likely to appear*.
- **Economic tradeoff.** Removing a curse costs the same as removing a bad basic card. This creates genuine "which entropy matters more?" decisions.
- **Some curses reward coexistence.** Du-Vu Doll and Darkstone Periapt mean entropy can be transmuted into power. This is the most sophisticated pattern: decay as fuel.
- **Parasite is brilliant.** A curse that *punishes removal* forces the player to decide: live with the entropy or pay a permanent price to remove it.

---

## 4. INSCRYPTION -- Card Sacrifice, Death Cards, and Game Deletion

### Card Sacrifice Mechanic
Cards require **blood sacrifice** (killing cards in play) to summon. Squirrel cards exist solely to be sacrificed. Dead cards generate **bone tokens** as a secondary resource. Sacrifice is not degradation -- it is *transformation of loss into currency*.

### Death Card Mechanic
When the player loses, they are "made into a death card" by the antagonist Leshy. The player chooses components from their run's cards (cost, power, health, sigils) to create a new card that appears in future runs. **Failure becomes a permanent artifact.** This is anti-entropy: loss generates something new.

### Game Self-Deletion (Act 3 -- Grimora)
In the final act, Grimora initiates **a full wipe of the game disk**, believing deletion of all content (including herself) is "for the greater good." The game progressively deletes itself while players complete final battles. Files are removed from the game directory in real-time.

### Why It Works:
- **Sacrifice as economy, not punishment.** The blood/bone system makes destruction feel generative.
- **Death cards create legacy.** Losing a run produces something you carry forward -- degradation creates artifacts.
- **Metagame entropy is unprecedented.** The game literally destroys itself. The file system becomes the entropy mechanic.

---

## 5. CAVES OF QUD -- Glimmer, Rust, and Fungal Infection

### Glimmer Mechanic (Psychic Entropy)
- **Accumulation:** Glimmer is proportional to the combined levels of all mental mutations. Higher Ego bonus increases effective mutation levels, which increases Glimmer.
- **Threshold at 20:** Exceeding 20 Glimmer triggers psychic hunters (Seekers of the Sightless Way) who pursue the player.
- **Design insight:** *Getting stronger at psychic abilities directly attracts proportional danger.* Power growth creates its own entropy. This is "negative progression through positive progression" -- the better you become, the more the world fights back.

### Rust Mechanic (Equipment Degradation)
- Items can be rusted by Qudzus (an environmental hazard)
- **Rusted items** cannot be equipped or activated. Commerce value divided by 100.
- **If a rusted item is rusted again, it is permanently destroyed.**
- Repair methods: Repair Skill + components, Fix-It Spray Foam consumable, NPC repair services

### Fungal Infection Mechanic (Biological Entropy)
- Fungal spores spread from environment/creatures to the player
- **Cure recipe is randomized per playthrough** -- you cannot memorize the solution
- Cure requires: eating a specific raw creature corpse, then applying a specific gel+liquid mixture to the infection within 100 turns
- **Untreated infection spreads and eventually transforms the player**

### Why It Works:
- **Glimmer is elegant anti-scaling.** It solves the problem of power creep by making power itself dangerous.
- **Randomized cures prevent systematic solutions.** Each playthrough requires fresh investigation of how to combat entropy.
- **Two-stage rust (degraded then destroyed)** creates a window of warning and decision.

---

## 6. NOITA -- Environmental Decay Through Physics

### The Mechanic
Every pixel is individually simulated using a cellular-automata engine inspired by falling-sand games. Materials have properties: flammable, liquid, corrosive, conductive, etc. All interactions are emergent, not scripted.

### Environmental Decay Examples:
- **Fire propagation:** Wood and coal ignite on contact with fire. Early levels are largely wood/coal, so fire can consume entire floors.
- **Acid:** Dissolves materials on contact, creating structural collapse.
- **Water-lava interaction:** Creates rock + steam. Steam condenses back into rain.
- **Toxic fumes:** Smoke from burning can suffocate the player.
- **Material state transitions:** Frozen acid, rusted metal, eroded rock, corroded materials, mossy steel -- all permanent transformation states.

### Why It Works:
- **The world degrades believably.** Entropy is emergent from physics, not a designed meter. It *feels* like real decay.
- **Chain reactions create narrative.** "I threw a bomb near coal and it ignited half the level" is a story, not a penalty.
- **Environmental decay is double-edged.** Destroying terrain can open paths, drain dangerous liquids, or create advantages. Entropy is a *tool*.
- **Permanence creates stakes.** Once an area is destroyed, it stays destroyed. No resets.

---

## 7. SUNLESS SEA / SUNLESS SKIES -- Terror as Environmental Degradation

### Terror Mechanic (Sunless Sea)
- **Accumulation:** Orange dots light at +1/2sec, red dots at +2/2sec. Rate increases when crew is below 25% capacity (double rate). Terror rises faster the further from London you sail.
- **At 100 Terror:** Crew mutiny. If you fail to calm them, they kill you.
- **Progressive consequences:** Before 100, random horrific events occur: crew members disappear, cargo is lost, sanity breaks.
- **Reduction methods:** Returning to well-lit ports, certain story events, spending money at specific locations.

### Interconnected Resource Entropy:
- **Fuel:** Depletes while sailing. Running out = adrift and helpless.
- **Supplies:** Consumed based on crew size. Running out = starvation events (crew death, cannibalism).
- **Crew:** Lost to combat, events, Terror consequences. Fewer crew = faster Terror accumulation.
- **These systems create cascading degradation:** Low supplies -> crew death -> Terror increases faster -> more negative events -> more crew loss.

### Legacy System (Death as Progression):
When the captain dies, the next captain inherits a portion of possessions. Certain narrative elements persist. The world map is re-randomized but partially familiar.

### Why It Works:
- **Distance is the entropy variable.** The further you go, the worse everything gets. Exploration *costs* in a fundamental way.
- **Cascading resource depletion** creates stories of desperation. Managing interconnected degrading systems is the core gameplay loop.
- **Terror is thematic, not abstract.** The fear of the unknown zee is the fear of entropy itself.
- **Legacy softens the blow.** Total failure still produces carry-forward, making entropy feel generative rather than purely destructive.

---

## 8. LOOP HERO -- World Construction as Entropy Source

### Core Mechanic
The hero auto-walks a loop. Players place terrain cards along the path. Each card has dual effects: benefits (spawning loot, healing, stat boosts) AND costs (spawning enemies, increasing boss meter).

### The Boss Meter:
- Filling the world with tiles fills the boss meter
- When full, a boss spawns at the camp
- **Building the world *creates* your own adversary**

### The Oblivion Card:
- **Single-use card that destroys a placed tile** and all creatures on it
- Returns road tiles to Wasteland
- Can destroy enemy camps, reducing spawns
- **Destroying tiles reduces the boss meter** -- deconstruction delays the final threat
- **Blissful Ignorance trait:** Full hand of Oblivion cards; using them restores 10% hero health. *Destruction heals.*

### Card Synergy Destruction:
- Destroying a Grove turns nearby Blood Groves into Hungry Groves
- Destroying a Village turns nearby Wheat Fields into Overgrown Fields
- **Selective destruction changes the nature of surrounding tiles** -- entropy ripples outward

### Why It Works:
- **Construction-destruction duality.** The player is both architect and demolisher. There is no "good" or "bad" -- only balance.
- **The boss meter makes growth dangerous.** Traditional roguelike progression (getting stronger) is here also the mechanism that spawns your greatest threat.
- **Oblivion is strategic retreat.** Choosing to unmake your world is a valid tactic, not a failure state.
- **Resource retention on retreat:** Retreating at camp keeps all resources; dying loses 70%. The tension between "push further" (more decay/danger) and "retreat now" (keep what you have) mirrors real entropy management.

---

## 9. ADDITIONAL GAMES WITH ENTROPY MECHANICS

### 9.1 FTL: Faster Than Light -- Ship Systems Degradation
- **Hull breaches** vent oxygen room-by-room. Crew suffocate in O2-depleted rooms.
- **System damage** is targeted: weapons, shields, engines, medbay can be individually destroyed.
- **Fires** spread between rooms and damage systems + hull.
- **The Lanius race** drains O2 from any room they occupy (living entropy agents).
- **Design insight:** Degradation is *spatial*. Different parts of the ship degrade independently, forcing triage decisions about which systems to save.

### 9.2 Into the Breach -- Permanent Grid Damage
- **Mech damage heals between missions. Grid damage is permanent.**
- Grid represents the civilian population. At 0 grid, the timeline is lost.
- Grid Defense (15% base) gives a chance for buildings to resist damage.
- **Only one weapon in the game can repair grid damage** (Grid Charger).
- **Design insight:** The asymmetry between recoverable (mech HP) and permanent (grid) damage creates a two-tier entropy system. Players sacrifice the recoverable to protect the permanent.

### 9.3 Pathologic / Pathologic 2 -- Negative Progression
- **The player gets weaker as the 12-day countdown progresses:** Health cap decreases from malnutrition, prices skyrocket, plague spreads, time accelerates.
- **"A pathologic fracture describes a bone worn down over time until one day it just breaks."** The game is named after its own entropy mechanic.
- The game "disproves everything you thought you knew about videogames" by making the player *less* capable over time.
- **Design insight:** Negative progression works when the *narrative supports it*. Pathologic is about a plague -- of course things get worse. The thematic alignment makes degradation feel purposeful, not arbitrary.

### 9.4 Breath of the Wild -- Weapon Durability as Entropy
- All weapons break after limited use. No repair mechanism.
- Weapons are abundant but ephemeral, forcing constant adaptation.
- **Design insight:** Durability forces experimentation. Players who would otherwise find one "best weapon" and never change must constantly engage with the loot system. Entropy prevents optimization lock-in.

---

## 10. UI DEGRADATION AS GAME MECHANIC

### 10.1 Eternal Darkness: Sanity's Requiem (2002)
The gold standard for UI-as-decay:
- **Camera tilts** progressively at low sanity (Dutch angle, jittering)
- **Fake blue screen of death** interrupts gameplay
- **Fake TV shutoff** (screen goes black, "VIDEO" blinks)
- **Fake GameCube boot screen** (pretends the game reset)
- **Fake controller disconnect** message
- **Fake save deletion** ("Delete all saves?" -- regardless of choice, saves appear deleted)
- **Fake sequel preview** ("Congratulations on completing the demo!")
- **Volume appears to change** (fake mute indicator)

### 10.2 NieR: Automata -- UI as Equipment
- All HUD elements (HP gauge, minimap, enemy data, damage values, sound waves) are **plug-in chips** consuming storage space.
- Players can **remove any UI element** to free storage for combat chips.
- **Removing the OS Chip kills the character** -- the operating system is literally the character's life.
- Total UI elements consume ~25 storage units (~20% of max capacity).
- **Design insight:** UI degradation is *voluntary and strategic*. Experienced players operate with minimal information for maximum combat power. The interface is a resource to be spent.

### 10.3 Doki Doki Literature Club -- Narrative UI Corruption
- Dialogue boxes glitch and corrupt progressively
- Choice options become unselectable or garbled
- Save files disappear
- **Character .chr files in the game directory** are deleted by the antagonist (Monika)
- The player can **interact with the file system** to influence the game
- **Design insight:** When the game's own meta-structure (saves, menus, files) degrades, it breaks the fourth wall and creates genuine unease. The player's control interface is being attacked.

---

## 11. DESIGN PATTERNS: WHAT MAKES ENTROPY FUN

### Pattern 1: The Risk-Reward Gradient (Darkest Dungeon Light)
Entropy creates a *spectrum* of risk and reward, not a binary state. The player can ride the gradient -- choosing their comfort level. More decay = more danger + more reward. This gives the player *authorship over their own difficulty*.

### Pattern 2: Voluntary Degradation (Hades Chaos, NieR Chips)
The player *chooses* to accept entropy in exchange for future power. This transforms punishment into investment. The key insight: entropy is tolerable when the player has agency over *when and how* it occurs.

### Pattern 3: Deck/Resource Pollution (Slay the Spire Curses)
Entropy does not remove capabilities -- it dilutes them. The player still has all their cards, but the probability of drawing the right one decreases. This creates *probabilistic degradation* that feels different from stat reduction.

### Pattern 4: Cascading System Failure (Sunless Sea, FTL)
Multiple interconnected systems degrade simultaneously. Failure in one system accelerates failure in others. The player must perform *triage*, deciding which systems to save and which to sacrifice.

### Pattern 5: Power Attracts Danger (Caves of Qud Glimmer)
Getting stronger directly increases the threat level. This is *self-correcting entropy* -- the game scales challenge to match player power, but through a diegetic mechanic rather than invisible difficulty scaling.

### Pattern 6: Construction Creates Destruction (Loop Hero)
Building the world is simultaneously building your own enemy. Progress and entropy are the same action. The player must find the optimal *balance point* between capability and threat.

### Pattern 7: Failure Creates Artifacts (Inscryption Death Cards, Sunless Sea Legacy)
Loss and degradation produce carry-forward elements. Entropy is *generative* -- destruction creates something new. This transforms the emotional valence of failure from negative to bittersweet.

### Pattern 8: Entropy of Information (Darkest Dungeon Scouting, Hades Enshrouded)
Rather than degrading stats or capabilities, the game degrades *what the player knows*. Less information forces riskier decisions. This is particularly effective because it attacks the player's meta-cognition, not their character's stats.

---

## 12. SYNTHESIS: DESIGN PRINCIPLES FOR THE ENTROPY ARCHETYPE

Based on this research, the following principles should guide The Entropy dungeon design:

### 12.1 Multi-Vector Decay
Do not rely on a single decay metric. Darkest Dungeon uses light AND stress AND condition. FTL uses hull AND systems AND oxygen AND crew. Multiple interacting entropy vectors create depth.

### 12.2 Agency Over Entropy Rate
Players should be able to influence (not eliminate) the rate of decay. Darkest Dungeon's torches, Loop Hero's Oblivion card, Hades' Chaos gate choice -- all give the player tools to modulate entropy.

### 12.3 Entropy as Resource
The most sophisticated designs (Slay the Spire's Du-Vu Doll, Loop Hero's Blissful Ignorance, Inscryption's Death Cards) allow players to *transmute entropy into power*. Decay should not be purely negative -- it should be a resource that skilled players can harness.

### 12.4 Cascading Consequences, Not Instant Death
Entropy should degrade *capability* before it causes *failure*. Darkest Dungeon's affliction system is the exemplar: stress degrades behavior, then agency, then health, then life. Each stage is a decision point.

### 12.5 Triage as Core Decision
When multiple things are decaying simultaneously, the player must choose what to save. The Entropy archetype's existing "Restoration Points" mechanic (choosing which decaying artifacts to restore) aligns perfectly with this pattern.

### 12.6 Information Entropy
Consider degrading what the player knows, not just what they have. Terminal-aesthetic text corruption, unreliable status displays, fading map data -- these would be thematically powerful and mechanically distinctive.

### 12.7 The Virtue Moment
Every decay system needs a counterbalancing "miracle" possibility. Darkest Dungeon's 25% Virtue chance transforms the stress system from pure punishment to dramatic narrative. The Entropy archetype should have moments where decay *reverses* or *transforms* into something beneficial.

### 12.8 Thematic Alignment
Pathologic works because the *narrative explains* why things get worse. "Der Verfall-Garten" (The Decay Garden) has strong thematic foundations -- entropy as transformation's dark twin, bloom from rot, beauty in dissolution. The mechanics should feel like they belong in this world, not like arbitrary difficulty.

---

## Sources

- [Light Meter - Official Darkest Dungeon Wiki](https://darkestdungeon.wiki.gg/wiki/Light_Meter)
- [Stress - Official Darkest Dungeon Wiki](https://darkestdungeon.wiki.gg/wiki/Stress)
- [Affliction - Official Darkest Dungeon Wiki](https://darkestdungeon.wiki.gg/wiki/Affliction)
- [Virtue - Official Darkest Dungeon Wiki](https://darkestdungeon.wiki.gg/wiki/Virtue)
- [Loathing - Official Darkest Dungeon Wiki](https://darkestdungeon.wiki.gg/wiki/Loathing)
- [Flame - Official Darkest Dungeon Wiki](https://darkestdungeon.wiki.gg/wiki/Flame)
- [Chaos/Boons (Hades) - Hades Wiki](https://hades.fandom.com/wiki/Chaos/Boons_(Hades))
- [Hades Chaos Guide - The Gamer](https://www.thegamer.com/hades-chaos-guide/)
- [All Curse Cards - Slay the Spire Wiki](https://slaythespire.gg/cards/curse)
- [Curse - Slay the Spire Wiki](https://slay-the-spire.fandom.com/wiki/Curse)
- [Inscryption - Wikipedia](https://en.wikipedia.org/wiki/Inscryption)
- [Deathcard - Inscryption Wiki](https://inscryption.fandom.com/wiki/Deathcard)
- [Glimmer - Official Caves of Qud Wiki](https://wiki.cavesofqud.com/wiki/Glimmer)
- [Mutations - Official Caves of Qud Wiki](https://wiki.cavesofqud.com/wiki/Mutations)
- [Fungal Infections - Official Caves of Qud Wiki](https://wiki.cavesofqud.com/wiki/Fungal_infections)
- [Rusted - Official Caves of Qud Wiki](https://wiki.cavesofqud.com/wiki/Rusted)
- [Noita - Kotaku](https://kotaku.com/noita-is-a-delightful-game-where-you-can-destroy-every-1838376682)
- [Noita Physics - PC Gamer](https://www.pcgamer.com/noita-is-a-hilarious-horrifying-wizard-death-experiment-where-every-pixel-is-simulated/)
- [Materials - Noita Wiki](https://noita.wiki.gg/wiki/Materials)
- [Terror - Sunless Sea Wiki](https://sunlesssea.fandom.com/wiki/Terror)
- [Sunless Sea - Steam Guide: Fuel, Supplies, Terror](https://steamcommunity.com/sharedfiles/filedetails/?id=1397427536)
- [Oblivion - Loop Hero Wiki](https://loophero.fandom.com/wiki/Oblivion)
- [Loop Hero - Wikipedia](https://en.wikipedia.org/wiki/Loop_Hero)
- [Sanity Effects - Eternal Darkness Wiki](https://eternaldarkness.fandom.com/wiki/Sanity_Effects)
- [NieR Automata Plug-in Chips - The Gamer](https://www.thegamer.com/nier-automata-plug-in-chips/)
- [Doki Doki Literature Club Disintegration - Epilogue Gaming](https://epiloguegaming.com/disintegration-in-doki-doki-literature-club/)
- [Pathologic Game Design - Game Developer](https://www.gamedeveloper.com/design/in-russia-game-plays-you-how-pathologic-proves-all-the-game-design-rules-wrong)
- [Negative Game Mechanics - Game Developer](https://www.gamedeveloper.com/design/a-look-at-negative-game-mechanics)
- [Weapon Durability in BotW - Medium](https://medium.com/@JohnnyUzan/weapon-durability-in-breath-of-the-wild-botw-has-been-a-source-of-controversy-among-gamers-ever-675e9c1bdae0)
- [Grid Power - Into the Breach Wiki](https://intothebreach.fandom.com/wiki/Grid_Power)
- [Oxygen - FTL Wiki](https://ftl.fandom.com/wiki/Oxygen)

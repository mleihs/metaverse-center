---
title: "Dungeon Archetype Detail Pages — Implementation Spec"
version: "1.1"
date: "2026-04-07"
type: spec
status: implemented
lang: en
tags: [dungeon, frontend, detail-page, design, literary, UI]
example_archetype: "The Overthrow"
---

# Dungeon Archetype Detail Pages — Full Implementation Spec

## Overview

The dungeon slider on the landing page (`DungeonShowcase.ts`) introduces each archetype with a slide. Each slide links to a **dedicated detail page** that expands on the lore, mechanics, literary DNA, encounters, enemies, loot, and objektanker of that archetype.

This document specifies **5 layout concepts**, of which **Concept 3 (The Descent)** and **Concept 5 (The Exhibition)** are fully elaborated for implementation. All examples use **The Overthrow** (Archetype VIII, `#d4364b`, Authority Fracture) as the reference dungeon.

---

## Route & Architecture

- **Route:** `/archetypes/:id` (e.g., `/archetypes/overthrow`)
- **Public:** Yes (no auth required, follows public-first architecture)
- **Component:** One shared `<velg-archetype-detail>` shell that lazy-loads the correct layout variant
- **Data:** Extended from `dungeon-showcase-data.ts` into a new `dungeon-detail-data.ts` file
- **SEO:** `seoService.setTitle(['The Overthrow — Der Spiegelpalast'])`, canonical, breadcrumbs
- **Navigation:** Prev/Next archetype links, back to landing page showcase section

---

## All 8 Archetypes (Quick Reference)

| # | Name | Subtitle | Accent | Mechanic | Gauge Name |
|---|------|----------|--------|----------|------------|
| I | The Shadow | Die Tiefe Nacht | `#7c5ce7` | Visibility Points (3→0) | VP |
| II | The Tower | Der Fallende Turm | `#4a8ab5` | Stability Countdown (100→0) | Stability |
| III | The Devouring Mother | Das Lebendige Labyrinth | `#2dd4a0` | Parasitic Attachment (0→100) | Attachment |
| IV | The Entropy | Der Verfall-Garten | `#d4920a` | Decay Accumulation (0→100) | Decay |
| V | The Prometheus | Die Werkstatt der Götter | `#e85d26` | Crafting Insight (0→100) | Insight |
| VI | The Deluge | Die Steigende Flut | `#1ab5c8` | Rising Water Level (0→100) | Water Level |
| VII | The Awakening | Das Kollektive Unbewusste | `#b48aef` | Awareness Gauge (0→100) | Awareness |
| VIII | The Overthrow | Der Spiegelpalast | `#d4364b` | Authority Fracture (0→100) | Fracture |

---

## 5 Concepts (Summary)

### Concept 1: "The Codex" — Editorial Scroll-Epos
Long-form vertical scroll. Literary magazine feel. Full-bleed pull quotes between editorial sections. Parallax hero images. Single-column reading width (65ch) for lore. Masonry grid for literary DNA. Horizontal encounter card strip.

### Concept 2: "The Dossier" — Intelligence Briefing
Split-screen: sticky artwork left, scrollable classified document right. Tabbed navigation (Briefing / Field Notes / Intercepts / Specimens / Artifacts). Monospace headers, redacted text effects, classification stamps. SCP Foundation meets Darkest Dungeon.

### Concept 3: "The Descent" — Vertical Depth Journey ← DETAILED BELOW
The page IS the dungeon. Scroll = descend. Background darkens, gauge fills, atmosphere intensifies. Content organized by depth levels. Boss reveal at bottom.

### Concept 4: "The Grimoire" — Annotated Manuscript
Three-column layout: left marginalia, center text, right annotations. Literary quotes as margin notes. Illuminated drop-caps. Layout "breaks" per archetype (text dissolves, columns collapse, etc.). House of Leaves meets illuminated manuscript.

### Concept 5: "The Exhibition" — Curated Gallery ← DETAILED BELOW
Full-screen "rooms" with scroll-snap. Each room showcases one aspect. Museum-text typography. Massive image surfaces. Gallery lighting via radial gradients. Minimal text, maximum atmosphere.

---

# THE OVERTHROW — Reference Content

All content below is sourced from the backend Python dicts and literary research docs. This is the complete content inventory for building detail pages.

## Archetype Identity

```
Name:       The Overthrow
Subtitle:   Der Spiegelpalast
Numeral:    VIII
Accent:     #d4364b (red)
Signature:  authority_fracture
Mechanic:   faction_navigation
Tagline EN: Power changes hands. The old order does not die — it metamorphoses.
Tagline DE: Macht wechselt die Hände. Die alte Ordnung stirbt nicht — sie verwandelt sich.
```

## Prose Style

> Political vertigo. Clinical precision at low fracture (Machiavelli), ascending paranoia at high (Dostoevsky). Every NPC is a political actor. Power is language, not violence. Certainty of allegiance degrades, not grammar. German: Spiegelpalast-Deutsch — legalistic → Brechtian → compressed.

## Literary Quotes (from Showcase Slider)

1. **Dostoevsky** (Русский): "Starting from unlimited freedom, I conclude with unlimited despotism."
   - Original: "Выходя из безграничной свободы, я заключаю безграничным деспотизмом."
2. **Machiavelli** (Italiano): "Everyone sees what you appear to be, few experience what you really are."
   - Original: "Ognuno vede quel che tu pari, pochi sentono quel che tu sei."
3. **Brecht** (Deutsch): "Food is the first thing, morals follow on."
   - Original: "Erst kommt das Fressen, dann kommt die Moral."
4. **Camus** (Français): "Every revolutionary ends as an oppressor or a heretic."
   - Original: "Tout révolutionnaire finit en oppresseur ou en hérétique."
5. **Orwell** (English): "Power is not a means; it is an end. One does not establish a dictatorship in order to safeguard a revolution; one makes the revolution in order to establish the dictatorship."
6. **Regime Banter**: "The old leader is gone. The new leader enters. Same room. Same desk. Same view from the window."

## Authority Fracture Mechanic

```
Start:              0 / 100
Gain per room:      4 (depth 1-2) → 7 (depth 3-4) → 10 (depth 5+)
Gain per combat:    +2/round, +2/hit, +5 on failed check
Reduce:             -5 on rest, -10 on rally (Propagandist ability)
Rally cost:         15 stress, 40 min aptitude, 3-room cooldown

Thresholds:
  Court Order   0-19   (Machiavelli: clinical, precise)
  Whispers     20-39   (Dostoevsky/Brecht/Havel: tension rising)
  Schism       40-59   (stress ×1.10, 20% ambush)
  Revolution   60-79   (stress ×1.25, 35% ambush — Koestler/Camus/Canetti)
  New Regime   80-99   (stress ×1.50, betrayals constant — Arendt/Kundera/Orwell)
  Collapse      100    (stress ×2.0, total power vacuum, party wipe)

Aptitude Weights:
  Propagandist: 30 (critical)
  Spy:          25 (high)
  Infiltrator:  15 (medium)
  Saboteur:     12 (medium)
  Guardian:     10 (low)
  Assassin:      8 (low)

Room Distribution: 20% Combat / 45% Encounter / 5% Elite / 10% Rest / 10% Treasure / 10% Exit
```

## Enemies (Bestiary)

### Faction Informer (Minion)
- **DE:** Fraktionsspitzel
- **Aptitude:** Spy | Power: 2 | Stress: 4 | Evasion: 45%
- **Ability:** Denounce
- **Description:** "Havel's greengrocer made operative. The informer does not believe — the informer performs. The sign in the window says what the faction requires. Behind the counter, the informer reports who does not display theirs."

### Propaganda Agent (Standard)
- **DE:** Propagandaagent
- **Aptitude:** Propagandist | Power: 3 | Stress: 6 | Evasion: 20%
- **Ability:** Rewrite
- **Description:** "Orwell's Squealer on two legs. The agent does not lie — the agent renders the concept of lying meaningless. Yesterday's alliance was always today's betrayal. The records have been updated. The records were always thus."

### Regime Enforcer (Standard)
- **DE:** Regimevollstrecker
- **Aptitude:** Guardian | Power: 5 | Stress: 3 | Evasion: 10%
- **Ability:** Suppress
- **Description:** "The muscle behind the rhetoric. The enforcer does not care which faction gives the order — only that the order exists. Arendt's ideal subject: one for whom the distinction between fact and fiction has ceased to matter."

### Grand Inquisitor (Elite)
- **DE:** Großinquisitor
- **Aptitude:** Propagandist | Power: 4 | Stress: 8 | Evasion: 15%
- **Ability:** Interrogate
- **Description:** "Dostoevsky's three powers made flesh: miracle, mystery, authority. The Inquisitor does not punish dissent — the Inquisitor explains why dissent was always agreement, misunderstood. The confession is not extracted. It is assisted."

### The Pretender (Boss)
- **DE:** Der Prätendent
- **Aptitude:** Propagandist | Power: 5 | Stress: 9 | Evasion: 20%
- **Abilities:** Rhetoric, Rewrite
- **Description:** "Milton's Satan made sovereign. The Pretender began as a rebel — magnificent, defiant, charismatic. Power degraded the vision. Phase 1: Book I archangel, addressing armies with impossible eloquence. Phase 2: Book IV, 'squat like a toad,' truth exposed. Phase 3: Book X, permanently serpentine. The Pretender quotes everyone. Especially you."

## Banter Lines (28 total, by Fracture Tier)

### Tier 0: Court Order (0-19) — Machiavelli Clinical
- "The corridor is orderly. Signs indicate direction. The signs have been recently updated."
- "Alliance offered. Alliance accepted. The cost will be announced later."
- "Everyone sees what you appear to be. Few experience what you really are. The Spiegelpalast sees both."
- "A faction representative nods at {agent}. The nod is precisely calibrated: acknowledgment without commitment."
- "The enforcers are down. The report will say they were never here. The revised report will say {agent} was never here either."
- "The faction leader smiles. The smile has been authorized."

### Tier 1: Whispers/Schism (20-59) — Dostoevsky/Brecht/Havel
- "Three factions. Three truths. None of them are lying. This is the problem."
- "{agent} is offered a seat at the table. The seat is comfortable. The table is set for fewer people than it was yesterday."
- "Walls have ears. These walls have faction insignia. The insignia changed since the party entered."
- "»Erst kommt das Bündnis«, sagt der Fraktionsführer. »Dann kommt die Wahrheit. Falls noch jemand fragt.«"
- "The enforcers make speeches while fighting. They die with quotable last words. The Overthrow is theatrical even in violence."
- "The enforcers are down. Which faction sent them? The answer depends on which faction asks."
- "{agent} reads the new decree. It contradicts the previous decree. Both remain in effect. Doublethink."

### Tier 2: Revolution (60-79) — Koestler/Camus/Canetti
- "The old leader is gone. The new leader enters. Same room. Same desk. Same view from the window."
- "Every revolutionary ends as an oppressor or a heretic. The Spiegelpalast offers both options. Choose quickly."
- "{agent} joins the revolution. The revolution has a sign-up sheet. The sign-up sheet has a second page that is not immediately visible."
- "The party can never be mistaken. {agent} can make a mistake. Not the party. Not the faction. Fight accordingly."
- "Victory. The revolution devours its children — but not today. Today, the children devour."
- "{agent} tries to mediate between factions. Both sides thank {agent}. Both sides add {agent}'s name to a list that is not labeled 'mediators.'"

### Tier 3: New Regime/Collapse (80+) — Arendt/Kundera/Orwell
- "Macht. Macht des Machens. Spiegel. Spiegel des Spiegels. Wer regiert?"
- "The Pretender speaks. {agent} has heard these words before — in their own voice, on Floor 1."
- "All factions are equal. But some factions are more equal than others. The sign was always there. The party is only now able to read it."
- "»Wir haben Ihre Akte gelesen. Eine bemerkenswerte Karriere. Leider müssen wir sie umschreiben.«"
- "The boot. The face. Forever. But whose boot? The answer changes with the faction."
- "»Ihr wolltet Freiheit. Ich wollte Freiheit. Seht, was wir daraus gemacht haben.«"
- "»Der Spiegelpalast zeigt jedem, was er sehen will. Nicht was er ist. Was er will. Das ist schlimmer.«"
- "Power is not a means; it is an end. One does not establish a dictatorship to safeguard a revolution. The Pretender knows this. {agent} is learning."

## Key Encounters (Narrative)

### Faction Offer (Depth 1-3)
> Alliance in exchange for unspecified service.
- Accept alliance (Propagandist check): -5 difficulty
- Gather intelligence first (Spy check): neutral
- Decline, remain unaligned

### Show Trial (Depth 2-5)
> Former faction leader tried with rewritten biography.
- Defend the accused (Propagandist check): +5 difficulty
- Observe the trial's mechanism (Spy check): -5 difficulty
- Leave before verdict

### Greengrocer's Window (Depth 1-4)
> Display one of multiple contradictory faction slogans to pass.
- Display dominant faction's sign (Infiltrator check): -5 difficulty

### Grand Inquisitor Tribunal (Elite, Depth 3-7)
> Philosophical debate with Dostoevsky's three powers.
- Debate (Propagandist): +5 difficulty
- Fight

### The Pretender (Boss, Depth 4+)
> Milton's Satan throne room. Every mirror reflects a different version of the same face.

## Entrance Texts (5 variants)

1. "The threshold is a mirror. Not glass — political. Every reflection shows a different allegiance."
2. "The air smells of ink and ambition. Decrees are being written somewhere deeper. Both will be enforced."
3. "Factions. The word is not adequate. These are ecosystems of belief, each convinced of its own necessity."
4. "Power changes hands here. Not violently — procedurally. The forms are filled out. The signatures are forged. The forgeries are notarized."
5. "The descent begins. Not into darkness — into politics. Zamyatin's glass walls. Privacy is not forbidden. It is conceptually abolished."

## Loot (12 items)

### Tier 1 (Minor)
| Item | Effect | Description |
|------|--------|-------------|
| Faction Dossier | Stress heal 50 | "Kadare's Palace of Dreams made portable. Knowledge is not power — knowledge is the absence of fear." |
| Propaganda Leaflet | Propagandist +5 (5 rooms) | "Squealer's latest revision. The words are wrong but the technique is instructive." |
| Informer's List | Spy +5 (5 rooms) | "Some are informers. Some are targets. The difference is a matter of perspective." |
| Safe Conduct Pass | Stress resist +10% (4 rooms) | "Valid until the faction leader is replaced. Which could be any moment." |

### Tier 2 (Major)
| Item | Effect | Description |
|------|--------|-------------|
| Decoded Cipher | Stress heal 100 | "Manuscripts don't burn. But codes can be broken." |
| Seal of Office | Propagandist +10 (8 rooms) | "The office no longer exists. The seal still carries weight." |
| Double Agent's Testimony | Stress resist +15% (6 rooms) | "Ngũgĩ's informer-hero: the traitor whose confession is the most heroic act." |
| Erased Photograph | Memory item | "Kundera's Clementis photograph. The body erased, the fur hat remaining." |

### Tier 3 (Legendary)
| Item | Effect | Description |
|------|--------|-------------|
| Authority Fragment | Zone security +1 tier (10 ticks) | "A fragment of legitimate authority, salvaged from the Spiegelpalast." |
| Colossus Splinter | All agents +15% morale (10 ticks) | "La Boétie's proof: tyranny requires consent." |
| Mirror Shard | Openness +5 | "It still reflects — but what it reflects is no longer the room." |

## Objektanker (8 Objects, 4 Phases Each)

### 1. Faction Banner
- Discovery: "A banner. The insignia is familiar — from two rooms ago, where it meant something different."
- Echo: "The banner has been turned inside out. The same insignia, reversed."
- Mutation: "The banner bears no insignia now. It bears a mirror."
- Climax: "The banner is blank. All factions have claimed it. All factions have abandoned it. It flies for no one."

### 2. Decree Stone
- Discovery: "A stone tablet with a decree. The ink is fresh. The decree is reasonable."
- Echo: "The decree has been amended. The amendment contradicts the original. Both remain binding."
- Mutation: "Three decrees form a triangle of mutual contradiction. Each abolishes the one before it."
- Climax: "The decree stone is blank. Not erased — never inscribed."

### 3. Informer's Clipboard
- Discovery: "A clipboard with names. Some checked off. The party's names are listed but not yet checked."
- Echo: "The clipboard has grown. More names. The handwriting changes — multiple informers."
- Mutation: "The informer's name is on the list now. The system is recursive."
- Climax: "Every name is checked off. The list continues. There are no names left. The checking continues."

### 4. Trial Chair
- Discovery: "An empty chair. The room is arranged for a tribunal. The chair is for the accused."
- Echo: "The chair has been occupied. Recently. The warmth is still there."
- Mutation: "The chair faces a mirror now. The accused watches their own trial."
- Climax: "The chair is for the judge now. The next trial is their own."

### 5. Mirror Corridor
- Discovery: "Mirrors on both walls. The reflections are accurate. Suspiciously accurate."
- Echo: "The reflections are slightly ahead of the party."
- Mutation: "The reflections wear different faction insignia than the party."
- Climax: "The mirrors face each other. Infinite recursion. The Pretender is in every reflection."

### 6. Propaganda Poster
- Discovery: "A poster. The message is clear, the design effective. It does not ask you to agree. It assumes you already do."
- Echo: "The poster has been pasted over with a new one. The new poster says the opposite."
- Mutation: "Both posters are visible now, layered. The contradiction is the message."
- Climax: "The poster is blank. The propaganda has moved from paper into the air itself."

### 7. Scales of Justice
- Discovery: "Balanced scales. Both pans empty. The balance is perfect because nothing is being weighed."
- Echo: "One pan holds a faction seal. The other holds a different seal. They weigh exactly the same."
- Mutation: "A thumb on the scale. Whose thumb? The mirror does not show a hand."
- Climax: "Both pans hit the ground simultaneously. Justice is not blind — justice has been dismissed."

### 8. Colossus Pedestal
- Discovery: "An empty pedestal scarred where something massive stood. The shadow has not noticed it is empty."
- Echo: "The inscription says: 'The Colossus stands because you carry it.' Below: 'Stop carrying.'"
- Mutation: "Cracks radiating downward. The Colossus was pulled from below. By the hands that built it."
- Climax: "The pedestal is being rebuilt. Fresh mortar, same dimensions. The builders are the ones who pulled the last one down."

## Literary DNA (Key Authors)

| Author | Work | Core Concept | Language |
|--------|------|--------------|----------|
| George Orwell | 1984, Animal Farm | Power as perpetual re-seizure. Doublethink. Newspeak. | English |
| Yevgeny Zamyatin | We | Totalitarianism through transparency. Glass walls. | Русский |
| Fyodor Dostoevsky | Demons, Bros. Karamazov | Revolutionary cell as pathology. Grand Inquisitor. | Русский |
| Arthur Koestler | Darkness at Noon | Revolution as logic. Rubashov's confession. | English/DE |
| Niccolò Machiavelli | The Prince | Realpolitik. Virtù vs. fortuna. Fox and lion. | Italiano |
| Hannah Arendt | Origins of Totalitarianism | Banality of evil. Fact/fiction collapse. | English/DE |
| William Shakespeare | Julius Caesar, Richard III | Power as performance. Antony's funeral oration. | English |
| Bertolt Brecht | Threepenny Opera, Galileo | Epic theatre. Alienation effect. | Deutsch |
| Václav Havel | Power of the Powerless | Greengrocer's sign. Living within the lie. | Čeština |
| Albert Camus | The Rebel | Absurd revolt. Revolution's self-consumption. | Français |
| Milan Kundera | Book of L&F | Clementis's fur hat. Memory as political weapon. | Čeština |
| Elias Canetti | Crowds and Power | Mass psychology. Transformation of power. | Deutsch |
| Ismail Kadare | Palace of Dreams | State surveillance via dream interpretation. | Shqip |
| Étienne de la Boétie | Discourse on Voluntary Servitude | Tyranny requires consent. Stop carrying the Colossus. | Français |
| John Milton | Paradise Lost | Satan: magnificent rebel → degraded tyrant (3 phases). | English |

## Mythological Foundations

- **Milton's Satan Cycle:** Magnificent rebel (Book I) → exposed spy (Book IV) → permanent serpent (Book X) = The Pretender's three phases
- **French Revolution Cycle:** Hope → Constitution → Radicalization → Terror → Exhaustion → Autocracy = Authority Fracture's emotional gradient
- **Antigone:** Irresolvable conflict between state authority and moral duty
- **Tower of Babel:** Communication breakdown across factions
- **Spartacus:** United against, divided on the future

---

# CONCEPT 3 — "THE DESCENT" — Full Implementation Spec

## Core Principle

**The page IS the dungeon.** Scrolling = descending. The scroll position drives a continuous atmospheric transformation: background darkens, the Authority Fracture gauge fills, text glow intensifies, encounters become more dangerous. At the bottom: the Boss.

## Visual Architecture

### Scroll-Driven Color System

The entire page background interpolates from a lighter surface to deep darkness as the user scrolls:

```css
/* Surface (top): */
color-mix(in oklch, var(--color-surface) 85%, #d4364b 15%)
/* → Threshold: */
color-mix(in oklch, var(--color-surface) 60%, #d4364b 10%)
/* → Depth 1: */
color-mix(in oklch, #1a1a2e 90%, #d4364b 10%)
/* → Depth 2: */
color-mix(in oklch, #0d0d1a 92%, #d4364b 8%)
/* → Abyss: */
#0a0a0f with radial red vignette
```

### Fracture Gauge (Sticky Sidebar Element)

A vertical gauge fixed to the right edge of the viewport (`position: sticky`). As the user scrolls through the page, the gauge fills from 0→100, mirroring the Authority Fracture mechanic.

```
Gauge visual per archetype (Overthrow):
┌──┐
│  │ 100 — Collapse (pulsing red)
│  │  80 — New Regime (bright red)
│  │  60 — Revolution (medium red, #d4364b)
│  │  40 — Schism (dull red)
│  │  20 — Whispers (dark red)
│  │   0 — Court Order (grey/dormant)
└──┘

Width: 4px (expands to 6px at threshold crossings)
Position: right: var(--space-4), top: 50%, transform: translateY(-50%)
Height: 40vh
Labels appear at threshold crossings as small tooltips
Animation: CSS animation-timeline: scroll() fills the gauge
```

For other archetypes:
- Shadow: VP gauge (inverted, drains from full to empty, purple)
- Deluge: Water level (fills blue from bottom)
- Entropy: Decay bar (fills gold, progressively fragmented)
- Mother: Attachment meter (fills teal, heart-pulse animation)
- Prometheus: Insight flame (fills orange, flicker animation at high values)
- Tower: Stability column (drains blue from top, crack animations)
- Awakening: Awareness eye (fills lavender, iris-aperture animation)

### Typography Scale

```css
:host {
  /* Hero title */
  --_title-size: clamp(3rem, 10vw + 1rem, 8rem);
  /* Section headers */
  --_section-size: clamp(1.5rem, 3vw + 0.5rem, 2.5rem);
  /* Pull quotes */
  --_quote-size: clamp(1.25rem, 2.5vw + 0.5rem, 2rem);
  /* Body text */
  --_body-size: clamp(0.95rem, 1vw + 0.5rem, 1.125rem);
  /* Gauge labels */
  --_label-size: var(--font-size-xs);
  
  /* Fonts */
  --_font-display: var(--font-brutalist);
  --_font-prose: var(--font-bureau); /* Spectral */
  --_font-data: var(--font-mono);
}
```

## Page Sections (Top → Bottom)

### SECTION 0: Surface — Parallax Hero (100vh)

**Visual:** 3-4 parallax layers that separate on scroll:
- Layer 1 (background, speed 0.3): Sky/exterior — faded, desaturated cityscape or palace exterior
- Layer 2 (midground, speed 0.6): The entrance to Der Spiegelpalast — arched doorway, mirror fragments
- Layer 3 (foreground, speed 0.9): Archetype title + metadata

**Content:**
```
THE OVERTHROW
Der Spiegelpalast
──── VIII / VIII ────

"Power changes hands. The old order does not die — it metamorphoses."

Authority Fracture: 0 / 100
[gauge: empty]

↓ Descend
```

**CSS:** Layers use `transform: translateY(calc(var(--scroll-y) * <rate>))` driven by IntersectionObserver or scroll event. No scroll-jacking — natural scroll, just visual parallax.

**Overthrow-specific:** Mirror-fragment SVG overlay on Layer 2 that catches light (subtle `mix-blend-mode: screen` animation). Red accent on the arch edges.

### SECTION 1: Threshold — Lore Introduction (auto, ~60vh)

**Transition:** Background begins darkening. A thin red horizontal line (accent divider) marks the boundary.

**Content:**
```
§ THE SPIEGELPALAST

[Entrance text, randomly selected from 5 variants:]
"The descent begins. Not into darkness — into politics. 
 Zamyatin's glass walls. Privacy is not forbidden. 
 It is conceptually abolished."

[2-3 paragraphs of introductory lore, written for the detail page:]

The Overthrow is the eighth and final archetype of Velgarien's 
Resonance Dungeons. Where other archetypes threaten the body 
or the mind, Der Spiegelpalast targets something more fragile: 
political certainty.

Three factions contest this space. None are wrong. None are 
right. The conflict is not between good and evil but between 
three equally valid claims to authority — each willing to 
destroy the others to prove its legitimacy.

The deeper you descend, the more the factions fracture. At the 
surface, Machiavelli's cold clarity governs. By the middle depths, 
Dostoevsky's paranoia has taken hold. At the bottom, only Orwell's 
boot remains — and the terrible question: whose foot is in it?
```

**Layout:** Single column, 65ch max-width, centered. Spectral (serif) font. Generous `line-height: 1.7`. First paragraph has a large drop-cap in accent color.

**Gauge state:** ~10/100 — just beginning to show red.

### SECTION 2: First Quote Break (50vh)

**Visual:** Full-width dark section. Single quote, enormous.

**Content (Overthrow):**
```
"Выходя из безграничной свободы, 
 я заключаю безграничным деспотизмом."

 Starting from unlimited freedom, 
 I conclude with unlimited despotism.

 — Fyodor Dostoevsky, Demons
```

**CSS:** Quote in `--_quote-size` (2rem+), italic Spectral. Original language at full opacity, translation at 0.6 opacity below. Decorative opening quote mark `"` as `::before` (6rem, accent color, opacity 0.1). `text-shadow: 0 0 40px color-mix(in oklch, #d4364b 40%, transparent)`.

**Gauge state:** ~20/100 — Whispers threshold crossed. Label "Whispers" appears briefly.

### SECTION 3: Mechanic Deep Dive (auto, ~80vh)

**Transition:** Background now noticeably darker. Red vignette beginning at edges.

**Layout:** 2-column grid on desktop (gauge visualization left, text right). Single column on mobile.

**Left Column — Gauge Visualization:**
A large, animated SVG/CSS representation of the Authority Fracture mechanic:

```
┌─────────────────────────────┐
│                             │
│   AUTHORITY FRACTURE        │
│                             │
│   ┌─────────────────────┐   │
│   │                     │   │
│   │  0 ──── 100         │   │
│   │  ████████░░░░░░░░░  │   │
│   │       42 / 100      │   │
│   │                     │   │
│   └─────────────────────┘   │
│                             │
│   Court Order    0-19  ──   │
│   Whispers      20-39  ██   │
│   Schism        40-59  ██   │ ← current
│   Revolution    60-79  ░░   │
│   New Regime    80-99  ░░   │
│   Collapse       100   ░░   │
│                             │
└─────────────────────────────┘
```

The gauge animates on scroll-enter (IntersectionObserver triggers fill animation). Thresholds light up sequentially. Each threshold has a 1-line description.

**Right Column — Mechanic Text:**

```
AUTHORITY FRACTURE

The Spiegelpalast's unique resonance mechanic. As you 
descend, political order disintegrates. Factions splinter. 
Alliances dissolve. Every room you enter, every battle 
you fight, every failed negotiation widens the cracks.

FRACTURE GAIN
+4 per room (shallow) → +10 per room (deep)
+2 per combat round
+5 on failed diplomacy

FRACTURE REDUCTION
-5 on rest (brief respite)
-10 on rally (Propagandist ability)
Violence does not restore order.

SPECIAL: RALLY
Cost: 15 stress | Requires: Propagandist 40+
Cooldown: 3 rooms
"Rhetoric is the only weapon that can 
 reassemble what rhetoric destroyed."

CRITICAL APTITUDES
Propagandist ████████████████ 30 (critical)
Spy          ████████████░░░░ 25 (high)
Infiltrator  ██████░░░░░░░░░░ 15 (medium)
Saboteur     █████░░░░░░░░░░░ 12 (medium)
Guardian     ████░░░░░░░░░░░░ 10 (low)
Assassin     ███░░░░░░░░░░░░░  8 (low)
```

**Gauge state:** ~40/100 — Schism threshold. Side gauge widens briefly, "Schism" label appears.

### SECTION 4: Bestiary — Enemy Encounter (auto, ~100vh)

**Transition:** Atmosphere significantly darker. A full-bleed Overthrow artwork (second AI image, deeper dungeon level) spans the transition zone with parallax.

**Layout:** Enemy cards in a grid (2 columns desktop, 1 mobile). Each card:

```
┌─────────────────────────────────────┐
│ FACTION INFORMER                    │
│ Fraktionsspitzel                    │
│ ──────────────────                  │
│ Tier: Minion                        │
│ ┌──────────┐                        │
│ │ PWR: 2   │ STRESS: 4  EVA: 45%  │
│ └──────────┘                        │
│ Ability: DENOUNCE                   │
│                                     │
│ "Havel's greengrocer made operative.│
│  The informer does not believe —    │
│  the informer performs."            │
└─────────────────────────────────────┘
```

Card styling:
- `background: color-mix(in oklch, var(--color-surface-raised) 90%, #d4364b 10%)`
- `border-left: 3px solid #d4364b` (accent thicker for higher tiers)
- Minion: thin border, Standard: medium, Elite: double-line, Boss: pulsing glow
- Hover: `transform: translateY(-2px)`, `box-shadow` intensifies

**Boss Card (The Pretender) — Full Width, Special Treatment:**
```
┌──────────────────────────────────────────────────────┐
│                                                      │
│  ██████████████████████████████████████████████████  │
│                                                      │
│               T H E   P R E T E N D E R              │
│                     Der Prätendent                    │
│                                                      │
│  ──────────────────────────────────────────────────  │
│                                                      │
│  "Milton's Satan made sovereign. The Pretender began  │
│   as a rebel — magnificent, defiant, charismatic.    │
│   Power degraded the vision."                        │
│                                                      │
│  Phase 1: Archangel — impossible eloquence           │
│  Phase 2: Exposed — 'squat like a toad'              │
│  Phase 3: Serpentine — permanent degradation          │
│                                                      │
│  "The Pretender quotes everyone. Especially you."    │
│                                                      │
│  PWR: 5 | STRESS: 9 | EVA: 20%                      │
│  Abilities: RHETORIC · REWRITE                       │
│                                                      │
│  ██████████████████████████████████████████████████  │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Gauge state:** ~55/100 — approaching Revolution.

### SECTION 5: Second Quote Break (50vh)

**Content (Overthrow):**
```
"Ognuno vede quel che tu pari, 
 pochi sentono quel che tu sei."

 Everyone sees what you appear to be, 
 few experience what you really are.

 — Niccolò Machiavelli, The Prince
```

**Visual:** Darker than first quote break. Text glow stronger (accent shadow radius increased). Faint mirror-reflection effect: the quote is subtly reflected below (opacity 0.05, scaleY(-1), gradient mask).

**Gauge state:** ~60/100 — Revolution. Red flash animation on gauge.

### SECTION 6: Encounters & Banter (auto, ~120vh)

**Layout:** Alternating left/right placement. Each encounter is a "scene" with generous vertical spacing.

**Encounter Card Pattern:**
```
┌─────────────────────────────────────────┐
│  ENCOUNTER: SHOW TRIAL                  │
│  Depth 2-5 | Narrative                  │
│  ────────────────────────────           │
│                                         │
│  "Former faction leader tried with      │
│   rewritten biography."                 │
│                                         │
│  CHOICES:                               │
│  ▸ Defend the accused                   │
│    [Propagandist] Difficulty: +5        │
│  ▸ Observe the mechanism                │
│    [Spy] Difficulty: -5                 │
│  ▸ Leave before verdict                 │
│    No check required                    │
│                                         │
└─────────────────────────────────────────┘
```

**Interspersed Banter Lines:**
Between encounter cards, banter lines appear as floating whispers — italic, smaller font, off-center, slightly rotated (1-2deg), accent-colored. Example:

> *"Three factions. Three truths. None of them are lying. This is the problem."*

**Gauge state:** ~70-80/100 — deep into Revolution, approaching New Regime.

### SECTION 7: Literary DNA — The Authors (auto, ~100vh)

**Transition:** We are now in deep darkness. Red vignette strong. This is the intellectual core.

**Header:**
```
THE AUTHORS WHO FORGED THIS PLACE

Der Spiegelpalast draws from the darkest 
tradition in political literature: writers 
who understood that power does not corrupt — 
power reveals.
```

**Layout:** Author cards in a masonry-style grid (3 columns desktop, 1 mobile). Primary influences are larger cards.

**Author Card (Primary — e.g., Orwell):**
```
┌─────────────────────────────────┐
│                                 │
│  GEORGE ORWELL                  │
│  1984 · Animal Farm             │
│  ──────────────────             │
│                                 │
│  Power as perpetual re-seizure. │
│  Doublethink. Newspeak. The     │
│  boot forever. The Overthrow's  │
│  endgame is Orwell's nightmare  │
│  made navigable.                │
│                                 │
│  "Power is not a means;         │
│   it is an end."                │
│                                 │
└─────────────────────────────────┘
```

**Author Card (Secondary — e.g., Havel):**
```
┌─────────────────────┐
│ VÁCLAV HAVEL         │
│ Power of Powerless   │
│ ────────             │
│ Greengrocer's sign.  │
│ Living within the    │
│ lie.                 │
└─────────────────────┘
```

**Gauge state:** ~85/100 — New Regime. Gauge pulsing.

### SECTION 8: Objektanker Showcase (auto, ~80vh)

**Header:** "ARTIFACTS OF THE SPIEGELPALAST"

**Layout:** Horizontal scroll gallery (scroll-snap: x mandatory) or a 2-column grid.

**Objektanker Card:**
```
┌──────────────────────────────────────┐
│  ◆ PROPAGANDA POSTER                 │
│  ────────────────────                │
│                                      │
│  DISCOVERY:                          │
│  "A poster. The message is clear,    │
│   the design effective. It does not  │
│   ask you to agree. It assumes you   │
│   already do."                       │
│                                      │
│  ↓ ECHO → MUTATION → CLIMAX         │
│  (expand to reveal all 4 phases)     │
│                                      │
│  CLIMAX:                             │
│  "The poster is blank. The           │
│   propaganda has moved from paper    │
│   into the air itself."              │
│                                      │
└──────────────────────────────────────┘
```

Each card shows Discovery by default. Click/tap expands to reveal all 4 phases as a vertical progression with connecting lines between phases.

**Gauge state:** ~92/100 — near Collapse.

### SECTION 9: Third Quote — The Final Warning (50vh)

**Content (Overthrow):**
```
"Erst kommt das Fressen, 
 dann kommt die Moral."

 Food is the first thing, 
 morals follow on.

 — Bertolt Brecht, The Threepenny Opera
```

**Visual:** Maximum darkness. Maximum glow. The quote burns.

**Gauge state:** ~97/100.

### SECTION 10: The Abyss — Boss Reveal + CTA (100vh)

**Visual:** Absolute darkness. The Pretender's presence fills the screen.

**Content:**
```
[Full-width dark section, red vignette from all edges]

AUTHORITY FRACTURE: 100 / 100
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

         ☠ COLLAPSE ☠

"The old leader is gone. 
 The new leader enters. 
 Same room. Same desk. 
 Same view from the window."

──────────────────────────────

You survived the reading.
Now survive the dungeon.

[███ ENTER THE SPIEGELPALAST ███]
     (accent glow, pulsing)

← All Archetypes    Share →

──────

← VII · The Awakening
   VIII · The Overthrow (current)
   I · The Shadow →
```

**Gauge state:** 100/100 — full red, pulsing, "COLLAPSE" label.

## Per-Archetype Differenziation (Descent)

| Archetype | Gauge Type | Color Shift | Atmosphere Effect | Boss Reveal |
|-----------|-----------|-------------|-------------------|-------------|
| Shadow | VP (drains 3→0) | Purple vignette closing in | Flicker animation on text | Materializes from darkness |
| Tower | Stability (drains 100→0) | Blue cracks spreading | SVG crack lines intensify | Building collapses around text |
| Mother | Attachment (0→100) | Teal warmth intensifying | Organic border-radius on sections | Warm embrace becomes suffocating |
| Entropy | Decay (0→100) | Gold/brown desaturation | Content progressively sparser | Almost nothing remains |
| Prometheus | Insight (0→100) | Orange glow from below | Ember particles between sections | Erupts from flame |
| Deluge | Water (0→100) | Cyan overlay rising | Wave border animation climbing | Surfaces from beneath water |
| Awakening | Awareness (0→100) | Lavender haze | Blur ↔ focus oscillation | Dream/reality split |
| Overthrow | Fracture (0→100) | Red vignette + mirror effects | Diagonal cuts, propaganda flash | Mirror throne room |

## CSS Animation Architecture

### Scroll-Driven Gauge (Modern CSS)

```css
@keyframes fill-gauge {
  from { height: 0%; background-color: var(--color-text-muted); }
  20%  { background-color: color-mix(in oklch, #d4364b 30%, var(--color-text-muted)); }
  40%  { background-color: color-mix(in oklch, #d4364b 50%, var(--color-text-muted)); }
  60%  { background-color: #d4364b; }
  80%  { background-color: color-mix(in oklch, #d4364b 100%, #ff0000 20%); }
  to   { height: 100%; background-color: #ff1a1a; }
}

.gauge__fill {
  animation: fill-gauge linear;
  animation-timeline: scroll(root);
}
```

### Background Interpolation

```css
@keyframes darken-descent {
  0%   { background-color: var(--_surface-top); }
  20%  { background-color: var(--_surface-threshold); }
  50%  { background-color: var(--_surface-depths); }
  80%  { background-color: var(--_surface-abyss); }
  100% { background-color: var(--_surface-collapse); }
}

:host {
  animation: darken-descent linear;
  animation-timeline: scroll(root);
}
```

### Fallback for Unsupported Browsers

Use IntersectionObserver to detect which section is visible and apply classes:
```css
:host(.depth-0) { background-color: var(--_surface-top); }
:host(.depth-1) { background-color: var(--_surface-threshold); }
/* etc — with CSS transitions for smooth interpolation */
```

## Accessibility

- `prefers-reduced-motion`: Disable parallax, scroll-driven animations, gauge fill. Use static background colors per section instead.
- Gauge has `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-label="Authority Fracture gauge"`.
- All quote `<blockquote>` elements have proper `cite` attributes.
- Section landmarks with `<section aria-label="...">`.
- Skip link to CTA at bottom for keyboard users.
- Contrast ratios verified for all text-on-dark combinations (WCAG AA minimum).

---

# CONCEPT 5 — "THE EXHIBITION" — Full Implementation Spec

## Core Principle

**A curated museum exhibition.** Each full-screen "room" (100vh section with `scroll-snap-type: y mandatory`) showcases exactly one aspect of the archetype. Massive image surfaces. Minimal, perfectly placed museum-text typography. The art speaks first — the explanation follows.

## Visual Architecture

### Scroll-Snap System

```css
:host {
  scroll-snap-type: y mandatory;
  overflow-y: scroll;
  height: 100vh;
}

.room {
  scroll-snap-align: start;
  min-height: 100vh;
  display: grid;
  place-items: center;
  position: relative;
}
```

Each "room" fills the viewport. Scroll-snap creates a discrete, exhibit-by-exhibit experience — like walking through gallery rooms.

### Gallery Lighting System

Each room has a simulated spotlight via `radial-gradient`:

```css
.room::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse at var(--_light-x, 50%) var(--_light-y, 30%),
    transparent 0%,
    rgba(0, 0, 0, 0.3) 40%,
    rgba(0, 0, 0, 0.7) 70%,
    rgba(0, 0, 0, 0.9) 100%
  );
  pointer-events: none;
  z-index: 1;
}
```

Per-archetype light positioning:
- Overthrow: `--_light-x: 50%; --_light-y: 20%` (authoritarian top-down spotlight)
- Shadow: `--_light-x: 50%; --_light-y: 80%` (light from below, horror convention)
- Prometheus: `--_light-x: 50%; --_light-y: 100%` (furnace glow from beneath)
- Deluge: `--_light-x: 30%; --_light-y: 50%` (side light, underwater caustic)

### Typography

```css
:host {
  /* Room titles — monumental */
  --_monument-size: clamp(4rem, 12vw, 10rem);
  --_monument-weight: 900;
  --_monument-tracking: 0.3em;
  
  /* Museum labels — small, precise */
  --_label-size: clamp(0.7rem, 0.8vw + 0.3rem, 0.85rem);
  --_label-tracking: 0.15em;
  --_label-transform: uppercase;
  
  /* Exhibition text — comfortable reading */
  --_exhibit-size: clamp(1rem, 1.2vw + 0.4rem, 1.25rem);
  --_exhibit-leading: 1.8;
  
  /* Quote walls — dramatic */
  --_wall-quote-size: clamp(1.5rem, 3vw + 0.5rem, 3rem);
}
```

### Room Transition Effects

Between rooms, the scroll-snap transition can be enhanced per archetype:

```css
/* Overthrow: Sharp cut with red flash */
.room--overthrow {
  border-bottom: 1px solid color-mix(in oklch, #d4364b 30%, transparent);
}

/* Entropy: Dissolving edge */
.room--entropy {
  mask-image: linear-gradient(to bottom, black 90%, transparent 100%);
}

/* Deluge: Wave border */
.room--deluge {
  border-bottom: none;
  /* SVG wave clip-path */
}
```

## Room Sequence (8 Rooms)

### ROOM 1: "Title Wall" — The Name (100vh)

**Visual:** Pure darkness. Nothing but the name, monumentally scaled.

```
[100vh black screen]

                    THE
                 OVERTHROW

              Der Spiegelpalast
                 VIII / VIII


[Museum label, bottom-left:]
Resonance Archetype VIII
Signature: authority_fracture
```

**CSS:**
```css
.room--title {
  background: #0a0a0f;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.room--title h1 {
  font-family: var(--font-brutalist);
  font-size: var(--_monument-size);
  font-weight: var(--_monument-weight);
  letter-spacing: var(--_monument-tracking);
  text-transform: uppercase;
  color: var(--color-text-primary);
  text-shadow: 0 0 80px color-mix(in oklch, #d4364b 50%, transparent);
}
```

**Entrance animation:** Title fades in over 2s (opacity 0→1), then subtitle fades in 0.5s later. No scroll indicator — the snap-scroll invites naturally.

**Overthrow-specific:** The text-shadow pulses very slowly (4s cycle), simulating political heartbeat. A barely visible mirror-line runs vertically through the center of the screen (opacity 0.03).

### ROOM 2: "The Atmosphere" — Key Art (100vh)

**Visual:** Full-viewport key art (`object-fit: cover`). The AI-generated Overthrow image fills the screen.

**Overlay:** Gallery spotlight gradient (darker edges, brighter center where the focal point is).

**Museum Label (bottom-left, glass panel):**
```
┌─────────────────────────────────────┐
│                                     │
│  "Power changes hands. The old      │
│   order does not die — it           │
│   metamorphoses."                   │
│                                     │
│  ──                                 │
│  Archetype VIII · Der Spiegelpalast │
│  Resonance Signature:               │
│  authority_fracture                 │
│                                     │
└─────────────────────────────────────┘
```

**CSS for museum label:**
```css
.museum-label {
  position: absolute;
  bottom: var(--space-8);
  left: var(--space-8);
  max-width: 400px;
  padding: var(--space-4) var(--space-5);
  background: color-mix(in oklch, var(--color-surface) 80%, transparent);
  backdrop-filter: blur(12px);
  border-left: 2px solid #d4364b;
  font-family: var(--font-bureau);
  font-size: var(--_label-size);
  letter-spacing: var(--_label-tracking);
  color: var(--color-text-secondary);
}

.museum-label blockquote {
  font-size: var(--_exhibit-size);
  font-style: italic;
  color: var(--color-text-primary);
  margin: 0 0 var(--space-3);
}
```

### ROOM 3: "The Voice" — Literary Quotation (100vh)

**Visual:** Black room. Single quote, dramatically lit.

**Content (Overthrow — rotated from the 6 available quotes):**

```
[Centered, enormous text:]

"Power is not a means; it is an end.
 One does not establish a dictatorship
 in order to safeguard a revolution;
 one makes the revolution in order 
 to establish the dictatorship."

                    — George Orwell, 1984
```

**CSS:**
```css
.room--voice {
  background: #0a0a0f;
  padding: var(--space-8);
}

.room--voice blockquote {
  font-family: var(--font-bureau);
  font-size: var(--_wall-quote-size);
  font-style: italic;
  font-weight: 400;
  line-height: 1.5;
  max-width: 75ch;
  text-align: center;
  color: var(--color-text-primary);
  text-shadow: 0 0 60px color-mix(in oklch, #d4364b 30%, transparent);
}

.room--voice cite {
  display: block;
  margin-top: var(--space-6);
  font-family: var(--font-brutalist);
  font-size: var(--_label-size);
  font-style: normal;
  letter-spacing: var(--_label-tracking);
  text-transform: uppercase;
  color: #d4364b;
}
```

**For multilingual quotes:** Original language displayed large, translation appears below at 0.5 opacity, with language label.

**Overthrow-specific:** Subtle "surveillance static" effect — a barely visible CSS noise texture (`background-image: url(noise.svg)`, opacity 0.02) that flickers on entrance.

### ROOM 4: "The Mechanic" — Gauge Exhibition (100vh)

**Visual:** The Authority Fracture mechanic presented as a museum installation.

**Layout:**
```
[Dark room with centered installation:]

┌──────────────────────────────────────────────────┐
│                                                  │
│         A U T H O R I T Y   F R A C T U R E     │
│                                                  │
│         ████████████████████████░░░░░░░░░░░░░░   │
│                    42 / 100                       │
│                                                  │
│   ─────────────────────────────────────────────  │
│                                                  │
│   Court Order ·········· 0-19     Clinical       │
│   Whispers ·············· 20-39    Tension        │
│   Schism ················ 40-59    Fracturing     │
│   Revolution ············ 60-79    Paranoia       │
│   New Regime ············ 80-99    Collapse       │
│                                                  │
│   ─────────────────────────────────────────────  │
│                                                  │
│   Gain: +4/room (shallow) → +10/room (deep)     │
│   Rally: -10 fracture (Propagandist, 15 stress)  │
│   "Violence does not restore order."             │
│                                                  │
└──────────────────────────────────────────────────┘

[Museum label, bottom-right:]
┌──────────────────────────────────┐
│ The deeper you descend, the more │
│ the factions fracture. At 100:   │
│ total collapse. Power vacuum.    │
│ Party wipe.                      │
└──────────────────────────────────┘
```

**Animation:** The gauge fills on room-enter (IntersectionObserver triggers animation). Each threshold lights up in sequence (0→20→40→60→80→100) over 3 seconds.

**Aptitude Chart:** SVG radar chart showing the 6 aptitude weights, filled in accent color with glow.

### ROOM 5: "The Bestiary" — Enemy Gallery (100vh, horizontal overflow)

**Visual:** Dark room. Enemies displayed as portraits in frames, horizontal scroll gallery.

**Layout:** `display: flex; overflow-x: scroll; scroll-snap-type: x mandatory;`

Each enemy is a "framed portrait":

```
┌─────────────────────┐
│  ╔═════════════════╗ │
│  ║                 ║ │
│  ║   [Enemy Art    ║ │
│  ║    Placeholder] ║ │
│  ║                 ║ │
│  ╚═════════════════╝ │
│                      │
│  PROPAGANDA AGENT    │
│  Propagandaagent     │
│  ──────────          │
│  Standard · PWR 3    │
│                      │
│  "Orwell's Squealer  │
│   on two legs."      │
│                      │
│  Ability: REWRITE    │
│                      │
└─────────────────────┘
```

**Frame styling:**
```css
.enemy-frame {
  min-width: 300px;
  max-width: 360px;
  scroll-snap-align: center;
  padding: var(--space-6);
  background: color-mix(in oklch, var(--color-surface-raised) 95%, #d4364b 5%);
  border: 1px solid color-mix(in oklch, #d4364b 20%, transparent);
}

.enemy-frame--boss {
  min-width: 400px;
  border: 2px solid #d4364b;
  box-shadow: 0 0 40px color-mix(in oklch, #d4364b 30%, transparent);
}
```

**Boss (The Pretender):** Last frame, wider, gold/red double border, pulsing glow. Description reveals the Milton's Satan three-phase cycle.

**Gallery indicator:** Dot navigation below (like the DungeonShowcase slider).

### ROOM 6: "The Literary Wall" — Authors & Influences (100vh+)

**Visual:** Second artwork as background (deeper dungeon level, 40% opacity). Literary DNA overlaid.

**Layout:**
```
[Background: second Overthrow artwork, darkened]

[Centered header:]
THE AUTHORS WHO FORGED THIS PLACE

[Large quote in original language:]
"Erst kommt das Fressen, 
 dann kommt die Moral."
                — Bertolt Brecht

[Below: Author grid (3 columns desktop, 1 mobile)]

┌────────────┐ ┌────────────┐ ┌────────────┐
│ ORWELL     │ │ DOSTOEVSKY │ │ MACHIAVELLI│
│ 1984       │ │ Demons     │ │ The Prince │
│ ────       │ │ ────       │ │ ────       │
│ Power as   │ │ Revolution │ │ Realpolitik│
│ re-seizure │ │ as cell    │ │ Fox & lion │
└────────────┘ └────────────┘ └────────────┘
┌────────────┐ ┌────────────┐ ┌────────────┐
│ ARENDT     │ │ KOESTLER   │ │ BRECHT     │
│ Banality   │ │ Darkness   │ │ Epic       │
│ ────       │ │ ────       │ │ ────       │
│ Fact/fic   │ │ Logic of   │ │ Alienation │
│ collapse   │ │ confession │ │ effect     │
└────────────┘ └────────────┘ └────────────┘
```

**Hover/tap on author card:** Expands to show key quote and specific influence on the Overthrow's prose/encounter design.

**This room may exceed 100vh** — that's OK. `scroll-snap-align: start` on this room, and `min-height: 100vh` (not fixed). The grid can grow.

### ROOM 7: "The Encounter" — Live Preview (100vh)

**Visual:** A simulated dungeon encounter, styled like the actual in-game UI but as a static preview.

**Content:** One narrative encounter (e.g., "Show Trial") rendered as it would appear in-game:

```
┌──────────────────────────────────────────┐
│                                          │
│  ═══ THE SPIEGELPALAST · DEPTH 3 ═══   │
│                                          │
│  Authority Fracture: ████████░░ 47/100  │
│                                          │
│  ──────────────────────────────────────  │
│                                          │
│  A tribunal. The accused was a faction   │
│  leader — yesterday. The biography has   │
│  been rewritten. The new version is      │
│  more convincing than memory.            │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ ▸ Defend the accused              │  │
│  │   [Propagandist] +5 difficulty    │  │
│  ├────────────────────────────────────┤  │
│  │ ▸ Observe the mechanism           │  │
│  │   [Spy] -5 difficulty             │  │
│  ├────────────────────────────────────┤  │
│  │ ▸ Leave before verdict            │  │
│  │   No check required               │  │
│  └────────────────────────────────────┘  │
│                                          │
│  "The party can never be mistaken."      │
│                                          │
└──────────────────────────────────────────┘

[Museum label below:]
"This is a preview. Actual encounters 
 feature procedural variation, agent 
 personality responses, and dynamic 
 consequences based on fracture level."
```

**Styling:** Uses the game's actual dark UI styling (monospace headers, dark cards) but framed within the exhibition context. Not interactive — choices are display-only.

### ROOM 8: "The Vault" — Objektanker & Loot (auto, ≥100vh)

**Visual:** Dark room with glass display cases (glassmorphism cards).

**Layout:** 2 sections:

**A. Objektanker (Vitrine-Style Cards):**
```
┌─────────────────────────────────────┐
│  ◆ SCALES OF JUSTICE               │
│  ───────────────────                │
│                                     │
│  "Balanced scales. Both pans empty. │
│   The balance is perfect because    │
│   nothing is being weighed."        │
│                                     │
│  4 Phases: Discovery → Echo →       │
│  Mutation → Climax                  │
│  [Expand to see full progression]   │
│                                     │
│  backdrop-filter: blur(16px)        │
│  border: 1px solid rgba(212,54,75,  │
│  0.2)                               │
│  box-shadow: inset glow             │
└─────────────────────────────────────┘
```

**B. Loot Showcase (3-Tier Display):**

Tier 1, 2, 3 loot grouped with tier badges. Each item shows name, effect, and the literary description.

### EXIT: Navigation + CTA (50vh)

```
[Dark room, red accent glow]

"You survived the exhibition.
 Now survive the dungeon."

[███ ENTER THE SPIEGELPALAST ███]

──────────

← VII · The Awakening  |  I · The Shadow →

[Back to All Archetypes]
```

## Per-Archetype Differentiation (Exhibition)

| Archetype | Room BG | Light Position | Frame Style | Transition |
|-----------|---------|---------------|-------------|------------|
| Shadow | Deep purple-black | From below (horror) | Smoky/blurred edges | Fade to black |
| Tower | Blue-black | From above (institutional) | Sharp geometric | Vertical slide |
| Mother | Teal-black | Warm diffuse center | Organic rounded | Soft dissolve |
| Entropy | Gold-brown-black | Fading, off-center | Fragmented/broken | Grain dissolve |
| Prometheus | Orange-black | From below (furnace) | Ember-edged glow | Flash transition |
| Deluge | Cyan-black | Side-light (underwater) | Wave-edged | Ripple wipe |
| Awakening | Lavender-black | Pulsing center | Blurred/dreamy | Focus shift |
| Overthrow | Red-black | Top-down (authoritarian) | Sharp diagonal cuts | Hard cut + red flash |

## Accessibility

- `scroll-snap-type: y mandatory` respects `prefers-reduced-motion` by falling back to `scroll-snap-type: y proximity`
- All images have descriptive `alt` text
- Horizontal scroll galleries have `role="listbox"` with `aria-label`
- Gallery keyboard navigation: Arrow keys move between items
- Museum labels meet WCAG AA contrast on glassmorphism backgrounds
- Skip links: "Skip to next room" for keyboard users
- `<section role="region" aria-label="Room: The Voice">` for each room

---

# SHARED INFRASTRUCTURE

## Data Layer: `dungeon-detail-data.ts`

Extends `dungeon-showcase-data.ts` with per-archetype detail content:

```typescript
export interface ArchetypeDetail extends ArchetypeSlide {
  // Extended lore
  readonly loreIntro: string[];           // 3-4 paragraphs
  readonly entranceTexts: string[];       // 5 random variants
  
  // Mechanic
  readonly mechanicName: string;          // "Authority Fracture"
  readonly mechanicDescription: string;   // Full explanation
  readonly mechanicGauge: GaugeConfig;    // Start, max, thresholds, labels
  readonly aptitudeWeights: Record<string, number>;
  
  // Bestiary
  readonly enemies: EnemyPreview[];       // 5 entries (minion→boss)
  
  // Encounters
  readonly encounterPreviews: EncounterPreview[];  // 3-4 selected
  
  // Banter
  readonly banterSamples: BanterLine[];   // 8-10 selected lines
  
  // Literary DNA
  readonly authors: AuthorCard[];         // 6-8 primary + secondary
  
  // Objektanker
  readonly objektanker: ObjektankerPreview[];  // 4-8 objects
  
  // Loot
  readonly lootShowcase: LootPreview[];   // Selected items per tier
  
  // Navigation
  readonly prevArchetype: { id: string; name: string; numeral: string };
  readonly nextArchetype: { id: string; name: string; numeral: string };
}
```

## Component Architecture (as implemented)

```
frontend/src/components/archetypes/
├── ArchetypeDetailView.ts          — Hybrid Descent+Exhibition layout (single component, no layout switching)
├── dungeon-detail-data.ts          — Extended content per archetype (types + full Overthrow data)
├── shared/
│   ├── archetype-detail-styles.ts  — Shared CSS: detailTokenStyles, detailRoomStyles, detailCardStyles
│   ├── QuoteWall.ts                — Full-screen quote with original-language support
│   ├── EnemyCard.ts                — Enemy portrait card (tier-aware: minion/standard/elite/boss)
│   ├── EncounterCard.ts            — Narrative encounter with choices
│   ├── AuthorCard.ts               — Literary influence card (primary/secondary)
│   ├── ObjektankerCard.ts          — 4-phase expandable vitrine
│   └── LootCard.ts                 — Loot item with tier glow
```

**Decision: No layout switching.** The spec proposed separate DescentLayout/ExhibitionLayout components. Implementation merges both into a single `ArchetypeDetailView.ts` that combines Exhibition rooms (scroll-snap) with Descent elements (scroll-driven gauge, background darkening, parallax). Simpler architecture, no user-facing layout picker.

**Decision: No ArchetypeGauge sub-component.** The gauge is CSS-only (`animation-timeline: scroll(root)`) and small enough to live in the main component. No separate component needed.

## Implementation Order (as executed)

1. Data layer (`dungeon-detail-data.ts`) — types + Overthrow content
2. Shared styles (`archetype-detail-styles.ts`) — tokens, room structure, card patterns
3. Sub-components — QuoteWall, EnemyCard, AuthorCard, EncounterCard, ObjektankerCard, LootCard
4. Main view (`ArchetypeDetailView.ts`) — hybrid layout with all rooms
5. Route registration (`/archetypes/:id` in `app-shell.ts`)
6. Image generation + upload (6 images via OpenRouter GPT-5 Image)
7. Design refinement — literary/editorial tone, softened typography

## Image Requirements (as implemented)

Each archetype needs **6 AI-generated images** in Supabase Storage:

```
simulation.assets/showcase/
├── dungeon-overthrow.avif            — Hero (16:9, regenerated for detail page)
├── dungeon-overthrow-depth.avif      — Koestler interrogation corridor
├── dungeon-overthrow-boss.avif       — Bacon's Pretender throne room
├── dungeon-overthrow-whispers.avif   — Hammershøi marble corridor (banter bg, early)
└── dungeon-overthrow-revolution.avif — Kiefer assembly hall in ruins (banter bg, late)
```

Image model: `openai/gpt-5-image` via OpenRouter. Prompts reference specific paintings/artists (Hammershøi, Kiefer, Bacon, El Lissitzky) rather than generic descriptions. All 16:9, 2K, AVIF-converted.

Image placement:

| Room | Image | Opacity |
|------|-------|---------|
| 1 Title | none | Pure darkness |
| 2 Atmosphere | Hero | 70% fullscreen |
| 2.5 Lore Intro | none | Spotlight only |
| 3 Voice (Quote 1) | none | Abyss black |
| 4 Mechanic | none | Spotlight only |
| 5 Bestiary | Depth | 22% parallax |
| Quote Break (Machiavelli) | none | Abyss black |
| 7 Encounters | none | Spotlight only |
| Banter 1 (Court Order) | Whispers | 25% parallax |
| 6 Literary Wall | Depth | 15% parallax |
| Banter 2 (Revolution) | Revolution | 25% parallax |
| 8 Vault | none | Spotlight only |
| Quote Break (Brecht) | none | Abyss black |
| 9 Exit | Boss | 25% parallax |

---

## Open Questions for Review

1. **Layout Switcher:** Should users be able to switch between Descent/Exhibition/etc. layouts? Or is one layout chosen per archetype?
2. **Content Language:** Detail pages in English only, or bilingual (EN/DE) with `msg()` i18n?
3. **Additional AI Images:** Generate 2-3 images per archetype now, or reuse hero images initially?
4. **Encounter Spoiler Policy:** How much encounter detail is acceptable on a public detail page?
5. **Boss Images:** Generate boss portraits, or keep the boss reveal text-only for mystery?

---

# APPENDIX A — CSS Scroll-Driven Animations Reference

## Browser Support (April 2026)

| Browser | `animation-timeline` | `scroll()` | `view()` | `scrollsnapchange` |
|---------|---------------------|------------|----------|---------------------|
| Chrome/Edge | 115+ | 115+ | 115+ | 129+ |
| Safari/iOS | 26+ | 26+ | 26+ | Not yet |
| Firefox | Behind flag | Behind flag | Behind flag | Not yet |
| **Global** | **~83%** | **~83%** | **~83%** | **~70%** |

## Core Pattern: Scroll Progress Timeline

```css
/* Declaration order matters: animation-timeline MUST come AFTER animation shorthand */
.element {
  animation: my-animation linear both;    /* 1. shorthand first */
  animation-timeline: scroll(root block); /* 2. timeline after */
}

/* Duration is implicitly 'auto' — scroll position controls progress */
```

## Gauge Fill (Scroll-Linked Progress Bar)

```css
@keyframes grow-progress {
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
}

.progress-bar {
  position: fixed;
  top: 0; left: 0;
  width: 100%;
  height: 4px;
  background: var(--accent);
  transform-origin: 0 50%;
  z-index: 9999;
  animation: grow-progress linear;
  animation-timeline: scroll(root block);
}
```

## View Timeline: Element Reveal on Viewport Entry

```css
@keyframes reveal {
  from { opacity: 0; transform: translateY(2rem); }
  to   { opacity: 1; transform: translateY(0); }
}

.card {
  animation: reveal linear both;
  animation-timeline: view();
  animation-range: entry 0% entry 80%;
}
```

## Named View Timelines (Cross-Tree References)

For nav dots that activate based on which section is visible:

```css
#section-1 { view-timeline: --section-1 block; }
#section-2 { view-timeline: --section-2 block; }

/* Ancestor declares scope for cross-tree access */
body { timeline-scope: --section-1, --section-2; }

.nav-dot:nth-child(1) {
  animation: dot-active linear both;
  animation-timeline: --section-1;
}
```

## animation-range Keywords

| Range | Meaning |
|-------|---------|
| `cover` | Full range: first pixel entering → last pixel exiting |
| `entry` | Element entering the scrollport |
| `exit` | Element leaving the scrollport |
| `contain` | Element fully inside the scrollport |

```css
/* Animate only during entry phase */
animation-range: entry;

/* Animate from 25% into entry to 50% of cover */
animation-range: entry 25% cover 50%;
```

## Combined Entry + Exit Animation

```css
@keyframes animate-in-and-out {
  entry 0%   { opacity: 0; transform: translateY(100%); }
  entry 100% { opacity: 1; transform: translateY(0); }
  exit 0%    { opacity: 1; transform: translateY(0); }
  exit 100%  { opacity: 0; transform: translateY(-100%); }
}

.element {
  animation: animate-in-and-out linear both;
  animation-timeline: view();
}
```

## Scroll-Linked Custom Property (Hue Rotation)

```css
@property --hue {
  syntax: '<angle>';
  initial-value: 0turn;
  inherits: false;
}

@keyframes hue-cycle {
  to { --hue: 1turn; }
}

:root {
  animation: hue-cycle linear both;
  animation-timeline: scroll(root);
  --surface: oklch(40% 50% var(--hue));
}
```

## JS API (Web Animations)

```js
const tl = new ScrollTimeline({ source: document.documentElement, axis: 'block' });
element.animate({ opacity: [0, 1] }, { timeline: tl });
```

## Critical Gotchas

1. **Declaration order:** `animation-timeline` AFTER `animation` shorthand (shorthand resets longhands)
2. **Duration = auto:** Scroll progress controls duration, not clock time
3. **Use `linear` easing:** Other easings compound with scroll velocity
4. **`animation-fill-mode: both`:** Required for bidirectional scroll
5. **Ranges use untransformed boxes:** CSS transforms don't affect range calculation
6. **Shadow DOM:** Named timelines may need `timeline-scope` on ancestor to cross shadow boundaries

## CSS-Only Parallax (Keith Clark Technique)

```css
.parallax-container {
  height: 100vh;
  overflow-x: hidden;
  overflow-y: auto;
  perspective: 1px;
  perspective-origin: 0 0;
}

.parallax-layer--back {
  transform-origin: 0 0;
  transform: translateZ(-1px) scale(2);
  /* scale = (perspective - translateZ) / perspective */
}

.parallax-layer--deep {
  transform-origin: 0 0;
  transform: translateZ(-2px) scale(3);
}
```

**WARNING:** Creates new containing block — breaks `position: fixed` children. Cannot use `overflow: hidden` on group elements. Per CLAUDE.md: never apply `perspective` on layout containers (shells, views, panels).

## Modern CSS-Only Parallax (2026, No Perspective Hack)

```css
@keyframes parallax-shift {
  from { transform: translateY(-20%); }
  to   { transform: translateY(20%); }
}

.parallax-bg {
  animation: parallax-shift linear both;
  animation-timeline: view();
  animation-range: cover;
  will-change: transform;
}
```

**This is the preferred approach** — no perspective hacks, no JS, compositor-thread only.

## JS Fallback (IntersectionObserver + rAF)

```js
class ParallaxController {
  #observer; #raf = null;
  constructor(elements, speed = 0.3) {
    this.elements = elements;
    this.speed = speed;
    this.#observer = new IntersectionObserver(
      (entries) => entries.forEach(e => e.isIntersecting
        ? this.#start(e.target) : this.#stop()),
      { threshold: 0 }
    );
    elements.forEach(el => this.#observer.observe(el));
  }
  #start(el) {
    const update = () => {
      const offset = el.getBoundingClientRect().top * this.speed;
      el.style.transform = `translate3d(0, ${offset}px, 0)`;
      this.#raf = requestAnimationFrame(update);
    };
    update();
  }
  #stop() { if (this.#raf) { cancelAnimationFrame(this.#raf); this.#raf = null; } }
  destroy() { this.#observer.disconnect(); this.#stop(); }
}
```

## Performance Rules

| Technique | Thread | JS | Layout Thrash |
|-----------|--------|-----|--------------|
| `animation-timeline: scroll()/view()` | Compositor | None | None |
| Keith Clark perspective parallax | Compositor | None | None |
| IntersectionObserver + rAF + transform | Main→Compositor | Minimal | Low |
| scroll event + transform | Main | Yes | Low (passive) |
| scroll event + top/margin | Main | Yes | **HIGH — avoid** |

---

# APPENDIX B — Scroll-Snap Best Practices

## mandatory vs proximity

| | mandatory | proximity |
|---|---|---|
| Use when | Every child fits viewport | Variable-height content |
| Risk | Traps user if child > viewport | None |

**Rule:** Use `proximity` for vertical sections, `mandatory` for horizontal carousels with fixed-size items.

```css
/* Safe vertical section snapping */
.page {
  scroll-snap-type: y proximity;
  scroll-padding-top: 80px; /* account for sticky header */
}

section {
  scroll-snap-align: start;
  min-height: 100vh;
}
```

## Detecting Active Snap Section

### Modern (Chrome 129+): scrollsnapchange event

```js
scroller.addEventListener('scrollsnapchange', (event) => {
  const idx = [...scroller.children].indexOf(event.snapTargetBlock);
  dots.forEach((dot, i) => dot.classList.toggle('active', i === idx));
});
```

### Fallback: IntersectionObserver

```js
const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) onActive(entry.target);
    }
  },
  { root: container, rootMargin: '-50% 0px -50% 0px', threshold: 0 }
);
sections.forEach(s => observer.observe(s));
```

## Keyboard & Accessibility

- `scroll-padding` affects PageUp/PageDown/Space
- `scroll-snap-stop: always` forces stop at each item (important for keyboard/AT)
- Tab navigation and `scrollIntoView()` respect snap alignment

## prefers-reduced-motion (No-Motion-First Pattern)

```css
/* Base: no animation, content visible */
.card { opacity: 1; transform: none; }

@media (prefers-reduced-motion: no-preference) {
  @supports (animation-timeline: view()) {
    .card {
      animation: reveal linear both;
      animation-timeline: view();
      animation-range: entry;
    }
  }
}
```

---

# APPENDIX C — Gallery Lighting, Glassmorphism & Dark UI Patterns

## Gallery Spotlight (Radial Gradient)

```css
/* Static museum spotlight */
.room::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse at var(--_light-x, 50%) var(--_light-y, 30%),
    transparent 0%,
    rgba(0, 0, 0, 0.3) 40%,
    rgba(0, 0, 0, 0.7) 70%,
    rgba(0, 0, 0, 0.9) 100%
  );
  pointer-events: none;
  z-index: 1;
}

/* Per-archetype light positioning */
.room--overthrow  { --_light-x: 50%; --_light-y: 20%; } /* top-down authoritarian */
.room--shadow     { --_light-x: 50%; --_light-y: 80%; } /* from below, horror */
.room--prometheus  { --_light-x: 50%; --_light-y: 100%; } /* furnace glow */
.room--deluge     { --_light-x: 30%; --_light-y: 50%; } /* side light, underwater */
```

## Vignette (Viewport Edge Darkening)

```css
.vignette::after {
  content: '';
  position: fixed;
  inset: 0;
  background: radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.7) 100%);
  pointer-events: none;
  z-index: 999;
}
```

## Text Glow (Professional, Multi-Layer)

```css
/* Subtle — headings on dark bg */
.subtle-glow {
  text-shadow:
    0 0 4px rgba(255, 255, 255, 0.15),
    0 0 12px color-mix(in oklch, var(--accent) 30%, transparent),
    0 0 28px color-mix(in oklch, var(--accent) 15%, transparent);
}

/* Accent — dramatic quotes */
.accent-glow {
  text-shadow:
    0 0 7px #fff,
    0 0 10px #fff,
    0 0 21px #fff,
    0 0 42px var(--accent),
    0 0 82px var(--accent);
}

/* ANTI-PATTERN: single large shadow = cheesy */
/* text-shadow: 0 0 40px #0ff; — DON'T */
```

## Glassmorphism Production Recipe

```css
.glass-card {
  background: rgba(255, 255, 255, 0.06);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3),
              inset 0 1px 0 rgba(255, 255, 255, 0.08);
  border-radius: 12px;
}

/* Fallback */
@supports not (backdrop-filter: blur(12px)) {
  .glass-card {
    background: rgba(30, 30, 30, 0.95);
  }
}
```

**Performance:** Max 2-3 glassmorphic elements per viewport on mobile. Reduce blur to 6-8px on mobile. Never animate elements with `backdrop-filter`. Creates new stacking context (breaks `position: fixed` children — CLAUDE.md rule).

## color-mix() Palette from Accent

```css
:root {
  --accent: #d4364b; /* Overthrow red */
  
  /* Tints */
  --accent-light: color-mix(in oklch, var(--accent) 40%, white);
  --accent-subtle: color-mix(in oklch, var(--accent) 15%, var(--color-surface));
  
  /* Shades */
  --accent-dark: color-mix(in oklch, var(--accent) 60%, black);
  
  /* Surface tinting */
  --surface-tinted: color-mix(in oklch, var(--accent) 5%, var(--color-surface));
  --border-accent: color-mix(in oklch, var(--accent) 20%, transparent);
}
```

## Museum-Label Typography

```css
.museum-label {
  font-family: var(--font-bureau); /* Spectral */
  font-size: clamp(0.7rem, 0.8vw + 0.3rem, 0.85rem);
  line-height: 1.5;
  letter-spacing: 0.02em;
}

.museum-label__category {
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.625rem;
  font-weight: 600;
  font-variant-caps: small-caps;
}

.museum-label__title {
  font-size: 1.125rem;
  font-weight: 500;
  letter-spacing: 0.01em;
}

.museum-label__body {
  max-width: 45ch; /* Optimal caption line length */
  line-height: 1.65;
}
```

## Dark UI Borders & Dividers

```css
/* Subtle structural divider */
.divider { border-top: 1px solid rgba(255, 255, 255, 0.06); }

/* Accent-tinted divider */
.divider-accent { border-top: 1px solid color-mix(in oklch, var(--accent) 15%, transparent); }

/* Gradient fade divider */
.divider-gradient {
  height: 1px;
  background: linear-gradient(to right, transparent, rgba(255,255,255,0.12) 20%, rgba(255,255,255,0.12) 80%, transparent);
}
```

## Dark Surface Elevation

```css
:root {
  --surface-0: #0a0a0a;  /* Deepest — NOT pure black */
  --surface-1: #121212;  /* Primary surface */
  --surface-2: #1e1e1e;  /* Elevated cards */
  --surface-3: #252525;  /* Modals */
  
  /* Or tinted from accent: */
  --surface-1-tinted: color-mix(in oklch, var(--accent) 3%, #121212);
  --surface-2-tinted: color-mix(in oklch, var(--accent) 5%, #1e1e1e);
}
```

## Horizontal Scroll Gallery (Inside Vertical Page)

```css
.gallery-track {
  display: flex;
  gap: 1rem;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-snap-type: x mandatory;
  scroll-padding-inline: 1rem;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-x: contain; /* Prevent scroll chaining to page */
  touch-action: pan-x; /* Hint: horizontal gestures only */
}

.gallery-item {
  flex: 0 0 auto;
  width: 80%;
  scroll-snap-align: center;
  scroll-snap-stop: always; /* Prevent skipping on fast swipe */
}
```

---

# APPENDIX D — Complete Fallback Strategy

Three-layer progressive enhancement for all scroll-driven features:

```css
/* === Layer 1: Base (works everywhere, no animation) === */
.animated-card { opacity: 1; transform: none; }
.progress-bar { transform: scaleX(0); }

/* === Layer 2: Motion-safe + scroll-driven supported === */
@media (prefers-reduced-motion: no-preference) {
  @supports (animation-timeline: view()) {
    .animated-card {
      animation: card-reveal linear both;
      animation-timeline: view();
      animation-range: entry 0% entry 80%;
    }
    .progress-bar {
      animation: grow-progress linear;
      animation-timeline: scroll(root block);
    }
  }
}

/* === Layer 3: Reduced motion — static === */
@media (prefers-reduced-motion: reduce) {
  .animated-card { opacity: 1; transform: none; }
}
```

```js
/* === Layer 4: JS fallback for unsupported browsers === */
if (!CSS.supports('animation-timeline', 'view()')) {
  // IntersectionObserver for card reveals
  const obs = new IntersectionObserver(
    (entries) => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); }
    }),
    { threshold: 0.1 }
  );
  document.querySelectorAll('.animated-card').forEach(c => {
    c.classList.add('needs-js-reveal');
    obs.observe(c);
  });
  
  // Scroll listener for progress bar (passive!)
  const bar = document.getElementById('progress-bar');
  if (bar) {
    window.addEventListener('scroll', () => {
      const frac = scrollY / (document.documentElement.scrollHeight - innerHeight);
      bar.style.transform = `scaleX(${frac})`;
    }, { passive: true });
  }
}
```

---

# APPENDIX E — Key Reference Links

- [Bramus: scroll-driven-animations.style](https://scroll-driven-animations.style/) — Interactive visualizer + 10 demos
- [Chrome DevRel: Scroll-Driven Animations Video Course](https://developer.chrome.com/blog/scroll-driven-animations-video-course) — 10-part course
- [MDN: CSS Scroll-Driven Animations](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll-driven_animations)
- [WebKit: Guide to Scroll-Driven Animations](https://webkit.org/blog/17101/a-guide-to-scroll-driven-animations-with-just-css/)
- [Keith Clark: Pure CSS Parallax](https://keithclark.co.uk/articles/pure-css-parallax-websites/)
- [Josh Comeau: Next-Level Frosted Glass](https://www.joshwcomeau.com/css/backdrop-filter/)
- [Evil Martians: OKLCH in CSS](https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl)
- [Ahmad Shadeed: CSS Scroll Snap](https://ishadeed.com/article/css-scroll-snap/)
- [Tatiana Mac: No-Motion-First Approach](https://www.tatianamac.com/posts/prefers-reduced-motion)
- [Codrops: Practical Scroll-Driven Animations](https://tympanus.net/codrops/2024/01/17/a-practical-introduction-to-scroll-driven-animations-with-css-scroll-and-view/)
- [Chrome DevRel: Scroll Snap Events](https://developer.chrome.com/blog/scroll-snap-events)
- [Butterick: Letterspacing](https://practicaltypography.com/letterspacing.html)
- [CSS-Tricks: Practical CSS Scroll Snapping](https://css-tricks.com/practical-css-scroll-snapping/)
- [Frontend Masters: CSS Spotlight Effect](https://frontendmasters.com/blog/css-spotlight-effect/)
- [flackr/scroll-timeline Polyfill](https://github.com/flackr/scroll-timeline) — Only if scroll animations are functionally critical
- [Chrome: Carousels with CSS (::scroll-marker)](https://developer.chrome.com/blog/carousels-with-css) — Chrome 135+ only, progressive enhancement
- [Chrome: CSS Names in Shadow DOM](https://developer.chrome.com/docs/css-ui/css-names) — Tree-scoped name audit
- [CSSWG #8192: Flat-tree lookup for scroll timelines](https://github.com/w3c/csswg-drafts/issues/8192) — Resolved: flat tree
- [CSSWG #10808: global() proposal for breaking name encapsulation](https://github.com/w3c/csswg-drafts/issues/10808) — Open proposal

---

# APPENDIX F — Shadow DOM + Scroll-Driven Animations (Lit 3)

## Critical Finding

**Anonymous timelines work perfectly in Shadow DOM. Named timelines do NOT reliably cross shadow boundaries.**

The CSS spec operates over the **flattened element tree** for `scroll()` and `view()` lookups (CSSWG #8192, resolved March 2023). This means an element inside a Lit component's shadow root will correctly find scrollers in the light DOM.

## Decision Table

| Scenario | Works? | Approach |
|----------|--------|----------|
| `scroll(nearest)` — scroller is ancestor in light DOM | **YES** | CSS only |
| `scroll(root)` — document scroller | **YES** | CSS only |
| `view()` — element in shadow, scrollport in light DOM | **YES** | CSS only |
| Named timeline in light DOM, used in shadow | **UNRELIABLE** | JS `ScrollTimeline` API |
| `timeline-scope` across shadow boundary | **NO** (by spec) | JS API |
| `timeline-scope` within same shadow root | **YES** | CSS only |

## Recommended Pattern for Lit Components

### CSS-Only (for all our detail page needs)

All our scroll-driven animations use anonymous timelines — the gauge tracks `scroll(root)`, cards reveal on `view()`. These work from inside shadow DOM with zero issues:

```ts
@customElement('velg-archetype-detail')
export class ArchetypeDetail extends LitElement {
  static styles = css`
    /* Gauge fill — tracks document scroll. WORKS in Shadow DOM. */
    .gauge__fill {
      animation: fill-gauge linear both;
      animation-timeline: scroll(root block);
    }
    
    /* Card reveal on viewport entry. WORKS in Shadow DOM. */
    .room__content {
      animation: reveal linear both;
      animation-timeline: view();
      animation-range: entry 0% entry 80%;
    }
    
    /* Parallax background. WORKS in Shadow DOM. */
    .parallax-bg {
      animation: parallax-shift linear both;
      animation-timeline: view();
      animation-range: cover;
    }
  `;
}
```

### JS API Fallback (only if we ever need named cross-boundary timelines)

```ts
firstUpdated() {
  const scroller = document.documentElement;
  const timeline = new ScrollTimeline({ source: scroller, axis: 'block' });
  
  const gauge = this.renderRoot.querySelector('.gauge__fill');
  gauge?.animate(
    [{ height: '0%' }, { height: '100%' }],
    { timeline, fill: 'both' }
  );
}

disconnectedCallback() {
  super.disconnectedCallback();
  // Clean up animations if stored
  this._animations?.forEach(a => a.cancel());
}
```

## Gotchas Specific to Lit

1. **No lifecycle interference:** Lit's reactive update cycle does NOT disturb active scroll-driven animations
2. **Use `firstUpdated()`** for one-time JS ScrollTimeline setup (shadow DOM fully rendered)
3. **CSS-only animations in `static styles`** need zero lifecycle management — auto-activate on connect
4. **`disconnectedCallback()`** should cancel stored JS animation references
5. **Named CSS timelines between Lit components** (e.g., a gauge component reading a scroller component's timeline) → use JS API with explicit element references, not CSS names

## Impact on Our Implementation

**No architectural changes needed.** Our hybrid Descent+Exhibition layout uses:
- `scroll(root)` for the gauge → **works in shadow DOM** ✓
- `view()` for card reveals → **works in shadow DOM** ✓
- `view()` for parallax backgrounds → **works in shadow DOM** ✓
- No named timelines crossing component boundaries

The only place we *might* use named timelines is `timeline-scope` WITHIN the same component's shadow root (e.g., linking a non-ancestor gauge to a scroll container inside the component). This also works fine.

---

# APPENDIX G — Implementation Log (2026-04-06/07)

## Decisions That Diverged from Spec

### 1. Single Component vs. Layout Variants
**Spec:** Separate `DescentLayout.ts`, `ExhibitionLayout.ts` with a shell that picks the layout.
**Implemented:** Single `ArchetypeDetailView.ts` that merges both concepts. No layout switcher. The hybrid approach is the layout.
**Reason:** Adding a layout switcher adds complexity with no user benefit at this stage. One well-executed hybrid is better than two mediocre separate layouts.

### 2. Design Language: Editorial, Not Terminal
**Spec:** Used `--font-brutalist` (Courier) for section headers, labels, navigation, tier badges.
**Implemented:** Spectral (serif) dominates everything. Courier only for the monumental title (`OVERTHROW`) and the CTA button.
**Reason:** User feedback: "Das ist ja kein science fiction Bedienelement." The page is a literary exhibition, not a cockpit. Uppercase monospace labels made the page feel like a terminal UI.

### 3. Room Sequence Differs from Spec
**Spec (Descent):** Surface → Threshold → Quote 1 → Mechanic → Bestiary → Quote 2 → Encounters → Literary → Objektanker → Quote 3 → Boss.
**Spec (Exhibition):** Title → Atmosphere → Voice → Mechanic → Bestiary → Literary → Encounter → Vault → Exit.
**Implemented (Hybrid):**
1. Title (Exhibition: pure darkness, monumental text)
2. Atmosphere (Exhibition: full-screen key art with museum label)
3. Lore Intro (Descent: entrance text + 3 lore paragraphs with drop-cap)
4. Voice / Quote 1 (Exhibition: Dostoevsky, full-screen)
5. Mechanic (Descent: 2-column gauge + text layout)
6. Bestiary (Exhibition: grid cards, depth image bg)
7. Quote Break / Machiavelli
8. Encounters (Descent: alternating left/right cards)
9. Banter Interlude 1 (whispers image bg, scroll-driven reveal)
10. Literary Wall (Exhibition: author grid, depth image bg)
11. Banter Interlude 2 (revolution image bg, scroll-driven reveal)
12. Vault / Objektanker + Loot (Exhibition: grid layout)
13. Quote Break / Brecht ("Final Warning")
14. Exit / CTA (boss image bg, prev/next nav)

### 4. Six Images Instead of Two-Three
**Spec:** 2-3 images per archetype (hero, depth, boss optional).
**Implemented:** 6 images, each art-historically informed:
- Hero (Constructivist Spiegelpalast, regenerated in 16:9)
- Depth (El Lissitzky corridor, Koestler interrogation)
- Boss (Francis Bacon's screaming pope, Milton's Satan)
- Whispers (Vilhelm Hammershøi silent corridor)
- Revolution (Anselm Kiefer scorched assembly hall)
**Reason:** Rooms without background images felt empty. Each image references a specific painter/art movement matching the fracture gradient.

### 5. No Decorative Quote Marks on Descriptions
**Spec:** Enemy/loot/encounter descriptions wrapped in `"..."`.
**Implemented:** Removed all wrapping quotes. Text is already italic — the quotes were redundant and made long prose descriptions look like misattributed citations.

### 6. Banter Lines as Pull-Quote Interstitials
**Spec (Descent):** "Floating whispers — italic, smaller font, off-center, slightly rotated."
**Implemented:** Centered, consistent-size, full-width interstitial sections with dedicated background images and scroll-driven fade-in/out animation. Each section has a header ("Overheard in the Spiegelpalast") for context.
**Reason:** Off-center rotated text with border lines looked broken, not atmospheric. Users couldn't tell what they were reading. Centered pull-quotes with background imagery and context header are clearer and more dramatic.

## Atmospheric Features Implemented

| Feature | CSS Technique | Spec Source |
|---------|--------------|-------------|
| Background darkening | `animation-timeline: scroll(self)` on `:host` | Descent §CSS |
| Fracture gauge | `animation-timeline: scroll(root)` on fixed element | Descent §Gauge |
| Red vignette | Fixed overlay, scroll-driven opacity 0→1 | Descent §Per-Archetype |
| Surveillance grain | SVG `feTurbulence` noise, 2.5% opacity, flicker | Exhibition §Room 3 note |
| Room transitions | `::after` red accent line on `.room + .room` | Exhibition §Transitions |
| Mirror line | Fixed 1px vertical line, 4% opacity | Descent §Overthrow-specific |
| Parallax backgrounds | `animation-timeline: view()` on `.room__bg` | Both concepts |
| Gallery spotlight | `radial-gradient` `::before` per room | Exhibition §Lighting |
| Card reveals | `animation-timeline: view()` on `.room__reveal` | Both concepts |
| Title heartbeat | Slow `text-shadow` pulse (4s cycle) | Exhibition §Room 1 |
| Banter emerge | Scroll-driven fade + scale + accent glow | Custom (not in spec) |
| CTA pulse | `box-shadow` glow animation | Descent §Section 10 |

## Files Created

| File | Purpose |
|------|---------|
| `archetypes/ArchetypeDetailView.ts` | Main hybrid layout (9 rooms + 2 quote breaks + 2 banter sections) |
| `archetypes/dungeon-detail-data.ts` | Types + full Overthrow content (5 enemies, 4 encounters, 10 banter, 12 authors, 8 objektanker, 11 loot) |
| `archetypes/shared/archetype-detail-styles.ts` | 3 style modules: tokens, room structure, card patterns |
| `archetypes/shared/QuoteWall.ts` | Full-screen quote with original language |
| `archetypes/shared/EnemyCard.ts` | Tier-aware enemy portrait |
| `archetypes/shared/EncounterCard.ts` | Encounter with choice list |
| `archetypes/shared/AuthorCard.ts` | Literary influence (primary/secondary) |
| `archetypes/shared/ObjektankerCard.ts` | 4-phase expandable card |
| `archetypes/shared/LootCard.ts` | Loot with tier glow |

## Files Modified

| File | Change |
|------|--------|
| `app-shell.ts` | Added `/archetypes/:archetypeId` route with lazy loading |
| `frontend/scripts/lint-color-tokens.sh` | Exemptions for archetype detail files |
| `docs/guides/design-tokens.md` | Documented color token exceptions |
| `backend/services/dungeon/showcase_image_service.py` | Added 5 new `ArchetypeVisual` entries (depth, boss, whispers, revolution) |

## Open Items / Follow-ups

1. **Other 7 archetypes** — Only Overthrow is populated in `dungeon-detail-data.ts`. Each needs its own content + images.
2. **Room distribution visualization** — `roomDistribution` data exists but is not rendered anywhere.
3. **Open questions from spec** — Layout switcher (decided: no), content language (EN only for now), encounter spoiler policy (showing full choices), boss images (text-only for mystery vs. generated).
4. **Mobile testing** — Responsive breakpoints set at 768px and 640px but not tested on real devices.
5. **DungeonShowcase slider link** — The showcase slides should link to `/archetypes/:id`. Not wired yet.
6. **Scroll-snap padding** — `scroll-padding-top` may need adjustment for the platform header (60px).

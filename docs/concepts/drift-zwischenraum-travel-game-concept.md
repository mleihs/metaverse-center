# DRIFT — Der Zwischenraum / The Interstice

**A travel, exploration and quest game across the metaverse**
Concept document v0.4 — 2026-06-12
Status: CONCEPT (decisions resolved — see section 22; gate-review applied — 126 findings verified against the live codebase, results in `docs/analysis/drift-concept-gate-review-final-2026-06-12.md`; ready for plan doc). Reference claims in section 3 were verified by an adversarial deep-research pass (105 agents, ~550 source fetches, 3-vote verification per claim against primary sources: Failbetter design essays, the Gamasutra/Game Developer postmortem, the GDC 2021 Sunless Skies narrative postmortem, GDC talks by inkle and Worldwalker Games). Source list in 3.8.

---

## 1. Executive Summary

DRIFT is a new platform game mode in which a player — as a **Träger** (carrier; deliberately bilingual: courier *and* carrier wave) of the Bureau of Impossible Geography — travels the space *between* simulations, explores a persistent, fog-of-war'd interstitial chart, visits the five canonical worlds (and every future forge-created world) from the inside, and completes quests that are assembled from the **real database entities** of each simulation: its agents, buildings, zones, streets, events, embassies and lore. Completed quests leave **persistent traces** in the metaverse — events, agent memories, echoes, chronicle mentions — with full effect in the player's home simulation and curated, capped effect everywhere else.

Sunless Sea is the structural reference (islands of narrative across a dangerous expanse, resource pressure as tension engine, a home port that gives meaning to return), but DRIFT is not a clone. Its originality comes from what the platform already is:

- The "zee" is the **Bleed** — the already-modeled connection topology between simulations (`simulation_connections`, bleed vectors, embassies).
- Travel is **transmission, not seafaring**: the player's presence is modulated onto a carrier frequency; hull/fuel/terror become **Kohärenz / Bandbreite / Dissonanz**.
- The sea has **seven frequencies**: the chart is layered by bleed vector; geography itself is frequency-dependent.
- Weather is real: **substrate resonances** (already real-world-driven) become moving storms on the chart.
- The journey home matters because home is not scenery: it is the player's own simulation, and it **visibly changes** because of what the player did out there.

Three scales of play: **Drift** (between simulations, turn-based chart navigation, the core loop), **Begehung** (inside a simulation, zone-graph movement on the per-simulation world map under a presence budget), **Storylet** (quality-gated narrative scenes everywhere).

---

## 2. Design Pillars

1. **Travel is the game, not the loading screen.** One mode-agnostic travel engine, two traversal clients: the **Takt mode** (turn-based; every turn is a decision: route, frequency, risk, cargo) and the optional **Helm mode** (real-time steering; presence, positioning and throttle economics carry the play — see 7.6). No dead time in either: repeat journeys collapse via autopilot/time-compression on surveyed routes — tension lives at the frontier, never in commuting.
2. **Exploration is personal in a shared world.** One platform-wide chart, per-player discovery. Being the *first* to survey a node means something (and pays). The chart is bigger than its connection graph: ghost islands, shoals, relays, wrecks — and seven frequency layers that make re-exploration of "known" space meaningful.
3. **Lore is loaded from the database, not duplicated into quest text.** Quests are templates instantiated against live entities. Inspektor Mueller, Madam Lacewing, the Chapel of Silence, the Undertide Docks, zone security levels, embassy bleed vectors, agent relationship taxonomies — the content pipeline *references* them; the LLM only dresses them. Every quest instance must touch ≥ 2 real entities (hard design KPI).
4. **Every deed leaves a trace.** A completed quest writes at least one persistent, player-visible artifact into the world: an event in the chronicle, a memory an agent will later *recall in conversation*, an echo, a zone modifier at home. Asymmetric by trust: full vocabulary at home, capped/curated abroad.
5. **Failure produces content, not just loss.** Unraveling in the Drift scatters your cargo as echoes addressed to random simulations and leaves a wreck on the shared chart that other players can find. You return home scarred — and scars unlock storylet options no healthy Träger sees.
6. **Original where the platform is original.** Frequency-layered geography, hospitality-governed cross-world impact, real-world-driven weather, ghost islands from abandoned forge drafts: none of these exist in the reference games. Where we borrow (storylet grammar, home-port loop, survey economy), we name the source and the lesson.
7. **Every world is visitable by construction.** Any *active* simulation — including every future forge-created one — is dockable and playable from its data alone: map geometry drives the Begehung graph, taxonomies drive the storylet selectors, lore/theme fields drive the dressing. Hand-authoring (threads, pillar pairs) only ever *adds* identity; it is never required to *enable* a world. A new simulation joining the metaverse is not a content request — it is a live world event on the chart (8.7).

---

## 3. Reference Analysis — what we take, what we refuse

> All claims below are verified against primary sources (3-0 adversarial votes unless noted). One frequently repeated claim was **refuted** and is not used: that Failbetter explicitly modeled KoDP's event structure as identical to an Echo Bazaar storylet (1-2 against; treat as fan inference, not studio statement).

### 3.1 Sunless Sea (Failbetter, 2015)

**Take:**
- **The loop shape**: provision at port → venture into the dark → spend resources/sanity for stories and cargo → limp home → convert into progress and *go further next time*. The emotional core is the **return**, not the departure. DRIFT keeps this loop intact and strengthens it: home is a living simulation that reacts.
- **Terror as a third resource** that converts distance into psychological pressure and forces route compromises. DRIFT's Dissonanz copies the *role*, not the flavor: it is not fear but **loss of certainty about which world is yours** — and at high bands the game itself becomes an unreliable narrator (see 6.3).
- **Port reports**: a guaranteed, story-light income for first-visits that funds the next trip. DRIFT generalizes this into the **Vermessung** survey economy (8.4).
- **Officers as story containers**: companions whose quests pace long-term play. DRIFT uses *bonded agents* — the existing `agent_bonds` system — so companions are not new content but deepened existing relationships (10).

**Refuse / handle with care:**
- **Real-time steering as the *only* mode.** The postmortem nuance matters here: slow travel was a *deliberate, defended* tension mechanic — Alexis Kennedy: *"we've resisted speeding up the ship, because it would reduce the tension, the sense of space and distance, and the menace of the dark"*, while conceding a 50 % faster ship might be "more fun and less grindy". So the lesson is not "real-time is bad" but "travel pacing is a deliberate risk-reward dial, and emptiness — not real-time itself — is the tedium". DRIFT's core is turn-based (web-native, mobile, accessible); a full real-time **Helm mode** is specified in 7.6, built only once chart density can support it (density before speed).
- **The unresolved genre hybrid.** Kennedy's self-identified biggest mistake: the CRPG-vs-roguelike split was *"the source of very nearly everything that's wrong with the game"* — uneven difficulty, and players hated repeating early story content after death. DRIFT commits: it is a persistent-narrative game with run-level stakes. **Threads never reset on failure**; only the run's cargo/position are at stake (12).
- **Roguelike full-loss permadeath as default.** Verified: Failbetter identified Sea's death as too punishing, and Sea's chart-inheritance created a lose-lose (inherit the chart → no exploration XP; refuse → lose trade routes). Skies' Legacy mode answered with generous inheritance and **world-state persisting across death** ("less of a setback, more of an opportunity", tied to the *stake your claim* pillar). DRIFT goes further: no character death at all — Zerfaserung (12) costs cargo and inflicts a scar; discoveries, threads and world-traces always persist (map knowledge decoupled from progression currency: the chart dilemma is structurally impossible).
- **Economy as grind**: late-game Sunless Sea trading devolved into spreadsheet routes. DRIFT has no commodity buy-low/sell-high market; value flows from quests, surveys and one-of-a-kind cargo with twists (7.8).
- **The StoryNexus warning, inverted.** Verified lesson: reusing the Fallen London CMS won Failbetter content-iteration speed but bolted web-UI assumptions onto a PC game. We are the inverse case — a web platform building a game mode — so the warning reads: the game surface must be a *dedicated, full-screen play experience* (canvas chart, dossier panels), not a page-shaped CRUD UI that happens to contain a game.

### 3.2 Fallen London / StoryNexus — the storylet grammar

The quality-based narrative (QBN) model is the correct content architecture for a database-driven world — and this is Failbetter's *documented* motivation, not retro-fitting: naive branching explodes combinatorially (*"a Fighting Fantasy book with ten options per chunk would be the size of the Encyclopedia Britannica"*), so they built a reusable **pattern language** of narrative structures instead of restricting choice. **Storylets** are discrete scenes, **gated by qualities**, offering **branches whose checks read qualities and whose outcomes write them** — and each storylet is written as a *self-contained micronarrative* that must hold up when encountered out of order and re-read. That architectural property is exactly what a database-driven quest system needs, since content fires on world/agent state, never on authored sequence. DRIFT adopts QBN wholesale (9.2) with platform-native qualities: Frequenzprofil affinities, clearance, dissonance band, cargo manifest, bond depths, scars, attunements, zone/security context. Templates own structure and checks; generation owns prose only — never mechanics.

Two more verified Failbetter insights shape DRIFT directly:
- **Failure is content.** *"People really loved it when terrible things happened to them. We had players actively trying to get themselves thrown back into New Newgate, or exiled, or dead."* This is the design warrant for Zerfaserung-as-content (12) and for dissonance bands that *unlock* storylets rather than only penalize (6.3, and Station Null's dissonance-inverted thread, 9.3).
- **Points of light, pools of shadow** — the authoring technique for sparse, repeatable content: anchor each scene with one or two vivid specific details and deliberately leave the rest in shadow (*"the player carries the burden of shaping what's in the shadows"*); state world-facts as calculated, hedged ambiguity (*"they say few, if any, have survived"*) so facts can vary or change without contradiction — while geography and chronology stay committed absolute facts. This is the exact prose discipline for LLM-dressing of DB lore, codified as binding authoring rules in 9.6.

### 3.3 Sunless Skies — the sequel's corrections

Skies fixed Sea's pacing with: faster traversal, denser encounter spacing, location-anchored "ports of call" with rotating micro-stories, and **facets** (character traits chosen at creation/level that gate options). DRIFT inherits: dense node spacing on the chart (a storylet opportunity every 2–4 Takte), rotating embassy noticeboards, and scars/attunements as facet-likes.

Two further verified Skies-postmortem methods are adopted wholesale:

- **Narrative pillars per hub.** Failbetter distilled Skies' tone into five punchy pillars (*stake your claim; who are you in the dark; conceal your hand; mind your manners; nothing is sacred*) used as team writing prompts, and gave each region a distinct identity by assigning it a **pair of pillars plus a region-specific horror type** (natural horror in the Reach, social horror in Albion, fear of the unknown in Eleutheria, cosmic-bureaucratic horror in the Blue Kingdom). This is the documented method for differentiating multiple hubs in a multi-hub travel game. DRIFT defines its own pillars and per-simulation pairs in 4.4.
- **Fuse narrative with the economy** (the Peacock-Wind rule). Failbetter deliberately designed showpiece phenomena that act directly on the resource economy: Skies' Peacock Wind raises food supplies *while raising Terror*. Model: **every evocative world element should pull at least two economic levers in tension**, making exploration's risk-reward legible through narrative. DRIFT's cargo twists (7.8) and storm archetypes (13) follow this rule; it is enforced as a design KPI (21).

### 3.4 80 Days — route economics as narrative

The genius of 80 Days: **route choice is the story**. Money/time/health make every leg a tradeoff, and the world reveals itself through *which* way you went. DRIFT's frequency tuning (7.2) is our version: the same A→B crossing on `dream` vs `commerce` is a different journey, different cost, different storylets, different visible geography.

Verified tooling lesson (inkle, GDC 2015): massive contextual branching is an **authoring/tooling problem, not something to avoid** — inkle built their in-house scripting language (open-sourced as ink in 2016) precisely to make large quantities of highly contextual prose authorable and consistent. For DRIFT this argues for investing early in the authoring layer: a structured selector/condition DSL inside the YAML packs over world state, rather than capping branching complexity (9.6).

### 3.5 Citizen Sleeper — clocks and dice for a web cadence

Citizen Sleeper proves slow-burn pressure works in short sessions: cycles, drives (multi-step clocks), condition decay. DRIFT's **Aufenthaltsfenster** (presence budget inside a foreign simulation, 8.6) and quest-clock threads borrow this: a visit is a hand of limited actions; you never do everything; prioritization *is* the gameplay.

### 3.6 King of Dragon Pass / Wildermyth — the simulation speaks

Both show how procedurally-instantiated cast (clan members / heroes) carry hand-authored event skeletons without feeling generic: the *system* picks who is involved from live state. DRIFT's dispatch templates (9.1) are exactly this pattern over `agents`/`buildings`/`zones` rows.

The verified record strengthens both legs:
- **KoDP is Failbetter's own cited gold standard** for simulation-driven narrative: *"No other game has so effectively combined simulation and narrative"*, the clan saga *"feels like reading an actual history"*. Decisive detail: they credit KoDP's **named characters and personal conflicts** (feuds, romance, a named carl accused of murder) with preventing players from taking a detached resource-management stance — the documented rationale for putting agents, not numbers, at the center of every quest. (Caveat: the often-repeated claim that Failbetter called KoDP's event structure identical to a storylet was refuted in verification — inference, not statement.)
- **Wildermyth is the verified template for attachment to generated characters** (Nate Austin, GDC 2022): attachment is a deliberate, articulable design discipline — *every* system "bends towards this one goal, of creating memorable, relatable, even iconic heroes" — and the documented pitfalls are **breaches of trust and inconsistent character behavior**. For DRIFT this becomes a binding rule (9.6/10): generated prose may never contradict an agent's DB-defined `character`/`background`/relationships; the LLM dresses who the agent already *is*.

### 3.7 Roadwarden — travel with a deadline and a ledger

Roadwarden's single map that grows in *meaning* (not size) as trust/knowledge qualities accumulate validates pillar 2's "re-exploration of known space". Its day-budget urgency informs window design.

(Research gap, flagged honestly: Citizen Sleeper's dice/clock economy and Roadwarden's time-pressure loop produced no *verified primary-source* design claims in the research pass — their use in 3.5/3.7 rests on the games as shipped, which is sufficient for mechanical reference but carries no studio-postmortem authority. Likewise, no primary documentation surfaced on how Sunless Sea's officers were authored as quality-gated arcs; the companion design in 10 leans on the verified KoDP/Wildermyth rationale instead.)

### 3.8 Primary sources (verified)

- Failbetter, *Echo Bazaar Narrative Structures, part one* (2010) — storylet pattern language; failure-is-content. `failbettergames.com/news/echo-bazaar-narrative-structures-part-one`
- Failbetter, *Points of Light, Pools of Shadow, part I* (2011) — anchor details + calculated ambiguity. `failbettergames.com/news/points-of-light-pools-of-shadow-part-i`
- Failbetter, *Echo Bazaar Inspirations: King of Dragon Pass* (2011). `failbettergames.com/news/echo-bazaar-inspirations-king-of-dragon-pass`
- Alexis Kennedy, *Postmortem: Failbetter Games' Sunless Sea* (Gamasutra/Game Developer, 2015) — genre-hybrid mistake; slow-travel defense; StoryNexus CMS lesson. `gamedeveloper.com/audio/postmortem-failbetter-games-i-sunless-sea-i-`
- Failbetter, *Sunless Sea vs Sunless Skies: death, legacies and repetition* — Legacy-mode specifics. `failbettergames.com/news/sunless-sea-vs-sunless-skies-death-legacies-and-repetition`
- *Sunless Skies* narrative postmortem (GDC 2021) — five pillars, per-region pillar pairs + horror types, Peacock-Wind economy fusion. `youtube.com/watch?v=_sslFBVy5Lc`
- Jon Ingold, *Adventures in Text: Innovating in Interactive Fiction* (GDC 2015) — ink/tooling for massive contextual branching. `gdcvault.com/play/1021774`
- Nate Austin, *Getting Players Emotionally Attached to Procedural Characters* (GDC 2022) — Wildermyth attachment discipline. `gdcvault.com/play/1027614`
- Kreminski & Wardrip-Fruin, *Sketching a Map of the Storylets Design Space* (ICIDS 2018) — QBN formalization. `mkremins.github.io/publications/Storylets_SketchingAMap.pdf`

---

## 4. Fiction & Framing

### 4.1 Premise

The Bureau of Impossible Geography — the institution that already publishes each simulation's chronicle — has learned that the connections between simulations carry more than echoes. A member of a simulation can be **moduliert**: their presence encoded onto a carrier wave and sent into the Bleed. The Bureau calls these people **Träger**. Officially they are field cartographers. Unofficially they are couriers, smugglers, witnesses, and the only people who have stood in two worlds in one lifetime.

The player's Träger is not a new avatar. It is the player **as a member of their home simulation** — their anchor (Anker). A Träger without an anchor is a wreck waiting to happen; everything carried home materializes *because* there is a home for it to materialize in.

### 4.2 The Zwischenraum

The space between simulations is not empty. It is the medium the metaverse is written on: a dark expanse threaded with **Strömungsbänder** (the visible glow of strong `simulation_connections`), littered with the half-built (ghost islands: forge drafts that never materialized), the abandoned (relays of unknown construction — who surveyed the Bleed *before* the Bureau? — a built-in long-term mystery arc), and the lost (wrecks of unraveled Träger). Simulations appear from the Drift as **broadcast glows** on the horizon: Velgarien a cold administrative lattice, the Gaslit Reach a warm bioluminescent smear, Station Null a single pulsing point orbiting something that eats light, Speranza a faint heartbeat under static, the Cité a steady dawn that never quite arrives.

Distance from any broadcast glow is dangerous: the deep Drift does not carry enough signal to keep a self coherent (this is the diegetic driver of Dissonanz).

### 4.3 Why this framing earns its keep

- It explains **public-first** diegetically: anyone can *watch* any simulation (the broadcasts are public); only the anchored member can *change* their own.
- It explains the impact asymmetry: a Träger is a guest frequency in a foreign broadcast — they can leave interference patterns (echoes, memories, events of capped impact), not rewrite the signal.
- It recruits existing lore instead of adding a parallel cosmology: bleed vectors, embassies, substrate resonances, the Bureau, the redacted aesthetic of the alpha suite — all already canon.

### 4.4 Tonale Pfeiler — five pillars, paired per world

Applying the verified Skies method (3.3): five punchy pillar statements as team/LLM writing prompts, each simulation keyed to a **pair of pillars plus a local threat flavor**, so every hub plays as a different experience of the same game.

The five DRIFT pillars:

1. **„Du bist das Signal."** — identity is transmission; you are what arrives.
2. **„Jede Welt sendet weiter."** — nothing stays local; every act echoes.
3. **„Die Karte lügt zuerst."** — distrust is a navigation skill; the interface is part of the fiction.
4. **„Was du trägst, trägt dich."** — cargo and self are entangled; every load is a bargain.
5. **„Zuhause ist eine Frequenz."** — home is not a place but an attunement you can lose and retune.

Per-world pairs and threat flavor:

| World | Pillar pair | Threat flavor |
|---|---|---|
| Velgarien | „Jede Welt sendet weiter" + „Die Karte lügt zuerst" | bureaucratic-social horror: being *seen*, filed, anticipated |
| The Gaslit Reach | „Was du trägst, trägt dich" + „Die Karte lügt zuerst" | chthonic horror: depth, dark, things older than the charts |
| Station Null | „Du bist das Signal" + „Zuhause ist eine Frequenz" | cosmic horror of unreliable systems: HAVEN, time-slip, the 194 |
| Speranza | „Was du trägst, trägt dich" + „Zuhause ist eine Frequenz" | scarcity horror: the surface, the machines, the weight of hope |
| Cité des Dames | „Jede Welt sendet weiter" + „Du bist das Signal" | **deliberately no horror** — the counterweight world; clarity and being heard as the local register |
| The Drift itself | „Die Karte lügt zuerst" + „Du bist das Signal" | dissolution: distance from every broadcast |

Forge-created simulations receive an auto-derived pillar pair and threat flavor at publish time (classification from their lore/theme fields, owner-overridable) — the pillar system scales to worlds nobody on the team has read (8.7).

---

## 5. The Three Scales of Play

```
┌─────────────────────────────────────────────────────────────┐
│  DRIFT (chart)        — turn-based node navigation,         │
│   between simulations   exploration, weather, hazards,      │
│                         frequency tuning, drift storylets   │
│         ⇅ dock at embassy / broadcast edge                  │
│  BEGEHUNG (world map) — zone-graph movement inside a        │
│   inside a simulation   simulation under a presence budget, │
│                         buildings, agents, local storylets  │
│         ⇅ any scene                                         │
│  STORYLET (panel)     — QBN scenes: checks against          │
│   everywhere            qualities, choices, outcomes        │
└─────────────────────────────────────────────────────────────┘
```

A session can be pure Drift (push the frontier), pure Begehung (work a simulation's quests during a window), or the classic arc: provision at home → cross → visit → return changed.

---

## 6. Resources & the Träger

All resource mutations are atomic Postgres RPCs with compare-and-swap (ADR-007). State authority is split deliberately: numeric resources (Kohärenz/Bandbreite/Dissonanz/Siegel) live as columns mutated only via CAS RPCs; narrative/positional run state lives in a checkpoint JSONB written by the same RPC in the same transaction (dungeon-engine pattern — but **without** inheriting its sole-writer assumption: a single-active-run-per-user CAS constraint governs multi-device opens).

### 6.1 Kohärenz (Coherence) — "hull"

Structural integrity of the carried self. Range 0–100. Damaged by: hazards, riding storm edges, frequency retuning (Umstimmung), failed high-risk checks, hostile encounters. Restored: fully at home (over Takte), partially at embassies (Siegel cost), rare storylet outcomes. At 0 → **Zerfaserung** (12).

### 6.2 Bandbreite (Bandwidth) — "fuel"

Carrying capacity of the connection between Träger and anchor. Spent per chart move (edge weight × frequency match), per active scan, per heavy cargo slot. Regenerates slowly at home; purchasable at relays/embassies for Siegel. Bandwidth class (upgradeable) sets cargo slots and scan range. Design rule: bandwidth pressure shapes *route planning*, never produces stranding-without-options — at 0 you can always limp along surveyed edges at a Kohärenz trickle cost ("Notfrequenz"), slow but never softlocked.

### 6.3 Dissonanz (Dissonance) — "terror", made original

Accumulated uncertainty about which world is yours. Range 0–100, in bands:

| Band | Effect |
|---|---|
| 0–24 Klar | none |
| 25–49 Verstimmt | foreign-sim storylets gain unsettling variants; some NPC reactions shift |
| 50–74 Doppelt | **the game starts lying**: chart pings may be false, storylet text shows ░▒ redaction artifacts (reuse `<velg-redacted>`), one option per storylet may be a mirage |
| 75–99 Fremd | home feels foreign: arriving home triggers estrangement storylets; companions may refuse options; false memories appear in the journal (clearly marked *after* the band drops) |
| 100 | **Identitätsbruch**: forced return, lose unanchored cargo, gain a scar. Mechanically a Zerfaserung variant resolved by the same RPC (`fn_zerfaserung`, `failure_type='identitaetsbruch'`): immediate, no distress window (you are not stranded — you are lost), no wreck node (the carrier holds; the self doesn't), cargo scatters identically, scar drawn from a dissonance-flavored pool |

Sources: Takte spent in deep Drift (scaled by distance from any broadcast glow), restricted zones abroad, desire/dream cargo aboard, storms. Sinks: home, bonded agents' presence, specific buildings (the Chapel of Silence; the Cité's Reason quarter; any building flagged `sanctuary` — a buildings-schema flag carried in §17's schema work, refreshing `active_buildings` in the same migration per the platform view rule; P0 hardcodes the Chapel of Silence as its sanctuary), some storylets.

The band-2 "game lies to you" mechanic is the signature original twist: terror that attacks the *interface*, not the character sheet. (Strictly cosmetic/informational distortion — never silently alters real state; the truth is always reconstructable after recovery. Accessibility toggle: distortion effects honor `prefers-reduced-motion` and have a screen-reader-safe rendering.)

### 6.4 Siegel (Seals) — Bureau scrip

Earned from dispatches, surveys, thread milestones. Spent on: bandwidth refills abroad, embassy services (lodging = window extension, storage, introductions), chart data (buying other players' published surveys), clearance exam fees, cosmetic stamps (the Bureau prestige line: clearance/feat-gated, Siegel-priced — disjoint by rule from the forge_token vanity catalog in 22.3; no item exists in both currencies). Deliberately **not** earnable by repetitive trading: there is no commodity market (anti-grind, 3.1).

### 6.5 Takt & Aufenthaltsfenster — time

The **Takt** is the universal turn: one chart move, one scan, one zone move, one major storylet entry. Weather is *sampled* per Takt from the global wall-clock weather state (15.2) — it advances on server time, never per-player. Inside a foreign simulation, presence is budgeted: an **Aufenthaltsfenster** of N Takte (base 12; modified by clearance, embassy lodging, bond shelter, hospitality setting). When the window closes, dissonance ramps steeply — you *can* overstay, at a price. At home, no window.

---

## 7. The Drift Chart — exploration core

### 7.1 Topology

One platform-wide chart, generated deterministically from a seed:

- **Anchor layout** from the existing multiverse graph: simulations positioned via the multiverse force-layout family (`frontend/src/components/multiverse/map-force.ts` — `CartographersDesk` is an SVG zone schematic, not a force graph), ported to a **new server-side seeded deterministic generator** (Python, seeded PRNG, fixed iteration count, viewport-independent coordinates — nothing client-side or run-to-run random survives into `drift_chart_nodes`); `simulation_connections` become Strömungsbänder — low-cost edge corridors whose width/glow encodes `strength`.
- **Interstitial tissue**: procedural nodes and edges fill the space between and around corridors — this is where exploration lives. Node density tuned so a storylet opportunity appears every 2–4 Takte on frontier routes (Skies lesson).
- **Frontier ring**: beyond the known simulations, open Drift with rarer, stranger nodes — room for future simulations to materialize *into* (a forge-published simulation appears on the chart as a new broadcast glow: existing feature becomes a live world event).

New simulations and new embassies change the chart additively; the generator is versioned (`chart_version`) so regeneration is an explicit migration-style event, not a silent reshuffle.

**Erstkontakt — how a new world joins the chart.** When a forge simulation is published, its broadcast glow appears in the frontier ring, announced in the dispatch ticker. If it has no `simulation_connections` yet, it is born with one **provisional thin connection** (weak, single-vector, auto-derived from its dominant theme) — reachable, but barely: the deep-Drift approach is expensive and dissonance-heavy, arrival is `unangemeldet` (no embassy yet). The integration of the new world into the topology is then *player work*: surveying its approaches, the platform-first docking ("Erstkontakt: <player>" — the rarest chart flag), and **introduce/`propose_embassy` quests** that establish its first formal embassy pair. Träger are diegetically the people who stitch new worlds into the metaverse — a growth loop where every forge publish creates a frontier gold-rush.

### 7.2 Frequencies — layered geography (original)

The Träger is always tuned to exactly one of the seven bleed vectors: `commerce, language, memory, resonance, architecture, dream, desire`. The chart is **frequency-filtered**:

- Every edge has per-vector permeability (derived from its connection's `bleed_vectors` + procedural variation): cheap on matching vectors, expensive or impassable off-vector.
- Some nodes exist on a subset of frequencies (**Frequenzfenster**); a region "fully explored" on commerce may hide a dream-only archipelago.
- Retuning (**Umstimmung**) is possible at any node: costs Kohärenz + 1 Takt; some relays retune for free (a reason relays matter).
- Cargo interacts with tuning: dream cargo spoils on commerce frequency, contracts can only legally cross on commerce, etc. (7.8).
- Quests can demand a frequency ("deliver this *as a dream*"), making route puzzles out of otherwise-known space (80-Days lesson).

Effect: 7 overlapping exploration layers over one topology — depth without authoring seven maps.

### 7.3 Node types

| Node | What it is | Play |
|---|---|---|
| **Broadcast-Rand** | a simulation's edge; dockable | enter Begehung (via embassy if any, else "unangemeldet" at higher dissonance cost) |
| **Relais** | stable waypoint, origin unknown | rest (dissonance −), free retune, noticeboard micro-quests; the mystery arc seeds here. Tension: relays are public congregation points — resting Träger are visible, and Splitterfänger scouts patrol the approaches (encounter chance ↑ on the next leg) |
| **Echo-Untiefe** | pooling ground of `event_echoes` | harvest resonance cores; reading the pooled echoes = diegetic window into *live platform events*. Tension: harvesting means listening to everyone's noise — Dissonanz ↑ per core drawn |
| **Geisterinsel** | a never-materialized forge draft (operationally: `status='draft'` with `updated_at` older than N days, or `status='failed'`; owners can opt out) | explorable micro-site, 2–3 storylets generated **from a public `ghost_island_lore` projection, never from the owner-scoped `forge_drafts` row** (drafts are RLS-private; the projection carries anonymized, curated fields only); unstable: may not be there on return |
| **Resonanzsturm** | mobile manifestation of an active substrate resonance | hazard with personality per archetype (The Deluge floods edges; The Shadow hides nodes; The Tower collapses a corridor); ride its edge for speed at Kohärenz cost |
| **Träger-Wrack** | where a player unraveled | salvage scattered cargo (explicitly forfeited at Zerfaserung — an open shared pool, first-come; non-interference intact because the owner has already lost it), read the final log entry (player-written, moderated per 22.5, or auto-generated) — asynchronous multiplayer memory. Tension: salvaged cargo arrives with twists, and wreck-sites carry a Dissonanz field |
| **Splitterfänger-Revier** | predator territory | fragment-swarms chase high-cargo Träger: evade (frequency switch, route play) or confront (storylet; or hand off into a themed resonance-dungeon run as a "boarding" — existing system as combat resolution) |

### 7.4 Movement, sensing, surveying

- **Move**: adjacent node, costs Bandbreite (edge weight × frequency match). Turn-based; hazards move after you (visible intent vectors — storms telegraph).
- **Pings**: from any node you passively sense adjacent nodes plus faint directional pings of undiscovered nodes 2–3 hops out, on your current frequency only.
- **Scan**: spend bandwidth to resolve pings into chart data. Companion professions (scientist, navigator) and attunements extend range.
- **Vermessung**: first personal discovery of a node yields survey data; **delivering it to the Bureau** pays Siegel + clearance progress. Platform-first discoveries are flagged on the shared chart ("Erstvermessung: <player>") — permanent, earned authorship in the shared world, **server-arbitrated**: the first successful `fn_survey_deliver` wins the flag (first-write-wins CAS, never client-trusted — see 7.7's state-authority scope); the runner-up gets partial credit per 15.1. Survey data is also *publishable*: other players can buy your published routes for Siegel (you earn a royalty trickle; anti-abuse: royalties pay only on purchases by distinct, unlinked accounts — self-purchase excluded) — exploration as economy, cartography as content.
- **Autopilot**: any route consisting solely of personally-surveyed (or purchased) edges can be traversed in one action at full resource cost but zero Takte of player attention. Weather semantics: the route is re-priced edge-by-edge against current global weather at execution time, and autopilot refuses to enter active hazard cells or collapsed corridors (manual play or reroute required) — the commute click never grants storm immunity. The anti-tedium contract: *the frontier is gameplay, the commute is a click*.

### 7.5 The mode-agnostic travel engine

The chart is canonically a **continuous 2D space**; the node graph is generated *from* it (nodes are points of interest, edges are traversable corridors). Two traversal clients run over the same engine and state:

- **Takt mode** (default, P0): samples the space discretely, node-to-node, as described in 7.4.
- **Helm mode** (variant, 7.6): traverses the space continuously in real time.

Both emit the *same canonical event stream* — node arrival, hazard/field contact, storylet trigger, resource delta, weather tick — checkpointed identically into `travel_runs`. A run may switch modes at any dock or relay. Quest logic, surveying, effects, weather and economy are mode-blind: they consume the event stream, never the input method. This keeps the real-time variant a *client concern*, not a fork of the game.

### 7.6 Helm-Modus — the real-time variant

The optional full-steering experience for players who want the boat, not the chess clock. Design contract: **atmosphere through presence and positioning — never through reflexes**.

**Steering & feel**
- Pointer or WASD heading + a **throttle dial** (0–3) with light inertia. No twitch demands anywhere: danger is positional and cumulative, telegraphed seconds ahead.
- Bandbreite drains per second × throttle² — slow is efficient, speed is a *spend decision*. This makes Kennedy's pacing dial (3.1) player-facing instead of designer-imposed: the player continuously prices tension against cost.
- Dissonanz accrues per second scaled by darkness (distance from broadcast glows); Kohärenz takes damage from field contact (storm cells, shoal turbulence, predator touch).

**Das Trägerlicht** — the lamp dilemma, earned diegetically
- Your beacon is your *self-signal*. Light on: Kohärenz stable, pings clear — but Splitterfänger see you. Running dark: invisible to predators, but Dissonanz ×2 and pings muted. The Sunless lamp homage, justified by the fiction (the beacon literally keeps the self coherent) rather than copied. Mode parity (KPI 8): in Takt mode the same dilemma exists as a per-move beacon stance toggle — identical effects, discrete texture.

**Frequency sweep** — the variant's signature instrument
- In Helm mode the frequency dial becomes playable continuously: **sweeping** across the seven vectors live-crossfades the visible chart; hidden nodes *shimmer* as the sweep passes their frequency. Active-sonar gameplay: you hunt Frequenzfenster by ear and glow before paying the Umstimmung lock-in cost. (In Takt mode the same information arrives as discrete scan results — same data, different texture.)

**Encounters**
- Entering a storylet trigger zone **soft-pauses** into the storylet panel; real time never runs under text. Splitterfänger pursue slowly with telegraphed lunges; escapes are routing, frequency lock-change, or jettisoning cargo as bait — and a confrontation hands off to a themed dungeon run exactly as in 7.3. No real-time combat layer, ever.

**Pacing, built from the verified lessons**
- Encounter density tuned to one meaningful sighting per ~30–45 s of frontier travel (Skies density lesson) — Helm mode ships only where the chart is dense enough; *density before speed*, or Helm inherits Sea's empty-crossing tedium.
- **Time compression ×4** on fully surveyed corridors replaces Takt-mode autopilot. Docking is instant.

**Web & engineering reality**
- Client-simulated `requestAnimationFrame` canvas loop in the dedicated drift component; auto-pause on tab blur, storylets and menus (a web game that punishes alt-tab is a broken web game).
- Server-authoritative at interaction points: node arrivals, storylet entries and resource checkpoints validated for plausibility against elapsed time and edge costs — same RPCs as Takt mode (`fn_travel_move` accepts a traversal segment instead of a single hop). PvE-only, so light validation suffices; no tick servers, no netcode.
- **Accessibility contract**: every run is completable in Takt mode; Helm is additive. `prefers-reduced-motion` defaults the client to Takt mode; all Helm information (pings, shimmer, telegraphs) has non-motion equivalents in Takt mode.

**Tradeoffs & recommendation**

| | Takt mode | Helm mode |
|---|---|---|
| Session shape | 5-min chunks, interruptible | 20-min+ immersion |
| Mobile | excellent | poor–moderate |
| Accessibility | full | reduced (mitigated by mode parity) |
| Dev cost | low (state machine exists as pattern) | high (loop, feel-tuning, validation) |
| Atmosphere ceiling | good (presentation-carried) | the differentiator on desktop |
| Tedium risk | low | high if content density lags |

Recommendation: **Takt mode ships P0–P2 as the canonical client; Helm mode is built in P3** on top of the by-then-dense chart, as the desktop atmosphere mode. The mode-agnostic engine (7.5) is a P0 architectural requirement precisely so this order stays cheap. *(Decided 2026-06-12, section 22.6: this order is binding — Takt-first, Helm in P3. The technical options below were written to support either order and remain valid unchanged.)*

### 7.7 Helm-Modus — technical options

Four decisions, each with a clear ladder. Stack context: Lit 3 + TypeScript + Vite frontend, FastAPI backend, Supabase (Realtime included), self-hosted on a VPS via Coolify (long-running processes are *possible*, not forbidden).

**(1) Rendering & game loop (client)**

| Option | What | Fit |
|---|---|---|
| **Canvas 2D, hand-rolled** | plain `<canvas>` + rAF render + fixed-timestep logic (60 Hz accumulator) | cheapest; precedent in `CartographersDesk`; fine for a P0 slice with dozens of nodes; glow/fog effects get expensive (per-pixel work on CPU) |
| **PixiJS v8** ⭐ | WebGL/WebGPU 2D scene graph: sprites, containers, filters (bloom/glow shaders), particles, culling; tree-shakeable, TS-native | the workhorse for exactly this genre of 2D atmosphere game; fog-of-war and frequency-crossfade as fragment shaders; thousands of chart objects at 60 fps; integrates as a child of a light-DOM Lit component (per the existing canvas-component rule) |
| **Phaser 3/4** | full game framework: input, camera, tweens, arcade physics, audio | fastest route to "game feel", but brings its own world/loop/asset model — a framework inside a framework; lock-in heavier than the problem requires (we need no physics engine, no tilemaps) |
| **Three.js (orthographic / 2.5D)** ⭐ | 3D scene, orthographic camera over a 2D play plane, volumetric drift layers optional | highest atmosphere ceiling (depth, parallax fog, light shafts); the **richest post-processing pipeline on the web** (EffectComposer: UnrealBloom, god rays, glitch — the dissonance/broadcast look off the shelf); `Points`/instancing handle thousands of chart objects trivially |

Recommendation (revised after LLM-production assessment): **Three.js with an orthographic camera** in a light-DOM Lit host component — same 2D game mechanics, 2.5D ceiling for free. Deciding factors beyond the table: documentation/example corpus density is an order of magnitude higher than Pixi's (≈100k stars / ≈25k SO questions / the official examples directory / the Shadertoy-adjacent shader culture), which directly raises LLM-assisted code quality; and PixiJS carries a v8-era risk — most online material still teaches v5–v7 patterns, inviting fluent-but-outdated generated code. PixiJS v8 remains the right pick for a strictly sprite-shaped 2D reading of the chart; the spike was run 2026-06-12 (Three.js only, per owner decision): all criteria verified — 500/5000 instanced nodes at 120 fps, UnrealBloom, continuous frequency crossfade via vertex-shader bitmask, bespoke pan/zoom, dissonance grade pass — see `spikes/drift-chart-three/README.md` for the binding carry-over list (including the sRGB background trap). Either way: movement physics is trivial integration math (velocity + light inertia — no physics library); logic in a fixed-timestep update decoupled from render, which keeps the simulation deterministic enough for replay validation and identical behavior at any frame rate. Optional perf lever later: `OffscreenCanvas` + Web Worker so simulation and rendering leave the UI thread entirely.

**(2) State authority & validation (server)**

| Option | Model | Verdict |
|---|---|---|
| **Client-simulated, server-checkpointed** ⭐ | client runs the sim; atomic RPCs at interaction points (node arrival, storylet entry, dock) + periodic resource checkpoints (~10–15 s, idempotent CAS); server validates plausibility envelopes (distance/time/cost) | correct for PvE + non-interference contract (KPI 9): client trust is scoped to **private resources only** — every shared or competitive write (Erstvermessung/Erstkontakt claims, royalties, leaderboards, rescues) is a server-arbitrated first-write-wins RPC, so cheating can only inflate your own single-player progress; zero new infrastructure; resume-safe by the same checkpoint mechanism as Takt mode |
| Deterministic replay validation | client streams its input log; an async job replays the deterministic sim core server-side and flags divergence | middle ground if survey/leaderboard integrity ever needs hardening; requires the sim core as a shared artifact (TS core run in a Node sidecar, or a Rust/WASM core used by both sides) — elegant, not v1 work |
| Server-authoritative tick loop | server owns positions, clients send inputs (websocket service on the VPS) | only needed for adversarial real-time interaction (PvP, collision, racing) — all of which the design forbids; highest ops burden (stateful service, scaling, reconnect logic); keep as the documented escalation path, expect never to need it |

**(3) Multiplayer presence transport (15.2)**

| Option | Verdict |
|---|---|
| **Supabase Realtime (Presence + Broadcast)** ⭐ | already first-class in the platform's hybrid pattern; channels sharded `drift:freq:<vector>:cell:<region>`; positions broadcast at 2–4 Hz, remote Träger rendered with ~250 ms interpolation buffer + dead reckoning (ghostly co-presence tolerates latency by design — nothing collision-relevant); message quotas are the constraint, sharding + throttling the answer |
| Own WebSocket service (FastAPI websockets or a small dedicated process via Coolify) | the self-hosted VPS makes this a *realistic* upgrade path if Realtime quotas pinch at higher Hz/population — port the hot presence channels, keep everything else; not v1 |
| WebRTC data channels (P2P within a convoy) | lowest latency between linked players; signaling complexity is not worth it for ghost-presence — revisit only if convoys ever need tight sync |

**(4) Web-platform obligations (non-negotiable regardless of options)**

- Pause on `visibilitychange`/blur and during storylets; never simulate while hidden (also closes the "background-tab resource drain" cheat/grief class).
- Checkpoint on pause/unload (`fn_travel_move` segment flush) — a dropped connection or closed tab costs nothing.
- Input: pointer + WASD at launch; Gamepad API is nearly free; touch (virtual stick) only if Helm ever goes mobile.
- WebAudio for sonar/ping/ambient layers (the atmosphere carrier in Helm mode).
- `prefers-reduced-motion` → Takt client (existing accessibility contract, 7.6).

**Bottom line** (spike-resolved 2026-06-12): **Three.js orthographic on the classic WebGL/EffectComposer path** (explicitly not WebGPU/TSL — thin corpus, API churn; re-evaluate at P3) + fixed-timestep client sim + checkpoint-validating RPCs + Supabase Realtime presence. No new server infrastructure for v1, an honest escalation path for each layer if scale or integrity demands it — and the mode-agnostic engine (7.5) means none of these choices fork the game.

### 7.8 Fracht — cargo families & twists

Cargo is what makes a crossing a *bargain* instead of a commute (pillar 4). The manifest is slot-based (bandwidth class = slot count, 6.2); every item is a one-of-a-kind instance, never a stackable commodity (no market, 6.4).

**Seven families, one per bleed vector** — cargo is frequency-shaped matter, so the families fall out of the existing vector taxonomy: **Kontrakte** (commerce — sealed obligations), **Idiome** (language — untranslatable phrases in carrying cases), **Erinnerungsstücke** (memory — objects that remember being elsewhere), **Resonanzkerne** (resonance — harvested at Echo-Untiefen, 7.3), **Blaupausen** (architecture — buildings that want to exist), **Traumfracht** (dream — volatile, lucid), **Sehnsuchtsgut** (desire — heavy in a way scales don't measure). Family determines vector affinity: carriage on the matching frequency is cheap; off-vector carriage costs extra Bandbreite per move and exposes the item's twists.

**Twists** are the Peacock-Wind engine at item scale: every instance draws 0–2 twists from a **closed catalog** at acquisition — mechanical metadata, template-owned, never LLM-written. Launch catalog: *deklariert/undeklariert* (legal only on commerce frequency / contraband at checkpoints — Velgarien scenes write themselves), *flüchtig* (spoils N Takte after leaving its vector), *laut* (Splitterfänger hear it), *verschränkt* (paired with a counterpart item in another world — delivering one alters the other), *beschriftet* (carries a written destination: a found quest, 9.5), *gefälscht* (not what its papers say; revealed at the delivery check). Dream/desire cargo additionally raises Dissonanz while aboard (6.3).

**Acquisition**: dispatches (9.1), storylet outcomes, harvest nodes, wreck salvage (with twists, 7.3), embassy noticeboards. **Value**: redemption through quests, Bureau delivery or building storylets (markets fence, archives authenticate) — value flows from twists and provenance, never from price spreads (3.1 anti-grind rule). **Stakes**: the manifest is precisely what Zerfaserung scatters (12); small personal items (Andenken) can be anchored at home, out of stake.

`travel_cargo` (17): instance rows — family, vector, twists (jsonb from the closed catalog), provenance refs (`origin_agent_id` / `origin_building_id` / `origin_event_id` — cargo carries its KPI-1 entity references in its papers), optional `quest_instance_id`, manifest position.

---

## 8. Begehung — inside a simulation

### 8.1 Arrival

Through an **embassy** (if an active embassy pairs with your origin/route): civilized arrival, window bonus, ambassador services. Or **unangemeldet** over the broadcast edge: arrive in a random low-security zone, +dissonance, no services — but no questions either (smuggler route; required where embassies are `suspended`).

### 8.2 Movement

The simulation's world map (zones/streets/buildings already exist with geojson) is played as a **zone graph**: zones are rooms; adjacency is **derived from zone-polygon border-sharing** (`zones.geojson`, a shapely pass in the ForgeMapService style, materialized as a `zone_adjacencies` structure refreshed by the map-geometry pipeline) — *not* from streets, which are intra-zone by construction (each `city_streets` row carries a single `zone_id` and never spans two zones). Moving zone-to-zone costs 1 Takt of the window; geometry-less legacy sims fall back to the list-shaped graph (8.7). `security_level` gates: restricted zones demand clearance, a companion with the right relationship, or a storylet gamble (Velgarien checkpoint scenes write themselves).

### 8.3 Discovery inside worlds

Public data ≠ explored data. The player's *personal* knowledge layer reveals progressively: entering a zone shows its prominent buildings; an **Erkundung** action (1 Takt) reveals more buildings/agents weighted by relevance; quest lines reveal specific targets. Browsing the database becomes walking the city. (Roadwarden lesson: the map grows in meaning, not size.)

### 8.4 Local play

- Talk to agents (existing chat system, now context-tagged "ein Träger spricht" — agents react via their actual `character`/`system`/relationship data; agent memories mean they *remember previous visits*).
- Building storylets keyed to `building_type`/`special_type` (archives research, markets fence cargo, laboratories analyze samples, chapels lower dissonance).
- Zone events: live `events` rows of that simulation surface as scene dressing and storylet hooks — the simulation's actual current news is the quest's weather.
- Pick up local dispatches at the embassy noticeboard or from agents (bond-gated offers via whisper system).

### 8.5 The five worlds, played

What the identity data already supports, per world — examples of how lore surfaces as mechanics:

- **Velgarien** (de, surveillance dystopia): high-security zone lattice; checkpoint storylets test `language` affinity and forged papers (cargo!); informant-handler relationship taxonomy becomes a trust minigame; events of type `surveillance/propaganda` raise patrol density. The Bureau's German bureaucratic register is *home flavor* — Velgarien is also the most natural first home simulation.
- **The Gaslit Reach** (subterranean gothic): vertical zone graph (Upper Galleries → Undertide Docks → Deepreach); light as soft resource flavor; **Madam Lacewing** — chief cartographer of the Reach (current canon since the retheme; the archive role belongs to Archivist Quill) — as the embassy questline anchor: a cartographer anchoring a travel-game thread is the natural bridge. (Canon-repair note for the plan: pre-retheme `embassy_metadata` JSONB still carries stale "Archivist Mossback" name strings, and embassy ambassadors are stored as unlinked name strings rather than agent FKs — the plan ships a repair migration adding `agent_id` linkage.)
- **Station Null** (deep-space horror): the window mechanic *tightens* here (time moves differently per section — Takte cost double in some decks); HAVEN, the lying station AI, is a diegetic twin of the dissonance-lies mechanic — at high dissonance, you cannot tell whether HAVEN or your own interface is deceiving you. Strongest horror synergy on the platform.
- **Speranza** (post-apocalyptic Toledo): Topside is the only "outdoor restricted zone" — escorted salvage runs with raid-partner agents; commerce/architecture vectors dominate; contrada kinship taxonomy gates shelter (window extension through earned trust, not Siegel).
- **Cité des Dames** (literary utopia): the sanctuary world — dissonance heals faster; quests are scholarly (manuscript provenance via `language`/`memory` vectors); the six historical women as agents make fetch-quests into salon conversations. Deliberately the "Mutton Island" of the chart: a place you go to *recover* and reflect.

### 8.6 Window pressure

12-Takt base window, Citizen-Sleeper-style: you arrive with three quests, current events, an unexplored quarter, and a closing window — *choosing what not to do* is the gameplay. Extensions are diegetic (lodging, shelter, clearance), never grind.

### 8.7 Universal visitability — generated worlds (pillar 7 made concrete)

Every layer of Begehung is derived from data that *every* simulation has, so a forge-created world is playable the moment it is published:

- **Travel identity, auto-derived at publish**: a one-time classification pass (LLM, budget-gated, with deterministic fallback from `theme`) assigns the new world a pillar pair (4.4), a threat flavor and per-vector affinities, stored as travel metadata. Per-simulation prompt-template overrides — an existing platform feature — give its generated quest prose the right voice from day one.
- **Begehung graph from geometry**: forge already generates zones/streets/buildings (`fn_apply_map_geometry`); the zone graph falls out of street connectivity. Fallback for legacy/geometry-less simulations: a list-shaped graph from `zones` rows grouped by city, all-adjacent — playable, just flat.
- **Storylets fire on taxonomies, not on world identity**: selectors key off `zone_type`, `security_level`, `building_type`, `special_type`, relationship-type taxonomies and live `events` — all seeded per simulation by the forge. The generic storylet/dispatch layer therefore applies to any world unchanged; world-specific packs (Fäden, 9.3) are additive flavor reserved for canonical or owner-curated worlds.
- **Status rules** (two dimensions, not one): dockable = `status='active'` **AND** `simulation_type='template'` — epoch game-instance clones (type `game_instance`, statuses lobby/foundation/competition/reckoning) never appear on the chart; note `archived` exists both as a status and as a type, with different meanings. `draft` forge worlds are not on the chart as worlds (abandoned ones surface as Geisterinseln per the operational definition in 7.3); archived template simulations remain visible as **Verstummte** — faded glows that no longer accept docking, mourning markers in the topology (and a candidate for later "ruins diving" content).
- **Hospitality default for new worlds**: `nur Echos` until the owner explicitly raises it — visitors arrive read-mostly by default; sovereignty is opt-down, impact is opt-in. Absence semantics are fail-closed: a missing `simulation_settings` row reads as `geschlossen` (the platform's F32 settings discipline), and a seed migration writes the explicit `nur Echos` default for every existing active simulation — the default is data, not code fallback.
- **Ambassador bootstrap**: a new world has no ambassador until its first embassy is approved (Erstkontakt loop, 7.1); until then, embassy services are simply absent — another reason early visits feel like expeditions, not tourism.

---

## 9. Quests — the storylet architecture

Four content layers, by authoring cost ↓ and instantiation breadth ↑:

### 9.1 Depeschen (procedural dispatches)

Template-driven, instantiated against live entities. Template families: **deliver** (cargo X from building A to agent B), **fetch** (acquire vector-cargo from a zone matching criteria), **survey** (chart N nodes in region R / map zone Z abroad), **investigate** (establish facts about event E / agent relations), **escort** (bring agent across the Drift — high-stakes, bond-relevant), **introduce** (carry a first contact between two agents in different worlds — may *propose a new embassy*: player actions feeding the platform's connective tissue).

Instantiation pipeline: selector queries pick real rows (filtered by sim, zone type, security, relationship type, event recency) → mechanical skeleton fixed by template (checks, costs, rewards, effect vocabulary) → LLM dresses prose via a new `GenerationService` façade (`generate_dispatch_flavor`), per-simulation prompt templates, budget purpose `travel_narrative`, template-text fallback when budget-capped. **LLM never writes mechanics** — only surface text (the KoDP/Wildermyth pattern, and the only sane LLM/QBN division of labor).

### 9.2 Storylets (QBN scenes)

The universal scene format, authored as YAML content packs (`content/drift/**` — the A1.5 pack pipeline *generalized*: loader root, schema module and both CI guards are currently dungeon-hardwired, so DRIFT adds a parallel travel schema module and extends `validate_content_packs.py` + `lint-no-content-in-python.sh` to `content/drift/**` as named plan work; thereafter the flow is identical: schema validation in CI → generated seed migrations → runtime registry cache). A storylet: requirements (qualities: affinities, clearance, dissonance band, cargo, scars, bond depths, zone/building context, active resonance), 2–4 options with checks (broad/narrow difficulty à la Fallen London), outcomes that write qualities and may invoke the effect vocabulary (11). Drift storylets key off (node type × frequency × weather × dissonance band); Begehung storylets key off (zone type × security × building type × world). Because requirements reference taxonomy values and entity attributes — never hardcoded world identity — the generic storylet pool serves every current and future simulation unchanged (pillar 7); a `world` key is an *optional narrowing* used by flavor packs, not a prerequisite.

### 9.3 Fäden (hand-authored threads)

One signature arc per canonical world (5–8 storylets each, bilingual), carrying that world's central tension, plus one platform arc (the relay-builders mystery). Launch set:

- *Velgarien*: *Der Aktenwanderer* — a ministry clerk wants to defect… into the files themselves.
- *Gaslit Reach*: *Lacewings Konkordanz* — the chief cartographer's cross-referencing has found a chart that exists in both worlds *first*.
- *Station Null*: *Nominal* — prove to HAVEN (or to yourself) that the 194 are not on board. The thread's checks are dissonance-inverted: some options *require* Doppelt band — being half-lost is the only way to see what HAVEN hides.
- *Speranza*: *Die Leitung hält* — a Tube collapse severs a contrada; a Träger is the only signal that can cross.
- *Cité des Dames*: *Das fehlende Kapitel* — Christine's allegory has a chapter no one remembers writing; provenance leads through every other world (the deliberate "visit everyone" thread).

### 9.4 Echo-Jagd (emergent, zero-authoring)

Pick any `event_echo` visible in a chronicle and trace it upstream: each hop (echo_depth) is a small investigation (find the target event, identify the vector, cross to the source sim, locate the source event/zone/agents). Reward: resonance core + a chronicle byline ("Herkunft geklärt durch Träger <name>"). Turns existing DB rows into an inexhaustible quest type and teaches players to *read the platform's living data* as content.

### 9.5 Quest sources (diegetic)

Bureau dispatch board (home), embassy noticeboards (rotating), bonded agents (whisper type `question` upgraded to a hook — bonds become quest-givers, paying off the bond system), chronicle classifieds ("Gesuche" — a new chronicle section generated from open dispatch slots), found objects (cargo with a destination written on it).

### 9.6 Authoring rules (binding, from verified sources)

1. **Points of light**: every storylet/dressed dispatch anchors on one or two vivid, specific details — ideally pulled verbatim from the referenced DB entities (a building's `description`, an agent's `character`, a zone's `security_level` made tangible) — and leaves the rest in shadow. No scene-painting walls of prose.
2. **Calculated ambiguity**: world-facts in generated text are hedged hearsay ("man sagt…", "die Akte behauptet…") so DB-sourced and procedurally varying lore can never contradict itself. Exception, per the source's own nuance: **geography and chronology are absolute** — names of zones, streets, buildings and the order of events are stated plainly.
3. **Self-containment**: every storylet must read correctly out of order and on re-read; no storylet may assume another fired first unless its requirements guarantee it.
4. **The Wildermyth trust rule**: generated prose may never contradict an agent's stored `character`/`background`/relationships or a simulation's canon. Breach of character is the documented attachment-killer; the LLM dresses who the agent *is*, selected by the template engine from live data.
5. **Tooling over caps** (ink lesson): branching breadth is handled by investing in the selector/condition DSL in the YAML packs (queries over qualities + entity attributes), never by limiting how contextual content is allowed to be. The DSL's binding primitives are sketched in Appendix 24; the full grammar is plan-doc work.
6. **Mechanics are template-owned**: no generated text ever defines a check, cost, reward or effect. (Restates pillar 3 as an authoring rule; enforced by schema validation in CI.)

---

## 10. Begleiter — companions

A Träger may carry **one** companion frequency (two with top bandwidth class):

- **Bonded agents** (home sim, bond depth ≥ 3): grant their aptitude profile to checks, a vector affinity bonus, exclusive storylet options, and travel banter (whisper pipeline, new trigger contexts). Cost: being carried strains the agent — a bad run (Zerfaserung, overstay, high dissonance) strains the bond (existing strain/recovery mechanics; *real stakes for the bond system*). A depth-5 bond surviving a Zerfaserung together → unique memory + scar variant.
- **Foreign hires**: at embassies, ambassadors broker temporary local guides (escort durations only, Siegel cost): access to their relationship graph (a guide with `contrada_kin` opens Speranza shelters; a `co_conspirator` opens Velgarien backdoors).

Companions are narrative carriers first (Sunless officers lesson): each bonded-agent profession gets a small option-layer across storylet families rather than one quest silo.

---

## 11. Impact — the effect vocabulary

Closed, declarative catalog (the only way quests touch the world; modeled after ability-pack `effect_params`; every application audit-logged):

| Effect | Writes to | Notes |
|---|---|---|
| `spawn_event` | `events` | typed, `impact_level`-capped (1–10 scale); surfaces in chronicle |
| `emit_echo` | `event_echoes` | `echo_vector` + `echo_strength`; composes `spawn_event` + echo rows in one RPC (an echo requires a NOT NULL source event); hard schema limits: `echo_depth` ≤ 3, never targets the home sim (`no_self_echo`); the cross-world ripple |
| `inject_agent_memory` | `agent_memories` | importance-capped; **agents later recall the Träger in chat** (pgvector retrieval) — the single highest-payoff effect. Requires a `memory_source_type` ENUM extension and an embedding write at insert (AgentMemoryService path; embedding cost billed under the travel purpose) |
| `grant_agent_effect` | new `agent_travel_effects` | home sim only; small persistent boons (the existing `agent_dungeon_loot_effects` is dungeon-coupled — closed `effect_type` CHECK plus FK to dungeon runs — so travel boons get their own table) |
| `bond_event` | `bond_memories`/whispers | milestone/strain writes |
| `emit_fragment` | `journal_fragments` | travel feeds the Resonance Journal (new source_type `travel` — a CHECK-constraint migration plus a fragment_type mapping decision, not just a new value) |
| `chronicle_mention` | new `mentions JSONB` on `simulation_chronicles` | byline/section credit next edition (chronicles today are a single generated text blob — the mentions column plus a prompt-template section make the credit structural, not hoped-for) |
| `zone_modifier` | new `zone_modifiers` | **home sim only**, temporary (festival, blackout, vigil…), feeds future storylet/context |
| `propose_embassy` | embassy `proposed` row | from *introduce* quests; sim owners approve |

**Asymmetry & hospitality**: at home, full vocabulary. Abroad, world-directed effects are capped — `spawn_event` (impact_level ≤ 3) / `emit_echo` / `inject_agent_memory` (importance ≤ 5) / `chronicle_mention` — while **traveler-self effects** (`emit_fragment`, `bond_event`) are always allowed abroad: they write the Träger's own journal/bonds, are hospitality-exempt by definition, and carry pillar 4's guarantee even in `geschlossen` worlds. All world-directed writes are governed by the target simulation's **Gastfreundschaft** setting (per-sim `simulation_settings`, fail-closed to `geschlossen` on a missing row — 8.7): `geschlossen` (read-only world: no world traces; self-effects still fire), `nur Echos`, `standard`, `offen`. **Every cross-sim write path passes the same gate**: quest effects, Zerfaserung scatter (12) and Spuren (15.7) all route through the hospitality-validating effect RPC family — no second, ungoverned channel exists. Owners keep sovereignty; travelers keep meaning. RLS scope, stated honestly: user-path reads/writes stay RLS-enforced, but cross-sim effect application is impossible under user-JWT RLS by design — the EffectResolver executes under `service_role` per ADR-006 (backend-only, role-validated), and hospitality + caps + in-RPC audit logging *are* the authorization layer.

---

## 12. Zerfaserung — failure & legacy

At Kohärenz 0 in the Drift: the carrier unravels.

1. Carried cargo scatters as `event_echoes` addressed to *random* reachable simulations with hospitality ≥ `nur Echos` (the home sim is excluded by `no_self_echo`; each echo composes its required source event), written through the same hospitality-gated effect path as quest effects (11) — **your failure literally becomes world content** other players and chronicles will encounter.
2. A **Träger-Wrack** node appears on the shared chart at the spot, holding salvageable remnants (explicitly forfeited — see 7.3) and your final log line (player-composed in the death modal, moderated per 22.5, or auto-generated).
3. You wake at your anchor with a **Narbe** (scar): a lasting quality, negative-but-interesting — e.g. *Zweitgestimmt* (one frequency permanently cheaper, home dissonance floor +5), *Statisches Ohr* (hear pings one hop further; false-ping rate +10% **at Verstimmt band and above** — band-gated so 6.3's reconstructability contract holds at Klar). Scars gate exclusive storylet options (Skies facets lesson: failure as characterization, not just penalty). Cap and dilution rules to keep scars special: max 3 active; a new scar beyond the cap replaces the oldest via a deliberate, Siegel-priced ritual ("lasting until ritually shed" — reconciling the earlier "permanent" vs "may replace" wording). Anti-farming: an empty-manifest Zerfaserung yields no scar and leaves no salvageable wreck — nothing was at stake, nothing marks you.
4. No account-level loss, ever. The run is the stake; the traveler is the continuity.

Two verified lessons are structural here: **map knowledge is decoupled from progression currency** (discoveries, surveys and purchased routes always survive Zerfaserung — Sea's chart-inheritance dilemma is impossible by construction), and **story never repeats on failure** (threads keep their state; the postmortem's most-hated flaw — re-grinding early story after death — cannot occur). World-state persistence across failure is the Skies Legacy principle taken to its limit: not only does the world you changed persist — your failure *itself* becomes part of it (scattered echoes, the wreck, the scar).

---

## 13. Weather — substrate resonances as tides

Active `substrate_resonances` project onto the chart as moving storms (7.3) *and* as global modifiers keyed by archetype: The Deluge (bandwidth costs ↑, commerce cargo value ↑), The Shadow (dissonance ↑, spy-flavored storylets unlock), The Tower (a corridor collapses for the duration — reroute the metaverse; salvage washes up along its banks, wreck and debris density ↑), The Prometheus (scan range ↑, ghost islands more stable — but false-ping rate ↑: clarity reveals things that aren't there). The storm-archetype list is **closed per release**, and each archetype must pass KPI 7 (two levers in tension) at review — no open-ended ellipsis. Because resonances are real-world-driven, the metaverse's weather is genuinely unpredictable and shared by all players — appointment content nobody scheduled. Weather-camping is priced: idling on the chart costs a small Dissonanz trickle per wall-clock interval (the Drift erodes the stationary), so "wait out the storm" is a choice with a cost, never a free dominant strategy. Forecasts appear in the player-facing travel-news feed — rendered with the shared `VelgDispatchTicker` primitive; the existing admin DispatchTicker is an ops-audit crawl and not reusable as-is, so the feed itself (data model + public endpoint + placement) is named plan work.

---

## 14. The Home-Port Loop

Returning home: dock → **Entladung** (cargo materializes via effect vocabulary; ceremony UI, one reveal per item) → **Bureau-Debriefing** (surveys paid, clearance progress, next dispatches) → journal fragments emitted → next chronicle edition carries your deeds → agents at home *remember*. The retention engine is the visible difference between your simulation before and after a voyage. Asynchronously: whispers from bonded agents reference your travels; the dispatch ticker mentions notable Träger feats platform-wide.

Progression axes: **Frequenzprofil** (7 affinities; raised by use; gates routes and options — the Fallen-London quality ladder), **Clearance** (Bureau ranks: Aspirant → Feldkartograph → Vermesser → Grenzgänger → Kartograph 1. Klasse; gates legal routes, embassy services, dispatch tiers), **bandwidth class** (slots/scan), **scars**, and **attunements** (existing journal attunements get a `travel_option` system hook — a CHECK-constraint extension on `journal_attunements.system_hook` — so crystallizing constellations feeds travel perks; the Resonance Journal becomes the contemplative twin of the travel game). Progression formulas, rank thresholds and the full price book are plan-doc Zahlenwerk.

---

## 15. Other Travelers — live presence & asynchronous traces

The chart, the weather, discoveries, wrecks and traces are shared platform state — so DRIFT is multiplayer *by construction*; the design question is how much of each other concurrent players perceive and what they can do together. The answer is layered, and every layer obeys one contract:

### 15.1 The non-interference contract

**No player can ever block, damage or slow another player — outside explicitly opted-in groupings** (Konvoi, Mitfahrt, Rettung donation), within which any member can unilaterally exit at any time at no cost beyond their current position; the exit guarantee is what makes the carve-out safe and testable. No PvP, no contested resources except singular *honors* (Erstvermessung/Erstkontakt are server-arbitrated first-write-wins; the runner-up gets partial survey credit and a "bereits vermessen" note, never nothing). Co-presence only ever adds options. This keeps every multiplayer feature safe to ship incrementally and keeps the Drift melancholic rather than hostile.

### 15.2 Same-frequency sighting — presence, sharded diegetically

Concurrent Träger on the chart see each other **only when tuned to the same frequency**: other carriers appear as moving signals with callsign and heading. This is the load-bearing original idea — the fiction (you cannot see what you are not tuned to), the social texture (each of the seven vectors is its own "shipping lane" community), and the scaling story (presence traffic shards ÷7 by frequency, further by chart region cell) are the same mechanism. Sweeping frequencies in Helm mode briefly shimmers *other players* in and out along with the geography. In Begehung, visitors in the same simulation see each other as fellow Träger in the zone view; locals (agents) may comment when a world has unusually many visitors — current `events` + visitor count as storylet dressing.

Because Takt mode is each player's own clock, co-presence is ghostly by nature: others move at their own pace, like distant ships. (Prerequisite, fixed here: **the weather clock is global wall-clock**, not per-player Takte — storms advance on server time; a player's Takt *samples* current global weather. One shared weather reality for all players and both traversal modes. Resume fairness: a resumed run re-samples weather at current wall-clock with no retroactive Takt cost; a one-line weather briefing covers the elapsed gap.)

### 15.3 Signalgruß — the minimal interaction

Two Träger within range on the same frequency can exchange a **Signalgruß**: a hail (small expressive set, Bureau-stationery emotes) plus optionally a **survey exchange** (peer-to-peer chart-data swap, both consent, no currency). Deliberately the only direct interaction at launch of presence: lightweight, unmissable, ungriefable.

### 15.4 Rettung — failure becomes a social moment

When a Träger hits Kohärenz 0, Zerfaserung does not finalize instantly: a **distress window** opens (~10 wall-clock minutes; the player may also concede immediately). The beacon broadcasts on *all* frequencies — the one signal everyone sees. Any player who reaches the position in time can stabilize the casualty by donating Bandbreite/Kohärenz (storylet-framed), earning a unique honor ("Bergung"), a **Träger-Verbindung** (a `traveler_connections` row between the two profiles — player↔player state has its own table; `inject_agent_memory` targets agents, not profiles), and the rescued player's run continues battered but alive. Lifecycle, pinned: `distress_beacons` rows carry a TTL; rescuer acceptance is first-write-wins CAS on `accepted_by`; expiry finalization and rescue race through the same status guard (`WHERE status='distress'`), so double-finalization is impossible; if the casualty disconnects, the window runs to term anyway. The waiting player is not idle: distress mode is playable (beacon tuning, jettison decisions, wreck-log composition) and immediate concede stays one click. Anti-farming: stabilization credits Bergung honors only after a minimum window duration, per-pair rescue credit is seasonally capped, and rescue pairs are visible in the Bureau ledger. Unanswered windows finalize into the normal wreck/scar flow (12). Rescue converts the game's loneliest moment into its strongest community story — and remains fully optional and async-compatible.

### 15.5 Mitfahrt — ferrying

A Träger with spare bandwidth class can carry another player's Träger as **passenger**: the passenger pays no movement costs, takes reduced dissonance, and earns no *survey credit* en route (the ferry does) — but does acquire **passive route knowledge** of traversed edges (usable for Notfrequenz limping and manual return; no Siegel value): a ferried newcomer is never stranded without a way home, keeping the "never softlocked" rule (6.2) intact for the design's own flagship scenario. Abandonment semantics: if the ferry logs off or unravels mid-route, the passenger is deposited at the last node passed with a one-time Bandbreite grant sufficient to reach the nearest relay. Primary use: veterans ferrying newcomers across the deep Drift to a far world — onboarding as a social act, paid in **Fährmann reputation** (deliberately *not* Siegel: no player-to-player currency channel exists anywhere in the design, which also closes the alt-funnel).

### 15.6 Konvoi — traveling together

2–4 Träger link at a dock or relay into a convoy: movement resolves on a **synchronized turn window** (the convoy moves when all members have committed, or on a generous timeout — async-friendly lockstep), scan ranges pool, deep-Drift dissonance is reduced for everyone (company keeps a self coherent — the diegetic reward for playing together), and convoy storylets unlock multi-Träger options (checks may combine the members' affinities — a dream-tuned and a commerce-tuned Träger together pass gates neither could alone, which also motivates *mixed-frequency* convoys: **the convoy link is diegetically a mutual attunement** — members carry each other's frequencies as a side-band, so linked Träger see each other regardless of tuning, becoming each other's eyes across the layers; technically the convoy subscribes an additional `drift:convoy:<id>` channel, 15.8). Lockstep, pinned: the timeout auto-commits "hold position"; each member commits their *own* move (a convoy is a synchronized clock, not shared steering); an edge impassable on a member's vector costs that member the off-vector rate but never blocks the group; any member can unlink at any time at no cost (15.1). Cost: Splitterfänger prefer convoys (more cargo in one place), and storm effects hit the group jointly — a known, opted-in group risk under the 15.1 carve-out. Threads and Echo-Jagd get shared-instance variants: the quest state lives on the initiator's instance; all participants hold per-member checkpoint credit that survives drop-out (the per-player thread-persistence guarantee is kept — what is shared is the *instance view*, never the players' progress records).

### 15.7 Asynchronous traces (unchanged baseline)

Erstvermessung names on the chart, purchasable published routes, wrecks with final logs, **Spuren** (short log entries per building, rolling-capped: max N per player per building, the oldest replaced on repeat visits — never unbounded accumulation; hospitality-gated and moderated per 22.5, visible to later visitors — Dark-Souls-message energy under Bureau stationery), seasonal Bureau leaderboards (distance, surveys, threads completed, echoes traced, Bergungen).

### 15.8 Engineering reality

Presence is ephemeral state over **Supabase Realtime** (already a first-class platform capability in the hybrid pattern): channels sharded as `drift:freq:<vector>:cell:<region>` and `begehung:<simulation_id>`, plus `drift:convoy:<id>` for convoy side-band presence (15.6) and one **unsharded `drift:beacons` channel** — distress beacons must be platform-visible, not shard-limited, or the ÷7-frequency × region-cell sharding math makes the 10-minute Rettung window statistically unanswerable at alpha-scale concurrency. Throttled position broadcasts, no DB writes for mere presence. Authoritative game state never travels over presence channels — moves, rescues, convoy commits and exchanges all go through the same atomic RPCs as solo play (`fn_travel_move`, `fn_rescue_stabilize`, `fn_convoy_commit`, `fn_survey_exchange`); Realtime only makes others *visible*. Durable multiplayer state gets four small tables: `travel_convoys` (+members), `distress_beacons` (TTL), `traveler_reputation` (Fährmann/Bergung tracks), `traveler_connections` (Rettung bonds, 15.4). Many concurrent players are absorbed by sharding (÷7 frequencies × region cells), and relays act as designed congregation points — where seeing many signals at once is atmosphere, not noise.

---

## 16. UI/UX Sketch

- **Drift chart**: full-screen **Three.js (WebGL)** view — own component family `frontend/src/components/drift/`, **unconditionally a light-DOM render root** with `getRootNode()`-scoped style injection per the `SimulationWorldMap` reference pattern (the completed spike settles the "if WebGL is used" hedge; for the record, `CartographersDesk` is an SVG schematic, not a canvas precedent — the layout precedent is `multiverse/map-force.ts`, 7.1). Sonar-ping aesthetic; frequency tuning as a physical dial; redaction artifacts at high dissonance. The same canvas hosts both traversal clients: Takt mode renders discrete moves with transit animation; Helm mode (7.6) runs the continuous loop with throttle/heading controls and the live frequency sweep.
- **Begehung**: the existing per-simulation world map (`SimulationWorldMap`) gains a presence layer: Träger position, window counter, zone-graph affordances, storylet pins.
- **Storylet panel**: Bureau-dossier styling (shared frame styles, design tokens, `bureauPanelFrameStyles` last — per CLAUDE.md).
- **Cargo hold / Träger console**: resources, manifest with cargo-twist indicators, companion card, scars.
- **Dispatch board** (home) and **noticeboards** (embassies): rotating offers.
- All bilingual (msg()), WCAG AA, microanimation language per feedback memory (180–280 ms reactive, 480–900 ms ceremonial). The ceremonial inventory is larger than two moments: docking/arrival, Entladung, Erstvermessung, Erstkontakt, Umstimmung, the Zerfaserung sequence (scatter → wreck → wake-at-anchor, staged), Bergung, and the first re-crossing of the home broadcast edge — the plan doc carries the full table (moment, tier, duration band, reduced-motion fallback).
- Accessibility beyond motion: the chart gets a **non-visual access mode** (keyboard/screen-reader traversal exposing nodes and adjacency as an ARIA list — this is what "screen-reader-safe rendering" concretely means), and the seven frequency colors get glyph/pattern redundancy (color is never the sole channel; the WCAG AA claim must cover the canvas, not just the HTML chrome). Band-2 lies resolve under a fixed protocol: mirage options are marked retroactively after band recovery, false pings get a reconstruction pass — the truth is always recoverable (6.3). Dissonance UI distortion honors `prefers-reduced-motion`.

---

## 17. System Architecture Mapping

New (high-level; detail belongs to a plan doc):

- **Tables**: `traveler_profiles` (anchor sim, resources, clearance, frequency, affinities), `travel_runs` (CAS resource columns + checkpoint JSONB, single-active-run-per-user constraint — §6), `drift_chart_nodes` / `drift_chart_edges` (seeded + versioned base topology **plus runtime-mutable overlay rows** — wrecks, ghost islands, storm projections, new broadcast glows — with TTL where ephemeral), `traveler_discoveries` (per-user FoW), `travel_cargo` (7.8), `travel_quest_templates` (from content packs) / `travel_quest_instances` / `travel_quest_participants` (in the P0 schema, single-row until group phases), `traveler_scars`, `zone_modifiers`, `zone_adjacencies` (8.2), `travel_traces`, `published_routes`, `ghost_island_lore` (public projection, 7.3), `agent_travel_effects` (11); multiplayer: `travel_convoys` (+members), `distress_beacons` (TTL), `traveler_reputation`, `traveler_connections` (15.8). Schema side-work, consolidated as one constraint-extension package: `simulation_chronicles.mentions JSONB`, `journal_fragments` source_type CHECK extension, `memory_source_type` ENUM extension, `journal_attunements.system_hook` CHECK extension, achievements category CHECK extension, buildings `sanctuary` flag (+ `active_buildings` view refresh in the same migration), embassy-ambassador `agent_id` linkage repair (8.5).
- **RLS posture (per ADR-006)**: per-user rows strictly user-scoped; the shared chart topology is public-read; `traveler_discoveries` is per-user and **server-filtered** — undiscovered node data never ships to the client (FoW is integrity-relevant: shipping hidden positions would undermine the survey economy, so the public chart endpoint serves topology, never discovery state). Cross-user operations (rescue donation, convoy commits, royalty crediting, trace writes) are SECURITY DEFINER functions with backend-only grants and role validation. The EffectResolver executes under `service_role` (11) — hospitality + caps + in-RPC audit are the authorization layer.
- **RPCs (atomic, ADR-007 — CAS wherever access is concurrent)**: `fn_travel_move` (CAS resources + position; Helm mode passes a traversal segment), `fn_apply_quest_effects` (hospitality + caps + audit — the single gate for all cross-sim writes), `fn_survey_deliver` (first-write-wins Erstvermessung CAS), `fn_zerfaserung` (opens the distress window; finalization and rescue race through one `WHERE status='distress'` guard), `fn_rescue_stabilize` (CAS `accepted_by`), `fn_convoy_commit`, `fn_survey_exchange`, `fn_route_purchase` (royalty credit + anti-self-buy check), `fn_trace_write` (hospitality + rolling cap), `fn_noticeboard_rotate`, `fn_profile_progress` (affinity/clearance raises). **Audit**: every mutating RPC writes `audit_log` in-transaction via a shared SQL helper — the platform's all-mutations audit rule gets no Python-only escape hatch here.
- **Scheduler**: one named owner, `TravelLifecycleScheduler` (BaseSchedulerMixin): global weather advance, distress-window expiry, noticeboard rotation, ghost-island stability. All expiry actions pass the same CAS guards as player actions, so scheduler-vs-player races resolve deterministically.
- **Services**: `TravelEngineService` (state machine + checkpoints), `DriftChartService` (gen + queries), `TravelQuestService` (selectors + instantiation), `EffectResolverService` (closed vocabulary), `TravelStoryletService` (registry from packs). Routers HTTP-only; everything `get_effective_supabase`; responses `SuccessResponse[T]`; Sentry tags (service name + simulation_id) on every failure path.
- **Content**: `content/drift/**/*.yaml` (storylets, dispatch templates, node types, threads) through the **generalized** pack pipeline (9.2 — new travel schema module + CI-guard extension, then: validation → seed migrations → registry cache).
- **Generation façade**: `generate_dispatch_flavor`, `generate_drift_storylet_dressing`, `generate_wreck_log` — typed DTOs, per-sim prompt templates. Budget: new purpose rows in the **`ai_budget`** table (the actual mechanism — no object named `ai_budget_caps` exists) + `BudgetEnforcementService` + `ai_circuit_state`; the new template_types double as the billed purposes, and their purpose rows are **seeded in the same migration that introduces the callers** (the pre-check is fail-open for unseeded purposes). Scoping rule: Zwischenraum generation (between sims) bills and resolves against the Träger's *home* simulation. Locale precedence: Begehung prose in the destination's `content_locale`, dispatches in the home locale, `en` fallback. Template fallbacks mandatory.
- **Reuse, named precisely**: probability checks via `combat/skill_checks.py` `resolve_skill_check` (the epoch-entangled operative-mission formula is the *wrong* target), whisper pipeline for banter/hooks (needs a trigger-strategy extraction — not a drop-in), fragment emission (journal), chronicle aggregation (via the new mentions column), `VelgDispatchTicker` UI primitive for the net-new player-facing travel-news feed (13), achievement system (travel category via CHECK extension), substrate resonance projection (weather).
- **Admin surfaces** (plan-doc scope, listed so they aren't lost): hospitality setting UI in sim settings, owner-visible trace ledger, Spuren report queue, travel content-pack admin, scheduler panel row.

---

## 18. Cross-System Integration Map

| Existing system | DRIFT relationship |
|---|---|
| Embassies / connections | chart topology, docks, ambassadors as quest anchors |
| Event echoes | impact channel + Echo-Jagd quest source + Zerfaserung scatter |
| Substrate resonances | weather + storylet gates |
| Agent bonds | companions, quest-givers, stakes (strain), shelters |
| Resonance Journal | fragments from travel; attunements gain travel hooks |
| Resonance dungeons | boarding/threshold encounters resolve as themed runs |
| Chronicle | deeds become news; classifieds offer quests |
| Bureau dispatch/ciphers | travel news; cipher codes can hide chart coordinates (ARG ↔ chart) |
| Epochs | v1: separate. Later (P4): epochs as chart-visible wars — travel advisories and blockades **as cost/dissonance modifiers or advisories only, never impassable routes**, or the coupling violates KPI 9; recorded now so the P4 design doesn't inherit an impossible constraint pair |
| Forge | drafts → ghost islands; published sims → new broadcast glows; map geometry → Begehung graphs |

---

## 19. Phasing

- **P0 — Vertical slice** (the proof): Velgarien ↔ Gaslit Reach via the seeded Threshold embassy. One chart region, one frequency pair — **memory/architecture** (the pair the seeded corridor actually carries; `language` is seeded on Velgarien↔Speranza) — resources + Takte + window, deliver/fetch dispatch templates, 3 effects (`spawn_event`, `inject_agent_memory`, `emit_fragment`), home Entladung ceremony. **P0 names its substrate explicitly** (it is a hidden platform, not one bullet): the QBN storylet engine + `content/drift` pack pipeline + storylet panel (the quest substrate, not deferrable polish); the mode-agnostic engine's P0 event subset (7.5 — a versioned event-stream interface with declared extension points for P1/P3 emitters); the hospitality setting in the schema with fail-closed reads and the `nur Echos` seed (P0's foreign writes are governed from day one); `travel_quest_participants` in the schema (single-row until group phases); the Chapel of Silence hardcoded as P0's sanctuary sink; a first-session flow (tutorial dispatch at home → first crossing, instrumenting KPI 3); and a minimal failure floor — Kohärenz 0 → forced return + cargo scatter (no wreck/scar/distress yet), Dissonanz capped at band Doppelt. The plan doc splits P0 into sub-milestones (P0a schema/engine, P0b chart + travel, P0c quests + effects, P0d Begehung + ceremony) with acceptance gates. *Success criterion: a playtester returns home, opens the chronicle, and finds themself in it* — which requires a chronicle-edition trigger post-Entladung (today's editions are editor-triggered on-demand, so the auto-generation hook is named P0 work).
- **P1 — The five worlds, and all worlds** (split — P1 is 2–3× P0's size): **P1a (worlds)** — every *active* template simulation dockable via the generic layer (including forge-created ones, automatically — pillar 7 / 8.7, with Erstkontakt flow), full seven-frequency system with progressive disclosure (unlock ladder keyed to clearance; minute-1 tuning is guided, not a seven-way cold choice), hospitality owner UI. **P1b (economy & presence)** — surveying + autopilot, published routes, embassy noticeboards, Echo-Jagd, live same-frequency presence + Signalgruß (15.2–15.3). The global weather clock moves to P3 with storms (in P1 it would have nothing visible to drive). *Done when: a freshly forge-published world with zero hand-authored content is docked, surveyed and quested by a playtester.*
- **P2 — People**: companions (bonds), foreign hires, threads 1–3 (bilingual authoring volume owned here), scars + Zerfaserung full loop, wrecks, Rettung (distress windows) + Mitfahrt (15.4–15.5). *Done when: a playtester unravels, is rescued by another live player, and both find the Verbindung recorded.*
- **P3 — Weather & frontier**: global weather clock + resonance storms, ghost islands, Splitterfänger + dungeon handoff, relay mystery arc, remaining threads (authoring owned here), **Helm-Modus** (real-time traversal client over the now-dense chart, 7.6; WebGPU re-evaluation point). *Done when: a storm visibly reroutes the playtest cohort, and a Helm run completes a thread with Takt parity verified.*
- **P4 — Society**: Spuren traces, leaderboards/seasons, chronicle classifieds, epoch interplay (advisory-only, 18), convoy exploration (shared-instance variants activate the P0 participant model). *Done when: a convoy completes a shared Echo-Jagd and every member's record survives a mid-run drop-out.*

Each phase ships behind **runtime `platform_settings` gates** — per-feature keys grouped by phase (e.g. `drift_p0_enabled`), read fail-closed via `parse_setting_bool`, surfaced through a narrow public state endpoint (the alpha suite's *runtime* half — settings + endpoint + admin tab — not its build-time define). Gate-off semantics: no new runs start; in-flight runs are checkpoint-frozen with resources intact. One platform kill-switch (`drift_emergency_return`) force-returns all travelers home without loss — the Bureau-Ops emergency-brake pattern. Content volume per phase (storylet counts, bilingual word budget, authoring owner) is tabulated in the plan doc.

---

## 20. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Content treadmill | DB-driven instantiation (9.1, 9.4) over hand-authoring; packs for skeletons only |
| LLM cost explosion | existing budget caps/circuit breaker; template fallbacks; prose-only generation; cache dressing per (template, entity-tuple) |
| Foreign-sim griefing | hospitality settings + capped vocabulary + audit log + owner-visible trace ledger |
| Two-scale complexity overwhelms new players | P0 onboarding = home-sim-only tutorial dispatch before first crossing; clearance gates pace the chart |
| Chart staleness after exploration saturates | frequency layers, weather, rotating noticeboards, Echo-Jagd (renewing by nature), seasons |
| Turn-based feels static vs. "sailing" fantasy | transit animation, ambient sound design, hazard telegraphing — feel via presentation, not via real-time mechanics |
| DB read amplification (public browsing as gameplay) | existing public-API caching (platform_settings TTLs); the shared chart topology is cache-friendly — per-player FoW reads are per-user by definition, never cached, and server-filtered (17) |

---

## 21. Design KPIs (testable contracts)

1. Every quest instance references ≥ 2 live DB entities by id, drawn from a bounded entity universe (agents, buildings, zones, events, embassies, connections; chart nodes and cargo instances satisfy the count via their `origin_*` entity refs — survey templates reference their target region's underlying entities).
2. Every completed quest applies ≥ 1 persistent effect visible outside the game mode (chronicle, agent chat, journal, map). Hospitality carve-out: in `geschlossen`/`nur Echos` worlds the guarantee is met by the always-allowed self-effects — the journal fragment is the floor (11).
3. First session reaches a foreign simulation in < 20 minutes — median over new players, instrumented via `drift_first_session_start` / `drift_first_foreign_dock` events; the full gating chain (membership → tutorial dispatch → crossing) is time-budgeted in the plan doc.
4. A repeat journey over surveyed routes costs ≤ 25 % of the first journey's *player attention* (Takt mode: decision count, with autopilot collapsing it to one action; Helm mode: time-compressed minutes with margin verified). Resource cost stays full — the KPI measures attention, not economy.
5. No storylet outcome mutates *world state* outside the effect vocabulary. (Player-quality writes — affinities, scars, cargo, thread progress — are the QBN layer's own declared channel per 9.2, validated by pack schema and audited separately.)
6. With the single setting `drift_ai_enabled=false`, the entire game remains playable on template text; the LLM touchpoint list is enumerated in the plan doc and the blocked state is exercised by a CI config.
7. **Peacock-Wind rule**: every named chart phenomenon pulls at least two resource levers in tension — and the storm-archetype and node-type lists are **closed per release** (13, 7.3), so the rule is checkable, not aspirational.
8. **Mode parity**: every quest, discovery and effect is reachable in Takt mode; Helm mode adds texture, never exclusive content. Enforcement locus: authoring-time — any Helm-only affordance (e.g. the Trägerlicht stance, 7.6) must declare its Takt equivalent in the pack schema.
9. **Non-interference**: no player action can ever block, damage or slow another player's run **outside explicitly opted-in groupings with free unilateral exit** (15.1); singular honors are server-arbitrated first-write-wins with partial credit for the runner-up.
10. **Universal visitability** (pillar 7): a freshly forge-published simulation with zero hand-authored travel content is dockable and questable from its data alone.
11. **Never softlocked**: from any reachable chart position — including a ferried passenger's (15.5) — home is reachable via Notfrequenz at some cost.
12. **Solo-completability**: every quest and thread is completable without any other player; group features add options, never requirements.
13. **Failure is content** (closing pillars 2 & 5's KPI gap): every finalized Zerfaserung produces ≥ 1 world artifact (wreck, echo set or chronicle line), and every platform-first survey renders on the shared chart within one refresh.

The KPI-to-enforcement table (id → phase, measurement method, query/protocol, owner) is mandatory plan-doc content; ch. 21 defines the contracts, the plan defines the harness.

---

## 22. Decisions (resolved 2026-06-12)

All six open questions were decided by the project owner on 2026-06-12. These are binding for the plan doc.

1. **Naming — KEEP ALL THREE.** "DRIFT" (mode), "Zwischenraum" (the space), "Träger" (player role) stay as written. Bilingual load-bearing (Träger = courier *and* carrier wave), consistent with the Bureau register.
2. **Home anchor — MEMBERSHIP REQUIRED.** DRIFT requires a home-simulation membership; no Wartesaal limbo state. The mode is a recruitment funnel: "find a home" becomes part of onboarding fiction. Keeps the return-loop design honest — home must be real for the loop to mean anything.
3. **Monetization — STRICTLY COSMETIC.** forge_tokens buy cosmetics only (stamps, callsign flair, wreck-log styling). No bandwidth, no window extensions, no Siegel purchasable. Window extension stays purely diegetic (lodging, bonds, clearance). Protects economy integrity and the Citizen-Sleeper window tension.
4. **Epoch coupling — INVISIBLE UNTIL P4.** DRIFT v1 fully decoupled from epochs. No read-only markers earlier; coupling arrives as a P4 "Society" feature once both systems are stable. Avoids cross-balancing two complex live systems prematurely.
5. **Trace moderation — HYBRID: AUTO-FILTER + POST-MODERATION, scope: ALL traveler-authored strings.** Spuren, wreck final logs, callsigns and published route names pass an automatic write-time filter (wordlist + optional LLM check under the `ai_budget` travel purpose; when the LLM check is budget-blocked, wordlist-only publish — fail-cheap, still filtered), then publish immediately; report flow + owner-visible trace ledger as backstop. The wordlist infrastructure is net-new platform work (no general-purpose filter exists in the repo today). The target simulation's Gastfreundschaft setting can disable Spuren entirely. No pre-moderation queue (kills the "ich war hier" moment), no phrase-composition fallback needed at launch.
6. **Helm-Modus priority — STAYS P3.** Density before speed, per the verified Sunless Sea lesson. Takt mode carries P0–P2; the mode-agnostic engine (7.5) remains a P0 architectural requirement so the Helm path stays cheap. The 7.7 renderer spike was run 2026-06-12 (Three.js only, owner decision) and resolved the choice: Three.js orthographic, classic WebGL/EffectComposer — see 7.7's bottom line and `spikes/drift-chart-three/README.md` (binding carry-over list).

---

## 23. Appendix — Art Production & Asset Pipeline

Art-direction thesis: **the fiction is "signals, not landscapes" — so ~80 % of the look is code-shaped, not asset-shaped.** The player reads instruments (sonar, radio bearing, Bureau dossier), never painted seascapes.

Four asset classes by production method:

| Class | Content | Production |
|---|---|---|
| **A. Chart layer** (dominant look) | broadcast glows, Strömungsbänder, fog-of-war, frequency crossfade, particle drift, dissonance scanlines/glitch | procedural: GLSL shaders + Three.js scene graph (spike-verified: instancing, UnrealBloom, bitmask crossfade, grade pass); zero painted assets |
| **B. Glyphs & icons** | node types, cargo families, scars, clearance ranks, stamps | monochrome SVG set in the existing icon system (`utils/icons.ts`), baked to a sprite atlas for the canvas; stamp/bureau aesthetics are *natively* vector work |
| **C. UI chrome** | dossier panels, frequency dial, throttle | existing brutalist design system in Lit/HTML/CSS *above* the canvas (better i18n/a11y than in-canvas UI); the Three.js canvas reads its palette from CSS custom properties at init (CSS-var→uniform bridge, spike-verified) — token fidelity in WebGL |
| **D. Narrative spot art** | storylet illustrations, ghost-island vignettes, world vignettes | the **existing** Replicate/Flux pipeline with lore-informed per-simulation style prompts (Forge A.5/A.6), budget-gated, cached per entity; unified post-processing shader (duotone/grain/redaction overlay) so AI images from five worlds read as one game |

Audio (the real atmosphere carrier in Helm mode): WebAudio-synthesized sonar pings and drones — also code.

Production order: one-page style bible → **chart shader prototype first** (the vertical slice carries most of the look) → SVG glyph set → spot-art pipeline last.

Division of labor: vector/shader/procedural work and Flux prompt-engineering is LLM-producible (SVG, GLSL, Pixi/particle configs, `image_prompt_text` patterns); raster generation runs through the platform's existing Replicate/Flux services; human role is style-bible approval and curation.

Renderer ecosystem shortlist (spike complete 2026-06-12 — the Three.js track is the decision; the PixiJS track is retained as the documented rejected alternative):

- **Three.js track** (CHOSEN — 7.7, spike-verified at three 0.184.0): vanilla Three (no react-three-fiber — we are Lit), orthographic camera; post-processing via `EffectComposer` (UnrealBloomPass, god rays, glitch/film passes — the dissonance and broadcast looks off the shelf); `Points` + instancing for chart objects; `camera-controls` (or a small bespoke pan/zoom controller) for the chart camera; troika-three-text only if in-canvas labels ever beat HTML overlays (they usually don't for us).
- **PixiJS track** (rejected alternative, kept for the record): **pixi-viewport** (pan/zoom camera), **pixi-filters** (v8 sub-modules; CRT + glitch + bloom/godray), `@pixi/ui` (barely needed — UI chrome lives in Lit), particles via built-in `ParticleContainer` + small bespoke emitter (official `@pixi/particle-emitter` lagged on v8, issue #211; community fork `@spd789562/particle-emitter` exists). Caveat: most online Pixi material teaches v5–v7 patterns; validate everything against the v8 migration guide.
- Either track: `@pixi/sound`/raw WebAudio, GSAP for tweens, sprite atlases from the SVG glyph set.

---

## 24. Appendix — Selector/Condition DSL sketch

The YAML packs' selector DSL (9.6 rule 5) — binding primitives; the full grammar is plan-doc work. Three clause families:

- **Entity selectors** (`select:`): pick live rows for template slots. `from:` a bounded entity universe (agents, buildings, zones, events, embassies, connections — the KPI 1 universe); `where:` attribute predicates — `eq / neq / in / gte / lte / contains` over taxonomy columns (`zone_type`, `security_level`, `building_type`, `special_type`, relationship types, `impact_level`, event-recency windows); `sample:` strategy (`random_weighted | most_recent | most_relevant`) with a deterministic seed per quest instance; `bind:` names the slot (`{{agent.informant}}`).
- **Quality conditions** (`require:` on storylets, `check:` on options): predicates over traveler state — affinity thresholds, clearance rank, dissonance-band ranges, scar/cargo/twist presence, bond depths, window remaining, current frequency, weather archetype, hospitality level, node/zone context.
- **Combinators**: `all: / any: / not:`, nesting arbitrarily (the ink lesson: tooling over caps, 3.4).

Two CI-enforced invariants: every selector that can resolve to zero rows must declare a `fallback:` (alternate selector or template-text degradation — KPI 6's fallback discipline at the selector level), and every `bind:` must be consumed by its template (no dangling slots). Validation runs against schema fixtures in the same CI gate as pack schema validation (9.2).

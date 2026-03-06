# metaverse.center: The Cartographer's Expansion

## Overview & Design Philosophy

As the lead game designer and narrative architect for metaverse.center, the goal of this expansion is to bridge the gap between *mechanical action* and *literary consequence*. The platform is not just a game; it is an act of collective, adversarial writing. The Fracture shattered one truth into five; the Bleed ensures these truths infect each other. 

Our UI and mechanics must reflect this. When a player acts, the world must scar, remember, and resist.

This document details three major features:
1.  **Palimpsest Zone Descriptions** (The Living Page)
2.  **3D Card "Shattering"** (Voronoi Fracture)
3.  **The Astrolabe** (Semantic Lore Search)

Each feature is designed with zero code duplication, strict adherence to our Lit/Preact signals architecture, WCAG 2.1 AA accessibility compliance, and SEO best practices.

---

## 1. Palimpsest Zone Descriptions (The Living Page)

### Narrative Context
A palimpsest is a manuscript page where text has been scraped off to be used again, leaving faint traces of the original. In the metaverse, reality is a text. When a Saboteur degrades a zone, or an Event Echo strikes, the old reality doesn't vanish—it is written over. The "bureaucrats" of Velgarien try to erase history; the "scholars" of the Gaslit Reach try to dig it up. The UI must show the scars of these edits.

### Game Design
This is a purely cosmetic, highly immersive UX feature. When players view a Zone or Building that has been subjected to hostile operative actions (Sabotage) or narrative shifts (Propaganda), they should physically see the "history" of the location peeking through the current description. It makes the abstract concept of "Zone Security" feel tangible.

### Technical Architecture

*   **Data Source (Backend):** We will leverage the existing `audit_log` table. We do not need a new table. We will create a new endpoint (or extend `LocationService`) to fetch the last 3 distinct `description` string states for a given `zone_id` from the audit logs.
*   **Component (`<velg-palimpsest>`):** A new Lit component in `frontend/src/components/shared/VelgPalimpsest.ts`.
*   **CSS Implementation:** 
    *   We use CSS Grid to stack three `<p>` elements in the exact same cell (`grid-area: 1 / 1`).
    *   **Layer 1 (Deepest Past):** Blur filter (`blur(1px)`), opacity `0.1`, skewed slightly off-axis.
    *   **Layer 2 (Recent Past):** Strike-through (`text-decoration: line-through`), opacity `0.25`, using a `mix-blend-mode: multiply` (or `screen` for dark themes).
    *   **Layer 3 (Present):** 100% opacity, standard theme text color.
*   **Accessibility (A11y):** The historical layers are purely decorative visual noise.
    *   Layer 1 & 2: `aria-hidden="true"` and `role="presentation"`.
    *   Layer 3: The only text read by screen readers. High contrast ratios guaranteed by existing theme tokens (`var(--color-text-primary)`).
*   **SEO:** By keeping the historical text hidden from ARIA and using proper semantic HTML (`<article>` or `<p>`), search engines will index the current state of the world without being confused by the "scratched out" text.

### Pros & Cons
*   **Pro:** Massive boost to literary immersion; visually represents the core "Bleed" mechanic.
*   **Con:** Requires fetching audit logs on standard reads, which could impact DB performance if not cached. *Mitigation:* We will cache the palimpsest array in Redis/Cachetools and invalidate it only on update.

---

## 2. 3D Card "Shattering" (Voronoi Fracture)

### Narrative Context
The Cartographers view the multiverse through the "Rete" of their instruments—a projected map. When an entity is "Assassinated" or a building "Destroyed," it is violently excised from the map. It doesn't just fade; the structural integrity of the simulation rejects it, shattering the projection.

### Game Design
Currently, operatives apply debuffs. We are introducing a *lethal outcome* threshold.
*   **Assassin:** 15% chance to permanently "Kill" a target agent in that epoch instance.
*   **Saboteur:** 33% chance to "Destroy" a building already in "Ruined" condition.
When these lethal outcomes are viewed in the Battle Log and acknowledged by the player, the target's TCG card performs a visceral, explosive 3D shatter animation before being purged from the UI state.

### Technical Architecture

*   **State Management (Frontend):** We use `@preact/signals-core`. Currently, when an entity is deleted, it vanishes instantly when the signal updates. We must introduce an `isShattering: string | null` signal.
*   **The Shatter Engine:**
    *   We will NOT use WebGL globally as it breaks accessibility and DOM flow.
    *   Instead, we create `<velg-shatter-overlay>`. 
    *   When `isShattering` is triggered for `card_id`, the overlay reads the bounding client rect of the target `<velg-game-card>`.
    *   It uses a lightweight JS Voronoi triangulator (like `d3-delaunay`) to cut the card's exact dimensions into ~15-20 polygon paths using CSS `clip-path: polygon(...)`.
    *   We clone the card's inner HTML into these 20 clipped divs.
*   **Animation (CSS/JS):** 
    *   We apply a physics step: each shard gets a random outward velocity vector and rotation, dropping via gravity for 800ms while fading opacity.
    *   After 800ms, the animation completes, and we finally dispatch the signal to remove the entity from the Preact store.
*   **Accessibility:** 
    *   We wrap the trigger in a `window.matchMedia('(prefers-reduced-motion: reduce)')` check. If true, bypass the animation and instantly remove the card.

### Pros & Cons
*   **Pro:** Provides the "juice" and game-feel lacking in text-heavy browser games. Makes the TCG cards feel physical and fragile.
*   **Con:** Expensive DOM manipulation during the 800ms animation. *Mitigation:* It only triggers on rare lethal events, never in bulk.

---

## 3. The Astrolabe (Semantic Lore Search)

### Narrative Context
The Astrolabe is the ancient tool of the Bureau of Impossible Geography. Just as historical astrolabes flattened the 3D cosmos into a 2D map, our Astrolabe flattens the chaotic, sprawling lore of five different timelines into a navigable web of semantic meaning. It allows Cartographers (players) to find thematic resonances—the "Bleed"—across boundaries.

### Game Design
Players need a way to navigate ~150 entities and their generated lore. Standard keyword search is insufficient for literary discovery. If a player searches "betrayal by a mentor," the Astrolabe should return the Station Null scientist who spaced his crew, *and* the Velgarien clerk who reported his superior, even if the word "betrayal" isn't in either text.

### Technical Architecture

*   **Database (`pgvector`):** We enable the `vector` extension in Supabase. We create a `entity_embeddings` table with a `vector(1536)` column.
*   **Embedding Pipeline (Backend):**
    *   We utilize the existing OpenRouter API key configured in `backend/config.py`.
    *   When an Agent, Building, or Location is created/updated (and its `content_hash` changes), an async FastAPI background task sends the lore to `openai/text-embedding-3-small` via OpenRouter.
    *   The resulting 1536-dimensional vector is upserted into Supabase.
*   **Search RPC:** A Supabase RPC `match_entities` performs cosine similarity (`<=>`) between the query vector and the database, returning the top 10 matches.
*   **Frontend Component (`<velg-astrolabe>`):**
    *   A `Cmd+K` global search modal styled as a brass, concentric-ringed instrument interface.
    *   **UX:** As the user types, a skeleton loader ("Calibrating Rete...") appears. 
    *   **Results:** Shows the entity name, simulation, and a highlighted snippet of the lore. Clicking a result pans the `CartographerMap.ts` 3D graph directly to that node.
*   **Clean Architecture:** The embedding logic is isolated in a new `SearchService`. The `public.py` router gets a single new `GET /search` endpoint. 

### Pros & Cons
*   **Pro:** Turns the platform's massive text output into a playable, explorable feature. Deepens the lore significantly.
*   **Con:** OpenRouter API costs for embeddings. *Mitigation:* `text-embedding-3-small` is exceptionally cheap, and we strictly hash-check content so we only re-embed when text actually changes.

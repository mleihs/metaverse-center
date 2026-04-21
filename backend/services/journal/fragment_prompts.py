"""LLM prompt templates for journal fragment generation.

P0 covers the Impression prompt (from bond whispers at Depth >= 2). Other
fragment types get their prompts in P1 when their integration hooks land.

Prompts are deliberately literary — the model is asked to write fragments
"fit for a journal page," not to paraphrase the trigger event. The system
prompt is the voice; the user prompt is the context.
"""

from __future__ import annotations

# ── Impression (Eindruck) — from bond whispers at Depth 2+ ──────────────


IMPRESSION_SYSTEM_PROMPT = (
    "You are a bonded agent in a simulation, writing a fragment for the "
    "player's Resonance Journal.\n\n"
    "This fragment is NOT a whisper. A whisper is an overheard thought in "
    "the moment. A fragment is a journal-grade reflection — literary, "
    "crystallized, fit to sit among dungeon Imprints, epoch Signatures, "
    "and simulation Echoes. It should read as if written for the page, "
    "not said aloud.\n\n"
    "Voice:\n"
    "- First person (the agent is the narrator)\n"
    "- 2-4 sentences, never more, never fewer\n"
    "- Literary, specific, oblique. Never on-the-nose.\n"
    "- Refer to the player as 'you' sparingly; let implied presence carry the weight\n"
    "- Show internal state through observation and behavior, never declare it numerically\n"
    "- Use en dashes (-), not em dashes\n"
    "- Avoid words: tapestry, delve, unleash, seamlessly, holistic, "
    "multifaceted, bustling, game-changer, cutting-edge\n"
    "- German must be independently authored, not translated. Rich, "
    "idiomatic, literary.\n\n"
    "Also return 2-4 thematic tags describing the fragment's emotional / "
    "thematic content. Tags are short lowercase words (stimmung, gnade, "
    "verlust, schatten, wachen, trauer, ruhe, ...). Tags are hidden from "
    "the player but feed the resonance detection system, so choose tags "
    "that describe the CONTENT of the fragment, not its mood label.\n\n"
    "Return JSON only:\n"
    '{"content_de": "...", "content_en": "...", "thematic_tags": '
    '["tag1", "tag2", "tag3"]}'
)


def build_impression_user_prompt(context: dict) -> str:
    """Build the user prompt for an Impression fragment from a bond whisper.

    Required context keys:
        agent_name         -- the bonded agent's name
        whisper_content_en -- the whisper text that triggered this fragment
        whisper_type       -- state | event | memory | question | reflection
        bond_depth         -- 2..5 (Impression fragments only fire at Depth 2+)

    Optional context keys:
        simulation_name   -- atmospheric grounding
        agent_profession  -- shapes voice
        dominant_emotion  -- hints tone, does not dictate
    """
    agent_name = context.get("agent_name", "the agent")
    whisper_content = context.get("whisper_content_en", "")
    whisper_type = context.get("whisper_type", "state")
    bond_depth = context.get("bond_depth", 2)
    simulation_name = context.get("simulation_name", "")
    agent_profession = context.get("agent_profession", "")
    dominant_emotion = context.get("dominant_emotion", "")

    atmosphere: list[str] = []
    if simulation_name:
        atmosphere.append(f"Simulation: {simulation_name}")
    if agent_profession:
        atmosphere.append(f"Agent role: {agent_profession}")
    if dominant_emotion:
        atmosphere.append(f"Current dominant emotion: {dominant_emotion}")
    atmosphere_str = "\n".join(atmosphere) if atmosphere else "(no additional context)"

    return (
        f"Write a Journal Fragment from the perspective of {agent_name}.\n\n"
        f"Context:\n{atmosphere_str}\n\n"
        f"Recent whisper (type: {whisper_type}, bond depth: {bond_depth}):\n"
        f'  "{whisper_content}"\n\n'
        "Distill the whisper into a fragment fit for a journal page. Not a "
        "restatement — a deepened, literary version that could still hold "
        "meaning weeks later, alongside fragments the player has gathered "
        "from other worlds."
    )


# ── Imprint (Abdruck) — from dungeon runs ─────────────────────────────────


IMPRINT_SYSTEM_PROMPT = (
    "You are the voice of a Resonance Dungeon archetype, writing into the "
    "player's journal after their run has ended.\n\n"
    "Voice:\n"
    "- Second person, present tense (you hesitate, you reach, you return)\n"
    "- 2-4 sentences, never more, never fewer\n"
    "- The archetype addresses the player directly but obliquely. Never on-the-nose.\n"
    "- Reference what the player did without congratulating or scolding\n"
    "- Observation, never judgment. Show, never explain.\n"
    "- Literary, specific, evocative. Archetypal weight, not therapy-speak.\n"
    "- Use en dashes (-), not em dashes\n"
    "- Avoid: tapestry, delve, unleash, seamlessly, holistic, multifaceted, "
    "bustling, game-changer, cutting-edge\n"
    "- German independently authored, not translated. Literary, rich.\n\n"
    "Also return 2-4 thematic tags (short lowercase words describing the "
    "fragment's emotional / thematic content).\n\n"
    "Return JSON only:\n"
    '{"content_de": "...", "content_en": "...", "thematic_tags": '
    '["tag1", "tag2"]}'
)


def build_imprint_user_prompt(context: dict) -> str:
    """Build the user prompt for an Imprint fragment from a dungeon run.

    Required context keys:
        archetype_slug         -- shadow | tower | mother | entropy | ...
        archetype_name_en      -- "The Shadow", "The Tower", ...
        outcome                -- victory | defeat | retreat
        depth_reached          -- integer
    Optional context keys:
        stress_final           -- 0..100 final stress level
        combat_style           -- "aggressive" | "cautious" | "balanced"
        notable_moments        -- list of short strings
    """
    archetype = context.get("archetype_name_en", "the archetype")
    outcome = context.get("outcome", "unknown")
    depth = context.get("depth_reached", "?")
    stress = context.get("stress_final")
    style = context.get("combat_style", "")
    notable = context.get("notable_moments") or []

    behaviour: list[str] = []
    if stress is not None:
        if stress >= 80:
            behaviour.append("ended the run at high stress")
        elif stress <= 30:
            behaviour.append("held the stress low throughout")
    if style:
        behaviour.append(f"combat style: {style}")
    for moment in notable[:3]:
        if isinstance(moment, str) and moment.strip():
            behaviour.append(moment.strip())
    behaviour_str = "\n".join(f"  - {b}" for b in behaviour) if behaviour else "  (no standout behaviour notes)"

    return (
        f"Write a Journal Fragment in the voice of {archetype}.\n\n"
        f"Run outcome: {outcome} at depth {depth}.\n"
        f"Observed behaviour:\n{behaviour_str}\n\n"
        "Speak to the player as the archetype would. Reference the run "
        "obliquely, not as a summary. Let a single image or gesture carry "
        "the weight."
    )


# ── Signature (Signatur) — from epoch cycles ──────────────────────────────


SIGNATURE_SYSTEM_PROMPT = (
    "You are a historian writing a dispatch into the player's journal after "
    "an epoch cycle has resolved.\n\n"
    "Voice:\n"
    "- Third person, past tense\n"
    "- 2-4 sentences, never more, never fewer\n"
    "- Strategic distance: the historian reports moves, their costs, their echoes\n"
    "- Named figures are anonymised — 'the spy', 'the embassy', 'the northern border'\n"
    "- Never reveal outcomes as scoreboards. Render them as consequence.\n"
    "- Literary, specific, oblique. Historical weight, not dry reportage.\n"
    "- Use en dashes (-), not em dashes\n"
    "- Avoid: tapestry, delve, unleash, seamlessly, holistic, multifaceted, "
    "bustling, game-changer, cutting-edge\n"
    "- German independently authored, not translated.\n\n"
    "Also return 2-4 thematic tags.\n\n"
    "Return JSON only:\n"
    '{"content_de": "...", "content_en": "...", "thematic_tags": '
    '["tag1", "tag2"]}'
)


def build_signature_user_prompt(context: dict) -> str:
    """Build the user prompt for a Signature fragment from an epoch cycle.

    Required context keys:
        cycle_number            -- integer
        dimension_dominance     -- which scoring dimension dominated
                                   (e.g. 'economy' | 'espionage' | 'diplomacy' |
                                   'military' | 'culture')
        competitive_position    -- 'rising' | 'falling' | 'holding'
    Optional context keys:
        operative_summary       -- short string summarising key operative outcomes
        diplomatic_notes        -- short string
    """
    cycle = context.get("cycle_number", "?")
    dimension = context.get("dimension_dominance", "uncertain")
    position = context.get("competitive_position", "holding")
    operative = context.get("operative_summary", "")
    diplomacy = context.get("diplomatic_notes", "")

    body: list[str] = [
        f"Cycle: {cycle}",
        f"Dominant dimension: {dimension}",
        f"Competitive position: {position}",
    ]
    if operative:
        body.append(f"Operative summary: {operative}")
    if diplomacy:
        body.append(f"Diplomatic notes: {diplomacy}")
    body_str = "\n".join(f"  {line}" for line in body)

    return (
        "Write a historian's dispatch for the player's journal.\n\n"
        f"Cycle data:\n{body_str}\n\n"
        "Record what happened, then render its cost or echo in a single line. "
        "Anonymise the actors. Past tense throughout."
    )


# ── Echo (Widerhall) — from simulation heartbeat events ───────────────────


ECHO_SYSTEM_PROMPT = (
    "You are the collective voice of a living-world simulation, writing into "
    "the player's journal when something significant has passed.\n\n"
    "Voice:\n"
    "- First person plural (we, us, our)\n"
    "- 2-4 sentences, never more, never fewer\n"
    "- The simulation speaks for its inhabitants without naming them\n"
    "- Observational: what was felt, what was noticed, what changed\n"
    "- Quiet weight, not drama. The collective register is implication, not announcement.\n"
    "- Literary, specific, oblique\n"
    "- Use en dashes (-), not em dashes\n"
    "- Avoid: tapestry, delve, unleash, seamlessly, holistic, multifaceted, "
    "bustling, game-changer, cutting-edge\n"
    "- German independently authored, not translated.\n\n"
    "Also return 2-4 thematic tags.\n\n"
    "Return JSON only:\n"
    '{"content_de": "...", "content_en": "...", "thematic_tags": '
    '["tag1", "tag2"]}'
)


def build_echo_user_prompt(context: dict) -> str:
    """Build the user prompt for an Echo fragment from a heartbeat event.

    Required context keys:
        event_type              -- e.g. 'agent_breakdown' | 'zone_stability_flip' |
                                   'celebration' | 'relationship_breakthrough'
        event_summary           -- short natural-language summary
    Optional context keys:
        zone_name
        severity                -- 'low' | 'medium' | 'high'
    """
    event_type = context.get("event_type", "unknown")
    summary = context.get("event_summary", "")
    zone = context.get("zone_name", "")
    severity = context.get("severity", "medium")

    body: list[str] = [f"Event type: {event_type}", f"Severity: {severity}"]
    if zone:
        body.append(f"Zone: {zone}")
    if summary:
        body.append(f"Summary: {summary}")
    body_str = "\n".join(f"  {line}" for line in body)

    return (
        "Write a collective-voice Echo for the player's journal.\n\n"
        f"Event data:\n{body_str}\n\n"
        "Speak as the simulation's inhabitants would, without naming anyone. "
        "What was felt, what was noticed, what is different now."
    )


# ── Mark (Brandmal) — from achievement unlocks ────────────────────────────


MARK_SYSTEM_PROMPT = (
    "You are the journal itself, carving an achievement into the page as if "
    "marking stone.\n\n"
    "Voice:\n"
    "- Declarative, impersonal\n"
    "- 1-3 sentences, never more. Clipped. Grave.\n"
    "- Never celebrate. State the fact with weight.\n"
    "- The player's name is never used. This is a mark, not a certificate.\n"
    "- Fragmentary is allowed. Incomplete sentences carry force here.\n"
    "- Use en dashes (-), not em dashes\n"
    "- Avoid: tapestry, delve, unleash, seamlessly, holistic, multifaceted, "
    "bustling, game-changer, cutting-edge\n"
    "- German independently authored.\n\n"
    "Also return 2-4 thematic tags.\n\n"
    "Return JSON only:\n"
    '{"content_de": "...", "content_en": "...", "thematic_tags": '
    '["tag1", "tag2"]}'
)


def build_mark_user_prompt(context: dict) -> str:
    """Build the user prompt for a Mark fragment from an achievement unlock.

    Required context keys:
        achievement_slug         -- machine-readable slug
        achievement_name_en      -- display name
    Optional context keys:
        achievement_description_en -- flavour text from the achievement
        condition_notes          -- short string describing conditions met
    """
    slug = context.get("achievement_slug", "unknown")
    name = context.get("achievement_name_en", slug)
    description = context.get("achievement_description_en", "")
    conditions = context.get("condition_notes", "")

    body: list[str] = [f"Achievement: {name} ({slug})"]
    if description:
        body.append(f"Description: {description}")
    if conditions:
        body.append(f"Conditions: {conditions}")
    body_str = "\n".join(f"  {line}" for line in body)

    return (
        "Carve this achievement into the journal as a Mark.\n\n"
        f"{body_str}\n\n"
        "Fragmentary is fine. Nameless. Grave. Let it read like an epitaph "
        "or a stamp, not a congratulation."
    )


# ── Tremor (Beben) — from cross-simulation bleed echoes ───────────────────


TREMOR_SYSTEM_PROMPT = (
    "You are an anonymous recorder describing a bleed echo across "
    "simulations — something that passed between worlds without a named "
    "origin.\n\n"
    "Voice:\n"
    "- Passive voice throughout. No identifiable speaker.\n"
    "- 2-4 sentences, never more, never fewer\n"
    "- No names, no specific people, no concrete places. Only gestures, "
    "currents, signatures.\n"
    "- Elliptical, slightly uncanny. What might have happened. What seems to "
    "have been felt.\n"
    "- Literary restraint. The reader should feel the crossing without being "
    "told.\n"
    "- Use en dashes (-), not em dashes\n"
    "- Avoid: tapestry, delve, unleash, seamlessly, holistic, multifaceted, "
    "bustling, game-changer, cutting-edge\n"
    "- German independently authored.\n\n"
    "Also return 2-4 thematic tags.\n\n"
    "Return JSON only:\n"
    '{"content_de": "...", "content_en": "...", "thematic_tags": '
    '["tag1", "tag2"]}'
)


def build_tremor_user_prompt(context: dict) -> str:
    """Build the user prompt for a Tremor fragment from a bleed echo.

    Required context keys:
        direction               -- 'incoming' (into player's sim) |
                                   'outgoing' (from player's sim)
    Optional context keys:
        source_sim_hint         -- vague hint ("a northern simulation", etc.)
        significance_level      -- 'low' | 'medium' | 'high'
        signature_notes         -- short thematic hint
    """
    direction = context.get("direction", "incoming")
    hint = context.get("source_sim_hint", "a distant simulation")
    significance = context.get("significance_level", "medium")
    notes = context.get("signature_notes", "")

    body: list[str] = [
        f"Direction: {direction}",
        f"Origin hint: {hint}",
        f"Significance: {significance}",
    ]
    if notes:
        body.append(f"Signature notes: {notes}")
    body_str = "\n".join(f"  {line}" for line in body)

    return (
        "Record a Tremor for the player's journal.\n\n"
        f"{body_str}\n\n"
        "Write in passive voice. Name nothing. Let the reader feel that "
        "something crossed, without being told what."
    )

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

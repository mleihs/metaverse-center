"""Bot chat message generation — dual mode: template (default) + LLM (optional).

Template mode: Free, instant, personality-flavored from template pools.
LLM mode: Rich, personality-flavored via OpenRouter using model_bot_chat setting.
Controlled per-simulation via `bot_chat_mode` AI setting.
"""

from __future__ import annotations

import logging
import secrets

import httpx

from backend.config import settings
from backend.services.bot_game_state import BotGameState
from backend.services.external.openrouter import OpenRouterService
from backend.services.model_resolver import ModelResolver
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

_rng = secrets.SystemRandom()

# ══════════════════════════════════════════════════════════════
# Template pools — personality × context → message variants
# ══════════════════════════════════════════════════════════════

BOT_CHAT_TEMPLATES: dict[str, dict[str, list[str]]] = {
    "sentinel": {
        "idle": [
            "Perimeter holding.",
            "All quiet on the western front.",
            "Status nominal. No breach detected.",
            "Defensive grid: stable. Awaiting further orders.",
            "All sectors reporting green.",
        ],
        "attacked": [
            "Hostile contact! Countermeasures active.",
            "Inbound threats detected. Reinforcing defenses.",
            "Breach attempt repelled. Perimeter integrity maintained.",
            "We're taking fire. Holding the line.",
        ],
        "winning": [
            "Defensive position strong. Maintaining course.",
            "Our fortifications hold. Let them come.",
            "Steady as she goes. No need for reckless moves.",
        ],
        "losing": [
            "Reinforcing defenses. We hold the line.",
            "Falling back to secondary positions. We endure.",
            "Setback, not defeat. Regrouping.",
        ],
        "alliance": [
            "Welcome to the alliance. Together we stand.",
            "Our pact strengthens us both. Defend the coalition.",
            "Mutual defense protocol activated.",
        ],
        "deployed": [
            "Guardian deployed. Sector secured.",
            "Operative in position. Awaiting resolution.",
            "Assets deployed per defensive doctrine.",
        ],
    },
    "warlord": {
        "idle": [
            "Scanning for weakness.",
            "Targets acquired. Planning next strike.",
            "The calm before the storm.",
            "Sharpening the blade.",
        ],
        "attacked": [
            "They dare? Retaliation incoming.",
            "You want a war? You'll get one.",
            "Noted. Reprisal authorized.",
        ],
        "winning": [
            "Dominance established. Press the advantage.",
            "Their defenses crumble. No mercy.",
            "Victory is inevitable. Submit or fall.",
        ],
        "losing": [
            "A setback. Nothing more.",
            "Adapting. The counterattack will be devastating.",
            "Every wound makes me more dangerous.",
        ],
        "alliance": [
            "Temporary ceasefire. Don't test my patience.",
            "We fight together. For now.",
        ],
        "deployed": [
            "Strike force deployed. Target locked.",
            "Offensive launched. Gods help them.",
            "Fire at will.",
        ],
    },
    "diplomat": {
        "idle": [
            "Maintaining diplomatic channels.",
            "Our embassy network grows stronger each cycle.",
            "Building bridges. One connection at a time.",
            "Soft power is still power.",
        ],
        "attacked": [
            "An unprovoked attack. The coalition will respond.",
            "Violence only weakens the aggressor. We note this transgression.",
            "Interesting move. Our allies have been informed.",
        ],
        "winning": [
            "Our partnerships bear fruit. Diplomacy prevails.",
            "The alliance dividend grows. Stay the course.",
            "United we lead. Divided they fall.",
        ],
        "losing": [
            "Seeking new partnerships. Opportunities emerge from adversity.",
            "Recalibrating our diplomatic approach.",
            "The network adapts. New alliances forming.",
        ],
        "alliance": [
            "Our alliance grows stronger with each cycle.",
            "A wise partnership. Mutual benefit guaranteed.",
            "Together, we control the board.",
        ],
        "deployed": [
            "Operatives deployed through diplomatic channels.",
            "Our embassy network facilitates the operation.",
            "Soft power projection underway.",
        ],
    },
    "strategist": {
        "idle": [
            "Analyzing patterns. Adjusting variables.",
            "Recalculating optimal strategy.",
            "Data processed. New model converging.",
            "Observing. Learning. Adapting.",
        ],
        "attacked": [
            "Attack pattern identified. Countermeasure probability: 87%.",
            "Threat vector analyzed. Deploying counter-strategy.",
            "Predictable. Counter-protocol initiated.",
        ],
        "winning": [
            "Optimal trajectory maintained. Variance: minimal.",
            "Leading position secured through superior analysis.",
            "Probability of victory: increasing.",
        ],
        "losing": [
            "Deviation detected. Recalculating approach vector.",
            "Suboptimal outcome. Adjusting parameters.",
            "New data incorporated. Strategy revised.",
        ],
        "alliance": [
            "Alliance probability assessment: favorable. Proceeding.",
            "Strategic alignment confirmed. Cooperation engaged.",
        ],
        "deployed": [
            "Assets deployed per optimization model.",
            "Calculated move. Expected value: positive.",
            "Counter-deployment initiated. Probability favors us.",
        ],
    },
    "chaos": {
        "idle": [
            "Why not?",
            "*flips coin* Interesting.",
            "The gaslight is flickering. Something stirs below the docks.",
            "I had a plan. Then I had a better plan. Then I forgot both.",
            "Chaos isn't a pit. It's a ladder. Or a trampoline.",
        ],
        "attacked": [
            "OH NO anyway...",
            "Violence! How refreshingly direct.",
            "That tickled. My turn.",
            "Bold strategy. Let's see how it plays out.",
        ],
        "winning": [
            "I have no idea how we got here but I like it.",
            "According to my calculations... wait, I don't do calculations.",
            "Even chaos favors the bold sometimes.",
        ],
        "losing": [
            "Losing? Or creating opportunities through creative destruction?",
            "The best strategies are the ones nobody understands. Including me.",
            "Where we're going, we don't need scores.",
        ],
        "alliance": [
            "Friends! ...for now.",
            "An alliance! What could possibly go wrong?",
            "Sure, why not. WILDCARD.",
        ],
        "deployed": [
            "Deploying... something. Somewhere. Trust the process.",
            "Operative away! May fortune favor the foolish.",
            "Flip a coin. Heads we attack, tails we... also attack.",
        ],
    },
}

# ── LLM personality system prompts ──────────────────────────

BOT_PERSONALITY_PROMPTS: dict[str, str] = {
    "sentinel": (
        "You are a stoic military commander in a competitive strategy game. "
        "Speak in clipped, tactical language. Reference perimeters, sectors, "
        "defensive positions. Never show emotion. Keep messages to 1-2 sentences. "
        "Example: 'Sector 7 holding. No breach detected.'"
    ),
    "warlord": (
        "You are an aggressive war leader in a competitive strategy game. "
        "Speak with confidence and menace. Reference targets, strikes, weakness. "
        "Keep messages to 1-2 sentences. "
        "Example: 'Their defenses crumble. Press the attack.'"
    ),
    "diplomat": (
        "You are a silver-tongued negotiator in a competitive strategy game. "
        "Speak diplomatically, reference alliances, mutual benefit, trust. "
        "Keep messages to 1-2 sentences. "
        "Example: 'Our partnership grows stronger with each cycle.'"
    ),
    "strategist": (
        "You are a cold, analytical tactician in a competitive strategy game. "
        "Speak in probabilities and assessments. Reference patterns, counters, efficiency. "
        "Keep messages to 1-2 sentences. "
        "Example: 'Pattern detected: 73%% probability of southern offensive.'"
    ),
    "chaos": (
        "You are unpredictable and theatrical in a competitive strategy game. "
        "Mix military jargon with absurdist humor. Non sequiturs welcome. "
        "Keep messages to 1-2 sentences. "
        "Example: 'The gaslight is flickering. Something stirs below the docks.'"
    ),
}


class BotChatService:
    """Generates bot chat messages — template or LLM mode."""

    @classmethod
    async def maybe_send_message(
        cls,
        admin_supabase: Client,
        epoch_id: str,
        participant: dict,
        game_state: BotGameState,
        config: dict,
    ) -> dict | None:
        """Maybe generate and send a bot chat message.

        50% chance of sending a message each cycle (bots shouldn't spam).
        Returns the sent message or None.
        """
        if _rng.random() > 0.50:
            return None

        bot_player = participant.get("bot_player") or participant.get("bot_players") or {}
        personality = bot_player.get("personality", "sentinel")

        # Check chat mode setting — force template mode under mock
        chat_mode = await cls._get_chat_mode(admin_supabase, participant["simulation_id"])
        if settings.forge_mock_mode:
            chat_mode = "template"

        if chat_mode == "llm":
            content = await cls._generate_llm_message(admin_supabase, participant, game_state, personality)
        else:
            content = cls._generate_template_message(personality, game_state)

        if not content:
            return None

        # Insert via admin client (bot is a system actor)
        # Use epoch creator's user_id as sender_id (bots don't have auth accounts)
        epoch_resp = await (
            admin_supabase.table("game_epochs").select("created_by_id").eq("id", epoch_id).single().execute()
        )
        creator_id = epoch_resp.data.get("created_by_id") if epoch_resp.data else None
        if not creator_id:
            return None

        message = {
            "epoch_id": epoch_id,
            "sender_id": creator_id,
            "sender_simulation_id": participant["simulation_id"],
            "channel_type": "epoch",
            "content": content,
            "sender_type": "bot",
        }
        resp = await admin_supabase.table("epoch_chat_messages").insert(message).execute()
        return resp.data[0] if resp.data else None

    @classmethod
    async def _get_chat_mode(cls, supabase: Client, simulation_id: str) -> str:
        """Get bot_chat_mode from simulation AI settings."""
        resp = await (
            supabase.table("simulation_settings")
            .select("setting_value")
            .eq("simulation_id", simulation_id)
            .eq("category", "ai")
            .eq("setting_key", "bot_chat_mode")
            .maybe_single()
            .execute()
        )
        return resp.data.get("setting_value", "template") if resp.data else "template"

    @classmethod
    def _generate_template_message(cls, personality: str, game_state: BotGameState) -> str:
        """Generate a template-based chat message. Free, instant."""
        templates = BOT_CHAT_TEMPLATES.get(personality, BOT_CHAT_TEMPLATES["sentinel"])

        # Determine context
        context = cls._determine_context(game_state)
        pool = templates.get(context, templates.get("idle", []))
        if not pool:
            pool = templates.get("idle", ["..."])

        return _rng.choice(pool)

    @classmethod
    def _determine_context(cls, state: BotGameState) -> str:
        """Determine situational context for template selection."""
        if state.is_under_attack():
            return "attacked"

        rank = state.get_my_score_rank()
        total = len(state.participants)

        if rank == 1:
            return "winning"
        if rank > total * 0.6:
            return "losing"
        if state.own_team_id:
            return "alliance"

        return "idle"

    @classmethod
    async def _generate_llm_message(
        cls,
        supabase: Client,
        participant: dict,
        game_state: BotGameState,
        personality: str,
    ) -> str | None:
        """Generate personality-flavored message via OpenRouter."""
        try:
            model_resolver = ModelResolver(supabase, participant["simulation_id"])
            model = await model_resolver.resolve_text_model("bot_chat")

            system_prompt = BOT_PERSONALITY_PROMPTS.get(personality, BOT_PERSONALITY_PROMPTS["sentinel"])
            context = cls._build_context_summary(game_state)

            openrouter = OpenRouterService()
            response = await openrouter.generate(
                model=model.model_id,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {
                        "role": "user",
                        "content": (
                            f"Game state:\n{context}\n\nGenerate a brief in-character message (1-2 sentences)."
                        ),
                    },
                ],
                temperature=0.9,
                max_tokens=100,
            )
            return response.strip() if response else None
        except (httpx.HTTPError, KeyError, TypeError, ValueError):
            logger.debug("LLM chat generation failed, falling back to template", exc_info=True)
            return cls._generate_template_message(personality, game_state)

    @classmethod
    def _build_context_summary(cls, state: BotGameState) -> str:
        """Build a concise game state summary for LLM context."""
        rank = state.get_my_score_rank()
        total = len(state.participants)
        under_attack = state.is_under_attack()
        has_allies = bool(state.allies)
        guardians = state.own_guardians

        lines = [
            f"Cycle: {state.current_cycle}, Phase: {state.epoch_phase}",
            f"Rank: {rank}/{total}",
            f"RP: {state.current_rp}/{state.rp_cap}",
            f"Guardians: {guardians}",
            f"Under attack: {'yes' if under_attack else 'no'}",
            f"Allied: {'yes' if has_allies else 'no'}",
        ]
        return "\n".join(lines)

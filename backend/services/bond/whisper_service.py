"""Whisper generation service -- LLM pipeline for bond whispers.

Follows the autonomous_event_service.py pattern: OpenRouter Tier 3 processing,
bilingual JSON output, salience filtering, template fallback.

Called from the heartbeat pipeline to generate whispers for bonded agents.
"""

from __future__ import annotations

import asyncio
import json
import logging
import random
import re
from datetime import UTC, datetime, timedelta
from uuid import UUID

import httpx
import sentry_sdk

from backend.services.bond.whisper_template_service import WhisperTemplateService
from backend.services.external.openrouter import OpenRouterService
from backend.services.model_resolver import ModelResolver
from backend.utils.db import maybe_single_data
from backend.utils.responses import extract_list
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

# ── Constants ──────────────────────────────────────────────────────────────

# Minimum hours between whispers for the same bond
_MIN_WHISPER_INTERVAL_HOURS = 8

# Random baseline probability for state whispers when no other trigger fires
_STATE_WHISPER_PROBABILITY = 0.30

# Whisper types available at each bond depth (cumulative)
_DEPTH_WHISPER_TYPES: dict[int, set[str]] = {
    1: {"state", "event"},
    2: {"state", "event", "memory"},
    3: {"state", "event", "memory", "question"},
    4: {"state", "event", "memory", "question", "reflection"},
    5: {"state", "event", "memory", "question", "reflection"},
}

# Mood score thresholds for state-change detection
_MOOD_SHIFT_THRESHOLD = 15
_STRESS_SHIFT_THRESHOLD = 150

# ── LLM Prompts ────────────────────────────────────────────────────────────

_WHISPER_SYSTEM_PROMPT = (
    "You are the inner voice of a simulation agent who has formed a bond with "
    "a player. Generate a short whisper (2-4 sentences) that reflects the "
    "agent's current emotional state, personality, and circumstances.\n\n"
    "The whisper should feel like an overheard thought – intimate, specific, "
    "never addressed directly to the player. Write in first person.\n\n"
    "Rules:\n"
    "- Never guilt-trip about absence. Agents wait patiently, not reproachfully.\n"
    "- Never explicitly state numerical values (mood scores, stress levels).\n"
    "- Show internal state through behavior and observation, not declaration.\n"
    "- Use literary, evocative language. Each whisper should read like a fragment "
    "from a private journal.\n"
    "- Use en dashes, not em dashes.\n"
    "- German text must be independently authored, not translated.\n\n"
    'Return JSON only: {"content_de": "...", "content_en": "..."}'
)

_TYPE_INSTRUCTIONS: dict[str, str] = {
    "state": "Reflect on the agent's current emotional or physical state.",
    "event": "React to a recent event: {event_description}",
    "memory": "Reference a past player action: {memory_description}",
    "question": (
        "Implicitly request help with: {need_description}. "
        "Do not ask directly – express the need through observation or behavior."
    ),
    "reflection": (
        "Observe the player's pattern: {pattern_description}. "
        "Be philosophical and intimate. This is the deepest form of whisper."
    ),
}

# Regex to strip markdown code fences from LLM output
_FENCE_RE = re.compile(r"```(?:json)?\s*\n?(.*?)\n?\s*```", re.DOTALL)

# Forbidden patterns in whisper content
_FORBIDDEN_PATTERNS = [
    re.compile(r"mood:\s*\d", re.IGNORECASE),
    re.compile(r"stress:\s*\d", re.IGNORECASE),
    re.compile(r"score:\s*\d", re.IGNORECASE),
    re.compile(r"level:\s*\d", re.IGNORECASE),
]


# ── Service ────────────────────────────────────────────────────────────────


class WhisperService:
    """Whisper generation pipeline for the heartbeat."""

    @classmethod
    async def generate_for_simulation(
        cls,
        supabase: Client,
        simulation_id: UUID,
        *,
        llm_budget: int = 3,
        openrouter_api_key: str | None = None,
    ) -> list[dict]:
        """Generate whispers for all bonded agents in a simulation.

        Called from the heartbeat pipeline. Returns list of created whisper dicts.

        Args:
            llm_budget: Max LLM calls this tick (template fallback is free).
            openrouter_api_key: BYOK key for OpenRouter. If None, templates only.
        """
        # Fetch active/strained bonds
        bonds_resp = await (
            supabase.table("agent_bonds")
            .select("*, agents(name, portrait_image_url, character, background, primary_profession, current_zone_id)")
            .eq("simulation_id", str(simulation_id))
            .in_("status", ["active", "strained"])
            .execute()
        )
        bonds = extract_list(bonds_resp)
        if not bonds:
            return []

        created_whispers: list[dict] = []
        llm_calls_used = 0

        for bond in bonds:
            # Evaluate salience
            should_generate, whisper_type = await cls._evaluate_salience(
                supabase, bond,
            )
            if not should_generate or not whisper_type:
                continue

            # Check depth allows this whisper type
            allowed_types = _DEPTH_WHISPER_TYPES.get(bond["depth"], set())
            if whisper_type not in allowed_types:
                # Downgrade to the highest available type
                whisper_type = "state" if "state" in allowed_types else None
                if not whisper_type:
                    continue

            # Gather context
            context = await cls._gather_context(supabase, bond, whisper_type)

            # Generate via LLM or fallback to template
            whisper_content = None
            if openrouter_api_key and llm_calls_used < llm_budget:
                whisper_content = await cls._generate_llm(
                    supabase, simulation_id, context, whisper_type,
                    openrouter_api_key=openrouter_api_key,
                )
                if whisper_content:
                    llm_calls_used += 1

            if not whisper_content:
                whisper_content = cls._generate_template(bond, whisper_type, context)

            if not whisper_content:
                continue

            # Store whisper
            stored = await cls._store_whisper(
                supabase,
                bond["id"],
                whisper_type,
                whisper_content["content_de"],
                whisper_content["content_en"],
                context.get("trigger_context", {}),
            )
            if stored:
                stored["agent_name"] = (bond.get("agents") or {}).get("name", "unknown")
                created_whispers.append(stored)

        return created_whispers

    # ── Salience Filter ────────────────────────────────────────────────

    @classmethod
    async def _evaluate_salience(
        cls,
        supabase: Client,
        bond: dict,
    ) -> tuple[bool, str | None]:
        """Determine if a whisper should be generated.

        Returns (should_generate, whisper_type_hint).
        Checks ordered by priority -- first match wins.
        """
        bond_id = str(bond["id"])

        # 1. Time gate: last whisper < 8 hours ago -> skip
        last_whisper = await maybe_single_data(
            supabase.table("bond_whispers")
            .select("created_at")
            .eq("bond_id", bond_id)
            .order("created_at", desc=True)
            .limit(1)
            .maybe_single()
        )
        if last_whisper:
            last_dt = datetime.fromisoformat(last_whisper["created_at"])
            if datetime.now(UTC) - last_dt < timedelta(hours=_MIN_WHISPER_INTERVAL_HOURS):
                return False, None

        agent_id = bond.get("agent_id")
        depth = bond.get("depth", 1)

        # 2. Event proximity: significant event in agent's zone
        agent_data = bond.get("agents") or {}
        zone_id = agent_data.get("current_zone_id")
        if zone_id:
            recent_events = await (
                supabase.table("events")
                .select("id")
                .eq("zone_id", str(zone_id))
                .gte("created_at", (datetime.now(UTC) - timedelta(hours=8)).isoformat())
                .gte("impact_level", 3)
                .limit(1)
                .execute()
            )
            if extract_list(recent_events):
                return True, "event"

        # 3. State change: mood/stress shifted significantly
        mood = await maybe_single_data(
            supabase.table("agent_mood")
            .select("mood_score, stress_level")
            .eq("agent_id", str(agent_id))
            .maybe_single()
        )
        if mood and last_whisper:
            # Check previous whisper's trigger_context for baseline
            prev_whisper = await maybe_single_data(
                supabase.table("bond_whispers")
                .select("trigger_context")
                .eq("bond_id", bond_id)
                .order("created_at", desc=True)
                .limit(1)
                .maybe_single()
            )
            prev_ctx = (prev_whisper or {}).get("trigger_context") or {}
            prev_mood = prev_ctx.get("mood_score")
            prev_stress = prev_ctx.get("stress_level")
            current_mood = mood.get("mood_score", 0)
            current_stress = mood.get("stress_level", 0)

            if prev_mood is not None and abs(current_mood - prev_mood) >= _MOOD_SHIFT_THRESHOLD:
                return True, "state"
            if prev_stress is not None and abs(current_stress - prev_stress) >= _STRESS_SHIFT_THRESHOLD:
                return True, "state"

        # 4. Need urgency: any need < 15 and depth >= 3
        if depth >= 3:
            needs = await maybe_single_data(
                supabase.table("agent_needs")
                .select("safety, social, comfort, stimulation, purpose")
                .eq("agent_id", str(agent_id))
                .maybe_single()
            )
            if needs:
                for need_name in ("safety", "social", "comfort", "stimulation", "purpose"):
                    if (needs.get(need_name) or 100) < 15:
                        return True, "question"

        # 5. Reflection trigger: depth >= 4 and 5+ memories since last reflection
        if depth >= 4:
            last_reflection = await maybe_single_data(
                supabase.table("bond_whispers")
                .select("created_at")
                .eq("bond_id", bond_id)
                .eq("whisper_type", "reflection")
                .order("created_at", desc=True)
                .limit(1)
                .maybe_single()
            )
            reflection_cutoff = (last_reflection or {}).get("created_at", "1970-01-01")
            memories_resp = await (
                supabase.table("bond_memories")
                .select("id", count="exact")
                .eq("bond_id", bond_id)
                .gte("created_at", reflection_cutoff)
                .execute()
            )
            if (memories_resp.count or 0) >= 5:
                return True, "reflection"

        # 6. Memory trigger: depth >= 2 and player action in last 48h
        if depth >= 2:
            recent_action = await maybe_single_data(
                supabase.table("bond_memories")
                .select("id")
                .eq("bond_id", bond_id)
                .eq("memory_type", "action")
                .gte("created_at", (datetime.now(UTC) - timedelta(hours=48)).isoformat())
                .limit(1)
                .maybe_single()
            )
            if recent_action:
                return True, "memory"

        # 7. Random baseline: 30% chance for state whisper
        if random.random() < _STATE_WHISPER_PROBABILITY:  # noqa: S311 -- game mechanic
            return True, "state"

        return False, None

    # ── Context Gathering ──────────────────────────────────────────────

    @classmethod
    async def _gather_context(
        cls,
        supabase: Client,
        bond: dict,
        whisper_type: str,
    ) -> dict:
        """Collect all context needed for whisper generation."""
        agent_id = str(bond["agent_id"])
        bond_id = str(bond["id"])
        agent_data = bond.get("agents") or {}

        # Agent mood
        mood = await maybe_single_data(
            supabase.table("agent_mood")
            .select("mood_score, dominant_emotion, stress_level")
            .eq("agent_id", agent_id)
            .maybe_single()
        ) or {}

        # Agent needs
        needs = await maybe_single_data(
            supabase.table("agent_needs")
            .select("safety, social, comfort, stimulation, purpose")
            .eq("agent_id", agent_id)
            .maybe_single()
        ) or {}

        # Recent whispers (last 3 for novelty check)
        prev_whispers_resp = await (
            supabase.table("bond_whispers")
            .select("content_en, whisper_type, trigger_context")
            .eq("bond_id", bond_id)
            .order("created_at", desc=True)
            .limit(3)
            .execute()
        )
        previous_whispers = extract_list(prev_whispers_resp)

        # Bond memories (last 10)
        memories_resp = await (
            supabase.table("bond_memories")
            .select("memory_type, description, context, created_at")
            .eq("bond_id", bond_id)
            .order("created_at", desc=True)
            .limit(10)
            .execute()
        )
        memories = extract_list(memories_resp)

        # Zone name
        zone_name = "the district"
        zone_id = agent_data.get("current_zone_id")
        if zone_id:
            zone = await maybe_single_data(
                supabase.table("zones")
                .select("name")
                .eq("id", str(zone_id))
                .maybe_single()
            )
            if zone:
                zone_name = zone.get("name", zone_name)

        # Building name (from agent's building assignment)
        building_name = "the quarters"
        building_resp = await (
            supabase.table("building_agent_relations")
            .select("buildings(name)")
            .eq("agent_id", agent_id)
            .limit(1)
            .execute()
        )
        building_data = extract_list(building_resp)
        if building_data:
            bld = (building_data[0].get("buildings") or {})
            building_name = bld.get("name", building_name)

        # Mood description for prompt
        mood_score = mood.get("mood_score", 0)
        stress = mood.get("stress_level", 0)
        if mood_score > 40:
            mood_desc = "content, at ease"
        elif mood_score > 10:
            mood_desc = "stable, calm"
        elif mood_score > -20:
            mood_desc = "subdued, uncertain"
        elif mood_score > -50:
            mood_desc = "struggling, withdrawn"
        else:
            mood_desc = "distressed, near breaking point"

        if stress > 700:
            stress_desc = "extremely high, close to breakdown"
        elif stress > 400:
            stress_desc = "elevated, visibly tense"
        elif stress > 200:
            stress_desc = "moderate, manageable"
        else:
            stress_desc = "low, relaxed"

        # Lowest need for question whispers
        lowest_need = None
        if needs:
            need_items = [(k, v) for k, v in needs.items() if isinstance(v, int | float)]
            if need_items:
                lowest_need = min(need_items, key=lambda x: x[1])

        context: dict = {
            "agent_name": agent_data.get("name", "the agent"),
            "agent_character": agent_data.get("character", ""),
            "agent_background": agent_data.get("background", ""),
            "agent_profession": agent_data.get("primary_profession", ""),
            "mood_score": mood_score,
            "mood_description": mood_desc,
            "stress_level": stress,
            "stress_description": stress_desc,
            "dominant_emotion": mood.get("dominant_emotion", "neutral"),
            "needs": needs,
            "lowest_need": lowest_need,
            "zone_name": zone_name,
            "building_name": building_name,
            "bond_depth": bond.get("depth", 1),
            "bond_status": bond.get("status", "active"),
            "previous_whispers": previous_whispers,
            "memories": memories,
            "trigger_context": {
                "mood_score": mood_score,
                "stress_level": stress,
                "dominant_emotion": mood.get("dominant_emotion", "neutral"),
                "whisper_type": whisper_type,
            },
        }

        # Type-specific context
        if whisper_type == "question" and lowest_need:
            context["need_description"] = (
                f"{lowest_need[0]} need is critically low ({lowest_need[1]}/100)"
            )
        if whisper_type == "memory" and memories:
            recent_action = next(
                (m for m in memories if m["memory_type"] == "action"), None,
            )
            context["memory_description"] = (
                recent_action["description"] if recent_action
                else "a past action the player took"
            )
        if whisper_type == "reflection":
            action_count = sum(1 for m in memories if m["memory_type"] == "action")
            neglect_count = sum(1 for m in memories if m["memory_type"] == "neglect")
            if action_count > neglect_count:
                context["pattern_description"] = "the player consistently cares for and acts on this agent's needs"
            elif neglect_count > 0:
                context["pattern_description"] = "the player is present but sometimes distracted by other concerns"
            else:
                context["pattern_description"] = "the player's stewardship style and what it reveals about them"

        return context

    # ── LLM Generation ─────────────────────────────────────────────────

    @classmethod
    async def _generate_llm(
        cls,
        supabase: Client,
        simulation_id: UUID,
        context: dict,
        whisper_type: str,
        *,
        openrouter_api_key: str | None = None,
    ) -> dict | None:
        """Generate a whisper via OpenRouter LLM with retry + hardened parsing.

        Hardened against OpenRouter unreliability:
          - Up to 2 attempts (initial + 1 retry)
          - Exponential backoff between retries (2s)
          - Robust JSON extraction (handles markdown fences, preamble text,
            partial JSON, single-language fallback)
          - Validation rejects before retry exhaustion triggers re-generation
          - All failures degrade to template fallback (never crashes heartbeat)

        Returns {"content_de": "...", "content_en": "..."} or None on failure.
        """
        user_prompt = cls._build_whisper_prompt(context, whisper_type)

        try:
            model_resolver = ModelResolver(supabase, simulation_id)
            resolved = await model_resolver.resolve_text_model("bond_whisper")
        except Exception:  # noqa: BLE001 -- model resolution failure must not crash heartbeat
            logger.warning("Model resolution failed for bond_whisper", exc_info=True)
            return None

        max_attempts = 2
        last_error: str = ""

        for attempt in range(max_attempts):
            try:
                openrouter = OpenRouterService(api_key=openrouter_api_key)

                content = await openrouter.generate(
                    model=resolved.model_id,
                    messages=[
                        {"role": "system", "content": _WHISPER_SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt},
                    ],
                    temperature=0.8,
                    max_tokens=300,
                )

                if not content or not content.strip():
                    last_error = "empty response"
                    continue

                # Parse JSON (strip markdown fences, preamble, etc.)
                parsed = cls._parse_json_response(content)
                if not parsed:
                    last_error = f"unparseable JSON: {content[:80]}"
                    if attempt < max_attempts - 1:
                        await asyncio.sleep(2)
                    continue

                # Validate quality
                if not cls._validate_whisper(parsed, context):
                    last_error = "validation failed"
                    if attempt < max_attempts - 1:
                        await asyncio.sleep(1)
                    continue

                return parsed

            except httpx.TimeoutException:
                last_error = "timeout"
                logger.warning(
                    "OpenRouter timeout on whisper attempt %d/%d",
                    attempt + 1, max_attempts,
                )
            except httpx.HTTPStatusError as exc:
                last_error = f"HTTP {exc.response.status_code}"
                logger.warning(
                    "OpenRouter HTTP error %d on whisper attempt %d/%d",
                    exc.response.status_code, attempt + 1, max_attempts,
                )
                # 429 (rate limit) or 5xx: worth retrying
                # 4xx (except 429): likely persistent, skip retry
                if exc.response.status_code < 500 and exc.response.status_code != 429:
                    break
            except (httpx.HTTPError, json.JSONDecodeError, KeyError, TypeError, ValueError) as exc:
                last_error = str(exc)
                logger.warning(
                    "Whisper generation error on attempt %d/%d: %s",
                    attempt + 1, max_attempts, exc,
                )

            if attempt < max_attempts - 1:
                await asyncio.sleep(2 * (attempt + 1))

        logger.info(
            "LLM whisper generation exhausted %d attempts (last error: %s), falling back to template",
            max_attempts, last_error,
        )
        sentry_sdk.set_context("whisper_failure", {
            "attempts": max_attempts,
            "last_error": last_error,
            "whisper_type": whisper_type,
            "bond_depth": context.get("bond_depth"),
        })
        return None

    @classmethod
    def _build_whisper_prompt(cls, context: dict, whisper_type: str) -> str:
        """Build the user prompt for whisper generation."""
        instruction = _TYPE_INSTRUCTIONS.get(whisper_type, "")
        safe_ctx = {k: v for k, v in context.items() if isinstance(v, str)}
        try:
            instruction = instruction.format_map(safe_ctx)
        except KeyError:
            pass

        prev_summaries = []
        for pw in context.get("previous_whispers", [])[:3]:
            prev_summaries.append(pw.get("content_en", "")[:100])
        prev_str = "\n".join(f"  - {s}" for s in prev_summaries) if prev_summaries else "(none yet)"

        mem_summaries = []
        for m in context.get("memories", [])[:5]:
            mem_summaries.append(f"{m['memory_type']}: {m['description'][:80]}")
        mem_str = "\n".join(f"  - {s}" for s in mem_summaries) if mem_summaries else "(none yet)"

        return (
            f"Agent: {context.get('agent_name', 'Unknown')} "
            f"({context.get('agent_profession', 'unknown profession')})\n"
            f"Personality: {context.get('agent_character', 'not described')[:200]}\n"
            f"Whisper type: {whisper_type}\n"
            f"Bond depth: {context.get('bond_depth', 1)}/5 "
            f"(deeper = more intimate)\n"
            f"Current mood: {context.get('mood_description', 'unknown')}\n"
            f"Current stress: {context.get('stress_description', 'unknown')}\n"
            f"Dominant emotion: {context.get('dominant_emotion', 'neutral')}\n"
            f"Location: {context.get('zone_name', 'unknown')}, "
            f"{context.get('building_name', 'unknown')}\n"
            f"Previous whispers (last 3):\n{prev_str}\n"
            f"Bond memories:\n{mem_str}\n\n"
            f"Instruction: {instruction}"
        )

    @classmethod
    def _parse_json_response(cls, content: str) -> dict | None:
        """Parse JSON from LLM response with robust extraction.

        Handles common OpenRouter quirks:
          - Markdown code fences (```json ... ```)
          - Preamble text before JSON ("Here is the whisper: {...}")
          - Trailing text after JSON
          - Escaped unicode characters
          - Single-language output (mirrors to other language as fallback)
        """
        if not content or not content.strip():
            return None

        text = content.strip()

        # Strategy 1: strip markdown fences
        match = _FENCE_RE.search(text)
        if match:
            text = match.group(1).strip()

        # Strategy 2: direct parse
        data = cls._try_json_parse(text)

        # Strategy 3: extract first {...} block from surrounding text
        if data is None:
            brace_match = re.search(r"\{[^{}]*\}", text, re.DOTALL)
            if brace_match:
                data = cls._try_json_parse(brace_match.group(0))

        # Strategy 4: extract nested {...} (handles {"content_de": "...", ...})
        if data is None:
            deep_match = re.search(r"\{.*\}", text, re.DOTALL)
            if deep_match:
                data = cls._try_json_parse(deep_match.group(0))

        if not isinstance(data, dict):
            logger.debug("Whisper JSON extraction failed: %.120s...", content)
            return None

        # Normalize field names (some models use "de"/"en" instead of "content_de"/"content_en")
        if "de" in data and "content_de" not in data:
            data["content_de"] = data.pop("de")
        if "en" in data and "content_en" not in data:
            data["content_en"] = data.pop("en")
        if "whisper_de" in data and "content_de" not in data:
            data["content_de"] = data.pop("whisper_de")
        if "whisper_en" in data and "content_en" not in data:
            data["content_en"] = data.pop("whisper_en")

        content_de = (data.get("content_de") or "").strip()
        content_en = (data.get("content_en") or "").strip()

        # Single-language fallback: if only one language present, skip
        # (template fallback will provide proper bilingual content)
        if not content_de or not content_en:
            logger.debug("Whisper missing one language (de=%d, en=%d chars)", len(content_de), len(content_en))
            return None

        return {"content_de": content_de, "content_en": content_en}

    @staticmethod
    def _try_json_parse(text: str) -> dict | None:
        """Attempt JSON parse, returning None on failure."""
        try:
            return json.loads(text)
        except (json.JSONDecodeError, ValueError):
            return None

    @classmethod
    def _validate_whisper(
        cls,
        content: dict,
        context: dict,
    ) -> bool:
        """Validate a generated whisper for quality."""
        de = content.get("content_de", "")
        en = content.get("content_en", "")

        # Length check (20-500 chars)
        if not (20 <= len(de) <= 500) or not (20 <= len(en) <= 500):
            logger.debug("Whisper rejected: length out of range (de=%d, en=%d)", len(de), len(en))
            return False

        # No numerical state reporting
        for pattern in _FORBIDDEN_PATTERNS:
            if pattern.search(de) or pattern.search(en):
                logger.debug("Whisper rejected: contains forbidden numerical pattern")
                return False

        # Novelty check: simple substring overlap with previous whispers
        for prev in context.get("previous_whispers", [])[:3]:
            prev_en = prev.get("content_en", "")
            if prev_en and en and _text_similarity(en, prev_en) > 0.7:
                logger.debug("Whisper rejected: too similar to recent whisper")
                return False

        return True

    # ── Template Fallback ──────────────────────────────────────────────

    @classmethod
    def _generate_template(
        cls,
        bond: dict,
        whisper_type: str,
        context: dict,
    ) -> dict | None:
        """Generate whisper from hand-authored templates."""
        agent_state = {
            "mood_score": context.get("mood_score", 0),
            "stress_level": context.get("stress_level", 0),
        }

        # Gather recent tags for dedup
        recent_tags: list[str] = []
        for pw in context.get("previous_whispers", [])[:5]:
            tc = pw.get("trigger_context") or {}
            recent_tags.extend(tc.get("template_tags", []))

        template = WhisperTemplateService.select_template(
            whisper_type=whisper_type,
            bond_depth=bond.get("depth", 1),
            agent_state=agent_state,
            recent_whisper_tags=recent_tags,
        )
        if not template:
            return None

        # Build slot values
        agent_data = bond.get("agents") or {}
        slots = {
            "agent_name": agent_data.get("name", "..."),
            "zone_name": context.get("zone_name", "the district"),
            "building_name": context.get("building_name", "the quarters"),
            "other_agent": "someone nearby",
            "days_count": "several",
        }

        # Try to get a related agent name for {other_agent}
        # (from bond memories or relationships -- simplified)

        content_de, content_en = WhisperTemplateService.fill_template(template, slots)

        return {
            "content_de": content_de,
            "content_en": content_en,
            "template_tags": list(template.tags),
        }

    # ── Storage ────────────────────────────────────────────────────────

    @classmethod
    async def _store_whisper(
        cls,
        supabase: Client,
        bond_id: str,
        whisper_type: str,
        content_de: str,
        content_en: str,
        trigger_context: dict,
    ) -> dict | None:
        """Insert a whisper into bond_whispers."""
        try:
            resp = await (
                supabase.table("bond_whispers")
                .insert({
                    "bond_id": bond_id,
                    "whisper_type": whisper_type,
                    "content_de": content_de,
                    "content_en": content_en,
                    "trigger_context": trigger_context,
                })
                .select("*")
                .execute()
            )
            data = extract_list(resp)
            return data[0] if data else None
        except Exception:  # noqa: BLE001 -- whisper storage failure must not crash heartbeat
            logger.warning("Failed to store whisper for bond %s", bond_id, exc_info=True)
            sentry_sdk.capture_exception()
            return None


# ── Utility ────────────────────────────────────────────────────────────────


def _text_similarity(a: str, b: str) -> float:
    """Simple character-level Jaccard similarity for novelty check.

    Not Levenshtein (too expensive for this use case) but sufficient for
    detecting near-duplicate whispers. Returns 0.0 (no overlap) to 1.0 (identical).
    """
    if not a or not b:
        return 0.0
    # Use character trigrams for better accuracy than raw characters
    trigrams_a = {a[i : i + 3] for i in range(len(a) - 2)}
    trigrams_b = {b[i : i + 3] for i in range(len(b) - 2)}
    if not trigrams_a or not trigrams_b:
        return 0.0
    intersection = trigrams_a & trigrams_b
    union = trigrams_a | trigrams_b
    return len(intersection) / len(union)

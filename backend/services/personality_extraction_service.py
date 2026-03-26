"""Personality extraction and autonomy initialization for agents.

Extracts Big Five personality profiles from agent backstories via LLM,
computes deterministic base compatibility between agent pairs, and
bootstraps the autonomy data (mood, needs) for new or existing agents.

PostgreSQL functions used:
- ``fn_initialize_agent_autonomy`` (migration 145) — idempotent mood+needs bootstrap
- ``fn_bootstrap_building_relations`` (migration 160) — populate building_agent_relations from current_building_id
"""

from __future__ import annotations

import hashlib
import json
import logging
import math
from uuid import UUID

import httpx
import sentry_sdk
import structlog
from postgrest.exceptions import APIError as PostgrestAPIError

from backend.services.external.openrouter import OpenRouterService
from backend.services.model_resolver import ModelResolver
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

# ── Personality extraction prompt ────────────────────────────────────────────

_EXTRACTION_SYSTEM_PROMPT = (
    "You are a personality analyst. Extract a structured Big Five personality "
    "profile from a fictional character's backstory. Base your analysis ONLY on "
    "the provided text. Return valid JSON, nothing else."
)

_EXTRACTION_USER_PROMPT = """Analyze this character and extract a personality profile.

Character: {agent_name}
Background: {agent_background}
Character Description: {agent_character}
Profession: {agent_profession}
Gender: {agent_gender}

Return a JSON object with these exact keys:
{{
  "openness": <0.0-1.0>,
  "conscientiousness": <0.0-1.0>,
  "extraversion": <0.0-1.0>,
  "agreeableness": <0.0-1.0>,
  "neuroticism": <0.0-1.0>,
  "dominant_traits": ["trait1", "trait2", "trait3"],
  "values": ["value1", "value2"],
  "fears": ["fear1", "fear2"],
  "social_style": "<one of: warm, reserved, volatile, calculating, gregarious>"
}}

Ensure values reflect the character's personality as implied by their backstory."""


# ── Personality-to-autonomy parameter mapping ────────────────────────────────

# Maps Big Five scores to autonomy system parameters
# These derivations are inspired by psychological research on trait correlations

def _derive_autonomy_params(profile: dict) -> dict:
    """Derive mood/needs parameters from Big Five personality profile."""
    o = profile.get("openness", 0.5)
    c = profile.get("conscientiousness", 0.5)
    e = profile.get("extraversion", 0.5)
    a = profile.get("agreeableness", 0.5)
    n = profile.get("neuroticism", 0.5)

    return {
        # Mood parameters
        "resilience": round(max(0.1, min(0.9, (1 - n) * 0.6 + c * 0.3 + 0.1)), 2),
        "volatility": round(max(0.1, min(0.9, n * 0.5 + (1 - a) * 0.3 + o * 0.1 + 0.1)), 2),
        "sociability": round(max(0.1, min(0.9, e * 0.6 + a * 0.3 + 0.1)), 2),
        # Need decay rates (higher = faster decay = more urgent)
        "social_decay": round(3.0 + e * 4.0, 1),        # Extraverts need social faster
        "purpose_decay": round(2.0 + c * 3.0, 1),        # Conscientious need purpose faster
        "safety_decay": round(1.0 + n * 3.0, 1),         # Neurotic need safety faster
        "comfort_decay": round(1.5 + (1 - o) * 2.5, 1),  # Low openness = more comfort need
        "stimulation_decay": round(2.0 + o * 4.0, 1),    # Open people crave stimulation
    }


class PersonalityExtractionService:
    """Extracts personality profiles and initializes agent autonomy data."""

    @classmethod
    async def extract_personality(
        cls,
        supabase: Client,
        agent_id: UUID,
        simulation_id: UUID,
        *,
        openrouter_api_key: str | None = None,
    ) -> dict:
        """Extract Big Five personality profile from agent backstory via LLM.

        Returns the parsed profile dict. Also stores it on the agent record.
        """
        structlog.contextvars.bind_contextvars(
            agent_id=str(agent_id),
            simulation_id=str(simulation_id),
        )

        # Fetch agent data
        result = await (
            supabase.table("agents")
            .select("name, character, background, primary_profession, gender, personality_profile")
            .eq("id", str(agent_id))
            .single()
            .execute()
        )
        agent = result.data
        if not agent:
            logger.warning("Agent not found for personality extraction")
            return {}

        # Skip if already extracted
        existing = agent.get("personality_profile")
        if existing and isinstance(existing, dict) and existing.get("openness") is not None:
            logger.info("Personality already extracted, skipping")
            return existing

        # Build prompt
        user_prompt = _EXTRACTION_USER_PROMPT.format(
            agent_name=agent.get("name", "Unknown"),
            agent_background=agent.get("background", "No background provided."),
            agent_character=agent.get("character", "No character description."),
            agent_profession=agent.get("primary_profession", "Unknown"),
            agent_gender=agent.get("gender", "Unknown"),
        )

        # Resolve model
        model_resolver = ModelResolver(supabase, simulation_id)
        resolved = await model_resolver.resolve_text_model("agent_description")

        # Call LLM
        openrouter = OpenRouterService(api_key=openrouter_api_key)
        try:
            content = await openrouter.generate(
                model=resolved.model_id,
                messages=[
                    {"role": "system", "content": _EXTRACTION_SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.3,
                max_tokens=512,
            )
        except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError):
            logger.exception("LLM call failed for personality extraction")
            sentry_sdk.capture_exception()
            return cls._default_profile()
        profile = cls._parse_profile(content)

        # Store on agent
        await supabase.table("agents").update(
            {"personality_profile": profile}
        ).eq("id", str(agent_id)).execute()

        logger.info(
            "Personality extracted",
            extra={
                "social_style": profile.get("social_style"),
                "traits": profile.get("dominant_traits"),
            },
        )
        return profile

    @classmethod
    async def initialize_agent_autonomy(
        cls,
        supabase: Client,
        agent_id: UUID,
        simulation_id: UUID,
        *,
        openrouter_api_key: str | None = None,
    ) -> None:
        """Full autonomy bootstrap: extract personality, derive params, create mood + needs.

        Idempotent -- safe to call on agents that already have autonomy data.
        """
        # Extract personality (or use existing)
        profile = await cls.extract_personality(
            supabase, agent_id, simulation_id,
            openrouter_api_key=openrouter_api_key,
        )

        # Derive autonomy parameters
        params = _derive_autonomy_params(profile)

        # Call PostgreSQL function to create mood + needs records (idempotent)
        await supabase.rpc("fn_initialize_agent_autonomy", {
            "p_agent_id": str(agent_id),
            "p_simulation_id": str(simulation_id),
            "p_resilience": params["resilience"],
            "p_volatility": params["volatility"],
            "p_sociability": params["sociability"],
            "p_social_decay": params["social_decay"],
            "p_purpose_decay": params["purpose_decay"],
            "p_safety_decay": params["safety_decay"],
            "p_comfort_decay": params["comfort_decay"],
            "p_stimulation_decay": params["stimulation_decay"],
        }).execute()

        logger.info(
            "Agent autonomy initialized",
            extra={"resilience": params["resilience"], "sociability": params["sociability"]},
        )

    @classmethod
    async def initialize_simulation_agents(
        cls,
        supabase: Client,
        simulation_id: UUID,
        *,
        openrouter_api_key: str | None = None,
    ) -> int:
        """Initialize autonomy for ALL agents in a simulation. Returns count processed."""
        result = await (
            supabase.table("agents")
            .select("id")
            .eq("simulation_id", str(simulation_id))
            .is_("deleted_at", "null")
            .execute()
        )
        agents = result.data or []
        processed = 0

        for agent_row in agents:
            try:
                await cls.initialize_agent_autonomy(
                    supabase, agent_row["id"], simulation_id,
                    openrouter_api_key=openrouter_api_key,
                )
                processed += 1
            except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError):
                logger.exception(
                    "Failed to initialize agent autonomy",
                    extra={"agent_id": agent_row["id"]},
                )
                sentry_sdk.capture_exception()

        # Bootstrap building_agent_relations from agents.current_building_id.
        # Creates 'works' records for agents assigned to buildings (idempotent).
        # Must run AFTER agents have current_building_id set (migration 157 or manual).
        try:
            bar_result = await supabase.rpc(
                "fn_bootstrap_building_relations",
                {"p_simulation_id": str(simulation_id)},
            ).execute()
            bar_count = bar_result.data if isinstance(bar_result.data, int) else 0
            logger.info(
                "Building agent relations bootstrapped",
                extra={"inserted": bar_count, "simulation_id": str(simulation_id)},
            )
        except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError):
            logger.exception(
                "Failed to bootstrap building agent relations",
                extra={"simulation_id": str(simulation_id)},
            )
            sentry_sdk.capture_exception()

        logger.info(
            "Simulation agents initialized",
            extra={"processed": processed, "total": len(agents)},
        )
        return processed

    @classmethod
    async def initialize_opinions(
        cls,
        supabase: Client,
        simulation_id: UUID,
    ) -> int:
        """Create opinion records for all agent pairs in a simulation.

        Computes base compatibility from Big Five profiles (deterministic,
        requires hashlib — stays in Python), then batch-upserts all pairs
        in a single DB call instead of N*(N-1) individual upserts.

        Returns count of opinion records created/updated.
        """
        result = await (
            supabase.table("agents")
            .select("id, personality_profile")
            .eq("simulation_id", str(simulation_id))
            .is_("deleted_at", "null")
            .execute()
        )
        agents = result.data or []
        if len(agents) < 2:
            return 0

        # Build all opinion rows in Python (O(N²) computation, but no DB calls)
        rows: list[dict] = []
        for i, agent_a in enumerate(agents):
            for agent_b in agents[i + 1:]:
                compat = cls.compute_base_compatibility(
                    agent_a.get("personality_profile", {}),
                    agent_b.get("personality_profile", {}),
                    agent_a["id"],
                    agent_b["id"],
                )
                opinion_score = round(compat * 20)

                # Bidirectional: A→B and B→A
                for source, target in [(agent_a, agent_b), (agent_b, agent_a)]:
                    rows.append({
                        "agent_id": source["id"],
                        "target_agent_id": target["id"],
                        "simulation_id": str(simulation_id),
                        "base_compatibility": compat,
                        "opinion_score": opinion_score,
                    })

        # Single batch upsert — 1 DB call instead of N*(N-1)
        if rows:
            await supabase.table("agent_opinions").upsert(
                rows,
                on_conflict="agent_id,target_agent_id",
            ).execute()

        logger.info("Opinions initialized", extra={"created": len(rows)})
        return len(rows)

    @staticmethod
    def compute_base_compatibility(
        profile_a: dict,
        profile_b: dict,
        agent_a_id: str | UUID,
        agent_b_id: str | UUID,
    ) -> float:
        """Compute deterministic base compatibility between two agents.

        Uses personality distance (Big Five Euclidean distance) plus a
        deterministic hash-based bias (RimWorld pattern) to create stable,
        asymmetric-proof compatibility scores.

        Returns: float in range [-0.3, 0.3]
        """
        # Big Five distance (inverted: similar = higher compatibility)
        dimensions = ("openness", "conscientiousness", "extraversion", "agreeableness", "neuroticism")
        dist = math.sqrt(sum(
            (profile_a.get(d, 0.5) - profile_b.get(d, 0.5)) ** 2
            for d in dimensions
        ))
        # Normalize: max distance = sqrt(5) ≈ 2.24, min = 0
        similarity = 1.0 - (dist / 2.24)  # 0..1

        # Deterministic hash bias (RimWorld-inspired: ensures consistency)
        pair_key = "".join(sorted([str(agent_a_id), str(agent_b_id)]))
        hash_val = int(hashlib.sha256(pair_key.encode()).hexdigest()[:8], 16)
        hash_bias = (hash_val % 100 - 50) / 500  # -0.1 .. +0.1

        # Combine: similarity drives most of it, hash adds variance
        compatibility = (similarity - 0.5) * 0.4 + hash_bias  # Maps to roughly -0.3..0.3
        return round(max(-0.3, min(0.3, compatibility)), 3)

    @staticmethod
    def _parse_profile(content: str) -> dict:
        """Parse LLM response into personality profile dict with validation."""
        try:
            # Extract JSON from potential markdown fences or surrounding text
            text = content.strip()
            if "```" in text:
                # Strip markdown code fences
                text = text.split("```json")[-1].split("```")[0].strip()
                if not text:
                    text = content.split("```")[-2].strip()
            # Find the JSON object
            start = text.find("{")
            end = text.rfind("}") + 1
            if start >= 0 and end > start:
                text = text[start:end]
            data = json.loads(text)
        except (json.JSONDecodeError, TypeError, ValueError):
            logger.warning("Failed to parse personality profile JSON, using defaults")
            return PersonalityExtractionService._default_profile()

        # Validate and clamp Big Five values
        profile: dict = {}
        for dim in ("openness", "conscientiousness", "extraversion", "agreeableness", "neuroticism"):
            val = data.get(dim, 0.5)
            try:
                profile[dim] = max(0.0, min(1.0, float(val)))
            except (ValueError, TypeError):
                profile[dim] = 0.5

        # Extract lists with type safety
        for field in ("dominant_traits", "values", "fears"):
            raw = data.get(field, [])
            profile[field] = [str(x) for x in raw][:5] if isinstance(raw, list) else []

        # Social style
        valid_styles = {"warm", "reserved", "volatile", "calculating", "gregarious"}
        style = str(data.get("social_style", "reserved")).lower()
        profile["social_style"] = style if style in valid_styles else "reserved"

        return profile

    @staticmethod
    def _default_profile() -> dict:
        """Fallback personality profile when extraction fails."""
        return {
            "openness": 0.5,
            "conscientiousness": 0.5,
            "extraversion": 0.5,
            "agreeableness": 0.5,
            "neuroticism": 0.5,
            "dominant_traits": [],
            "values": [],
            "fears": [],
            "social_style": "reserved",
        }

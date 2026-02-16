"""Model fallback chain for AI generation."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from uuid import UUID

from supabase import Client

logger = logging.getLogger(__name__)

# Platform defaults — used when simulation has no model configured
PLATFORM_DEFAULT_MODELS: dict[str, str] = {
    "agent_description": "deepseek/deepseek-chat-v3-0324",
    "agent_reactions": "meta-llama/llama-3.3-70b-instruct:free",
    "building_description": "meta-llama/llama-3.3-70b-instruct:free",
    "event_generation": "deepseek/deepseek-chat-v3-0324",
    "chat_response": "deepseek/deepseek-chat-v3-0324",
    "news_transformation": "meta-llama/llama-3.2-3b-instruct:free",
    "social_trends": "meta-llama/llama-3.3-70b-instruct:free",
    "default": "meta-llama/llama-3.3-70b-instruct:free",
    "fallback": "shisa-ai/shisa-v2-llama3.3-70b:free",
}

PLATFORM_DEFAULT_IMAGE_MODELS: dict[str, dict[str, str]] = {
    "agent_portrait": {
        "model": "stability-ai/stable-diffusion",
        "version": "ac732df83cea7fff2b7cf1003e0b4b7a9",
    },
    "building_image": {
        "model": "stability-ai/stable-diffusion",
        "version": "ac732df83cea7fff2b7cf1003e0b4b7a9",
    },
    "fallback": {
        "model": "stability-ai/stable-diffusion",
        "version": "ac732df83cea7fff2b7cf1003e0b4b7a9",
    },
}

PLATFORM_DEFAULT_PARAMS: dict[str, float | int | str] = {
    "temperature": 0.8,
    "max_tokens": 500,
    "image_width": 512,
    "image_height": 512,
    "guidance_scale": 7.5,
    "num_inference_steps": 50,
    "scheduler": "K_EULER",
    "negative_prompt_agent": "cartoon, anime, illustration, distorted, deformed, ugly, blurry",
    "negative_prompt_building": "people, humans, characters, faces, text, watermark",
}


@dataclass
class ResolvedModel:
    """Resolved model with all parameters."""

    model_id: str
    temperature: float = 0.8
    max_tokens: int = 500
    source: str = "platform_default"


@dataclass
class ResolvedImageModel:
    """Resolved image model with generation parameters."""

    model: str
    version: str
    width: int = 512
    height: int = 512
    guidance_scale: float = 7.5
    num_inference_steps: int = 50
    scheduler: str = "K_EULER"
    negative_prompt: str = ""
    source: str = "platform_default"


class ModelResolver:
    """Resolves the best model for a given purpose using a 4-level fallback chain.

    Resolution order:
    1. Simulation-specific model (ai.models.{purpose})
    2. Simulation default model (ai.models.default)
    3. Platform default model
    4. Platform fallback model
    """

    def __init__(self, supabase: Client, simulation_id: UUID):
        self._supabase = supabase
        self._simulation_id = simulation_id
        self._settings_cache: dict[str, str] | None = None

    async def _load_settings(self) -> dict[str, str]:
        """Load all AI-related settings for this simulation."""
        if self._settings_cache is not None:
            return self._settings_cache

        response = (
            self._supabase.table("simulation_settings")
            .select("setting_key, setting_value")
            .eq("simulation_id", str(self._simulation_id))
            .like("setting_key", "ai.%")
            .execute()
        )

        self._settings_cache = {}
        for row in response.data or []:
            key = row["setting_key"]
            value = row["setting_value"]
            if isinstance(value, str):
                self._settings_cache[key] = value
            elif isinstance(value, dict | list):
                # JSON values stored as-is
                self._settings_cache[key] = str(value)
            else:
                self._settings_cache[key] = str(value) if value is not None else ""

        return self._settings_cache

    async def resolve_text_model(self, purpose: str) -> ResolvedModel:
        """Resolve the best text model for the given purpose.

        Fallback chain:
        1. ai.models.{purpose} (simulation)
        2. ai.models.default (simulation)
        3. Platform default for purpose
        4. Platform fallback
        """
        ai_settings = await self._load_settings()

        # 1. Simulation-specific model for this purpose
        sim_model = ai_settings.get(f"ai.models.{purpose}")
        if sim_model:
            temp = self._get_float(ai_settings, f"ai.params.temperature.{purpose}", 0.8)
            tokens = self._get_int(ai_settings, f"ai.params.max_tokens.{purpose}", 500)
            return ResolvedModel(
                model_id=sim_model,
                temperature=temp,
                max_tokens=tokens,
                source=f"simulation.{purpose}",
            )

        # 2. Simulation default model
        sim_default = ai_settings.get("ai.models.default")
        if sim_default:
            temp = self._get_float(ai_settings, "ai.params.temperature.default", 0.8)
            tokens = self._get_int(ai_settings, "ai.params.max_tokens.default", 500)
            return ResolvedModel(
                model_id=sim_default,
                temperature=temp,
                max_tokens=tokens,
                source="simulation.default",
            )

        # 3. Platform default for purpose
        platform_model = PLATFORM_DEFAULT_MODELS.get(purpose)
        if platform_model:
            return ResolvedModel(
                model_id=platform_model,
                temperature=float(PLATFORM_DEFAULT_PARAMS.get("temperature", 0.8)),
                max_tokens=int(PLATFORM_DEFAULT_PARAMS.get("max_tokens", 500)),
                source=f"platform.{purpose}",
            )

        # 4. Platform fallback
        return ResolvedModel(
            model_id=PLATFORM_DEFAULT_MODELS["fallback"],
            temperature=0.7,
            max_tokens=500,
            source="platform.fallback",
        )

    async def resolve_image_model(self, purpose: str) -> ResolvedImageModel:
        """Resolve the best image model for the given purpose."""
        ai_settings = await self._load_settings()

        # Check simulation-specific image model
        sim_model = ai_settings.get(f"ai.image_models.{purpose}")
        sim_version = ai_settings.get(f"ai.image_models.{purpose}.version")

        if not sim_model:
            # Fall back to platform defaults
            platform = PLATFORM_DEFAULT_IMAGE_MODELS.get(
                purpose, PLATFORM_DEFAULT_IMAGE_MODELS["fallback"],
            )
            sim_model = platform["model"]
            sim_version = platform["version"]

        # Load image parameters (simulation override or platform default)
        width = self._get_int(ai_settings, "ai.image_params.width", 512)
        height = self._get_int(ai_settings, "ai.image_params.height", 512)
        guidance = self._get_float(ai_settings, "ai.image_params.guidance_scale", 7.5)
        steps = self._get_int(ai_settings, "ai.image_params.num_inference_steps", 50)
        scheduler = ai_settings.get(
            "ai.image_params.scheduler",
            str(PLATFORM_DEFAULT_PARAMS.get("scheduler", "K_EULER")),
        )

        # Negative prompt per purpose type
        neg_key = "agent" if "portrait" in purpose else "building"
        negative = ai_settings.get(
            f"ai.params.negative_prompt.{neg_key}",
            str(PLATFORM_DEFAULT_PARAMS.get(f"negative_prompt_{neg_key}", "")),
        )

        return ResolvedImageModel(
            model=sim_model,
            version=sim_version or "",
            width=width,
            height=height,
            guidance_scale=guidance,
            num_inference_steps=steps,
            scheduler=scheduler,
            negative_prompt=negative,
            source="simulation" if ai_settings.get(f"ai.image_models.{purpose}") else "platform",
        )

    @staticmethod
    def _get_float(settings: dict[str, str], key: str, default: float) -> float:
        val = settings.get(key)
        if val is None:
            return default
        try:
            return float(val)
        except (ValueError, TypeError):
            return default

    @staticmethod
    def _get_int(settings: dict[str, str], key: str, default: int) -> int:
        val = settings.get(key)
        if val is None:
            return default
        try:
            return int(float(val))
        except (ValueError, TypeError):
            return default

"""Model fallback chain for AI generation."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from uuid import UUID

from supabase import Client

logger = logging.getLogger(__name__)

# Platform defaults — used when simulation has no model configured
PLATFORM_DEFAULT_MODELS: dict[str, str] = {
    "agent_description": "deepseek/deepseek-v3.2",
    "agent_reactions": "deepseek/deepseek-v3.2",
    "building_description": "deepseek/deepseek-v3.2",
    "event_generation": "deepseek/deepseek-v3.2",
    "chat_response": "deepseek/deepseek-v3.2",
    "news_transformation": "deepseek/deepseek-v3.2",
    "social_trends": "deepseek/deepseek-v3.2",
    "default": "deepseek/deepseek-v3.2",
    "fallback": "deepseek/deepseek-r1-0528:free",
}

# Platform default image models — SD 1.5 as cheap default ($0.002/img)
# Simulations can override to Flux Dev ($0.025/img) via settings
PLATFORM_DEFAULT_IMAGE_MODELS: dict[str, str] = {
    "agent_portrait": "stability-ai/stable-diffusion:ac732df83cea7fff18b8472768c88ad041fa750ff7682a21affe81863cbe77e4",
    "building_image": "stability-ai/stable-diffusion:ac732df83cea7fff18b8472768c88ad041fa750ff7682a21affe81863cbe77e4",
    "fallback": "stability-ai/stable-diffusion:ac732df83cea7fff18b8472768c88ad041fa750ff7682a21affe81863cbe77e4",
}

PLATFORM_DEFAULT_PARAMS: dict[str, float | int | str] = {
    "temperature": 0.8,
    "max_tokens": 1500,
    # SD defaults
    "image_width_portrait": 512,
    "image_height_portrait": 768,
    "image_width_building": 768,
    "image_height_building": 512,
    "image_guidance_scale": 7.5,
    "image_num_inference_steps": 50,
    "image_scheduler": "K_EULER",
    "negative_prompt_agent": (
        "cartoon, anime, illustration, painting, drawing, artistic, "
        "distorted, deformed, low quality, blurry, text, watermark, signature, "
        "multiple people, group, crowd, couple, two people, two faces, "
        "extra limbs, extra fingers, cropped, out of frame, full body, "
        "bright colors, cheerful, happy, colorful, vibrant, sunny"
    ),
    "negative_prompt_building": (
        "people, humans, characters, faces, text, watermark, "
        "cartoon, anime, low quality, blurry, distorted, "
        "bright colors, cheerful, happy, colorful, vibrant, sunny, "
        "modern glass, clean minimalist, utopian"
    ),
    # Flux defaults (used when model contains "flux")
    "flux_guidance": 3.5,
    "flux_num_inference_steps": 28,
    "flux_aspect_ratio_portrait": "3:4",
    "flux_aspect_ratio_building": "4:3",
    "flux_output_format": "webp",
    "flux_output_quality": 90,
}

# Generic platform default style prompts (neutral, no brutalist)
PLATFORM_DEFAULT_STYLE_PROMPTS: dict[str, str] = {
    "portrait": (
        "photorealistic portrait photograph, cinematic lighting, "
        "shallow depth of field, single subject, high detail"
    ),
    "building": (
        "architectural photograph, cinematic composition, "
        "photorealistic, high detail, dramatic lighting"
    ),
}


@dataclass
class ResolvedModel:
    """Resolved model with all parameters."""

    model_id: str
    temperature: float = 0.8
    max_tokens: int = 1500
    source: str = "platform_default"


@dataclass
class ResolvedImageModel:
    """Resolved image model with generation parameters.

    The `model` field uses SDK convention:
    - "black-forest-labs/flux-dev" (official, no version)
    - "stability-ai/stable-diffusion:ac732d..." (version-hash appended)
    """

    model: str
    # SD-specific params (ignored by Flux)
    width: int = 512
    height: int = 512
    guidance_scale: float = 7.5
    num_inference_steps: int = 50
    scheduler: str = "K_EULER"
    negative_prompt: str = ""
    # Flux-specific params (ignored by SD)
    aspect_ratio: str = ""
    output_format: str = "webp"
    output_quality: int = 90
    # LoRA (Flux only)
    lora_url: str = ""
    lora_scale: float = 0.85
    # Metadata
    source: str = "platform_default"

    @property
    def is_flux(self) -> bool:
        """Check if this is a Flux model."""
        return "flux" in self.model.lower()

    def to_replicate_params(self) -> dict:
        """Build params dict for ReplicateService.generate_image()."""
        if self.is_flux:
            params: dict = {
                "guidance": self.guidance_scale,
                "num_inference_steps": self.num_inference_steps,
                "output_format": self.output_format,
                "output_quality": self.output_quality,
            }
            if self.aspect_ratio:
                params["aspect_ratio"] = self.aspect_ratio
            if self.lora_url and "lora" in self.model.lower():
                params["hf_lora"] = self.lora_url
                params["lora_scale"] = self.lora_scale
            return params

        # SD params
        return {
            "width": self.width,
            "height": self.height,
            "guidance_scale": self.guidance_scale,
            "num_inference_steps": self.num_inference_steps,
            "scheduler": self.scheduler,
            "negative_prompt": self.negative_prompt,
        }


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
            .eq("category", "ai")
            .execute()
        )

        self._settings_cache = {}
        for row in response.data or []:
            key = row["setting_key"]
            value = row["setting_value"]
            # Strip surrounding quotes from JSON string values
            if isinstance(value, str) and value.startswith('"') and value.endswith('"'):
                self._settings_cache[key] = value[1:-1]
            elif isinstance(value, str):
                self._settings_cache[key] = value
            elif isinstance(value, dict | list):
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
        sim_model = ai_settings.get(f"model_{purpose}")
        if sim_model:
            temp = self._get_float(ai_settings, "default_temperature", 0.8)
            tokens = self._get_int(ai_settings, "default_max_tokens", 1500)
            return ResolvedModel(
                model_id=sim_model,
                temperature=temp,
                max_tokens=tokens,
                source=f"simulation.{purpose}",
            )

        # 2. Simulation default model
        sim_default = ai_settings.get("model_fallback")
        if sim_default:
            temp = self._get_float(ai_settings, "default_temperature", 0.8)
            tokens = self._get_int(ai_settings, "default_max_tokens", 1500)
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
                max_tokens=int(PLATFORM_DEFAULT_PARAMS.get("max_tokens", 1500)),
                source=f"platform.{purpose}",
            )

        # 4. Platform fallback
        return ResolvedModel(
            model_id=PLATFORM_DEFAULT_MODELS["fallback"],
            temperature=0.7,
            max_tokens=1500,
            source="platform.fallback",
        )

    async def resolve_image_model(self, purpose: str) -> ResolvedImageModel:
        """Resolve the best image model for the given purpose.

        The model string uses SDK convention:
        - "black-forest-labs/flux-dev" for Flux official models
        - "stability-ai/stable-diffusion:ac732d..." for version-hash models
        """
        ai_settings = await self._load_settings()

        # Resolve model (may be "black-forest-labs/flux-dev" or "stability-ai/stable-diffusion:hash")
        sim_model = ai_settings.get(f"image_model_{purpose}")
        if not sim_model:
            sim_model = PLATFORM_DEFAULT_IMAGE_MODELS.get(
                purpose, PLATFORM_DEFAULT_IMAGE_MODELS["fallback"],
            )

        is_flux = "flux" in sim_model.lower()
        is_portrait = "portrait" in purpose

        if is_flux:
            # Flux parameters
            ar_key = "portrait" if is_portrait else "building"
            default_ar = str(PLATFORM_DEFAULT_PARAMS.get(f"flux_aspect_ratio_{ar_key}", "3:4"))
            guidance = self._get_float(
                ai_settings, "image_guidance_scale",
                float(PLATFORM_DEFAULT_PARAMS.get("flux_guidance", 3.5)),
            )
            steps = self._get_int(
                ai_settings, "image_num_inference_steps",
                int(PLATFORM_DEFAULT_PARAMS.get("flux_num_inference_steps", 28)),
            )
            aspect_ratio = ai_settings.get("image_aspect_ratio", default_ar)
            output_format = ai_settings.get(
                "image_output_format",
                str(PLATFORM_DEFAULT_PARAMS.get("flux_output_format", "webp")),
            )
            output_quality = self._get_int(
                ai_settings, "image_output_quality",
                int(PLATFORM_DEFAULT_PARAMS.get("flux_output_quality", 90)),
            )
            lora_url = ai_settings.get("image_lora_url", "")
            lora_scale = self._get_float(ai_settings, "image_lora_scale", 0.85)

            return ResolvedImageModel(
                model=sim_model,
                guidance_scale=guidance,
                num_inference_steps=steps,
                aspect_ratio=aspect_ratio,
                output_format=output_format,
                output_quality=output_quality,
                lora_url=lora_url,
                lora_scale=lora_scale,
                source="simulation" if ai_settings.get(f"image_model_{purpose}") else "platform",
            )

        # SD parameters
        default_w = int(PLATFORM_DEFAULT_PARAMS.get(
            f"image_width_{'portrait' if is_portrait else 'building'}", 512,
        ))
        default_h = int(PLATFORM_DEFAULT_PARAMS.get(
            f"image_height_{'portrait' if is_portrait else 'building'}", 768 if is_portrait else 512,
        ))
        width = self._get_int(ai_settings, "image_width", default_w)
        height = self._get_int(ai_settings, "image_height", default_h)
        guidance = self._get_float(
            ai_settings, "image_guidance_scale",
            float(PLATFORM_DEFAULT_PARAMS.get("image_guidance_scale", 7.5)),
        )
        steps = self._get_int(
            ai_settings, "image_num_inference_steps",
            int(PLATFORM_DEFAULT_PARAMS.get("image_num_inference_steps", 50)),
        )
        scheduler = ai_settings.get(
            "image_scheduler",
            str(PLATFORM_DEFAULT_PARAMS.get("image_scheduler", "K_EULER")),
        )

        # Negative prompt per purpose type
        neg_key = "agent" if is_portrait else "building"
        negative = ai_settings.get(
            f"negative_prompt_{neg_key}",
            str(PLATFORM_DEFAULT_PARAMS.get(f"negative_prompt_{neg_key}", "")),
        )

        return ResolvedImageModel(
            model=sim_model,
            width=width,
            height=height,
            guidance_scale=guidance,
            num_inference_steps=steps,
            scheduler=scheduler,
            negative_prompt=negative,
            source="simulation" if ai_settings.get(f"image_model_{purpose}") else "platform",
        )

    async def resolve_style_prompt(self, purpose: str) -> str:
        """Resolve the style prompt for image generation.

        Looks up `image_style_prompt_{purpose}` in simulation settings,
        falls back to platform defaults.

        Args:
            purpose: "portrait" or "building"

        Returns:
            Style prompt string to append to image generation prompts.
        """
        ai_settings = await self._load_settings()
        style = ai_settings.get(f"image_style_prompt_{purpose}", "")
        if style:
            return style
        return PLATFORM_DEFAULT_STYLE_PROMPTS.get(purpose, "")

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

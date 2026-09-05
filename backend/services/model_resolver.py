"""Model fallback chain for AI generation."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from uuid import UUID

from backend.services.constants import PLATFORM_DEFAULT_MODELS
from backend.services.image_content_policy import ContentRating
from backend.services.image_model_families import ImageModelFamily, family_for
from backend.services.platform_model_config import get_platform_model
from backend.utils.db import maybe_single_data
from backend.utils.responses import extract_list
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

# Re-export for backwards compatibility
__all__ = ["PLATFORM_DEFAULT_MODELS", "ModelResolver", "ResolvedModel", "ResolvedImageModel"]

# Platform default image models — FLUX.2 Pro for quality + commercial license ($0.031/img)
# Upgraded from flux-dev (non-commercial) in April 2026.
# Simulations can override via settings.
PLATFORM_DEFAULT_IMAGE_MODELS: dict[str, str] = {
    "agent_portrait": "black-forest-labs/flux-2-pro",
    "building_image": "black-forest-labs/flux-2-pro",
    "lore_image": "black-forest-labs/flux-2-pro",
    "banner": "black-forest-labs/flux-2-pro",
    "fallback": "black-forest-labs/flux-2-pro",
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
        "cartoon, anime, illustration, painting, drawing, "
        "distorted, deformed, low quality, blurry, text, watermark, signature, "
        "multiple people, group, crowd, couple, two people, two faces, "
        "extra limbs, extra fingers, cropped, out of frame, full body"
    ),
    "negative_prompt_building": (
        "people, humans, characters, faces, text, watermark, cartoon, anime, low quality, blurry, distorted"
    ),
    # Flux defaults (used when model contains "flux")
    "flux_guidance": 3.5,
    "flux_num_inference_steps": 28,
    "flux_aspect_ratio_portrait": "3:4",
    "flux_aspect_ratio_building": "4:3",
    "flux_output_format": "png",
    "flux_output_quality": 100,
}

# Generic platform default style prompts (neutral, world-adaptive)
PLATFORM_DEFAULT_STYLE_PROMPTS: dict[str, str] = {
    "portrait": (
        "photorealistic portrait photograph, cinematic lighting, "
        "shallow depth of field, single subject, high detail, "
        "rich color palette, environmental context visible"
    ),
    "building": (
        "architectural photograph, cinematic composition, "
        "photorealistic, high detail, dramatic lighting, "
        "atmospheric perspective, rich textures and materials"
    ),
    "banner": (
        "cinematic matte painting, epic scale, volumetric lighting, rich color, high detail, no text, no UI elements"
    ),
    "lore": (
        "atmospheric concept art, painterly composition, moody lighting, "
        "rich environmental detail, vivid color, no text, no UI elements"
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
    output_format: str = "png"
    output_quality: int = 100
    # LoRA (Flux only)
    lora_url: str = ""
    lora_scale: float = 0.85
    # img2img reference
    reference_image_url: str = ""
    img2img_strength: float = 0.75
    #: Weitere Referenzbilder — die Figurenkonstanz einer Szene mit mehreren
    #: Personen. Nur Flux 2 nimmt sie (`input_images`, bis zu acht); jede
    #: andere Familie verwendet `reference_image_url` allein.
    extra_reference_urls: tuple[str, ...] = ()
    #: Wie freizuegig das Modell sein darf, 1 (streng) bis 6 (offen). Bis zum
    #: 05.09.2026 stand hier fest verdrahtet die 5. Eine Zahl, die niemand
    #: waehlen kann, ist keine Einstellung — und bei einer Plattform mit
    #: Inhaltsstufen ist sie genau die falsche Konstante.
    safety_tolerance: int = 2
    # Metadata
    source: str = "platform_default"

    @property
    def family(self) -> ImageModelFamily:
        """Welche Felder dieses Modell annimmt. Siehe `image_model_families`."""
        return family_for(self.model)

    @property
    def is_flux(self) -> bool:
        """Check if this is a Flux model."""
        return self.family.name.startswith("flux")

    @property
    def is_img2img(self) -> bool:
        """Check if this model should use img2img pipeline."""
        return bool(self.reference_image_url)

    @property
    def references(self) -> list[str]:
        """Alle Referenzbilder, so viele wie die Familie nimmt."""
        alle = [self.reference_image_url, *self.extra_reference_urls]
        return [u for u in alle if u][: self.family.max_references]

    @property
    def prompt_param_name(self) -> str:
        """Return the prompt parameter name for the current model.

        bxclib2/flux_img2img uses ``positive_prompt``;
        most other models use ``prompt``.
        """
        if self.is_img2img and "flux_img2img" in self.model:
            return "positive_prompt"
        return "prompt"

    def to_replicate_params(self) -> dict:
        """Die Felder, die DIESES Modell annimmt — und keine anderen.

        Vorher entschied ein `is_flux` ueber drei Familien mit drei Schemata.
        Was dabei herauskam, steht im Kopf von `image_model_families`: drei
        Felder gingen an ein Modell, das sie nicht kennt, und Replicate hat das
        weder abgelehnt noch gemeldet.

        Gebaut wird jetzt aus der Familie. Ein Feld, das sie nicht fuehrt, wird
        nicht gesendet — nicht, weil es schadet, sondern weil ein gesendetes
        Feld ohne Wirkung eine Einstellung vortaeuscht, die es nicht gibt.
        """
        fam = self.family
        params: dict = {}

        if fam.guidance_field:
            params[fam.guidance_field] = self.guidance_scale
        if fam.steps_field:
            params[fam.steps_field] = self.num_inference_steps

        if fam.size_field == "megapixels":
            params["megapixels"] = "1"
        elif fam.size_field == "resolution":
            # Flux 2 rechnet in Megapixeln als ZAHL, nicht als Zeichenkette.
            # Ohne dieses Feld nimmt das Modell seine eigene Vorgabe, und die
            # ist nicht die guenstigste.
            params["resolution"] = 1
        elif fam.size_field == "width_height":
            params["width"] = self.width
            params["height"] = self.height

        if fam.supports_negative_prompt and self.negative_prompt:
            params["negative_prompt"] = self.negative_prompt

        if fam.safety == "tolerance":
            params["safety_tolerance"] = self.safety_tolerance
        elif fam.safety == "checker":
            # Der Schalter ist umgekehrt gepolt: `True` schaltet die Pruefung
            # AB. Er faellt nur auf der offensten Stufe, damit eine Welt ohne
            # Inhaltsstufe nicht versehentlich ungefiltert erzeugt.
            params["disable_safety_checker"] = self.safety_tolerance >= 5

        refs = self.references
        if refs:
            if fam.reference == "list":
                params[fam.reference_field] = refs
            else:
                params[fam.reference_field] = refs[0]
                for feld in fam.strength_fields:
                    params[feld] = self.img2img_strength

        if self.aspect_ratio and fam.supports_aspect_ratio and fam.size_field != "width_height":
            params["aspect_ratio"] = self.aspect_ratio
        if fam.supports_output_fields:
            params["output_format"] = self.output_format or "png"
            params["output_quality"] = self.output_quality
        if self.lora_url and "lora" in self.model.lower():
            params["hf_lora"] = self.lora_url
            params["lora_scale"] = self.lora_scale

        return params


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
        #: Die Modelltabelle der Erwachsenenspur. Eigener Zwischenspeicher,
        #: weil sie aus `platform_settings` kommt und nicht aus den
        #: Einstellungen dieser Welt — zwei Herkuenfte, zwei Speicher.
        self._mature_cache: dict | None = None
        self._toleranz_cache: dict[str, int] = {}

    async def _load_settings(self) -> dict[str, str]:
        """Load all AI-related settings for this simulation."""
        if self._settings_cache is not None:
            return self._settings_cache

        response = await (
            self._supabase.table("simulation_settings")
            .select("setting_key, setting_value")
            .eq("simulation_id", str(self._simulation_id))
            .eq("category", "ai")
            .execute()
        )

        self._settings_cache = {}
        for row in extract_list(response):
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

        # 3. Platform default for purpose (admin-configurable via platform_settings)
        platform_model = get_platform_model(purpose)
        if platform_model:
            return ResolvedModel(
                model_id=platform_model,
                temperature=float(PLATFORM_DEFAULT_PARAMS.get("temperature", 0.8)),
                max_tokens=int(PLATFORM_DEFAULT_PARAMS.get("max_tokens", 1500)),
                source=f"platform.{purpose}",
            )

        # 4. Platform fallback (admin-configurable)
        return ResolvedModel(
            model_id=get_platform_model("fallback"),
            temperature=0.7,
            max_tokens=1500,
            source="platform.fallback",
        )

    async def _mature_model(self, purpose: str) -> str:
        """Das Modell der Erwachsenenspur, oder ``""`` wenn sie nicht eingerichtet ist.

        Getrennte Zeile und nicht ein Regler am bestehenden Modell: Flux 2
        filtert beim Anbieter, die SDXL-Abkoemmlinge tun es nicht, und zwischen
        beiden liegt keine Zahl, sondern eine andere Familie mit anderen
        Parametern (siehe `image_model_families`).

        Leer heisst: die Stufe ist nicht eingerichtet. Dann faellt der Aufruf auf
        die jugendfreie Spur zurueck — das ist die richtige Richtung, in die
        eine fehlende Einstellung irren soll.
        """
        if self._mature_cache is None:
            zeile = await maybe_single_data(
                self._supabase.table("platform_settings")
                .select("setting_value")
                .eq("setting_key", "image_models_mature")
                .maybe_single()
            )
            wert = (zeile or {}).get("setting_value")
            if isinstance(wert, str):
                try:
                    wert = json.loads(wert)
                except (json.JSONDecodeError, TypeError):
                    wert = {}
            self._mature_cache = wert if isinstance(wert, dict) else {}

        return str(self._mature_cache.get(purpose) or self._mature_cache.get("fallback") or "")

    async def _safety_tolerance(self, rating: ContentRating) -> int:
        """Wie offen das Modell erzeugen darf — vom Betreiber, nicht aus dem Code.

        Zwei Schluessel, `image_safety_tolerance_general` und
        `image_safety_tolerance_mature`, und die Zahl bedeutet in beiden
        Familien etwas anderes: Flux 2 nimmt sie woertlich als
        `safety_tolerance` (1 streng bis 6 offen), die SD-Abkoemmlinge kennen
        nur einen Schalter, der ab 5 umlegt (siehe `to_replicate_params`).

        Diese Zeilen standen vorher NUR in `forge_image_service`, und zwar als
        `5 if MATURE else 2` — mit einem Kommentar darueber, der behauptete,
        die Werte kaemen aus `image_safety_tolerance_*`. Sie kamen nie von
        dort. Jeder andere Aufrufer der Erwachsenenspur bekam still die
        vorsichtige 2, also ein weichgezeichnetes Bild ohne Fehlermeldung und
        ohne dass jemand den eingestellten Wert wiedergefunden haette.
        """
        schluessel = (
            "image_safety_tolerance_mature"
            if rating is ContentRating.MATURE
            else "image_safety_tolerance_general"
        )
        if schluessel not in self._toleranz_cache:
            zeile = await maybe_single_data(
                self._supabase.table("platform_settings")
                .select("setting_value")
                .eq("setting_key", schluessel)
                .maybe_single()
            )
            wert = (zeile or {}).get("setting_value")
            if isinstance(wert, str):
                try:
                    wert = json.loads(wert)
                except (json.JSONDecodeError, TypeError):
                    wert = None
            # Die Vorgabe irrt in die vorsichtige Richtung, wenn der Schluessel
            # fehlt — aber NUR fuer die jugendfreie Stufe. Fehlt der
            # Erwachsenenschluessel, waere eine 2 keine Vorsicht, sondern eine
            # stille Verweigerung dessen, was der Nutzer eingestellt hat.
            vorgabe = 5 if rating is ContentRating.MATURE else 2
            try:
                self._toleranz_cache[schluessel] = int(wert) if wert is not None else vorgabe
            except (TypeError, ValueError):
                self._toleranz_cache[schluessel] = vorgabe
        return self._toleranz_cache[schluessel]

    async def resolve_image_model(
        self,
        purpose: str,
        *,
        rating: ContentRating = ContentRating.GENERAL,
    ) -> ResolvedImageModel:
        """Resolve the best image model for the given purpose.

        The model string uses SDK convention:
        - "black-forest-labs/flux-dev" for Flux official models
        - "stability-ai/stable-diffusion:ac732d..." for version-hash models
        """
        ai_settings = await self._load_settings()

        # Die Erwachsenenspur hat Vorrang vor der Weltwahl, aber nur, wenn die
        # Stufe schon durch `image_content_policy.resolve_rating` gegangen ist —
        # dieser Aufruf PRUEFT sie nicht, er fuehrt sie aus. Wer `rating` hier
        # setzt, ohne vorher zu rechnen, umgeht Welt und Konto.
        mature_model = await self._mature_model(purpose) if rating is ContentRating.MATURE else ""

        # Resolve model (may be "black-forest-labs/flux-dev" or "stability-ai/stable-diffusion:hash")
        sim_model = mature_model or ai_settings.get(f"image_model_{purpose}")
        if not sim_model:
            sim_model = PLATFORM_DEFAULT_IMAGE_MODELS.get(
                purpose,
                PLATFORM_DEFAULT_IMAGE_MODELS["fallback"],
            )

        is_flux = "flux" in sim_model.lower()
        is_portrait = "portrait" in purpose

        if is_flux:
            # Flux parameters
            ar_key = "portrait" if is_portrait else "building"
            default_ar = str(PLATFORM_DEFAULT_PARAMS.get(f"flux_aspect_ratio_{ar_key}", "3:4"))
            flux_default = float(PLATFORM_DEFAULT_PARAMS.get("flux_guidance", 3.5))
            stored_guidance = self._get_float(ai_settings, "image_guidance_scale", flux_default)
            # `image_guidance_scale` is ONE settings key read by two branches
            # whose scales differ: Stable Diffusion wants ~7.5, flux wants ~3.5.
            # When the platform switched its default image model to flux, the
            # per-simulation rows written in the SD era stayed behind in the SD
            # scale, and nothing looked at them again. Measured on production
            # 2026-08-30: of 41 worlds, 14 carry exactly 7.5 (the SD-era platform
            # default, last written 2026-04-10) and ALL 14 resolve to a flux
            # model — 11 of them because they have no `image_model_*` row at all
            # and inherit `PLATFORM_DEFAULT_IMAGE_MODELS`, which is flux-2-pro.
            # 16 more carry 5.0, which is no platform default in either family
            # and therefore someone's choice; 11 carry the flux default.
            #
            # This does NOT clamp the value down. Picking a "sane flux ceiling"
            # would be inventing a threshold no measurement here supports, and
            # it would change how 30 worlds look without anyone deciding to. It
            # reports the one value that is provably residue rather than a
            # choice — a row equal to the SD default, resolving for flux — so
            # the repair is a decision someone makes, with a number in front of
            # them. See finding 14.
            sd_default = float(PLATFORM_DEFAULT_PARAMS.get("image_guidance_scale", 7.5))
            if stored_guidance == sd_default and "image_guidance_scale" in ai_settings:
                logger.warning(
                    "Simulation %s resolves a flux model with guidance %.1f – that is the "
                    "Stable-Diffusion-era platform default, not a flux value (flux default %.1f). "
                    "Most likely an un-migrated row from before the image model family switch.",
                    self._simulation_id,
                    stored_guidance,
                    flux_default,
                    extra={
                        "simulation_id": str(self._simulation_id),
                        "purpose": purpose,
                        "model": sim_model,
                        "guidance": stored_guidance,
                        "flux_default": flux_default,
                    },
                )
            guidance = min(stored_guidance, 10.0)  # Flux-dev hard max
            steps = self._get_int(
                ai_settings,
                "image_num_inference_steps",
                int(PLATFORM_DEFAULT_PARAMS.get("flux_num_inference_steps", 28)),
            )
            aspect_ratio = ai_settings.get("image_aspect_ratio", default_ar)
            output_format = ai_settings.get(
                "image_output_format",
                str(PLATFORM_DEFAULT_PARAMS.get("flux_output_format", "png")),
            )
            output_quality = self._get_int(
                ai_settings,
                "image_output_quality",
                int(PLATFORM_DEFAULT_PARAMS.get("flux_output_quality", 100)),
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
                safety_tolerance=await self._safety_tolerance(rating),
                source="simulation" if ai_settings.get(f"image_model_{purpose}") else "platform",
            )

        # SD parameters
        default_w = int(
            PLATFORM_DEFAULT_PARAMS.get(
                f"image_width_{'portrait' if is_portrait else 'building'}",
                512,
            )
        )
        default_h = int(
            PLATFORM_DEFAULT_PARAMS.get(
                f"image_height_{'portrait' if is_portrait else 'building'}",
                768 if is_portrait else 512,
            )
        )
        width = self._get_int(ai_settings, "image_width", default_w)
        height = self._get_int(ai_settings, "image_height", default_h)
        guidance = self._get_float(
            ai_settings,
            "image_guidance_scale",
            float(PLATFORM_DEFAULT_PARAMS.get("image_guidance_scale", 7.5)),
        )
        steps = self._get_int(
            ai_settings,
            "image_num_inference_steps",
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
            safety_tolerance=await self._safety_tolerance(rating),
            source="simulation" if ai_settings.get(f"image_model_{purpose}") else "platform",
        )

    async def resolve_img2img_model(self, purpose: str) -> ResolvedImageModel:
        """Resolve the img2img model for style-reference generation.

        Checks simulation setting `image_ref_model`, falls back to
        platform default img2img model.
        """
        ai_settings = await self._load_settings()
        model_id = ai_settings.get(
            "image_ref_model",
            "bxclib2/flux_img2img:0ce45202d83c6bd379dfe58f4c0c41e6cadf93ebbd9d938cc63cc0f2fcb729a5",
        )

        is_portrait = "portrait" in purpose
        ar_key = "portrait" if is_portrait else "building"
        default_ar = str(PLATFORM_DEFAULT_PARAMS.get(f"flux_aspect_ratio_{ar_key}", "3:4"))

        guidance = self._get_float(ai_settings, "image_guidance_scale", 3.5)
        if "flux" in model_id.lower():
            guidance = min(guidance, 10.0)

        return ResolvedImageModel(
            model=model_id,
            guidance_scale=guidance,
            num_inference_steps=self._get_int(ai_settings, "image_num_inference_steps", 28),
            aspect_ratio=ai_settings.get("image_aspect_ratio", default_ar),
            output_format=ai_settings.get("image_output_format", "png"),
            output_quality=self._get_int(ai_settings, "image_output_quality", 100),
            source="img2img",
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

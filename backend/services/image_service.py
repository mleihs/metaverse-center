"""End-to-end image generation pipeline."""

from __future__ import annotations

import io
import logging
from uuid import UUID, uuid4

from backend.services.external.replicate import ReplicateService
from backend.services.generation_service import GenerationService
from backend.services.model_resolver import ModelResolver
from supabase import Client

logger = logging.getLogger(__name__)

MAX_IMAGE_DIMENSION = 1024
WEBP_QUALITY = 85


class ImageService:
    """Orchestrates image generation: description -> Replicate -> WebP -> Storage."""

    def __init__(
        self,
        supabase: Client,
        simulation_id: UUID,
        replicate_api_key: str | None = None,
        openrouter_api_key: str | None = None,
    ):
        self._supabase = supabase
        self._simulation_id = simulation_id
        self._replicate = ReplicateService(api_key=replicate_api_key)
        self._generation = GenerationService(
            supabase, simulation_id, openrouter_api_key=openrouter_api_key,
        )
        self._model_resolver = ModelResolver(supabase, simulation_id)

    async def generate_agent_portrait(
        self,
        agent_id: UUID,
        agent_name: str,
        agent_data: dict | None = None,
    ) -> str:
        """Generate a portrait for an agent and upload to storage.

        Returns the public URL of the uploaded portrait.
        """
        # 1. Generate portrait description (always English for image models)
        description = await self._generation.generate_portrait_description(
            agent_name=agent_name,
            agent_data=agent_data,
            locale="en",
        )
        logger.info(
            "Portrait description for '%s': %s",
            agent_name,
            description[:100],
        )

        # 2. Append style prompt from settings
        style_prompt = await self._model_resolver.resolve_style_prompt("portrait")
        if style_prompt:
            description = f"{description}, {style_prompt}"

        # 3. Generate image via Replicate
        image_model = await self._model_resolver.resolve_image_model(
            "agent_portrait",
        )
        raw_bytes = await self._replicate.generate_image(
            model=image_model.model,
            prompt=description,
            **image_model.to_replicate_params(),
        )

        # 4. Convert to WebP (skip if Flux already outputs WebP)
        webp_bytes = _convert_to_webp(raw_bytes)

        # 5. Upload to Supabase Storage
        filename = f"{self._simulation_id}/{agent_id}/{uuid4()}.webp"
        url = await self._upload_to_storage(
            bucket="agent.portraits",
            path=filename,
            data=webp_bytes,
        )

        # 6. Update agent record
        self._supabase.table("agents").update(
            {"portrait_image_url": url},
        ).eq("id", str(agent_id)).execute()

        logger.info("Portrait uploaded for agent %s: %s", agent_id, url)
        return url

    async def generate_building_image(
        self,
        building_id: UUID,
        building_name: str,
        building_type: str,
        building_data: dict | None = None,
    ) -> str:
        """Generate an image for a building and upload to storage.

        Uses a dedicated building_image_description template (same pattern as
        portrait generation) to produce a proper image-generation prompt that
        reflects the building's game-state properties.
        """
        # 1. Generate building image description via LLM template
        description = await self._generation.generate_building_image_description(
            building_name=building_name,
            building_type=building_type,
            building_data=building_data,
        )
        logger.info(
            "Building image description for '%s': %s",
            building_name,
            description[:100],
        )

        # 2. Append style prompt from settings
        style_prompt = await self._model_resolver.resolve_style_prompt("building")
        if style_prompt:
            description = f"{description}, {style_prompt}"

        # 3. Generate image
        image_model = await self._model_resolver.resolve_image_model(
            "building_image",
        )
        raw_bytes = await self._replicate.generate_image(
            model=image_model.model,
            prompt=description,
            **image_model.to_replicate_params(),
        )

        # 4. Convert to WebP
        webp_bytes = _convert_to_webp(raw_bytes)

        # 5. Upload
        filename = f"{self._simulation_id}/{building_id}/{uuid4()}.webp"
        url = await self._upload_to_storage(
            bucket="building.images",
            path=filename,
            data=webp_bytes,
        )

        # 6. Update building record
        self._supabase.table("buildings").update(
            {"image_url": url},
        ).eq("id", str(building_id)).execute()

        logger.info("Image uploaded for building %s: %s", building_id, url)
        return url

    async def _upload_to_storage(
        self,
        bucket: str,
        path: str,
        data: bytes,
    ) -> str:
        """Upload file to Supabase Storage and return the public URL."""
        self._supabase.storage.from_(bucket).upload(
            path,
            data,
            {"content-type": "image/webp"},
        )

        result = self._supabase.storage.from_(bucket).get_public_url(path)
        return result


def _convert_to_webp(image_bytes: bytes) -> bytes:
    """Convert image bytes to WebP format, resizing if needed."""
    try:
        from PIL import Image
    except ImportError:
        logger.warning("Pillow not installed — returning raw image bytes")
        return image_bytes

    img = Image.open(io.BytesIO(image_bytes))

    # Resize if larger than max dimension
    if max(img.size) > MAX_IMAGE_DIMENSION:
        img.thumbnail((MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION))

    # Convert to RGB if necessary (e.g. RGBA, palette)
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")

    output = io.BytesIO()
    img.save(output, format="WEBP", quality=WEBP_QUALITY)
    return output.getvalue()

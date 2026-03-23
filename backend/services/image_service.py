"""End-to-end image generation pipeline."""

from __future__ import annotations

import io
import logging
from uuid import UUID, uuid4

from backend.services.external.replicate import ReplicateService
from backend.services.generation_service import GenerationService
from backend.services.model_resolver import ModelResolver
from backend.services.style_reference_service import StyleReferenceService
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

MAX_IMAGE_DIMENSION = 1024
AVIF_QUALITY = 85  # Full-resolution originals
AVIF_QUALITY_THUMB = 80  # Display-optimized thumbnails


class ImageService:
    """Orchestrates image generation: description -> Replicate -> AVIF -> Storage."""

    def __init__(
        self,
        supabase: Client,
        simulation_id: UUID,
        replicate_api_key: str | None = None,
        openrouter_api_key: str | None = None,
        world_context: str = "",
    ):
        self._supabase = supabase
        self._simulation_id = simulation_id
        self._replicate = ReplicateService(api_key=replicate_api_key)
        self._generation = GenerationService(
            supabase, simulation_id,
            openrouter_api_key=openrouter_api_key,
            world_context=world_context,
        )
        self._model_resolver = ModelResolver(supabase, simulation_id)

    @staticmethod
    async def _download_reference_image(url: str) -> io.BytesIO:
        """Download a reference image with SSRF protection, convert to PNG.

        Uses ``safe_download`` (``backend/utils/safe_fetch``) to validate the
        URL before fetching.  Two conversions happen:

        1. Replicate runs remotely and cannot access local URLs
           (e.g. localhost Supabase storage), so we download the image.
        2. Storage uses AVIF for efficiency, but many Replicate models
           only support PNG/JPEG/WebP — convert to PNG for compatibility.
        """
        from PIL import Image

        from backend.utils.safe_fetch import safe_download

        allowed = {"image/png", "image/jpeg", "image/webp", "image/avif", "image/gif"}
        data, _ = await safe_download(url, allowed_content_types=allowed)
        img = Image.open(io.BytesIO(data))
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        buf.name = "reference.png"  # Replicate SDK uses .name for content-type
        return buf

    async def generate_agent_portrait(
        self,
        agent_id: UUID,
        agent_name: str,
        agent_data: dict | None = None,
        description_override: str | None = None,
        api_key: str | None = None,
    ) -> str:
        """Generate a portrait for an agent and upload to storage."""
        replicate_client = ReplicateService(api_key=api_key) if api_key else self._replicate
        data = agent_data or {}

        if description_override:
            description = description_override
            logger.debug(
                "Using description override for agent",
                extra={"entity_type": "agent", "entity_id": str(agent_id)},
            )
        elif data.get("is_ambassador"):
            description = await self._generate_ambassador_description(
                agent_name, data,
            )
        else:
            description = await self._generation.generate_portrait_description(
                agent_name=agent_name,
                agent_data=agent_data,
                locale="en",
            )

        logger.debug("Portrait description generated", extra={"entity_type": "agent", "entity_id": str(agent_id)})

        # 2. Append style prompt from settings
        style_prompt = await self._model_resolver.resolve_style_prompt("portrait")
        if style_prompt:
            description = f"{description}, {style_prompt}"

        # 3. Resolve style reference (img2img) or standard model
        ref = await StyleReferenceService.resolve_reference(
            self._supabase, self._simulation_id, "portrait", agent_id,
        )
        if ref:
            image_model = await self._model_resolver.resolve_img2img_model("agent_portrait")
            image_model.reference_image_url = ref["url"]
            image_model.img2img_strength = ref["strength"]
            logger.info(
                "Using img2img with style reference",
                extra={"entity_type": "agent", "entity_id": str(agent_id), "scope": ref["scope"]},
            )
            # Download reference image so Replicate can access it
            # (local Supabase URLs are not reachable from Replicate's servers)
            ref_bytes = await self._download_reference_image(ref["url"])
            params = image_model.to_replicate_params()
            params["image"] = ref_bytes  # override URL with file-like object
            raw_bytes = await replicate_client.generate_image(
                model=image_model.model,
                prompt=description,
                prompt_key=image_model.prompt_param_name,
                **params,
            )
        else:
            image_model = await self._model_resolver.resolve_image_model(
                "agent_portrait",
            )
            raw_bytes = await replicate_client.generate_image(
                model=image_model.model,
                prompt=description,
                prompt_key=image_model.prompt_param_name,
                **image_model.to_replicate_params(),
            )

        # 4. Upload dual-resolution AVIF (full-res + thumbnail)
        filename = f"{self._simulation_id}/{agent_id}/{uuid4()}.avif"
        url = await self._upload_dual_resolution(
            bucket="agent.portraits",
            base_path=filename,
            raw_bytes=raw_bytes,
        )

        # 5. Update agent record (persist both URL and description for debugging)
        self._supabase.table("agents").update(
            {"portrait_image_url": url, "portrait_description": description[:2000]},
        ).eq("id", str(agent_id)).execute()

        logger.info("Portrait uploaded", extra={"entity_type": "agent", "entity_id": str(agent_id), "path": url})
        return url

    async def generate_building_image(
        self,
        building_id: UUID,
        building_name: str,
        building_type: str,
        building_data: dict | None = None,
        description_override: str | None = None,
        api_key: str | None = None,
    ) -> str:
        """Generate an image for a building and upload to storage."""
        replicate_client = ReplicateService(api_key=api_key) if api_key else self._replicate
        data = building_data or {}

        if description_override:
            description = description_override
            logger.debug(
                "Using description override for building",
                extra={"entity_type": "building", "entity_id": str(building_id)},
            )
        elif data.get("special_type") == "embassy":
            description = await self._generate_embassy_description(
                building_name, data,
            )
        else:
            description = await self._generation.generate_building_image_description(
                building_name=building_name,
                building_type=building_type,
                building_data=building_data,
            )

        logger.debug(
            "Building image description generated",
            extra={"entity_type": "building", "entity_id": str(building_id)},
        )

        # 2. Append style prompt from settings
        style_prompt = await self._model_resolver.resolve_style_prompt("building")
        if style_prompt:
            description = f"{description}, {style_prompt}"

        # 3. Resolve style reference (img2img) or standard model
        ref = await StyleReferenceService.resolve_reference(
            self._supabase, self._simulation_id, "building", building_id,
        )
        if ref:
            image_model = await self._model_resolver.resolve_img2img_model("building_image")
            image_model.reference_image_url = ref["url"]
            image_model.img2img_strength = ref["strength"]
            logger.info(
                "Using img2img with style reference",
                extra={"entity_type": "building", "entity_id": str(building_id), "scope": ref["scope"]},
            )
            ref_bytes = await self._download_reference_image(ref["url"])
            params = image_model.to_replicate_params()
            params["image"] = ref_bytes
            raw_bytes = await replicate_client.generate_image(
                model=image_model.model,
                prompt=description,
                prompt_key=image_model.prompt_param_name,
                **params,
            )
        else:
            image_model = await self._model_resolver.resolve_image_model(
                "building_image",
            )
            raw_bytes = await replicate_client.generate_image(
                model=image_model.model,
                prompt=description,
                prompt_key=image_model.prompt_param_name,
                **image_model.to_replicate_params(),
            )

        # 4. Upload dual-resolution AVIF (full-res + thumbnail)
        filename = f"{self._simulation_id}/{building_id}/{uuid4()}.avif"
        url = await self._upload_dual_resolution(
            bucket="building.images",
            base_path=filename,
            raw_bytes=raw_bytes,
        )

        # 5. Update building record (persist both URL and prompt for debugging)
        self._supabase.table("buildings").update(
            {"image_url": url, "image_prompt_text": description[:2000]},
        ).eq("id", str(building_id)).execute()

        logger.info("Image uploaded", extra={"entity_type": "building", "entity_id": str(building_id), "path": url})
        return url

    async def generate_banner_image(
        self,
        sim_name: str,
        sim_description: str,
        anchor_data: dict | None = None,
    ) -> str:
        """Generate a 16:9 banner image for a simulation and upload to storage.

        Uses the banner_description prompt template (via GenerationService)
        so each simulation can define its own banner art direction — matching
        the same per-simulation customization used for portraits and buildings.
        """
        # Fetch zone descriptions for thematic context
        zones_resp = await (
            self._supabase.table("zones")
            .select("name, description")
            .eq("simulation_id", str(self._simulation_id))
            .limit(10)
            .execute()
        )
        zone_summaries = [
            f"{z['name']}: {z['description']}"
            for z in (zones_resp.data or [])
            if z.get("description")
        ]

        description = await self._generation.generate_banner_description(
            sim_name=sim_name,
            sim_description=sim_description,
            zone_summaries=zone_summaries,
            anchor_data=anchor_data,
        )

        style_prompt = await self._model_resolver.resolve_style_prompt("banner")
        if style_prompt:
            description = f"{description}, {style_prompt}"

        image_model = await self._model_resolver.resolve_image_model("banner")
        params = image_model.to_replicate_params()
        params["aspect_ratio"] = "16:9"

        raw_bytes = await self._replicate.generate_image(
            model=image_model.model,
            prompt=description,
            **params,
        )

        filename = f"{self._simulation_id}/banner/{uuid4()}.avif"
        url = await self._upload_dual_resolution(
            bucket="simulation.assets",
            base_path=filename,
            raw_bytes=raw_bytes,
        )

        self._supabase.table("simulations").update(
            {"banner_url": url},
        ).eq("id", str(self._simulation_id)).execute()

        logger.info(
            "Banner uploaded",
            extra={"entity_type": "banner", "simulation_id": str(self._simulation_id), "path": url},
        )
        return url

    async def generate_lore_image(
        self,
        section_title: str,
        section_body: str,
        image_slug: str,
        sim_slug: str,
        section_id: str | None = None,
        image_caption: str | None = None,
    ) -> str:
        """Generate a 3:2 atmospheric lore image and upload to storage.

        Uploads to simulation.assets/{sim_slug}/lore/{image_slug}.avif
        matching the LoreScroll._getImageUrl() path convention.

        When image_caption is provided (written during lore creation as a
        visual description specifically for image generation), it is used
        directly as the Replicate prompt — no LLM re-generation needed.
        Falls back to LLM-powered description from section body otherwise.
        """
        if image_caption:
            description = image_caption
        else:
            description = await self._generation.generate_lore_image_description(
                section_title=section_title,
                section_body=section_body,
            )

        style_prompt = await self._model_resolver.resolve_style_prompt("lore")
        if style_prompt:
            description = f"{description}, {style_prompt}"

        image_model = await self._model_resolver.resolve_image_model("lore_image")
        params = image_model.to_replicate_params()
        params["aspect_ratio"] = "3:2"

        raw_bytes = await self._replicate.generate_image(
            model=image_model.model,
            prompt=description,
            prompt_key=image_model.prompt_param_name,
            **params,
        )

        # Upload path matches LoreScroll convention: /{sim_slug}/lore/{image_slug}.avif
        path = f"{sim_slug}/lore/{image_slug}.avif"
        full_avif = _convert_to_avif(raw_bytes, max_dimension=None, quality=AVIF_QUALITY)
        thumb_avif = _convert_to_avif(raw_bytes, max_dimension=MAX_IMAGE_DIMENSION, quality=AVIF_QUALITY_THUMB)

        full_path = path.replace(".avif", ".full.avif")
        await self._upload_to_storage("simulation.assets", full_path, full_avif)
        url = await self._upload_to_storage("simulation.assets", path, thumb_avif)

        # Mark section as image-generated for progress tracking
        if section_id:
            await self._supabase.table("simulation_lore").update(
                {"image_generated_at": "now()"},
            ).eq("id", section_id).execute()

        logger.info("Lore image uploaded", extra={"entity_type": "lore", "path": url})
        return url

    async def _generate_embassy_description(
        self,
        building_name: str,
        building_data: dict,
    ) -> str:
        """Fetch embassy context and generate an embassy building image description."""
        embassy_id = building_data.get("embassy_id")
        if not embassy_id:
            # Try to find embassy via special_attributes
            attrs = building_data.get("special_attributes") or {}
            embassy_id = attrs.get("embassy_id")

        if not embassy_id:
            logger.warning(
                "Embassy building '%s' has no embassy_id — falling back to standard",
                building_name,
            )
            return await self._generation.generate_building_image_description(
                building_name=building_name,
                building_type=building_data.get("building_type", ""),
                building_data=building_data,
            )

        # Fetch embassy record
        embassy_resp = await (
            self._supabase.table("embassies")
            .select("*")
            .eq("id", str(embassy_id))
            .limit(1)
            .execute()
        )
        if not embassy_resp.data:
            logger.warning("Embassy %s not found — falling back to standard", embassy_id)
            return await self._generation.generate_building_image_description(
                building_name=building_name,
                building_type=building_data.get("building_type", ""),
                building_data=building_data,
            )

        embassy = embassy_resp.data[0]

        # Determine partner simulation ID
        partner_sim_id = building_data.get("partner_simulation_id")
        if not partner_sim_id:
            attrs = building_data.get("special_attributes") or {}
            partner_sim_id = attrs.get("partner_simulation_id")
        if not partner_sim_id:
            # Derive from embassy: the partner is whichever sim is not ours
            if str(embassy["simulation_a_id"]) == str(self._simulation_id):
                partner_sim_id = embassy["simulation_b_id"]
            else:
                partner_sim_id = embassy["simulation_a_id"]

        # Fetch partner simulation name
        partner_resp = await (
            self._supabase.table("simulations")
            .select("name")
            .eq("id", str(partner_sim_id))
            .limit(1)
            .execute()
        )
        partner_name = (
            partner_resp.data[0]["name"] if partner_resp.data else "Unknown"
        )

        # Fetch partner style prompt
        partner_style_resp = await (
            self._supabase.table("simulation_settings")
            .select("setting_value")
            .eq("simulation_id", str(partner_sim_id))
            .eq("setting_key", "ai.image_style_prompt_building")
            .limit(1)
            .execute()
        )
        partner_theme = (
            partner_style_resp.data[0]["setting_value"]
            if partner_style_resp.data else ""
        )

        # Fetch our own style prompt for the template
        own_style_resp = await (
            self._supabase.table("simulation_settings")
            .select("setting_value")
            .eq("simulation_id", str(self._simulation_id))
            .eq("setting_key", "ai.image_style_prompt_building")
            .limit(1)
            .execute()
        )
        own_theme = (
            own_style_resp.data[0]["setting_value"]
            if own_style_resp.data else ""
        )

        building_data_with_theme = {**building_data, "simulation_theme": own_theme}

        return await self._generation.generate_embassy_building_image_description(
            building_name=building_name,
            building_data=building_data_with_theme,
            partner_simulation={"name": partner_name, "theme": partner_theme},
            embassy_data=embassy,
        )

    async def _generate_ambassador_description(
        self,
        agent_name: str,
        agent_data: dict,
    ) -> str:
        """Fetch embassy context and generate an ambassador portrait description."""
        # Find the first embassy this agent is associated with via embassy_metadata
        # Ambassadors are named in embassy_metadata.ambassador_a/b.name
        embassy_resp = await (
            self._supabase.table("embassies")
            .select("*")
            .or_(
                f"simulation_a_id.eq.{self._simulation_id},"
                f"simulation_b_id.eq.{self._simulation_id}",
            )
            .eq("status", "active")
            .limit(1)
            .execute()
        )

        if not embassy_resp.data:
            logger.warning(
                "No embassy found for ambassador '%s' — falling back to standard",
                agent_name,
            )
            return await self._generation.generate_portrait_description(
                agent_name=agent_name,
                agent_data=agent_data,
                locale="en",
            )

        embassy = embassy_resp.data[0]

        # Determine partner simulation
        if str(embassy["simulation_a_id"]) == str(self._simulation_id):
            partner_sim_id = embassy["simulation_b_id"]
        else:
            partner_sim_id = embassy["simulation_a_id"]

        # Fetch partner simulation name
        partner_resp = await (
            self._supabase.table("simulations")
            .select("name")
            .eq("id", str(partner_sim_id))
            .limit(1)
            .execute()
        )
        partner_name = (
            partner_resp.data[0]["name"] if partner_resp.data else "Unknown"
        )

        # Fetch partner style prompt (portrait)
        partner_style_resp = await (
            self._supabase.table("simulation_settings")
            .select("setting_value")
            .eq("simulation_id", str(partner_sim_id))
            .eq("setting_key", "ai.image_style_prompt_portrait")
            .limit(1)
            .execute()
        )
        partner_theme = (
            partner_style_resp.data[0]["setting_value"]
            if partner_style_resp.data else ""
        )

        # Fetch our own style prompt
        own_style_resp = await (
            self._supabase.table("simulation_settings")
            .select("setting_value")
            .eq("simulation_id", str(self._simulation_id))
            .eq("setting_key", "ai.image_style_prompt_portrait")
            .limit(1)
            .execute()
        )
        own_theme = (
            own_style_resp.data[0]["setting_value"]
            if own_style_resp.data else ""
        )

        agent_data_with_theme = {**agent_data, "simulation_theme": own_theme}

        return await self._generation.generate_ambassador_portrait_description(
            agent_name=agent_name,
            agent_data=agent_data_with_theme,
            partner_simulation={"name": partner_name, "theme": partner_theme},
            embassy_data=embassy,
        )

    async def _upload_dual_resolution(
        self,
        bucket: str,
        base_path: str,
        raw_bytes: bytes,
    ) -> str:
        """Upload full-res + thumbnail AVIF. Returns thumbnail URL.

        Full-res file: {uuid}.full.avif (native resolution, quality 85)
        Thumbnail file: {uuid}.avif (max 1024px, quality 80)
        """
        full_avif = _convert_to_avif(
            raw_bytes, max_dimension=None, quality=AVIF_QUALITY,
        )
        thumb_avif = _convert_to_avif(
            raw_bytes, max_dimension=MAX_IMAGE_DIMENSION, quality=AVIF_QUALITY_THUMB,
        )

        full_path = base_path.replace(".avif", ".full.avif")
        await self._upload_to_storage(bucket, full_path, full_avif)
        thumb_url = await self._upload_to_storage(bucket, base_path, thumb_avif)

        logger.debug(
            "Dual upload complete",
            extra={"path": base_path, "thumb_bytes": len(thumb_avif), "full_bytes": len(full_avif)},
        )
        return thumb_url

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
            {"content-type": "image/avif", "upsert": "true"},
        )

        result = self._supabase.storage.from_(bucket).get_public_url(path)
        return result


def _convert_to_avif(
    image_bytes: bytes,
    max_dimension: int | None = MAX_IMAGE_DIMENSION,
    quality: int = AVIF_QUALITY,
) -> bytes:
    """Convert image bytes to AVIF format.

    Args:
        image_bytes: Raw image data.
        max_dimension: If set, resize so the longest edge fits this limit.
            Pass None to preserve native resolution (full-res mode).
        quality: AVIF quality (0-100).
    """
    try:
        from PIL import Image
    except ImportError:
        logger.warning("Pillow not installed — returning raw image bytes")
        return image_bytes

    img = Image.open(io.BytesIO(image_bytes))

    # Resize if max_dimension is set and image exceeds it
    if max_dimension is not None and max(img.size) > max_dimension:
        img.thumbnail((max_dimension, max_dimension))

    # Convert to RGB if necessary (e.g. RGBA, palette)
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")

    output = io.BytesIO()
    img.save(output, format="AVIF", quality=quality)
    return output.getvalue()

"""Style reference image management for img2img generation."""

from __future__ import annotations

import logging
from uuid import UUID, uuid4

import httpx
from postgrest.exceptions import APIError as PostgrestAPIError

from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_CONTENT_TYPES = {"image/png", "image/jpeg", "image/webp", "image/avif"}
STORAGE_BUCKET = "simulation.assets"


class StyleReferenceService:
    """Manages art style reference images for img2img generation.

    Reference images are stored in Supabase Storage and tracked via:
    - simulation_settings (global refs): keys image_ref_global_portrait, image_ref_global_building
    - agents/buildings table (per-entity refs): style_reference_url column

    Resolution priority: entity-level > global > None (text-to-image fallback).
    """

    @staticmethod
    async def upload_reference(
        supabase: Client,
        simulation_id: UUID,
        entity_type: str,
        scope: str,
        image_data: bytes,
        content_type: str,
        entity_id: UUID | None = None,
        strength: float = 0.75,
    ) -> str:
        """Validate, convert to AVIF, upload to storage, and persist URL.

        Args:
            supabase: Authenticated Supabase client (RLS enforced).
            simulation_id: Target simulation.
            entity_type: "portrait" or "building".
            scope: "global" or "entity".
            image_data: Raw image bytes.
            content_type: MIME type of the uploaded image.
            entity_id: Required when scope="entity".
            strength: img2img influence (0.0-1.0).

        Returns:
            Public URL of the uploaded reference image.

        Raises:
            ValueError: On validation failure.
        """
        # Validate
        if content_type not in ALLOWED_CONTENT_TYPES:
            raise ValueError(
                f"Unsupported image type: {content_type}. Allowed: {', '.join(sorted(ALLOWED_CONTENT_TYPES))}"
            )
        if len(image_data) > MAX_FILE_SIZE:
            raise ValueError(f"File too large: {len(image_data)} bytes (max {MAX_FILE_SIZE // (1024 * 1024)} MB)")
        if entity_type not in ("portrait", "building"):
            raise ValueError(f"Invalid entity_type: {entity_type}")
        if scope not in ("global", "entity"):
            raise ValueError(f"Invalid scope: {scope}")
        if scope == "entity" and entity_id is None:
            raise ValueError("entity_id is required when scope is 'entity'")

        # Convert to AVIF
        avif_bytes = _convert_to_avif(image_data)

        # Upload to storage
        file_id = str(uuid4())
        storage_path = f"{simulation_id}/style-refs/{entity_type}/{file_id}.avif"

        await supabase.storage.from_(STORAGE_BUCKET).upload(
            storage_path,
            avif_bytes,
            {"content-type": "image/avif"},
        )
        url = await supabase.storage.from_(STORAGE_BUCKET).get_public_url(storage_path)

        # Persist reference
        if scope == "global":
            await _upsert_setting(
                supabase,
                simulation_id,
                f"image_ref_global_{entity_type}",
                url,
            )
            await _upsert_setting(
                supabase,
                simulation_id,
                f"image_ref_strength_{entity_type}",
                str(strength),
            )
        else:
            table = "agents" if entity_type == "portrait" else "buildings"
            await (
                supabase.table(table)
                .update(
                    {"style_reference_url": url},
                )
                .eq("id", str(entity_id))
                .execute()
            )

        logger.info(
            "Style reference uploaded",
            extra={
                "simulation_id": str(simulation_id),
                "entity_type": entity_type,
                "scope": scope,
                "entity_id": str(entity_id) if entity_id else None,
                "path": storage_path,
            },
        )
        return url

    @staticmethod
    async def fetch_from_url(url: str) -> tuple[bytes, str]:
        """Download image from URL with SSRF protection.

        Delegates to ``backend.utils.safe_fetch.safe_download`` which provides
        scheme validation, IP checks, and DNS-rebinding protection.

        Args:
            url: Public image URL.

        Returns:
            Tuple of (image_bytes, content_type).

        Raises:
            ValueError: On validation failure or SSRF attempt.
        """
        from backend.utils.safe_fetch import safe_download

        return await safe_download(
            url,
            max_size=MAX_FILE_SIZE,
            allowed_content_types=ALLOWED_CONTENT_TYPES,
        )

    @staticmethod
    async def resolve_reference(
        supabase: Client,
        simulation_id: UUID,
        entity_type: str,
        entity_id: UUID | None = None,
    ) -> dict | None:
        """Resolve the best style reference for generation.

        Priority: entity-level > global > None.

        Args:
            supabase: Authenticated Supabase client.
            simulation_id: Simulation context.
            entity_type: "portrait" or "building".
            entity_id: Specific agent/building ID (optional).

        Returns:
            Dict with url and strength, or None if no reference configured.
        """
        # 1. Check entity-level reference
        if entity_id:
            table = "agents" if entity_type == "portrait" else "buildings"
            resp = await supabase.table(table).select("style_reference_url").eq("id", str(entity_id)).limit(1).execute()
            if resp.data and resp.data[0].get("style_reference_url"):
                return {
                    "url": resp.data[0]["style_reference_url"],
                    "strength": 0.75,  # entity-level uses default strength
                    "scope": "entity",
                }

        # 2. Check global reference in simulation_settings
        resp = await (
            supabase.table("simulation_settings")
            .select("setting_key, setting_value")
            .eq("simulation_id", str(simulation_id))
            .eq("category", "ai")
            .in_(
                "setting_key",
                [f"image_ref_global_{entity_type}", f"image_ref_strength_{entity_type}"],
            )
            .execute()
        )

        settings_map: dict[str, str] = {}
        for row in resp.data or []:
            val = row["setting_value"]
            if isinstance(val, str) and val.startswith('"') and val.endswith('"'):
                settings_map[row["setting_key"]] = val[1:-1]
            else:
                settings_map[row["setting_key"]] = str(val) if val is not None else ""

        ref_url = settings_map.get(f"image_ref_global_{entity_type}", "")
        if ref_url:
            strength_str = settings_map.get(f"image_ref_strength_{entity_type}", "0.75")
            try:
                strength = float(strength_str)
            except (ValueError, TypeError):
                strength = 0.75
            return {
                "url": ref_url,
                "strength": strength,
                "scope": "global",
            }

        # 3. No reference found
        return None

    @staticmethod
    async def delete_reference(
        supabase: Client,
        simulation_id: UUID,
        entity_type: str,
        scope: str,
        entity_id: UUID | None = None,
    ) -> None:
        """Remove a style reference (storage file + DB record).

        Args:
            supabase: Authenticated Supabase client.
            simulation_id: Simulation context.
            entity_type: "portrait" or "building".
            scope: "global" or "entity".
            entity_id: Required when scope="entity".
        """
        if scope == "global":
            # Resolve current URL to delete from storage
            resp = await (
                supabase.table("simulation_settings")
                .select("setting_value")
                .eq("simulation_id", str(simulation_id))
                .eq("category", "ai")
                .eq("setting_key", f"image_ref_global_{entity_type}")
                .limit(1)
                .execute()
            )
            if resp.data:
                old_url = resp.data[0].get("setting_value", "")
                if isinstance(old_url, str):
                    await _try_delete_storage_file(supabase, old_url)

            # Clear settings
            (
                await supabase.table("simulation_settings")
                .delete()
                .eq("simulation_id", str(simulation_id))
                .eq("category", "ai")
                .in_(
                    "setting_key",
                    [
                        f"image_ref_global_{entity_type}",
                        f"image_ref_strength_{entity_type}",
                    ],
                )
                .execute()
            )
        else:
            if entity_id is None:
                raise ValueError("entity_id is required when scope is 'entity'")
            table = "agents" if entity_type == "portrait" else "buildings"

            # Resolve current URL to delete from storage
            resp = await supabase.table(table).select("style_reference_url").eq("id", str(entity_id)).limit(1).execute()
            if resp.data and resp.data[0].get("style_reference_url"):
                await _try_delete_storage_file(supabase, resp.data[0]["style_reference_url"])

            await (
                supabase.table(table)
                .update(
                    {"style_reference_url": None},
                )
                .eq("id", str(entity_id))
                .execute()
            )

        logger.info(
            "Style reference deleted",
            extra={
                "simulation_id": str(simulation_id),
                "entity_type": entity_type,
                "scope": scope,
                "entity_id": str(entity_id) if entity_id else None,
            },
        )

    @staticmethod
    async def list_references(
        supabase: Client,
        simulation_id: UUID,
        entity_type: str,
    ) -> list[dict]:
        """List all configured style references for an entity type.

        Returns global reference (if any) plus per-entity references.
        """
        results: list[dict] = []

        # Global reference
        ref = await StyleReferenceService.resolve_reference(
            supabase,
            simulation_id,
            entity_type,
        )
        if ref and ref["scope"] == "global":
            results.append(
                {
                    "entity_type": entity_type,
                    "scope": "global",
                    "reference_image_url": ref["url"],
                    "strength": ref["strength"],
                    "entity_id": None,
                    "entity_name": None,
                }
            )

        # Per-entity references
        table = "agents" if entity_type == "portrait" else "buildings"
        resp = await (
            supabase.table(table)
            .select("id, name, style_reference_url")
            .eq("simulation_id", str(simulation_id))
            .not_.is_("style_reference_url", "null")
            .execute()
        )
        for row in resp.data or []:
            if row.get("style_reference_url"):
                results.append(
                    {
                        "entity_type": entity_type,
                        "scope": "entity",
                        "reference_image_url": row["style_reference_url"],
                        "strength": 0.75,
                        "entity_id": row["id"],
                        "entity_name": row.get("name"),
                    }
                )

        return results


async def _upsert_setting(
    supabase: Client,
    simulation_id: UUID,
    key: str,
    value: str,
) -> None:
    """Upsert a simulation_settings row in the 'ai' category."""
    await (
        supabase.table("simulation_settings")
        .upsert(
            {
                "simulation_id": str(simulation_id),
                "category": "ai",
                "setting_key": key,
                "setting_value": value,
            },
            on_conflict="simulation_id,category,setting_key",
        )
        .execute()
    )


async def _try_delete_storage_file(supabase: Client, url: str) -> None:
    """Best-effort delete of a storage file by its public URL."""
    try:
        # Extract path from public URL: .../<bucket>/object/public/<path>
        parts = url.split(f"/{STORAGE_BUCKET}/")
        if len(parts) == 2:
            # Remove the "object/public/" prefix if present
            path = parts[1]
            if path.startswith("object/public/"):
                path = path[len("object/public/") :]
            await supabase.storage.from_(STORAGE_BUCKET).remove([path])
    except (PostgrestAPIError, httpx.HTTPError, OSError):
        logger.warning("Failed to delete storage file: %s", url, exc_info=True)


def _convert_to_avif(image_bytes: bytes, quality: int = 85) -> bytes:
    """Convert image bytes to AVIF format for storage efficiency.

    Delegates to the canonical implementation in utils.image.
    Reference images are capped at 2048px (manageable for style transfer).
    """
    from backend.utils.image import convert_to_avif

    return convert_to_avif(image_bytes, max_dimension=2048, quality=quality)

"""Service layer for dungeon content admin CRUD operations.

Extracted from dungeon_content_admin router to enforce router→service separation.
Provides generic CRUD for all 10 dungeon content tables.
"""

from __future__ import annotations

import logging

from backend.services.base_service import paginate_response
from backend.utils.db import maybe_single_data
from backend.utils.errors import bad_request, not_found, server_error
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

# ── Content type → table name mapping ─────────────────────────────────────

TABLE_MAP: dict[str, str] = {
    "banter": "dungeon_banter",
    "enemies": "dungeon_enemy_templates",
    "spawns": "dungeon_spawn_configs",
    "encounters": "dungeon_encounter_templates",
    "choices": "dungeon_encounter_choices",
    "loot": "dungeon_loot_items",
    "anchors": "dungeon_anchor_objects",
    "entrance_texts": "dungeon_entrance_texts",
    "barometer_texts": "dungeon_barometer_texts",
    "abilities": "combat_abilities",
}

# Primary key column(s) per content type
PK_MAP: dict[str, str | tuple[str, str]] = {
    "banter": "id",
    "enemies": "id",
    "spawns": "id",
    "encounters": "id",
    "choices": ("encounter_id", "id"),
    "loot": "id",
    "anchors": ("archetype", "id"),
    "entrance_texts": "id",
    "barometer_texts": "id",
    "abilities": "id",
}

# Searchable text columns per content type
_TEXT_COLUMNS: dict[str, list[str]] = {
    "banter": ["id", "text_en", "text_de"],
    "enemies": ["id", "name_en", "name_de", "description_en", "description_de"],
    "spawns": ["id"],
    "encounters": ["id", "description_en", "description_de"],
    "choices": ["id", "label_en", "label_de", "success_narrative_en", "success_narrative_de"],
    "loot": ["id", "name_en", "name_de", "description_en", "description_de"],
    "anchors": ["id"],
    "entrance_texts": ["text_en", "text_de"],
    "barometer_texts": ["text_en", "text_de"],
    "abilities": ["id", "name_en", "name_de", "description_en", "description_de"],
}


def _build_search_filter(content_type: str, search: str) -> str:
    """Build PostgREST or.filter string for text search across bilingual columns."""
    escaped = search.replace("%", "").replace("_", "")
    pattern = f"%{escaped}%"
    columns = _TEXT_COLUMNS.get(content_type, ["id"])
    filters = [f"{col}.ilike.{pattern}" for col in columns]
    return ",".join(filters)


def _parse_composite_id(item_id: str) -> tuple[str, str]:
    """Parse a 'parent_id::child_id' composite key string.

    Raises:
        HTTPException: 400 if format is invalid.
    """
    parts = item_id.split("::", 1)
    if len(parts) != 2:
        raise bad_request(
            f"Composite ID required (format: 'parent_id::id'), got: {item_id}",
        )
    return parts[0], parts[1]


class DungeonContentAdminService:
    """Generic CRUD for dungeon content tables (admin-only)."""

    @staticmethod
    async def list_content(
        supabase: Client,
        content_type: str,
        *,
        archetype: str | None = None,
        search: str | None = None,
        page: int = 1,
        per_page: int = 100,
    ) -> tuple[list[dict], int]:
        """List content rows with optional archetype filter and search.

        Returns (data, total_count).
        """
        table = TABLE_MAP[content_type]
        query = supabase.table(table).select("*", count="exact")

        if archetype:
            query = query.eq("archetype", archetype)

        if search:
            search_filter = _build_search_filter(content_type, search)
            if search_filter:
                query = query.or_(search_filter)

        offset = (page - 1) * per_page
        query = query.range(offset, offset + per_page - 1)
        query = query.order("sort_order", desc=False)

        response = await query.execute()
        data, total = paginate_response(response)
        return data, total

    @staticmethod
    async def get_item(
        supabase: Client,
        content_type: str,
        item_id: str,
    ) -> dict:
        """Get a single content item by ID. Raises 404 if not found."""
        table = TABLE_MAP[content_type]
        pk = PK_MAP.get(content_type, "id")

        if isinstance(pk, tuple):
            parent_id, child_id = _parse_composite_id(item_id)
            data = await maybe_single_data(
                supabase.table(table).select("*").eq(pk[0], parent_id).eq(pk[1], child_id).maybe_single()
            )
        else:
            data = await maybe_single_data(
                supabase.table(table).select("*").eq(pk, item_id).maybe_single()
            )

        if not data:
            raise not_found(content_type, item_id)
        return data

    @staticmethod
    async def update_item(
        supabase: Client,
        content_type: str,
        item_id: str,
        data: dict,
    ) -> dict:
        """Update a content item. Returns updated row. Raises 404 if not found."""
        table = TABLE_MAP[content_type]
        pk = PK_MAP.get(content_type, "id")
        update_data = {k: v for k, v in data.items() if k not in ("created_at", "updated_at")}

        if isinstance(pk, tuple):
            parent_id, child_id = _parse_composite_id(item_id)
            response = await (
                supabase.table(table).update(update_data).eq(pk[0], parent_id).eq(pk[1], child_id).execute()
            )
        else:
            response = await supabase.table(table).update(update_data).eq(pk, item_id).execute()

        if not response.data:
            raise not_found(content_type, item_id)

        logger.info(
            "Dungeon content updated",
            extra={"content_type": content_type, "item_id": item_id, "fields": list(update_data.keys())},
        )
        return response.data[0]

    @staticmethod
    async def create_item(
        supabase: Client,
        content_type: str,
        data: dict,
    ) -> dict:
        """Create a new content item. Returns created row."""
        table = TABLE_MAP[content_type]
        create_data = {k: v for k, v in data.items() if k not in ("created_at", "updated_at")}

        response = await supabase.table(table).insert(create_data).execute()

        if not response.data:
            raise server_error(f"Failed to create {content_type} item.")

        logger.info(
            "Dungeon content created",
            extra={"content_type": content_type, "item_id": response.data[0].get("id", "?")},
        )
        return response.data[0]

    @staticmethod
    async def delete_item(
        supabase: Client,
        content_type: str,
        item_id: str,
    ) -> dict:
        """Delete a content item. Returns deleted row. Raises 404 if not found."""
        table = TABLE_MAP[content_type]
        pk = PK_MAP.get(content_type, "id")

        if isinstance(pk, tuple):
            parent_id, child_id = _parse_composite_id(item_id)
            response = await supabase.table(table).delete().eq(pk[0], parent_id).eq(pk[1], child_id).execute()
        else:
            response = await supabase.table(table).delete().eq(pk, item_id).execute()

        if not response.data:
            raise not_found(content_type, item_id)

        logger.info(
            "Dungeon content deleted",
            extra={"content_type": content_type, "item_id": item_id},
        )
        return {"deleted": True, "id": item_id}

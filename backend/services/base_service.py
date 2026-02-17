"""Generic CRUD base service for simulation-scoped entities."""

from __future__ import annotations

from datetime import UTC, date, datetime
from uuid import UUID

from fastapi import HTTPException, status

from supabase import Client


def _serialize_for_json(data: dict) -> dict:
    """Convert non-JSON-serializable values (datetime, UUID) to strings."""
    result = {}
    for key, value in data.items():
        if isinstance(value, datetime):
            result[key] = value.isoformat()
        elif isinstance(value, date):
            result[key] = value.isoformat()
        elif isinstance(value, UUID):
            result[key] = str(value)
        else:
            result[key] = value
    return result


class BaseService:
    """Base service providing standard CRUD operations for simulation-scoped entities.

    Subclasses set `table_name` and optionally `view_name` for soft-delete filtering.
    """

    table_name: str
    view_name: str | None = None  # e.g. "active_agents" — used for list/get queries
    supports_created_by: bool = True  # Override to False for tables without created_by_id

    @classmethod
    def _read_table(cls, include_deleted: bool = False) -> str:
        """Return the table/view to query from."""
        if include_deleted or cls.view_name is None:
            return cls.table_name
        return cls.view_name

    @classmethod
    async def list(
        cls,
        supabase: Client,
        simulation_id: UUID,
        *,
        select: str = "*",
        filters: dict | None = None,
        order_by: str = "created_at",
        order_desc: bool = True,
        limit: int = 25,
        offset: int = 0,
        include_deleted: bool = False,
    ) -> tuple[list[dict], int]:
        """List entities with pagination and optional filters.

        Returns (data, total_count).
        """
        table = cls._read_table(include_deleted)
        query = (
            supabase.table(table)
            .select(select, count="exact")
            .eq("simulation_id", str(simulation_id))
            .order(order_by, desc=order_desc)
        )

        if filters:
            for key, value in filters.items():
                if value is not None:
                    query = query.eq(key, value)

        query = query.range(offset, offset + limit - 1)
        response = query.execute()

        total = response.count if response.count is not None else len(response.data or [])
        return response.data or [], total

    @classmethod
    async def get(
        cls,
        supabase: Client,
        simulation_id: UUID,
        entity_id: UUID,
        *,
        select: str = "*",
        include_deleted: bool = False,
    ) -> dict:
        """Get a single entity by ID within a simulation."""
        table = cls._read_table(include_deleted)
        response = (
            supabase.table(table)
            .select(select)
            .eq("simulation_id", str(simulation_id))
            .eq("id", str(entity_id))
            .limit(1)
            .execute()
        )

        data = (
            response.data[0]
            if response and response.data and isinstance(response.data, list)
            else (response.data if response and response.data else None)
        )

        if not data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"{cls.table_name} '{entity_id}' not found in simulation '{simulation_id}'.",
            )

        return data

    @classmethod
    async def create(
        cls,
        supabase: Client,
        simulation_id: UUID,
        user_id: UUID,
        data: dict,
    ) -> dict:
        """Create a new entity in a simulation."""
        insert_data = _serialize_for_json({
            **data,
            "simulation_id": str(simulation_id),
        })

        # Set created_by_id if the table supports it
        if cls.supports_created_by and "created_by_id" not in insert_data:
            insert_data.setdefault("created_by_id", str(user_id))

        response = (
            supabase.table(cls.table_name)
            .insert(insert_data)
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create {cls.table_name} record.",
            )

        return response.data[0]

    @classmethod
    async def update(
        cls,
        supabase: Client,
        simulation_id: UUID,
        entity_id: UUID,
        data: dict,
        *,
        if_updated_at: str | None = None,
    ) -> dict:
        """Update an existing entity.

        Args:
            supabase: Supabase client with user JWT.
            simulation_id: Owning simulation.
            entity_id: Entity to update.
            data: Fields to update.
            if_updated_at: Optimistic lock — if provided, the update only succeeds
                when the row's ``updated_at`` still matches this value.  A mismatch
                means another user edited the entity in the meantime and results in
                HTTP 409 Conflict.
        """
        if not data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields to update.",
            )

        update_data = _serialize_for_json({**data, "updated_at": datetime.now(UTC).isoformat()})

        query = (
            supabase.table(cls.table_name)
            .update(update_data)
            .eq("simulation_id", str(simulation_id))
            .eq("id", str(entity_id))
            .is_("deleted_at", "null")
        )

        if if_updated_at is not None:
            query = query.eq("updated_at", if_updated_at)

        response = query.execute()

        if not response.data:
            # Distinguish "not found" from "conflict" when optimistic locking is active.
            if if_updated_at is not None:
                # Check whether the entity actually exists (ignoring the timestamp).
                exists = (
                    supabase.table(cls.table_name)
                    .select("id")
                    .eq("simulation_id", str(simulation_id))
                    .eq("id", str(entity_id))
                    .is_("deleted_at", "null")
                    .limit(1)
                    .execute()
                )
                if exists and exists.data:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=(
                            "Conflict: entity was modified by another user. "
                            "Please refresh and try again."
                        ),
                    )

            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"{cls.table_name} '{entity_id}' not found.",
            )

        return response.data[0]

    @classmethod
    async def soft_delete(
        cls,
        supabase: Client,
        simulation_id: UUID,
        entity_id: UUID,
    ) -> dict:
        """Soft-delete an entity by setting deleted_at."""
        response = (
            supabase.table(cls.table_name)
            .update({"deleted_at": datetime.now(UTC).isoformat()})
            .eq("simulation_id", str(simulation_id))
            .eq("id", str(entity_id))
            .is_("deleted_at", "null")
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"{cls.table_name} '{entity_id}' not found or already deleted.",
            )

        return response.data[0]

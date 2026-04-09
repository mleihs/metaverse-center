"""Supabase response extraction utilities and response helpers.

Replaces repeated ``response.data[0]`` / ``response.data or []`` patterns
with type-safe, consistent helpers.

Usage::

    from backend.utils.responses import extract_one, extract_one_or_404, extract_list
    from backend.utils.responses import paginated

    data = extract_one(response)                          # dict | None
    data = extract_one_or_404(response, "Agent", agent_id)  # dict (or raises 404)
    items = extract_list(response)                         # list[dict]
    return paginated(data, total, limit, offset)           # PaginatedResponse
"""

from __future__ import annotations

from uuid import UUID

from backend.models.common import PaginatedResponse, PaginationMeta
from backend.utils.errors import not_found


def extract_one(response: object) -> dict | None:
    """Extract a single result from a Supabase response.

    Handles both list and dict response shapes safely.
    Returns None if no data is present.
    """
    data = getattr(response, "data", None)
    if not data:
        return None
    if isinstance(data, list):
        return data[0] if data else None
    return data


def extract_one_or_404(
    response: object,
    entity_type: str,
    entity_id: UUID | str | None = None,
    *,
    context: str | None = None,
) -> dict:
    """Extract a single result or raise HTTP 404.

    Args:
        response: Supabase query response.
        entity_type: Human-readable name for error message.
        entity_id: Optional ID to include in error message.
        context: Optional additional context for error message.

    Raises:
        HTTPException: 404 if no data found.
    """
    result = extract_one(response)
    if result is None:
        raise not_found(entity_type, entity_id, context=context)
    return result


def extract_list(response: object) -> list[dict]:
    """Extract a list from a Supabase response, never returning None."""
    return getattr(response, "data", None) or []


def paginated(data: list, total: int, limit: int, offset: int) -> PaginatedResponse:
    """Build a PaginatedResponse with auto-computed count.

    Replaces the verbose pattern::

        return PaginatedResponse(
            data=data,
            meta=PaginationMeta(count=len(data), total=total, limit=limit, offset=offset),
        )
    """
    return PaginatedResponse(
        data=data,
        meta=PaginationMeta(count=len(data), total=total, limit=limit, offset=offset),
    )

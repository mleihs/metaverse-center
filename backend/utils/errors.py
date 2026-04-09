"""Standardized HTTP error factories.

Provides consistent error messages across all services and routers.
Replaces ad-hoc HTTPException construction with centralized, typesafe helpers.

Usage::

    from backend.utils.errors import not_found, forbidden, bad_request

    raise not_found("Agent", agent_id)
    raise not_found("Conversation", conversation_id)
    raise forbidden("Not authorized to edit this simulation.")
    raise bad_request("No fields to update.")
"""

from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status


def not_found(
    entity_type: str | None = None,
    entity_id: UUID | str | None = None,
    *,
    context: str | None = None,
    detail: str | None = None,
) -> HTTPException:
    """Create a 404 Not Found error with a consistent message format.

    Supports both calling conventions:
      - ``not_found("agent", agent_id)`` — entity-based (preferred)
      - ``not_found(detail="Custom message")`` — legacy detail-only

    Args:
        entity_type: Human-readable entity name (e.g. "Agent", "Conversation").
        entity_id: Optional ID to include in the message.
        context: Optional context (e.g. "in simulation 'abc-123'").
        detail: Override the entire detail message.
    """
    if detail is None:
        if entity_type is not None:
            if entity_id is not None:
                msg = f"{entity_type} '{entity_id}' not found"
            else:
                msg = f"{entity_type} not found"
            if context:
                msg += f" {context}"
            msg += "."
            detail = msg
        else:
            detail = "Resource not found."
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


def forbidden(detail: str = "Not authorized.") -> HTTPException:
    """Create a 403 Forbidden error."""
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


def bad_request(detail: str) -> HTTPException:
    """Create a 400 Bad Request error."""
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


def conflict(detail: str) -> HTTPException:
    """Create a 409 Conflict error."""
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)


def server_error(detail: str = "Internal server error.") -> HTTPException:
    """Create a 500 Internal Server Error."""
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=detail,
    )

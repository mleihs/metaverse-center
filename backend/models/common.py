from datetime import UTC, datetime
from typing import Generic, TypeVar
from uuid import UUID

from pydantic import BaseModel, Field

T = TypeVar("T")


class CurrentUser(BaseModel):
    """Authenticated user extracted from JWT."""

    id: UUID
    email: str
    access_token: str


class PaginationMeta(BaseModel):
    """Pagination metadata for list responses."""

    count: int
    total: int
    limit: int
    offset: int


class PaginatedResponse(BaseModel, Generic[T]):
    """Standard paginated response wrapper."""

    success: bool = True
    data: list[T]
    meta: PaginationMeta
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))


class SuccessResponse(BaseModel, Generic[T]):
    """Standard success response wrapper."""

    success: bool = True
    data: T
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))


class MessageResponse(BaseModel):
    """Payload for operations that return a confirmation message."""

    message: str


class DeleteResponse(BaseModel):
    """Payload for delete operations that confirm entity removal."""

    deleted: bool = True
    id: str | None = None


class ErrorDetail(BaseModel):
    """Error detail information."""

    code: str
    message: str
    details: dict | None = None


class ErrorResponse(BaseModel):
    """Standard error response wrapper."""

    success: bool = False
    error: ErrorDetail
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))

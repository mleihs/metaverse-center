"""Agent Memory router — observation, retrieval, reflection endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request

from backend.dependencies import get_admin_supabase, get_current_user, get_supabase, require_role
from backend.middleware.rate_limit import RATE_LIMIT_STANDARD, limiter
from backend.models.common import PaginatedResponse, PaginationMeta, SuccessResponse
from backend.models.memory import ReflectionRequest
from backend.services.agent_memory_service import AgentMemoryService
from supabase import Client

router = APIRouter(
    prefix="/api/v1/simulations/{simulation_id}/agents/{agent_id}/memories",
    tags=["Agent Memories"],
)


@router.get("", response_model=PaginatedResponse)
@limiter.limit(RATE_LIMIT_STANDARD)
async def list_memories(
    request: Request,
    simulation_id: UUID,
    agent_id: UUID,
    _user=Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    memory_type: str | None = Query(default=None),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """List agent memories (paginated, filterable by memory_type)."""
    data, total = await AgentMemoryService.list_memories(
        supabase, agent_id, simulation_id,
        memory_type=memory_type, limit=limit, offset=offset,
    )
    return {
        "success": True,
        "data": data,
        "meta": PaginationMeta(count=len(data), total=total, limit=limit, offset=offset),
    }


@router.post("/reflect", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_STANDARD)
async def trigger_reflection(
    request: Request,
    simulation_id: UUID,
    agent_id: UUID,
    body: ReflectionRequest | None = None,
    _user=Depends(get_current_user),
    _role_check=Depends(require_role("editor")),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Trigger agent reflection (requires editor+)."""
    locale = body.locale if body else "en"
    data = await AgentMemoryService.reflect(
        admin_supabase, simulation_id, agent_id, locale=locale,
    )
    return {"success": True, "data": data}

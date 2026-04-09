"""Agent Memory router — observation, retrieval, reflection endpoints."""

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request

from backend.dependencies import get_admin_supabase, get_current_user, get_effective_supabase, require_role
from backend.middleware.rate_limit import RATE_LIMIT_STANDARD, limiter
from backend.models.common import CurrentUser, PaginatedResponse, SuccessResponse
from backend.models.memory import ReflectionRequest
from backend.services.agent_memory_service import AgentMemoryService
from backend.services.audit_service import AuditService
from backend.utils.responses import paginated
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/simulations/{simulation_id}/agents/{agent_id}/memories",
    tags=["Agent Memories"],
)


@router.get("")
@limiter.limit(RATE_LIMIT_STANDARD)
async def list_memories(
    request: Request,
    simulation_id: UUID,
    agent_id: UUID,
    _user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
    memory_type: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PaginatedResponse:
    """List agent memories (paginated, filterable by memory_type)."""
    data, total = await AgentMemoryService.list_memories(
        supabase,
        agent_id,
        simulation_id,
        memory_type=memory_type,
        limit=limit,
        offset=offset,
    )
    return paginated(data, total, limit, offset)


@router.post("/reflect")
@limiter.limit(RATE_LIMIT_STANDARD)
async def trigger_reflection(
    request: Request,
    simulation_id: UUID,
    agent_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
    body: ReflectionRequest | None = None,
) -> SuccessResponse:
    """Trigger agent reflection (requires editor+)."""
    locale = body.locale if body else "en"
    data = await AgentMemoryService.reflect(
        admin_supabase,
        simulation_id,
        agent_id,
        locale=locale,
    )
    await AuditService.safe_log(
        admin_supabase,
        simulation_id,
        user.id,
        "agent_memories",
        agent_id,
        "reflect",
        details={"locale": locale},
    )
    return SuccessResponse(data=data)

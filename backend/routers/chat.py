"""Chat endpoints — with optional AI response generation and group chat support."""

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request

from backend.dependencies import get_current_user, get_supabase, require_role
from backend.middleware.rate_limit import RATE_LIMIT_AI_CHAT, limiter
from backend.models.chat import (
    AddAgentRequest,
    ConversationCreate,
    ConversationResponse,
    EventReferenceCreate,
    EventReferenceResponse,
    MessageCreate,
    MessageResponse,
)
from backend.models.common import CurrentUser, SuccessResponse
from backend.services.audit_service import AuditService
from backend.services.chat_ai_service import ChatAIService
from backend.services.chat_service import ChatService
from backend.services.external_service_resolver import ExternalServiceResolver
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/simulations/{simulation_id}/chat",
    tags=["chat"],
)

_service = ChatService()


@router.get("/conversations")
async def list_conversations(
    simulation_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> SuccessResponse[list[ConversationResponse]]:
    """List all conversations for the current user."""
    conversations = await _service.list_conversations(supabase, simulation_id, user.id)
    return SuccessResponse(data=conversations)


@router.post("/conversations", status_code=201)
async def create_conversation(
    simulation_id: UUID,
    body: ConversationCreate,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> SuccessResponse[ConversationResponse]:
    """Start a new conversation with one or more agents."""
    conversation = await _service.create_conversation(
        supabase, simulation_id, user.id, body.agent_ids, body.title,
    )
    await AuditService.safe_log(
        supabase, simulation_id, user.id, "chat_conversations", conversation.get("id"), "create",
        details={"title": body.title, "agent_count": len(body.agent_ids)},
    )
    return SuccessResponse(data=conversation)


@router.get("/conversations/{conversation_id}/messages")
async def get_messages(
    simulation_id: UUID,
    conversation_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_supabase)],
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    before: Annotated[str | None, Query(description="Cursor: ISO timestamp for pagination")] = None,
) -> SuccessResponse[list[MessageResponse]]:
    """Get messages for a conversation with cursor-based pagination."""
    messages = await _service.get_messages(supabase, conversation_id, limit=limit, before=before)
    return SuccessResponse(data=messages)


@router.post(
    "/conversations/{conversation_id}/messages",
    status_code=201,
)
@limiter.limit(RATE_LIMIT_AI_CHAT)
async def send_message(
    request: Request,
    simulation_id: UUID,
    conversation_id: UUID,
    body: MessageCreate,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> SuccessResponse[MessageResponse | list[MessageResponse]]:
    """Send a message in a conversation.

    If generate_response=true, generates AI responses from all agents in the conversation.
    """
    # Save user message
    user_message = await _service.send_message(
        supabase, conversation_id, body.content, body.sender_role, body.metadata,
    )
    await AuditService.safe_log(
        supabase, simulation_id, user.id, "chat_messages", user_message.get("id"), "create",
        details={"conversation_id": str(conversation_id)},
    )

    if not body.generate_response:
        return SuccessResponse(data=user_message)

    # Generate AI response(s)
    resolver = ExternalServiceResolver(supabase, simulation_id)
    ai_config = await resolver.get_ai_provider_config()
    chat_ai = ChatAIService(
        supabase, simulation_id,
        openrouter_api_key=ai_config.openrouter_api_key,
    )

    # Check how many agents are in this conversation
    agents = await ChatService._load_conversation_agents(supabase, str(conversation_id))

    if len(agents) > 1:
        # Group chat: generate responses for all agents
        await chat_ai.generate_group_response(conversation_id, body.content)
    else:
        # Single agent: use simpler path
        await chat_ai.generate_response(conversation_id, body.content)

    # Load all new messages (user + AI responses)
    all_messages = await _service.get_messages(
        supabase, conversation_id, limit=len(agents) + 1,
    )

    return SuccessResponse(data=all_messages)


@router.post(
    "/conversations/{conversation_id}/agents",
    status_code=201,
)
async def add_agent(
    simulation_id: UUID,
    conversation_id: UUID,
    body: AddAgentRequest,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> SuccessResponse[dict]:
    """Add an agent to a conversation."""
    result = await _service.add_agent(supabase, conversation_id, body.agent_id)
    await AuditService.safe_log(
        supabase, simulation_id, user.id, "chat_conversation_agents", body.agent_id, "create",
        details={"conversation_id": str(conversation_id)},
    )
    return SuccessResponse(data=result)


@router.delete("/conversations/{conversation_id}/agents/{agent_id}")
async def remove_agent(
    simulation_id: UUID,
    conversation_id: UUID,
    agent_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> SuccessResponse[dict]:
    """Remove an agent from a conversation."""
    await _service.remove_agent(supabase, conversation_id, agent_id)
    await AuditService.safe_log(
        supabase, simulation_id, user.id, "chat_conversation_agents", agent_id, "delete",
        details={"conversation_id": str(conversation_id)},
    )
    return SuccessResponse(data={"removed": True})


@router.get("/conversations/{conversation_id}/events")
async def get_event_references(
    simulation_id: UUID,
    conversation_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> SuccessResponse[list[EventReferenceResponse]]:
    """List event references for a conversation."""
    refs = await _service.get_event_references(supabase, conversation_id)
    return SuccessResponse(data=refs)


@router.post(
    "/conversations/{conversation_id}/events",
    status_code=201,
)
async def add_event_reference(
    simulation_id: UUID,
    conversation_id: UUID,
    body: EventReferenceCreate,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> SuccessResponse[EventReferenceResponse]:
    """Add an event reference to a conversation."""
    ref = await _service.add_event_reference(
        supabase, conversation_id, body.event_id, user.id,
    )
    await AuditService.safe_log(
        supabase, simulation_id, user.id, "chat_event_references", body.event_id, "create",
        details={"conversation_id": str(conversation_id)},
    )
    return SuccessResponse(data=ref)


@router.delete("/conversations/{conversation_id}/events/{event_id}")
async def remove_event_reference(
    simulation_id: UUID,
    conversation_id: UUID,
    event_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> SuccessResponse[dict]:
    """Remove an event reference from a conversation."""
    await _service.remove_event_reference(supabase, conversation_id, event_id)
    await AuditService.safe_log(
        supabase, simulation_id, user.id, "chat_event_references", event_id, "delete",
        details={"conversation_id": str(conversation_id)},
    )
    return SuccessResponse(data={"removed": True})


@router.patch("/conversations/{conversation_id}")
async def archive_conversation(
    simulation_id: UUID,
    conversation_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> SuccessResponse[ConversationResponse]:
    """Archive a conversation (soft-delete)."""
    conversation = await _service.archive_conversation(supabase, conversation_id)
    await AuditService.safe_log(
        supabase, simulation_id, user.id, "chat_conversations", conversation_id, "archive",
    )
    return SuccessResponse(data=conversation)


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    simulation_id: UUID,
    conversation_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> SuccessResponse[ConversationResponse]:
    """Permanently delete a conversation and all its messages."""
    conversation = await _service.delete_conversation(supabase, conversation_id)
    await AuditService.safe_log(
        supabase, simulation_id, user.id, "chat_conversations", conversation_id, "delete",
    )
    return SuccessResponse(data=conversation)

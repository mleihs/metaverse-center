"""Chat endpoints — with optional AI response generation and group chat support."""

import json
import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import EventSourceResponse

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
    ReactionSummary,
    ReactionToggleRequest,
    ReactionToggleResponse,
)
from backend.models.common import CurrentUser, SuccessResponse
from backend.services.audit_service import AuditService
from backend.services.chat_service import ChatService
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
        supabase,
        simulation_id,
        user.id,
        body.agent_ids,
        body.title,
    )
    await AuditService.safe_log(
        supabase,
        simulation_id,
        user.id,
        "chat_conversations",
        conversation.get("id"),
        "create",
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
    await _service.verify_ownership(supabase, conversation_id, user.id)
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
) -> SuccessResponse[list[MessageResponse]]:
    """Send a message in a conversation.

    Always returns a list of messages. When generate_response=true, includes
    both the user message and all AI responses.
    """
    await _service.verify_ownership(supabase, conversation_id, user.id)
    # Save user message
    user_message = await _service.send_message(
        supabase,
        conversation_id,
        body.content,
        body.sender_role,
        body.metadata,
    )
    await AuditService.safe_log(
        supabase,
        simulation_id,
        user.id,
        "chat_messages",
        user_message.get("id"),
        "create",
        details={"conversation_id": str(conversation_id)},
    )

    if not body.generate_response:
        return SuccessResponse(data=[user_message])

    # Delegate AI orchestration to service layer
    all_messages = await _service.generate_ai_response(
        supabase,
        simulation_id,
        conversation_id,
        body.content,
    )

    return SuccessResponse(data=all_messages)


@router.post(
    "/conversations/{conversation_id}/messages/stream",
    status_code=200,
)
@limiter.limit(RATE_LIMIT_AI_CHAT)
async def stream_message(
    request: Request,
    simulation_id: UUID,
    conversation_id: UUID,
    body: MessageCreate,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> EventSourceResponse:
    """Stream AI response via Server-Sent Events.

    Saves the user message first, then streams AI response tokens
    as SSE events. For group conversations, agents respond sequentially
    with interleaved agent_start/token/agent_done events.
    """
    await _service.verify_ownership(supabase, conversation_id, user.id)

    # Save user message synchronously before starting the stream
    user_message = await _service.send_message(
        supabase,
        conversation_id,
        body.content,
        body.sender_role,
        body.metadata,
    )
    await AuditService.safe_log(
        supabase,
        simulation_id,
        user.id,
        "chat_messages",
        user_message.get("id"),
        "create",
        details={"conversation_id": str(conversation_id), "streaming": True},
    )

    async def event_generator():
        """Yield SSE-formatted events for the streaming response."""
        try:
            # Confirm user message was saved (for optimistic reconciliation)
            yield _format_sse("user_confirmed", {"message": user_message})

            # Stream AI response tokens
            async for sse_event in _service.stream_ai_response(
                supabase,
                simulation_id,
                conversation_id,
                body.content,
            ):
                # Check client disconnect between events
                if await request.is_disconnected():
                    logger.info("Client disconnected during stream for conversation %s", conversation_id)
                    return

                yield _format_sse(sse_event.event, sse_event.data)

            yield _format_sse("done", {})

        except Exception:
            logger.exception("Error during streaming response for conversation %s", conversation_id)
            yield _format_sse("error", {"error": "An internal error occurred during generation."})

    return EventSourceResponse(
        event_generator(),
        headers={
            "X-Accel-Buffering": "no",
            "Cache-Control": "no-cache, no-store",
        },
    )


def _format_sse(event: str, data: dict) -> str:
    """Format a single SSE event string."""
    return f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"


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
    await _service.verify_ownership(supabase, conversation_id, user.id)
    result = await _service.add_agent(supabase, conversation_id, body.agent_id)
    await AuditService.safe_log(
        supabase,
        simulation_id,
        user.id,
        "chat_conversation_agents",
        body.agent_id,
        "create",
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
    await _service.verify_ownership(supabase, conversation_id, user.id)
    await _service.remove_agent(supabase, conversation_id, agent_id)
    await AuditService.safe_log(
        supabase,
        simulation_id,
        user.id,
        "chat_conversation_agents",
        agent_id,
        "delete",
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
    await _service.verify_ownership(supabase, conversation_id, user.id)
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
    await _service.verify_ownership(supabase, conversation_id, user.id)
    ref = await _service.add_event_reference(
        supabase,
        conversation_id,
        body.event_id,
        user.id,
    )
    await AuditService.safe_log(
        supabase,
        simulation_id,
        user.id,
        "chat_event_references",
        body.event_id,
        "create",
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
    await _service.verify_ownership(supabase, conversation_id, user.id)
    await _service.remove_event_reference(supabase, conversation_id, event_id)
    await AuditService.safe_log(
        supabase,
        simulation_id,
        user.id,
        "chat_event_references",
        event_id,
        "delete",
        details={"conversation_id": str(conversation_id)},
    )
    return SuccessResponse(data={"removed": True})


@router.post(
    "/conversations/{conversation_id}/messages/{message_id}/reactions",
)
async def toggle_reaction(
    simulation_id: UUID,
    conversation_id: UUID,
    message_id: UUID,
    body: ReactionToggleRequest,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> SuccessResponse[ReactionToggleResponse]:
    """Toggle a reaction on a message (add if absent, remove if present).

    Delegates to atomic Postgres RPC — no race conditions on concurrent toggles.
    """
    await _service.verify_ownership(supabase, conversation_id, user.id)
    action = await _service.toggle_reaction(supabase, message_id, body.emoji)
    await AuditService.safe_log(
        supabase,
        simulation_id,
        user.id,
        "chat_message_reactions",
        message_id,
        action,
        details={"emoji": body.emoji, "conversation_id": str(conversation_id)},
    )
    return SuccessResponse(
        data=ReactionToggleResponse(
            action=action,
            message_id=message_id,
            emoji=body.emoji,
        ),
    )


@router.get(
    "/conversations/{conversation_id}/messages/{message_id}/reactions",
)
async def get_reactions(
    simulation_id: UUID,
    conversation_id: UUID,
    message_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> SuccessResponse[list[ReactionSummary]]:
    """Get aggregated reactions for a message."""
    await _service.verify_ownership(supabase, conversation_id, user.id)
    grouped = await _service.get_reactions(supabase, [message_id])
    reactions = grouped.get(str(message_id), [])
    return SuccessResponse(data=reactions)


@router.patch("/conversations/{conversation_id}")
async def archive_conversation(
    simulation_id: UUID,
    conversation_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> SuccessResponse[ConversationResponse]:
    """Archive a conversation (soft-delete)."""
    await _service.verify_ownership(supabase, conversation_id, user.id)
    conversation = await _service.archive_conversation(supabase, conversation_id)
    await AuditService.safe_log(
        supabase,
        simulation_id,
        user.id,
        "chat_conversations",
        conversation_id,
        "archive",
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
    await _service.verify_ownership(supabase, conversation_id, user.id)
    conversation = await _service.delete_conversation(supabase, conversation_id)
    await AuditService.safe_log(
        supabase,
        simulation_id,
        user.id,
        "chat_conversations",
        conversation_id,
        "delete",
    )
    return SuccessResponse(data=conversation)

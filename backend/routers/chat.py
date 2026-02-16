"""Chat endpoints — with optional AI response generation."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query

from backend.dependencies import get_current_user, get_supabase, require_role
from backend.models.chat import (
    ConversationCreate,
    ConversationResponse,
    MessageCreate,
    MessageResponse,
)
from backend.models.common import CurrentUser, SuccessResponse
from backend.services.chat_ai_service import ChatAIService
from backend.services.chat_service import ChatService
from backend.services.external_service_resolver import ExternalServiceResolver
from supabase import Client

router = APIRouter(
    prefix="/api/v1/simulations/{simulation_id}/chat",
    tags=["chat"],
)

_service = ChatService()


@router.get("/conversations", response_model=SuccessResponse[list[ConversationResponse]])
async def list_conversations(
    simulation_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """List all conversations for the current user."""
    conversations = await _service.list_conversations(supabase, simulation_id, user.id)
    return {"success": True, "data": conversations}


@router.post("/conversations", response_model=SuccessResponse[ConversationResponse], status_code=201)
async def create_conversation(
    simulation_id: UUID,
    body: ConversationCreate,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Start a new conversation with an agent."""
    conversation = await _service.create_conversation(
        supabase, simulation_id, user.id, body.agent_id, body.title,
    )
    return {"success": True, "data": conversation}


@router.get("/conversations/{conversation_id}/messages", response_model=SuccessResponse[list[MessageResponse]])
async def get_messages(
    simulation_id: UUID,
    conversation_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
    limit: int = Query(default=50, ge=1, le=200),
    before: str | None = Query(default=None, description="Cursor: ISO timestamp for pagination"),
) -> dict:
    """Get messages for a conversation with cursor-based pagination."""
    messages = await _service.get_messages(supabase, conversation_id, limit=limit, before=before)
    return {"success": True, "data": messages}


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=SuccessResponse[MessageResponse | list[MessageResponse]],
    status_code=201,
)
async def send_message(
    simulation_id: UUID,
    conversation_id: UUID,
    body: MessageCreate,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Send a message in a conversation.

    If generate_response=true, also generates an AI response from the agent.
    """
    # Save user message
    user_message = await _service.send_message(
        supabase, conversation_id, body.content, body.sender_role, body.metadata,
    )

    if not body.generate_response:
        return {"success": True, "data": user_message}

    # Generate AI response
    resolver = ExternalServiceResolver(supabase, simulation_id)
    ai_config = await resolver.get_ai_provider_config()
    chat_ai = ChatAIService(
        supabase, simulation_id,
        openrouter_api_key=ai_config.openrouter_api_key,
    )
    await chat_ai.generate_response(
        conversation_id, body.content,
    )

    # Load the AI message that was saved by ChatAIService
    ai_messages = await _service.get_messages(
        supabase, conversation_id, limit=1,
    )

    return {
        "success": True,
        "data": [user_message, ai_messages[0]] if ai_messages else user_message,
    }


@router.delete("/conversations/{conversation_id}", response_model=SuccessResponse[ConversationResponse])
async def archive_conversation(
    simulation_id: UUID,
    conversation_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Archive a conversation."""
    conversation = await _service.archive_conversation(supabase, conversation_id)
    return {"success": True, "data": conversation}

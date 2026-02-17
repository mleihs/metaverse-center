"""Chat endpoints — with optional AI response generation and group chat support."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query

from backend.dependencies import get_current_user, get_supabase, require_role
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
    """Start a new conversation with one or more agents."""
    conversation = await _service.create_conversation(
        supabase, simulation_id, user.id, body.agent_ids, body.title,
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

    If generate_response=true, generates AI responses from all agents in the conversation.
    """
    # Save user message
    user_message = await _service.send_message(
        supabase, conversation_id, body.content, body.sender_role, body.metadata,
    )

    if not body.generate_response:
        return {"success": True, "data": user_message}

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

    return {"success": True, "data": all_messages}


@router.post(
    "/conversations/{conversation_id}/agents",
    response_model=SuccessResponse[dict],
    status_code=201,
)
async def add_agent(
    simulation_id: UUID,
    conversation_id: UUID,
    body: AddAgentRequest,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Add an agent to a conversation."""
    result = await _service.add_agent(supabase, conversation_id, body.agent_id)
    return {"success": True, "data": result}


@router.delete(
    "/conversations/{conversation_id}/agents/{agent_id}",
    response_model=SuccessResponse[dict],
)
async def remove_agent(
    simulation_id: UUID,
    conversation_id: UUID,
    agent_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Remove an agent from a conversation."""
    await _service.remove_agent(supabase, conversation_id, agent_id)
    return {"success": True, "data": {"removed": True}}


@router.get(
    "/conversations/{conversation_id}/events",
    response_model=SuccessResponse[list[EventReferenceResponse]],
)
async def get_event_references(
    simulation_id: UUID,
    conversation_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """List event references for a conversation."""
    refs = await _service.get_event_references(supabase, conversation_id)
    return {"success": True, "data": refs}


@router.post(
    "/conversations/{conversation_id}/events",
    response_model=SuccessResponse[EventReferenceResponse],
    status_code=201,
)
async def add_event_reference(
    simulation_id: UUID,
    conversation_id: UUID,
    body: EventReferenceCreate,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Add an event reference to a conversation."""
    ref = await _service.add_event_reference(
        supabase, conversation_id, body.event_id, user.id,
    )
    return {"success": True, "data": ref}


@router.delete(
    "/conversations/{conversation_id}/events/{event_id}",
    response_model=SuccessResponse[dict],
)
async def remove_event_reference(
    simulation_id: UUID,
    conversation_id: UUID,
    event_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Remove an event reference from a conversation."""
    await _service.remove_event_reference(supabase, conversation_id, event_id)
    return {"success": True, "data": {"removed": True}}


@router.patch("/conversations/{conversation_id}", response_model=SuccessResponse[ConversationResponse])
async def archive_conversation(
    simulation_id: UUID,
    conversation_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Archive a conversation (soft-delete)."""
    conversation = await _service.archive_conversation(supabase, conversation_id)
    return {"success": True, "data": conversation}


@router.delete("/conversations/{conversation_id}", response_model=SuccessResponse[ConversationResponse])
async def delete_conversation(
    simulation_id: UUID,
    conversation_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Permanently delete a conversation and all its messages."""
    conversation = await _service.delete_conversation(supabase, conversation_id)
    return {"success": True, "data": conversation}

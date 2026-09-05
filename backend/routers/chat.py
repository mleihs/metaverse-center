"""Chat endpoints — with optional AI response generation and group chat support."""

import json
import logging
from typing import Annotated
from uuid import UUID

import sentry_sdk
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import EventSourceResponse

from backend.dependencies import (
    get_anon_supabase,
    get_current_user,
    get_effective_supabase,
    require_role,
)
from backend.middleware.rate_limit import (
    RATE_LIMIT_AI_CHAT,
    RATE_LIMIT_AI_GENERATION,
    RATE_LIMIT_EXTERNAL_API,
    limiter,
)
from backend.models.auth import ConversationLockRequest, SceneImageRequest
from backend.models.chat import (
    AddAgentRequest,
    ChatMessageResponse,
    ConversationContinuationRequest,
    ConversationCreate,
    ConversationResponse,
    ConversationStatusRequest,
    ConversationUpdate,
    EventReferenceCreate,
    EventReferenceResponse,
    MessageCreate,
    ReactionSummary,
    ReactionToggleRequest,
    ReactionToggleResponse,
)
from backend.models.common import CurrentUser, SuccessResponse
from backend.routers.auth import verify_account_password
from backend.services.audit_service import AuditService
from backend.services.chat.scene_image_service import (
    SceneImageRefusedError,
    SceneImageService,
    SceneSpan,
)
from backend.services.chat_service import ChatService
from backend.services.external.openrouter import OpenRouterError
from backend.services.forge_draft_service import ForgeDraftService
from backend.services.image_content_policy import ContentRating, SceneVantage
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
    supabase: Annotated[Client, Depends(get_effective_supabase)],
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
    supabase: Annotated[Client, Depends(get_effective_supabase)],
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
    supabase: Annotated[Client, Depends(get_effective_supabase)],
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    before: Annotated[str | None, Query(description="Cursor: ISO timestamp for pagination")] = None,
) -> SuccessResponse[list[ChatMessageResponse]]:
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
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[list[ChatMessageResponse]]:
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
        user_id=user.id,
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
    supabase: Annotated[Client, Depends(get_effective_supabase)],
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
                user_id=user.id,
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


@router.post(
    "/conversations/{conversation_id}/regenerate",
    status_code=200,
)
@limiter.limit(RATE_LIMIT_AI_CHAT)
async def regenerate_response(
    request: Request,
    simulation_id: UUID,
    conversation_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> EventSourceResponse:
    """Re-trigger AI response generation via SSE stream.

    Uses the last user message in the conversation as context.
    Does NOT create a new user message — only generates a new AI response.
    Used by: Regenerate toolbar action, automatic retry on empty response.
    """
    await _service.verify_ownership(supabase, conversation_id, user.id)

    await AuditService.safe_log(
        supabase,
        simulation_id,
        user.id,
        "chat_messages",
        conversation_id,
        "regenerate",
        details={"conversation_id": str(conversation_id)},
    )

    async def event_generator():
        try:
            async for sse_event in _service.stream_regenerate(
                supabase,
                simulation_id,
                conversation_id,
                user_id=user.id,
            ):
                if await request.is_disconnected():
                    logger.info("Client disconnected during regenerate for conversation %s", conversation_id)
                    return

                yield _format_sse(sse_event.event, sse_event.data)

            yield _format_sse("done", {})

        except Exception:
            logger.exception("Error during regenerate for conversation %s", conversation_id)
            yield _format_sse("error", {"error": "An internal error occurred during regeneration."})

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


@router.get("/conversations/{conversation_id}/starters")
async def get_conversation_starters(
    simulation_id: UUID,
    conversation_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
    locale: Annotated[str, Query(pattern="^(de|en)$")] = "de",
) -> SuccessResponse[list[str]]:
    """Get contextual conversation starters for an empty conversation.

    Returns 3-4 template-based suggestions derived from agent profiles,
    recent simulation events, and agent mood. Designed for the empty
    conversation state in ChatFeed.
    """
    await _service.verify_ownership(supabase, conversation_id, user.id)
    starters = await _service.get_conversation_starters(
        supabase,
        simulation_id,
        conversation_id,
        locale,
    )
    return SuccessResponse(data=starters)


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
    supabase: Annotated[Client, Depends(get_effective_supabase)],
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
    supabase: Annotated[Client, Depends(get_effective_supabase)],
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
    supabase: Annotated[Client, Depends(get_effective_supabase)],
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
    supabase: Annotated[Client, Depends(get_effective_supabase)],
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
    supabase: Annotated[Client, Depends(get_effective_supabase)],
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
    supabase: Annotated[Client, Depends(get_effective_supabase)],
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
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[list[ReactionSummary]]:
    """Get aggregated reactions for a message."""
    await _service.verify_ownership(supabase, conversation_id, user.id)
    grouped = await _service.get_reactions(supabase, [message_id])
    reactions = grouped.get(str(message_id), [])
    return SuccessResponse(data=reactions)


@router.put("/conversations/{conversation_id}/title")
async def rename_conversation(
    simulation_id: UUID,
    conversation_id: UUID,
    body: ConversationUpdate,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[ConversationResponse]:
    """Rename a conversation."""
    await _service.verify_ownership(supabase, conversation_id, user.id)
    conversation = await _service.rename_conversation(supabase, conversation_id, body.title)
    await AuditService.safe_log(
        supabase,
        simulation_id,
        user.id,
        "chat_conversations",
        conversation_id,
        "rename",
        details={"title": body.title},
    )
    return SuccessResponse(data=conversation)


@router.patch("/conversations/{conversation_id}/lock")
@limiter.limit(RATE_LIMIT_EXTERNAL_API)
async def set_conversation_lock(
    request: Request,
    simulation_id: UUID,
    conversation_id: UUID,
    body: ConversationLockRequest,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
    anon: Annotated[Client, Depends(get_anon_supabase)],
) -> SuccessResponse[dict]:
    """Ein Gespraech unter Verschluss legen oder wieder oeffnen.

    Das Passwort steht im SELBEN Aufruf wie die Aenderung. Die Spezifikation
    sah einen `reauth_at < 2 min`-Merker vor; der haette einen Zustand
    gebraucht, den der Server sonst nirgends fuehrt, und ein Fenster zwischen
    Nachweis und Wirkung geoeffnet. So gibt es kein Fenster.

    ⚠ `require_role("viewer")` genuegt hier bewusst NICHT allein: der
    Verschluss gehoert dem BESITZER des Gespraechs, nicht einer Weltrolle.
    `verify_ownership` wirft 404 fuer jeden anderen — auch fuer einen
    Plattform-Admin, dessen RLS-Umgehung an dieser Stelle sonst greifen wuerde.
    """
    await _service.verify_ownership(supabase, conversation_id, user.id)

    if not await verify_account_password(anon, user.email, body.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Password not recognised.",
        )

    await _service.set_locked(supabase, conversation_id, user.id, body.locked)
    await AuditService.safe_log(
        supabase,
        simulation_id,
        user.id,
        "chat_conversations",
        conversation_id,
        "lock" if body.locked else "unlock",
        # Kein Passwort, kein Titel: das Protokoll haelt fest, DASS der
        # Verschluss umgelegt wurde, nicht woran.
        details={"locked": body.locked},
    )
    return SuccessResponse(data={"id": str(conversation_id), "locked": body.locked})


@router.post("/conversations/{conversation_id}/scene-image")
@limiter.limit(RATE_LIMIT_AI_GENERATION)
async def create_scene_image(
    request: Request,
    simulation_id: UUID,
    conversation_id: UUID,
    body: SceneImageRequest,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[dict]:
    """Ein Bild aus dem, was gerade gesagt wurde.

    ``verify_ownership`` zuerst, wie beim Verschluss nebenan: ein Bild aus
    einem fremden Gespraech waere ein Leck, und `require_role("viewer")`
    allein deckt das nicht — es prueft die Weltrolle, nicht den Besitz.

    ``RATE_LIMIT_AI_GENERATION`` und nicht ``RATE_LIMIT_AI_CHAT``: das hier
    kostet einen Modellaufruf UND eine Bilderzeugung, ist aber kein
    Gespraechszug. 120/Stunde ist die Kappe, die auch die Schmiede faehrt.
    """
    await _service.verify_ownership(supabase, conversation_id, user.id)
    or_key, _ = await ForgeDraftService.get_user_keys(user.id)

    dienst = SceneImageService(supabase, simulation_id)
    try:
        nachricht = await dienst.generate(
            conversation_id=conversation_id,
            user_id=user.id,
            span=SceneSpan(body.span),
            vantage=SceneVantage(body.vantage) if body.vantage else None,
            rating=ContentRating(body.rating),
            openrouter_key=or_key,
        )
    except SceneImageRefusedError as abgelehnt:
        # 422 und nicht 400: die Anfrage war wohlgeformt, ihr INHALT geht
        # nicht. Der Text stammt aus `image_content_policy` und ist fuer den
        # Nutzer geschrieben — er nennt absichtlich nicht, welches Wort
        # gegriffen hat.
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(abgelehnt),
        ) from abgelehnt
    except OpenRouterError as aus:
        # Der Weg zum Bild geht ueber EINEN Modellaufruf: die Szene wird erst
        # in eine Bildbeschreibung uebersetzt. `OpenRouterError` ist dabei die
        # Basisklasse fuer den API-Fehler, die gescheiterte Verbindung UND die
        # erschoepften Wiederholungen — die drei Unterklassen decken keinen
        # dieser Faelle ab, deshalb steht hier die Basis.
        #
        # 503 und nicht 500: es liegt nicht an der Anfrage, und der Nutzer
        # soll es gleich noch einmal versuchen duerfen. Gleiche Behandlung wie
        # in `echoes.py` und `admin.py`.
        logger.warning(
            "Scene image unavailable: model call failed",
            extra={"conversation_id": str(conversation_id), "error": str(aus)},
        )
        with sentry_sdk.push_scope() as scope:
            scope.set_tag("service", "scene_image")
            scope.set_tag("simulation_id", str(simulation_id))
            sentry_sdk.capture_exception(aus)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service unavailable. Please try again.",
        ) from aus

    await AuditService.safe_log(
        supabase,
        simulation_id,
        user.id,
        "chat_messages",
        conversation_id,
        "scene_image",
        details={"span": body.span, "rating": body.rating},
    )
    return SuccessResponse(data=nachricht)


@router.delete("/conversations/{conversation_id}/scene-image/{message_id}")
async def delete_scene_image(
    simulation_id: UUID,
    conversation_id: UUID,
    message_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[dict]:
    """Ein einzelnes Szenenbild aus dem Faden entfernen.

    `require_role("viewer")` und nicht `editor`, wie beim Erzeugen nebenan:
    wer ein Bild in seinem eigenen Gespraech anlegen darf, darf es auch wieder
    loeschen. Den Besitz prueft `verify_ownership` — die Weltrolle allein
    deckt ihn nicht ab.

    Es gab diese Route bis zum 05.09.2026 nicht. Ein erzeugtes Bild blieb, wo
    es war, und die einzige Moeglichkeit, es loszuwerden, war den ganzen Faden
    zu loeschen — was seinerseits die Dateien im Speicher liegen liess.
    """
    await _service.verify_ownership(supabase, conversation_id, user.id)
    dienst = SceneImageService(supabase, simulation_id)
    try:
        ergebnis = await dienst.delete(conversation_id=conversation_id, message_id=message_id)
    except SceneImageRefusedError as fehlt:
        # 404 und nicht 422: hier ist nicht der INHALT das Problem, sondern
        # dass es die Zeile in diesem Faden nicht gibt.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(fehlt)) from fehlt

    await AuditService.safe_log(
        supabase,
        simulation_id,
        user.id,
        "chat_messages",
        message_id,
        "delete",
        details={"conversation_id": str(conversation_id), "kind": "scene_image"},
    )
    return SuccessResponse(data=ergebnis)


@router.patch("/conversations/{conversation_id}/continuation")
@limiter.limit(RATE_LIMIT_EXTERNAL_API)
async def set_conversation_continuation(
    request: Request,
    simulation_id: UUID,
    conversation_id: UUID,
    body: ConversationContinuationRequest,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[dict]:
    """Ob die Agenten dieses Fadens ohne den Menschen weiterreden.

    Kein Passwort, anders als beim Verschluss nebenan: der Verschluss nimmt
    etwas zurueck, was schon geschrieben steht; dies gibt nur der Zukunft eine
    Richtung.

    ⚠ `require_role("viewer")` genuegt hier — wie beim Verschluss — bewusst
    NICHT allein: der Faden gehoert seinem BESITZER, nicht einer Weltrolle.
    `set_continuation` prueft die Besitzerschaft und wirft 404 fuer jeden
    anderen, auch fuer einen Plattform-Admin, dessen RLS-Umgehung sonst
    griffe.

    Ein verschlossener Faden wird abgewiesen (400). Das Merkmalstor
    `agent_continuation_enabled` entscheidet, ob die Phase ueberhaupt laeuft;
    es ist bewusst KEINE Bedingung fuer diesen Aufruf, damit ein Mensch seine
    Wahl vorbereiten kann, bevor die Verwaltung das Tor oeffnet, und sie nach
    einem Schliessen nicht verliert.
    """
    result = await _service.set_continuation(
        supabase,
        conversation_id,
        user.id,
        continues_without_user=body.continues_without_user,
        notify=body.notify,
        interval_hours=body.interval_hours,
    )
    await AuditService.safe_log(
        supabase,
        simulation_id,
        user.id,
        "chat_conversations",
        conversation_id,
        "continuation_on" if body.continues_without_user else "continuation_off",
        # Kein Titel, kein Inhalt: das Protokoll haelt fest, WAS eingestellt
        # wurde, nicht worueber geredet wird.
        details={"notify": body.notify, "interval_hours": body.interval_hours},
    )
    return SuccessResponse(data=result)


@router.patch("/conversations/{conversation_id}")
async def set_conversation_status(
    simulation_id: UUID,
    conversation_id: UUID,
    body: ConversationStatusRequest,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[ConversationResponse]:
    """Ein Gespraech beiseitelegen (`archived`) oder hervorholen (`active`).

    Die Route nahm bis zum 05.09.2026 KEINEN Rumpf und archivierte immer. Der
    Klient schickte `{"status": "archived"}`, der Server verwarf es — was nie
    auffiel, weil beide dasselbe wollten. Der Weg zurueck fehlte damit auf der
    ganzen Strecke, und die Oberflaeche bot an einem archivierten Gespraech
    nur noch das Loeschen an.

    Der Rumpf ist jetzt echt und auf zwei Werte typisiert. Das ist die
    kleinste Aenderung, die aus einer Einbahnstrasse eine Tuer macht — und die
    einzige, die dem Wort „archivieren" sein Versprechen zurueckgibt.
    """
    await _service.verify_ownership(supabase, conversation_id, user.id)
    conversation = await _service.set_conversation_status(supabase, conversation_id, body.status)
    await AuditService.safe_log(
        supabase,
        simulation_id,
        user.id,
        "chat_conversations",
        conversation_id,
        # Die Handlung heisst, was sie tut. Ein Pruefpfad, in dem beide
        # Richtungen „archive" heissen, waere beim Nachsehen wertlos.
        "archive" if body.status == "archived" else "unarchive",
    )
    return SuccessResponse(data=conversation)


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    simulation_id: UUID,
    conversation_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
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

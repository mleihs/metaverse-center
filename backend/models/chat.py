"""Pydantic models for chat conversations and messages."""

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


class AgentBrief(BaseModel):
    """Lightweight agent info for message attribution."""

    id: UUID
    name: str
    portrait_image_url: str | None = None

    # Wo dieser Agent gerade ist — als ZUSTAND, nicht als Wort.
    #
    # Das Frontend beschriftet ihn („Im Amt", „Unterwegs", „Im Auftrag",
    # „Erreichbar"), weil die Übersetzungen dort leben. Die REGEL steht in der
    # Sicht `agent_presence` (Migration 327) und nirgends sonst: nennt morgen die
    # Rundschau oder eine Mail denselben Status, liest sie dieselbe Quelle statt
    # sie aus Rohfeldern nachzurechnen.
    #
    # `None` heisst „niemand hat es gesagt" — nicht „erreichbar". Der Unterschied
    # ist der Grund, warum die Oberfläche im Zweifel KEINE Statuszeile zeigt
    # statt einer erfundenen: ein Signal, das nie umspringt, ist Dekor mit dem
    # Aussehen einer Messung.
    presence: Literal["in_office", "travelling", "on_assignment", "reachable"] | None = None


class ConversationCreate(BaseModel):
    """Schema for creating a new chat conversation."""

    agent_ids: list[UUID] = Field(..., min_length=1)
    title: str | None = None


class ConversationUpdate(BaseModel):
    """Schema for updating a conversation (rename)."""

    title: str = Field(..., min_length=1, max_length=200)


class AddAgentRequest(BaseModel):
    """Schema for adding an agent to a conversation."""

    agent_id: UUID


class EventReferenceCreate(BaseModel):
    """Schema for referencing an event in a conversation."""

    event_id: UUID


class MessageCreate(BaseModel):
    """Schema for sending a chat message."""

    content: str = Field(..., min_length=1, max_length=10000)
    sender_role: Literal["user", "system"] = "user"
    metadata: dict | None = None
    generate_response: bool = False


class ConversationStatusRequest(BaseModel):
    """Ein Gespraech beiseitelegen — oder wieder hervorholen.

    WARUM DAS EIN RUMPF IST UND VORHER KEINER WAR

    Die Route `PATCH /conversations/{id}` nahm bis zum 05.09.2026 GAR KEINEN
    Rumpf entgegen und setzte immer `status='archived'`. Der Klient schickte
    `{"status": "archived"}` und der Server verwarf es — was nicht auffiel,
    weil beide dasselbe wollten.

    Aufgefallen ist es, als jemand versehentlich archivierte und zurueck
    wollte: es gab keinen Weg. Die Zeile blieb sichtbar, das Schreibfeld
    verschwand, und die einzige Handlung, die die Oberflaeche einem
    archivierten Gespraech noch anbot, war LOESCHEN. Auf „das wollte ich
    nicht" antwortete die Anwendung mit „dann zerstoere es".

    Ein Wort wie „archivieren" verspricht, dass etwas wiederzufinden ist. Eine
    Einbahnstrasse unter diesem Namen ist eine zerstoererische Handlung mit
    einem sanften Etikett — und sie trug als einzige der drei (archivieren,
    verschliessen, loeschen) KEINE Rueckfrage.

    Zwei Werte und nicht ein freies Feld: `status` traegt in der Datenbank
    genau diese beiden, und ein `Literal` sagt das an der Stelle, an der ein
    Klient es liest.
    """

    status: Literal["active", "archived"]


class ConversationContinuationRequest(BaseModel):
    """Der Griff am einzelnen Gespraech: reden die Agenten ohne mich weiter.

    Kein Passwort, anders als beim Verschluss. Der Verschluss NIMMT etwas
    zurueck, was schon geschrieben ist; dies gibt nur der Zukunft eine
    Richtung und ist jederzeit wieder umzulegen.

    ``interval_hours`` ist der MINDESTABSTAND zwischen zwei Wortwechseln, nicht
    eine Stufenzahl. Fuenf Werte, weil ein Regler mit benannten Rasten fuenf
    traegt; die Zahl steht am Regler, damit die Beschriftung nicht das einzige
    ist, was der Mensch zu sehen bekommt.

    ⚠ Die wirkliche Kadenz ist ``max(interval_hours, Heartbeat-Taktlaenge)`` —
    feiner als der Takt kann nichts werden. Siehe Migration 357.
    """

    continues_without_user: bool
    notify: Literal["never", "app", "digest", "immediate"] = "digest"
    interval_hours: Literal[4, 6, 12, 24, 48] = 12


class ConversationResponse(BaseModel):
    """Full conversation response."""

    id: UUID
    simulation_id: UUID
    user_id: UUID
    agent_id: UUID | None = None
    title: str | None = None
    status: str = "active"
    locked: bool = False
    continues_without_user: bool = False
    continue_notify: Literal["never", "app", "digest", "immediate"] = "digest"
    continue_interval_hours: int = 12
    message_count: int = 0
    last_message_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    locale: str = "de"
    agents: list[AgentBrief] = []
    event_references: list["EventReferenceResponse"] = []


class ChatMessageResponse(BaseModel):
    """Full chat message response."""

    id: UUID
    conversation_id: UUID
    sender_role: str
    content: str
    metadata: dict | None = None
    created_at: datetime
    agent_id: UUID | None = None
    agent: AgentBrief | None = None
    # AI generation metadata (populated for assistant messages from metadata JSON)
    model_used: str | None = None
    token_count: int | None = None
    generation_ms: int | None = None
    locale: str | None = None
    # Reactions (populated from batch RPC in get_messages)
    reactions: list["ReactionSummary"] = []

    @model_validator(mode="before")
    @classmethod
    def _extract_ai_metadata(cls, data: Any) -> Any:
        """Extract AI metadata fields from the metadata JSON dict."""
        if isinstance(data, dict):
            meta = data.get("metadata")
            if isinstance(meta, dict):
                for field in ("model_used", "token_count", "generation_ms", "locale"):
                    if field not in data or data[field] is None:
                        data[field] = meta.get(field)
        return data


class EventReferenceResponse(BaseModel):
    """Event reference with event details."""

    id: UUID
    event_id: UUID
    event_title: str
    event_type: str | None = None
    event_description: str | None = None
    occurred_at: str | None = None
    impact_level: int | None = None
    referenced_at: datetime


class ReactionToggleRequest(BaseModel):
    """Schema for toggling a reaction on a message."""

    emoji: str = Field(..., min_length=1, max_length=8)


class ReactionSummary(BaseModel):
    """Aggregated reaction for a message — emoji + count + own-vote indicator."""

    emoji: str
    count: int
    reacted_by_me: bool = False


class ReactionToggleResponse(BaseModel):
    """Result of toggling a reaction — 'added' or 'removed'."""

    action: str
    message_id: UUID
    emoji: str

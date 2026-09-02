"""Pydantic-Modelle der Schleuse (Event-Intake).

Die Schleuse führt zwei Zuflüsse zusammen, die bisher zwei Vokabulare an zwei
Orten hatten: den Substrate-Scanner (Admin) und die Social-Trends-Suche
(Architekt). Der Plan steht in `handoff/schleuse-event-intake.md`.

Hier stehen nur die Formen, die es vorher nicht gab — das Melden eines Signals
an das Bureau und die Vorschau darauf, was eine Resonanz in den Welten anrichten
würde. Alles andere spricht weiterhin über `backend/models/news_scanner.py` und
`backend/models/social_trend.py`.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class FlagSignalRequest(BaseModel):
    """Ein Architekt legt dem Bureau ein Signal vor.

    Der Körper trägt das Signal selbst mit, nicht nur eine Kennung: der
    Architekt arbeitet in der Schleuse mit gebrowsten Artikeln, und die haben
    keine Zeile in der Datenbank — sie sind flüchtig, bis jemand sie behält.
    Das Melden IST das Behalten.
    """

    title: str = Field(min_length=1, max_length=500)
    source_category: str
    magnitude: float = Field(ge=0.1, le=1.0)
    reason: str = Field(min_length=1, max_length=2000)

    description: str | None = Field(default=None, max_length=5000)
    article_url: str | None = Field(default=None, max_length=2000)
    article_platform: str | None = Field(default=None, max_length=200)
    article_raw_data: dict | None = None


class FlaggedSignalResponse(BaseModel):
    """Die Meldung, wie sie in der Warteschlange des Bureaus liegt."""

    id: UUID
    title: str
    source_category: str
    magnitude: float
    status: str
    flag_reason: str | None = None
    flagged_by_simulation_id: UUID | None = None
    created_at: datetime


class SusceptibilityRow(BaseModel):
    """Was eine Resonanz in EINER Welt anrichten würde.

    `effective_magnitude` ist eine OBERGRENZE: Attunement-Tiefe und
    Anker-Schutz werden erst im Lauf je Welt gelesen und können den Wert nur
    senken. `will_skip` ist entsprechend die vorsichtige Antwort — eine Welt,
    die hier als getroffen steht, kann im Lauf noch übersprungen werden, nie
    umgekehrt.
    """

    simulation_id: UUID
    simulation_name: str
    simulation_slug: str | None = None
    susceptibility: float
    effective_magnitude: float
    will_skip: bool

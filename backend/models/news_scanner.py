"""Pydantic models for Substrate Scanner API."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from backend.models.common import PaginationMeta


class ScanCandidateResponse(BaseModel):
    """Response model for a scan candidate."""

    id: UUID
    source_category: str
    title: str
    description: str | None = None
    bureau_dispatch: str | None = None
    article_url: str | None = None
    article_platform: str | None = None
    article_raw_data: dict | None = None
    magnitude: float
    classification_reason: str | None = None
    source_adapter: str
    #: Die Quellen, die dieselbe Geschichte gemeldet haben (Migration 345).
    #: Enthaelt IMMER auch den Traeger — eine Geschichte ohne Quelle gibt es
    #: nicht. Die Vorgabe deckt Zeilen von vor der Migration.
    sources: list[dict] = []
    #: Likes + Reposts der beitragenden Sozialquellen. 0 heisst „keine
    #: gemessen", nicht „niemand hat reagiert".
    social_volume: int = 0
    #: Zusammen mit `source_adapter` der Schluessel zum Scan-Protokoll
    #: (Migration 343). NULL fuer Zeilen von vor der Migration, die sich nicht
    #: eindeutig zuordnen liessen.
    source_id: str | None = None
    is_structured: bool
    status: str
    resonance_id: UUID | None = None
    created_at: datetime
    reviewed_at: datetime | None = None
    reviewed_by_id: UUID | None = None
    # Nur bei status='flagged' gesetzt (Migration 334). Ohne die Begruendung
    # sieht eine Meldung in der Liste des Admins aus wie jeder Scanner-Treffer,
    # und der Grund, warum ein Mensch sie hervorgeholt hat, waere fort.
    flag_reason: str | None = None
    flagged_by_simulation_id: UUID | None = None


class ApproveCandidateRequest(BaseModel):
    """Request to approve a candidate and create a resonance."""

    delay_hours: int = Field(default=4, ge=1, le=72)


class UpdateCandidateRequest(BaseModel):
    """Request to edit a candidate before approving."""

    title: str | None = Field(default=None, min_length=1, max_length=500)
    magnitude: float | None = Field(default=None, ge=0.1, le=1.0)
    source_category: str | None = None
    bureau_dispatch: str | None = None
    archetype_override: str | None = None
    signature_override: str | None = None


class TriggerScanRequest(BaseModel):
    """Request to manually trigger a scan cycle."""

    adapter_names: list[str] | None = None


class AdapterStatusResponse(BaseModel):
    """Status info for a single source adapter."""

    name: str
    display_name: str
    categories: list[str]
    is_structured: bool
    requires_api_key: bool
    api_key_setting: str | None = None
    default_interval: int
    enabled: bool = False
    available: bool = False


class ScanMetricsResponse(BaseModel):
    """Scanner dashboard metrics."""

    scanned_today: int = 0
    classified_today: int = 0
    resonances_today: int = 0
    pending_candidates: int = 0
    last_scan: str | None = None


class DashboardResponse(BaseModel):
    """Full scanner dashboard data."""

    config: dict
    adapters: list[dict]
    metrics: ScanMetricsResponse


class ScanCandidateListResponse(BaseModel):
    """Envelope for the candidates list: items + pagination meta + the
    recommended magnitude threshold derived from the returned set.

    Preserves the FE-consumed ``{items, meta, recommended_threshold}`` shape
    (the admin scanner UI reads ``.items`` and ``.recommended_threshold``) while
    making it typed — so it is NOT switched to the standard ``paginated()``
    ``{data, meta}`` envelope, which would break those reads.
    """

    items: list[ScanCandidateResponse]
    meta: PaginationMeta
    recommended_threshold: float

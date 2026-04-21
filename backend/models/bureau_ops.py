"""Pydantic response + request models for the Bureau Ops admin panel (P1).

Canonical shape contract between `/api/v1/admin/ops/*` and the frontend
``BureauOpsApiService``. Every admin-ops endpoint returns one of these
models wrapped in ``SuccessResponse[T]``; mutation endpoints consume one
of the ``*Request`` models.

See docs/plans/bureau-ops-implementation-plan.md §4 for the data model
that backs these DTOs.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

# ── Scope / period enums (mirrors migration 228 CHECKs) ──────────────────

BudgetScope = Literal["global", "purpose", "simulation", "user"]
BudgetPeriod = Literal["hour", "day", "month"]
CircuitScope = Literal["provider", "model", "purpose", "global"]
CircuitState = Literal["closed", "half_open", "open", "killed"]
SentryRuleKind = Literal["ignore", "fingerprint", "downgrade"]
SentryDowngradeTo = Literal["warning", "info"]


# ── Ledger panel (①) ─────────────────────────────────────────────────────


class LedgerMetric(BaseModel):
    """One ledger row (today/month total or breakdown row)."""

    calls: int = 0
    tokens: int = 0
    cost_usd: float = 0.0


class LedgerBreakdownRow(BaseModel):
    """Per-(model|purpose|provider) row with label + metric."""

    key: str
    calls: int = 0
    tokens: int = 0
    cost_usd: float = 0.0


class LedgerSnapshot(BaseModel):
    """Aggregated ledger snapshot used by LedgerPanel + BurnRatePanel."""

    today: LedgerMetric
    month: LedgerMetric
    last_hour: LedgerMetric
    hourly_trend: list[LedgerMetric] = Field(default_factory=list)
    by_purpose: list[LedgerBreakdownRow] = Field(default_factory=list)
    by_model: list[LedgerBreakdownRow] = Field(default_factory=list)
    by_provider: list[LedgerBreakdownRow] = Field(default_factory=list)
    generated_at: datetime


# ── Firehose panel (⑥) ───────────────────────────────────────────────────


class FirehoseEntry(BaseModel):
    """One ai_usage_log row projected for the firehose stream.

    Never includes the prompt body (D-4). Admin can follow user_id /
    simulation_id via redacted-marker hover-reveal.
    """

    id: UUID
    created_at: datetime
    provider: str
    model: str
    purpose: str
    total_tokens: int = 0
    estimated_cost_usd: float = 0.0
    duration_ms: int = 0
    simulation_id: UUID | None = None
    user_id: UUID | None = None
    key_source: str = "platform"
    status: str = "ok"


# ── Circuit matrix panel (③) + Quarantine panel (④) ─────────────────────


class CircuitEntry(BaseModel):
    """Combined auto + manual circuit state for one (scope, scope_key)."""

    scope: CircuitScope
    scope_key: str
    state: CircuitState
    failures_in_window: int = 0
    opens_until_s: float = 0.0
    consecutive_opens: int = 0
    # Present only when the row reflects an admin-kill override:
    killed_reason: str | None = None
    killed_revert_at: datetime | None = None
    killed_by_id: UUID | None = None


class CircuitMatrix(BaseModel):
    """All known circuits (auto + manually killed) used by the matrix panel."""

    entries: list[CircuitEntry]
    generated_at: datetime


# ── Heatmap panel (⑦) ────────────────────────────────────────────────────


class HeatmapCell(BaseModel):
    """One hour × (purpose|model|provider) cell for the heatmap."""

    hour: datetime
    key: str
    calls: int
    tokens: int
    cost_usd: float


# ── Forecast panel (⑧) ───────────────────────────────────────────────────


class ForecastSlider(BaseModel):
    """One what-if slider definition returned with the projection."""

    key: str
    label: str
    min: float
    max: float
    default: float
    unit: str = ""


class ForecastProjection(BaseModel):
    """End-of-month projection + driver text used by ForecastPanel."""

    projected_usd: float
    confidence_low_usd: float
    confidence_high_usd: float
    days_remaining: int
    driver_text: str = ""
    sliders: list[ForecastSlider] = Field(default_factory=list)
    generated_at: datetime


# ── Sentry budget tile ───────────────────────────────────────────────────


class SentryBudget(BaseModel):
    """Rolling Sentry event-quota usage (D-3 5-min cache)."""

    events_this_month: int = 0
    quota: int = 5000
    quota_reset_at: datetime | None = None
    recently_silenced_24h: int = 0


# ── Ops audit log ────────────────────────────────────────────────────────


class OpsAuditEntry(BaseModel):
    """One row from ops_audit_log (migration 228)."""

    model_config = ConfigDict(extra="allow")

    id: UUID
    actor_id: UUID | None = None
    action: str
    target_scope: str | None = None
    target_key: str | None = None
    reason: str
    payload: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


# ── Budget CRUD ──────────────────────────────────────────────────────────


class BudgetCap(BaseModel):
    """Budget row (read + response)."""

    id: UUID
    scope: BudgetScope
    scope_key: str
    period: BudgetPeriod
    max_usd: float
    max_calls: int | None = None
    soft_warn_pct: int = 75
    hard_block_pct: int = 100
    enabled: bool = True
    updated_by_id: UUID | None = None
    updated_at: datetime
    created_at: datetime
    # Rolled-up current-period usage, populated by OpsLedgerService for UI:
    current_usd: float = 0.0
    current_calls: int = 0


class BudgetUpsertRequest(BaseModel):
    """Body for POST /admin/ops/budget and PUT /admin/ops/budget/{id}."""

    scope: BudgetScope
    scope_key: str = Field(..., min_length=1, max_length=128)
    period: BudgetPeriod
    max_usd: float = Field(..., ge=0)
    max_calls: int | None = Field(default=None, ge=0)
    soft_warn_pct: int = Field(default=75, ge=10, le=100)
    hard_block_pct: int = Field(default=100, ge=50, le=200)
    enabled: bool = True
    reason: str = Field(..., min_length=3, max_length=500)


# ── Sentry rules CRUD ────────────────────────────────────────────────────


class SentryRule(BaseModel):
    """Sentry rule row (read + response)."""

    id: UUID
    kind: SentryRuleKind
    match_exception_type: str | None = None
    match_message_regex: str | None = None
    match_logger: str | None = None
    fingerprint_template: str | None = None
    downgrade_to: SentryDowngradeTo | None = None
    enabled: bool = True
    note: str
    silenced_count_24h: int = 0
    updated_by_id: UUID | None = None
    updated_at: datetime
    created_at: datetime


class SentryRuleUpsertRequest(BaseModel):
    """Body for POST/PUT /admin/ops/sentry/rules.

    ``note`` is the rule's permanent documentation (why the rule exists).
    ``audit_reason`` is optional and records why this specific mutation
    happened — operators should pass it when the mutation intent differs
    from the rule's existence rationale (e.g. toggling enabled off as a
    short-term silencer). Falls back to ``note`` when omitted, matching
    the create-rule case where the two are identical.
    """

    kind: SentryRuleKind
    match_exception_type: str | None = Field(default=None, max_length=128)
    match_message_regex: str | None = Field(default=None, max_length=512)
    match_logger: str | None = Field(default=None, max_length=128)
    fingerprint_template: str | None = Field(default=None, max_length=256)
    downgrade_to: SentryDowngradeTo | None = None
    enabled: bool = True
    note: str = Field(..., min_length=3, max_length=500)
    audit_reason: str | None = Field(default=None, min_length=3, max_length=500)


# ── Kill / revert (Quarantine panel) ─────────────────────────────────────

# D-5: default auto-revert 60 minutes, max 24 hours.
_DEFAULT_REVERT_MINUTES = 60
_MAX_REVERT_MINUTES = 60 * 24


class TripKillRequest(BaseModel):
    """Body for POST /admin/ops/kill (trip a circuit manually)."""

    scope: CircuitScope
    scope_key: str = Field(..., min_length=1, max_length=128)
    reason: str = Field(..., min_length=3, max_length=500)
    revert_after_minutes: int = Field(
        default=_DEFAULT_REVERT_MINUTES,
        ge=1,
        le=_MAX_REVERT_MINUTES,
    )


class RevertKillRequest(BaseModel):
    """Body for POST /admin/ops/revert (lift an admin kill)."""

    scope: CircuitScope
    scope_key: str = Field(..., min_length=1, max_length=128)
    reason: str = Field(..., min_length=3, max_length=500)


class ResetCircuitRequest(BaseModel):
    """Body for POST /admin/ops/circuit/reset (clear auto-state)."""

    scope: CircuitScope
    scope_key: str = Field(..., min_length=1, max_length=128)
    reason: str = Field(..., min_length=3, max_length=500)


class CutAllAIRequest(BaseModel):
    """Body for POST /admin/ops/kill/cut-all-ai (master switch)."""

    reason: str = Field(..., min_length=3, max_length=500)
    revert_after_minutes: int = Field(
        default=_DEFAULT_REVERT_MINUTES,
        ge=1,
        le=_MAX_REVERT_MINUTES,
    )


class KillActionResponse(BaseModel):
    """Response after trip / revert / reset — reflects the new circuit row."""

    scope: CircuitScope
    scope_key: str
    state: CircuitState
    revert_at: datetime | None = None
    reason: str

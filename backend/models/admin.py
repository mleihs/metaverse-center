"""Pydantic response models for the admin router."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field

# ── Environment ──────────────────────────────────────────────────────────


class EnvironmentResponse(BaseModel):
    """Server environment identifier."""

    environment: str


# ── Platform Settings ────────────────────────────────────────────────────


class PlatformSettingResponse(BaseModel):
    """Platform setting row (select * from platform_settings)."""

    model_config = ConfigDict(extra="allow")

    setting_key: str
    setting_value: Any = None


# ── Feature Gates ────────────────────────────────────────────────────────


class FeatureGateResponse(BaseModel):
    """Ein Merkmalstor mit seiner Erklärung und seinem gemessenen Zustand.

    Die erklärenden Felder stammen aus ``services/platform_gate_contracts``, die
    Zustandsfelder aus ``platform_settings``. Beides zusammen, weil die Frage
    "steht das an?" ohne "was passiert, wenn es aus ist?" keine Antwort ist.
    """

    key: str
    group: str
    label: str
    turns_on: str
    absence_costs: str
    reader: str

    #: Was die Lesestelle benutzt, wenn die Zeile fehlt. Nicht überall False —
    #: Herzschlag, Autonomie und die Resonanzverarbeitung sind Notaus-Schalter.
    default_when_missing: bool

    #: Ändert das Umlegen heute etwas? Fünf DRIFT-Tore stehen auf Prod, ohne
    #: dass irgendetwas sie liest.
    wired: bool

    #: Hat ``platform_settings`` überhaupt eine Zeile für diesen Schlüssel?
    has_row: bool

    #: Der wirksame Zustand: die Zeile, wenn es sie gibt, sonst die Vorgabe.
    enabled: bool

    #: Der rohe Wert, wie er in der Tabelle steht — für den Fall, dass dort
    #: etwas Nicht-Kanonisches liegt und man es sehen muss.
    raw_value: str | None = None


class UndeclaredGateResponse(BaseModel):
    """Eine ``*_enabled``-Zeile in der Tabelle, die keine Erklärung hat.

    Existiert, damit ein Schlüssel sich nicht dadurch verstecken kann, dass
    niemand ihn erklärt hat. Erscheint in der Oberfläche als Warnung.
    """

    key: str
    enabled: bool
    raw_value: str | None = None


class FeatureGateListResponse(BaseModel):
    """Alle erklärten Tore plus alles, was in der Tabelle unerklärt liegt."""

    gates: list[FeatureGateResponse]
    undeclared: list[UndeclaredGateResponse] = Field(default_factory=list)
    groups: list[str] = Field(default_factory=list)


# ── User Management ─────────────────────────────────────────────────────


class AdminUserListResponse(BaseModel):
    """Paginated user list from admin_list_users RPC."""

    users: list[dict[str, Any]]
    total: int


class AdminUserDetailResponse(BaseModel):
    """User detail from admin_get_user RPC + memberships + wallet."""

    model_config = ConfigDict(extra="allow")

    memberships: list[dict[str, Any]] = Field(default_factory=list)
    wallet: dict[str, Any] | None = None


class AdminMembershipResponse(BaseModel):
    """Simulation membership record from simulation_members table."""

    model_config = ConfigDict(extra="allow")

    user_id: str
    simulation_id: str
    member_role: str


class AdminWalletResponse(BaseModel):
    """Wallet record from user_wallets table."""

    model_config = ConfigDict(extra="allow")

    user_id: str
    forge_tokens: int
    is_architect: bool


# ── Simulation List ─────────────────────────────────────────────────────


class AdminSimulationListItem(BaseModel):
    """Simulation row from admin list query (subset of columns)."""

    id: str
    name: str
    slug: str
    status: str
    theme: str
    simulation_type: str
    owner_id: str
    created_at: str
    deleted_at: str | None = None


# ── Health Effects ──────────────────────────────────────────────────────


class HealthEffectsSimEntry(BaseModel):
    """Per-simulation health effects state."""

    id: str
    name: str
    slug: str
    overall_health: float
    threshold_state: str
    effects_enabled: bool


class HealthEffectsDashboard(BaseModel):
    """Global + per-simulation health effects state for admin tab."""

    global_enabled: bool
    simulations: list[HealthEffectsSimEntry]


class HealthEffectsToggleResponse(BaseModel):
    """Toggle result for per-simulation health effects."""

    enabled: bool


# ── Dungeon Config ──────────────────────────────────────────────────────


class DungeonGlobalConfigResponse(BaseModel):
    """Global dungeon configuration (Pydantic mirror of service TypedDict)."""

    override_mode: str
    override_archetypes: list[str]
    clearance_mode: str
    clearance_threshold: int


class DungeonOverrideListEntry(BaseModel):
    """Simulation with its dungeon override config (bulk view)."""

    id: str
    name: str
    slug: str
    mode: str
    archetypes: list[str]


class DungeonOverrideResponse(BaseModel):
    """Per-simulation dungeon override config."""

    mode: str
    archetypes: list[str]


# ── Special Ops ─────────────────────────────────────────────────────────


class ImpersonateResponse(BaseModel):
    """Magic link token for user impersonation."""

    hashed_token: str
    email: str


class AIUsageStatsResponse(BaseModel):
    """AI usage stats from get_ai_usage_stats RPC (migration 152/169)."""

    period_days: int
    total_calls: int
    total_tokens: int
    total_cost_usd: float
    avg_cost_per_call: float
    by_provider: list[dict[str, Any]]
    by_model: list[dict[str, Any]]
    by_purpose: list[dict[str, Any]]
    by_simulation: list[dict[str, Any]]
    daily_trend: list[dict[str, Any]]
    key_sources: dict[str, Any]


class ShowcaseImageResponse(BaseModel):
    """Result of showcase background image generation."""

    archetype: str
    model: str
    url: str
    full_path: str
    thumb_path: str
    bytes: int
    usage: dict[str, Any] | None = None

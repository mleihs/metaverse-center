"""Pydantic models for the Simulation Forge drafting process."""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, conlist, field_validator

# ── The contract the model is held to ─────────────────────────────────
#
# Two things every Forge output field states in its own type, because neither
# can be recovered downstream once the model has guessed.
#
# LANGUAGE (finding 12). Only the ``_de`` fields ever named a language. The
# English side was unnamed, so the model inferred it from the context — and the
# context is a German seed. Measured on production: ``primary_profession`` came
# back once as "Tintenbad-Aufseher Erster Klasse", and gpt-4.1-mini wrote
# "Schriftregulation" into the English field. Same root, not model weakness.
# Two statements cover every field: one for the fields that pair with a ``_de``
# twin, one for the proper names that are the same string in every locale.
#
# FLOOR (finding 7). ``min_length=1`` let an object whose every field was
# literally ``"..."`` validate clean — measured, returned by ``model_default``.
# The floors below are not a quality bar. They reject a field that is not an
# answer at all, and nothing more. Each sits at roughly HALF the shortest value
# the Forge has ever written on production, read on 2026-08-30 out of the raw
# ``forge_drafts`` rows — 115 agent drafts, 117 building drafts, 88 zones,
# 62 anchors. The corpus minimum is recorded beside each constant so the next
# author reads a measurement rather than a preference.
#
# There is deliberately NO floor on the short identifier fields -- name, system,
# profession, gender, building/zone/street type, building condition. A floor of 4
# was written first and measured against the corpus before being trusted: it
# rejects the German enum word "gut" and the building type "inn", both three
# characters, which is exactly the length of the "..." it was meant to catch. On a
# short field, length does not separate a placeholder from an answer. The hollow
# object that prompted finding 7 had "..." in EVERY field, so the long-form floors
# below catch it whole; a placeholder in a short field alone is a different
# problem, and the instrument for it is each world's own taxonomy (finding 30).
#
#   floor                     applies to                        prod minimum (n)
_MIN_TITLE = 8  #             anchor title                             17  (62)
_MIN_PHRASE = 10  #           literary influence                       21  (62)
_MIN_LINE = 20  #             core question, bleed signature      42 · 46  (62)
_MIN_SHORT_PROSE = 40  #      zone description (1-2 sentences)    81 · 94  (88)
_MIN_ANCHOR_PROSE = 60  #     anchor description                134 · 155  (62)
_MIN_LONG_PROSE = 250  #      agent character + background,      515 · 452 (115)
#                             building description               464 · 470 (117)

_IN_ENGLISH = "Written in English."

# The platform's core condition rungs, best to worst — named to the model in
# exactly one place.
#
# WHY A CONSTANT AND NOT TWO STRING LITERALS
# There were two, and they disagreed. This model's field said `excellent`; the
# builder in `forge_orchestrator_service` said `pristine` — in the SAME request,
# so the model was handed two vocabularies and picked from both. That is where
# the six `pristine` buildings came from that no world's taxonomy defined
# (`forge_taxonomies` docstring, finding 30). `excellent` is the platform's
# word: the prompt template in migration 027 has said so since March, the
# database core ladder carries it at rung 10, and 26 of 36 worlds hold it as
# their top rung against 5 that hold `pristine`.
#
# `pristine` stays a legal value on the DB ladder (rung 5, above `excellent`) —
# five worlds use it and it is theirs. It is simply not what a generator should
# be told to reach for.
BUILDING_CONDITION_CORE: tuple[str, ...] = ("excellent", "good", "fair", "poor", "ruined")

# Die Kernsprossen mit ihrer Zahl — die Anker, an denen sich ein erfundenes Wort
# ausrichtet. Spiegel von `fn_building_condition_rungs()` (Migration 322).
#
# WARUM ES HIER ÜBERHAUPT EINE ZWEITE FASSUNG GIBT
# Die Karte liegt in SQL, und das ist richtig so: dort entscheidet sie, welche
# Sprosse gilt. Aber das Modell muss die Skala im Prompt LESEN können, und ein
# Prompt kann keine Datenbank abfragen. Diese Zeile ist also unvermeidlich eine
# Abschrift — und deshalb bindet `test_building_condition_vocabulary.py` sie an
# die Migration, die die Funktion definiert. Eine Abschrift ohne Wächter ist der
# Fehler, der heute dreimal zugeschlagen hat.
BUILDING_CONDITION_CORE_RUNGS: dict[str, int] = {
    "pristine": 5,
    "excellent": 10,
    "good": 20,
    "fair": 30,
    "poor": 40,
    "ruined": 50,
}
_WORLD_TONGUE = (
    "A proper name in the world's own language. It is never translated -- the same "
    "string is shown in every locale -- so do not write an English rendering of it."
)


def counted_list(item_type: type[BaseModel], requested: int, *, minimum: int) -> Any:
    """The requested length, carried by the output type the model is handed.

    ``requested`` becomes ``maxItems`` and ``minimum`` becomes ``minItems`` in the
    JSON schema pydantic-ai builds for the output tool, and both are what its
    validation retry fires on. The two numbers are deliberately different.

    The ceiling is nearly free. Over-delivery silently changes a roster the user
    configured and is paid for by the token; across 92 list deliveries read out of
    ``forge_drafts`` on production, one came back longer than ordered.

    The floor is NOT the requested count, and that is the point. Measured against
    the real anchor path (deepseek-v4-pro, the production ``model_forge``, six runs
    per variant, ``retries=1`` as ``create_forge_agent`` sets it):

        no length constraint    three anchors in 6/6 runs, 0 failures
        exactly three           three anchors in 5/6 runs, 1 TOTAL LOSS after
                                90.4 s, the call billed twice
        at least two, at most   three anchors in 6/6 runs, 0 failures
        three

    Demanding the exact count did not raise the delivery rate -- it was already
    6 of 6 without any constraint -- it only added a way to lose the entire answer.
    The stored corpus agrees: of 92 list deliveries, 87 were exact, 4 short, 1 long.
    So the floor sits where a delivery stops being worth keeping, never at the
    number ordered, and the gap between the two is reported by
    ``report_delivery_count`` instead of raised. See finding 10.
    """
    if not 1 <= minimum <= requested:
        raise ValueError(f"counted_list: minimum {minimum} must be between 1 and requested {requested}")
    return conlist(item_type, min_length=minimum, max_length=requested)


# ── Token Store Models ────────────────────────────────────────────────


class TokenBundle(BaseModel):
    """Token bundle from catalog."""

    id: UUID
    slug: str
    display_name: str
    tokens: int
    price_cents: int
    savings_pct: int
    sort_order: int
    is_active: bool = True


class PurchaseReceipt(BaseModel):
    """Receipt returned by fn_purchase_tokens."""

    purchase_id: UUID
    bundle_slug: str
    tokens_granted: int
    balance_before: int
    balance_after: int
    price_cents: int


class PurchaseRequest(BaseModel):
    """Request body for mock purchase."""

    bundle_slug: str = Field(min_length=1, max_length=50)


class TokenPurchaseHistory(BaseModel):
    """Ledger entry for purchase history."""

    id: UUID
    bundle_id: UUID
    tokens_granted: int
    price_cents: int
    payment_method: str
    balance_before: int
    balance_after: int
    created_at: datetime


class AdminTokenGrant(BaseModel):
    """Admin grant request."""

    user_id: UUID
    tokens: int = Field(ge=1, le=1000)
    reason: str | None = Field(None, max_length=500)


class AdminBundleUpdate(BaseModel):
    """Admin bundle edit request."""

    display_name: str | None = Field(None, min_length=1, max_length=100)
    tokens: int | None = Field(None, gt=0)
    price_cents: int | None = Field(None, ge=0)
    savings_pct: int | None = Field(None, ge=0, le=100)
    is_active: bool | None = None
    sort_order: int | None = Field(None, ge=0)


class TokenEconomyStats(BaseModel):
    """Aggregated token economy metrics from ``token_economy_stats`` view (migration 102)."""

    total_purchases: int
    mock_purchases: int
    admin_grants: int
    total_revenue_cents: int
    total_tokens_granted: int
    tokens_in_circulation: int
    unique_buyers: int
    active_bundles: int


class AdminPurchaseLedgerEntry(BaseModel):
    """Purchase ledger entry with bundle slug for admin view."""

    id: UUID
    user_id: UUID
    tokens_granted: int
    price_cents: int
    payment_method: str
    payment_reference: str | None = None
    balance_before: int
    balance_after: int
    created_at: datetime
    token_bundles: dict | None = None


ForgePhase = Literal["astrolabe", "drafting", "darkroom", "ignition", "completed", "failed"]
ForgeStatus = Literal["draft", "processing", "completed", "failed"]


# ── Generation Config ──────────────────────────────────────────────────


class ForgeGenerationConfig(BaseModel):
    """User-chosen entity counts and quality settings for world generation."""

    agent_count: int = Field(default=6, ge=3, le=12)
    building_count: int = Field(default=7, ge=3, le=12)
    zone_count: int = Field(default=5, ge=3, le=8)
    street_count: int = Field(default=5, ge=3, le=8)
    deep_research: bool = Field(
        default=True,
        description=(
            "Run a dedicated LLM research step before lore generation. "
            "Produces concept-lore-quality output grounded in real literary, "
            "philosophical, and architectural traditions. Costs ~$0.002 extra."
        ),
    )


# ── Lore Models ────────────────────────────────────────────────────────


class ForgeLoreSection(BaseModel):
    """A single lore section for a simulation."""

    chapter: str
    arcanum: str
    title: str

    # Das Feld hatte KEINE Beschreibung -- das Modell erfuhr nie, was ein
    # Epigraph sein soll, und tat dann das Haeufigste aus seinem Training: es
    # haengte einen beruehmten Namen unter eine zitatfoermige Zeile.
    epigraph: str = Field(
        default="",
        description=(
            "Optional. A line THIS WORLD produced: a Bureau document, a recovered log, "
            "an inscription, a field report, or a named figure of this world together "
            "with the document they said it in. NEVER a quotation attributed to a real "
            "author, thinker or historical person -- you cannot verify that they wrote "
            "it, and an unverifiable quotation under a real name is a fabricated "
            "citation. A real thinker may be named as an INFLUENCE elsewhere; that is a "
            "reference, not words put in their mouth."
        ),
    )
    body: str
    image_slug: str | None = None
    image_caption: str | None = None

    @field_validator("epigraph")
    @classmethod
    def _no_scholarly_citation(cls, value: str) -> str:
        """Weist die eine Form ab, die nachweislich Falsches erzeugt hat.

        Ein Epigraph kann nicht mechanisch auf Echtheit geprueft werden -- aber
        die GEFAEHRLICHSTE Form schon: eine Zuschreibung mit Jahreszahl in
        Klammern oder Paragraphenzeichen. Das ist die Behauptung einer realen
        Fundstelle, und genau sie macht eine Erfindung glaubwuerdiger als das
        Echte. Auf Produktion gemessen (01.09.2026) trug ein erfundenes
        Wittgenstein-Zitat die Angabe "Philosophical Investigations, Paragraph 19"
        -- die Stelle existiert und sagt etwas anderes.

        Bewusst ENG: geprueft wird nur der Schwanz nach dem letzten Gedankenstrich,
        und nur auf Jahreszahl (1400-2099) oder Paragraphenzeichen. Eine
        weltinterne Angabe wie "Tape 7" oder "Fragment 42" faellt nicht darunter.
        Ein zu breiter Pruefer haette hier einen hohen Preis: er laesst die ganze
        Lore-Erzeugung scheitern, statt eine Zeile zu verbessern -- dieselbe
        Abwaegung wie bei `counted_list`, wo eine exakte Laengenforderung die
        Lieferquote nicht hob, sondern nur einen Weg schuf, die Antwort ganz zu
        verlieren.
        """
        if not value:
            return value
        tail = re.split(r"[-\u2013\u2014]", value)[-1]
        if re.search(r"\((1[4-9]\d{2}|20\d{2})\)", tail) or "\u00a7" in tail:
            raise ValueError(
                "epigraph carries a scholarly citation (a year in parentheses or a "
                "section mark). That claims a real, checkable source. Epigraphs are "
                "in-world citations: name a Bureau document, a recovered log or an "
                "inscription instead, and never attribute a line to a real person."
            )
        return value


class ForgeLoreOutput(BaseModel):
    """AI-generated lore for a simulation."""

    sections: list[ForgeLoreSection]


class ForgeLoreTranslatedSection(BaseModel):
    """Translated fields for a single lore section."""

    title: str
    epigraph: str = ""
    body: str
    image_caption: str | None = None


class ForgeLoreTranslatedOutput(BaseModel):
    """AI-translated lore sections (DE)."""

    sections: list[ForgeLoreTranslatedSection]


# ── Theme Models ───────────────────────────────────────────────────────


class ForgeThemeOutput(BaseModel):
    """AI-generated theme with all ~40 design settings."""

    # Colors (21)
    color_primary: str = Field(description="Primary brand color (hex)")
    color_primary_hover: str = Field(description="Primary hover state")
    color_primary_active: str = Field(description="Primary active/pressed state")
    color_secondary: str = Field(description="Secondary accent color")
    color_accent: str = Field(description="Tertiary highlight color")
    color_background: str = Field(description="Page background")
    color_surface: str = Field(description="Card/panel surface")
    color_surface_sunken: str = Field(description="Recessed surface areas")
    color_surface_header: str = Field(description="Header/nav surface")
    color_text: str = Field(description="Primary text color")
    color_text_secondary: str = Field(description="Secondary text color")
    color_text_muted: str = Field(description="Muted/disabled text")
    color_border: str = Field(description="Primary border color")
    color_border_light: str = Field(description="Subtle border color")
    color_danger: str = Field(description="Error/danger color")
    color_success: str = Field(description="Success color")
    color_primary_bg: str = Field(description="Primary tinted background")
    color_info_bg: str = Field(description="Info tinted background")
    color_danger_bg: str = Field(description="Danger tinted background")
    color_success_bg: str = Field(description="Success tinted background")
    color_warning_bg: str = Field(description="Warning tinted background")

    # Typography (7)
    font_heading: str = Field(description="Heading font family CSS value")
    font_body: str = Field(description="Body font family CSS value")
    font_mono: str = Field(description="Monospace font family CSS value")
    font_base_size: str = Field(default="16px", description="Base font size")
    heading_weight: str = Field(description="Heading font weight (100-900)")
    heading_transform: str = Field(description="Heading text-transform: uppercase|none|capitalize")
    heading_tracking: str = Field(description="Heading letter-spacing CSS value")

    # Character (7)
    border_radius: str = Field(description="Border radius in px (e.g. '0', '6px', '12px')")
    border_width: str = Field(description="Primary border width (e.g. '3px')")
    border_width_default: str = Field(default="2px", description="Default border width")
    shadow_style: Literal["offset", "blur", "glow", "none"] = Field(description="Shadow rendering style")
    shadow_color: str = Field(description="Shadow color (hex)")
    hover_effect: Literal["translate", "scale", "glow"] = Field(description="Element hover effect")
    text_inverse: str = Field(default="#ffffff", description="Inverse text for dark-on-light")

    # Animation (2)
    animation_speed: str = Field(default="1", description="Animation speed multiplier (0.7-2.0)")
    animation_easing: str = Field(description="CSS easing function")

    # Card frame (4)
    card_frame_texture: Literal["none", "filigree", "circuits", "scanlines", "rivets", "illumination"] = Field(
        description="Card background texture overlay"
    )
    card_frame_nameplate: Literal["terminal", "banner", "readout", "plate", "cartouche"] = Field(
        description="Card name label style"
    )
    card_frame_corners: Literal["none", "tentacles", "brackets", "crosshairs", "bolts", "floral"] = Field(
        description="Card corner decoration motif"
    )
    card_frame_foil: Literal["holographic", "aquatic", "phosphor", "patina", "gilded"] = Field(
        description="Card holographic foil style"
    )

    # Image style prompts (4) — appended to Replicate prompts for world-consistent imagery
    image_style_prompt_portrait: str = Field(
        description="Visual style suffix for agent portrait generation. "
        "Describe the photographic/artistic style, lighting, mood, and medium "
        "that matches this world's aesthetic. E.g. 'oil painting, chiaroscuro lighting, "
        "muted earth tones' or 'cyberpunk neon photograph, rain-slicked, high contrast'.",
    )
    image_style_prompt_building: str = Field(
        description="Visual style suffix for building/architecture images. "
        "Describe the architectural photography style and atmosphere. "
        "E.g. 'brutalist concrete photography, overcast sky, stark shadows' "
        "or 'watercolor illustration, overgrown ruins, warm golden light'.",
    )
    image_style_prompt_banner: str = Field(
        description="Visual style suffix for the simulation's banner image (16:9 landscape). "
        "Describe the cinematic style for the world's establishing shot. "
        "E.g. 'epic matte painting, volumetric fog, dramatic scale' "
        "or 'aerial photograph, twilight, city lights emerging'.",
    )
    image_style_prompt_lore: str = Field(
        description="Visual style suffix for lore/story illustration images. "
        "Describe the illustration style for atmospheric narrative scenes. "
        "E.g. 'engraving illustration, cross-hatching, sepia tones' "
        "or 'concept art, moody palette, environmental storytelling'.",
    )


# ── Draft Models ───────────────────────────────────────────────────────


class ForgeDraftBase(BaseModel):
    """Base fields for a Forge Draft."""

    seed_prompt: str | None = None
    current_phase: ForgePhase = "astrolabe"
    philosophical_anchor: dict[str, Any] = Field(default_factory=dict)
    research_context: dict[str, Any] = Field(default_factory=dict)
    taxonomies: dict[str, Any] = Field(default_factory=dict)
    geography: dict[str, Any] = Field(default_factory=dict)
    agents: list[dict[str, Any]] = Field(default_factory=list)
    buildings: list[dict[str, Any]] = Field(default_factory=list)
    ai_settings: dict[str, Any] = Field(default_factory=dict)
    generation_config: dict[str, Any] = Field(default_factory=dict)
    theme_config: dict[str, Any] = Field(default_factory=dict)
    status: ForgeStatus = "draft"
    map_status: Literal["pending", "generating", "succeeded", "failed"] = "pending"


class ForgeDraftCreate(BaseModel):
    """Schema for creating a new draft."""

    seed_prompt: str = Field(min_length=3, max_length=1500)


class ForgeDraftUpdate(BaseModel):
    """Schema for updating a draft state."""

    # The seed is editable for as long as the draft is a draft. It was absent
    # here, which made it write-once at creation: the Astrolabe offers a "change
    # seed" control and a textarea, and every edit was dropped by this model
    # without a word, so the phase kept answering the question the user had
    # already replaced. Same bounds as ForgeDraftCreate — a seed that would be
    # refused at creation must not slip in through an update.
    seed_prompt: str | None = Field(default=None, min_length=3, max_length=1500)
    current_phase: ForgePhase | None = None
    philosophical_anchor: dict[str, Any] | None = None
    research_context: dict[str, Any] | None = None
    taxonomies: dict[str, Any] | None = None
    geography: dict[str, Any] | None = None
    agents: list[dict[str, Any]] | None = None
    buildings: list[dict[str, Any]] | None = None
    ai_settings: dict[str, Any] | None = None
    generation_config: dict[str, Any] | None = None
    theme_config: dict[str, Any] | None = None
    status: ForgeStatus | None = None
    map_status: Literal["pending", "generating", "succeeded", "failed"] | None = None
    error_log: str | None = None


class ForgeDraft(ForgeDraftBase):
    """Full draft record from database."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    error_log: str | None = None
    created_at: datetime
    updated_at: datetime


class UserWallet(BaseModel):
    """User wallet/quota information.

    Carries no key material. It used to declare
    ``encrypted_openrouter_key`` / ``encrypted_replicate_key`` (finding 9),
    which meant any endpoint returning this model would have serialised the
    ciphertext outward — and since migration 333 the keys do not live here at
    all. What a caller may know about a key is whether one is on file, and
    ``BYOKStatus`` says that.
    """

    model_config = ConfigDict(from_attributes=True)

    user_id: UUID
    forge_tokens: int
    is_architect: bool
    created_at: datetime
    updated_at: datetime


#: An OpenRouter key is ~73 characters, a Replicate token ~40. The ceiling is
#: generous enough for either provider to change its format and low enough that
#: a paste accident or a hostile payload never reaches ``encrypt()`` or the
#: database (finding 9: there was no bound at all). The floor rejects the
#: fat-fingered fragment before it is stored as if it were a key.
_API_KEY_MIN = 8
_API_KEY_MAX = 512


class UpdateBYOKRequest(BaseModel):
    """Schema for users to securely store their own API keys."""

    openrouter_key: str | None = Field(None, min_length=_API_KEY_MIN, max_length=_API_KEY_MAX)
    replicate_key: str | None = Field(None, min_length=_API_KEY_MIN, max_length=_API_KEY_MAX)


class TestBYOKRequest(BaseModel):
    """Schema for testing a BYOK key against a provider."""

    provider: Literal["openrouter", "replicate"]
    key: str = Field(min_length=_API_KEY_MIN, max_length=_API_KEY_MAX)


class TestBYOKResult(BaseModel):
    """Result of a BYOK key test."""

    valid: bool
    detail: str
    response_ms: int = 0


class BYOKStatus(BaseModel):
    """BYOK status for a user — the shape ``fn_get_wallet_summary`` returns.

    Every key the RPC puts inside ``byok_status`` must be declared HERE.
    Pydantic v2 defaults to ``extra="ignore"``, so an undeclared field is
    dropped without a word: migration 333 added ``openrouter_verified_at`` /
    ``replicate_verified_at``, the frontend type declared them, the SQL
    returned them — and this model swallowed both, so the key card could only
    ever say "never confirmed". Bound by
    ``backend/tests/unit/test_byok_status_contract.py``.
    """

    has_openrouter_key: bool
    has_replicate_key: bool
    #: Last characters of the stored key, so a card can show an identity
    #: (``sk-or-v1-•••••7f3a``) instead of only "configured". Not a secret.
    openrouter_last4: str | None = None
    replicate_last4: str | None = None
    #: When the STORED key last went through at the provider. None = never
    #: checked, not invalid.
    openrouter_verified_at: datetime | None = None
    replicate_verified_at: datetime | None = None
    #: When the key was last handed out for a real call (stamped hourly).
    openrouter_last_used_at: datetime | None = None
    replicate_last_used_at: datetime | None = None
    byok_allowed: bool  # whether user is permitted to use BYOK at all
    byok_bypass: bool  # per-user bypass flag
    system_bypass_enabled: bool
    effective_bypass: bool
    access_policy: str = "per_user"  # "none", "all", "per_user"
    #: After this many days without a confirmation the card carries a notice.
    stale_after_days: int = 90
    #: Status of this account's latest access request, if it ever made one.
    request_status: Literal["pending", "approved", "rejected"] | None = None


class BYOKRequestCreate(BaseModel):
    """A person asking to be allowed a personal key."""

    reason: str | None = Field(None, max_length=1000)


class BYOKRequest(BaseModel):
    """One access request, as the admin inbox lists it."""

    model_config = ConfigDict(extra="allow")

    id: str
    user_id: str
    reason: str | None = None
    status: Literal["pending", "approved", "rejected"]
    created_at: datetime
    reviewed_at: datetime | None = None


class BYOKRecheckResult(BaseModel):
    """Answer of a re-check against the provider for the STORED key."""

    valid: bool
    detail: str
    response_ms: int = 0
    #: False when there was no stored key to check in the first place.
    had_key: bool = True


# ── Feature Purchase Models ──────────────────────────────────────────

FeatureType = Literal["darkroom_pass", "classified_dossier", "recruitment", "chronicle_export"]
FeaturePurchaseStatus = Literal["pending", "processing", "completed", "failed", "refunded"]


class FeaturePurchase(BaseModel):
    """Feature purchase record from database."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    simulation_id: UUID
    feature_type: FeatureType
    token_cost: int
    status: FeaturePurchaseStatus
    config: dict[str, Any] = Field(default_factory=dict)
    result: dict[str, Any] = Field(default_factory=dict)
    regen_budget_remaining: int = 0
    created_at: datetime
    completed_at: datetime | None = None


class RecruitmentRequest(BaseModel):
    """Request body for agent recruitment purchase."""

    focus: str | None = Field(None, max_length=200)
    zone_id: UUID | None = None


class ImageRegenRequest(BaseModel):
    """Request body for Darkroom image regeneration."""

    prompt_override: str | None = Field(None, max_length=500)


class PhilosophicalAnchor(BaseModel):
    """A proposed thematic anchor for a simulation."""

    title: str = Field(
        min_length=_MIN_TITLE,
        description=f"Name of the anchor, a short evocative phrase. {_IN_ENGLISH}",
    )
    title_de: str = Field(
        default="",
        min_length=_MIN_TITLE,
        description="German equivalent of title, written as if originally German.",
    )
    literary_influence: str = Field(
        min_length=_MIN_PHRASE,
        description=(f"The real author, work or school of thought this anchor grounds itself in. {_IN_ENGLISH}"),
    )
    literary_influence_de: str = Field(
        default="",
        min_length=_MIN_PHRASE,
        description="German equivalent of literary_influence -- use published German title if it exists.",
    )
    core_question: str = Field(
        min_length=_MIN_LINE,
        description=f"The single question the world exists to ask, phrased as a question. {_IN_ENGLISH}",
    )
    core_question_de: str = Field(
        default="",
        min_length=_MIN_LINE,
        description="German equivalent of core_question.",
    )
    bleed_signature_suggestion: str = Field(
        min_length=_MIN_LINE,
        description=(
            "Short sensory phrase naming how this world's bleed manifests "
            f"(e.g. 'fading ink on wet parchment'). {_IN_ENGLISH}"
        ),
    )
    description: str = Field(
        min_length=_MIN_ANCHOR_PROSE,
        description=f"What this world is and how the anchor shapes it. {_IN_ENGLISH}",
    )
    description_de: str = Field(
        default="",
        min_length=_MIN_ANCHOR_PROSE,
        description="German equivalent of description.",
    )


class ForgeAgentDraft(BaseModel):
    """Draft of an agent entity."""

    name: str = Field(
        min_length=1,
        max_length=100,
        description=f"The person's name. {_WORLD_TONGUE}",
    )
    gender: str = Field(
        min_length=1,
        max_length=30,
        description=(
            "Gender as a lowercase English descriptor -- 'male', 'female', 'non-binary' "
            "and the like. The set is open, the spelling is not: lowercase, hyphenated, "
            f"no capitals. {_IN_ENGLISH}"
        ),
    )
    system: str = Field(
        min_length=1,
        max_length=80,
        description=(
            "Short faction or organization name (1-5 words). "
            "Must be a concise identifier like 'Gildenrat' or 'Kanalgrund Widerstand', "
            f"NOT a full description or sentence. {_WORLD_TONGUE}"
        ),
    )
    primary_profession: str = Field(
        min_length=1,
        max_length=100,
        description=f"The person's occupation, as a short noun phrase. {_IN_ENGLISH}",
    )
    primary_profession_de: str = Field(
        min_length=1,
        max_length=100,
        description="German equivalent of primary_profession.",
    )
    character: str = Field(
        min_length=_MIN_LONG_PROSE,
        description=(
            "Personality portrait in 200-300 words. Include temperament, mannerisms, "
            "contradictions, one memorable quirk, and a brief physical impression "
            "(build, distinguishing feature, typical clothing) to aid later portrait generation. "
            f"{_IN_ENGLISH}"
        ),
    )
    character_de: str = Field(
        min_length=_MIN_LONG_PROSE,
        description="German equivalent of character.",
    )
    background: str = Field(
        min_length=_MIN_LONG_PROSE,
        description=(
            "Backstory in 200-300 words. Include origin, formative event, current motivation, "
            f"and a secret or unresolved tension. {_IN_ENGLISH}"
        ),
    )
    background_de: str = Field(
        min_length=_MIN_LONG_PROSE,
        description="German equivalent of background.",
    )


class ForgeBuildingDraft(BaseModel):
    """Draft of a building entity."""

    name: str = Field(
        min_length=1,
        max_length=100,
        description=f"The building's name. {_WORLD_TONGUE}",
    )
    building_type: str = Field(
        min_length=1,
        max_length=100,
        description=f"What kind of building this is, as a short noun. {_IN_ENGLISH}",
    )
    building_type_de: str = Field(
        min_length=1,
        max_length=100,
        description="German equivalent of building_type.",
    )
    description: str = Field(
        min_length=_MIN_LONG_PROSE,
        description=(
            "Atmospheric description in 150-250 words. Include architectural style, "
            "dominant materials (stone, iron, glass, wood), sensory details (sounds, smells, light), "
            "and what makes this place remarkable or unsettling. "
            f"These details will feed into image generation. {_IN_ENGLISH}"
        ),
    )
    description_de: str = Field(
        min_length=_MIN_LONG_PROSE,
        description="German equivalent of description.",
    )
    # NOT a Literal, deliberately, and not for lack of a vocabulary: every world
    # carries its OWN `building_condition` taxonomy in `simulation_taxonomies`
    # (thematic values like `sealed`, `anomalous`, `thriving`), and this generator
    # ignores it. Measured on production: 115 of 314 buildings hold a condition
    # their own simulation's taxonomy does not contain -- including all six
    # `pristine` and all four `ruined`. Freezing the platform's five words into the
    # type would cement the wrong vocabulary; the fix is to feed each world's own
    # values into the prompt, which is finding 30 and belongs to W4.
    #
    # `excellent`, not `pristine`: the platform prompt template has said `excellent`
    # since migration 027, this model said `pristine`, and the two disagreeing is
    # why six buildings in five worlds carry a value no taxonomy anywhere defines.
    building_condition: str = Field(
        default="good",
        min_length=1,
        max_length=40,
        description=(
            f"Physical condition: {', '.join(BUILDING_CONDITION_CORE[:-1])}, "
            f"or {BUILDING_CONDITION_CORE[-1]}. "
            "Vary across buildings in the set. "
            f"A 'ruined' building shows structural damage; 'poor' shows neglect and decay. {_IN_ENGLISH}"
        ),
    )
    building_condition_de: str = Field(
        min_length=1,
        max_length=40,
        description="German equivalent of building_condition.",
    )
    # WHY THE MODEL IS ASKED WHERE ITS OWN WORD SITS
    #
    # A world's condition vocabulary is DERIVED from what the model wrote
    # (`forge_taxonomies`, finding 30) — consistent by construction, because the
    # world's values ARE the ones its buildings carry. But a derivation yields a
    # SET, and decay needs a SEQUENCE: `fn_degrade_building` moves a building
    # DOWN a ladder, and a word with no place on it cannot move at all.
    #
    # Measured on production before migration 320: 17 buildings in 6 worlds
    # carried a word that sat on no rung, and they never decayed — sabotage and
    # crisis events passed them by. 320 placed the 13 words that existed then;
    # this field is what keeps the NEXT invented word from repeating it.
    #
    # Asking the same call that invents the word is the cheapest correct answer:
    # no second model call, no failure mode of its own, and the model already
    # knows what it meant. Nothing here can distort the platform's own scale —
    # `fn_materialize_shard` stores this number ONLY for a value the platform
    # rung map does not already know, so a draft that claims `good` sits at 45
    # is ignored rather than obeyed.
    condition_rung: int = Field(
        default=30,
        ge=1,
        le=59,
        description=(
            "Where this condition word sits on a decay ladder from 1 (untouched) "
            "to 59 (a ruin). Anchors: "
            + ", ".join(f"{w} {n}" for w, n in BUILDING_CONDITION_CORE_RUNGS.items())
            + ". A word of your own takes the number nearest its meaning, "
            "between the two anchors it belongs between. Decay moves a building "
            "to HIGHER numbers, so a word that sounds healthier than another "
            "must carry a lower number than it."
        ),
    )


class ForgeZoneDraft(BaseModel):
    """Draft of a single zone/district."""

    name: str = Field(
        min_length=1,
        description=f"The district's name. {_WORLD_TONGUE}",
    )
    zone_type: str = Field(
        min_length=1,
        description="Zone classification (e.g. residential, industrial,"
        f" cultural, commercial, government, military, slum, entertainment). {_IN_ENGLISH}",
    )
    zone_type_de: str = Field(
        default="",
        description="German equivalent of zone_type.",
    )
    description: str = Field(
        min_length=_MIN_SHORT_PROSE,
        description=f"1-2 sentence atmospheric description of the zone's character and purpose. {_IN_ENGLISH}",
    )
    description_de: str = Field(
        default="",
        description="German equivalent of description.",
    )
    # No `_de` twin exists for these tags, so the German UI shows the English
    # strings verbatim. Naming the language at least stops the model from
    # answering in whichever language the seed happened to be written in; the
    # missing translation is a surface question and belongs to W5.
    characteristics: list[str] = Field(
        description="2-4 evocative tags capturing the zone's essence"
        f" (e.g. 'perpetual twilight', 'echoing walls', 'overgrown machinery'). {_IN_ENGLISH}",
    )


class ForgeStreetDraft(BaseModel):
    """Draft of a single named street."""

    name: str = Field(
        min_length=1,
        description=f"The street's name. {_WORLD_TONGUE}",
    )
    zone_name: str = Field(
        min_length=1,
        description="Name of the zone this street belongs to. Must match one of the zone names "
        "exactly -- it is the join key, not a description.",
    )
    street_type: str = Field(
        min_length=1,
        description="Street classification (e.g. alley, boulevard, lane, avenue, road, street, "
        f"stairway). {_IN_ENGLISH}",
    )
    street_type_de: str = Field(
        default="",
        description="German equivalent of street_type.",
    )
    # Genuinely optional -- it defaults to empty and the map renders without it,
    # so no floor here: a floor would turn an omission into a hard failure.
    description: str = Field(
        default="",
        description=f"Optional 1-sentence atmospheric detail about this street. {_IN_ENGLISH}",
    )


class ForgeGeographyDraft(BaseModel):
    """Draft of city geography."""

    city_name: str = Field(
        min_length=1,
        description=f"The city's name. {_WORLD_TONGUE}",
    )
    zones: list[ForgeZoneDraft]
    streets: list[ForgeStreetDraft]


# ── Entity Translation Models ─────────────────────────────────────────


class ForgeAgentTranslation(BaseModel):
    """German translations for a single agent."""

    name: str  # used as key to match, not translated
    character_de: str = ""
    background_de: str = ""
    primary_profession_de: str = ""


class ForgeBuildingTranslation(BaseModel):
    """German translations for a single building."""

    name: str
    description_de: str = ""
    building_type_de: str = ""
    building_condition_de: str = ""


class ForgeZoneTranslation(BaseModel):
    """German translations for a single zone."""

    name: str
    description_de: str = ""
    zone_type_de: str = ""


class ForgeStreetTranslation(BaseModel):
    """German translations for a single street."""

    name: str
    street_type_de: str = ""


class ForgeSimulationTranslation(BaseModel):
    """German title and description for the simulation itself.

    ``name_de`` ist bewusst KEIN Widerspruch zur Regel „Eigennamen bleiben
    unübersetzt": diese Regel schützt Namen INNERHALB der Welt (Figuren,
    Gebäude, Zonen, Straßen). Der Titel der Welt selbst ist keiner davon — er
    ist ein Werktitel und wird lokalisiert wie einer.

    Belegt an den fünf Welten, die am 31.08.2026 bereits ein ``name_de``
    trugen; jemand hat sie von Hand gesetzt, und zwar als Titel, nicht als
    Rohübersetzung:

        The Time Bank of Momo        → Die Momo-Zeitbank
        The Metamorphosis of Memory  → Die Verwandlung der Erinnerung
        The Chitinous Mandate        → Das Chitinöse Mandat

    Die zweite Zeile trifft sogar den deutschen Kafka-Titel. Das ist die
    Messlatte für das Modell, nicht „Wort für Wort".

    Der Slug bleibt englisch — er ist eine Adresse, kein Text.
    """

    name_de: str = ""
    description_de: str = ""


class ForgeEntityTranslationOutput(BaseModel):
    """Complete entity translation batch for a simulation."""

    agents: list[ForgeAgentTranslation]
    buildings: list[ForgeBuildingTranslation]
    zones: list[ForgeZoneTranslation]
    streets: list[ForgeStreetTranslation]
    simulation: ForgeSimulationTranslation


# ── Response Models (Schritt 3) ──────────────────────────────────────


class WalletSummary(BaseModel):
    """Wallet summary returned by fn_get_wallet_summary RPC."""

    forge_tokens: int = 0
    is_architect: bool = False
    account_tier: str = "observer"
    byok_status: BYOKStatus


class IgnitionResponse(BaseModel):
    """Response from shard ignition (draft → simulation materialization)."""

    simulation_id: str
    slug: str | None = None
    name: str
    # Empty until migration 287 gave the materialization a German name to write,
    # and still empty for a world whose anchor carried no `title_de`. The
    # frontend's `t()` falls back to `name`, so an empty value renders the
    # English name rather than nothing — a missing translation is a visible gap.
    name_de: str = ""
    description: str
    description_de: str = ""
    anchor: dict[str, Any]
    seed_prompt: str


class PurchaseConfirmation(BaseModel):
    """Shared response for feature purchases (dossier, recruit, chronicle)."""

    purchase_id: str


class DarkroomPassResponse(BaseModel):
    """Response from darkroom pass purchase."""

    purchase_id: str
    regen_budget: int


class MissingImagesResponse(BaseModel):
    """Result of the repair run that fills only the images an earlier run missed."""

    queued: int
    message: str


class DarkroomRegenResponse(BaseModel):
    """Response from darkroom image regeneration."""

    remaining_regenerations: int
    entity_type: str
    entity_id: str


class DossierEvolveResponse(BaseModel):
    """Response from dossier section evolution."""

    status: str
    arcanum: str


class ForgeAdminStats(BaseModel):
    """Global forge statistics for admin dashboard."""

    active_drafts: int
    total_tokens: int
    total_materialized: int


class PurgeResult(BaseModel):
    """Result of stale draft purge operation."""

    deleted_count: int


class BYOKSystemSettings(BaseModel):
    """BYOK system-level settings (admin view)."""

    byok_bypass_enabled: bool | None = None
    byok_access_policy: str | None = None


class BYOKUserOverride(BaseModel):
    """Per-user BYOK override settings (admin operations)."""

    user_id: str
    byok_bypass: bool | None = None
    byok_allowed: bool | None = None


class ForgeProgressResponse(BaseModel):
    """Public forge-ceremony progress (``get_forge_progress(slug)`` PG function).

    ``agents``/``buildings``/``lore`` are lists of ``{name, image_url}``
    pairs assembled inside the function; ``done`` flips when every asset
    (including the banner) is generated.
    """

    total: int = 0
    completed: int = 0
    done: bool = False
    banner_url: str | None = None
    lore_progress: dict | None = None
    agents: list[dict] = Field(default_factory=list)
    buildings: list[dict] = Field(default_factory=list)
    lore: list[dict] = Field(default_factory=list)

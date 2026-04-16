"""API router for the Simulation Forge."""

import logging
import time
from datetime import UTC, datetime, timedelta
from typing import Annotated, Literal
from uuid import UUID

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field

from backend.dependencies import (
    get_admin_supabase,
    get_current_user,
    get_effective_supabase,
    require_architect,
    require_platform_admin,
)
from backend.middleware.rate_limit import RATE_LIMIT_AI_ENTITY, RATE_LIMIT_AI_GENERATION, RATE_LIMIT_STANDARD, limiter
from backend.models.common import CurrentUser, MessageResponse, PaginatedResponse, SuccessResponse
from backend.models.forge import (
    AdminBundleUpdate,
    AdminPurchaseLedgerEntry,
    AdminTokenGrant,
    BYOKSystemSettings,
    BYOKUserOverride,
    DarkroomPassResponse,
    DarkroomRegenResponse,
    DossierEvolveResponse,
    FeaturePurchase,
    ForgeAdminStats,
    ForgeDraft,
    ForgeDraftCreate,
    ForgeDraftUpdate,
    ForgeThemeOutput,
    IgnitionResponse,
    ImageRegenRequest,
    PurchaseConfirmation,
    PurchaseReceipt,
    PurchaseRequest,
    PurgeResult,
    RecruitmentRequest,
    TestBYOKRequest,
    TestBYOKResult,
    TokenBundle,
    TokenEconomyStats,
    TokenPurchaseHistory,
    UpdateBYOKRequest,
    WalletSummary,
)
from backend.services.ai_utils import safe_background
from backend.services.audit_service import AuditService
from backend.services.codex_export_service import CodexExportService
from backend.services.dossier_evolution_service import DossierEvolutionService
from backend.services.forge_draft_service import ForgeDraftService
from backend.services.forge_feature_service import ForgeFeatureService
from backend.services.forge_lore_service import ForgeLoreService
from backend.services.forge_orchestrator_service import ForgeOrchestratorService
from backend.services.forge_theme_service import ForgeThemeService
from backend.services.simulation_service import SimulationService
from backend.utils.responses import paginated

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/forge", tags=["forge"])

_draft_service = ForgeDraftService()
_orchestrator_service = ForgeOrchestratorService()


@router.get("/drafts")
async def list_drafts(
    user: Annotated[CurrentUser, Depends(require_architect())],
    supabase=Depends(get_effective_supabase),
    limit: Annotated[int, Query(ge=1, le=50)] = 10,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PaginatedResponse[ForgeDraft]:
    """List simulation forge drafts for the current user."""
    data, total = await _draft_service.list_drafts(supabase, user.id, limit, offset)
    return paginated(data, total, limit, offset)


@router.post("/drafts")
@limiter.limit(RATE_LIMIT_STANDARD)
async def create_draft(
    request: Request,
    body: ForgeDraftCreate,
    user: Annotated[CurrentUser, Depends(require_architect())],
    supabase=Depends(get_effective_supabase),
) -> SuccessResponse[ForgeDraft]:
    """Initialize a new worldbuilding draft."""
    draft = await _draft_service.create_draft(supabase, user.id, body)
    await AuditService.safe_log(
        supabase,
        None,
        user.id,
        "forge_draft",
        draft.get("id"),
        "create",
        {"seed_prompt": body.seed_prompt[:100]},
    )
    return SuccessResponse(data=draft)


@router.get("/drafts/{draft_id}")
async def get_draft(
    draft_id: UUID,
    user: Annotated[CurrentUser, Depends(require_architect())],
    supabase=Depends(get_effective_supabase),
) -> SuccessResponse[ForgeDraft]:
    """Get draft details."""
    draft = await _draft_service.get_draft(supabase, user.id, draft_id)
    return SuccessResponse(data=draft)


@router.patch("/drafts/{draft_id}")
@limiter.limit(RATE_LIMIT_STANDARD)
async def update_draft(
    request: Request,
    draft_id: UUID,
    body: ForgeDraftUpdate,
    user: Annotated[CurrentUser, Depends(require_architect())],
    supabase=Depends(get_effective_supabase),
) -> SuccessResponse[ForgeDraft]:
    """Update draft state."""
    # Validate business rules (phase transitions + status guards)
    if body.current_phase is not None:
        current = await _draft_service.get_draft(supabase, user.id, draft_id)
        current_phase = current.get("current_phase", "astrolabe")
    else:
        current_phase = "astrolabe"
    _draft_service.validate_draft_update(body, current_phase=current_phase)

    draft = await _draft_service.update_draft(supabase, user.id, draft_id, body)
    await AuditService.safe_log(
        supabase,
        None,
        user.id,
        "forge_draft",
        str(draft_id),
        "update",
        {"fields": [k for k, v in body.model_dump(exclude_none=True).items()]},
    )
    return SuccessResponse(data=draft)


@router.delete("/drafts/{draft_id}")
async def delete_draft(
    draft_id: UUID,
    user: Annotated[CurrentUser, Depends(require_architect())],
    supabase=Depends(get_effective_supabase),
) -> SuccessResponse[MessageResponse]:
    """Delete a draft."""
    await _draft_service.delete_draft(supabase, user.id, draft_id)
    await AuditService.safe_log(
        supabase,
        None,
        user.id,
        "forge_draft",
        str(draft_id),
        "delete",
    )
    return SuccessResponse(data=MessageResponse(message="Draft deleted."))


@router.post("/drafts/{draft_id}/research")
@limiter.limit(RATE_LIMIT_AI_GENERATION)
async def run_research(
    request: Request,
    draft_id: UUID,
    user: Annotated[CurrentUser, Depends(require_architect())],
    supabase=Depends(get_effective_supabase),
) -> SuccessResponse[dict]:  # ASSESS: polymorphic AI research output
    """Trigger the Astrolabe AI research phase."""
    result = await _orchestrator_service.run_astrolabe_research(supabase, user.id, draft_id)
    await AuditService.safe_log(
        supabase,
        None,
        user.id,
        "forge_draft",
        str(draft_id),
        "research",
    )
    return SuccessResponse(data=result)


@router.post("/drafts/{draft_id}/generate/{chunk_type}")
@limiter.limit(RATE_LIMIT_AI_GENERATION)
async def generate_chunk(
    request: Request,
    draft_id: UUID,
    chunk_type: Literal["geography", "agents", "buildings"],
    user: Annotated[CurrentUser, Depends(require_architect())],
    supabase=Depends(get_effective_supabase),
) -> SuccessResponse[dict]:  # ASSESS: polymorphic AI chunk output
    """Trigger generation of a specific lore chunk (agents, buildings, etc)."""
    result = await _orchestrator_service.generate_blueprint_chunk(supabase, user.id, draft_id, chunk_type)
    await AuditService.safe_log(
        supabase,
        None,
        user.id,
        "forge_draft",
        str(draft_id),
        "generate",
        {"chunk_type": chunk_type},
    )
    return SuccessResponse(data=result)


@router.post("/drafts/{draft_id}/generate-entity/{entity_type}")
@limiter.limit(RATE_LIMIT_AI_ENTITY)
async def generate_single_entity(
    request: Request,
    draft_id: UUID,
    entity_type: Literal["agents", "buildings"],
    entity_index: Annotated[int, Query(ge=0, le=11)],
    entity_total: Annotated[int, Query(ge=3, le=12)],
    user: Annotated[CurrentUser, Depends(require_architect())],
    supabase=Depends(get_effective_supabase),
) -> SuccessResponse[dict]:  # ASSESS: polymorphic AI entity output
    """Generate a single agent or building entity (per-entity loop)."""
    result = await _orchestrator_service.generate_single_entity(
        supabase, user.id, draft_id, entity_type, entity_index, entity_total
    )
    await AuditService.safe_log(
        supabase,
        None,
        user.id,
        "forge_draft",
        str(draft_id),
        "generate_entity",
        {"entity_type": entity_type, "entity_index": entity_index, "entity_total": entity_total},
    )
    return SuccessResponse(data=result)


@router.post("/drafts/{draft_id}/generate-theme")
@limiter.limit(RATE_LIMIT_AI_GENERATION)
async def generate_theme(
    request: Request,
    draft_id: UUID,
    user: Annotated[CurrentUser, Depends(require_architect())],
    supabase=Depends(get_effective_supabase),
) -> SuccessResponse[ForgeThemeOutput]:
    """Generate an AI theme for a draft (Darkroom phase)."""
    theme_data = await _orchestrator_service.generate_theme_for_draft(supabase, user.id, draft_id)
    await AuditService.safe_log(
        supabase,
        None,
        user.id,
        "forge_draft",
        str(draft_id),
        "generate_theme",
    )
    return SuccessResponse(data=theme_data)


@router.post("/drafts/{draft_id}/ignite")
@limiter.limit(RATE_LIMIT_AI_GENERATION)
async def ignite_shard(
    request: Request,
    draft_id: UUID,
    background_tasks: BackgroundTasks,
    user: Annotated[CurrentUser, Depends(require_architect())],
    supabase=Depends(get_effective_supabase),
    admin_supabase=Depends(get_admin_supabase),
) -> SuccessResponse[IgnitionResponse]:
    """Finalize the draft and materialize the simulation."""
    result = await _orchestrator_service.materialize_shard(supabase, user.id, draft_id, admin_supabase)

    sim_id = result.get("simulation_id")
    await AuditService.safe_log(
        supabase,
        sim_id,
        user.id,
        "forge_draft",
        str(draft_id),
        "ignite",
        {"simulation_id": str(sim_id)} if sim_id else None,
    )

    # Background: lore generation + translations + image generation
    # Uses admin client (user JWT may expire during long-running tasks)
    if sim_id:
        background_tasks.add_task(
            safe_background(_orchestrator_service.run_batch_generation),
            admin_supabase,
            sim_id,
            user.id,
            anchor_data=result.get("anchor"),
            draft_data=result.get("draft_data"),
        )

    # Strip internal fields from the client response
    response_data = {k: v for k, v in result.items() if k != "draft_data"}
    return SuccessResponse(data=response_data)


@router.get("/bundles")
async def list_token_bundles(
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase=Depends(get_effective_supabase),
) -> SuccessResponse[list[TokenBundle]]:
    """List active token bundles (product catalog)."""
    bundles = await _draft_service.list_bundles(supabase)
    return SuccessResponse(data=bundles)


@router.get("/wallet")
async def get_wallet(
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase=Depends(get_effective_supabase),
) -> SuccessResponse[WalletSummary]:
    """Get the current user's forge wallet."""
    data = await _draft_service.get_wallet(supabase, user.id)
    return SuccessResponse(data=data)


@router.post("/wallet/purchase")
@limiter.limit(RATE_LIMIT_STANDARD)
async def purchase_tokens(
    request: Request,
    body: PurchaseRequest,
    user: Annotated[CurrentUser, Depends(require_architect())],
    supabase=Depends(get_effective_supabase),
) -> SuccessResponse[PurchaseReceipt]:
    """Mock-purchase a token bundle. Grants tokens immediately."""
    receipt = await _draft_service.purchase_tokens(supabase, body.bundle_slug)
    await AuditService.safe_log(
        supabase,
        None,
        user.id,
        "forge_wallet",
        str(user.id),
        "purchase",
        {"bundle": body.bundle_slug, "tokens": receipt.get("tokens_granted")},
    )
    return SuccessResponse(data=receipt)


@router.get("/wallet/history")
async def get_purchase_history(
    user: Annotated[CurrentUser, Depends(require_architect())],
    supabase=Depends(get_effective_supabase),
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PaginatedResponse[TokenPurchaseHistory]:
    """Get the current user's token purchase history."""
    data, total = await _draft_service.get_purchase_history(
        supabase,
        user.id,
        limit,
        offset,
    )
    return paginated(data, total, limit, offset)


@router.put("/wallet/keys")
@limiter.limit(RATE_LIMIT_STANDARD)
async def update_byok(
    request: Request,
    body: UpdateBYOKRequest,
    user: Annotated[CurrentUser, Depends(require_architect())],
    supabase=Depends(get_effective_supabase),
) -> SuccessResponse[MessageResponse]:
    """Update personal API keys (BYOK) for the Simulation Forge."""
    # Check if user is allowed to use BYOK
    try:
        allowed = await ForgeDraftService.check_byok_allowed(supabase, user.id)
        if not allowed:
            raise HTTPException(
                status_code=403,
                detail="BYOK access not granted. Contact your platform administrator.",
            )
    except HTTPException:
        raise
    except Exception:
        logger.exception("BYOK allowance check failed — denying access")
        raise HTTPException(
            status_code=500,
            detail="Unable to verify BYOK access. Please try again later.",
        ) from None

    result = await _draft_service.update_user_keys(supabase, user.id, body.openrouter_key, body.replicate_key)
    await AuditService.safe_log(
        supabase,
        None,
        user.id,
        "forge_wallet",
        str(user.id),
        "update_keys",
        {"openrouter": body.openrouter_key is not None, "replicate": body.replicate_key is not None},
    )
    return SuccessResponse(data=result)


@router.delete("/wallet/keys/{provider}")
@limiter.limit(RATE_LIMIT_STANDARD)
async def delete_byok_key(
    request: Request,
    provider: str,
    user: Annotated[CurrentUser, Depends(require_architect())],
    supabase=Depends(get_effective_supabase),
) -> SuccessResponse[MessageResponse]:
    """Remove a single BYOK API key (openrouter or replicate)."""
    if provider not in ("openrouter", "replicate"):
        raise HTTPException(status_code=400, detail=f"Unknown provider: {provider}. Use 'openrouter' or 'replicate'.")

    try:
        allowed = await ForgeDraftService.check_byok_allowed(supabase, user.id)
        if not allowed:
            raise HTTPException(status_code=403, detail="BYOK access not granted.")
    except HTTPException:
        raise
    except Exception:
        logger.exception("BYOK allowance check failed — denying access")
        raise HTTPException(status_code=500, detail="Unable to verify BYOK access.") from None

    result = await _draft_service.clear_user_key(supabase, user.id, provider)
    await AuditService.safe_log(
        supabase,
        None,
        user.id,
        "forge_wallet",
        str(user.id),
        "delete_key",
        {"provider": provider},
    )
    return SuccessResponse(data=result)


@router.post("/wallet/keys/test")
@limiter.limit(RATE_LIMIT_STANDARD)
async def test_byok_key(
    request: Request,
    body: TestBYOKRequest,
    user: Annotated[CurrentUser, Depends(require_architect())],
) -> SuccessResponse[TestBYOKResult]:
    """Test a BYOK API key against its provider without storing it.

    Makes a lightweight API call to verify the key is valid:
    - OpenRouter: GET /api/v1/models (model list)
    - Replicate: GET /v1/account (account info)
    """
    provider_urls = {
        "openrouter": "https://openrouter.ai/api/v1/models",
        "replicate": "https://api.replicate.com/v1/account",
    }
    url = provider_urls[body.provider]

    start = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers={"Authorization": f"Bearer {body.key}"})
        elapsed_ms = int((time.monotonic() - start) * 1000)

        if resp.status_code == 200:
            result = TestBYOKResult(valid=True, detail="Key verified successfully.", response_ms=elapsed_ms)
        elif resp.status_code == 401:
            result = TestBYOKResult(valid=False, detail="Invalid or expired API key.", response_ms=elapsed_ms)
        elif resp.status_code == 403:
            result = TestBYOKResult(valid=False, detail="Key lacks required permissions.", response_ms=elapsed_ms)
        else:
            result = TestBYOKResult(
                valid=False,
                detail=f"Provider returned status {resp.status_code}.",
                response_ms=elapsed_ms,
            )
    except httpx.TimeoutException:
        result = TestBYOKResult(valid=False, detail="Provider did not respond within 10 seconds.")
    except httpx.ConnectError:
        result = TestBYOKResult(valid=False, detail="Could not connect to provider.")
    except Exception:
        logger.exception("Unexpected error testing BYOK key for provider=%s", body.provider)
        result = TestBYOKResult(valid=False, detail="Unexpected error during key verification.")

    return SuccessResponse(data=result)


# --- Feature Purchases ---


@router.get(
    "/simulations/{simulation_id}/features",
)
async def list_feature_purchases(
    simulation_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase=Depends(get_effective_supabase),
    feature_type: Annotated[str | None, Query()] = None,
) -> SuccessResponse[list[FeaturePurchase]]:
    """List feature purchases for a simulation (own purchases only via RLS)."""
    purchases = await ForgeFeatureService.list_purchases(
        supabase,
        simulation_id,
        user.id,
        feature_type,
    )
    return SuccessResponse(data=purchases)


@router.post(
    "/simulations/{simulation_id}/darkroom",
)
@limiter.limit(RATE_LIMIT_AI_GENERATION)
async def purchase_darkroom_pass(
    request: Request,
    simulation_id: UUID,
    background_tasks: BackgroundTasks,
    user: Annotated[CurrentUser, Depends(require_architect())],
    supabase=Depends(get_effective_supabase),
    admin_supabase=Depends(get_admin_supabase),
) -> SuccessResponse[DarkroomPassResponse]:
    """Purchase Darkroom Pass: 3 theme variants + 10 image regenerations."""
    purchase_id = await ForgeFeatureService.purchase_feature(
        supabase,
        user.id,
        simulation_id,
        "darkroom_pass",
        config={"regen_budget": 10},
    )
    await AuditService.safe_log(
        supabase,
        str(simulation_id),
        user.id,
        "feature_purchase",
        purchase_id,
        "darkroom_pass",
    )

    # Generate 3 theme variants in background
    background_tasks.add_task(
        safe_background(ForgeThemeService.generate_variants),
        admin_supabase,
        simulation_id,
        user.id,
        purchase_id,
    )

    return SuccessResponse(data=DarkroomPassResponse(purchase_id=purchase_id, regen_budget=10))


@router.post(
    "/simulations/{simulation_id}/darkroom/regenerate/{entity_type}/{entity_id}",
)
@limiter.limit(RATE_LIMIT_AI_GENERATION)
async def darkroom_regenerate_image(
    request: Request,
    simulation_id: UUID,
    entity_type: Literal["agent", "building", "lore"],
    entity_id: UUID,
    body: ImageRegenRequest,
    background_tasks: BackgroundTasks,
    user: Annotated[CurrentUser, Depends(require_architect())],
    supabase=Depends(get_effective_supabase),
    admin_supabase=Depends(get_admin_supabase),
) -> SuccessResponse[DarkroomRegenResponse]:
    """Regenerate a single entity image using Darkroom budget."""
    # Find active darkroom pass
    darkroom = await ForgeFeatureService.get_active_darkroom(
        supabase,
        simulation_id,
        user.id,
    )
    if not darkroom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active Darkroom pass for this simulation.",
        )

    if darkroom["regen_budget_remaining"] <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Darkroom regeneration budget exhausted.",
        )

    # Decrement budget atomically
    remaining = await ForgeFeatureService.use_darkroom_regen(
        supabase,
        darkroom["id"],
    )

    await AuditService.safe_log(
        supabase,
        str(simulation_id),
        user.id,
        "feature_purchase",
        darkroom["id"],
        "darkroom_regen",
        {"entity_type": entity_type, "entity_id": str(entity_id)},
    )

    # Queue image regeneration in background
    background_tasks.add_task(
        safe_background(_orchestrator_service.regenerate_single_image),
        admin_supabase,
        simulation_id,
        entity_type,
        entity_id,
        body.prompt_override,
        user.id,
    )

    return SuccessResponse(
        data=DarkroomRegenResponse(
            remaining_regenerations=remaining,
            entity_type=entity_type,
            entity_id=str(entity_id),
        )
    )


@router.post(
    "/simulations/{simulation_id}/dossier",
)
@limiter.limit(RATE_LIMIT_AI_GENERATION)
async def purchase_classified_dossier(
    request: Request,
    simulation_id: UUID,
    background_tasks: BackgroundTasks,
    user: Annotated[CurrentUser, Depends(require_architect())],
    supabase=Depends(get_effective_supabase),
    admin_supabase=Depends(get_admin_supabase),
) -> SuccessResponse[PurchaseConfirmation]:
    """Purchase Classified Dossier: 6-section deep lore expansion."""
    purchase_id = await ForgeFeatureService.purchase_feature(
        supabase,
        user.id,
        simulation_id,
        "classified_dossier",
    )
    await AuditService.safe_log(
        supabase,
        str(simulation_id),
        user.id,
        "feature_purchase",
        purchase_id,
        "classified_dossier",
    )

    # Get user's BYOK key if available
    or_key, _ = await ForgeDraftService.get_user_keys(supabase, user.id)

    background_tasks.add_task(
        safe_background(ForgeLoreService.generate_dossier),
        admin_supabase,
        simulation_id,
        user.id,
        purchase_id,
        or_key,
    )

    return SuccessResponse(data=PurchaseConfirmation(purchase_id=purchase_id))


@router.post(
    "/simulations/{simulation_id}/dossier/evolve",
)
@limiter.limit(RATE_LIMIT_AI_GENERATION)
async def evolve_dossier_section(
    request: Request,
    simulation_id: UUID,
    background_tasks: BackgroundTasks,
    arcanum: Annotated[str, Query(description="Section arcanum: BETA, GAMMA, DELTA, or ZETA")],
    trigger: Annotated[
        str, Query(description="Evolution trigger: agent_recruited, building_constructed, resonance_event, periodic")
    ],
    entity_name: Annotated[str, Query(description="Name of new entity/event")],
    user: Annotated[CurrentUser, Depends(require_architect())],
    admin_supabase=Depends(get_admin_supabase),
    entity_detail: Annotated[str, Query(description="Additional context")] = "",
) -> SuccessResponse[DossierEvolveResponse]:
    """Evolve a classified dossier section with new content."""
    valid_arcanums = {"BETA", "GAMMA", "DELTA", "ZETA"}
    if arcanum not in valid_arcanums:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid arcanum. Must be one of: {', '.join(valid_arcanums)}",
        )

    # Get user's BYOK key if available
    or_key = None
    try:
        or_key, _ = await ForgeDraftService.get_user_keys(
            admin_supabase,
            user.id,
        )
    except Exception:
        logger.debug("Optional BYOK key retrieval failed, continuing without", exc_info=True)

    background_tasks.add_task(
        safe_background(DossierEvolutionService.evolve_section),
        admin_supabase,
        simulation_id,
        arcanum,
        trigger,
        entity_name,
        entity_detail,
        or_key,
    )

    return SuccessResponse(data=DossierEvolveResponse(status="evolving", arcanum=arcanum))


@router.post(
    "/simulations/{simulation_id}/recruit",
)
@limiter.limit(RATE_LIMIT_AI_GENERATION)
async def purchase_recruitment(
    request: Request,
    simulation_id: UUID,
    body: RecruitmentRequest,
    background_tasks: BackgroundTasks,
    user: Annotated[CurrentUser, Depends(require_architect())],
    supabase=Depends(get_effective_supabase),
    admin_supabase=Depends(get_admin_supabase),
) -> SuccessResponse[PurchaseConfirmation]:
    """Purchase Recruitment: 3 new agents with full integration."""
    purchase_id = await ForgeFeatureService.purchase_feature(
        supabase,
        user.id,
        simulation_id,
        "recruitment",
        config={
            "focus": body.focus,
            "zone_id": str(body.zone_id) if body.zone_id else None,
        },
    )
    await AuditService.safe_log(
        supabase,
        str(simulation_id),
        user.id,
        "feature_purchase",
        purchase_id,
        "recruitment",
    )

    or_key, rep_key = await ForgeDraftService.get_user_keys(supabase, user.id)

    background_tasks.add_task(
        safe_background(_orchestrator_service.recruit_agents),
        admin_supabase,
        simulation_id,
        user.id,
        purchase_id,
        body.focus,
        body.zone_id,
        or_key,
        rep_key,
    )

    return SuccessResponse(data=PurchaseConfirmation(purchase_id=purchase_id))


@router.post(
    "/simulations/{simulation_id}/chronicle",
)
@limiter.limit(RATE_LIMIT_STANDARD)
async def purchase_chronicle_export(
    request: Request,
    simulation_id: UUID,
    background_tasks: BackgroundTasks,
    user: Annotated[CurrentUser, Depends(require_architect())],
    supabase=Depends(get_effective_supabase),
    admin_supabase=Depends(get_admin_supabase),
) -> SuccessResponse[PurchaseConfirmation]:
    """Purchase Chronicle: PDF codex export."""
    purchase_id = await ForgeFeatureService.purchase_feature(
        supabase,
        user.id,
        simulation_id,
        "chronicle_export",
        config={"export_type": "codex"},
    )
    await AuditService.safe_log(
        supabase,
        str(simulation_id),
        user.id,
        "feature_purchase",
        purchase_id,
        "chronicle_export",
    )

    background_tasks.add_task(
        safe_background(CodexExportService.generate_codex_pdf),
        admin_supabase,
        simulation_id,
        user.id,
        purchase_id,
    )

    return SuccessResponse(data=PurchaseConfirmation(purchase_id=purchase_id))


@router.post(
    "/simulations/{simulation_id}/chronicle/hires",
)
@limiter.limit(RATE_LIMIT_STANDARD)
async def purchase_hires_archive(
    request: Request,
    simulation_id: UUID,
    background_tasks: BackgroundTasks,
    user: Annotated[CurrentUser, Depends(require_architect())],
    supabase=Depends(get_effective_supabase),
    admin_supabase=Depends(get_admin_supabase),
) -> SuccessResponse[PurchaseConfirmation]:
    """Purchase Full-Res Archive: ZIP of all simulation images at native resolution."""
    purchase_id = await ForgeFeatureService.purchase_feature(
        supabase,
        user.id,
        simulation_id,
        "chronicle_export",
        config={"export_type": "hires"},
    )
    await AuditService.safe_log(
        supabase,
        str(simulation_id),
        user.id,
        "feature_purchase",
        purchase_id,
        "chronicle_export_hires",
    )

    background_tasks.add_task(
        safe_background(CodexExportService.generate_hires_archive),
        admin_supabase,
        simulation_id,
        user.id,
        purchase_id,
    )

    return SuccessResponse(data=PurchaseConfirmation(purchase_id=purchase_id))


@router.get(
    "/features/{purchase_id}",
)
async def get_feature_purchase(
    purchase_id: str,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase=Depends(get_effective_supabase),
) -> SuccessResponse[FeaturePurchase]:
    """Get feature purchase status (for polling during generation)."""
    purchase = await ForgeFeatureService.get_purchase(supabase, purchase_id)
    if not purchase:
        raise HTTPException(status_code=404, detail="Feature purchase not found.")
    return SuccessResponse(data=purchase)


# --- Admin Endpoints ---


@router.get("/admin/stats")
async def get_forge_stats(
    _admin: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase=Depends(get_admin_supabase),
) -> SuccessResponse[ForgeAdminStats]:
    """Get global forge statistics (admin only)."""
    data = await _draft_service.get_admin_stats(admin_supabase)
    return SuccessResponse(data=data)


@router.delete("/admin/purge")
async def purge_stale_drafts(
    _admin: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase=Depends(get_admin_supabase),
    days: Annotated[int, Query(ge=1, le=365)] = 30,
) -> SuccessResponse[PurgeResult]:
    """Purge stale drafts older than N days (admin only)."""
    cutoff = (datetime.now(tz=UTC) - timedelta(days=days)).isoformat()
    deleted_count = await _draft_service.purge_stale_drafts(admin_supabase, cutoff)
    logger.info("Purged stale forge drafts", extra={"deleted_count": deleted_count, "min_age_days": days})
    await AuditService.safe_log(
        admin_supabase,
        None,
        _admin.id,
        "forge_draft",
        None,
        "purge",
        {"days": days, "deleted_count": deleted_count},
    )
    return SuccessResponse(data=PurgeResult(deleted_count=deleted_count))


@router.get("/admin/economy")
async def get_token_economy_stats(
    _admin: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase=Depends(get_admin_supabase),
) -> SuccessResponse[TokenEconomyStats]:
    """Aggregated token economy stats (admin only)."""
    data = await ForgeDraftService.get_token_economy_stats(admin_supabase)
    return SuccessResponse(data=data)


@router.get("/admin/bundles")
async def admin_list_bundles(
    _admin: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase=Depends(get_admin_supabase),
) -> SuccessResponse[list[TokenBundle]]:
    """List ALL bundles including inactive (admin only)."""
    bundles = await ForgeDraftService.admin_list_all_bundles(admin_supabase)
    return SuccessResponse(data=bundles)


@router.put("/admin/bundles/{bundle_id}")
async def update_bundle(
    bundle_id: UUID,
    body: AdminBundleUpdate,
    admin: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase=Depends(get_admin_supabase),
) -> SuccessResponse[TokenBundle]:
    """Update bundle pricing/availability (admin only)."""
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=422, detail="No fields to update")
    data = await ForgeDraftService.admin_update_bundle(admin_supabase, bundle_id, updates)
    await AuditService.safe_log(
        admin_supabase,
        None,
        admin.id,
        "token_bundles",
        bundle_id,
        "update",
        details=updates,
    )
    return SuccessResponse(data=data)


@router.get("/admin/purchases")
async def admin_list_purchases(
    _admin: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase=Depends(get_admin_supabase),
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    payment_method: Annotated[str | None, Query()] = None,
) -> PaginatedResponse[AdminPurchaseLedgerEntry]:
    """Global purchase ledger (admin only)."""
    data, total = await ForgeDraftService.admin_list_purchases(
        admin_supabase,
        limit,
        offset,
        payment_method,
    )
    return paginated(data, total, limit, offset)


@router.post("/admin/grant")
async def admin_grant_tokens(
    body: AdminTokenGrant,
    admin: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase=Depends(get_admin_supabase),
) -> SuccessResponse[PurchaseReceipt]:
    """Grant tokens to a user (admin only). Creates auditable ledger entry."""
    receipt = await ForgeDraftService.admin_grant_tokens(
        admin_supabase,
        body.user_id,
        body.tokens,
        body.reason,
    )
    await AuditService.safe_log(
        admin_supabase,
        None,
        admin.id,
        "forge_wallet",
        body.user_id,
        "admin_grant",
        details={"tokens": body.tokens, "reason": body.reason},
    )
    return SuccessResponse(data=receipt)


@router.get("/admin/byok-setting")
async def get_byok_system_setting(
    _admin: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase=Depends(get_admin_supabase),
) -> SuccessResponse[BYOKSystemSettings]:
    """Get all BYOK-related platform settings (admin only)."""
    result = await ForgeDraftService.get_byok_system_settings(admin_supabase)
    return SuccessResponse(data=result)


@router.put("/admin/byok-setting")
async def update_byok_system_setting(
    enabled: Annotated[bool, Query()],
    admin: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase=Depends(get_admin_supabase),
) -> SuccessResponse[BYOKSystemSettings]:
    """Toggle system-wide BYOK bypass (admin only)."""
    result = await ForgeDraftService.update_byok_bypass_setting(admin_supabase, enabled, admin.id)
    await AuditService.safe_log(
        admin_supabase,
        None,
        admin.id,
        "platform_settings",
        None,
        "update_byok_bypass",
        {"enabled": enabled},
    )
    return SuccessResponse(data=result)


@router.put("/admin/byok-access-policy")
async def update_byok_access_policy(
    policy: Annotated[str, Query(pattern="^(none|all|per_user)$")],
    admin: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase=Depends(get_admin_supabase),
) -> SuccessResponse[BYOKSystemSettings]:
    """Set global BYOK access policy: 'none', 'all', or 'per_user' (admin only)."""
    result = await ForgeDraftService.update_byok_access_policy(admin_supabase, policy, admin.id)
    await AuditService.safe_log(
        admin_supabase,
        None,
        admin.id,
        "platform_settings",
        None,
        "update_byok_access_policy",
        {"policy": policy},
    )
    return SuccessResponse(data=result)


@router.put("/admin/user-byok-bypass/{target_user_id}")
async def update_user_byok_bypass(
    target_user_id: UUID,
    enabled: Annotated[bool, Query()],
    admin: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase=Depends(get_admin_supabase),
) -> SuccessResponse[BYOKUserOverride]:
    """Toggle per-user BYOK bypass (admin only)."""
    result = await ForgeDraftService.update_user_byok_bypass(admin_supabase, target_user_id, enabled)
    await AuditService.safe_log(
        admin_supabase,
        None,
        admin.id,
        "user_wallets",
        str(target_user_id),
        "update_byok_bypass",
        {"enabled": enabled},
    )
    return SuccessResponse(data=result)


@router.put("/admin/user-byok-allowed/{target_user_id}")
async def update_user_byok_allowed(
    target_user_id: UUID,
    enabled: Annotated[bool, Query()],
    admin: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase=Depends(get_admin_supabase),
) -> SuccessResponse[BYOKUserOverride]:
    """Grant or revoke BYOK access for a specific user (admin only)."""
    result = await ForgeDraftService.update_user_byok_allowed(admin_supabase, target_user_id, enabled)
    await AuditService.safe_log(
        admin_supabase,
        None,
        admin.id,
        "user_wallets",
        str(target_user_id),
        "update_byok_allowed",
        {"enabled": enabled},
    )
    return SuccessResponse(data=result)


class RegenerateImagesRequest(BaseModel):
    """Optional filter for batch image regeneration."""

    entity_types: list[str] | None = Field(
        None,
        description="Filter to specific types: 'banner', 'agent', 'building', 'lore'. Omit for all.",
    )


@router.post("/admin/regenerate-images/{simulation_id}")
@limiter.limit(RATE_LIMIT_AI_GENERATION)
async def regenerate_images(
    request: Request,
    simulation_id: UUID,
    background_tasks: BackgroundTasks,
    admin: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase=Depends(get_admin_supabase),
    body: RegenerateImagesRequest | None = None,
) -> SuccessResponse[MessageResponse]:
    """Trigger batch image generation for an existing simulation (admin only).

    Optionally filter to specific entity types (e.g. {"entity_types": ["lore"]}).
    """
    # Verify simulation exists (raises 404 if not found)
    sim = await SimulationService.check_exists(admin_supabase, simulation_id)

    entity_types = set(body.entity_types) if body and body.entity_types else None

    background_tasks.add_task(
        safe_background(_orchestrator_service.run_batch_generation),
        admin_supabase,
        simulation_id,
        admin.id,
        entity_types=entity_types,
    )

    types_str = ", ".join(sorted(entity_types)) if entity_types else "all"
    await AuditService.safe_log(
        admin_supabase,
        str(simulation_id),
        admin.id,
        "simulation",
        str(simulation_id),
        "regenerate_images",
        {"simulation_name": sim["name"], "entity_types": types_str},
    )

    return SuccessResponse(data=MessageResponse(message=f"Image generation ({types_str}) started for '{sim['name']}'."))


class RetriggerBatchRequest(BaseModel):
    """Request body for admin batch retrigger."""

    include_lore: bool = Field(
        True,
        description="If true, re-run lore + translations before images.",
    )
    entity_types: list[str] | None = Field(
        None,
        description="Filter image types: 'banner', 'agent', 'building', 'lore'. Omit for all.",
    )


@router.post("/admin/retrigger-batch/{simulation_id}")
@limiter.limit(RATE_LIMIT_AI_GENERATION)
async def retrigger_batch(
    request: Request,
    simulation_id: UUID,
    background_tasks: BackgroundTasks,
    admin: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase=Depends(get_admin_supabase),
    body: RetriggerBatchRequest | None = None,
) -> SuccessResponse[MessageResponse]:
    """Re-run batch generation (lore + images) for an existing simulation (admin only).

    Unlike regenerate-images, this can also re-run the full Phase A
    (research → lore → translations) by reconstructing draft_data from
    the materialized tables.
    """
    sim = await SimulationService.check_exists(admin_supabase, simulation_id)
    include_lore = body.include_lore if body else True
    entity_types = set(body.entity_types) if body and body.entity_types else None

    draft_data = None
    if include_lore:
        draft_data = await ForgeOrchestratorService.reconstruct_draft_data(
            admin_supabase,
            simulation_id,
        )
        # Delete existing lore to avoid duplicates on re-generation
        await ForgeOrchestratorService.delete_simulation_lore(
            admin_supabase,
            simulation_id,
        )

    background_tasks.add_task(
        safe_background(_orchestrator_service.run_batch_generation),
        admin_supabase,
        simulation_id,
        admin.id,
        draft_data=draft_data,
        entity_types=entity_types,
    )

    mode = "lore + images" if include_lore else "images only"
    types_str = ", ".join(sorted(entity_types)) if entity_types else "all"
    await AuditService.safe_log(
        admin_supabase,
        str(simulation_id),
        admin.id,
        "simulation",
        str(simulation_id),
        "retrigger_batch",
        {"simulation_name": sim["name"], "mode": mode, "entity_types": types_str},
    )

    msg = f"Batch retrigger ({mode}, {types_str}) started for '{sim['name']}'."
    return SuccessResponse(data=MessageResponse(message=msg))

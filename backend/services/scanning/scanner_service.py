"""Scanner orchestrator — fetch → filter → classify → create/stage.

Runs as a background task (system actor) using admin Supabase client.
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import UTC, datetime, timedelta
from uuid import UUID

import httpx
from postgrest.exceptions import APIError as PostgrestAPIError

from backend.config import settings
from backend.dependencies import get_admin_supabase
from backend.models.resonance import ARCHETYPE_DESCRIPTIONS, CATEGORY_ARCHETYPE_MAP
from backend.services.base_service import serialize_for_json
from backend.services.external.openrouter import OpenRouterService
from backend.services.scanning import classifier, deduplicator, pre_filter
from backend.services.scanning.base_adapter import ScanResult
from backend.services.scanning.registry import get_adapter, get_adapter_names
from backend.utils.errors import not_found
from backend.utils.responses import extract_list
from supabase import AsyncClient as Client

# Resolved template dataclass for cached DB templates
_TemplateCache = dict[str, dict[str, str]]  # {template_type: {system_prompt, prompt_content, ...}}

logger = logging.getLogger(__name__)

# System actor UUID for automated operations
_SYSTEM_USER_ID = UUID("00000000-0000-0000-0000-000000000000")

# Defaults (overridable via platform_settings)
_DEFAULT_ENABLED = False
_DEFAULT_INTERVAL = 21600  # 6 hours
_FLOOR_INTERVAL = 3600  # 1 hour minimum


class ScannerService:
    """Substrate Scanner — background service for automated event detection."""

    _task: asyncio.Task | None = None

    # ── Lifecycle ─────────────────────────────────────────────────────────

    @classmethod
    async def start(cls) -> asyncio.Task:
        """Launch the scanner loop. Called from app lifespan."""
        cls._task = asyncio.create_task(cls._run_loop())
        logger.info("Substrate Scanner started")
        return cls._task

    @classmethod
    async def _run_loop(cls) -> None:
        """Infinite loop: sleep → check config → run scan cycle."""
        while True:
            interval = _DEFAULT_INTERVAL
            try:
                admin = await get_admin_supabase()
                config = await cls._load_config(admin)
                interval = config["interval"]
                if config["enabled"]:
                    await cls.run_scan_cycle(admin, config)
            except asyncio.CancelledError:
                logger.info("Substrate Scanner shutting down")
                raise
            except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError):
                logger.exception("Scanner loop error")
            await asyncio.sleep(interval)

    # ── Configuration ─────────────────────────────────────────────────────

    @classmethod
    async def _load_config(cls, admin: Client) -> dict:
        """Read scanner config from platform_settings."""
        config = {
            "enabled": _DEFAULT_ENABLED,
            "interval": _DEFAULT_INTERVAL,
            "auto_create": False,
            "adapters": [],
            "min_magnitude": 0.20,
            "impacts_delay_hours": 4,
            "openrouter_api_key": settings.openrouter_api_key,
        }

        try:
            _resp = await (
                admin.table("platform_settings")
                .select("setting_key, setting_value")
                .in_(
                    "setting_key",
                    [
                        "news_scanner_enabled",
                        "news_scanner_interval_seconds",
                        "news_scanner_auto_create",
                        "news_scanner_adapters",
                        "news_scanner_min_magnitude",
                        "news_scanner_impacts_delay_hours",
                    ],
                )
                .execute()
            )
            rows = extract_list(_resp)

            for row in rows:
                key = row["setting_key"]
                val = row["setting_value"]
                if key == "news_scanner_enabled":
                    config["enabled"] = str(val).lower() not in ("false", "0", "no")
                elif key == "news_scanner_interval_seconds":
                    try:
                        config["interval"] = max(_FLOOR_INTERVAL, int(val))
                    except (ValueError, TypeError):
                        pass
                elif key == "news_scanner_auto_create":
                    config["auto_create"] = str(val).lower() not in ("false", "0", "no")
                elif key == "news_scanner_adapters":
                    try:
                        parsed = json.loads(val) if isinstance(val, str) else val
                        if isinstance(parsed, list):
                            config["adapters"] = parsed
                    except (json.JSONDecodeError, TypeError):
                        pass
                elif key == "news_scanner_min_magnitude":
                    try:
                        config["min_magnitude"] = float(val)
                    except (ValueError, TypeError):
                        pass
                elif key == "news_scanner_impacts_delay_hours":
                    try:
                        config["impacts_delay_hours"] = int(val)
                    except (ValueError, TypeError):
                        pass

            # Also load API keys needed by adapters
            _resp = await (
                admin.table("platform_settings")
                .select("setting_key, setting_value")
                .in_(
                    "setting_key",
                    [
                        "guardian_api_key",
                        "newsapi_api_key",
                    ],
                )
                .execute()
            )
            api_key_rows = extract_list(_resp)
            config["api_keys"] = {r["setting_key"]: r["setting_value"] for r in api_key_rows}

        except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError):
            logger.warning("Failed to load scanner config, using defaults")

        return config

    # ── Template Loading ────────────────────────────────────────────────────

    @classmethod
    async def _load_templates(cls, admin: Client) -> _TemplateCache:
        """Load scanner prompt templates from prompt_templates table.

        Falls back to empty dict on failure — callers use inline defaults.
        """
        try:
            resp = await (
                admin.table("prompt_templates")
                .select("template_type, system_prompt, prompt_content, temperature, max_tokens")
                .eq("prompt_category", "scanner")
                .eq("is_active", True)
                .is_("simulation_id", "null")
                .execute()
            )
            return {row["template_type"]: row for row in extract_list(resp)}
        except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError):
            logger.warning("Failed to load scanner templates from DB, using inline defaults")
            return {}

    # ── Scan Cycle ────────────────────────────────────────────────────────

    @classmethod
    async def run_scan_cycle(
        cls,
        admin: Client,
        config: dict | None = None,
        adapter_names: list[str] | None = None,
    ) -> dict:
        """Execute one full scan cycle. Returns metrics dict."""
        if config is None:
            config = await cls._load_config(admin)

        # Determine which adapters to run
        enabled_names = adapter_names or config.get("adapters", [])
        if not enabled_names:
            enabled_names = get_adapter_names()

        min_magnitude = config.get("min_magnitude", 0.20)
        auto_create = config.get("auto_create", False)
        delay_hours = config.get("impacts_delay_hours", 4)
        api_keys = config.get("api_keys", {})

        # Load prompt templates from DB (falls back to inline defaults)
        templates = await cls._load_templates(admin)
        config["_templates"] = templates

        metrics = {
            "adapters": {},
            "total_fetched": 0,
            "total_classified": 0,
            "total_new": 0,
            "resonances_created": 0,
            "candidates_staged": 0,
            "llm_calls": 0,
            "started_at": datetime.now(UTC).isoformat(),
        }

        # Stage 1: FETCH — collect results from all adapters
        all_results: list[ScanResult] = []
        for name in enabled_names:
            try:
                adapter = get_adapter(name)
                # Inject API key if needed
                if adapter.requires_api_key and adapter.api_key_setting:
                    adapter._api_key = api_keys.get(adapter.api_key_setting)

                if not await adapter.is_available():
                    metrics["adapters"][name] = {"status": "unavailable", "fetched": 0}
                    continue

                results = await adapter.fetch()
                metrics["adapters"][name] = {"status": "ok", "fetched": len(results)}
                metrics["total_fetched"] += len(results)
                all_results.extend(results)
            except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError):
                logger.exception("Adapter %s fetch failed", name)
                metrics["adapters"][name] = {"status": "error", "fetched": 0}

        if not all_results:
            metrics["finished_at"] = datetime.now(UTC).isoformat()
            return metrics

        # Stage 2: PRE-FILTER — keyword reject/boost (no LLM)
        filtered = pre_filter.pre_filter(all_results)

        # Deduplicate within batch (removes near-identical NOAA/USGS titles)
        filtered = deduplicator.deduplicate_within_batch(filtered)

        # Deduplicate against scan log
        novel = await deduplicator.deduplicate(admin, filtered)

        # Stage 3: CLASSIFY — structured pass-through, LLM for unstructured
        needs_llm = any(not r.is_structured for r in novel)
        if needs_llm and config.get("openrouter_api_key"):
            openrouter = OpenRouterService(config["openrouter_api_key"])
            # Use DB template system_prompt if available, else inline default
            cls_template = templates.get("scanner_classification")
            cls_system_prompt = cls_template["system_prompt"] if cls_template else None
            classified = await classifier.classify_batch(
                novel, openrouter, system_prompt_override=cls_system_prompt,
            )
            metrics["llm_calls"] = 1
        else:
            classified = novel

        # Filter by minimum magnitude and require classification
        qualified = [
            r for r in classified if r.source_category and r.magnitude is not None and r.magnitude >= min_magnitude
        ]
        metrics["total_classified"] = len(qualified)

        # Deduplicate against existing resonances (title similarity)
        final = await deduplicator.deduplicate_against_resonances(admin, qualified)
        metrics["total_new"] = len(final)

        # Log all results (including duplicates) for tracking
        await deduplicator.log_results(admin, classified)

        # Stage 4: CREATE or STAGE
        for result in final:
            try:
                if auto_create:
                    resonance = await cls._create_resonance(
                        admin,
                        result,
                        delay_hours,
                        config,
                    )
                    if resonance:
                        metrics["resonances_created"] += 1
                else:
                    await cls._stage_candidate(admin, result, config)
                    metrics["candidates_staged"] += 1
            except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError):
                logger.exception("Failed to create/stage result: %s", result.title[:80])

        # Cleanup old scan log entries
        await deduplicator.cleanup_old_logs(admin)

        metrics["finished_at"] = datetime.now(UTC).isoformat()
        logger.info(
            "Scan cycle complete: %d fetched, %d classified, %d new, %d created, %d staged",
            metrics["total_fetched"],
            metrics["total_classified"],
            metrics["total_new"],
            metrics["resonances_created"],
            metrics["candidates_staged"],
        )
        return metrics

    # ── Create / Stage ────────────────────────────────────────────────────

    @classmethod
    async def _create_resonance(
        cls,
        admin: Client,
        result: ScanResult,
        delay_hours: int,
        config: dict,
    ) -> dict | None:
        """Create a substrate resonance directly from a scan result."""
        from backend.services.resonance_service import ResonanceService

        impacts_at = datetime.now(UTC) + timedelta(hours=delay_hours)

        # Generate bureau dispatch if LLM is available
        dispatch = await cls._generate_dispatch(result, config)

        insert_data = {
            "source_category": result.source_category,
            "title": result.title,
            "description": result.description,
            "bureau_dispatch": dispatch,
            "real_world_source": {
                "url": result.url,
                "source_adapter": result.source_name,
                "raw_data": result.raw_data,
            },
            "magnitude": result.magnitude,
            "impacts_at": impacts_at,
        }

        resonance = await ResonanceService.create(admin, _SYSTEM_USER_ID, insert_data)

        # Also record as candidate with status='created'
        await cls._stage_candidate(admin, result, config, status="created", resonance_id=resonance["id"])

        return resonance

    @classmethod
    async def _stage_candidate(
        cls,
        admin: Client,
        result: ScanResult,
        config: dict,
        *,
        status: str = "pending",
        resonance_id: str | None = None,
    ) -> None:
        """Stage a scan result as a candidate for admin review."""
        # Generate bureau dispatch for pending candidates too
        dispatch = None
        if status == "pending":
            dispatch = await cls._generate_dispatch(result, config)

        row = serialize_for_json(
            {
                "source_category": result.source_category,
                "title": result.title,
                "description": result.description or result.classification_reason,
                "bureau_dispatch": dispatch,
                "article_url": result.url,
                "article_platform": result.source_name,
                "article_raw_data": result.raw_data,
                "magnitude": result.magnitude,
                "classification_reason": result.classification_reason,
                "source_adapter": result.source_name,
                "is_structured": result.is_structured,
                "status": status,
                "resonance_id": resonance_id,
            }
        )

        try:
            await admin.table("news_scan_candidates").insert(row).execute()
        except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError):
            logger.exception("Failed to stage candidate: %s", result.title[:80])

    # Inline fallback prompts — used when DB templates are unavailable
    _DISPATCH_SYSTEM_PROMPT = (
        "You write bureau dispatches — official reports from the Bureau of Substrate Monitoring, "
        "as if real-world events were tremors detected in the fabric between realities. "
        "Tone: Clinical yet ominous. Like a seismological report written by someone who "
        "suspects the instruments are detecting something alive."
    )

    _DISPATCH_USER_TEMPLATE = (
        "Source event: {article_title}\n"
        "{article_description}\n\n"
        "Category: {source_category}\n"
        "Archetype: {archetype_name} — {archetype_description}\n"
        "Magnitude: {magnitude_scaled}/10\n\n"
        "Write a bureau dispatch (100-200 words). "
        "Reference the real event obliquely (never name real places or people directly). "
        "Use the archetype as thematic framing. "
        "End with a monitoring classification code.\n\n"
        "Respond in {locale}."
    )

    @classmethod
    async def _generate_dispatch(
        cls,
        result: ScanResult,
        config: dict,
    ) -> str | None:
        """Generate a bureau dispatch narrative for a scan result.

        Uses DB prompt_templates (scanner_bureau_dispatch) if loaded,
        falls back to inline constants.
        """
        api_key = config.get("openrouter_api_key")
        if not api_key or not result.source_category:
            return None

        mapping = CATEGORY_ARCHETYPE_MAP.get(result.source_category)
        if not mapping:
            return None

        _, archetype = mapping
        archetype_desc = ARCHETYPE_DESCRIPTIONS.get(archetype, "")
        magnitude_scaled = round((result.magnitude or 0.5) * 10)

        # Resolve templates — prefer DB, fall back to inline
        templates: _TemplateCache = config.get("_templates", {})
        db_template = templates.get("scanner_bureau_dispatch")

        if db_template:
            system_prompt = db_template.get("system_prompt") or cls._DISPATCH_SYSTEM_PROMPT
            # DB template uses {{var}} mustache placeholders — convert to Python format
            user_template = db_template.get("prompt_content", cls._DISPATCH_USER_TEMPLATE)
            user_template = user_template.replace("{{", "{").replace("}}", "}")
        else:
            system_prompt = cls._DISPATCH_SYSTEM_PROMPT
            user_template = cls._DISPATCH_USER_TEMPLATE

        user_prompt = user_template.format(
            article_title=result.title,
            article_description=result.description or "",
            source_category=result.source_category,
            archetype_name=archetype,
            archetype_description=archetype_desc,
            magnitude_scaled=magnitude_scaled,
            locale="English",
        )

        try:
            openrouter = OpenRouterService(api_key)
            dispatch = await openrouter.generate_with_system(
                model="deepseek/deepseek-v3.2",
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=float(db_template.get("temperature", 0.9)) if db_template else 0.9,
                max_tokens=int(db_template.get("max_tokens", 512)) if db_template else 512,
            )
            return dispatch.strip()
        except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError):
            logger.warning("Bureau dispatch generation failed for: %s", result.title[:80])
            return None

    # ── Admin Operations ──────────────────────────────────────────────────

    @classmethod
    async def toggle_adapter(
        cls,
        admin: Client,
        name: str,
        enabled: bool,
    ) -> dict:
        """Enable or disable an adapter in platform_settings."""
        resp = await (
            admin.table("platform_settings")
            .select("setting_value")
            .eq("setting_key", "news_scanner_adapters")
            .limit(1)
            .execute()
        )
        current: list[str] = []
        if resp.data:
            try:
                current = json.loads(resp.data[0]["setting_value"])
            except (json.JSONDecodeError, TypeError):
                pass

        if enabled and name not in current:
            current.append(name)
        elif not enabled and name in current:
            current.remove(name)

        await (
            admin.table("platform_settings")
            .update(
                {"setting_value": json.dumps(current)},
            )
            .eq("setting_key", "news_scanner_adapters")
            .execute()
        )

        return {"name": name, "enabled": enabled}

    @staticmethod
    def compute_recommended_threshold(candidates: list[dict]) -> float:
        """Compute recommended magnitude threshold from candidate list.

        Returns the magnitude at the top-20% boundary of pending candidates,
        with a minimum of 0.4 and a default of 0.6 when no candidates exist.
        """
        pending = [c for c in candidates if c.get("status") == "pending"]
        if not pending:
            return 0.6
        magnitudes = sorted(
            (float(c.get("magnitude") or 0) for c in pending),
            reverse=True,
        )
        top_20_idx = max(0, int(len(magnitudes) * 0.2) - 1)
        return max(0.4, round(magnitudes[top_20_idx], 2))

    @classmethod
    async def list_candidates(
        cls,
        admin: Client,
        *,
        status: str | None = None,
        category: str | None = None,
        source: str | None = None,
        limit: int = 25,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        """List scan candidates with filters. Returns (data, total)."""
        query = admin.table("news_scan_candidates").select("*", count="exact")

        if status:
            query = query.eq("status", status)
        if category:
            query = query.eq("source_category", category)
        if source:
            query = query.eq("source_adapter", source)

        query = query.order("created_at", desc=True)
        query = query.range(offset, offset + limit - 1)

        response = await query.execute()
        data = extract_list(response)
        total = response.count if response.count is not None else len(data)
        return data, total

    @classmethod
    async def update_candidate(
        cls,
        admin: Client,
        candidate_id: UUID,
        data: dict,
    ) -> dict | None:
        """Update a candidate's fields. Returns updated candidate or None."""
        if not data:
            return None

        resp = await admin.table("news_scan_candidates").update(data).eq("id", str(candidate_id)).execute()
        return resp.data[0] if resp.data else None

    @classmethod
    async def list_scan_log(
        cls,
        admin: Client,
        *,
        limit: int = 50,
        offset: int = 0,
        source: str | None = None,
    ) -> tuple[list[dict], int]:
        """Recent scan history. Returns (data, total)."""
        query = admin.table("news_scan_log").select("*", count="exact")

        if source:
            query = query.eq("source_name", source)

        query = query.order("scanned_at", desc=True)
        query = query.range(offset, offset + limit - 1)

        response = await query.execute()
        data = extract_list(response)
        total = response.count if response.count is not None else len(data)
        return data, total

    @classmethod
    async def approve_candidate(
        cls,
        admin: Client,
        candidate_id: UUID,
        user_id: UUID,
        delay_hours: int = 4,
    ) -> dict:
        """Approve a candidate → create resonance + mark as 'created'."""
        from backend.services.resonance_service import ResonanceService

        # Load candidate
        resp = await (
            admin.table("news_scan_candidates")
            .select("*")
            .eq("id", str(candidate_id))
            .eq("status", "pending")
            .limit(1)
            .execute()
        )
        if not resp.data:
            raise not_found(detail="Candidate not found or not pending.")

        candidate = resp.data[0]
        impacts_at = datetime.now(UTC) + timedelta(hours=delay_hours)

        insert_data = {
            "source_category": candidate["source_category"],
            "title": candidate["title"],
            "description": candidate["description"],
            "bureau_dispatch": candidate["bureau_dispatch"],
            "real_world_source": {
                "url": candidate.get("article_url"),
                "source_adapter": candidate.get("source_adapter"),
                "raw_data": candidate.get("article_raw_data"),
            },
            "magnitude": float(candidate["magnitude"]),
            "impacts_at": impacts_at,
        }

        resonance = await ResonanceService.create(admin, user_id, insert_data)

        # Mark candidate as created
        await (
            admin.table("news_scan_candidates")
            .update(
                {
                    "status": "created",
                    "resonance_id": resonance["id"],
                    "reviewed_at": datetime.now(UTC).isoformat(),
                    "reviewed_by_id": str(user_id),
                }
            )
            .eq("id", str(candidate_id))
            .execute()
        )

        return resonance

    @classmethod
    async def reject_candidate(
        cls,
        admin: Client,
        candidate_id: UUID,
        user_id: UUID,
    ) -> None:
        """Reject a candidate."""
        await (
            admin.table("news_scan_candidates")
            .update(
                {
                    "status": "rejected",
                    "reviewed_at": datetime.now(UTC).isoformat(),
                    "reviewed_by_id": str(user_id),
                }
            )
            .eq("id", str(candidate_id))
            .execute()
        )

    @classmethod
    async def get_dashboard(cls, admin: Client) -> dict:
        """Get scanner dashboard data: adapter status, metrics, last scan."""
        from backend.services.scanning.registry import get_adapter_info

        config = await cls._load_config(admin)

        # Get adapter info with availability
        adapter_info = get_adapter_info()
        enabled_names = config.get("adapters", [])
        api_keys = config.get("api_keys", {})

        for info in adapter_info:
            info["enabled"] = info["name"] in enabled_names
            # Check availability
            try:
                adapter = get_adapter(info["name"])
                if adapter.requires_api_key and adapter.api_key_setting:
                    adapter._api_key = api_keys.get(adapter.api_key_setting)
                info["available"] = await adapter.is_available()
            except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError):
                info["available"] = False

        # Get scan metrics
        today_start = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()

        scanned_resp = await (
            admin.table("news_scan_log").select("id", count="exact").gte("scanned_at", today_start).execute()
        )
        scanned_today = scanned_resp.count or 0

        classified_resp = await (
            admin.table("news_scan_log")
            .select("id", count="exact")
            .gte("scanned_at", today_start)
            .eq("classified", True)
            .execute()
        )
        classified_today = classified_resp.count or 0

        resonances_resp = await (
            admin.table("substrate_resonances")
            .select("id", count="exact")
            .gte("created_at", today_start)
            .is_("deleted_at", "null")
            .execute()
        )
        resonances_today = resonances_resp.count or 0

        # Pending candidates count
        pending_resp = await (
            admin.table("news_scan_candidates").select("id", count="exact").eq("status", "pending").execute()
        )
        pending_count = pending_resp.count or 0

        # Last scan timestamp
        last_scan_resp = await (
            admin.table("news_scan_log").select("scanned_at").order("scanned_at", desc=True).limit(1).execute()
        )
        last_scan = last_scan_resp.data[0]["scanned_at"] if last_scan_resp.data else None

        return {
            "config": {
                "enabled": config["enabled"],
                "interval": config["interval"],
                "auto_create": config.get("auto_create", False),
                "min_magnitude": config.get("min_magnitude", 0.20),
                "impacts_delay_hours": config.get("impacts_delay_hours", 4),
            },
            "adapters": adapter_info,
            "metrics": {
                "scanned_today": scanned_today,
                "classified_today": classified_today,
                "resonances_today": resonances_today,
                "pending_candidates": pending_count,
                "last_scan": last_scan,
            },
        }

"""disease.sh (Open Disease Data) adapter — STRUCTURED.

Tracks COVID-19 and influenza data. Uses rate-of-change detection
across polling cycles to identify significant spikes.
"""

from __future__ import annotations

import logging
from datetime import datetime

import httpx

from backend.services.scanning.base_adapter import ScanResult, SourceAdapter
from backend.services.scanning.registry import register_adapter

logger = logging.getLogger(__name__)

DISEASE_SH_BASE = "https://disease.sh/v3/covid-19"
TIMEOUT = 15

# In-memory tracking for rate-of-change detection
_last_global_cases: int | None = None


@register_adapter
class DiseaseSHAdapter(SourceAdapter):
    name = "disease_sh"
    display_name = "disease.sh Pandemic Tracker"
    categories = ["pandemic"]
    is_structured = True
    requires_api_key = False
    default_interval = 3600  # 60 minutes

    async def fetch(self, since: datetime | None = None) -> list[ScanResult]:
        global _last_global_cases
        results: list[ScanResult] = []

        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(f"{DISEASE_SH_BASE}/all")
            if resp.status_code != 200:
                logger.warning("disease.sh returned %d", resp.status_code)
                return []
            data = resp.json()

        today_cases = data.get("todayCases", 0)
        today_deaths = data.get("todayDeaths", 0)
        active = data.get("active", 0)
        cases = data.get("cases", 0)

        # Rate-of-change detection
        magnitude: float | None = None
        if _last_global_cases is not None and _last_global_cases > 0:
            daily_change = (cases - _last_global_cases) / _last_global_cases
            if daily_change > 0.20:
                magnitude = 0.60
            elif daily_change > 0.10:
                magnitude = 0.35
            # Stable/declining → skip

        _last_global_cases = cases

        if magnitude is not None:
            results.append(
                ScanResult(
                    source_id=f"disease_sh_global_{data.get('updated', 0)}",
                    source_name=self.name,
                    title=f"Global pandemic spike: {today_cases:,} new cases today",
                    url="https://disease.sh",
                    description=f"Active: {active:,}, Today deaths: {today_deaths:,}",
                    raw_data={
                        "cases": cases,
                        "todayCases": today_cases,
                        "todayDeaths": today_deaths,
                        "active": active,
                        "critical": data.get("critical", 0),
                        "updated": data.get("updated"),
                    },
                    source_category="pandemic",
                    magnitude=magnitude,
                    classification_reason=">10% daily case increase globally",
                    is_structured=True,
                )
            )

        return results

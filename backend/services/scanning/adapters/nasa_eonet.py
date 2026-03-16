"""NASA EONET (Earth Observatory Natural Event Tracker) v3 adapter — STRUCTURED."""

from __future__ import annotations

import logging
from datetime import datetime

import httpx

from backend.services.scanning.base_adapter import ScanResult, SourceAdapter
from backend.services.scanning.registry import register_adapter

logger = logging.getLogger(__name__)

EONET_API_URL = "https://eonet.gsfc.nasa.gov/api/v3/events"
TIMEOUT = 20

# EONET category → resonance category
_CATEGORY_MAP = {
    "earthquakes": "natural_disaster",
    "volcanoes": "natural_disaster",
    "severeStorms": "natural_disaster",
    "floods": "natural_disaster",
    "landslides": "natural_disaster",
    "wildfires": "natural_disaster",
    "waterColor": "environmental_disaster",
    "dustHaze": "environmental_disaster",
    "snow": "environmental_disaster",
    "seaLakeIce": "environmental_disaster",
    "tempExtremes": "environmental_disaster",
    "drought": "environmental_disaster",
}


@register_adapter
class NASAEONETAdapter(SourceAdapter):
    name = "nasa_eonet"
    display_name = "NASA EONET"
    categories = ["natural_disaster", "environmental_disaster"]
    is_structured = True
    requires_api_key = False
    default_interval = 1800  # 30 minutes

    async def fetch(self, since: datetime | None = None) -> list[ScanResult]:
        params = {
            "status": "open",
            "limit": "25",
            "days": "7",
        }

        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(EONET_API_URL, params=params)
            resp.raise_for_status()
            data = resp.json()

        events = data.get("events", [])
        results: list[ScanResult] = []

        for event in events:
            eonet_id = event.get("id", "")
            title = event.get("title", "")
            categories = event.get("categories", [])
            geometry = event.get("geometry", [])

            # Determine resonance category from EONET categories
            source_category = "natural_disaster"
            for cat in categories:
                cat_id = cat.get("id", "")
                if cat_id in _CATEGORY_MAP:
                    source_category = _CATEGORY_MAP[cat_id]
                    break

            # Extract magnitude if available
            magnitude_value = None
            for geom in geometry:
                mv = geom.get("magnitudeValue")
                if mv is not None:
                    magnitude_value = mv
                    break

            # Default magnitude 0.30 for EONET events
            game_magnitude = 0.30
            if magnitude_value is not None:
                # Simple scaling — EONET doesn't have uniform magnitude units
                game_magnitude = min(1.0, max(0.15, magnitude_value / 10.0))

            sources = event.get("sources", [])
            url = sources[0].get("url") if sources else None

            results.append(ScanResult(
                source_id=eonet_id,
                source_name=self.name,
                title=title,
                url=url,
                description=f"EONET event: {', '.join(c.get('title', '') for c in categories)}",
                raw_data={
                    "categories": [c.get("id") for c in categories],
                    "geometry": geometry[:1] if geometry else [],
                    "sources": [s.get("url") for s in sources],
                },
                source_category=source_category,
                magnitude=round(game_magnitude, 2),
                classification_reason=(
                    f"EONET category:"
                    f" {categories[0].get('id', 'unknown') if categories else 'unknown'}"
                ),
                is_structured=True,
            ))

        return results

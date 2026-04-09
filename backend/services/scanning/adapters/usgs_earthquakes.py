"""USGS Earthquake Hazards Program adapter — STRUCTURED."""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta

import httpx

from backend.services.scanning.base_adapter import ScanResult, SourceAdapter
from backend.services.scanning.registry import register_adapter

logger = logging.getLogger(__name__)

USGS_API_URL = "https://earthquake.usgs.gov/fdsnws/event/1/query"
TIMEOUT = 20


def _richter_to_magnitude(mag: float, alert: str | None, tsunami: int) -> float:
    """Map Richter magnitude to game magnitude [0.1, 1.0]."""
    if mag >= 8.0:
        base = 0.95
    elif mag >= 7.0:
        base = 0.70
    elif mag >= 6.0:
        base = 0.45
    elif mag >= 5.0:
        base = 0.25
    else:
        base = 0.15

    if alert == "red":
        base += 0.15
    if tsunami:
        base += 0.10

    return min(1.0, max(0.1, round(base, 2)))


@register_adapter
class USGSEarthquakeAdapter(SourceAdapter):
    name = "usgs_earthquakes"
    display_name = "USGS Earthquake Hazards"
    categories = ["natural_disaster"]
    is_structured = True
    requires_api_key = False
    default_interval = 900  # 15 minutes

    async def fetch(self, since: datetime | None = None) -> list[ScanResult]:
        start = since or (datetime.now(UTC) - timedelta(hours=24))
        params = {
            "format": "geojson",
            "minmagnitude": "4.0",
            "starttime": start.strftime("%Y-%m-%dT%H:%M:%S"),
            "orderby": "time",
        }

        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(USGS_API_URL, params=params)
            resp.raise_for_status()
            data = resp.json()

        features = data.get("features", [])
        results: list[ScanResult] = []

        for feature in features:
            props = feature.get("properties", {})
            mag = props.get("mag", 0)
            alert = props.get("alert")
            tsunami = props.get("tsunami", 0)

            results.append(
                ScanResult(
                    source_id=feature.get("id", ""),
                    source_name=self.name,
                    title=props.get("title", f"M {mag} Earthquake"),
                    url=props.get("url"),
                    description=props.get("place", ""),
                    raw_data={
                        "mag": mag,
                        "place": props.get("place"),
                        "time": props.get("time"),
                        "alert": alert,
                        "tsunami": tsunami,
                        "coordinates": feature.get("geometry", {}).get("coordinates"),
                    },
                    source_category="natural_disaster",
                    magnitude=_richter_to_magnitude(mag, alert, tsunami),
                    classification_reason=f"Richter {mag}, alert={alert}, tsunami={tsunami}",
                    is_structured=True,
                )
            )

        return results

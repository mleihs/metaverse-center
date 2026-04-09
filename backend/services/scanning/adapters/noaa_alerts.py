"""NOAA / National Weather Service Alerts adapter — STRUCTURED."""

from __future__ import annotations

import logging
from datetime import datetime

import httpx

from backend.services.scanning.base_adapter import ScanResult, SourceAdapter
from backend.services.scanning.registry import register_adapter

logger = logging.getLogger(__name__)

NOAA_API_URL = "https://api.weather.gov/alerts/active"
TIMEOUT = 20

# Severity → base magnitude
_SEVERITY_MAP = {
    "Minor": 0.10,
    "Moderate": 0.20,
    "Severe": 0.45,
    "Extreme": 0.75,
}

# Event type boosts
_EVENT_BOOSTS = {
    "Tornado": 0.15,
    "Hurricane": 0.20,
    "Tsunami": 0.20,
    "Typhoon": 0.20,
    "Tropical Storm": 0.10,
}


def _severity_to_magnitude(severity: str, event: str) -> float:
    base = _SEVERITY_MAP.get(severity, 0.20)
    for keyword, boost in _EVENT_BOOSTS.items():
        if keyword.lower() in event.lower():
            base += boost
            break
    return min(1.0, max(0.1, round(base, 2)))


@register_adapter
class NOAAAlertAdapter(SourceAdapter):
    name = "noaa_alerts"
    display_name = "NOAA Weather Alerts"
    categories = ["natural_disaster"]
    is_structured = True
    requires_api_key = False
    default_interval = 900  # 15 minutes

    async def fetch(self, since: datetime | None = None) -> list[ScanResult]:
        headers = {
            "User-Agent": "(metaverse.center, matthias@leihs.at)",
            "Accept": "application/geo+json",
        }
        params = {"severity": "Extreme,Severe"}

        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(NOAA_API_URL, params=params, headers=headers)
            resp.raise_for_status()
            data = resp.json()

        features = data.get("features", [])
        results: list[ScanResult] = []

        for feature in features:
            props = feature.get("properties", {})
            event = props.get("event", "Weather Alert")
            severity = props.get("severity", "Moderate")
            alert_id = props.get("id", "")

            results.append(
                ScanResult(
                    source_id=alert_id,
                    source_name=self.name,
                    title=props.get("headline", event),
                    url=f"https://alerts.weather.gov/alert/{alert_id}" if alert_id else None,
                    description=props.get("description", "")[:500],
                    raw_data={
                        "event": event,
                        "severity": severity,
                        "urgency": props.get("urgency"),
                        "areaDesc": props.get("areaDesc"),
                        "onset": props.get("onset"),
                        "expires": props.get("expires"),
                    },
                    source_category="natural_disaster",
                    magnitude=_severity_to_magnitude(severity, event),
                    classification_reason=f"{event}, severity={severity}",
                    is_structured=True,
                )
            )

        return results

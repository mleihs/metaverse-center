"""GDACS (Global Disaster Alert and Coordination System) adapter — STRUCTURED."""

from __future__ import annotations

import logging
import re
from datetime import UTC, datetime, timedelta

import httpx

from backend.services.scanning.base_adapter import ScanResult, SourceAdapter
from backend.services.scanning.registry import register_adapter

logger = logging.getLogger(__name__)

GDACS_API_URL = "https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH"
TIMEOUT = 20

# Alert level → magnitude
_ALERT_MAGNITUDE = {
    "Green": 0.15,
    "Orange": 0.45,
    "Red": 0.80,
}


@register_adapter
class GDACSAdapter(SourceAdapter):
    name = "gdacs"
    display_name = "GDACS Disasters"
    categories = ["natural_disaster"]
    is_structured = True
    requires_api_key = False
    default_interval = 1800  # 30 minutes

    async def fetch(self, since: datetime | None = None) -> list[ScanResult]:
        from_date = (datetime.now(UTC) - timedelta(days=7)).strftime("%Y-%m-%d")
        to_date = datetime.now(UTC).strftime("%Y-%m-%d")

        params = {
            "eventlist": "EQ,TC,FL,VO,WF,DR",
            "alertlevel": "Orange,Red",
            "fromdate": from_date,
            "todate": to_date,
        }

        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(GDACS_API_URL, params=params)
            resp.raise_for_status()
            data = resp.json()

        features = data.get("features", [])
        results: list[ScanResult] = []

        for feature in features:
            props = feature.get("properties", {})
            event_id = str(props.get("eventid", feature.get("id", "")))
            alert_level = props.get("alertlevel", "Green")
            event_type = props.get("eventtype", "")
            title = props.get("name", props.get("htmldescription", f"GDACS {event_type}"))

            # Clean HTML from title if present
            if "<" in title:
                title = re.sub(r"<[^>]+>", "", title).strip()

            magnitude = _ALERT_MAGNITUDE.get(alert_level, 0.30)

            results.append(ScanResult(
                source_id=f"gdacs_{event_type}_{event_id}",
                source_name=self.name,
                title=title[:500],
                url=props.get("url"),
                description=props.get("description", "")[:500] if props.get("description") else None,
                raw_data={
                    "eventtype": event_type,
                    "alertlevel": alert_level,
                    "eventid": event_id,
                    "severity": props.get("severity"),
                    "country": props.get("country"),
                    "coordinates": feature.get("geometry", {}).get("coordinates"),
                },
                source_category="natural_disaster",
                magnitude=magnitude,
                classification_reason=f"GDACS {event_type}, alert={alert_level}",
                is_structured=True,
            ))

        return results

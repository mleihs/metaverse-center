"""WHO Disease Outbreak News adapter — SEMI-STRUCTURED (category known, LLM for magnitude)."""

from __future__ import annotations

import logging
import re
from datetime import datetime

import httpx

from backend.services.scanning.base_adapter import ScanResult, SourceAdapter
from backend.services.scanning.registry import register_adapter

logger = logging.getLogger(__name__)

WHO_API_URL = "https://www.who.int/api/news/diseaseoutbreaknews"
TIMEOUT = 20


#: Ein Bild im HTML der WHO-Meldung.
#:
#: Die Disease-Outbreak-News fuehren KEIN Bildfeld — ihre Karten und
#: Fallkurven stehen als `<img>` im HTML von `Overview` bzw. `Epidemiology`
#: (`https://cdn.who.int/media/images/...`). Wer nur nach einem Schluessel
#: sucht, der „image" heisst, findet sie nicht und haelt die Quelle fuer
#: bildlos. Am 02.09.2026 nachgemessen: die drei juengsten Meldungen tragen
#: jede eines.
_IMG_SRC = re.compile(r'<img[^>]+src="(https://cdn\.who\.int/[^"]+)"', re.IGNORECASE)


def _first_image(item: dict) -> str | None:
    """Die erste Bild-URL aus den HTML-Feldern einer Meldung, oder `None`.

    Reihenfolge ist bedeutungstragend: `Overview` traegt in aller Regel die
    Uebersichtskarte, `Epidemiology` die Fallkurve. Die Uebersicht ist das
    bessere Teaserbild.
    """
    for field in ("Overview", "Epidemiology", "Response", "FurtherInformation"):
        html = item.get(field)
        if not isinstance(html, str):
            continue
        found = _IMG_SRC.search(html)
        if found:
            return found.group(1)
    return None


@register_adapter
class WHOOutbreaksAdapter(SourceAdapter):
    name = "who_outbreaks"
    display_name = "WHO Disease Outbreaks"
    categories = ["pandemic"]
    is_structured = False  # Category known, but magnitude needs LLM
    requires_api_key = False
    default_interval = 3600  # 60 minutes

    async def fetch(self, since: datetime | None = None) -> list[ScanResult]:
        params = {
            "$orderby": "PublicationDateAndTime desc",
            "$top": "20",
        }

        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(WHO_API_URL, params=params)
            if resp.status_code != 200:
                logger.warning("WHO API returned %d", resp.status_code)
                return []
            data = resp.json()

        items = data.get("value", [])
        results: list[ScanResult] = []

        for item in items:
            don_id = item.get("DonId", item.get("UrlName", ""))
            title = item.get("Title", "")
            summary = item.get("Summary", "")
            url = item.get("ItemDefaultUrl", "")

            if not title:
                continue

            results.append(
                ScanResult(
                    source_id=f"who_{don_id}",
                    source_name=self.name,
                    title=title,
                    url=f"https://www.who.int{url}" if url and not url.startswith("http") else url,
                    description=summary[:500] if summary else None,
                    raw_data={
                        "DonId": don_id,
                        "PublicationDate": item.get("PublicationDateAndTime"),
                        "image_url": _first_image(item),
                    },
                    # Category is known (always pandemic), but leave for LLM to set magnitude
                    source_category="pandemic",
                    magnitude=None,  # LLM will determine
                    is_structured=False,
                )
            )

        return results

"""Die Schleuse — Geschäftslogik für den einen Weg, der eine Welt verlässt.

Der Architekt einer Welt kann in der Schleuse zwei Dinge mit einem Signal tun:
es zu einem Ereignis SEINER Welt machen (das läuft über
`social_trends`/`integrate-article`), oder es DEM BUREAU MELDEN. Nur das zweite
verlässt seine Welt, und nur das zweite hatte bis Migration 334 keinen Ort, an
dem es ankommen konnte.

WARUM DAS MELDEN EINE ZEILE ANLEGT UND KEINE ÄNDERT: der Architekt arbeitet mit
gebrowsten Artikeln. Die sind flüchtig — `POST …/social-trends/browse` legt
nichts ab, und die Kandidatenliste des Scanners ist admin-only. Es gibt also
keine Zeile, die man auf `flagged` setzen könnte; das Melden IST das Behalten.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from uuid import UUID

from backend.models.resonance import CATEGORY_ARCHETYPE_MAP, SOURCE_CATEGORIES
from backend.services.resonance_service import ResonanceService
from backend.utils.errors import bad_request
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)


class IntakeService:
    """Der Übergang `q → flag` und die Vorschau, die vor `q → res` gehört."""

    @staticmethod
    def signature_for(source_category: str) -> str:
        """Die Resonanz-Signatur hinter einer Quellkategorie.

        Die Zuordnung steht EINMAL, in `models/resonance.py`. Sie hier zu
        wiederholen wäre die zweite Wahrheit, die irgendwann von der ersten
        abweicht — und der Unterschied fiele erst auf, wenn eine Resonanz die
        falsche Suszeptibilität abfragt.
        """
        entry = CATEGORY_ARCHETYPE_MAP.get(source_category)
        if not entry:
            raise bad_request(
                f"Unknown source category {source_category!r}. "
                f"Allowed: {', '.join(sorted(SOURCE_CATEGORIES))}.",
            )
        return entry[0]

    @classmethod
    async def flag_signal(
        cls,
        admin: Client,
        *,
        simulation_id: UUID,
        user_id: UUID,
        title: str,
        source_category: str,
        magnitude: float,
        reason: str,
        description: str | None = None,
        article_url: str | None = None,
        article_platform: str | None = None,
        article_raw_data: dict | None = None,
    ) -> dict:
        """Ein Signal dem Bureau vorlegen.

        Der Kandidat entsteht mit `status='flagged'`, nicht mit `pending`: er
        ist NICHT das Ergebnis eines Scan-Zyklus, und er soll in der Liste des
        Admins auch nicht so aussehen. Wer ihn dort liest, sieht am Zustand,
        dass ein Mensch ihn hervorgeholt hat, und an `flag_reason`, warum.

        `source_adapter` trägt die Plattform des Artikels, ersatzweise
        `architect`. Ein Leerstring wäre die Unwahrheit — irgendwoher kam die
        Meldung.
        """
        # Die Kategorie wird hier geprueft und nicht erst von der
        # CHECK-Bedingung: ein 400 mit der Liste der erlaubten Werte ist eine
        # Auskunft, ein 500 aus postgrest ist keine.
        cls.signature_for(source_category)

        row = {
            "source_category": source_category,
            "title": title,
            "description": description,
            "article_url": article_url,
            "article_platform": article_platform,
            "article_raw_data": article_raw_data,
            "magnitude": magnitude,
            "classification_reason": "gemeldet von einem Architekten",
            "source_adapter": article_platform or "architect",
            "is_structured": False,
            "status": "flagged",
            "flag_reason": reason,
            "flagged_by_simulation_id": str(simulation_id),
            "reviewed_at": datetime.now(UTC).isoformat(),
            "reviewed_by_id": str(user_id),
        }

        resp = await admin.table("news_scan_candidates").insert(row).execute()
        if not resp.data:
            raise bad_request("Die Meldung konnte nicht abgelegt werden.")

        candidate = resp.data[0]
        logger.info(
            "Signal flagged for Bureau: candidate=%s simulation=%s category=%s magnitude=%.2f",
            candidate["id"],
            simulation_id,
            source_category,
            magnitude,
        )
        return candidate

    @classmethod
    async def susceptibility_preview(
        cls,
        admin: Client,
        *,
        source_category: str,
        magnitude: float,
    ) -> list[dict]:
        """Was eine Resonanz dieser Kategorie in den Welten anrichten würde.

        Dünne Hülle über `ResonanceService.preview_susceptibility` — die Formel
        gehört dorthin, wo der Lauf sie benutzt. Hier steht nur die Übersetzung
        von der Sprache der Schleuse (Kategorie) in die der Resonanz (Signatur).
        """
        signature = cls.signature_for(source_category)
        return await ResonanceService.preview_susceptibility(
            admin,
            signature=signature,
            magnitude=magnitude,
        )

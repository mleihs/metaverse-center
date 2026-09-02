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
from backend.utils.responses import extract_list
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

    @staticmethod
    async def signature_fit(
        supabase: Client,
        simulation_id: UUID,
    ) -> list[dict]:
        """Die Passung dieser Welt fuer jede der acht Signaturen.

        Gefragt wird `ResonanceService.susceptibility_of` — dieselbe Funktion,
        die der Resonanzlauf benutzt und die dem Admin vor dem Ausloesen die
        Suszeptibilitaetstafel fuellt. Zwei Umsetzungen derselben Formel wuerden
        auseinanderlaufen, und die auseinandergelaufene ist die, die niemand
        ausfuehrt.

        Acht Aufrufe, unabhaengig von der Zahl der Kandidaten: die Passung
        haengt an (Welt, Signatur), nicht am einzelnen Signal.
        """
        out: list[dict] = []
        for signature in sorted({s for s, _ in CATEGORY_ARCHETYPE_MAP.values()}):
            value = await ResonanceService.susceptibility_of(supabase, simulation_id, signature)
            out.append({"signature": signature, "fit": min(100, max(0, round(value * 100)))})
        return out

    # ── Abonnements ───────────────────────────────────────────────────────────
    #
    # Ein Abo entscheidet, WAS ohne Nachfrage in den Eingang einer Welt gehoert
    # und mit welcher Linse. Es verwandelt NICHTS: ein Zeitgeber, der von selbst
    # Modellaufrufe ausloest, kostet Geld ohne Klick, und genau das wurde am
    # 02.09.2026 auf Prod fuer alle anderen Planer abgestellt.

    @staticmethod
    async def list_subscriptions(supabase: Client, simulation_id: UUID) -> list[dict]:
        """Alle Abos einer Welt, das juengste zuerst."""
        resp = await (
            supabase.table("intake_subscriptions")
            .select("*")
            .eq("simulation_id", str(simulation_id))
            .order("created_at", desc=True)
            .execute()
        )
        return extract_list(resp)

    @staticmethod
    async def create_subscription(
        supabase: Client,
        *,
        simulation_id: UUID,
        user_id: UUID | str | None,
        data: dict,
    ) -> dict:
        """Ein Abo anlegen. Der Schreibweg laeuft ueber RLS, nicht ueber den
        Admin-Client: ein Abo gehoert der Welt, und wer sie bearbeiten darf,
        darf es anlegen."""
        row = {
            **data,
            "simulation_id": str(simulation_id),
            "created_by_id": str(user_id) if user_id else None,
        }
        if row.get("zone_id"):
            row["zone_id"] = str(row["zone_id"])
        resp = await supabase.table("intake_subscriptions").insert(row).execute()
        created = extract_list(resp)
        if not created:
            raise bad_request("Das Abonnement liess sich nicht anlegen.")
        return created[0]

    @staticmethod
    async def update_subscription(
        supabase: Client,
        *,
        subscription_id: UUID,
        simulation_id: UUID,
        data: dict,
    ) -> dict | None:
        """Ein Abo aendern.

        `simulation_id` steht ZUSAETZLICH im Filter, obwohl die Kennung schon
        eindeutig ist: ohne sie wuerde eine fremde Kennung im Pfad zwar an RLS
        scheitern, aber mit einer Meldung, die nach einem Serverfehler aussieht
        statt nach „gehoert nicht hierher".
        """
        update = {**data, "updated_at": datetime.now(UTC).isoformat()}
        if update.get("zone_id"):
            update["zone_id"] = str(update["zone_id"])
        resp = await (
            supabase.table("intake_subscriptions")
            .update(update)
            .eq("id", str(subscription_id))
            .eq("simulation_id", str(simulation_id))
            .execute()
        )
        rows = extract_list(resp)
        return rows[0] if rows else None

    @staticmethod
    async def delete_subscription(
        supabase: Client,
        *,
        subscription_id: UUID,
        simulation_id: UUID,
    ) -> bool:
        """Ein Abo loeschen. Gibt zurueck, ob wirklich eines wegging."""
        resp = await (
            supabase.table("intake_subscriptions")
            .delete()
            .eq("id", str(subscription_id))
            .eq("simulation_id", str(simulation_id))
            .execute()
        )
        return bool(extract_list(resp))

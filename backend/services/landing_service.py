"""Der Schnappschuss der Frontseite — jede Zahl gemessen, keine gesetzt.

Der Entwurf der neuen Frontseite trug drei Attrappen: `47 worlds`,
`3 epochs in play`, `128 resonances absorbed`. Gemessen am 31.08.2026 auf Prod
sind es **16**, **0** und **1**. Dazu nannte er zwei Welten, die es nicht gibt —
ausgerechnet als kriechbare Links in der SEO-Fußzeile. Dieser Dienst existiert,
damit keine dieser Zahlen und keiner dieser Namen je wieder aus einer Konstante
kommt.

Zwei Fallen, die beim Messen aufgingen und die hier ausdrücklich vermieden werden:

**Erstens: der Bestandsfilter.** `SimulationService.get_platform_stats` zählte
`simulation_type='template' AND deleted_at IS NULL` — ohne `status`. Das Ergebnis
war richtig, weil zufällig alle 16 Vorlagen `active` sind; mit der ersten
archivierten Welt hätte die Frontseite mit ihr weitergeworben. Der Zähler filtert
`status` seit dem 31.08.2026 mit (`simulation_service.py`); dieser Dienst tat es
von Anfang an, und beide schneiden jetzt gleich. Derselbe Fehler steckt weiterhin
in der Sicht `active_agents` (N3).

**Zweitens: ein Status ist kein Betrieb.** `game_epochs` kennt gar kein
`status='active'` — die Werte auf Prod sind `foundation`, `competition`, `lobby`.
Ein reiner Statusfilter zählt deshalb **7 laufende Epochen**, und die Frontseite
würde „7 Epochen im Spiel" behaupten. Gemessen bewegt sich keine davon:
164 bis 185 Tage ohne Änderung, sechs der sieben heißen „Academy Training" oder
„bob". Eine Epoche gilt hier nur dann als im Spiel, wenn sie in einem spielenden
Status steht UND sich bewegt hat. Ergebnis: 0 — dieselbe Zahl, die der Plan
nannte, aber aus dem Grund, der wirklich zutrifft.

Dieselbe Unterscheidung gilt für Welten: `worlds_live` ist Bestand,
`worlds_transmitting` ist Betrieb. Der Entwurf wirbt mit „worlds transmitting",
also muss der Betrieb getrennt gemessen werden. Heute sind beide 16, und dass
sie gleich sind, ist eine Aussage — keine Selbstverständlichkeit.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from typing import Final

from backend.utils.responses import extract_list
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)


#: Wie frisch ein Herzschlag sein muss, damit eine Welt als sendend gilt.
#:
#: Der Tick läuft mit einer Untergrenze von zwei Stunden
#: (`heartbeat_service`, `max(7200, …)`). Zwei Tage sind also rund
#: vierundzwanzig verpasste Ticks — großzügig genug, dass ein Wartungsfenster
#: oder ein Neustart die Frontseite nicht in eine Falschaussage stürzt, und eng
#: genug, dass eine wirklich eingefrorene Welt nicht als sendend gilt.
#: Velgarien stand vom 25.03. an monatelang still (stiller Skip-Zweig), ohne
#: dass es irgendwo sichtbar war — genau das soll diese Grenze aufdecken.
_TRANSMITTING_WINDOW: Final = timedelta(days=2)

#: Wie frisch eine Epoche sein muss, damit sie als „im Spiel" gilt.
#:
#: Epochen bewegen sich in Zyklen, nicht in Ticks — ein Zyklus kann Tage
#: dauern, und zwischen zwei Zügen darf Ruhe liegen. Vierzehn Tage sind
#: reichlich bemessen. Der Bestand auf Prod liegt trotzdem weit darüber: die
#: jüngste Änderung ist 164 Tage her.
_EPOCH_WINDOW: Final = timedelta(days=14)

#: Status, in denen eine Epoche gespielt wird. `lobby` gehört NICHT dazu: eine
#: Epoche, die auf Mitspieler wartet, ist nicht im Spiel, und die Frontseite
#: soll das Warten nicht als Betrieb ausgeben.
_EPOCH_PLAYING_STATUSES: Final = ("foundation", "competition", "reckoning")

#: Wie viele Welten das Raster trägt (Entwurf: vier Spalten).
_GRID_SIZE: Final = 4

#: Wie viele Dossierkarten der Entwurf auffächert.
_CITIZEN_COUNT: Final = 3


class LandingService:
    """Liest den öffentlichen Zustand der Plattform für die Frontseite."""

    @staticmethod
    async def _live_world_rows(anon: Client) -> list[dict]:
        """Jede lebende Welt mit den Feldern, die das Raster braucht.

        `status='active'` ist Teil der Bedingung, nicht Beiwerk: ohne ihn wirbt
        die Frontseite mit archivierten Welten, sobald es die erste gibt.
        """
        response = await (
            anon.table("simulations")
            .select(
                "id, slug, name, name_de, description, description_de, banner_url, theme, last_heartbeat_at",
            )
            .eq("simulation_type", "template")
            .eq("status", "active")
            .is_("deleted_at", "null")
            .execute()
        )
        return extract_list(response)

    #: Wie viele Sätze der Schreibmaschinen-Effekt bekommt. Mehr wäre Ladung
    #: ohne Wirkung — niemand sieht dem Effekt zwanzig Sätze lang zu.
    _PROMPT_COUNT: Final = 12

    #: Die Längenspanne, in der ein Satz getippt lesbar bleibt. Gemessen reicht
    #: der Bestand von 127 bis 1 122 Zeichen; ein Satz von 1 122 Zeichen tippt
    #: sich über eine Minute und hat die Seite längst verloren. Das ist eine
    #: Darstellungsfrage und steht deshalb HIER und nicht in der Sicht: die
    #: Sicht gibt den Bestand heraus, dieser Dienst wählt fürs Schaufenster.
    _PROMPT_MIN_CHARS: Final = 80
    _PROMPT_MAX_CHARS: Final = 420

    @classmethod
    async def _forge_prompts(cls, anon: Client) -> list[dict]:
        """Die echten Sätze, aus denen Welten wurden.

        Bis zum 31.08.2026 tippte der Abschnitt zwanzig erfundene Beispiele.
        Auf Prod liegen 26 echte Ausgangssätze, 16 davon aus abgeschlossenen
        Läufen — der Nutzer hat entschieden, dass sie gezeigt werden dürfen.

        Gelesen wird über die Sicht ``public_forge_prompts`` (Migration 314),
        die GENAU EINE Spalte herausgibt. ``forge_drafts`` selbst trägt
        ``user_id``, alle Zwischenstände und das Fehlerprotokoll; wer eine
        Zeile davon hat, hat jede Spalte darin.

        Fällt die Abfrage aus, kommt eine leere Liste zurück und der Abschnitt
        tippt seine Beispiele. Public-First: die Frontseite zeigt nie einen
        Fehler.
        """
        try:
            response = await anon.table("public_forge_prompts").select("seed_prompt").execute()
        except Exception:  # noqa: BLE001 — die Frontseite degradiert, sie scheitert nicht
            logger.warning("Forge-Sätze nicht verfügbar", exc_info=True)
            return []
        texts = [" ".join((row.get("seed_prompt") or "").split()) for row in extract_list(response)]
        fitting = [text for text in texts if cls._PROMPT_MIN_CHARS <= len(text) <= cls._PROMPT_MAX_CHARS]
        # Zweisprachig ist das Feld nicht: ein Ausgangssatz wurde in einer
        # Sprache geschrieben und bleibt darin. `text_de` bleibt leer, und
        # `t(prompt, 'text')` fällt dann auf `text` zurück — richtig so, denn
        # eine maschinelle Übersetzung eines fremden Satzes wäre eine Fälschung.
        return [{"text": text} for text in fitting[: cls._PROMPT_COUNT]]

    @staticmethod
    async def _agent_counts(anon: Client, world_ids: list[str]) -> dict[str, int]:
        """Bürgerzahl je Welt aus der Übersichtssicht.

        `simulation_dashboard` trägt die Zahlen bereits aufsummiert; sie hier
        erneut zu zählen wäre eine zweite Wahrheit über dieselbe Größe.
        """
        if not world_ids:
            return {}
        response = await (
            anon.table("simulation_dashboard")
            .select("simulation_id, agent_count")
            .in_("simulation_id", world_ids)
            .execute()
        )
        return {str(row["simulation_id"]): int(row.get("agent_count") or 0) for row in extract_list(response)}

    @staticmethod
    async def _count(anon: Client, table: str, world_ids: list[str]) -> int:
        """Zeilen einer Tabelle, auf lebende Welten eingegrenzt."""
        if not world_ids:
            return 0
        response = await (
            anon.table(table)
            .select("id", count="exact")
            .in_("simulation_id", world_ids)
            .is_("deleted_at", "null")
            .execute()
        )
        return response.count or 0

    @staticmethod
    async def _zone_count(anon: Client, world_ids: list[str]) -> int:
        """Zonen lebender Welten.

        Eigener Zähler und nicht ``_count``: ``zones`` führt keine Spalte
        ``deleted_at``, der gemeinsame Zähler würde also auf eine Spalte
        filtern, die es nicht gibt — und postgrest antwortet darauf mit einem
        Fehler, nicht mit null.
        """
        if not world_ids:
            return 0
        response = await anon.table("zones").select("id", count="exact").in_("simulation_id", world_ids).execute()
        return response.count or 0

    @staticmethod
    async def _epochs_in_play(anon: Client, now: datetime) -> int:
        """Epochen in einem spielenden Status, die sich auch bewegt haben.

        Der Statusfilter allein zählt auf Prod 7 und wäre eine Falschaussage.
        """
        response = await (
            anon.table("game_epochs")
            .select("id", count="exact")
            .in_("status", list(_EPOCH_PLAYING_STATUSES))
            .gte("updated_at", (now - _EPOCH_WINDOW).isoformat())
            .execute()
        )
        return response.count or 0

    @staticmethod
    async def _resonance_count(anon: Client) -> int:
        response = await (
            anon.table("substrate_resonances").select("id", count="exact").is_("deleted_at", "null").execute()
        )
        return response.count or 0

    @staticmethod
    async def _memory_count(anon: Client, world_ids: list[str]) -> int:
        """Erinnerungen der Bürger lebender Welten.

        `agent_memories` hat keine `simulation_id`; der Weg führt über die
        Agenten. Ein LEFT JOIN wäre hier sinnlos — es geht um genau die
        Erinnerungen, die zu einem dieser Agenten gehören.
        """
        if not world_ids:
            return 0
        agents = await (
            anon.table("agents").select("id").in_("simulation_id", world_ids).is_("deleted_at", "null").execute()
        )
        agent_ids = [str(row["id"]) for row in extract_list(agents)]
        if not agent_ids:
            return 0
        response = await anon.table("agent_memories").select("id", count="exact").in_("agent_id", agent_ids).execute()
        return response.count or 0

    @staticmethod
    async def _citizens(anon: Client, worlds: list[dict]) -> list[dict]:
        """Drei Bürger mit Porträt UND Beruf für die Dossierkarten.

        Gezogen aus den bestbevölkerten Welten des Rasters, damit die Karten
        zur Seite passen und nicht aus einer Welt kommen, die weiter unten gar
        nicht vorkommt.

        Die Bedingungen sind an der Karte gemessen, nicht gewählt. Die
        Dossierkarte trägt Bild, Namensschild und die Zeile „Beruf · Zone" — ein
        Feld, das fehlt, ist auf der Karte eine Lücke, keine Kleinigkeit.
        Gemessen am 31.08.2026 über die 108 Agenten lebender Welten: 108 haben
        ein Porträt und eine Kennung, **66 haben einen Beruf**. Ohne die
        Beruf-Bedingung zog die Abfrage drei Velgarien-Agenten ohne einen, und
        die Zeile wäre leer geblieben. 66 Bewerber für drei Plätze sind
        reichlich — die Bedingung kostet also nichts und schließt eine Lücke.

        Die Zone kommt als eingebetteter LEFT JOIN (kein ``!inner``): ein Agent
        ohne Zone soll die Karte nicht aus der Auswahl werfen, die Zeile trägt
        dann nur den Beruf.
        """
        if not worlds:
            return []
        by_id = {str(world["id"]): world for world in worlds}
        response = await (
            anon.table("agents")
            .select(
                "slug, name, primary_profession, primary_profession_de, "
                "character, character_de, portrait_image_url, simulation_id, "
                "zones(name)",
            )
            .in_("simulation_id", list(by_id))
            .not_.is_("portrait_image_url", "null")
            .not_.is_("slug", "null")
            .not_.is_("primary_profession", "null")
            .is_("deleted_at", "null")
            .limit(_CITIZEN_COUNT)
            .execute()
        )
        citizens = []
        for row in extract_list(response):
            world = by_id.get(str(row.get("simulation_id")))
            if not world or not world.get("slug"):
                continue
            zone = row.get("zones")
            citizens.append(
                {
                    "slug": row["slug"],
                    "name": row["name"],
                    "profession": row.get("primary_profession"),
                    "profession_de": row.get("primary_profession_de"),
                    "character": row.get("character"),
                    "character_de": row.get("character_de"),
                    "portrait_image_url": row.get("portrait_image_url"),
                    "zone_name": (zone or {}).get("name") if isinstance(zone, dict) else None,
                    "simulation_slug": world["slug"],
                    "simulation_name": world["name"],
                },
            )
        return citizens

    @classmethod
    async def get_snapshot(cls, anon: Client) -> dict:
        """Zahlen, vier Welten und drei Bürger — in einem Zug.

        Der Aufrufer fängt Fehler ab und degradiert auf einen leeren
        Schnappschuss: die Frontseite darf nie einen Fehler zeigen, aber sie
        darf auch nie eine erfundene Zahl zeigen. Leer ist die einzige ehrliche
        Rückfallebene.
        """
        now = datetime.now(UTC)
        fresh_since = now - _TRANSMITTING_WINDOW

        worlds = await cls._live_world_rows(anon)
        world_ids = [str(world["id"]) for world in worlds]

        def _is_transmitting(world: dict) -> bool:
            raw = world.get("last_heartbeat_at")
            if not raw:
                return False
            try:
                beat = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
            except ValueError:
                logger.warning("Unlesbarer Herzschlag-Zeitstempel: %r", raw)
                return False
            if beat.tzinfo is None:
                beat = beat.replace(tzinfo=UTC)
            return beat >= fresh_since

        agent_counts = await cls._agent_counts(anon, world_ids)

        # Das Raster zeigt die bestbevölkerten Welten. Bei Gleichstand
        # entscheidet der jüngere Herzschlag, damit die Reihenfolge stabil ist
        # und nicht bei jedem Aufruf springt.
        ranked = sorted(
            worlds,
            key=lambda w: (
                agent_counts.get(str(w["id"]), 0),
                str(w.get("last_heartbeat_at") or ""),
            ),
            reverse=True,
        )
        grid = [world for world in ranked if world.get("slug")][:_GRID_SIZE]

        counts = {
            "worlds_live": len(worlds),
            "worlds_transmitting": sum(1 for world in worlds if _is_transmitting(world)),
            "epochs_in_play": await cls._epochs_in_play(anon, now),
            "resonances": await cls._resonance_count(anon),
            "citizens": await cls._count(anon, "agents", world_ids),
            "buildings": await cls._count(anon, "buildings", world_ids),
            "memories": await cls._memory_count(anon, world_ids),
            "events": await cls._count(anon, "events", world_ids),
            "zones": await cls._zone_count(anon, world_ids),
        }

        forge_prompts = await cls._forge_prompts(anon)

        return {
            "counts": counts,
            "forge_prompts": forge_prompts,
            "worlds": [
                {
                    "slug": world["slug"],
                    "name": world["name"],
                    "name_de": world.get("name_de"),
                    "description": world.get("description"),
                    "description_de": world.get("description_de"),
                    "banner_url": world.get("banner_url"),
                    "theme": world.get("theme"),
                    "agent_count": agent_counts.get(str(world["id"]), 0),
                    "transmitting": _is_transmitting(world),
                }
                for world in grid
            ],
            "citizens": await cls._citizens(anon, ranked[:_GRID_SIZE]),
            "measured_at": now,
        }

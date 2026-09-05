"""Wenn eine neue Beobachtung eine alte aufhebt.

── DER BEFUND, DER DIESEN DIENST AUSGELÖST HAT ───────────────────────────────

Migration 379 hat dem Gedächtnis Gültigkeit gegeben: ``valid_until``,
``superseded_by``, ``fn_supersede_memory``. Der Abruf achtet sie, die
Oberfläche zeigt sie, ``AgentMemoryService.supersede`` schreibt sie.

Gemessen am 05.09.2026, unmittelbar nach dem Ausrollen:

    Erinnerungen gesamt                   504
    davon mit Gültigkeitsfenster            0
    davon als überholt markiert             0

Der Weg war gebaut und ging ihn niemand. Es fehlte nicht das Datenmodell,
sondern der ERKENNER.

── ZWEI STUFEN, UND DIE ERSTE KOSTET NICHTS ──────────────────────────────────

Ein Modellaufruf je Beobachtung wäre teuer. Aber die Einbettungen liegen
längst da, und ein Widerspruch braucht Nähe: „X ist Archivarin" und „X ist
nicht mehr Archivarin" stehen im Vektorraum dicht beieinander, „X ist
Archivarin" und „es regnet" nicht.

Vorher gemessen, an 495 eingebetteten Beobachtungen auf Produktion — der
Abstand jeder Beobachtung zu ihrem nächsten ÄLTEREN Nachbarn derselben Figur:

    min 0,057 · p05 0,136 · p25 0,232 · Median 0,341 · max 0,829

    Kandidaten unter Abstand   0,05     0 von 496
                               0,10     7
                               0,15    28     ← gewählt
                               0,20    66
                               0,25   120

Der Vektor wirft 94 % weg (``fn_supersede_candidates``, Migration 383), das
Modell entscheidet nur den Rest. Auf Produktion sind das 30 Paare über
11 Welten.

⚠ Die drei ähnlichsten Paare lagen 1 bis 2 Minuten auseinander und waren
fast gleich lang — das sind Beinahe-Doppelungen aus aufeinanderfolgenden
Zügen, keine Widersprüche. Genau deshalb entscheidet nicht der Abstand,
sondern das Modell, und genau deshalb sagt die Vorlage „im Zweifel: nein".

── DIE RICHTUNG DES ZWEIFELS ─────────────────────────────────────────────────

Eine fälschlich aufgehobene Erinnerung nimmt einer Figur etwas weg, das sie
wusste. Eine fälschlich behaltene kostet Platz. Der zweite Fehler ist der
billigere, also fällt jeder Zweifel auf NEIN:

* die Vorlage sagt es ausdrücklich,
* ``judge_memory_supersession`` wertet eine unlesbare Antwort als NEIN,
* das Merkmalstor steht auf AUS.

── WAS DIESER DIENST NICHT TUT ───────────────────────────────────────────────

Er löscht nichts. „Überholt" heisst: fällt aus dem Abruf, die Zeile bleibt
stehen. Ein Gedächtnis, das Vergangenes nicht mehr benennen kann, ist ärmer
als eines, das zu viel behält (Migration 379).

Und er läuft nicht im Anfragepfad. Wie ``ContinuationService`` hängt er am
Herzschlag: eigener Zweck, eigenes Budget, eigenes Tor.
"""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from backend.services.agent_memory_service import AgentMemoryService
from backend.services.ai_utils import key_source_for
from backend.services.generation_service import GenerationService
from backend.utils.responses import extract_list
from backend.utils.settings import parse_setting_bool
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

#: Das Merkmalstor. Vorgabe AUS.
#:
#: Dieser Dienst SCHREIBT ins Gedächtnis. Ein Merkmal, das einer Figur etwas
#: wegnehmen kann, das sie wusste, läuft nicht an, weil jemand vergessen hat,
#: es abzuschalten.
FEATURE_GATE = "memory_supersede_enabled"

#: Der eigene Modellzweck (``ai_purposes.py``). Nicht ``chat_response``: eine
#: Änderung an der Chat-Vorgabe darf diese Prüfung nicht still verteuern.
PURPOSE = "memory_supersede"

#: Ab welchem Vektorabstand ein Paar überhaupt vorgelegt wird.
#:
#: 0,15 — gemessen, nicht gewählt: darüber liegen 66 von 496 Beobachtungen
#: (13 %), darunter 28 (5,6 %), und bei 0,10 nur noch 7. Die Schwelle steht
#: HIER und nicht in der Migration, weil sie eine Spielregel ist und keine
#: Struktur: sie zu ändern kostet einen Deploy, keine Datenwanderung.
KANDIDAT_ABSTAND = 0.15

#: Wie viele Paare EIN Takt höchstens beurteilt.
#:
#: Ein Modellaufruf je Paar. Fünf sind bei 30 Kandidaten auf Produktion sechs
#: Takte bis zum Durchlauf — langsam genug, dass ein Fehlurteil auffällt,
#: bevor es sich vervielfacht.
BUDGET = 5


class MemorySupersedeService:
    """Die Herzschlag-Phase, die überholte Erinnerungen als überholt markiert."""

    @classmethod
    async def run_for_simulation(
        cls,
        admin: Client,
        simulation_id: UUID,
        *,
        budget: int = BUDGET,
        locale: str = "de",
        api_key: str | None = None,
    ) -> list[dict[str, Any]]:
        """Kandidaten holen, beurteilen, Überholtes markieren.

        Gibt die durchgeführten Überholungen zurück — für die Chronik und
        damit ein Mensch nachlesen kann, was verschwunden ist.
        """
        if not await cls._gate_open(admin):
            return []

        paare = await cls._candidates(admin, simulation_id, budget=budget)
        if not paare:
            return []

        gen = GenerationService(admin, simulation_id, api_key, key_source=key_source_for(api_key))
        namen = await cls._agent_names(admin, [p["kandidat_agent_id"] for p in paare])

        erledigt: list[dict[str, Any]] = []
        for paar in paare:
            wer = namen.get(str(paar["kandidat_agent_id"]), "Agent")
            try:
                urteil = await gen.judge_memory_supersession(
                    agent_name=wer,
                    older_statement=str(paar["aeltere_inhalt"]),
                    newer_statement=str(paar["neuere_inhalt"]),
                    locale=locale,
                )
            except Exception:
                # Ein Paar, dessen Urteil scheitert, darf die uebrigen nicht
                # mitnehmen — und den Takt schon gar nicht.
                logger.exception("Urteil ueber Paar %s/%s gescheitert", paar["aeltere_id"], paar["neuere_id"])
                continue

            if not urteil.supersedes:
                logger.debug(
                    "kein Widerspruch (%s): %s", round(float(paar["abstand"]), 3), urteil.reason[:80]
                )
                continue

            # Das Fensterende ist der Zeitpunkt der NEUEREN Beobachtung, nicht
            # `now()`: die alte galt bis dahin, nicht bis zu dem Takt, in dem
            # jemand es bemerkt hat. Dieselbe Unterscheidung wie beim
            # Wasserstand der Reflexion.
            await AgentMemoryService.supersede(
                admin,
                UUID(str(paar["aeltere_id"])),
                UUID(str(paar["neuere_id"])),
            )
            erledigt.append(
                {
                    "agent_id": str(paar["kandidat_agent_id"]),
                    "alt": str(paar["aeltere_id"]),
                    "neu": str(paar["neuere_id"]),
                    "abstand": round(float(paar["abstand"]), 4),
                    "grund": urteil.reason,
                }
            )
            logger.info(
                "Erinnerung %s als ueberholt markiert (Abstand %s): %s",
                paar["aeltere_id"],
                round(float(paar["abstand"]), 3),
                urteil.reason[:120],
            )
        return erledigt

    # ── Torwaechter ───────────────────────────────────────────────────────

    @staticmethod
    async def _gate_open(admin: Client) -> bool:
        """Fail-closed. Fehlt die Zeile, laeuft nichts."""
        try:
            response = await (
                admin.table("platform_settings")
                .select("setting_value")
                .eq("setting_key", FEATURE_GATE)
                .limit(1)
                .execute()
            )
        except Exception:
            logger.exception("Merkmalstor %s nicht gelesen – bleibt zu", FEATURE_GATE)
            return False
        rows = extract_list(response)
        return bool(rows) and parse_setting_bool(rows[0].get("setting_value"))

    # ── Die billige Stufe ─────────────────────────────────────────────────

    @staticmethod
    async def _candidates(
        admin: Client, simulation_id: UUID, *, budget: int
    ) -> list[dict[str, Any]]:
        """Die Paare, ueber die ueberhaupt geurteilt wird.

        EINE Abfrage. Der Vektorabstand ist ein Operator und gehoert in SQL;
        ein Python-Durchlauf ueber alle Paare waere O(n²) ueber die
        Anwendungsgrenze (ADR-007, Migration 383).
        """
        try:
            response = await admin.rpc(
                "fn_supersede_candidates",
                {
                    "p_simulation_id": str(simulation_id),
                    "p_max_distance": KANDIDAT_ABSTAND,
                    "p_limit": max(0, budget),
                },
            ).execute()
        except Exception:
            logger.exception("Kandidatensuche fuer %s gescheitert", simulation_id)
            return []
        return extract_list(response)

    @staticmethod
    async def _agent_names(admin: Client, agent_ids: list[Any]) -> dict[str, str]:
        """Die Namen der betroffenen Figuren, in EINER Abfrage.

        Der Name geht in den Prompt; ohne ihn urteilte das Modell ueber
        „Agent" und verlöre den einzigen Anhaltspunkt, um wen es geht.
        """
        ids = [str(a) for a in agent_ids if a]
        if not ids:
            return {}
        try:
            response = await admin.table("agents").select("id, name").in_("id", ids).execute()
        except Exception:
            logger.exception("Namen fuer %s nicht gelesen", ids)
            return {}
        return {str(r["id"]): str(r.get("name") or "Agent") for r in extract_list(response)}

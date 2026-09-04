"""Wie viele Datenbank-Rundreisen ein Chat-Zug kosten darf.

Eine Messung, die einmal gemacht wurde, ist eine Tatsache. Eine Messung, die
bei jedem Lauf wiederholt wird, ist eine Zusage — und nur die hält den
nächsten Abruf auf, der sich je Agent einschleicht.

GEMESSEN AM 04.09.2026 gegen einen zählenden Doppelgänger, Gruppenzug mit drei
Agenten, VOR der Sanierung:

    Vorlauf                     5
    je Agent (Kontext)          9   ← 3× Verlauf, 3× Beziehungen, 3× Erinnerungen
    je Agent (Prompt-Bau)       6   ← 3× Stimmung, 3× Moodlets
                               ──
                               20   Rundreisen für EINE Nutzernachricht

Der Verschnitt war nicht die Anzahl der Abfragen, sondern ihre WIEDERHOLUNG:
derselbe Verlauf dreimal (bis zu 200 Zeilen), dieselbe Beziehungstabelle
dreimal, dieselbe Stimmungstabelle dreimal. Was sich je Sprecher unterscheidet,
ist nicht das Ergebnis, sondern seine Auslegung — und die ist reine Rechnung
ohne Netz.

Nach der Sanierung bleibt je Agent GENAU EINE Rundreise: der Erinnerungsabruf,
der wirklich je Agent ein anderes Ergebnis hat (Vektorabstand zu seinem
eigenen Gedächtnis).

⚠ DIESE DATEI MISST DEN ECHTEN AUFRUFPFAD, nicht eine Nachbildung davon. Eine
frühere Fassung des Messgeräts rief ``_build_group_turn_context`` ohne die
Werte, die der Vorlauf inzwischen mitgibt — sie mass den Rückfallweg und
meldete drei Rundreisen zu viel. Ein Messgerät, das den Aufrufer nicht
nachbildet, misst einen anderen Code.
"""

from __future__ import annotations

import collections
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from backend.services.chat.conversation_digest_service import ConversationDigestService
from backend.services.chat_ai_service import ChatAIService
from backend.services.prompt_service import PromptSource, ResolvedPrompt

#: Die Obergrenze je Agent im Kontextaufbau.
#:
#: EINS, und zwar der Erinnerungsabruf. Jede weitere Rundreise hier ist eine,
#: die mit der Zahl der Sprecher wächst — und die Kosten einer Gruppe steigen
#: dann nicht linear mit dem, was sie erzählt, sondern mit ihrer Größe.
RUNDREISEN_JE_AGENT = 1

#: Die Obergrenze im Prompt-Bau je Agent. NULL: Stimmung und Moodlets kommen
#: aus dem Vorlauf.
RUNDREISEN_PROMPTBAU = 0


class _Zaehler:
    """Ein Supabase-Doppelgänger, der nur zählt."""

    def __init__(self, antworten: dict[str, list] | None = None):
        self.zaehler: collections.Counter[str] = collections.Counter()
        self._antworten = antworten or {}

    # ── Das Protokoll, so weit der Chat es benutzt ────────────────────────

    def table(self, name: str):
        return _Kette(self, f"table:{name}", self._antworten.get(name, []))

    def rpc(self, name: str, *_a, **_k):
        return _Kette(self, f"rpc:{name}", [])

    @property
    def gesamt(self) -> int:
        return sum(self.zaehler.values())


class _Kette:
    def __init__(self, zaehler: _Zaehler, marke: str, daten: list):
        self._z, self._marke, self._daten = zaehler, marke, daten

    def __getattr__(self, name: str):
        if name == "execute":

            async def ex():
                self._z.zaehler[self._marke] += 1
                return MagicMock(data=self._daten, count=0)

            return ex
        return lambda *_a, **_k: self


def _vorlage() -> ResolvedPrompt:
    return ResolvedPrompt(
        template_type="chat_system_prompt",
        locale="de",
        prompt_content="x",
        system_prompt=None,
        variables=[],
        default_model=None,
        temperature=0.7,
        max_tokens=1024,
        negative_prompt=None,
        source=PromptSource.PLATFORM_LOCALE,
    )


@pytest.fixture()
def besetzung() -> list[dict]:
    return [{"id": str(uuid4()), "name": n} for n in ("Mira", "Elena", "Lena")]


async def _gruppenzug(besetzung: list[dict]) -> tuple[int, int, int]:
    """Ein vollständiger Gruppenzug. Gibt (Vorlauf, je Agent, Prompt-Bau)."""
    zaehler = _Zaehler(
        {
            "chat_conversation_agents": [{"agents": a} for a in besetzung],
            # Eine Stimmung MUSS dabei sein, sonst kehrt der Stimmungsaufbau
            # vorzeitig um und die Moodlet-Abfrage laeuft nie — die Messung
            # saehe dann besser aus, als sie ist.
            "agent_mood": [
                {"agent_id": a["id"], "mood_score": 10, "dominant_emotion": "calm", "stress_level": 100}
                for a in besetzung
            ],
        }
    )
    svc = ChatAIService(zaehler, uuid4(), openrouter_api_key="x")
    conv = uuid4()
    with (
        patch.object(svc._prompt_resolver, "resolve", AsyncMock(return_value=_vorlage())),
        patch.object(
            svc._model_resolver,
            "resolve_text_model",
            AsyncMock(return_value=MagicMock(model_id="deepseek/deepseek-v4-flash")),
        ),
    ):
        setup = await svc._prepare_group_turn(conv)
        vorlauf = zaehler.gesamt

        zaehler.zaehler.clear()
        # GENAU wie `stream_group_response` es ruft.
        for idx, agent in enumerate(setup.agents):
            await svc._build_group_turn_context(
                conversation_id=conv,
                agents=setup.agents,
                agent_names=setup.agent_names,
                idx=idx,
                event_context=setup.event_context,
                locale=setup.locale,
                user_message="x",
                saved_messages=[],
                model_id=setup.model.model_id,
                digest_text=ConversationDigestService.render(
                    setup.digest_rows, setup.locale, since=agent.get("_joined_at")
                ),
                history=setup.history,
                relationship_context=setup.relationships.get(str(agent["id"]), ""),
            )
        je_agent = zaehler.gesamt

        zaehler.zaehler.clear()
        for agent in setup.agents:
            await svc._build_generation_context(
                agent=agent,
                simulation={},
                locale=setup.locale,
                prompt_template=_vorlage(),
                history_messages=[],
            )
        promptbau = zaehler.gesamt
    return vorlauf, je_agent, promptbau


class TestNichtsWaechstMitDerZahlDerSprecher:
    """Die eigentliche Zusage. Alles andere hier ist Begleitung."""

    async def test_je_agent_bleibt_eine_rundreise(self, besetzung):
        _, je_agent, _ = await _gruppenzug(besetzung)
        assert je_agent == len(besetzung) * RUNDREISEN_JE_AGENT, (
            f"{je_agent} Rundreisen fuer {len(besetzung)} Agenten. Erlaubt ist genau eine "
            "je Agent (der Erinnerungsabruf). Alles andere — Verlauf, Beziehungen, "
            "Stimmung — ist fuer alle Sprecher dasselbe und gehoert in den Vorlauf."
        )

    async def test_der_promptbau_fragt_gar_nicht_mehr(self, besetzung):
        _, _, promptbau = await _gruppenzug(besetzung)
        assert promptbau == RUNDREISEN_PROMPTBAU, (
            f"{promptbau} Rundreisen im Prompt-Bau. Stimmung und Moodlets kommen aus "
            "dem Vorlauf; wer hier wieder fragt, fragt je Agent."
        )

    async def test_ein_vierter_agent_kostet_genau_eine_rundreise_mehr(self):
        """Die Gegenprobe. Sie beweist, dass die Zahl oben an der Bauform
        haengt und nicht daran, dass zufaellig drei Agenten dastehen."""
        drei = [{"id": str(uuid4()), "name": n} for n in ("A", "B", "C")]
        vier = [*drei, {"id": str(uuid4()), "name": "D"}]
        v3, a3, _ = await _gruppenzug(drei)
        v4, a4, _ = await _gruppenzug(vier)
        assert a4 - a3 == RUNDREISEN_JE_AGENT
        assert v4 == v3, "der Vorlauf haengt an der Zahl der Agenten"


class TestDerVerlaufWirdEINMALGeholt:
    async def test_nur_ein_abruf_von_chat_messages(self, besetzung):
        """Er ist fuer alle Sprecher derselbe: dieselbe Unterhaltung, dasselbe
        Modell, dieselbe Kappung. Bis zu 200 Zeilen, vorher dreimal."""
        zaehler = _Zaehler({"chat_conversation_agents": [{"agents": a} for a in besetzung]})
        svc = ChatAIService(zaehler, uuid4(), openrouter_api_key="x")
        conv = uuid4()
        with (
            patch.object(svc._prompt_resolver, "resolve", AsyncMock(return_value=_vorlage())),
            patch.object(
                svc._model_resolver,
                "resolve_text_model",
                AsyncMock(return_value=MagicMock(model_id="deepseek/deepseek-v4-flash")),
            ),
        ):
            setup = await svc._prepare_group_turn(conv)
            for idx, agent in enumerate(setup.agents):
                await svc._build_group_turn_context(
                    conversation_id=conv,
                    agents=setup.agents,
                    agent_names=setup.agent_names,
                    idx=idx,
                    event_context="",
                    locale=setup.locale,
                    user_message="x",
                    saved_messages=[],
                    model_id=setup.model.model_id,
                    history=setup.history,
                    relationship_context=setup.relationships.get(str(agent["id"]), ""),
                )
        assert zaehler.zaehler["table:chat_messages"] == 1

    async def test_ohne_mitgabe_holt_er_sich_einen(self, besetzung):
        """Der Rueckfall bleibt, fuer Aufrufer, die keinen mitgeben. Er ist
        der alte Weg, nicht der gewoehnliche — und ohne ihn waere ein
        vergessener Parameter ein leerer Verlauf statt eines langsamen."""
        zaehler = _Zaehler()
        svc = ChatAIService(zaehler, uuid4(), openrouter_api_key="x")
        with patch.object(svc._prompt_resolver, "resolve", AsyncMock(return_value=_vorlage())):
            await svc._build_group_turn_context(
                conversation_id=uuid4(),
                agents=besetzung,
                agent_names=[a["name"] for a in besetzung],
                idx=0,
                event_context="",
                locale="de",
                user_message="x",
                saved_messages=[],
            )
        assert zaehler.zaehler["table:chat_messages"] == 1


class TestBeziehungenUndStimmungJeSprecherAberEineAbfrage:
    async def test_eine_beziehungsabfrage_fuer_alle(self, besetzung):
        _, je_agent, _ = await _gruppenzug(besetzung)
        # Waere sie je Agent geblieben, stuende sie in `je_agent` — die
        # Obergrenze oben faengt es ab. Hier steht der Grund daneben.
        assert je_agent == len(besetzung), "die Beziehungen werden wieder je Agent geholt"

    def test_die_kappung_gilt_je_sprecher(self):
        """Ein `LIMIT 6` ueber die Vereinigung gaebe einem Agenten sechs und
        den anderen keine. Die Grenze gilt je Sprecher, also wird sie dort
        gezogen, wo nach Sprechern sortiert wird."""
        import inspect

        quelle = inspect.getsource(ChatAIService._build_relationship_contexts)
        assert ".limit(" not in quelle, "die Kappung ist zurueck ins SQL gerutscht"
        assert "len(je_agent[wer]) < 6" in quelle

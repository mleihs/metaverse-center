"""Wer im Gruppen-Prompt als ICH dasteht — und wer nicht.

BEFUND, der diese Datei ausgelöst hat (04.09.2026, Faden
7b2e37c3-46ab-423c-ab18-ed54c6428dc2, 79 Agentennachrichten ausgezählt):

    Zugposition 0   Marie Morgenrot   32 Nachrichten   0 Bruchstücke
    Zugposition 1   Benno Blattgold       32 Nachrichten   9 Bruchstücke
    Zugposition 2   Suse Sonnenblum         5 Nachrichten   0 Bruchstücke
    Einzelchat      Marie, davor      10 Nachrichten   0 Bruchstücke

Alle neun auf Position 1. Das ist keine Streuung, das ist eine Adresse:
Position 1 ist die erste, die einen FRISCHEN fremden Zug bekommt — und der ging
mit ``role: "assistant"`` hinaus, was im Protokoll heisst „das hast du gesagt".
Die Textmarke ``[Marie Morgenrot]: `` ist blosser Inhalt und verliert dagegen.

Die Prüfungen hier sind rein strukturell: kein LLM, kein Netz. Sie halten drei
Zusagen fest, von denen jede einzeln den Fehler zurückbrächte —

  1. Kein fremder Zug trägt ``role="assistant"``.
  2. Kein eigener Zug trägt eine ``[Name]``-Marke (sonst sieht sich die Figur
     beim Namen in der dritten Person und übernimmt den Ton — die zweite Hälfte
     des Fehlers, das Kippen zwischen Ich- und Er-Form).
  3. Keine zwei ``user``-Züge stehen nebeneinander (mehrere Anbieter lehnen das
     mit einem 400er ab; DeepSeek nicht, weshalb es sonst erst beim nächsten
     Modellwechsel aufschlüge).
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from backend.services.chat_ai_service import _DEPARTED_SPEAKER, ChatAIService
from backend.services.prompt_service import PromptSource, ResolvedPrompt

MARIE = "11111111-1111-1111-1111-111111111111"
BENNO = "22222222-2222-2222-2222-222222222222"
SUSE = "33333333-3333-3333-3333-333333333333"

AGENTS = [
    {"id": MARIE, "name": "Marie Morgenrot"},
    {"id": BENNO, "name": "Benno Blattgold"},
    {"id": SUSE, "name": "Suse Sonnenblum"},
]
AGENT_NAMES = [a["name"] for a in AGENTS]


def _agent_msg(agent_id: str, name: str, content: str) -> dict:
    """Eine Zeile, wie ``_load_history`` sie liefert — mit eingebettetem Namen."""
    return {
        "content": content,
        "sender_role": "assistant",
        "agent_id": agent_id,
        "agents": {"name": name},
    }


def _user_msg(content: str) -> dict:
    return {"content": content, "sender_role": "user", "agent_id": None}


HISTORY = [
    _user_msg("Wie steht es um die Akte?"),
    _agent_msg(MARIE, "Marie Morgenrot", "Ich habe sie heute morgen geholt."),
    _agent_msg(BENNO, "Benno Blattgold", "Und ich habe sie gegengelesen."),
    _agent_msg(SUSE, "Suse Sonnenblum", "Mir fiel der Stempel auf."),
]


@pytest.fixture()
def service() -> ChatAIService:
    return ChatAIService(MagicMock(), uuid4(), openrouter_api_key="test-key")


async def _turns(service: ChatAIService, idx: int, saved: list[dict] | None = None):
    """``_build_group_turn_context`` ohne Netz: Verlauf und Vorlage vorgegeben."""
    resolved = ResolvedPrompt(
        template_type="chat_group_instruction",
        locale="de",
        prompt_content="Die anderen Teilnehmer sind: {other_agent_names}.",
        system_prompt=None,
        variables=[],
        default_model=None,
        temperature=0.7,
        max_tokens=1024,
        negative_prompt=None,
        source=PromptSource.PLATFORM_LOCALE,
    )
    with (
        patch.object(service, "_load_history", return_value=list(HISTORY)),
        patch.object(service._prompt_resolver, "resolve", return_value=resolved),
    ):
        _extra, messages = await service._build_group_turn_context(
            conversation_id=uuid4(),
            agents=AGENTS,
            agent_names=AGENT_NAMES,
            idx=idx,
            event_context="",
            locale="de",
            user_message="Und was folgt daraus?",
            saved_messages=saved or [],
        )
    return messages


class TestFremderZugIstNiemalsAssistant:
    """Zusage 1 — die Kernaussage des Befundes."""

    @pytest.mark.parametrize("idx", [0, 1, 2])
    async def test_kein_fremder_satz_steht_als_eigener_da(self, service, idx):
        messages = await _turns(service, idx)
        eigener_text = AGENTS[idx]["name"]
        fremde_texte = [m["content"] for m in messages if m["role"] == "assistant"]
        for name in AGENT_NAMES:
            if name == eigener_text:
                continue
            assert not any(name in text for text in fremde_texte), f"{name} steht im assistant-Zug von {eigener_text}"

    async def test_eigene_saetze_kommen_als_assistant_an(self, service):
        messages = await _turns(service, 1)
        assistant = [m["content"] for m in messages if m["role"] == "assistant"]
        assert assistant == ["Und ich habe sie gegengelesen."]

    async def test_fremde_saetze_kommen_als_user_mit_marke_an(self, service):
        messages = await _turns(service, 1)
        alles = "\n".join(m["content"] for m in messages if m["role"] == "user")
        assert "[Marie Morgenrot]: Ich habe sie heute morgen geholt." in alles
        assert "[Suse Sonnenblum]: Mir fiel der Stempel auf." in alles


class TestEigenerZugTraegtKeineMarke:
    """Zusage 2 — die zweite Hälfte: das Kippen in die Er-Form."""

    @pytest.mark.parametrize("idx", [0, 1, 2])
    async def test_keine_klammer_im_eigenen_zug(self, service, idx):
        messages = await _turns(service, idx)
        for msg in messages:
            if msg["role"] == "assistant":
                assert not msg["content"].lstrip().startswith("["), msg["content"]


class TestFrischeZuegeDesLaufendenDurchgangs:
    """GENAU DIE STELLE, an der Position 1 brach.

    ``saved_messages`` sind die eben fertig gewordenen Züge. Sie gingen früher
    unbesehen als ``assistant`` hinaus — der zweite Sprecher las den Satz des
    ersten als seinen eigenen und schrieb daran weiter.
    """

    async def test_frischer_fremder_zug_ist_user(self, service):
        saved = [{"content": "Ich habe sie heute morgen geholt.", "sender_role": "assistant", "agent_id": MARIE}]
        messages = await _turns(service, 1, saved)
        letzter = messages[-1]
        # Zusammengefasst mit der Nutzerzeile davor (Zusage 3) — geprueft wird
        # deshalb die Rolle und die Marke, nicht der Zeilenanfang.
        assert letzter["role"] == "user"
        assert "[Marie Morgenrot]: Ich habe sie heute morgen geholt." in letzter["content"]
        assert not any(
            "Ich habe sie heute morgen geholt." in m["content"] for m in messages if m["role"] == "assistant"
        )

    async def test_frischer_eigener_zug_bleibt_assistant(self, service):
        """Kommt der eigene Zug im selben Durchgang zurück, ist er der eigene."""
        saved = [{"content": "Nachtrag von mir.", "sender_role": "assistant", "agent_id": BENNO}]
        messages = await _turns(service, 1, saved)
        assert messages[-1] == {"role": "assistant", "content": "Nachtrag von mir."}


class TestKeineZweiUserZuegeNebeneinander:
    """Zusage 3 — sonst 400er, sobald der Chat das Modell wechselt."""

    @pytest.mark.parametrize("idx", [0, 1, 2])
    async def test_rollen_wechseln_sich_ab(self, service, idx):
        messages = await _turns(service, idx)
        for davor, danach in zip(messages, messages[1:], strict=False):
            assert not (davor["role"] == "user" and danach["role"] == "user"), messages

    def test_zusammenfassen_erhaelt_beide_texte(self):
        merged = ChatAIService._merge_consecutive_user_turns(
            [
                {"role": "user", "content": "eins"},
                {"role": "user", "content": "zwei"},
                {"role": "assistant", "content": "drei"},
                {"role": "user", "content": "vier"},
            ]
        )
        assert merged == [
            {"role": "user", "content": "eins\n\nzwei"},
            {"role": "assistant", "content": "drei"},
            {"role": "user", "content": "vier"},
        ]

    def test_zusammenfassen_veraendert_die_eingabe_nicht(self):
        """Die Liste gehört dem Aufrufer; sie darf nicht unter ihm wegmutieren."""
        eingabe = [{"role": "user", "content": "eins"}, {"role": "user", "content": "zwei"}]
        ChatAIService._merge_consecutive_user_turns(eingabe)
        assert eingabe == [{"role": "user", "content": "eins"}, {"role": "user", "content": "zwei"}]


class TestAbgegangeneStimme:
    async def test_ohne_namen_steht_die_ehrliche_unbekannte_da(self, service):
        """Ein entfernter Teilnehmer ohne Einbettung: lieber unbekannt als falsch."""
        turn = service._as_turn(
            {
                "content": "Das war vor eurer Zeit.",
                "sender_role": "assistant",
                "agent_id": "99999999-9999-9999-9999-999999999999",
            },
            agents=AGENTS,
            current_agent_id=BENNO,
        )
        assert turn["role"] == "user"
        assert turn["content"].startswith(f"[{_DEPARTED_SPEAKER}]: ")


class TestSanitizeMarke:
    """Das Tor, das von 16 Marken im Faden 7b2e37c3 genau null fing."""

    def test_marke_ohne_doppelpunkt_wird_gefangen(self):
        text = "[Suse Sonnenblum] *Ich hebe die Hand.*"
        assert ChatAIService._sanitize_response(text, AGENT_NAMES) == "*Ich hebe die Hand.*"

    def test_marke_mit_doppelpunkt_wird_gefangen(self):
        text = "[Benno Blattgold]: Ich lese noch."
        assert ChatAIService._sanitize_response(text, AGENT_NAMES) == "Ich lese noch."

    def test_marke_ohne_klammer_wird_gefangen(self):
        assert ChatAIService._sanitize_response("Marie Morgenrot: Guten Tag.", AGENT_NAMES) == "Guten Tag."

    def test_marke_mitten_im_text_wird_gefangen(self):
        text = "Ich lese noch.\n[Suse Sonnenblum] Und ich stemple."
        assert ChatAIService._sanitize_response(text, AGENT_NAMES) == "Ich lese noch.\nUnd ich stemple."

    def test_regieanweisung_bleibt_stehen(self):
        """Der Grund, gegen NAMEN zu prüfen statt gegen ein weites Muster."""
        text = "[Sie legt die Akte hin] Ich habe genug gesehen."
        assert ChatAIService._sanitize_response(text, AGENT_NAMES) == text

    def test_ohne_namensliste_bleibt_es_beim_engen_verhalten(self):
        """Ein Tor, das rät, ist schlimmer als eines, das nichts weiss."""
        assert ChatAIService._sanitize_response("[Suse Sonnenblum] *hebt die Hand*") == "[Suse Sonnenblum] *hebt die Hand*"
        assert ChatAIService._sanitize_response("[Suse Sonnenblum]: hebt die Hand") == "hebt die Hand"


class TestAlteMarkenImBestand:
    """Die 16 Zeilen, die schon dastehen.

    Gemessen am 04.09.2026 im Faden 7b2e37c3: von 57 Agentennachrichten, die
    mit einer eckigen Klammer beginnen, sind 41 echte Regieanweisungen und 16
    fremde Namensmarken unter der EIGENEN ``agent_id`` — ``[Benno Blattgold] …``,
    gespeichert als Marie. Sie sind das Ergebnis des Fehlers und zugleich sein
    Lehrbuch, denn ein Modell lernt das Format aus dem Verlauf.
    """

    def test_eigener_zug_verliert_die_fremde_marke(self, service):
        turn = service._as_turn(
            {
                "content": "[Benno Blattgold] *Bennos Atem stockt.*",
                "sender_role": "assistant",
                "agent_id": MARIE,
            },
            agents=AGENTS,
            current_agent_id=MARIE,
        )
        assert turn == {"role": "assistant", "content": "*Bennos Atem stockt.*"}

    def test_fremder_zug_bekommt_keine_zweite_marke(self, service):
        """Ohne den Schnitt stuende hier ``[Marie Morgenrot]: [Benno Blattgold] …``."""
        turn = service._as_turn(
            {
                "content": "[Benno Blattgold] *Bennos Atem stockt.*",
                "sender_role": "assistant",
                "agent_id": MARIE,
                "agents": {"name": "Marie Morgenrot"},
            },
            agents=AGENTS,
            current_agent_id=BENNO,
        )
        assert turn == {"role": "user", "content": "[Marie Morgenrot]: *Bennos Atem stockt.*"}

    def test_regieanweisung_ueberlebt_den_verlauf(self, service):
        """41 der 57 — sie duerfen nicht angetastet werden."""
        text = "[Der Raum ist still, als sich die Tür einen Spalt öffnet.]"
        turn = service._as_turn(
            {"content": text, "sender_role": "assistant", "agent_id": MARIE},
            agents=AGENTS,
            current_agent_id=MARIE,
        )
        assert turn["content"] == text

    def test_der_bestand_bleibt_unangetastet(self, service):
        """Nur was das Modell sieht, ist bereinigt — die Zeile selbst nicht."""
        msg = {"content": "[Benno Blattgold] *Bennos Atem stockt.*", "sender_role": "assistant", "agent_id": MARIE}
        service._as_turn(msg, agents=AGENTS, current_agent_id=MARIE)
        assert msg["content"] == "[Benno Blattgold] *Bennos Atem stockt.*"

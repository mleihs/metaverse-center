"""Wer im Gruppen-Prompt als ICH dasteht — und wer nicht.

BEFUND, der diese Datei ausgelöst hat (04.09.2026, Faden
7b2e37c3-46ab-423c-ab18-ed54c6428dc2, 79 Agentennachrichten ausgezählt):

    Zugposition 0   Marie Morgenrot   32 Nachrichten   0 Bruchstücke
    Zugposition 1   Suse Sonnenblum       32 Nachrichten   9 Bruchstücke
    Zugposition 2   Benno Blattgold         5 Nachrichten   0 Bruchstücke
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

from backend.services.agent_memory_service import AgentMemoryService
from backend.services.chat_ai_service import _DEPARTED_SPEAKER, ChatAIService, _user_speaker
from backend.services.prompt_service import PromptSource, ResolvedPrompt

MIRA = "11111111-1111-1111-1111-111111111111"
ELENA = "22222222-2222-2222-2222-222222222222"
LENA = "33333333-3333-3333-3333-333333333333"

AGENTS = [
    {"id": MIRA, "name": "Marie Morgenrot"},
    {"id": ELENA, "name": "Suse Sonnenblum"},
    {"id": LENA, "name": "Benno Blattgold"},
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
    _agent_msg(MIRA, "Marie Morgenrot", "Ich habe frische Aepfel mitgebracht."),
    _agent_msg(ELENA, "Suse Sonnenblum", "Und ich habe sie gegengelesen."),
    _agent_msg(LENA, "Benno Blattgold", "Der Brunnen glitzert heute."),
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
    # Erinnerungen und Beziehungen gehen seit dem 04.09.2026 auch in den
    # Gruppenzug ein (davor bekam ein Agent in Gesellschaft keine). Sie sind
    # hier NICHT der Gegenstand — geprueft werden die Rollen — und beide
    # sprechen mit der Datenbank. Abgeschaltet, damit diese Datei rein
    # strukturell bleibt: kein LLM, kein Netz.
    with (
        patch.object(service, "_load_history", return_value=list(HISTORY)),
        patch.object(service._prompt_resolver, "resolve", return_value=resolved),
        patch.object(AgentMemoryService, "retrieve", return_value=[]),
        patch.object(service, "_build_relationship_context", return_value=""),
    ):
        _extra, messages, _anweisung = await service._build_group_turn_context(
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
        assert "[Marie Morgenrot]: Ich habe frische Aepfel mitgebracht." in alles
        assert "[Benno Blattgold]: Der Brunnen glitzert heute." in alles


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
        saved = [{"content": "Ich habe frische Aepfel mitgebracht.", "sender_role": "assistant", "agent_id": MIRA}]
        messages = await _turns(service, 1, saved)
        letzter = messages[-1]
        # Zusammengefasst mit der Nutzerzeile davor (Zusage 3) — geprueft wird
        # deshalb die Rolle und die Marke, nicht der Zeilenanfang.
        assert letzter["role"] == "user"
        assert "[Marie Morgenrot]: Ich habe frische Aepfel mitgebracht." in letzter["content"]
        assert not any(
            "Ich habe frische Aepfel mitgebracht." in m["content"] for m in messages if m["role"] == "assistant"
        )

    async def test_frischer_eigener_zug_bleibt_assistant(self, service):
        """Kommt der eigene Zug im selben Durchgang zurück, ist er der eigene."""
        saved = [{"content": "Nachtrag von mir.", "sender_role": "assistant", "agent_id": ELENA}]
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
            current_agent_id=ELENA,
        )
        assert turn["role"] == "user"
        assert turn["content"].startswith(f"[{_DEPARTED_SPEAKER}]: ")


class TestSanitizeMarke:
    """Das Tor, das von 16 Marken im Faden 7b2e37c3 genau null fing."""

    def test_marke_ohne_doppelpunkt_wird_gefangen(self):
        text = "[Benno Blattgold] *Ich hebe die Hand.*"
        assert ChatAIService._sanitize_response(text, AGENT_NAMES) == "*Ich hebe die Hand.*"

    def test_marke_mit_doppelpunkt_wird_gefangen(self):
        text = "[Suse Sonnenblum]: Ich lese noch ein Kapitel."
        assert ChatAIService._sanitize_response(text, AGENT_NAMES) == "Ich lese noch ein Kapitel."

    def test_marke_ohne_klammer_wird_gefangen(self):
        assert ChatAIService._sanitize_response("Marie Morgenrot: Guten Tag.", AGENT_NAMES) == "Guten Tag."

    def test_marke_mitten_im_text_wird_gefangen(self):
        text = "Ich lese noch ein Kapitel.\n[Benno Blattgold] Und ich giesse die Blumen."
        assert (
            ChatAIService._sanitize_response(text, AGENT_NAMES)
            == "Ich lese noch ein Kapitel.\nUnd ich giesse die Blumen."
        )

    def test_regieanweisung_bleibt_stehen(self):
        """Der Grund, gegen NAMEN zu prüfen statt gegen ein weites Muster."""
        text = "[Sie legt die Akte hin] Ich habe genug gesehen."
        assert ChatAIService._sanitize_response(text, AGENT_NAMES) == text

    def test_ohne_namensliste_bleibt_es_beim_engen_verhalten(self):
        """Ein Tor, das rät, ist schlimmer als eines, das nichts weiss."""
        assert (
            ChatAIService._sanitize_response("[Benno Blattgold] *winkt freundlich*")
            == "[Benno Blattgold] *winkt freundlich*"
        )
        assert ChatAIService._sanitize_response("[Benno Blattgold]: winkt freundlich") == "winkt freundlich"


class TestAlteMarkenImBestand:
    """Die 16 Zeilen, die schon dastehen.

    Gemessen am 04.09.2026 im Faden 7b2e37c3: von 57 Agentennachrichten, die
    mit einer eckigen Klammer beginnen, sind 41 echte Regieanweisungen und 16
    fremde Namensmarken unter der EIGENEN ``agent_id`` — ``[Suse Sonnenblum] …``,
    gespeichert als Marie. Sie sind das Ergebnis des Fehlers und zugleich sein
    Lehrbuch, denn ein Modell lernt das Format aus dem Verlauf.
    """

    def test_eigener_zug_verliert_die_fremde_marke(self, service):
        turn = service._as_turn(
            {
                "content": "[Suse Sonnenblum] *Suses Atem stockt.*",
                "sender_role": "assistant",
                "agent_id": MIRA,
            },
            agents=AGENTS,
            current_agent_id=MIRA,
        )
        assert turn == {"role": "assistant", "content": "*Suses Atem stockt.*"}

    def test_fremder_zug_bekommt_keine_zweite_marke(self, service):
        """Ohne den Schnitt stuende hier ``[Marie Morgenrot]: [Suse Sonnenblum] …``."""
        turn = service._as_turn(
            {
                "content": "[Suse Sonnenblum] *Suses Atem stockt.*",
                "sender_role": "assistant",
                "agent_id": MIRA,
                "agents": {"name": "Marie Morgenrot"},
            },
            agents=AGENTS,
            current_agent_id=ELENA,
        )
        assert turn == {"role": "user", "content": "[Marie Morgenrot]: *Suses Atem stockt.*"}

    def test_regieanweisung_ueberlebt_den_verlauf(self, service):
        """41 der 57 — sie duerfen nicht angetastet werden."""
        text = "[Der Raum ist still, als sich die Tür einen Spalt öffnet.]"
        turn = service._as_turn(
            {"content": text, "sender_role": "assistant", "agent_id": MIRA},
            agents=AGENTS,
            current_agent_id=MIRA,
        )
        assert turn["content"] == text

    def test_der_bestand_bleibt_unangetastet(self, service):
        """Nur was das Modell sieht, ist bereinigt — die Zeile selbst nicht."""
        msg = {"content": "[Suse Sonnenblum] *Suses Atem stockt.*", "sender_role": "assistant", "agent_id": MIRA}
        service._as_turn(msg, agents=AGENTS, current_agent_id=MIRA)
        assert msg["content"] == "[Suse Sonnenblum] *Suses Atem stockt.*"


class TestDerMenschHatAuchEineMarke:
    """Ein Agent übernimmt die Handlung des Menschen.

    Der Ablauf, schematisch und mit erfundenem Inhalt — der Wortlaut eines
    echten Gesprächs gehört weder in eine Datei noch in ein Commit-Log:

        Agent A schreibt eine Handlung dem MENSCHEN zu — richtig.
        Agent B übernimmt dieselbe Handlung Sekunden später für sich.

    Die Ursache liegt im zusammengesetzten Verlauf. So kommt er bei Agent B an:

        user   <Zeile des Menschen>

               [Marie Morgenrot]: *Du hältst einen Korb Äpfel in den Händen.*

               (nächste Zeile von Agent B)

    EIN Block, weil aufeinanderfolgende `user`-Züge zusammengefasst werden
    müssen. Maries Zeile hat einen Besitzer, die des Menschen hat KEINEN — und
    eine unbeschriftete Zeile zwischen beschrifteten liest sich wie herrenlose
    Erzählung.

    ⚠ Das Zusammenfassen ist Teil derselben Reparatur, die den Rollen-Fehler
    behoben hat. Sie hat diese zweite Lücke geöffnet. Eine Reparatur, die das
    tut, ist eine halbe.
    """

    def test_die_zeile_des_menschen_traegt_seine_marke(self, service):
        turn = service._as_turn(
            {"content": "Ich stelle den Korb auf den Tisch.", "sender_role": "user", "agent_id": None},
            agents=AGENTS,
            current_agent_id=MIRA,
        )
        # Gegen die MARKE, nicht gegen eine Zeichenkette. Sie hat sich am
        # 05.09.2026 geaendert (`[User]` -> `[dein Gegenueber]`), weil 11 von
        # 24 Zuegen die alte woertlich in ihre Prosa schrieben — dem Menschen
        # fehlt ein Name, also griff die Figur zur Marke. Was hier zugesagt
        # wird, ist der BESITZER der Zeile; welches Wort ihn bezeichnet, darf
        # sich aendern, ohne dass ein Tor bricht.
        marke = _user_speaker("de")
        assert turn == {"role": "user", "content": f"[{marke}]: Ich stelle den Korb auf den Tisch."}

    def test_im_einzelchat_bleibt_sie_weg(self, service):
        """Dort gibt es zwei Stimmen, die Rolle sagt schon alles, und eine
        Marke waere Laerm."""
        turn = service._as_turn(
            {"content": "Hallo.", "sender_role": "user", "agent_id": None},
            agents=[AGENTS[0]],
            current_agent_id=MIRA,
        )
        assert turn == {"role": "user", "content": "Hallo."}

    async def test_kein_satz_im_block_steht_ohne_besitzer(self, service):
        """Die Zusicherung, um die es geht: JEDE Zeile im zusammengefassten
        `user`-Block nennt, von wem sie ist."""
        messages = await _turns(service, 1)
        for msg in messages:
            if msg["role"] != "user":
                continue
            for zeile in msg["content"].split("\n"):
                if not zeile.strip():
                    continue
                assert zeile.lstrip().startswith("["), f"Zeile ohne Besitzer im user-Block: {zeile!r}"

    async def test_auch_die_frische_nachricht_traegt_sie(self, service):
        """Sonst stuende ausgerechnet der Satz, auf den geantwortet werden
        soll, als einziger ohne Besitzer da."""
        messages = await _turns(service, 1)
        marke = _user_speaker("de")
        assert any(f"[{marke}]: Und was folgt daraus?" in m["content"] for m in messages)

    def test_das_tor_kennt_die_marke_des_menschen(self, service):
        """Schreibt ein Modell `[User]: …` zurueck, ist das derselbe Fehler wie
        `[Marie Morgenrot]: …` — es hat die Protokollmarke fuer ein Textformat
        gehalten."""
        namen = ChatAIService._known_speakers(AGENT_NAMES)
        assert ChatAIService._sanitize_response("[User]: ich warte", namen) == "ich warte"

    def test_ohne_besetzung_wird_nicht_geraten(self):
        """Das Tor faellt auf sein enges Verhalten zurueck statt gegen einen
        einzelnen Namen zu raten."""
        assert ChatAIService._known_speakers(None) is None
        assert ChatAIService._known_speakers([]) == []


class TestDieAnweisungStehtVorDerAntwort:
    """Nicht im System-Prompt, sondern als Letztes.

    GEMESSEN am 04.09.2026: die Gruppen-Anweisung stand an Position 0 von 9 —
    vor dem ganzen Verlauf. In einem Faden mit 373 Nachrichten liegen
    zweihundert Züge dazwischen.

    Der Praktiker-Konsens ist eindeutig und trägt den einzigen quantifizierten
    Datenpunkt, den es zu dieser Frage gibt: 37 von 40 sauberen Durchläufen
    (DeepSeek, Temperatur 0, Sampler aus) mit der Regel unmittelbar vor der
    Antwort. SillyTavern nennt es „Post-History Instructions" bzw. eine
    Autorennotiz auf Tiefe 0.
    """

    def test_sie_wird_an_den_letzten_nutzerzug_gehaengt(self, service):
        msgs = service._append_closing_instruction(
            [
                {"role": "system", "content": "Persona"},
                {"role": "user", "content": "[User]: Und dann?"},
            ],
            "DIE REGEL",
        )
        assert len(msgs) == 2, "es darf kein zusaetzlicher Zug entstehen"
        assert msgs[-1]["content"].endswith("DIE REGEL")
        assert msgs[-1]["role"] == "user"

    def test_nach_einem_agentenzug_kommt_ein_eigener_zug(self, service):
        """Endet der Faden mit einer Agentenantwort, gibt es nichts, woran man
        anhaengen koennte — dann wird ein eigener `user`-Zug daraus."""
        msgs = service._append_closing_instruction(
            [
                {"role": "system", "content": "Persona"},
                {"role": "assistant", "content": "Ihre Antwort."},
            ],
            "DIE REGEL",
        )
        assert len(msgs) == 3
        assert msgs[-1] == {"role": "user", "content": "DIE REGEL"}

    def test_keine_system_rolle_mitten_im_verlauf(self, service):
        """Eine `system`-Rolle mitten im Verlauf ist bei OpenAI-kompatiblen
        Anbietern nicht verlaesslich — DeepSeek dokumentiert sie nur am Anfang.
        Dieselbe Vorsicht wie beim Zusammenfassen der `user`-Zuege."""
        msgs = service._append_closing_instruction(
            [{"role": "system", "content": "Persona"}, {"role": "user", "content": "x"}],
            "DIE REGEL",
        )
        assert [m["role"] for m in msgs].count("system") == 1

    def test_ohne_anweisung_bleibt_alles_wie_es_war(self, service):
        vorher = [{"role": "system", "content": "P"}, {"role": "user", "content": "x"}]
        assert service._append_closing_instruction(list(vorher), "") == vorher
        assert service._append_closing_instruction(list(vorher), "   ") == vorher

    async def test_der_gruppenzug_gibt_sie_getrennt_zurueck(self, service):
        """Sie darf NICHT in `extra_parts` landen — das ist der System-Prompt.
        Dort traegt `extra_parts` weiterhin INHALT (Ereignisse, Erinnerungen,
        Beziehungen, Vorgeschichte): was die Figur weiss, nicht was sie tun
        soll."""
        resolved = ResolvedPrompt(
            template_type="chat_group_instruction",
            locale="de",
            prompt_content="ANWEISUNG fuer {other_agent_names}.",
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
            patch.object(AgentMemoryService, "retrieve", return_value=[]),
            patch.object(service, "_build_relationship_context", return_value=""),
        ):
            extra_parts, _messages, closing = await service._build_group_turn_context(
                conversation_id=uuid4(),
                agents=AGENTS,
                agent_names=AGENT_NAMES,
                idx=0,
                event_context="EIN EREIGNIS",
                locale="de",
                user_message="x",
                saved_messages=[],
            )
        assert "ANWEISUNG" in closing
        assert not any("ANWEISUNG" in teil for teil in extra_parts)
        assert any("EIN EREIGNIS" in teil for teil in extra_parts), "der Inhalt fehlt vorn"

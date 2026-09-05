"""Die abschnittweise Vorgeschichte — und die eine Zusage, die alles trägt.

Die Bauform hat genau einen Grund, und er ist gemessen: arXiv:2308.15022 und
die Arbeiten danach beschreiben, wie ein Verdichter, der seine eigene frühere
Ausgabe wieder als Eingabe bekommt, sie für Grundwahrheit hält — ein einmal
falsch gesagter Satz überlebt jede weitere Runde und wird dabei bestätigt.

**Kein Pfad darf eine Verdichtung in eine andere führen.** Das ist keine
Verhaltensregel, die man einhalten kann oder auch nicht; es ist eine
Eigenschaft, die der Aufbau garantieren muss. Diese Datei prüft sie an der
Stelle, an der sie brechen würde: an dem, was in den Modellaufruf geht.

Die zweite Zusage ist die Vollständigkeit. Ein angefangener Abschnitt wird
NICHT verdichtet. Verdichtete man ihn, müsste er später ergänzt oder ersetzt
werden — und ein Ersetzen aus dem eigenen alten Wert ist genau die Rekursion
von oben, nur unter anderem Namen.

Die dritte: eine leere Antwort wird nicht gespeichert. Die
CHECK-Beschränkung aus 358 wiese sie ab, aber der eigentliche Grund ist ein
anderer — eine leere Zeile belegte die Abschnittsnummer, und der Abschnitt
wäre für immer unverdichtbar, weil `ensure_digests` ihn für erledigt hielte.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from backend.services.chat.conversation_digest_service import (
    MAX_DIGESTS_IN_PROMPT,
    SEGMENT_SIZE,
    ConversationDigestService,
)
from backend.services.prompt_service import PromptSource, ResolvedPrompt

CONV = uuid4()


def _resolved() -> ResolvedPrompt:
    return ResolvedPrompt(
        template_type="chat_conversation_digest",
        locale="de",
        prompt_content="Abschnitt {segment_index} zwischen {participant_names}:\n{transcript}\n({locale_name})",
        system_prompt=None,
        variables=[],
        default_model=None,
        temperature=0.3,
        max_tokens=700,
        negative_prompt=None,
        source=PromptSource.PLATFORM_LOCALE,
    )


def _messages(count: int, start: int = 0) -> list[dict]:
    return [
        {
            "content": f"Satz {start + i}",
            "sender_role": "assistant" if i % 2 else "user",
            "created_at": f"2026-09-0{1 + (i % 3)}T10:0{i % 10}:00+00:00",
            "agents": {"name": "Mira Steinfeld"} if i % 2 else None,
        }
        for i in range(count)
    ]


def _service(*, existing: list[dict], total: int, segment: list[dict]) -> ConversationDigestService:
    svc = ConversationDigestService(MagicMock(), uuid4(), openrouter_api_key="x")
    svc._load_digests = AsyncMock(return_value=existing)
    svc._count_messages = AsyncMock(return_value=total)
    svc._load_segment = AsyncMock(return_value=segment)
    svc._model_resolver.resolve_text_model = AsyncMock(return_value=MagicMock(model_id="deepseek/deepseek-v4-flash"))
    svc._prompt_resolver.resolve = AsyncMock(return_value=_resolved())
    svc._openrouter.generate = AsyncMock(return_value="Sie sprachen ueber die Akte.")
    svc._openrouter.last_usage = {"prompt_tokens": 100, "completion_tokens": 20}
    return svc


class TestKeineVerdichtungLiestEineAndere:
    """Die Zusage, die die ganze Bauform trägt."""

    async def test_der_aufruf_sieht_nur_den_urtext_seines_abschnitts(self):
        vorhanden = [
            {
                "segment_index": 0,
                "covers_from": "2026-09-01T00:00:00+00:00",
                "covers_to": "2026-09-01T12:00:00+00:00",
                "summary": "EINE FRUEHERE VERDICHTUNG, die niemals in einen Auftrag geraten darf.",
            }
        ]
        svc = _service(existing=vorhanden, total=2 * SEGMENT_SIZE, segment=_messages(SEGMENT_SIZE, start=40))
        svc._supabase.table.return_value.insert.return_value.execute = AsyncMock(return_value=MagicMock(data=[{}]))
        with patch("backend.services.chat.conversation_digest_service.AIUsageService.log", AsyncMock()):
            await svc.ensure_digests(CONV, participant_names=["Mira Steinfeld"], locale="de")

        gesendet = svc._openrouter.generate.await_args_list
        assert gesendet, "es wurde gar nicht verdichtet"
        for aufruf in gesendet:
            text = "\n".join(m["content"] for m in aufruf.kwargs["messages"])
            assert "EINE FRUEHERE VERDICHTUNG" not in text, (
                "eine Verdichtung ist in den Auftrag einer anderen geraten – "
                "genau die Fehlerhaeufung, die diese Bauform ausschliessen soll"
            )
            assert "Satz 40" in text, "der Urtext des Abschnitts fehlt"

    async def test_nur_fehlende_abschnitte_werden_erzeugt(self):
        """Ein vorhandener Abschnitt wird nicht noch einmal angefasst."""
        vorhanden = [{"segment_index": i, "covers_from": "x", "covers_to": "y", "summary": "s"} for i in range(3)]
        svc = _service(existing=vorhanden, total=3 * SEGMENT_SIZE, segment=_messages(SEGMENT_SIZE))
        erzeugt = await svc.ensure_digests(CONV, participant_names=["Mira"], locale="de")
        assert erzeugt == 0
        svc._openrouter.generate.assert_not_awaited()


class TestNurVollstaendigeAbschnitte:
    async def test_unter_einem_abschnitt_geschieht_nichts(self):
        svc = _service(existing=[], total=SEGMENT_SIZE - 1, segment=[])
        assert await svc.ensure_digests(CONV, participant_names=["Mira"], locale="de") == 0
        svc._openrouter.generate.assert_not_awaited()

    async def test_ein_angefangener_abschnitt_wird_nicht_verdichtet(self):
        """Zwischen Zaehlung und Auswahl kann geloescht worden sein. Ein
        unvollstaendiger Abschnitt truege sonst fuer immer die Nummer eines
        Abschnitts, den es so nie gab."""
        svc = _service(existing=[], total=SEGMENT_SIZE, segment=_messages(SEGMENT_SIZE - 5))
        assert await svc.ensure_digests(CONV, participant_names=["Mira"], locale="de") == 0
        svc._openrouter.generate.assert_not_awaited()


class TestEineLeereAntwortBelegtKeineNummer:
    async def test_leer_wird_nicht_gespeichert(self):
        svc = _service(existing=[], total=SEGMENT_SIZE, segment=_messages(SEGMENT_SIZE))
        svc._openrouter.generate = AsyncMock(return_value="   \n  ")
        einfuegen = MagicMock()
        svc._supabase.table.return_value.insert = einfuegen
        with patch("backend.services.chat.conversation_digest_service.AIUsageService.log", AsyncMock()):
            erzeugt = await svc.ensure_digests(CONV, participant_names=["Mira"], locale="de")
        assert erzeugt == 0
        einfuegen.assert_not_called()


class TestDasBuchWirdGefuehrt:
    """`WhisperService._generate_llm` bucht bis heute NICHT — Bond-Whispers
    tauchen in keiner Kostenauswertung auf. Nicht kopieren."""

    async def test_jeder_aufruf_steht_im_buch(self):
        svc = _service(existing=[], total=SEGMENT_SIZE, segment=_messages(SEGMENT_SIZE))
        svc._supabase.table.return_value.insert.return_value.execute = AsyncMock(return_value=MagicMock(data=[{}]))
        with patch("backend.services.chat.conversation_digest_service.AIUsageService.log", AsyncMock()) as buch:
            await svc.ensure_digests(CONV, participant_names=["Mira"], locale="de")
        buch.assert_awaited()
        assert buch.await_args.kwargs["purpose"] == "chat_digest"

    async def test_das_budget_geht_mit(self):
        """`test_llm_calls_carry_budget.py` erzwingt es per AST; hier steht,
        dass der Kontext auch den richtigen Zweck traegt."""
        svc = _service(existing=[], total=SEGMENT_SIZE, segment=_messages(SEGMENT_SIZE))
        svc._supabase.table.return_value.insert.return_value.execute = AsyncMock(return_value=MagicMock(data=[{}]))
        with patch("backend.services.chat.conversation_digest_service.AIUsageService.log", AsyncMock()):
            await svc.ensure_digests(CONV, participant_names=["Mira"], locale="de")
        budget = svc._openrouter.generate.await_args.kwargs["budget"]
        assert budget is not None
        assert budget.purpose == "chat_digest"


class TestEinLaufWirdGedeckelt:
    async def test_hoechstens_max_per_run(self):
        """Der erste Lauf fuer einen langen Faden waere sonst der teuerste –
        acht Modellaufrufe am Stueck, die niemand angefordert hat."""
        svc = _service(existing=[], total=8 * SEGMENT_SIZE, segment=_messages(SEGMENT_SIZE))
        svc._supabase.table.return_value.insert.return_value.execute = AsyncMock(return_value=MagicMock(data=[{}]))
        with patch("backend.services.chat.conversation_digest_service.AIUsageService.log", AsyncMock()):
            erzeugt = await svc.ensure_digests(CONV, participant_names=["Mira"], locale="de", max_per_run=2)
        assert erzeugt == 2
        assert svc._openrouter.generate.await_count == 2


class TestDerBlockFuerDenPrompt:
    async def test_leer_wenn_es_nichts_gibt(self):
        svc = _service(existing=[], total=0, segment=[])
        assert await svc.load_digest_text(CONV, "de") == ""

    async def test_die_neuesten_ueberleben_den_deckel(self):
        """Faellt etwas weg, dann das AELTESTE. Was vor einem halben Jahr
        besprochen wurde, ist ueber `agent_memories` weiter auffindbar."""
        viele = [
            {
                "segment_index": i,
                "covers_from": "2026-09-01T00:00:00+00:00",
                "covers_to": "2026-09-02T00:00:00+00:00",
                "summary": f"Abschnitt {i}",
            }
            for i in range(MAX_DIGESTS_IN_PROMPT + 3)
        ]
        svc = _service(existing=viele, total=0, segment=[])
        text = await svc.load_digest_text(CONV, "de")
        assert "Abschnitt 0" not in text
        assert f"Abschnitt {MAX_DIGESTS_IN_PROMPT + 2}" in text
        assert text.count("Abschnitt ") == MAX_DIGESTS_IN_PROMPT


class TestDieMitschriftIstKeinProtokoll:
    """Der Name steht als TEXT davor, und alles ist eine Zeile.

    Ginge die Mitschrift als Folge von `assistant`- und `user`-Zuegen hinaus,
    laese das Modell die fremden Zuege als eigene und schriebe das Gespraech
    fort, statt es zu berichten – derselbe Fehler, den Migration 356 im Chat
    selbst behoben hat, nur an anderer Stelle.
    """

    def test_der_sprecher_steht_im_text(self):
        zeile = ConversationDigestService._as_line(
            {"content": "Ich habe sie geholt.", "sender_role": "assistant", "agents": {"name": "Mira"}}
        )
        assert zeile == "Mira: Ich habe sie geholt."

    def test_der_mensch_heisst_user(self):
        zeile = ConversationDigestService._as_line({"content": "Und dann?", "sender_role": "user", "agents": None})
        assert zeile == "User: Und dann?"

    def test_eine_eingebettete_liste_wird_auch_gelesen(self):
        """postgrest liefert eine to-one-Einbettung mal als Objekt, mal als
        einelementige Liste."""
        zeile = ConversationDigestService._as_line(
            {"content": "x", "sender_role": "assistant", "agents": [{"name": "Elena"}]}
        )
        assert zeile.startswith("Elena: ")

    async def test_der_auftrag_enthaelt_keine_rollenfolge(self):
        svc = _service(existing=[], total=SEGMENT_SIZE, segment=_messages(SEGMENT_SIZE))
        svc._supabase.table.return_value.insert.return_value.execute = AsyncMock(return_value=MagicMock(data=[{}]))
        with patch("backend.services.chat.conversation_digest_service.AIUsageService.log", AsyncMock()):
            await svc.ensure_digests(CONV, participant_names=["Mira"], locale="de")
        gesendet = svc._openrouter.generate.await_args.kwargs["messages"]
        rollen = [m["role"] for m in gesendet]
        assert rollen.count("assistant") == 0, (
            "die Mitschrift ist als Gespraechsprotokoll hinausgegangen – das Modell "
            "liest fremde Zuege dann als eigene und schreibt fort statt zu berichten"
        )


@pytest.mark.parametrize("wert", [SEGMENT_SIZE, MAX_DIGESTS_IN_PROMPT])
def test_die_stellschrauben_sind_positiv(wert):
    """Beides sind Abwaegungen, keine Naturkonstanten – aber null waere ein
    stiller Ausfall: `ensure_digests` teilte durch null, `load_digest_text`
    gaebe immer leer zurueck, und niemand bekaeme eine Meldung."""
    assert wert > 0


# ═══════════════════════════════════════════════════════════════════════════
# Kein Abschnitt, der ohnehin woertlich dasteht
# ═══════════════════════════════════════════════════════════════════════════


class TestVerdichtungUndWortlautStehenNichtDoppelt:
    """Gemessen am 05.09.2026 am groessten Faden auf Produktion:

        Faden 585 Nachrichten = 14 Abschnitte à 40
        Verdichtung deckte ab   Nachricht   0–559
        woertlich gingen mit    Nachricht 385–584
        ÜBERLAPP                175 Nachrichten

    Dieselbe Strecke stand zweimal im Prompt: einmal als Bericht (8 095
    Token) und einmal im Original (~29 900 Token).

    Chub hat denselben Fehler und dieselbe Reparatur; ihre Doku sagt es
    woertlich: „We only summarize the messages that are out of context (aka
    messages that the AI no longer remembers)." Letta, LlamaIndex,
    AI Dungeon und Anthropic lassen die Verdichtung den Wortlaut ERSETZEN
    statt neben ihm zu stehen — keine der untersuchten Referenzen haelt
    beides zugleich.

    ⚠ Das heisst NICHT, dass Verdichtung besser waere als Wortlaut. Die
    Forschung sagt das Gegenteil: woertliche Ausschnitte liegen 22,0 Punkte
    VOR extrahierten Artefakten, und HaluMem misst ~40 % Fehler in
    extrahierten Gedaechtnisinhalten. Die Formel ist „woertlich, aber
    weniger davon" — deshalb faellt hier nur die DOPPLUNG weg, und die
    Verdichtung waechst nicht als Ausgleich.
    """

    @staticmethod
    def _zeilen():
        """Vier Abschnitte, je zehn Minuten, chronologisch."""
        return [
            {
                "segment_index": i,
                "covers_from": f"2026-09-05T10:{i * 10:02d}:00",
                "covers_to": f"2026-09-05T10:{i * 10 + 9:02d}:59",
                "summary": f"Abschnitt {i}",
                "agent_id": None,
            }
            for i in range(4)
        ]

    def test_ohne_schnitt_kommen_alle_abschnitte(self):
        """Die Gegenprobe zuerst: ohne `verbatim_from` aendert sich nichts.
        Ohne sie pruefte alles Weitere nur, dass die Funktion etwas
        weglaesst."""
        text = ConversationDigestService.render(self._zeilen(), "de")
        for i in range(4):
            assert f"Abschnitt {i}" in text

    def test_was_im_fenster_steht_faellt_weg(self):
        """Das Fenster beginnt um 10:20 — Abschnitt 2 und 3 liegen darin."""
        text = ConversationDigestService.render(self._zeilen(), "de", verbatim_from="2026-09-05T10:20:00")
        assert "Abschnitt 0" in text
        assert "Abschnitt 1" in text
        assert "Abschnitt 2" not in text
        assert "Abschnitt 3" not in text

    def test_ein_halb_hineinragender_abschnitt_faellt_auch_weg(self):
        """Verglichen wird `covers_to`. Ein Abschnitt, der nur zur Haelfte
        ins Fenster ragt, faellt weg — die weggelassene Haelfte steht
        woertlich da, waehrend ein doppelter Abschnitt beides kostet."""
        text = ConversationDigestService.render(self._zeilen(), "de", verbatim_from="2026-09-05T10:15:00")
        assert "Abschnitt 1" not in text, "Abschnitt 1 endet 10:09:59 … prueft die Grenze"
        assert "Abschnitt 0" in text

    def test_liegt_alles_im_fenster_bleibt_die_verdichtung_leer(self):
        """Ein junger Faden braucht keinen Bericht ueber das, was ganz
        woertlich dasteht."""
        text = ConversationDigestService.render(self._zeilen(), "de", verbatim_from="2026-09-05T09:00:00")
        assert text == ""

    def test_der_schnitt_wirkt_zusammen_mit_der_perspektivgrenze(self):
        """Beide Filter sind unabhaengig und muessen beide greifen: `since`
        schneidet vorne (was die Figur nicht miterlebt hat), `verbatim_from`
        hinten (was sie ohnehin woertlich liest)."""
        text = ConversationDigestService.render(
            self._zeilen(),
            "de",
            since="2026-09-05T10:10:00",
            verbatim_from="2026-09-05T10:30:00",
        )
        assert "Abschnitt 0" not in text, "vor dem Beitritt"
        assert "Abschnitt 1" in text
        assert "Abschnitt 2" in text
        assert "Abschnitt 3" not in text, "steht woertlich da"


class TestDasFensterIstEineEntscheidungKeineAbfrageschranke:
    """`_MAX_MESSAGES_HARD = 200` trug den Kommentar „prevent huge DB
    queries" und war damit versehentlich die Kontextpolitik des Systems.

    Gemessen: bei deepseek-v4 (1-Mio-Fenster) erlaubte
    `_HISTORY_BUDGET_RATIO = 0.6` rechnerisch 2 380 Nachrichten — gebunden
    hat immer die Kappe.
    """

    def test_das_fenster_hat_einen_namen_der_sagt_was_es_ist(self):
        from backend.services.chat_ai_service import _VERBATIM_WINDOW

        assert _VERBATIM_WINDOW == 40

    def test_es_passt_zur_abschnittsgroesse_der_verdichtung(self):
        """Das Fenster ist genau EIN Abschnitt breit. Damit faellt der
        Schnitt zwischen „woertlich" und „verdichtet" auf eine
        Abschnittsgrenze statt mitten hinein."""
        from backend.services.chat.conversation_digest_service import SEGMENT_SIZE
        from backend.services.chat_ai_service import _VERBATIM_WINDOW

        assert _VERBATIM_WINDOW % SEGMENT_SIZE == 0

    def test_es_liegt_im_korridor_der_referenzen(self):
        """LangChain behaelt 20 Nachrichten, Qvink 10, RisuAI mindestens 3,
        AI Dungeon historisch 20 Zuege. MemDelta misst, dass woertlicher
        Abruf mit ~5 000 Token die volle Historie statistisch einholt
        (p = 0,34) — bei ~171 Token je Nachricht rund 30.

        40 ist der vorsichtige obere Rand. Ueber 100 waere ausserhalb jeder
        Referenz."""
        from backend.services.chat_ai_service import _VERBATIM_WINDOW

        assert 10 <= _VERBATIM_WINDOW <= 100

    def test_die_alte_kappe_zeigt_auf_dieselbe_zahl(self):
        """Ein Aufrufer ausserhalb darf nicht still brechen."""
        from backend.services.chat_ai_service import _MAX_MESSAGES_HARD, _VERBATIM_WINDOW

        assert _MAX_MESSAGES_HARD == _VERBATIM_WINDOW

    def test_der_verlauf_wird_wirklich_darauf_gekappt(self):
        """Die Zusage selbst: `_max_history_messages` liefert das Fenster,
        nicht das Tokenbudget. Bei einem 1-Mio-Modell erlaubte das
        Verhaeltnis 2 380 — es darf nicht binden."""
        from backend.services.chat_ai_service import _VERBATIM_WINDOW, _max_history_messages

        assert _max_history_messages("deepseek/deepseek-v4-flash") == _VERBATIM_WINDOW

    def test_bei_einem_kleinen_fenster_bindet_das_verhaeltnis(self):
        """Die Gegenprobe: bei einem Modell, das nicht in der Tabelle steht
        (32 000 angenommen), rechnet das Verhaeltnis 0,6 × 32 000 − 5 000 =
        14 200 Token ÷ 250 = 56 Nachrichten. Das Fenster von 40 ist
        kleiner, also bindet weiterhin es — aber die Rechnung ist nicht
        tot, sie greift bei noch kleineren Fenstern."""
        from backend.services.chat_ai_service import _max_history_messages

        assert _max_history_messages("irgendein/unbekanntes-modell") == 40

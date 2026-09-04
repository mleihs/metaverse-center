"""Der Weg vom Wortwechsel zur Nachricht — und die vier Wege, ihn zu verfehlen.

Der Plan verlangt: Flüstern, wenn der Spieler im Wortwechsel vorkommt UND eine
Bindung besteht. Die erste Bedingung ist NICHT ERFÜLLBAR, und das ist gemessen:
`user_profiles` führt keinen Anzeigenamen, und vor allem erfährt der Agent den
Namen des Menschen im Prompt nie — in jeder Mitschrift heisst er „User". Eine
Bedingung, die auf einen Namen prüft, den niemand kennt, ist immer falsch; das
Merkmal sähe gebaut aus und liefe nie.

Es gilt deshalb die Bindung allein. Diese Datei hält fest, was daraus folgt.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from backend.services.chat.continuation_service import ContinuationService

ZUEGE = [
    {"speaker": "Mira Steinfeld", "content": "Die Akte lag heute morgen schon auf meinem Tisch."},
    {"speaker": "Elena Voss", "content": "Und niemand will sie dorthin gelegt haben."},
]
AGENTS = [
    {"id": "id-mira", "name": "Mira Steinfeld"},
    {"id": "id-elena", "name": "Elena Voss"},
]


def _admin(bindungen: list[dict]) -> MagicMock:
    admin = MagicMock()
    lesen = MagicMock()
    for name in ("select", "eq", "in_", "neq"):
        getattr(lesen, name).return_value = lesen
    lesen.execute = AsyncMock(return_value=MagicMock(data=bindungen))
    schreiben = MagicMock()
    schreiben.execute = AsyncMock(return_value=MagicMock(data=[{}]))
    lesen.insert = MagicMock(return_value=schreiben)
    admin.table.return_value = lesen
    admin._insert = lesen.insert
    return admin


async def _whisper(notify: str, bindungen: list[dict], *, user_id: str | None = "u1"):
    admin = _admin(bindungen)
    faden = {"continue_notify": notify, "user_id": user_id}
    ids = await ContinuationService._whisper(admin, faden, ZUEGE, AGENTS, locale="de", conversation_id=uuid4())
    return admin, ids


class TestNeverSchweigtVollstaendig:
    async def test_kein_fluestern_bei_never(self):
        """Nicht „Karte ja, Post nein" – gar nichts. Die Zeile entstuende sonst
        und laege nur ungelesen da."""
        admin, ids = await _whisper("never", [{"id": "b1", "agent_id": "id-mira"}])
        assert ids == []
        admin._insert.assert_not_called()


class TestOhneBindungKeinFluestern:
    async def test_niemand_gebunden(self):
        """Ohne Bindung waere das Fluestern die Benachrichtigung einer Fremden."""
        admin, ids = await _whisper("app", [])
        assert ids == []
        admin._insert.assert_not_called()

    async def test_ohne_besitzer_kein_fluestern(self):
        admin, ids = await _whisper("app", [{"id": "b1", "agent_id": "id-mira"}], user_id=None)
        assert ids == []


class TestDasFluesternTraegtSeinenBeleg:
    async def test_die_conversation_id_geht_mit(self):
        """Ohne sie waere das Fluestern eine Behauptung ohne Beleg – der Mensch
        koennte nicht nachsehen, wovon die Rede ist."""
        admin, ids = await _whisper("digest", [{"id": "b1", "agent_id": "id-mira"}])
        assert ids == ["b1"]
        zeile = admin._insert.call_args.args[0][0]
        assert zeile["whisper_type"] == "conversation"
        assert zeile["trigger_context"]["conversation_id"]
        assert zeile["trigger_context"]["notify"] == "digest"

    async def test_die_zustellart_steht_drin(self):
        """Der Mail-Sweep liest sie aus dem Fluestern. Fehlte sie, gingen alle
        Fluestern in dieselbe Post – oder in gar keine.

        ⚠ Die erste Fassung dieser Pruefung rief nur auf und behauptete
        nichts. Sie waere gruen gewesen, waere `notify` gar nicht mitgegangen.
        """
        admin, _ = await _whisper("immediate", [{"id": "b1", "agent_id": "id-mira"}])
        kontext = admin._insert.call_args.args[0][0]["trigger_context"]
        assert kontext["notify"] == "immediate"
        assert kontext["turns"] == len(ZUEGE)
        assert kontext["locale"] == "de"

    async def test_je_bindung_eine_zeile_aber_ein_einziger_insert(self):
        """Zwei gebundene Agenten im selben Faden sind zwei Beziehungen und
        zwei Nachrichten – jede aus der Sicht ihres Agenten. Aber EIN Insert:
        zwei Rundreisen dafuer sind eine zu viel (ADR-007).

        Alles oder nichts ist hier auch das RICHTIGE. Die Bindungen eines
        Fadens gehoeren demselben Menschen; bekaeme er eine Karte und die
        zweite nicht, saehe er einen halben Wortwechsel und haette keinen
        Anhalt, dass etwas fehlt.
        """
        admin, ids = await _whisper("app", [{"id": "b1", "agent_id": "id-mira"}, {"id": "b2", "agent_id": "id-elena"}])
        assert sorted(ids) == ["b1", "b2"]
        assert admin._insert.call_count == 1, "je Bindung eine Rundreise statt einer fuer alle"
        zeilen = admin._insert.call_args.args[0]
        assert len(zeilen) == 2
        assert {z["bond_id"] for z in zeilen} == {"b1", "b2"}


class TestDerTextIstDieErsteZeile:
    """KEIN Modellaufruf. Der Wortwechsel ist schon geschrieben und bezahlt;
    ihn ein zweites Mal durch ein Modell zu schicken, um zu sagen „wir haben
    geredet", waere ein Aufruf fuer eine Auskunft, die schon dasteht."""

    def test_der_name_und_die_zeile_stehen_drin(self):
        text = ContinuationService._whisper_text("Mira Steinfeld", ["Elena Voss"], "Die Akte lag schon da.", "de")
        assert "Mira Steinfeld" in text
        assert "Elena Voss" in text
        assert "Die Akte lag schon da." in text

    def test_eine_lange_zeile_wird_gekuerzt(self):
        lang = "x" * 400
        text = ContinuationService._whisper_text("Mira", ["Elena"], lang, "de")
        assert "..." in text
        assert len(text) < 300

    def test_beide_sprachen_sind_verschieden(self):
        """Sonst laese die eine Haelfte der Nutzerschaft die andere Sprache,
        ohne dass es auffiele – es faellt nichts aus, der Satz ist nur fremd."""
        de = ContinuationService._whisper_text("Mira", ["Elena"], "Text", "de")
        en = ContinuationService._whisper_text("Mira", ["Elena"], "Text", "en")
        assert de != en
        assert "Waehrend du weg warst" in de
        assert "While you were away" in en

    def test_ohne_gegenueber_bleibt_der_satz_ganz(self):
        de = ContinuationService._whisper_text("Mira", [], "Text", "de")
        en = ContinuationService._whisper_text("Mira", [], "Text", "en")
        assert de.count("mit ") >= 1
        assert "someone" in en


@pytest.mark.parametrize("notify", ["app", "digest", "immediate"])
async def test_alle_wege_ausser_never_schreiben_ein_fluestern(notify):
    """`app` bekommt nur die Karte, `digest` und `immediate` zusaetzlich Post –
    aber die KARTE entsteht in allen dreien. Sie ist der Beleg, aus dem der
    Mail-Sweep spaeter liest; ohne sie gaebe es fuer die Post keine Quelle."""
    _, ids = await _whisper(notify, [{"id": "b1", "agent_id": "id-mira"}])
    assert ids == ["b1"]

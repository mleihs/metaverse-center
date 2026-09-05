"""Ein Buch, in dem jede Zeile null steht, ist ein leeres Buch.

── DER BEFUND ────────────────────────────────────────────────────────────────

`run_ai` schrieb seine Zeile ins Aufrufbuch — mit **0 Token und 0 USD**.
Gemessen am 05.09.2026 auf Produktion:

    translation   202 Aufrufe   0 mit Token   0,00000 USD
    anchors         2 Aufrufe   0 mit Token   0,00000 USD

    jeder ANDERE Zweck (chat, chat_digest, memory_extraction, …): sauber

Die Ursache ist ein Klammerpaar. In pydantic-ai 2.x ist
`AgentRunResult.usage` eine **property**, in 1.x war es eine **Methode**. Der
Aufruf `result.usage()` ruft damit ein `RunUsage`-Objekt auf, das nicht
aufrufbar ist; der `TypeError` faellt in ein `except Exception`, das mit
Absicht nichts scheitern laesst, und beide Zaehler bleiben null.

⚠ WARUM DAS BESONDERS TUECKISCH IST. Der Docstring von `_record_attempt`
beschreibt genau diesen Fehler eine Ebene hoeher: dass die Forge-Textspur
gegen eine Zahl geprueft wurde, die strukturell immer null war, weil gar
keine Zeile geschrieben wurde. Am 02.09.2026 wurde die ZEILE ergaenzt. Die
ZAHL darin blieb null — und die vorhandene Zeile liess den Fehler behoben
aussehen.

Dieselbe Familie wie der tote Parameter, der Eintragstyp ohne CHECK und die
zwei Zaehler ohne Spalte: eine Haelfte richtig, die andere fehlt, und das
Ergebnis sieht von aussen vollstaendig aus.
"""

from __future__ import annotations

import inspect
from dataclasses import dataclass


@dataclass
class _Usage:
    input_tokens: int = 0
    output_tokens: int = 0


class _AlsProperty:
    """Die Form von pydantic-ai 2.x."""

    @property
    def usage(self) -> _Usage:
        return _Usage(120, 45)


class _AlsMethode:
    """Die Form von pydantic-ai 1.x."""

    def usage(self) -> _Usage:
        return _Usage(7, 3)


def _lies(result) -> tuple[int, int]:
    """Die Leseregel, wie sie in `_record_attempt` steht."""
    usage = result.usage
    if callable(usage):
        usage = usage()
    return int(getattr(usage, "input_tokens", 0) or 0), int(getattr(usage, "output_tokens", 0) or 0)


class TestBeideFormenWerdenGelesen:
    def test_property_wie_in_pydantic_ai_2(self):
        assert _lies(_AlsProperty()) == (120, 45)

    def test_methode_wie_in_pydantic_ai_1(self):
        """Eine Aenderung der Bibliothek in die andere Richtung darf das Buch
        nicht wieder stilllegen."""
        assert _lies(_AlsMethode()) == (7, 3)

    def test_die_alte_form_haette_die_property_verfehlt(self):
        """Die Gegenprobe, die zeigt WORIN der Fehler bestand. Ohne sie
        pruefte alles oben nur, dass die neue Regel funktioniert — nicht,
        dass die alte kaputt war."""
        import pytest

        with pytest.raises(TypeError):
            _AlsProperty().usage()  # genau der Aufruf, der auf Prod scheiterte


class TestDieBibliothekIstWIRKLICHSO:
    """⚠ Das Entscheidende. Die zwei Tests oben laufen gegen Attrappen und
    wuerden auch dann bestehen, wenn pydantic-ai sich morgen aendert.

    Dieser hier fragt die ECHTE Bibliothek — er ist der Grund, warum der
    Fehler ueberhaupt entstehen konnte: niemand hat je nachgesehen, welche
    Form sie tatsaechlich hat.
    """

    def test_agentrunresult_usage_ist_heute_eine_property(self):
        from pydantic_ai.agent import AgentRunResult

        merkmal = inspect.getattr_static(AgentRunResult, "usage", None)
        assert merkmal is not None, "pydantic-ai hat `usage` entfernt"
        assert isinstance(merkmal, property) or callable(merkmal), (
            "`usage` ist weder property noch aufrufbar — die Leseregel in `_record_attempt` muss angepasst werden."
        )

    def test_die_leseregel_passt_zur_echten_form(self):
        """Bindet Regel und Bibliothek aneinander. Wechselt pydantic-ai die
        Form, wird hier rot — und nicht still eine Null gebucht."""
        from pydantic_ai.agent import AgentRunResult

        merkmal = inspect.getattr_static(AgentRunResult, "usage", None)
        roh = inspect.getsource(__import__("backend.services.ai_utils", fromlist=["_record_attempt"])._record_attempt)
        # ⚠ OHNE die Kommentarzeilen. Die Erklaerung ueber der Leseregel nennt
        # die alte, kaputte Form beim Namen — ein Tor, das die Prosa mitliest,
        # schlaegt an der Dokumentation seiner eigenen Reparatur an. Genau das
        # ist beim ersten Lauf passiert.
        quelle = "\n".join(z for z in roh.splitlines() if not z.lstrip().startswith("#"))
        assert "usage = result.usage" in quelle
        assert "if callable(usage):" in quelle, (
            "Die Leseregel muss BEIDE Formen bedienen; heute ist es "
            f"{'eine property' if isinstance(merkmal, property) else 'eine Methode'}."
        )
        assert "result.usage()" not in quelle, "Der Aufruf mit Klammern scheitert an der property und bucht still null."

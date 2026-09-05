"""Die Sprache einer Welt — eine Frage, eine Antwort.

BEFUND vom 04.09.2026. Zwei Dateien beantworteten dieselbe Frage verschieden:

    ChatAIService._get_locale()               ->  "de"
    PromptResolver._get_simulation_locale()   ->  "en"

Gemessen auf Produktion: KEINE der 41 Welten hatte `general.content_locale`
gesetzt. Der Widerspruch galt also für jede.

WAS ER ANRICHTETE, und es ist kein Konfigurationsdetail. Der Chat fragte nach
einer DEUTSCHEN Vorlage, fand keine, und Stufe 2 des Auflösers ("Welt +
Vorgabesprache der Welt") gab ihm die ENGLISCHE welteigene. Ein Agent in
Velgarien bekam damit einen System-Prompt, der

  · einen englischen Rahmen um eine deutsche Figur legte
    ("You are Mira, a <1100 Zeichen deutscher Lebenslauf>")
  · anwies: "Acknowledge the party's Citizen Identification Number (CIN)"
    — daher die CIN-Bruchstücke in den Antworten
  · keinen `{agent_memories}`-Platzhalter hatte, also nie sein Gedächtnis
  · keinen `{agent_mood}`-Platzhalter hatte, also nie seine Stimmung
  · kein Wort zur Ich-Form sagte, also Erzählung von aussen über sich selbst

Vier der fünf Auffälligkeiten in einem 373 Nachrichten langen Gespräch, alle
aus derselben Wurzel.

Diese Datei hält fest, dass es die Wurzel nicht mehr gibt.
"""

from __future__ import annotations

import ast
import pathlib
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from backend.utils.settings import DEFAULT_CONTENT_LOCALE, get_content_locale

BACKEND = pathlib.Path(__file__).resolve().parents[2]


def _klient(rows):
    kette = MagicMock()
    for name in ("select", "eq", "limit"):
        getattr(kette, name).return_value = kette
    kette.execute = AsyncMock(return_value=MagicMock(data=rows))
    klient = MagicMock()
    klient.table.return_value = kette
    return klient


class TestEineFrageEineAntwort:
    """Die tragende Zusage: es gibt genau EINE Stelle mit einem Vorgabewert."""

    def test_keine_datei_traegt_eine_eigene_vorgabe(self):
        """Der Widerspruch wird baulich unmoeglich, nicht behoben.

        Geprueft wird per AST auf ZUWEISUNGEN — ein `locale = "de"` im Rumpf
        der beiden Methoden. Ein blosses Vorkommen der Zeichenkette faenge
        auch Docstrings, und die REDEN hier absichtlich ueber das Problem.
        """
        for pfad, methode in (
            ("services/chat_ai_service.py", "_get_locale"),
            ("services/prompt_service.py", "_get_simulation_locale"),
        ):
            baum = ast.parse((BACKEND / pfad).read_text(encoding="utf-8"))
            fn = next(
                k for k in ast.walk(baum) if isinstance(k, ast.AsyncFunctionDef | ast.FunctionDef) and k.name == methode
            )
            literale = [k.value for k in ast.walk(fn) if isinstance(k, ast.Constant) and k.value in {"de", "en"}]
            assert not literale, (
                f"{pfad}::{methode} traegt wieder einen eigenen Sprach-Vorgabewert "
                f"({literale}). Genau so entstand der Widerspruch: zwei Dateien, "
                "dieselbe Frage, zwei Antworten."
            )

    def test_beide_rufen_dieselbe_funktion(self):
        for pfad in ("services/chat_ai_service.py", "services/prompt_service.py"):
            quelle = (BACKEND / pfad).read_text(encoding="utf-8")
            assert "get_content_locale" in quelle, f"{pfad} fragt nicht die gemeinsame Stelle"


class TestDerVorgabewert:
    async def test_ohne_zeile_gilt_die_vorgabe(self):
        assert await get_content_locale(_klient([]), uuid4()) == DEFAULT_CONTENT_LOCALE

    async def test_ohne_welt_gilt_die_vorgabe(self):
        assert await get_content_locale(_klient([]), None) == DEFAULT_CONTENT_LOCALE

    async def test_eine_gesetzte_sprache_gewinnt(self):
        assert await get_content_locale(_klient([{"setting_value": "en"}]), uuid4()) == "en"

    async def test_jsonb_anfuehrungszeichen_gehoeren_nicht_in_einen_sprachschluessel(self):
        """postgrest reicht `'"en"'::jsonb` als Zeichenkette MIT
        Anfuehrungszeichen durch. Ungetrimmt waere die Sprache `"en"` mit
        Zeichen, und keine Vorlage traegt die."""
        assert await get_content_locale(_klient([{"setting_value": '"en"'}]), uuid4()) == "en"

    async def test_ein_leerer_wert_ist_keine_sprache(self):
        assert await get_content_locale(_klient([{"setting_value": ""}]), uuid4()) == DEFAULT_CONTENT_LOCALE
        assert await get_content_locale(_klient([{"setting_value": None}]), uuid4()) == DEFAULT_CONTENT_LOCALE

    async def test_eine_unlesbare_einstellung_ist_nicht_englisch_sondern_unbekannt(self):
        """Der Vorgabewert ist die ehrlichere Antwort als ein Fehler mitten im
        Prompt-Aufbau — aber er wird protokolliert."""
        import httpx

        kette = MagicMock()
        for name in ("select", "eq", "limit"):
            getattr(kette, name).return_value = kette
        kette.execute = AsyncMock(side_effect=httpx.ConnectError("weg"))
        klient = MagicMock()
        klient.table.return_value = kette
        assert await get_content_locale(klient, uuid4()) == DEFAULT_CONTENT_LOCALE


class TestDieVorgabeIstGemessen:
    """`de` ist keine Geschmacksfrage, sondern der Stand auf Produktion."""

    def test_die_begruendung_steht_beim_wert(self):
        """Eine Zahl ohne ihre Messung ist eine Behauptung, und die naechste
        Person, die sie aendert, weiss dann nicht, wogegen sie argumentiert."""
        quelle = (BACKEND / "utils/settings.py").read_text(encoding="utf-8")
        zuweisung = quelle.index("DEFAULT_CONTENT_LOCALE = ")
        davor = quelle[:zuweisung]
        assert "41 Welten" in davor, "die Messung, die den Wert traegt, ist verschwunden"
        assert "CIN" in davor, "was der Widerspruch angerichtet hat, steht nicht mehr dabei"

    def test_der_wert_ist_der_des_chats(self):
        """Alle Gespraeche der Plattform laufen auf `de`. Ein anderer
        Vorgabewert wuerde jeden davon auf eine fremde Vorlage lenken."""
        assert DEFAULT_CONTENT_LOCALE == "de"


@pytest.mark.parametrize("stufe", ["simulation+locale", "simulation+default_locale"])
def test_die_vorgabe_wirkt_nur_in_stufe_2(stufe):
    """Alle elf `resolve()`-Aufrufe im Werk geben die Sprache ausdruecklich
    mit. Der Vorgabewert entscheidet also allein darueber, ob eine welteigene
    Vorlage in einer FREMDEN Sprache einer Plattform-Vorlage in der RICHTIGEN
    vorgezogen wird — und das soll sie nicht.

    Waechst die Zahl der Aufrufe ohne Sprache, ist diese Begruendung hinfaellig
    und der Wert wirkt ploetzlich ueberall.
    """
    import re

    ohne_sprache = 0
    for pfad in (BACKEND / "services").rglob("*.py"):
        for treffer in re.finditer(r"prompt_resolver\.resolve\(([^)]*)\)", pfad.read_text(encoding="utf-8")):
            if "," not in treffer.group(1):
                ohne_sprache += 1
    assert ohne_sprache == 0, (
        f"{ohne_sprache} resolve()-Aufruf(e) ohne Sprache. Der Vorgabewert wirkt dann "
        "nicht mehr nur in Stufe 2, sondern entscheidet die angeforderte Sprache selbst."
    )

"""Jede Buchung im Kostenbuch muss ihre Geldquelle AUSSAGEN.

── WOHER DIESES TOR KOMMT ────────────────────────────────────────────────────

Am 05.09.2026 gemessen, auf Produktion: 1510 von 1510 Zeilen in
`ai_usage_log` tragen `key_source = 'platform'`. Das sah lange richtig aus —
und es war richtig, aber nur aus Versehen. Denn zugleich gilt: null
hinterlegte Schluessel, null BYOK-Antraege. Die unterscheidende Lage ist nie
eingetreten.

⚠ **Eine Pruefung, die besteht, weil es nichts zu pruefen gab, ist keine
bestandene Pruefung.** Von elf Buchungsstellen sagten sechs die Quelle gar
nicht — sie erbten den Vorgabewert `"platform"`. Zwei davon bekommen vom
Herzschlag nachweislich den EIGENEN Schluessel der Besitzerin durchgereicht
(`bond_whisper`, `agent_continuation`, beide `bw_key if bw_has_key else None`)
und haetten fremdes Geld als Plattformgeld gebucht. Beide Zwecke hatten am
Messtag noch keine einzige Zeile geschrieben — der Fehler war gebaut, aber
noch nicht eingetreten.

Das ist keine Buchhaltungsfeinheit. `get_budget_states` wiegt das Kostenbuch
gegen die Obergrenzen der Plattform, und `key_source` entscheidet, ob ein
Betrag mitzaehlt. Falsch als `byok` gebucht: die Obergrenze greift nicht mehr.
Falsch als `platform` gebucht: eine fremde Rechnung schliesst die Plattform.

── WARUM NICHT AUS DEM SCHLUESSEL RATEN ──────────────────────────────────────

Weil `key_source_for()` das nicht kann und es auch nicht behauptet. Es
antwortet `"byok"` auf jeden Schluessel, der nicht None ist. Zwei Ketten
liefern einen solchen Schluessel und meinen das Gegenteil voneinander:

    ExternalServiceResolver   Simulation → Plattform → .env   IMMER platform
    ForgeDraftService         der eigene Schluessel, sonst None   byok

`ForgeImageService` hatte das schon gelernt und schreibt es in seinem
Konstruktor auf. `GenerationService` bekam denselben Parameter aus demselben
Grund. Wo `key_source_for()` steht, muss sein Argument aus der ZWEITEN Kette
kommen — das prueft dieses Tor nicht, das bleibt Sache der Lesenden.

── WAS ES PRUEFT ─────────────────────────────────────────────────────────────

Nur die billigste Frage, die diese Klasse gefangen haette: steht an jedem
`AIUsageService.log(...)` ueberhaupt ein `key_source`? Ein stillschweigend
geerbter Vorgabewert ist keine Aussage, auch wenn er zufaellig stimmt.
"""

from __future__ import annotations

import ast
from pathlib import Path

WURZEL = Path(__file__).resolve().parents[2]


def _buchungsstellen() -> list[tuple[Path, ast.Call]]:
    treffer: list[tuple[Path, ast.Call]] = []
    for datei in sorted((WURZEL / "services").rglob("*.py")):
        baum = ast.parse(datei.read_text(encoding="utf-8"), filename=str(datei))
        for knoten in ast.walk(baum):
            if not isinstance(knoten, ast.Call):
                continue
            f = knoten.func
            if isinstance(f, ast.Attribute) and f.attr == "log":
                besitzer = f.value
                if isinstance(besitzer, ast.Name) and besitzer.id == "AIUsageService":
                    treffer.append((datei, knoten))
    return treffer


def test_das_tor_findet_ueberhaupt_buchungsstellen() -> None:
    """Erst die Bedingung herstellen, dann pruefen.

    Ohne diese Zeile bestuende das Tor auch dann, wenn die Suche nichts
    faende — ein umbenannter Dienst, ein verschobener Ordner, und das Tor
    meldete jahrelang gruen, ohne je etwas angesehen zu haben.
    """
    stellen = _buchungsstellen()
    assert len(stellen) >= 10, f"nur {len(stellen)} Buchungsstellen gefunden — sucht das Tor noch richtig?"


def test_jede_buchung_sagt_ihre_verursacherin() -> None:
    """Dieselbe Frage, andere Spalte — und sie war noch leerer.

    Am 05.09.2026 gemessen: `ai_usage_log.user_id` stand in **1510 von 1510**
    Zeilen auf NULL. Nur `run_ai` reichte eine Kennung durch; neun von zehn
    Buchungsstellen nannten sie gar nicht.

    Damit gab es die Achse „welche Person verbraucht wie viel" nicht — und die
    Nutzer-Sprosse von `get_budget_states` konnte nie greifen, weil das Buch
    die Person nicht kannte. `ChatAIService._chat_budget` sagte es selbst in
    seinem Docstring: „`user_id` is not threaded through the chat services
    today".

    ⚠ **`user_id` und `key_source` sind NICHT dieselbe Frage.** `key_source`
    sagt, WER BEZAHLT hat; `user_id`, WER ES AUSGELOEST hat. Bei einer
    Admin-Ueberschreibung faellt beides auseinander: die Plattform zahlt, die
    Besitzerin hat es veranlasst. Zwei Spalten, zwei Fragen, und beide muessen
    dastehen.

    Ein Herzschlag hat keinen Menschen am Bildschirm — aber eine
    Verursacherin. `_resolve_autonomy_key` loest sie ohnehin auf, um an den
    Schluessel zu kommen, und gibt sie seit diesem Tag mit zurueck.

    Geprueft wird wie beim Geldweg nur die billigste Frage: steht ueberhaupt
    ein `user_id` da? Ein `None` besteht — aber es ist dann ein AUSGESAGTES
    None, kein vergessenes.
    """
    ohne: list[str] = []
    for datei, aufruf in _buchungsstellen():
        namen = {kw.arg for kw in aufruf.keywords if kw.arg}
        if "user_id" not in namen:
            ohne.append(f"{datei.relative_to(WURZEL.parent)}:{aufruf.lineno}")
    assert not ohne, (
        "Diese Buchungen nennen ihre Verursacherin nicht:\n  "
        + "\n  ".join(ohne)
        + "\n\nWer den Aufruf AUSLOEST, sagt es — bei einem Herzschlag ist das die "
        "Besitzerin der Welt, bei einem Chatzug die Person am Bildschirm. Wo es "
        "wirklich niemanden gibt, steht `user_id=None` ausdruecklich da."
    )


def test_jede_buchung_sagt_ihre_geldquelle() -> None:
    ohne: list[str] = []
    for datei, aufruf in _buchungsstellen():
        namen = {kw.arg for kw in aufruf.keywords if kw.arg}
        if "key_source" not in namen:
            ohne.append(f"{datei.relative_to(WURZEL.parent)}:{aufruf.lineno}")
    assert not ohne, (
        "Diese Buchungen erben `key_source` still statt es auszusagen:\n  "
        + "\n  ".join(ohne)
        + "\n\nAus dem Schluessel raten geht nicht (siehe Modul-Dokumentation). "
        "Wer den Schluessel WAEHLT, sagt die Quelle — `key_source_for(...)` fuer "
        'einen eigenen Schluessel, sonst ausdruecklich `"platform"`.'
    )

"""Der Generator darf dem Modell nur EIN Zustandsvokabular nennen.

WAS SCHIEFGING
Zwei Stellen nannten dem Modell die erlaubten Bauzustände, und sie waren nicht
gleich:

    backend/models/forge.py            "excellent, good, fair, poor, or ruined"
    forge_orchestrator_service.py:243  "pristine, good, fair, poor, or ruined"

Beide gingen in DIESELBE Anfrage — das Schema als Feldbeschreibung, die andere
als Anforderungszeile im Prompt. Das Modell bekam zwei Vokabulare und nahm aus
beiden. Daher die sechs `pristine`-Bauten auf Produktion, die keine Welt
beschriften konnte (`forge_taxonomies` Docstring, Befund 30).

Der Kommentar im Modell wusste das sogar und schrieb es hin — „this model said
`pristine`, and the two disagreeing is why six buildings in five worlds carry a
value no taxonomy anywhere defines". Repariert wurde damals nur die eine Hälfte.
**Eine Lehre, die in einer der beiden Kopien steht, gilt nur für diese Kopie.**

WAS DIESER TEST HÄLT
Seit `BUILDING_CONDITION_CORE` gibt es eine Quelle, und beide Stellen bauen ihren
Satz daraus — auseinanderlaufen können sie damit nicht mehr. Bleibt die Gefahr,
dass jemand die Liste erneut hinschreibt, weil ein Literal im Prompt bequemer
liest als ein f-String. Genau danach sucht der dritte Test.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from backend.models.forge import BUILDING_CONDITION_CORE, ForgeBuildingDraft

BACKEND = Path(__file__).resolve().parents[2]
ORCHESTRATOR = BACKEND / "services" / "forge_orchestrator_service.py"
FORGE_MODEL = BACKEND / "models" / "forge.py"

# Jedes Wort, das auf der Zustandsleiter der Datenbank sitzt (Migration 322,
# `fn_building_condition_rungs`). Ein Prompt-Literal, das drei oder mehr davon
# aufzählt, ist eine zweite Vokabelliste.
LADDER_WORDS = {
    "pristine",
    "illuminated",
    "excellent",
    "restored",
    "preserved",
    "thriving",
    "good",
    "restricted",
    "functional",
    "operational",
    "fair",
    "obsolete",
    "anomalous",
    "sealed",
    "makeshift",
    "poor",
    "compromised",
    "critical",
    "ruined",
}


def test_core_vocabulary_is_ordered_best_to_worst() -> None:
    """Die Reihenfolge ist die Aussage, nicht nur der Inhalt.

    `excellent` steht vorn, weil die Prompt-Vorlage aus Migration 027 das seit
    März sagt und die Kernleiter der Datenbank es auf Sprosse 10 führt. `poor`
    und `ruined` stehen hinten, weil der Prompt daraus „mindestens eines soll
    schlecht sein" baut, indem er die letzten zwei nimmt.
    """
    assert BUILDING_CONDITION_CORE == ("excellent", "good", "fair", "poor", "ruined")
    assert set(BUILDING_CONDITION_CORE) <= LADDER_WORDS


def test_the_model_schema_names_exactly_the_core_vocabulary() -> None:
    """Was im Schema steht, ist das, was das Modell als Feldbeschreibung liest."""
    description = ForgeBuildingDraft.model_fields["building_condition"].description
    assert description, "Feldbeschreibung fehlt — das Modell bekäme gar kein Vokabular"

    for word in BUILDING_CONDITION_CORE:
        assert re.search(rf"\b{word}\b", description), f"{word} fehlt in der Feldbeschreibung"

    fremd = {w for w in LADDER_WORDS - set(BUILDING_CONDITION_CORE) if re.search(rf"\b{w}\b", description)}
    assert not fremd, (
        f"Die Feldbeschreibung nennt Zustandswörter ausserhalb des Kernvokabulars: "
        f"{sorted(fremd)}. Genau so entstanden die sechs `pristine`-Bauten."
    )


@pytest.mark.parametrize("path", [ORCHESTRATOR, FORGE_MODEL], ids=lambda p: p.name)
def test_no_second_hardcoded_condition_list(path: Path) -> None:
    """Keine Zeile darf das Vokabular erneut von Hand aufzählen.

    Gesucht wird eine EINZELNE Quellzeile, die drei oder mehr Leiterwörter nennt
    — das ist die Form, die eine Aufzählung annimmt (`"use pristine, good, fair,
    poor, or ruined"`). Die Definition der Konstante selbst ist ausgenommen, und
    Kommentarzeilen sind es auch: die Geschichte dieses Fehlers aufzuschreiben
    muss erlaubt bleiben, sonst löscht der Wächter seine eigene Begründung.
    """
    offenders: list[str] = []
    for lineno, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        stripped = line.strip()
        if stripped.startswith("#") or stripped.startswith("--"):
            continue
        if "BUILDING_CONDITION_CORE" in line:
            continue  # die Quelle selbst, und jede Zeile, die aus ihr baut
        found = {w for w in LADDER_WORDS if re.search(rf"\b{w}\b", line)}
        if len(found) >= 3:
            offenders.append(f"{path.name}:{lineno}: {sorted(found)} — {stripped[:90]}")

    assert not offenders, (
        "Zweite Vokabelliste gefunden:\n" + "\n".join(offenders) + "\n"
        "Das Vokabular kommt aus BUILDING_CONDITION_CORE. Zwei Listen in einer "
        "Anfrage haben dem Modell schon einmal zwei Wahrheiten gegeben."
    )

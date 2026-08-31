"""Der Chat berechnet Erinnerung und Stimmung — die Vorlage muss sie auch nennen.

Befund D7/S12. Die Prompt-Kette hat hier VIER Glieder, und drei davon waren
in Ordnung:

    1. `ChatAIService` holt die Erinnerungen (mit Wichtigkeit und Typ) und
       baut einen Stimmungsblock aus Laune, Stress und den fünf stärksten
       Moodlets.                                                        ✓
    2. `prompt_contracts.py` deklariert `agent_memories` und `agent_mood`
       für `chat_system_prompt`.                                        ✓
    3. `PromptResolver` rendert, was die Vorlage nennt.                 ✓
    4. Der Vorlagentext nannte weder das eine noch das andere.          ✗

Gemessen auf Prod am 31.08.2026: BEIDE Plattformvorlagen (de, 322 Zeichen;
en, 295 Zeichen) ohne beide Platzhalter. Von vier weltbezogenen Vorlagen
nutzte genau EINE sie — die aus der Schmiede, 899 Zeichen. Für jede andere
Welt war jedes Gespräch das erste: der Agent erinnerte sich an nichts und war
immer gleich gelaunt.

Der Rechenweg lief die ganze Zeit. Es fehlte nur der Abnehmer, und weil eine
deklarierte, aber ungenannte Variable geräuschlos in nichts rendert (bewusst
so, `PromptResolver._render`), gab es kein Signal.

Diese Tests binden die vier Glieder aneinander. Sie brauchen keine Datenbank:
Migration und Seed sind Textdateien, der Dienst ist ein AST.
"""

from __future__ import annotations

import ast
import re
from pathlib import Path

from backend.services.prompt_contracts import get_contract

_ROOT = Path(__file__).resolve().parents[3]
_MIGRATION = _ROOT / "supabase" / "migrations" / "20260831090000_299_chat_prompt_uses_memory_and_mood.sql"
_SEED = _ROOT / "supabase" / "seed" / "006_prompt_templates.sql"
_SERVICE = _ROOT / "backend" / "services" / "chat_ai_service.py"

_REQUIRED = ("agent_memories", "agent_mood")


def _sql_without_comments(path: Path) -> str:
    """J3b: der Kopfkommentar der Migration erklärt den Defekt und nennt dabei
    genau die gesuchten Platzhalter. Ohne Bereinigung bestünde jede Zusicherung
    schon durch die Erklärung."""
    return "\n".join(
        line for line in path.read_text(encoding="utf-8").splitlines() if not line.lstrip().startswith("--")
    )


def test_the_contract_declares_both() -> None:
    """Glied 2. Ohne die Deklaration meldete der Resolver sie als Verstoß."""
    contract = get_contract("chat_system_prompt")
    assert contract is not None, "chat_system_prompt hat keinen Vertrag — der Typ wäre unverwaltet"
    for name in _REQUIRED:
        assert name in contract.variables, f"{name} ist für chat_system_prompt nicht deklariert"


def test_the_service_supplies_both() -> None:
    """Glied 1, per AST an den Zuweisungen — nicht per Textsuche.

    `agent_memories` reist als `extra_variables={"agent_memories": ...}`,
    `agent_mood` als `variables["agent_mood"] = ...`. Beide Formen werden
    ausdrücklich gesucht, damit der Test nicht schon durch einen Kommentar
    besteht, der die Namen nennt.
    """
    tree = ast.parse(_SERVICE.read_text(encoding="utf-8"))

    supplied: set[str] = set()
    for node in ast.walk(tree):
        # variables["agent_mood"] = ...
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if (
                    isinstance(target, ast.Subscript)
                    and isinstance(target.slice, ast.Constant)
                    and target.slice.value in _REQUIRED
                ):
                    supplied.add(target.slice.value)
        # extra_variables={"agent_memories": ...}
        if isinstance(node, ast.Dict):
            for key in node.keys:
                if isinstance(key, ast.Constant) and key.value in _REQUIRED:
                    supplied.add(key.value)

    missing = sorted(set(_REQUIRED) - supplied)
    assert not missing, (
        f"{missing} wird von chat_ai_service nicht geliefert — dann rendert die Vorlage "
        "sie leer, und der Vorlagenfix wäre wirkungslos"
    )


def test_the_migration_puts_both_into_the_platform_templates() -> None:
    """Glied 4, der eigentliche Fix. Beide Sprachen, beide Platzhalter."""
    sql = _sql_without_comments(_MIGRATION)

    updates = re.findall(r"UPDATE prompt_templates(.*?);", sql, re.DOTALL)
    assert len(updates) == 2, f"{len(updates)} UPDATE-Anweisungen — erwartet werden zwei (de und en)"

    for locale in ("'en'", "'de'"):
        block = next((u for u in updates if f"locale = {locale}" in u), None)
        assert block is not None, f"kein UPDATE für locale = {locale}"
        for name in _REQUIRED:
            assert "{" + name + "}" in block, f"{name} fehlt im {locale}-Vorlagentext"
            assert f'"name": "{name}"' in block, f"{name} fehlt in der variables-Liste für {locale}"


def test_the_migration_leaves_world_owned_templates_alone() -> None:
    """Regel W6: eine Weltvorlage ist Autorschaft, kein Datenbestand."""
    sql = _sql_without_comments(_MIGRATION)
    updates = re.findall(r"UPDATE prompt_templates(.*?);", sql, re.DOTALL)
    for u in updates:
        assert "simulation_id IS NULL" in u, (
            "ein UPDATE ohne `simulation_id IS NULL` würde auch weltbezogene Vorlagen "
            "überschreiben — genau der automatische Reparaturlauf, den W6 verbietet"
        )


def test_the_migration_refuses_a_silent_no_op() -> None:
    """Ein UPDATE, das null Zeilen trifft, ist sonst ein Erfolg.

    Dieselbe Fehlerart, wegen der `upsert_platform_setting` existiert: fehlende
    Zeile auf einer frischen Datenbank, ein anderer `locale`-Wert, ein
    Tippfehler — und die Migration meldet nichts. Gegenprobe gefahren: nach dem
    Löschen der de-Zeile bricht sie mit
    „Gefunden: 1" ab und rollt zurück.
    """
    sql = _sql_without_comments(_MIGRATION)
    assert "RAISE EXCEPTION" in sql, "die Migration prüft ihr eigenes Ergebnis nicht"
    assert "vollstaendig <> 2" in sql


def test_the_seed_carries_the_same_thing() -> None:
    """Sonst trägt eine frische Datenbank den alten Stand.

    Der Seed läuft NACH den Migrationen (Befund 31 der Forge-Prüfung), eine
    nicht gespiegelte Änderung wird also aktiv wieder überschrieben.
    """
    seed = _SEED.read_text(encoding="utf-8")
    start = seed.index("-- 8. chat_system_prompt (EN)")
    block = seed[start : seed.index("-- 9.", start)] if "-- 9." in seed[start:] else seed[start:]
    for name in _REQUIRED:
        assert block.count("{" + name + "}") == 2, (
            f"{name} muss in BEIDEN Seed-Vorlagen (en und de) stehen; gefunden: {block.count('{' + name + '}')}"
        )
        assert block.count(f'"name": "{name}"') == 2, f"{name} fehlt in einer der beiden variables-Listen"


def test_the_placeholders_stand_bare_on_their_own_line() -> None:
    """Beide Werte tragen ihre eigene Beschriftung.

    `format_for_prompt` beginnt mit „Your memories and reflections:", der
    Stimmungsblock ist ein vollständiger Satz. Eine Beschriftung im
    Vorlagentext ergäbe eine doppelte — und weil beide Variablen BEDINGT sind
    (der Dienst setzt `agent_mood` nur, wenn ein Block zustande kam), bliebe
    eine beschriftete Zeile ohne Fortsetzung stehen, während eine nackte
    rückstandsfrei verschwindet.
    """
    sql = _sql_without_comments(_MIGRATION)
    for name in _REQUIRED:
        assert re.search(r"^\{" + name + r"\}$", sql, re.MULTILINE), (
            f"{{{name}}} muss allein auf seiner Zeile stehen, ohne Beschriftung davor"
        )

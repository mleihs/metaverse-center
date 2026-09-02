"""Was geschieht, wenn die Frist verstreicht.

Bis 2026-09-02 ging jedes offene Beutestück an ``party[0]`` — an dieselbe
Person, gleichgültig wem es genutzt hätte, und selbst dann, wenn sie gefangen
war und die Wirkung deshalb verfiel.

Das Bittere daran: der Server hatte die bessere Antwort die ganze Zeit dabei.
``_compute_loot_suggestions`` wählt für eine Eignungs-Verstärkung den Agenten
mit dem niedrigsten Stand in genau dieser Eignung, und die Oberfläche zeigt
diesen Vorschlag dem Spieler an, während die Uhr läuft. Nur beim Ablauf wurde
er verworfen.

Diese Prüfungen binden die Reparatur an ihren Zweck. Sie greifen den
Zuweisungs-Block heraus, statt fünf Minuten zu warten: der Block ist reine
Logik über dem Instanz-Zustand, und ein Test, der ``asyncio.sleep(300)``
abwartet, wird abgeschaltet statt gelesen.
"""

from __future__ import annotations

import ast
from pathlib import Path
from types import SimpleNamespace

import pytest

from backend.services.dungeon_distribution_service import DungeonDistributionService

QUELLE = Path("backend/services/dungeon_distribution_service.py")


def _agent(agent_id: str, condition: str = "healthy", **aptitudes: int):
    """Ein Gruppenmitglied, so weit die Verteilung es liest."""
    return SimpleNamespace(agent_id=agent_id, condition=condition, aptitudes=aptitudes)


def _instanz(party, pending_loot, assignments=None):
    return SimpleNamespace(
        party=party,
        pending_loot=pending_loot,
        loot_assignments=dict(assignments or {}),
        auto_assigned=[],
    )


class TestAutoFinalizeFolgtDenVorschlaegen:
    """Der Ablauf der Frist darf keine Ersatzhandlung mehr sein."""

    def test_eine_eignung_geht_an_den_schwaechsten_nicht_an_den_ersten(self) -> None:
        """Der Kern der Reparatur, an echten Daten gemessen.

        Die Verstärkung auf `infiltration` nützt dem Agenten am meisten, der
        darin am schwächsten ist. Vorher bekam sie `party[0]` — hier also der
        Falsche, obwohl der Server es besser wusste.
        """
        party = [
            _agent("stark", infiltration=9),
            _agent("schwach", infiltration=1),
        ]
        inst = _instanz(
            party,
            [
                {
                    "id": "L1",
                    "effect_type": "aptitude_boost",
                    "effect_params": {"aptitude": "infiltration"},
                }
            ],
        )
        ergebnis = DungeonDistributionService._weise_offene_beute_zu(inst)

        assert inst.loot_assignments["L1"] == "schwach", (
            "Die Verstärkung ging wieder an den Ersten statt an den, dem sie nützt."
        )
        assert ergebnis == [{"item_id": "L1", "agent_id": "schwach", "reason": "suggestion"}]

    def test_eine_gefangene_bekommt_nichts_solange_jemand_handeln_kann(self) -> None:
        """Der Vorschlag filtert Gefangene bereits heraus.

        Mein erster Testentwurf setzte hier auf die Auffanglinie und war falsch:
        `_compute_loot_suggestions` hat einen `else`-Zweig, der JEDEN
        verteilbaren Typ reihum vergibt. Es gibt also kein Stück ohne Vorschlag,
        solange ein Agent handeln kann — und der Vorschlag geht ohnehin nie an
        eine Gefangene. Geprüft wird deshalb, was wirklich eintritt.
        """
        party = [_agent("gefangen", condition="captured"), _agent("frei")]
        inst = _instanz(party, [{"id": "L1", "effect_type": "building_repair", "effect_params": {}}])
        ergebnis = DungeonDistributionService._weise_offene_beute_zu(inst)

        assert inst.loot_assignments["L1"] == "frei"
        assert ergebnis[0]["reason"] == "suggestion"

    def test_die_auffanglinie_greift_erst_wenn_niemand_mehr_handeln_kann(self) -> None:
        """Der einzige Weg in die Auffanglinie — und er ist bitter.

        Fällt die ganze Gruppe aus, gibt `_compute_loot_suggestions` nichts
        zurück, und das Stück geht an jemanden, der es nicht anwenden kann. Der
        Grund steht als `fallback` in der Antwort, damit das Finale nicht
        behauptet, jemand habe das so gewollt.

        ⚠ Damit ist der `can_act`-Vorzug in der Auffanglinie heute WIRKUNGSLOS:
        er greift nur, wenn niemand handlungsfähig ist, und dann ist auch die
        Vorzugsliste leer. Er steht als Absicherung dafür, dass die
        Vorschlagsregel einmal Lücken bekommt — nicht als Schutz, der heute
        etwas fängt. Dieser Test hält das fest, damit niemand ihn für wirksam
        hält.
        """
        party = [_agent("a", condition="captured"), _agent("b", condition="captured")]
        inst = _instanz(party, [{"id": "L1", "effect_type": "building_repair", "effect_params": {}}])
        ergebnis = DungeonDistributionService._weise_offene_beute_zu(inst)

        assert ergebnis == [{"item_id": "L1", "agent_id": "a", "reason": "fallback"}]

    def test_auto_wirkungen_werden_nicht_zugewiesen(self) -> None:
        """Sie wirken ohne Wahl — auch der Ablauf darf sie nicht verteilen."""
        inst = _instanz(
            [_agent("a")],
            [
                {"id": "A1", "effect_type": "stress_heal", "effect_params": {}},
                {"id": "A2", "effect_type": "arc_modifier", "effect_params": {}},
            ],
        )
        assert DungeonDistributionService._weise_offene_beute_zu(inst) == []
        assert inst.loot_assignments == {}

    def test_was_der_spieler_schon_vergeben_hat_bleibt_seins(self) -> None:
        """Die Frist überschreibt keine getroffene Wahl."""
        inst = _instanz(
            [_agent("a"), _agent("b")],
            [{"id": "L1", "effect_type": "building_repair", "effect_params": {}}],
            assignments={"L1": "b"},
        )
        assert DungeonDistributionService._weise_offene_beute_zu(inst) == []
        assert inst.loot_assignments["L1"] == "b"

    def test_ohne_gruppe_wird_nichts_erfunden(self) -> None:
        inst = _instanz([], [{"id": "L1", "effect_type": "building_repair", "effect_params": {}}])
        assert DungeonDistributionService._weise_offene_beute_zu(inst) == []

    def test_party_null_ist_nicht_mehr_das_erste_ziel(self) -> None:
        """Das alte Muster darf nicht zurückkehren."""
        code = QUELLE.read_text(encoding="utf-8")
        assert "first_agent_id = str(inst.party[0].agent_id)" not in code

    def test_die_begruendung_verlaesst_den_server(self) -> None:
        """`auto_assigned` muss in der Antwort stehen, sonst sieht es niemand."""
        code = QUELLE.read_text(encoding="utf-8")
        block = code[code.index("return DistributeConfirmResponse(") :]
        assert "auto_assigned=instance.auto_assigned" in block[:400]


class TestDasFeldExistiertUeberall:
    """Ein Feld, das nur an einer der drei Stellen steht, trägt nichts."""

    @pytest.mark.parametrize(
        "klasse",
        ["DungeonInstance", "DistributeConfirmResponse"],
    )
    def test_auto_assigned_ist_deklariert(self, klasse: str) -> None:
        quelle = Path("backend/models/resonance_dungeon.py").read_text(encoding="utf-8")
        baum = ast.parse(quelle)
        for knoten in ast.walk(baum):
            if isinstance(knoten, ast.ClassDef) and knoten.name == klasse:
                felder = {
                    n.target.id for n in knoten.body if isinstance(n, ast.AnnAssign) and isinstance(n.target, ast.Name)
                }
                assert "auto_assigned" in felder, f"{klasse} kennt auto_assigned nicht"
                return
        pytest.fail(f"Klasse {klasse} nicht gefunden")

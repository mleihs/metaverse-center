"""Eine Meinung muss von ihrem Startwert aus unter Null gelangen können.

Elf Monate lang konnte sie das nicht. Gemessen auf Prod am 31.08.2026:
1 177 Meinungen, Spanne 0 … 45, **null negative** — und
`relationship_threshold` (|60|) damit unerreichbar.

Die Ursache war eine geschlossene Schleife: `insult` und `confrontation` sind
die einzigen Quellen, aus denen eine Meinung sinken kann, und beide verlangten
eine bereits negative Meinung.

    insult          Meinungs-Fenster (−100, −20)   Δ −15
    confrontation   Meinungs-Fenster (−100, −50)   Δ −12

🔑 Die Bedingung der Ursache war ihre eigene Wirkung. Dieselbe Form wie N5
selbst („um unglücklich zu werden, muss man beleidigt werden — und wer
beleidigt, muss unglücklich sein"), eine Schicht tiefer: der Laune-Teil wurde am
31.08. früh aufgebrochen, der Meinungs-Teil hing nie am Laune-Fenster.

Nachgerechnet, dass keine andere Stellschraube das öffnet:

    base_compatibility ∈ [−0,3; 0,3] × 20   →  −6
    profession_rivalry −5, Kappe 1           →  −5
    zusammen                                 → −11
    gefordert                                → −20

Deshalb prüft diese Datei nicht die ZAHL 20, sondern die EIGENSCHAFT: von einer
neutralen Meinung aus muss es einen Weg nach unten geben. Wer die Zahl später
ändert, darf das — er darf nur die Schleife nicht wieder schliessen.
"""

from __future__ import annotations

import pytest

from backend.services.agent_activity_service import SOCIAL_INTERACTIONS
from backend.services.agent_opinion_service import OPINION_PRESETS, STACKING_CAPS

#: Der Wert, mit dem `_ensure_opinion_record` jede neue Meinung anlegt
#: (`base_compatibility = 0.0` → `opinion_score = 0`).
_START = 0

#: Was `relationship_threshold` verlangt, damit ein Ereignis entsteht.
_THRESHOLD = -60


def _delta(config: dict) -> int | None:
    """Die Meinungsänderung einer Interaktion, über ihr Preset."""
    preset = config.get("opinion_preset")
    if not preset:
        return None
    return OPINION_PRESETS[preset]["opinion_change"]


def _negative_interactions() -> dict[str, dict]:
    return {n: c for n, c in SOCIAL_INTERACTIONS.items() if (d := _delta(c)) is not None and d < 0}


def _selectable(config: dict, *, mood: int, opinion: int) -> bool:
    """Dieselbe Bedingung wie `_select_interaction` — beide Fenster, Agent A."""
    mood_min, mood_max = config["mood_range"]
    op_min, op_max = config["opinion_range"]
    return mood_min <= mood <= mood_max and op_min <= opinion <= op_max


class TestDieSchleifeIstOffen:
    def test_a_negative_interaction_exists_at_all(self) -> None:
        assert _negative_interactions(), "Keine Interaktion senkt eine Meinung"

    def test_at_least_one_is_selectable_from_the_neutral_start(self) -> None:
        """Der Einstieg unter Null.

        Für eine unglückliche Figur (Laune −25, gemessen: schlechteste Laune der
        Plattform ist −25) mit einer neutralen Meinung muss mindestens eine
        senkende Interaktion wählbar sein. Ohne das ist die Spanne nach unten
        geschlossen, egal wie die Zahlen sonst stehen.
        """
        offen = [
            name for name, config in _negative_interactions().items() if _selectable(config, mood=-25, opinion=_START)
        ]
        assert offen, (
            "Von einer neutralen Meinung aus ist keine senkende Interaktion wählbar — "
            "die Schleife ist wieder geschlossen: um beleidigt zu werden, müsste man "
            "schon verachtet sein."
        )

    @pytest.mark.parametrize("opinion", [-19, -10, 0, 10, 19])
    def test_the_whole_neutral_band_has_a_way_down(self, opinion: int) -> None:
        """Nicht nur der Startpunkt.

        Eine Meinung wandert durch positive Modifikatoren nach oben
        (`good_conversation` +8, gemessen 72 Zeilen). Sie darf dabei nicht in
        einen Bereich geraten, aus dem es keinen Weg zurück gibt.
        """
        offen = [
            name for name, config in _negative_interactions().items() if _selectable(config, mood=-25, opinion=opinion)
        ]
        assert offen, f"Bei Meinung {opinion} gibt es keinen Weg nach unten"


class TestZuneigungBleibtGeschuetzt:
    """Die Obergrenze ist eine Aussage, kein Rest.

    Schlechte Laune sucht sich ein Ziel, keinen Feind. Wer wirklich gemocht
    wird, wird nicht angefahren — sonst zerfällt jede Bindung, die das Spiel
    gerade erst aufbaut.
    """

    @pytest.mark.parametrize("opinion", [40, 60, 100])
    def test_a_warm_relationship_cannot_be_insulted(self, opinion: int) -> None:
        offen = [
            name for name, config in _negative_interactions().items() if _selectable(config, mood=-100, opinion=opinion)
        ]
        assert not offen, (
            f"Bei Meinung {opinion} ist {offen} wählbar — eine warme Beziehung "
            "darf nicht durch schlechte Laune zerfallen"
        )


class TestDasTorIstDanachErreichbar:
    """Ein offener Einstieg nützt nichts, wenn der Weg vor dem Tor endet."""

    def test_stacking_reaches_the_relationship_threshold(self) -> None:
        tiefste = min(
            _delta(config) * STACKING_CAPS.get(OPINION_PRESETS[config["opinion_preset"]]["stacking_group"], 5)
            for config in _negative_interactions().values()
        )
        assert tiefste <= _THRESHOLD, (
            f"Gestapelt erreicht die tiefste Kette nur {tiefste}, das Tor liegt bei {_THRESHOLD} — der Weg endet davor"
        )

    def test_the_entry_carries_itself(self) -> None:
        """Nach dem ersten Schritt muss der zweite noch möglich sein.

        Sonst bliebe jede Meinung bei genau einem negativen Modifikator stehen
        und käme nie an die Stapelkappe.
        """
        einstiege = {
            name: config
            for name, config in _negative_interactions().items()
            if _selectable(config, mood=-25, opinion=_START)
        }
        assert einstiege
        for name, config in einstiege.items():
            danach = _START + _delta(config)
            assert _selectable(config, mood=-25, opinion=danach), (
                f"{name} kann nur EINMAL zuschlagen: nach dem ersten Mal steht die "
                f"Meinung bei {danach} und liegt ausserhalb von {config['opinion_range']}"
            )


class TestConfrontationBrauchteKeineAenderung:
    """Ein Schloss öffnen, nicht zwei.

    `confrontation` verlangt −50 und wird durch gestapelte Beleidigungen von
    selbst erreichbar. Diese Zusicherung hält fest, dass das gemeint war — und
    schlägt fehl, wenn jemand sein Fenster ebenfalls aufmacht, ohne es zu
    begründen.
    """

    def test_confrontation_stays_gated_on_an_existing_dislike(self) -> None:
        config = SOCIAL_INTERACTIONS["confrontation"]
        assert config["opinion_range"][1] < 0, (
            "confrontation ist vom neutralen Start aus wählbar geworden — das war "
            "nicht die Entscheidung vom 31.08.2026 (ein Schloss öffnen, eine Runde messen)"
        )

    def test_insult_stacking_reaches_confrontations_window(self) -> None:
        insult = SOCIAL_INTERACTIONS["insult"]
        preset = OPINION_PRESETS[insult["opinion_preset"]]
        tiefste = preset["opinion_change"] * STACKING_CAPS[preset["stacking_group"]]
        assert tiefste <= SOCIAL_INTERACTIONS["confrontation"]["opinion_range"][1], (
            f"Gestapelte Beleidigungen kommen nur auf {tiefste} und erreichen "
            "confrontations Fenster nicht — dann ist die zweite Stufe tot"
        )

"""Wer ein Wort erfindet, sagt auch, wo es steht — die Python-Hälfte davon.

DAS PROBLEM, DAS DIESE KETTE LÖST
Die Taxonomie einer Welt wird aus dem abgeleitet, was das Modell geschrieben
hat. Das ist konsistent von Konstruktion her, erzeugt aber eine MENGE, und der
Verfall braucht eine FOLGE: `fn_degrade_building` bewegt einen Bau eine Leiter
abwärts, und ein Wort ohne Platz kann sich nicht bewegen. Gemessen vor Migration
320: 17 Bauten in 6 Welten verfielen nie.

Migration 320 hat die dreizehn Wörter eingehängt, die es damals gab — den
BESTAND. `ForgeBuildingDraft.condition_rung` ist die LEITUNG: das nächste
erfundene Wort bringt seinen Platz selbst mit.

DIE ARBEITSTEILUNG, DIE HIER GEPRÜFT WIRD
Python trägt die Zahl nur weiter und kanonisiert sie. Ob sie zählt, entscheidet
`fn_materialize_shard` gegen `fn_building_condition_rungs()` — die Karte liegt in
SQL, und eine zweite Fassung hier wäre genau die Doppelung, die Migration 322
entfernt hat. Deshalb prüft dieser Test NICHT, dass `good` abgewiesen wird: das
zu prüfen hiesse, es hier zu wissen.
"""

from __future__ import annotations

from backend.services.forge_taxonomies import derive_taxonomies


def _draft(buildings: list[dict]) -> dict:
    return {"buildings": buildings}


def _b(condition: str, rung: object = None, de: str | None = None) -> dict:
    row = {"building_condition": condition, "building_condition_de": de or condition}
    if rung is not None:
        row["condition_rung"] = rung
    return row


def _entry(taxonomies: dict, value: str) -> dict:
    return next(e for e in taxonomies["building_conditions"] if e["value"] == value)


def test_the_rung_travels_from_the_building_into_the_vocabulary() -> None:
    tax = derive_taxonomies(_draft([_b("sealed", 36, "Versiegelt")]))
    assert _entry(tax, "sealed")["rung"] == 36


def test_a_word_without_a_rung_carries_none_at_all() -> None:
    """Kein Vorgabewert. Ein fehlender Platz ist kein schlechter Platz — und ein
    erfundener wäre eine Behauptung, die niemand getroffen hat."""
    tax = derive_taxonomies(_draft([_b("sealed")]))
    assert "rung" not in _entry(tax, "sealed")


def test_disagreeing_buildings_are_settled_the_same_way_labels_are() -> None:
    """Zwei Bauten, dasselbe Wort, verschiedene Zahlen: die häufigste gewinnt.

    Dieselbe Regel wie bei der Beschriftung, und aus demselben Grund — das
    Ergebnis darf nicht von der Reihenfolge eines Dictionaries abhängen.
    """
    tax = derive_taxonomies(_draft([_b("sealed", 30), _b("sealed", 36), _b("sealed", 36)]))
    assert _entry(tax, "sealed")["rung"] == 36


def test_a_rung_that_is_not_a_number_is_not_a_rung() -> None:
    """`"about 30"` ist keine Sprosse, und eine daraus zu raten setzte einen Bau
    auf eine Position, die niemand gewählt hat."""
    for junk in ("about 30", "", None, True, 3.5):
        tax = derive_taxonomies(_draft([_b("sealed", junk)]))
        assert "rung" not in _entry(tax, "sealed"), f"{junk!r} wurde als Sprosse genommen"


def test_a_rung_written_as_digits_in_a_string_still_counts() -> None:
    """Modelle schreiben Zahlen manchmal als Text. Das ist eindeutig lesbar —
    im Gegensatz zu `"about 30"`, wo das Raten anfinge."""
    tax = derive_taxonomies(_draft([_b("sealed", "36")]))
    assert _entry(tax, "sealed")["rung"] == 36


def test_the_other_five_vocabularies_never_carry_a_rung() -> None:
    """Ein Beruf steht nicht über einem anderen. Nur die Bauzustände sind
    geordnet; die übrigen fünf Vokabulare sind Mengen."""
    draft = {
        "buildings": [{"building_type": "archive", "building_type_de": "Archiv", "condition_rung": 20}],
        "agents": [{"primary_profession": "clerk", "primary_profession_de": "Schreiber"}],
    }
    tax = derive_taxonomies(draft)
    for key, entries in tax.items():
        if key == "building_conditions":
            continue
        for entry in entries:
            assert "rung" not in entry, f"{key} trägt eine Sprosse"


def test_the_default_from_the_schema_arrives_as_a_real_rung() -> None:
    """`ForgeBuildingDraft.condition_rung` hat die Vorgabe 30 (= `fair`).

    Das ist Absicht und nicht dasselbe wie „keine Sprosse": ein Entwurf aus einem
    Modell, das das Feld ignoriert, bekommt die Mitte der Leiter statt gar nichts
    — und weil `fn_materialize_shard` die Zahl NUR für ein der Plattform
    unbekanntes Wort speichert, verschiebt diese Vorgabe niemals einen Kernwert.
    """
    from backend.models.forge import ForgeBuildingDraft

    field = ForgeBuildingDraft.model_fields["condition_rung"]
    assert field.default == 30
    tax = derive_taxonomies(_draft([_b("sealed", field.default)]))
    assert _entry(tax, "sealed")["rung"] == 30

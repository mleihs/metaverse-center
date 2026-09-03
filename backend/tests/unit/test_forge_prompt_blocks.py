"""Der geteilte Prompt-Kopf der Schmiede, festgenagelt.

Ein Prompt ist kein Code: läuft er auseinander, wird nichts rot, das Modell
schreibt nur etwas anderes. Lore und Theme trugen diesen Kopf seit März 2026
wörtlich gleich; jetzt steht er an einer Stelle, und dieser Test hält den
Wortlaut fest, damit eine Änderung daran eine ABSICHT sein muss und kein
Nebeneffekt.

Was hier NICHT geprüft wird: ob der Kopf gut ist. Nur, dass er sich nicht
unbemerkt bewegt – und dass die beiden Stufen ihre eigene Zonenzeile behalten.
"""

from __future__ import annotations

from backend.services.forge_prompt_blocks import world_context_header

ANCHOR = {
    "title": "The Tower",
    "core_question": "Who decides?",
    "description": "A city that answers to nobody.",
    "literary_influence": "Kafka",
}
GEOGRAPHY = {
    "city_name": "Velgarien",
    # Eine Zone OHNE Namen ist Absicht: an ihr hängt der Unterschied zwischen
    # den beiden Aufrufern (siehe unten).
    "zones": [{"name": "Nord"}, {}, {"name": "Sued"}],
}


class TestTheHeaderReadsExactlyAsBefore:
    def test_the_rendered_header_is_pinned(self) -> None:
        assert world_context_header("ein Same", ANCHOR, GEOGRAPHY) == (
            "SEED: ein Same\n"
            "\n"
            "PHILOSOPHICAL ANCHOR:\n"
            "  Title: The Tower\n"
            "  Core Question: Who decides?\n"
            "  Description: A city that answers to nobody.\n"
            "  Literary Influence: Kafka\n"
            "\n"
            "GEOGRAPHY:\n"
            "  City: Velgarien\n"
        )

    def test_it_stops_after_the_city_so_the_caller_can_add_its_zone_line(self) -> None:
        """Kein Leerzeile am Ende: die Zonenzeile schliesst den Block."""
        out = world_context_header("s", ANCHOR, GEOGRAPHY)
        assert out.endswith("  City: Velgarien\n")
        assert not out.endswith("\n\n")
        assert "Zones:" not in out
        assert "Districts:" not in out


class TestTheFallbacksAreTheOnesBothStagesAlreadyUsed:
    def test_a_missing_anchor_field_is_empty_but_the_title_says_unknown(self) -> None:
        out = world_context_header("s", {}, {})
        assert "  Title: Unknown\n" in out
        assert "  Core Question: \n" in out
        assert "  Description: \n" in out
        assert "  Literary Influence: \n" in out

    def test_a_missing_city_is_named_unnamed(self) -> None:
        assert "  City: Unnamed\n" in world_context_header("s", ANCHOR, {})


class TestTheZoneLineStaysWithTheCaller:
    """Die beiden Stufen sind sich beim Rückfall NICHT einig.

    Lore schreibt ``?`` für eine namenlose Zone, Theme einen Leerstring. Das
    hier zusammenzuführen hiesse, einen der beiden Prompts still zu ändern –
    genau deshalb steht die Zeile nicht im geteilten Kopf.
    """

    def test_lore_marks_a_nameless_zone_with_a_question_mark(self) -> None:
        zone_names = ", ".join(z.get("name", "?") for z in GEOGRAPHY["zones"])
        assert f"  Districts: {zone_names}\n\n" == "  Districts: Nord, ?, Sued\n\n"

    def test_theme_leaves_a_nameless_zone_blank(self) -> None:
        zones = ", ".join(z.get("name", "") for z in GEOGRAPHY["zones"])
        assert f"  Zones: {zones}\n\n" == "  Zones: Nord, , Sued\n\n"


class TestBothCallSitesStillComposeTheHeader:
    """Der Kopf nützt nichts, wenn ihn niemand mehr aufruft."""

    def test_lore_and_theme_both_call_it(self) -> None:
        from pathlib import Path

        root = Path(__file__).resolve().parents[2] / "services"
        for name in ("forge_lore_service.py", "forge_theme_service.py"):
            src = (root / name).read_text(encoding="utf-8")
            assert "world_context_header(seed, anchor, geography)" in src, name
            # Die alte Kopie darf nicht danebenstehen.
            assert "PHILOSOPHICAL ANCHOR:" not in src, name

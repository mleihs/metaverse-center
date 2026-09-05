"""FALLBACK_SPAWNS must cover every archetype, with ids the packs really define.

Until the Systemprüfung of 2026-08-30 the table held seven of eight archetypes.
The lookup is ``FALLBACK_SPAWNS.get(instance.archetype, FALLBACK_SPAWNS["The
Shadow"])`` — so a rest ambush in The Overthrow spawned SHADOW enemies and
nothing said a word (Befund D7).

Two things had to be true for that to survive: nothing checked the table
against the archetype list, and nothing checked the ids against the content.
Both are checked here.
"""

from __future__ import annotations

import pytest

from backend.services.content_packs.loader import load_packs
from backend.services.dungeon.dungeon_archetypes import ARCHETYPE_CONFIGS
from backend.services.dungeon_shared import FALLBACK_SPAWNS

REQUIRED_KEYS = ("boss", "default", "rest_ambush")


@pytest.fixture(scope="module")
def spawn_ids() -> set[str]:
    """Every spawn-config id the content packs define."""
    result = load_packs()
    ids: set[str] = set()
    for per_archetype in result.spawns.values():
        ids.update(per_archetype)
    return ids


class TestScannerFindsSomething:
    """A pack scan that reads nothing would make every test below vacuous."""

    def test_archetypes_are_loaded(self):
        assert len(ARCHETYPE_CONFIGS) >= 8, ARCHETYPE_CONFIGS

    def test_spawn_ids_are_loaded(self, spawn_ids):
        assert len(spawn_ids) >= 20, f"nur {len(spawn_ids)} Spawn-IDs geladen"


class TestFallbackSpawnCoverage:
    def test_every_archetype_has_a_fallback(self):
        missing = sorted(set(ARCHETYPE_CONFIGS) - set(FALLBACK_SPAWNS))
        assert not missing, f"Ohne Eintrag bekommen diese Archetypen die Gegner eines anderen: {missing}"

    def test_no_fallback_for_an_unknown_archetype(self):
        stray = sorted(set(FALLBACK_SPAWNS) - set(ARCHETYPE_CONFIGS))
        assert not stray, f"Fallback für einen Archetyp, den es nicht gibt: {stray}"

    @pytest.mark.parametrize("archetype", sorted(ARCHETYPE_CONFIGS))
    def test_every_entry_is_complete(self, archetype):
        entry = FALLBACK_SPAWNS[archetype]
        missing = [key for key in REQUIRED_KEYS if not entry.get(key)]
        assert not missing, f"{archetype} fehlt: {missing}"

    @pytest.mark.parametrize("archetype", sorted(ARCHETYPE_CONFIGS))
    def test_ids_exist_in_the_content_packs(self, archetype, spawn_ids):
        """A typo here is as invisible as a missing entry — same defect class."""
        for key, spawn_id in FALLBACK_SPAWNS[archetype].items():
            assert spawn_id in spawn_ids, (
                f"{archetype}/{key} verweist auf '{spawn_id}', das kein Inhaltspaket definiert"
            )

    @pytest.mark.parametrize("archetype", sorted(ARCHETYPE_CONFIGS))
    def test_ids_belong_to_their_own_archetype(self, archetype):
        """The whole point: nobody may borrow another archetype's monsters."""
        own = load_packs().spawns.get(archetype, {})
        for key, spawn_id in FALLBACK_SPAWNS[archetype].items():
            assert spawn_id in own, (
                f"{archetype}/{key} = '{spawn_id}' gehört einem anderen Archetyp — "
                f"genau der Fehler, den The Overthrow hatte"
            )

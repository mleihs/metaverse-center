"""Enemy scene art: the publish precondition and the DTO hops that carry it.

Rollout Phase 3a gave every creature an image. The path travels
EnemyTemplate (pack) -> EnemyInstance (spawn) -> EnemyCombatStateClient
(checkpoint) -> the graphical scene band. Each hop is a plain copy, which is
exactly the wiring that goes missing when a field is added beside it and nobody
notices the art quietly stopped rendering.

Deliberately NOT covered here, because it already is elsewhere:
  - path shape and creature ownership -> `_check_enemy_art_paths` in
    scripts/validate_content_packs.py, run by the `content-packs` CI step.
  - what the seed migration emits -> the generator is deterministic and its
    output is committed.

What IS covered is the gap between them: the pack may declare art whose master
never made it into the repo. The validator cannot see that (it reads YAML, not
the asset directory) and the CI content step would pass. `collect_jobs()` is
the one place that resolves declaration to file, so running it here fails the
pull request instead of the publish, weeks later.
"""

from __future__ import annotations

from backend.models.combat import EnemyInstance
from backend.models.resonance_dungeon import EnemyCombatStateClient
from backend.services.dungeon.dungeon_combat import spawn_enemies
from scripts.ingest_dungeon_enemy_art import EXPECTED_SUFFIX, collect_jobs


class TestPublishPrecondition:
    def test_every_declared_creature_image_has_a_master_in_the_repo(self):
        """Raises SystemExit naming every creature whose declared art is absent
        from assets/dungeon-enemies/ or is a rendition this pipeline cannot
        produce.

        A creature with NO art is not a violation: image_path is optional and
        the scene falls back to a clip-path silhouette, which is how a creature
        authored ahead of its artwork is meant to look.
        """
        jobs = collect_jobs()
        assert jobs, "no creature declares scene art — did image_path drop out of the pack?"


class TestDtoChain:
    def test_spawn_copies_the_template_path_onto_every_instance(self):
        """Hop one, dungeon_combat.spawn_enemies. Two wisps from one template
        each carry the art: the band draws every instance separately."""
        instances = spawn_enemies("shadow_whispers_spawn", 1, 1)
        assert instances, "spawn config produced no enemies"
        for inst in instances:
            assert inst.image_path == f"dungeon-enemies/{inst.template_id}{EXPECTED_SUFFIX}"

    def test_client_dto_carries_the_path(self):
        """Hop two, the projection in DungeonCheckpointService. The path is
        public content, unlike the exact step counts the same projection
        deliberately abstracts into condition_display."""
        inst = _instance(image_path="dungeon-enemies/shadow_wisp-384.avif")
        assert _project(inst).image_path == "dungeon-enemies/shadow_wisp-384.avif"

    def test_the_chain_tolerates_a_creature_without_art(self):
        """The silhouette fallback must survive every hop, or making art
        optional buys nothing: an unillustrated creature has to spawn and
        project like any other."""
        assert _project(_instance(image_path=None)).image_path is None

    def test_instances_checkpointed_before_the_field_existed_still_load(self):
        """Runs already in flight were serialized without image_path. They must
        deserialize into a silhouette, not raise."""
        legacy = _instance().model_dump()
        del legacy["image_path"]
        assert EnemyInstance.model_validate(legacy).image_path is None


def _instance(*, image_path: str | None = None) -> EnemyInstance:
    return EnemyInstance(
        instance_id="shadow_wisp_abc123",
        template_id="shadow_wisp",
        name_en="Shadow Wisp",
        name_de="Schattenglimmer",
        condition_steps_remaining=1,
        condition_steps_max=1,
        stress_resistance=50,
        evasion=40,
        image_path=image_path,
    )


def _project(inst: EnemyInstance) -> EnemyCombatStateClient:
    """The same field-for-field projection DungeonCheckpointService performs."""
    return EnemyCombatStateClient(
        instance_id=inst.instance_id,
        name_en=inst.name_en,
        name_de=inst.name_de,
        condition_display=inst.condition_display,
        threat_level=inst.threat_level,
        is_alive=inst.is_alive,
        image_path=inst.image_path,
    )

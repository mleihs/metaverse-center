"""Generate JSON Schema files for content packs.

The YAML packs reference a JSON Schema at the top of each file via the
`yaml-language-server` directive, which enables autocomplete, hover docs,
and inline validation in VSCode's YAML extension. Pydantic v2 emits JSON
Schema directly from each pack model — we just serialize and write.

Regenerate after schema changes:

    .venv/bin/python scripts/generate_pack_json_schemas.py

Output lives in `content/schema/*.json` and is committed to the repo.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.services.content_packs.schemas import (  # noqa: E402
    AbilityPack,
    AnchorPack,
    BanterPack,
    BarometerTextPack,
    EncounterPack,
    EnemyPack,
    EntranceTextPack,
    LootPack,
    SpawnPack,
)

DEFAULT_OUTPUT = PROJECT_ROOT / "content" / "schema"

PACK_CLASSES = {
    "encounter_pack": EncounterPack,
    "banter_pack": BanterPack,
    "loot_pack": LootPack,
    "enemy_pack": EnemyPack,
    "spawn_pack": SpawnPack,
    "anchor_pack": AnchorPack,
    "entrance_text_pack": EntranceTextPack,
    "barometer_text_pack": BarometerTextPack,
    "ability_pack": AbilityPack,
}


def main() -> int:
    DEFAULT_OUTPUT.mkdir(parents=True, exist_ok=True)

    for stem, cls in PACK_CLASSES.items():
        schema = cls.model_json_schema()
        out_path = DEFAULT_OUTPUT / f"{stem}.schema.json"
        out_path.write_text(json.dumps(schema, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        print(f"  wrote {out_path.relative_to(PROJECT_ROOT)}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

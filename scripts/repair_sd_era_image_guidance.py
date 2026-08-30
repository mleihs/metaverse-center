"""Repair `image_guidance_scale` rows left behind by the image-model family switch.

Finding 14 in ``docs/analysis/forge-prod-run-2026-08-30.md``.

WHAT IS WRONG
-------------
``simulation_settings.image_guidance_scale`` is ONE key read by two branches of
``ModelResolver.resolve_image_model`` whose scales differ: Stable Diffusion wants
around 7.5, flux wants around 3.5. When the platform switched its default image
model to flux, the rows written in the SD era stayed behind in the SD scale, and
the only clamp is at 10.0 — flux-dev's API maximum, not its usable range — so it
catches none of them.

Measured on production 2026-08-30, across all 41 worlds:

| stored | worlds | resolve to flux | own image_model_* row | last written |
|-------:|-------:|----------------:|----------------------:|:-------------|
|    7.5 |     14 |              14 | 3 (11 inherit flux)   | 2026-04-10   |
|    5.0 |     16 |              16 | 16                    | 2026-03-20   |
|    3.5 |     11 |              11 | 9                     | 2026-08-29   |

WHAT THIS SCRIPT TOUCHES, AND WHAT IT REFUSES TO
------------------------------------------------
Only the **7.5** cohort, and only where the world actually resolves a flux model.

7.5 is exactly ``PLATFORM_DEFAULT_PARAMS["image_guidance_scale"]``, the SD-era
platform default. Nobody chose it — it is residue from before the switch, and
putting it back to the flux default is a restoration.

5.0 is left alone, deliberately. It is not a platform default in either family,
so somebody or something chose it, and changing it would be an aesthetic
decision about how sixteen worlds look. That belongs to whoever owns the
surface, not to a repair script. The same reasoning refused an invented "sane
flux ceiling" in the resolver itself.

A world whose ``image_model_*`` rows are all non-flux is skipped and reported:
for that world 7.5 is the right number, and there is no such world on production
today — but the check is what makes the rule true rather than merely currently
true.

Conventions, matching ``repair_simulation_prompt_templates.py``:

* dry run is the default; ``--apply`` writes;
* ``--apply`` first dumps every affected row verbatim to a backup file, so the
  change is reversible with ``--restore``;
* the target database is always printed, and ``--apply`` refuses to run unless
  the target was named explicitly — the first dry run of the sibling script
  silently read local Supabase and reported the wrong row count.

Usage:

    python scripts/repair_sd_era_image_guidance.py
    python scripts/repair_sd_era_image_guidance.py --target production
    python scripts/repair_sd_era_image_guidance.py --target production --apply
    python scripts/repair_sd_era_image_guidance.py --target production \\
        --restore backups/image-guidance/image_guidance_….json
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.dependencies import get_admin_supabase  # noqa: E402
from backend.services.model_resolver import PLATFORM_DEFAULT_IMAGE_MODELS, PLATFORM_DEFAULT_PARAMS  # noqa: E402
from backend.utils.responses import extract_list  # noqa: E402
from supabase import acreate_client  # noqa: E402

PRODUCTION_ENV_FILE = Path.home() / ".config" / "metaspots" / "velgarien-coolify.env"

SETTING_KEY = "image_guidance_scale"

# Read from the resolver rather than written out here, so the script cannot
# disagree with the code whose behaviour it is repairing. `sd_default` is the
# value that identifies residue; `flux_default` is what it becomes.
SD_DEFAULT = float(PLATFORM_DEFAULT_PARAMS["image_guidance_scale"])
FLUX_DEFAULT = float(PLATFORM_DEFAULT_PARAMS["flux_guidance"])

# When a world has no `image_model_*` row it inherits this, and if that is a
# flux model the SD-era guidance reaches flux. On production 11 of the 14
# affected worlds are in exactly that position.
INHERITED_MODEL = PLATFORM_DEFAULT_IMAGE_MODELS["fallback"]


class Colour:
    """ANSI codes, suppressed when stdout is not a terminal."""

    enabled = sys.stdout.isatty()

    @classmethod
    def _wrap(cls, code: str, text: str) -> str:
        return f"\033[{code}m{text}\033[0m" if cls.enabled else text

    @classmethod
    def bold(cls, text: str) -> str:
        return cls._wrap("1", text)

    @classmethod
    def red(cls, text: str) -> str:
        return cls._wrap("31", text)

    @classmethod
    def green(cls, text: str) -> str:
        return cls._wrap("32", text)

    @classmethod
    def dim(cls, text: str) -> str:
        return cls._wrap("2", text)


def _read_env_file(path: Path) -> dict[str, str]:
    """Parse a KEY=value env file. No shell, no export, no interpolation."""
    values: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


async def _connect(target: str) -> tuple[Any, str]:
    """Return (client, host) for the named target."""
    if target == "production":
        if not PRODUCTION_ENV_FILE.exists():
            raise FileNotFoundError(f"No production credentials at {PRODUCTION_ENV_FILE}")
        env = _read_env_file(PRODUCTION_ENV_FILE)
        url = env.get("SUPABASE_URL", "")
        key = env.get("SUPABASE_SERVICE_ROLE_KEY", "")
        if not url or not key:
            raise KeyError(f"{PRODUCTION_ENV_FILE} lacks SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
        return await acreate_client(url, key), url

    from backend.config import settings

    return await get_admin_supabase(), settings.supabase_url


def _as_float(value: Any) -> float | None:
    """Read a jsonb setting value as a number, or None if it is not one."""
    if isinstance(value, bool):
        return None
    if isinstance(value, int | float):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value.strip().strip('"'))
        except ValueError:
            return None
    return None


async def _load(supabase: Any) -> tuple[list[dict], dict[str, list[str]], dict[str, str]]:
    """Guidance rows, each world's image models, and each world's name."""
    guidance = extract_list(
        await supabase.table("simulation_settings")
        .select("id, simulation_id, setting_value, setting_key")
        .eq("setting_key", SETTING_KEY)
        .execute()
    )
    models: dict[str, list[str]] = {}
    for row in extract_list(
        await supabase.table("simulation_settings")
        .select("simulation_id, setting_key, setting_value")
        .like("setting_key", "image_model_%")
        .execute()
    ):
        value = row.get("setting_value")
        text = value.strip('"') if isinstance(value, str) else str(value)
        models.setdefault(str(row["simulation_id"]), []).append(text)

    names = {
        str(row["id"]): row.get("slug") or row.get("name") or str(row["id"])
        for row in extract_list(await supabase.table("simulations").select("id, slug, name").execute())
    }
    return guidance, models, names


def _plan(
    guidance: list[dict],
    models: dict[str, list[str]],
    names: dict[str, str],
) -> tuple[list[dict], list[dict], dict[float, int]]:
    """Split the rows into (repair, skip, distribution)."""
    repair: list[dict] = []
    skip: list[dict] = []
    distribution: dict[float, int] = {}

    for row in guidance:
        value = _as_float(row.get("setting_value"))
        sim_id = str(row["simulation_id"])
        if value is not None:
            distribution[value] = distribution.get(value, 0) + 1

        own = models.get(sim_id) or []
        effective = own or [INHERITED_MODEL]
        resolves_flux = any("flux" in model.lower() for model in effective)
        entry = {
            "id": row["id"],
            "simulation_id": sim_id,
            "world": names.get(sim_id, sim_id),
            "value": value,
            "models": effective,
            "inherited": not own,
            "resolves_flux": resolves_flux,
        }

        if value is None or value != SD_DEFAULT:
            continue
        if not resolves_flux:
            entry["reason"] = "resolves no flux model — 7.5 is the right number here"
            skip.append(entry)
            continue
        repair.append(entry)

    return repair, skip, distribution


def _write_backup(rows: list[dict], directory: Path) -> Path:
    directory.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    path = directory / f"image_guidance_{stamp}.json"
    path.write_text(
        json.dumps(
            {
                "written_at": datetime.now(UTC).isoformat(),
                "note": "Pre-repair snapshot. Restore with --restore <this file>.",
                "setting_key": SETTING_KEY,
                "rows": [
                    {"id": r["id"], "simulation_id": r["simulation_id"], "setting_value": r["value"]} for r in rows
                ],
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    return path


async def _restore(supabase: Any, path: Path) -> bool:
    payload = json.loads(path.read_text(encoding="utf-8"))
    rows = payload.get("rows", [])
    print(Colour.bold(f"Restoring {len(rows)} rows from {path}"))
    failed = 0
    for row in rows:
        try:
            await (
                supabase.table("simulation_settings")
                .update({"setting_value": json.dumps(row["setting_value"])})
                .eq("id", row["id"])
                .execute()
            )
        except Exception as exc:  # noqa: BLE001 - a script reports and continues
            failed += 1
            print(Colour.red(f"  {row['id']}: {exc}"))
    print(Colour.green(f"Restored {len(rows) - failed} of {len(rows)}."))
    return failed > 0


async def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument(
        "--target",
        choices=("env", "production"),
        help="which database to talk to. 'env' (default) follows backend settings, which on a "
        "developer machine is local Supabase. Required explicitly for --apply.",
    )
    parser.add_argument("--apply", action="store_true", help="write the repair (default: dry run)")
    parser.add_argument("--restore", type=Path, help="put back a backup file written by --apply")
    parser.add_argument(
        "--backup-dir",
        type=Path,
        default=PROJECT_ROOT / "backups" / "image-guidance",
        help="where --apply writes its snapshot",
    )
    args = parser.parse_args()

    if (args.apply or args.restore) and args.target is None:
        print(Colour.red("Refusing to write without --target. Name the database: env or production."))
        return 2

    try:
        supabase, host = await _connect(args.target or "env")
    except Exception as exc:  # noqa: BLE001 - a script's top level reports and exits
        print(Colour.red(f"Could not reach the database: {exc}"))
        return 2

    print(Colour.bold(f"TARGET: {host}"))
    print(Colour.dim(f"SD-era default {SD_DEFAULT} → flux default {FLUX_DEFAULT}; inherited model {INHERITED_MODEL}"))

    if args.restore:
        return 1 if await _restore(supabase, args.restore) else 0

    guidance, models, names = await _load(supabase)
    repair, skip, distribution = _plan(guidance, models, names)

    print(f"\n{len(guidance)} worlds carry an {SETTING_KEY} row:")
    for value in sorted(distribution):
        marker = "  ← SD-era default" if value == SD_DEFAULT else ("  ← flux default" if value == FLUX_DEFAULT else "")
        print(f"  {value:>5} : {distribution[value]:>3} worlds{Colour.dim(marker)}")

    if skip:
        print(Colour.dim(f"\n{len(skip)} rows at {SD_DEFAULT} left alone:"))
        for entry in skip:
            print(Colour.dim(f"  {entry['world']}: {entry['reason']}"))

    if not repair:
        print(Colour.green("\nNothing to repair."))
        return 0

    print(Colour.bold(f"\n{len(repair)} rows to repair ({SD_DEFAULT} → {FLUX_DEFAULT}):"))
    for entry in repair:
        source = "inherits " + INHERITED_MODEL if entry["inherited"] else ", ".join(sorted(set(entry["models"])))
        print(f"  {entry['world']:<58} {source}")

    if not args.apply:
        print(Colour.bold("\nDry run. Nothing was written. Re-run with --apply to repair."))
        return 0

    backup = _write_backup(repair, args.backup_dir)
    print(Colour.dim(f"\nBackup written to {backup}"))

    failed = 0
    for entry in repair:
        try:
            await (
                supabase.table("simulation_settings")
                .update({"setting_value": json.dumps(FLUX_DEFAULT)})
                .eq("id", entry["id"])
                .execute()
            )
        except Exception as exc:  # noqa: BLE001 - a script reports and continues
            failed += 1
            print(Colour.red(f"  {entry['world']}: {exc}"))

    print(Colour.green(f"\nRepaired {len(repair) - failed} of {len(repair)} rows."))
    print(Colour.dim(f"Undo with: --target {args.target} --restore {backup}"))
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))

#!/usr/bin/env python
"""Repair simulation-owned prompt templates against their contract.

Phase A.6 of the Forge lets a model write a world's prompt templates and stored
the result unchecked. Migrations 026 and 028 seeded curated per-world templates
in Mustache syntax (``{{agent_name}}``), which ``str.format`` never substitutes.
Both defects are invisible at runtime: the renderer left the placeholder
standing and a second model downstream filled the hole with something plausible.

Measured on production, 2026-08-30 (docs/analysis/forge-prod-run-2026-08-30.md,
findings 5, 6, 23): 48 simulation-owned rows across 9 worlds, of which 8 carry
invented placeholders and 16 are written in the wrong syntax.

What this does to a row whose ``template_type`` has a contract:

* ``{{name}}`` -> ``{name}`` when the code supplies ``name``;
* a sentence that names an undeclared variable **and no declared one** is
  removed whole — it existed only to present data that never arrives, and
  stripping just the token left the ATRAMENT portrait reading
  *"Pinned to the lapel is a diagnosis: 'Leserlichkeit: %'"*, which still tells
  an image model to draw a badge;
* otherwise the token alone is removed and the gap it leaves is closed. The
  sentence stays, because it carries a variable that does arrive.
  Prose is never rewritten, only cut at those seams — every cut is printed
  below before anything is written;
* ``variables`` -> a real JSON array of the names the repaired text uses. A.6
  wrote ``json.dumps([])`` into a jsonb column, i.e. the *string* "[]".

Rows whose type has no contract (``embassy_pair_generation``, ``agent_backstory``,
the scanner prompts) are reported and left alone: no declaration, no authority.
Platform rows are out of scope — they are seeded by migrations and are repaired
by one (see 20260830120000_280_prompt_template_one_syntax.sql).

Safety:

* dry run is the default; ``--apply`` writes;
* ``--apply`` first dumps every affected row verbatim to a backup file, so the
  change is reversible with ``--restore``;
* the target database is always printed, and ``--apply`` refuses to run unless
  ``--target`` was named explicitly. ``.env`` points at local Supabase on a
  developer machine, so a script that quietly followed it would report on one
  database and could be believed about another.

Usage:
    python scripts/repair_simulation_prompt_templates.py                     # dry run, local
    python scripts/repair_simulation_prompt_templates.py --target production # dry run, prod
    python scripts/repair_simulation_prompt_templates.py --target production --apply
    python scripts/repair_simulation_prompt_templates.py --target production \
        --restore backups/prompt-templates/prompt_templates_….json

Exit codes:
  0 — nothing to repair, or the repair succeeded
  1 — at least one row failed to update
  2 — could not reach the database, or the target was not named for a write
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
from backend.services.prompt_contracts import get_contract, sanitize_template  # noqa: E402
from backend.utils.responses import extract_list  # noqa: E402
from supabase import acreate_client  # noqa: E402

# Where the production service-role credentials live on an operator machine.
# Documented in ~/.config/metaspots/SUPABASE-ACCESS.md; never in the repo.
PRODUCTION_ENV_FILE = Path.home() / ".config" / "metaspots" / "velgarien-coolify.env"

# Columns carrying template text. Both are rendered; both are repaired.
TEXT_FIELDS = ("prompt_content", "system_prompt")

# Everything needed to put a row back exactly as it was.
BACKUP_FIELDS = ("id", "simulation_id", "template_type", "locale", *TEXT_FIELDS, "variables")


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
    """Return (client, host) for the named target.

    ``env`` follows backend settings — on a developer machine that is local
    Supabase. ``production`` reads the service-role credentials from the
    operator's config directory, so the choice is stated rather than inherited.
    """
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


def _normalise_variables(value: Any) -> list[dict[str, str]] | None:
    """Read the stored ``variables`` column, whatever shape it is in.

    Seeded rows hold a jsonb array; A.6 rows hold the jsonb *string* "[]".
    """
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError:
            return None
    if isinstance(value, list):
        return [entry for entry in value if isinstance(entry, dict)]
    return None


def _plan_row(row: dict) -> dict | None:
    """Work out what a row needs. Returns None when it is already correct."""
    contract = get_contract(row.get("template_type", ""))
    if contract is None:
        return None

    update: dict[str, Any] = {}
    changes: list[str] = []
    used: set[str] = set()

    for field in TEXT_FIELDS:
        original = row.get(field) or ""
        if not original:
            continue
        result = sanitize_template(original, contract)
        used.update(result.used_variables)
        if result.changed:
            update[field] = result.text
            for defect, names in result.audit.defects.items():
                changes.append(f"{field}: {defect.value} {sorted(names)}")

    declared = [{"name": name} for name in sorted(used)]
    stored = _normalise_variables(row.get("variables"))
    if stored != declared:
        update["variables"] = declared
        changes.append(f"variables: {_describe(stored)} -> {[entry['name'] for entry in declared]}")

    if not update:
        return None
    return {"row": row, "update": update, "changes": changes}


def _describe(stored: list[dict[str, str]] | None) -> str:
    if stored is None:
        return "<not an array>"
    return str([entry.get("name", "?") for entry in stored])


def _print_plan(plan: dict, *, verbose: bool) -> None:
    row = plan["row"]
    print(
        f"\n{Colour.bold(row['template_type'])}  "
        f"{Colour.dim(f'{row.get("sim_name", row["simulation_id"])} · {row["locale"]} · {row["id"]}')}"
    )
    for change in plan["changes"]:
        print(f"    {Colour.red('-')} {change}")
    if not verbose:
        return
    for field in TEXT_FIELDS:
        if field not in plan["update"]:
            continue
        print(f"    {Colour.dim('--- before ---')}")
        print("    " + (row.get(field) or "").replace("\n", "\n    "))
        print(f"    {Colour.dim('--- after ----')}")
        print("    " + plan["update"][field].replace("\n", "\n    "))


async def _load_rows(supabase, simulation_id: str | None) -> list[dict]:
    query = (
        supabase.table("prompt_templates")
        .select("*, simulations(name)")
        .not_.is_("simulation_id", "null")
        .order("template_type")
    )
    if simulation_id:
        query = query.eq("simulation_id", simulation_id)
    response = await query.execute()

    rows = extract_list(response)
    for row in rows:
        joined = row.pop("simulations", None) or {}
        row["sim_name"] = joined.get("name") or row.get("simulation_id")
    return rows


def _write_backup(plans: list[dict], directory: Path) -> Path:
    directory.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    path = directory / f"prompt_templates_{stamp}.json"
    payload = {
        "created_at": datetime.now(UTC).isoformat(),
        "note": "Pre-repair snapshot. Restore with --restore <this file>.",
        "rows": [{field: plan["row"].get(field) for field in BACKUP_FIELDS} for plan in plans],
    }
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    return path


async def _apply(supabase, plans: list[dict]) -> int:
    failures = 0
    for plan in plans:
        row_id = plan["row"]["id"]
        response = await supabase.table("prompt_templates").update(plan["update"]).eq("id", row_id).execute()
        if not response.data:
            failures += 1
            print(Colour.red(f"  FAILED to update {row_id}"))
        else:
            print(Colour.green(f"  updated {plan['row']['template_type']} · {row_id}"))
    return failures


async def _restore(supabase, path: Path) -> int:
    payload = json.loads(path.read_text(encoding="utf-8"))
    rows = payload.get("rows", [])
    print(f"Restoring {len(rows)} rows from {path}")
    failures = 0
    for row in rows:
        update = {field: row.get(field) for field in (*TEXT_FIELDS, "variables")}
        response = await supabase.table("prompt_templates").update(update).eq("id", row["id"]).execute()
        if not response.data:
            failures += 1
            print(Colour.red(f"  FAILED to restore {row['id']}"))
        else:
            print(Colour.green(f"  restored {row['template_type']} · {row['id']}"))
    return failures


async def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument(
        "--target",
        choices=("env", "production"),
        help="which database to talk to. 'env' (default) follows backend settings, which on a "
        "developer machine is local Supabase. Required explicitly for --apply.",
    )
    parser.add_argument("--apply", action="store_true", help="write the repair (default: dry run)")
    parser.add_argument("--simulation", help="restrict to one simulation id")
    parser.add_argument("--verbose", action="store_true", help="print the full before/after text")
    parser.add_argument("--restore", type=Path, help="put back a backup file written by --apply")
    parser.add_argument(
        "--backup-dir",
        type=Path,
        default=PROJECT_ROOT / "backups" / "prompt-templates",
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

    if args.restore:
        return 1 if await _restore(supabase, args.restore) else 0

    rows = await _load_rows(supabase, args.simulation)
    print(f"{len(rows)} simulation-owned template rows")

    plans: list[dict] = []
    skipped: list[dict] = []
    for row in rows:
        if get_contract(row.get("template_type", "")) is None:
            skipped.append(row)
            continue
        plan = _plan_row(row)
        if plan:
            plans.append(plan)

    if skipped:
        types = sorted({row["template_type"] for row in skipped})
        print(Colour.dim(f"{len(skipped)} rows left alone — no contract declared for: {', '.join(types)}"))

    if not plans:
        print(Colour.green("Nothing to repair — every contracted row already matches."))
        return 0

    print(Colour.bold(f"\n{len(plans)} rows need repair:"))
    for plan in plans:
        _print_plan(plan, verbose=args.verbose)

    if not args.apply:
        print(Colour.bold("\nDry run. Nothing was written. Re-run with --apply to repair."))
        return 0

    backup = _write_backup(plans, args.backup_dir)
    print(Colour.bold(f"\nBackup written: {backup}"))
    print(Colour.bold("Applying:"))
    failures = await _apply(supabase, plans)
    if failures:
        print(Colour.red(f"\n{failures} of {len(plans)} updates failed. Restore with:"))
        print(f"  python {Path(__file__).relative_to(PROJECT_ROOT)} --restore {backup}")
        return 1
    print(Colour.green(f"\n{len(plans)} rows repaired. Undo with:"))
    print(f"  python {Path(__file__).relative_to(PROJECT_ROOT)} --restore {backup}")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))

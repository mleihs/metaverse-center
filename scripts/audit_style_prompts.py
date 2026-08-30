"""List the stored style prompts that describe a picture instead of a style.

Finding 28 in ``docs/analysis/forge-prod-run-2026-08-30.md``.

WHAT THIS IS FOR
----------------
``theme_contrast.audit_style_prompts`` already runs at generation time
(``ForgeThemeService``), so a world made from today on is checked as it is
built. What has never been done is the look backwards: the 41 worlds that
already exist were generated before the rule was written, and their style
prompts were measured once, by hand, for the analysis.

This is that measurement as a tool. It reads and reports; it writes nothing,
and it has no ``--apply``. That is deliberate and it is the finding's own
instruction: rewriting a world's visual identity is an editorial act, and it
belongs to whoever owns the surface. A script that quietly rephrased 29 style
prompts across 18 worlds would be changing how those worlds look without anyone
deciding to.

WHY A STYLE PROMPT THAT NAMES A SUBJECT IS A DEFECT
---------------------------------------------------
The style prompt is appended to EVERY image prompt in its world, after the
per-entity description. Whatever it says last wins. One shipped prompt named a
subject and a measurement; it made every portrait in that world male regardless
of the agent, gave each the same badge with the same invented number, and made
them look alike — the original complaint about the Forge, traced to its source.
Repairing the template and regenerating the description did not help, because
this ran after both.

ABOUT THE NUMERALS, BECAUSE THE RULE WAS WRONG ONCE
---------------------------------------------------
The first version of the check flagged any numeral and hit 42 of 123. Looking at
what those numerals were: 13x ``1970s``, 12x ``35mm``, 12x ``1979``, ``16:9``,
``f/8``, ``f/2.8``, ``85mm``, ``24mm``, ``CP437``, ``80x25`` — precisely the
vocabulary a style is written in. A gate that fires on nearly every world is
switched off within a week, and then it misses the real case too. The rule now
catches only a numeral presented as a *measurement*: a percentage, or a label
with a value after a colon. Four tests in ``test_theme_contrast.py`` hold the
legitimate vocabulary as legal so it cannot drift wide again.

Usage:

    python scripts/audit_style_prompts.py
    python scripts/audit_style_prompts.py --target production
    python scripts/audit_style_prompts.py --target production --verbose
    python scripts/audit_style_prompts.py --target production --json > flagged.json
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.dependencies import get_admin_supabase  # noqa: E402
from backend.services.theme_contrast import (  # noqa: E402
    STYLE_PROMPT_KEYS,
    STYLE_PROMPT_MAX_WORDS,
    audit_style_prompts,
)
from backend.utils.responses import extract_list  # noqa: E402
from supabase import acreate_client  # noqa: E402

PRODUCTION_ENV_FILE = Path.home() / ".config" / "metaspots" / "velgarien-coolify.env"


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


def _as_text(value: Any) -> str:
    """Read a jsonb setting value as plain text."""
    if isinstance(value, str):
        return value.strip('"')
    return str(value) if value is not None else ""


async def _load(supabase: Any) -> dict[str, dict[str, str]]:
    """``{world: {style_prompt_key: text}}`` for every world that has any."""
    rows = extract_list(
        await supabase.table("simulation_settings")
        .select("simulation_id, setting_key, setting_value")
        .in_("setting_key", list(STYLE_PROMPT_KEYS))
        .execute()
    )
    names = {
        str(row["id"]): row.get("slug") or row.get("name") or str(row["id"])
        for row in extract_list(await supabase.table("simulations").select("id, slug, name").execute())
    }
    worlds: dict[str, dict[str, str]] = {}
    for row in rows:
        world = names.get(str(row["simulation_id"]), str(row["simulation_id"]))
        worlds.setdefault(world, {})[row["setting_key"]] = _as_text(row.get("setting_value"))
    return worlds


async def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument(
        "--target",
        choices=("env", "production"),
        default="env",
        help="which database to read. 'env' (default) follows backend settings, which on a "
        "developer machine is local Supabase.",
    )
    parser.add_argument("--verbose", action="store_true", help="print the full text of each flagged prompt")
    parser.add_argument("--json", action="store_true", help="emit the findings as JSON instead of a report")
    args = parser.parse_args()

    try:
        supabase, host = await _connect(args.target)
    except Exception as exc:  # noqa: BLE001 - a script's top level reports and exits
        print(Colour.red(f"Could not reach the database: {exc}"))
        return 2

    worlds = await _load(supabase)

    flagged: list[dict[str, Any]] = []
    prompt_count = 0
    for world in sorted(worlds):
        theme = worlds[world]
        prompt_count += sum(1 for value in theme.values() if value.strip())
        for finding in audit_style_prompts(theme):
            flagged.append(
                {
                    "world": world,
                    "key": finding.key,
                    "problems": list(finding.problems),
                    "words": finding.word_count,
                    "text": theme.get(finding.key, ""),
                }
            )

    if args.json:
        print(json.dumps({"host": host, "prompts": prompt_count, "flagged": flagged}, indent=2, ensure_ascii=False))
        return 0

    print(Colour.bold(f"TARGET: {host}"))
    print(Colour.dim("Rule: a style may not name a subject, state a measurement, ask for readable"))
    print(Colour.dim(f"text, or run past {STYLE_PROMPT_MAX_WORDS} words. Legitimate style vocabulary"))
    print(Colour.dim("(1970s, 35mm, f/8, 16:9, CP437) is explicitly legal — see test_theme_contrast.py."))
    print()
    print(f"{prompt_count} style prompts across {len(worlds)} worlds")

    if not flagged:
        print(Colour.green("\nNothing flagged."))
        return 0

    affected = {entry["world"] for entry in flagged}
    print(Colour.bold(f"{len(flagged)} flagged in {len(affected)} worlds:\n"))

    reasons: dict[str, int] = {}
    current = ""
    for entry in flagged:
        if entry["world"] != current:
            current = entry["world"]
            print(Colour.bold(f"  {current}"))
        key = str(entry["key"]).removeprefix("image_style_prompt_")
        print(f"    {key:<10} {', '.join(entry['problems'])}")
        for problem in entry["problems"]:
            head = problem.split(" (")[0]
            reasons[head] = reasons.get(head, 0) + 1
        if args.verbose:
            print(Colour.dim(f"      {entry['text']}"))

    print(Colour.bold("\nBy reason:"))
    for reason, count in sorted(reasons.items(), key=lambda kv: -kv[1]):
        print(f"  {count:>3}  {reason}")

    print(
        Colour.dim(
            "\nNothing was written, and there is no --apply. Rewriting a world's visual\n"
            "identity is an editorial act; this reports so someone can decide."
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))

#!/usr/bin/env python3
"""Give the existing agents a personality — and therefore an inner life.

Befund N1 der Systemprüfung. `PersonalityExtractionService` has no caller
anywhere in the backend, so on production:

    select count(*) filter (where personality_profile = '{}') from agents;
    → 258 of 258

and, because `_derive_autonomy_params` never ran either:

    select count(distinct resilience), count(distinct volatility),
           count(distinct sociability) from agent_mood;
    → 1, 1, 1

**Every agent in every world is behaviourally identical.** Need decay, mood
volatility, sociability — one number for all 258. The heartbeat's whole
personality layer, every Big Five modifier in skill checks, the neuroticism
term in stress, the banter personality filters: all reading a neutral default.

The write path is wired for NEW worlds (`forge_orchestrator_service`
materialization). This script is for the ones that already exist.

## Why this is a script and not a migration

One model call per agent. 258 agents is 258 calls, and the owner has switched
the narrative layers off for cost. That is a decision, not a repair, so it is
made deliberately, per world if wanted, with the count printed first.

    python scripts/backfill_agent_personalities.py                      # dry run, local
    python scripts/backfill_agent_personalities.py --target production  # dry run, prod
    python scripts/backfill_agent_personalities.py --target production --simulation <id> --apply
    python scripts/backfill_agent_personalities.py --target production --apply

Dry run is the default and prints exactly what would be spent. `--apply`
requires `--target` explicitly, so nobody spends money on production by
forgetting a flag.
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from supabase import acreate_client  # noqa: E402

from backend.dependencies import get_admin_supabase  # noqa: E402
from backend.services.personality_extraction_service import (  # noqa: E402
    PersonalityExtractionService,
)
from backend.utils.db import extract_list  # noqa: E402

PRODUCTION_ENV_FILE = Path.home() / ".config" / "metaspots" / "velgarien-coolify.env"


def _read_env_file(path: Path) -> dict[str, str]:
    """Parse a KEY=value env file. No shell, no export, no interpolation."""
    values: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        values[key.strip()] = value.strip().strip("\"'")
    return values


async def _connect(target: str) -> tuple[object, str]:
    """Return (client, host) for the NAMED target.

    The first version of this script took `--target` and then called
    `get_admin_supabase()` regardless — the flag accepted "production" and
    silently followed backend settings, which on a developer machine is local
    Supabase. A switch that does nothing is worse than no switch: it invites
    the operator to believe a choice was made. Same shape as
    `repair_simulation_prompt_templates._connect`, deliberately.
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


async def _agents_without_personality(supabase, simulation_id: str | None) -> list[dict]:
    query = supabase.table("agents").select("id, name, simulation_id, personality_profile").is_("deleted_at", "null")
    if simulation_id:
        query = query.eq("simulation_id", simulation_id)
    rows = extract_list(await query.execute())
    return [row for row in rows if not (row.get("personality_profile") or {}).get("openness")]


async def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument(
        "--target",
        choices=("env", "production"),
        help="which database to talk to. 'env' follows backend settings, which on a "
        "developer machine is local Supabase. Must be named explicitly for --apply.",
    )
    parser.add_argument("--apply", action="store_true", help="spend the calls (default: dry run)")
    parser.add_argument("--simulation", help="restrict to one simulation id")
    parser.add_argument("--limit", type=int, help="process at most N agents — for a first, cheap trial")
    args = parser.parse_args()

    if args.apply and args.target is None:
        # Not safety theatre: this spends real money per agent, and `env` on a
        # developer machine is local Supabase. The database must be named.
        print("Refusing to write without --target. Name the database: env or production.")
        return 2

    target = args.target or "env"
    supabase, host = await _connect(target)
    pending = await _agents_without_personality(supabase, args.simulation)

    if args.limit:
        pending = pending[: args.limit]

    worlds = {row["simulation_id"] for row in pending}
    print(f"Ziel: {target}  ({host})")
    print(f"Agenten ohne Persönlichkeit: {len(pending)} in {len(worlds)} Welt(en)")
    # Gemessen am 31.08.2026, nicht geschätzt: `agent_description` hat keinen
    # eigenen Modelleintrag und fällt auf `model_default` =
    # deepseek/deepseek-v4-flash-0731. Für genau dieses Modell weist
    # `ai_usage_log` auf Prod 0,000121 USD je Aufruf aus (19 Aufrufe, im Mittel
    # 693 Prompt- und 1035 Antwort-Token). Dieser Aufruf ist auf BEIDEN Seiten
    # kleiner — Prompt ~580 Token, Antwort auf 512 gedeckelt — der Wert ist
    # also eine Obergrenze.
    cost_per_call_usd = 0.000121
    print(f"Kosten: ein Modellaufruf je Agent — also {len(pending)} Aufrufe")
    print(
        f"        ~{cost_per_call_usd:.6f} USD je Aufruf (gemessen, Obergrenze) "
        f"= ~{len(pending) * cost_per_call_usd:.3f} USD gesamt"
    )
    print("Modell: deepseek/deepseek-v4-flash-0731 (model_default)")
    print("Zweck (Budget): personality_extraction")

    if not pending:
        print("Nichts zu tun.")
        return 0

    if not args.apply:
        print("\nTROCKENLAUF — nichts geschrieben. Mit --apply ausführen.")
        for row in pending[:10]:
            print(f"  {row['id']}  {row.get('name', '?')}")
        if len(pending) > 10:
            print(f"  … und {len(pending) - 10} weitere")
        return 0

    done = failed = 0
    for row in pending:
        try:
            await PersonalityExtractionService.initialize_agent_autonomy(supabase, row["id"], row["simulation_id"])
            done += 1
            print(f"  ✓ {row.get('name', row['id'])}")
        except Exception as exc:  # noqa: BLE001 — a single agent must not stop the run
            failed += 1
            print(f"  ✗ {row.get('name', row['id'])}: {exc}")

    print(f"\nFertig: {done} erledigt, {failed} fehlgeschlagen.")
    print(
        "Nachmessen:  select count(distinct resilience), count(distinct sociability) from agent_mood;   — vorher 1, 1"
    )
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))

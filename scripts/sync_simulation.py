"""Bidirectional simulation sync: copy DB rows + storage images between environments.

Syncs complete simulation data (all tables + image files) between local and
production Supabase in either direction.  Designed to replace ad-hoc pg_dump +
manual import workflows.

Usage examples::

    # Pull from prod to local
    python scripts/sync_simulation.py prod local --sim velgarien

    # Push local to prod
    python scripts/sync_simulation.py local prod --sim velgarien

    # Multiple simulations
    python scripts/sync_simulation.py prod local --sim velgarien --sim station-null

    # Data only / images only
    python scripts/sync_simulation.py prod local --sim velgarien --data-only
    python scripts/sync_simulation.py prod local --sim velgarien --images-only

    # Specific table groups
    python scripts/sync_simulation.py prod local --sim velgarien --tables core,entities

    # Dry run (reads happen, writes are logged but not executed)
    python scripts/sync_simulation.py prod local --sim velgarien --dry-run

Requirements:
    - backend/.venv activated (for psycopg2)
    - For prod reads/writes: SUPABASE_ACCESS_TOKEN in env (sbp_... token)
    - For prod storage writes: service role key in /tmp/prod_key.txt or Railway
    - For local: Supabase running (supabase start)

Architecture — Write-Layer Split
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Reads always use raw SQL (local via psycopg2, prod via Management API).

**Writes diverge by target environment:**

- **Local target → psycopg2 ``execute_values()``**
  Parameterized batch inserts.  No SQL string building, no escaping.
  All tables are written inside a single transaction (commit/rollback).
  The ``_adapt_row_for_psycopg()`` helper wraps dicts/lists with
  ``psycopg2.extras.Json`` so Postgres receives proper jsonb.

- **Prod target → raw SQL via Management API**
  The Management API accepts only raw SQL strings, so we must serialise
  every value ourselves.  ``sql_val()`` handles None/bool/int/float/str/
  dict/list/uuid/datetime → SQL literal conversion.  ``build_upsert_sql()``
  assembles a full INSERT … ON CONFLICT DO UPDATE statement.
  Each statement is sent individually (no transaction wrapper — the API
  is stateless).  Idempotency via ON CONFLICT makes repeated runs safe.

This split is the core architectural decision: it lets us use the safest,
fastest write method available for each environment while sharing all read
logic and orchestration code.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import time
import uuid as uuid_mod
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")


# ── Constants ────────────────────────────────────────────────────────────────

LOCAL_DB_HOST = "127.0.0.1"
LOCAL_DB_PORT = 54322
LOCAL_DB_NAME = "postgres"
LOCAL_DB_USER = "postgres"
LOCAL_DB_PASS = "postgres"

LOCAL_SUPABASE_URL = "http://127.0.0.1:54321"
LOCAL_SERVICE_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
    ".eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0"
    ".EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
)

PROD_PROJECT_REF = "bffjoupddfjaljqrwqck"
PROD_SUPABASE_URL = f"https://{PROD_PROJECT_REF}.supabase.co"
PROD_MANAGEMENT_API = (
    f"https://api.supabase.com/v1/projects/{PROD_PROJECT_REF}/database/query"
)

PLATFORM_ADMIN_EMAIL = os.environ.get("PLATFORM_ADMIN_EMAIL", "matthias@leihs.at")

STORAGE_BUCKETS = {
    "portraits": "agent.portraits",
    "buildings": "building.images",
    "assets": "simulation.assets",
}

# ── Table Specs ──────────────────────────────────────────────────────────────
#
# Each spec drives the generic sync loop.  Fields:
#   name          — Postgres table name
#   group         — CLI filter group (core / geography / entities / relations / narrative)
#   columns       — columns to SELECT and INSERT (order matters for execute_values)
#   filter_col    — column used in the WHERE clause ("slug" for simulations, else "simulation_id")
#   conflict_col  — ON CONFLICT target (default "id")
#   null_fks      — columns NULLed on write (user FKs that may not exist on target)
#   order_by      — optional ORDER BY clause
#
# IMPORTANT: never include GENERATED ALWAYS columns (search_vector) here.

TABLE_SPECS: list[dict[str, Any]] = [
    # ── core ──────────────────────────────────────────────────────────────
    {
        "name": "simulations",
        "group": "core",
        "columns": [
            "id", "name", "slug", "description", "description_de",
            "theme", "status", "content_locale", "additional_locales",
            "owner_id", "icon_url", "banner_url",
            "simulation_type", "source_template_id", "epoch_id",
            "created_at", "updated_at", "archived_at", "deleted_at",
        ],
        "filter_col": "slug",
        "conflict_col": "id",
        "null_fks": set(),  # owner_id gets admin-fallback, not NULL
        # additional_locales is text[] (Postgres array), NOT jsonb
    },
    {
        "name": "simulation_settings",
        "group": "core",
        "columns": [
            "id", "simulation_id", "category", "setting_key", "setting_value",
            "updated_by_id", "created_at", "updated_at",
        ],
        "filter_col": "simulation_id",
        "conflict_col": "id",
        "null_fks": {"updated_by_id"},
        "jsonb_cols": {"setting_value"},
    },
    {
        "name": "simulation_taxonomies",
        "group": "core",
        "columns": [
            "id", "simulation_id", "taxonomy_type", "value", "label",
            "description", "sort_order", "is_default", "is_active",
            "metadata", "game_weight", "created_at",
        ],
        "filter_col": "simulation_id",
        "conflict_col": "id",
        "null_fks": set(),
        "jsonb_cols": {"label", "description", "metadata"},
    },
    # ── geography ─────────────────────────────────────────────────────────
    {
        "name": "cities",
        "group": "geography",
        "columns": [
            "id", "simulation_id", "name", "layout_type", "description",
            "population", "map_center_lat", "map_center_lng",
            "map_default_zoom", "created_at", "updated_at",
        ],
        "filter_col": "simulation_id",
        "conflict_col": "id",
        "null_fks": set(),
    },
    {
        "name": "zones",
        "group": "geography",
        "columns": [
            "id", "simulation_id", "city_id", "name", "description",
            "description_de", "zone_type", "zone_type_de",
            "population_estimate", "security_level", "data_source",
            "created_at", "updated_at",
        ],
        "filter_col": "simulation_id",
        "conflict_col": "id",
        "null_fks": set(),
    },
    {
        "name": "city_streets",
        "group": "geography",
        "columns": [
            "id", "simulation_id", "city_id", "zone_id", "name",
            "street_type", "street_type_de", "length_km", "geojson",
            "created_at", "updated_at",
        ],
        "filter_col": "simulation_id",
        "conflict_col": "id",
        "null_fks": set(),
        "jsonb_cols": {"geojson"},
    },
    # ── entities ──────────────────────────────────────────────────────────
    {
        "name": "agents",
        "group": "entities",
        "columns": [
            "id", "simulation_id", "name", "system", "character",
            "character_de", "background", "background_de", "gender",
            "primary_profession", "primary_profession_de",
            "portrait_image_url", "portrait_description",
            "style_reference_url",
            "data_source", "created_by_id", "ambassador_blocked_until",
            "created_at", "updated_at", "deleted_at",
        ],
        "filter_col": "simulation_id",
        "conflict_col": "id",
        "null_fks": {"created_by_id"},
    },
    {
        "name": "buildings",
        "group": "entities",
        "columns": [
            "id", "simulation_id", "name", "building_type", "building_type_de",
            "description", "description_de", "style", "style_reference_url",
            "location", "city_id", "zone_id", "street_id", "address",
            "population_capacity", "construction_year",
            "building_condition", "building_condition_de",
            "geojson", "image_url", "image_prompt_text",
            "special_type", "special_attributes", "data_source",
            "created_at", "updated_at", "deleted_at",
        ],
        "filter_col": "simulation_id",
        "conflict_col": "id",
        "null_fks": set(),
        "jsonb_cols": {"location", "geojson", "special_attributes"},
    },
    {
        "name": "events",
        "group": "entities",
        "columns": [
            "id", "simulation_id", "title", "title_de", "event_type",
            "description", "description_de", "occurred_at", "data_source",
            "metadata", "source_platform", "propaganda_type",
            "target_demographic", "urgency_level", "original_trend_data",
            "impact_level", "location", "tags", "external_refs",
            "created_at", "updated_at", "deleted_at",
        ],
        "filter_col": "simulation_id",
        "conflict_col": "id",
        "null_fks": set(),
        "jsonb_cols": {"metadata", "original_trend_data", "external_refs"},
        # tags is text[] (Postgres array), NOT jsonb
        # campaign_id intentionally excluded — campaigns are not synced and
        # the FK would fail on the target.
    },
    # ── relations ─────────────────────────────────────────────────────────
    {
        "name": "agent_professions",
        "group": "relations",
        "columns": [
            "id", "simulation_id", "agent_id", "profession",
            "qualification_level", "specialization", "certified_at",
            "certified_by", "is_primary", "created_at", "updated_at",
        ],
        "filter_col": "simulation_id",
        "conflict_col": "id",
        "null_fks": set(),
    },
    {
        "name": "building_agent_relations",
        "group": "relations",
        "columns": [
            "id", "simulation_id", "building_id", "agent_id",
            "relation_type", "created_at",
        ],
        "filter_col": "simulation_id",
        "conflict_col": "id",
        "null_fks": set(),
    },
    {
        "name": "building_event_relations",
        "group": "relations",
        "columns": [
            "id", "simulation_id", "building_id", "event_id",
            "relation_type", "created_at",
        ],
        "filter_col": "simulation_id",
        "conflict_col": "id",
        "null_fks": set(),
    },
    {
        "name": "building_profession_requirements",
        "group": "relations",
        "columns": [
            "id", "simulation_id", "building_id", "profession",
            "min_qualification_level", "is_mandatory", "description",
            "created_at",
        ],
        "filter_col": "simulation_id",
        "conflict_col": "id",
        "null_fks": set(),
    },
    {
        "name": "event_reactions",
        "group": "relations",
        "columns": [
            "id", "simulation_id", "event_id", "agent_id", "agent_name",
            "reaction_text", "occurred_at", "emotion", "confidence_score",
            "data_source", "created_at", "updated_at",
        ],
        "filter_col": "simulation_id",
        "conflict_col": "id",
        "null_fks": set(),
    },
    {
        "name": "agent_relationships",
        "group": "relations",
        "columns": [
            "id", "simulation_id", "source_agent_id", "target_agent_id",
            "relationship_type", "is_bidirectional", "intensity",
            "description", "metadata", "created_at", "updated_at",
        ],
        "filter_col": "simulation_id",
        "conflict_col": "id",
        "null_fks": set(),
        "jsonb_cols": {"metadata"},
    },
    # ── narrative ─────────────────────────────────────────────────────────
    {
        "name": "simulation_lore",
        "group": "narrative",
        "columns": [
            "id", "simulation_id", "sort_order", "chapter", "arcanum",
            "title", "title_de", "epigraph", "epigraph_de",
            "body", "body_de",
            "image_slug", "image_caption", "image_caption_de",
            "image_generated_at",
            "evolved_at", "evolution_count", "evolution_log",
            "created_at", "updated_at",
        ],
        "filter_col": "simulation_id",
        "conflict_col": "id",
        "null_fks": set(),
        "jsonb_cols": {"evolution_log"},
        "order_by": "sort_order",
    },
]

TABLE_GROUPS = {
    "core": "simulations, simulation_settings, simulation_taxonomies",
    "geography": "cities, zones, city_streets",
    "entities": "agents, buildings, events",
    "relations": (
        "agent_professions, building_agent_relations, "
        "building_event_relations, building_profession_requirements, "
        "event_reactions, agent_relationships"
    ),
    "narrative": "simulation_lore",
}


# ── Credential Helpers ───────────────────────────────────────────────────────


def _get_sbp_token() -> str:
    """Supabase personal access token (sbp_…) for Management API."""
    token = os.environ.get("SUPABASE_ACCESS_TOKEN", "")
    if not token:
        print("ERROR: SUPABASE_ACCESS_TOKEN not set (need sbp_… token for prod DB)")
        sys.exit(1)
    return token


def _get_prod_service_key() -> str:
    """Production service role key for storage uploads.

    Checked in order:
    1. /tmp/prod_key.txt (cached from a previous run)
    2. Railway environment variables (fetched live, then cached)
    """
    key_file = Path("/tmp/prod_key.txt")
    if key_file.exists():
        key = key_file.read_text().strip()
        if key:
            return key

    print("  Production service role key not in /tmp/prod_key.txt — fetching from Railway…")
    try:
        result = subprocess.run(
            ["railway", "variables", "--json"],
            capture_output=True, text=True, check=True, timeout=15,
        )
        variables = json.loads(result.stdout)
        key = variables.get("SUPABASE_SERVICE_ROLE_KEY", "")
        if not key:
            print("ERROR: SUPABASE_SERVICE_ROLE_KEY not found in Railway variables")
            sys.exit(1)
        key_file.write_text(key)
        print(f"  Saved to {key_file}")
        return key
    except Exception as e:
        print(f"ERROR: Failed to fetch from Railway: {e}")
        sys.exit(1)


# ── DB Read Layer ────────────────────────────────────────────────────────────
#
# Both environments use raw SQL for reads.
# - Local:  psycopg2 RealDictCursor  (direct TCP to Postgres on port 54322)
# - Prod:   Supabase Management API  (HTTP POST with raw SQL string)


def _get_local_connection():
    """Return a new psycopg2 connection to the local Supabase Postgres."""
    try:
        import psycopg2
    except ImportError:
        print("ERROR: psycopg2 not installed.  pip install psycopg2-binary")
        sys.exit(1)

    try:
        return psycopg2.connect(
            host=LOCAL_DB_HOST, port=LOCAL_DB_PORT,
            dbname=LOCAL_DB_NAME, user=LOCAL_DB_USER, password=LOCAL_DB_PASS,
        )
    except psycopg2.OperationalError as e:
        print(f"ERROR: Cannot connect to local Postgres — is Supabase running?\n  {e}")
        sys.exit(1)


def query_local(sql: str) -> list[dict]:
    """Execute a read-only query against local Postgres via psycopg2."""
    import psycopg2.extras

    conn = _get_local_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql)
            return [dict(row) for row in cur.fetchall()]
    finally:
        conn.close()


def query_prod(sql: str) -> list[dict]:
    """Execute a read-only query against production via the Management API."""
    token = _get_sbp_token()
    resp = requests.post(
        PROD_MANAGEMENT_API,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        json={"query": sql},
        timeout=30,
    )
    if resp.status_code not in (200, 201):
        print(f"ERROR: Management API {resp.status_code}: {resp.text[:500]}")
        sys.exit(1)
    return resp.json()


def query_db(env: str, sql: str) -> list[dict]:
    """Route a read query to the correct environment."""
    return query_local(sql) if env == "local" else query_prod(sql)


# ── DB Write Layer — LOCAL (parameterized) ───────────────────────────────────
#
# Local writes use psycopg2 ``execute_values()`` for safety and speed.
# A single connection is created at sync start and passed through; all writes
# happen inside one transaction that is committed at the end (or rolled back
# on error).
#
# JSON/dict values are wrapped with ``psycopg2.extras.Json`` so Postgres
# receives proper jsonb instead of a string representation.


def _adapt_row_for_psycopg(row: dict, jsonb_cols: set[str]) -> dict:
    """Prepare a row dict for psycopg2 execute_values.

    - Wraps **dicts** with ``psycopg2.extras.Json`` (always jsonb).
    - Wraps **lists** with ``Json`` only when the column is in ``jsonb_cols``.
      Other lists are left as-is so psycopg2 sends them as Postgres arrays
      (e.g. ``text[]`` for ``additional_locales``, ``tags``).
    - Converts uuid.UUID to str (psycopg2 handles str→uuid cast).
    - Leaves everything else for psycopg2's native type adaptation.
    """
    from psycopg2.extras import Json

    adapted = {}
    for k, v in row.items():
        if k in jsonb_cols and v is not None:
            # All jsonb values get wrapped — dicts, lists, strings, numbers.
            # psycopg2 reads jsonb strings as Python str, so we must re-wrap.
            adapted[k] = Json(v)
        elif isinstance(v, dict):
            # Dicts are always jsonb even if not declared (safety net)
            adapted[k] = Json(v)
        elif isinstance(v, uuid_mod.UUID):
            adapted[k] = str(v)
        else:
            adapted[k] = v
    return adapted


def write_local(
    conn,
    table: str,
    rows: list[dict],
    conflict_col: str = "id",
    exclude_from_update: set[str] | None = None,
    jsonb_cols: set[str] | None = None,
) -> int:
    """Batch-upsert rows into local Postgres using execute_values.

    This is the **local** half of the write-layer split.  No SQL string
    escaping — psycopg2 handles all parameterisation.

    Args:
        conn: Open psycopg2 connection (caller manages transaction).
        table: Target table name.
        rows: List of dicts (all must have the same keys).
        conflict_col: Column for ON CONFLICT.
        exclude_from_update: Columns to skip in the DO UPDATE SET clause.
        jsonb_cols: Column names that are jsonb (so lists are wrapped with Json
            instead of being sent as Postgres arrays).

    Returns:
        Number of rows upserted.
    """
    from psycopg2.extras import execute_values

    if not rows:
        return 0

    cols = list(rows[0].keys())
    excl = exclude_from_update or set()
    update_cols = [c for c in cols if c != conflict_col and c not in excl]

    col_list = ", ".join(cols)
    update_clause = ", ".join(f"{c} = EXCLUDED.{c}" for c in update_cols)

    sql = (
        f"INSERT INTO {table} ({col_list}) VALUES %s "
        f"ON CONFLICT ({conflict_col}) DO UPDATE SET {update_clause}"
    )

    jcols = jsonb_cols or set()
    adapted = [_adapt_row_for_psycopg(r, jcols) for r in rows]
    values = [tuple(r[c] for c in cols) for r in adapted]

    with conn.cursor() as cur:
        execute_values(cur, sql, values, page_size=200)

    return len(rows)


def exec_sql_local(conn, sql: str) -> int:
    """Execute a raw SQL statement on local Postgres (for URL rewriting etc.).

    Returns rowcount.
    """
    with conn.cursor() as cur:
        cur.execute(sql)
        return cur.rowcount


# ── DB Write Layer — PROD (raw SQL via Management API) ───────────────────────
#
# The Supabase Management API accepts only raw SQL strings — no parameterised
# queries.  We must serialise every Python value into a SQL literal ourselves.
#
# ``sql_val()``         — single value → SQL literal
# ``build_upsert_sql()``— list of row dicts → full INSERT … ON CONFLICT statement
#
# Each statement is sent individually (the API is stateless, no transaction
# wrapper).  Idempotency via ON CONFLICT makes repeated runs safe.


def sql_val(v: Any) -> str:
    """Convert a Python value to a SQL literal string.

    This is **only used for the prod write path** (Management API).
    Local writes use parameterised queries and never call this function.

    Handles: None, bool, int, float, Decimal, str, dict, list,
    uuid.UUID, datetime, date, text arrays.
    """
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, int | float):
        return str(v)
    if isinstance(v, Decimal):
        return str(v)
    if isinstance(v, uuid_mod.UUID):
        return f"'{v}'"
    if isinstance(v, datetime):
        return f"'{v.isoformat()}'"
    if isinstance(v, date):
        return f"'{v.isoformat()}'"
    if isinstance(v, dict | list):
        dumped = json.dumps(v, default=str).replace("'", "''")
        return f"'{dumped}'::jsonb"
    if isinstance(v, str):
        escaped = v.replace("'", "''")
        return f"'{escaped}'"
    # Fallback: stringify
    return f"'{str(v)}'"


def build_upsert_sql(
    table: str,
    rows: list[dict],
    conflict_col: str = "id",
    exclude_from_update: set[str] | None = None,
) -> str:
    """Build an INSERT … ON CONFLICT DO UPDATE statement from row dicts.

    This is **only used for the prod write path** (Management API).
    Local writes use ``write_local()`` with parameterised queries.

    Returns a single SQL string that upserts all rows.
    """
    if not rows:
        return ""

    cols = list(rows[0].keys())
    excl = exclude_from_update or set()
    update_cols = [c for c in cols if c != conflict_col and c not in excl]

    col_list = ", ".join(cols)
    value_rows = []
    for row in rows:
        vals = ", ".join(sql_val(row[c]) for c in cols)
        value_rows.append(f"({vals})")

    values_str = ",\n".join(value_rows)
    update_clause = ", ".join(f"{c} = EXCLUDED.{c}" for c in update_cols)

    return (
        f"INSERT INTO {table} ({col_list})\nVALUES\n{values_str}\n"
        f"ON CONFLICT ({conflict_col}) DO UPDATE SET\n{update_clause};"
    )


def write_prod(sql: str) -> None:
    """Execute a write SQL statement on production via the Management API."""
    if not sql or not sql.strip():
        return
    token = _get_sbp_token()
    resp = requests.post(
        PROD_MANAGEMENT_API,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        json={"query": sql},
        timeout=30,
    )
    if resp.status_code not in (200, 201):
        print(f"  ERROR: Management API {resp.status_code}: {resp.text[:500]}")
        raise RuntimeError(f"Prod write failed: {resp.status_code}")


def exec_sql_prod(sql: str) -> None:
    """Execute raw SQL on prod (for URL rewriting etc.).  Alias for write_prod."""
    write_prod(sql)


# ── Storage Layer ────────────────────────────────────────────────────────────


def _storage_url(env: str) -> str:
    return LOCAL_SUPABASE_URL if env == "local" else PROD_SUPABASE_URL


def _storage_key(env: str) -> str:
    return LOCAL_SERVICE_KEY if env == "local" else _get_prod_service_key()


def download_file(env: str, bucket: str, path: str) -> bytes | None:
    """Download a file from Supabase Storage (public URL, no auth).

    Returns bytes on success, None on 404 / error.
    """
    url = f"{_storage_url(env)}/storage/v1/object/public/{bucket}/{path}"
    try:
        resp = requests.get(url, timeout=30)
        if resp.status_code == 200:
            return resp.content
        return None
    except requests.RequestException:
        return None


def upload_file(env: str, bucket: str, path: str, data: bytes) -> bool:
    """Upload a file to Supabase Storage with x-upsert.

    Returns True on success, False on failure.
    """
    base = _storage_url(env)
    key = _storage_key(env)
    url = f"{base}/storage/v1/object/{bucket}/{path}"
    content_type = "image/webp" if path.endswith(".webp") else "image/avif"
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": content_type,
        "x-upsert": "true",
    }
    resp = requests.put(url, headers=headers, data=data, timeout=30)
    if resp.status_code in (200, 201):
        return True
    # Retry: delete + post
    requests.delete(url, headers=headers, timeout=10)
    resp = requests.post(url, headers=headers, data=data, timeout=30)
    return resp.status_code in (200, 201)


# ── Sync Orchestration ───────────────────────────────────────────────────────


def _validate_slugs(slugs: list[str]) -> None:
    """Reject slugs that don't match the expected pattern (injection guard)."""
    pattern = re.compile(r"^[a-z0-9][a-z0-9._-]*$")
    for slug in slugs:
        if not pattern.match(slug):
            print(f"ERROR: Invalid simulation slug: {slug!r}")
            sys.exit(1)


def _resolve_simulations(
    env: str, slugs: list[str],
) -> list[dict]:
    """Look up simulations by slug on the source environment.

    Returns list of simulation row dicts.  Exits if any slug is not found.
    """
    slug_list = ", ".join(f"'{s}'" for s in slugs)
    rows = query_db(env, f"SELECT * FROM simulations WHERE slug IN ({slug_list})")
    found_slugs = {r["slug"] for r in rows}
    missing = set(slugs) - found_slugs
    if missing:
        print(f"ERROR: Simulation(s) not found on {env}: {', '.join(sorted(missing))}")
        sys.exit(1)
    return rows


def _resolve_admin_uuid(env: str) -> str | None:
    """Find the platform admin user UUID on the target environment.

    Used as a fallback for owner_id when the original owner doesn't exist.
    """
    rows = query_db(
        env,
        f"SELECT id FROM auth.users WHERE email = '{PLATFORM_ADMIN_EMAIL}' LIMIT 1",
    )
    if rows:
        return str(rows[0]["id"])
    return None


def _prepare_rows(
    rows: list[dict],
    spec: dict,
    admin_uuid: str | None,
) -> list[dict]:
    """Prepare rows for writing: NULL user FKs, handle owner_id fallback.

    Modifies rows in-place and returns them.
    """
    null_fks = spec.get("null_fks", set())
    table_name = spec["name"]

    for row in rows:
        # NULL out user FK columns that may not exist on target
        for col in null_fks:
            if col in row:
                row[col] = None

        # Special handling: simulations.owner_id → admin fallback
        if table_name == "simulations" and admin_uuid:
            row["owner_id"] = admin_uuid

    return rows


def sync_data(
    source: str,
    target: str,
    slugs: list[str],
    sim_ids: list[str],
    active_groups: set[str],
    dry_run: bool,
) -> int:
    """Sync all table data from source to target.

    This is the main data-sync loop.  For each table spec whose group is in
    ``active_groups``, it SELECTs rows from the source and writes them to the
    target using the appropriate write method (see module docstring for the
    write-layer split).

    Returns total number of rows synced.
    """
    # Resolve admin UUID on target for owner_id fallback
    admin_uuid = _resolve_admin_uuid(target) if not dry_run else None
    if not dry_run and not admin_uuid:
        print(f"  WARNING: Platform admin ({PLATFORM_ADMIN_EMAIL}) not found on {target}")
        print("           owner_id values will be kept as-is (may cause FK errors)")

    # For local target: single connection + transaction
    local_conn = None
    if target == "local" and not dry_run:
        local_conn = _get_local_connection()
        local_conn.autocommit = False

    total_rows = 0
    active_specs = [s for s in TABLE_SPECS if s["group"] in active_groups]

    try:
        for i, spec in enumerate(active_specs, 1):
            table = spec["name"]
            cols = spec["columns"]
            filter_col = spec.get("filter_col", "simulation_id")
            order_by = spec.get("order_by")

            # Build SELECT
            col_list = ", ".join(cols)
            if filter_col == "slug":
                where_vals = ", ".join(f"'{s}'" for s in slugs)
            else:
                where_vals = ", ".join(f"'{sid}'" for sid in sim_ids)
            where = f"{filter_col} IN ({where_vals})"
            order = f" ORDER BY {order_by}" if order_by else ""
            select_sql = f"SELECT {col_list} FROM {table} WHERE {where}{order}"

            rows = query_db(source, select_sql)
            count = len(rows)
            label = f"[{i}/{len(active_specs)}] {table}"
            print(f"  {label:.<50s} {count} row{'s' if count != 1 else ''}")

            if not rows or dry_run:
                total_rows += count
                continue

            rows = _prepare_rows(rows, spec, admin_uuid)

            # ── Write: split by target environment ────────────────────────
            if target == "local":
                write_local(
                    local_conn, table, rows,
                    conflict_col=spec.get("conflict_col", "id"),
                    jsonb_cols=spec.get("jsonb_cols"),
                )
            else:
                sql = build_upsert_sql(
                    table, rows,
                    conflict_col=spec.get("conflict_col", "id"),
                )
                write_prod(sql)

            total_rows += count

        # Commit local transaction
        if local_conn:
            local_conn.commit()

    except Exception:
        if local_conn:
            local_conn.rollback()
            print("  Transaction rolled back.")
        raise
    finally:
        if local_conn:
            local_conn.close()

    return total_rows


# ── URL Rewriting ────────────────────────────────────────────────────────────
#
# Image URLs stored in the DB contain the full Supabase base URL.  After
# upserting rows, we rewrite source URLs → target URLs so images resolve
# correctly in the target environment.
#
# Lore images use ``image_slug`` (relative path) and don't need rewriting.


def rewrite_urls(
    source: str,
    target: str,
    sim_ids: list[str],
    dry_run: bool,
) -> int:
    """Rewrite image URLs in the target DB from source base to target base.

    Returns the total number of rows updated.
    """
    src_base = _storage_url(source) + "/storage/v1/object/public"
    tgt_base = _storage_url(target) + "/storage/v1/object/public"

    if src_base == tgt_base:
        return 0

    id_list = ", ".join(f"'{sid}'" for sid in sim_ids)

    statements = [
        # agents.portrait_image_url
        f"UPDATE agents SET portrait_image_url = REPLACE(portrait_image_url, '{src_base}', '{tgt_base}') "
        f"WHERE simulation_id IN ({id_list}) AND portrait_image_url LIKE '{src_base}%'",
        # buildings.image_url
        f"UPDATE buildings SET image_url = REPLACE(image_url, '{src_base}', '{tgt_base}') "
        f"WHERE simulation_id IN ({id_list}) AND image_url LIKE '{src_base}%'",
        # simulations.banner_url + icon_url
        f"UPDATE simulations SET "
        f"banner_url = REPLACE(COALESCE(banner_url, ''), '{src_base}', '{tgt_base}'), "
        f"icon_url = REPLACE(COALESCE(icon_url, ''), '{src_base}', '{tgt_base}') "
        f"WHERE id IN ({id_list}) AND (banner_url LIKE '{src_base}%' OR icon_url LIKE '{src_base}%')",
        # agents.style_reference_url
        f"UPDATE agents SET style_reference_url = REPLACE(style_reference_url, '{src_base}', '{tgt_base}') "
        f"WHERE simulation_id IN ({id_list}) AND style_reference_url LIKE '{src_base}%'",
        # buildings.style_reference_url
        f"UPDATE buildings SET style_reference_url = REPLACE(style_reference_url, '{src_base}', '{tgt_base}') "
        f"WHERE simulation_id IN ({id_list}) AND style_reference_url LIKE '{src_base}%'",
    ]

    if dry_run:
        print(f"  URL rewriting ({'→'.join([source, target])}) ... [DRY RUN]")
        return 0

    # Open dedicated connection for local target (URL rewriting is its own step)
    local_conn = None
    if target == "local":
        local_conn = _get_local_connection()
        local_conn.autocommit = False

    total = 0
    try:
        for sql in statements:
            if target == "local":
                total += exec_sql_local(local_conn, sql)
            else:
                exec_sql_prod(sql)
                # Management API doesn't return rowcount; estimate 1 per statement
                total += 1

        if local_conn:
            local_conn.commit()
    except Exception:
        if local_conn:
            local_conn.rollback()
        raise
    finally:
        if local_conn:
            local_conn.close()

    print(f"  URL rewriting ({'→'.join([source, target])}) ... {total} rows updated")
    return total


# ── Storage Sync ─────────────────────────────────────────────────────────────
#
# Strategy: derive storage paths from DB data (not bucket listings).
#
# For each image-bearing entity, we parse the URL or slug from the source DB
# to determine the storage path, then download from source and upload to
# target.  Each file has a thumbnail (.avif) and optionally a full-res
# (.full.avif) variant.


def _extract_storage_path(url: str, bucket: str) -> str | None:
    """Extract the path component after /object/public/{bucket}/ from a URL."""
    marker = f"/object/public/{bucket}/"
    idx = url.find(marker)
    if idx == -1:
        return None
    return url[idx + len(marker):]


def _sync_file_pair(
    source: str, target: str, bucket: str, base_path: str,
    dry_run: bool, stats: dict,
) -> None:
    """Download thumb + full-res from source, upload to target.

    ``base_path`` is the thumbnail path (e.g. "velgarien/lore/slug.avif").
    The full-res variant is derived by inserting ".full" before the extension.
    Handles both .avif and legacy .webp paths.
    """
    stem, ext = os.path.splitext(base_path)
    full_path = f"{stem}.full{ext}"

    for path in [base_path, full_path]:
        stats["attempted"] += 1
        if dry_run:
            print(f"    [DRY RUN] {bucket}/{path}")
            continue

        data = download_file(source, bucket, path)
        if data is None:
            stats["skipped"] += 1
            continue

        ok = upload_file(target, bucket, path, data)
        if ok:
            stats["synced"] += 1
            kb = len(data) / 1024
            print(f"    {bucket}/{path} ... OK ({kb:.0f} KB)")
        else:
            stats["failed"] += 1
            print(f"    {bucket}/{path} ... FAILED")


def sync_storage(
    source: str,
    target: str,
    sim_ids: list[str],
    sim_slugs: list[str],
    dry_run: bool,
) -> dict:
    """Sync all image files from source storage to target storage.

    Derives file paths from the source DB data rather than listing buckets.

    Returns a stats dict with keys: attempted, synced, skipped, failed.
    """
    stats = {"attempted": 0, "synced": 0, "skipped": 0, "failed": 0}
    id_list = ", ".join(f"'{sid}'" for sid in sim_ids)

    # ── Agent portraits ───────────────────────────────────────────────────
    agents = query_db(
        source,
        f"SELECT portrait_image_url FROM agents "
        f"WHERE simulation_id IN ({id_list}) AND portrait_image_url IS NOT NULL",
    )
    if agents:
        print(f"\n  agent.portraits ({len(agents)} agents):")
        bucket = STORAGE_BUCKETS["portraits"]
        for row in agents:
            path = _extract_storage_path(row["portrait_image_url"], bucket)
            if path:
                _sync_file_pair(source, target, bucket, path, dry_run, stats)

    # ── Building images ───────────────────────────────────────────────────
    buildings = query_db(
        source,
        f"SELECT image_url FROM buildings "
        f"WHERE simulation_id IN ({id_list}) AND image_url IS NOT NULL",
    )
    if buildings:
        print(f"\n  building.images ({len(buildings)} buildings):")
        bucket = STORAGE_BUCKETS["buildings"]
        for row in buildings:
            path = _extract_storage_path(row["image_url"], bucket)
            if path:
                _sync_file_pair(source, target, bucket, path, dry_run, stats)

    # ── Simulation banners / icons ────────────────────────────────────────
    sims = query_db(
        source,
        f"SELECT banner_url, icon_url FROM simulations WHERE id IN ({id_list})",
    )
    if sims:
        print("\n  simulation.assets (banners/icons):")
        bucket = STORAGE_BUCKETS["assets"]
        for row in sims:
            for col in ("banner_url", "icon_url"):
                url = row.get(col)
                if url:
                    path = _extract_storage_path(url, bucket)
                    if path:
                        _sync_file_pair(source, target, bucket, path, dry_run, stats)

    # ── Lore images (derived from image_slug, not URL) ────────────────────
    lore = query_db(
        source,
        f"SELECT l.image_slug, s.slug AS sim_slug "
        f"FROM simulation_lore l "
        f"JOIN simulations s ON s.id = l.simulation_id "
        f"WHERE l.simulation_id IN ({id_list}) AND l.image_slug IS NOT NULL",
    )
    if lore:
        print(f"\n  simulation.assets/lore ({len(lore)} lore images):")
        bucket = STORAGE_BUCKETS["assets"]
        for row in lore:
            base_path = f"{row['sim_slug']}/lore/{row['image_slug']}.avif"
            _sync_file_pair(source, target, bucket, base_path, dry_run, stats)

    return stats


# ── Main ─────────────────────────────────────────────────────────────────────


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Sync simulation data + images between Supabase environments.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Table groups (--tables filter):\n"
            + "\n".join(f"  {k:12s} {v}" for k, v in TABLE_GROUPS.items())
            + "\n\nAll groups sync by default."
        ),
    )
    parser.add_argument(
        "source", choices=["local", "prod"],
        help="Source environment to read from",
    )
    parser.add_argument(
        "target", choices=["local", "prod"],
        help="Target environment to write to",
    )
    parser.add_argument(
        "--sim", action="append", required=True, dest="sims",
        help="Simulation slug(s) to sync (repeatable)",
    )
    parser.add_argument(
        "--tables",
        help="Comma-separated table groups to sync (default: all)",
    )
    parser.add_argument(
        "--data-only", action="store_true",
        help="Skip image file sync (DB rows only)",
    )
    parser.add_argument(
        "--images-only", action="store_true",
        help="Skip DB row sync (storage files only, still rewrites URLs)",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Read from source but don't write to target",
    )
    args = parser.parse_args()

    if args.data_only and args.images_only:
        print("ERROR: --data-only and --images-only are mutually exclusive")
        sys.exit(1)

    # Validate slugs against injection
    _validate_slugs(args.sims)

    # Resolve table groups
    if args.tables:
        active_groups = set(args.tables.split(","))
        unknown = active_groups - set(TABLE_GROUPS)
        if unknown:
            print(f"ERROR: Unknown table group(s): {', '.join(sorted(unknown))}")
            print(f"  Valid groups: {', '.join(TABLE_GROUPS)}")
            sys.exit(1)
    else:
        active_groups = set(TABLE_GROUPS)

    # ── Header ────────────────────────────────────────────────────────────
    sims_label = ", ".join(args.sims)
    print(f"\n=== Sync: {sims_label} ({args.source} → {args.target}) ===\n")
    if args.dry_run:
        print("  Mode: DRY RUN (no writes)\n")
    if args.data_only:
        print("  Scope: data only (no images)\n")
    if args.images_only:
        print("  Scope: images only (no DB rows)\n")
    if args.tables:
        print(f"  Table groups: {args.tables}\n")

    t_start = time.time()

    # ── Resolve simulation IDs ────────────────────────────────────────────
    sim_rows = _resolve_simulations(args.source, args.sims)
    sim_ids = [str(r["id"]) for r in sim_rows]
    sim_slugs = [r["slug"] for r in sim_rows]
    print(f"  Resolved {len(sim_ids)} simulation(s)\n")

    total_rows = 0
    url_updates = 0
    storage_stats = {"attempted": 0, "synced": 0, "skipped": 0, "failed": 0}

    # ── Data sync ─────────────────────────────────────────────────────────
    if not args.images_only:
        print("Data sync:")
        total_rows = sync_data(
            args.source, args.target, sim_slugs, sim_ids,
            active_groups, args.dry_run,
        )

        # URL rewriting (only when source ≠ target base URL)
        if _storage_url(args.source) != _storage_url(args.target):
            url_updates = rewrite_urls(
                args.source, args.target, sim_ids, args.dry_run,
            )

    # ── Storage sync ──────────────────────────────────────────────────────
    if not args.data_only:
        print("\nStorage sync:")
        storage_stats = sync_storage(
            args.source, args.target, sim_ids, sim_slugs, args.dry_run,
        )

    # ── Summary ───────────────────────────────────────────────────────────
    elapsed = time.time() - t_start
    parts = []
    if not args.images_only:
        parts.append(f"{total_rows} rows synced")
    if url_updates:
        parts.append(f"{url_updates} URLs rewritten")
    if not args.data_only:
        s = storage_stats
        file_parts = [f"{s['synced']} files synced"]
        if s["skipped"]:
            file_parts.append(f"{s['skipped']} skipped")
        if s["failed"]:
            file_parts.append(f"{s['failed']} failed")
        parts.append(", ".join(file_parts))

    summary = ", ".join(parts) if parts else "nothing to do"
    mode = " [DRY RUN]" if args.dry_run else ""
    print(f"\n=== Done: {summary}, {elapsed:.1f}s{mode} ===\n")


if __name__ == "__main__":
    main()

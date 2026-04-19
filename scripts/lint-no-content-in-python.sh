#!/usr/bin/env bash
# Forbid bilingual game content from being added to Python files under
# `backend/services/dungeon/`. Since A1.5b (2026-04-19), dungeon content
# (encounters, banter, loot, enemies, spawn configs, objektanker, barometer
# texts, entrance texts, abilities) lives in `content/dungeon/**/*.yaml`.
# The Python modules keep only runtime functions.
#
# This gate catches:
#   - New `text_en="..."` / `description_de: "..."` bilingual string-literal
#     assignments (game prose).
#   - Re-introduction of the deleted registries (`_BANTER_REGISTRIES`,
#     `SHADOW_BANTER`, `TOWER_ENEMIES`, ...).
#   - Per-archetype content constants that fed the deleted registries.
#
# Combat ability content is similarly forbidden in
# `backend/services/combat/ability_schools.py` (ALL_ABILITIES et al.).
#
# File-level opt-out: add the pragma comment
#     # content-allowed: <short reason>
# near the top of a file to exempt it (used by dungeon_loot.py to carry the
# Deluge DELUGE_DEBRIS_POOL, which lives in Python because it is not part of
# the DB content tables).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

FAIL=0

# ── Helper: does the file carry the content-allowed pragma? ──────────────

file_exempt() {
  local file="$1"
  grep -qE '^\s*#\s*content-allowed:' "$file" 2>/dev/null
}

# ── Scope: files to lint ──────────────────────────────────────────────────

SCAN_FILES=()
while IFS= read -r f; do
  SCAN_FILES+=("$f")
done < <(
  {
    find backend/services/dungeon -type f -name '*.py'
    echo backend/services/combat/ability_schools.py
  } | sort -u
)

# ── Rule 1: bilingual string-literal assignments ─────────────────────────
#
# Regex requires an `=` followed by a string literal. Type annotations
# (`text_en: str`) have no `=`, attribute copies (`name_en=obj.name_en`)
# have no opening quote — both pass through the filter.

LITERAL_PATTERN='^\s*(text_en|text_de|name_en|name_de|description_en|description_de|label_en|label_de)\s*=\s*["'"'"']'

for file in "${SCAN_FILES[@]}"; do
  if [ ! -f "$file" ]; then continue; fi
  if file_exempt "$file"; then continue; fi
  MATCHES="$(grep -nE "$LITERAL_PATTERN" "$file" 2>/dev/null || true)"
  if [ -n "$MATCHES" ]; then
    echo "FAIL: bilingual-content string literal in $file" >&2
    echo "$MATCHES" >&2 | sed 's/^/  /'
    FAIL=1
  fi
done

# ── Rule 2: deleted-registry names (definition syntax only) ──────────────

FORBIDDEN_NAMES=(
  _BANTER_REGISTRIES _ENCOUNTER_REGISTRIES _ENEMY_REGISTRIES
  _SPAWN_REGISTRIES _LOOT_REGISTRIES _ENCOUNTER_BY_ID
  ANCHOR_OBJECTS BAROMETER_TEXTS ENTRANCE_TEXTS ALL_ABILITIES
  SHADOW_BANTER TOWER_BANTER ENTROPY_BANTER MOTHER_BANTER
  PROMETHEUS_BANTER DELUGE_BANTER AWAKENING_BANTER OVERTHROW_BANTER
  SHADOW_ENEMIES TOWER_ENEMIES ENTROPY_ENEMIES MOTHER_ENEMIES
  PROMETHEUS_ENEMIES DELUGE_ENEMIES AWAKENING_ENEMIES OVERTHROW_ENEMIES
  SHADOW_SPAWN_CONFIGS TOWER_SPAWN_CONFIGS ENTROPY_SPAWN_CONFIGS
  MOTHER_SPAWN_CONFIGS PROMETHEUS_SPAWN_CONFIGS DELUGE_SPAWN_CONFIGS
  AWAKENING_SPAWN_CONFIGS OVERTHROW_SPAWN_CONFIGS
  SHADOW_LOOT_TABLES TOWER_LOOT_TABLES ENTROPY_LOOT_TABLES
  MOTHER_LOOT_TABLES PROMETHEUS_LOOT_TABLES DELUGE_LOOT_TABLES
  AWAKENING_LOOT_TABLES OVERTHROW_LOOT_TABLES
)

for name in "${FORBIDDEN_NAMES[@]}"; do
  for file in "${SCAN_FILES[@]}"; do
    if [ ! -f "$file" ]; then continue; fi
    # Exempted files may legitimately *reference* forbidden names but not
    # redefine them; treat the pragma as blanket skip for both rules.
    if file_exempt "$file"; then continue; fi
    RESULT="$(grep -nE "^\s*${name}\s*[:=]" "$file" 2>/dev/null || true)"
    if [ -n "$RESULT" ]; then
      echo "FAIL: deleted registry '${name}' reintroduced in $file" >&2
      echo "$RESULT" >&2 | sed 's/^/  /'
      FAIL=1
    fi
  done
done

if [ $FAIL -eq 0 ]; then
  echo "OK: no bilingual content or deleted registries in Python dungeon files"
fi

exit $FAIL

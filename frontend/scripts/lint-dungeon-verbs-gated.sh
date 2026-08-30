#!/usr/bin/env bash
# Every dungeon verb the dispatcher handles must have a clearance tier.
#
# The gate in `dungeon-commands.ts` reads:
#
#     const requiredTier = DUNGEON_VERB_TIER[verb];
#     if (requiredTier !== undefined && !bypass) { ... }
#
# so a verb that is dispatched but ABSENT from the table skips the clearance
# check entirely — it does not fall back to a default tier, it is simply
# ungated. `protocol` was in exactly that state (Befund D18 der Systemprüfung):
# handled by the switch, missing from the table, usable at clearance 0.
#
# This gate compares the two lists. It does NOT require the reverse direction:
# the table may legitimately carry a verb the dungeon dispatcher does not handle
# (`dungeon` is the entry verb and lives elsewhere).
set -uo pipefail

# Anchor to the frontend root so the grep targets resolve no matter where the
# gate is invoked from (enforced by scripts/lint-lint-scripts-anchored.sh —
# which caught this script the first time it was written).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

FILE="src/utils/dungeon-commands.ts"

if [[ ! -f "$FILE" ]]; then
  echo "FAIL: $FILE not found — did the dispatcher move?" >&2
  exit 1
fi

# Verbs the switch dispatches.
dispatched=$(grep -oE "^    case '[a-z]+':" "$FILE" | sed "s/.*case '//;s/'://" | sort -u)

# Verbs the tier table declares, read from the object literal only.
tiered=$(awk '/^const DUNGEON_VERB_TIER/,/^};/' "$FILE" \
  | grep -oE "^  [a-z]+: [0-9]" | sed 's/^  //;s/:.*//' | sort -u)

if [[ -z "$dispatched" ]]; then
  echo "FAIL: found no dispatched verbs — the scan pattern no longer matches." >&2
  exit 1
fi
if [[ -z "$tiered" ]]; then
  echo "FAIL: found no tiered verbs — the scan pattern no longer matches." >&2
  exit 1
fi

ungated=$(comm -23 <(echo "$dispatched") <(echo "$tiered"))

if [[ -n "$ungated" ]]; then
  echo "FAIL: dungeon verbs dispatched without a clearance tier:" >&2
  echo "$ungated" | sed 's/^/  - /' >&2
  echo "" >&2
  echo "A verb missing from DUNGEON_VERB_TIER is NOT gated at a default tier —" >&2
  echo "the check is skipped outright. Add it to the table." >&2
  exit 1
fi

# ── Second direction: every dispatched verb must be documented ─────────────
# `help dungeon` listed 16 of 19 verbs. `ground` and `rally` were dispatched,
# gated and undocumented — two archetypes had a command the help never named
# (Befund D19). An alias counts as documented when the help names it.
HELPFILE="src/utils/dungeon-formatters.ts"
# Comment lines are stripped before the check: the explanatory comment inside
# formatDungeonHelp names `ground` and `rally` itself, and without this the gate
# found them there and passed while the help text still omitted them. A gate
# that reads its own explanation instead of the thing proves nothing.
help_block=$(awk '/export function formatDungeonHelp/,/^}/' "$HELPFILE" | grep -vE "^\s*(//|\*|/\*)")

if [[ -z "$help_block" ]]; then
  echo "FAIL: could not read formatDungeonHelp from $HELPFILE." >&2
  exit 1
fi

undocumented=""
for verb in $dispatched; do
  if ! grep -qE "(^|[^a-z])$verb([^a-z]|$)" <<<"$help_block"; then
    undocumented+="$verb"$'\n'
  fi
done

if [[ -n "$undocumented" ]]; then
  echo 'FAIL: dungeon verbs the player can use and "help dungeon" never mentions:' >&2
  printf '%s' "$undocumented" | sed 's/^/  - /' >&2
  exit 1
fi

echo "PASS: all $(echo "$dispatched" | wc -w | tr -d ' ') dispatched dungeon verbs carry a clearance tier and appear in help."

#!/usr/bin/env bash
# lint-no-ternary-in-msg.sh — grammar decisions belong to the i18n layer, not to
# a conditional inside a message template.
# Run: bash frontend/scripts/lint-no-ternary-in-msg.sh
#
# Exit code: 0 = pass, 1 = violations found.
#
# Rejected pattern: a ternary (`? … :`) inside a `${…}` placeholder of a
# `msg(str`…`)` template.
#
# Why: lit-localize turns each `msg(str`…`)` into ONE message whose placeholders
# are opaque to the translator. A ternary hides a word — usually a plural suffix
# — inside such a placeholder, so no translation can be correct. The agent list
# read `msg(str`${n} Agent${n !== 1 ? 's' : ''}`)`, giving German the source
# `{0} Agent{1}`. The only available target was `{0} Agent{1}en`, and the page
# showed "8 AGENTSEN". The relationship summary had the same shape with English
# words: `${n === 1 ? 'ally' : 'allies'}` reached the German UI untranslated.
#
# Correct pattern: one complete message per grammatical case, chosen outside the
# message. lit-localize has no ICU plurals; this is the supported idiom.
#
#   count === 1 ? msg('1 Agent') : msg(str`${count} Agents`)
#
# `??` is deliberately NOT matched. A nullish fallback substitutes a missing
# value; it does not choose between wordings.
#
# See CLAUDE.md 'i18n (MANDATORY)' and
# docs/plans/graphical-dungeon-remediation-2026-08-28.md D-1.

set -euo pipefail

# Anchor all paths to the frontend root. CI and `npm run lint:full` invoke this
# script from the REPO root while a developer runs it from `frontend/`; a
# relative target that is right for one is silently empty for the other, and the
# `2>/dev/null || true` guards turn that into a green no-op pass. Resolve
# SCRIPT_DIR BEFORE the cd — BASH_SOURCE may be relative and would die with the
# old cwd. Enforced by scripts/lint-lint-scripts-anchored.sh.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# A `?` that is not part of `??` or `?.`, followed later by a `:`, inside a
# placeholder of a msg(str`…`) template.
VIOLATIONS=$(grep -rnE "msg\(str\`[^\`]*\\\$\{[^}]*[^?]\?[^?.][^}]*:[^}]*\}" \
  --include='*.ts' src/ 2>/dev/null || true)

if [ -n "$VIOLATIONS" ]; then
  echo "ERROR: conditional inside a localized message template:"
  echo ""
  echo "$VIOLATIONS"
  echo ""
  echo "A ternary inside msg(str\`…\`) hides a word in an opaque placeholder, so"
  echo "no translation can be correct. Choose between COMPLETE messages instead:"
  echo ""
  echo "  count === 1 ? msg('1 Agent') : msg(str\`\${count} Agents\`)"
  echo ""
  echo "See CLAUDE.md 'i18n (MANDATORY)'."
  exit 1
fi

echo "PASS: no conditionals inside localized message templates."
exit 0

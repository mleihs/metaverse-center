#!/bin/bash
# lint-no-cast-unknown.sh — Type casts via `as unknown as T` must be replaced
# with proper type guards, narrow-interface accessors, or corrected upstream
# signatures.
# Run: bash frontend/scripts/lint-no-cast-unknown.sh
#
# Exit code: 0 = pass, 1 = violations found.
#
# Rejected pattern: `as unknown as T` (double-cast through `unknown`) anywhere
# in `frontend/src/**/*.ts`. This pattern defeats TypeScript's structural
# check and is a documented source of runtime `undefined` crashes and silent
# feature breakage (W3.2 found three latent bugs behind such casts — C1, C5,
# plus two in the ForgeStateManager / AdminDungeonContentTab pair of C4).
#
# Correct patterns:
#   - Add the missing field to the base type (if it's genuinely on the entity).
#   - Create a wrapper / projection type (for SQL-view fields that aren't on
#     the base table).
#   - Write a `function isFoo(x: unknown): x is Foo` type guard with runtime
#     validation. Reject failures via `captureError` (see W2.3c invariant).
#   - Fix the upstream return type on the API service method — frontend
#     `ApiResponse<T>` already carries `meta` so double-wrapping is wrong.
#   - For dynamic field access, use a narrow key type via
#     `Exclude<keyof State, 'immutableField'>` instead of widening to
#     `Record<string, unknown>`.
#
# Whitelist — two canonical Lit mixin idioms where TypeScript genuinely cannot
# infer the intersection of the concrete mixin host constructor with the
# dynamic TBase parameter. See https://lit.dev/docs/composition/mixins/
# #creating-a-mixin. Both files contain a documented block comment explaining
# this; widening the whitelist without a matching comment is a review-bail.
#
# Why this matters: "as unknown as T" tells the compiler "trust me" at a
# place where it has no way to verify. Wrong in 3 of 16 sites audited in
# W3.2 — features were silently broken because the cast hid the shape drift.
# Every cast is a potential latent bug; a type guard preserves the runtime
# validation that the cast erased.
#
# See CLAUDE.md 'Frontend Rules' > 'Type Safety (MANDATORY)'.

set -euo pipefail

# Files where the `as unknown as` pattern is the documented Lit mixin idiom.
# Extend this list only with a matching comment in the source file AND a
# review consensus that the TypeScript limitation is inherent, not a gap in
# our types.
WHITELIST_REGEX='^src/components/shared/(DataLoaderMixin|PaginatedLoaderMixin)\.ts:'

VIOLATIONS=$(grep -rnE 'as[[:space:]]+unknown[[:space:]]+as' \
  --include='*.ts' src/ 2>/dev/null | \
  grep -vE "$WHITELIST_REGEX" || true)

if [ -n "$VIOLATIONS" ]; then
  echo "ERROR: \`as unknown as T\` casts are forbidden outside the 2 whitelisted Lit mixin sites:"
  echo ""
  echo "$VIOLATIONS"
  echo ""
  echo "Fix options (pick the one that matches the root cause):"
  echo "  - Add the missing field to the base type (if it's on the entity)."
  echo "  - Create a wrapper / projection type (for SQL-view or FK-join fields)."
  echo "  - Write a \`function isFoo(x: unknown): x is Foo\` type guard with"
  echo "    runtime validation. Observe rejections via captureError."
  echo "  - Fix the upstream API service return type — ApiResponse<T> already"
  echo "    carries \`meta\`; don't double-wrap with PaginatedResponse<T>."
  echo "  - For dynamic field access, narrow the key type via"
  echo "    \`Exclude<keyof State, 'immutableField'>\` instead of widening to"
  echo "    Record<string, unknown>."
  echo ""
  echo "See CLAUDE.md 'Frontend Rules' > 'Type Safety (MANDATORY)'."
  exit 1
fi

echo "PASS: no \`as unknown as T\` casts outside the 2 whitelisted Lit mixin sites."
exit 0

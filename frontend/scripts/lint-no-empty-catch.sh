#!/bin/bash
# lint-no-empty-catch.sh — Every failure path must be observed.
# Run: bash frontend/scripts/lint-no-empty-catch.sh
#
# Exit code: 0 = pass, 1 = violations found.
#
# Rejects three sibling anti-patterns for silent exception swallowing:
#
# Rule 1 — empty-var `catch {` without an `(err)` binding. Without the
#   binding, the error object is unreachable, so `captureError()` can never
#   observe it. Variants rejected:
#     } catch {}
#     } catch { /* non-critical */ }
#     } catch { return fallback; }
#   SentryService.ts is allowlisted because it IS the capture service.
#
# Rule 2 — `.catch(() => ...)` Promise-chain handlers without a rejection
#   binding. Same root problem in Promise-chain syntax: the rejection reason
#   is discarded, so Sentry is blind to it.
#     foo().catch(() => {});
#     foo().catch(() => { log("failed"); });
#
# Rule 3 — bound-but-unobserved catch bodies (deep audit 2026-07-12).
#   `catch (err) { console.error(err); }` passes Rules 1+2 (a binding
#   exists) while still leaving Sentry blind. Delegated to
#   scripts/lint-catch-observability.mjs, which brace-matches every catch
#   body and every `.catch((err) => ...)` handler and requires
#   captureError-or-throw inside.
#
# Correct patterns:
#   } catch (err) {
#     captureError(err, { source: 'ClassName.methodName' });
#     // optional: VelgToast.error(...), this._error = ..., return fallback
#   }
#
#   someAsync().catch((err) => captureError(err, { source: '...' }));
#
# Why this matters: silent swallow of exceptions produces invisible failures
# in production — users see "nothing happened" and we see nothing in Sentry.
# The full remediation history lives in
# memory/architecture-welle-2-3c-complete-*.md and CLAUDE.md under
# "Frontend Rules > Error Observability (MANDATORY)".

set -euo pipefail

# Anchor all paths to the frontend root. CI and `npm run lint:full` invoke
# this script from the REPO root, where a bare `src/` matches nothing and the
# `2>/dev/null || true` guards turned Rules 1+2 into silent no-op passes
# (found during the 2026-07 deep-audit sweep). Resolve SCRIPT_DIR BEFORE the
# cd — BASH_SOURCE may be a relative path that dies with the old cwd.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

FAIL=0

# Rule 1: empty-var `catch {` (no binding)
CATCH_VIOLATIONS=$(grep -rnE 'catch\s*\{' \
  --include='*.ts' src/ 2>/dev/null | \
  grep -v '^src/services/SentryService\.ts:' || true)

if [ -n "$CATCH_VIOLATIONS" ]; then
  echo "ERROR: empty-var catch blocks are forbidden — every failure must be observed:"
  echo ""
  echo "$CATCH_VIOLATIONS"
  echo ""
  echo "Fix: add a binding and route errors through captureError:"
  echo "    } catch (err) {"
  echo "      captureError(err, { source: 'ClassName.methodName' });"
  echo "      // ...existing body (if any)"
  echo "    }"
  echo ""
  FAIL=1
fi

# Rule 2: `.catch(() => ...)` Promise-chain swallowers with no arg binding.
PROMISE_VIOLATIONS=$(grep -rnE '\.catch\s*\(\s*\(\s*\)\s*=>' \
  --include='*.ts' src/ 2>/dev/null | \
  grep -v '^src/services/SentryService\.ts:' || true)

if [ -n "$PROMISE_VIOLATIONS" ]; then
  echo "ERROR: Promise-chain .catch(() => ...) without a rejection binding is forbidden:"
  echo ""
  echo "$PROMISE_VIOLATIONS"
  echo ""
  echo "Fix: bind the rejection and route through captureError:"
  echo "    .catch((err) => captureError(err, { source: 'ClassName.methodName' }))"
  echo ""
  FAIL=1
fi

# Rule 3: bound-but-unobserved catch bodies (captureError-or-throw required).
if ! node "$SCRIPT_DIR/lint-catch-observability.mjs"; then
  FAIL=1
fi

if [ "$FAIL" -eq 1 ]; then
  echo "See CLAUDE.md 'Frontend Rules' > 'Error Observability (MANDATORY)'."
  exit 1
fi

echo "PASS: no empty-var catch blocks or Promise-chain swallowers. Every failure path has a binding and is observed."
exit 0

#!/bin/bash
# lint-no-private-generate.sh — Keep GenerationService._generate() private.
# Run: bash scripts/lint-no-private-generate.sh
#
# Exit code: 0 = pass, 1 = violations found.
#
# Rejects any call to `_generate(` in `backend/services/` outside of
# `generation_service.py` itself. Callers must use the public façade
# methods on GenerationService:
#
#   - extract_memory_observations
#   - reflect_on_memories
#   - generate_chronicle_entry
#   - generate_cycle_sitrep
#   - generate_instagram_caption
#
# The tests under `backend/tests/` are intentionally NOT checked — test
# code mocks `_generate` via `patch.object(instance, "_generate", ...)`
# to simulate the LLM response, which is a legitimate test seam.
#
# Why: see docs/analysis/architecture-cleanliness-verification-2026-04-17.md
# finding F6, and memory/architecture-welle-1-complete-2026-04-17.md for
# the full remediation plan (W2.4).

set -euo pipefail

VIOLATIONS=0
TARGET_DIR="backend/services"

# Match `._generate(` calls but skip:
#   - the definition in generation_service.py
#   - comment/docstring lines starting with # or containing only """..."""
FORBIDDEN=$(grep -rnE '\._generate\(' \
  --include='*.py' \
  "$TARGET_DIR" 2>/dev/null | \
  grep -v '^backend/services/generation_service\.py:' | \
  grep -vE '^[^:]+:[0-9]+:\s*#' || true)

if [ -n "$FORBIDDEN" ]; then
  echo "ERROR: External call to GenerationService._generate() — forbidden:"
  echo "$FORBIDDEN"
  echo ""
  echo "Use one of the public façade methods on GenerationService instead:"
  echo "  - extract_memory_observations   (agent-chat → observations)"
  echo "  - reflect_on_memories           (observations → reflections)"
  echo "  - generate_chronicle_entry      (period summaries → chronicle)"
  echo "  - generate_cycle_sitrep         (battle stats → sitrep)"
  echo "  - generate_instagram_caption    (candidate → caption)"
  echo ""
  echo "Each façade method owns its prompt template + model purpose and"
  echo "returns a typed DTO from backend/models/generation.py — callers"
  echo "no longer need to know the _generate() contract."
  VIOLATIONS=1
fi

if [ "$VIOLATIONS" -eq 0 ]; then
  echo "PASS: GenerationService._generate() is not called from outside generation_service.py."
fi

exit $VIOLATIONS

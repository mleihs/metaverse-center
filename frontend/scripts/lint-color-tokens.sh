#!/bin/bash
# lint-color-tokens.sh — Reject raw hex colors and gray tokens in component CSS.
# Run: bash frontend/scripts/lint-color-tokens.sh
#
# Documented exceptions are filtered out.
# Exit code: 0 = pass, 1 = violations found.

set -euo pipefail

VIOLATIONS=0
COMPONENTS_DIR="frontend/src/components"

# --- Check 1: --color-gray-* usage anywhere in frontend/src ---
RESULT=$(grep -rn 'color-gray-' frontend/src/ 2>/dev/null || true)
if [ -n "$RESULT" ]; then
  echo "ERROR: --color-gray-* tokens found (removed from design system):"
  echo "$RESULT"
  echo ""
  VIOLATIONS=1
fi

# --- Check 2: Raw #hex in component CSS ---
# Exceptions are filtered AFTER grep to support subdirectory paths.
RESULT=$(grep -rnE '#[0-9a-fA-F]{3,8}\b' \
  --include='*.ts' \
  "$COMPONENTS_DIR" 2>/dev/null | \
  grep -v 'lint-color-ok' | \
  grep -v 'var(--' | \
  grep -v 'import ' | \
  grep -v '@license' | \
  grep -v '\.hash' | \
  grep -v 'channel\.' | \
  grep -v 'href=' | \
  grep -v 'console\.' | \
  grep -v 'getElementById' | \
  grep -v 'defaultValue' | \
  grep -v 'Color(' | \
  grep -v 'backgroundColor(' | \
  grep -v '&#[0-9]' | \
  grep -v '/EchartsChart\.ts:' | \
  grep -v '/forge-placeholders\.ts:' | \
  grep -v '/DailyBriefingModal\.ts:' | \
  grep -v '/VelgDarkroomStudio\.ts:' | \
  grep -v '/DesignSettingsPanel\.ts:' | \
  grep -v '/map-data\.ts:' | \
  grep -v '/map-three-render\.ts:' | \
  grep -v '/HowToPlayView\.ts:' | \
  grep -v '/VelgForgeDarkroom\.ts:' | \
  grep -v '/CartographerMap\.ts:' | \
  grep -v '/CartographicMap\.ts:' | \
  grep -v '/VelgForgeTable\.ts:' | \
  grep -v '/EmbassyLink\.ts:' | \
  grep -v '/BleedGazetteSidebar\.ts:' | \
  grep -v '/MapBattleFeed\.ts:' | \
  grep -v '/SimulationSwitcher\.ts:' | \
  grep -v '/MapLayerToggle\.ts:' | \
  grep -v '/AdminInstagramTab\.ts:' || true)

if [ -n "$RESULT" ]; then
  echo "ERROR: Raw hex colors found in components (use semantic tokens):"
  echo "$RESULT"
  echo ""
  VIOLATIONS=1
fi

# --- Summary ---
if [ "$VIOLATIONS" -eq 0 ]; then
  echo "PASS: No color token violations found."
fi

exit $VIOLATIONS

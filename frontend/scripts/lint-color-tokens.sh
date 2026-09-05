#!/bin/bash
# lint-color-tokens.sh — Reject raw colors (hex, rgba, rgb) and gray tokens in component CSS.
# Run: bash frontend/scripts/lint-color-tokens.sh
#
# Documented exceptions are filtered out.
# Exit code: 0 = pass, 1 = violations found.
#
# Convention (enforced by code review, not this script):
#   Component-local custom properties MUST use the --_ prefix (e.g. --_accent, --_phosphor-dim).
#   Define only in :host blocks. Derive from Tier 1/2 tokens via color-mix().
#   See docs/guides/design-tokens.md for the full 3-tier architecture.

set -euo pipefail

# Anchor all paths to the frontend root. CI and `npm run lint:full` invoke this
# script from the REPO root while a developer runs it from `frontend/`; a
# relative target that is right for one is silently empty for the other, and the
# `2>/dev/null || true` guards turn that into a green no-op pass. Resolve
# SCRIPT_DIR BEFORE the cd — BASH_SOURCE may be relative and would die with the
# old cwd. Enforced by scripts/lint-lint-scripts-anchored.sh.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

VIOLATIONS=0
COMPONENTS_DIR="src/components"

# --- Check 1: --color-gray-* usage anywhere in frontend/src ---
RESULT=$(grep -rn 'color-gray-' src/ 2>/dev/null || true)
if [ -n "$RESULT" ]; then
  echo "ERROR: --color-gray-* tokens found (removed from design system):"
  echo "$RESULT"
  echo ""
  VIOLATIONS=1
fi

# --- Check 2: Raw rgba()/rgb() in tokenized components ---
# Enforced on directories/files that have been fully migrated to color-mix tokens.
# Add dirs here as they're cleaned. Use "lint-color-ok" comment for intentional overlays.
RGBA_ENFORCED_DIRS=(
  "$COMPONENTS_DIR/epoch"
  "$COMPONENTS_DIR/forge/VelgForgeCeremony.ts"
  # Added after the Atlas-skin Sweep B (black shadows) + Sweep C (white
  # overlays), 2026-09-03: these two were already at zero raw rgba() once
  # those two sweeps landed. The other Sweep-C target dirs (how-to-play,
  # platform, shared, settings, multiverse, map, health, heartbeat,
  # archetypes) still carry COLOURED rgba() — accent glows, warning tints —
  # that neither sweep touched; enforcing there now would fail the gate on
  # work nobody has done yet. Extend the list dir-by-dir as each is cleaned,
  # not in one jump — see handoff/RESUME-atlas-skin-2026-09-03.md.
  "$COMPONENTS_DIR/content"
  "$COMPONENTS_DIR/agents"
  # Nachtrag 05.09.2026, nach dem Bernstein-Durchgang: 63 fest verdrahtete
  # rgba(245,158,11,...) in 16 Dateien laufen jetzt ueber
  # var(--color-accent-amber) und damit ueber die Polaritaetsregel in
  # ThemeService.publishPlatformAccent. Danach gemessen: die folgenden
  # Verzeichnisse tragen NULL rohe rgba().
  #
  # Das ist KEIN Sprung entgegen der Warnung darueber: die Warnung galt
  # Verzeichnissen, in denen die Arbeit noch aussteht. Jedes hier ist
  # nachgemessen leer, das Tor ist also ab der ersten Sekunde gruen und
  # bewacht ab jetzt nur, dass es so bleibt.
  "$COMPONENTS_DIR/alpha"
  "$COMPONENTS_DIR/bonds"
  "$COMPONENTS_DIR/broadsheet"
  "$COMPONENTS_DIR/buildings"
  "$COMPONENTS_DIR/bureau"
  "$COMPONENTS_DIR/chronicle"
  "$COMPONENTS_DIR/dashboard"
  "$COMPONENTS_DIR/drift"
  "$COMPONENTS_DIR/embassies"
  "$COMPONENTS_DIR/intake"
  "$COMPONENTS_DIR/journal"
  "$COMPONENTS_DIR/landing"
  "$COMPONENTS_DIR/locations"
  "$COMPONENTS_DIR/simulation"
  "$COMPONENTS_DIR/world-map"
)
for TARGET in "${RGBA_ENFORCED_DIRS[@]}"; do
  # Kommentarzeilen fallen raus. Ein rgba() hinter // oder * ist Prosa und
  # faerbt nichts; zwei Erklaertexte in landing/ haben das Tor beim Aufziehen
  # der Liste am 05.09.2026 rot gemeldet, obwohl beide Dateien sauber sind.
  # Ein Tor, das den Unterschied zwischen Code und Erklaerung nicht kennt,
  # bestraft genau das Aufschreiben, das dieses Haus verlangt.
  RESULT=$(grep -rnE 'rgba?\(' \
    --include='*.ts' \
    "$TARGET" 2>/dev/null | \
    grep -v 'lint-color-ok' | \
    grep -v 'color-mix' | \
    grep -vE '^[^:]+:[0-9]+: *(\*|//|/\*)' || true)

  if [ -n "$RESULT" ]; then
    echo "ERROR: Raw rgba()/rgb() found in tokenized component (use color-mix or lint-color-ok):"
    echo "$RESULT"
    echo ""
    VIOLATIONS=1
  fi
done

# --- Check 3: Raw #hex in component CSS ---
# Covers both `css`...`` blocks in .ts files AND standalone .css files under
# components/ (e.g. world-map.css for light-DOM components that can't use
# static styles). Token source files in `styles/tokens/` are NOT scanned —
# they're the source of truth and legitimately contain hex.
# Exceptions are filtered AFTER grep to support subdirectory paths.
RESULT=$(grep -rnE '#[0-9a-fA-F]{3,8}\b' \
  --include='*.ts' \
  --include='*.css' \
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
  grep -v '/VelgDarkroomStudio\.ts:' | \
  grep -v '/DesignSettingsPanel\.ts:' | \
  grep -v '/VelgDesignPreview\.ts:' | \
  grep -v '/map-data\.ts:' | \
  grep -v '/map-three-render\.ts:' | \
  grep -v '/drift/chart/' | \
  grep -v '/drift/scene/' | \
  grep -v '/drift/post/' | \
  grep -v '/drift/controls/' | \
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
  grep -v '/AdminInstagramTab\.ts:' | \
  grep -v '/dungeon-showcase-data\.ts:' | \
  grep -v '/HowToPlayWarRoom\.ts:' | \
  grep -v '/archetype-detail-styles\.ts:' | \
  grep -v '/ArchetypeDetailView\.ts:' || true)

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

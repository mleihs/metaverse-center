#!/bin/bash
# lint-svg-fragments-use-svg-tag.sh — An SVG fragment must be written with lit's
# `svg` tag, never `html`. Run: bash frontend/scripts/lint-svg-fragments-use-svg-tag.sh
#
# Exit code: 0 = pass, 1 = violations found.
#
# Why this is a gate. A nested html`` template is parsed as HTML even when the
# place it renders into is inside an <svg>. The browser then builds an element
# in the XHTML namespace, and an SVG shape in the XHTML namespace draws
# NOTHING. There is no error, no warning, no console output — the geometry is
# simply absent.
#
# Measured 2026-08-29 (lit 3.3.3, same render pass, all three inside one <svg>):
#
#   html`<line …/>`     -> ns=http://www.w3.org/1999/xhtml   HTMLUnknownElement
#   svg`<circle …/>`    -> ns=http://www.w3.org/2000/svg     SVGCircleElement
#   <path …/> written directly in the parent template
#                       -> ns=http://www.w3.org/2000/svg     SVGPathElement
#
# The bug that produced this gate: the agent needs radar in AgentMoodPanel drew
# its grid rings, its five axes and its data points through `.map(… => html`…`)`.
# All of them were invisible. Only the filled area showed, because that one was
# written directly in the surrounding template. It had been that way since the
# panel was built.
#
# lit-analyzer catches part of this as `no-unclosed-tag` — but only for elements
# its HTML parser does not recognise. It flagged <line> and <circle> and stayed
# silent on <path>, which was broken in exactly the same way. That is the gap
# this gate closes.

set -euo pipefail

# Anchor all paths to the frontend root — CI and `npm run lint:full` invoke this
# from the REPO root, a developer from `frontend/`. Resolve SCRIPT_DIR BEFORE
# the cd. Enforced by scripts/lint-lint-scripts-anchored.sh.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# Elements that only exist in the SVG namespace. Deliberately excludes names
# that are also valid HTML (a, script, style, title) — those are ambiguous in a
# grep and would produce noise.
SVG_ONLY='path|circle|line|rect|ellipse|polygon|polyline|tspan|textPath|defs|use|marker|clipPath|mask|linearGradient|radialGradient|stop|feGaussianBlur|feOffset|feMerge|feMergeNode|feColorMatrix|feComponentTransfer|feTurbulence|feDisplacementMap|feFlood|feComposite|feBlend|animate|animateTransform|animateMotion|foreignObject|symbol|pattern|switch'

if hits=$(grep -rnE "html\`[[:space:]]*<($SVG_ONLY)[[:space:]/>]" src --include='*.ts' 2>/dev/null); then
  echo "FAIL: SVG fragment written with the \`html\` tag."
  echo
  echo "$hits" | sed 's/^/  /'
  echo
  echo "  These render as HTMLUnknownElement in the XHTML namespace and draw"
  echo "  nothing at all — silently. Use lit's \`svg\` tag instead:"
  echo
  echo "      import { svg } from 'lit';"
  echo "      \${items.map((i) => svg\`<circle cx=\${i.x} cy=\${i.y} />\`)}"
  echo
  exit 1
fi

count=$(grep -rlE "svg\`" src --include='*.ts' 2>/dev/null | wc -l | tr -d ' ')
echo "PASS: no SVG fragments written with the html tag (${count} file(s) use the svg tag)."

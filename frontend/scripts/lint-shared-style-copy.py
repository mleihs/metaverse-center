#!/usr/bin/env python3
"""Reject a component that re-types CSS a shared `*-styles.ts` module already owns.

WHY THIS GATE EXISTS
    This repo is very good at WRITING a rule down and unevenly good at BINDING
    it. The sweep of 2026-08-29 built `shared/marker-styles.ts` with forty lines
    arguing why status must not be a coloured bar — and then the commit that
    claimed to apply it copied the treatment by hand into three files instead of
    importing it. `markerStatusStyles` ended the day with zero importers while
    its content stood, verbatim, in `VelgContentDraftEditor`,
    `VelgPublishBatchModal` and `VelgSweepOrphansModal`. `ClearanceQueue` carried
    a 63-line hand-copy of the whole `.forge-section` family from
    `admin-shared-styles.ts`, amber edge bar included, without importing it.

    Writing the module felt like enforcing it. It was not. This gate is the
    binding.

WHAT IS REJECTED
    A window of 12 consecutive normalised lines that
      * appears verbatim in a `*-styles.ts` module AND in a component,
      * contains at least one SELECTOR line (`.foo {`), and
      * the component does not name that module anywhere.

WHY THOSE THREE CONDITIONS, MEASURED
    Loosening any one of them stops measuring duplication. Over the whole
    frontend on 2026-08-30:

        window 8,  no selector required  ->  57 pairs   (mostly noise: any two
                                                        files share a run of
                                                        `display: flex; …`)
        window 12, selector required     ->   4 pairs   (all four real)
        window 20, selector required     ->   3 pairs

    So the selector requirement is what separates "two files happen to set the
    same four properties" from "someone re-typed a rule". All four were fixed —
    the last of them, DraftRosterPanel against deploy-operative-styles, only
    after two measured attempts at sharing whole rule groups were thrown away for
    leaking properties into the panel. The gate stands at zero exceptions.

WHAT IS NOT CHECKED HERE, AND WHY
    A shared export with ZERO importers is a related defect (six exist today:
    htp1440pHeroStyles, htp4kHeroStyles, adminConfigCardStyles,
    adminConfigGridStyles, forgeOverlayStyles, forgeConsoleStyles). It is NOT
    gated, because three of those have components that grew their own DIVERGED
    version of the same class names — converging them is a design decision, not
    a mechanical fix, and a gate that demands a design decision gets allowlisted
    into silence. Reported in docs, not enforced here.

Exit code: 0 = clean, 1 = violations.
"""

from __future__ import annotations

import hashlib
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "src"

WINDOW = 12

# A rule opener: `.foo {`, `.foo:hover {`, `.a, .b {`. This is the line that
# turns a run of declarations into a copied RULE.
SELECTOR = re.compile(r"^\.[a-zA-Z][\w-]*[^{}]*\{$")

# Empty, and meant to stay that way. An entry would be a record of known debt
# with a plan attached — never a way to make a red build green. The last
# occupant (DraftRosterPanel) was cleared rather than kept.
ALLOWLIST: dict[tuple[str, str], str] = {}


def normalise(text: str) -> tuple[list[str], list[int]]:
    """Whitespace-collapsed content lines, plus their original line numbers.

    Comments are dropped: a copied rule stays a copied rule when the comment
    above it is reworded, and keeping them would let a rename hide a copy.
    """
    lines: list[str] = []
    numbers: list[int] = []
    for number, raw in enumerate(text.split("\n"), 1):
        stripped = re.sub(r"\s+", " ", raw).strip()
        if not stripped or stripped.startswith(("//", "*", "/*")):
            continue
        lines.append(stripped)
        numbers.append(number)
    return lines, numbers


def windows_with_a_selector(lines: list[str], numbers: list[int]):
    """Every WINDOW-line window that opens at least one rule."""
    for start in range(len(lines) - WINDOW):
        window = lines[start : start + WINDOW]
        if not any(SELECTOR.match(line) for line in window):
            continue
        yield hashlib.md5("\n".join(window).encode()).hexdigest(), numbers[start]


def main() -> int:
    sources = sorted(ROOT.rglob("*.ts"))
    text = {path: path.read_text(encoding="utf-8") for path in sources}
    shared = [path for path in sources if path.name.endswith("-styles.ts")]

    owned: dict[str, list[tuple[Path, int]]] = defaultdict(list)
    for module in shared:
        lines, numbers = normalise(text[module])
        for digest, line in windows_with_a_selector(lines, numbers):
            owned[digest].append((module, line))

    hits: dict[tuple[Path, Path], list[tuple[int, int]]] = defaultdict(list)
    for component in sources:
        if component in shared:
            continue
        lines, numbers = normalise(text[component])
        for digest, line in windows_with_a_selector(lines, numbers):
            for module, module_line in owned.get(digest, []):
                # Naming the module anywhere — an import, or a comment saying why
                # not — counts as knowing about it.
                if module.stem in text[component]:
                    continue
                hits[(component, module)].append((line, module_line))

    violations = []
    for (component, module), places in sorted(hits.items()):
        key = (str(component.relative_to(ROOT)), module.name)
        if key in ALLOWLIST:
            continue
        first_component_line, first_module_line = places[0]
        violations.append(
            f"  {component.relative_to(ROOT.parent)}:{first_component_line}\n"
            f"      re-types {len(places)} window(s) of {module.name} "
            f"(first at {module.name}:{first_module_line}) without naming it"
        )

    if violations:
        print("ERROR: a component re-types CSS a shared module already owns:\n")
        print("\n".join(violations))
        print(
            "\nImport the module instead and delete the local copy:\n"
            "  static styles = [theSharedStyles, css`… only what this component adds …`]\n"
            "\nIf the shared rule is ALMOST right, change the shared module — that is what\n"
            "it is for. If it is genuinely a different thing that happens to share a class\n"
            "name, rename your class; two meanings on one selector will collide in a future\n"
            "refactor.\n"
            "\nDo not silence this by adding an ALLOWLIST entry. An entry is a record of\n"
            "known debt with a plan attached, not a way to make a red build green.\n"
        )
        return 1

    checked = len(shared)
    print(f"PASS: no component re-types a shared style module ({checked} modules, {len(ALLOWLIST)} known debt).")
    return 0


if __name__ == "__main__":
    sys.exit(main())

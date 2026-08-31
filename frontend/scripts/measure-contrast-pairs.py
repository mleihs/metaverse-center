#!/usr/bin/env python3
"""measure-contrast-pairs.py — WCAG AA contrast of COMPONENT pairs, not palette pairs.

WHY THIS EXISTS, next to lint-color-contrast.sh
    That gate is not broken, and this does not replace it. It checks 13 pairs
    of BASE TOKENS read from `_colors.css` — the palette's own sanity. It can
    report PASS while every component in the platform is unreadable, because a
    component almost never puts a raw token on a raw token: it writes
    `color-mix(in srgb, var(--color-text-muted) 60%, transparent)` on a ground
    the gate never sees. A measured example: the nav context line came out at
    2.80:1 against a sunken ground while the gate reported PASS on all 13.

    So: that gate answers "is the palette sound?", this one answers "can you
    read the interface?". Both questions are real. Only the second is in the
    handoff's definition of done.

WHAT IT DOES
    1. Resolves the token graph from src/styles/tokens/ (var() chains and
       color-mix() included, recursively).
    2. Parses the css`...` blocks of every component into rules.
    3. For each rule that sets `color`, finds the GROUND it sits on — same
       rule first, then the nearest enclosing selector in the same file, then
       :host, then --color-surface. The assumed ground is PRINTED with every
       finding, because in shadow DOM the ground is often not the box next to
       it, and a pair measured against the wrong ground is worse than no
       measurement.
    4. Picks the threshold from the rule's own font-size and weight:
       3.0 for large text (>=24px, or >=18.66px bold), else 4.5.

WHAT IT DELIBERATELY DOES NOT DO
    It does not guess across files, and it does not follow a token a component
    inherits from an ancestor component. Those pairs are reported as SKIP with
    the reason, never silently dropped — an unmeasured pair must not look like
    a passing one.

Usage:  python3 scripts/measure-contrast-pairs.py [--threshold-only] [path ...]
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TOKENS_DIR = ROOT / "src" / "styles" / "tokens"

# ---------------------------------------------------------------------------
# Token graph
# ---------------------------------------------------------------------------

TOKEN_DECL = re.compile(r"--([a-z0-9_-]+)\s*:\s*([^;]+);")


def load_tokens() -> dict[str, str]:
    """First definition wins: later blocks are theme and media overrides, and
    the brutalist default at the top of :root is the case we measure."""
    tokens: dict[str, str] = {}
    for f in sorted(TOKENS_DIR.glob("*.css")):
        for name, value in TOKEN_DECL.findall(f.read_text(encoding="utf-8")):
            tokens.setdefault(name, value.strip())
    return tokens


# ---------------------------------------------------------------------------
# Colour arithmetic
# ---------------------------------------------------------------------------

HEX = re.compile(r"^#([0-9a-fA-F]{3,8})$")


def hex_to_rgba(h: str) -> tuple[float, float, float, float] | None:
    m = HEX.match(h.strip())
    if not m:
        return None
    s = m.group(1)
    if len(s) == 3:
        s = "".join(c * 2 for c in s)
    if len(s) == 4:
        s = "".join(c * 2 for c in s)
    if len(s) == 6:
        return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16), 1.0)
    if len(s) == 8:
        return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16), int(s[6:8], 16) / 255)
    return None


def split_top_level(s: str, sep: str = ",") -> list[str]:
    """Split on `sep` but not inside parentheses — color-mix nests."""
    out, depth, cur = [], 0, ""
    for ch in s:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        if ch == sep and depth == 0:
            out.append(cur)
            cur = ""
        else:
            cur += ch
    out.append(cur)
    return [p.strip() for p in out if p.strip()]


class Unresolved(Exception):
    """A value this tool refuses to guess at."""


def resolve(value: str, tokens: dict[str, str], depth: int = 0):
    """Resolve a CSS colour to (r, g, b, a). Raises Unresolved rather than
    returning a plausible wrong answer."""
    value = value.strip()
    if depth > 12:
        raise Unresolved("var() chain too deep")
    if value == "transparent":
        return (0.0, 0.0, 0.0, 0.0)
    if value in ("currentColor", "inherit", "initial", "unset", "none"):
        raise Unresolved(value)

    rgba = hex_to_rgba(value)
    if rgba:
        return rgba

    m = re.match(r"^var\(\s*(--[a-z0-9_-]+)\s*(?:,\s*(.+))?\)$", value, re.I)
    if m:
        name = m.group(1)[2:]
        if name in tokens:
            try:
                return resolve(tokens[name], tokens, depth + 1)
            except Unresolved:
                pass
        if m.group(2):
            return resolve(m.group(2), tokens, depth + 1)
        raise Unresolved(f"unknown token --{name}")

    m = re.match(r"^color-mix\(\s*in\s+srgb\s*,(.+)\)$", value, re.I | re.S)
    if m:
        parts = split_top_level(m.group(1))
        if len(parts) != 2:
            raise Unresolved("color-mix with unusual arity")
        def parse_part(p: str):
            pm = re.match(r"^(.*?)\s+([0-9.]+)%$", p.strip(), re.S)
            if pm:
                return pm.group(1), float(pm.group(2)) / 100
            return p.strip(), None
        c1, p1 = parse_part(parts[0])
        c2, p2 = parse_part(parts[1])
        if p1 is None and p2 is None:
            p1 = p2 = 0.5
        elif p1 is None:
            p1 = 1 - p2
        elif p2 is None:
            p2 = 1 - p1
        total = p1 + p2
        if total <= 0:
            raise Unresolved("color-mix percentages sum to zero")
        p1, p2 = p1 / total, p2 / total
        r1 = resolve(c1, tokens, depth + 1)
        r2 = resolve(c2, tokens, depth + 1)
        return tuple(r1[i] * p1 + r2[i] * p2 for i in range(4))

    m = re.match(r"^rgba?\(([^)]+)\)$", value, re.I)
    if m:
        nums = [n.strip() for n in re.split(r"[,/\s]+", m.group(1)) if n.strip()]
        if len(nums) >= 3:
            try:
                r, g, b = (float(n) for n in nums[:3])
                a = float(nums[3]) if len(nums) > 3 else 1.0
                return (r, g, b, a)
            except ValueError:
                raise Unresolved("non-numeric rgb()")
    raise Unresolved(f"unparsed value {value[:48]!r}")


def composite(fg, bg):
    """Paint fg over an opaque bg."""
    a = fg[3]
    return tuple(fg[i] * a + bg[i] * (1 - a) for i in range(3)) + (1.0,)


def luminance(rgb) -> float:
    def chan(c):
        c = max(0.0, min(255.0, c)) / 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (chan(x) for x in rgb[:3])
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def ratio(fg, bg) -> float:
    l1, l2 = luminance(fg), luminance(bg)
    hi, lo = max(l1, l2), min(l1, l2)
    return (hi + 0.05) / (lo + 0.05)


# ---------------------------------------------------------------------------
# Component CSS parsing
# ---------------------------------------------------------------------------

# A rule is `selector { decls }`. Nested at-rules (@media, @supports) are
# flattened: their inner rules are measured too, which is the point — an
# override inside `@media (max-width: 640px)` is where a colour often changes.
RULE = re.compile(r"([^{}@;]+)\{([^{}]*)\}", re.S)
DECL = re.compile(r"(--?[a-z_][a-z0-9_-]*|[a-z-]+)\s*:\s*([^;]+)", re.I)


def css_blocks(source: str) -> list[str]:
    """Extract the contents of every css`...` tagged template.

    A backtick inside a CSS COMMENT ends the template as far as the JS parser
    is concerned; this project has been bitten by that before. We take the same
    naive view the parser does, so what we measure is what ships."""
    out, i = [], 0
    while True:
        j = source.find("css`", i)
        if j < 0:
            return out
        k = source.find("`", j + 4)
        if k < 0:
            return out
        out.append(source[j + 4 : k])
        i = k + 1


def parse_rules(block: str) -> list[tuple[str, dict[str, str], int]]:
    """-> [(selector, {prop: value}, offset_in_block)]"""
    rules = []
    for m in RULE.finditer(block):
        sel = " ".join(m.group(1).split())
        if not sel or sel.startswith("@") or sel.startswith("from") or sel.startswith("to"):
            continue
        decls = {}
        for prop, val in DECL.findall(m.group(2)):
            decls[prop.strip().lower()] = val.strip()
        if decls:
            rules.append((sel, decls, m.start()))
    return rules


BG_PROPS = ("background-color", "background")


def rule_background(decls: dict[str, str]) -> str | None:
    for p in BG_PROPS:
        if p in decls:
            v = decls[p]
            # `background: url(...) center/cover` and gradients carry no single
            # colour we may honestly measure against.
            if "gradient" in v or "url(" in v:
                return None
            if v.strip() in ("transparent", "none", "inherit", "initial", "unset"):
                return None
            return split_top_level(v, " ")[0] if " " in v and not v.startswith("color-mix") else v
    return None


def font_px(decls: dict[str, str], tokens: dict[str, str]) -> float | None:
    v = decls.get("font-size")
    if not v:
        return None
    m = re.match(r"^var\(\s*(--[a-z0-9_-]+)", v, re.I)
    if m:
        v = tokens.get(m.group(1)[2:], "")
    m = re.match(r"^([0-9.]+)px", v.strip())
    if m:
        return float(m.group(1))
    m = re.match(r"^([0-9.]+)rem", v.strip())
    if m:
        return float(m.group(1)) * 16
    return None


def is_bold(decls: dict[str, str], tokens: dict[str, str]) -> bool:
    v = decls.get("font-weight", "")
    m = re.match(r"^var\(\s*(--[a-z0-9_-]+)", v, re.I)
    if m:
        v = tokens.get(m.group(1)[2:], "")
    v = v.strip()
    if v in ("bold", "bolder"):
        return True
    try:
        return int(v) >= 700
    except ValueError:
        return False


def threshold_for(decls: dict[str, str], tokens: dict[str, str]) -> tuple[float, str]:
    """WCAG AA: 3:1 for large text (>=24px, or >=18.66px bold), else 4.5:1.
    Reported WITH the size, because a 3.2:1 finding is a failure or not
    depending on it — a list without sizes is not usable."""
    px = font_px(decls, tokens)
    if px is None:
        return 4.5, "size unknown, assumed normal"
    if px >= 24 or (px >= 18.66 and is_bold(decls, tokens)):
        return 3.0, f"{px:.0f}px large"
    return 4.5, f"{px:.0f}px normal"


def styled_element(sel: str) -> str:
    """The compound selector actually being painted.

    `:host([recovering]) .scan-status__label` styles the label, not the host;
    its ground is the label's container. Matching on the whole string sent the
    lookup to `:host` and measured text against an overlay backdrop."""
    first = sel.split(",")[0].strip()
    parts = [p for p in re.split(r"\s*[>+~]\s*|\s+", first) if p]
    return parts[-1] if parts else first


def enclosing_ground(sel: str, rules, tokens, self_idx: int) -> tuple[str, str]:
    """Find the ground a rule sits on. Order matters and is reported.

    1. the rule's own background
    2. the longest OTHER selector in the same block that is a prefix of this
       one (`.card` grounds `.card__title`; `.card__title` is BEM-nested by
       name even when it is not nested in the CSS)
    3. :host
    4. --color-surface, the page itself
    """
    own = rule_background(rules[self_idx][1])
    if own:
        return own, "own background"

    target = styled_element(sel)
    best, best_len = None, -1
    for i, (osel, odecls, _) in enumerate(rules):
        if i == self_idx:
            continue
        bg = rule_background(odecls)
        if not bg:
            continue
        base = styled_element(osel)
        if not base or base.startswith(":host") or base == target:
            continue
        # A prefix is not a parent. `.selector__chips-label` starts with the
        # characters of `.selector__chip`, but it is a different class, and
        # grounding the label on the chip measured secondary text against an
        # amber fill it never sits on. In BEM a real descendant continues with
        # `__` (element) or `--` (modifier); anything else is a name collision.
        if target != base and target.startswith(base):
            rest = target[len(base):]
            if not (rest.startswith("__") or rest.startswith("--")
                    or rest.startswith(":") or rest.startswith(".")):
                continue
        if target.startswith(base) and len(base) > best_len:
            best, best_len = (bg, base), len(base)
    if best:
        return best[0], f"from `{best[1]}`"

    for osel, odecls, _ in rules:
        # ONLY the host itself. `:host([recovering]) .scan-overlay::before`
        # also starts with ":host", and it is a sweep line - taking its
        # background as the component ground measured six labels against an
        # animated amber bar they never touch. The host is being styled only
        # when nothing follows it and no pseudo-element is named.
        if not osel.startswith(":host") or "::" in osel:
            continue
        if styled_element(osel).startswith(":host"):
            bg = rule_background(odecls)
            if bg:
                return bg, "from :host"
    return "var(--color-surface)", "page default"


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------

SKIP_SELECTORS = re.compile(r"::(before|after|placeholder|selection|-webkit)", re.I)


def shared_tier3(root: Path) -> dict[str, str]:
    """Tier-3 tokens declared by the SHARED style modules.

    `--_phosphor-dim` and its family live in `shared/terminal-theme-styles.ts`
    and are composed into ~40 components; reading only each component's own
    `:host` left 88 pairs unmeasurable. Restricted to `components/shared/`
    ON PURPOSE: those modules exist to be composed, so borrowing their values
    is what the cascade does. Scanning every component instead would collide —
    `--_phosphor-dim` is ALSO defined, differently, in BureauTerminal.ts and
    DungeonChronicle.ts, and a token with two values is not a measurement.
    A name defined twice among the shared modules is dropped for that reason.
    """
    seen: dict[str, set] = {}
    for f in sorted((root / "src" / "components" / "shared").rglob("*.ts")):
        for block in css_blocks(f.read_text(encoding="utf-8")):
            for sel, decls, _ in parse_rules(block):
                if not sel.startswith(":host"):
                    continue
                for prop, val in decls.items():
                    if prop.startswith("--"):
                        seen.setdefault(prop[2:], set()).add(val)
    return {k: next(iter(v)) for k, v in seen.items() if len(v) == 1}


def local_tokens(rules, tokens: dict[str, str]) -> dict[str, str]:
    """Tier-3 tokens a component declares for itself.

    The 3-tier system puts `--_accent`, `--_phosphor-dim` and friends in the
    component's own `:host`. Reading only the global palette leaves exactly
    the layer the designs are actually built on unmeasured — 88 pairs hung on
    `--_phosphor-dim` alone. Component definitions SHADOW the global ones,
    which is what the cascade does too."""
    local = dict(tokens)
    for sel, decls, _ in rules:
        if not sel.startswith(":host"):
            continue
        for prop, val in decls.items():
            if prop.startswith("--"):
                local[prop[2:]] = val
    return local


def scan_file(path: Path, tokens: dict[str, str]):
    findings, skips = [], []
    source = path.read_text(encoding="utf-8")
    for block in css_blocks(source):
        rules = parse_rules(block)
        tokens_here = local_tokens(rules, tokens)
        for idx, (sel, decls, off) in enumerate(rules):
            if "color" not in decls:
                continue
            if SKIP_SELECTORS.search(sel):
                continue
            fg_raw = decls["color"]
            # `color: transparent` is concealment on purpose - a redaction bar
            # over a classified lore section, a caret block, a clipped glyph.
            # Reporting it as a contrast failure would bury the real findings
            # under the one case where unreadable IS the requirement.
            if fg_raw.strip() in ("transparent", "inherit", "currentColor"):
                skips.append((path, sel, f"foreground: {fg_raw.strip()} (deliberate)"))
                continue
            bg_raw, ground_via = enclosing_ground(sel, rules, tokens_here, idx)
            try:
                fg = resolve(fg_raw, tokens_here)
            except Unresolved as e:
                skips.append((path, sel, f"foreground: {e}"))
                continue
            try:
                bg = resolve(bg_raw, tokens_here)
            except Unresolved as e:
                skips.append((path, sel, f"ground: {e}"))
                continue
            # A translucent ground is painted on the page itself.
            if bg[3] < 1.0:
                bg = composite(bg, resolve("var(--color-surface)", tokens_here))
            if fg[3] < 1.0:
                fg = composite(fg, bg)
            need, size_note = threshold_for(decls, tokens_here)
            r = ratio(fg, bg)
            # An exact 1.00 on an ASSUMED ground is the assumption talking,
            # not a finding: nobody writes invisible text on the page. The
            # real case behind it is a child painted on a parent this tool
            # cannot see (`.selector__chip-remove` sits inside an amber chip
            # that BEM naming does not reveal). Report it as unmeasured -
            # an unmeasured pair must never look like a failing one, and it
            # must never look like a passing one either.
            if r < 1.005 and ground_via in ("page default", "from :host"):
                skips.append((path, sel, f"ground: {ground_via} is a guess (fg == bg)"))
                continue
            if r < need:
                line = source[: source.find(block)].count("\n") + block[:off].count("\n") + 1
                findings.append(
                    {
                        "file": path, "line": line, "sel": sel,
                        "fg": fg_raw.strip(), "bg": bg_raw.strip(),
                        "ratio": r, "need": need,
                        "size": size_note, "ground_via": ground_via,
                    }
                )
    return findings, skips


def main(argv: list[str]) -> int:
    args = [a for a in argv[1:] if not a.startswith("--")]
    tokens = load_tokens()
    # Shared Tier-3 first, global palette wins over it on a name clash.
    tokens = {**shared_tier3(ROOT), **tokens}
    targets: list[Path] = []
    roots = [ROOT / a for a in args] if args else [ROOT / "src" / "components"]
    for r in roots:
        targets.extend(sorted(r.rglob("*.ts")) if r.is_dir() else [r])

    all_findings, all_skips = [], []
    for t in targets:
        f, s = scan_file(t, tokens)
        all_findings.extend(f)
        all_skips.extend(s)

    all_findings.sort(key=lambda x: x["ratio"])
    for f in all_findings:
        try:
            rel = f["file"].relative_to(ROOT)
        except ValueError:
            rel = f["file"]
        print(f"{f['ratio']:5.2f}:1  need {f['need']}  {rel}:{f['line']}  {f['sel']}")
        print(f"           fg {f['fg']}")
        same = "  [fg == bg: likely a decorative block, not text]" if f["ratio"] < 1.005 else ""
        print(f"           bg {f['bg']}   ({f['ground_via']}, {f['size']}){same}")

    print()
    print(f"{len(all_findings)} pair(s) below WCAG AA in {len(targets)} file(s).")
    print(f"{len(all_skips)} pair(s) not measurable (reported, never assumed to pass).")
    return 1 if all_findings else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

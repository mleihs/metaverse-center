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


COMMENT = re.compile(r"/\*.*?\*/", re.S)


def strip_comments(block: str) -> str:
    """Blank out comments BEFORE parsing, keeping the line count intact.

    Stripping them from the selector afterwards is not enough, and the
    self-check found both reasons within minutes of existing:

      * the rule regex stops at `;`, and a comment containing one — „Hand-
        computed; independently measured…" — cuts the rule in half. What
        reaches the selector is the TAIL of a comment with no `/*` in it, so
        no amount of stripping there can recognise it.
      * `lint-color-ok: a control value` inside a comment parses as a
        declaration, because it has the shape of one.

    Newlines are preserved so reported line numbers still point at the rule."""
    return COMMENT.sub(lambda m: "\n" * m.group(0).count("\n"), block)


def parse_rules(block: str) -> list[tuple[str, dict[str, str], int]]:
    """-> [(selector, {prop: value}, offset_in_block)]"""
    block = strip_comments(block)
    rules = []
    for m in RULE.finditer(block):
        sel = " ".join(m.group(1).split())
        if not sel:
            continue
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


def ground_chain(sel: str, rules, tokens, self_idx: int) -> list[tuple[str, str]]:
    """Every ground under this rule, nearest first.

    One layer is not enough. The nav bar stacks three: `:host` paints
    `--color-surface-sunken`, the active tab paints `--color-surface` on top,
    and the selection tint is a `color-mix(… 6%, transparent)` over THAT. A
    tool that finds only the nearest and composites it straight onto the page
    lands on a ground that is too light and reports a value that is too GOOD —
    the friendlier error, and still an error.

    So: walk outwards, collecting each background, and let the caller
    composite down the stack until it reaches something opaque."""
    chain: list[tuple[str, str]] = []
    own = rule_background(rules[self_idx][1])
    if own:
        chain.append((own, "own background"))

    target = styled_element(sel)
    ancestors: list[tuple[int, str, str]] = []
    for i, (osel, odecls, _) in enumerate(rules):
        if i == self_idx:
            continue
        bg = rule_background(odecls)
        if not bg:
            continue
        base = styled_element(osel)
        if not base or base.startswith(":host") or base == target:
            continue
        if target != base and target.startswith(base):
            rest = target[len(base):]
            if not (rest.startswith("__") or rest.startswith("--")
                    or rest.startswith(":") or rest.startswith(".")):
                continue
            ancestors.append((len(base), bg, f"from `{base}`"))
    # Longest prefix is the nearest ancestor; shortest is the outermost.
    for _, bg, via in sorted(ancestors, key=lambda x: -x[0]):
        chain.append((bg, via))

    for osel, odecls, _ in rules:
        if not osel.startswith(":host") or "::" in osel:
            continue
        if styled_element(osel).startswith(":host"):
            bg = rule_background(odecls)
            if bg:
                chain.append((bg, "from :host"))
                break

    chain.append(("var(--color-surface)", "page default"))
    return chain


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


# ---------------------------------------------------------------------------
# Themes — the same file can pass in dark and fail in light
# ---------------------------------------------------------------------------

PRESETS_FILE = ROOT / "src" / "services" / "theme-presets.ts"
THEME_SERVICE_FILE = ROOT / "src" / "services" / "ThemeService.ts"
PRESET_BLOCK = re.compile(r"^  '?([a-z0-9-]+)'?:\s*\{(.*?)^  \},", re.S | re.M)
PRESET_ENTRY = re.compile(r"([a-z0-9_]+):\s*'(#[0-9a-fA-F]{3,8})'")
TOKEN_MAP_BLOCK = re.compile(r"THEME_TOKEN_MAP[^=]*=\s*\{(.*?)^\};", re.S | re.M)
TOKEN_MAP_ENTRY = re.compile(r"([a-z0-9_]+):\s*'(--[a-z0-9-]+)'")


def theme_token_map() -> dict:
    """The setting-key → CSS-token map, READ from ThemeService.

    Rebuilding it here as a snake_case-to-kebab-case rule would be wrong twice
    over, and both were caught only by reading the real thing:

        color_background  ->  --color-surface          (not --color-background)
        color_surface     ->  --color-surface-RAISED   (not --color-surface)
        color_text        ->  --color-text-primary     (not --color-text)
        color_secondary   ->  --color-info
        color_accent      ->  --color-warning

    A tool that guesses at this mapping measures a palette nobody ships.
    """
    if not THEME_SERVICE_FILE.exists():
        return {}
    m = TOKEN_MAP_BLOCK.search(THEME_SERVICE_FILE.read_text(encoding="utf-8"))
    if not m:
        return {}
    return {k: v[2:] for k, v in TOKEN_MAP_ENTRY.findall(m.group(1))}


# A view that pins the platform palette on ITSELF at runtime makes its whole
# subtree immune to simulation themes:
#
#     themeService.applyConfig(PLATFORM_DARK_CONFIG, this);
#
# Two do it today (dungeon/DungeonView.ts, drift/DriftView.ts). Measuring their
# children against a light theme reports failures that cannot happen — the
# child inherits the pinned dark palette across the shadow boundary, and no
# amount of reading the child's CSS reveals that. Derived from the call, not
# from a hardcoded list, so a third view that does the same is covered the day
# it is written.
PIN_CALL = re.compile(r"applyConfig\(\s*PLATFORM_DARK_CONFIG\s*,\s*this\s*\)")


def theme_immune_dirs(root: Path) -> list:
    out = []
    for f in (root / "src" / "components").rglob("*.ts"):
        try:
            if PIN_CALL.search(f.read_text(encoding="utf-8")):
                out.append(f.parent)
        except OSError:
            continue
    return out


def is_theme_immune(path: Path, dirs: list) -> bool:
    return any(d == path.parent or d in path.parents for d in dirs)


def theme_overrides() -> dict:
    """Token overrides per simulation theme preset.

    WHY THIS EXISTS: the palette in `_colors.css` is the PLATFORM default, and
    it is dark. Ten simulation themes overwrite those tokens at runtime on the
    shell element, and FOUR of them are light. Measuring only the defaults sees
    half the product — and worse, the half where a mistake points the other
    way: mixing a dim colour toward its background LIFTS contrast on a dark
    ground and LOWERS it on a light one. Six "repairs" were made against the
    dark default and were wrong in every light theme.

    The preset keys are snake_case (`color_text_muted`); the tokens are
    kebab-case (`--color-text-muted`). Same mapping ThemeService applies.
    """
    if not PRESETS_FILE.exists():
        return {}
    tmap = theme_token_map()
    if not tmap:
        return {}
    src = PRESETS_FILE.read_text(encoding="utf-8")
    out: dict[str, dict[str, str]] = {}
    for name, body in PRESET_BLOCK.findall(src):
        entries = {}
        for k, v in PRESET_ENTRY.findall(body):
            token = tmap.get(k)
            if token:
                entries[token] = v
        if entries:
            out[name] = entries
    return out


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


IMPORT_RE = re.compile(r"import\s*\{([^}]*)\}\s*from\s*['\"]([^'\"]+)['\"]")
STYLES_ARRAY_RE = re.compile(r"static\s+styles\s*=\s*\[(.*?)\]", re.S)


def composed_tokens(path: Path, source: str, tokens: dict[str, str]) -> dict[str, str]:
    """Tier-3 tokens from the style modules this component COMPOSES.

    `static styles = [terminalTokens, dungeonLegibility, css`...`]` is a
    cascade: each module's `:host` block can redefine what an earlier one set,
    and the component's own block wins last. Reading only `components/shared/`
    missed this entirely — a legibility overlay that lives beside the
    components it corrects (`dungeon/dungeon-legibility.ts`) was invisible,
    so the tool kept reporting the OLD value and called a fixed file broken.
    Following the array in ITS OWN ORDER is the only honest way to read it.
    """
    m = STYLES_ARRAY_RE.search(source)
    if not m:
        return tokens
    order = [x.strip() for x in m.group(1).split(",")]
    order = [x for x in order if re.fullmatch(r"[A-Za-z_$][\w$]*", x)]
    if not order:
        return tokens

    source_of: dict[str, str] = {}
    for names, mod in IMPORT_RE.findall(source):
        for n in names.split(","):
            n = n.strip().split(" as ")[-1].strip()
            if n:
                source_of[n] = mod

    out = dict(tokens)
    for ident in order:
        mod = source_of.get(ident)
        if not mod or not mod.startswith("."):
            continue
        target = (path.parent / mod).resolve()
        cand = target.with_suffix(".ts") if target.suffix in ("", ".js") else target
        if str(cand).endswith(".js.ts"):
            cand = Path(str(cand)[:-6] + ".ts")
        if not cand.exists():
            continue
        try:
            mod_src = cand.read_text(encoding="utf-8")
        except OSError:
            continue
        for block in css_blocks(mod_src):
            for sel, decls, _ in parse_rules(block):
                if not sel.startswith(":host"):
                    continue
                for prop, val in decls.items():
                    if prop.startswith("--"):
                        out[prop[2:]] = val
    return out


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


def hidden_from_readers(source: str, selector: str) -> bool:
    """Does the element this rule paints carry aria-hidden="true"?

    Suggested from a real run: after a round of fixes, the last remaining
    finding in three directories was a 64px watermark at 4% opacity, and the
    element was already `aria-hidden="true"`. The tool could only guess at that
    ("fg == bg: likely a decorative block"). Reading the markup turns the guess
    into a fact — and it is the honest way to drop such a pair, rather than an
    allowlist entry that outlives its reason.

    Deliberately narrow: the class must appear in the SAME tag as the attribute.
    Inheriting hiddenness from an ancestor is real in the DOM but not decidable
    from a template without building the tree, and a wrong SKIP is worse than a
    finding a human dismisses in two seconds.
    """
    cls = selector.split(",")[0].strip().split()[-1] if selector.strip() else ""
    for token in (":", "::"):
        if token in cls:
            cls = cls.split(token)[0]
    if not cls.startswith(".") or len(cls) < 2:
        return False
    name = re.escape(cls[1:])
    # A word boundary is not a class boundary: `\bicon\b` also matches
    # class="icon-large", and that mismatch silently skipped pairs that were
    # never hidden. A class name ends where a non-name character does.
    edge = r"(?<![-\w])" + name + r"(?![-\w])"
    tag = (
        r"<[^>]*aria-hidden=[\"']true[\"'][^>]*class=[^>]*" + edge
        + r"|<[^>]*class=[^>]*" + edge + r"[^>]*aria-hidden=[\"']true[\"']"
    )
    return re.search(tag, source, re.S) is not None


def scan_file(path: Path, tokens: dict[str, str]):
    findings, skips = [], []
    source = path.read_text(encoding="utf-8")
    composed = composed_tokens(path, source, tokens)
    # A pure style MODULE (no `static styles` array of its own) is composed
    # into components that may redefine the very tokens it paints with. It is
    # measured here with the shared defaults, which is the worst case but not
    # necessarily the shipped one - so its findings carry that caveat instead
    # of pretending to a certainty the file cannot have.
    standalone_module = STYLES_ARRAY_RE.search(source) is None
    for block in css_blocks(source):
        rules = parse_rules(block)
        tokens_here = local_tokens(rules, composed)
        for idx, (sel, decls, off) in enumerate(rules):
            if "color" not in decls:
                continue
            if SKIP_SELECTORS.search(sel):
                continue
            if hidden_from_readers(source, sel):
                skips.append((path, sel, 'aria-hidden="true" in the markup'))
                continue
            fg_raw = decls["color"]
            # `color: transparent` is concealment on purpose - a redaction bar
            # over a classified lore section, a caret block, a clipped glyph.
            # Reporting it as a contrast failure would bury the real findings
            # under the one case where unreadable IS the requirement.
            if fg_raw.strip() in ("transparent", "inherit", "currentColor"):
                skips.append((path, sel, f"foreground: {fg_raw.strip()} (deliberate)"))
                continue
            chain = ground_chain(sel, rules, tokens_here, idx)
            try:
                fg = resolve(fg_raw, tokens_here)
            except Unresolved as e:
                skips.append((path, sel, f"foreground: {e}"))
                continue

            # Composite DOWN the stack: each translucent layer is painted on
            # the one below it, until something opaque carries the result.
            # A Tier-3 ground this file never declares - not in its own
            # `:host`, not in a module it composes, not in the platform
            # palette - comes from an ANCESTOR component across the shadow
            # boundary. Resolving the global value there does not produce an
            # unknown, it produces a WRONG number, and a wrong number reads
            # like a finding. The header of this file says an unmeasured pair
            # must not look like a passing one; it must not look like a
            # failing one either.
            first = chain[0][0]
            fm = re.match(r"^var\(\s*(--[a-z0-9_-]+)", first)
            if fm and fm.group(1)[2:] not in tokens_here:
                skips.append(
                    (path, sel, f"ground {fm.group(1)} is declared by an ancestor component")
                )
                continue

            bg = None
            bg_raw, ground_via = chain[0][0], chain[0][1]
            layers = []
            for raw, via in chain:
                try:
                    layers.append((resolve(raw, tokens_here), raw, via))
                except Unresolved:
                    continue
            if not layers:
                skips.append((path, sel, f"ground: none of {len(chain)} layers resolvable"))
                continue
            bg_raw, ground_via = layers[0][1], layers[0][2]
            depth = 0
            for colour, raw, via in layers:
                depth += 1
                if bg is None:
                    bg = colour
                else:
                    bg = composite(bg, colour)
                if bg[3] >= 1.0:
                    break
            if bg[3] < 1.0:
                bg = composite(bg, (10.0, 10.0, 10.0, 1.0))
            if depth > 1:
                ground_via += f" +{depth - 1} layer(s) below"
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
                        "module": standalone_module,
                    }
                )
    return findings, skips


# ---------------------------------------------------------------------------
# Self-check — the values this tool must reproduce
# ---------------------------------------------------------------------------
#
# On 2026-08-31 four sessions found twenty defects of one shape between them,
# and every one produced a PLAUSIBLE OUTPUT instead of an error. What caught
# them was almost never a compiler, a lint gate or a review: it was a second,
# independently known value the result had to agree with.
#
# That knowledge lived in people. Here it lives in the file, and it is checked
# on demand rather than remembered.
#
# NEVER adjust a number here to make the check pass. If the tool and the
# fixture disagree, exactly one of them is wrong and it is not automatically
# the fixture.

CONTROL_FILE = "scripts/fixtures/contrast-controls.ts"

# (selector, expected ratio, tolerance)
CONTROL_EXPECT = [
    (".control-hex-on-sunken", 2.72, 0.02),
    (".control-translucent-fg", 1.61, 0.02),
    (".tab__tint__label", 2.09, 0.02),
]

# Selectors that must stay SILENT. A tool that reports everything is as
# useless as one that reports nothing.
CONTROL_SILENT = [".control-passes", ".control-large-text"]


def self_check(tokens) -> int:
    path = ROOT / CONTROL_FILE
    if not path.exists():
        print(f"FAIL: control fixture missing at {CONTROL_FILE}")
        return 1

    findings, skips = scan_file(path, tokens)
    by_sel = {f["sel"]: f for f in findings}
    bad = 0

    for sel, want, tol in CONTROL_EXPECT:
        f = by_sel.get(sel)
        if f is None:
            print(f"FAIL  {sel}: expected {want}:1, the tool reported nothing at all")
            bad += 1
            continue
        got = f["ratio"]
        if abs(got - want) > tol:
            print(f"FAIL  {sel}: expected {want}:1, measured {got:.2f}:1")
            bad += 1
        else:
            print(f"ok    {sel}  {got:.2f}:1")

    for sel in CONTROL_SILENT:
        if sel in by_sel:
            print(f"FAIL  {sel}: must pass, but was reported at {by_sel[sel]['ratio']:.2f}:1")
            bad += 1
        else:
            print(f"ok    {sel}  silent, as it must be")

    # The layered control must also say HOW DEEP it had to go. A tool that
    # gets the right number by the wrong route is right by accident.
    layered = by_sel.get(".tab__tint__label")
    if layered and "layer(s) below" not in layered["ground_via"]:
        print("FAIL  .tab__tint__label: right number, wrong route — the ground "
              "chain did not report a layer below")
        bad += 1
    elif layered:
        print(f"ok    .tab__tint__label ground: {layered['ground_via']}")

    print()
    if bad:
        print(f"{bad} control(s) failed. The instrument has drifted; do not trust "
              "its other numbers until this passes.")
        return 1
    print(f"All {len(CONTROL_EXPECT) + len(CONTROL_SILENT) + 1} controls hold.")
    return 0


def run(targets, tokens):
    findings, skips = [], []
    for t in targets:
        f, s = scan_file(t, tokens)
        findings.extend(f)
        skips.extend(s)
    return findings, skips


PLAIN_TOKEN = re.compile(r"^var\(\s*(--color-[a-z0-9-]+)\s*\)$")


def palette_fault(fg_raw: str, bg_raw: str, tokens, need: float):
    """Is this failure the THEME's palette, or the component's composition?

    The distinction turns a list of hundreds into a list of worlds. If a rule
    puts one plain platform token on another plain platform token — say
    `--color-success` on `--color-surface` — then nothing about the component
    decides the outcome: the theme picked both values, and every component in
    the platform that pairs them fails identically. Repairing that at the call
    site would dodge the theme's intent in one place and leave it standing in
    ninety others.

    Anything else — a `color-mix`, a Tier-3 token, a literal — is a choice the
    component made, and the component is where it can be unmade.

    Measured origin: `--color-success` on `--color-surface` is 3.30:1 in
    brutalist, 3.15 in nordic-noir and 1.28 in deep-fried-horror (#00FF00 on
    #FFFF00). No component wrote those numbers.
    """
    fm, bm = PLAIN_TOKEN.match(fg_raw.strip()), PLAIN_TOKEN.match(bg_raw.strip())
    if not (fm and bm):
        return None

    # Two exclusions, because a wrong GROUND must never be dressed up as a
    # palette defect. A list of "the theme is broken" that contains this
    # tool's own mistakes is worse than no list: the reader cannot tell the
    # halves apart, and the real entries lose their authority with the false
    # ones.
    #
    # (a) The same token on itself is not a pairing anyone wrote. It means the
    #     ground resolution landed on the element's own colour.
    # (b) --color-text-inverse exists FOR an inverse ground: it is the label on
    #     a filled button, a solid badge, a primary chip. If the resolved
    #     ground is anything but --color-surface-inverse, the fill is what the
    #     text actually sits on and this tool did not see it. Ten pairs.
    if fm.group(1) == bm.group(1):
        return None
    if fm.group(1) == "--color-text-inverse" and bm.group(1) != "--color-surface-inverse":
        return None

    # (c) A palette pairing is TEXT or a STATUS colour on a SURFACE - the same
    #     shape lint-color-contrast.sh checks in its 13 base pairs. A surface
    #     token used as a foreground (`color: var(--color-surface-sunken)`) is
    #     a component painting something decorative; a border token used as a
    #     ground is a divider the ground walk stepped onto. Neither is a
    #     decision the theme's author made about legibility.
    fg_tok, bg_tok = fm.group(1), bm.group(1)
    fg_ok = fg_tok.startswith("--color-text-") or fg_tok in (
        "--color-primary", "--color-secondary", "--color-danger", "--color-success",
        "--color-warning", "--color-info", "--color-accent-amber",
        "--color-accent-green", "--color-epoch-influence",
    )
    bg_ok = bg_tok.startswith("--color-surface")
    if not (fg_ok and bg_ok):
        return None
    try:
        r = ratio(resolve(fg_raw, tokens), resolve(bg_raw, tokens))
    except Unresolved:
        return None
    return (fm.group(1), bm.group(1)) if r < need else None


STATUS_TOKEN = re.compile(
    r"--color-(primary|secondary|danger|success|warning|info"
    r"|accent-amber|accent-green|epoch-influence)\b"
)


def same_colour_tint(fg_raw: str, bg_raw: str):
    """Is the text the same status colour as the tint it sits on?

    A platform idiom, not a slip: 168 rules in 74 files paint a status colour
    on `color-mix(in srgb, <that same status colour> N%, …)`. On a near-black
    ground the tint stays dark and the text reads at 8:1. On a WHITE ground the
    tint becomes a pale wash of the same hue and the text lands at 1.0 - green
    on pale green.

    It is worth naming as its own kind because the obvious repair does not
    work. `--color-success-hover` (80 % base + 20 % text-primary) exists for
    exactly this direction and only lifts brutalist from 2.55 to 3.68 - still
    under AA. Reaching 4.5 means either a dedicated text-weight variant per
    status, or not tinting the ground with the colour the text is written in.
    Both are decisions about the design system, and neither belongs in the 74
    files that merely follow the idiom.
    """
    fm = STATUS_TOKEN.search(fg_raw)
    if not fm or "color-mix" not in bg_raw:
        return None
    bm = STATUS_TOKEN.search(bg_raw)
    if not bm or bm.group(1) != fm.group(1):
        return None
    return f"--color-{fm.group(1)}"


def report_themes(targets, base_tokens) -> int:
    """Measure every simulation theme and report per PAIR, not per theme.

    A finding printed ten times, once per theme, is ten findings to a reader
    and one to the code. So each pair is named once, with the themes it fails
    in — and the themes it PASSES in are the useful half of that line: a pair
    that fails everywhere is a wrong colour, a pair that fails only in the
    light themes is a wrong DIRECTION, and those want different repairs.
    """
    themes = theme_overrides()
    if not themes:
        print("No theme presets found; measured the platform default only.")
        return 1 if run(targets, base_tokens)[0] else 0

    # The platform default counts as a theme in its own right - it is what a
    # simulation with no saved settings gets.
    runs = {"(platform default)": base_tokens}
    for name, over in sorted(themes.items()):
        runs[name] = {**base_tokens, **over}

    # Files under a view that pins the platform palette at runtime are measured
    # ONCE, against the default - a simulation theme never reaches them.
    immune_dirs = theme_immune_dirs(ROOT)
    immune = [t for t in targets if is_theme_immune(t, immune_dirs)]
    themed = [t for t in targets if t not in set(immune)]
    if immune:
        print(f"# {len(immune)} file(s) under a view that pins PLATFORM_DARK_CONFIG "
              f"at runtime — measured against the default palette only.")
        print()

    per_pair: dict[tuple, dict] = {}
    for f in run(immune, base_tokens)[0]:
        key = (str(f["file"]), f["line"], f["sel"])
        e = per_pair.setdefault(key, {"f": f, "themes": [], "worst": 99.0})
        e["themes"].append("(pinned dark)")
        e["worst"] = min(e["worst"], f["ratio"])

    palette_pairs: dict = {}
    tint_pairs: dict = {}
    for theme, tok in runs.items():
        for f in run(themed, tok)[0]:
            key = (str(f["file"]), f["line"], f["sel"])
            entry = per_pair.setdefault(key, {"f": f, "themes": [], "worst": 99.0, "palette": set()})
            entry["themes"].append(theme)
            entry["worst"] = min(entry["worst"], f["ratio"])
            pf = palette_fault(f["fg"], f["bg"], tok, f["need"])
            if pf:
                entry["palette"].add(theme)
                palette_pairs.setdefault(pf, {}).setdefault(theme, []).append(f["ratio"])
            tint = same_colour_tint(f["fg"], f["bg"])
            if tint:
                entry["tint"] = tint
                tint_pairs.setdefault(tint, set()).add(str(f["file"]))

    rows = sorted(per_pair.values(), key=lambda e: e["worst"])

    # ── The palette's own faults, named once ──────────────────────────────
    #
    # Every row below would otherwise appear as dozens of component findings.
    # It is one decision per token pair per theme, and it belongs to whoever
    # owns the theme - not to the ninety files that pair the two tokens.
    if palette_pairs:
        print("=" * 72)
        print("THEME PALETTE — these token pairs fail before any component is involved")
        print("=" * 72)
        for (fg, bg), by_theme in sorted(
            palette_pairs.items(), key=lambda kv: min(min(v) for v in kv[1].values())
        ):
            print(f"  {fg} on {bg}")
            for theme, ratios in sorted(by_theme.items(), key=lambda kv: min(kv[1])):
                print(f"      {min(ratios):5.2f}:1  {theme}")
        touched = sum(1 for e in rows if e["palette"])
        print()
        print(f"  {len(palette_pairs)} token pair(s) - they account for {touched} "
              f"of the {len(rows)} findings below.")
        print("  Repairing these at a call site would dodge the theme's intent in one")
        print("  place and leave it standing everywhere else.")
        print()
    if tint_pairs:
        print("=" * 72)
        print("SAME-COLOUR TINT — the text and its ground are one status colour")
        print("=" * 72)
        for tok, files_ in sorted(tint_pairs.items(), key=lambda kv: -len(kv[1])):
            print(f"  {tok:28s} {len(files_):3d} file(s)")
        n_tint = sum(1 for e in rows if e.get("tint"))
        print()
        print(f"  A platform idiom, {n_tint} of the findings below. It reads at 8:1 on")
        print("  a near-black ground and at 1.0 on a white one. --color-<status>-hover")
        print("  is the obvious repair and is NOT enough (brutalist: 2.55 -> 3.68).")
        print()

    print("=" * 72)
    print("COMPONENT — a colour this file chose, and can unchoose")
    print("=" * 72)

    for e in rows:
        if e["palette"] or e.get("tint"):
            continue
        f = e["f"]
        try:
            rel = f["file"].relative_to(ROOT)
        except ValueError:
            rel = f["file"]
        n = len(e["themes"])
        where = "ALL themes" if n == len(runs) else ", ".join(e["themes"])
        print(f"{e['worst']:5.2f}:1  need {f['need']}  {rel}:{f['line']}  {f['sel']}")
        print(f"           fg {f['fg']}")
        # The ground belongs in every finding, theme mode included: a pair
        # without it cannot be acted on, and the reader cannot tell a bad
        # colour from a bad ground.
        print(f"           bg {f['bg']}   ({f['ground_via']}, {f['size']})")
        print(f"           fails in {n}/{len(runs)}: {where}")

    component_rows = [e for e in rows if not e["palette"] and not e.get("tint")]
    tint_rows = [e for e in rows if e.get("tint") and not e["palette"]]
    print()
    print(f"{len(rows)} pair(s) below WCAG AA in at least one of {len(runs)} themes:")
    print(f"   {len(rows) - len(component_rows)} caused by a theme's own palette "
          f"({len(palette_pairs)} token pairs to decide)")
    print(f"   {len(tint_rows)} the same-colour-tint idiom ({len(tint_pairs)} status colours)")
    print(f"   {len(component_rows)} caused by a colour the component chose")
    light_only = [
        e for e in rows if "(platform default)" not in e["themes"]
    ]
    print(f"{len(light_only)} of them PASS the platform default and fail elsewhere -")
    print("   those are the ones a dark-only measurement can never find.")
    return 1 if rows else 0


def main(argv: list[str]) -> int:
    flags = [a for a in argv[1:] if a.startswith("--")]
    args = [a for a in argv[1:] if not a.startswith("--")]
    tokens = load_tokens()
    # Shared Tier-3 first, global palette wins over it on a name clash.
    tokens = {**shared_tier3(ROOT), **tokens}
    targets: list[Path] = []
    roots = [ROOT / a for a in args] if args else [ROOT / "src" / "components"]
    for r in roots:
        targets.extend(sorted(r.rglob("*.ts")) if r.is_dir() else [r])

    if "--self-check" in flags:
        return self_check(tokens)

    if "--themes" in flags:
        return report_themes(targets, tokens)

    all_findings, all_skips = run(targets, tokens)

    all_findings.sort(key=lambda x: x["ratio"])
    for f in all_findings:
        try:
            rel = f["file"].relative_to(ROOT)
        except ValueError:
            rel = f["file"]
        print(f"{f['ratio']:5.2f}:1  need {f['need']}  {rel}:{f['line']}  {f['sel']}")
        print(f"           fg {f['fg']}")
        same = "  [fg == bg: likely a decorative block, not text]" if f["ratio"] < 1.005 else ""
        if f.get("module"):
            same += "  [style module: measured with shared defaults, a consumer may override]"
        print(f"           bg {f['bg']}   ({f['ground_via']}, {f['size']}){same}")

    print()
    print(f"{len(all_findings)} pair(s) below WCAG AA in {len(targets)} file(s).")
    print(f"{len(all_skips)} pair(s) not measurable (reported, never assumed to pass).")
    return 1 if all_findings else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

#!/usr/bin/env python3
"""Sweep D — put every CRT glow behind the `--glow-strength` multiplier.

A glow is a shadow with no offset and no spread: `0 0 <blur> <colour>`.
A focus ring (`0 0 0 3px`) has a spread and is NOT a glow — a plain regex on
`0 0 \\d+px` matches the ring's spread by backtracking, which is why this
tokenises each shadow component instead.

Covers all three shapes the codebase uses: box-shadow, text-shadow and
filter: drop-shadow().
"""
import re, sys, pathlib, collections

ROOT = pathlib.Path("src")
EXCLUDE = (
    "components/terminal/",
    "components/dungeon/",
    "components/drift/",
    "components/shared/terminal-theme-styles.ts",
    "components/shared/bureau-palette-styles.ts",
    "components/multiverse/CartographerMap.ts",
)

LEN = re.compile(r"^-?\d+(?:\.\d+)?(px|rem|em)\b")
ALREADY = "var(--glow-strength)"


def split_top(value: str, sep: str = ",") -> list[str]:
    out, depth, cur = [], 0, ""
    for ch in value:
        if ch in "([":
            depth += 1
        elif ch in ")]":
            depth -= 1
        if ch == sep and depth == 0:
            out.append(cur)
            cur = ""
        else:
            cur += ch
    out.append(cur)
    return out


def scale_component(comp: str, max_lengths: int) -> tuple[str, bool]:
    """Wrap the blur radius of one shadow component if it is a glow.

    max_lengths: 4 for box-shadow (x y blur spread), 3 for text/drop-shadow.
    """
    if ALREADY in comp or "${" in comp:
        return comp, False
    lead = re.match(r"\s*(inset\s+)?", comp)
    head = lead.group(0)
    rest = comp[len(head):]

    lengths, pos = [], 0
    while len(lengths) < max_lengths:
        m = re.match(r"\s*(-?\d+(?:\.\d+)?(?:px|rem|em)|0)\b", rest[pos:])
        if not m:
            break
        lengths.append((pos + m.start(1), pos + m.end(1), m.group(1)))
        pos += m.end()
    # x and y must both be zero, a blur must exist, and nothing may follow it.
    if len(lengths) != 3:
        return comp, False
    x, y, blur = (l[2] for l in lengths)
    if x.rstrip("pxremem") not in ("0", "") or float(re.sub(r"[a-z]", "", x)) != 0:
        return comp, False
    if float(re.sub(r"[a-z]", "", y)) != 0:
        return comp, False
    if float(re.sub(r"[a-z]", "", blur)) == 0:
        return comp, False
    s, e, _ = lengths[2]
    return head + rest[:s] + f"calc({blur} * {ALREADY})" + rest[e:], True


def sweep_property(txt: str, prop: str, max_lengths: int) -> tuple[str, int]:
    n = 0
    out, last = [], 0
    for m in re.finditer(rf"\b{prop}\s*:\s*([^;{{}}]+)", txt):
        value = m.group(1)
        comps = split_top(value)
        new_comps, changed = [], False
        for c in comps:
            nc, ch = scale_component(c, max_lengths)
            new_comps.append(nc)
            changed = changed or ch
            n += ch
        if changed:
            out.append(txt[last:m.start(1)])
            out.append(",".join(new_comps))
            last = m.end(1)
    out.append(txt[last:])
    return "".join(out), n


def sweep_drop_shadow(txt: str) -> tuple[str, int]:
    n, out, last = 0, [], 0
    for m in re.finditer(r"drop-shadow\(", txt):
        i, depth = m.end(), 1
        while i < len(txt) and depth:
            if txt[i] == "(":
                depth += 1
            elif txt[i] == ")":
                depth -= 1
            i += 1
        inner = txt[m.end(): i - 1]
        new, ch = scale_component(inner, 3)
        if ch:
            out.append(txt[last:m.end()])
            out.append(new)
            last = i - 1
            n += 1
    out.append(txt[last:])
    return "".join(out), n


def main() -> int:
    apply = "--apply" in sys.argv
    counts, files_touched = collections.Counter(), 0
    for p in sorted(list(ROOT.rglob("*.ts")) + list(ROOT.rglob("*.css"))):
        s = str(p)
        if any(e in s for e in EXCLUDE):
            continue
        txt = orig = p.read_text()
        txt, a = sweep_property(txt, "box-shadow", 4)
        txt, b = sweep_property(txt, "text-shadow", 3)
        txt, c = sweep_drop_shadow(txt)
        if a or b or c:
            files_touched += 1
            counts["box-shadow"] += a
            counts["text-shadow"] += b
            counts["drop-shadow"] += c
            if apply and txt != orig:
                p.write_text(txt)
    total = sum(counts.values())
    print(f"{'APPLIED' if apply else 'DRY RUN'} — {total} Glows in {files_touched} Dateien")
    for k, v in counts.most_common():
        print(f"  {v:5d}  {k}")
    return 0

sys.exit(main())

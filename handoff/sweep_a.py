#!/usr/bin/env python3
"""Sweep A — split `text-transform: uppercase` into the heading role and the label role.

Both tokens default to `uppercase` in :root, so this rewrite is invisible in the
dark chrome. It only becomes visible under a skin that lowercases headings.

Usage:  sweep_a.py --dry     (classify + write report, touch nothing)
        sweep_a.py --apply   (rewrite files)
"""
import re, sys, pathlib, collections, json

ROOT = pathlib.Path("src")
# Diegetic surfaces: phosphor CRT is fixed, not skinnable.
EXCLUDE = (
    "components/terminal/",
    "components/dungeon/",
    "components/drift/",
    "components/shared/terminal-theme-styles.ts",
    "components/shared/bureau-palette-styles.ts",
    "components/multiverse/CartographerMap.ts",
)

HIT = re.compile(r"text-transform:\s*uppercase")

# --- font-size buckets -------------------------------------------------------
SMALL = re.compile(
    r"--text-(?:2xs|xs|sm)\b"
    r"|(?<![\d.])(?:[6-9]|1[0-3])px\b"
    r"|(?<![\d.])0\.(?:[3-8]\d*)rem\b"
)
LARGE = re.compile(
    r"--text-(?:lg|xl|2xl|3xl|4xl|5xl|display[\w-]*)\b"
    r"|(?<![\d.])(?:1[8-9]|[2-9]\d|\d{3,})px\b"
    r"|(?<![\d.])(?:1\.[2-9]\d*|[2-9](?:\.\d+)?)rem\b"
)
MID = re.compile(r"--text-(?:base|md)\b|(?<![\d.])(?:1[4-7])px\b|(?<![\d.])(?:0\.9\d*|1(?:\.[01]\d*)?)rem\b")

# --- selector semantics ------------------------------------------------------
HEAD_ELEM = re.compile(r"(?:^|[\s,>~+(])h[1-6](?=[\s,{:.\[]|$)")
HEAD_NAME = re.compile(
    r"[\w-]*(?:title|heading|headline|display|hero__name|masthead)[\w-]*", re.I
)
LABEL_NAME = re.compile(
    r"[\w-]*(?:label|kicker|eyebrow|badge|chip|tag|pill|meta|caption|legend|"
    r"button|btn|tab|nav|crumb|stat__key|key|unit|status|state|flag|code|"
    r"overline|column-head|th\b|footer|counter|count|value-label|hint|note|stamp|watermark|clock|readout)[\w-]*",
    re.I,
)

def blocks(txt: str, at: int):
    """Return (selector, body) of the CSS rule enclosing offset `at`."""
    depth, j = 0, at
    while j > 0:
        j -= 1
        if txt[j] == "}":
            depth += 1
        elif txt[j] == "{":
            if depth == 0:
                break
            depth -= 1
    ob = j
    k = ob
    while k > 0 and txt[k - 1] not in "};{":
        k -= 1
    selector = " ".join(txt[k:ob].split())
    depth, e = 0, ob
    while e < len(txt) - 1:
        e += 1
        if txt[e] == "{":
            depth += 1
        elif txt[e] == "}":
            if depth == 0:
                break
            depth -= 1
    return selector, txt[ob:e]

def font_size(body: str) -> str | None:
    m = re.search(r"font-size:\s*([^;]+);", body)
    return m.group(1) if m else None


LOCAL_VAR = re.compile(r"var\(\s*(--_[\w-]+)")

def resolve_local(fs: str, locals_: dict[str, str], depth: int = 0) -> str:
    """Substitute component-local Tier-3 variables (`--_label-size: 11px`).

    They are declared in the same file's :host block, so their value is
    knowable without a browser — and their size is what decides the role.
    """
    if depth > 4:
        return fs
    m = LOCAL_VAR.search(fs)
    if not m:
        return fs
    val = locals_.get(m.group(1))
    if val is None:
        return fs
    return resolve_local(fs.replace(m.group(0) + ")", val).replace(m.group(0), val), locals_, depth + 1)

def classify(selector: str, body: str, locals_: dict[str, str]) -> tuple[str, str]:
    """→ (role, reason).  role ∈ {heading, label, review}"""
    fs = font_size(body)
    if fs:
        fs = resolve_local(fs, locals_)
    sel = selector.split("/*")[-1]  # drop a leading comment
    sel_tail = sel[-160:]

    if fs:
        small, large, mid = SMALL.search(fs), LARGE.search(fs), MID.search(fs)
        # A clamp()/min()/max() carries several sizes; the largest one decides.
        if large and not small:
            if HEAD_ELEM.search(sel_tail) or HEAD_NAME.search(sel_tail):
                return "heading", f"large font {fs.strip()} + heading selector"
            if LABEL_NAME.search(sel_tail):
                return "review", f"large font {fs.strip()} but label-ish selector"
            return "heading", f"large font {fs.strip()}"
        if small:
            # Small wins over a heading-sounding name: `.heading { font-size: var(--text-sm) }`
            # is a label wearing a heading's name (admin/ops/BurnRatePanel).
            return "label", f"small font {fs.strip()}"
        if mid:
            if HEAD_ELEM.search(sel_tail):
                return "heading", f"mid font {fs.strip()} + h-element"
            if LABEL_NAME.search(sel_tail):
                return "label", f"mid font {fs.strip()} + label selector"
            if HEAD_NAME.search(sel_tail):
                return "review", f"mid font {fs.strip()} + heading name"
            return "review", f"mid font {fs.strip()}, selector undecided"
        return "review", f"font-size {fs.strip()} unparsed"

    # No font-size in this block.
    if HEAD_ELEM.search(sel_tail):
        return "heading", "h-element, no font-size"
    if LABEL_NAME.search(sel_tail):
        return "label", "label selector, no font-size"
    ls = re.search(r"letter-spacing:\s*([^;]+);", body)
    if ls and re.search(r"--tracking-(?:wide|wider|widest|display|hero|brutalist)|0\.(?:0[5-9]|[1-9])", ls.group(1)):
        return "label", f"tracking {ls.group(1).strip()}, no font-size"
    if HEAD_NAME.search(sel_tail):
        return "review", "heading name, no font-size"
    return "review", "no font-size, no tracking, selector undecided"


def main() -> int:
    apply = "--apply" in sys.argv
    counts = collections.Counter()
    review, edits = [], collections.defaultdict(list)

    files = sorted(list(ROOT.rglob("*.ts")) + list(ROOT.rglob("*.css")))
    for p in files:
        s = str(p)
        if any(e in s for e in EXCLUDE):
            continue
        txt = p.read_text()
        if not HIT.search(txt):
            continue
        locals_ = dict(re.findall(r"(--_[\w-]+):\s*([^;]+);", txt))
        for m in HIT.finditer(txt):
            selector, body = blocks(txt, m.start())
            role, reason = classify(selector, body, locals_)
            counts[role] += 1
            line = txt[: m.start()].count("\n") + 1
            rec = {"file": s, "line": line, "role": role, "reason": reason,
                   "selector": selector[-140:]}
            if role == "review":
                review.append(rec)
            edits[p].append((m.start(), m.end(), role))

    # rewrite back-to-front so offsets stay valid
    if apply:
        for p, spans in edits.items():
            txt = p.read_text()
            for start, end, role in sorted(spans, reverse=True):
                token = "--heading-transform" if role == "heading" else "--label-transform"
                # `review` defaults to the label role: it is the majority role and
                # the mistake is invisible in the dark chrome either way.
                txt = txt[:start] + f"text-transform: var({token})" + txt[end:]
            p.write_text(txt)

    out = pathlib.Path(sys.argv[0]).parent / "sweep_a_review.json"
    out.write_text(json.dumps(review, indent=1))
    total = sum(counts.values())
    print(f"{'APPLIED' if apply else 'DRY RUN'} — {total} Treffer in {len(edits)} Dateien")
    for k, v in counts.most_common():
        print(f"  {v:5d}  {k:8s} {v*100//total}%")
    print(f"\n  review-Liste → {out} ({len(review)} Einträge)")
    return 0

sys.exit(main())

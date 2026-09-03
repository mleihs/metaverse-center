import re, sys, pathlib

def promote_selector(txt: str, selector: str, path: str) -> tuple[str, int]:
    n = 0
    out = []
    esc = re.escape(selector)
    pat = re.compile(rf"(?<![\w-]){esc}(?![\w-])")
    for m in pat.finditer(txt):
        j = m.end()
        brace = txt.find("{", j)
        if brace == -1 or (txt.find("}", j) != -1 and txt.find("}", j) < brace):
            continue
        between = txt[j:brace]
        if "{" in between or ";" in between:
            continue
        depth = 0
        e = brace
        while e < len(txt) - 1:
            e += 1
            if txt[e] == "{":
                depth += 1
            elif txt[e] == "}":
                if depth == 0:
                    break
                depth -= 1
        body = txt[brace:e]
        if "var(--label-transform)" not in body:
            continue
        new_body = body.replace("var(--label-transform)", "var(--heading-transform)", 1)
        out.append((brace, e, new_body))
        n += 1
    for brace, e, new_body in sorted(out, reverse=True):
        txt = txt[:brace] + new_body + txt[e:]
    return txt, n


TARGETS = [
    ("src/components/archetypes/ArchetypeDetailView.ts", [".not-found__name"]),
    ("src/components/chat/ChatWindow.ts", [".window__agent-name"]),
    ("src/components/epoch/EpochResultsView.ts", [".podium__name", ".mvp-card__sim"]),
    ("src/components/how-to-play/htp-styles.ts", [".op-card__name"]),
    ("src/components/journal/VelgAttunementPanel.ts", [".card__name"]),
    ("src/components/journal/VelgConstellationList.ts", [".row__name"]),
    ("src/components/journal/VelgInsightReveal.ts", [".attunement__name"]),
    ("src/components/multiverse/MapConnectionPanel.ts", [".panel__sims"]),
]

apply = "--apply" in sys.argv
total = 0
for rel, selectors in TARGETS:
    p = pathlib.Path(rel)
    txt = p.read_text()
    file_n = 0
    for sel in selectors:
        txt, n = promote_selector(txt, sel, rel)
        if n == 0:
            print(f"  WARN nicht gefunden: {rel} {sel}")
        file_n += n
    total += file_n
    print(f"{'APPLIED' if apply else 'DRY'}  {file_n}  {rel}")
    if apply and file_n:
        p.write_text(txt)
print(f"Gesamt: {total}")

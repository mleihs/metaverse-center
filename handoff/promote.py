#!/usr/bin/env python3
"""Promote specific (file, selector) pairs from --label-transform to
--heading-transform. Restliste review decision: text-base/text-md is the
h5/h6 token-scale size (see _typography.css h5-size/h6-size), and combined
with a title/heading/subtitle-named selector these are section-level
headings, not labels — just smaller ones than a page h1."""
import re, sys, pathlib

TARGETS = [
    ("src/components/admin/AdminInstagramTab.ts", [".reject-modal__title"]),
    ("src/components/admin/content-drafts/VelgContentDraftConflictView.ts",
     [".head__title", ".all-auto__title"]),
    ("src/components/admin/content-drafts/VelgContentDraftEditor.ts", [".head__title"]),
    ("src/components/agents/VelgRecruitmentOffice.ts",
     [".recruit__title", ".config__title", ".processing__title"]),
    ("src/components/bonds/VelgBondPanel.ts", [".empty__title"]),
    ("src/components/content/content-styles.ts",
     [".feature-card__title", ".faq-section__title"]),
    ("src/components/forge/VelgDarkroomStudio.ts",
     [".theme-lab__heading", ".image-forge__heading"]),
    ("src/components/forge/VelgForgeAstrolabe.ts", [".dossier__title"]),
    ("src/components/forge/VelgForgeTable.ts", [".generation-failed__title"]),
    ("src/components/health/SimulationHealthView.ts", [".panel__title"]),
    ("src/components/how-to-play/HowToPlayGuideHub.ts", [".card__title"]),
    ("src/components/how-to-play/HowToPlayTopic.ts", [".demo-step__title"]),
    ("src/components/how-to-play/htp-styles.ts",
     [".match__title", ".analytics-sub__title", ".demo-step__title"]),
    ("src/components/landing/ChronicleFeed.ts", [".feed-empty__title"]),
    ("src/components/landing/WorldsGallery.ts", [".gallery-empty__title"]),
    ("src/components/lore/LoreEditor.ts", [".edit-form__title"]),
    ("src/components/lore/VelgDossierRequest.ts", [".processing__title"]),
    ("src/components/multiverse/BleedGazetteSidebar.ts", [".gazette-header__title"]),
    ("src/components/onboarding/OnboardingWizard.ts",
     [".worlds__heading", ".tour__heading", ".mission__heading"]),
    ("src/components/settings/GeneralSettingsPanel.ts", [".danger-zone__title"]),
    ("src/components/shared/settings-styles.ts", [".settings-section__subtitle"]),
]


def promote_selector(txt: str, selector: str, path: str) -> tuple[str, int]:
    n = 0
    out = []
    i = 0
    esc = re.escape(selector)
    # selector must appear as its own token: start of line/whitespace/comma,
    # end at whitespace/comma/{/: (avoid matching a longer classname prefix)
    pat = re.compile(rf"(?<![\w-]){esc}(?![\w-])")
    for m in pat.finditer(txt):
        # find the `{` that opens this rule (selector may be comma-separated,
        # scan forward to the next unescaped `{` before a `}`)
        j = m.end()
        brace = txt.find("{", j)
        if brace == -1 or (txt.find("}", j) != -1 and txt.find("}", j) < brace):
            continue
        # guard: make sure no other `{` or `;` lies between selector and this
        # brace (i.e. this IS the selector list for that rule, not inside a
        # comment or a previous rule's body)
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


def main() -> int:
    apply = "--apply" in sys.argv
    total = 0
    for rel, selectors in TARGETS:
        p = pathlib.Path(rel)
        txt = p.read_text()
        file_n = 0
        for sel in selectors:
            txt, n = promote_selector(txt, sel, rel)
            if n == 0:
                print(f"  ⚠ NICHT GEFUNDEN: {rel}  {sel}")
            file_n += n
        total += file_n
        print(f"{'APPLIED' if apply else 'DRY'}  {file_n}  {rel}")
        if apply and file_n:
            p.write_text(txt)
    print(f"\nGesamt: {total} Selektoren promoted")
    return 0

sys.exit(main())

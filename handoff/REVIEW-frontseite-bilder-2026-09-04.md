# Code-Review Frontseiten-Bilder — 15 Befunde, am 05.09.2026 ALLE BEHOBEN

> `/code-review` auf `max`, gelaufen am 04.09.2026 13:15–13:30 lokal, gegen den
> Commit `a36826cc` (vor der Historien-Umschreibung: `2e9badd0`) —
> „der Anmeldesaal als Held". Zehn Blickwinkel, danach eine eigene Verifikation.
> Die Meldung landete in einer anderen Sitzung und wurde nie gelesen.
>
> **Abgearbeitet am 05.09.2026 in `4f3106b8`.** Vorher jeder Befund einzeln
> nachgemessen, alle 15 noch gueltig. Der sichtbarste (B2) hat jetzt eine
> eigene Bilddatei: `heroWide`, ein beim Ableiten gesetzter 16:9-Zuschnitt,
> 78 KB statt 364 KB. Neu abgelegt wurden 8 Dateien; **nichts ueberschrieben**,
> weil die vorhandenen `heroPortrait`-Dateien aus dem echten Original stammen
> und die verfuegbare Quelle nur noch die verlustbehaftete 1440er Fassung war.
>
> Die reparierte Budget-Probe schlug beim ersten Lauf sofort an — sie misst
> jetzt jedes Format, nicht nur AVIF.
>
> Was aus dem Review NICHT vollstaendig behoben ist: das 1440er WebP auf Prod
> traegt weiter 615 KB. Es neu abzuleiten haette eine zweite Generation
> Verlust bedeutet; stattdessen sorgen die neue 1200er Stufe und das
> korrigierte `sizes` dafuer, dass diese Stufe kaum noch gewaehlt wird. Wer
> das Original wiederbeschafft, leitet einmal sauber neu ab.

> `/code-review` auf `max`, gelaufen am 04.09.2026 13:15–13:30 lokal, gegen den
> Commit `a36826cc` (vor der Historien-Umschreibung: `2e9badd0`) —
> „der Anmeldesaal als Held". Zehn Blickwinkel, danach eine eigene Verifikation.
>
> **Nachgemessen am 05.09.2026: keiner der 15 Befunde ist behoben.** Elf davon
> direkt im Arbeitsbaum geprueft (26vw steht, der 16/9-Zweig steht, der
> `or`-Kurzschluss steht, `quality_webp=80` steht, `landing-images.spec` gibt es
> nicht, die zwei NOP-Zeichenketten in `main()` stehen); die uebrigen vier sind
> Folgen desselben unveraenderten Codes.
>
> Auf Produktion nachgemessen, ebenfalls 05.09.:
> `hero-intake-hall-heroPortrait-1440.webp` = 614 660 B (150 % des
> 400-KB-Budgets), `…-1440.avif` = 372 829 B, gegen
> `hero-bureau-hero-1920.avif` = 64 528 B.

All 10 angles reported. Consolidating with my own sweep and verification.

**Reusing `max` effort (the level you typed last time) â type a level to change it, e.g. `/code-review high`.**

One candidate self-resolved mid-review: the six `hero-intake-hall-heroPortrait-*` objects returned `404 NoSuchKey` when I first checked and `200` with correct sizes minutes later â the parallel session uploaded them, and the reviewed changes landed as commit `2e9badd0`. Not reported. All byte figures below are measured against those live production files.

```json
[
  {
    "file": "frontend/src/components/landing/landing-images.ts",
    "line": 132,
    "summary": "The `26vw` in `sizes` rests on a slot measurement that does not reproduce: the 4fr column is 528 CSS px (30.6vw) at a 1728px viewport, not the 438 px (25.3vw) the comment records â 438 px back-solves to a ~1457px viewport, i.e. it was measured with DevTools docked.",
    "failure_scenario": "CSS gives plate = (min(V,--stage-measure) - 2*gutter - 48)/3; at V=1728 gutter is 48px (the 1920px query has not fired), so (1728-96-48)/3 = 528px. Verified independently four times. At 1728/DPR2 the true need is 1056 device px but `26vw` declares 899, so the browser picks the 960w rung and upscales it 1.10x â a visible softening on the exact 16-inch MacBook the number was tuned on, for a dense pen drawing whose own comment says it 'zeigt jeden Kompressionsfehler'. Under-declares by 1.10x-1.18x across the whole 1024-1920 range. The comment's claim 'Hier steht 26 und nicht 30, und das ist keine Kosmetik' is inverted: 30vw was right. Same false 438/25vw figure is repeated in derive_landing_images.py:90-93."
  },
  {
    "file": "frontend/src/components/landing/atlas/AtlasHero.ts",
    "line": 308,
    "summary": "Below 1023px the frame flips to `aspect-ratio: 16 / 9` while the new source is 3:4 portrait under `object-fit: cover` â 58% of the drawing is cropped away, which is the exact mirror of the crop this change was made to fix.",
    "failure_scenario": "`@container (max-width: 1023px) { .fig__frame { aspect-ratio: 16 / 9 } }` with `object-fit: cover` unchanged. Source is 1792x2400 (0.747); cover scales to width, so visible height fraction = 0.747/1.778 = 42.2%. The replaced `hero-bureau` (2752x1536, 1.79) filled that same mobile frame at ~97%, so this breakpoint was correct before the change and wrong after it. landing-images.ts:63-65 argues the swap is needed because 'ein Querformat wird darin auf einen schmalen Mittelstreifen beschnitten' â that is now precisely what happens to the portrait on every phone and portrait tablet, the majority-traffic breakpoint, and neither the new doc block nor the `_HERO_PORTRAIT` comment mentions the 16/9 branch exists. Fix: a `&lt;source media=\"(max-width: 1023px)\"&gt;` pair with a 16:9 derivative, or drop the 16/9 override."
  },
  {
    "file": "scripts/derive_landing_images.py",
    "line": 280,
    "summary": "`hero = _pick(\"hero\",\"avif\",1920) or _pick(\"heroPortrait\",\"avif\",1440)` short-circuits, so on any full run the new Atlas hero is never weighed against the 400 KB budget â the opposite of what the comment three lines above promises.",
    "failure_scenario": "Without `--only`, `_SOURCES` always contains `hero-bureau`, whose 1920 rung always derives, so the left operand is truthy and Python never evaluates the right. The portrait hero â 372,829 B, i.e. 91% of the ceiling â is derived, written, uploaded and never measured. The comment at 273-274 states the intent it breaks: 'Beide gegen dieselbe Grenze zu pruefen ist richtig - sie an derselben DATEI zu pruefen waere falsch.' The file's own note at line 101 records q58 = 449 KB for this image; bump `quality_avif` 52-&gt;58, re-run the full pipeline, and the script prints `UNTER 400 KB â` for hero-bureau while shipping a 449 KB LCP image. The `else` branch added in this same diff cannot fire, because something WAS found â just not the thing the line names. Fix: `+` instead of `or`, judging each stem separately."
  },
  {
    "file": "scripts/derive_landing_images.py",
    "line": 105,
    "summary": "`quality_webp=80` produces a 600 KB WebP at the 1440 rung â 150% of the house 400 KB budget â and the budget probe only ever reads AVIF, so it is invisible.",
    "failure_scenario": "Measured on prod: hero-intake-hall-heroPortrait-1440.webp = 614,660 B. This is what the WebP `&lt;source srcset&gt;` hands every client without AVIF (Safari/iOS &lt;= 16.3) at the picks where 1440 wins: iPhone 430@3x, iPhone SE 390@3x, iPad 768@2x, and 2560@2x desktop â all &gt;= 400 KB, all above the fold, all at `fetchpriority=\"high\"`. The role inherits inconsistently: `quality_avif=52` is the landscape hero's value while `quality_webp=80` is the panel's, so the comment's stated intent ('naeher an der Tafel-Qualitaet als am Helden') is honoured only on the format most users never receive and violated on the one that blows the budget. Fix: measure every format in the ladder, and reconcile the two quality knobs with the stated intent."
  },
  {
    "file": "frontend/src/components/landing/landing-images.ts",
    "line": 50,
    "summary": "Above-the-fold image weight regresses 2.4x on desktop and 8.9x on mobile against the 63 KB baseline this pipeline was built to establish, because a `w` descriptor is width but bytes scale with area.",
    "failure_scenario": "Measured, prod: heroPortrait AVIF 640/960/1440 = 61/155/364 KB vs hero-bureau 640/960/1440/1920 = 11/21/41/63 KB â 5.5x to 8.9x heavier at every rung. Old AtlasHero used role `hero` + `sizes: 100vw`, so 1728@2x fetched 1920w = 63 KB; it now fetches 960w = 155 KB. Mobile 430@3x went 1440w = 41 KB -&gt; 1440w = 364 KB. Commit 6cfa046b established 63 KB as the measured first image load ('die erste Bildlast sinkt auf 63 KB'); nothing in this change records that it is being given up. Half the cause is content density, half is geometry: 3:4 carries 2.4x the pixels of 16:9 at equal `w`. The 960-&gt;1440 gap (1.5x) is where every 2x desktop and 3x phone need lands; a ~1200 rung would cost ~253 KB instead of 364 KB on each."
  },
  {
    "file": "frontend/src/components/landing/landing-images.ts",
    "line": 132,
    "summary": "`sizes` uses a viewport media condition to mirror a container query â the attribute has no container-query form, so the two can only agree while host width equals viewport width.",
    "failure_scenario": "The layout switch is `@container (max-width: 1023px)` against `:host { container-type: inline-size }` (AtlasHero.ts:82/301), and the comment at 295-299 records that a *media* query at that exact spot was the 2026-09-03 bug: 'eine Medienabfrage hier hat dazu gefuehrt, dass das Blatt bei 390 px Blattbreite zweispaltig stehenblieb, weil das Fenster 1728 breit war.' The new `sizes` reintroduces the viewport half. Reachable today via the classic scrollbar: on Windows/Linux Chrome at viewport 1024-1038 the host is 1009-1023, so the container query fires (single column, plate ~920 CSS px) while the media query does not, and `26vw` ~= 267 px selects the 640w candidate for a 1840-device-px slot â a 2.9x upscale. Structurally it breaks wholesale the moment the component is rendered in any non-full-bleed shell (skin preview, admin embed, split view). At minimum state in the comment that `sizes` is viewport-based on purpose and that the host must stay viewport-wide."
  },
  {
    "file": "scripts/derive_landing_images.py",
    "line": 300,
    "summary": "The section report prints an absolute label ('1 Tafel 1280 + 6 Miniaturen 288') over whatever subset `--only` happened to derive, and the combined total is captioned 'Held + Systemabschnitt' three lines after the script declared there is no Held.",
    "failure_scenario": "Verified by simulation and by running it. `--only system-02-epochs`: `panel_first` is empty (it is hardcoded to stem `system-01-forge`) and `thumbs` has 1 entry, so the `or` passes and the script prints the '1 Tafel + 6 Miniaturen' caption over the size of a single thumbnail. `--only system-01-forge`: `hero` is empty, so lines 296-297 correctly print 'KEIN Held ... AUSGESETZT, nicht bestanden' â and then line 303 prints `Held + Systemabschnitt zusammen: 1 KB` with `hero_bytes = 0`, a figure that reads as a full-page budget and is missing its largest term. This is the same hardcoded-count defect the diff fixed one screen earlier at `Quellen (7 Dateien)` -&gt; `len(quellen)`, and the same 'ein Haken, weil nichts gefunden wurde' rule the new comment invokes, applied to the hero but not here. Fix: interpolate `len(panel_first)`/`len(thumbs)`, and gate line 303 on `hero and (panel_first or thumbs)`."
  },
  {
    "file": "frontend/src/components/landing/landing-images.ts",
    "line": 111,
    "summary": "`landingFallbackUrl` returns `widths[widths.length - 1]`, silently depending on every width array being sorted ascending â while the Python table it mirrors is sorted descending throughout.",
    "failure_scenario": "The doc directly above says 'WebP in der groessten Breite'; the code says 'the last element'. derive_landing_images.py writes all four ladders descending â (1920,1440,960,640), (1440,960,640), (1280,960,640), (288,192) â and landing-images.ts writes them ascending. The natural sync direction is Python-&gt;TS, since Python is where the widths are measured and chosen; paste `(1440, 960, 640)` as `[1440, 960, 640]` and `landingFallbackUrl` silently returns the 640w WebP as the `&lt;img src&gt;` for a frame rendering at 1440. `landingSrcset` still emits all three so nothing visibly breaks, `tsc` stays green (still a readonly 3-tuple of numbers), and no test exists. Fix: `Math.max(...widths)` â order-independent and matches the documented intent. Separately, pointing the fallback at the middle rung (960 WebP = 253,110 B) would cut the worst case by 353 KB at no cost on any live path."
  },
  {
    "file": "frontend/src/components/landing/landing-images.ts",
    "line": 12,
    "summary": "The header names its own safety net â 'ein Ableitungslauf, der andere Breiten schreibt, macht `landing-images.spec` rot statt die Seite still kaputt' â and no such file exists anywhere in the repo.",
    "failure_scenario": "Confirmed by six angles independently: `find` for any landing-images spec outside `dist/` returns only the source module; `grep -rn LANDING_IMAGE_WIDTHS` over `frontend/src` and `frontend/tests` (84 test files) matches one file, itself; and `vitest.config.ts` includes only `tests/**/*.test.ts` and `src/**/*.test.ts`, which a file named `.spec` would not match anyway. So the TS&lt;-&gt;Python contract has zero enforcement, and this change adds a fourth coupling point to it (`heroPortrait` widths, the role name, the `hero-intake-hall` stem, the `_SOURCES` key). `Record&lt;LandingImageRole, string&gt;` enforces only the TS&lt;-&gt;TS half. Any future width edit on one side yields green tsc, green lint, green CI and a 404 on the landing page's LCP image. Either write the spec the comment promises (parse the Python `Role` table and assert set-equality) or delete the false guarantee."
  },
  {
    "file": "frontend/src/components/landing/landing-images.ts",
    "line": 91,
    "summary": "`landingSrcset(stem: string, ...)` and `landingFallbackUrl(stem: string, ...)` take `stem` as a bare `string`, so every (stem, role) pair type-checks â including the ones for which no file was ever derived.",
    "failure_scenario": "The pre-change Atlas hero was `(LANDING_HERO_STEM, 'hero')`: a valid pair, wrong image. The half-finished edit â `(LANDING_HERO_STEM, 'heroPortrait')` or `(ATLAS_HERO_STEM, 'hero')` â is equally type-clean and yields three srcset candidates plus a fallback that all 404, rendering an empty `.fig__frame` with `alt=\"\"` suppressing even the broken-image affordance and no error path to Sentry. `&lt;picture&gt;` selects on `type`/`media` only and does not retry another `&lt;source&gt;` on a fetch failure, so a 404 candidate is a hard blank, not a graceful degrade. This is the repo's own `widening-to-string-is-a-cast` rule: a `string` where a union belongs turns the type checker off at the one place it could help. Fix: a stem-&gt;roles registry mirroring `_SOURCES`, with `landingSrcset` narrowed to the derived union â which also gives the spec above something to iterate."
  },
  {
    "file": "scripts/derive_landing_images.py",
    "line": 169,
    "summary": "`_derive_one` silently tolerates a declared width it cannot write â it prints one `!` line into a long log and the script still exits 0 â while the frontend unconditionally advertises that rung in `srcset`.",
    "failure_scenario": "`if width &gt; source.width: print(...); continue`. All three heroPortrait widths are &lt;= 1792 so nothing is skipped today, but `--only` makes single-image re-derivation routine and a replacement source is exactly where a narrower file appears. Re-render the intake hall at 1200 px wide, re-derive with `--only hero-intake-hall`, and the 1440 rung is skipped with one warning line among dozens; the script exits 0, the operator uploads. `landingSrcset` still emits `...-heroPortrait-1440.avif 1440w` and `landingFallbackUrl` still points `&lt;img src&gt;` at the 1440 WebP. Per the finding above, a browser that selects the missing candidate gets a blank hero with no console error â and only DPR-3 phones and wide retina desktops are affected, which is the hardest possible shape to reproduce. Fix: exit non-zero (or refuse the role) when a declared width cannot be written."
  },
  {
    "file": "scripts/derive_landing_images.py",
    "line": 234,
    "summary": "Narrowing `missing` from `_SOURCES` to `quellen` removed the guarantee that `--out` holds one complete, self-consistent generation, and the upload step has no notion of a generation either.",
    "failure_scenario": "Derive never clears `--out` (`out.mkdir(parents=True, exist_ok=True)`), and upload_landing_images.py:113 globs `sorted(p for p in src.glob(\"*\") if p.suffix in _MIME)` and POSTs every file it finds with `\"x-upsert\": \"true\"` into the fixed `platform/landing/2026-08` prefix. So derive reports a subset while upload ships whatever is on disk. Concretely: the default `--out build/landing-images` still holds a previous full run; someone runs `--only hero-intake-hall` after tuning a shared `Role` or `_FORMATS`, sees `Abgeleitet ( 6 Dateien)` and a clean verdict for six files, then uploads â and 74 files are upserted, overwriting URLs that both landing-images.ts:17-19 and upload_landing_images.py:14-15 swear are final ('eine neue Ableitung bekommt einen neuen Vorsatz, nie eine ueberschriebene URL') and that are served with `max-age=31536000, immutable`. Per the repo's own `asset-error-immutable-poisoning` note, `immutable` is only safe while the URL never changes."
  },
  {
    "file": "scripts/derive_landing_images.py",
    "line": 191,
    "summary": "Six numeric claims invalidated by the eighth source, two of them printed verbatim by `--help`.",
    "failure_scenario": "`ArgumentParser(description=__doc__)` renders the module docstring, so `--help` now states 'Aus sieben JPEG a 3 MB' and 'sieben Dateien, 2752-2816 x 1536, zusammen 20,61 MB' â the new source is 1792x2400, breaking the count, the dimension range and the total in one sentence â while `--src` help says 'Verzeichnis mit den sieben JPEG'. That is the first thing an operator reads before a Prod-facing run, and it tells them to assemble seven files. Meanwhile landing-images.ts:4 says 'Die 68 Dateien unter platform/landing/2026-08/' (now 74: 4x2 + 6x(3+2)x2 + 3x2) and line 33 says 'Die drei Verwendungen' above four roles. The 68 figure is the only inventory of that storage prefix anywhere in the repo. The diff correctly de-hardcoded the one runtime count (`Quellen (7 Dateien)` -&gt; `len(quellen)`) and left every prose copy behind. Note also `--only`'s 14-line rationale sits in a no-op string that `--help` can never reach, while the BENUTZUNG block that `--help` does print documents only `--src` and `--out`."
  },
  {
    "file": "scripts/derive_landing_images.py",
    "line": 227,
    "summary": "The hand-rolled `--only` validation re-implements argparse `choices=` and loses three things it would have given for free; the summary line also mis-pluralises on the single-source path the flag exists for.",
    "failure_scenario": "`choices=sorted({stem for stem, _ in _SOURCES.values()})` validates each element of `nargs=\"+\"` and deletes lines 227-231 â and the house already does exactly this against a module constant at generate_dungeon_detail_images.py:570. What the hand-rolled version loses: (a) the error prints a Python list repr, `Unbekannte Kennung(en): ['hero-intake']`, and never names the valid values, nor does `--help` (it lists one example); an operator who types an underscore must open the source â precisely the returning-months-later reader `--only` was written for; (b) it returns 1, the same code as 'source directory missing' and 'source files missing', where argparse uses 2 for usage errors, so a CI wrapper cannot distinguish a typo from a real failure; (c) both `{stem for stem, _ in _SOURCES.values()}` (228) and `set(args.only)` (232) sit inside comprehension conditions and are rebuilt per iteration. Separately, line 258 prints 'Quellen (1 Dateien)' under `--only hero-intake-hall` â deriving one late-arriving image is the flag's stated motivation."
  },
  {
    "file": "scripts/derive_landing_images.py",
    "line": 212,
    "summary": "Two bare triple-quoted strings are used as statements inside `main()` (lines 212-225 and 268-279). They are not docstrings â only a function's first statement is â so they compile to NOP and are invisible to every tool that reads comments or docstrings.",
    "failure_scenario": "Verified: both follow executable statements, `main.__doc__` is None, `dis` emits a bare NOP, and `ruff check` passes because B018 deliberately exempts string constants (a probe confirms B018 fires on `[1,2,3]` and on a bare name, not on a bare string) â so no CI gate will ever surface this. An AST scan found these are the only two occurrences in the entire first-party codebase; every other explanatory block in this same file uses `#`. Two concrete traps beyond convention: the block at 268-279 sits immediately after the nested `def _pick(...)`, so an ordinary reorder silently converts 12 lines of prose into `_pick.__doc__`; and unlike a comment, a string statement is live syntax â appending a `%` or `.format(...)` during a later edit turns it into an evaluated expression that can raise inside `main()`. Convert both to `#` blocks."
  }
]
```

**Two notes outside the diff.** `scripts/lint-no-em-dash-in-content.sh` currently fails on committed code â `backend/services/platform_settings_service.py:331` carries a U+2014, landed in `188b8052` â and will block CI on any branch containing it. And `scripts/recover_landing_images.py` plus `generate_landing_images.py` still list only the four pre-2026-08 files, so the 74 live derivatives have no recovery path; the source JPEG for the new hero exists only in an ephemeral temp directory outside the repo, which is the gap `--only` documents but does not close.
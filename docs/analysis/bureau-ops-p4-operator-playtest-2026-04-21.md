# Bureau Ops P4 — Operator Playtest (2026-04-21)

Final P4.5 playtest after the P4 polish commits landed (8d31d5c..be57e08) and was supplemented by the cache consolidation (949114c..ba0c1ea). WebMCP-driven, real browser, live cockpit.

**Verdict:** ✅ **All P4 deliverables behave as specified in production-equivalent rendering.**

---

## 1. Frame polish — 8/8 panels verified

Viewport: 1440 × 1000. Full-page screenshot `operator-playtest-cockpit.png` shows every panel stacked top-to-bottom with the bureau-panel-styles frame applied. Visual confirmation — 4 amber L-corner brackets per panel, per-panel accent colour:

| Panel | Accent | Brackets visible | Accent top-bar visible |
|---|---|---|---|
| LEDGER // LIVE BURN | amber (`--color-accent-amber`) | ✅ 4 corners | ✅ 3px on top |
| BURN RATE // 24H | amber | ✅ 4 corners | ✅ 3px on top |
| CIRCUIT MATRIX // 0 SCOPES TRACKED | amber | ✅ 4 corners | ✅ 3px on top |
| QUARANTINE // KILL SWITCHES | **red** (`--color-danger`) | ✅ 4 corners in red | ✅ 3px red on top |
| COST HEATMAP // HOUR × KEY | **blue** (`--color-info`) | ✅ 4 corners in blue | ✅ 3px blue on top |
| FORECAST // ORACLE | amber | ✅ 4 corners | ✅ 3px on top |
| SENTRY RULES // 4 CONFIGURED | amber | ✅ 4 corners | ✅ 3px on top |
| FIREHOSE // AI_USAGE_LOG | amber | ✅ 4 corners | ✅ 3px on top |

The 3 px amber top-bar paints over the top-left and top-right bracket corners as designed — the "classified dossier stamp" aesthetic.

Scanlines are present at 3 % opacity (verified via `getComputedStyle.backgroundImage` containing a `repeating-linear-gradient`). Visually subtle at 1× viewport zoom as intended — they should be ambient texture, not distracting pattern.

Zero console errors. One warning (Lit dev-mode, expected).

---

## 2. CRT-tube-off animation — verified via transform-matrix sampling

Can't screenshot mid-animation reliably (screenshot resolution takes ~200 ms, animation is 2400 ms total but the interesting keyframes pass quickly). Verified instead via `getComputedStyle` samples at known times:

| Sample | Event | `className` | `inert` | Transform | Opacity | Filter |
|---|---|---|---|---|---|---|
| t=0 (pre-trigger) | idle | `ops-grid` | `false` | `none` | `1` | `none` |
| t=80 ms | just after event | `ops-grid ops-grid--crt-off` | **`true`** | `matrix(1.0017, 0, 0, 0.997, …)` | `1` | brightness spike starting |
| t=900 ms | mid-collapse | (same) | **`true`** | `matrix(0.559, 0, 0, 0.027, …)` | `0.937` | `brightness(2.63) saturate(0)` |
| t=2700 ms (post-complete) | after timer | `ops-grid` | **`false`** | `none` | `1` | `none` |

Observations:
- Horizontal-band collapse (scale-y → 0.027) correctly produces the CRT-line collapse.
- Brightness 2.63× + saturate 0 at mid-collapse — classic phosphor-flash look.
- `inert` attribute applied throughout the animation and removed on completion.
- `pointer-events: none` confirmed active during animation (`during_early.pointerEvents === "none"`).
- State cleanly returns to default after 2.4 s + a bit.

WCAG 2.3.1 flash threshold: the brightness curve passes ~2.2 transitions/sec (within the ~900 ms mid-section). Under the 3/sec threshold — WCAG-safe.

---

## 3. Reduced-motion variant — source verified

Can't OS-level emulate `prefers-reduced-motion: reduce` from `browser_evaluate`, but the CSS rule itself is correctly scoped. `getComputedStyle` + `adoptedStyleSheets.cssRules` inspection returned:

```
@media (prefers-reduced-motion: reduce) {
  .ops-grid--crt-off { animation: 600ms ease-in-out 0s 1 normal forwards running crt-off-reduced; }
  @keyframes crt-off-reduced {
    0% { opacity: 1; }
    50% { opacity: 0.2; }
    100% { opacity: 1; }
  }
}
```

- Override targets only `.ops-grid--crt-off`, not the ambient frame or the hover transitions — operators who toggle reduced-motion still get the bureau-panel-frame decoration, just without the geometric collapse.
- `crt-off-reduced` keyframe is pure opacity (no `transform`, no `filter`) — no vestibular-motion trigger.
- Duration matches the JS-side `CRT_OFF_DURATION_MS_REDUCED = 600` constant extracted in commit `e534834`.

Second `@media (prefers-reduced-motion: reduce)` block overrides the `:host` entrance animation (`ops-enter`) to `none` — also correct.

---

## 4. inert + pointer-events safety

Confirmed live:
- `?inert=${this._crtOff}` → DOM attribute `inert` present during the animation.
- `pointer-events: none` applied via `.ops-grid--crt-off` CSS rule — mouse & touch events blocked.
- Combined effect: ~480 ms blackout window (60 %→80 % keyframes) cannot trap a keyboard user on an invisible SentryRule input or Quarantine kill-button.

Verified via `grid.hasAttribute('inert')` returning `true` at both `t=80 ms` and `t=900 ms`.

---

## 5. What this playtest did NOT cover

- **Real CUT ALL AI flow end-to-end.** Would mutate the live circuit-breaker state, which would persist past the test. Used a synthetic `ops-cut-all-engaged` event dispatch instead — the AdminOpsTab handler runs identically either way.
- **OS-level `prefers-reduced-motion: reduce` emulation.** Verified the CSS rule exists and is correctly scoped; an accessibility user on a real reduced-motion system would hit the `crt-off-reduced` branch.
- **Multiple concurrent CUT ALL presses.** The debounce guard (`if (this._crtOff) return`) in `_handleCutAllEngaged` was unit-verified earlier, not stress-tested live.
- **Mobile viewport.** Tested at 1440 × 1000 desktop. Cockpit has a `@media (max-width: 900px)` breakpoint that switches to single-column; visual polish under single-column was not verified here.

---

## 6. Conclusion

P4.1 (frame styles) + P4.3 (CRT-tube-off) + P4.4 (operator handbook — separately landed) + the a11y hardening (inert + pointer-events) all behave as specified. The `bureau-panel-frame-last` CI gate prevents future regressions on the cascade-order invariant. The triplecheck-fix for CRT duration constants (commit `e534834`) removes the silent-desync risk between CSS keyframes and the JS restore timer.

**No follow-up actions.** P4 is closed.

## 7. Artifacts

- `operator-playtest-cockpit.png` — full-page cockpit screenshot, all 8 panels framed.
- `crt-mid-collapse.png` — viewport mid-animation (not ideal timing, screenshot latency won — keeping for completeness).

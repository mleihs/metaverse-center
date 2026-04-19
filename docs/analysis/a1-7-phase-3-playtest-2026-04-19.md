# A1.7 Phase 3 — WebMCP E2E Playtest

**Date:** 2026-04-19
**Session:** Phase 3 frontend verification after self-audit commit `f0bd75c`.
**Flow tested:** Login admin → Admin → Content Drafts → New Draft (cascading
select) → Load & Edit → edit JSON → Save → Close → select checkbox → Publish
Selected (modal) → Cancel → Abandon.

Real-PR publish was **not** executed (local dev has GITHUB_APP creds set;
triggering would open a PR against the live metaverse.center repo).

## What worked end-to-end

- Admin → Content Drafts tab renders, empty state correct.
- "New Draft" opens side panel with create form.
- Pack dropdown populated from backend manifest (8 archetype slugs).
- Resource dropdown cascades from pack selection, shows entry counts
  (banter (44), encounters (13), enemies (5), loot (16), spawns (9) …).
- "SELECTED" banner appears with disk path + entry count.
- "Load & Edit" fetches disk YAML, creates draft, opens editor populated
  with the real 44 banter entries.
- Editor's entries sidebar renders sb_01 … sb_41 correctly.
- JSON textarea shows full entry JSON, one line per key.
- Editing + Save → version bumps v1 → v2, persists in DB.
- Closing without unsaved edits doesn't fire the dirty-check prompt.
- Select checkbox → batch-bar appears; "Publish selected" → modal opens.
- Publish modal shows drafts list, deploy-lag advisory, commit-message
  input with 72-char counter, Cancel/Publish buttons.
- Abandon → confirm dialog → draft transitions to ABANDONED badge.

## Bugs & observations

### BUG #1 (HIGH) — FIXED (commit `fdf87e6`)

Side-panel editor never rendered — just showed the header + close button,
body empty.

Root cause: `VelgSidePanel` uses only *named* slots (`slot="media"`,
`slot="content"`, `slot="footer"`) with no default slot, but the wrapper
mounted `<velg-content-draft-editor>` as default-slotted content.

Fix: added `slot="content"` to the editor element.

### BUG #3 (HIGH) — FIXED (this commit)

Side panel default width 520px left the JSON textarea only ~140px wide
(sidebar 200-280px + gap + 1fr = unusable). JSON wrapped to 4-char lines.

Fix: wrapper tab overrides `--side-panel-width` to `min(1100px, 90vw)`.

### BUG #6 (HIGH) — FIXED (this commit)

Edit-panel content appeared "zu weit rechts / abgeschnitten" — clipped at
the right edge of the admin view, not the viewport.

Root cause: `AdminPanel.ts`'s `.admin-content` keyframe had
`transform: translateY(0)` in its `to` state. After animation ends, the
persistent transform creates a new containing block, scoping descendants'
`position: fixed` to `.admin-content` (max-width 1200px) instead of the
viewport. Child side-panels/modals then got clipped on the right edge.

CLAUDE.md frontend rules warn about exactly this pattern:
> Never apply CSS `filter`, `transform`, `will-change`, `contain: paint`,
> or `perspective` on layout containers. These create new containing
> blocks that break `position: fixed` modals/lightboxes.

Fix: removed the `to { transform: translateY(0) }` step. Animation now
ends with the element reverting to its base (transform-free) style, and
position:fixed resolves against the viewport.

### BUG #9 (LOW) — FIXED (this commit)

Singular/plural grammar off: "PUBLISH 1 DRAFTS" and "1 DRAFTS IN THIS
BATCH" with count=1. Fixed via explicit `count === 1` branching in
VelgPublishBatchModal and VelgContentDraftsList batch-bar.

### BUG #4/#5/#7 (LOW) — not blocking

- #4 Row Edit/Abandon icons hidden behind side-panel overlay when panel
  open. Expected modal behavior; row actions aren't usable while editing
  anyway.
- #5 Two close buttons when editor is inside side-panel (panel's X + the
  editor's own "× Close"). Harmless redundancy; the editor's internal
  head also surfaces pack/resource + version so we can't drop it wholesale.
- #7 The drafts-list card is partially covered by the semi-transparent
  backdrop when the editor is open. Again, expected overlay behavior.

### BUG #8 (FALSE POSITIVE)

Thought the TR corner-bracket of the drafts-list frame was missing. On
close inspection it renders correctly — the bracket is faint but present
at the card's top-right (just hard to see against the "NEW DRAFT" button
in small screenshots).

## Non-bug observations worth noting

- Save-toast visible ~3s; my E2E test's `wait_for("Draft saved")` timed
  out because the toast had already faded by then. Not a bug — the toast
  fires on save, we just raced it.
- Full-page screenshot with panel open shows the drafts-list's pagination
  controls covered by the panel overlay. Fine (admin can't paginate while
  editing).

## Migration / DB state

- 1 test draft created during playtest, then ABANDONED to leave the DB
  tidy. Visible under "Abandoned" tab until cleanup.
- No real GitHub PR was opened. Publish flow stopped at the modal layer.

## Remaining work before final push

- Commit the cluster of fixes (Phase 3 Option B backend + frontend
  cascading select + panel-width + AdminPanel transform + singular/plural).
- Optional follow-up: explore whether the editor's internal title should
  be dropped in favor of only the side-panel header title (bug #5). Keep
  deferred — the internal head also carries version + created-at info,
  non-trivial to consolidate cleanly.

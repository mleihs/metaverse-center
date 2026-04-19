---
title: A1.7 UI Research Findings & Architecture Plan
date: 2026-04-19
status: research-complete
authors: 7 parallel research agents, synthesized
---

# A1.7 UI Research Findings & Architecture Plan

## Executive Summary

Seven parallel research agents investigated production patterns for a draft-to-PR content
workflow across ~40 tools (Tina, Decap, Keystatic, Sanity, Contentful, Strapi, Directus,
Notion, Payload, Storyblok, Prismic, TinaCMS, GitHub, GitLab, Linear, Graphite, Vercel,
Figma, Google Docs, Are.na, Linear, Cron, Observable, Val Town, Supabase, Raycast, Arc,
Astro, Zod, Formik, TanStack Form, Remix, SvelteKit, plus primary-source engineering blogs
and libraries from Liveblocks, Yjs, Automerge, PlanetScale, libgit2, PyJWT, Octokit).

**Four primary decisions emerged, all mutually consistent:**

1. **Architecture**: GitHub App + GraphQL `createCommitOnBranch` + stateless (no local
   clone). Perfect fit for our FastAPI-on-Railway ephemeral filesystem. No new infra
   beyond `PyJWT[crypto]`.

2. **Concurrency**: Two-level optimistic locking — DB `version` column (intra-edit) +
   GitHub `expectedHeadOid` (at-publish) + pre-publish field-level 3-way merge in Python.
   Presence sliver via Supabase Realtime as phase 3.

3. **Editor UX**: Schema-driven `FieldRenderer` with 3-column field anatomy
   (label | input | gutter-for-validation-and-presence). Side-by-side bilingual
   (EN∥DE) preserved. JSON shape editor for closed-schema JSONB. Combobox reference
   picker with typeahead.

4. **Aesthetics**: Refined brutalism — 1px hairline borders (not 3px kitsch), mono for
   labels/identifiers only (not prose), near-black `#0A0B0D` (not `#000`), accent amber
   rationed to primary actions, offset shadows on hover only.

Additionally, **seven A1.6 retrofits** identified (4 P0 correctness/style, 3 P1 cleanliness)
are documented in Part 7 and shipped in a separate commit.

---

## Part 1 — Git-Backed CMS Architecture

### Comparison Table (from Agent 1)

| CMS | Backend host | Workspace strategy | Token auth | Conflict handling | Atomic multi-file commits |
|---|---|---|---|---|---|
| Decap CMS | Client-only + OAuth proxy | Stateless Git Data API | User OAuth (PAT-like) | Merge-time only | Yes (Trees API) |
| Tina self-hosted | Serverless + DB cache | Stateless Contents API | PAT in env | Per-file blob SHA | No (one call per file) |
| **Keystatic GitHub** | Thin Node (OAuth only) + client GraphQL | **Stateless GraphQL** | **Per-project GitHub App + user OAuth** | **`expectedHeadOid` + tree-key diff** | **Yes (`createCommitOnBranch`)** |
| Forestry (legacy) | Persistent VM + git clone | Long-lived workspace | Server PAT | `git pull --rebase` | Yes (native git) |
| Payload | Persistent Node | DB as source | PAT via plugin | Domain-specific | Via plugin |

### Decision: Adopt the Keystatic pattern

Five non-obvious insights drive the choice:

1. **The Git Data / GraphQL API makes a persistent clone unnecessary.** Every mature
   git-backed CMS has abandoned local clones. Railway's ephemeral FS is the *intended*
   deployment profile, not a compromise.

2. **`createCommitOnBranch` is the modern primitive.** One GraphQL mutation replaces the
   5-step blob/tree/commit/ref dance, carries `expectedHeadOid` optimistic concurrency,
   and uniquely auto-signs commits as "Verified" when called via a GitHub App
   installation token. The REST Git Data API cannot produce verified bot commits without
   server-side GPG-key management.

3. **Tree-key optimistic concurrency is strictly better than per-file blob SHA.** Tina's
   per-file SHA check fails only when the exact file changes; Keystatic's
   `expectedHeadOid` + tree-key pattern fails any time the relevant subtree changed,
   and succeeds to retry automatically if the change was elsewhere in the tree. For
   concurrent admin editing this is the right default.

4. **Branch-per-draft is a feature, not a mechanism.** Decap forces it (one branch per
   entry, PR labels for status), Keystatic makes it orthogonal (one branch can hold many
   drafts, PR is just "I'm done"). For 1-10 admins with YAML that often touches multiple
   files together, a single per-publish-batch branch is lighter than one-branch-per-draft
   and avoids PR-label state machines.

5. **Drafts in a DB and commits via API are complementary, not a tradeoff.** The DB is
   the authoritative *draft* store (never lost, Postgres-versioned), git is the
   authoritative *published* store. Publish = atomic projection from DB → YAML → one
   GitHub commit + PR. The two layers never contradict because "published" is a
   Postgres column, not a separate git state.

### Concrete architecture for our stack

**Token management**: GitHub App ("Velgarien Content Publisher") installed on
`mleihs/velgarien-rebuild` with `contents:write`, `pull_requests:write`,
`metadata:read`. Store `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`,
`GITHUB_APP_INSTALLATION_ID` in Railway env vars. Sign JWT with `PyJWT[crypto]` (10-min
expiry) → exchange for installation token (1-hour expiry, cached in Postgres or memory).

Rationale: GitHub App installation tokens inherit 5,000-12,500 req/hr (independent of
human user rate limits), auto-rotate, and produce Verified commits — important because
published content traces back to a bot identity, not a shared PAT masquerading as human.

**Worktree strategy**: Stateless. One `httpx` POST to GitHub GraphQL per publish:

```python
MUTATION = """
mutation($input: CreateCommitOnBranchInput!) {
  createCommitOnBranch(input: $input) { commit { oid } }
}"""

async def publish(file_changes: list[FileChange], branch: str, head_oid: str):
    token = await installation_token()
    async with httpx.AsyncClient() as client:
        r = await client.post(
            "https://api.github.com/graphql",
            headers={"Authorization": f"Bearer {token}"},
            json={"query": MUTATION, "variables": {"input": {
                "branch": {"repositoryNameWithOwner": "mleihs/velgarien-rebuild",
                           "branchName": branch},
                "expectedHeadOid": head_oid,
                "message": {"headline": f"content: publish {len(file_changes)} drafts"},
                "fileChanges": {
                    "additions": [
                        {"path": f.path, "contents": b64encode(f.bytes).decode()}
                        for f in file_changes
                    ],
                    "deletions": [],
                },
            }}})
    return r.json()
```

Rejected alternatives:
- `pygit2` (needs libgit2 binary + workspace)
- `GitPython` (maintainer warns against long-running-process use)
- `subprocess git` (non-atomic, crash-unsafe, breaks on pod restart)

**DB schema (new migration)**:

```sql
CREATE TABLE content_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL,
    entity_key TEXT NOT NULL,
    yaml_path TEXT NOT NULL,
    content JSONB NOT NULL,
    base_sha TEXT,
    base_version INT NOT NULL DEFAULT 1,
    author_id UUID REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'draft'
           CHECK (status IN ('draft', 'publishing', 'published',
                              'conflicted', 'failed', 'abandoned')),
    pr_number INT,
    pr_url TEXT,
    error_message TEXT,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (entity_type, entity_key, author_id)
      WHERE status IN ('draft', 'conflicted')
);
```

**Publish flow**:
1. Open transaction, `SELECT … FOR UPDATE` drafts being published, mark `publishing`.
2. Resolve `main` HEAD via `repository(…){ ref("refs/heads/main"){ target { oid } } }`.
3. Create branch `content/publish-{uuid}` via REST `POST /git/refs`.
4. Serialize each draft → YAML string (existing `yaml.safe_dump`).
5. **Single `createCommitOnBranch` mutation** with all file changes in one commit,
   `expectedHeadOid = head_oid`. Atomic.
6. `POST /repos/.../pulls` to open PR with body auto-populated from draft metadata
   (Combined-PR digest pattern, per Agent 3).
7. On success: mark drafts `published`, set `pr_number`, emit audit log.
8. On `STALE_DATA` or conflict: mark `conflicted`, surface to user.

**Webhook**: Register for `pull_request.closed{merged:true}` only. HMAC-verify.
On receipt → mark matching draft `merged` for UI state. Webhooks are not in the
publish critical path — they're the closing ack.

---

## Part 2 — Concurrency Model

### Three architecture options (from Agent 6)

| Option | Approach | LOC | Complexity | Fit |
|---|---|---:|---|---|
| **A — Minimal** | Version column + stale banner + whole-draft rebase | ~500 | Simple | Too coarse — loses work |
| **B — Medium** | Field-level 3-way merge + deploy queue + conflict resolver | ~1100 | Medium | **Recommended** |
| **C — Ambitious** | Real-time presence + CRDT sync (Liveblocks/Yjs) | ~2000+ | Heavy | Overkill — Railway FS hostile, silent LWW merges bad for authored prose |

### Decision: Option B + presence sliver

Four reasons Option B wins for our context:

1. **Our content model already matches it.** Drafts are per-admin per-item rows with
   field patches. Field-level 3-way diff is natural — not a retrofit. Matches Sanity's
   "one version per document per release" invariant.

2. **Railway ephemeral FS rules out self-hosted Yjs.** Option C needs Redis or
   Liveblocks, which is disproportionate to 1-10 admins, non-hot content, and no
   stated real-time requirement.

3. **YAML is line-oriented and reviewable.** Field-level merge in Python at queue time
   produces a clean PR. Falls back to standard Git conflict markers + GitHub web
   resolver (Oct 2025) for the rare tail.

4. **PlanetScale's pre-validation pattern** ("early warning while queued") fits admins
   who draft for hours before publishing. Surface conflicts at draft-save time, not only
   at publish.

### Merge algorithm (Python, `merge_service.py`)

```python
def three_way_merge(base: dict, mine: dict, theirs: dict) -> MergeResult:
    """Field-level 3-way merge matching PlanetScale's schemadiff pattern.

    For each field:
      - Unchanged in both: take base
      - Changed only in mine: take mine
      - Changed only in theirs: take theirs
      - Same value in both: non-conflict, take either
      - Different values: conflict, require admin resolution
    """
    conflicts = []
    merged = {}
    for field in set(base) | set(mine) | set(theirs):
        b, m, t = base.get(field), mine.get(field), theirs.get(field)
        if m == b and t == b:      merged[field] = b
        elif m == b and t != b:    merged[field] = t
        elif t == b and m != b:    merged[field] = m
        elif m == t:               merged[field] = m  # non-conflict
        else:                      conflicts.append(FieldConflict(field, b, m, t))
    return MergeResult(merged=merged, conflicts=conflicts)
```

### Conflict-resolver UI (three-button pattern, aligned to GitHub Oct-2025 muscle memory)

Three canonical buttons per field conflict, matching the 3-button GitHub web resolver:

| Button | Action |
|---|---|
| `ACCEPT CURRENT` (theirs) | Discard admin's change, keep main-branch value |
| `ACCEPT INCOMING` (mine) | Overwrite main with admin's draft value |
| `ACCEPT BOTH` | Concatenate / merge (context-specific — for free-prose fields) |

Plus an escape hatch `[Rebase onto main instead]` (one-click, runs `git rebase origin/main`
equivalent server-side via `createCommitOnBranch` with new base OID).

### Presence sliver (phase 3, optional)

Supabase Realtime channel broadcasting `{draft_id, admin_id, last_heartbeat}` every 15s.
Rendered as avatar stack on the draft editor. No cursors, no field-focus indicators —
just "Bob is also editing this." ~200 LOC, uses infra we already have, pre-empts 80%
of conflicts by awareness alone.

---

## Part 3 — Inline Editor Patterns

### 14 patterns extracted (from Agent 2)

Consensus findings across Sanity, Contentful, Strapi, Directus, Notion, Keystatic,
Storyblok, Prismic, Payload, and TinaCMS:

1. **Runtime schema interpretation** — no codegen. A widget registry keyed by type
   dispatches to a form-renderer. Every mature CMS does this.
2. **Editor-interface override** — schema says what the data *is*; editor interface
   says how it's *entered*. Our `trigger` field (dropdown) vs free text (textarea) are
   the same `Symbol` type.
3. **Three-column field anatomy** — `[label+description] [input] [validation+presence gutter]`.
   Sanity canonicalized this in their Form Components Reference.
4. **Side-by-side bilingual** wins for ≤3 locales (our case: 2). Locale tabs only when
   ≥5 locales. Translatable-checkbox only for mixed-agnostic datasets.
5. **Dirty-state via status pill** (`[DRAFT]` / `[MODIFIED]` / `[PUBLISHED]`) — not
   just Save button state. Storyblok's 4-state system is the canonical pattern.
6. **Save vs Publish separation** — Payload autosaves to a single version every ~800ms;
   Publish is explicit.
7. **Form-within-form for JSONB** — known-shape → nested typed rows; unknown-shape →
   CodeMirror raw editor fallback.
8. **Typeahead combobox reference picker** — never a native `<select>` for >20 items.
   Debounced, virtualized, chip with `[×]` after selection.
9. **Click-to-edit from preview** — TinaCMS/Storyblok pattern; click rendered element
   scrolls + focuses form field.
10. **Inline + gutter marker + footer summary validation** (triple layer, per Sanity).
11. **Portable Text / Lexical for rich text** — overkill for our terminal-style prose.
    Plain monospace textarea with char-count badge suffices.
12. **Presence indicators** — avatar stack in field gutter. Phase 3 feature.
13. **Minimal keyboard shortcuts** — `Cmd+S` save, `Cmd+Enter` save+next, `Esc` close,
    `?` help, never override Tab in textareas (Payload anti-pattern).
14. **Live preview side-by-side** — left preview / right form (Storyblok) or inverse
    (TinaCMS). Our existing `<velg-dungeon-terminal-preview>` already fits.

### Recommended v2 structure for `<velg-dungeon-content-editor>`

Refactor from the current per-content-type `if/else` in 986 LOC to a schema-driven
FieldRenderer:

```
frontend/src/components/admin/
├── DungeonContentEditor.ts              # ~300 LOC orchestrator (was 986)
├── fields/
│   ├── FieldRenderer.ts                 # dispatch by schema.type → widget
│   ├── BilingualTextareaField.ts        # side-by-side EN∥DE
│   ├── JsonShapeField.ts                # known-shape JSONB form
│   ├── JsonRawField.ts                  # CodeMirror fallback
│   ├── ReferencePickerField.ts          # typeahead combobox
│   ├── IntegerRangeField.ts             # slider + number input
│   ├── EnumSelectField.ts               # dropdown from schema.options
│   └── SlugField.ts                     # kebab-case with validation
└── schemas/                              # schema descriptor per content type
    ├── banter.schema.ts
    ├── encounters.schema.ts
    ├── enemies.schema.ts
    └── ...
```

Each field widget implements:
```ts
interface FieldWidget<T> {
  render(value: T, schema: FieldSchema, onChange: (v: T) => void): TemplateResult;
  validate(value: T, schema: FieldSchema): ValidationIssue[];
}
```

### Bilingual refinements (keep side-by-side, add three borrowings)

1. **From Sanity fieldsets**: gutter `●` indicator when EN and DE char-counts diverge
   by >30% (likely translation gap).
2. **From Strapi**: one-shot `⟶ fill DE` button in EN gutter (single-click copy, no
   live linking).
3. **From Payload**: explicit `filterAvailableLocales` behind a future flag.

---

## Part 4 — PR-Workflow UI

### Draft state machine (consolidated from Agents 3 + 6)

```
                      +----------+
                      |  DRAFT   |  local, editable
                      +----+-----+
                           |  user clicks "Publish Drafts (N)"
                           v
                      +----------+
                      |SUBMITTING|  backend creating branch + PR
                      +----+-----+
                           |
              (success)    |    (api_error)
        +-----------------+ +-----------------+
        v                                     v
  +-----------+                         +-----------+
  |PUBLISHING |   [PR open, CI runs]    |  FAILED   |--+
  +--+--+-----+                         +-----+-----+  |
     |  |                                     |        |
     |  | webhook: PR.closed(merged=true)     |  (retry)
     v  v                                     +--------+
  +------------+      +-------------+
  | PUBLISHED  |      |  CONFLICTED |  webhook: mergeable_state=dirty
  +------------+      +------+------+
                             |
              (auto)         |     (manual: resolve inline)
        +------------------+ +------------------+
        v                                       v
 +--------------+                         +-------------+
 |AUTO-REBASED  |  merge-tree succeeded   |  RESOLVING  |  3-button editor
 +--------------+                         +------+------+
        |                                        |
        +------> back to PUBLISHING <------------+
                                                 |
                          (user: "Abandon")      |
                                                 v
                                        +---------------+
                                        |   ABANDONED   |  PR closed, archived
                                        +---------------+
```

### State badges (aligned to GitHub Octicon + color conventions)

| State | Label | Icon | Background | Foreground |
|-------|-------|------|------------|------------|
| DRAFT | `DRAFT` | open-arrow outline | `var(--color-neutral-bg)` | `var(--color-text-secondary)` |
| SUBMITTING | `SUBMITTING…` | spinner | `var(--color-info-bg)` | `var(--color-info)` |
| PUBLISHING | `● OPEN` | filled dot | `var(--color-success-bg)` | `var(--color-success)` |
| CONFLICTED | `▲ CONFLICT` | warning triangle | `var(--color-danger-bg)` | `var(--color-danger)` |
| FAILED | `✕ FAILED` | X glyph | `var(--color-danger-bg)` | `var(--color-danger)` |
| PUBLISHED | `⌾ MERGED` | twist-arrow | `var(--color-done-bg)` (new) | `var(--color-done)` (purple) |
| ABANDONED | `ABANDONED` | archive | `var(--color-muted-bg)` | `var(--color-text-tertiary)` |

Dual-coding (color + shape) for WCAG accessibility. New token `--color-done` (merged
purple) needs adding to Tier-2.

### `<velg-my-drafts>` panel layout (ASCII mockup)

```
+----------------------------------------------------------------------+
| MY DRAFTS                           [Publish Drafts (3)]  [⋮]        |
+----------------------------------------------------------------------+
| ▸ LOCAL (3)                                                          |
|   ┌────────────────────────────────────────────────────────────┐    |
|   | [DRAFT] The Overthrow — loot revision    edited 4m ago  ☑ |    |
|   | content/dungeon/archetypes/overthrow/loot.yaml            |    |
|   | [ Edit ] [ Preview ] [ Delete ]                           |    |
|   └────────────────────────────────────────────────────────────┘    |
|                                                                      |
| ▸ SUBMITTED (2)                                                      |
|   ┌────────────────────────────────────────────────────────────┐    |
|   | [● OPEN] PR #482 Content drop 2026-04-19   opened 12m ago |    |
|   |  3 of 4 checks green    ⧗ CI running    auto-merge: on    |    |
|   |  Bundles: overthrow-loot, agent-bonds-v3, resonance-css    |    |
|   |  [ View on GitHub ↗ ]                                      |    |
|   └────────────────────────────────────────────────────────────┘    |
|   ┌────────────────────────────────────────────────────────────┐    |
|   | [▲ CONFLICT] PR #481 Sitrep wording fix   opened 2h ago   |    |
|   |  ⚠ Merge conflict in backend/services/sitrep.py            |    |
|   |  [ Resolve inline ] [ Rebase & retry ] [ Abandon ]         |    |
|   └────────────────────────────────────────────────────────────┘    |
|                                                                      |
| ▸ PUBLISHED (last 7d, 4)                                             |
|   ⌾ #479 Typography tokens         merged 1d ago                     |
|   ⌾ #478 Banter additions          merged 2d ago                     |
+----------------------------------------------------------------------+
```

### Publish-batch confirmation modal (Combined-PR digest)

Modal titled `PUBLISH 3 DRAFTS AS 1 PR`. Two sections:

1. **Bundle preview** — checkbox list of selected drafts (pre-checked), each row
   shows title + file path + diff stats. "Select/Deselect all" header.
2. **PR metadata** — pre-populated editable:
   - Title: `Content drop {YYYY-MM-DD} ({N} drafts)`
   - Body: markdown bullet list per draft (auto-filled per Agent 3's P14 + P9)
   - Target branch: `main` (read-only)
   - `☑ Auto-merge when green`
   - `☑ Squash commits`

Footer: `[CANCEL]` ghost + `[PUBLISH 3 DRAFTS →]` primary. Inline toast
"Opening PR…" during submission. Error → red sticky banner with GitHub error body.

---

## Part 5 — Validation UX

### Path-based error mapping (Agent 4)

Normalize all errors to a canonical dotted path. Pydantic `loc=("encounters", 0, "choices", 2, "partial_narrative_en")` becomes `"encounters.0.choices.2.partial_narrative_en"`. Every
form input carries a matching `data-path` attribute. On response, iterate errors, query
`[data-path=...]`, toggle invalid state.

```typescript
export function locToPath(loc: readonly (string | number)[]): string {
  return loc.map(String).join('.');
}

export function locToLabel(loc: readonly (string | number)[]): string {
  return loc.map((s, i) =>
    typeof s === 'number'
      ? `#${s + 1}`
      : i === 0 ? s.replace(/_/g, ' ') : ` → ${s.replace(/_/g, ' ')}`
  ).join('');
}

// ("encounters", 0, "choices", 2, "partial_narrative_en")
//   → "encounters #1 → choices #3 → partial narrative en"

function applyErrors(root: ShadowRoot, errors: BackendError[]) {
  const byPath = groupBy(errors, e => locToPath(e.loc));
  root.querySelectorAll('[data-path][aria-invalid="true"]')
    .forEach(el => el.setAttribute('aria-invalid', 'false'));
  for (const [path, errs] of byPath) {
    const input = root.querySelector<HTMLElement>(`[data-path="${CSS.escape(path)}"]`);
    if (!input) {
      captureError(new Error(`Unmapped validation path: ${path}`),
                   { source: 'ContentEditor.applyErrors' });
      continue;
    }
    input.setAttribute('aria-invalid', 'true');
  }
  if (byPath.size < 3) {
    root.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }
}
```

### Timing: blur-based "reward early, punish late"

Validate a field only when it loses focus for the first time. Once marked invalid,
switch to on-change for that specific field (immediate positive feedback on correction).
Empty required fields validated only on submit — never during typing (Formik default,
Smart Interface Design Patterns, NN/G #7).

### Severity: error vs warning

Two severity levels, different ARIA/color/icon treatment:

| Severity | Color | Icon | ARIA | Blocks publish? |
|---|---|---|---|---|
| Error | `--color-danger` | `✕` | `role="alert"` `aria-live="assertive"` | Yes |
| Warning | `--color-warning` | `⚠` | `role="status"` `aria-live="polite"` | No |

Sanity precedent: `rule.error()` blocks publish, `rule.warning()` is advisory. Our existing
validator split (violations vs warnings in `scripts/validate_content_packs.py`) already
matches this pattern.

### Recommendation matrix

| Error class | Severity | Inline | Summary | Block publish? | Block draft save? |
|---|---|---|---|---|---|
| Pydantic type/required (single field) | error | yes | if ≥3 | yes | no |
| Pydantic cross-field (check_aptitude pair) | error | on dependent + hint on trigger | if ≥3 | yes | no |
| FK integrity (encounter → spawn) | error | yes (monospace ID + filename) | always | yes | yes |
| Duplicate global ID | error | yes (+ "see line 42") | always | yes | yes |
| Missing partial narrative | warning | yes (amber) | collapsible | no | no |
| Network/server 500 | error | no | no — toast | n/a | n/a |
| Unsaved-edit leave | n/a | no | no — confirm dialog | n/a | n/a |

### Accessibility checklist (Lit 3 Shadow DOM specifics)

1. `aria-invalid="true"` toggled (not re-rendered) to avoid focus loss.
2. `aria-describedby` must reference element **inside the same shadow root** — cross-root
   IDREFs don't resolve. Render error `<div>` in the same Lit template.
3. Persistent `<div aria-live="assertive" aria-atomic="true" role="alert">` at page load —
   iOS VoiceOver ignores late-inserted live regions.
4. Focus management: <3 errors → first invalid input; ≥3 → summary banner with `tabindex="-1"`.
5. Use `ValidityState` internally, render messages ourselves. Don't use `reportValidity()`
   tooltips — Primer, GOV.UK, Pope Tech all document inaccessibility.

---

## Part 6 — Brutalist Aesthetics

### Refined vs costume brutalism (Agent 5)

**Refined** (Are.na, Linear, Vercel, Cron, Observable): 1px hairline borders, mono for
labels only, near-black `#08090A`, one accent rationed, offset shadows on hover only,
aggressive type-scale (5:1+), structural grid via alignment.

**Costume** (brutalism.tailwinddashboard, brutalistui.site): 3px black borders, 4px offset
shadows on everything, emojis in chrome, rounded corners inconsistently, filled yellow/neon
chips, kawaii illustrations. **Anti-pattern — we already avoid this.**

### 15 concrete brutalist techniques

1. **Mono as label language, not body language** — reserve Courier for
   `<velg-section-label>`, `<kbd>`, identifiers. Never prose.
2. **Aggressive negative tracking on display type** — `-0.06em` on 64px headings
   (Vercel, Linear, Cron).
3. **Extreme scale contrast, single family** — 64px display / 12px label, skip the
   muddy middle.
4. **Hairline 1px, not chunky 3px** — 1px dashed/solid, never decorative thickness.
5. **Dotted/dashed used semantically** — dashed = draft/pending; solid = committed.
6. **Offset shadows as hover, not default** — `transform: translate(-1px, -1px)` on
   `:hover` only; resting state flush.
7. **Structural grid visible via alignment, not lines** — Are.na's tile grid has no
   dividers.
8. **Near-black, never `#000`** — `#0A0B0D` preserves text antialiasing.
9. **One saturated accent, fiercely rationed** — amber for primary CTA, active nav,
   in-progress state only.
10. **Mono-numeral tabular data** — `font-variant-numeric: tabular-nums` free refinement.
11. **Keyboard hints as inline chrome** — `⌘K` in search placeholder, not hidden.
12. **Breadcrumbs with `/` separator in mono** — `velgarien / drafts / #481`.
13. **Pill-rect status tokens, tiny caps** — 10-11px mono, 1px outline, rectangular.
14. **No emoji in UI chrome** — use `▸ ↗ ↵ ⌘ ↑ ⇥` glyphs.
15. **No illustrations for empty states** — "No drafts yet" beats a cute icon.

### Token additions needed

```css
/* New Tier-1 */
--space-hairline:   1px;      /* border default */
--radius-chip:      2px;      /* status pills only */
--track-display:    -0.06em;
--track-label:       0.08em;  /* uppercase breathing */

/* State via border-style */
--border-draft:     1px dashed var(--color-border);
--border-committed: 1px solid  var(--color-border);
--border-conflict:  1px dashed var(--color-danger);
--border-active:    1px solid  var(--color-accent);

/* Hover transforms (brutalist tactile) */
--hover-lift:       translate(-1px, -1px);
--active-sink:      translate(1px, 1px);

/* New merged-state token */
--color-done:       #7E5FB4;   /* merged purple, GitHub convention */
--color-done-bg:    color-mix(in srgb, var(--color-done) 8%, transparent);
```

### Anti-patterns to avoid

- 3px borders + 4px offset shadows everywhere (Windows-98 cosplay)
- Yellow/neon-green fills in chip backgrounds (kawaii)
- Default system fonts (Arial 16px brutalism)
- Rounded corners on half components, sharp on others
- Emojis in UI chrome
- Three weight families at once
- Drop shadows on dark surfaces (use inset borders or bright 1px top-line instead)
- Centered hero text in admin views
- Filled gradient loading bars
- Illustrations for empty states

---

## Part 7 — A1.6 Retrofits (shipping immediately, separate commit)

### P0 — Must fix before A1.7

1. **Button variant semantic mismatch** (`DungeonContentEditor.ts:574`)
   - Current: `.btn.btn--ghost.btn--sm` on GitHub deep-link
   - Correct: `.btn.btn--info.btn--sm` — semantically "navigate / view more"
   - Applies to both the tab banner link and the editor footer button

2. **Missing accessible new-tab label** (both files)
   - Current: icon-only `${icons.externalLink()}` with `title=` attribute
   - Correct: add `aria-label=${msg('... (opens in new tab)')}` OR include
     "(opens in new tab)" in visible label

3. **i18n string fragmentation** (`AdminDungeonContentTab.ts:353-357`)
   - Current: 3 `msg()` chunks around inline `<code>content/dungeon/</code>`
   - Correct: single `msg()` with backticks in-string, CSS for code highlighting

4. **CSS fallback inconsistency** (`AdminDungeonContentTab.ts:93` vs `:161`)
   - Current: `var(--font-mono, monospace)` vs `var(--font-mono)` (mixed)
   - Correct: all `var(--font-mono)` — Tier-1 tokens guaranteed by ThemeService

### P1 — Nice-to-have

1. **Extract `admin-info-banner-styles.ts`** — the `.source-notice` pattern will repeat
   in other admin tabs (caching, models, sync-status banners).

2. **Use `<velg-section-header>` component** — `VelgSectionHeader.ts` exists! I used
   raw `.section-header` div. Should be the component.

3. **Extract `renderExternalLink()` utility** — the `target="_blank"` + `rel="noopener
   noreferrer"` + icon + aria pattern repeats. One helper in `frontend/src/utils/`.

### P2 — Maybe-maybe-not

1. 768px breakpoint choice (OK, consistent with `adminGlobalCardStyles`).
2. Hardcoded `PACKS_ROOT_URL` (fine for single-repo project, extract to env if multi-deploy).

---

## Part 8 — Phased Implementation Plan for A1.7

### Phase 1: Foundation (A1.7a, 3-4 commits, ~1 week)

- Migration: `content_drafts` table + webhook-ingest table
- `backend/services/github_app.py` — installation token cache, GraphQL client
- `backend/services/content_drafts_service.py` — CRUD extending `BaseService`
- Unit tests with mocked GitHub GraphQL
- No UI changes yet — backend foundation only

### Phase 2: Publish flow (A1.7b, 4-5 commits, ~1 week)

- `backend/services/content_packs/publish.py` — batch publish via `createCommitOnBranch`
- Webhook handler `backend/routers/webhooks/github.py` for PR state
- `backend/routers/admin/drafts.py` — admin CRUD endpoints + publish endpoint
- Integration tests (live sandbox repo or mocked)

### Phase 3: Editor refactor (A1.7c, 5-6 commits, ~1 week)

- `<velg-field-renderer>` + widget atoms (`BilingualTextareaField`, `JsonShapeField`, etc.)
- Schema descriptors per content type under `frontend/src/components/admin/schemas/`
- Refactor `DungeonContentEditor` to schema-driven (986 → ~300 LOC)

### Phase 4: My-Drafts UI (A1.7d, 3-4 commits, ~1 week)

- `<velg-my-drafts>` master panel
- Draft state badges + token additions (`--color-done` etc.)
- Publish-batch confirmation modal
- `<velg-admin-info-banner>` shared component (extraction from A1.6)

### Phase 5: Conflict resolver (A1.7e, 3-4 commits, ~1 week)

- `merge_service.py` (field-level 3-way merge)
- Deploy queue (Postgres-backed, FIFO with pre-validation)
- `<velg-conflict-resolver>` UI (3-button + rebase escape)

### Phase 6 (optional): Presence sliver (A1.7f, 1-2 commits, ~2 days)

- Supabase Realtime channel for admin presence
- Avatar stack in editor header

### Phase 7 (optional): Polish (A1.7g, 2-3 commits, ~3 days)

- Validation UX refinements (path-based mapping, severity tokens)
- Keyboard shortcuts (`Cmd+S`, `Cmd+Enter`, `Esc`, `?`)
- Click-to-edit from preview (TinaCMS pattern)

**Total estimate**: ~20-25 commits, 4-6 weeks, no new infra beyond `PyJWT[crypto]`.

---

## Sources (selected primary references)

### Git-backed CMS architecture
- [Decap CMS Editorial Workflows](https://decapcms.org/docs/editorial-workflows/)
- [Tina Self-Hosted GitHub Provider](https://github.com/tinacms/tinacms/tree/main/packages/tinacms-gitprovider-github)
- [Keystatic source (updating.tsx)](https://github.com/Thinkmill/keystatic/tree/main/packages/keystatic/src/app/updating.tsx)
- [GitHub: A simpler API for authoring commits](https://github.blog/changelog/2021-09-13-a-simpler-api-for-authoring-commits/)
- [Asana/push-signed-commits (reference impl)](https://github.com/Asana/push-signed-commits)

### PR-workflow UI
- [GitHub Octicons state conventions](https://github.blog/changelog/2021-06-08-new-issue-and-pull-request-state-icons/)
- [GitHub one-click merge conflict resolution (Oct 2025)](https://github.blog/changelog/2025-10-02-one-click-merge-conflict-resolution-now-in-the-web-interface/)
- [github/combine-prs action](https://github.com/github/combine-prs)
- [Graphite: Visualize a stack](https://graphite.com/docs/visualize-stack)

### Concurrency patterns
- [PlanetScale: Three-way merge for schema changes](https://planetscale.com/blog/database-branching-three-way-merge-schema-changes)
- [Figma: How and why we built branching](https://www.figma.com/blog/how-and-why-we-built-branching/)
- [Sanity Releases: Introducing Content Releases](https://www.sanity.io/blog/introducing-content-releases)
- [Operational Transformation — Google Docs algorithm](https://www.loremine.com/blogs/operational-transformation-algorithm-behind-google-docs)

### Editor UX patterns
- [Sanity Form Components Reference](https://www.sanity.io/docs/studio/form-components-reference)
- [Contentful Editor Interfaces](https://www.contentful.com/developers/docs/concepts/editor-interfaces/)
- [Strapi Content Manager (v5)](https://docs.strapi.io/cms/features/content-manager)
- [TinaCMS Click-to-Edit Blog](https://tina.io/blog/Click-to-Edit-Comes-to-Visual-Editing)

### Validation UX
- [Zod Error Formatting](https://zod.dev/error-formatting)
- [Pydantic Validation Errors](https://docs.pydantic.dev/latest/errors/validation_errors/)
- [NN/G: 10 Guidelines for Reporting Errors](https://www.nngroup.com/articles/errors-forms-design-guidelines/)
- [Primer Forms Pattern](https://primer.github.io/design/ui-patterns/forms/overview/)
- [W3C ARIA19: Using role=alert](https://w3c.github.io/wcag/techniques/aria/ARIA19)

### Brutalist aesthetics
- [Are.na](https://www.are.na)
- [Linear](https://linear.app)
- [Vercel Geist Design System](https://vercel.com/geist/introduction)
- [Notion Calendar design guide (Blake Crosley)](https://blakecrosley.com/guides/design/notion-calendar)
- [NN/G on Neobrutalism usability](https://www.nngroup.com/articles/neobrutalism/)
- [nat.io: Brutalist Design Principles](https://nat.io/blog/brutalist-design-principles)

### Full agent reports (for detail)
Full ~17,000-word research transcripts from the 7 parallel agents are preserved in the
task runner's output files. This doc consolidates the decision points and patterns; the
full reports include additional details, source code citations, and extended examples
useful for implementation reference.

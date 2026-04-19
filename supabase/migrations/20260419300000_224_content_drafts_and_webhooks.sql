-- Migration 224: Content drafts + GitHub webhook event store (A1.7 Phase 1)
--
-- Establishes the persistence layer for the admin content-draft workflow.
-- Admins edit content through the web UI; each edit is tracked as a draft
-- until published via `createCommitOnBranch` GraphQL (see backend/services/
-- github_app.py in commit 2 of this phase).
--
-- Two tables:
--   content_drafts         — one draft = one resource edit; batched into
--                            a single commit at publish time.
--   github_webhook_events  — ingestion store for GitHub webhooks
--                            (PR close → mark draft merged).
--
-- Concurrency model (see docs/concepts/a1-7-ui-research-findings.md §2):
--   - `version` (INT) provides intra-edit optimistic concurrency at the DB
--     level (PlanetScale pattern).
--   - `expected_head_oid` (TEXT) captures the `main`-branch SHA at the
--     moment the draft was opened; used as GraphQL `expectedHeadOid` at
--     publish time to detect main-branch-moved races.
--   - On conflict (either level), a field-level 3-way merge happens in
--     Python before publish (merge_service.py, later phase).
--
-- RLS:
--   - content_drafts: admins only (platform_admin or admin_user), enforced
--     via `is_platform_admin()` in USING/WITH CHECK.
--   - github_webhook_events: service_role only (no anon/authenticated
--     policies) — webhooks arrive at a backend endpoint, stored via
--     admin client.
--
-- References:
--   - docs/concepts/a1-7-ui-research-findings.md — design-of-record.
--   - memory/post-a1-research-resume-command.md §4 — locked-in decisions.

BEGIN;

-- ── content_drafts ────────────────────────────────────────────────────────

CREATE TABLE content_drafts (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Which YAML pack + resource is being edited.
    -- pack_slug: matches the YAML pack identifier under content/dungeon/
    --            (e.g., 'awakening_banter', 'shadow_encounters').
    -- resource_path: addressable path within the pack, e.g.,
    --                'banter[ab_01]', 'encounters.ew_intro.choices[0].text_de'.
    pack_slug               TEXT NOT NULL,
    resource_path           TEXT NOT NULL,

    -- Snapshot of the content at draft-open time — used as the merge base
    -- for field-level 3-way merge if a conflict surfaces before publish.
    base_sha                TEXT,
    base_content            JSONB NOT NULL,

    -- Current admin edit state — overwritten on every save.
    working_content         JSONB NOT NULL,

    status                  TEXT NOT NULL DEFAULT 'draft'
                                CHECK (status IN (
                                    'draft',      -- admin is actively editing
                                    'conflict',   -- base-content drifted on main; needs merge
                                    'published',  -- PR opened, awaiting merge
                                    'merged',     -- webhook confirmed PR merged
                                    'abandoned'   -- admin discarded draft
                                )),

    -- Optimistic concurrency: every update bumps `version`. Reads + writes
    -- MUST pass the last-seen version to catch concurrent edits from
    -- another admin session on the same draft.
    version                 INTEGER NOT NULL DEFAULT 1,

    -- GitHub integration: filled at publish time (commit SHA returned by
    -- createCommitOnBranch) and again on webhook receipt (PR merged).
    expected_head_oid       TEXT,
    commit_sha              TEXT,
    pr_number               INTEGER,
    pr_url                  TEXT,

    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at            TIMESTAMPTZ,  -- filled when status transitions to 'published'
    merged_at               TIMESTAMPTZ   -- filled on webhook receipt (pull_request.closed + merged)
);

-- ── Indexes ───────────────────────────────────────────────────────────────

-- List "my drafts" in the admin UI (most recent first).
CREATE INDEX idx_content_drafts_author_status_updated
    ON content_drafts (author_id, status, updated_at DESC);

-- Find open drafts on a given resource — used at draft-open time to
-- warn "another admin is already editing this" + for presence tracking.
CREATE INDEX idx_content_drafts_resource_open
    ON content_drafts (pack_slug, resource_path)
    WHERE status IN ('draft', 'conflict');

-- Find drafts awaiting merge (used by webhook handler to match
-- pull_request.closed events back to a draft row).
CREATE INDEX idx_content_drafts_pr_number
    ON content_drafts (pr_number)
    WHERE pr_number IS NOT NULL;

-- ── Trigger ───────────────────────────────────────────────────────────────

CREATE TRIGGER set_content_drafts_updated_at
    BEFORE UPDATE ON content_drafts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE content_drafts ENABLE ROW LEVEL SECURITY;

-- Platform admins can read all drafts (needed for conflict-resolution UI,
-- where one admin sees another admin's draft).
CREATE POLICY content_drafts_admin_select
    ON content_drafts
    FOR SELECT
    TO authenticated
    USING ((SELECT is_platform_admin()));

-- Platform admins can insert drafts (as themselves — author_id must match).
CREATE POLICY content_drafts_admin_insert
    ON content_drafts
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (SELECT is_platform_admin())
        AND author_id = (SELECT auth.uid())
    );

-- Platform admins can update any draft (conflict-resolution may require
-- a second admin to finalize someone else's draft).
CREATE POLICY content_drafts_admin_update
    ON content_drafts
    FOR UPDATE
    TO authenticated
    USING ((SELECT is_platform_admin()))
    WITH CHECK ((SELECT is_platform_admin()));

-- Platform admins can delete drafts (abandonment — also representable as
-- status='abandoned', but hard delete is preferred for GDPR hygiene on
-- content that never shipped).
CREATE POLICY content_drafts_admin_delete
    ON content_drafts
    FOR DELETE
    TO authenticated
    USING ((SELECT is_platform_admin()));


-- ── github_webhook_events ─────────────────────────────────────────────────

CREATE TABLE github_webhook_events (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- GitHub's X-GitHub-Delivery header — unique per webhook delivery.
    -- Used for idempotency: if GitHub retries delivery, we recognize it.
    delivery_id         TEXT NOT NULL UNIQUE,

    -- Event type from X-GitHub-Event header (e.g., 'pull_request', 'push').
    event_type          TEXT NOT NULL,

    -- Payload `action` field for events that carry one (e.g.,
    -- pull_request: 'opened' | 'closed' | 'reopened' | ...).
    action              TEXT,

    -- Full webhook payload — kept for debugging + audit. Trimmed on a
    -- retention schedule in a later phase.
    payload             JSONB NOT NULL,

    received_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at        TIMESTAMPTZ,
    processing_result   TEXT CHECK (processing_result IN ('success', 'error', 'ignored')),
    error_message       TEXT
);

-- delivery_id lookup is already served by the UNIQUE constraint's btree index
-- (`github_webhook_events_delivery_id_key`); no explicit index needed.

CREATE INDEX idx_github_webhook_events_type_action_received
    ON github_webhook_events (event_type, action, received_at DESC);

CREATE INDEX idx_github_webhook_events_unprocessed
    ON github_webhook_events (received_at)
    WHERE processed_at IS NULL;

-- RLS: service_role only. Webhooks are received at a backend endpoint
-- that uses the admin client; no user ever reads this table directly.
ALTER TABLE github_webhook_events ENABLE ROW LEVEL SECURITY;
-- No policies — default-deny for anon and authenticated; service_role
-- bypasses RLS by design.

COMMIT;

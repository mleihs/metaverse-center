-- Migration 225: Content-draft status invariants (A1.7 Phase 1 cleanup)
--
-- Defense-in-depth for the content-draft state machine. Migration 224 shipped
-- the table with a status enum but no cross-column guarantees — the DB could
-- hold `status='published'` with `published_at IS NULL`, or `pr_number=0`.
-- Self-audit finding F10 + F11 (see memory/a1-7-phase-1-self-audit-2026-04-19.md).
--
-- The Python service layer already enforces these invariants (mark_published/
-- mark_merged always set the timestamp alongside the status, and pr_number is
-- filled by GitHub's response which is always positive), but a stray
-- service_role write or a future migration could violate them without notice.
--
-- Why additive, not part of 224: 224 is already pushed; rewriting it would
-- force a `supabase db reset` that the user must never perform on prod.
-- Standalone migration keeps the commit chain linear.
--
-- References:
--   - memory/a1-7-phase-1-self-audit-2026-04-19.md §F10, §F11
--   - supabase/migrations/20260419300000_224_content_drafts_and_webhooks.sql

BEGIN;

-- ── Status ↔ timestamp invariants ────────────────────────────────────────
--
-- Postgres CHECK constraints are point-in-time, not transition: they cannot
-- reference OLD vs NEW. That's sufficient for our purposes — the guarantee
-- we want is that the row's *current* state is internally consistent.
--
-- Both constraints use the logical-implication shape
-- `(status = X AND timestamp IS NOT NULL) OR (status != X)`, which is
-- equivalent to `status = X → timestamp IS NOT NULL`.

ALTER TABLE content_drafts
    ADD CONSTRAINT content_drafts_published_invariant
    CHECK (
        (status = 'published' AND published_at IS NOT NULL)
        OR status != 'published'
    );

ALTER TABLE content_drafts
    ADD CONSTRAINT content_drafts_merged_invariant
    CHECK (
        (status = 'merged' AND merged_at IS NOT NULL)
        OR status != 'merged'
    );

-- ── PR-number sanity ─────────────────────────────────────────────────────
--
-- GitHub's pull-request numbers are always positive (1-based). A zero or
-- negative value would indicate a bug in the publish flow (e.g. surfacing
-- an uninitialized variable) rather than a legitimate value.

ALTER TABLE content_drafts
    ADD CONSTRAINT content_drafts_pr_number_positive
    CHECK (pr_number IS NULL OR pr_number > 0);

COMMIT;

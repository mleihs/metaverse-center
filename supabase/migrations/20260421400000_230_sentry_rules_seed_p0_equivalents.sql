-- Migration 230: Bureau Ops — seed sentry_rules with P0-equivalent entries
-- (P2.1 handover Deferral E).
--
-- Preserves the emergency-brake filtering that shipped with P0 as hardcoded
-- branches in backend/app.py::_ops_before_send. The P2.1 commit replaces
-- that function with a cache over this table; without the seeds the switch
-- would regress Sentry back to pre-P0 noise levels.
--
-- Rule list (see docs/plans/bureau-ops-implementation-plan.md §5.6 for
-- provenance):
--   1. IGNORE credit/quota-exhaustion bursts — these are ops signals, not
--      bugs, and the 2026-04-18 incident showed one of these can burn
--      1200+ events in minutes.
--   2. FINGERPRINT RateLimitError by (exc_type, model) — collapses 429
--      scatter across models into a single Sentry issue group.
--   3. FINGERPRINT ModelUnavailableError identically.
--   4. DOWNGRADE pydantic-ai ModelHTTPError to warning when the error
--      message carries a 402/403/503 status token. Rule-based matching is
--      slightly broader than the P0 branch on ``exc.status_code`` (which
--      is not accessible from sentry_rules match columns), but operators
--      can tighten the regex via the admin UI if it over-fires.
--
-- Idempotency: sentry_rules has no natural unique key suitable for ON
-- CONFLICT, so the migration relies on Supabase's migration-tracking
-- (`schema_migrations` dedup). Do not re-apply this file manually —
-- operators seeking to restore these defaults after a table wipe should
-- copy the INSERT statements ad-hoc.

INSERT INTO sentry_rules (
    kind,
    match_exception_type,
    match_message_regex,
    fingerprint_template,
    downgrade_to,
    note
) VALUES
    (
        'ignore',
        NULL,
        '(Key limit exceeded|insufficient_quota)',
        NULL,
        NULL,
        'P0-equivalent: drop OpenRouter credit/quota-exhaustion bursts entirely. These are ops signals, not actionable bugs. 2026-04-18 incident produced 1200+ events in minutes without this rule.'
    ),
    (
        'fingerprint',
        'RateLimitError',
        NULL,
        'openrouter.{exc_type}.{model}',
        NULL,
        'P0-equivalent: collapse rate-limit bursts into (type, model) groups instead of scattering across dozens of Sentry issues.'
    ),
    (
        'fingerprint',
        'ModelUnavailableError',
        NULL,
        'openrouter.{exc_type}.{model}',
        NULL,
        'P0-equivalent: collapse model-unavailable bursts into (type, model) groups.'
    ),
    (
        'downgrade',
        'ModelHTTPError',
        '\b(402|403|503)\b',
        NULL,
        'warning',
        'P0-equivalent: downgrade pydantic-ai ModelHTTPError for 402/403/503 to warning so Sentry error-budget does not eat them. Regex on message is broader than the P0 check on exc.status_code; tighten via admin UI if it over-fires.'
    );

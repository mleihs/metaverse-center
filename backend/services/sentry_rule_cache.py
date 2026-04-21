"""In-process cache + apply-engine for ``sentry_rules`` (P2.1).

Replaces the hardcoded rules that shipped with P0 (``backend/app.py::
_ops_before_send``) with a DB-driven cache. Rules live in ``sentry_rules``
(migration 228). Three complementary reload triggers keep the cache
fresh:

  * Lifespan startup in ``backend/app.py`` primes the cache before
    traffic arrives.
  * Admin mutations in
    :mod:`backend.services.sentry_rule_service` call ``reload`` directly
    after every insert/update/delete for sub-second visibility.
  * :class:`backend.services.sentry_rule_cache_refresher.SentryRuleCacheRefresher`
    ticks every 60 seconds and re-pulls the table so a missed mutation
    (transient DB error, multi-worker drift once we outgrow AD-1) can
    never leave the cache permanently stale.

Why not ``NOTIFY`` + LISTEN:
    Supabase Python client is HTTP-based (postgrest) and does not expose
    a persistent TCP connection for LISTEN. Multi-worker coordination
    would need a raw asyncpg connection — deferred until we outgrow a
    single worker. The 60-second refresher is the upper bound on
    staleness across any failure mode.

Thread-safety:
    Sentry's ``before_send`` runs on the SDK's synchronous event-flush
    thread. The cache snapshot is copied under a ``threading.Lock`` and
    returned as an immutable tuple — callers can read without contention
    and mutations complete atomically from the reader's perspective.

Behaviour contract (plan §7.1, §7.2):
    * ``ignore`` rules apply first. First match drops the event (``None``).
    * ``fingerprint`` rules apply second. First match sets
      ``event['fingerprint']`` from ``fingerprint_template``.
    * ``downgrade`` rules apply last. First match sets ``event['level']``
      to ``downgrade_to``.
    * Within a kind, rules sort by ``created_at`` ASC (D-1).
    * An empty cache (not-yet-loaded at startup) is a no-op — events pass
      through unchanged. Lifespan-driven ``reload()`` populates the cache
      before normal request traffic arrives.
"""

from __future__ import annotations

import logging
import re
import threading
import time
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Literal

from postgrest.exceptions import APIError as PostgrestAPIError

from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

_CACHE_TTL_SECONDS = 30.0

RuleKind = Literal["ignore", "fingerprint", "downgrade"]


@dataclass(frozen=True)
class CompiledRule:
    """A ``sentry_rules`` row with its regex pre-compiled for match speed.

    Immutable on purpose — the snapshot returned by :func:`get_snapshot`
    hands out these tuples to the (potentially concurrent) ``before_send``
    reader without copying.
    """

    id: str
    kind: RuleKind
    match_exception_type: str | None
    match_message_pattern: re.Pattern[str] | None
    match_logger_prefix: str | None
    fingerprint_template: str | None
    downgrade_to: str | None

    @classmethod
    def from_row(cls, row: Mapping[str, object]) -> CompiledRule | None:
        """Build from a ``sentry_rules`` row; None if the row is malformed."""
        rule_id = row.get("id")
        kind = row.get("kind")
        if not isinstance(rule_id, str) or kind not in ("ignore", "fingerprint", "downgrade"):
            return None
        raw_regex = row.get("match_message_regex")
        pattern: re.Pattern[str] | None = None
        if isinstance(raw_regex, str) and raw_regex:
            try:
                pattern = re.compile(raw_regex)
            except re.error:
                # A bad regex from the admin UI must not poison the cache;
                # drop the rule and log so operators can see it.
                logger.warning(
                    "sentry_rule %s has invalid regex %r; dropping from cache",
                    rule_id,
                    raw_regex,
                )
                return None
        exc_type = row.get("match_exception_type")
        logger_prefix = row.get("match_logger")
        fingerprint = row.get("fingerprint_template")
        downgrade = row.get("downgrade_to")
        return cls(
            id=rule_id,
            kind=kind,  # type: ignore[arg-type]
            match_exception_type=exc_type if isinstance(exc_type, str) else None,
            match_message_pattern=pattern,
            match_logger_prefix=logger_prefix if isinstance(logger_prefix, str) else None,
            fingerprint_template=fingerprint if isinstance(fingerprint, str) else None,
            downgrade_to=downgrade if isinstance(downgrade, str) else None,
        )


@dataclass(frozen=True)
class Snapshot:
    """Immutable view of the cache contents used by :func:`apply_rules`."""

    ignore: tuple[CompiledRule, ...]
    fingerprint: tuple[CompiledRule, ...]
    downgrade: tuple[CompiledRule, ...]
    loaded_at_monotonic: float

    @classmethod
    def empty(cls) -> Snapshot:
        return cls(ignore=(), fingerprint=(), downgrade=(), loaded_at_monotonic=0.0)


# Module-level state (intentional singleton — one Sentry SDK per process).
_lock = threading.Lock()
_snapshot: Snapshot = Snapshot.empty()


def get_snapshot() -> Snapshot:
    """Return the current cache snapshot. Thread-safe."""
    with _lock:
        return _snapshot


def reset_for_tests() -> None:
    """Test hook: wipe the cache back to the empty state."""
    global _snapshot
    with _lock:
        _snapshot = Snapshot.empty()


def _replace_snapshot(new_snapshot: Snapshot) -> None:
    global _snapshot
    with _lock:
        _snapshot = new_snapshot


async def reload(admin: Client) -> Snapshot:
    """Fetch every enabled rule and atomically swap the cache snapshot.

    Called at lifespan startup and after every ``admin_ops`` rule mutation.
    Returns the new snapshot so callers can assert on row counts in tests.

    Raises ``PostgrestAPIError`` on DB error; callers decide whether to
    fall back (startup keeps the empty snapshot; mutations surface the
    error to the admin UI).
    """
    try:
        result = await (
            admin.table("sentry_rules")
            .select(
                "id,kind,match_exception_type,match_message_regex,match_logger,"
                "fingerprint_template,downgrade_to",
            )
            .eq("enabled", True)
            .order("created_at", desc=False)
            .execute()
        )
    except PostgrestAPIError:
        logger.exception("SentryRuleCache: reload failed")
        raise

    rows = result.data or []
    by_kind: dict[RuleKind, list[CompiledRule]] = {
        "ignore": [],
        "fingerprint": [],
        "downgrade": [],
    }
    for row in rows:
        compiled = CompiledRule.from_row(row)
        if compiled is None:
            continue
        by_kind[compiled.kind].append(compiled)

    new_snapshot = Snapshot(
        ignore=tuple(by_kind["ignore"]),
        fingerprint=tuple(by_kind["fingerprint"]),
        downgrade=tuple(by_kind["downgrade"]),
        loaded_at_monotonic=time.monotonic(),
    )
    _replace_snapshot(new_snapshot)
    logger.info(
        "SentryRuleCache reloaded: ignore=%d fingerprint=%d downgrade=%d",
        len(new_snapshot.ignore),
        len(new_snapshot.fingerprint),
        len(new_snapshot.downgrade),
    )
    return new_snapshot


def is_stale(now_monotonic: float | None = None) -> bool:
    """Return True if the snapshot is older than the TTL (or never loaded)."""
    current = get_snapshot()
    if current.loaded_at_monotonic <= 0.0:
        return True
    now = now_monotonic if now_monotonic is not None else time.monotonic()
    return (now - current.loaded_at_monotonic) >= _CACHE_TTL_SECONDS


# ── Rule application (sync — called from Sentry's before_send hook) ────────


def _extract_tags(event: Mapping[str, object]) -> dict[str, str]:
    """Flatten event.tags (which may be dict or list of {key,value})."""
    tags_source = event.get("tags")
    if isinstance(tags_source, dict):
        return {str(k): str(v) for k, v in tags_source.items()}
    if isinstance(tags_source, list):
        result: dict[str, str] = {}
        for entry in tags_source:
            if isinstance(entry, dict):
                key = entry.get("key")
                value = entry.get("value")
                if isinstance(key, str) and value is not None:
                    result[key] = str(value)
        return result
    return {}


def _event_logger_name(event: Mapping[str, object]) -> str:
    logger_name = event.get("logger")
    return logger_name if isinstance(logger_name, str) else ""


def _rule_matches(
    rule: CompiledRule,
    *,
    exc_type_name: str,
    message: str,
    logger_name: str,
) -> bool:
    """All configured match fields must hit (NULL fields mean any)."""
    if rule.match_exception_type and rule.match_exception_type != exc_type_name:
        return False
    if rule.match_message_pattern and not rule.match_message_pattern.search(message):
        return False
    if rule.match_logger_prefix and not logger_name.startswith(rule.match_logger_prefix):
        return False
    return True


def _format_fingerprint(template: str, context: Mapping[str, str]) -> list[str] | None:
    """Format a fingerprint template; None if a placeholder is missing.

    Output is split on '.' so ``openrouter.{exc_type}.{model}`` becomes the
    Sentry-standard list form used by the P0 rule. Model identifiers
    containing '/' (e.g. ``deepseek/deepseek-chat``) stay in one segment.
    """
    try:
        formatted = template.format_map(_DefaultDict(context))
    except (KeyError, IndexError, ValueError):
        return None
    return formatted.split(".")


class _DefaultDict(dict):
    """format_map backing that yields an empty string for missing keys.

    Sentry tags vary per event — a missing ``{model}`` should produce
    ``openrouter.RateLimitError.`` rather than crash rule application.
    """

    def __missing__(self, key: str) -> str:
        return ""


def apply_rules(
    event: dict,
    hint: Mapping[str, object],
    snapshot: Snapshot | None = None,
) -> dict | None:
    """Apply cache rules to a Sentry event. Returns the event or ``None``.

    * Empty cache → event unchanged (pass-through).
    * Ignore match → ``None`` (Sentry drops the event).
    * Fingerprint match → ``event['fingerprint']`` set.
    * Downgrade match → ``event['level']`` set.

    ``snapshot`` is injectable for testing; production callers use the
    module-level :func:`get_snapshot`.
    """
    if snapshot is None:
        snapshot = get_snapshot()

    if not snapshot.ignore and not snapshot.fingerprint and not snapshot.downgrade:
        return event

    exc_info = hint.get("exc_info") if isinstance(hint, Mapping) else None
    exc_type = None
    exc = None
    if exc_info and isinstance(exc_info, tuple) and len(exc_info) >= 2:
        exc_type = exc_info[0]
        exc = exc_info[1]

    exc_type_name = exc_type.__name__ if exc_type is not None else ""
    message = str(exc) if exc is not None else ""
    logger_name = _event_logger_name(event)

    for rule in snapshot.ignore:
        if _rule_matches(
            rule,
            exc_type_name=exc_type_name,
            message=message,
            logger_name=logger_name,
        ):
            return None

    if snapshot.fingerprint:
        tags = _extract_tags(event)
        context: dict[str, str] = {
            "exc_type": exc_type_name or "unknown",
            "exc_name": exc_type_name or "unknown",
            "logger": logger_name or "unknown",
            "model": tags.get("model", "unknown"),
            "provider": tags.get("provider", "unknown"),
            "purpose": tags.get("purpose", "unknown"),
        }
        for rule in snapshot.fingerprint:
            if not _rule_matches(
                rule,
                exc_type_name=exc_type_name,
                message=message,
                logger_name=logger_name,
            ):
                continue
            if not rule.fingerprint_template:
                continue
            formatted = _format_fingerprint(rule.fingerprint_template, context)
            if formatted:
                event["fingerprint"] = formatted
                break

    for rule in snapshot.downgrade:
        if _rule_matches(
            rule,
            exc_type_name=exc_type_name,
            message=message,
            logger_name=logger_name,
        ):
            if rule.downgrade_to:
                event["level"] = rule.downgrade_to
            break

    return event

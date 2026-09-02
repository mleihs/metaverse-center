"""Shared error type for the hand-written external news clients.

WHY THIS EXISTS. Guardian and NewsAPI are the only two scanner sources that
reach the outside world through a hand-written client instead of a plain
``httpx`` call, and both used to raise a bare ``Exception`` subclass carrying
nothing but a formatted string. Two consequences, both measured on 2026-09-02
against the live Guardian key:

* ``ScannerService.run_scan_cycle`` isolates each adapter with
  ``except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError,
  ValueError)``. A ``GuardianError`` matched none of them, so it escaped the
  per-adapter boundary and would have ended the WHOLE cycle — every adapter
  after Guardian in the list included. The failure never showed because the
  key was absent and the adapter reported ``unavailable`` before ever calling
  out. Entering a key would have armed it.
* ``POST …/social-trends/browse`` funnelled every one of them into
  ``502 "External API error. Please try again."``. That sentence is wrong for
  the case that actually happened — the Guardian answered ``401 Unauthorized``
  because the stored key is dead — and "please try again" sends the reader in
  precisely the wrong direction. It cost about a day.

So the base class carries the upstream status code. A caller can then tell
"our credentials are refused" (nothing to retry, a human must supply a key)
from "the service is unwell" (retrying is exactly right), and both clients
inherit one type that the existing handlers can name.
"""

from __future__ import annotations


class ExternalNewsError(Exception):
    """A news provider answered, and the answer was not usable.

    ``status_code`` is the provider's HTTP status where there was one, and
    ``None`` where the failure was in the body rather than the status (NewsAPI
    answers ``200`` with ``{"status": "error"}``).
    """

    def __init__(self, message: str, *, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code

    @property
    def is_auth_failure(self) -> bool:
        """The provider refused our credentials — a key problem, not an outage."""
        return self.status_code in (401, 403)

    @property
    def is_rate_limited(self) -> bool:
        """The provider is throttling us — the same request later may succeed."""
        return self.status_code == 429

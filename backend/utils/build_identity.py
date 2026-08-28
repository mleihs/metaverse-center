"""Which build is running — one answer, resolved at runtime, shared by both tiers.

The problem this solves: an error report is only worth as much as the version it
points at. Backend events were tagged with `SENTRY_RELEASE`, which is unset on
production, and the frontend baked `VITE_SENTRY_RELEASE` at build time, which is
also unset — so nothing carried a release, and uploaded source maps had nothing
to match against.

Why not fix it at build time
----------------------------
Coolify does inject the deployed commit, but only into the CONTAINER at runtime.
Its `docker build` line passes exactly four of its own variables plus the app's
`VITE_*` ones as build args; `SOURCE_COMMIT` is not among them (verified against
the deployment log). Adding a hand-maintained `SENTRY_RELEASE` variable to the
deployment target would be a value someone has to bump on every deploy — and
that lies from the first time it is forgotten, silently, in exactly the tool one
consults when something is wrong.

So the release is read from the process environment, where the truthful value
already is, and handed to the browser by the server that serves it. Backend and
frontend therefore report the SAME release by construction, not by two
configurations agreeing.

Precedence: an explicit `SENTRY_RELEASE` (a CI-supplied release name) wins;
otherwise the deployed commit. Empty when neither is set — local development,
where a release tag would be noise.
"""

from __future__ import annotations

import os

#: Release identifier for this running build. Empty string when unknown.
RELEASE: str = (os.environ.get("SENTRY_RELEASE") or os.environ.get("SOURCE_COMMIT") or "").strip()

#: Short commit form for human-facing surfaces (the alpha build strip).
SHORT_SHA: str = RELEASE[:7] if RELEASE else "unknown"

"""Alle Mailvorlagen zur Ansicht an eine Testadresse schicken.

Die Beispieldaten stehen seit P3.27 in ``backend/services/email_fixtures.py``
und nicht mehr hier. Dieses Skript ist damit nur noch der Versandweg; wer die
Vorlagen bloß ANSEHEN will, braucht es nicht mehr und nimmt die Admin-Vorschau
(``GET /api/v1/admin/emails/preview``), die nichts zustellt.

Der Grund für den Umzug: vier der elf Vorlagen standen hier gar nicht, weil sie
später entstanden sind — und wer eine Vorlage nur durch Versenden prüfen kann,
prüft sie nicht.

Usage:
    cd /path/to/velgarien-rebuild
    .venv/bin/python scripts/send_test_emails.py
"""

import asyncio
import os
import sys

# Ensure project root is on path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.services.email_fixtures import FIXTURES  # noqa: E402
from backend.services.email_service import EmailService  # noqa: E402

RECIPIENT = "matthias@leihs.at"
LOCALE = "de"


def build_all_templates() -> list[tuple[str, str]]:
    """Return list of (subject, html_body) for every registered template."""
    return [
        (f"[TEST] {fixture.label}", fixture.render(LOCALE))
        for fixture in FIXTURES
    ]


async def main():
    templates = build_all_templates()
    print(f"Sending {len(templates)} test emails to {RECIPIENT}...")
    print()

    for i, (subject, html_body) in enumerate(templates, 1):
        print(f"  [{i}/{len(templates)}] {subject}...")
        ok = await EmailService.send(RECIPIENT, subject, html_body)
        if ok:
            print("           -> Sent!")
        else:
            print("           -> FAILED (check SMTP config)")
        # Brief pause to avoid throttling
        await asyncio.sleep(0.5)

    print()
    print(f"Done. {len(templates)} emails sent to {RECIPIENT}.")


if __name__ == "__main__":
    asyncio.run(main())

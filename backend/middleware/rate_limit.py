"""Der Schluessel, nach dem gedrosselt wird — und warum es nicht die IP ist.

WAS AM 05.09.2026 GEMESSEN WURDE

`Limiter(key_func=get_remote_address)` liest `request.client.host`. Hinter
einem Reverse Proxy ist das die Adresse des PROXYS, bei jedem Nutzer dieselbe:
alle teilen sich einen Eimer. Auf Produktion nachgestellt — sechs Aufrufe von
`/api/v1/auth/reauth` mit dem richtigen Passwort ergaben fuenfmal 200 und dann
HTTP 429. Das traf nicht nur den Sechsten, sondern jeden anderen Nutzer
derselben Minute, an neun Routern und an jedem Limit gleichermassen. Ein
einzelner Aufrufer konnte damit die Anmeldung der ganzen Plattform sperren.

Der naheliegende Griff — uvicorn mit `--proxy-headers --forwarded-allow-ips '*'`
— war SCHLIMMER, und auch das ist gemessen: uvicorn 0.52 nimmt bei
`always_trust` den ERSTEN Eintrag von `X-Forwarded-For`, und den setzt der
Aufrufer selbst. Acht Anfragen mit frei gewaehltem Kopf gingen alle durch, wo
vorher die sechste abgewiesen wurde. Fuer ein Passwort-Orakel ist das kein
Kompromiss, sondern die Abschaffung der Schranke.

WAS STATTDESSEN GILT

Der richtige Schluessel fuer eine angemeldete Anfrage ist der NUTZER, nicht sein
Weg durchs Netz. Er steht als `sub` im Zugangstoken.

Dass dieses `sub` hier NICHT geprueft wird, ist Absicht und kein Versehen: die
Drossel laeuft vor jeder Abhaengigkeit, eine Signaturpruefung an dieser Stelle
waere ein zweiter Ort mit derselben Verantwortung. Sie ist auch nicht noetig.
Wer den Wert faelscht, faelscht damit sein Token, und ein gefaelschtes Token
scheitert danach an `get_current_user` — er kauft sich einen frischen Eimer fuer
Anfragen, die ohnehin mit 401 enden. Wer ein GUELTIGES Token hat (der Fall, gegen
den `/auth/reauth` geschuetzt wird — ein liegengelassener Browser, ein
gestohlener Sitzungsschluessel), hat genau EIN `sub` und kann es nicht wechseln,
ohne die Gueltigkeit zu verlieren. Genau dort haelt der Schluessel also.

Ohne Token bleibt es bei der Adresse. Das ist fuer oeffentliche Endpunkte
weiterhin grob — hinter Cloudflare ist es die Adresse des Proxys — und bleibt
offen; die saubere Loesung dafuer liest `CF-Connecting-IP`, was uvicorn nicht
tut. Der Unterschied: dort geht es um Last, hier ging es um ein Passwort.
"""

import base64
import binascii
import json

from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request


def _subject_from_bearer(request: Request) -> str | None:
    """Das `sub` aus dem Zugangstoken, ohne Pruefung der Signatur.

    Gibt ``None`` bei allem, was nicht wie ein JWT mit `sub` aussieht — ein
    fehlender Kopf, ein fremdes Schema, drei fehlende Punkte, unlesbares
    Base64, ein anderes JSON. Die Drossel darf an keiner dieser Stellen
    scheitern: eine Ausnahme im `key_func` beendet die Anfrage, bevor der
    Endpunkt sie ueberhaupt sieht.
    """
    header = request.headers.get("authorization") or ""
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return None
    parts = token.split(".")
    if len(parts) != 3:
        return None
    payload = parts[1]
    payload += "=" * (-len(payload) % 4)  # Base64url ohne Fuellzeichen
    try:
        claims = json.loads(base64.urlsafe_b64decode(payload))
    except (binascii.Error, ValueError, UnicodeDecodeError):
        return None
    subject = claims.get("sub") if isinstance(claims, dict) else None
    return str(subject) if subject else None


def rate_limit_key(request: Request) -> str:
    """Der Nutzer, wenn es einen gibt; sonst die Absenderadresse."""
    subject = _subject_from_bearer(request)
    return f"user:{subject}" if subject else f"ip:{get_remote_address(request)}"


limiter = Limiter(key_func=rate_limit_key)

# Rate limit constants
RATE_LIMIT_AI_GENERATION = "120/hour"
RATE_LIMIT_AI_CHAT = "10/minute"
RATE_LIMIT_EXTERNAL_API = "5/minute"
RATE_LIMIT_STANDARD = "100/minute"
RATE_LIMIT_AI_ENTITY = "360/hour"
RATE_LIMIT_ADMIN_MUTATION = "10/minute"

"""Wonach gedrosselt wird — und die vier Arten, das still falsch zu machen.

Der Anlass: `/api/v1/auth/reauth` ist ein Passwort-Orakel und war auf Produktion
nach der Adresse des Reverse Proxys gedrosselt, also fuer alle Nutzer gemeinsam.
Der Versuch, das mit `--proxy-headers --forwarded-allow-ips '*'` zu heilen, hat
die Schranke aufgehoben statt sie zu verfeinern: uvicorn 0.52 nimmt dann den
ERSTEN Eintrag von `X-Forwarded-For`, den der Aufrufer selbst setzt. Gemessen
auf Produktion — acht Anfragen mit frei gewaehltem Kopf, achtmal 200, wo ohne
den Kopf die siebte mit 429 abgewiesen wurde.

Deshalb schluesselt der Begrenzer jetzt nach dem Nutzer. Diese Tests pinnen,
dass er dabei an keiner Eingabe scheitert: ein `key_func`, der wirft, beendet
die Anfrage, bevor der Endpunkt sie sieht — eine Drossel, die den Dienst
abschaltet, waere schlimmer als gar keine.
"""

import base64
import json

import pytest

from backend.middleware.rate_limit import rate_limit_key


def _request(headers: dict[str, str], client_host: str = "10.0.0.7"):
    """Eine Anfrage, so weit sie der Begrenzer anfasst: Koepfe und Absender."""
    from starlette.requests import Request

    raw = [(k.lower().encode(), v.encode()) for k, v in headers.items()]
    return Request({"type": "http", "headers": raw, "client": (client_host, 1234), "method": "GET", "path": "/"})


def _token(claims: dict) -> str:
    def seg(obj: dict) -> str:
        return base64.urlsafe_b64encode(json.dumps(obj).encode()).decode().rstrip("=")

    return f"{seg({'alg': 'ES256'})}.{seg(claims)}.signature-egal"


class TestAngemeldet:
    def test_der_nutzer_ist_der_schluessel(self):
        token = _token({"sub": "00000000-0000-0000-0000-000000000001", "email": "wer@example.test"})
        key = rate_limit_key(_request({"authorization": f"Bearer {token}"}))
        assert key == "user:00000000-0000-0000-0000-000000000001"

    def test_dieselbe_person_von_zwei_adressen_teilt_einen_eimer(self):
        token = _token({"sub": "abc"})
        a = rate_limit_key(_request({"authorization": f"Bearer {token}"}, client_host="10.0.0.1"))
        b = rate_limit_key(_request({"authorization": f"Bearer {token}"}, client_host="10.0.0.2"))
        assert a == b

    def test_zwei_personen_teilen_keinen(self):
        # Das ist der eigentliche Punkt: vorher lagen beide im Eimer des Proxys,
        # und der Sechste sperrte die Anmeldung fuer den Siebten.
        a = rate_limit_key(_request({"authorization": f"Bearer {_token({'sub': 'eins'})}"}))
        b = rate_limit_key(_request({"authorization": f"Bearer {_token({'sub': 'zwei'})}"}))
        assert a != b

    def test_ein_gefaelschter_kopf_verschiebt_nichts(self):
        # Der Angriff, den `--forwarded-allow-ips '*'` erst moeglich gemacht hat.
        token = _token({"sub": "abc"})
        ohne = rate_limit_key(_request({"authorization": f"Bearer {token}"}))
        mit = rate_limit_key(
            _request({"authorization": f"Bearer {token}", "x-forwarded-for": "203.0.113.77"}),
        )
        assert ohne == mit


class TestAnonym:
    def test_ohne_token_zaehlt_die_adresse(self):
        assert rate_limit_key(_request({}, client_host="198.51.100.5")) == "ip:198.51.100.5"

    def test_nutzer_und_adresse_kollidieren_nicht(self):
        # Getrennte Vorsaetze, damit eine Nutzerkennung, die zufaellig wie eine
        # Adresse aussieht, nicht denselben Eimer trifft wie diese Adresse.
        token = _token({"sub": "198.51.100.5"})
        assert rate_limit_key(_request({"authorization": f"Bearer {token}"})) != rate_limit_key(
            _request({}, client_host="198.51.100.5"),
        )


class TestNichtsBringtIhnZuFall:
    @pytest.mark.parametrize(
        "header",
        [
            "",
            "Bearer",
            "Bearer ",
            "Basic dXNlcjpwYXNz",
            "Bearer nicht.genug",
            "Bearer a.b.c.d",
            "Bearer a.!!!nicht-base64!!!.c",
            f"Bearer a.{base64.urlsafe_b64encode(b'kein json').decode().rstrip('=')}.c",
            f"Bearer a.{base64.urlsafe_b64encode(b'[1,2,3]').decode().rstrip('=')}.c",
            f"Bearer a.{base64.urlsafe_b64encode(b'{}').decode().rstrip('=')}.c",
            f"Bearer a.{base64.urlsafe_b64encode(b'{"sub": null}').decode().rstrip('=')}.c",
        ],
    )
    def test_faellt_auf_die_adresse_zurueck_statt_zu_werfen(self, header: str):
        # Eine Ausnahme im key_func beendet die Anfrage, bevor der Endpunkt sie
        # sieht. Jede dieser Eingaben muss darum still auf die Adresse fallen.
        assert rate_limit_key(_request({"authorization": header} if header else {})) == "ip:10.0.0.7"

    def test_fuellzeichen_werden_ergaenzt(self):
        # Base64url in einem JWT traegt kein '='. Ohne das Auffuellen wirft
        # `urlsafe_b64decode` bei jeder Nutzlast, deren Laenge nicht durch vier
        # teilbar ist — also bei den meisten.
        claims = {"sub": "x" * 7}  # erzwingt eine Laenge mit Rest
        assert rate_limit_key(_request({"authorization": f"Bearer {_token(claims)}"})) == "user:" + "x" * 7

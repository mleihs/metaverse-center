"""Modelle für die erneute Anmeldung (Sichtschutz auf Gespräche)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class ReauthRequest(BaseModel):
    """Das Kontopasswort, erneut eingegeben.

    ``max_length`` ist keine Formvorschrift, sondern eine Kostengrenze: die
    Prüfung geht an Supabase, und ein megabytegrosses Feld wäre ein billiger
    Weg, das zu beschäftigen.
    """

    password: str = Field(min_length=1, max_length=256)


class ReauthResponse(BaseModel):
    """Wie lange die Oberfläche das Ergebnis gelten lassen darf.

    Der Server merkt sich NICHTS. Die Frist ist eine Ansage an die Oberfläche,
    keine serverseitige Sitzung — was der Sichtschutz auch nicht braucht, denn
    er schützt gegen jemanden, der auf den Bildschirm sieht, nicht gegen
    jemanden, der ein Token hat.
    """

    valid_for_seconds: int


class ConversationLockRequest(BaseModel):
    """Den Verschluss umlegen — mit Passwort im SELBEN Aufruf.

    Die Spezifikation sah einen ``reauth_at < 2 min``-Merker vor. Das hätte
    einen Zustand gebraucht, den der Server sonst nirgends führt, und eine
    zweite Rundreise. Das Passwort hier mitzugeben ist beides nicht — und es
    ist die STÄRKERE Zusicherung: die Prüfung liegt im selben Aufruf wie die
    Änderung, es gibt kein Fenster dazwischen.
    """

    locked: bool
    password: str = Field(min_length=1, max_length=256)


class SceneImageRequest(BaseModel):
    """Ein Bild aus dem Gespraech.

    Alle drei Felder sind WUENSCHE, keine Feststellungen. Was wirklich gilt,
    rechnet der Server aus den Einstellungen des Nutzers — siehe
    ``image_content_policy``. Ein Klient, der ``rating='mature'`` schickt,
    erhoeht damit nichts.
    """

    span: Literal["message", "round", "section"] = "round"
    vantage: Literal["human", "agent", "wide"] | None = None
    rating: Literal["general", "mature"] = "general"


class ImagePreferencesUpdate(BaseModel):
    """Was ein Nutzer ueber die Bilder entscheidet, die fuer ihn entstehen.

    ZWEI FELDER, ZWEI VERSCHIEDENE ARTEN VON WAHL

    `image_content_preference` ist ein WUNSCH, keine Anweisung: der Server
    rechnet ihn per `resolve_rating` gegen die Anfrage und nimmt das Minimum.
    Er steht deshalb in der Datenbank und nicht im Bildaufruf — sonst koennte
    ein Klient sich die Stufe selbst setzen.

    `scene_image_vantage` darf ``None`` sein, und das ist ein eigener Wert und
    kein fehlender: „die Vorgabe der Welt gilt". Ein Nutzer, der nie gewaehlt
    hat, und einer, der ausdruecklich der Welt folgen will, sehen in der
    Datenbank gleich aus — und sollen es auch, weil sich die Vorgabe der Welt
    aendern darf, ohne seine Wahl zu ueberschreiben.

    Beide Felder sind optional: die Oberflaeche schickt, was sich geaendert
    hat. Ein nicht gesendetes Feld bleibt, wie es war. `None` fuer den Blick
    laesst sich davon nicht unterscheiden, deshalb gibt es dafuer den
    ausdruecklichen Schalter `vantage_folgt_der_welt`.
    """

    image_content_preference: Literal["general", "mature"] | None = None
    scene_image_vantage: Literal["human", "agent", "wide"] | None = None
    #: Ausdruecklich auf „die Welt entscheidet" zuruecksetzen. Ohne diesen
    #: Schalter waere ein `null` im Rumpf nicht von „nicht mitgeschickt" zu
    #: unterscheiden — JSON kennt den Unterschied, Pydantic-Vorgabewerte nicht.
    vantage_folgt_der_welt: bool = False


class ImagePreferencesResponse(BaseModel):
    """Der Stand nach dem Schreiben — und was daraus folgt."""

    image_content_preference: Literal["general", "mature"]
    scene_image_vantage: Literal["human", "agent", "wide"] | None

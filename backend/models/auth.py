"""Modelle für die erneute Anmeldung (Sichtschutz auf Gespräche)."""

from __future__ import annotations

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

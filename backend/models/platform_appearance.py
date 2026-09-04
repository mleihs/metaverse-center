"""Public DTO für das Erscheinungsbild der Plattform.

Die Plattform hat zwei Ausgaben: das Phosphor-Chrom (``dark``) und die
Kartenmappe (``atlas``). Wer eine wählt, dessen Wahl liegt im Browser. Wer
keine gewählt hat, bekommt die, die die Verwaltung gesetzt hat — und die steht
in ``platform_settings``, das keine anon-Richtlinie hat. Deshalb dieser enge
öffentliche Ausschnitt: ein einziger Name, sonst nichts.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

#: Die Ausgaben, die es gibt. Eine Zeichenkette ausserhalb dieser Menge ist
#: kein Skin, sondern ein Tippfehler — die Prüfung sitzt hier und im Frontend
#: (``isPlatformSkin``), nicht als CHECK auf einer Schlüssel-Wert-Tabelle.
PlatformSkin = Literal["dark", "atlas"]

#: Was ein Gast bekommt, solange niemand etwas anderes gesetzt hat.
DEFAULT_PLATFORM_SKIN: PlatformSkin = "dark"


class PlatformAppearancePublic(BaseModel):
    """Welche Ausgabe ein Besucher ohne eigene Wahl bekommt."""

    default_skin: PlatformSkin

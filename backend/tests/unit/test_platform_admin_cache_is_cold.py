"""Der Plattform-Admin-Zwischenspeicher muss vor jedem Test kalt sein.

`dependencies.is_platform_admin` arbeitet in drei Stufen:

    1. E-Mail-Liste            O(1), kein I/O
    2. zwischengespeicherte IDs O(1), Frist 5 min
    3. Auffrischung aus der DB  selten, füllt den Speicher

Stufe 2 und 3 hängen an zwei MODULWEITEN Variablen. Ein Test, der die Frist
füllt, schaltet Stufe 3 für die nächsten fünf Minuten ab — und damit die
einzige Stelle im Rollentor, die den Admin-Client überhaupt anfasst.

🔑 Gemessen am 31.08.2026: 26 Fälle in drei Dateien bestanden **nur, weil ein
früherer Test den Speicher gefüllt hatte**. Allein aufgerufen scheiterten sie
mit `TypeError: object MagicMock can't be used in 'await' expression`, weil
ihre Überschreibung von `get_admin_supabase` ein blankes `MagicMock` war. Im
vollen Lauf kam der Aufruf nie dort an.

    test_echo_router.py            15
    test_embassy_router.py          9
    test_dependency_gates.py        2

Das ist dieselbe Form wie die Reihenfolgeabhängigkeit von
`test_travel_havarie.py` (T7), nur in die andere Richtung: dort grün allein und
rot im Verband, hier rot allein und grün im Verband. Beide Male entscheidet
nicht der Test, sondern was vor ihm lief.

Dieser Test bindet die Gegenmassnahme (`_reset_platform_admin_id_cache` in
`backend/tests/conftest.py`). Ohne sie ist er selbst rot — allerdings nur,
wenn vorher etwas den Speicher gefüllt hat. Deshalb prüft er zusätzlich, dass
die Frist wirklich abgelaufen ist und nicht nur die Menge leer.
"""

from __future__ import annotations

import time

from backend import dependencies


class TestDerSpeicherIstKalt:
    def test_the_id_set_is_empty(self) -> None:
        assert dependencies._platform_admin_ids == set(), (
            "Der Test beginnt mit gefüllten Admin-IDs — Stufe 2 ist damit scharf, "
            "und das Ergebnis hängt davon ab, was vorher lief."
        )

    def test_the_ttl_has_expired(self) -> None:
        """Eine leere Menge genügt nicht.

        Ist die Frist noch offen, überspringt `is_platform_admin` Stufe 3 —
        der Admin-Client wird nie angefasst, und eine falsche Attrappe fällt
        nicht auf. Die Frist ist der eigentliche Schalter, nicht die Menge.
        """
        assert dependencies._platform_admin_ids_expires <= time.monotonic(), (
            "Die 5-Minuten-Frist ist noch offen — Stufe 3 wird übersprungen."
        )


#: Setzt der erste Fall des Paares unten; der zweite prüft ihn.
_HAT_GEFUELLT = False


class TestDerSpeicherIstAuchNACHEinemFuellenWiederKalt:
    """Der Rücksetzer muss ZWISCHEN zwei Tests greifen, nicht nur einmal.

    Der erste Fall füllt, der zweite misst. Läuft der zweite grün, hat die
    autouse-Fixture dazwischen gegriffen.

    ⚠ Das Paar hängt an der Reihenfolge — und ein Test, der an der Reihenfolge
    hängt, ist genau das, was diese Datei bekämpft. Deshalb ist die Abhängigkeit
    hier NICHT stillschweigend: der zweite Fall prüft ausdrücklich, dass der
    erste gelaufen ist, und scheitert sonst mit einem Satz statt still grün zu
    sein. (Es gibt keinen Zufallsordner im Projekt — pytest läuft in
    Definitionsreihenfolge; die Absicherung ist für den Tag, an dem einer
    dazukommt.)
    """

    def test_a_fill_the_cache(self) -> None:
        global _HAT_GEFUELLT  # noqa: PLW0603
        dependencies._platform_admin_ids = {"11111111-1111-1111-1111-111111111111"}
        dependencies._platform_admin_ids_expires = time.monotonic() + 300
        assert dependencies._platform_admin_ids_expires > time.monotonic()
        _HAT_GEFUELLT = True

    def test_b_cache_is_cold_again(self) -> None:
        assert _HAT_GEFUELLT, (
            "test_a_fill_the_cache lief nicht vor diesem Fall — die Messung wäre "
            "leer bestanden. Reihenfolge in dieser Klasse ist Teil der Aussage."
        )
        assert dependencies._platform_admin_ids == set()
        assert dependencies._platform_admin_ids_expires <= time.monotonic()

"""Welche der beiden gespeicherten Fassungen als Bildvorlage geholt wird.

`_upload_dual_resolution` legt jedes erzeugte Bild zweimal ab — `{uuid}.avif`
mit 1024 Pixel laengster Kante und `{uuid}.full.avif` in nativer Aufloesung —
und gibt die KLEINE zurueck. Sie steht deshalb in jeder Spalte und in jedem
Link. Fuer eine Seite ist das richtig, fuer eine Bildvorlage nicht: gemessen an
zwoelf Prod-Portraeten ist die grosse Fassung 880x1168 gegen 772x1024, wo das
Original ueber 1024 lag, und dieselbe Datei, wo es darunter lag.

Eine rohe PNG-Fassung gibt es nicht. `convert_to_avif` wandelt die Antwort des
Modells um, die Rohdaten werden nirgends abgelegt — `.full.avif` ist das Beste,
was der Speicher hat.
"""

from unittest.mock import AsyncMock, patch

import pytest

from backend.services import forge_image_service as modul

ERLAUBT = {"image/png", "image/avif"}


@pytest.mark.asyncio
class TestWelcheFassung:
    async def test_die_grosse_wird_zuerst_versucht(self):
        with patch.object(modul, "safe_download", new=AsyncMock(return_value=(b"gross", "image/avif"))) as lade:
            daten, _ = await modul._lade_beste_aufloesung(
                "https://speicher.invalid/x/marie.avif", ERLAUBT
            )
        assert daten == b"gross"
        assert lade.await_args.args[0] == "https://speicher.invalid/x/marie.full.avif"
        assert lade.await_count == 1

    async def test_ohne_grosse_fassung_gilt_die_verlinkte(self):
        # Kein Fehler, sondern der Normalfall bei alten Eintraegen.
        async def antwort(url: str, **_):
            if url.endswith(".full.avif"):
                raise FileNotFoundError("404")
            return (b"klein", "image/avif")

        with patch.object(modul, "safe_download", new=AsyncMock(side_effect=antwort)) as lade:
            daten, _ = await modul._lade_beste_aufloesung(
                "https://speicher.invalid/x/marie.avif", ERLAUBT
            )
        assert daten == b"klein"
        assert lade.await_count == 2

    async def test_eine_fremde_vorlage_wird_nicht_umgeschrieben(self):
        # Eine Stilvorlage von aussen folgt unserer Namenskonvention nicht;
        # ein erfundener `.full`-Pfad waere dort ein zusaetzlicher Fehlgriff.
        with patch.object(modul, "safe_download", new=AsyncMock(return_value=(b"fremd", "image/png"))) as lade:
            await modul._lade_beste_aufloesung("https://woanders.invalid/bild.png", ERLAUBT)
        assert lade.await_args.args[0] == "https://woanders.invalid/bild.png"
        assert lade.await_count == 1

    async def test_eine_grosse_fassung_wird_nicht_noch_einmal_vergroessert(self):
        # Sonst entstuende `marie.full.full.avif`.
        with patch.object(modul, "safe_download", new=AsyncMock(return_value=(b"gross", "image/avif"))) as lade:
            await modul._lade_beste_aufloesung("https://speicher.invalid/marie.full.avif", ERLAUBT)
        assert lade.await_args.args[0] == "https://speicher.invalid/marie.full.avif"
        assert lade.await_count == 1

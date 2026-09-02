"""Die Schleuse — Vorschau und Meldung.

Geprüft wird das, was still falsch sein kann und auf einem unumkehrbaren Knopf
steht.

DIE ÜBERSPRING-SCHWELLE
-----------------------
`handoff/schleuse-event-intake.md` nennt 0.2 als Grenze, unter der eine
Resonanz eine Welt überspringt — an zwei Stellen sogar, als Schwelle UND als
Farbgrenze. Der Lauf springt bei 0.05 (`_process_simulation_impact`, §5). Mit
0.2 hätte die Suszeptibilitätstafel einem Admin „diese Welt wird übersprungen"
für Welten gemeldet, die getroffen werden — auf genau dem Schirm, auf dem er
den Halte-Knopf drückt. Die Zahl steht jetzt EINMAL
(`ResonanceService.SKIP_THRESHOLD`) und wird von der Schwelle im Lauf UND von
der Vorschau gelesen; die Tests hier nageln beide an dieselbe Konstante.

EINE FORMEL, ZWEI AUFRUFER
--------------------------
`susceptibility_of` wurde aus `_process_simulation_impact` herausgezogen, damit
die Vorschau und der Lauf dieselbe Zahl benutzen. Zwei Fassungen einer Formel
driften, und die driftende ist immer die, die niemand ausführt. Die Tests
prüfen deshalb die Rückfallkette explizit: adaptiv, dann statisch, dann 1.0.
"""

from unittest.mock import AsyncMock, MagicMock

import pytest
from postgrest.exceptions import APIError as PostgrestAPIError

from backend.services.intake_service import IntakeService
from backend.services.resonance_service import ResonanceService
from backend.utils.errors import HTTPException


def _rpc_client(*results):
    """Ein Supabase-Doppel, dessen `rpc()` der Reihe nach `results` liefert.

    Ein Eintrag darf eine Exception-Klasse sein; dann wirft der Aufruf.
    """
    client = MagicMock()
    calls = list(results)

    def rpc(_name, _params):
        outcome = calls.pop(0)
        handle = MagicMock()
        if isinstance(outcome, type) and issubclass(outcome, Exception):
            # postgrest-py baut seinen Fehler aus einem dict, nicht aus einem
            # String — ein `PostgrestAPIError("boom")` scheitert schon beim
            # Anlegen und pruefte dann etwas anderes als gemeint.
            handle.execute = AsyncMock(
                side_effect=outcome(
                    {"message": "rpc missing", "code": "42883", "hint": "", "details": ""}
                )
            )
        else:
            handle.execute = AsyncMock(return_value=MagicMock(data=outcome))
        return handle

    client.rpc = rpc
    return client


class TestSusceptibilityOf:
    """Die Rückfallkette — adaptiv, statisch, 1.0."""

    @pytest.mark.asyncio
    async def test_uses_the_adaptive_value_when_it_answers(self):
        client = _rpc_client(0.75)
        value = await ResonanceService.susceptibility_of(client, "sim-1", "economic_tremor")
        assert value == 0.75

    @pytest.mark.asyncio
    async def test_falls_back_to_the_static_rpc(self):
        # Migration 216 fehlt (alte Datenbank) → die statische Funktion aus 076.
        client = _rpc_client(PostgrestAPIError, 1.2)
        value = await ResonanceService.susceptibility_of(client, "sim-1", "conflict_wave")
        assert value == 1.2

    @pytest.mark.asyncio
    async def test_falls_back_to_neutral_when_neither_rpc_is_there(self):
        # 1.0 heisst „unverändert durchgereicht" — die vorsichtige Annahme.
        client = _rpc_client(PostgrestAPIError, PostgrestAPIError)
        value = await ResonanceService.susceptibility_of(client, "sim-1", "decay_bloom")
        assert value == 1.0

    @pytest.mark.asyncio
    async def test_treats_a_null_answer_as_neutral(self):
        # `data=None` ist keine Null-Suszeptibilität, sondern keine Auskunft.
        client = _rpc_client(None)
        value = await ResonanceService.susceptibility_of(client, "sim-1", "dream_ache")
        assert value == 1.0


class TestPreviewSusceptibility:
    """Was die Tafel sagt, bevor jemand den Halte-Knopf drückt."""

    @staticmethod
    def _client_with(worlds, susceptibilities):
        client = MagicMock()

        table = MagicMock()
        table.select.return_value = table
        table.eq.return_value = table
        table.order.return_value = table
        table.execute = AsyncMock(return_value=MagicMock(data=worlds))
        client.table = MagicMock(return_value=table)

        values = list(susceptibilities)

        def rpc(_name, _params):
            handle = MagicMock()
            handle.execute = AsyncMock(return_value=MagicMock(data=values.pop(0)))
            return handle

        client.rpc = rpc
        return client

    @pytest.mark.asyncio
    async def test_effective_magnitude_is_magnitude_times_susceptibility(self):
        client = self._client_with(
            [{"id": "w1", "name": "Velgarien", "slug": "velgarien"}],
            [0.8],
        )
        rows = await ResonanceService.preview_susceptibility(
            client, signature="economic_tremor", magnitude=0.5
        )
        assert rows[0]["effective_magnitude"] == 0.4
        assert rows[0]["susceptibility"] == 0.8
        assert rows[0]["will_skip"] is False

    @pytest.mark.asyncio
    async def test_the_cap_at_one_is_the_same_the_trigger_applies(self):
        # `compute_effective_magnitude` (Migration 074) deckelt bei 1.00.
        # Die Vorschau kann keine Zeile einfuegen, um das zu erfahren — also
        # steht der Deckel hier, und dieser Test bindet ihn an die Zahl.
        client = self._client_with([{"id": "w1", "name": "A", "slug": "a"}], [2.0])
        rows = await ResonanceService.preview_susceptibility(
            client, signature="conflict_wave", magnitude=0.9
        )
        assert rows[0]["effective_magnitude"] == 1.00

    @pytest.mark.asyncio
    async def test_skip_uses_the_threshold_the_run_uses(self):
        # 0.5 x 0.08 = 0.04 → unter 0.05, also uebersprungen.
        # 0.5 x 0.12 = 0.06 → darueber, also getroffen.
        # Mit der 0.2 aus dem Bauplan waeren BEIDE als uebersprungen gemeldet
        # worden, und die zweite Welt wird getroffen.
        client = self._client_with(
            [
                {"id": "w1", "name": "Klein", "slug": "klein"},
                {"id": "w2", "name": "Gross", "slug": "gross"},
            ],
            [0.08, 0.12],
        )
        rows = await ResonanceService.preview_susceptibility(
            client, signature="decay_bloom", magnitude=0.5
        )
        assert rows[0]["will_skip"] is True
        assert rows[1]["will_skip"] is False

    @pytest.mark.asyncio
    async def test_the_threshold_is_the_one_measured_in_the_run(self):
        assert ResonanceService.SKIP_THRESHOLD == 0.05


class TestSignatureFor:
    """Kategorie → Signatur, aus der einen Tabelle des Backends."""

    def test_maps_every_category_the_scanner_can_produce(self):
        from backend.models.resonance import SOURCE_CATEGORIES

        for category in SOURCE_CATEGORIES:
            assert IntakeService.signature_for(category)

    def test_rejects_an_unknown_category_with_a_readable_answer(self):
        # Ein 400 mit der Liste der erlaubten Werte ist eine Auskunft; ein 500
        # aus postgrest, weil die CHECK-Bedingung zuschlaegt, ist keine.
        with pytest.raises(HTTPException) as exc:
            IntakeService.signature_for("celebrity_gossip")
        assert exc.value.status_code == 400
        assert "economic_crisis" in str(exc.value.detail)

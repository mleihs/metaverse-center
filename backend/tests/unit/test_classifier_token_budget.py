"""Das Antwortbudget des Klassifikators muss mit dem Stapel wachsen.

DER BEFUND (Prod, 02.09.2026, erster Scan-Zyklus nach 197 Tagen)
----------------------------------------------------------------
`classify_batch` schickte jeden Stapel mit `max_tokens=1024` los — eine feste
Zahl, unabhaengig davon, wie viele Ueberschriften darin lagen. Das hielt,
solange die einzige unstrukturierte Quelle Guardian war (eine Handvoll je
Zyklus). Dann brachte der neue Bluesky-Adapter 19 Ueberschriften in einem
Zyklus:

    OpenRouter response  status 200  completion_tokens: 1024   ← exakt max_tokens
    LLM batch classification failed

Das Modell hat nichts falsch gemacht. Es wurde nach mehr gefragt, als es sagen
durfte, die Antwort brach mitten im JSON-Array ab, `_parse_json_from_text`
scheiterte, und ALLE 19 kamen unklassifiziert zurueck. Auf dem Schirm: 18
Zeilen im Scan-Log, null Kandidaten, und eine Fehlermeldung, die nach einem
kaputten Modell klingt.

🔑 **Eine Obergrenze, die sich nicht mit der Eingabe bewegt, ist ein Fehler,
der auf eine groessere Eingabe wartet.**

Die Tests hier halten beide Haelften der Reparatur fest: das Budget waechst mit
dem Stapel, und ueber `_MAX_BATCH_SIZE` wird gestueckelt statt erhoeht.
"""

from unittest.mock import AsyncMock, MagicMock

import pytest

from backend.services.scanning.base_adapter import ScanResult
from backend.services.scanning.classifier import (
    _MAX_BATCH_SIZE,
    _MAX_COMPLETION_TOKENS,
    _TOKENS_OVERHEAD,
    _TOKENS_PER_ITEM,
    classify_batch,
)


def _result(i: int, *, structured: bool = False) -> ScanResult:
    return ScanResult(
        source_id=f"s{i}",
        source_name="Bluesky",
        title=f"Headline number {i} about something happening somewhere",
        description="A sentence of context.",
        is_structured=structured,
        source_category="natural_disaster" if structured else None,
    )


def _openrouter(answer: str):
    """Ein OpenRouter-Doppel, das die `max_tokens` jedes Aufrufs mitschreibt."""
    calls: list[dict] = []

    async def generate_with_system(**kwargs):
        calls.append(kwargs)
        return answer

    svc = MagicMock()
    svc.generate_with_system = AsyncMock(side_effect=generate_with_system)
    return svc, calls


def _valid_answer(n: int) -> str:
    entries = ", ".join(
        f'{{"index": {i}, "category": "natural_disaster", "significance": 5, "reason": "x"}}'
        for i in range(n)
    )
    return f"[{entries}]"


class TestDasBudgetWaechstMit:
    @pytest.mark.asyncio
    async def test_a_bigger_batch_gets_a_bigger_answer_budget(self):
        small, calls_small = _openrouter(_valid_answer(3))
        await classify_batch([_result(i) for i in range(3)], small, "m")

        big, calls_big = _openrouter(_valid_answer(19))
        await classify_batch([_result(i) for i in range(19)], big, "m")

        assert calls_big[0]["max_tokens"] > calls_small[0]["max_tokens"]

    @pytest.mark.asyncio
    async def test_the_batch_that_broke_prod_now_fits(self):
        # 19 Ueberschriften, das war der Fall vom 02.09. Mit der alten festen
        # 1024 lief er ueber; diese Zeile ist der Riegel dagegen.
        svc, calls = _openrouter(_valid_answer(19))
        await classify_batch([_result(i) for i in range(19)], svc, "m")
        assert calls[0]["max_tokens"] > 1024

    @pytest.mark.asyncio
    async def test_structured_results_do_not_buy_answer_tokens(self):
        # Vorklassifizierte Ergebnisse gehen gar nicht an das Modell. Sie
        # duerfen das Budget also auch nicht aufblaehen — sonst zahlt eine
        # Quelle wie USGS fuer eine Antwort, die sie nie ausloest.
        mixed = [_result(i, structured=(i % 2 == 0)) for i in range(10)]
        unstructured_count = sum(1 for r in mixed if not r.is_structured)
        svc, calls = _openrouter(_valid_answer(unstructured_count))
        await classify_batch(mixed, svc, "m")
        assert calls[0]["max_tokens"] == _TOKENS_OVERHEAD + _TOKENS_PER_ITEM * unstructured_count

    @pytest.mark.asyncio
    async def test_the_budget_never_exceeds_the_ceiling(self):
        svc, calls = _openrouter(_valid_answer(_MAX_BATCH_SIZE))
        await classify_batch([_result(i) for i in range(_MAX_BATCH_SIZE)], svc, "m")
        assert all(c["max_tokens"] <= _MAX_COMPLETION_TOKENS for c in calls)


class TestZuGrosseStapelWerdenGestueckelt:
    @pytest.mark.asyncio
    async def test_a_batch_past_the_limit_becomes_several_calls(self):
        n = _MAX_BATCH_SIZE * 2 + 5
        svc, calls = _openrouter(_valid_answer(_MAX_BATCH_SIZE))
        await classify_batch([_result(i) for i in range(n)], svc, "m")
        assert len(calls) == 3

    @pytest.mark.asyncio
    async def test_nothing_is_lost_in_the_chunking(self):
        # Der eigentliche Schaden einer schlechten Stueckelung waere nicht ein
        # Fehler, sondern ein stiller Verlust: Ergebnisse, die keinen Rueckweg
        # finden. Deshalb wird hier die ANZAHL geprueft, nicht nur der Erfolg.
        n = _MAX_BATCH_SIZE + 7
        svc, _ = _openrouter(_valid_answer(_MAX_BATCH_SIZE))
        out = await classify_batch([_result(i) for i in range(n)], svc, "m")
        assert len(out) == n

    @pytest.mark.asyncio
    async def test_a_batch_within_the_limit_stays_one_call(self):
        svc, calls = _openrouter(_valid_answer(5))
        await classify_batch([_result(i) for i in range(5)], svc, "m")
        assert len(calls) == 1


class TestDerAbbruchWirdBenanntNichtVerschwiegen:
    @pytest.mark.asyncio
    async def test_a_cut_off_answer_is_reported_as_cut_off(self, caplog):
        # Eine abgeschnittene Antwort schloss frueher als „failed" — was nach
        # einem kaputten Modell klingt. Sie soll als das gemeldet werden, was
        # sie ist, sonst repariert der naechste Leser die falsche Sache.
        truncated = '[{"index": 0, "category": "pandemic", "significance": 5, "reason": "ab'
        svc, _ = _openrouter(truncated)
        with caplog.at_level("WARNING"):
            out = await classify_batch([_result(i) for i in range(3)], svc, "m")
        assert len(out) == 3
        assert any("cut off" in r.getMessage() for r in caplog.records)

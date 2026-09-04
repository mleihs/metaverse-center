"""Der Griff am einzelnen Gespräch — und die eine Tür, die er nicht öffnet.

Ein verschlossener Faden (Migration 349) darf nicht weiterreden. Wer
verschliesst, hat eine Geste gemacht; ein Agent, der daraus in der Wochenpost
erzählt, verrät sie. Die Schranke steht im SERVICE und nicht nur im Router,
weil sie zur Sache gehört und nicht zum Protokoll — und weil eine Einstellung,
die stillschweigend nichts tut, schlimmer ist als eine abgewiesene.

Die zweite Zusage hier ist der doppelte Besitzerfilter: der Router benutzt
``get_effective_supabase``, und für einen Plattform-Admin ist RLS dort
ausgeschaltet. Fällt ``verify_ownership`` je weg, muss die Schreibbedingung
allein noch tragen.
"""

from __future__ import annotations

from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from backend.services.chat_service import ChatService

CONV = uuid4()
USER = uuid4()


class _Kette:
    """Minimaler postgrest-Doppelgänger: merkt sich update() und die Filter."""

    def __init__(self, store: dict, row: dict | None):
        self._store = store
        self._row = row

    def select(self, *_a, **_k):
        return self

    def update(self, payload):
        self._store["update"] = payload
        self._store["eq"] = []
        return self

    def eq(self, spalte, wert):
        self._store.setdefault("eq", []).append((spalte, wert))
        return self

    def maybe_single(self):
        return self

    async def execute(self):
        # `maybe_single()` liefert die Zeile selbst, keine Liste — genau die
        # Zweischichtigkeit, die `maybe_single_data` einebnet. Ein Doppelgaenger,
        # der hier eine Liste zurueckgibt, prueft eine Form, die es nicht gibt.
        return MagicMock(data=self._row)


def _supabase(row: dict | None) -> tuple[MagicMock, dict]:
    store: dict = {}
    client = MagicMock()
    client.table = MagicMock(return_value=_Kette(store, row))
    return client, store


class TestVerschlossenerFadenRedetNichtWeiter:
    async def test_einschalten_wird_abgewiesen(self):
        client, store = _supabase({"id": str(CONV), "locked": True})
        with pytest.raises(HTTPException) as exc:
            await ChatService.set_continuation(
                client, CONV, USER, continues_without_user=True, notify="digest", interval_hours=12
            )
        assert exc.value.status_code == 400
        assert "update" not in store, "der verschlossene Faden wurde trotzdem geschrieben"

    async def test_ausschalten_bleibt_erlaubt(self):
        """Sonst säße ein Mensch fest: verschliessen, und die Einstellung, die
        er zurücknehmen will, ist unerreichbar."""
        client, store = _supabase({"id": str(CONV), "locked": True})
        await ChatService.set_continuation(
            client, CONV, USER, continues_without_user=False, notify="never", interval_hours=48
        )
        assert store["update"]["continues_without_user"] is False


class TestBesitz:
    async def test_fremder_faden_ist_nicht_da(self):
        """404, nicht 403 — die Existenz eines fremden Fadens ist selbst eine
        Auskunft."""
        client, _ = _supabase(None)
        with pytest.raises(HTTPException) as exc:
            await ChatService.set_continuation(
                client, CONV, USER, continues_without_user=True, notify="app", interval_hours=6
            )
        assert exc.value.status_code == 404

    async def test_der_besitzer_steht_in_der_schreibbedingung(self):
        """Doppelt, mit Absicht: `get_effective_supabase` schaltet RLS für
        einen Plattform-Admin ab."""
        client, store = _supabase({"id": str(CONV), "locked": False})
        await ChatService.set_continuation(
            client, CONV, USER, continues_without_user=True, notify="digest", interval_hours=4
        )
        assert ("user_id", str(USER)) in store["eq"]
        assert ("id", str(CONV)) in store["eq"]


class TestGeschriebeneWerte:
    async def test_alle_drei_felder_gehen_hinaus(self):
        client, store = _supabase({"id": str(CONV), "locked": False})
        ergebnis = await ChatService.set_continuation(
            client, CONV, USER, continues_without_user=True, notify="immediate", interval_hours=24
        )
        assert store["update"]["continue_notify"] == "immediate"
        assert store["update"]["continue_interval_hours"] == 24
        assert ergebnis["continue_interval_hours"] == 24


class TestDieFuenfStufen:
    """Die Werte am Regler und die Schranke in der Datenbank müssen dieselben
    sein. Stünde hier eine sechste Zahl, wiese Postgres sie mit 23514 ab —
    aus der Tiefe, ohne Hinweis, wo sie herkam."""

    def test_das_modell_kennt_genau_diese_fuenf(self):
        from typing import get_args

        from backend.models.chat import ConversationContinuationRequest

        feld = ConversationContinuationRequest.model_fields["interval_hours"]
        assert set(get_args(feld.annotation)) == {4, 6, 12, 24, 48}

    def test_die_migration_traegt_dieselben_fuenf(self):
        """Die eine Stelle, an der Modell und Migration sich treffen können."""
        import pathlib
        import re

        sql = pathlib.Path(
            "supabase/migrations/20260904110000_357_ein_gespraech_darf_ohne_zuhoerer_weitergehen.sql"
        ).read_text()
        treffer = re.search(r"continue_interval_hours IN \(([^)]+)\)", sql)
        assert treffer, "die Stundenschranke steht nicht mehr in 357"
        assert {int(x) for x in treffer.group(1).split(",")} == {4, 6, 12, 24, 48}

"""Unit tests for DossierEvolutionService.evolve_section.

Focus: the atomic-RPC wiring (fn_record_dossier_evolution, migration 262) that
replaced the stale read-modify-write of body/evolution_log/evolution_count, plus
the body_de English fallback when translation fails.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from backend.services.dossier_evolution_service import DossierEvolutionService

SIM_ID = uuid4()
_MOD = "backend.services.dossier_evolution_service"


def _make_admin():
    """Mock admin client: simulations read is awaitable; rpc captured."""
    admin = MagicMock()

    sim_chain = MagicMock()
    sim_chain.select.return_value = sim_chain
    sim_chain.eq.return_value = sim_chain
    sim_chain.single.return_value = sim_chain
    sim_chain.maybe_single.return_value = sim_chain
    sim_chain.execute = AsyncMock(
        return_value=MagicMock(data={"name": "Test Sim", "description": "A theme"})
    )

    # simulation_lore / feature_purchases chains are only built as the (ignored)
    # argument to the patched maybe_single_data, so a bare auto-chaining mock is fine.
    admin.table.side_effect = lambda name: sim_chain if name == "simulations" else MagicMock()

    rpc_chain = MagicMock()
    rpc_chain.execute = AsyncMock(return_value=MagicMock(data=None))
    admin.rpc.return_value = rpc_chain
    return admin


@pytest.mark.asyncio
async def test_evolve_section_calls_atomic_rpc():
    """A successful evolution routes through fn_record_dossier_evolution, not a
    table update, passing the live-concat pieces + the jsonb log entry."""
    admin = _make_admin()
    section = {"id": "sec-1", "body": "BASE", "body_de": "BASIS", "evolution_count": 0}

    with (
        patch(f"{_MOD}.maybe_single_data", new=AsyncMock(return_value=section)),
        # W4: the service no longer builds its Agent by hand — model, budget,
        # timeout and reasoning all come from the one `dossier_evolution` row in
        # `ai_purposes.AI_PURPOSES`, resolved inside `create_forge_agent`.
        patch(f"{_MOD}.create_forge_agent", return_value=MagicMock()),
        patch(f"{_MOD}.run_ai", new=AsyncMock(return_value=MagicMock(output="Generated addendum text."))),
        patch(
            f"{_MOD}.TranslationService.translate_text",
            new=AsyncMock(return_value="Uebersetzter Nachtrag."),
        ),
    ):
        ok = await DossierEvolutionService.evolve_section(
            admin, SIM_ID, "BETA", "agent_recruited", "Agent Smith",
        )

    assert ok is True
    admin.rpc.assert_called_once()
    assert admin.rpc.call_args[0][0] == "fn_record_dossier_evolution"
    params = admin.rpc.call_args[0][1]
    assert params["p_section_id"] == "sec-1"
    assert "BUREAU ADDENDUM" in params["p_body_separator"]
    assert params["p_addendum"] == "Generated addendum text."
    assert "BUREAU-NACHTRAG" in params["p_body_de_separator"]  # translated path
    assert params["p_addendum_de"] == "Uebersetzter Nachtrag."
    assert params["p_log_entry"]["trigger"] == "agent_recruited"
    assert params["p_log_entry"]["entity"] == "Agent Smith"
    assert params["p_log_entry"]["words_added"] == 3


@pytest.mark.asyncio
async def test_evolve_section_body_de_falls_back_to_english_on_translation_failure():
    """When translation raises, body_de uses the English separator + addendum so
    it never falls behind — passed to the RPC unchanged."""
    admin = _make_admin()
    section = {"id": "sec-2", "body": "BASE", "body_de": "BASIS", "evolution_count": 0}

    with (
        patch(f"{_MOD}.maybe_single_data", new=AsyncMock(return_value=section)),
        # W4: the service no longer builds its Agent by hand — model, budget,
        # timeout and reasoning all come from the one `dossier_evolution` row in
        # `ai_purposes.AI_PURPOSES`, resolved inside `create_forge_agent`.
        patch(f"{_MOD}.create_forge_agent", return_value=MagicMock()),
        patch(f"{_MOD}.run_ai", new=AsyncMock(return_value=MagicMock(output="English only addendum."))),
        patch(
            f"{_MOD}.TranslationService.translate_text",
            new=AsyncMock(side_effect=ValueError("translation down")),
        ),
    ):
        ok = await DossierEvolutionService.evolve_section(
            admin, SIM_ID, "BETA", "event_occurred", "The Incident",
        )

    assert ok is True
    params = admin.rpc.call_args[0][1]
    # Fallback: de separator == en separator, de addendum == en addendum.
    assert params["p_body_de_separator"] == params["p_body_separator"]
    assert params["p_addendum_de"] == params["p_addendum"] == "English only addendum."

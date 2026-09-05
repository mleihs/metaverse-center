"""AptitudeService._effective_rows — one baseline, one place.

Regression cover for the remediation plan's B-2. The same question ("what are
this agent's aptitudes when nobody assigned any?") used to have four different
answers across the stack: a flat 6 in AptitudeService, a flat 6 in the frontend
formatter, another flat 6 seeded into three hand-written folds, and a
non-budget-valid {"spy": 3, "guardian": 2} inside dungeon run creation. Only 5
of 35 simulations on production have assigned aptitudes, so the outlier was the
value nearly every dungeon party actually fought with.
"""

from uuid import UUID, uuid4

from backend.models.aptitude import (
    APTITUDE_BUDGET,
    DEFAULT_APTITUDE_LEVEL,
    OPERATIVE_TYPES,
    AptitudeResponse,
)
from backend.services.aptitude_service import AptitudeService

SIM_ID = UUID("11111111-1111-1111-1111-111111111111")


def _assigned_row(op_type: str, level: int) -> dict:
    return {
        "id": str(uuid4()),
        "operative_type": op_type,
        "aptitude_level": level,
        "created_at": "2026-01-01T00:00:00+00:00",
        "updated_at": "2026-01-01T00:00:00+00:00",
    }


def test_baseline_is_the_budget_spread_evenly() -> None:
    assert DEFAULT_APTITUDE_LEVEL * len(OPERATIVE_TYPES) == APTITUDE_BUDGET


def test_agent_without_rows_gets_a_full_marked_baseline() -> None:
    agent_id = uuid4()
    rows = AptitudeService._effective_rows([{"id": str(agent_id), "agent_aptitudes": []}], SIM_ID)

    assert len(rows) == len(OPERATIVE_TYPES)
    assert {r["operative_type"] for r in rows} == set(OPERATIVE_TYPES)
    assert all(r["aptitude_level"] == DEFAULT_APTITUDE_LEVEL for r in rows)
    assert all(r["is_default"] is True for r in rows)
    # A synthetic row carries no DB identity — it must not look like a stored one.
    assert all(r["id"] is None and r["created_at"] is None for r in rows)


def test_assigned_rows_are_passed_through_unchanged() -> None:
    agent_id = uuid4()
    assigned = [_assigned_row(op, 9 if op == "spy" else 3) for op in OPERATIVE_TYPES]
    rows = AptitudeService._effective_rows([{"id": str(agent_id), "agent_aptitudes": assigned}], SIM_ID)

    by_type = {r["operative_type"]: r for r in rows}
    assert by_type["spy"]["aptitude_level"] == 9
    assert by_type["guardian"]["aptitude_level"] == 3
    assert all(r["is_default"] is False for r in rows)
    assert all(r["id"] is not None for r in rows)


def test_partial_set_is_completed_not_replaced() -> None:
    agent_id = uuid4()
    rows = AptitudeService._effective_rows(
        [{"id": str(agent_id), "agent_aptitudes": [_assigned_row("spy", 9)]}], SIM_ID
    )

    by_type = {r["operative_type"]: r for r in rows}
    assert by_type["spy"]["aptitude_level"] == 9
    assert by_type["spy"]["is_default"] is False
    assert by_type["guardian"]["aptitude_level"] == DEFAULT_APTITUDE_LEVEL
    assert by_type["guardian"]["is_default"] is True


def test_missing_embed_key_is_treated_as_no_rows() -> None:
    # PostgREST omits the embed entirely under some select shapes; `None` and a
    # missing key must not raise, they mean the same thing as an empty list.
    rows = AptitudeService._effective_rows(
        [{"id": str(uuid4())}, {"id": str(uuid4()), "agent_aptitudes": None}], SIM_ID
    )
    assert len(rows) == 2 * len(OPERATIVE_TYPES)
    assert all(r["is_default"] is True for r in rows)


def test_no_agents_yields_no_rows() -> None:
    # An agent that does not exist must not be given a baseline — that would turn
    # a 404-shaped answer into fabricated data.
    assert AptitudeService._effective_rows([], SIM_ID) == []


def test_rows_validate_against_the_response_model() -> None:
    rows = AptitudeService._effective_rows([{"id": str(uuid4()), "agent_aptitudes": [_assigned_row("spy", 9)]}], SIM_ID)
    models = [AptitudeResponse.model_validate(r) for r in rows]
    assert len(models) == len(OPERATIVE_TYPES)
    assert {m.simulation_id for m in models} == {SIM_ID}

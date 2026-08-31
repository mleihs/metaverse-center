"""The derived autonomy parameters must actually land on the agent.

Befund N1, and it turned out to have two halves.

The first is the reported one: `PersonalityExtractionService` has no caller
anywhere in the backend, so all 258 production agents carry
`personality_profile = {}`.

The second only showed up when measuring what that costs. `_derive_autonomy_params`
turns a personality into resilience, volatility, sociability and four need-decay
rates. Because the derivation never ran, production shows

    select count(distinct resilience), count(distinct volatility),
           count(distinct sociability) from agent_mood;   →  1, 1, 1

across all 258 rows. Every agent in every world is behaviourally identical.

And a third thing, which decides how the fix has to look:
`fn_initialize_agent_autonomy` carries `ON CONFLICT (agent_id) DO NOTHING`
twice, and migration 286 (Befund A3) already creates those rows in SQL with the
signature defaults. Calling the Python path afterwards would therefore be a
silent no-op — the exact defect class the whole review is about. Hence
migration 296: creating the row and tuning it are separate calls.
"""

from __future__ import annotations

import ast
import inspect
import textwrap
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest

from backend.services.personality_extraction_service import (
    PersonalityExtractionService,
    _derive_autonomy_params,
)

_ROOT = Path(__file__).resolve().parents[3]
_MIGRATION = _ROOT / "supabase/migrations/20260831060000_296_autonomy_params_can_be_applied_later.sql"


class TestTheMigrationSeparatesCreationFromTuning:
    @pytest.fixture(scope="class")
    def sql(self) -> str:
        assert _MIGRATION.is_file(), f"Migration nicht gefunden: {_MIGRATION}"
        return _MIGRATION.read_text(encoding="utf-8")

    def _body(self, sql: str) -> str:
        start = sql.index("CREATE OR REPLACE FUNCTION fn_apply_agent_autonomy_params")
        return sql[start : sql.index("$fn$;", start)]

    def test_it_updates_the_configuration_columns(self, sql):
        body = self._body(sql)
        for column in ("resilience", "volatility", "sociability"):
            assert f"{column}  = p_{column}" in body or f"{column} = p_{column}" in body, column
        for decay in ("social_decay", "purpose_decay", "safety_decay", "comfort_decay", "stimulation_decay"):
            assert f"{decay}" in body, decay

    def test_it_never_touches_state(self, sql):
        """mood_score, stress_level and the current need levels belong to a
        running world. Tuning a parameter must not reset how an agent feels."""
        body = self._body(sql)
        for state_column in ("mood_score", "stress_level"):
            assert f"{state_column} =" not in body, (
                f"Die Funktion schreibt {state_column} — das ist Zustand, keine Einstellung"
            )

    def test_it_does_not_change_the_creating_function(self, sql):
        """`fn_initialize_agent_autonomy` keeps its DO NOTHING: for creating a
        row that is right. The fix is a second call, not a changed first one."""
        assert "fn_initialize_agent_autonomy" not in self._body(sql)

    def test_the_grant_is_service_role_only(self, sql):
        assert "FROM PUBLIC, anon, authenticated" in sql
        assert "TO service_role" in sql


class TestThePythonPathAppliesThem:
    def test_initialize_agent_autonomy_calls_both_rpcs(self):
        """Creating the rows is not enough — the second call is the whole fix."""
        source = textwrap.dedent(
            inspect.getsource(PersonalityExtractionService.initialize_agent_autonomy.__func__)
        )
        tree = ast.parse(source)
        rpcs = {
            node.args[0].value
            for node in ast.walk(tree)
            if isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and node.func.attr == "rpc"
            and node.args
            and isinstance(node.args[0], ast.Constant)
        }
        assert "fn_initialize_agent_autonomy" in rpcs, "legt die Zeilen nicht mehr an"
        assert "fn_apply_agent_autonomy_params" in rpcs, (
            "Ohne diesen Aufruf bleibt der abgeleitete Wert liegen: die erste "
            "Funktion trägt ON CONFLICT DO NOTHING und die Zeilen existieren "
            "auf Prod bereits alle"
        )

    @pytest.mark.asyncio
    async def test_the_applied_values_are_the_derived_ones(self):
        profile = {
            "openness": 0.4, "conscientiousness": 0.9, "extraversion": 0.3,
            "agreeableness": 0.6, "neuroticism": 0.1,
        }
        expected = _derive_autonomy_params(profile)

        calls: list[tuple[str, dict]] = []
        supabase = MagicMock()
        supabase.rpc = lambda name, params: calls.append((name, params)) or MagicMock(
            execute=AsyncMock(return_value=MagicMock(data={}))
        )

        with pytest.MonkeyPatch.context() as patch:
            patch.setattr(
                PersonalityExtractionService, "extract_personality",
                AsyncMock(return_value=profile),
            )
            from uuid import uuid4

            await PersonalityExtractionService.initialize_agent_autonomy(
                supabase, uuid4(), uuid4()
            )

        applied = next(p for name, p in calls if name == "fn_apply_agent_autonomy_params")
        assert applied["p_resilience"] == expected["resilience"]
        assert applied["p_sociability"] == expected["sociability"]
        assert applied["p_social_decay"] == expected["social_decay"]


class TestTheDerivationActuallyDiffers:
    """If every personality produced the same numbers, wiring it would be
    theatre. Production today: one distinct value across 258 agents."""

    def test_different_personalities_give_different_parameters(self):
        calm = _derive_autonomy_params(
            {"openness": 0.4, "conscientiousness": 0.9, "extraversion": 0.3,
             "agreeableness": 0.6, "neuroticism": 0.1}
        )
        anxious = _derive_autonomy_params(
            {"openness": 0.5, "conscientiousness": 0.5, "extraversion": 0.1,
             "agreeableness": 0.4, "neuroticism": 0.9}
        )
        assert calm["resilience"] != anxious["resilience"]
        assert calm["sociability"] != anxious["sociability"]
        assert calm["volatility"] != anxious["volatility"]

    def test_the_spread_is_wide_enough_to_matter(self):
        values = [
            _derive_autonomy_params(
                {"openness": v, "conscientiousness": v, "extraversion": v,
                 "agreeableness": v, "neuroticism": 1 - v}
            )["resilience"]
            for v in (0.0, 0.5, 1.0)
        ]
        assert max(values) - min(values) >= 0.3, f"zu flach, um Verhalten zu ändern: {values}"


class TestTheForgeCallsIt:
    def test_materialization_extracts_personality_before_aptitudes(self):
        """Order matters: the aptitudes are derived FROM the personality."""
        from backend.services.forge_orchestrator_service import ForgeOrchestratorService

        # `materialize_shard` is a @staticmethod — no `__func__`, unlike the
        # classmethods elsewhere in this file.
        source = inspect.getsource(ForgeOrchestratorService.materialize_shard)
        assert "initialize_simulation_agents" in source, (
            "Die Schmiede ruft die Persönlichkeitsextraktion nicht — dann bleibt "
            "jeder neue Agent beim leeren Profil"
        )
        assert source.index("initialize_simulation_agents") < source.index("_seed_agent_aptitudes"), (
            "Eignungen werden aus der Persönlichkeit abgeleitet; laufen sie "
            "zuerst, bekommt jeder Agent den ebenen Generalisten"
        )

"""Jeder Modellaufruf trägt einen Budget-Kontext — und jede Reparatur wird erwartet.

Zwei Befunde aus D10-7, beide von der Bauart „läuft, kostet Geld, sagt nichts".

## 1. Der Streampfad zahlte außerhalb jedes Budgets

`OpenRouterService.stream_completion` nimmt `budget: BudgetContext | None` und
ruft `_pre_check_budget(budget)` als erste Anweisung. Der Vorabtest ist damit
optional, und `_pre_check_budget(None)` kehrt sofort zurück:

    async def _pre_check_budget(budget):
        if budget is None:
            return
        await BudgetEnforcementService.pre_check(...)

`ChatAIService` baute den Kontext im NICHT streamenden Zweig
(`_generate_single_response`) und übergab im streamenden Zweig gar keinen. Der
interaktive Pfad — der, den ein Mensch wiederholt benutzt — war also der eine,
der an der globalen, der Zweck- und der Weltgrenze vorbeilief. Die andere
Fassung derselben Anfrage hielt sie ein.

Der Vorabtest wirft `BudgetExceededError`. Ihn hinzuzufügen, ohne ihn zu
behandeln, hätte eine stille Überschreitung gegen einen Abbruch getauscht: der
Router fängt pauschal `Exception` und meldete eine bewusste, protokollierte
Verwaltungsentscheidung als „An internal error occurred". Deshalb prüft diese
Datei beides — den Kontext UND seine Behandlung.

## 2. Zwei Reparaturaufrufe waren gar keine Aufrufe

`repair_json_output` hat vier Pflichtargumente und ist eine Koroutine. An zwei
Stellen stand:

    repaired = repair_json_output(content)

Ein Argument, kein `await`. Python bindet die Argumente auch bei `async def`
zum AUFRUFZEITPUNKT, das wirft also sofort `TypeError` — und `TypeError` steht
in beiden `except`-Klauseln darunter. Der Ablauf war damit: Modell rufen
(bezahlt), Antwort erhalten, `TypeError`, Abfangen, Vorlage benutzen, und
`logger.warning("LLM narrative failed, using template")` — eine Meldung, die
eine Ursache nennt, die nicht eingetreten war.

Ein fehlendes `await` erzeugt normalerweise eine RuntimeWarning („coroutine was
never awaited"), die auffällt. Hier nicht: die Koroutine wurde nie erzeugt, weil
schon die Bindung scheiterte. Der lauteste verfügbare Hinweis war damit
ausgerechnet abgeschaltet.
"""

from __future__ import annotations

import ast
import inspect
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[2]
REPO = BACKEND.parent
OPENROUTER = BACKEND / "services" / "external" / "openrouter.py"


def _budget_accepting_methods() -> set[str]:
    """Public OpenRouterService methods that take a `budget` argument."""
    tree = ast.parse(OPENROUTER.read_text(encoding="utf-8"))
    names: set[str] = set()
    for node in ast.walk(tree):
        if not isinstance(node, ast.AsyncFunctionDef | ast.FunctionDef):
            continue
        if node.name.startswith("_"):
            continue
        args = {a.arg for a in list(node.args.args) + list(node.args.kwonlyargs)}
        if "budget" in args:
            names.add(node.name)
    return names


def _call_sites() -> tuple[list[str], list[str]]:
    """Call sites of those methods, split into with-budget and without.

    The receiver is checked, not just the method name: `MorningBriefingService
    .generate(...)` and `ChronicleService.generate(...)` share a name with
    `OpenRouterService.generate` and are not the same call, and
    `replicate_client.generate_image(...)` is a different client with a
    different cost path. Filtering on the attribute alone reported six false
    positives on the first run (J3c).
    """
    methods = _budget_accepting_methods()
    with_budget: list[str] = []
    without: list[str] = []
    for path in sorted(BACKEND.rglob("*.py")):
        parts = set(path.parts)
        if "tests" in parts or ".venv" in parts or path == OPENROUTER:
            continue
        try:
            tree = ast.parse(path.read_text(encoding="utf-8"))
        except SyntaxError:  # pragma: no cover
            continue
        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue
            attr = getattr(node.func, "attr", None)
            if attr not in methods:
                continue
            receiver = ast.unparse(node.func.value)
            if "openrouter" not in receiver.lower():
                continue
            where = f"{path.relative_to(REPO)}:{node.lineno}  {receiver}.{attr}(…)"
            if any(kw.arg == "budget" for kw in node.keywords):
                with_budget.append(where)
            else:
                without.append(where)
    return with_budget, without


class TestTheGateItself:
    def test_the_scan_finds_the_methods_and_the_calls(self) -> None:
        methods = _budget_accepting_methods()
        assert {"generate", "generate_with_system", "generate_image", "stream_completion"} <= methods, methods
        with_budget, without = _call_sites()
        assert len(with_budget) + len(without) >= 15, "zu wenige Aufrufstellen gefunden — der Scan ist kaputt"

    def test_the_receiver_filter_excludes_the_lookalikes(self) -> None:
        """A name match is not a call match."""
        with_budget, without = _call_sites()
        everything = with_budget + without
        for lookalike in ("MorningBriefingService.generate", "ChronicleService.generate", "replicate"):
            assert not any(lookalike in site for site in everything), (
                f"{lookalike} ist kein OpenRouter-Aufruf und darf nicht mitgezählt werden"
            )


class TestEveryOpenRouterCallCarriesABudget:
    def test_no_call_site_without_budget(self) -> None:
        _, without = _call_sites()
        assert not without, (
            "OpenRouter-Aufrufe ohne Budget-Kontext. `_pre_check_budget(None)` "
            "kehrt sofort zurück, diese Aufrufe laufen also an jeder Grenze "
            "vorbei:\n  " + "\n  ".join(without)
        )

    def test_the_streaming_chat_path_in_particular(self) -> None:
        """Named explicitly, so a revert reads as a regression, not as noise."""
        with_budget, _ = _call_sites()
        assert any("chat_ai_service" in site and "stream_completion" in site for site in with_budget)

    def test_both_chat_paths_build_the_context_the_same_way(self) -> None:
        """One construction, or the two drift apart again."""
        from backend.services.chat_ai_service import ChatAIService

        source = inspect.getsource(ChatAIService)
        assert source.count("BudgetContext(") == 1, (
            "Der Budget-Kontext wird an mehr als einer Stelle gebaut — genau so "
            "ist der Streampfad ohne einen davongekommen"
        )
        assert source.count("_chat_budget()") >= 2, (
            "beide Chat-Pfade müssen denselben Helfer benutzen"
        )


class TestABudgetBlockIsNotAnInternalError:
    def test_the_stream_handles_budget_exceeded(self) -> None:
        from backend.services.chat_ai_service import ChatAIService

        source = inspect.getsource(ChatAIService.stream_single_response)
        assert "except BudgetExceededError" in source, (
            "Der Vorabtest wirft BudgetExceededError. Ungefangen meldet der "
            "Router eine bewusste Verwaltungsentscheidung als internen Fehler."
        )
        assert '"error_type": "budget_exceeded"' in source


class TestTheRepairCallsAreRealCalls:
    """`repair_json_output(content)` bound one argument to a four-argument coroutine."""

    def test_every_call_site_awaits_and_passes_every_argument(self) -> None:
        from backend.services.external import output_repair

        signature = inspect.signature(output_repair.repair_json_output)
        required = {
            name
            for name, parameter in signature.parameters.items()
            if parameter.default is inspect.Parameter.empty
        }
        assert required == {"openrouter", "model", "malformed_output", "pydantic_model"}, required

        offenders: list[str] = []
        for path in sorted(BACKEND.rglob("*.py")):
            parts = set(path.parts)
            if "tests" in parts or ".venv" in parts:
                continue
            try:
                tree = ast.parse(path.read_text(encoding="utf-8"))
            except SyntaxError:  # pragma: no cover
                continue
            for node in ast.walk(tree):
                if not isinstance(node, ast.Call):
                    continue
                callee = getattr(node.func, "id", None) or getattr(node.func, "attr", None)
                if callee != "repair_json_output":
                    continue
                supplied = {kw.arg for kw in node.keywords if kw.arg} | set(
                    list(required)[: len(node.args)]
                )
                where = f"{path.relative_to(REPO)}:{node.lineno}"
                if not required <= supplied:
                    offenders.append(f"{where}  fehlende Argumente: {sorted(required - supplied)}")
        assert not offenders, (
            "repair_json_output wird mit zu wenigen Argumenten gerufen. Python "
            "bindet auch bei `async def` sofort — das wirft TypeError am Aufruf, "
            "und TypeError steht in den except-Klauseln daneben:\n  "
            + "\n  ".join(offenders)
        )

    def test_no_call_site_forgets_the_await(self) -> None:
        offenders: list[str] = []
        for path in sorted(BACKEND.rglob("*.py")):
            parts = set(path.parts)
            if "tests" in parts or ".venv" in parts:
                continue
            try:
                tree = ast.parse(path.read_text(encoding="utf-8"))
            except SyntaxError:  # pragma: no cover
                continue
            awaited = {
                id(node.value)
                for node in ast.walk(tree)
                if isinstance(node, ast.Await)
            }
            for node in ast.walk(tree):
                if not isinstance(node, ast.Call):
                    continue
                callee = getattr(node.func, "id", None) or getattr(node.func, "attr", None)
                if callee == "repair_json_output" and id(node) not in awaited:
                    offenders.append(f"{path.relative_to(REPO)}:{node.lineno}")
        assert not offenders, "repair_json_output ohne await: " + ", ".join(offenders)


class TestTheRepairActuallyChecksTheShape:
    """It accepted a `pydantic_model` and never validated against it."""

    def test_valid_json_of_the_wrong_shape_is_not_the_fast_path(self) -> None:
        from backend.models.generation import AutonomousEventNarrative
        from backend.services.external.output_repair import _matches

        assert _matches(
            {"title": "a", "description": "b", "title_de": "c", "description_de": "d"},
            AutonomousEventNarrative,
        )
        assert not _matches({"headline": "a"}, AutonomousEventNarrative)
        assert not _matches(["a"], AutonomousEventNarrative)
        assert not _matches("a string", AutonomousEventNarrative)

    def test_the_two_narrative_shapes_match_their_prompts(self) -> None:
        """The DTO and the prompt that asks for it must name the same keys."""
        from backend.models.generation import AutonomousEventNarrative, MorningBriefingNarrative
        from backend.services.autonomous_event_service import _EVENT_NARRATIVE_SYSTEM
        from backend.services.morning_briefing_service import _BRIEFING_SYSTEM

        for field in AutonomousEventNarrative.model_fields:
            assert f'"{field}"' in _EVENT_NARRATIVE_SYSTEM, f"{field} fehlt im Prompt"
        for field in MorningBriefingNarrative.model_fields:
            assert f'"{field}"' in _BRIEFING_SYSTEM, f"{field} fehlt im Prompt"

    def test_the_event_fallback_produces_the_same_keys_as_the_model(self) -> None:
        """The template narrative is the other half of an either/or.

        `_insert_event` reads the keys without looking at which half produced
        them, so both must agree — otherwise a budget block quietly yields an
        event with different fields than a successful generation.
        """
        from backend.models.generation import AutonomousEventNarrative
        from backend.services.autonomous_event_service import AutonomousEventService

        template = AutonomousEventService._template_narrative("stress_breakdown", "A, B", "Zone")
        assert set(AutonomousEventNarrative.model_fields) <= set(template), (
            f"Vorlage liefert {sorted(template)}, Modell verlangt "
            f"{sorted(AutonomousEventNarrative.model_fields)}"
        )

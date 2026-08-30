"""Tests for the prompt-template contract.

The point of this file is the first class: `TestContractMatchesCallSites` walks
the AST of every module that renders a prompt template, extracts the variable
names each call site actually supplies, and compares them with the declaration
in `prompt_contracts`. A contract that drifts from its call site — a variable
added in the service and not in the declaration, or the reverse — turns this
red. Without that binding the declaration would be a second copy of the truth,
and the repair pass in `scripts/repair_simulation_prompt_templates.py` would
happily strip a legitimate placeholder out of production rows.

The remaining classes cover the renderer, the sanitiser and the platform frame.
"""

from __future__ import annotations

import ast
import fnmatch
from pathlib import Path

import pytest

from backend.services.chat_ai_service import ChatAIService
from backend.services.prompt_contracts import (
    PROMPT_CONTRACTS,
    Defect,
    audit_template,
    example_variables,
    get_contract,
    render_template,
    sanitize_template,
    variable_catalogue,
)
from backend.services.prompt_service import (
    HARDCODED_FALLBACKS,
    PromptResolver,
    PromptSource,
    ResolvedPrompt,
)

BACKEND = Path(__file__).resolve().parents[2]

# Modules that render prompt templates. Every literal template_type they name
# must have a contract, and its variables must match what they supply.
RENDERING_MODULES = (
    "services/generation_service.py",
    "services/chat_ai_service.py",
    "services/epoch_invitation_service.py",
)

# `chat_system_prompt` is the one call site whose variables are not a literal
# dict at the fill site: they come from ChatAIService._build_agent_variables plus
# two extras added conditionally. It is covered by an execution test below
# (`test_chat_system_prompt_contract`) rather than by the AST sweep.
AST_EXEMPT_TYPES = frozenset({"chat_system_prompt"})


# ── AST extraction ───────────────────────────────────────────────────────────


def _literal(node: ast.AST) -> str | None:
    """The string value of a node, or None when it is not a plain literal."""
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    return None


def _type_patterns(node: ast.AST) -> list[str]:
    """Every template_type a node can evaluate to, as literals or globs.

    Three shapes occur in the services:

    * ``"portrait_description"`` -> that one type;
    * ``f"instagram_{content_type}_caption"`` -> the glob ``instagram_*_caption``,
      which stands for the four caption contracts;
    * ``"building_generation_named" if name else "building_generation"`` -> both.

    Without this the seven dynamically-named contracts would have no call site
    bound to them, which is exactly the gap the file exists to close.
    """
    literal = _literal(node)
    if literal is not None:
        return [literal]
    if isinstance(node, ast.JoinedStr):
        parts = []
        for value in node.values:
            if isinstance(value, ast.Constant) and isinstance(value.value, str):
                parts.append(value.value)
            else:
                parts.append("*")
        return ["".join(parts)]
    if isinstance(node, ast.IfExp):
        return _type_patterns(node.body) + _type_patterns(node.orelse)
    return []


def _matching_types(pattern: str) -> list[str]:
    """The declared template types a pattern stands for."""
    if "*" not in pattern:
        return [pattern]
    return sorted(fnmatch.filter(PROMPT_CONTRACTS, pattern))


def _dict_keys(node: ast.AST) -> set[str] | None:
    """The literal string keys of a dict node, or None if it is not one."""
    if not isinstance(node, ast.Dict):
        return None
    keys = set()
    for key in node.keys:
        name = _literal(key) if key is not None else None
        if name is None:
            return None
        keys.add(name)
    return keys


def _call_sites(path: Path) -> list[tuple[str, set[str], int]]:
    """Extract (template_type, supplied variable names, line) from one module.

    Handles the two shapes the codebase uses:

    * ``self._generate(template_type="x", variables={...})`` — the generation
      service, plus any ``variables["y"] = ...`` added in the same function;
    * ``tpl = await resolver.resolve("x", ...)`` followed by
      ``resolver.fill_template(tpl, {...})`` — chat and epoch invitations.
    """
    tree = ast.parse(path.read_text(encoding="utf-8"))
    found: list[tuple[str, set[str], int]] = []

    for fn in ast.walk(tree):
        if not isinstance(fn, ast.AsyncFunctionDef | ast.FunctionDef):
            continue

        # local name -> template_type, from `resolve("<type>")`
        aliases: dict[str, str] = {}
        # local name -> the template_type patterns a plain assignment can yield
        type_aliases: dict[str, list[str]] = {}
        # local name -> literal dict keys
        dicts: dict[str, set[str]] = {}
        # keys assigned conditionally as `variables["x"] = ...`
        conditional: dict[str, set[str]] = {}

        for node in ast.walk(fn):
            if isinstance(node, ast.Assign | ast.AnnAssign):
                targets = node.targets if isinstance(node, ast.Assign) else [node.target]
                value = node.value
                for target in targets:
                    if isinstance(target, ast.Name) and value is not None:
                        call = value.value if isinstance(value, ast.Await) else value
                        if isinstance(call, ast.Call) and ast.unparse(call.func).endswith(".resolve"):
                            template_type = _literal(call.args[0]) if call.args else None
                            if template_type:
                                aliases[target.id] = template_type
                        keys = _dict_keys(value)
                        if keys is not None:
                            dicts[target.id] = keys
                        patterns = _type_patterns(value)
                        if patterns:
                            type_aliases[target.id] = patterns
                    elif (
                        isinstance(target, ast.Subscript)
                        and isinstance(target.value, ast.Name)
                        and _literal(target.slice) is not None
                    ):
                        conditional.setdefault(target.value.id, set()).add(str(_literal(target.slice)))

        for node in ast.walk(fn):
            if not isinstance(node, ast.Call):
                continue
            func_name = ast.unparse(node.func)

            if func_name.endswith("_generate"):
                patterns: list[str] = []
                variables: ast.AST | None = None
                for kw in node.keywords:
                    if kw.arg == "template_type":
                        patterns = _type_patterns(kw.value)
                        if not patterns and isinstance(kw.value, ast.Name):
                            patterns = type_aliases.get(kw.value.id, [])
                    elif kw.arg == "variables":
                        variables = kw.value
                if not patterns or variables is None:
                    continue
                keys = _dict_keys(variables)
                if keys is None and isinstance(variables, ast.Name):
                    keys = set(dicts.get(variables.id, set())) | conditional.get(variables.id, set())
                elif keys is not None and isinstance(variables, ast.Dict):
                    keys = set(keys)
                if keys is None:
                    continue
                for pattern in patterns:
                    for resolved_type in _matching_types(pattern):
                        found.append((resolved_type, keys, node.lineno))

            elif func_name.endswith("fill_template") and node.args:
                target = node.args[0]
                if not isinstance(target, ast.Name):
                    continue
                template_type = aliases.get(target.id)
                if template_type is None:
                    continue
                arg = node.args[1] if len(node.args) > 1 else None
                keys = _dict_keys(arg) if arg is not None else None
                if keys is None and isinstance(arg, ast.Name):
                    keys = set(dicts.get(arg.id, set())) | conditional.get(arg.id, set())
                if keys is None:
                    continue
                found.append((template_type, keys, node.lineno))

    return found


ALL_CALL_SITES = [
    (module, template_type, keys, line)
    for module in RENDERING_MODULES
    for template_type, keys, line in _call_sites(BACKEND / module)
]


class TestContractMatchesCallSites:
    """The declaration is bound to the code that renders. It cannot drift quietly."""

    def test_call_sites_were_found(self):
        # Guard against the extractor silently matching nothing after a refactor,
        # which would turn every test below into a no-op.
        assert len(ALL_CALL_SITES) >= 30

    def test_every_declared_contract_has_a_call_site(self):
        """A contract nobody renders is a contract nobody can keep honest."""
        bound = {template_type for _, template_type, _, _ in ALL_CALL_SITES} | AST_EXEMPT_TYPES
        unbound = sorted(set(PROMPT_CONTRACTS) - bound)
        assert not unbound, (
            f"These contracts are declared but no call site was found for them: {unbound}. "
            f"Either the type is no longer rendered (drop the contract) or the extractor "
            f"cannot see its call site (extend _type_patterns)."
        )

    @pytest.mark.parametrize(
        ("module", "template_type", "keys", "line"),
        [pytest.param(*site, id=f"{site[1]}@{Path(site[0]).stem}:{site[3]}") for site in ALL_CALL_SITES],
    )
    def test_call_site_matches_contract(self, module: str, template_type: str, keys: set[str], line: int):
        if template_type in AST_EXEMPT_TYPES:
            pytest.skip(f"{template_type} is covered by an execution test")

        contract = get_contract(template_type)
        assert contract is not None, (
            f"{module}:{line} renders '{template_type}', which has no contract in prompt_contracts.py. "
            f"Declare it with the variables this call site supplies: {sorted(keys)}"
        )
        assert set(contract.variables) == keys, (
            f"{module}:{line} supplies {sorted(keys)} for '{template_type}', "
            f"but the contract declares {sorted(contract.variables)}. "
            f"Only in code: {sorted(keys - contract.variables)}. "
            f"Only in contract: {sorted(contract.variables - keys)}."
        )

    def test_chat_system_prompt_contract(self):
        """The chat variables are assembled, not a literal — so execute the assembler."""
        agent = {
            "id": "00000000-0000-0000-0000-000000000001",
            "name": "Test",
            "character": "c",
            "background": "b",
            "system": "politics",
            "gender": "female",
            "primary_profession": "archivist",
        }
        supplied = set(ChatAIService._build_agent_variables(agent, {"name": "Sim"}, "en"))
        # Two more are added by _build_generation_context when they exist.
        supplied |= {"agent_mood", "agent_memories"}

        contract = get_contract("chat_system_prompt")
        assert contract is not None
        assert set(contract.variables) == supplied, (
            f"chat_system_prompt supplies {sorted(supplied)} but declares {sorted(contract.variables)}"
        )


class TestHardcodedFallbacksSatisfyTheirContract:
    """The last-resort prompts live in this repo, so they must obey the contract too."""

    @pytest.mark.parametrize("template_type", sorted(HARDCODED_FALLBACKS))
    def test_fallback_placeholders_are_declared(self, template_type: str):
        contract = get_contract(template_type)
        assert contract is not None, f"hardcoded fallback '{template_type}' has no contract"
        audit = audit_template(HARDCODED_FALLBACKS[template_type], contract)
        assert not audit.unknown, f"'{template_type}' fallback uses undeclared {sorted(audit.unknown)}"
        assert not audit.mustache, f"'{template_type}' fallback uses Mustache {sorted(audit.mustache)}"


class TestPlaceholderSyntax:
    """One syntax: {identifier}. Every other brace is literal."""

    def test_declared_variable_is_substituted(self):
        contract = get_contract("portrait_description")
        result = render_template("A portrait of {agent_name}.", {"agent_name": "Almandine"}, contract)
        assert result.text == "A portrait of Almandine."
        assert result.audit.is_clean

    def test_declared_but_unsupplied_renders_empty_and_stays_silent(self):
        contract = get_contract("portrait_description")
        result = render_template("Character: {agent_character}.", {}, contract)
        assert result.text == "Character: ."
        assert result.audit.is_clean, "a conditional variable without a value is normal, not a defect"

    def test_undeclared_placeholder_renders_empty_and_is_reported(self):
        contract = get_contract("portrait_description")
        result = render_template("a {agent_title} of the bureau", {}, contract)
        assert result.text == "a  of the bureau"
        assert result.audit.unknown == frozenset({"agent_title"})
        assert result.audit.defects == {Defect.UNKNOWN: frozenset({"agent_title"})}

    def test_json_braces_survive_untouched(self):
        """The chronicle prompt carries a JSON example. It must reach the model intact."""
        contract = get_contract("chronicle_generation")
        text = 'Edition {edition_number}. Return JSON: {"title": "x", "content": "y"}'
        result = render_template(text, {"edition_number": "12"}, contract)
        assert result.text == 'Edition 12. Return JSON: {"title": "x", "content": "y"}'
        assert result.audit.is_clean

    def test_mustache_is_substituted_but_reported(self):
        """Four production worlds ship {{agent_name}}. Render it, but say so."""
        contract = get_contract("relationship_generation")
        result = render_template("Name: {{agent_name}}", {"agent_name": "Almandine"}, contract)
        assert result.text == "Name: Almandine"
        assert result.audit.mustache == frozenset({"agent_name"})

    def test_no_contract_means_no_judgement(self):
        result = render_template("{whatever}", {"whatever": "x"}, None)
        assert result.text == "x"
        assert result.audit.is_clean


class TestSanitize:
    """The repair: strip what cannot be filled, fix what is merely mis-written."""

    # The real production text of the ATRAMENT world, abridged. Two invented
    # variables, one legitimate one, one literal brace.
    ATRAMENT_PORTRAIT = (
        "Describe a portrait of {agent_name}, a {agent_title} of the Tintenbad bureau. "
        "Pinned to the lapel is a diagnosis: 'Leserlichkeit: {leserlichkeit_level}%'. "
        "{agent_character} confronts the lens."
    )

    def test_unknown_placeholders_are_removed_and_the_prose_survives(self):
        contract = get_contract("portrait_description")
        result = sanitize_template(self.ATRAMENT_PORTRAIT, contract)
        assert result.changed
        assert "{agent_title}" not in result.text
        assert "{leserlichkeit_level}" not in result.text
        assert "{agent_name}" in result.text
        assert "{agent_character}" in result.text
        # The sentence carrying {agent_name} survives; only the token goes.
        assert "Tintenbad bureau" in result.text
        assert "confronts the lens" in result.text
        assert result.used_variables == ["agent_character", "agent_name"]

    def test_a_sentence_that_only_served_an_invented_variable_is_dropped(self):
        """The measured harm: stripping the token alone left 'Leserlichkeit: %'.

        An image model reads that as an instruction to draw a badge with an
        empty number — the very fiction the repair exists to stop.
        """
        contract = get_contract("portrait_description")
        result = sanitize_template(self.ATRAMENT_PORTRAIT, contract)
        assert "Pinned to the lapel" not in result.text
        assert "Leserlichkeit" not in result.text
        assert "%" not in result.text

    def test_removal_closes_the_gap_it_leaves(self):
        """The space before the full stop goes with the token, not after it."""
        contract = get_contract("chat_system_prompt")
        text = "{agent_background} A purge left {agent_condition}. Speak on."
        result = sanitize_template(text, contract)
        assert result.text == "{agent_background} A purge left. Speak on."

    def test_a_sentence_with_a_declared_variable_is_kept(self):
        contract = get_contract("chronicle_generation")
        text = "The headline reports a {event_summary} diagnosed as a {pathological_condition} of the state."
        result = sanitize_template(text, contract)
        assert result.text == "The headline reports a {event_summary} diagnosed as a of the state."

    def test_an_abbreviation_does_not_end_a_sentence(self):
        """'e.g.,' must not split — a wrong seam would drop the wrong words."""
        contract = get_contract("chronicle_generation")
        text = "Protocols (e.g., re-inscription) for {edition_number}. A {pathological_condition} report."
        result = sanitize_template(text, contract)
        assert "e.g., re-inscription" in result.text
        assert "{edition_number}" in result.text
        assert "pathological" not in result.text

    def test_mustache_of_a_declared_variable_is_normalised(self):
        contract = get_contract("relationship_generation")
        result = sanitize_template("Name: {{agent_name}}\nOther: {{other_agents}}", contract)
        assert result.text == "Name: {agent_name}\nOther: {other_agents}"
        assert result.used_variables == ["agent_name", "other_agents"]

    def test_mustache_of_an_undeclared_variable_is_removed(self):
        contract = get_contract("relationship_generation")
        result = sanitize_template("TYPES:\n{{relationship_types}}", contract)
        assert result.text == "TYPES:\n"

    def test_line_structure_of_an_untouched_segment_is_preserved(self):
        """Only changed segments are tidied, so layout elsewhere survives."""
        contract = get_contract("building_image_description")
        text = "Building:  {building_name}\nType:  {building_type}\nBadge: {building_leserlichkeit}"
        result = sanitize_template(text, contract)
        assert result.text == "Building:  {building_name}\nType:  {building_type}\n"

    def test_a_clean_multi_paragraph_template_is_returned_byte_identical(self):
        """Blank lines are structure, not emptiness.

        The first version of the segment walk decided "drop this separator" by
        looking at whether the previous rebuilt entry was empty — which is also
        true for a blank line. It ate the blank lines out of every bulleted
        template and reported `changed=True` with an empty defect set: a silent
        rewrite with no reason to show the operator, on 48 production rows.
        """
        contract = get_contract("portrait_description")
        text = (
            "RULES:\n"
            "- Be bold\n"
            "\n"
            "VARIABLES:\n"
            "- {agent_name}\n"
            "\n"
            "Portrait of {agent_character}.\n\n- mood\n\n- light"
        )
        result = sanitize_template(text, contract)
        assert result.text == text
        assert not result.changed

    def test_a_dropped_sentence_still_takes_its_separator(self):
        """Rule 2 must keep working after the blank-line fix."""
        contract = get_contract("portrait_description")
        result = sanitize_template("Portrait of {agent_name}. Badge: {leserlichkeit_level}%. Done.", contract)
        assert result.text == "Portrait of {agent_name}. Done."

    def test_a_clean_template_is_returned_byte_identical(self):
        contract = get_contract("portrait_description")
        text = 'Portrait of {agent_name}. {agent_character}. Return {"a": 1}'
        result = sanitize_template(text, contract)
        assert result.text == text
        assert not result.changed

    def test_without_a_contract_nothing_is_touched(self):
        text = "{{source_building_name}} and {invented}"
        result = sanitize_template(text, None)
        assert result.text == text
        assert not result.changed


class TestPlatformFrame:
    """The guarantee a world may not edit away."""

    @staticmethod
    def _resolved(template_type: str, content: str, source: PromptSource) -> ResolvedPrompt:
        return ResolvedPrompt(
            template_type=template_type,
            locale="en",
            prompt_content=content,
            system_prompt=None,
            variables=[],
            default_model=None,
            temperature=0.8,
            max_tokens=300,
            negative_prompt=None,
            source=source,
        )

    def test_frame_is_appended_to_a_simulation_template(self):
        resolver = PromptResolver(supabase=None)  # type: ignore[arg-type]  # no I/O on this path
        filled = resolver.fill_template(
            self._resolved("portrait_description", "A kalotype of {agent_name}.", PromptSource.SIMULATION_LOCALE),
            {"agent_name": "Almandine"},
        )
        assert filled.startswith("A kalotype of Almandine.")
        assert "exactly ONE person" in filled
        assert "comma-separated visual descriptors" in filled

    def test_frame_is_not_appended_to_a_platform_template(self):
        resolver = PromptResolver(supabase=None)  # type: ignore[arg-type]
        filled = resolver.fill_template(
            self._resolved("portrait_description", "A portrait of {agent_name}.", PromptSource.PLATFORM_LOCALE),
            {"agent_name": "Almandine"},
        )
        assert filled == "A portrait of Almandine."

    def test_a_type_without_a_frame_gets_nothing_appended(self):
        """memory_extraction is structured observation, deliberately unframed."""
        contract = get_contract("memory_extraction")
        assert contract is not None and not contract.frame, "pick a type that still has no frame"
        resolver = PromptResolver(supabase=None)  # type: ignore[arg-type]
        filled = resolver.fill_template(
            self._resolved("memory_extraction", "Analyze {agent_name}.", PromptSource.SIMULATION_LOCALE),
            {"agent_name": "Almandine"},
        )
        assert filled == "Analyze Almandine."

    def test_system_prompt_is_filled(self):
        """The platform chronicle system prompt names {simulation_name}."""
        resolver = PromptResolver(supabase=None)  # type: ignore[arg-type]
        resolved = self._resolved("chronicle_generation", "body", PromptSource.PLATFORM_LOCALE)
        resolved.system_prompt = "You are the editor-in-chief of {simulation_name}'s newspaper."
        filled = resolver.fill_system_prompt(resolved, {"simulation_name": "Velgarien"})
        assert filled == "You are the editor-in-chief of Velgarien's newspaper."

    def test_system_prompt_of_a_template_without_one_is_empty(self):
        resolver = PromptResolver(supabase=None)  # type: ignore[arg-type]
        resolved = self._resolved("chronicle_generation", "body", PromptSource.PLATFORM_LOCALE)
        assert resolver.fill_system_prompt(resolved, {}) == ""


class TestContractHygiene:
    """Invariants over the declaration itself."""

    def test_every_contract_is_keyed_by_its_own_type(self):
        for key, contract in PROMPT_CONTRACTS.items():
            assert key == contract.template_type

    def test_every_variable_is_a_valid_placeholder_name(self):
        for contract in PROMPT_CONTRACTS.values():
            for name in contract.variables:
                assert name.isidentifier(), f"{contract.template_type}: '{name}' is not a placeholder name"

    def test_no_contract_declares_an_empty_variable_set(self):
        for contract in PROMPT_CONTRACTS.values():
            assert contract.variables, f"{contract.template_type} declares no variables"

    def test_frames_never_contain_a_placeholder(self):
        """The frame is appended after rendering, so a placeholder there would leak."""
        for contract in PROMPT_CONTRACTS.values():
            if not contract.frame:
                continue
            audit = audit_template(contract.frame, contract)
            assert not audit.known and not audit.unknown and not audit.mustache, (
                f"{contract.template_type} frame contains a placeholder"
            )

    def test_variable_catalogue_lists_every_variable(self):
        contract = get_contract("portrait_description")
        assert contract is not None
        catalogue = variable_catalogue(contract)
        for name in contract.variables:
            assert f"{{{name}}}" in catalogue

    def test_example_variables_cover_the_contract(self):
        contract = get_contract("building_image_description")
        assert contract is not None
        examples = example_variables(contract)
        assert set(examples) == set(contract.variables)
        assert all(value for value in examples.values())

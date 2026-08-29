-- Migration 280 — one placeholder syntax for prompt templates
--
-- WHY
-- ---
-- `prompt_templates.prompt_content` is rendered by `PromptResolver`, whose
-- substitution is Python `str.format` style: `{name}`. Several seeds were
-- written in Mustache style, `{{name}}`, which `str.format` renders as the
-- literal text `{name}` — the variable is never substituted at all.
--
-- Measured on production 2026-08-30 (docs/analysis/forge-prod-run-2026-08-30.md,
-- finding 23), rendered through the real code path:
--
--   relationship_generation  ->  "Name: {agent_name}"   reaches the model
--   event_echo_transformation ->  "Title: {source_title}" reaches the model
--   cycle_sitrep_generation   ->  "Cycle {cycle_number}"  reaches the model
--
-- Four worlds have been generating agent relationships and cross-world echoes
-- without the model ever seeing the agent or the event. Migrations 026 and 028
-- seeded them in February 2026; nothing has ever noticed, because a template
-- that renders its own placeholder names produces plausible-looking output.
--
-- `scanner_service.py` already carried a local workaround for exactly this
-- (`user_template.replace("{{", "{")`, with a comment naming the mismatch).
-- The workaround is removed in the same change: the data is now correct, so
-- the code no longer has to compensate for it.
--
-- WHAT
-- ----
-- 1. Normalise every `{{identifier}}` to `{identifier}` in both text columns.
--    Verified on all 104 production rows: every doubled brace is a Mustache
--    placeholder. Nothing uses `{{` to escape a literal brace — JSON examples
--    inside prompts are written with single braces and are left untouched by
--    the renderer, which only substitutes `{identifier}`.
-- 2. A CHECK constraint so the mistake cannot come back. The service layer
--    rejects it first with a readable message (PromptTemplateService) and the
--    Forge repairs it before storing (ForgeThemeService); this is the backstop
--    that holds when a future migration seeds a template by hand.
--
-- Simulation-owned rows also carry invented placeholders, which are prose-level
-- damage a constraint cannot express; those are repaired by
-- `scripts/repair_simulation_prompt_templates.py` (reversible, dry-run first).

BEGIN;

UPDATE public.prompt_templates
SET
    prompt_content = regexp_replace(prompt_content, '\{\{(\w+)\}\}', '{\1}', 'g'),
    system_prompt = CASE
        WHEN system_prompt IS NULL THEN NULL
        ELSE regexp_replace(system_prompt, '\{\{(\w+)\}\}', '{\1}', 'g')
    END
WHERE
    prompt_content ~ '\{\{\w+\}\}'
    OR system_prompt ~ '\{\{\w+\}\}';

ALTER TABLE public.prompt_templates
    ADD CONSTRAINT prompt_templates_single_brace_placeholders
    CHECK (
        prompt_content !~ '\{\{\w+\}\}'
        AND (system_prompt IS NULL OR system_prompt !~ '\{\{\w+\}\}')
    );

COMMENT ON CONSTRAINT prompt_templates_single_brace_placeholders ON public.prompt_templates IS
    'Placeholders are {name}, never {{name}}. PromptResolver renders str.format style, so a '
    'doubled brace is never substituted and reaches the model as literal text. See migration 280.';

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- 279 — Reasoning effort per AI purpose (Admin > Models)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- WHY
-- ---
-- OpenRouter spends reasoning tokens from inside `max_tokens` and bills them as
-- output ("max_tokens must be strictly higher than the reasoning budget";
-- "Reasoning tokens are considered output tokens and charged accordingly").
-- Effort maps to a share of that budget: xhigh ~95%, high ~80%, medium ~50%,
-- low ~20%, minimal ~10%.
--
-- `model_forge` carries `deepseek/deepseek-v4-pro`, which OpenRouter offers
-- ONLY at `high` and `xhigh`. Nothing in the backend ever set a reasoning
-- level, so every Forge call ran at the model's own default. Measured on
-- production 2026-08-29, purpose `entity` (max_tokens 3072):
--
--   3016 of 3072 tokens went to thinking; 56 were left for the answer.
--   3 of 4 attempts died as
--     UnexpectedModelBehavior: Model token limit (3072) exceeded
--     before any response was generated
--   -> HTTP 502 after 50-115s each, billed in full, and the wizard stalled at
--      "3 of 6 operatives" while reporting the department complete.
--
-- Turning thinking off is a first-class mode on the V4 hybrids, not a
-- workaround. Measured against the real ForgeAgentDraft schema:
--   entity  ~25% complete objects -> 3/3, 50-115s -> ~31s, 922-1026 words
--   lore    2/2 either way, but more sections, 40% faster, half the cost
-- `anchors` stays on `auto`: the run that produced correctly dated, checkable
-- citations (Scott, Seeing Like a State, 1998) was a thinking run.
--
-- WHAT
-- ----
-- Five `reasoning_<purpose>` keys, read by `get_platform_reasoning()` through
-- the same 5-minute cache as `model_*`. Values:
--   off      -> sends {"enabled": false}, thinking suppressed
--   minimal | low | medium | high | xhigh -> sends {"effort": "<level>"}
--   auto     -> sends nothing, the model's own default applies
-- An unknown value logs a warning and falls back to `auto`, so a typo degrades
-- to today's behaviour instead of breaking the call.
--
-- Safe to re-run: ON CONFLICT DO NOTHING leaves any admin edit in place.
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO platform_settings (setting_key, setting_value, description) VALUES
  (
    'reasoning_entity',
    '"off"'::jsonb,
    'Reasoning effort for single agent/building generation. off | minimal | low | medium | high | xhigh | auto. Measured: "off" takes entity generation from ~25% to 3/3 complete objects at max_tokens 3072, because deepseek-v4-pro otherwise spends the whole budget thinking.'
  ),
  (
    'reasoning_lore',
    '"off"'::jsonb,
    'Reasoning effort for the Lore Scroll. off | minimal | low | medium | high | xhigh | auto. Measured: "off" keeps 2/2 success, yields more sections, runs 40% faster and costs half.'
  ),
  (
    'reasoning_chunk',
    '"off"'::jsonb,
    'Reasoning effort for batch geography/agent/building generation. off | minimal | low | medium | high | xhigh | auto. Same budget arithmetic as entity: long structured output leaves no room to think.'
  ),
  (
    'reasoning_anchors',
    '"auto"'::jsonb,
    'Reasoning effort for philosophical anchors. off | minimal | low | medium | high | xhigh | auto. Left on "auto": the run that produced correctly dated, checkable citations was a thinking run. Change only with a measurement.'
  ),
  (
    'reasoning_dossier',
    '"auto"'::jsonb,
    'Reasoning effort for the classified dossier (~9000 words at max_tokens 16384). off | minimal | low | medium | high | xhigh | auto. Left on "auto": the measurement was inconclusive, 3 of 4 runs hit an upstream provider error unrelated to thinking.'
  )
ON CONFLICT (setting_key) DO NOTHING;

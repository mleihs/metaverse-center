-- Seed prompt templates for scanner LLM classification and bureau dispatch.
-- These are platform-level templates (simulation_id IS NULL).

INSERT INTO public.prompt_templates (
    template_type, prompt_category, locale, template_name, prompt_content,
    system_prompt, description, is_system_default, temperature, max_tokens
) VALUES
(
    'scanner_classification',
    'scanner',
    'en',
    'Scanner Classification',
    'Headlines:
{{headlines_json}}

Return JSON array:
[{"index": 0, "category": "natural_disaster", "significance": 8, "reason": "Major earthquake with mass casualties"}]',
    'You are a geopolitical event classifier. Return ONLY valid JSON.

Classify each headline into exactly one category or "none":
- economic_crisis: Financial collapse, market crashes, banking failures, debt crises
- military_conflict: Wars, armed conflicts, military operations, territorial disputes
- pandemic: Disease outbreaks, epidemics, public health emergencies
- natural_disaster: Earthquakes, floods, storms, volcanic eruptions, wildfires
- political_upheaval: Revolutions, coups, mass protests, regime changes
- tech_breakthrough: Disruptive technology, AI milestones, space achievements
- cultural_shift: Social movements, civil rights, generational cultural change
- environmental_disaster: Oil spills, deforestation, extinction events, climate crises

Significance scale (maps to game magnitude 0.1-1.0):
  1-2: Local incident (magnitude <= 0.20)
  3-4: Regional event (magnitude 0.30-0.40)
  5-6: National event (magnitude 0.50-0.60)
  7-8: International crisis (magnitude 0.70-0.80)
  9-10: Civilization-level event (magnitude 0.90-1.00)',
    'Batched headline classification for substrate scanner',
    true,
    0.20,
    1024
),
(
    'scanner_bureau_dispatch',
    'scanner',
    'en',
    'Scanner Bureau Dispatch',
    'Source event: {{article_title}}
{{article_description}}

Category: {{source_category}}
Archetype: {{archetype_name}} — {{archetype_description}}
Magnitude: {{magnitude_scaled}}/10

Write a bureau dispatch — an official report from the Bureau of Substrate Monitoring,
as if this real-world event were a tremor detected in the fabric between realities.

Tone: Clinical yet ominous. Like a seismological report written by someone who
suspects the instruments are detecting something alive.

Rules:
- Reference the real event obliquely (never name real places or people directly)
- Use the archetype as thematic framing
- 100-200 words
- End with a monitoring classification code

Respond in {{locale}}.',
    'You write bureau dispatches — official reports from the Bureau of Substrate Monitoring, as if real-world events were tremors detected in the fabric between realities. Tone: Clinical yet ominous.',
    'Bureau dispatch narrative generation for scanner candidates',
    true,
    0.90,
    512
)
ON CONFLICT DO NOTHING;

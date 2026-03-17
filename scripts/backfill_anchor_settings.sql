-- One-time backfill: populate simulation_settings category='anchor' for existing
-- simulations that were materialized from forge_drafts before migration 122.
--
-- Run via: psql $DATABASE_URL -f scripts/backfill_anchor_settings.sql
-- Or paste into Supabase SQL Editor.
--
-- Safe to re-run: uses ON CONFLICT DO NOTHING.

INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value)
SELECT sim.id, 'anchor', kv.key, to_jsonb(kv.value)
FROM simulations sim
JOIN forge_drafts fd ON fd.user_id = sim.owner_id
    AND fd.status = 'completed'
    AND (fd.philosophical_anchor->'selected'->>'title') = sim.name
CROSS JOIN LATERAL (
    VALUES
        ('title',                    fd.philosophical_anchor->'selected'->>'title'),
        ('title_de',                 coalesce(fd.philosophical_anchor->'selected'->>'title_de', '')),
        ('core_question',            coalesce(fd.philosophical_anchor->'selected'->>'core_question', '')),
        ('core_question_de',         coalesce(fd.philosophical_anchor->'selected'->>'core_question_de', '')),
        ('literary_influence',       coalesce(fd.philosophical_anchor->'selected'->>'literary_influence', '')),
        ('literary_influence_de',    coalesce(fd.philosophical_anchor->'selected'->>'literary_influence_de', '')),
        ('description',              coalesce(fd.philosophical_anchor->'selected'->>'description', '')),
        ('description_de',           coalesce(fd.philosophical_anchor->'selected'->>'description_de', '')),
        ('bleed_signature_suggestion', coalesce(fd.philosophical_anchor->'selected'->>'bleed_signature_suggestion', '')),
        ('seed_prompt',              coalesce(fd.seed_prompt, ''))
) AS kv(key, value)
WHERE sim.deleted_at IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM simulation_settings ss
      WHERE ss.simulation_id = sim.id AND ss.category = 'anchor'
  )
ON CONFLICT (simulation_id, category, setting_key) DO NOTHING;

-- Track lore generation progress in the forge ceremony.
-- The background task writes progress JSONB to this column;
-- get_forge_progress() includes it in the poll response.

ALTER TABLE public.simulations
  ADD COLUMN IF NOT EXISTS lore_progress jsonb DEFAULT NULL;

-- PostgreSQL SELECT * in views resolves at creation time.
-- Must refresh after adding a column.
CREATE OR REPLACE VIEW public.active_simulations AS
  SELECT * FROM simulations WHERE deleted_at IS NULL;

-- Replace get_forge_progress() to include lore_progress in the response.
CREATE OR REPLACE FUNCTION public.get_forge_progress(p_slug text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  v_sim_id        uuid;
  v_banner        text;
  v_lore_progress jsonb;
  v_agents        jsonb;
  v_buildings     jsonb;
  v_lore          jsonb;
  v_agent_done    int;
  v_building_done int;
  v_lore_done     int;
  v_lore_count    int;
  v_total         int;
  v_completed     int;
BEGIN
  -- Resolve simulation
  SELECT id, banner_url, lore_progress
  INTO v_sim_id, v_banner, v_lore_progress
  FROM simulations
  WHERE slug = p_slug
  LIMIT 1;

  IF v_sim_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Agent progress (ordered by creation)
  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object('name', a.name, 'image_url', a.portrait_image_url)
      ORDER BY a.created_at
    ), '[]'::jsonb),
    COUNT(*) FILTER (WHERE a.portrait_image_url IS NOT NULL)
  INTO v_agents, v_agent_done
  FROM agents a
  WHERE a.simulation_id = v_sim_id;

  -- Building progress (ordered by creation)
  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object('name', b.name, 'image_url', b.image_url)
      ORDER BY b.created_at
    ), '[]'::jsonb),
    COUNT(*) FILTER (WHERE b.image_url IS NOT NULL)
  INTO v_buildings, v_building_done
  FROM buildings b
  WHERE b.simulation_id = v_sim_id;

  -- Lore image progress (only sections that have an image_slug)
  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'name', l.title,
        'image_url', CASE WHEN l.image_generated_at IS NOT NULL THEN l.image_slug ELSE NULL END
      )
      ORDER BY l.sort_order
    ), '[]'::jsonb),
    COUNT(*),
    COUNT(*) FILTER (WHERE l.image_generated_at IS NOT NULL)
  INTO v_lore, v_lore_count, v_lore_done
  FROM simulation_lore l
  WHERE l.simulation_id = v_sim_id AND l.image_slug IS NOT NULL;

  -- Totals (banner + agents + buildings + lore)
  v_total := 1 + (SELECT count(*) FROM agents WHERE simulation_id = v_sim_id)
               + (SELECT count(*) FROM buildings WHERE simulation_id = v_sim_id)
               + v_lore_count;
  v_completed := (CASE WHEN v_banner IS NOT NULL THEN 1 ELSE 0 END)
               + v_agent_done + v_building_done + v_lore_done;

  RETURN jsonb_build_object(
    'total',         v_total,
    'completed',     v_completed,
    'done',          v_completed >= v_total,
    'banner_url',    v_banner,
    'agents',        v_agents,
    'buildings',     v_buildings,
    'lore',          v_lore,
    'lore_progress', v_lore_progress
  );
END;
$function$;

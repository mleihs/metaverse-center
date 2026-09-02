/**
 * Every query-parameter name the backend actually declares.
 *
 * WHY THIS FILE EXISTS (D10-6)
 * ----------------------------
 * The API services used to take `params?: Record<string, string>`. That type
 * accepts any key at all, so four call sites in the chat components sent
 * `page_size` — a name no FastAPI endpoint has ever declared. FastAPI ignores
 * an unknown query parameter without a word: no 422, no log line, no Sentry
 * event. The picker asked for 100 agents and silently got the default 25; the
 * chat window asked for 100 messages and got 50.
 *
 * A wrong parameter name is indistinguishable at runtime from one that was
 * never sent. The only place the difference is visible is the type system —
 * so that is where it now lives. `page_size` is a compile error.
 *
 * HOW IT STAYS TRUE
 * -----------------
 * The list below is MEASURED, not maintained by hand: it is the set of
 * argument names annotated with `Query(...)` across `backend/routers/**`.
 * `backend/tests/unit/test_query_params_declared.py` re-derives that set by
 * AST on every run and fails if the two disagree — in either direction. Adding
 * a query parameter to a router therefore means adding it here, and deleting
 * one means deleting it here.
 *
 * Do not edit by hand without running that test.
 */

export type ApiQueryParam =
  | 'activity_type'
  | 'admin_notes'
  | 'agent_id'
  | 'approve'
  | 'arcanum'
  | 'archetype'
  | 'author_id'
  | 'before'
  | 'building_condition'
  | 'building_type'
  | 'campaign_type'
  | 'category'
  | 'city_id'
  | 'content_types'
  | 'cycle'
  | 'date_from'
  | 'date_to'
  | 'days'
  | 'dimension'
  | 'direction'
  | 'enabled'
  | 'entity_detail'
  | 'entity_index'
  | 'entity_name'
  | 'entity_total'
  | 'entry_type'
  | 'event_status'
  | 'event_type'
  | 'feature_type'
  | 'fragment_type'
  | 'gender'
  | 'hard'
  | 'impact_level'
  | 'include_deleted'
  | 'include_inactive'
  | 'include_platform'
  | 'is_mandatory'
  | 'limit'
  | 'locale'
  | 'memory_type'
  | 'min_qualification_level'
  | 'min_significance'
  | 'mode'
  | 'new_status'
  | 'offset'
  | 'order_asc'
  | 'order_by'
  | 'pack_slug'
  | 'page'
  | 'part'
  | 'payment_method'
  | 'per_page'
  | 'policy'
  | 'primary_profession'
  | 'profession'
  | 'prompt_category'
  | 'proposal_status'
  | 'rarity'
  | 'reason'
  | 'relation_type'
  | 'resonance_id'
  | 'resource_path'
  | 'search'
  | 'signature'
  | 'simulation_id'
  | 'since_hours'
  | 'source'
  | 'source_type'
  | 'status'
  | 'system'
  | 'tag'
  | 'target_agent_id'
  | 'target_building_id'
  | 'target_zone_id'
  | 'taxonomy_type'
  | 'team_id'
  | 'template_type'
  | 'tick_number'
  | 'token'
  | 'trigger'
  | 'ward_strength'
  | 'ward_vector'
  | 'zone_id';

/**
 * Query parameters for a GET through the API services.
 *
 * `string` values only — these are serialised straight into the URL. Numbers
 * are passed as strings (`{ limit: '100' }`), which is what `URLSearchParams`
 * would do anyway; spelling it out keeps the shape honest.
 */
export type QueryParams = Partial<Record<ApiQueryParam, string>>;

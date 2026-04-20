/**
 * Per-entry JSON Schemas for the content-pack editor.
 *
 * The hybrid editor (VelgContentDraftEditor) lets admins edit ONE entry of
 * a pack collection at a time (sidebar = entries, right pane = textarea
 * holding `JSON.stringify(entry)`). These schemas describe that single
 * entry shape — not the wrapping pack file.
 *
 * Derived by hand from `backend/services/content_packs/schemas.py` (and
 * for Encounter/Enemy/Loot from `backend/models/resonance_dungeon.py`).
 * The Python models are the source of truth; if those drift, this file
 * needs a matching edit — there is no runtime-type-generation bridge yet.
 *
 * Scope: the 8 archetype-pack resource_paths currently exposed by the
 * admin manifest endpoint (see read_service.list_pack_resources). Ability
 * packs live under content/dungeon/abilities/ and are NOT exposed via the
 * draft workflow yet, so they're absent here — add when the publish
 * pipeline learns to emit ability-school paths.
 */

import type { JSONSchema7 } from 'json-schema';

/** Bilingual pair shape shared by many entry schemas. */
const BILINGUAL: Record<string, JSONSchema7> = {
  text_en: { type: 'string', description: 'English text.' },
  text_de: { type: 'string', description: 'German text.' },
};

/** One between-encounter banter line. Mirrors BanterItem. */
const BANTER_ITEM: JSONSchema7 = {
  type: 'object',
  required: ['id', 'trigger', 'text_en', 'text_de'],
  additionalProperties: false,
  properties: {
    id: { type: 'string', description: 'Unique banter id within the pack.' },
    trigger: {
      type: 'string',
      description: 'Event or condition that fires this line.',
    },
    personality_filter: {
      type: 'object',
      description:
        'Optional Big-Five filter. Values are [min, max] tuples for traits, or booleans for non-trait flags (e.g. opinion_positive_pair).',
      additionalProperties: {
        oneOf: [
          {
            type: 'array',
            items: { type: 'number' },
            minItems: 2,
            maxItems: 2,
          },
          { type: 'boolean' },
          { type: 'null' },
        ],
      },
    },
    text_en: BILINGUAL.text_en,
    text_de: BILINGUAL.text_de,
    decay_tier: { type: ['integer', 'null'], description: 'Entropy tier gate.' },
    attachment_tier: {
      type: ['integer', 'null'],
      description: 'Mother tier gate.',
    },
    insight_tier: {
      type: ['integer', 'null'],
      description: 'Prometheus tier gate.',
    },
    water_tier: { type: ['integer', 'null'], description: 'Deluge tier gate.' },
    awareness_tier: {
      type: ['integer', 'null'],
      description: 'Awakening tier gate.',
    },
    fracture_tier: {
      type: ['integer', 'null'],
      description: 'Overthrow tier gate.',
    },
  },
};

/** One encounter choice. Mirrors EncounterChoice. */
const ENCOUNTER_CHOICE: JSONSchema7 = {
  type: 'object',
  required: ['id', 'label_en', 'label_de'],
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    label_en: { type: 'string' },
    label_de: { type: 'string' },
    requires_aptitude: {
      type: ['object', 'null'],
      description: 'Aptitude gate map, e.g. {courage: 3}.',
      additionalProperties: { type: 'integer' },
    },
    requires_profession: { type: ['string', 'null'] },
    check_aptitude: {
      type: ['string', 'null'],
      description: 'Aptitude rolled on click, e.g. "empathy".',
    },
    check_difficulty: { type: 'integer', default: 0 },
    success_effects: { type: 'object', additionalProperties: true },
    partial_effects: { type: 'object', additionalProperties: true },
    fail_effects: { type: 'object', additionalProperties: true },
    success_narrative_en: { type: 'string', default: '' },
    success_narrative_de: { type: 'string', default: '' },
    partial_narrative_en: { type: 'string', default: '' },
    partial_narrative_de: { type: 'string', default: '' },
    fail_narrative_en: { type: 'string', default: '' },
    fail_narrative_de: { type: 'string', default: '' },
  },
};

/** One encounter template. Mirrors EncounterTemplate. */
const ENCOUNTER_ITEM: JSONSchema7 = {
  type: 'object',
  required: ['id', 'archetype', 'room_type'],
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    archetype: { type: 'string', description: 'e.g. "The Shadow".' },
    room_type: { type: 'string' },
    min_depth: { type: 'integer', default: 0, minimum: 0 },
    max_depth: { type: 'integer', default: 99 },
    min_difficulty: { type: 'integer', default: 1 },
    requires_aptitude: {
      type: ['object', 'null'],
      additionalProperties: { type: 'integer' },
    },
    description_en: { type: 'string', default: '' },
    description_de: { type: 'string', default: '' },
    choices: { type: 'array', items: ENCOUNTER_CHOICE, default: [] },
    combat_encounter_id: {
      type: ['string', 'null'],
      description: 'References a spawn config id.',
    },
    is_ambush: { type: 'boolean', default: false },
    ambush_stress: { type: 'integer', default: 0 },
  },
};

/** One loot drop. Mirrors LootItem. */
const LOOT_ITEM: JSONSchema7 = {
  type: 'object',
  required: ['id', 'name_en', 'name_de', 'tier', 'effect_type'],
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    name_en: { type: 'string' },
    name_de: { type: 'string' },
    tier: {
      type: 'integer',
      description: '1=minor, 2=major, 3=legendary.',
      minimum: 1,
      maximum: 3,
    },
    effect_type: {
      type: 'string',
      description: 'e.g. "stress_heal", "aptitude_boost", "memory", "moodlet".',
    },
    effect_params: { type: 'object', additionalProperties: true },
    description_en: { type: 'string', default: '' },
    description_de: { type: 'string', default: '' },
    drop_weight: { type: 'integer', default: 10, minimum: 0 },
  },
};

/** One enemy template. Mirrors EnemyTemplate. */
const ENEMY_ITEM: JSONSchema7 = {
  type: 'object',
  required: [
    'id',
    'name_en',
    'name_de',
    'archetype',
    'condition_threshold',
    'attack_aptitude',
    'attack_power',
    'stress_attack_power',
  ],
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    name_en: { type: 'string' },
    name_de: { type: 'string' },
    archetype: { type: 'string' },
    condition_threshold: { type: 'integer', minimum: 1 },
    stress_resistance: { type: 'integer', default: 0 },
    threat_level: {
      type: 'string',
      enum: ['standard', 'elite', 'boss'],
      default: 'standard',
    },
    attack_aptitude: { type: 'string' },
    attack_power: { type: 'integer' },
    stress_attack_power: { type: 'integer' },
    telegraphed_intent: { type: 'boolean', default: true },
    evasion: { type: 'integer', default: 0 },
    resistances: { type: 'array', items: { type: 'string' }, default: [] },
    vulnerabilities: { type: 'array', items: { type: 'string' }, default: [] },
    action_weights: {
      type: 'object',
      description: 'Map of action_id -> integer weight for the enemy AI chooser.',
      additionalProperties: { type: 'integer' },
    },
    special_abilities: {
      type: 'array',
      items: { type: 'string' },
      default: [],
    },
    description_en: { type: 'string', default: '' },
    description_de: { type: 'string', default: '' },
    ambient_text_en: { type: 'array', items: { type: 'string' }, default: [] },
    ambient_text_de: { type: 'array', items: { type: 'string' }, default: [] },
  },
};

/** One objektanker phase. Mirrors AnchorPhase. */
const ANCHOR_PHASE: JSONSchema7 = {
  type: 'object',
  required: ['text_en', 'text_de'],
  additionalProperties: false,
  properties: {
    text_en: BILINGUAL.text_en,
    text_de: BILINGUAL.text_de,
    state_effect: { type: 'object', additionalProperties: true },
  },
};

/** One objektanker. Mirrors AnchorObject. */
const ANCHOR_ITEM: JSONSchema7 = {
  type: 'object',
  required: ['id', 'phases'],
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    phases: {
      type: 'object',
      required: ['discovery', 'echo', 'mutation', 'climax'],
      additionalProperties: false,
      properties: {
        discovery: ANCHOR_PHASE,
        echo: ANCHOR_PHASE,
        mutation: ANCHOR_PHASE,
        climax: ANCHOR_PHASE,
      },
    },
  },
};

/** One bilingual text row (entrance_texts). Mirrors BilingualText. */
const BILINGUAL_TEXT_ITEM: JSONSchema7 = {
  type: 'object',
  required: ['text_en', 'text_de'],
  additionalProperties: false,
  properties: { text_en: BILINGUAL.text_en, text_de: BILINGUAL.text_de },
};

/** One barometer row. Mirrors BarometerEntry. */
const BAROMETER_ITEM: JSONSchema7 = {
  type: 'object',
  required: ['tier', 'text_en', 'text_de'],
  additionalProperties: false,
  properties: {
    tier: { type: 'integer', minimum: 0, maximum: 3 },
    text_en: BILINGUAL.text_en,
    text_de: BILINGUAL.text_de,
  },
};

/**
 * Spawns entry shape: each "entry" in the editor's sidebar is the ARRAY
 * of SpawnEntry keyed by combat_encounter_id. So the textarea holds a
 * `[{template_id, count}, ...]` list, not a single SpawnEntry.
 */
const SPAWN_LIST: JSONSchema7 = {
  type: 'array',
  description: 'Enemy spawn list for this combat_encounter_id.',
  items: {
    type: 'object',
    required: ['template_id'],
    additionalProperties: false,
    properties: {
      template_id: {
        type: 'string',
        description: 'References an EnemyTemplate id.',
      },
      count: { type: 'integer', default: 1, minimum: 1 },
    },
  },
};

/**
 * Resource-path → per-entry schema. Keyed by the `resource_path` field
 * stored on the draft row.
 */
export const SCHEMA_BY_RESOURCE_PATH: Record<string, JSONSchema7> = {
  banter: BANTER_ITEM,
  encounters: ENCOUNTER_ITEM,
  loot: LOOT_ITEM,
  enemies: ENEMY_ITEM,
  anchors: ANCHOR_ITEM,
  entrance_texts: BILINGUAL_TEXT_ITEM,
  barometer_texts: BAROMETER_ITEM,
  spawns: SPAWN_LIST,
};

/** Fetch the entry schema for a resource_path, or undefined when unknown. */
export function getSchemaForResource(resourcePath: string): JSONSchema7 | undefined {
  return SCHEMA_BY_RESOURCE_PATH[resourcePath];
}

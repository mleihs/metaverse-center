/**
 * Per-entry JSON Schemas for the content-pack editor.
 *
 * The hybrid editor (VelgContentDraftEditor) lets admins edit ONE entry of
 * a pack collection at a time (sidebar = entries, right pane = textarea
 * holding `JSON.stringify(entry)`). These schemas describe that single
 * entry shape — not the wrapping pack file.
 *
 * Source of truth
 * ---------------
 * Derived by hand from:
 *   - `backend/services/content_packs/schemas.py` (BanterItem, AnchorObject,
 *     SpawnEntry, BarometerEntry — the loader's strict Pydantic models)
 *   - `backend/models/resonance_dungeon.py` (EnemyTemplate, EncounterTemplate,
 *     EncounterChoice, LootItem — the runtime dataclasses)
 *   - `backend/models/resonance.py::ARCHETYPES` (the 8-archetype canonical list)
 *
 * Manual-sync contract
 * --------------------
 * There is no runtime-type-generation bridge from Python → TS yet. If any of
 * the source files above changes, this file needs a matching edit or admins
 * see stale completion + wrong lint in the JSON editor. Use this to surface
 * drift:
 *
 *   git log -p --since='1 month ago' \
 *     backend/services/content_packs/schemas.py \
 *     backend/models/resonance_dungeon.py \
 *     backend/models/resonance.py
 *
 * Scope
 * -----
 * Two pack families are addressable from the manifest endpoint
 * (`read_service.list_pack_resources`):
 *
 *   - Archetype packs: 8 `resource_path`s (banter / encounters / loot /
 *     enemies / anchors / entrance_texts / barometer_texts / spawns).
 *     Lookup via `SCHEMA_BY_RESOURCE_PATH[resourcePath]`.
 *
 *   - Ability packs: `pack_slug = "abilities"` (see `ABILITY_PACK_SLUG`),
 *     `resource_path = <school>` (spy, assassin, guardian, infiltrator,
 *     propagandist, saboteur, universal). All 7 schools share the
 *     `ABILITY_ITEM` schema — dispatched via the `packSlug` argument to
 *     `getSchemaForResource` because the resource_path alone isn't
 *     disambiguating here.
 */

import type { JSONSchema7 } from 'json-schema';

/** 8 resonance-dungeon archetypes. Canonical list in
 *  `backend/models/resonance.py::ARCHETYPES`. */
const ARCHETYPE_ENUM: string[] = [
  'The Shadow',
  'The Tower',
  'The Devouring Mother',
  'The Entropy',
  'The Prometheus',
  'The Deluge',
  'The Awakening',
  'The Overthrow',
];

/** 7 aptitude / ability-school values. Mirrors `content/dungeon/abilities/*.yaml`.
 *  Used as keys in agent.aptitudes, enemy.resistances/vulnerabilities, and
 *  ability.school. `universal` is the "no-school" bucket. */
const APTITUDE_ENUM: string[] = [
  'assassin',
  'guardian',
  'infiltrator',
  'propagandist',
  'saboteur',
  'spy',
  'universal',
];

/** 5 Big-Five personality dimensions. Canonical set in
 *  `backend/models/resonance_dungeon.py::BIG_FIVE_DIMENSIONS`. */
const BIG_FIVE_ENUM: string[] = [
  'openness',
  'conscientiousness',
  'extraversion',
  'agreeableness',
  'neuroticism',
];

/** Bilingual pair shape shared by many entry schemas. */
const BILINGUAL: Record<string, JSONSchema7> = {
  text_en: { type: 'string', description: 'English text.' },
  text_de: { type: 'string', description: 'German text.' },
};

/** One between-encounter banter line. Mirrors BanterItem.
 *
 *  Runtime selection happens in `dungeon_banter.select_banter`: filter by
 *  trigger, exclude already-used IDs, gate by min_depth, then pick the
 *  highest archetype-tier line that is ≤ current tier. Personality filter is
 *  consumed upstream of `select_banter` by callers that match banter to
 *  specific party members — see the loader docstring on BanterItem for the
 *  dispatch rules. */
const BANTER_ITEM: JSONSchema7 = {
  type: 'object',
  required: ['id', 'trigger', 'text_en', 'text_de'],
  additionalProperties: false,
  properties: {
    id: {
      type: 'string',
      description: 'Unique banter id within the pack (e.g. "sb_01").',
    },
    trigger: {
      type: 'string',
      description:
        'Event or condition that fires this line. Common triggers: room_entered, combat_start, combat_won, combat_victory, loot_found, elite_spotted, boss_approach, agent_stressed, agent_downed, agent_afflicted, rest_start, rest_safe, rest_ambush, retreat, party_wipe, dungeon_completed. Archetype-specific: decay_critical / decay_degraded (Entropy), attachment_critical / attachment_dependent (Mother), insight_cold / insight_feverish / insight_breakthrough / insight_inspired (Prometheus), flood_imminent / tidal_surge / tidal_recession / waist_threshold / chest_threshold / ankle_threshold / submerged_room_entered (Deluge), stirring / liminal / lucid / awakened / deja_vu (Awakening), stability_critical / stability_collapse / visibility_zero (Tower), dissolution (Overthrow).',
    },
    personality_filter: {
      type: 'object',
      description:
        'Optional per-agent filter. Keys are either:\n' +
        `  (a) Big-Five trait names — ${BIG_FIVE_ENUM.join(', ')} — with value \`[min, max]\` (0.0-1.0 range, both inclusive), or\n` +
        '  (b) Non-trait matchers — currently only `opinion_positive_pair` / `opinion_negative_pair` — with boolean value.\n' +
        'Values of `null` disable that matcher. Empty object `{}` means no filter. Runtime dispatches on value type in `dungeon_banter.select_banter` (and friends).',
      additionalProperties: {
        oneOf: [
          {
            type: 'array',
            items: { type: 'number' },
            minItems: 2,
            maxItems: 2,
            description:
              '[min, max] range for a Big-Five trait, e.g. [0.6, 1.0] for "highly neurotic".',
          },
          {
            type: 'boolean',
            description:
              'Non-trait flag, e.g. `opinion_positive_pair: true` to gate on party relationships.',
          },
          { type: 'null', description: 'Matcher disabled.' },
        ],
      },
      examples: [
        { neuroticism: [0.6, 1.0] },
        { extraversion: [0.0, 0.3], agreeableness: [0.5, 1.0] },
        { opinion_positive_pair: true },
      ],
    },
    text_en: {
      ...BILINGUAL.text_en,
      description:
        "English line. `{agent}` placeholder is substituted with the acting agent's name at render time.",
    },
    text_de: {
      ...BILINGUAL.text_de,
      description: 'German line. Same `{agent}` substitution as text_en.',
    },
    decay_tier: {
      type: ['integer', 'null'],
      description:
        'Entropy tier gate (0-3). 0=decay<40, 1=40-69, 2=70-84, 3=≥85. Line is eligible when archetype tier ≥ this value; preferred when tier equals max available.',
      minimum: 0,
      maximum: 3,
    },
    attachment_tier: {
      type: ['integer', 'null'],
      description: 'Devouring Mother tier gate (0-2). 0=attachment<45, 1=45-74, 2=≥75.',
      minimum: 0,
      maximum: 2,
    },
    insight_tier: {
      type: ['integer', 'null'],
      description:
        'Prometheus tier gate (0-3). 0=insight<20 (cold), 1=20-44 (warming), 2=45-74 (inspired), 3=≥75 (feverish).',
      minimum: 0,
      maximum: 3,
    },
    water_tier: {
      type: ['integer', 'null'],
      description:
        'Deluge tier gate (0-3). 0=water<25 (dry), 1=25-49 (shallow), 2=50-74 (rising), 3=≥75 (critical).',
      minimum: 0,
      maximum: 3,
    },
    awareness_tier: {
      type: ['integer', 'null'],
      description:
        'Awakening tier gate (0-3). 0=awareness<25 (unconscious), 1=25-49 (stirring), 2=50-69 (liminal), 3=≥70 (lucid/dissolution).',
      minimum: 0,
      maximum: 3,
    },
    fracture_tier: {
      type: ['integer', 'null'],
      description:
        'Overthrow authority-fracture tier gate (0-3). 0=fracture<20 (Court Order), 1=20-59 (Whispers/Schism), 2=60-79 (Revolution), 3=≥80 (New Regime/Collapse).',
      minimum: 0,
      maximum: 3,
    },
  },
};

/** One encounter choice. Mirrors EncounterChoice.
 *
 *  Each choice is a button the player clicks on the encounter screen. If
 *  `check_aptitude` is set the click rolls a skill check with difficulty
 *  `check_difficulty` against the acting agent's aptitude level; the result
 *  tier (success / partial / fail) decides which `*_effects` dict is applied
 *  and which `*_narrative_{en,de}` is shown. */
const ENCOUNTER_CHOICE: JSONSchema7 = {
  type: 'object',
  required: ['id', 'label_en', 'label_de'],
  additionalProperties: false,
  properties: {
    id: { type: 'string', description: 'Unique within the parent encounter.' },
    label_en: { type: 'string', description: 'Button label (English).' },
    label_de: { type: 'string', description: 'Button label (German).' },
    requires_aptitude: {
      type: ['object', 'null'],
      description:
        "Minimum aptitude gate — choice is hidden when ANY party member doesn't meet the bar. Keys are aptitude names, values are integer thresholds. Example: `{spy: 3}` hides the choice unless at least one agent has spy ≥ 3.",
      additionalProperties: {
        type: 'integer',
        minimum: 0,
      },
      examples: [{ spy: 3 }, { courage: 2, empathy: 1 }],
    },
    requires_profession: {
      type: ['string', 'null'],
      description:
        'Profession gate — choice is hidden unless at least one agent has this profession id.',
    },
    check_aptitude: {
      type: ['string', 'null'],
      description:
        'Aptitude rolled on click. When null the choice auto-resolves to success (no roll). Use one of the 7 ability-school aptitudes.',
      enum: [...APTITUDE_ENUM, null] as JSONSchema7['enum'],
    },
    check_difficulty: {
      type: 'integer',
      description:
        'Target difficulty for the aptitude check. 0=trivial, 3=standard, 6=hard, 9=expert.',
      default: 0,
      minimum: 0,
    },
    success_effects: {
      type: 'object',
      description:
        'Applied when the check rolls success. Stress keys (`stress`, `stress_heal`) are applied directly in `dungeon_movement_service._handle_encounter_choice_locked`; archetype-specific keys are dispatched via `get_archetype_strategy(archetype).apply_encounter_effects(instance, effects)` in `backend/services/dungeon/archetype_strategies.py`. Common keys: `stress` (int, delta to all active party — negative heals), `stress_heal` (int, unconditional heal), `loot` (array of LootItem ids to pend for distribution), `visibility` (Tower), `stability` (Tower), `decay` (Entropy), `attachment` (Mother), `insight` (Prometheus, + add_component/remove_components/add_crafted_item/craft_failed), `water_level` (Deluge), `awareness` (Awakening), `fracture` (Overthrow, + faction_standing/betrayal). Unknown keys are silently ignored by the archetype strategy dispatch.',
      additionalProperties: true,
      examples: [
        { stress: -50 },
        { stress: -20, insight: 10 },
        { loot: ['l_minor_gem_01'], stress_heal: 30 },
      ],
    },
    partial_effects: {
      type: 'object',
      description:
        'Applied when the check rolls partial (typically half the success magnitude). Same key schema as success_effects.',
      additionalProperties: true,
    },
    fail_effects: {
      type: 'object',
      description:
        'Applied when the check rolls fail. Usually introduces a penalty (positive stress, state damage). Same key schema as success_effects.',
      additionalProperties: true,
      examples: [{ stress: 50 }, { stress: 80, fracture: 5 }],
    },
    success_narrative_en: {
      type: 'string',
      default: '',
      description: 'English narrative shown on success. `{agent}` substitution applies.',
    },
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
    id: { type: 'string', description: 'Unique encounter id within the pack.' },
    archetype: {
      type: 'string',
      description:
        'One of the 8 canonical archetypes. Must match the archetype the dungeon run was spawned with.',
      enum: ARCHETYPE_ENUM,
    },
    room_type: {
      type: 'string',
      description:
        'Room category. Typical values: combat, skill_check, rest, shrine, merchant, archetype-specific (e.g. "forge" for Prometheus, "flooded" for Deluge).',
    },
    min_depth: {
      type: 'integer',
      description: 'Earliest depth (0-based) where this encounter can spawn.',
      default: 0,
      minimum: 0,
    },
    max_depth: {
      type: 'integer',
      description: 'Latest depth where this encounter can spawn. 99 = no cap.',
      default: 99,
    },
    min_difficulty: {
      type: 'integer',
      description:
        'Difficulty floor (1-3 in current content). Filters at generator time against run difficulty.',
      default: 1,
      minimum: 1,
    },
    requires_aptitude: {
      type: ['object', 'null'],
      description:
        'Minimum aptitude gate for the encounter to spawn at all. Same shape as EncounterChoice.requires_aptitude.',
      additionalProperties: { type: 'integer', minimum: 0 },
    },
    description_en: {
      type: 'string',
      description: 'English prose shown above the choice buttons.',
      default: '',
    },
    description_de: {
      type: 'string',
      description: 'German prose shown above the choice buttons.',
      default: '',
    },
    choices: {
      type: 'array',
      description: 'Player-facing buttons. Order is preserved in UI. 2-4 choices is typical.',
      items: ENCOUNTER_CHOICE,
      default: [],
    },
    combat_encounter_id: {
      type: ['string', 'null'],
      description: 'References a SpawnEntry list id. Set for room_type=combat; null otherwise.',
    },
    is_ambush: {
      type: 'boolean',
      description: 'If true, combat starts with enemies acting first in round 1.',
      default: false,
    },
    ambush_stress: {
      type: 'integer',
      description: 'Stress dealt to each party member on ambush-combat entry (before round 1).',
      default: 0,
      minimum: 0,
    },
  },
};

/** One loot drop. Mirrors LootItem.
 *
 *  `effect_type` is a free string on the Python side (no Literal), so this
 *  schema uses `examples` instead of `enum` — listing an enum here would be
 *  stricter than the backend and reject valid future additions. Known values
 *  in use today are documented in the description. */
const LOOT_ITEM: JSONSchema7 = {
  type: 'object',
  required: ['id', 'name_en', 'name_de', 'tier', 'effect_type'],
  additionalProperties: false,
  properties: {
    id: { type: 'string', description: 'Unique loot id within the pack.' },
    name_en: { type: 'string', description: 'Display name (English).' },
    name_de: { type: 'string', description: 'Display name (German).' },
    tier: {
      type: 'integer',
      description:
        '1=minor (common, auto-apply by default), 2=major (meaningful choice), 3=legendary (rare, lasting). Tier affects drop-weight normalization and loot-distribution UI framing.',
      minimum: 1,
      maximum: 3,
    },
    effect_type: {
      type: 'string',
      description:
        'Effect-applier dispatch key. Auto-apply types (listed in `AUTO_APPLY_EFFECT_TYPES` in `backend/services/dungeon_shared.py`): "stress_heal", "dungeon_buff", "event_modifier", "arc_modifier". Player-assigned types: "aptitude_boost" (params: aptitude, amount), "personality_modifier" (params: trait — one of openness/conscientiousness/extraversion/agreeableness/neuroticism — and delta; fixed-trait items may pre-bake the trait), "memory" / "moodlet" (adds to agent memories), "simulation_modifier". Recipient-suggestion logic and per-type branching live in `dungeon_checkpoint_service._compute_loot_suggestions`; validation in `dungeon_distribution_service.assign_loot` / `confirm_distribution`; final persistence via the `fn_apply_dungeon_loot` Postgres RPC. Adding a new value here requires touching all three plus the auto-apply frozenset (if the new type should skip the distribution UI).',
      examples: ['stress_heal', 'dungeon_buff', 'aptitude_boost', 'personality_modifier', 'memory'],
    },
    effect_params: {
      type: 'object',
      description:
        'Effect-specific parameters. Schema depends on effect_type — see examples. Unknown keys are silently ignored by the applier.',
      additionalProperties: true,
      examples: [
        { amount: 30 },
        { aptitude: 'spy', amount: 1 },
        { trait: 'neuroticism', delta: -0.1 },
        { duration: 3, modifier: 'resilient' },
      ],
    },
    description_en: { type: 'string', default: '' },
    description_de: { type: 'string', default: '' },
    drop_weight: {
      type: 'integer',
      description:
        'Relative weight for the archetype loot pool. Higher = more common. Compared against sibling loot of the same tier.',
      default: 10,
      minimum: 0,
    },
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
    id: { type: 'string', description: 'Referenced by SpawnEntry.template_id.' },
    name_en: { type: 'string' },
    name_de: { type: 'string' },
    archetype: {
      type: 'string',
      description:
        'One of the 8 canonical archetypes. Used to scope enemies to the correct dungeon run.',
      enum: ARCHETYPE_ENUM,
    },
    condition_threshold: {
      type: 'integer',
      description:
        'Hit points equivalent — number of damage steps the enemy absorbs before defeat. Standard enemies 2-3, elites 4-6, bosses 8+.',
      minimum: 1,
    },
    stress_resistance: {
      type: 'integer',
      description: 'Flat reduction to incoming stress-damage steps. 0 = vulnerable, 2 = bossy.',
      default: 0,
      minimum: 0,
    },
    threat_level: {
      type: 'string',
      description:
        'Informational tier. Drives music, UI accent, and whether the enemy counts toward boss-kill achievements.',
      enum: ['standard', 'elite', 'boss'],
      default: 'standard',
    },
    attack_aptitude: {
      type: 'string',
      description:
        "Ability school used by the enemy's default attack. Gates hit-chance calculation — agents resist/vulnerable to this school respond accordingly.",
      enum: APTITUDE_ENUM,
    },
    attack_power: {
      type: 'integer',
      description: 'Base damage steps on a successful attack (pre-modifiers). Typical range 1-6.',
      minimum: 0,
    },
    stress_attack_power: {
      type: 'integer',
      description:
        'Base stress-damage on a successful stress_attack. Typical range 1-8 (bosses can go higher).',
      minimum: 0,
    },
    telegraphed_intent: {
      type: 'boolean',
      description:
        'If true, the UI shows "will attack X" / "bracing for impact" on the enemy card during the planning phase (Into the Breach style).',
      default: true,
    },
    evasion: {
      type: 'integer',
      description:
        'Evasion rating subtracted from incoming hit-chance rolls. 0-50 typical; disrupted enemies lose 15 effective evasion.',
      default: 0,
      minimum: 0,
    },
    resistances: {
      type: 'array',
      description:
        'Ability schools this enemy resists (reduced damage). Each entry must be one of the 7 aptitude values.',
      items: { type: 'string', enum: APTITUDE_ENUM },
      default: [],
    },
    vulnerabilities: {
      type: 'array',
      description:
        'Ability schools this enemy is vulnerable to (amplified damage). Same 7-value enum.',
      items: { type: 'string', enum: APTITUDE_ENUM },
      default: [],
    },
    action_weights: {
      type: 'object',
      description:
        'Map of action_id → integer weight for the enemy AI chooser (weighted random). Common keys: "attack", "stress_attack", "defend", "evade", "grapple". Archetype-specific keys exist (e.g. "summon_wisps" for Shadow). Default when absent: {attack: 50, stress_attack: 30, defend: 20}.',
      additionalProperties: { type: 'integer', minimum: 0 },
      examples: [
        { attack: 60, stress_attack: 30, defend: 10 },
        { attack: 40, stress_attack: 40, grapple: 20 },
      ],
    },
    special_abilities: {
      type: 'array',
      description:
        'Ability ids available to this enemy beyond the default attack. References `content/dungeon/abilities/<school>.yaml` entry ids. Decorative unless the AI chooser is extended to include ability actions.',
      items: { type: 'string' },
      default: [],
    },
    description_en: { type: 'string', default: '' },
    description_de: { type: 'string', default: '' },
    ambient_text_en: {
      type: 'array',
      description:
        'Idle / round-start flavour lines rotated randomly. Keep terse — they stack below the portrait.',
      items: { type: 'string' },
      default: [],
    },
    ambient_text_de: {
      type: 'array',
      description: 'German variant of ambient_text_en.',
      items: { type: 'string' },
      default: [],
    },
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
    state_effect: {
      type: 'object',
      description:
        'Optional archetype-state delta applied when the anchor transitions into this phase. Same key schema as EncounterChoice.success_effects (archetype-specific — stress, decay, insight, etc.). Defaults to {} (no effect).',
      additionalProperties: true,
      examples: [{ decay: 5 }, { insight: 10, stress: -10 }],
    },
  },
};

/** One objektanker. Mirrors AnchorObject. */
const ANCHOR_ITEM: JSONSchema7 = {
  type: 'object',
  required: ['id', 'phases'],
  additionalProperties: false,
  properties: {
    id: { type: 'string', description: 'Unique anchor id within the pack.' },
    phases: {
      type: 'object',
      description:
        'The 4-phase migration arc of an object through the dungeon: discovery (first encounter), echo (resurface), mutation (transformed), climax (final appearance). All four phases are required.',
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
  description:
    'One entrance / atmospheric prose block. Rotated randomly by the dungeon on depth-0 entry.',
  properties: { text_en: BILINGUAL.text_en, text_de: BILINGUAL.text_de },
};

/** One barometer row. Mirrors BarometerEntry. */
const BAROMETER_ITEM: JSONSchema7 = {
  type: 'object',
  required: ['tier', 'text_en', 'text_de'],
  additionalProperties: false,
  description:
    'One tier of the objektanker barometer — prose shown at the run summary depending on the dominant archetype tier reached. Exactly one entry per tier (0-3) per archetype is expected.',
  properties: {
    tier: {
      type: 'integer',
      description: '0=baseline (low archetype pressure), 1=middle, 2=high, 3=peak/climax.',
      minimum: 0,
      maximum: 3,
    },
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
  description:
    'Enemy spawn list for one combat_encounter_id. Each entry references an EnemyTemplate. `count` > 1 places multiple instances of the same template on the field.',
  items: {
    type: 'object',
    required: ['template_id'],
    additionalProperties: false,
    properties: {
      template_id: {
        type: 'string',
        description: 'References an EnemyTemplate id (must exist in the enemies pack).',
      },
      count: {
        type: 'integer',
        description: 'Instance count. Default 1.',
        default: 1,
        minimum: 1,
      },
    },
  },
};

/** One combat ability. Mirrors the Pydantic `AbilityItem`
 *  (`backend/services/content_packs/schemas.py`) AND the runtime `Ability`
 *  dataclass (`backend/services/combat/ability_schools.py`). */
const ABILITY_ITEM: JSONSchema7 = {
  type: 'object',
  required: ['id', 'name_en', 'name_de', 'school', 'description_en', 'description_de'],
  additionalProperties: false,
  properties: {
    id: {
      type: 'string',
      description:
        'Unique ability id within the pack (e.g. "assassin_precision_strike"). Referenced from `EnemyItem.special_abilities` and from combat skill-check code.',
    },
    name_en: { type: 'string', description: 'Display name (English).' },
    name_de: { type: 'string', description: 'Display name (German).' },
    school: {
      type: 'string',
      description:
        'Ability school bucket. Must match the file stem (abilities/spy.yaml entries all carry school: spy, etc.) — `_ingest_ability_pack` puts the ability into `result.abilities[item.school]`. `universal` is the "any-aptitude" bucket.',
      enum: APTITUDE_ENUM,
    },
    description_en: {
      type: 'string',
      description:
        'Tooltip / combat-log prose (English). Surfaces in the ability picker and in narrative effects lines.',
    },
    description_de: {
      type: 'string',
      description: 'German variant of description_en.',
    },
    min_aptitude: {
      type: 'integer',
      description:
        'Minimum aptitude level required to cast. Gates ability availability in the combat picker — agents below this threshold see the ability greyed out.',
      default: 3,
      minimum: 0,
    },
    cooldown: {
      type: 'integer',
      description:
        'Rounds between uses. 0 = every round, 1 = every other round, etc. Tracked per-agent per-run.',
      default: 0,
      minimum: 0,
    },
    effect_type: {
      type: 'string',
      description:
        'Combat dispatch key. Handled in `backend/services/combat/combat_engine.py` — common values: "damage" (deals damage steps, params: power + optional hit_bonus / bonus_vs_debuffed), "stress_damage" (deals stress), "heal_stress" (reduces stress, params: amount), "buff" / "debuff" (adds a named status, params: status + duration), "utility" (side-effects like taunt / evade). Free string on the Python side — adding a new value needs a matching branch in combat_engine.',
      default: 'damage',
      examples: ['damage', 'stress_damage', 'heal_stress', 'buff', 'debuff', 'utility'],
    },
    effect_params: {
      type: 'object',
      description:
        'Effect-type-specific params. Schema depends on `effect_type` — see examples. Unknown keys are silently ignored by combat_engine.',
      additionalProperties: true,
      examples: [
        { power: 5, hit_bonus: 10 },
        { power: 7, bonus_vs_debuffed: 1 },
        { power: 9, requires_first_round_or_dark: true },
        { amount: 30 },
        { status: 'evasive', duration: 2 },
      ],
    },
    is_ultimate: {
      type: 'boolean',
      description:
        'If true, the ability is flagged as an ultimate — typically long cooldown + high impact. Currently informational only (UI badge); combat_engine does not special-case.',
      default: false,
    },
    targets: {
      type: 'string',
      description: 'Target-selection mode. Drives the UI picker and the effect applier.',
      enum: ['single_enemy', 'all_enemies', 'single_ally', 'all_allies', 'self'],
      default: 'single_enemy',
    },
  },
};

/**
 * Resource-path → per-entry schema, for archetype-pack drafts.
 *
 * Keyed by the `resource_path` field stored on the draft row. Ability packs
 * use `pack_slug="abilities"` and a school-name resource_path (spy, assassin,
 * …), so they don't fit this single-key map — `getSchemaForResource` handles
 * them via the pack_slug argument instead.
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

/** Sentinel pack_slug that addresses the flat `content/dungeon/abilities/`
 *  namespace — mirrors `backend.services.content_packs.schemas.ABILITY_PACK_SLUG`.
 *  All 7 schools share this slug; the school name lives in resource_path. */
export const ABILITY_PACK_SLUG = 'abilities';

/** Fetch the entry schema for a draft.
 *
 * Dispatches on `packSlug` first:
 *   - `ABILITY_PACK_SLUG` ("abilities") → returns the shared ABILITY_ITEM
 *     schema regardless of which school (resource_path) the draft addresses.
 *   - any other slug → looks up `resourcePath` in the archetype map.
 *
 * Returns `undefined` for unknown resource paths so the editor falls back
 * to generic JSON editing with no validation. `packSlug` is optional for
 * callers that only have the resource_path (the archetype path is resolvable
 * from resource_path alone).
 */
export function getSchemaForResource(
  resourcePath: string,
  packSlug?: string,
): JSONSchema7 | undefined {
  if (packSlug === ABILITY_PACK_SLUG) return ABILITY_ITEM;
  return SCHEMA_BY_RESOURCE_PATH[resourcePath];
}

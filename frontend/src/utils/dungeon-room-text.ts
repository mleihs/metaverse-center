/**
 * Resonance Dungeons — what prose belongs to the room the party is standing in.
 *
 * This module answers ONE question, for every surface: given the room, the run
 * state and (on entry) the move response, which texts describe this room and in
 * what order? The answer is a plain data structure. Rendering is somebody
 * else's job — the terminal turns it into TerminalLine[], the graphical scene
 * paints it into the frame.
 *
 * It exists because that question used to be answered twice, and only one of
 * the answers was complete. `formatRoomEntry` assembled banter, anchor prose,
 * the barometer line and the room-type ambient for the terminal, while
 * `dungeon-commands` separately decided when to show `encounter_description`.
 * The graphical view, having no terminal buffer, was handed a hand-picked
 * subset — banter and barometer — through the state manager. Everything
 * outside that subset was invisible in graphical mode: 129 encounter templates
 * with bilingual prose, every anchor object, every room-type ambient line.
 * Written content that reaches one of two surfaces is the most expensive kind
 * of bug in this codebase, so the selection lives here and nowhere else.
 *
 * Pure: no DOM, no state-manager import, no API call. Directly unit-testable —
 * see tests/dungeon-room-text.test.ts.
 *
 * Pattern: utils/dungeon-environment.ts (pure resolver shared by both views).
 */

import { msg } from '@lit/localize';

import type {
  AnchorText,
  DungeonClientState,
  MoveToRoomResponse,
  RoomNodeClient,
} from '../types/dungeon.js';
import {
  ARCHETYPE_AWAKENING,
  ARCHETYPE_DELUGE,
  ARCHETYPE_ENTROPY,
  ARCHETYPE_MOTHER,
  ARCHETYPE_OVERTHROW,
  ARCHETYPE_PROMETHEUS,
  ARCHETYPE_SHADOW,
  ARCHETYPE_TOWER,
} from '../types/dungeon.js';
import { localized } from './locale-fields.js';

// ── Archetype Ambient Texts (data-driven, no code-branching) ────────────────
// Each archetype defines its own scout, boss, rest, and treasure flavor text.
// IMPORTANT: msg() must be called at render time, not module scope (i18n gotcha).
// Using functions that return msg() ensures correct locale resolution.

interface AmbientTexts {
  scout: string;
  boss: string;
  rest: string;
  treasure: string;
}

type AmbientFactory = () => AmbientTexts;

const ARCHETYPE_AMBIENT_FACTORIES: Record<string, AmbientFactory> = {
  [ARCHETYPE_SHADOW]: () => ({
    scout: msg('probes the surrounding darkness'),
    boss: msg('The darkness is thicker here. Absolute. Intentional.'),
    rest: msg('A fragile pocket of stillness in the darkness.'),
    treasure: msg('Something glints in the shadow.'),
  }),
  [ARCHETYPE_TOWER]: () => ({
    scout: msg('surveys the structural layout'),
    boss: msg('The structure shudders. The load-bearing walls are screaming.'),
    rest: msg('A reinforced alcove. The ceiling holds, for now.'),
    treasure: msg('Assets, abandoned in the collapse.'),
  }),
  [ARCHETYPE_ENTROPY]: () => ({
    scout: msg('examines the dissolving patterns'),
    boss: msg('The dissolution accelerates. What remains is not enough.'),
    rest: msg('A pocket of coherence in the decay.'),
    treasure: msg('Something crystallized before it could dissolve.'),
  }),
  [ARCHETYPE_MOTHER]: () => ({
    scout: msg('searches through the suffocating warmth'),
    boss: msg('The embrace tightens. There is no leaving without a wound.'),
    rest: msg('A room that feels like childhood. Almost too safe.'),
    treasure: msg('A gift, left where you would find it. Deliberate.'),
  }),
  [ARCHETYPE_PROMETHEUS]: () => ({
    scout: msg('traces the pathways of stolen knowledge'),
    boss: msg('The light here burns. Knowledge has a cost.'),
    rest: msg('A cooling chamber. The forge rests, briefly.'),
    treasure: msg('An insight, crystallized into form.'),
  }),
  [ARCHETYPE_DELUGE]: () => ({
    scout: msg('reads the current ahead'),
    boss: msg('The water rises. The final chamber is submerged.'),
    rest: msg('An air pocket. The flood pauses, not retreats.'),
    treasure: msg('Salvage, caught in the debris field.'),
  }),
  [ARCHETYPE_AWAKENING]: () => ({
    scout: msg('extends awareness through the layers'),
    boss: msg('Every layer of consciousness converges. The dreamer stirs.'),
    rest: msg('A lucid interval. The boundaries hold, temporarily.'),
    treasure: msg('A fragment of clarity, solid enough to hold.'),
  }),
  [ARCHETYPE_OVERTHROW]: () => ({
    scout: msg('surveys the transparent corridors'),
    boss: msg('The mirrors intensify. Every reflection is a verdict.'),
    rest: msg('A room where the cameras have been covered.'),
    treasure: msg('Files left exposed. Someone wanted these found.'),
  }),
};

/** Get ambient text for an archetype, falling back to Shadow defaults.
 *  msg() is called at invocation time (not module scope) for correct i18n. */
export function getAmbient(archetype: string): AmbientTexts {
  const factory =
    ARCHETYPE_AMBIENT_FACTORIES[archetype] ?? ARCHETYPE_AMBIENT_FACTORIES[ARCHETYPE_SHADOW];
  return factory();
}

// ── Room Type Labels ────────────────────────────────────────────────────────
// msg() at call time, not module scope (i18n gotcha).

function roomTypeLabel(roomType: string): string {
  switch (roomType) {
    case 'combat':
      return msg('COMBAT ENCOUNTER');
    case 'elite':
      return msg('ELITE ENCOUNTER');
    case 'encounter':
      return msg('ENCOUNTER');
    case 'rest':
      return msg('REST SITE');
    case 'treasure':
      return msg('TREASURE');
    case 'boss':
      return msg('BOSS CHAMBER');
    case 'exit':
      return msg('EXIT');
    case 'threshold':
      return msg('THRESHOLD');
    case 'entrance':
      return msg('ENTRANCE');
    default:
      return roomType.toUpperCase();
  }
}

/** Operating hint for a room type. The terminal prints it; the graphical HUD
 *  offers the same actions as buttons and does not need the typed command. */
function roomTypeHint(roomType: string): string | null {
  switch (roomType) {
    case 'rest':
      return msg('Use "rest" to recover stress. Risk of ambush.');
    case 'exit':
      return msg('Use "retreat" to leave with partial loot.');
    case 'entrance':
      return msg('Type "map" to view the dungeon layout, "move <number>" to advance.');
    default:
      return null;
  }
}

/** Ambient prose bound to the room type. Only three room types carry one. */
function roomTypeAmbient(roomType: string, archetype: string): string | null {
  if (roomType !== 'rest' && roomType !== 'treasure' && roomType !== 'boss') return null;
  return getAmbient(archetype)[roomType];
}

// ── Room Description ────────────────────────────────────────────────────────

/**
 * The prose belonging to one room, in reading order.
 *
 * Every field is either present text or null/empty — no placeholders, no
 * "unknown" strings. A surface renders what is there and skips what is not.
 */
export interface RoomDescription {
  depth: number;
  roomIndex: number;
  roomType: string;
  /** Localized room-type label, e.g. "BOSS CHAMBER". */
  typeLabel: string;
  /** An agent reacting to the room. Only on entry — a re-describe has none. */
  banter: string | null;
  /** Anchor-object prose: the objects that belong to this room. */
  anchors: string[];
  /** Archetype-state prose (the sentence under the meter). */
  barometer: string | null;
  /** Ambient prose bound to the room type (rest / treasure / boss). */
  ambient: string | null;
  /** The situation the party faces, when the room presents choices. */
  encounter: string | null;
  /** True when `encounter` is a Threshold toll — both surfaces render it sparser. */
  isThreshold: boolean;
  /** Operating hint; terminal-only, null for most room types. */
  hint: string | null;
}

/** Localized text of an anchor object, dropping empty entries. */
function anchorProse(anchorTexts: AnchorText[] | null | undefined): string[] {
  if (!anchorTexts) return [];
  return anchorTexts
    .map((anchor) => localized(anchor, 'text'))
    .filter((text): text is string => !!text);
}

/**
 * Keep what only arrival could know.
 *
 * `describeRoom` without a move response cannot produce banter, anchor prose or
 * the barometer line — they exist only in the moment the party walks in, and
 * inventing them would be worse than omitting them. But `look` calls exactly
 * that impoverished form and used to PUBLISH it, overwriting the good
 * description with one where the agent had said nothing and the objects in the
 * room had vanished. From the player's side: the room described itself on
 * entry, and then, the moment they resolved its encounter or asked to look
 * again, most of that description disappeared.
 *
 * So a re-describe of the SAME room merges rather than replaces: the fields
 * only arrival can fill are carried over, everything else is taken fresh. On a
 * room change nothing is carried — the previous room's objects have no business
 * in this one.
 *
 * `encounter` is deliberately NOT carried. It is recoverable from run state,
 * and after the party resolves the situation the fresh null is the truth: the
 * prose stays, the choices go.
 */
export function mergeRoomDescription(
  prev: RoomDescription | null,
  next: RoomDescription,
): RoomDescription {
  if (!prev || prev.roomIndex !== next.roomIndex || prev.depth !== next.depth) return next;
  return {
    ...next,
    banter: next.banter ?? prev.banter,
    anchors: next.anchors.length > 0 ? next.anchors : prev.anchors,
    barometer: next.barometer ?? prev.barometer,
  };
}

/**
 * Describe the room the party is standing in.
 *
 * `move` is the response that carried the party here: it holds the texts that
 * exist only at that moment (banter, anchor prose, barometer, the encounter
 * description). Omit it to re-describe the current room from run state alone —
 * that is the terminal's `look` command, and the graphical view's re-render
 * after a reload. Everything that CAN be recovered from state then is; banter
 * cannot, and is correctly absent rather than invented.
 */
export function describeRoom(
  room: RoomNodeClient,
  state: DungeonClientState,
  move?: MoveToRoomResponse | null,
): RoomDescription {
  // On entry the encounter prose rides on the move response; on a re-describe
  // it is recovered from the checkpointed state.
  const showsChoices = move
    ? !!move.choices?.length
    : !!state.encounter_choices?.length &&
      (state.phase === 'threshold' || state.phase === 'encounter' || state.phase === 'rest');

  // Choices and prose are NOT the same question. The choices vanish the moment
  // the party picks one; the situation stands until it is resolved — including
  // through the fight that choice started. Combat is therefore a re-describe
  // case of its own: no choices to offer, but very much a situation to state.
  //
  // Only on a re-describe. A move INTO a combat room already carries its own
  // arrival prose (banter, anchors) on the response, and entry behaviour is
  // deliberately left untouched.
  const inCombat = state.phase === 'combat_planning' || state.phase === 'combat_resolving';
  const situationStands = showsChoices || (!move && inCombat);

  let encounter: string | null = null;
  if (situationStands) {
    encounter = move
      ? localized(move, 'description') || null
      : localized(state, 'encounter_description') || null;
  }

  // The specific beats the general. A rest site in The Entropy carries the
  // room-type ambient "A pocket of coherence in the decay."; its encounter
  // template opens with "A pocket of slower decay." Printed together they read
  // as a stutter — the same observation twice, in slightly different words,
  // and the player learns to skip both. The encounter line is written for THIS
  // situation, so it wins; the ambient returns once the situation is resolved.
  const ambient = encounter ? null : roomTypeAmbient(room.room_type, state.archetype);

  return {
    depth: room.depth,
    roomIndex: room.index,
    roomType: room.room_type,
    typeLabel: roomTypeLabel(room.room_type),
    banter: move?.banter ? localized(move.banter, 'text') || null : null,
    anchors: anchorProse(move?.anchor_texts),
    barometer: move?.barometer_text ? localized(move.barometer_text, 'text') || null : null,
    ambient,
    encounter,
    isThreshold: move ? !!move.threshold : state.phase === 'threshold',
    hint: roomTypeHint(room.room_type),
  };
}

/**
 * Bureau Terminal — Type definitions for the MUD command interface.
 * Part IV of game-systems-integration.md
 */

import type { TemplateResult } from 'lit';
import type { EpochParticipant, EpochStatus } from './index.js';

// ── Terminal Output ────────────────────────────────────────────────────────

/** Channel prefixes for realtime feed entries (EVE Online pattern). */
export type TerminalChannel = 'INTEL' | 'WEATHER' | 'ALERT' | 'DISTANT' | 'COMMS' | 'SYSTEM';

/** Classification of a terminal output line — drives styling and ARIA roles. */
export type TerminalLineType =
  | 'command' // echoed player input
  | 'response' // command output (formatted prose)
  | 'system' // [SYSTEM] clearance upgrades, boot sequence
  | 'art' // ASCII art banner (tight line-height, pre-wrap)
  | 'error' // unknown command, insufficient points
  | 'feed' // realtime heartbeat feed entry
  | 'hint' // onboarding guidance
  | 'combat-player' // party attack/ability hits (bright amber)
  | 'combat-miss' // missed attacks, failed checks (dim olive, italic)
  | 'combat-damage' // damage received by party (danger red)
  | 'combat-heal' // stress heals, condition recovery (success green)
  | 'combat-system'; // round headers, victory, stalemate (bold amber)

/**
 * Structured payload riding along a formatted line.
 *
 * A formatter that computed numbers to print them can attach the numbers
 * themselves here. The terminal renders `content` and ignores this field; a
 * richer surface renders a widget from the values and drops the text lines the
 * widget replaces. Both read the SAME numbers – neither parses the other's
 * prose, which is what made the two dungeon surfaces drift apart before.
 *
 * Deliberately domain-neutral: `types/terminal.ts` knows nothing about
 * dungeons, and the one assignment site is type-checked against
 * `SkillCheckDetail`, so the shapes cannot silently diverge.
 */
export type TerminalLineMeta =
  | {
      readonly kind: 'skill-check';
      readonly aptitude: string;
      readonly level: number;
      /** Pre-roll success probability in percent, as the server computed it. */
      readonly chance: number;
      /** The raw d100 before modifiers. */
      readonly roll: number;
      /** Sum of all modifiers; may be negative. */
      readonly adjustment: number;
      /** roll + adjustment, clamped to 1..100 – the number that decided it. */
      readonly effectiveRoll: number;
      readonly result: 'success' | 'partial' | 'fail';
    }
  /** A text line the preceding widget already says. Rich surfaces drop it. */
  | { readonly kind: 'skill-check-part' };

/** A single line (or block) of terminal output. */
export interface TerminalLine {
  /** Unique key for lit repeat(). */
  readonly id: string;
  readonly type: TerminalLineType;
  readonly channel?: TerminalChannel;
  /** Pre-formatted text content. May contain multiple visual lines. */
  readonly content: string;
  readonly timestamp: Date;
  /** Zone context for locality filtering (feed entries). */
  readonly zoneId?: string;
  /** Optional structured twin of `content`. See TerminalLineMeta. */
  readonly meta?: TerminalLineMeta;
}

// ── Command System ─────────────────────────────────────────────────────────

/** Clearance tier — determines which commands are available. */
export type ClearanceTier = 1 | 2 | 3 | 4 | 5;

/** Entity types the parser can resolve targets to. */
export type TargetType = 'agent' | 'building' | 'zone' | 'event' | 'player' | 'freetext';

/** Result of fuzzy entity resolution. */
export interface ResolvedEntity {
  readonly type: TargetType;
  readonly id: string;
  readonly name: string;
  readonly data?: unknown;
}

/** Context passed to every command handler. */
export interface CommandContext {
  readonly simulationId: string;
  readonly currentZoneId: string;
  readonly rawInput: string;
  readonly verb: string;
  readonly args: string[];
  readonly target?: ResolvedEntity;
  /** Epoch context — present when terminal is in OPERATIONAL MODE (game_instance). */
  readonly epochId?: string;
  readonly epochParticipant?: EpochParticipant;
  readonly epochStatus?: EpochStatus;
}

/** A registered terminal command definition. */
export interface TerminalCommand {
  readonly verb: string;
  readonly synonyms: readonly string[];
  readonly tier: ClearanceTier;
  readonly syntax: string;
  /** Lazy-evaluated to avoid module-level msg() i18n gotcha. */
  readonly description: string | (() => string);
  readonly requiresTarget: boolean;
  readonly targetType?: TargetType;
  readonly handler: (ctx: CommandContext) => Promise<TerminalLine[]>;
}

// ── Quick Actions ──────────────────────────────────────────────────────────

/** A context-sensitive button below the terminal input. */
export interface QuickAction {
  readonly label: string;
  readonly command: string;
  readonly icon?: () => TemplateResult;
  readonly visible: (clearanceLevel: number, inConversation: boolean) => boolean;
}

// ── Persisted State ────────────────────────────────────────────────────────

/** Shape of the localStorage-persisted terminal state per simulation. */
export interface TerminalPersistedState {
  currentZoneId: string | null;
  clearanceLevel: number;
  commandCount: number;
  onboarded: boolean;
  onboardingStep: number;
  commandHistory: string[];
  operationsPoints: number;
  intelPoints: number;
  /**
   * Der Herzschlag-Tick, zu dem die Punkte zuletzt aufgefuellt wurden.
   *
   * Ohne diesen Wert war die Auffuellung nicht ausdrueckbar: `refreshBudgets()`
   * existierte, hatte aber NULL Aufrufer, und nichts wusste, ob ein neuer Tick
   * seit dem letzten Besuch vergangen war. Die Punktewirtschaft des Terminals
   * lief damit in eine Richtung — ausgeben ja, nachfuellen nie.
   *
   * `null` heisst „noch nie aufgefuellt": beim ersten Abgleich wird der
   * aktuelle Tick uebernommen, OHNE aufzufuellen, damit ein Bestandsspieler
   * nicht durch das blosse Erscheinen dieses Feldes ein Geschenk bekommt.
   */
  budgetTick: number | null;
  feedFilter: 'all' | 'intel' | 'alert' | 'weather' | 'off';
  /** Map of agentId -> conversationId for reusing terminal conversations. */
  conversationMap: Record<string, string>;
  /** Last N output lines persisted for session continuity across re-mounts. */
  recentOutput?: Array<{ type: string; content: string }>;
}

// ── Feed Filter ────────────────────────────────────────────────────────────

export type FeedFilter = 'all' | 'intel' | 'alert' | 'weather' | 'off';

// ── Conversation Mode ──────────────────────────────────────────────────────

export interface ConversationMode {
  readonly agentId: string;
  readonly agentName: string;
  readonly conversationId: string;
}

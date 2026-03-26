/**
 * Bureau Terminal — Type definitions for the MUD command interface.
 * Part IV of game-systems-integration.md
 */

import type { TemplateResult } from 'lit';

// ── Terminal Output ────────────────────────────────────────────────────────

/** Channel prefixes for realtime feed entries (EVE Online pattern). */
export type TerminalChannel =
  | 'INTEL'
  | 'WEATHER'
  | 'ALERT'
  | 'DISTANT'
  | 'COMMS'
  | 'SYSTEM';

/** Classification of a terminal output line — drives styling and ARIA roles. */
export type TerminalLineType =
  | 'command'   // echoed player input
  | 'response'  // command output (formatted prose)
  | 'system'    // [SYSTEM] clearance upgrades, boot sequence
  | 'error'     // unknown command, insufficient points
  | 'feed'      // realtime heartbeat feed entry
  | 'hint';     // onboarding guidance

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
}

// ── Command System ─────────────────────────────────────────────────────────

/** Clearance tier — determines which commands are available. */
export type ClearanceTier = 1 | 2 | 3 | 4 | 5;

/** Entity types the parser can resolve targets to. */
export type TargetType = 'agent' | 'building' | 'zone' | 'event' | 'freetext';

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
}

/** A registered terminal command definition. */
export interface TerminalCommand {
  readonly verb: string;
  readonly synonyms: readonly string[];
  readonly tier: ClearanceTier;
  readonly syntax: string;
  readonly description: string;
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
  feedFilter: 'all' | 'intel' | 'alert' | 'weather' | 'off';
  /** Map of agentId -> conversationId for reusing terminal conversations. */
  conversationMap: Record<string, string>;
}

// ── Feed Filter ────────────────────────────────────────────────────────────

export type FeedFilter = 'all' | 'intel' | 'alert' | 'weather' | 'off';

// ── Conversation Mode ──────────────────────────────────────────────────────

export interface ConversationMode {
  readonly agentId: string;
  readonly agentName: string;
  readonly conversationId: string;
}

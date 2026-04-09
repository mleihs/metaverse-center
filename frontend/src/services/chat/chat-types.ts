/**
 * Chat Display Types — shared interfaces for unified chat components.
 *
 * These types bridge the gap between Agent Chat (AgentBrief) and Epoch Chat
 * (player names) by providing a common display abstraction that both can map to.
 */

import type { ChatEventReference, ChatMessage } from '../../types/index.js';

// ---------------------------------------------------------------------------
// Participant — unified sender identity for display
// ---------------------------------------------------------------------------

/** A chat participant: agent, player, or system. Used for O(1) sender lookup. */
export interface Participant {
  readonly id: string;
  readonly name: string;
  readonly avatarUrl?: string;
  /** Accent color for message borders and name labels (CSS value). */
  readonly accentColor?: string;
  /** Agent mood score (-100..+100). Drives the mood ring on avatar. */
  readonly moodScore?: number;
  /** Dominant emotion label (e.g. "hope", "anxiety"). */
  readonly moodEmotion?: string;
  readonly role: 'agent' | 'player' | 'system';
}

// ---------------------------------------------------------------------------
// Timeline — merged message + event stream
// ---------------------------------------------------------------------------

/** Discriminated union for timeline items: messages, events, date separators. */
export type TimelineItem = TimelineMessage | TimelineEvent | TimelineDateSeparator;

export interface TimelineMessage {
  readonly kind: 'message';
  readonly message: ChatMessage;
  /** Same sender as previous item (for visual grouping). */
  readonly grouped: boolean;
  /** Last message in a consecutive group from the same sender. */
  readonly lastInGroup: boolean;
}

export interface TimelineEvent {
  readonly kind: 'event';
  readonly event: ChatEventReference;
}

export interface TimelineDateSeparator {
  readonly kind: 'date';
  readonly date: string;
  readonly label: string;
}

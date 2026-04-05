/**
 * RealtimeService — singleton managing Supabase Realtime channels.
 *
 * Provides Preact Signals for reactive UI:
 * - onlineUsers: who's currently online in the epoch
 * - epochMessages / teamMessages: live chat feeds
 * - readyStates: cycle_ready per simulation_id
 * - unreadEpochCount / unreadTeamCount: unread badge counters
 * - chatTypingUsers: who's currently typing in an agent chat conversation
 *
 * Channel naming:
 * - epoch:{id}:chat       — Broadcast (epoch-wide messages)
 * - epoch:{id}:presence   — Presence (online users)
 * - epoch:{id}:status     — Broadcast (ready signals, cycle events)
 * - epoch:{id}:team:{tid}:chat — Broadcast (team messages)
 * - chat:{id}:typing      — Broadcast (typing indicators for agent chat)
 * - chat:{id}:messages    — Broadcast (new messages from DB trigger 179)
 */

import { signal } from '@preact/signals-core';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { chatStore, type TypingUser } from '../chat/ChatSessionStore.js';
import type { ChatMessage, EpochChatMessage, PresenceUser } from '../../types/index.js';
import { agentTypingPhrase } from '../../utils/agent-colors.js';
import { supabase } from '../supabase/client.js';

class RealtimeServiceImpl {
  // ── Signals ──────────────────────────────────────────
  readonly onlineUsers = signal<PresenceUser[]>([]);
  readonly epochMessages = signal<EpochChatMessage[]>([]);
  readonly teamMessages = signal<EpochChatMessage[]>([]);
  readonly readyStates = signal<Record<string, boolean>>({});
  readonly unreadEpochCount = signal(0);
  readonly unreadTeamCount = signal(0);
  readonly cycleResolved = signal<{ cycle_number: number; epoch_id: string } | null>(null);

  // ── Agent Chat Signals ───────────────────────────────
  readonly chatTypingUsers = signal<TypingUser[]>([]);

  // ── Internal state ───────────────────────────────────
  private _chatChannel: RealtimeChannel | null = null;
  private _presenceChannel: RealtimeChannel | null = null;
  private _statusChannel: RealtimeChannel | null = null;
  private _teamChannel: RealtimeChannel | null = null;
  private _currentEpochId: string | null = null;
  private _currentTeamId: string | null = null;
  private _epochChatFocused = true;
  private _teamChatFocused = false;

  // Agent chat channels
  private _convTypingChannel: RealtimeChannel | null = null;
  private _convMessageChannel: RealtimeChannel | null = null;
  private _convReactionChannel: RealtimeChannel | null = null;
  private _currentConversationId: string | null = null;
  private _typingTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private _lastTypingBroadcast = 0;
  private _onReactionChanged: ((messageId: string) => void) | null = null;

  // ── Join Epoch ───────────────────────────────────────

  joinEpoch(epochId: string, userId: string, simulationId: string, simulationName: string) {
    // Prevent duplicate joins
    if (this._currentEpochId === epochId) return;

    // Clean up previous epoch if any
    if (this._currentEpochId) {
      this.leaveEpoch(this._currentEpochId);
    }

    this._currentEpochId = epochId;

    // 1. Chat channel (Broadcast)
    this._chatChannel = supabase
      .channel(`epoch:${epochId}:chat`, { config: { private: true } })
      .on('broadcast', { event: 'new_message' }, (payload) => {
        const msg = payload.payload as EpochChatMessage;
        if (this.epochMessages.value.some((m) => m.id === msg.id)) return;
        this.epochMessages.value = [...this.epochMessages.value, msg];
        if (!this._epochChatFocused) {
          this.unreadEpochCount.value += 1;
        }
      })
      .subscribe();

    // 2. Presence channel
    this._presenceChannel = supabase
      .channel(`epoch:${epochId}:presence`, { config: { private: true } })
      .on('presence', { event: 'sync' }, () => {
        const state = this._presenceChannel?.presenceState() ?? {};
        const users: PresenceUser[] = [];
        for (const presences of Object.values(state)) {
          for (const p of presences as unknown as PresenceUser[]) {
            users.push(p);
          }
        }
        this.onlineUsers.value = users;
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await this._presenceChannel?.track({
            user_id: userId,
            simulation_id: simulationId,
            simulation_name: simulationName,
            online_at: new Date().toISOString(),
          });
        }
      });

    // 3. Status channel (ready signals + cycle resolution)
    this._statusChannel = supabase
      .channel(`epoch:${epochId}:status`, { config: { private: true } })
      .on('broadcast', { event: 'ready_changed' }, (payload) => {
        const { simulation_id, cycle_ready } = payload.payload as {
          simulation_id: string;
          cycle_ready: boolean;
        };
        this.readyStates.value = {
          ...this.readyStates.value,
          [simulation_id]: cycle_ready,
        };
      })
      .on('broadcast', { event: 'cycle_resolved' }, (payload) => {
        const { epoch_id, cycle_number } = payload.payload as {
          epoch_id: string;
          cycle_number: number;
        };
        this.cycleResolved.value = { epoch_id, cycle_number };
      })
      .subscribe();
  }

  // ── Join Team Channel ────────────────────────────────

  joinTeam(epochId: string, teamId: string) {
    if (this._currentTeamId === teamId) return;

    // Clean up previous team channel
    if (this._teamChannel) {
      supabase.removeChannel(this._teamChannel);
      this._teamChannel = null;
    }

    this._currentTeamId = teamId;
    this.teamMessages.value = [];
    this.unreadTeamCount.value = 0;

    this._teamChannel = supabase
      .channel(`epoch:${epochId}:team:${teamId}:chat`, { config: { private: true } })
      .on('broadcast', { event: 'new_message' }, (payload) => {
        const msg = payload.payload as EpochChatMessage;
        if (this.teamMessages.value.some((m) => m.id === msg.id)) return;
        this.teamMessages.value = [...this.teamMessages.value, msg];
        if (!this._teamChatFocused) {
          this.unreadTeamCount.value += 1;
        }
      })
      .subscribe();
  }

  // ── Leave Team Channel ───────────────────────────────

  leaveTeam(_epochId: string, _teamId: string) {
    if (this._teamChannel) {
      supabase.removeChannel(this._teamChannel);
      this._teamChannel = null;
    }
    this._currentTeamId = null;
    this.teamMessages.value = [];
    this.unreadTeamCount.value = 0;
  }

  // ── Leave Epoch ──────────────────────────────────────

  leaveEpoch(_epochId: string) {
    if (this._chatChannel) {
      supabase.removeChannel(this._chatChannel);
      this._chatChannel = null;
    }
    if (this._presenceChannel) {
      supabase.removeChannel(this._presenceChannel);
      this._presenceChannel = null;
    }
    if (this._statusChannel) {
      supabase.removeChannel(this._statusChannel);
      this._statusChannel = null;
    }
    if (this._teamChannel) {
      supabase.removeChannel(this._teamChannel);
      this._teamChannel = null;
    }

    this._currentEpochId = null;
    this._currentTeamId = null;

    // Reset signals
    this.onlineUsers.value = [];
    this.epochMessages.value = [];
    this.teamMessages.value = [];
    this.readyStates.value = {};
    this.unreadEpochCount.value = 0;
    this.unreadTeamCount.value = 0;
    this.cycleResolved.value = null;
  }

  // ── Unread Management ────────────────────────────────

  resetUnreadCount(channelType: 'epoch' | 'team') {
    if (channelType === 'epoch') {
      this.unreadEpochCount.value = 0;
      this._epochChatFocused = true;
      this._teamChatFocused = false;
    } else {
      this.unreadTeamCount.value = 0;
      this._teamChatFocused = true;
      this._epochChatFocused = false;
    }
  }

  // ── Broadcast Cycle Resolution ──────────────────────

  broadcastCycleResolved(epochId: string, cycleNumber: number) {
    // Set locally first so the UI updates immediately
    this.cycleResolved.value = { epoch_id: epochId, cycle_number: cycleNumber };
    // Also broadcast to other connected clients
    this._statusChannel?.send({
      type: 'broadcast',
      event: 'cycle_resolved',
      payload: { epoch_id: epochId, cycle_number: cycleNumber },
    });
  }

  // ── Initialize Ready States ──────────────────────────

  initReadyStates(participants: Array<{ simulation_id: string; cycle_ready?: boolean }>) {
    const states: Record<string, boolean> = {};
    for (const p of participants) {
      states[p.simulation_id] = p.cycle_ready ?? false;
    }
    this.readyStates.value = states;
  }

  // ── Agent Chat: Join/Leave Conversation ──────────────

  joinConversation(
    conversationId: string,
    lastMessageTimestamp?: number,
    onReactionChanged?: (messageId: string) => void,
  ): void {
    if (this._currentConversationId === conversationId) return;

    // Clean up previous conversation channels
    if (this._currentConversationId) {
      this.leaveConversation();
    }

    this._currentConversationId = conversationId;
    this._onReactionChanged = onReactionChanged ?? null;
    this.chatTypingUsers.value = [];
    this._lastTypingBroadcast = 0; // Reset debounce so first typing fires immediately

    // Typing channel — transient broadcast, no DB persistence
    this._convTypingChannel = supabase
      .channel(`chat:${conversationId}:typing`, { config: { private: true } })
      .on('broadcast', { event: 'typing' }, (payload) => {
        const { user_id, name } = payload.payload as { user_id: string; name: string };

        // Update or add typing user with personality-based phrase
        const existing = this.chatTypingUsers.value;
        const filtered = existing.filter((u) => u.id !== user_id);
        this.chatTypingUsers.value = [
          ...filtered,
          { id: user_id, name, phrase: agentTypingPhrase(user_id) },
        ];

        // Auto-clear after 3 seconds of inactivity
        const prev = this._typingTimers.get(user_id);
        if (prev) clearTimeout(prev);
        this._typingTimers.set(
          user_id,
          setTimeout(() => {
            this.chatTypingUsers.value = this.chatTypingUsers.value.filter((u) => u.id !== user_id);
            this._typingTimers.delete(user_id);
          }, 3000),
        );
      })
      .on('broadcast', { event: 'stop_typing' }, (payload) => {
        const { user_id } = payload.payload as { user_id: string };
        const prev = this._typingTimers.get(user_id);
        if (prev) clearTimeout(prev);
        this._typingTimers.delete(user_id);
        this.chatTypingUsers.value = this.chatTypingUsers.value.filter((u) => u.id !== user_id);
      })
      .subscribe();

    // Message channel — receives broadcasts from DB trigger 179.
    // Replay catches messages inserted between REST load and channel subscribe.
    const replaySince = lastMessageTimestamp ?? Date.now();
    this._convMessageChannel = supabase
      .channel(`chat:${conversationId}:messages`, {
        config: {
          private: true,
          broadcast: { replay: { since: replaySince, limit: 50 } },
        },
      })
      .on('broadcast', { event: 'new_message' }, (payload) => {
        const msg = payload.payload as ChatMessage;
        // addMessage deduplicates by ID — safe against REST/SSE overlap
        chatStore.addMessage(conversationId, msg);
      })
      .subscribe();

    // Reaction channel — receives broadcasts from DB trigger 180.
    // Payload contains { message_id, conversation_id } — caller fetches full summaries.
    this._convReactionChannel = supabase
      .channel(`chat:${conversationId}:reactions`, { config: { private: true } })
      .on('broadcast', { event: 'reaction_changed' }, (payload) => {
        const { message_id } = payload.payload as { message_id: string; conversation_id: string };
        this._onReactionChanged?.(message_id);
      })
      .subscribe();
  }

  leaveConversation(): void {
    if (this._convTypingChannel) {
      supabase.removeChannel(this._convTypingChannel);
      this._convTypingChannel = null;
    }
    if (this._convMessageChannel) {
      supabase.removeChannel(this._convMessageChannel);
      this._convMessageChannel = null;
    }
    if (this._convReactionChannel) {
      supabase.removeChannel(this._convReactionChannel);
      this._convReactionChannel = null;
    }

    // Clear all typing timers
    for (const timer of this._typingTimers.values()) {
      clearTimeout(timer);
    }
    this._typingTimers.clear();

    this._currentConversationId = null;
    this._onReactionChanged = null;
    this.chatTypingUsers.value = [];
  }

  /**
   * Broadcast a typing indicator to other clients in the conversation.
   * Debounced: max 1 broadcast per 2 seconds.
   */
  broadcastTyping(_conversationId: string, userId: string, userName: string): void {
    const now = Date.now();
    if (now - this._lastTypingBroadcast < 2000) return;
    this._lastTypingBroadcast = now;

    this._convTypingChannel?.send({
      type: 'broadcast',
      event: 'typing',
      payload: { user_id: userId, name: userName, at: now },
    });
  }

  /**
   * Broadcast a "stopped typing" signal. Called when a message is sent
   * to immediately clear the sender's typing indicator on other clients.
   */
  broadcastStopTyping(userId: string): void {
    this._convTypingChannel?.send({
      type: 'broadcast',
      event: 'stop_typing',
      payload: { user_id: userId },
    });
    this._lastTypingBroadcast = 0;
  }

  // ── Dispose ──────────────────────────────────────────

  dispose() {
    if (this._currentEpochId) {
      this.leaveEpoch(this._currentEpochId);
    }
    this.leaveConversation();
  }
}

export const realtimeService = new RealtimeServiceImpl();

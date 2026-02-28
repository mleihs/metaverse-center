/**
 * RealtimeService — singleton managing Supabase Realtime channels for epochs.
 *
 * Provides Preact Signals for reactive UI:
 * - onlineUsers: who's currently online in the epoch
 * - epochMessages / teamMessages: live chat feeds
 * - readyStates: cycle_ready per simulation_id
 * - unreadEpochCount / unreadTeamCount: unread badge counters
 *
 * Channel naming:
 * - epoch:{id}:chat     — Broadcast (epoch-wide messages)
 * - epoch:{id}:presence  — Presence (online users)
 * - epoch:{id}:status    — Broadcast (ready signals, cycle events)
 * - epoch:{id}:team:{tid}:chat — Broadcast (team messages)
 */

import { signal } from '@preact/signals-core';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { EpochChatMessage, PresenceUser } from '../../types/index.js';
import { supabase } from '../supabase/client.js';

class RealtimeServiceImpl {
  // ── Signals ──────────────────────────────────────────
  readonly onlineUsers = signal<PresenceUser[]>([]);
  readonly epochMessages = signal<EpochChatMessage[]>([]);
  readonly teamMessages = signal<EpochChatMessage[]>([]);
  readonly readyStates = signal<Record<string, boolean>>({});
  readonly unreadEpochCount = signal(0);
  readonly unreadTeamCount = signal(0);

  // ── Internal state ───────────────────────────────────
  private _chatChannel: RealtimeChannel | null = null;
  private _presenceChannel: RealtimeChannel | null = null;
  private _statusChannel: RealtimeChannel | null = null;
  private _teamChannel: RealtimeChannel | null = null;
  private _currentEpochId: string | null = null;
  private _currentTeamId: string | null = null;
  private _epochChatFocused = true;
  private _teamChatFocused = false;

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

    // 3. Status channel (ready signals)
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

  // ── Initialize Ready States ──────────────────────────

  initReadyStates(participants: Array<{ simulation_id: string; cycle_ready?: boolean }>) {
    const states: Record<string, boolean> = {};
    for (const p of participants) {
      states[p.simulation_id] = p.cycle_ready ?? false;
    }
    this.readyStates.value = states;
  }

  // ── Dispose ──────────────────────────────────────────

  dispose() {
    if (this._currentEpochId) {
      this.leaveEpoch(this._currentEpochId);
    }
  }
}

export const realtimeService = new RealtimeServiceImpl();

/**
 * Tests for RealtimeService signal management and channel lifecycle.
 *
 * We don't test actual Supabase Realtime connections (those need a live server).
 * Instead we verify signal state management: initReadyStates, resetUnreadCount, dispose.
 */

import { describe, expect, it, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Inline testable version of RealtimeService signal logic.
// We replicate the signal-management parts without the Supabase dependency.
// ---------------------------------------------------------------------------

import { signal } from '@preact/signals-core';

interface PresenceUser {
  user_id: string;
  simulation_id: string;
  simulation_name: string;
  online_at: string;
}

interface EpochChatMessage {
  id: string;
  epoch_id: string;
  sender_id: string;
  sender_simulation_id: string;
  channel_type: 'epoch' | 'team';
  team_id?: string;
  content: string;
  created_at: string;
  sender_name?: string;
}

class TestableRealtimeService {
  readonly onlineUsers = signal<PresenceUser[]>([]);
  readonly epochMessages = signal<EpochChatMessage[]>([]);
  readonly teamMessages = signal<EpochChatMessage[]>([]);
  readonly readyStates = signal<Record<string, boolean>>({});
  readonly unreadEpochCount = signal(0);
  readonly unreadTeamCount = signal(0);

  // Public, damit der Fokuswechsel PRUEFBAR ist. Als `private` wurden beide nur
  // geschrieben und nie gelesen — der Testdouble bildete Verhalten nach, das
  // kein Test je betrachtet hat.
  epochChatFocused = true;
  teamChatFocused = false;

  initReadyStates(participants: Array<{ simulation_id: string; cycle_ready?: boolean }>) {
    const states: Record<string, boolean> = {};
    for (const p of participants) {
      states[p.simulation_id] = p.cycle_ready ?? false;
    }
    this.readyStates.value = states;
  }

  resetUnreadCount(channelType: 'epoch' | 'team') {
    if (channelType === 'epoch') {
      this.unreadEpochCount.value = 0;
      this.epochChatFocused = true;
      this.teamChatFocused = false;
    } else {
      this.unreadTeamCount.value = 0;
      this.teamChatFocused = true;
      this.epochChatFocused = false;
    }
  }

  dispose() {
    this.onlineUsers.value = [];
    this.epochMessages.value = [];
    this.teamMessages.value = [];
    this.readyStates.value = {};
    this.unreadEpochCount.value = 0;
    this.unreadTeamCount.value = 0;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RealtimeService — initReadyStates', () => {
  let service: TestableRealtimeService;

  beforeEach(() => {
    service = new TestableRealtimeService();
  });

  it('should initialize ready states from participants', () => {
    service.initReadyStates([
      { simulation_id: 'sim-1', cycle_ready: true },
      { simulation_id: 'sim-2', cycle_ready: false },
      { simulation_id: 'sim-3' },
    ]);
    expect(service.readyStates.value).toEqual({
      'sim-1': true,
      'sim-2': false,
      'sim-3': false,
    });
  });

  it('should handle empty participants', () => {
    service.initReadyStates([]);
    expect(service.readyStates.value).toEqual({});
  });

  it('should overwrite previous states', () => {
    service.readyStates.value = { 'sim-old': true };
    service.initReadyStates([{ simulation_id: 'sim-new', cycle_ready: true }]);
    expect(service.readyStates.value).toEqual({ 'sim-new': true });
    expect(service.readyStates.value['sim-old']).toBeUndefined();
  });
});

describe('RealtimeService — resetUnreadCount', () => {
  let service: TestableRealtimeService;

  beforeEach(() => {
    service = new TestableRealtimeService();
  });

  it('should reset epoch unread count', () => {
    service.unreadEpochCount.value = 5;
    service.resetUnreadCount('epoch');
    expect(service.unreadEpochCount.value).toBe(0);
  });

  it('should reset team unread count', () => {
    service.unreadTeamCount.value = 3;
    service.resetUnreadCount('team');
    expect(service.unreadTeamCount.value).toBe(0);
  });

  it('should not affect other channel count', () => {
    service.unreadEpochCount.value = 5;
    service.unreadTeamCount.value = 3;
    service.resetUnreadCount('epoch');
    expect(service.unreadTeamCount.value).toBe(3);
  });

  it('should move chat focus to the reset channel', () => {
    service.resetUnreadCount('team');
    expect(service.teamChatFocused).toBe(true);
    expect(service.epochChatFocused).toBe(false);

    service.resetUnreadCount('epoch');
    expect(service.epochChatFocused).toBe(true);
    expect(service.teamChatFocused).toBe(false);
  });
});

describe('RealtimeService — dispose', () => {
  let service: TestableRealtimeService;

  beforeEach(() => {
    service = new TestableRealtimeService();
  });

  it('should reset all signals', () => {
    service.onlineUsers.value = [
      { user_id: 'u1', simulation_id: 's1', simulation_name: 'Velg', online_at: '...' },
    ];
    service.epochMessages.value = [
      {
        id: 'm1',
        epoch_id: 'e1',
        sender_id: 'u1',
        sender_simulation_id: 's1',
        channel_type: 'epoch',
        content: 'Hi',
        created_at: '...',
      },
    ];
    service.readyStates.value = { 's1': true };
    service.unreadEpochCount.value = 10;
    service.unreadTeamCount.value = 5;

    service.dispose();

    expect(service.onlineUsers.value).toEqual([]);
    expect(service.epochMessages.value).toEqual([]);
    expect(service.teamMessages.value).toEqual([]);
    expect(service.readyStates.value).toEqual({});
    expect(service.unreadEpochCount.value).toBe(0);
    expect(service.unreadTeamCount.value).toBe(0);
  });
});

describe('RealtimeService — signal reactivity', () => {
  let service: TestableRealtimeService;

  beforeEach(() => {
    service = new TestableRealtimeService();
  });

  it('should allow pushing messages to epoch feed', () => {
    const msg1: EpochChatMessage = {
      id: 'm1',
      epoch_id: 'e1',
      sender_id: 'u1',
      sender_simulation_id: 's1',
      channel_type: 'epoch',
      content: 'Hello',
      created_at: '2026-02-28T12:00:00Z',
    };
    service.epochMessages.value = [...service.epochMessages.value, msg1];
    expect(service.epochMessages.value).toHaveLength(1);
    expect(service.epochMessages.value[0].content).toBe('Hello');
  });

  it('should accumulate unread counts', () => {
    service.unreadEpochCount.value += 1;
    service.unreadEpochCount.value += 1;
    service.unreadEpochCount.value += 1;
    expect(service.unreadEpochCount.value).toBe(3);
  });

  it('should update ready state for specific simulation', () => {
    service.initReadyStates([
      { simulation_id: 'sim-1', cycle_ready: false },
      { simulation_id: 'sim-2', cycle_ready: false },
    ]);
    service.readyStates.value = { ...service.readyStates.value, 'sim-1': true };
    expect(service.readyStates.value['sim-1']).toBe(true);
    expect(service.readyStates.value['sim-2']).toBe(false);
  });
});

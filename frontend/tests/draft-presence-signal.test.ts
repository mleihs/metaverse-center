/**
 * Tests for RealtimeService's draft-presence signal shape.
 *
 * We don't exercise the Supabase Realtime connection (that needs a live
 * server). Instead we replicate the signal-management parts inline and
 * verify the keyed `draftPresence` contract:
 *   - `leave` drops only the targeted slot
 *   - reading the slot for an unknown draft returns empty (default)
 *   - mutations produce new object references so signal subscribers fire
 */

import { signal } from '@preact/signals-core';
import { beforeEach, describe, expect, it } from 'vitest';

interface DraftPresenceUser {
  user_id: string;
  user_email: string;
  joined_at: string;
}

class TestablePresenceStore {
  readonly draftPresence = signal<Record<string, DraftPresenceUser[]>>({});

  /** Parallels the sync handler in `joinDraft`. */
  syncPresence(draftId: string, users: DraftPresenceUser[]): void {
    this.draftPresence.value = {
      ...this.draftPresence.value,
      [draftId]: users,
    };
  }

  /** Parallels `leaveDraft` — drops the keyed slot, preserves siblings. */
  leaveDraft(draftId: string): void {
    if (!(draftId in this.draftPresence.value)) return;
    const { [draftId]: _dropped, ...rest } = this.draftPresence.value;
    this.draftPresence.value = rest;
  }
}

const _user = (id: string, email = `${id}@example.com`): DraftPresenceUser => ({
  user_id: id,
  user_email: email,
  joined_at: '2026-04-21T12:00:00Z',
});

describe('draftPresence signal', () => {
  let store: TestablePresenceStore;

  beforeEach(() => {
    store = new TestablePresenceStore();
  });

  it('starts with an empty record', () => {
    expect(store.draftPresence.value).toEqual({});
  });

  it('reading a slot for an unknown draft returns undefined', () => {
    expect(store.draftPresence.value['unknown-draft']).toBeUndefined();
  });

  it('sync populates the targeted slot', () => {
    store.syncPresence('draft-a', [_user('alice')]);
    expect(store.draftPresence.value['draft-a']).toHaveLength(1);
    expect(store.draftPresence.value['draft-a']?.[0]?.user_id).toBe('alice');
  });

  it('sync on one draft does not disturb other slots', () => {
    store.syncPresence('draft-a', [_user('alice')]);
    store.syncPresence('draft-b', [_user('bob')]);
    expect(Object.keys(store.draftPresence.value).sort()).toEqual([
      'draft-a',
      'draft-b',
    ]);
    expect(store.draftPresence.value['draft-a']?.[0]?.user_id).toBe('alice');
    expect(store.draftPresence.value['draft-b']?.[0]?.user_id).toBe('bob');
  });

  it('leaveDraft drops only the targeted slot', () => {
    store.syncPresence('draft-a', [_user('alice')]);
    store.syncPresence('draft-b', [_user('bob')]);
    store.leaveDraft('draft-a');
    expect(store.draftPresence.value['draft-a']).toBeUndefined();
    expect(store.draftPresence.value['draft-b']?.[0]?.user_id).toBe('bob');
  });

  it('leaveDraft on an unknown slot is a no-op', () => {
    store.syncPresence('draft-a', [_user('alice')]);
    const before = store.draftPresence.value;
    store.leaveDraft('draft-nonexistent');
    // Reference equality: the no-op path must not allocate a new object —
    // otherwise SignalWatcher components re-render on every stray leave.
    expect(store.draftPresence.value).toBe(before);
  });

  it('sync mutation produces a fresh top-level reference (reactivity)', () => {
    store.syncPresence('draft-a', [_user('alice')]);
    const first = store.draftPresence.value;
    store.syncPresence('draft-a', [_user('alice'), _user('bob')]);
    const second = store.draftPresence.value;
    expect(second).not.toBe(first);
    expect(second['draft-a']).toHaveLength(2);
  });

  it('sync replaces the slot rather than merging users', () => {
    store.syncPresence('draft-a', [_user('alice'), _user('bob')]);
    store.syncPresence('draft-a', [_user('alice')]);
    // Bob left between sync events; slot must reflect the new truth.
    expect(store.draftPresence.value['draft-a']?.map((u) => u.user_id)).toEqual([
      'alice',
    ]);
  });
});

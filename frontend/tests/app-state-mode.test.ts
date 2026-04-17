// @vitest-environment happy-dom
import type { User } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { AppStateManager } from '../src/services/AppStateManager.js';

/**
 * Characterization tests for `AppStateManager.currentSimulationMode`.
 *
 * This computed signal is the single source of truth for simulation-scoped
 * API routing: `'member'` ⇔ authenticated AND has a role in the current sim,
 * else `'public'`. Services in `src/services/api/` must not read
 * `isAuthenticated` / `currentRole` directly — callers read this mode and
 * pass it explicitly.
 *
 * Locking in the derivation contract before threading `mode` through the
 * API layer guarantees migration is mechanical (same truth table, surfaced).
 */

function makeUser(id: string): User {
  return { id } as User;
}

describe('AppStateManager.currentSimulationMode', () => {
  it("is 'public' on a fresh instance (not authenticated, no role)", () => {
    const state = new AppStateManager();
    expect(state.currentSimulationMode.value).toBe('public');
  });

  it("is 'public' when authenticated but has no role (browsing someone else's sim)", () => {
    const state = new AppStateManager();
    state.setUser(makeUser('user-1'));
    expect(state.isAuthenticated.value).toBe(true);
    expect(state.currentRole.value).toBeNull();
    expect(state.currentSimulationMode.value).toBe('public');
  });

  it("is 'public' when a role exists but user is not authenticated (stale role)", () => {
    const state = new AppStateManager();
    state.setCurrentRole('owner');
    expect(state.isAuthenticated.value).toBe(false);
    expect(state.currentRole.value).toBe('owner');
    expect(state.currentSimulationMode.value).toBe('public');
  });

  it("is 'member' when authenticated AND has any role in the current sim", () => {
    const state = new AppStateManager();
    state.setUser(makeUser('user-1'));

    for (const role of ['owner', 'admin', 'editor', 'viewer'] as const) {
      state.setCurrentRole(role);
      expect(state.currentSimulationMode.value).toBe('member');
    }
  });

  it("flips from 'member' to 'public' on sign-out", () => {
    const state = new AppStateManager();
    state.setUser(makeUser('user-1'));
    state.setCurrentRole('owner');
    expect(state.currentSimulationMode.value).toBe('member');

    state.setUser(null);
    expect(state.currentSimulationMode.value).toBe('public');
  });

  it("flips from 'member' to 'public' when leaving the current simulation", () => {
    const state = new AppStateManager();
    state.setUser(makeUser('user-1'));
    state.setCurrentRole('editor');
    expect(state.currentSimulationMode.value).toBe('member');

    // Simulates _checkMembership resolving to null (authenticated non-member).
    state.setCurrentRole(null);
    expect(state.currentSimulationMode.value).toBe('public');
  });
});

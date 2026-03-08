import type { AuthError, Session, User } from '@supabase/supabase-js';
import { analyticsService } from '../AnalyticsService.js';
import { appState } from '../AppStateManager.js';
import { forgeApi } from '../api/ForgeApiService.js';
import { supabase } from './client.js';

export class SupabaseAuthService {
  private _initialized = false;
  private _previouslyAuthenticated = false;

  /**
   * Initialize auth: restore session from storage and set up the
   * persistent auth state listener. Must be called once at app startup.
   * Returns the restored session (or null).
   */
  async initialize(): Promise<Session | null> {
    if (this._initialized) {
      const { data } = await supabase.auth.getSession();
      return data.session;
    }

    // Wait for the INITIAL_SESSION event which fires once the session
    // has been loaded from localStorage (or confirmed as absent).
    const session = await new Promise<Session | null>((resolve) => {
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, s) => {
        if (event === 'INITIAL_SESSION') {
          resolve(s);
        }
        // Keep the listener alive for all future auth events
        // (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, etc.)
        this._syncAppState(s);
      });
      // Safety: if INITIAL_SESSION never fires (shouldn't happen), resolve after 2s
      setTimeout(() => {
        resolve(null);
      }, 2000);
      // Store subscription so we don't double-subscribe
      this._subscription = subscription;
    });

    this._initialized = true;
    return session;
  }

  private _subscription: { unsubscribe: () => void } | null = null;

  dispose(): void {
    this._subscription?.unsubscribe();
    this._subscription = null;
    this._initialized = false;
  }

  private async _syncAppState(session: Session | null): Promise<void> {
    if (session) {
      if (!this._previouslyAuthenticated) {
        const provider = session.user?.app_metadata?.provider ?? 'email';
        analyticsService.trackEvent('login', { method: provider });
      }
      this._previouslyAuthenticated = true;
      appState.setUser(session.user);
      appState.setAccessToken(session.access_token);

      // Fetch forge wallet status
      try {
        const walletResp = await forgeApi.getWallet();
        if (walletResp.success && walletResp.data) {
          appState.setArchitectStatus(walletResp.data.is_architect);
        }
      } catch (err) {
        console.error('Failed to fetch forge wallet:', err);
      }
    } else {
      if (this._previouslyAuthenticated) {
        analyticsService.trackEvent('logout');
      }
      this._previouslyAuthenticated = false;
      appState.setUser(null);
      appState.setAccessToken(null);
      appState.setArchitectStatus(false);
    }
  }

  async signUp(
    email: string,
    password: string,
  ): Promise<{ user: User | null; error: AuthError | null }> {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    return { user: data.user, error };
  }

  async signIn(
    email: string,
    password: string,
  ): Promise<{ user: User | null; error: AuthError | null }> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { user: data.user, error };
  }

  async signInWithGoogle(): Promise<void> {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
  }

  async signInWithDiscord(): Promise<void> {
    await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
  }

  async signOut(): Promise<{ error: AuthError | null }> {
    const { error } = await supabase.auth.signOut();
    return { error };
  }

  async resetPassword(email: string): Promise<{ error: AuthError | null }> {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    return { error };
  }

  async getSession(): Promise<{ session: Session | null; error: AuthError | null }> {
    const { data, error } = await supabase.auth.getSession();
    return { session: data.session, error };
  }
}

export const authService = new SupabaseAuthService();

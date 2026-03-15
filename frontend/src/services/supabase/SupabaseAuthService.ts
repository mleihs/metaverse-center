import type { AuthError, Session, User } from '@supabase/supabase-js';
import { msg, str } from '@lit/localize';
import { analyticsService } from '../AnalyticsService.js';
import { appState } from '../AppStateManager.js';
import { forgeApi } from '../api/ForgeApiService.js';
import { localeService } from '../i18n/locale-service.js';
import { supabase } from './client.js';

const CLEARANCE_TOAST_KEY = 'velg_clearance_toast_shown';
const ADMIN_PENDING_TOAST_KEY = 'velg_admin_pending_toast_shown';

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

          // If not architect, check for pending/approved clearance request
          if (!walletResp.data.is_architect) {
            try {
              const reqResp = await forgeApi.getMyAccessRequest();
              if (reqResp.success && reqResp.data) {
                appState.setForgeRequestStatus(reqResp.data.status);
              } else {
                appState.setForgeRequestStatus('none');
              }
            } catch (err) {
              console.error('Failed to check forge status:', err);
            }
          } else {
            // Check if the user was just approved (has an approved request)
            if (appState.forgeRequestStatus.value === 'pending' || !sessionStorage.getItem(CLEARANCE_TOAST_KEY)) {
              try {
                const reqResp = await forgeApi.getMyAccessRequest();
                if (reqResp.success && reqResp.data?.status === 'approved') {
                  // Show toast only once per session for newly approved architects
                  if (!sessionStorage.getItem(CLEARANCE_TOAST_KEY)) {
                    const { VelgToast } = await import('../../components/shared/Toast.js');
                    VelgToast.success(msg('Clearance granted \u2014 welcome to the Forge, Architect'));
                    sessionStorage.setItem(CLEARANCE_TOAST_KEY, '1');
                  }
                }
              } catch (err) {
                console.error('Failed to check forge status:', err);
              }
            }
            appState.setForgeRequestStatus('none');
          }
        }
      } catch (err) {
        console.error('Failed to fetch forge wallet:', err);
      }

      // Set GA4 user properties for segmentation
      const userType = appState.isPlatformAdmin.value
        ? 'admin'
        : appState.isArchitect.value
          ? 'architect'
          : 'member';
      analyticsService.setUserProperties({
        user_type: userType,
        has_forge_access: appState.canForge.value,
        locale: localeService.currentLocale,
      });

      // Admin: check pending clearance requests
      if (appState.isPlatformAdmin.value) {
        try {
          const countResp = await forgeApi.getPendingRequestCount();
          if (countResp.success && typeof countResp.data === 'number') {
            appState.setPendingForgeRequestCount(countResp.data);
            if (countResp.data > 0 && !sessionStorage.getItem(ADMIN_PENDING_TOAST_KEY)) {
              const { VelgToast } = await import('../../components/shared/Toast.js');
              VelgToast.info(msg(str`${countResp.data} pending clearance request(s)`));
              sessionStorage.setItem(ADMIN_PENDING_TOAST_KEY, '1');
            }
          }
        } catch (err) {
          console.error('Failed to check pending forge requests:', err);
        }
      }
    } else {
      if (this._previouslyAuthenticated) {
        analyticsService.trackEvent('logout');
        analyticsService.setUserProperties({ user_type: 'visitor' });
      }
      this._previouslyAuthenticated = false;
      appState.setUser(null);
      appState.setAccessToken(null);
      appState.setArchitectStatus(false);
      appState.setPlatformAdmin(false);
      appState.setForgeRequestStatus('none');
      appState.setPendingForgeRequestCount(0);
      sessionStorage.removeItem(CLEARANCE_TOAST_KEY);
      sessionStorage.removeItem(ADMIN_PENDING_TOAST_KEY);
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

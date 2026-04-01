import { msg, str } from '@lit/localize';
import type { AuthError, RealtimeChannel, Session, User } from '@supabase/supabase-js';
import { analyticsService } from '../AnalyticsService.js';
import { appState } from '../AppStateManager.js';
import { forgeApi } from '../api/ForgeApiService.js';
import { forgeStateManager } from '../ForgeStateManager.js';
import { localeService } from '../i18n/locale-service.js';
import { captureError } from '../SentryService.js';
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
  private _clearanceChannel: RealtimeChannel | null = null;

  dispose(): void {
    this._subscription?.unsubscribe();
    this._subscription = null;
    this._unsubscribeClearance();
    this._initialized = false;
  }

  private _unsubscribeClearance(): void {
    if (this._clearanceChannel) {
      supabase.removeChannel(this._clearanceChannel);
      this._clearanceChannel = null;
    }
  }

  /**
   * Subscribe to realtime updates on the user's clearance request.
   * Auto-unsubscribes once the request is resolved (approved/rejected).
   */
  private _subscribeClearanceStatus(userId: string): void {
    // Don't double-subscribe
    if (this._clearanceChannel) return;

    this._clearanceChannel = supabase
      .channel(`clearance:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'forge_access_requests',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          const newStatus = (payload.new as { status?: string }).status;

          if (newStatus === 'approved') {
            // Re-fetch wallet to get updated architect status + token balance
            const wallet = await forgeStateManager.loadWallet();
            appState.setArchitectStatus(true);
            appState.setForgeRequestStatus('none');

            // Show welcome toast with token count
            const tokens = wallet?.forge_tokens ?? 0;
            const { VelgToast } = await import('../../components/shared/Toast.js');
            VelgToast.success(
              tokens > 0
                ? msg(
                    str`Clearance granted – welcome to the Forge, Architect! ${tokens} tokens await you.`,
                  )
                : msg('Clearance granted – welcome to the Forge, Architect'),
            );
            sessionStorage.setItem(CLEARANCE_TOAST_KEY, '1');

            this._unsubscribeClearance();
          } else if (newStatus === 'rejected') {
            appState.setForgeRequestStatus('rejected');
            this._unsubscribeClearance();
          }
        },
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          captureError(err ?? status, { source: 'clearance_realtime' });
          this._unsubscribeClearance();
        }
      });
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
                // Subscribe to realtime updates while request is pending
                if (reqResp.data.status === 'pending' && session.user?.id) {
                  this._subscribeClearanceStatus(session.user.id);
                }
              } else {
                appState.setForgeRequestStatus('none');
              }
            } catch (err) {
              captureError(err, { source: 'forge_status_check' });
            }
          } else {
            // Check if the user was just approved (has an approved request)
            if (
              appState.forgeRequestStatus.value === 'pending' ||
              !sessionStorage.getItem(CLEARANCE_TOAST_KEY)
            ) {
              try {
                const reqResp = await forgeApi.getMyAccessRequest();
                if (reqResp.success && reqResp.data?.status === 'approved') {
                  // Show toast only once per session for newly approved architects
                  if (!sessionStorage.getItem(CLEARANCE_TOAST_KEY)) {
                    const { VelgToast } = await import('../../components/shared/Toast.js');
                    VelgToast.success(
                      msg('Clearance granted \u2014 welcome to the Forge, Architect'),
                    );
                    sessionStorage.setItem(CLEARANCE_TOAST_KEY, '1');
                  }
                }
              } catch (err) {
                captureError(err, { source: 'forge_status_check' });
              }
            }
            appState.setForgeRequestStatus('none');
          }
        }
      } catch (err) {
        captureError(err, { source: 'forge_wallet_fetch' });
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
          captureError(err, { source: 'pending_forge_requests' });
        }
      }
    } else {
      if (this._previouslyAuthenticated) {
        analyticsService.trackEvent('logout');
        analyticsService.setUserProperties({ user_type: 'visitor' });
      }
      this._previouslyAuthenticated = false;
      this._unsubscribeClearance();
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

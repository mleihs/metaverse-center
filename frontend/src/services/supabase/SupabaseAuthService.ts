import { msg, str } from '@lit/localize';
import type { AuthError, RealtimeChannel, Session, User } from '@supabase/supabase-js';
import { analyticsService } from '../AnalyticsService.js';
import { appState } from '../AppStateManager.js';
import { forgeApi } from '../api/ForgeApiService.js';
import { usersApi } from '../api/UsersApiService.js';
import { forgeStateManager } from '../ForgeStateManager.js';
import { localeService } from '../i18n/locale-service.js';
import { captureError } from '../SentryService.js';
import { supabase } from './client.js';

const CLEARANCE_TOAST_KEY = 'velg_clearance_toast_shown';
const ADMIN_PENDING_TOAST_KEY = 'velg_admin_pending_toast_shown';

export class SupabaseAuthService {
  private _initialized = false;
  private _previouslyAuthenticated = false;
  private _subscription: { unsubscribe: () => void } | null = null;
  private _clearanceChannel: RealtimeChannel | null = null;

  /**
   * Initialize auth: restore session from storage, bootstrap appState, set up
   * the persistent auth listener. Must be called once at app startup.
   *
   * Returns only after the initial bootstrap completes — callers can rely on
   * `appState.isAuthenticated`, `isPlatformAdmin`, `isArchitect`,
   * `onboardingCompleted`, and `forgeRequestStatus` being fully populated.
   */
  async initialize(): Promise<Session | null> {
    if (this._initialized) {
      const { data } = await supabase.auth.getSession();
      return data.session;
    }

    let initialResolved = false;
    let resolveInitial!: (session: Session | null) => void;
    const initialPromise = new Promise<Session | null>((r) => {
      resolveInitial = r;
    });

    // Safety net: if INITIAL_SESSION never fires (shouldn't happen), resolve
    // with null after 2s so app startup doesn't hang.
    const timeout = setTimeout(() => {
      if (!initialResolved) {
        initialResolved = true;
        resolveInitial(null);
      }
    }, 2000);

    // Single listener handles INITIAL_SESSION (awaited for bootstrap completion)
    // + all subsequent auth events (bootstrap/clear in background).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION') {
        if (initialResolved) return;
        initialResolved = true;
        clearTimeout(timeout);
        if (session) {
          await this.bootstrapSession(session);
        } else {
          await this.clearSession();
        }
        resolveInitial(session);
        return;
      }
      // SIGNED_IN / SIGNED_OUT / TOKEN_REFRESHED / USER_UPDATED / PASSWORD_RECOVERY
      if (session) {
        await this.bootstrapSession(session);
      } else {
        await this.clearSession();
      }
    });
    this._subscription = subscription;

    const initialSession = await initialPromise;
    this._initialized = true;
    return initialSession;
  }

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

  /**
   * Bootstrap appState from a signed-in session. Runs on INITIAL_SESSION with
   * a non-null session and on SIGNED_IN / TOKEN_REFRESHED / USER_UPDATED.
   *
   * Invariant: every `appState` field that depends on the signed-in user's
   * identity is populated exactly once per invocation, and GA4 user_properties
   * fires exactly once per invocation. No race window where `isPlatformAdmin`
   * lags behind `isArchitect` (see W1 audit F4).
   */
  async bootstrapSession(session: Session): Promise<void> {
    // 1. Primary auth state — set immediately so route guards / API layer
    //    see `isAuthenticated = true` while the parallel fetches are in flight.
    if (!this._previouslyAuthenticated) {
      const provider = session.user?.app_metadata?.provider ?? 'email';
      analyticsService.trackEvent('login', { method: provider });
    }
    this._previouslyAuthenticated = true;
    appState.setUser(session.user);
    appState.setAccessToken(session.access_token);

    // 2. Parallel-fetch every endpoint this bootstrap depends on.
    //    /me is authoritative for `is_platform_admin` + `onboarding_completed`.
    //    wallet is authoritative for `is_architect`.
    //    access-request gives the clearance status (pending/approved/rejected).
    const [meResp, walletResp, requestResp] = await Promise.all([
      usersApi.getMe().catch((err: unknown) => {
        captureError(err, { source: 'auth_bootstrap_me' });
        return null;
      }),
      forgeApi.getWallet().catch((err: unknown) => {
        captureError(err, { source: 'auth_bootstrap_wallet' });
        return null;
      }),
      forgeApi.getMyAccessRequest().catch((err: unknown) => {
        captureError(err, { source: 'auth_bootstrap_access_request' });
        return null;
      }),
    ]);

    // 3. Derive canonical values. /me wins for admin status; wallet wins for
    //    architect. For architects, forgeRequestStatus is always 'none' — the
    //    architect flag trumps any lingering request row.
    const meData = meResp?.success && meResp.data ? meResp.data : null;
    const walletData = walletResp?.success && walletResp.data ? walletResp.data : null;
    const requestData = requestResp?.success && requestResp.data ? requestResp.data : null;

    const isPlatformAdmin = meData?.is_platform_admin === true;
    const onboardingCompleted = meData?.onboarding_completed !== false;
    const isArchitect = walletData?.is_architect === true;
    const requestStatus = requestData?.status ?? 'none';
    const effectiveRequestStatus = isArchitect ? 'none' : requestStatus;

    // 4. Single write pass into appState.
    appState.setPlatformAdmin(isPlatformAdmin);
    appState.setOnboardingCompleted(onboardingCompleted);
    appState.setArchitectStatus(isArchitect);
    appState.setForgeRequestStatus(effectiveRequestStatus);

    // 5. Realtime subscription for a pending clearance request.
    if (effectiveRequestStatus === 'pending' && session.user?.id) {
      this._subscribeClearanceStatus(session.user.id);
    }

    // 6. GA4 user properties — fired once with the FINAL derived values.
    const userType: 'admin' | 'architect' | 'member' = isPlatformAdmin
      ? 'admin'
      : isArchitect
        ? 'architect'
        : 'member';
    analyticsService.setUserProperties({
      user_type: userType,
      has_forge_access: appState.canForge.value,
      locale: localeService.currentLocale,
    });

    // 7. Toasts — each guarded by a sessionStorage key so they fire at most
    //    once per browser session.
    if (
      isArchitect &&
      requestStatus === 'approved' &&
      !sessionStorage.getItem(CLEARANCE_TOAST_KEY)
    ) {
      const { VelgToast } = await import('../../components/shared/Toast.js');
      VelgToast.success(msg('Clearance granted \u2013 welcome to the Forge, Architect'));
      sessionStorage.setItem(CLEARANCE_TOAST_KEY, '1');
    }

    if (isPlatformAdmin) {
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
  }

  /**
   * Clear all user-derived appState on sign-out / INITIAL_SESSION with null.
   */
  async clearSession(): Promise<void> {
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
    appState.setOnboardingCompleted(true);
    sessionStorage.removeItem(CLEARANCE_TOAST_KEY);
    sessionStorage.removeItem(ADMIN_PENDING_TOAST_KEY);
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

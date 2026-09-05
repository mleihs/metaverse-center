import type {
  ApiResponse,
  DashboardData,
  ImagePreferences,
  ImagePreferencesPatch,
  UserAccount,
} from '../../types/index.js';
import { BaseApiService } from './BaseApiService.js';

/**
 * The account endpoints that exist.
 *
 * Two methods were removed on 30.08.2026 because nothing served them:
 * `updateMe()` PUT `/users/me` and `getMemberships()` GET `/users/me/memberships`
 * had no route in `backend/routers/users.py`, so the profile page answered every
 * visit with two failed requests - an error banner where the membership list
 * belonged, and a Save button that could only ever fail.
 *
 * Memberships come from `getMe()`, which has always returned them. The display
 * name is Supabase Auth data and is written through `authService`, not here.
 */
export class UsersApiService extends BaseApiService {
  getMe(): Promise<ApiResponse<UserAccount>> {
    return this.get('/users/me');
  }

  getDashboard(): Promise<ApiResponse<DashboardData>> {
    return this.get('/users/me/dashboard');
  }

  completeOnboarding(): Promise<ApiResponse<{ onboarding_completed: boolean }>> {
    return this.patch('/users/me/onboarding');
  }

  getImagePreferences(): Promise<ApiResponse<ImagePreferences>> {
    return this.get('/users/me/image-preferences');
  }

  /**
   * Inhaltsstufe und Blick setzen.
   *
   * PATCH und nicht PUT, und das ist inhaltlich wichtig: die Akte hat zwei
   * getrennte Bedienelemente, und eines zu bedienen darf das andere nicht
   * zuruecksetzen. Ein weggelassenes Feld bleibt, wie es war.
   *
   * `vantage_folgt_der_welt` ist der einzige Weg, den Blick auf „die Welt
   * entscheidet" zurueckzustellen — ein `null` im Rumpf waere von einem
   * weggelassenen Feld nicht zu unterscheiden.
   */
  updateImagePreferences(patch: ImagePreferencesPatch): Promise<ApiResponse<ImagePreferences>> {
    return this.patch('/users/me/image-preferences', patch);
  }
}

export const usersApi = new UsersApiService();

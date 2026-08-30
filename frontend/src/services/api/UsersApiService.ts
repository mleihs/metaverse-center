import type { ApiResponse, DashboardData, UserAccount } from '../../types/index.js';
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
}

export const usersApi = new UsersApiService();

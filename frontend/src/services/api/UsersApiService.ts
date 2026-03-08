import type { ApiResponse, MembershipInfo, UserProfile } from '../../types/index.js';
import { BaseApiService } from './BaseApiService.js';

export class UsersApiService extends BaseApiService {
  getMe(): Promise<ApiResponse<UserProfile>> {
    return this.get('/users/me');
  }

  updateMe(data: Partial<UserProfile>): Promise<ApiResponse<UserProfile>> {
    return this.put('/users/me', data);
  }

  getMemberships(): Promise<ApiResponse<MembershipInfo[]>> {
    return this.get('/users/me/memberships');
  }

  completeOnboarding(): Promise<ApiResponse<{ onboarding_completed: boolean }>> {
    return this.patch('/users/me/onboarding');
  }
}

export const usersApi = new UsersApiService();

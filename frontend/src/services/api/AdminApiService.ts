import type {
  AdminUser,
  AdminUserDetail,
  ApiResponse,
  PlatformSetting,
} from '../../types/index.js';
import { BaseApiService } from './BaseApiService.js';

export class AdminApiService extends BaseApiService {
  async listSettings(): Promise<ApiResponse<PlatformSetting[]>> {
    return this.get('/admin/settings');
  }

  async updateSetting(key: string, value: string | number): Promise<ApiResponse<PlatformSetting>> {
    return this.put(`/admin/settings/${key}`, { value });
  }

  async listUsers(
    page = 1,
    perPage = 50,
  ): Promise<ApiResponse<{ users: AdminUser[]; total: number }>> {
    return this.get('/admin/users', { page: String(page), per_page: String(perPage) });
  }

  async getUser(userId: string): Promise<ApiResponse<AdminUserDetail>> {
    return this.get(`/admin/users/${userId}`);
  }

  async deleteUser(userId: string): Promise<ApiResponse<{ deleted: boolean }>> {
    return this.delete(`/admin/users/${userId}`);
  }

  async addMembership(
    userId: string,
    simulationId: string,
    role: string,
  ): Promise<ApiResponse<unknown>> {
    return this.post(`/admin/users/${userId}/memberships`, {
      simulation_id: simulationId,
      role,
    });
  }

  async changeMembershipRole(
    userId: string,
    simulationId: string,
    role: string,
  ): Promise<ApiResponse<unknown>> {
    return this.put(`/admin/users/${userId}/memberships/${simulationId}`, { role });
  }

  async removeMembership(userId: string, simulationId: string): Promise<ApiResponse<unknown>> {
    return this.delete(`/admin/users/${userId}/memberships/${simulationId}`);
  }
}

export const adminApi = new AdminApiService();

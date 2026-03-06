import type {
  AdminUser,
  AdminUserDetail,
  ApiResponse,
  CleanupExecuteResult,
  CleanupPreviewResult,
  CleanupStats,
  CleanupType,
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

  async updateUserWallet(
    userId: string,
    data: { forge_tokens?: number; is_architect?: boolean },
  ): Promise<ApiResponse<unknown>> {
    return this.put(`/admin/users/${userId}/wallet`, data);
  }

  async getCleanupStats(): Promise<ApiResponse<CleanupStats>> {
    return this.get('/admin/cleanup/stats');
  }

  async previewCleanup(
    cleanupType: CleanupType,
    minAgeDays: number,
  ): Promise<ApiResponse<CleanupPreviewResult>> {
    return this.post('/admin/cleanup/preview', {
      cleanup_type: cleanupType,
      min_age_days: minAgeDays,
    });
  }

  async executeCleanup(
    cleanupType: CleanupType,
    minAgeDays: number,
  ): Promise<ApiResponse<CleanupExecuteResult>> {
    return this.post('/admin/cleanup/execute', {
      cleanup_type: cleanupType,
      min_age_days: minAgeDays,
    });
  }

  // --- Simulation Management ---

  async listSimulations(
    page = 1,
    perPage = 50,
    includeDeleted = false,
  ): Promise<ApiResponse<AdminSimulation[]>> {
    return this.get('/admin/simulations', {
      page: String(page),
      per_page: String(perPage),
      include_deleted: String(includeDeleted),
    });
  }

  async listDeletedSimulations(page = 1, perPage = 50): Promise<ApiResponse<AdminSimulation[]>> {
    return this.get('/admin/simulations/deleted', {
      page: String(page),
      per_page: String(perPage),
    });
  }

  async softDeleteSimulation(simulationId: string): Promise<ApiResponse<unknown>> {
    return this.delete(`/admin/simulations/${simulationId}`);
  }

  async hardDeleteSimulation(simulationId: string): Promise<ApiResponse<unknown>> {
    return this.delete(`/admin/simulations/${simulationId}?hard=true`);
  }

  async restoreSimulation(simulationId: string): Promise<ApiResponse<unknown>> {
    return this.post(`/admin/simulations/${simulationId}/restore`, {});
  }
}

export interface AdminSimulation {
  id: string;
  name: string;
  slug: string;
  status: string;
  theme: string;
  simulation_type: string;
  owner_id: string | null;
  created_at: string;
  deleted_at: string | null;
}

export const adminApi = new AdminApiService();

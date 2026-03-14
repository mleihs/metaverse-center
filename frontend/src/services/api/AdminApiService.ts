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
  async getEnvironment(): Promise<ApiResponse<{ environment: string }>> {
    return this.get('/admin/environment');
  }

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
    epochIds?: string[],
  ): Promise<ApiResponse<CleanupPreviewResult>> {
    return this.post('/admin/cleanup/preview', {
      cleanup_type: cleanupType,
      min_age_days: minAgeDays,
      ...(epochIds ? { epoch_ids: epochIds } : {}),
    });
  }

  async executeCleanup(
    cleanupType: CleanupType,
    minAgeDays: number,
    epochIds?: string[],
  ): Promise<ApiResponse<CleanupExecuteResult>> {
    return this.post('/admin/cleanup/execute', {
      cleanup_type: cleanupType,
      min_age_days: minAgeDays,
      ...(epochIds ? { epoch_ids: epochIds } : {}),
    });
  }

  // --- Token Economy (Admin) ---

  async getTokenEconomyStats(): Promise<ApiResponse<TokenEconomyStats>> {
    return this.get('/forge/admin/economy');
  }

  async listAllBundles(): Promise<ApiResponse<AdminBundleEntry[]>> {
    return this.get('/forge/admin/bundles');
  }

  async updateBundle(
    bundleId: string,
    data: Partial<AdminBundleEntry>,
  ): Promise<ApiResponse<unknown>> {
    return this.put(`/forge/admin/bundles/${bundleId}`, data);
  }

  async listPurchases(
    limit = 50,
    offset = 0,
    paymentMethod?: string,
  ): Promise<ApiResponse<AdminPurchaseLedgerEntry[]>> {
    const params: Record<string, string> = {
      limit: String(limit),
      offset: String(offset),
    };
    if (paymentMethod) params.payment_method = paymentMethod;
    return this.get('/forge/admin/purchases', params);
  }

  async grantTokens(
    userId: string,
    tokens: number,
    reason?: string,
  ): Promise<ApiResponse<unknown>> {
    return this.post('/forge/admin/grant', { user_id: userId, tokens, reason });
  }

  // --- BYOK System Settings ---

  async getBYOKSystemSetting(): Promise<ApiResponse<{
    byok_bypass_enabled: boolean;
    byok_access_policy: string;
  }>> {
    return this.get('/forge/admin/byok-setting');
  }

  async updateBYOKSystemSetting(enabled: boolean): Promise<ApiResponse<{ byok_bypass_enabled: boolean }>> {
    return this.put(`/forge/admin/byok-setting?enabled=${enabled}`, {});
  }

  async updateBYOKAccessPolicy(policy: 'none' | 'all' | 'per_user'): Promise<ApiResponse<{ byok_access_policy: string }>> {
    return this.put(`/forge/admin/byok-access-policy?policy=${policy}`, {});
  }

  async updateUserBYOKBypass(userId: string, enabled: boolean): Promise<ApiResponse<unknown>> {
    return this.put(`/forge/admin/user-byok-bypass/${userId}?enabled=${enabled}`, {});
  }

  async updateUserBYOKAllowed(userId: string, enabled: boolean): Promise<ApiResponse<unknown>> {
    return this.put(`/forge/admin/user-byok-allowed/${userId}?enabled=${enabled}`, {});
  }

  // --- Impersonation ---

  async impersonateUser(userId: string): Promise<ApiResponse<{ hashed_token: string; email: string }>> {
    return this.post('/admin/impersonate', { user_id: userId });
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

export interface TokenEconomyStats {
  total_purchases: number;
  mock_purchases: number;
  admin_grants: number;
  total_revenue_cents: number;
  total_tokens_granted: number;
  tokens_in_circulation: number;
  unique_buyers: number;
  active_bundles: number;
}

export interface AdminBundleEntry {
  id: string;
  slug: string;
  display_name: string;
  tokens: number;
  price_cents: number;
  savings_pct: number;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface AdminPurchaseLedgerEntry {
  id: string;
  user_id: string;
  tokens_granted: number;
  price_cents: number;
  payment_method: string;
  payment_reference?: string;
  balance_before: number;
  balance_after: number;
  created_at: string;
  token_bundles?: { slug: string };
}

export const adminApi = new AdminApiService();

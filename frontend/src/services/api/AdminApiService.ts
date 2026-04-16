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

  async getAIUsageStats(days = 30): Promise<ApiResponse<AIUsageStats>> {
    return this.get('/admin/ai-usage/stats', { days: String(days) });
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

  async getBYOKSystemSetting(): Promise<
    ApiResponse<{
      byok_bypass_enabled: boolean;
      byok_access_policy: string;
    }>
  > {
    return this.get('/forge/admin/byok-setting');
  }

  async updateBYOKSystemSetting(
    enabled: boolean,
  ): Promise<ApiResponse<{ byok_bypass_enabled: boolean }>> {
    return this.put(`/forge/admin/byok-setting?enabled=${enabled}`, {});
  }

  async updateBYOKAccessPolicy(
    policy: 'none' | 'all' | 'per_user',
  ): Promise<ApiResponse<{ byok_access_policy: string }>> {
    return this.put(`/forge/admin/byok-access-policy?policy=${policy}`, {});
  }

  async updateUserBYOKBypass(userId: string, enabled: boolean): Promise<ApiResponse<unknown>> {
    return this.put(`/forge/admin/user-byok-bypass/${userId}?enabled=${enabled}`, {});
  }

  async updateUserBYOKAllowed(userId: string, enabled: boolean): Promise<ApiResponse<unknown>> {
    return this.put(`/forge/admin/user-byok-allowed/${userId}?enabled=${enabled}`, {});
  }

  // --- Impersonation ---

  async impersonateUser(
    userId: string,
  ): Promise<ApiResponse<{ hashed_token: string; email: string }>> {
    return this.post('/admin/impersonate', { user_id: userId });
  }

  // --- Health Effects Control ---

  async getHealthEffects(): Promise<ApiResponse<HealthEffectsData>> {
    return this.get('/admin/health-effects');
  }

  async updateSimulationHealthEffects(
    simulationId: string,
    enabled: boolean,
  ): Promise<ApiResponse<{ enabled: boolean }>> {
    return this.put(`/admin/health-effects/simulations/${simulationId}`, { enabled });
  }

  // --- Instagram Pipeline ---

  async listInstagramQueue(
    params?: Record<string, string>,
  ): Promise<ApiResponse<InstagramQueueItem[]>> {
    return this.get('/admin/instagram/queue', params);
  }

  async getInstagramPost(postId: string): Promise<ApiResponse<InstagramQueueItem>> {
    return this.get(`/admin/instagram/queue/${postId}`);
  }

  async generateInstagramContent(body: {
    content_types?: string[];
    simulation_id?: string;
    count?: number;
  }): Promise<ApiResponse<InstagramQueueItem[]>> {
    return this.post('/admin/instagram/generate', body);
  }

  async listInstagramCandidates(params?: Record<string, string>): Promise<ApiResponse<unknown[]>> {
    return this.get('/admin/instagram/candidates', params);
  }

  async createInstagramPost(
    body: Record<string, unknown>,
  ): Promise<ApiResponse<InstagramQueueItem>> {
    return this.post('/admin/instagram/queue', body);
  }

  async approveInstagramPost(
    postId: string,
    body?: { scheduled_at?: string },
  ): Promise<ApiResponse<InstagramQueueItem>> {
    return this.post(`/admin/instagram/queue/${postId}/approve`, body ?? {});
  }

  async rejectInstagramPost(
    postId: string,
    reason: string,
  ): Promise<ApiResponse<InstagramQueueItem>> {
    return this.post(`/admin/instagram/queue/${postId}/reject`, { reason });
  }

  async forcePublishInstagramPost(postId: string): Promise<ApiResponse<InstagramQueueItem>> {
    return this.post(`/admin/instagram/queue/${postId}/publish`, {});
  }

  async getInstagramAnalytics(days = 30): Promise<ApiResponse<InstagramAnalytics>> {
    return this.get('/admin/instagram/analytics', { days: String(days) });
  }

  async getInstagramRateLimit(): Promise<ApiResponse<InstagramRateLimit>> {
    return this.get('/admin/instagram/rate-limit');
  }

  async getInstagramCipherStats(): Promise<ApiResponse<CipherStats>> {
    return this.get('/admin/instagram/ciphers');
  }

  async setInstagramCipher(
    postId: string,
    body: { unlock_code: string; difficulty: string },
  ): Promise<ApiResponse<{ post_id: string; unlock_code: string; difficulty: string }>> {
    return this.post(`/admin/instagram/${postId}/cipher`, body);
  }

  async getInstagramSettings(): Promise<ApiResponse<InstagramPipelineSettings>> {
    return this.get('/admin/instagram/settings');
  }

  async getInstagramStatus(): Promise<ApiResponse<InstagramConnectionStatus>> {
    return this.get('/admin/instagram/status');
  }

  // --- Bluesky Pipeline ---

  async listBlueskyQueue(
    params?: Record<string, string>,
  ): Promise<ApiResponse<BlueskyQueueItem[]>> {
    return this.get('/admin/bluesky/queue', params);
  }

  async getBlueskyPost(postId: string): Promise<ApiResponse<BlueskyQueueItem>> {
    return this.get(`/admin/bluesky/queue/${postId}`);
  }

  async skipBlueskyPost(postId: string): Promise<ApiResponse<BlueskyQueueItem>> {
    return this.post(`/admin/bluesky/queue/${postId}/skip`, {});
  }

  async unskipBlueskyPost(postId: string): Promise<ApiResponse<BlueskyQueueItem>> {
    return this.post(`/admin/bluesky/queue/${postId}/unskip`, {});
  }

  async forcePublishBlueskyPost(postId: string): Promise<ApiResponse<BlueskyQueueItem>> {
    return this.post(`/admin/bluesky/queue/${postId}/publish`, {});
  }

  async getBlueskyAnalytics(days = 30): Promise<ApiResponse<BlueskyAnalytics>> {
    return this.get('/admin/bluesky/analytics', { days: String(days) });
  }

  async getBlueskySettings(): Promise<ApiResponse<BlueskyPipelineSettings>> {
    return this.get('/admin/bluesky/settings');
  }

  async getBlueskyStatus(): Promise<ApiResponse<BlueskyConnectionStatus>> {
    return this.get('/admin/bluesky/status');
  }

  // --- Social Stories (Resonance → Instagram Story Pipeline) ---

  async listSocialStories(
    params?: Record<string, string>,
  ): Promise<ApiResponse<SocialStoryItem[]>> {
    return this.get('/admin/instagram/stories', params);
  }

  async getSocialStorySequence(resonanceId: string): Promise<ApiResponse<SocialStorySequence>> {
    return this.get(`/admin/instagram/stories/sequence/${resonanceId}`);
  }

  async skipSocialStory(storyId: string): Promise<ApiResponse<SocialStoryItem>> {
    return this.post(`/admin/instagram/stories/${storyId}/skip`, {});
  }

  async unskipSocialStory(storyId: string): Promise<ApiResponse<SocialStoryItem>> {
    return this.post(`/admin/instagram/stories/${storyId}/unskip`, {});
  }

  async forceComposeSocialStory(storyId: string): Promise<ApiResponse<SocialStoryItem>> {
    return this.post(`/admin/instagram/stories/${storyId}/compose`, {});
  }

  async forcePublishSocialStory(storyId: string): Promise<ApiResponse<SocialStoryItem>> {
    return this.post(`/admin/instagram/stories/${storyId}/publish`, {});
  }

  async getSocialStorySettings(): Promise<ApiResponse<Record<string, string>>> {
    return this.get('/admin/instagram/stories/settings');
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

  // --- Dungeon Global Config ---

  async getDungeonGlobalConfig(): Promise<ApiResponse<DungeonGlobalConfig>> {
    return this.get('/admin/dungeon-config/global');
  }

  async updateDungeonGlobalConfig(
    config: DungeonGlobalConfig,
  ): Promise<ApiResponse<DungeonGlobalConfig>> {
    return this.put('/admin/dungeon-config/global', {
      override_mode: config.override_mode,
      override_archetypes: config.override_archetypes,
      clearance_mode: config.clearance_mode,
      clearance_threshold: config.clearance_threshold,
    });
  }

  // --- Dungeon Per-Simulation Override ---

  async listDungeonOverrides(): Promise<ApiResponse<DungeonOverrideSimulation[]>> {
    return this.get('/admin/dungeon-override');
  }

  async getDungeonOverride(simulationId: string): Promise<ApiResponse<DungeonOverrideConfig>> {
    return this.get(`/admin/dungeon-override/simulations/${simulationId}`);
  }

  async updateDungeonOverride(
    simulationId: string,
    config: DungeonOverrideConfig,
  ): Promise<ApiResponse<DungeonOverrideConfig>> {
    return this.put(`/admin/dungeon-override/simulations/${simulationId}`, config);
  }
}

export interface HealthEffectsData {
  global_enabled: boolean;
  simulations: HealthEffectsSimulation[];
}

export interface HealthEffectsSimulation {
  id: string;
  name: string;
  name_de?: string;
  slug: string;
  overall_health: number;
  threshold_state: 'normal' | 'critical' | 'ascendant';
  effects_enabled: boolean;
}

export interface AdminSimulation {
  id: string;
  name: string;
  name_de?: string;
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

export interface InstagramQueueItem {
  id: string;
  simulation_id: string | null;
  content_source_type: string;
  content_source_id: string | null;
  caption: string;
  hashtags: string[];
  alt_text: string | null;
  image_urls: string[];
  media_type: string;
  status: string;
  scheduled_at: string | null;
  published_at: string | null;
  failure_reason: string | null;
  retry_count: number;
  ig_permalink: string | null;
  likes_count: number;
  comments_count: number;
  reach: number;
  saves: number;
  shares: number;
  engagement_rate: number;
  metrics_updated_at: string | null;
  unlock_code: string | null;
  ai_disclosure_included: boolean;
  ai_model_used: string | null;
  created_at: string;
  updated_at: string;
  created_by_id: string | null;
  simulation_name: string | null;
  simulation_slug: string | null;
  simulation_theme: string | null;
  bsky_status: string | null;
}

export interface InstagramAnalytics {
  period_days: number;
  total_posts: number;
  total_drafts: number;
  total_scheduled: number;
  total_failed: number;
  avg_engagement_rate: number | null;
  total_reach: number | null;
  total_likes: number | null;
  total_saves: number | null;
  total_shares: number | null;
  total_comments: number | null;
  top_content_type: string | null;
  engagement_by_simulation: {
    simulation_name: string;
    post_count: number;
    avg_engagement_rate: number;
  }[];
  engagement_by_type: { content_type: string; post_count: number; avg_engagement_rate: number }[];
}

export interface InstagramRateLimit {
  quota_usage: number;
  quota_total: number;
  remaining: number;
}

export interface CipherStats {
  total_redemptions: number;
  unique_users: number;
  total_attempts: number;
  success_rate: number;
  recent_redemptions: CipherRedemptionRecord[];
}

export interface CipherRedemptionRecord {
  id: string;
  instagram_post_id: string;
  user_id: string | null;
  redeemed_at: string;
  ip_hash: string | null;
  reward_type: string;
  reward_data: Record<string, unknown>;
}

export interface InstagramSettingEntry {
  value: string;
  description: string;
}

export type InstagramPipelineSettings = Record<string, InstagramSettingEntry>;

export interface InstagramConnectionStatus {
  configured: boolean;
  authenticated: boolean;
  ig_user_id: string | null;
}

export interface BlueskyQueueItem {
  id: string;
  instagram_post_id: string | null;
  simulation_id: string | null;
  content_source_type: string;
  content_source_id: string | null;
  caption: string;
  facets: Record<string, unknown>[] | null;
  alt_text: string | null;
  image_urls: string[];
  status: string;
  scheduled_at: string | null;
  published_at: string | null;
  failure_reason: string | null;
  retry_count: number;
  bsky_uri: string | null;
  bsky_cid: string | null;
  likes_count: number;
  reposts_count: number;
  replies_count: number;
  quotes_count: number;
  metrics_updated_at: string | null;
  unlock_code: string | null;
  created_at: string;
  updated_at: string;
  simulation_name: string | null;
  simulation_slug: string | null;
  simulation_theme: string | null;
  instagram_permalink: string | null;
  instagram_status: string | null;
}

export interface BlueskyAnalytics {
  period_days: number;
  total_posts: number;
  total_pending: number;
  total_failed: number;
  total_skipped: number;
  avg_likes: number | null;
  total_reposts: number | null;
  total_replies: number | null;
  total_quotes: number | null;
  engagement_by_type: { content_type: string; post_count: number; avg_likes: number }[];
}

export interface BlueskyConnectionStatus {
  configured: boolean;
  authenticated: boolean;
  handle: string | null;
  pds_url: string;
}

export type BlueskyPipelineSettings = Record<string, InstagramSettingEntry>;

export interface SocialStoryItem {
  id: string;
  resonance_id: string | null;
  simulation_id: string | null;
  story_type: string;
  sequence_index: number;
  image_url: string | null;
  caption: string | null;
  narrative_closing: string | null;
  ig_story_id: string | null;
  ig_posted_at: string | null;
  status: string;
  scheduled_at: string;
  published_at: string | null;
  failure_reason: string | null;
  retry_count: number;
  archetype: string | null;
  magnitude: number | null;
  effective_magnitude: number | null;
  created_at: string;
  updated_at: string;
}

export interface SocialStorySequence {
  resonance_id: string;
  archetype: string;
  magnitude: number;
  stories: SocialStoryItem[];
  total_stories: number;
  published_count: number;
  status_summary: string;
}

// ── AI Usage Analytics ─────────────────────────────────────────────────

export interface AIUsageBreakdown {
  calls: number;
  tokens: number;
  cost: number;
}

export interface AIUsageStats {
  period_days: number;
  total_calls: number;
  total_tokens: number;
  total_cost_usd: number;
  avg_cost_per_call: number;
  by_provider: (AIUsageBreakdown & { provider: string })[];
  by_model: (AIUsageBreakdown & { model: string })[];
  by_purpose: (AIUsageBreakdown & { purpose: string })[];
  by_simulation: (AIUsageBreakdown & { simulation_id: string })[];
  daily_trend: (AIUsageBreakdown & { date: string })[];
  key_sources: Record<string, AIUsageBreakdown>;
}

// ── Dungeon Global Config ────────────────────────────────────────────

export interface DungeonGlobalConfig {
  override_mode: 'off' | 'supplement' | 'override';
  override_archetypes: string[];
  clearance_mode: 'off' | 'standard' | 'custom';
  clearance_threshold: number;
}

// ── Dungeon Per-Simulation Override ─────────────────────────────────

export interface DungeonOverrideConfig {
  mode: 'off' | 'supplement' | 'override';
  archetypes: string[];
}

export interface DungeonOverrideSimulation {
  id: string;
  name: string;
  name_de?: string;
  slug: string;
  mode: 'off' | 'supplement' | 'override';
  archetypes: string[];
}

export const adminApi = new AdminApiService();

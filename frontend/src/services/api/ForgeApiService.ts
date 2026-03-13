import type { ApiResponse, ForgeAccessRequest, ForgeAccessRequestWithEmail, PaginatedResponse } from '../../types/index.js';
import { BaseApiService } from './BaseApiService.js';

export interface PhilosophicalAnchor {
  title: string;
  literary_influence: string;
  core_question: string;
  description: string;
}

export interface ForgeAgentDraft {
  name: string;
  gender: string;
  system: string;
  primary_profession: string;
  character: string;
  background: string;
}

export interface ForgeBuildingDraft {
  name: string;
  building_type: string;
  description: string;
  building_condition: string;
}

export interface ForgeGenerationConfig {
  agent_count: number;
  building_count: number;
  zone_count: number;
  street_count: number;
  deep_research: boolean;
}

export interface ForgeLoreSection {
  id: string;
  simulation_id: string;
  sort_order: number;
  chapter: string;
  arcanum: string;
  title: string;
  epigraph: string;
  body: string;
  image_slug: string | null;
  image_caption: string | null;
  title_de?: string | null;
  epigraph_de?: string | null;
  body_de?: string | null;
  image_caption_de?: string | null;
}

export interface ForgeDraft {
  id: string;
  user_id: string;
  current_phase: 'astrolabe' | 'drafting' | 'darkroom' | 'ignition' | 'completed' | 'failed';
  seed_prompt: string;
  philosophical_anchor: {
    options: PhilosophicalAnchor[];
    selected?: PhilosophicalAnchor;
  };
  taxonomies: Record<string, unknown>;
  geography: Record<string, unknown>;
  agents: ForgeAgentDraft[];
  buildings: ForgeBuildingDraft[];
  ai_settings: Record<string, unknown>;
  generation_config: ForgeGenerationConfig;
  theme_config: Record<string, string>;
  status: 'draft' | 'processing' | 'completed' | 'failed';
  error_log?: string;
  created_at: string;
  updated_at: string;
}

export interface ForgeProgressEntity {
  name: string;
  image_url: string | null;
}

export interface ForgeProgress {
  total: number;
  completed: number;
  done: boolean;
  agents: ForgeProgressEntity[];
  buildings: ForgeProgressEntity[];
}

export interface TokenBundle {
  id: string;
  slug: string;
  display_name: string;
  tokens: number;
  price_cents: number;
  savings_pct: number;
  sort_order: number;
}

export interface PurchaseReceipt {
  purchase_id: string;
  bundle_slug: string;
  tokens_granted: number;
  balance_before: number;
  balance_after: number;
  price_cents: number;
}

export interface TokenPurchase {
  id: string;
  bundle_id: string;
  tokens_granted: number;
  price_cents: number;
  payment_method: string;
  balance_before: number;
  balance_after: number;
  created_at: string;
}

export interface BYOKStatus {
  has_openrouter_key: boolean;
  has_replicate_key: boolean;
  byok_allowed: boolean;
  byok_bypass: boolean;
  system_bypass_enabled: boolean;
  effective_bypass: boolean;
  access_policy: 'none' | 'all' | 'per_user';
}

export interface WalletResponse {
  forge_tokens: number;
  is_architect: boolean;
  account_tier: string;
  byok_status: BYOKStatus;
}

export interface FeaturePurchase {
  id: string;
  user_id: string;
  simulation_id: string;
  feature_type: 'darkroom_pass' | 'classified_dossier' | 'recruitment' | 'chronicle_export';
  token_cost: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
  config: Record<string, unknown>;
  result: Record<string, unknown>;
  regen_budget_remaining: number;
  created_at: string;
  completed_at: string | null;
}

export class ForgeApiService extends BaseApiService {
  listDrafts(params?: Record<string, string>): Promise<ApiResponse<PaginatedResponse<ForgeDraft>>> {
    return this.get('/forge/drafts', params);
  }

  createDraft(seed_prompt: string): Promise<ApiResponse<ForgeDraft>> {
    return this.post('/forge/drafts', { seed_prompt });
  }

  getDraft(id: string): Promise<ApiResponse<ForgeDraft>> {
    return this.get(`/forge/drafts/${id}`);
  }

  updateDraft(id: string, data: Partial<ForgeDraft>): Promise<ApiResponse<ForgeDraft>> {
    return this.patch(`/forge/drafts/${id}`, data);
  }

  deleteDraft(id: string): Promise<ApiResponse<void>> {
    return this.delete(`/forge/drafts/${id}`);
  }

  runResearch(id: string): Promise<ApiResponse<{ anchors: PhilosophicalAnchor[] }>> {
    return this.post(`/forge/drafts/${id}/research`);
  }

  generateChunk(id: string, chunkType: string): Promise<ApiResponse<unknown>> {
    return this.post(`/forge/drafts/${id}/generate/${chunkType}`);
  }

  generateTheme(id: string): Promise<ApiResponse<Record<string, string>>> {
    return this.post(`/forge/drafts/${id}/generate-theme`);
  }

  ignite(id: string): Promise<ApiResponse<{ simulation_id: string; slug: string | null; name?: string; description?: string }>> {
    return this.post(`/forge/drafts/${id}/ignite`);
  }

  getSimulationLore(simulationId: string): Promise<ApiResponse<ForgeLoreSection[]>> {
    return this.getPublic(`/simulations/${simulationId}/lore`);
  }

  getForgeProgress(slug: string): Promise<ApiResponse<ForgeProgress>> {
    return this.getPublic(`/simulations/by-slug/${slug}/forge-progress`);
  }

  getWallet(): Promise<ApiResponse<WalletResponse>> {
    return this.get('/forge/wallet');
  }

  listBundles(): Promise<ApiResponse<TokenBundle[]>> {
    return this.get('/forge/bundles');
  }

  purchaseBundle(slug: string): Promise<ApiResponse<PurchaseReceipt>> {
    return this.post('/forge/wallet/purchase', { bundle_slug: slug });
  }

  getPurchaseHistory(limit = 20, offset = 0): Promise<ApiResponse<PaginatedResponse<TokenPurchase>>> {
    return this.get(`/forge/wallet/history?limit=${limit}&offset=${offset}`);
  }

  updateBYOK(data: {
    openrouter_key?: string;
    replicate_key?: string;
  }): Promise<ApiResponse<unknown>> {
    return this.put('/forge/wallet/keys', data);
  }

  // --- Feature Purchases ---

  listFeaturePurchases(
    simulationId: string, featureType?: string,
  ): Promise<ApiResponse<FeaturePurchase[]>> {
    const params = featureType ? `?feature_type=${featureType}` : '';
    return this.get(`/forge/simulations/${simulationId}/features${params}`);
  }

  purchaseDarkroom(simulationId: string): Promise<ApiResponse<{ purchase_id: string; regen_budget: number }>> {
    return this.post(`/forge/simulations/${simulationId}/darkroom`);
  }

  darkroomRegen(
    simulationId: string, entityType: string, entityId: string,
    promptOverride?: string,
  ): Promise<ApiResponse<{ remaining_regenerations: number; entity_type: string; entity_id: string }>> {
    return this.post(
      `/forge/simulations/${simulationId}/darkroom/regenerate/${entityType}/${entityId}`,
      { prompt_override: promptOverride ?? null },
    );
  }

  purchaseDossier(simulationId: string): Promise<ApiResponse<{ purchase_id: string }>> {
    return this.post(`/forge/simulations/${simulationId}/dossier`);
  }

  purchaseRecruitment(
    simulationId: string, focus?: string, zoneId?: string,
  ): Promise<ApiResponse<{ purchase_id: string }>> {
    return this.post(`/forge/simulations/${simulationId}/recruit`, {
      focus: focus ?? null,
      zone_id: zoneId ?? null,
    });
  }

  purchaseChronicle(simulationId: string): Promise<ApiResponse<{ purchase_id: string }>> {
    return this.post(`/forge/simulations/${simulationId}/chronicle`);
  }

  getFeaturePurchase(purchaseId: string): Promise<ApiResponse<FeaturePurchase>> {
    return this.get(`/forge/features/${purchaseId}`);
  }

  // --- Access Requests (Clearance) ---

  requestAccess(message?: string): Promise<ApiResponse<ForgeAccessRequest>> {
    return this.post('/forge/access-requests', { message: message ?? null });
  }

  getMyAccessRequest(): Promise<ApiResponse<ForgeAccessRequest | null>> {
    return this.get('/forge/access-requests/me');
  }

  listPendingRequests(): Promise<ApiResponse<ForgeAccessRequestWithEmail[]>> {
    return this.get('/forge/access-requests/pending');
  }

  getPendingRequestCount(): Promise<ApiResponse<number>> {
    return this.get('/forge/access-requests/pending/count');
  }

  reviewRequest(id: string, action: 'approve' | 'reject', adminNotes?: string): Promise<ApiResponse<unknown>> {
    return this.post(`/forge/access-requests/${id}/review`, {
      action,
      admin_notes: adminNotes ?? null,
    });
  }

  // --- Admin Stats ---

  getAdminStats(): Promise<
    ApiResponse<{ active_drafts: number; total_tokens: number; total_materialized: number }>
  > {
    return this.get('/forge/admin/stats');
  }

  purgeStale(days = 30): Promise<ApiResponse<{ deleted_count: number }>> {
    return this.delete(`/forge/admin/purge?days=${days}`);
  }
}

export const forgeApi = new ForgeApiService();

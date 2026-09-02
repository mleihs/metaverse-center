import type {
  ApiResponse,
  ForgeAccessRequest,
  ForgeAccessRequestWithEmail,
  PaginatedResponse,
} from '../../types/index.js';
import { BaseApiService } from './BaseApiService.js';
import type { QueryParams } from './query-params';

export interface PhilosophicalAnchor {
  title: string;
  title_de?: string;
  literary_influence: string;
  literary_influence_de?: string;
  core_question: string;
  core_question_de?: string;
  bleed_signature_suggestion?: string;
  description: string;
  description_de?: string;
}

export interface ForgeAgentDraft {
  name: string;
  gender: string;
  system: string;
  primary_profession: string;
  primary_profession_de?: string;
  character: string;
  character_de?: string;
  background: string;
  background_de?: string;
}

export interface ForgeBuildingDraft {
  name: string;
  building_type: string;
  building_type_de?: string;
  description: string;
  description_de?: string;
  building_condition: string;
  building_condition_de?: string;
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
  slug: string;
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
  evolution_count?: number | null;
  evolved_at?: string | null;
  evolution_log?: Array<{
    trigger: string;
    entity: string;
    timestamp: string;
    words_added: number;
  }> | null;
}

export interface ForgeDraft {
  id: string;
  user_id: string;
  current_phase: 'astrolabe' | 'drafting' | 'darkroom' | 'ignition' | 'completed' | 'failed';
  seed_prompt: string;
  philosophical_anchor: {
    options: PhilosophicalAnchor[];
    selected?: PhilosophicalAnchor;
    /**
     * How often the Astrolabe has been read for this draft.
     *
     * Written by the server on every scan and capped there
     * (`MAX_ANCHOR_SCANS` in `forge_orchestrator_service.py`); the client only
     * reads it to show how many readings are left.
     */
    scans?: number;
    /** The seed those scans were spent on; a different one starts the budget over. */
    seed?: string;
  };
  taxonomies: Record<string, unknown>;
  geography: Record<string, unknown>;
  agents: ForgeAgentDraft[];
  buildings: ForgeBuildingDraft[];
  ai_settings: Record<string, unknown>;
  research_context: {
    raw_data?: string;
    source?: 'tavily' | 'emulator';
    /**
     * The rows the web search actually returned — title and URL, deduplicated,
     * with no model in between. They do NOT verify a citation; they say what
     * was read, which is what the card's footer claims. Absent on drafts made
     * before finding 17 and empty on the emulator path. Never ask a model for
     * these: a fabricated URL carries more authority than a fabricated title.
     */
    sources?: { axis: string; title: string; url: string }[];
  };
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

/** One entity whose image did not come back, for the shortfall panel. */
export interface FailedImageEntity {
  entity_type: string;
  entity_name: string;
  entity_id: string;
  /** Raw model/provider error. English, unlocalised — never render it plainly. */
  error: string;
}

export interface LorePhaseProgress {
  /**
   * `images_incomplete` is a RESTING state, not a step: the batch finished and
   * some images did not come back. Before it existed, `lore_progress` was set to
   * NULL at the end of every run, and `get_forge_progress` computes `done` as
   * `completed >= total` — so a partial run left the bar at 15/16 forever,
   * without a word and without anything to press.
   */
  phase: 'research' | 'generating' | 'translating' | 'entities' | 'images' | 'images_incomplete';
  current?: number;
  total?: number;
  section_title?: string;
  /** `images_incomplete` only: how many of `total` have no image. */
  failed?: number;
  /** `images_incomplete` only: which ones. */
  entities?: FailedImageEntity[];
}

/** Result of asking the Bureau to redraw only what is missing. */
export interface MissingImagesResponse {
  queued: number;
  message: string;
}

export interface ForgeProgress {
  total: number;
  completed: number;
  done: boolean;
  banner_url: string | null;
  agents: ForgeProgressEntity[];
  buildings: ForgeProgressEntity[];
  lore: ForgeProgressEntity[];
  lore_progress: LorePhaseProgress | null;
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
  /**
   * When the STORED key last went through at the provider (migration 333).
   * `null` means never checked, not invalid – "configured" says nothing about
   * whether a key still works, and a key revoked at OpenRouter three weeks ago
   * looked identical to a working one.
   */
  openrouter_verified_at: string | null;
  replicate_verified_at: string | null;
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

export interface TestBYOKResult {
  valid: boolean;
  detail: string;
  response_ms: number;
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
  listDrafts(params?: QueryParams): Promise<ApiResponse<PaginatedResponse<ForgeDraft>>> {
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

  generateEntity(
    id: string,
    entityType: 'agents' | 'buildings',
    entityIndex: number,
    entityTotal: number,
  ): Promise<ApiResponse<ForgeAgentDraft | ForgeBuildingDraft>> {
    return this.post(
      `/forge/drafts/${id}/generate-entity/${entityType}?entity_index=${entityIndex}&entity_total=${entityTotal}`,
    );
  }

  generateTheme(id: string): Promise<ApiResponse<Record<string, string>>> {
    return this.post(`/forge/drafts/${id}/generate-theme`);
  }

  ignite(id: string): Promise<
    ApiResponse<{
      simulation_id: string;
      slug: string | null;
      name?: string;
      // Empty for a world whose anchor carried no German title; `t()` then
      // falls back to `name`. Before migration 287 nothing wrote this at all
      // and every world was named in English in every language (finding 16).
      name_de?: string;
      description?: string;
      description_de?: string;
    }>
  > {
    return this.post(`/forge/drafts/${id}/ignite`);
  }

  getSimulationLore(simulationId: string): Promise<ApiResponse<ForgeLoreSection[]>> {
    return this.getPublic(`/simulations/${simulationId}/lore`);
  }

  getForgeProgress(slug: string): Promise<ApiResponse<ForgeProgress>> {
    return this.getPublic(`/simulations/by-slug/${slug}/forge-progress`);
  }

  /**
   * Redraw ONLY the entities that have no image.
   *
   * Free, and deliberately narrow: after a partial run one image of sixteen is
   * typically missing, and regenerating the set would spend fifteen to repair
   * one. Calling it with nothing missing is a no-op that returns `queued: 0`.
   */
  generateMissingImages(simulationId: string): Promise<ApiResponse<MissingImagesResponse>> {
    return this.post(`/forge/simulations/${simulationId}/generate-missing-images`);
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

  /**
   * Backend returns `PaginatedResponse[TokenPurchaseHistory]`; after
   * BaseApiService unwraps the envelope, `resp.data` is the `TokenPurchase[]`
   * array directly (not a re-wrapped `PaginatedResponse<T>`). `resp.meta`
   * carries the pagination metadata via the `ApiResponse<T>` shape.
   */
  getPurchaseHistory(limit = 20, offset = 0): Promise<ApiResponse<TokenPurchase[]>> {
    return this.get(`/forge/wallet/history?limit=${limit}&offset=${offset}`);
  }

  updateBYOK(data: {
    openrouter_key?: string;
    replicate_key?: string;
  }): Promise<ApiResponse<unknown>> {
    return this.put('/forge/wallet/keys', data);
  }

  deleteBYOK(provider: 'openrouter' | 'replicate'): Promise<ApiResponse<unknown>> {
    return this.delete(`/forge/wallet/keys/${provider}`);
  }

  testBYOK(
    provider: 'openrouter' | 'replicate',
    key: string,
  ): Promise<ApiResponse<TestBYOKResult>> {
    return this.post('/forge/wallet/keys/test', { provider, key });
  }

  // --- Feature Purchases ---

  listFeaturePurchases(
    simulationId: string,
    featureType?: string,
  ): Promise<ApiResponse<FeaturePurchase[]>> {
    const params = featureType ? `?feature_type=${featureType}` : '';
    return this.get(`/forge/simulations/${simulationId}/features${params}`);
  }

  purchaseDarkroom(
    simulationId: string,
  ): Promise<ApiResponse<{ purchase_id: string; regen_budget: number }>> {
    return this.post(`/forge/simulations/${simulationId}/darkroom`);
  }

  darkroomRegen(
    simulationId: string,
    entityType: string,
    entityId: string,
    promptOverride?: string,
  ): Promise<
    ApiResponse<{ remaining_regenerations: number; entity_type: string; entity_id: string }>
  > {
    return this.post(
      `/forge/simulations/${simulationId}/darkroom/regenerate/${entityType}/${entityId}`,
      { prompt_override: promptOverride ?? null },
    );
  }

  purchaseDossier(simulationId: string): Promise<ApiResponse<{ purchase_id: string }>> {
    return this.post(`/forge/simulations/${simulationId}/dossier`);
  }

  purchaseRecruitment(
    simulationId: string,
    focus?: string,
    zoneId?: string,
  ): Promise<ApiResponse<{ purchase_id: string }>> {
    return this.post(`/forge/simulations/${simulationId}/recruit`, {
      focus: focus ?? null,
      zone_id: zoneId ?? null,
    });
  }

  purchaseChronicle(simulationId: string): Promise<ApiResponse<{ purchase_id: string }>> {
    return this.post(`/forge/simulations/${simulationId}/chronicle`);
  }

  purchaseHiresArchive(simulationId: string): Promise<ApiResponse<{ purchase_id: string }>> {
    return this.post(`/forge/simulations/${simulationId}/chronicle/hires`);
  }

  getFeaturePurchase(purchaseId: string): Promise<ApiResponse<FeaturePurchase>> {
    return this.get(`/forge/features/${purchaseId}`);
  }

  // --- Dossier Evolution ---

  evolveDossier(
    simulationId: string,
    arcanum: string,
    trigger: string,
    entityName: string,
    entityDetail?: string,
  ): Promise<ApiResponse<{ status: string; arcanum: string }>> {
    const params = new URLSearchParams({
      arcanum,
      trigger,
      entity_name: entityName,
    });
    if (entityDetail) params.set('entity_detail', entityDetail);
    return this.post(`/forge/simulations/${simulationId}/dossier/evolve?${params.toString()}`);
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

  reviewRequest(
    id: string,
    action: 'approve' | 'reject',
    adminNotes?: string,
  ): Promise<ApiResponse<unknown>> {
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

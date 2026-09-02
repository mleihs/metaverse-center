import type { ApiResponse } from '../../types/index.js';
import { BaseApiService } from './BaseApiService.js';
import type { QueryParams } from './query-params';

export interface ScannerDashboard {
  config: {
    enabled: boolean;
    interval: number;
    auto_create: boolean;
    min_magnitude: number;
    impacts_delay_hours: number;
  };
  adapters: AdapterInfo[];
  metrics: ScannerMetrics;
}

export interface AdapterInfo {
  name: string;
  display_name: string;
  categories: string[];
  is_structured: boolean;
  requires_api_key: boolean;
  api_key_setting: string | null;
  default_interval: number;
  enabled: boolean;
  available: boolean;
}

export interface ScannerMetrics {
  scanned_today: number;
  classified_today: number;
  resonances_today: number;
  pending_candidates: number;
  last_scan: string | null;
}

export interface ScanCandidate {
  id: string;
  source_category: string;
  title: string;
  description: string | null;
  bureau_dispatch: string | null;
  article_url: string | null;
  article_platform: string | null;
  article_raw_data: Record<string, unknown> | null;
  magnitude: number;
  classification_reason: string | null;
  source_adapter: string;
  /** Mit `source_adapter` der Schlüssel zum Scan-Protokoll (Migration 343). */
  source_id: string | null;
  /**
   * Die Quellen, die dieselbe Geschichte gemeldet haben (Migration 345).
   * Enthält immer auch den Träger selbst.
   */
  sources: Array<{ name: string; count: number }>;
  /**
   * Likes + Reposts der beitragenden Sozialquellen.
   *
   * ⚠ `0` heisst „keine gemessen", NICHT „niemand hat reagiert". Heute liefert
   * nur Bluesky solche Zahlen, und es trägt nur zu Geschichten bei, die eine
   * Nachrichtenquelle schon gemeldet hat.
   */
  social_volume: number;
  is_structured: boolean;
  status: string;
  resonance_id: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by_id: string | null;
  /** Nur bei `status: 'flagged'` gesetzt (Migration 334). */
  flag_reason: string | null;
  flagged_by_simulation_id: string | null;
}

/**
 * Was eine Resonanz in EINER Welt anrichten wuerde — vor dem Ausloesen.
 *
 * `effective_magnitude` ist eine OBERGRENZE: Attunement-Tiefe und
 * Anker-Schutz werden erst im Lauf je Welt gelesen und koennen den Wert nur
 * senken. `will_skip` ist entsprechend die vorsichtige Antwort — eine Welt,
 * die hier als getroffen steht, kann im Lauf noch uebersprungen werden, nie
 * umgekehrt. Die Zahl kommt aus derselben Funktion, die der Lauf benutzt
 * (`ResonanceService.susceptibility_of`).
 */
export interface SusceptibilityRow {
  simulation_id: string;
  simulation_name: string;
  simulation_slug: string | null;
  susceptibility: number;
  effective_magnitude: number;
  will_skip: boolean;
}

export interface ScanLogEntry {
  id: string;
  source_id: string;
  source_name: string;
  title: string;
  url: string | null;
  scanned_at: string;
  classified: boolean;
  source_category: string | null;
  magnitude: number | null;
  /**
   * Was aus dieser Zeile geworden ist — der Status des Kandidaten, den sie
   * erzeugt hat (`pending` · `approved` · `rejected` · `flagged`).
   *
   * `null` heisst: sie wurde nie einer. Das gilt für alles, was die
   * Vorfilterung aussortiert hat, und für die Zeilen von vor Migration 343,
   * die sich nicht eindeutig zuordnen liessen. Der Unterschied zwischen
   * „aussortiert" und „nicht zuzuordnen" steht NICHT hier — er steht in der
   * Spalte `classified` daneben.
   */
  intake_status: string | null;
}

export interface ScanCandidateList {
  items: ScanCandidate[];
  meta: {
    count: number;
    total: number;
    limit: number;
    offset: number;
  };
  recommended_threshold: number;
}

export interface ScanCycleMetrics {
  adapters: Record<string, { status: string; fetched: number }>;
  total_fetched: number;
  total_classified: number;
  total_new: number;
  resonances_created: number;
  candidates_staged: number;
  llm_calls: number;
  started_at: string;
  finished_at?: string;
}

export class ScannerApiService extends BaseApiService {
  async getDashboard(): Promise<ApiResponse<ScannerDashboard>> {
    return this.get('/admin/news-scanner/dashboard');
  }

  async listAdapters(): Promise<ApiResponse<AdapterInfo[]>> {
    return this.get('/admin/news-scanner/adapters');
  }

  async toggleAdapter(name: string, enabled: boolean): Promise<ApiResponse<unknown>> {
    return this.patch(`/admin/news-scanner/adapters/${name}?enabled=${enabled}`);
  }

  async triggerScan(adapterNames?: string[]): Promise<ApiResponse<ScanCycleMetrics>> {
    return this.post(
      '/admin/news-scanner/trigger-scan',
      adapterNames ? { adapter_names: adapterNames } : {},
    );
  }

  async listCandidates(params?: QueryParams): Promise<ApiResponse<ScanCandidateList>> {
    return this.get('/admin/news-scanner/candidates', params);
  }

  /**
   * Vorschau: was das Ausloesen dieses Kandidaten in den Welten anrichten wuerde.
   *
   * Wird VOR dem Halte-Knopf geladen. Ohne sie stuende auf einem
   * unumkehrbaren Knopf eine geratene Folge, und das ist schlimmer als gar
   * keine — es traegt die Gestalt von Wissen.
   */
  async candidateSusceptibility(id: string): Promise<ApiResponse<SusceptibilityRow[]>> {
    return this.get(`/admin/news-scanner/candidates/${id}/susceptibility`);
  }

  async approveCandidate(id: string, delayHours = 4): Promise<ApiResponse<unknown>> {
    return this.post(`/admin/news-scanner/candidates/${id}/approve`, { delay_hours: delayHours });
  }

  async rejectCandidate(id: string): Promise<ApiResponse<unknown>> {
    return this.post(`/admin/news-scanner/candidates/${id}/reject`);
  }

  async updateCandidate(
    id: string,
    data: {
      title?: string;
      magnitude?: number;
      source_category?: string;
      bureau_dispatch?: string;
    },
  ): Promise<ApiResponse<ScanCandidate>> {
    return this.patch(`/admin/news-scanner/candidates/${id}`, data);
  }

  async getScanLog(params?: QueryParams): Promise<ApiResponse<ScanLogEntry[]>> {
    return this.get('/admin/news-scanner/scan-log', params);
  }
}

export const scannerApi = new ScannerApiService();

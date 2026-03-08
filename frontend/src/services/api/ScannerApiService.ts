import type { ApiResponse } from '../../types/index.js';
import { BaseApiService } from './BaseApiService.js';

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
  is_structured: boolean;
  status: string;
  resonance_id: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by_id: string | null;
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
    return this.post('/admin/news-scanner/trigger-scan', adapterNames ? { adapter_names: adapterNames } : {});
  }

  async listCandidates(params?: Record<string, string>): Promise<ApiResponse<ScanCandidate[]>> {
    return this.get('/admin/news-scanner/candidates', params);
  }

  async approveCandidate(id: string, delayHours = 4): Promise<ApiResponse<unknown>> {
    return this.post(`/admin/news-scanner/candidates/${id}/approve`, { delay_hours: delayHours });
  }

  async rejectCandidate(id: string): Promise<ApiResponse<unknown>> {
    return this.post(`/admin/news-scanner/candidates/${id}/reject`);
  }

  async updateCandidate(
    id: string,
    data: { title?: string; magnitude?: number; source_category?: string; bureau_dispatch?: string },
  ): Promise<ApiResponse<ScanCandidate>> {
    return this.patch(`/admin/news-scanner/candidates/${id}`, data);
  }

  async getScanLog(params?: Record<string, string>): Promise<ApiResponse<ScanLogEntry[]>> {
    return this.get('/admin/news-scanner/scan-log', params);
  }
}

export const scannerApi = new ScannerApiService();

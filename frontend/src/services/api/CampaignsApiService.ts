import type {
  ApiResponse,
  Campaign,
  CampaignEvent,
  CampaignMetric,
  PaginatedResponse,
} from '../../types/index.js';
import { appState } from '../AppStateManager.js';
import { BaseApiService } from './BaseApiService.js';

export class CampaignsApiService extends BaseApiService {
  list(
    simulationId: string,
    params?: Record<string, string>,
  ): Promise<ApiResponse<PaginatedResponse<Campaign>>> {
    if (!appState.isAuthenticated.value) {
      return this.getPublic(`/simulations/${simulationId}/campaigns`, params);
    }
    return this.get(`/simulations/${simulationId}/campaigns`, params);
  }

  getById(simulationId: string, campaignId: string): Promise<ApiResponse<Campaign>> {
    return this.get(`/simulations/${simulationId}/campaigns/${campaignId}`);
  }

  create(simulationId: string, data: Partial<Campaign>): Promise<ApiResponse<Campaign>> {
    return this.post(`/simulations/${simulationId}/campaigns`, data);
  }

  update(
    simulationId: string,
    campaignId: string,
    data: Partial<Campaign>,
  ): Promise<ApiResponse<Campaign>> {
    return this.put(`/simulations/${simulationId}/campaigns/${campaignId}`, data);
  }

  remove(simulationId: string, campaignId: string): Promise<ApiResponse<Campaign>> {
    return this.delete(`/simulations/${simulationId}/campaigns/${campaignId}`);
  }

  getEvents(simulationId: string, campaignId: string): Promise<ApiResponse<CampaignEvent[]>> {
    return this.get(`/simulations/${simulationId}/campaigns/${campaignId}/events`);
  }

  addEvent(
    simulationId: string,
    campaignId: string,
    data: Partial<CampaignEvent>,
  ): Promise<ApiResponse<CampaignEvent>> {
    return this.post(`/simulations/${simulationId}/campaigns/${campaignId}/events`, data);
  }

  getMetrics(simulationId: string, campaignId: string): Promise<ApiResponse<CampaignMetric[]>> {
    return this.get(`/simulations/${simulationId}/campaigns/${campaignId}/metrics`);
  }
}

export const campaignsApi = new CampaignsApiService();

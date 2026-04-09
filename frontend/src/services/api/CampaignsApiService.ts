import type {
  ApiResponse,
  Campaign,
  CampaignAnalytics,
  CampaignEvent,
  CampaignMetric,
} from '../../types/index.js';
import { CrudApiService } from './CrudApiService.js';

export class CampaignsApiService extends CrudApiService<Campaign> {
  protected readonly resource = 'campaigns';

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

  getAnalytics(simulationId: string, campaignId: string): Promise<ApiResponse<CampaignAnalytics>> {
    return this.getSimulationData(`/simulations/${simulationId}/campaigns/${campaignId}/analytics`);
  }
}

export const campaignsApi = new CampaignsApiService();

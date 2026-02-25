import type {
  ApiResponse,
  PaginatedResponse,
  Event as SimEvent,
  SocialTrend,
} from '../../types/index.js';
import { appState } from '../AppStateManager.js';
import { BaseApiService } from './BaseApiService.js';

export interface BrowseArticle {
  name: string;
  platform: string;
  url?: string;
  raw_data?: Record<string, unknown>;
}

export class SocialTrendsApiService extends BaseApiService {
  list(
    simulationId: string,
    params?: Record<string, string>,
  ): Promise<ApiResponse<PaginatedResponse<SocialTrend>>> {
    if (!appState.isAuthenticated.value) {
      return this.getPublic(`/simulations/${simulationId}/social-trends`, params);
    }
    return this.get(`/simulations/${simulationId}/social-trends`, params);
  }

  fetch(
    simulationId: string,
    data: { source: string; query: string; limit?: number },
  ): Promise<ApiResponse<SocialTrend[]>> {
    return this.post(`/simulations/${simulationId}/social-trends/fetch`, data);
  }

  transform(
    simulationId: string,
    data: { trend_id: string },
  ): Promise<
    ApiResponse<{
      trend_id: string;
      original_title: string;
      transformation: {
        content: string;
        model_used: string;
        template_source: string;
        locale: string;
      };
    }>
  > {
    return this.post(`/simulations/${simulationId}/social-trends/transform`, data);
  }

  integrate(
    simulationId: string,
    data: {
      trend_id: string;
      title: string;
      description?: string;
      event_type?: string;
      impact_level?: number;
      tags?: string[];
    },
  ): Promise<ApiResponse<SimEvent>> {
    return this.post(`/simulations/${simulationId}/social-trends/integrate`, data);
  }

  workflow(
    simulationId: string,
    data: { source: string; query: string; limit?: number },
  ): Promise<ApiResponse<Record<string, unknown>>> {
    return this.post(`/simulations/${simulationId}/social-trends/workflow`, data);
  }

  // --- Browse workflow (ephemeral, no DB storage) ---

  browse(
    simulationId: string,
    data: { source?: string; query?: string; section?: string; limit?: number },
  ): Promise<ApiResponse<BrowseArticle[]>> {
    return this.post(`/simulations/${simulationId}/social-trends/browse`, data);
  }

  transformArticle(
    simulationId: string,
    data: {
      article_name: string;
      article_platform: string;
      article_url?: string;
      article_raw_data?: Record<string, unknown>;
    },
  ): Promise<
    ApiResponse<{
      original_title: string;
      transformation: {
        content?: string;
        narrative?: string;
        title?: string;
        description?: string;
        event_type?: string;
        impact_level?: number;
        model_used?: string;
      };
    }>
  > {
    return this.post(`/simulations/${simulationId}/social-trends/transform-article`, data);
  }

  integrateArticle(
    simulationId: string,
    data: {
      title: string;
      description?: string;
      event_type?: string;
      impact_level?: number;
      tags?: string[];
      generate_reactions?: boolean;
      max_reaction_agents?: number;
      source_article?: Record<string, unknown>;
    },
  ): Promise<ApiResponse<{ event: SimEvent; reactions_count: number; reactions: unknown[] }>> {
    return this.post(`/simulations/${simulationId}/social-trends/integrate-article`, data);
  }
}

export const socialTrendsApi = new SocialTrendsApiService();

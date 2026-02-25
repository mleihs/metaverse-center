import type {
  ApiResponse,
  PaginatedResponse,
  SocialMediaAgentReaction,
  SocialMediaComment,
  SocialMediaPost,
} from '../../types/index.js';
import { appState } from '../AppStateManager.js';
import { BaseApiService } from './BaseApiService.js';

export class SocialMediaApiService extends BaseApiService {
  listPosts(
    simulationId: string,
    params?: Record<string, string>,
  ): Promise<ApiResponse<PaginatedResponse<SocialMediaPost>>> {
    if (!appState.isAuthenticated.value) {
      return this.getPublic(`/simulations/${simulationId}/social-media`, params);
    }
    return this.get(`/simulations/${simulationId}/social-media/posts`, params);
  }

  syncPosts(simulationId: string): Promise<ApiResponse<Record<string, unknown>>> {
    return this.post(`/simulations/${simulationId}/social-media/sync`);
  }

  transformPost(
    simulationId: string,
    postId: string,
    data: { transformation_type?: string },
  ): Promise<ApiResponse<SocialMediaPost>> {
    return this.post(`/simulations/${simulationId}/social-media/posts/${postId}/transform`, data);
  }

  analyzeSentiment(
    simulationId: string,
    postId: string,
    data?: { detail_level?: string },
  ): Promise<ApiResponse<SocialMediaPost>> {
    return this.post(
      `/simulations/${simulationId}/social-media/posts/${postId}/analyze-sentiment`,
      data ?? {},
    );
  }

  generateReactions(
    simulationId: string,
    postId: string,
    data?: { agent_ids?: string[]; max_agents?: number },
  ): Promise<ApiResponse<SocialMediaAgentReaction[]>> {
    return this.post(
      `/simulations/${simulationId}/social-media/posts/${postId}/generate-reactions`,
      data ?? {},
    );
  }

  getComments(simulationId: string, postId: string): Promise<ApiResponse<SocialMediaComment[]>> {
    return this.get(`/simulations/${simulationId}/social-media/posts/${postId}/comments`);
  }
}

export const socialMediaApi = new SocialMediaApiService();

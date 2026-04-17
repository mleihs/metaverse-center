import type {
  ApiResponse,
  SocialMediaAgentReaction,
  SocialMediaComment,
  SocialMediaPost,
} from '../../types/index.js';
import { BaseApiService } from './BaseApiService.js';

export class SocialMediaApiService extends BaseApiService {
  /**
   * List social-media posts for a simulation.
   *
   * Note: the public and member routes use DIFFERENT paths — public serves
   * `/simulations/{id}/social-media` while member serves
   * `/simulations/{id}/social-media/posts`. This is an intentional
   * backend split (public returns curated subset; member returns full
   * post stream including drafts), so the routing cannot go through
   * `getSimulationData` (which assumes same path for both modes).
   */
  listPosts(
    simulationId: string,
    mode: 'public' | 'member',
    params?: Record<string, string>,
  ): Promise<ApiResponse<SocialMediaPost[]>> {
    return mode === 'public'
      ? this.getPublic(`/simulations/${simulationId}/social-media`, params)
      : this.get(`/simulations/${simulationId}/social-media/posts`, params);
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

import type { ApiResponse, StyleReferenceInfo } from '../../types/index.js';
import { BaseApiService } from './BaseApiService.js';

interface StyleReferenceUploadResponse {
  url: string;
  scope: 'global' | 'entity';
  entity_type: 'portrait' | 'building';
  entity_id?: string;
}

export class StyleReferenceApiService extends BaseApiService {
  /**
   * Upload a style reference image (file or URL).
   * Uses multipart/form-data — no Content-Type header (browser sets boundary).
   */
  async upload(
    simulationId: string,
    file?: File,
    imageUrl?: string,
    entityType: string = 'portrait',
    scope: string = 'global',
    entityId?: string,
    strength: number = 0.75,
  ): Promise<ApiResponse<StyleReferenceUploadResponse>> {
    const formData = new FormData();
    formData.append('entity_type', entityType);
    formData.append('scope', scope);
    formData.append('strength', String(strength));
    if (file) formData.append('file', file);
    if (imageUrl) formData.append('image_url', imageUrl);
    if (entityId) formData.append('entity_id', entityId);

    return this.postFormData<StyleReferenceUploadResponse>(
      `/simulations/${simulationId}/style-references/upload`,
      formData,
    );
  }

  /** List all configured references for an entity type. */
  async list(
    simulationId: string,
    entityType: string,
  ): Promise<ApiResponse<StyleReferenceInfo[]>> {
    return this.get<StyleReferenceInfo[]>(
      `/simulations/${simulationId}/style-references/${entityType}`,
    );
  }

  /** Remove a style reference. */
  async remove(
    simulationId: string,
    entityType: string,
    scope: string = 'global',
    entityId?: string,
  ): Promise<ApiResponse<{ deleted: boolean }>> {
    const params: Record<string, string> = { scope };
    if (entityId) params.entity_id = entityId;
    return this.delete<{ deleted: boolean }>(
      `/simulations/${simulationId}/style-references/${entityType}`,
      params,
    );
  }
}

export const styleReferenceApi = new StyleReferenceApiService();

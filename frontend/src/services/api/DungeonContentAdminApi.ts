import type { ApiResponse } from '../../types/index.js';
import { BaseApiService } from './BaseApiService.js';

export type DungeonContentType =
  | 'banter'
  | 'enemies'
  | 'spawns'
  | 'encounters'
  | 'choices'
  | 'loot'
  | 'anchors'
  | 'entrance_texts'
  | 'barometer_texts'
  | 'abilities';

export interface ContentListResponse {
  data: Record<string, unknown>[];
  meta: {
    count: number;
    total: number;
    limit: number;
    offset: number;
  };
}

export class DungeonContentAdminApi extends BaseApiService {
  private base = '/admin/dungeon-content';

  async listContent(
    contentType: DungeonContentType,
    params?: { archetype?: string; search?: string; page?: number; per_page?: number },
  ): Promise<ApiResponse<ContentListResponse>> {
    const query: Record<string, string> = {};
    if (params?.archetype) query.archetype = params.archetype;
    if (params?.search) query.search = params.search;
    if (params?.page) query.page = String(params.page);
    if (params?.per_page) query.per_page = String(params.per_page);
    return this.get(`${this.base}/${contentType}`, query);
  }

  async getItem(
    contentType: DungeonContentType,
    itemId: string,
  ): Promise<ApiResponse<Record<string, unknown>>> {
    return this.get(`${this.base}/${contentType}/${encodeURIComponent(itemId)}`);
  }

  async updateItem(
    contentType: DungeonContentType,
    itemId: string,
    data: Record<string, unknown>,
  ): Promise<ApiResponse<Record<string, unknown>>> {
    return this.put(`${this.base}/${contentType}/${encodeURIComponent(itemId)}`, { data });
  }

  async createItem(
    contentType: DungeonContentType,
    data: Record<string, unknown>,
  ): Promise<ApiResponse<Record<string, unknown>>> {
    return this.post(`${this.base}/${contentType}`, { data });
  }

  async deleteItem(
    contentType: DungeonContentType,
    itemId: string,
  ): Promise<ApiResponse<{ deleted: boolean; id: string }>> {
    return this.delete(`${this.base}/${contentType}/${encodeURIComponent(itemId)}`);
  }

  async reloadCache(): Promise<ApiResponse<{ reloaded: boolean }>> {
    return this.post(`${this.base}/reload-cache`, {});
  }
}

export const dungeonContentApi = new DungeonContentAdminApi();

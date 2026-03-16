import type { ApiResponse } from '../../types/index.js';
import { BaseApiService } from './BaseApiService.js';
import type { ForgeLoreSection } from './ForgeApiService.js';

export interface LoreSectionCreatePayload {
  chapter: string;
  arcanum: string;
  title: string;
  epigraph?: string;
  body: string;
  image_slug?: string | null;
  image_caption?: string | null;
}

export type LoreSectionUpdatePayload = Partial<LoreSectionCreatePayload>;

export class LoreApiService extends BaseApiService {
  createSection(
    simulationId: string,
    data: LoreSectionCreatePayload,
  ): Promise<ApiResponse<ForgeLoreSection>> {
    return this.post(`/simulations/${simulationId}/lore`, data);
  }

  updateSection(
    simulationId: string,
    sectionId: string,
    data: LoreSectionUpdatePayload,
  ): Promise<ApiResponse<ForgeLoreSection>> {
    return this.patch(`/simulations/${simulationId}/lore/${sectionId}`, data);
  }

  deleteSection(simulationId: string, sectionId: string): Promise<ApiResponse<ForgeLoreSection>> {
    return this.delete(`/simulations/${simulationId}/lore/${sectionId}`);
  }

  reorderSections(
    simulationId: string,
    sectionIds: string[],
  ): Promise<ApiResponse<ForgeLoreSection[]>> {
    return this.put(`/simulations/${simulationId}/lore`, { section_ids: sectionIds });
  }
}

export const loreApi = new LoreApiService();

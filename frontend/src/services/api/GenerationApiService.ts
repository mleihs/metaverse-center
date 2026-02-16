import type { ApiResponse } from '../../types/index.js';
import { BaseApiService } from './BaseApiService.js';

export interface GenerateAgentRequest {
  name: string;
  system: string;
  gender: string;
  locale: string;
}

export interface GenerateBuildingRequest {
  building_type: string;
  name?: string;
  locale: string;
}

export interface GeneratePortraitDescriptionRequest {
  agent_id: string;
  agent_name: string;
  agent_data?: Record<string, unknown>;
}

export interface GenerateEventRequest {
  event_type: string;
  locale: string;
}

export interface GenerateImageRequest {
  entity_type: string;
  entity_id: string;
  entity_name: string;
  extra?: Record<string, unknown>;
}

export class GenerationApiService extends BaseApiService {
  generateAgent(
    simulationId: string,
    data: GenerateAgentRequest,
  ): Promise<ApiResponse<Record<string, unknown>>> {
    return this.post(`/simulations/${simulationId}/generate/agent`, data);
  }

  generateBuilding(
    simulationId: string,
    data: GenerateBuildingRequest,
  ): Promise<ApiResponse<Record<string, unknown>>> {
    return this.post(`/simulations/${simulationId}/generate/building`, data);
  }

  generatePortraitDescription(
    simulationId: string,
    data: GeneratePortraitDescriptionRequest,
  ): Promise<ApiResponse<Record<string, unknown>>> {
    return this.post(`/simulations/${simulationId}/generate/portrait-description`, data);
  }

  generateEvent(
    simulationId: string,
    data: GenerateEventRequest,
  ): Promise<ApiResponse<Record<string, unknown>>> {
    return this.post(`/simulations/${simulationId}/generate/event`, data);
  }

  generateImage(
    simulationId: string,
    data: GenerateImageRequest,
  ): Promise<ApiResponse<Record<string, unknown>>> {
    return this.post(`/simulations/${simulationId}/generate/image`, data);
  }
}

export const generationApi = new GenerationApiService();

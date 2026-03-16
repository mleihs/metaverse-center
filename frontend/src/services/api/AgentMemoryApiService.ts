import type { AgentMemory, ApiResponse } from '../../types/index.js';
import { BaseApiService } from './BaseApiService.js';

export class AgentMemoryApiService extends BaseApiService {
  list(
    simulationId: string,
    agentId: string,
    params?: { memory_type?: string; limit?: number; offset?: number },
  ): Promise<ApiResponse<AgentMemory[]>> {
    const p: Record<string, string> = {};
    if (params?.memory_type) p.memory_type = params.memory_type;
    if (params?.limit != null) p.limit = String(params.limit);
    if (params?.offset != null) p.offset = String(params.offset);
    return this.getSimulationData(`/simulations/${simulationId}/agents/${agentId}/memories`, p);
  }

  reflect(
    simulationId: string,
    agentId: string,
    data?: { locale?: string },
  ): Promise<ApiResponse<AgentMemory[]>> {
    return this.post(`/simulations/${simulationId}/agents/${agentId}/memories/reflect`, data);
  }
}

export const agentMemoryApi = new AgentMemoryApiService();

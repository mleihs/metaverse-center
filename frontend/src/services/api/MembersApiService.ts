import type { ApiResponse, SimulationMember, SimulationRole } from '../../types/index.js';
import { BaseApiService } from './BaseApiService.js';

export class MembersApiService extends BaseApiService {
  list(simulationId: string): Promise<ApiResponse<SimulationMember[]>> {
    return this.get(`/simulations/${simulationId}/members`);
  }

  add(
    simulationId: string,
    data: { user_id: string; member_role: SimulationRole },
  ): Promise<ApiResponse<SimulationMember>> {
    return this.post(`/simulations/${simulationId}/members`, data);
  }

  changeRole(
    simulationId: string,
    memberId: string,
    data: { member_role: SimulationRole },
  ): Promise<ApiResponse<SimulationMember>> {
    return this.put(`/simulations/${simulationId}/members/${memberId}`, data);
  }

  remove(simulationId: string, memberId: string): Promise<ApiResponse<void>> {
    return this.delete(`/simulations/${simulationId}/members/${memberId}`);
  }
}

export const membersApi = new MembersApiService();

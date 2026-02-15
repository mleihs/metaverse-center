import type { ApiResponse, SettingCategory, SimulationSetting } from '../../types/index.js';
import { BaseApiService } from './BaseApiService.js';

export class SettingsApiService extends BaseApiService {
  list(
    simulationId: string,
    category?: SettingCategory,
  ): Promise<ApiResponse<SimulationSetting[]>> {
    const params = category ? { category } : undefined;
    return this.get(`/simulations/${simulationId}/settings`, params);
  }

  getByCategory(
    simulationId: string,
    category: SettingCategory,
  ): Promise<ApiResponse<SimulationSetting[]>> {
    return this.get(`/simulations/${simulationId}/settings`, { category });
  }

  getById(simulationId: string, settingId: string): Promise<ApiResponse<SimulationSetting>> {
    return this.get(`/simulations/${simulationId}/settings/${settingId}`);
  }

  upsert(
    simulationId: string,
    data: Partial<SimulationSetting>,
  ): Promise<ApiResponse<SimulationSetting>> {
    return this.post(`/simulations/${simulationId}/settings`, data);
  }

  remove(simulationId: string, settingId: string): Promise<ApiResponse<void>> {
    return this.delete(`/simulations/${simulationId}/settings/${settingId}`);
  }
}

export const settingsApi = new SettingsApiService();

import type { ApiResponse, SettingCategory, SimulationSetting } from '../../types/index.js';
import { BaseApiService } from './BaseApiService.js';

export class SettingsApiService extends BaseApiService {
  list(
    simulationId: string,
    category?: SettingCategory,
  ): Promise<ApiResponse<SimulationSetting[]>> {
    // Design, anchor, and features are publicly readable (anon RLS, migrations 020+187).
    // Always use public endpoint for these to avoid 403 for authenticated non-members.
    if (category === 'design' || category === 'features') {
      return this.getPublic(`/simulations/${simulationId}/settings`, category ? { category } : undefined);
    }
    return this.getSimulationData(
      `/simulations/${simulationId}/settings`,
      category ? { category } : undefined,
    );
  }

  getByCategory(
    simulationId: string,
    category: SettingCategory,
  ): Promise<ApiResponse<SimulationSetting[]>> {
    if (category === 'design') {
      return this.getPublic(`/simulations/${simulationId}/settings`);
    }
    return this.getSimulationData(`/simulations/${simulationId}/settings`, { category });
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

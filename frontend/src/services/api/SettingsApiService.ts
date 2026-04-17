import type { ApiResponse, SettingCategory, SimulationSetting } from '../../types/index.js';
import { BaseApiService } from './BaseApiService.js';

export class SettingsApiService extends BaseApiService {
  /**
   * List settings, optionally filtered by category.
   *
   * `mode` routes via `/api/v1/public/*` ('public') or `/api/v1/*` ('member').
   * Categories `'design'` and `'features'` are always readable via `anon` RLS
   * (migrations 020 + 187), so they short-circuit to the public endpoint
   * irrespective of caller mode — otherwise authenticated non-members would
   * receive 403 on member-scoped gated categories. See `docs/guides/design-tokens.md`.
   */
  list(
    simulationId: string,
    mode: 'public' | 'member',
    category?: SettingCategory,
  ): Promise<ApiResponse<SimulationSetting[]>> {
    if (category === 'design' || category === 'features') {
      return this.getPublic(
        `/simulations/${simulationId}/settings`,
        category ? { category } : undefined,
      );
    }
    return this.getSimulationData(
      `/simulations/${simulationId}/settings`,
      mode,
      category ? { category } : undefined,
    );
  }

  getByCategory(
    simulationId: string,
    category: SettingCategory,
    mode: 'public' | 'member',
  ): Promise<ApiResponse<SimulationSetting[]>> {
    if (category === 'design') {
      return this.getPublic(`/simulations/${simulationId}/settings`);
    }
    return this.getSimulationData(
      `/simulations/${simulationId}/settings`,
      mode,
      { category },
    );
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

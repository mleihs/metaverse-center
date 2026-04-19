import type { ApiResponse } from '../../types/index.js';
import { BaseApiService } from './BaseApiService.js';

export interface FirstContactPublic {
  enabled: boolean;
  version: string;
}

export interface AlphaStatePublic {
  first_contact: FirstContactPublic;
}

export class AlphaStateApiService extends BaseApiService {
  async getAlphaState(): Promise<ApiResponse<AlphaStatePublic>> {
    return this.getPublic<AlphaStatePublic>('/alpha-state');
  }
}

export const alphaStateApi = new AlphaStateApiService();

import { BaseApiService } from './BaseApiService.js';

export interface CipherRedemptionResult {
  success: boolean;
  error?: string;
  message?: string;
  redemption_id?: string;
  reward_type?: string;
  reward_data?: {
    type: string;
    source_type: string;
    source_id: string;
    simulation_id: string;
    snapshot: Record<string, unknown>;
  };
  attempts_remaining?: number;
  retry_after_seconds?: number;
}

export class BureauApiService extends BaseApiService {
  async redeemCipher(code: string) {
    return this.post<CipherRedemptionResult>('/public/bureau/dispatch', { code });
  }
}

export const bureauApi = new BureauApiService();

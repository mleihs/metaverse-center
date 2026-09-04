import type { ApiResponse } from '../../types/index.js';
import type { PlatformSkin } from '../theme-presets.js';
import { BaseApiService } from './BaseApiService.js';

export interface PlatformAppearancePublic {
  default_skin: PlatformSkin;
}

/**
 * Welche Ausgabe ein Besucher OHNE eigene Wahl bekommt.
 *
 * Oeffentlich, weil sie fuer einen Gast gilt — der hat kein Token, und die
 * Auskunft ist ein einziger Name. Wer im Editionsumschalter gewaehlt hat,
 * dessen Wahl liegt im Browser und schlaegt diese hier immer.
 */
export class PlatformAppearanceApiService extends BaseApiService {
  async getAppearance(): Promise<ApiResponse<PlatformAppearancePublic>> {
    return this.getPublic<PlatformAppearancePublic>('/appearance');
  }
}

export const platformAppearanceApi = new PlatformAppearanceApiService();

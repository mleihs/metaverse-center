import type { ApiResponse } from '../../types/index.js';
import { BaseApiService } from './BaseApiService.js';

/** Ein Signal, das ein Architekt dem Bureau vorgelegt hat. */
export interface FlaggedSignal {
  id: string;
  title: string;
  source_category: string;
  magnitude: number;
  status: string;
  flag_reason: string | null;
  flagged_by_simulation_id: string | null;
  created_at: string;
}

export interface FlagSignalRequest {
  title: string;
  source_category: string;
  magnitude: number;
  reason: string;
  description?: string;
  article_url?: string;
  article_platform?: string;
  article_raw_data?: Record<string, unknown>;
}

/**
 * Die Schleuse — der eine Weg, der eine Welt verlaesst.
 *
 * Alles andere an der Schleuse spricht ueber bestehende Dienste: der Zufluss
 * ueber `socialTrendsApi` (browse/transform/integrate), die Sensorlage und die
 * Kandidaten ueber `scannerApi` (nur Admin). Hier steht, was beiden fehlte.
 *
 * Kein `mode`-Parameter: Melden ist eine Schreiboperation und setzt
 * Mitgliedschaft voraus. Ein oeffentlicher Weg dafuer waere ein Loch.
 */
export class IntakeApiService extends BaseApiService {
  /**
   * Ein Signal dem Bureau vorlegen.
   *
   * Der Koerper traegt das Signal selbst mit, nicht nur eine Kennung: der
   * Architekt arbeitet mit gebrowsten Artikeln, und die haben keine Zeile in
   * der Datenbank. Das Melden IST das Behalten.
   */
  flag(simulationId: string, data: FlagSignalRequest): Promise<ApiResponse<FlaggedSignal>> {
    return this.post(`/simulations/${simulationId}/intake/flag`, data);
  }
}

export const intakeApi = new IntakeApiService();

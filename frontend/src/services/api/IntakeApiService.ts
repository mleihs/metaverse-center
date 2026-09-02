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
/**
 * Ein Abonnement der Schleuse: was ohne Nachfrage in den Eingang gehört.
 *
 * ⚠ Es verwandelt NICHTS. `zone_id` und `vector` sind die Linse, die ein Mensch
 * EINMAL entschieden hat — sie füllen später den Schmelztiegel vor, statt
 * heimlich ein Ereignis zu erzeugen. Ein Zeitgeber, der von selbst
 * Modellaufrufe auslöst, kostet Geld ohne Klick.
 */
export interface IntakeSubscription {
  id: string;
  simulation_id: string;
  label: string;
  source_category: string | null;
  min_magnitude: number;
  zone_id: string | null;
  vector: string | null;
  is_active: boolean;
  created_at: string;
}

export type IntakeSubscriptionInput = Omit<
  IntakeSubscription,
  'id' | 'simulation_id' | 'created_at'
>;

export class IntakeApiService extends BaseApiService {
  listSubscriptions(simulationId: string): Promise<ApiResponse<IntakeSubscription[]>> {
    return this.get(`/simulations/${simulationId}/intake/subscriptions`);
  }

  createSubscription(
    simulationId: string,
    data: IntakeSubscriptionInput,
  ): Promise<ApiResponse<IntakeSubscription>> {
    return this.post(`/simulations/${simulationId}/intake/subscriptions`, data);
  }

  updateSubscription(
    simulationId: string,
    id: string,
    data: IntakeSubscriptionInput,
  ): Promise<ApiResponse<IntakeSubscription>> {
    return this.patch(`/simulations/${simulationId}/intake/subscriptions/${id}`, data);
  }

  deleteSubscription(simulationId: string, id: string): Promise<ApiResponse<unknown>> {
    return this.delete(`/simulations/${simulationId}/intake/subscriptions/${id}`);
  }

  /**
   * Die Passung dieser Welt je Signatur (Lücke 3).
   *
   * ACHT Zeilen, nicht eine je Kandidat: die Passung hängt an (Welt, Signatur).
   * Zwei Unwetterwarnungen haben dieselbe — Passung sagt „wie sehr geht diese
   * ART von Sache diese Welt an", die Magnitude sagt „wie gross ist DIESE".
   *
   * Die Zahl ist NICHT erfunden: es ist die Suszeptibilität, mit der der
   * Resonanzlauf rechnet (`fn_get_adaptive_susceptibility`).
   */
  signatureFit(
    simulationId: string,
  ): Promise<ApiResponse<Array<{ signature: string; fit: number }>>> {
    return this.get(`/simulations/${simulationId}/intake/fit`);
  }

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

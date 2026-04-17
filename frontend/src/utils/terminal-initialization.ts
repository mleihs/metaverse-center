/**
 * Shared terminal zone initialization.
 *
 * Fetches zones, caches them in TerminalStateManager, and validates
 * the persisted zone ID against loaded zones. If the persisted zone
 * is stale (e.g. from a different game instance whose UUIDs differ
 * from the source template), resets to the first zone alphabetically.
 *
 * Used by: TerminalView, EpochTerminalView, DungeonTerminalView.
 *
 * @throws Error if no zones are found in the simulation.
 */

import { msg } from '@lit/localize';
import { appState } from '../services/AppStateManager.js';
import { locationsApi } from '../services/api/index.js';
import { terminalState } from '../services/TerminalStateManager.js';

export async function initializeTerminalZones(simulationId: string): Promise<void> {
  const zonesResp = await locationsApi.listZones(
    simulationId,
    appState.currentSimulationMode.value,
  );
  if (!zonesResp.success || !zonesResp.data || zonesResp.data.length === 0) {
    throw new Error(msg('No zones found in this simulation.'));
  }

  terminalState.cacheZones(zonesResp.data);

  // Always validate persisted zone against loaded zones.
  // Game instances have different UUIDs than their source template,
  // so a persisted zone ID from a template session won't match.
  const currentZone = terminalState.currentZoneId.value;
  const zoneIds = new Set(zonesResp.data.map((z) => z.id));
  if (!currentZone || !zoneIds.has(currentZone)) {
    const sorted = [...zonesResp.data].sort((a, b) => a.name.localeCompare(b.name));
    terminalState.setCurrentZone(sorted[0].id);
  }
}

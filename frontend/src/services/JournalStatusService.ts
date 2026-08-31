/**
 * JournalStatusService — Laufzeit-Tor des Resonanzjournals.
 *
 * Besitzt das eine reaktive Signal, das der Leerzustand befragt: `enabled`,
 * gelesen aus dem öffentlichen GET /api/v1/public/journal/state (kein JWT —
 * ob eine Mechanik läuft, ist keine persönliche Information).
 *
 * WARUM ES DIESEN DIENST GIBT (Befund G6): der Leerzustand versprach
 * „Fragmente sammeln sich, während du spielst". Gemessen auf Prod am
 * 31.08.2026: 0 Fragmente, 0 Konstellationen — und `journal_enabled` ist
 * überhaupt nicht gesetzt, der Erzeuger läuft also fail-closed nie. Ein
 * Leerzustand, der ein Versprechen gibt, das der Server nicht halten kann,
 * ist schlechter als einer, der schweigt: er lässt jemanden warten.
 *
 * Bewusst getrennt von `AppStateManager`, nach dem Vorbild von
 * `AlphaStatusService` und `DriftStatusService`: das Journal ist
 * phasengesteuert und muss als Einzeldatei abschaltbar bleiben.
 */

import { signal } from '@preact/signals-core';
import { journalApi } from './api/JournalApiService.js';
import { captureError } from './SentryService.js';

class JournalStatusService {
  /** journal_enabled — falsch, bis der öffentliche Zustand aufgelöst ist. */
  readonly enabled = signal<boolean>(false);

  private _loaded = false;

  /**
   * Einmal je Sitzung auflösen. Aus jedem `connectedCallback` sicher
   * aufrufbar; erneute Einhängungen nach dem ersten Erfolg sind wirkungslos.
   * Lehnt nie ab: der Fehlerpfad wird intern beobachtet, das Tor bleibt
   * fail-closed — der Leerzustand sagt dann die vorsichtigere Wahrheit.
   */
  async ensureLoaded(): Promise<void> {
    if (this._loaded) return;
    await this.refresh();
  }

  /** Erneut lesen, etwa nachdem ein Admin `journal_enabled` umgelegt hat. */
  async refresh(): Promise<void> {
    const result = await journalApi.getPublicState();
    if (!result.success || !result.data) {
      if (!result.success) {
        captureError(new Error(result.error?.message ?? 'journal-state fetch failed'), {
          source: 'JournalStatusService.refresh',
          code: result.error?.code ?? '',
        });
      }
      return;
    }
    this.enabled.value = result.data.enabled;
    this._loaded = true;
  }
}

export const journalStatus = new JournalStatusService();

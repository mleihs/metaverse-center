/**
 * AlphaStatusService -- Runtime state for the Velgarien alpha suite.
 *
 * Owns four reactive signals and the Bureau-Dispatch first-contact logic:
 *
 *   isAlphaBuild           Build-time flag (`VITE_IS_ALPHA === 'true'`).
 *   firstContactEnabled    Admin toggle, read from /api/v1/public/alpha-state.
 *   firstContactVersion    Bump-to-retrigger version string.
 *   firstContactAcked      LocalStorage-backed: user dismissed this version.
 *
 * Computed `shouldShowFirstContact` gates modal visibility:
 *   non-member AND enabled AND not acked-for-this-version.
 *
 * Kept separate from AppStateManager — alpha is orthogonal to identity/routing
 * and deletable at release-cut without touching core state.
 */

import { computed, signal } from '@preact/signals-core';
import { appState } from './AppStateManager.js';
import { alphaStateApi } from './api/AlphaStateApiService.js';
import { captureError } from './SentryService.js';

const ACK_STORAGE_KEY = 'velg.firstContact.ack';

/** Safely read localStorage, returning '' on any error (private mode, quota, etc.). */
function readAck(): string {
  try {
    return localStorage.getItem(ACK_STORAGE_KEY) ?? '';
  } catch (err) {
    captureError(err, { source: 'AlphaStatusService.readAck' });
    return '';
  }
}

function writeAck(version: string): void {
  try {
    localStorage.setItem(ACK_STORAGE_KEY, version);
  } catch (err) {
    captureError(err, { source: 'AlphaStatusService.writeAck' });
  }
}

class AlphaStatusService {
  readonly isAlphaBuild: boolean = import.meta.env.VITE_IS_ALPHA === 'true';
  readonly gitSha: string = import.meta.env.VITE_GIT_SHA || 'unknown';
  readonly buildDate: string = import.meta.env.VITE_BUILD_DATE || '';

  readonly firstContactEnabled = signal<boolean>(false);
  readonly firstContactVersion = signal<string>('');
  readonly firstContactAcked = signal<string>(readAck());
  readonly firstContactPreviewing = signal<boolean>(false);

  /** Non-member + modal enabled + user has not acked this specific version. */
  readonly shouldShowFirstContact = computed<boolean>(() => {
    if (!this.isAlphaBuild) return false;
    if (appState.isAuthenticated.value) return false;
    if (!this.firstContactEnabled.value) return false;
    const version = this.firstContactVersion.value;
    if (!version) return false;
    return this.firstContactAcked.value !== version;
  });

  /** Fetch latest alpha-state from the public endpoint. No-op when not in alpha build. */
  async refresh(): Promise<void> {
    if (!this.isAlphaBuild) return;
    const result = await alphaStateApi.getAlphaState();
    if (!result.success || !result.data) {
      if (!result.success) {
        captureError(new Error(result.error?.message ?? 'alpha-state fetch failed'), {
          source: 'AlphaStatusService.refresh',
          code: result.error?.code ?? '',
        });
      }
      return;
    }
    this.firstContactEnabled.value = result.data.first_contact.enabled;
    this.firstContactVersion.value = result.data.first_contact.version;
  }

  /** User dismissed the modal: persist version ack. */
  acknowledge(): void {
    const version = this.firstContactVersion.value;
    if (!version) return;
    writeAck(version);
    this.firstContactAcked.value = version;
  }

  /** Admin preview: opens the modal without writing localStorage. */
  openPreview(): void {
    this.firstContactPreviewing.value = true;
  }

  closePreview(): void {
    this.firstContactPreviewing.value = false;
  }
}

export const alphaStatus = new AlphaStatusService();

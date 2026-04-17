/**
 * Retry-aware dynamic import for route-level code splitting.
 *
 * Single retry handles the deploy race condition: after a new deployment,
 * the browser may hold a cached index.html referencing old chunk hashes.
 * The first import() fails; a retry fetches the correct chunk URL.
 */
import { msg } from '@lit/localize';

import { captureError } from '../services/SentryService.js';

export async function lazyRoute(factory: () => Promise<unknown>): Promise<boolean> {
  try {
    await factory();
    return true;
  } catch (firstErr) {
    // Expected deploy-race path: cached index.html references a stale chunk.
    // Retry once before surfacing any error — most users never hit this.
    captureError(firstErr, { source: 'lazy-route.first-try', kind: 'retry' });
    try {
      await factory();
      return true;
    } catch (retryErr) {
      // Both attempts failed — the chunk is genuinely unreachable. Tell the
      // user and give up.
      captureError(retryErr, { source: 'lazy-route.retry' });
      try {
        const { VelgToast } = await import('../components/shared/Toast.js');
        VelgToast.error(msg('Failed to load page. Please refresh.'));
      } catch (toastErr) {
        // Toast import also failed — terminal network failure. Sentry may
        // already be unreachable, but captureError itself swallows send
        // errors so this is safe.
        captureError(toastErr, { source: 'lazy-route.toast-import' });
      }
      return false;
    }
  }
}

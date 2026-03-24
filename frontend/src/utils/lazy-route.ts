/**
 * Retry-aware dynamic import for route-level code splitting.
 *
 * Single retry handles the deploy race condition: after a new deployment,
 * the browser may hold a cached index.html referencing old chunk hashes.
 * The first import() fails; a retry fetches the correct chunk URL.
 */
import { msg } from '@lit/localize';

export async function lazyRoute(factory: () => Promise<unknown>): Promise<boolean> {
  try {
    await factory();
    return true;
  } catch {
    try {
      await factory();
      return true;
    } catch {
      try {
        const { VelgToast } = await import('../components/shared/Toast.js');
        VelgToast.error(msg('Failed to load page. Please refresh.'));
      } catch {
        // Toast import also failed — terminal network failure
      }
      return false;
    }
  }
}

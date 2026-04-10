// URLPattern polyfill — Safari < 18.2 lacks native support.
// Must load before @lit-labs/router (imported by app-shell) which uses URLPattern internally.
import 'urlpattern-polyfill';

// ── Deploy chunk recovery ───────────────────────────────────────────
// After a deploy, the browser may hold cached HTML referencing old chunk
// hashes that no longer exist on the server (404).  Vite fires
// `vite:preloadError` for every failed dynamic-import preload.  We
// intercept it, suppress the error, and reload once so the browser
// fetches fresh HTML with correct chunk URLs.
//
// A sessionStorage timestamp prevents infinite reload loops: if we
// reloaded within the last 10 seconds, we let the error propagate to
// lazyRoute()'s fallback toast instead.
window.addEventListener('vite:preloadError', (event) => {
  const key = 'vite-chunk-reload';
  const last = sessionStorage.getItem(key);
  const now = Date.now();
  if (!last || now - Number(last) > 10_000) {
    event.preventDefault();
    sessionStorage.setItem(key, String(now));
    window.location.reload();
  }
});

// ── Trailing-slash normalization ────────────────────────────────────
// @lit-labs/router uses URLPattern which is trailing-slash-sensitive.
// Normalize before any component imports — the Router reads
// window.location.pathname at class-field init time, so this must
// run before the app-shell module is even parsed.
{
  const { pathname, search, hash } = window.location;
  if (pathname.length > 1 && pathname.endsWith('/')) {
    window.history.replaceState(null, '', pathname.slice(0, -1) + search + hash);
  }
}

import { initSentry } from './services/SentryService.js';

initSentry();

import './app-shell.js';

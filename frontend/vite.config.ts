import { execSync } from 'node:child_process';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { defineConfig, loadEnv } from 'vite';

// Build-time metadata. Fails open — a missing git binary (e.g. Docker build
// without .git) collapses to "unknown" rather than aborting the build.
function resolveGitSha(envSha: string | undefined): string {
  // Truncated here rather than at the caller: the deployment supplies a full
  // 40-char SHA (Coolify's SOURCE_COMMIT), and every consumer of VITE_GIT_SHA
  // wants the short form.
  if (envSha) return envSha.trim().slice(0, 7);
  try {
    return execSync('git rev-parse --short=7 HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return 'unknown';
  }
}

/**
 * Variables the deployed bundle cannot do without. Vite inlines them at build
 * time, so a missing one is not an error anywhere — it is a silently absent
 * feature in the shipped JavaScript. `VITE_SENTRY_DSN` is the worst case of
 * that class: without it every `captureError()` in the codebase writes to the
 * browser console and nowhere else, which is how a dead Pixi FX layer survived
 * months on production unnoticed (remediation plan §A-1/§A-2).
 *
 * Checked only when the build declares itself a deployment build via
 * `VELG_REQUIRE_BUILD_ENV=true` (set by the Dockerfile's frontend stage — the
 * only build that ships to users). Local `npm run build` and CI stay usable
 * without production secrets.
 */
const REQUIRED_DEPLOY_ENV = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_SENTRY_DSN'] as const;

function assertDeployEnv(env: Record<string, string>): void {
  if (env.VELG_REQUIRE_BUILD_ENV !== 'true') return;

  const missing: string[] = REQUIRED_DEPLOY_ENV.filter((key) => !env[key]);
  // Source maps are uploaded under a release name; without it the uploaded
  // maps cannot be matched to the running bundle and stack traces stay minified.
  if (env.SENTRY_AUTH_TOKEN && !env.VITE_SENTRY_RELEASE) missing.push('VITE_SENTRY_RELEASE');

  /*
   * ⚠ DIESE PRUEFUNG KONNTE DAS FEHLEN DES TOKENS NICHT SEHEN.
   *
   * Die Zeile darueber verlangt `VITE_SENTRY_RELEASE` nur, WENN
   * `SENTRY_AUTH_TOKEN` gesetzt ist. Fehlt das Token, ist die Bedingung falsch,
   * die Pruefung sagt nichts, und der Build laeuft durch — obwohl genau dann
   * beides passiert, wogegen es sie gibt.
   *
   * Gemessen auf Prod am 05.09.2026: das Token ist WEDER ein GitHub-Secret
   * NOCH eine Coolify-Build-Variable. Folge, eine fehlende Variable, drei
   * Wirkungen:
   *
   *   1. `sentryVitePlugin` schaltet sich still ab -> keine Karten in Sentry,
   *      jeder Stapelauszug bleibt minifiziert.
   *   2. `filesToDeleteAfterUpload` loescht die Karten NACH dem Hochladen.
   *      Ohne Hochladen wird auch nicht geloescht: 5 MB je Brocken gingen
   *      oeffentlich raus, mit `sourcesContent` und 365 Quelldateien.
   *   3. Der CI-Job `sentry-release` faellt bei jedem Push auf main.
   *
   * Der Build wird deshalb NICHT abgebrochen — das Token zu beschaffen ist
   * eine Entscheidung ausserhalb dieser Datei, und ein Deploy, der daran
   * scheitert, hilft niemandem. Aber er sagt es, und `configureBuild` unten
   * hoert auf, die Karten auszuliefern, die niemand hochgeladen hat.
   */
  if (!env.SENTRY_AUTH_TOKEN) {
    console.warn(
      '[build-env] SENTRY_AUTH_TOKEN ist nicht gesetzt.\n' +
        '            Source Maps werden NICHT zu Sentry hochgeladen und NICHT\n' +
        '            ausgeliefert: Stapelauszuege in Sentry bleiben minifiziert.\n' +
        '            Abhilfe: Coolify -> Environment Variables, "Build Variable"\n' +
        '            aktiviert, plus GitHub-Secret gleichen Namens fuer den\n' +
        '            CI-Job sentry-release. Siehe docs/guides/sentry-cicd-integration.md.',
    );
  }

  if (missing.length > 0) {
    throw new Error(
      `[build-env] Deployment build is missing required variable(s): ${missing.join(', ')}.\n` +
        'Set them on the deployment target (Coolify → Environment Variables, "Build Variable" enabled)\n' +
        'and pass them as Docker build args. See docs/guides/sentry-cicd-integration.md.',
    );
  }
}

export default defineConfig(({ mode }) => {
  // Mirrors the existing envDir: '..' — .env files live at project root,
  // not inside frontend/. loadEnv respects that hierarchy, process.env does not.
  const env = loadEnv(mode, '..', '');
  assertDeployEnv(env);
  const isAlpha = env.VITE_IS_ALPHA === 'true';
  const gitSha = resolveGitSha(env.VITE_GIT_SHA);
  const buildDate = new Date().toISOString().slice(0, 10);

  return {
    envDir: '..',
    define: {
      // Compile-time constants — the bundler inlines them and tree-shakes
      // branches guarded by `import.meta.env.VITE_IS_ALPHA === 'true'`.
      'import.meta.env.VITE_IS_ALPHA': JSON.stringify(String(isAlpha)),
      'import.meta.env.VITE_GIT_SHA': JSON.stringify(gitSha),
      'import.meta.env.VITE_BUILD_DATE': JSON.stringify(buildDate),
    },
    build: {
      target: 'es2022',
      /*
       * 'hidden' erzeugt die Karten OHNE `//# sourceMappingURL`-Zeile: der
       * Browser holt sie nicht von selbst, Sentry bekommt sie ueber den
       * Upload. Genau dafuer ist der Wert da.
       *
       * ⚠ Ohne `SENTRY_AUTH_TOKEN` gibt es keinen Upload — und dann auch
       * keinen Grund, die Karten ueberhaupt zu schreiben. Sie blieben sonst im
       * Abbild liegen (`filesToDeleteAfterUpload` raeumt nur nach einem
       * Upload auf) und waren am 05.09.2026 unter /assets/*.map oeffentlich
       * abrufbar: 5 MB je Brocken, mit `sourcesContent` und 365 Quelldateien.
       *
       * `false` ist hier die ehrlichere Vorgabe: entweder die Karten gehen zu
       * Sentry, oder es gibt sie nicht. Ein drittes Ziel hatten sie nie.
       */
      sourcemap: process.env.SENTRY_AUTH_TOKEN ? 'hidden' : false,
      outDir: '../static/dist',
      chunkSizeWarningLimit: 500,
      rolldownOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes('node_modules/lit/') || id.includes('@lit/reactive-element')) return 'lit';
            if (id.includes('@preact/signals-core') || id.includes('@lit-labs/preact-signals')) return 'signals';
            if (id.includes('@lit-labs/router')) return 'router';
            if (id.includes('@supabase/supabase-js')) return 'supabase';
            if (id.includes('node_modules/marked') || id.includes('node_modules/dompurify')) return 'markdown';
          },
        },
      },
    },
    plugins: [
      // Upload source maps to Sentry during production builds.
      // Reads SENTRY_ORG, SENTRY_PROJECT, SENTRY_AUTH_TOKEN from env automatically.
      // Disabled when SENTRY_AUTH_TOKEN is absent (local dev, CI lint/test).
      sentryVitePlugin({
        disable: !process.env.SENTRY_AUTH_TOKEN,
        release: {
          name: process.env.SENTRY_RELEASE,
          setCommits: false, // No .git in Docker — CI handles commit association
          deploy: false, // CI handles deploy registration
        },
        sourcemaps: {
          filesToDeleteAfterUpload: ['../static/dist/assets/*.map'],
        },
        errorHandler: (err) => {
          console.warn('[sentry] Source map upload warning:', err.message);
        },
        telemetry: false,
      }),
    ],
    server: {
      port: 5173,
      proxy: {
        // Targets are overridable so a dev box can point the running frontend at
        // a remote stack without editing this file — which is what people
        // otherwise do, and then commit by accident. Defaults are the local
        // stack, so nothing changes unless the vars are set (see .env.local).
        '/api': {
          target: env.VITE_DEV_API_PROXY || 'http://localhost:8000',
          changeOrigin: true,
          secure: true,
        },
        '/storage': {
          target: env.VITE_DEV_STORAGE_PROXY || 'http://127.0.0.1:54321',
          changeOrigin: true,
          secure: true,
        },
      },
    },
  };
});

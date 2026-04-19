import { execSync } from 'node:child_process';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { defineConfig, loadEnv } from 'vite';

// Build-time metadata. Fails open — a missing git binary (e.g. Docker build
// without .git) collapses to "unknown" rather than aborting the build.
function resolveGitSha(envSha: string | undefined): string {
  if (envSha) return envSha;
  try {
    return execSync('git rev-parse --short=7 HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return 'unknown';
  }
}

export default defineConfig(({ mode }) => {
  // Mirrors the existing envDir: '..' — .env files live at project root,
  // not inside frontend/. loadEnv respects that hierarchy, process.env does not.
  const env = loadEnv(mode, '..', '');
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
      sourcemap: 'hidden',
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
        '/api': 'http://localhost:8000',
        '/storage': 'http://127.0.0.1:54321',
      },
    },
  };
});

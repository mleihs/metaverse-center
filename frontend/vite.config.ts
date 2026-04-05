import { sentryVitePlugin } from '@sentry/vite-plugin';
import { defineConfig } from 'vite';

export default defineConfig({
  envDir: '..',
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
        deploy: false,     // CI handles deploy registration
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
});

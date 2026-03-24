import { defineConfig } from 'vite';

export default defineConfig({
  envDir: '..',
  build: {
    target: 'es2022',
    sourcemap: 'hidden',
    outDir: '../static/dist',
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks: {
          'lit': ['lit', '@lit/reactive-element'],
          'signals': ['@preact/signals-core', '@lit-labs/preact-signals'],
          'router': ['@lit-labs/router'],
          'supabase': ['@supabase/supabase-js'],
          'markdown': ['marked', 'dompurify'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8000',
      '/storage': 'http://127.0.0.1:54321',
    },
  },
});

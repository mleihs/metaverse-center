import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'happy-dom',
    /*
     * Platzhalter, damit `services/supabase/client.ts` beim Import nicht wirft.
     *
     * Das Modul prüft die beiden Variablen auf Modulebene. Jede Komponente, die
     * ein API-Singleton anfasst — und das sind fast alle, die etwas laden —
     * zieht es über `BaseApiService` mit herein. Ohne diese zwei Zeilen war
     * KEINE solche Komponente überhaupt testbar: der Testlauf scheiterte am
     * Import, lange bevor ein `it` lief.
     *
     * Die Werte sind erfunden und dürfen es sein: kein Test ruft hinaus, und
     * ein Test, der es täte, wäre an dieser Adresse ohnehin sofort auffällig.
     */
    env: {
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key-not-a-secret',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/locales/**'],
    },
  },
});

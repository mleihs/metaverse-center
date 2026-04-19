/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Build-time gate for the Velgarien alpha suite (stamp, build-strip, first-contact modal). */
  readonly VITE_IS_ALPHA: string;
  /** Short git SHA of the build, populated by vite.config.ts at build time. */
  readonly VITE_GIT_SHA: string;
  /** ISO date (YYYY-MM-DD) stamped into the build at build time. */
  readonly VITE_BUILD_DATE: string;
  /** Sentry release identifier. Populated by CI for production builds. */
  readonly VITE_SENTRY_RELEASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

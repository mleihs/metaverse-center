---
title: "Sentry CI/CD Integration — Release Tracking, Source Maps & Post-Deploy Verification"
version: "1.0"
date: "2026-03-24"
type: guide
status: active
lang: en
---

# Sentry CI/CD Integration

## Overview

The codebase has mature Sentry error tracking (backend: 70+ `capture_exception()` calls across 28 services; frontend: 9 `captureError()` calls). This integration closes three operational blind spots:

1. **Unreadable frontend errors** — Vite generates hidden source maps (`sourcemap: 'hidden'`), but without uploading them to Sentry, production frontend errors show minified stack traces.
2. **No release correlation** — Without a `release` identifier in `sentry_sdk.init()` and `Sentry.init()`, errors cannot be attributed to specific deployments. Suspect commits, regression detection, and release health are inactive.
3. **No post-deploy verification** — Railway deploys on push to main. If a deploy introduces a regression, discovery is manual.

### Pre-existing Bug Fixed

`VITE_SENTRY_DSN` was missing from the Dockerfile's `ARG` declarations in Stage 1. This meant `import.meta.env.VITE_SENTRY_DSN` was `undefined` in production Docker builds — **frontend Sentry was silently broken in production**.

---

## Architecture

```
Push to main
    |
    +---> Railway Docker Build
    |       |
    |       +-- Stage 1: node:22-slim
    |       |     - npm ci + npm run build
    |       |     - @sentry/vite-plugin uploads .map files to Sentry
    |       |     - filesToDeleteAfterUpload removes .map files
    |       |     - SENTRY_AUTH_TOKEN is a build ARG (discarded after this stage)
    |       |
    |       +-- Stage 2: python:3.13-slim (prerender)
    |       |     - COPY --from=frontend-build (no .map files — already deleted)
    |       |     - Generates static HTML for crawlers
    |       |
    |       +-- Stage 3: python:3.13-slim (runtime)
    |             - COPY --from=prerender (no .map files, no SENTRY_AUTH_TOKEN)
    |             - ENV SENTRY_RELEASE=${SENTRY_RELEASE} (for backend tagging)
    |             - uvicorn serves app
    |
    +---> GitHub Actions CI (.github/workflows/ci.yml)
    |       |
    |       +-- lint-frontend, test-frontend, test-backend (parallel)
    |       |
    |       +-- sentry-release (after all tests pass, main branch only)
    |             - checkout with fetch-depth: 0 (full git history)
    |             - getsentry/action-release@v3: associate commits + register deploy
    |             - No frontend build (source maps already uploaded from Docker)
    |
    +---> Post-Deploy Health Check (.github/workflows/post-deploy-check.yml)
            - Triggered by: workflow_run (after CI completes on main)
            - Polls /health endpoint (up to 10 min, 30s intervals)
            - Waits 5 min for errors to accumulate
            - Queries Sentry API for new unresolved issues in this release
            - >5 issues = error, 1-5 = warning, 0 = clean
```

---

## Single-Build Guarantee (Critical Design Decision)

Source maps are uploaded from the **same `npm run build`** that produces the production JavaScript. This is non-negotiable.

### Why Not Upload from CI?

The anti-pattern (rejected during design review):

1. CI runs `npm run build` to generate source maps
2. CI uploads maps to Sentry
3. Railway runs `npm run build` separately in Docker

**Problem:** Vite inlines `import.meta.env.*` values into built JS at build time. If any environment variable differs between CI and Docker (e.g., `VITE_GA4_MEASUREMENT_ID` set in Docker but not CI), the built JS files have **different content**. Different content = different content hashes = different chunk filenames. The source maps from CI correspond to `chunk-abc123.js`, but production serves `chunk-def456.js`. **Source maps never resolve.**

**Solution:** `@sentry/vite-plugin` runs inside the Docker build. Same build, same env vars, same chunks, guaranteed match.

---

## Files Modified

| File | Purpose |
|------|---------|
| `frontend/vite.config.ts` | Added `sentryVitePlugin` — uploads maps during build, deletes after |
| `frontend/package.json` | Added `@sentry/vite-plugin@^5.1.1` devDependency |
| `Dockerfile` | Added `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` ARGs to Stage 1; `VITE_SENTRY_DSN` ARG (bug fix); `SENTRY_RELEASE` ARG/ENV in Stages 1 and 3 |
| `backend/app.py` | Added `release=os.environ.get("SENTRY_RELEASE")` to `sentry_sdk.init()` |
| `frontend/src/services/SentryService.ts` | Added `VITE_SENTRY_RELEASE` constant + `release: RELEASE` to `Sentry.init()` |
| `.github/workflows/ci.yml` | Added `sentry-release` job (commit association + deploy registration only) |
| `.github/workflows/post-deploy-check.yml` | New workflow: health poll + Sentry regression check |
| `.env.example`, `.env.production.example` | Documented `SENTRY_RELEASE`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` |

---

## Configuration

### Railway Build Variables

These must be set in Railway Dashboard > Service > Variables. Railway automatically passes all service variables as Docker build args.

| Variable | Value | Purpose |
|----------|-------|---------|
| `SENTRY_RELEASE` | `${{RAILWAY_GIT_COMMIT_SHA}}` | Release identifier (git commit SHA) |
| `SENTRY_AUTH_TOKEN` | `sntryu_...` | Authenticates source map upload |
| `SENTRY_ORG` | `ing-mag-matthias-leihs-bsc` | Sentry organization slug |
| `SENTRY_PROJECT` | `metaverse_center` | Sentry project slug |
| `VITE_SENTRY_DSN` | `<DSN from Sentry project settings>` | Frontend error tracking DSN |

### GitHub Secrets

Set in GitHub repo > Settings > Secrets and variables > Actions.

| Secret | Value | Used By |
|--------|-------|---------|
| `SENTRY_AUTH_TOKEN` | Same token as Railway | CI: commit association |
| `SENTRY_ORG` | `ing-mag-matthias-leihs-bsc` | CI: commit association |
| `SENTRY_PROJECT` | `metaverse_center` | CI: commit association |
| `PRODUCTION_URL` | `https://metaverse.center` | Post-deploy health check |

**Not needed in GitHub** (only in Railway): `VITE_SENTRY_DSN`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — these are only consumed during Docker build.

### Sentry Internal Integration

Create at: Sentry > Settings > Developer Settings > Internal Integrations.

Required scopes:
- `project:releases` (create releases, upload source maps)
- `org:read` (commit association)

The generated auth token goes into both Railway and GitHub secrets as `SENTRY_AUTH_TOKEN`.

---

## Vite Plugin Configuration

```ts
// frontend/vite.config.ts
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
```

### Option Rationale

| Option | Value | Why |
|--------|-------|-----|
| `disable` | `!process.env.SENTRY_AUTH_TOKEN` | Skips all plugin work in local dev and CI lint/test (no auth token present). Returns a noop plugin — zero network calls, zero file modifications. |
| `release.name` | `process.env.SENTRY_RELEASE` | Matches Railway's `${{RAILWAY_GIT_COMMIT_SHA}}`. Plugin also auto-reads `SENTRY_RELEASE` from env. Explicit for clarity. |
| `release.setCommits` | `false` | Default is `{ auto: true }` which runs `git` commands. Docker builds have no `.git` directory — this would fail. CI handles commit association via `getsentry/action-release@v3`. |
| `release.deploy` | `false` | Plugin doesn't know about deployment context. CI registers the deploy. |
| `sourcemaps.filesToDeleteAfterUpload` | `['../static/dist/assets/*.map']` | Deletes `.map` files after upload. Path is relative to Vite project root (`frontend/`). Ensures no source maps reach Stage 2 (prerender) or Stage 3 (runtime). |
| `errorHandler` | Logs warning, doesn't throw | Default behavior throws on upload failure, blocking the build. Non-blocking ensures Sentry outages don't prevent deploys. Trade-off: silent upload failure = minified stack traces until next successful deploy. |
| `telemetry` | `false` | Don't send Sentry plugin analytics. |

---

## Security

### Docker ARG Visibility

`SENTRY_AUTH_TOKEN` is passed as a Docker `ARG` in Stage 1. Key considerations:

- **Final image is clean.** Stage 1 is discarded. The runtime image (Stage 3) contains no trace of the auth token.
- **Intermediate layers are NOT clean.** `docker history --no-trunc` on the Stage 1 layer reveals ARG values. However, Railway does not expose intermediate build layers externally.
- **BuildKit `--mount=type=secret` is NOT supported by Railway** ([open feature request](https://station.railway.com/feedback/docker-build-kit-build-secrets-support-777c36cc)). The ARG approach is Railway's recommended pattern.
- **Token scope is limited.** `project:releases + org:read` — cannot access issues, events, or project settings.
- **Mitigation:** If Railway adds secret mount support, migrate the token from ARG to `--mount=type=secret`.

### Railway Sealed Variables

Railway offers "sealed" variables whose values are provided to builds/deploys but never visible in the Railway UI after creation. Consider using this for `SENTRY_AUTH_TOKEN` for additional protection.

---

## How It Works: Push-to-Main Flow

1. Developer pushes to `main`
2. **Railway** starts Docker build:
   - Stage 1: `npm run build` runs with `SENTRY_AUTH_TOKEN` in env
   - `@sentry/vite-plugin` detects the token, creates Sentry release, uploads `.js.map` files
   - Plugin deletes `.map` files after successful upload
   - Stage 2: prerender runs (no `.map` files in COPY)
   - Stage 3: runtime image built (no `.map` files, no auth token)
   - Container deployed with `SENTRY_RELEASE=<commit SHA>` env var
3. **GitHub Actions CI** runs in parallel:
   - Lint + test jobs (no Sentry involvement)
   - `sentry-release` job (after tests pass): associates commits + registers deploy
4. **Post-deploy check** triggers after CI completes:
   - Polls `https://metaverse.center/health` until 200
   - Waits 5 minutes for errors to accumulate
   - Queries Sentry API for new unresolved issues with `first-release:<SHA>`
   - Reports: >5 issues = error (red check), 1-5 = warning (yellow), 0 = clean (green)

---

## Verification Checklist

After setting up all Railway variables and GitHub secrets:

1. **Dockerfile ARG fix:** Push to branch. Railway build logs should show `VITE_SENTRY_DSN` being passed and the Sentry plugin uploading maps.
2. **Backend release tag:** After deploy, trigger a backend error. In Sentry, the error detail should show the release SHA.
3. **Frontend release tag:** Open browser, trigger a frontend error. Sentry should show the same release SHA.
4. **Source map resolution:** In Sentry, click a frontend error. The stack trace should show original TypeScript file names and line numbers (not minified JS).
5. **Suspect commits:** In Sentry, open the release. The "Commits" tab should show associated git history.
6. **Deploy tracking:** In Sentry, Releases page. The "production" column should show the deployment timestamp.
7. **Post-deploy check:** Push to main. After CI, "Post-Deploy Health Check" workflow should run and show green/yellow/red.
8. **Linting:** `ruff check backend/` and `npm run typecheck` both clean.

---

## Troubleshooting

### Source maps not resolving (minified stack traces)

1. Check Railway build logs for `[sentry] Source map upload warning:` — indicates upload failure.
2. Verify `SENTRY_AUTH_TOKEN` is set in Railway variables.
3. Verify the token has `project:releases` scope.
4. Check Sentry > Settings > Source Maps > Release Artifacts — are maps listed for the commit SHA?

### Post-deploy check always warns

The check queries for issues with `first-release:<SHA>`. If the same error occurs across multiple releases, only the first occurrence's release is tagged. Persistent errors won't re-trigger.

### sentry-release CI job fails

1. Verify GitHub secrets `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` are set.
2. Ensure `fetch-depth: 0` in checkout — shallow clones break commit association.
3. Check the token has `org:read` scope.

### Plugin uploads succeed but errors still show minified

The `release` value in Sentry must match between the uploaded source maps and the error event. Verify:
- Railway has `SENTRY_RELEASE=${{RAILWAY_GIT_COMMIT_SHA}}`
- `ENV VITE_SENTRY_RELEASE=${SENTRY_RELEASE}` is in Dockerfile Stage 1
- `SentryService.ts` reads `VITE_SENTRY_RELEASE` and passes it to `Sentry.init()`
- `backend/app.py` reads `SENTRY_RELEASE` from env and passes it to `sentry_sdk.init()`

### Local development

The plugin is automatically disabled in local dev (`SENTRY_AUTH_TOKEN` is not set). No source maps are uploaded, no network calls are made. The `disable` option returns a noop plugin.

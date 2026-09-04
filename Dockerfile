# Stage 1: Build frontend + upload source maps to Sentry
FROM node:22-slim AS frontend-build

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_GA4_MEASUREMENT_ID
ARG VITE_SENTRY_DSN
ARG SENTRY_RELEASE
ARG SENTRY_AUTH_TOKEN
ARG SENTRY_ORG
ARG SENTRY_PROJECT
# MEASURED, 2026-08-28: Coolify does NOT pass SOURCE_COMMIT as a build arg. Its
# docker build line carries four COOLIFY_* variables plus the app's VITE_* ones
# and nothing else, so these two ENV lines resolve to empty on a Coolify deploy.
# They are kept for a build that DOES supply the values (CI); the deploy path
# gets its identity at runtime instead — the server stamps it into the SPA shell
# (backend/utils/spa_document.py), which is also what makes the backend and the
# frontend report the same release. Do not re-derive this dead end.
ARG SOURCE_COMMIT=""
# Vite reads ENV (not ARG) at build time — export all VITE_* for inlining
ENV VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
ENV VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}
ENV VITE_GA4_MEASUREMENT_ID=${VITE_GA4_MEASUREMENT_ID}
ENV VITE_SENTRY_DSN=${VITE_SENTRY_DSN}
ENV VITE_SENTRY_RELEASE=${SENTRY_RELEASE:-$SOURCE_COMMIT}
# Only populated when the builder supplies SOURCE_COMMIT (see above). On a
# Coolify deploy the alpha build strip reads the runtime stamp instead.
ENV VITE_GIT_SHA=${SOURCE_COMMIT}
# This is the only build that ships to users. It opts into the build-env
# contract in frontend/vite.config.ts (assertDeployEnv), so a deployment that
# forgets a build-critical VITE_* variable fails here instead of silently
# shipping a bundle with the feature compiled out.
ENV VELG_REQUIRE_BUILD_ENV=true

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Python runtime with built frontend
FROM python:3.13-slim

# Non-root user for runtime (H9: container escape mitigation)
RUN useradd --create-home --shell /bin/bash appuser

WORKDIR /app

# Install curl for healthcheck + pinned deps (Docker layer cache)
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
COPY backend/requirements.txt ./backend/
# --require-hashes: requirements.txt is a uv-compiled hash lock generated from
# pyproject.toml (single source of truth) — a tampered or unhashed dep aborts the build.
RUN pip install --no-cache-dir --require-hashes -r backend/requirements.txt

# Copy app source (changes frequently, but deps are already cached)
COPY pyproject.toml ./
COPY backend/ ./backend/

# Copy built frontend assets
COPY --from=frontend-build /app/static/dist ./static/dist

# Ensure appuser owns app files
RUN chown -R appuser:appuser /app

# Same derivation as stage 1, so backend and frontend events land on ONE release.
ARG SENTRY_RELEASE
ARG SOURCE_COMMIT=""
ENV SENTRY_RELEASE=${SENTRY_RELEASE:-$SOURCE_COMMIT}

USER appuser

EXPOSE ${PORT:-8000}
# start-period=120s (matches railway.toml healthcheckTimeout): the FastAPI lifespan runs
# serial Supabase round-trips before serving (model config, research domains, a 10-table
# dungeon-content load, sentry-rule cache, circuit-kill rehydrate). On a cold/slow DB,
# readiness can exceed 10s; failing probes during start-period don't count toward retries,
# so this is pure additive grace — it cannot mark a healthy container unhealthy, and it
# avoids a restart-on-unhealthy crash-loop under Coolify.
HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/api/v1/health || exit 1
# KEIN --proxy-headers, und das ist eine Messung, keine Auslassung.
#
# Der Ratenbegrenzer sah als Absender bis zum 05.09.2026 den Reverse Proxy, bei
# jedem Nutzer denselben — ein Eimer fuer alle. Der naheliegende Griff
# (`--proxy-headers --forwarded-allow-ips '*'`) machte es SCHLIMMER: uvicorn
# 0.52 nimmt bei `always_trust` den ERSTEN Eintrag von `X-Forwarded-For`, und
# den setzt der Aufrufer selbst. Auf Produktion gemessen: acht Anfragen an
# /api/v1/auth/reauth mit frei gewaehltem Kopf gingen alle durch, wo ohne den
# Kopf die siebte mit 429 abgewiesen wurde. Fuer ein Passwort-Orakel ist das
# die Abschaffung der Schranke.
#
# Geloest wird es eine Ebene hoeher: `backend/middleware/rate_limit.py` schluesselt
# angemeldete Anfragen nach dem NUTZER (`sub` aus dem Token) statt nach seinem
# Weg durchs Netz. Das ist nicht faelschbar, ohne das Token ungueltig zu machen.
#
# Offen bleibt die Adresse fuer ANONYME Endpunkte: hinter Cloudflare ist sie
# weiterhin die des Proxys. Die saubere Loesung liest `CF-Connecting-IP` in
# einer eigenen Middleware; `--forwarded-allow-ips` kann das nicht.
CMD ["sh", "-c", "uvicorn backend.app:app --host 0.0.0.0 --port ${PORT:-8000} --no-access-log"]

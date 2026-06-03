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
# Vite reads ENV (not ARG) at build time — export all VITE_* for inlining
ENV VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
ENV VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}
ENV VITE_GA4_MEASUREMENT_ID=${VITE_GA4_MEASUREMENT_ID}
ENV VITE_SENTRY_DSN=${VITE_SENTRY_DSN}
ENV VITE_SENTRY_RELEASE=${SENTRY_RELEASE}

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
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy app source (changes frequently, but deps are already cached)
COPY pyproject.toml ./
COPY backend/ ./backend/

# Copy built frontend assets
COPY --from=frontend-build /app/static/dist ./static/dist

# Ensure appuser owns app files
RUN chown -R appuser:appuser /app

ARG SENTRY_RELEASE
ENV SENTRY_RELEASE=${SENTRY_RELEASE}

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
CMD ["sh", "-c", "uvicorn backend.app:app --host 0.0.0.0 --port ${PORT:-8000} --no-access-log"]

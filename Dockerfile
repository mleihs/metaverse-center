# Stage 1: Build frontend
FROM node:22-slim AS frontend-build

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_GA4_MEASUREMENT_ID

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Prerender static HTML for crawlers
FROM python:3.13-slim AS prerender
WORKDIR /app
COPY scripts/prerender.py ./scripts/
COPY --from=frontend-build /app/static/dist ./static/dist
RUN pip install --no-cache-dir httpx
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV SUPABASE_URL=${VITE_SUPABASE_URL}
ENV SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}
RUN python scripts/prerender.py

# Stage 3: Python runtime with built frontend
FROM python:3.13-slim

WORKDIR /app

# Install pinned deps first (Docker layer cache — only re-runs when requirements.txt changes)
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy app source (changes frequently, but deps are already cached)
COPY pyproject.toml ./
COPY backend/ ./backend/

# Copy built frontend assets + prerendered HTML
COPY --from=prerender /app/static/dist ./static/dist

EXPOSE ${PORT:-8000}
CMD ["sh", "-c", "uvicorn backend.app:app --host 0.0.0.0 --port ${PORT:-8000}"]

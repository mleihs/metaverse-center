# Stage 1: Build frontend
FROM node:22-slim AS frontend-build

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Python runtime with built frontend
FROM python:3.13-slim

WORKDIR /app

# Install Python dependencies (needs pyproject.toml + backend source)
COPY pyproject.toml ./
COPY backend/ ./backend/
RUN pip install --no-cache-dir .

# Copy built frontend assets
COPY --from=frontend-build /app/static/dist ./static/dist

EXPOSE ${PORT:-8000}
CMD ["sh", "-c", "uvicorn backend.app:app --host 0.0.0.0 --port ${PORT:-8000}"]

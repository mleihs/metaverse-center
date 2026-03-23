-- AI Usage Log — tracks every LLM/image generation call for cost visibility.
--
-- Phase 6 of audit remediation. Enables:
-- 1. Per-simulation cost tracking
-- 2. Per-model usage breakdown
-- 3. Anomaly detection (unexpected cost spikes)
-- 4. Future: quota enforcement
--
-- Inserts are fire-and-forget from the backend AIUsageService.
-- No RLS needed — this is a platform-level audit table (service_role only).

CREATE TABLE IF NOT EXISTS ai_usage_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    simulation_id UUID REFERENCES simulations(id) ON DELETE SET NULL,
    user_id UUID,  -- nullable (background tasks have no user)
    provider TEXT NOT NULL CHECK (provider IN ('openrouter', 'replicate')),
    model TEXT NOT NULL,
    purpose TEXT NOT NULL,  -- e.g. 'chat', 'portrait', 'building', 'lore', 'description'
    prompt_tokens INT NOT NULL DEFAULT 0,
    completion_tokens INT NOT NULL DEFAULT 0,
    total_tokens INT NOT NULL DEFAULT 0,
    duration_ms INT NOT NULL DEFAULT 0,
    estimated_cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0,
    key_source TEXT NOT NULL DEFAULT 'platform' CHECK (key_source IN ('platform', 'simulation', 'byok', 'env')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for per-simulation cost queries
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_sim
    ON ai_usage_log(simulation_id, created_at DESC);

-- Index for per-model cost queries
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_model
    ON ai_usage_log(model, created_at DESC);

-- RLS: service_role only (no user access needed)
ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_usage_log_service_role ON ai_usage_log
    FOR ALL USING (true) WITH CHECK (true);
-- Only service_role can access (default for tables without user policies)

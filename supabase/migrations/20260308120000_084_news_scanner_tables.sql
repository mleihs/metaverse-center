-- Substrate Scanner — news_scan_log + news_scan_candidates tables
-- Scanner runs as system actor (service_role), so RLS is permissive.

-- ── news_scan_log: Tracks all fetched items for deduplication ────────────

CREATE TABLE public.news_scan_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id   TEXT NOT NULL,
    source_name TEXT NOT NULL,
    title       TEXT NOT NULL,
    url         TEXT,
    scanned_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    classified  BOOLEAN NOT NULL DEFAULT false,
    source_category TEXT,
    magnitude   NUMERIC(3,2),
    CONSTRAINT unique_source_id UNIQUE (source_name, source_id)
);

CREATE INDEX idx_scan_log_scanned ON public.news_scan_log (scanned_at DESC);
CREATE INDEX idx_scan_log_source ON public.news_scan_log (source_name, scanned_at DESC);

-- ── news_scan_candidates: Staged resonances awaiting admin review ────────

CREATE TABLE public.news_scan_candidates (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_category      TEXT NOT NULL CHECK (source_category IN (
        'economic_crisis', 'military_conflict', 'pandemic',
        'natural_disaster', 'political_upheaval', 'tech_breakthrough',
        'cultural_shift', 'environmental_disaster'
    )),
    title                TEXT NOT NULL,
    description          TEXT,
    bureau_dispatch      TEXT,
    article_url          TEXT,
    article_platform     TEXT,
    article_raw_data     JSONB,
    magnitude            NUMERIC(3,2) NOT NULL DEFAULT 0.50
                           CHECK (magnitude >= 0.10 AND magnitude <= 1.00),
    classification_reason TEXT,
    source_adapter       TEXT NOT NULL,
    is_structured        BOOLEAN NOT NULL DEFAULT false,
    status               TEXT NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'approved', 'rejected', 'created')),
    resonance_id         UUID REFERENCES public.substrate_resonances(id),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at          TIMESTAMPTZ,
    reviewed_by_id       UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_candidates_status ON public.news_scan_candidates (status, created_at DESC);

-- ── RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE public.news_scan_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_scan_candidates ENABLE ROW LEVEL SECURITY;

-- Service role: full access (scanner runs as system actor)
CREATE POLICY scan_log_service ON public.news_scan_log
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY candidates_service ON public.news_scan_candidates
    FOR ALL USING (true) WITH CHECK (true);

-- Authenticated: read candidates (for admin UI)
CREATE POLICY candidates_read ON public.news_scan_candidates
    FOR SELECT TO authenticated USING (true);

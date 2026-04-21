-- Migration 232: Resonance Journal — foundation schema (P0).
--
-- Spec: docs/plans/resonance-journal-implementation-plan.md §3 + §7
-- Design: docs/plans/resonance-journal-design-direction.md
--
-- Eight tables, all journal-scoped:
--   journal_attunements           — catalog of meta-progression unlocks (seeded
--                                    with 3 starters: Hesitation / Mercy / Tremor).
--                                    Public-readable so the catalog UI works for
--                                    any logged-in user; writes are service_role.
--   journal_fragments             — atomic journal entries (imprint/signature/
--                                    echo/impression/mark/tremor). User-owned
--                                    per-simulation, but aggregation is global
--                                    per AD-5.
--   fragment_generation_requests  — async generation queue (AD-1). Scheduler pops
--                                    pending rows, calls the LLM, inserts fragment,
--                                    marks done. Partial index on pending rows
--                                    for cheap dequeue.
--   journal_constellations        — player-composed groupings of fragments (P2).
--                                    Per AD-5 user-global (no simulation_id).
--   constellation_fragments       — junction table with canvas coordinates
--                                    (position_x, position_y) — AD-3 revised
--                                    to Pointer Events but same coord persistence.
--   user_attunements              — per-user unlock log. attunement_id is the
--                                    catalog reference; constellation_id is the
--                                    crystallization that triggered the unlock.
--   resonance_profiles            — hidden 8-dimensional fingerprint, per-user
--                                    global (AD-5). Updated incrementally from
--                                    fragment thematic_tags.
--   journal_palimpsests           — periodic LLM-generated reflection (AD-4 every
--                                    30th fragment). resonance_snapshot captures
--                                    the profile state at generation time.
--
-- RLS:
--   Per-user tables use (SELECT auth.uid()) initPlan wrapping per migration 183.
--   Catalog table (journal_attunements) is authenticated-read + service_role-write.
--   Scheduler + generation services run with service_role (bypass RLS).
--
-- Seeds:
--   3 starter attunements mapped to 3 game systems (AD-9).
--   3 new ai_budget purpose rows (fragment_generation / constellation_insight /
--   palimpsest_reflection) so Bureau Ops Ledger surfaces spend from day 1 (AD-7).
--
-- Active-view refresh: none required. No changes to agents, buildings,
-- simulations, events.


-- ── journal_attunements (catalog, no FK deps — create first) ──────────────

CREATE TABLE journal_attunements (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug                     TEXT NOT NULL UNIQUE,
    name_de                  TEXT NOT NULL,
    name_en                  TEXT NOT NULL,
    description_de           TEXT NOT NULL,
    description_en           TEXT NOT NULL,
    system_hook              TEXT NOT NULL
                                 CHECK (system_hook IN (
                                     'dungeon_option',
                                     'epoch_option',
                                     'simulation_option'
                                 )),
    effect                   JSONB NOT NULL DEFAULT '{}'::jsonb,
    required_resonance       JSONB NOT NULL DEFAULT '{}'::jsonb,
    required_resonance_type  TEXT
                                 CHECK (required_resonance_type IS NULL
                                        OR required_resonance_type IN (
                                            'archetype',
                                            'emotional',
                                            'temporal',
                                            'contradiction'
                                        )),
    enabled                  BOOLEAN NOT NULL DEFAULT TRUE,
    seeded_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_journal_attunements_resonance_type
    ON journal_attunements (required_resonance_type, enabled);


-- ── journal_fragments ─────────────────────────────────────────────────────

CREATE TABLE journal_fragments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    simulation_id   UUID REFERENCES simulations(id) ON DELETE SET NULL,
    fragment_type   TEXT NOT NULL
                        CHECK (fragment_type IN (
                            'imprint',     -- dungeon
                            'signature',   -- epoch
                            'echo',        -- simulation
                            'impression',  -- bond whisper
                            'mark',        -- achievement
                            'tremor'       -- cross-simulation bleed
                        )),
    source_type     TEXT NOT NULL
                        CHECK (source_type IN (
                            'dungeon', 'epoch', 'simulation',
                            'bond', 'achievement', 'bleed'
                        )),
    source_id       UUID,  -- nullable; FK targets vary by source_type
    content_de      TEXT NOT NULL CHECK (length(trim(content_de)) > 0),
    content_en      TEXT NOT NULL CHECK (length(trim(content_en)) > 0),
    thematic_tags   JSONB NOT NULL DEFAULT '[]'::jsonb,
    rarity          TEXT NOT NULL DEFAULT 'common'
                        CHECK (rarity IN (
                            'common', 'uncommon', 'rare', 'singular'
                        )),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Primary list query: newest-first per user.
CREATE INDEX idx_journal_fragments_user
    ON journal_fragments (user_id, created_at DESC);

-- Dedup + retro lookup (e.g. "did we already emit a fragment for this bond whisper?").
CREATE INDEX idx_journal_fragments_source
    ON journal_fragments (source_type, source_id);

-- Filter tab queries (user's dungeon fragments / user's epoch fragments / etc.).
CREATE INDEX idx_journal_fragments_user_type
    ON journal_fragments (user_id, fragment_type, created_at DESC);


-- ── fragment_generation_requests (async queue, AD-1) ──────────────────────

CREATE TABLE fragment_generation_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    simulation_id   UUID REFERENCES simulations(id) ON DELETE CASCADE,
    source_type     TEXT NOT NULL
                        CHECK (source_type IN (
                            'dungeon', 'epoch', 'simulation',
                            'bond', 'achievement', 'bleed'
                        )),
    source_id       UUID NOT NULL,
    fragment_type   TEXT NOT NULL
                        CHECK (fragment_type IN (
                            'imprint', 'signature', 'echo',
                            'impression', 'mark', 'tremor'
                        )),
    context         JSONB NOT NULL DEFAULT '{}'::jsonb,
    status          TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN (
                            'pending', 'generating', 'done', 'failed'
                        )),
    attempts        INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    last_error      TEXT,
    enqueued_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at    TIMESTAMPTZ
);

-- Scheduler pop: oldest pending first. Partial index keeps it tiny even if
-- the table grows large with 'done' history.
CREATE INDEX idx_fragment_gen_pending
    ON fragment_generation_requests (enqueued_at)
    WHERE status = 'pending';

-- Admin / debug: recent failures per user.
CREATE INDEX idx_fragment_gen_user_status
    ON fragment_generation_requests (user_id, status, enqueued_at DESC);


-- ── journal_constellations ────────────────────────────────────────────────

CREATE TABLE journal_constellations (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name_de           TEXT,
    name_en           TEXT,
    status            TEXT NOT NULL DEFAULT 'drafting'
                          CHECK (status IN (
                              'drafting', 'crystallized', 'archived'
                          )),
    insight_de        TEXT,
    insight_en        TEXT,
    resonance_type    TEXT
                          CHECK (resonance_type IS NULL
                                 OR resonance_type IN (
                                     'archetype',
                                     'emotional',
                                     'temporal',
                                     'contradiction'
                                 )),
    attunement_id     UUID REFERENCES journal_attunements(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    crystallized_at   TIMESTAMPTZ,
    archived_at       TIMESTAMPTZ,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Invariants: once crystallized, insight must be present.
    CONSTRAINT journal_constellations_crystallized_has_insight
        CHECK (status != 'crystallized'
               OR (insight_de IS NOT NULL AND insight_en IS NOT NULL))
);

CREATE INDEX idx_journal_constellations_user
    ON journal_constellations (user_id, status, created_at DESC);


-- ── constellation_fragments (junction with canvas coords) ─────────────────

CREATE TABLE constellation_fragments (
    constellation_id  UUID NOT NULL REFERENCES journal_constellations(id) ON DELETE CASCADE,
    fragment_id       UUID NOT NULL REFERENCES journal_fragments(id) ON DELETE CASCADE,
    position_x        INTEGER NOT NULL DEFAULT 0,
    position_y        INTEGER NOT NULL DEFAULT 0,
    placed_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (constellation_id, fragment_id)
);

-- Reverse lookup: "which constellations reference this fragment?"
CREATE INDEX idx_constellation_fragments_fragment
    ON constellation_fragments (fragment_id);


-- ── user_attunements (per-user unlock log) ────────────────────────────────

CREATE TABLE user_attunements (
    user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    attunement_id    UUID NOT NULL REFERENCES journal_attunements(id) ON DELETE CASCADE,
    constellation_id UUID REFERENCES journal_constellations(id) ON DELETE SET NULL,
    unlocked_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, attunement_id)
);

-- Per-user fast path: "does user have attunement X?"  (PK already covers it.)
-- Reverse lookup: catalog view showing who unlocked what (admin only).
CREATE INDEX idx_user_attunements_attunement
    ON user_attunements (attunement_id, unlocked_at DESC);


-- ── resonance_profiles (hidden 8D fingerprint, user-global) ───────────────

CREATE TABLE resonance_profiles (
    user_id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    umbra            DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (umbra >= 0),
    struktur         DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (struktur >= 0),
    nexus            DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (nexus >= 0),
    aufloesung       DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (aufloesung >= 0),
    prometheus_dim   DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (prometheus_dim >= 0),
    flut             DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (flut >= 0),
    erwachen         DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (erwachen >= 0),
    umsturz          DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (umsturz >= 0),
    fragment_count   INTEGER NOT NULL DEFAULT 0 CHECK (fragment_count >= 0),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ── journal_palimpsests ───────────────────────────────────────────────────

CREATE TABLE journal_palimpsests (
    id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content_de                      TEXT NOT NULL CHECK (length(trim(content_de)) > 0),
    content_en                      TEXT NOT NULL CHECK (length(trim(content_en)) > 0),
    fragment_count_at_generation    INTEGER NOT NULL CHECK (fragment_count_at_generation > 0),
    resonance_snapshot              JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at                      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_journal_palimpsests_user
    ON journal_palimpsests (user_id, created_at DESC);


-- ── Updated-at triggers (shared set_updated_at function) ──────────────────

CREATE TRIGGER set_journal_attunements_updated_at
    BEFORE UPDATE ON journal_attunements
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_journal_constellations_updated_at
    BEFORE UPDATE ON journal_constellations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_resonance_profiles_updated_at
    BEFORE UPDATE ON resonance_profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── Row Level Security ────────────────────────────────────────────────────
--
-- All new tables get RLS. Catalog (journal_attunements) is authenticated-read
-- so any logged-in user sees the 3 starter attunements + any future additions.
-- Every other table is per-user: authenticated sees their own rows via
-- (SELECT auth.uid()) initPlan wrapping (migration 183 pattern), service_role
-- is full-access for backend operations.

ALTER TABLE journal_attunements           ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_fragments             ENABLE ROW LEVEL SECURITY;
ALTER TABLE fragment_generation_requests  ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_constellations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE constellation_fragments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_attunements              ENABLE ROW LEVEL SECURITY;
ALTER TABLE resonance_profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_palimpsests           ENABLE ROW LEVEL SECURITY;

-- Catalog: public to authenticated, writes via service_role only.
CREATE POLICY journal_attunements_auth_select
    ON journal_attunements FOR SELECT TO authenticated
    USING (enabled);
CREATE POLICY journal_attunements_service_role
    ON journal_attunements FOR ALL TO service_role
    USING (TRUE) WITH CHECK (TRUE);

-- Per-user fragment access.
CREATE POLICY journal_fragments_owner_select
    ON journal_fragments FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);
CREATE POLICY journal_fragments_service_role
    ON journal_fragments FOR ALL TO service_role
    USING (TRUE) WITH CHECK (TRUE);

-- Generation queue: backend-only. Users never touch this directly.
CREATE POLICY fragment_generation_requests_service_role
    ON fragment_generation_requests FOR ALL TO service_role
    USING (TRUE) WITH CHECK (TRUE);

-- Constellations: full CRUD for owner.
CREATE POLICY journal_constellations_owner_all
    ON journal_constellations FOR ALL TO authenticated
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY journal_constellations_service_role
    ON journal_constellations FOR ALL TO service_role
    USING (TRUE) WITH CHECK (TRUE);

-- Junction inherits owner from constellation. Using EXISTS with the owner
-- check on the parent, wrapped in (SELECT …) so Postgres initPlan-caches it.
CREATE POLICY constellation_fragments_owner_all
    ON constellation_fragments FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM journal_constellations c
        WHERE c.id = constellation_fragments.constellation_id
          AND c.user_id = (SELECT auth.uid())
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM journal_constellations c
        WHERE c.id = constellation_fragments.constellation_id
          AND c.user_id = (SELECT auth.uid())
    ));
CREATE POLICY constellation_fragments_service_role
    ON constellation_fragments FOR ALL TO service_role
    USING (TRUE) WITH CHECK (TRUE);

-- User attunements: read-only for owner (unlock is backend-driven).
CREATE POLICY user_attunements_owner_select
    ON user_attunements FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);
CREATE POLICY user_attunements_service_role
    ON user_attunements FOR ALL TO service_role
    USING (TRUE) WITH CHECK (TRUE);

-- Resonance profile: owner can SELECT (admin-only UI reads this in P4+);
-- writes are backend-only since the profile aggregates from fragment inserts.
CREATE POLICY resonance_profiles_owner_select
    ON resonance_profiles FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);
CREATE POLICY resonance_profiles_service_role
    ON resonance_profiles FOR ALL TO service_role
    USING (TRUE) WITH CHECK (TRUE);

-- Palimpsests: read-only for owner (generation is backend-driven).
CREATE POLICY journal_palimpsests_owner_select
    ON journal_palimpsests FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);
CREATE POLICY journal_palimpsests_service_role
    ON journal_palimpsests FOR ALL TO service_role
    USING (TRUE) WITH CHECK (TRUE);


-- ── Seed: 3 starter attunements (AD-9) ────────────────────────────────────
--
-- Maps three resonance-detection types to three game systems:
--   Hesitation  → emotional    → Dungeon (wait-and-observe threshold option)
--   Mercy       → archetype    → Epoch   (Observer operative class)
--   Tremor      → temporal     → Simulation (bleed signature visible to others with Tremor)
--
-- contradiction-type constellations still crystallize and produce an Insight,
-- they just don't unlock an attunement in the starter set. Future migrations
-- can add a 4th attunement for the contradiction channel.

INSERT INTO journal_attunements (
    slug, name_de, name_en, description_de, description_en,
    system_hook, effect, required_resonance_type
) VALUES
    (
        'einstimmung_zoegern',
        'Einstimmung des Zögerns',
        'Hesitation Attunement',
        'In Dungeon-Läufen erscheint an Schwellen eine zusätzliche Option: warten und beobachten. Enthüllt verborgene Information, kostet einen Stress-Tick.',
        'In dungeon runs a new threshold option appears: wait and observe. Reveals hidden information at the cost of one stress tick.',
        'dungeon_option',
        '{"hook": "dungeon_threshold_wait_option", "reveals_hidden_info": true, "stress_cost": 1}'::jsonb,
        'emotional'
    ),
    (
        'einstimmung_gnade',
        'Einstimmung der Gnade',
        'Mercy Attunement',
        'Schaltet in Epochen eine neue Operativ-Klasse frei: der Beobachter. Sammelt Informationen ohne das Risiko oder den Ertrag aktiver Spionage.',
        'Unlocks a new operative class in epochs: the Observer. Gathers intelligence without the risk or reward of active espionage.',
        'epoch_option',
        '{"hook": "epoch_operative_class", "class_slug": "observer"}'::jsonb,
        'archetype'
    ),
    (
        'einstimmung_beben',
        'Einstimmung des Bebens',
        'Tremor Attunement',
        'Bleed-Echos aus deinen Simulationen tragen eine feine emotionale Signatur. Sichtbar für andere Spieler, die ebenfalls die Einstimmung des Bebens aktiv haben.',
        'Bleed echoes from your simulations carry a subtle emotional signature, visible to other players who also have the Tremor attunement active.',
        'simulation_option',
        '{"hook": "simulation_bleed_emotional_signature", "visible_to_tremor_holders": true}'::jsonb,
        'temporal'
    )
ON CONFLICT (slug) DO NOTHING;


-- ── Seed: ai_budget purpose rows (AD-7) ───────────────────────────────────
--
-- Bureau Ops Ledger surfaces these from day 1. Launch-generous; tune down
-- from real usage after the first week per plan §7 "Bureau Ops sanity".
--   fragment_generation     — $3/day global, covers ~500 DeepSeek V3 calls.
--   constellation_insight   — $1/day global, covers ~50 Sonnet calls.
--   palimpsest_reflection   — $1.50/day global, covers ~30 Sonnet calls.
-- These cap the sum across all simulations; per-simulation caps can be
-- added later via scope='simulation' rows in admin UI.

INSERT INTO ai_budget (
    scope, scope_key, period, max_usd, soft_warn_pct, hard_block_pct, enabled
) VALUES
    ('purpose', 'fragment_generation',    'day', 3.0000, 75, 100, TRUE),
    ('purpose', 'constellation_insight',  'day', 1.0000, 75, 100, TRUE),
    ('purpose', 'palimpsest_reflection',  'day', 1.5000, 75, 100, TRUE)
ON CONFLICT (scope, scope_key, period) DO NOTHING;


-- ── Comments (catalog documentation) ──────────────────────────────────────

COMMENT ON TABLE journal_fragments IS
    'Atomic journal entries. Six fragment types (imprint/signature/echo/impression/mark/tremor) mapping six source systems. thematic_tags feeds the hidden resonance_profile aggregation. See docs/plans/resonance-journal-implementation-plan.md.';

COMMENT ON TABLE fragment_generation_requests IS
    'Async generation queue (AD-1). FragmentGenerationScheduler pops pending rows every ~60s, calls the LLM via BudgetContext, inserts the resulting fragment, marks done. Singular fragments bypass this and generate inline.';

COMMENT ON TABLE journal_constellations IS
    'Player-composed groupings of fragments (P2). Crystallization runs the insight LLM and optionally unlocks an attunement when resonance_type matches the attunement''s required_resonance_type.';

COMMENT ON TABLE journal_attunements IS
    'Catalog of meta-progression unlocks. Attunements EXPAND gameplay options (Loop Hero / Deep Rock Galactic model), they do not strengthen numbers. 3 starters seeded here; post-launch additions via new rows.';

COMMENT ON TABLE resonance_profiles IS
    'Hidden 8-dimensional fingerprint, per-user GLOBAL (AD-5: crosses simulations). Updated incrementally from fragment thematic_tags. Never shown to player as numbers; manifests as Palimpsest vocabulary, fragment frequency, and attunement availability.';

COMMENT ON TABLE journal_palimpsests IS
    'Deep literary reflection, LLM-generated on every 30th fragment insert (AD-4). resonance_snapshot captures the profile state at generation time so future Palimpsests can reference "how the profile looked then".';

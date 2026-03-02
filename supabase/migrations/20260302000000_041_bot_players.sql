-- Migration 041: Bot Players for Competitive Epochs
-- Adds bot_players table, bot_decision_log table, epoch_participants bot columns,
-- epoch_chat_messages sender_type column for bot chat messages.

-- ══════════════════════════════════════════════════════════════
-- 1. bot_players — reusable bot presets ("deck of opponents")
-- ══════════════════════════════════════════════════════════════

CREATE TABLE bot_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL CHECK (char_length(name) >= 1 AND char_length(name) <= 50),
    personality TEXT NOT NULL CHECK (personality IN ('sentinel', 'warlord', 'diplomat', 'strategist', 'chaos')),
    difficulty TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
    config JSONB NOT NULL DEFAULT '{}',
    created_by_id UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- updated_at trigger
CREATE TRIGGER set_updated_at_bot_players
    BEFORE UPDATE ON bot_players
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Indexes
CREATE INDEX idx_bot_players_created_by ON bot_players(created_by_id);

-- RLS
ALTER TABLE bot_players ENABLE ROW LEVEL SECURITY;

-- Creator can CRUD their own bots
CREATE POLICY bot_players_select ON bot_players FOR SELECT
    TO authenticated USING (true);  -- All authenticated users can see bots (needed for lobby display)

CREATE POLICY bot_players_insert ON bot_players FOR INSERT
    TO authenticated WITH CHECK (created_by_id = auth.uid());

CREATE POLICY bot_players_update ON bot_players FOR UPDATE
    TO authenticated USING (created_by_id = auth.uid());

CREATE POLICY bot_players_delete ON bot_players FOR DELETE
    TO authenticated USING (created_by_id = auth.uid());


-- ══════════════════════════════════════════════════════════════
-- 2. epoch_participants — add bot columns
-- ══════════════════════════════════════════════════════════════

ALTER TABLE epoch_participants
    ADD COLUMN is_bot BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN bot_player_id UUID REFERENCES bot_players(id);

-- Ensure bot_player_id is set when is_bot=true and vice versa
ALTER TABLE epoch_participants
    ADD CONSTRAINT chk_bot_consistency CHECK (
        (is_bot = FALSE AND bot_player_id IS NULL) OR
        (is_bot = TRUE AND bot_player_id IS NOT NULL)
    );


-- ══════════════════════════════════════════════════════════════
-- 3. bot_decision_log — audit trail for bot decisions
-- ══════════════════════════════════════════════════════════════

CREATE TABLE bot_decision_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    epoch_id UUID NOT NULL REFERENCES game_epochs(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES epoch_participants(id) ON DELETE CASCADE,
    cycle_number INTEGER NOT NULL,
    phase TEXT NOT NULL CHECK (phase IN ('analysis', 'allocation', 'deployment', 'alliance', 'chat')),
    decision JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bot_decision_log_epoch ON bot_decision_log(epoch_id, cycle_number);
CREATE INDEX idx_bot_decision_log_participant ON bot_decision_log(participant_id);

-- RLS: epoch participants can read (transparency), insert via admin client only
ALTER TABLE bot_decision_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY bot_decision_log_select ON bot_decision_log FOR SELECT
    TO authenticated USING (
        EXISTS (
            SELECT 1 FROM epoch_participants ep
            JOIN simulation_members sm ON sm.simulation_id = ep.simulation_id
            WHERE ep.epoch_id = bot_decision_log.epoch_id
            AND sm.user_id = auth.uid()
        )
    );

-- Anon can read decision logs (public transparency)
CREATE POLICY bot_decision_log_anon_select ON bot_decision_log FOR SELECT
    TO anon USING (true);

-- Insert/update/delete only via service_role (admin client)
CREATE POLICY bot_decision_log_service_insert ON bot_decision_log FOR INSERT
    TO service_role WITH CHECK (true);


-- ══════════════════════════════════════════════════════════════
-- 4. epoch_chat_messages — add sender_type for bot messages
-- ══════════════════════════════════════════════════════════════

ALTER TABLE epoch_chat_messages
    ADD COLUMN sender_type TEXT NOT NULL DEFAULT 'human'
    CHECK (sender_type IN ('human', 'bot'));

-- For bot messages, sender_id will be the epoch creator's user ID
-- (bots are system actors, the creator initiates their actions).
-- sender_simulation_id identifies which simulation the bot controls.

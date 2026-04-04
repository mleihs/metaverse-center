-- Migration 180: Chat message reactions
--
-- Emoji reactions on chat messages. Single table with unique constraint
-- (message_id, user_id, emoji) — one reaction per emoji per user per message.
--
-- Architecture decision: aggregation via Postgres RPC (get_message_reactions)
-- rather than Python-side grouping. The RPC returns per-emoji counts with
-- reacted_by_me flag, avoiding N+1 and keeping aggregation in the DB layer
-- where it belongs.
--
-- Broadcast trigger notifies connected clients when reactions change,
-- following the pattern established in migration 179 (chat_message_broadcast).

-- ── Table ──────────────────────────────────────────────────

CREATE TABLE chat_message_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    emoji TEXT NOT NULL CHECK (char_length(emoji) BETWEEN 1 AND 8),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (message_id, user_id, emoji)
);

CREATE INDEX idx_chat_reactions_message ON chat_message_reactions(message_id);

-- ── RLS ────────────────────────────────────────────────────

ALTER TABLE chat_message_reactions ENABLE ROW LEVEL SECURITY;

-- Anyone can read reactions (same visibility as messages themselves)
CREATE POLICY "chat_reactions_select"
    ON chat_message_reactions FOR SELECT
    USING (true);

-- Users can insert their own reactions
CREATE POLICY "chat_reactions_insert"
    ON chat_message_reactions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own reactions
CREATE POLICY "chat_reactions_delete"
    ON chat_message_reactions FOR DELETE
    USING (auth.uid() = user_id);

-- ── RPC: Aggregated reaction summaries ─────────────────────
-- Returns per-emoji counts with reacted_by_me for the calling user.
-- Called from backend with user JWT → auth.uid() resolves correctly.

CREATE OR REPLACE FUNCTION get_message_reactions(p_message_ids UUID[])
RETURNS TABLE (
    message_id UUID,
    emoji TEXT,
    count BIGINT,
    reacted_by_me BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.message_id,
        r.emoji,
        COUNT(*)::BIGINT AS count,
        BOOL_OR(r.user_id = auth.uid()) AS reacted_by_me
    FROM chat_message_reactions r
    WHERE r.message_id = ANY(p_message_ids)
    GROUP BY r.message_id, r.emoji
    ORDER BY r.message_id, MIN(r.created_at);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant to authenticated only (not anon — reactions require auth)
GRANT EXECUTE ON FUNCTION get_message_reactions(UUID[]) TO authenticated;

-- ── RPC: Toggle reaction (atomic upsert/delete) ───────────
-- Idempotent: if reaction exists → delete; if not → insert.
-- Returns 'added' or 'removed' so frontend knows the outcome.
-- Atomic — no race conditions from concurrent toggles.

CREATE OR REPLACE FUNCTION toggle_message_reaction(
    p_message_id UUID,
    p_emoji TEXT
)
RETURNS TEXT AS $$
DECLARE
    v_deleted BOOLEAN;
BEGIN
    -- Attempt delete first (cheaper than INSERT ... ON CONFLICT)
    DELETE FROM chat_message_reactions
    WHERE message_id = p_message_id
      AND user_id = auth.uid()
      AND emoji = p_emoji;

    IF FOUND THEN
        RETURN 'removed';
    END IF;

    -- Not found → insert
    INSERT INTO chat_message_reactions (message_id, user_id, emoji)
    VALUES (p_message_id, auth.uid(), p_emoji);

    RETURN 'added';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION toggle_message_reaction(UUID, TEXT) TO authenticated;

-- ── Broadcast trigger ──────────────────────────────────────
-- Broadcasts reaction changes to the conversation channel so connected
-- clients can update reaction counts in real-time.
-- Topic: chat:{conversation_id}:reactions
-- Payload includes the updated reaction summary for the affected message.

CREATE OR REPLACE FUNCTION broadcast_chat_reaction()
RETURNS TRIGGER AS $$
DECLARE
    v_conversation_id UUID;
    v_message_id UUID;
BEGIN
    -- Determine message_id from INSERT or DELETE row
    v_message_id := COALESCE(NEW.message_id, OLD.message_id);

    -- Look up conversation_id from the parent message
    SELECT conversation_id INTO v_conversation_id
    FROM chat_messages
    WHERE id = v_message_id;

    IF v_conversation_id IS NULL THEN
        RETURN NULL;
    END IF;

    PERFORM realtime.send(
        jsonb_build_object(
            'message_id', v_message_id,
            'conversation_id', v_conversation_id
        ),
        'reaction_changed',
        'chat:' || v_conversation_id::text || ':reactions',
        true
    );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_broadcast_chat_reaction
    AFTER INSERT OR DELETE ON chat_message_reactions
    FOR EACH ROW EXECUTE FUNCTION broadcast_chat_reaction();

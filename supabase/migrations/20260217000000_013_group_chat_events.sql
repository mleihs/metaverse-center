-- Migration 013: Group Chat + Event References
-- Enables multi-agent conversations and event referencing in chat

-- 1. Junction-Table: which Agents are in which Conversation
CREATE TABLE public.chat_conversation_agents (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id uuid NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    added_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE(conversation_id, agent_id)
);

-- 2. chat_conversations: agent_id nullable, remove old UNIQUE constraint
ALTER TABLE chat_conversations ALTER COLUMN agent_id DROP NOT NULL;
DROP INDEX IF EXISTS chat_conversations_simulation_id_user_id_agent_id_key;

-- 3. chat_messages: agent_id for Agent attribution (which agent responded)
ALTER TABLE chat_messages ADD COLUMN agent_id uuid REFERENCES agents(id) ON DELETE SET NULL;

-- 4. Event references per Conversation
CREATE TABLE public.chat_event_references (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id uuid NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    referenced_by uuid NOT NULL REFERENCES auth.users(id),
    referenced_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE(conversation_id, event_id)
);

-- 5. Migrate existing 1:1 conversations into junction table
INSERT INTO chat_conversation_agents (conversation_id, agent_id)
SELECT id, agent_id FROM chat_conversations WHERE agent_id IS NOT NULL;

-- 6. Backfill existing assistant messages with agent_id
UPDATE chat_messages m SET agent_id = c.agent_id
FROM chat_conversations c
WHERE m.conversation_id = c.id AND m.sender_role = 'assistant' AND c.agent_id IS NOT NULL;

-- 7. Indexes
CREATE INDEX idx_conv_agents_conv ON chat_conversation_agents(conversation_id);
CREATE INDEX idx_conv_agents_agent ON chat_conversation_agents(agent_id);
CREATE INDEX idx_chat_messages_agent ON chat_messages(agent_id);
CREATE INDEX idx_chat_event_refs_conv ON chat_event_references(conversation_id);

-- 8. RLS
ALTER TABLE chat_conversation_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_event_references ENABLE ROW LEVEL SECURITY;

-- conversation_agents: only own conversations
CREATE POLICY conv_agents_select ON chat_conversation_agents FOR SELECT
    USING (EXISTS (SELECT 1 FROM chat_conversations WHERE id = conversation_id AND user_id = auth.uid()));
CREATE POLICY conv_agents_insert ON chat_conversation_agents FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM chat_conversations WHERE id = conversation_id AND user_id = auth.uid()));
CREATE POLICY conv_agents_delete ON chat_conversation_agents FOR DELETE
    USING (EXISTS (SELECT 1 FROM chat_conversations WHERE id = conversation_id AND user_id = auth.uid()));

-- event_references: only own conversations
CREATE POLICY event_refs_select ON chat_event_references FOR SELECT
    USING (EXISTS (SELECT 1 FROM chat_conversations WHERE id = conversation_id AND user_id = auth.uid()));
CREATE POLICY event_refs_insert ON chat_event_references FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM chat_conversations WHERE id = conversation_id AND user_id = auth.uid()));
CREATE POLICY event_refs_delete ON chat_event_references FOR DELETE
    USING (EXISTS (SELECT 1 FROM chat_conversations WHERE id = conversation_id AND user_id = auth.uid()));

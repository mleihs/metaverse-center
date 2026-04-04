-- Migration 179: Chat message broadcast via Supabase Realtime
--
-- Broadcasts new chat_messages to the conversation's Realtime channel,
-- enabling real-time message delivery to connected clients (other tabs,
-- future multi-user chat). Follows the epoch_chat pattern from migration 037.
--
-- Topic convention: chat:{conversation_id}:messages (private)
-- Event: new_message
-- Payload: controlled via jsonb_build_object (not to_jsonb(NEW))

CREATE OR REPLACE FUNCTION broadcast_chat_message()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM realtime.send(
    jsonb_build_object(
      'id', NEW.id,
      'conversation_id', NEW.conversation_id,
      'sender_role', NEW.sender_role,
      'content', NEW.content,
      'agent_id', NEW.agent_id,
      'metadata', NEW.metadata,
      'created_at', NEW.created_at
    ),
    'new_message',
    'chat:' || NEW.conversation_id::text || ':messages',
    true
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_broadcast_chat_message
  AFTER INSERT ON chat_messages
  FOR EACH ROW EXECUTE FUNCTION broadcast_chat_message();

-- Migration 182: Prevent empty chat messages at DB level (defence-in-depth)
--
-- Root cause: chat_messages.content had CHECK (length(content) <= 5000) but no
-- minimum length check. Empty or whitespace-only strings could be persisted by
-- any code path that bypasses Pydantic validation (e.g. _persist_ai_response
-- after sanitization edge cases). The sibling table epoch_chat_messages already
-- enforces CHECK (char_length(content) BETWEEN 1 AND 2000) — this brings
-- chat_messages to parity.
--
-- Strategy: clean existing empty rows first, then add constraint.

-- Step 1: Delete any existing empty/whitespace-only messages (ghost rows).
-- These have no user-visible content and were created by the empty-response bug.
DELETE FROM chat_messages
WHERE TRIM(content) = '' OR content IS NULL;

-- Step 2: Replace the old max-length-only constraint with a combined check
-- that enforces both non-empty and max-length.
ALTER TABLE chat_messages
  DROP CONSTRAINT IF EXISTS chat_messages_content_check;

ALTER TABLE chat_messages
  ADD CONSTRAINT chat_messages_content_not_empty_and_bounded
  CHECK (TRIM(content) != '' AND length(content) <= 5000);

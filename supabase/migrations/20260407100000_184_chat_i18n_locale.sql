-- Migration 184: Chat i18n — locale tracking on conversations
--
-- Adds locale column to chat_conversations so new conversations record
-- the language they were created in. AI-generated messages store locale
-- in their existing metadata JSONB (no schema change needed for messages).
--
-- Root cause: Agent responses were a mix of German and English because
-- the AI model received English agent personality with only a weak
-- "respond in Deutsch" suffix instruction. This migration enables the
-- backend to track conversation locale for proper context assembly and
-- WCAG 3.1.2 compliance (lang attributes on message elements).

-- 1. Add locale column (default 'de' matching most simulations)
ALTER TABLE public.chat_conversations
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'de';

-- 2. Backfill existing conversations from their simulation's content_locale
UPDATE chat_conversations c
SET locale = COALESCE(
  (SELECT ss.setting_value::text
   FROM simulation_settings ss
   WHERE ss.simulation_id = c.simulation_id
     AND ss.setting_key = 'general.content_locale'
   LIMIT 1),
  'de'
);

-- 3. Check constraint: ISO 639-1 two-letter codes
ALTER TABLE chat_conversations
  ADD CONSTRAINT chat_conversations_locale_valid
  CHECK (locale ~ '^[a-z]{2}$');

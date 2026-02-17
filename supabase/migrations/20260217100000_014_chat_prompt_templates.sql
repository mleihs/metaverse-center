-- Migration 014: Add chat prompt templates for event context, group instructions, and reactions
-- These templates allow the chat AI service to use configurable prompts
-- instead of hardcoded strings.

INSERT INTO prompt_templates (template_type, prompt_category, locale, template_name, prompt_content, is_system_default, is_active)
VALUES
  -- chat_event_context: wrapper around the full event list
  ('chat_event_context', 'chat', 'en', 'Chat Event Context (EN)',
   E'--- REFERENCED EVENTS ---\n{event_list}\n--- END EVENTS ---',
   true, true),
  ('chat_event_context', 'chat', 'de', 'Chat Event-Kontext (DE)',
   E'--- REFERENZIERTE EVENTS ---\n{event_list}\n--- ENDE EVENTS ---',
   true, true),

  -- chat_event_item: per-event block within the context
  ('chat_event_item', 'chat', 'en', 'Chat Event Item (EN)',
   E'[{event_title}] (Type: {event_type}, Impact: {impact_level}/10, Date: {occurred_at})\n{event_description}',
   true, true),
  ('chat_event_item', 'chat', 'de', 'Chat Event-Eintrag (DE)',
   E'[{event_title}] (Typ: {event_type}, Impact: {impact_level}/10, Datum: {occurred_at})\n{event_description}',
   true, true),

  -- chat_group_instruction: instruction for group conversations
  ('chat_group_instruction', 'chat', 'en', 'Chat Group Instruction (EN)',
   'You are in a group conversation. The other participants are: {other_agent_names}. Respond to the user''s and other agents'' statements. Reference the mentioned events when relevant to the conversation.',
   true, true),
  ('chat_group_instruction', 'chat', 'de', 'Chat Gruppen-Instruktion (DE)',
   'Du befindest dich in einem Gruppengespraech. Die anderen Teilnehmer sind: {other_agent_names}. Reagiere auf die Aussagen des Users und der anderen Agenten. Beziehe dich auf die referenzierten Events, wenn sie fuer das Gespraech relevant sind.',
   true, true),

  -- chat_event_reaction: format for agent reactions to events
  ('chat_event_reaction', 'chat', 'en', 'Chat Event Reaction (EN)',
   '{agent_name} reacted to "{event_title}": {reaction_text} (Emotion: {emotion})',
   true, true),
  ('chat_event_reaction', 'chat', 'de', 'Chat Event-Reaktion (DE)',
   '{agent_name} reagierte auf "{event_title}": {reaction_text} (Emotion: {emotion})',
   true, true)
ON CONFLICT DO NOTHING;

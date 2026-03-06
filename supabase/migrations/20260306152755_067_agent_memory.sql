-- 067: Agent Memory & Reflection — pgvector semantic memory system

-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Memory enums
CREATE TYPE memory_type AS ENUM ('observation', 'reflection');
CREATE TYPE memory_source_type AS ENUM ('chat', 'event_reaction', 'system', 'reflection');

CREATE TABLE public.agent_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  simulation_id UUID NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
  memory_type memory_type NOT NULL DEFAULT 'observation',
  content TEXT NOT NULL,
  content_de TEXT,
  importance INT NOT NULL DEFAULT 5 CHECK (importance BETWEEN 1 AND 10),
  source_type memory_source_type NOT NULL DEFAULT 'system',
  source_id UUID,
  embedding extensions.vector(1536),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_accessed_at TIMESTAMPTZ
);

CREATE INDEX idx_memories_agent ON agent_memories(agent_id, simulation_id);
CREATE INDEX idx_memories_retrieval ON agent_memories(agent_id, importance DESC, created_at DESC);
CREATE INDEX idx_memories_embedding ON agent_memories
  USING ivfflat (embedding extensions.vector_cosine_ops) WITH (lists = 100);

ALTER TABLE agent_memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "memories_public_read" ON agent_memories FOR SELECT USING (true);
CREATE POLICY "memories_service_write" ON agent_memories FOR ALL
  USING (auth.role() = 'service_role');

-- Semantic + importance + recency retrieval function (Stanford formula)
CREATE OR REPLACE FUNCTION retrieve_agent_memories(
  p_agent_id UUID,
  p_query_embedding extensions.vector(1536) DEFAULT NULL,
  p_top_k INT DEFAULT 10
) RETURNS TABLE (
  id UUID, memory_type memory_type, content TEXT, content_de TEXT,
  importance INT, source_type memory_source_type, created_at TIMESTAMPTZ,
  retrieval_score FLOAT
) LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT
    m.id, m.memory_type, m.content, m.content_de,
    m.importance, m.source_type, m.created_at,
    (
      CASE WHEN p_query_embedding IS NOT NULL AND m.embedding IS NOT NULL
        THEN 0.4 * (1 - (m.embedding <=> p_query_embedding))
        ELSE 0
      END
      + 0.4 * (m.importance::float / 10.0)
      + 0.2 * (1.0 / (1.0 + EXTRACT(EPOCH FROM (now() - m.created_at)) / 86400.0))
    )::FLOAT AS retrieval_score
  FROM agent_memories m
  WHERE m.agent_id = p_agent_id
  ORDER BY retrieval_score DESC
  LIMIT p_top_k;
$$;

-- Prompt templates for memory extraction and reflection
INSERT INTO prompt_templates (
  id, simulation_id, template_type, prompt_category, template_name, locale,
  prompt_content, system_prompt, temperature, max_tokens
) VALUES
(gen_random_uuid(), NULL, 'memory_extraction', 'text_generation',
  'Memory Extraction', 'en',
  'Analyze this conversation between a user and {agent_name} in {simulation_name}:

User: {user_message}
{agent_name}: {agent_response}

Extract 0-2 key observations that {agent_name} would remember.
Return JSON: {"observations": [{"content": "...", "importance": 1-10}]}
If nothing noteworthy: {"observations": []}',
  'You extract memorable observations from conversations. Focus on emotionally significant, relationship-changing, or world-revealing moments. Trivial small talk produces empty observations.',
  0.3, 512),

(gen_random_uuid(), NULL, 'memory_reflection', 'text_generation',
  'Memory Reflection', 'en',
  'You are {agent_name} in {simulation_name}. Review your recent observations:

{observations_text}

Synthesize 1-3 higher-level reflections about patterns, relationships, or insights you notice.
Return JSON: {"reflections": [{"content": "...", "importance": 1-10}]}',
  'You are reflecting on your experiences. Generate profound, character-consistent insights that reveal growth or understanding. Reflections should be more abstract than raw observations.',
  0.7, 1024);

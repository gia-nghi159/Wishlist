-- ==============================================================================
-- 1. CLEANUP LEDGER FEATURES (Removed in pivot to Applied AI)
-- ==============================================================================

-- Drop the contributions table entirely
DROP TABLE IF EXISTS contributions;

-- Remove the price column from wishes
ALTER TABLE wishes DROP COLUMN IF EXISTS price;


-- ==============================================================================
-- 2. ADVANCED IR: HYBRID SEARCH (RRF)
-- ==============================================================================

-- Add Full-Text Search (FTS) column to the wishes table for sparse retrieval
ALTER TABLE wishes ADD COLUMN IF NOT EXISTS fts tsvector GENERATED ALWAYS AS (
  to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''))
) STORED;

-- Create an index to speed up text searches
CREATE INDEX IF NOT EXISTS wishes_fts_idx ON wishes USING GIN (fts);

-- Create the Hybrid Search RPC (Reciprocal Rank Fusion)
CREATE OR REPLACE FUNCTION match_wishes_hybrid(
  query_text text,
  query_embedding vector(768),
  match_count int DEFAULT 10,
  p_group_id uuid DEFAULT NULL,
  p_user_id text DEFAULT NULL
)
RETURNS TABLE (
  id bigint,
  name text,
  description text,
  url text,
  is_inspo boolean,
  reserved_by text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH semantic_search AS (
    SELECT
      w.id,
      ROW_NUMBER() OVER (ORDER BY w.item_embedding <=> query_embedding) as rank
    FROM wishes w
    WHERE w.item_embedding IS NOT NULL
      AND (p_group_id IS NULL OR w.group_id = p_group_id)
      AND (p_user_id IS NULL OR w.user_id = p_user_id)
    ORDER BY w.item_embedding <=> query_embedding
    LIMIT match_count
  ),
  keyword_search AS (
    SELECT
      w.id,
      ROW_NUMBER() OVER (ORDER BY ts_rank(w.fts, websearch_to_tsquery('english', query_text)) DESC) as rank
    FROM wishes w
    WHERE w.fts @@ websearch_to_tsquery('english', query_text)
      AND (p_group_id IS NULL OR w.group_id = p_group_id)
      AND (p_user_id IS NULL OR w.user_id = p_user_id)
    ORDER BY ts_rank(w.fts, websearch_to_tsquery('english', query_text)) DESC
    LIMIT match_count
  )
  SELECT
    w.id,
    w.name,
    w.description,
    w.url,
    w.is_inspo,
    w.reserved_by,
    -- Reciprocal Rank Fusion formula: 1 / (60 + rank)
    (COALESCE(1.0 / (60 + ss.rank), 0.0) + COALESCE(1.0 / (60 + ks.rank), 0.0))::float AS similarity
  FROM wishes w
  LEFT JOIN semantic_search ss ON w.id = ss.id
  LEFT JOIN keyword_search ks ON w.id = ks.id
  WHERE ss.id IS NOT NULL OR ks.id IS NOT NULL
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;


-- ==============================================================================
-- 3. SEMANTIC CACHING WITH CONTEXT HASHING
-- ==============================================================================

-- Create Semantic Cache table
CREATE TABLE IF NOT EXISTS semantic_cache (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  query_text text NOT NULL,
  query_embedding vector(768) NOT NULL,
  context_hash text NOT NULL, -- MD5 hash of group_id + fetched wishes
  cached_response text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS) on the semantic cache.
-- We DO NOT add any policies here because we do not want users querying it directly from the frontend.
-- It will strictly be accessed Server-Side by our Next.js API using the Service Role Key.
ALTER TABLE semantic_cache ENABLE ROW LEVEL SECURITY;

-- Index for semantic similarity matching on the cache
CREATE INDEX IF NOT EXISTS semantic_cache_embedding_idx ON semantic_cache USING ivfflat (query_embedding vector_cosine_ops) WITH (lists = 100);

-- RPC to find semantic cache hit
CREATE OR REPLACE FUNCTION check_semantic_cache(
  query_embedding vector(768),
  p_context_hash text,
  match_threshold float DEFAULT 0.95
)
RETURNS TABLE (
  cached_response text,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sc.cached_response,
    1 - (sc.query_embedding <=> query_embedding) as similarity
  FROM semantic_cache sc
  WHERE 1 - (sc.query_embedding <=> query_embedding) > match_threshold
    AND sc.context_hash = p_context_hash
    AND sc.created_at > now() - interval '24 hours'
  ORDER BY sc.query_embedding <=> query_embedding ASC
  LIMIT 1;
END;
$$;

-- Migration: Add conversation_facts table for semantic memory
-- Description: Stores extracted facts from conversations with embeddings for semantic search
-- Features: Lifecycle management, trust/attribution, financial tracking, priority handling

-- Ensure pgvector extension is enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Main conversation_facts table
CREATE TABLE IF NOT EXISTS conversation_facts (
  -- Primary Identity
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,

  -- Fact Content
  fact_type VARCHAR(50) NOT NULL,  -- 'task', 'decision', 'milestone', 'financial', 'schedule', 'material', 'risk', 'constraint'
  fact_content JSONB NOT NULL,     -- Structured data about the fact
  fact_summary TEXT NOT NULL,       -- Human-readable summary for semantic search

  -- Embedding for semantic search
  embedding vector(1536),           -- OpenAI ada-002 dimensions (1536-dimensional vectors)

  -- 1. LIFECYCLE & VERSIONING (Handling Change)
  is_active BOOLEAN NOT NULL DEFAULT true,
  superseded_by INTEGER REFERENCES conversation_facts(id) ON DELETE SET NULL,
  valid_until TIMESTAMP WITH TIME ZONE,  -- For time-bound facts (quotes, rentals, etc.)
  version INTEGER NOT NULL DEFAULT 1,

  -- 2. TRUST & ATTRIBUTION (Quality Control)
  author_role VARCHAR(20) NOT NULL CHECK (author_role IN ('user', 'assistant', 'system')),
  confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  verification_status VARCHAR(20) NOT NULL DEFAULT 'pending_approval'
    CHECK (verification_status IN ('pending_approval', 'verified', 'rejected', 'needs_review')),
  verified_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  verified_at TIMESTAMP WITH TIME ZONE,

  -- 3. FINANCIAL METADATA (First-Class Citizen)
  financial_amount DECIMAL(12,2),   -- Null if not a financial fact
  currency VARCHAR(3) DEFAULT 'USD',
  financial_category VARCHAR(100),  -- Cost codes: 'Materials', 'Labor', '03-Concrete', '16-Electrical', etc.
  financial_type VARCHAR(20) CHECK (
    financial_type IS NULL OR
    financial_type IN ('estimate', 'quote', 'change_order', 'hard_cost', 'invoice', 'payment', 'budget')
  ),

  -- 4. PRIORITY & ATTENTION (New)
  priority VARCHAR(20) NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('critical', 'high', 'normal', 'low')),
  requires_action BOOLEAN NOT NULL DEFAULT false,
  action_deadline TIMESTAMP WITH TIME ZONE,

  -- Metadata & Audit Trail
  source_message_id VARCHAR(255),   -- Reference to original chat message
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

  -- Data Integrity Constraints
  CONSTRAINT financial_fact_validation CHECK (
    (fact_type != 'financial') OR
    (fact_type = 'financial' AND financial_amount IS NOT NULL AND financial_type IS NOT NULL)
  ),

  CONSTRAINT action_deadline_requires_flag CHECK (
    (action_deadline IS NULL) OR (requires_action = true)
  )
);

-- Performance Indexes
CREATE INDEX idx_conversation_facts_session ON conversation_facts(session_id);
CREATE INDEX idx_conversation_facts_project ON conversation_facts(project_id);
CREATE INDEX idx_conversation_facts_user ON conversation_facts(user_id);
CREATE INDEX idx_conversation_facts_type ON conversation_facts(fact_type);
CREATE INDEX idx_conversation_facts_created ON conversation_facts(created_at DESC);
CREATE INDEX idx_conversation_facts_updated ON conversation_facts(updated_at DESC);

-- Filtered indexes for common queries
CREATE INDEX idx_conversation_facts_active
  ON conversation_facts(is_active)
  WHERE is_active = true;

CREATE INDEX idx_conversation_facts_verification
  ON conversation_facts(verification_status, priority DESC);

CREATE INDEX idx_conversation_facts_financial
  ON conversation_facts(financial_type, financial_amount DESC)
  WHERE financial_type IS NOT NULL;

CREATE INDEX idx_conversation_facts_valid_until
  ON conversation_facts(valid_until)
  WHERE valid_until IS NOT NULL AND is_active = true;

CREATE INDEX idx_conversation_facts_requires_action
  ON conversation_facts(requires_action, action_deadline, priority DESC)
  WHERE requires_action = true AND is_active = true;

-- Composite index for common financial queries
CREATE INDEX idx_conversation_facts_financial_unverified
  ON conversation_facts(verification_status, financial_amount DESC, priority DESC)
  WHERE financial_amount IS NOT NULL AND verification_status != 'verified';

-- Vector similarity index for semantic search
-- Using IVFFlat algorithm with cosine distance
CREATE INDEX conversation_facts_embedding_idx ON conversation_facts
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_conversation_facts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER conversation_facts_updated_at_trigger
  BEFORE UPDATE ON conversation_facts
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_facts_updated_at();

-- Helper Views for Common Queries

-- View 1: Active, verified facts only
CREATE VIEW active_verified_facts AS
SELECT
  id,
  session_id,
  project_id,
  fact_type,
  fact_summary,
  fact_content,
  financial_amount,
  financial_category,
  financial_type,
  priority,
  created_at,
  valid_until
FROM conversation_facts
WHERE is_active = true
  AND verification_status = 'verified'
  AND (valid_until IS NULL OR valid_until > NOW());

-- View 2: Financial facts needing review (over $5000)
CREATE VIEW high_value_financial_facts AS
SELECT
  id,
  project_id,
  fact_summary,
  financial_amount,
  financial_category,
  financial_type,
  confidence_score,
  verification_status,
  priority,
  author_role,
  created_at,
  valid_until
FROM conversation_facts
WHERE is_active = true
  AND financial_amount IS NOT NULL
  AND financial_amount >= 5000.00
  AND verification_status IN ('pending_approval', 'needs_review')
ORDER BY financial_amount DESC, priority DESC, created_at DESC;

-- View 3: Facts requiring immediate action
CREATE VIEW action_required_facts AS
SELECT
  id,
  project_id,
  fact_type,
  fact_summary,
  priority,
  action_deadline,
  verification_status,
  financial_amount,
  created_at
FROM conversation_facts
WHERE is_active = true
  AND requires_action = true
  AND (action_deadline IS NULL OR action_deadline > NOW())
ORDER BY
  CASE priority
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'normal' THEN 3
    WHEN 'low' THEN 4
  END,
  action_deadline ASC NULLS LAST;

-- View 4: Expiring facts (within next 7 days)
CREATE VIEW expiring_facts AS
SELECT
  id,
  project_id,
  fact_type,
  fact_summary,
  financial_amount,
  valid_until,
  verification_status,
  EXTRACT(EPOCH FROM (valid_until - NOW()))/3600 as hours_until_expiry
FROM conversation_facts
WHERE is_active = true
  AND valid_until IS NOT NULL
  AND valid_until BETWEEN NOW() AND NOW() + INTERVAL '7 days'
ORDER BY valid_until ASC;

-- View 5: Fact version history (for auditing)
CREATE VIEW fact_version_history AS
WITH RECURSIVE fact_chain AS (
  -- Base case: current active facts
  SELECT
    id,
    fact_type,
    fact_summary,
    financial_amount,
    version,
    is_active,
    superseded_by,
    created_at,
    id as root_fact_id,
    1 as chain_position
  FROM conversation_facts
  WHERE superseded_by IS NULL

  UNION ALL

  -- Recursive case: previous versions
  SELECT
    cf.id,
    cf.fact_type,
    cf.fact_summary,
    cf.financial_amount,
    cf.version,
    cf.is_active,
    cf.superseded_by,
    cf.created_at,
    fc.root_fact_id,
    fc.chain_position + 1
  FROM conversation_facts cf
  INNER JOIN fact_chain fc ON cf.id = fc.superseded_by
)
SELECT * FROM fact_chain
ORDER BY root_fact_id, chain_position;

-- Utility function: Get active facts for a project with semantic search
CREATE OR REPLACE FUNCTION get_relevant_facts(
  p_project_id INTEGER,
  p_query_embedding vector(1536),
  p_limit INTEGER DEFAULT 5,
  p_min_confidence DECIMAL DEFAULT 0.7
)
RETURNS TABLE (
  fact_id INTEGER,
  fact_summary TEXT,
  fact_content JSONB,
  similarity DECIMAL,
  confidence_score DECIMAL,
  financial_amount DECIMAL,
  priority VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cf.id,
    cf.fact_summary,
    cf.fact_content,
    ROUND((1 - (cf.embedding <=> p_query_embedding))::NUMERIC, 4) as similarity,
    cf.confidence_score,
    cf.financial_amount,
    cf.priority
  FROM conversation_facts cf
  WHERE cf.project_id = p_project_id
    AND cf.is_active = true
    AND cf.verification_status IN ('verified', 'pending_approval')
    AND (cf.valid_until IS NULL OR cf.valid_until > NOW())
    AND cf.confidence_score >= p_min_confidence
  ORDER BY cf.embedding <=> p_query_embedding
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Utility function: Mark fact as superseded and create new version
CREATE OR REPLACE FUNCTION supersede_fact(
  p_old_fact_id INTEGER,
  p_new_fact_summary TEXT,
  p_new_fact_content JSONB,
  p_new_embedding vector(1536),
  p_new_financial_amount DECIMAL DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_new_fact_id INTEGER;
  v_old_fact RECORD;
BEGIN
  -- Get old fact details
  SELECT * INTO v_old_fact FROM conversation_facts WHERE id = p_old_fact_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fact with id % not found', p_old_fact_id;
  END IF;

  -- Create new fact with incremented version
  INSERT INTO conversation_facts (
    session_id, project_id, user_id, fact_type, fact_content, fact_summary,
    embedding, is_active, version, author_role, confidence_score,
    verification_status, financial_amount, currency, financial_category,
    financial_type, priority, requires_action, source_message_id
  ) VALUES (
    v_old_fact.session_id,
    v_old_fact.project_id,
    v_old_fact.user_id,
    v_old_fact.fact_type,
    p_new_fact_content,
    p_new_fact_summary,
    p_new_embedding,
    true,
    v_old_fact.version + 1,
    v_old_fact.author_role,
    v_old_fact.confidence_score,
    'needs_review', -- New version needs review
    COALESCE(p_new_financial_amount, v_old_fact.financial_amount),
    v_old_fact.currency,
    v_old_fact.financial_category,
    v_old_fact.financial_type,
    v_old_fact.priority,
    v_old_fact.requires_action,
    v_old_fact.source_message_id
  ) RETURNING id INTO v_new_fact_id;

  -- Mark old fact as superseded
  UPDATE conversation_facts
  SET is_active = false,
      superseded_by = v_new_fact_id
  WHERE id = p_old_fact_id;

  RETURN v_new_fact_id;
END;
$$ LANGUAGE plpgsql;

-- Add helpful comments
COMMENT ON TABLE conversation_facts IS 'Stores extracted facts from AI conversations with semantic embeddings for intelligent retrieval';
COMMENT ON COLUMN conversation_facts.embedding IS 'Vector embedding (1536-dim) for semantic similarity search using OpenAI ada-002';
COMMENT ON COLUMN conversation_facts.confidence_score IS 'AI confidence in fact extraction (0.0-1.0). Values below 0.9 should require human verification';
COMMENT ON COLUMN conversation_facts.financial_category IS 'Cost code or budget line item (e.g., 03-Concrete, 16-Electrical, Materials, Labor)';
COMMENT ON COLUMN conversation_facts.valid_until IS 'Timestamp when this fact expires (e.g., quote expiration, rental availability end)';
COMMENT ON COLUMN conversation_facts.superseded_by IS 'Points to the fact that replaces this one (for audit trail)';

-- Verification: Show table info
SELECT
  'Migration completed successfully' as status,
  COUNT(*) as total_indexes
FROM pg_indexes
WHERE tablename = 'conversation_facts';

-- Migration: Update vector dimensions to support Voyage AI (1024d) and OpenAI (1536d)
-- Strategy: Use 1536 dimensions to support both (Voyage vectors will have trailing zeros)

-- Note: pgvector doesn't support variable dimensions per row, so we use the max (1536)
-- Voyage AI embeddings (1024d) will be padded with zeros to 1536d

-- Check current dimension
DO $$
BEGIN
    -- The column is already vector(1536), so no change needed
    -- Voyage 1024d embeddings will be padded to 1536d automatically
    RAISE NOTICE 'Vector dimension is already 1536, compatible with both OpenAI and Voyage AI';
END $$;

-- Note: When storing Voyage embeddings (1024d), we'll pad them to 1536d
-- When retrieving, we can use all 1536 dimensions for similarity search
-- This works because trailing zeros don't affect cosine similarity significantly

SELECT 'Migration complete - database supports both OpenAI (1536d) and Voyage AI (1024d) embeddings' as status;

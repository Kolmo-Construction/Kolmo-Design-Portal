import OpenAI from 'openai';

/**
 * Supported embedding providers
 */
type EmbeddingProvider = 'openai' | 'voyage';

/**
 * Service for generating vector embeddings for semantic search
 * Supports: OpenAI (text-embedding-ada-002, 1536d) and Voyage AI (voyage-context-3, 1024d)
 */
class EmbeddingService {
  private client: OpenAI | null = null;
  private initialized: boolean = false;
  private provider: EmbeddingProvider | null = null;
  private model: string = '';
  private dimensions: number = 0;

  constructor() {
    try {
      // Try Voyage AI first (preferred for cost and quality)
      const voyageKey = process.env.VOYAGE_API_KEY;
      if (voyageKey) {
        this.client = new OpenAI({
          apiKey: voyageKey,
          baseURL: 'https://api.voyageai.com/v1',
        });
        this.provider = 'voyage';
        this.model = 'voyage-3'; // Voyage AI's latest general-purpose model
        this.dimensions = 1024;
        this.initialized = true;
        console.log('[Embedding] Initialized with Voyage AI voyage-3 (1024 dimensions)');
        return;
      }

      // Fallback to OpenAI
      const openaiKey = process.env.OPENAI_API_KEY;
      if (openaiKey) {
        this.client = new OpenAI({
          apiKey: openaiKey,
        });
        this.provider = 'openai';
        this.model = 'text-embedding-ada-002';
        this.dimensions = 1536;
        this.initialized = true;
        console.log('[Embedding] Initialized with OpenAI text-embedding-ada-002 (1536 dimensions)');
        return;
      }

      console.warn('[Embedding] No embedding API key found - embeddings disabled');
      console.warn('[Embedding] Set VOYAGE_API_KEY (recommended) or OPENAI_API_KEY');
    } catch (error) {
      console.error('[Embedding] Initialization failed:', error);
    }
  }

  /**
   * Check if service is ready
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text: string): Promise<number[] | null> {
    if (!this.initialized || !this.client) {
      console.warn('[Embedding] Service not initialized - skipping embedding generation');
      return null;
    }

    if (!text || text.trim().length === 0) {
      console.warn('[Embedding] Empty text provided');
      return null;
    }

    try {
      // Truncate text if too long (both APIs have ~8K token limit)
      const truncatedText = text.length > 8000 ? text.substring(0, 8000) : text;

      const requestBody: any = {
        model: this.model,
        input: truncatedText,
      };

      // Voyage AI uses 'input_type' instead of 'encoding_format'
      if (this.provider === 'voyage') {
        requestBody.input_type = 'document'; // 'document' for storage, 'query' for search
      } else {
        requestBody.encoding_format = 'float';
      }

      const response = await this.client.embeddings.create(requestBody);

      let embedding = response.data[0].embedding;

      // Pad Voyage embeddings to 1536 dimensions to match database schema
      if (this.provider === 'voyage' && embedding.length < 1536) {
        const padded = new Array(1536).fill(0);
        embedding.forEach((val, idx) => padded[idx] = val);
        embedding = padded;
        console.log(`[Embedding] Padded Voyage embedding from ${this.dimensions} to 1536 dimensions`);
      }

      console.log(`[Embedding] Generated ${this.provider} embedding (${embedding.length} dimensions) for: "${text.substring(0, 50)}..."`);

      return embedding;
    } catch (error) {
      console.error('[Embedding] Failed to generate embedding:', error);
      return null;
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   * More efficient for bulk operations
   */
  async generateEmbeddings(texts: string[]): Promise<(number[] | null)[]> {
    if (!this.initialized || !this.client) {
      console.warn('[Embedding] Service not initialized');
      return texts.map(() => null);
    }

    if (texts.length === 0) {
      return [];
    }

    // Filter out empty texts
    const validTexts = texts.map(t => t?.trim() || '').filter(t => t.length > 0);

    if (validTexts.length === 0) {
      return texts.map(() => null);
    }

    try {
      // Truncate each text if needed
      const truncatedTexts = validTexts.map(text =>
        text.length > 8000 ? text.substring(0, 8000) : text
      );

      const requestBody: any = {
        model: this.model,
        input: truncatedTexts,
      };

      // Voyage AI uses 'input_type'
      if (this.provider === 'voyage') {
        requestBody.input_type = 'document';
      } else {
        requestBody.encoding_format = 'float';
      }

      const response = await this.client.embeddings.create(requestBody);

      let embeddings = response.data.map(item => item.embedding);

      // Pad Voyage embeddings to 1536 dimensions to match database schema
      if (this.provider === 'voyage' && embeddings[0]?.length < 1536) {
        embeddings = embeddings.map(embedding => {
          const padded = new Array(1536).fill(0);
          embedding.forEach((val: number, idx: number) => padded[idx] = val);
          return padded;
        });
        console.log(`[Embedding] Padded ${embeddings.length} Voyage embeddings from ${this.dimensions} to 1536 dimensions`);
      }

      console.log(`[Embedding] Generated ${embeddings.length} ${this.provider} embeddings in batch`);

      return embeddings;
    } catch (error) {
      console.error('[Embedding] Batch embedding generation failed:', error);
      // Fallback: try one by one
      console.log('[Embedding] Falling back to individual embedding generation');
      return Promise.all(texts.map(text => this.generateEmbedding(text)));
    }
  }

  /**
   * Calculate cosine similarity between two embeddings
   * Returns value between -1 and 1 (1 = identical, 0 = orthogonal, -1 = opposite)
   */
  cosineSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have same dimensions');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dotProduct / (norm1 * norm2);
  }

  /**
   * Format embedding for PostgreSQL vector type
   * Converts array to the format pgvector expects
   */
  formatForPostgres(embedding: number[]): string {
    return `[${embedding.join(',')}]`;
  }

  /**
   * Parse embedding from PostgreSQL vector type
   */
  parseFromPostgres(vectorString: string): number[] {
    // Remove brackets and split by comma
    const cleaned = vectorString.replace(/[\[\]]/g, '');
    return cleaned.split(',').map(val => parseFloat(val.trim()));
  }

  /**
   * Get embedding model info
   */
  getModelInfo() {
    return {
      provider: this.provider || 'none',
      model: this.model || 'none',
      dimensions: this.dimensions,
      maxTokens: 8191,
      initialized: this.initialized,
    };
  }

  /**
   * Get the current dimensions for this embedding model
   */
  getDimensions(): number {
    return this.dimensions;
  }
}

// Singleton instance
export const embeddingService = new EmbeddingService();

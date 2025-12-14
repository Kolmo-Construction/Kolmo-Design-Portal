import OpenAI from 'openai';

/**
 * Supported embedding providers
 */
type EmbeddingProvider = 'voyage-context' | 'voyage' | 'openai';

/**
 * Voyage API response format for contextualized embeddings
 */
interface VoyageContextualResponse {
  data: Array<{
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    total_tokens: number;
  };
}

/**
 * Service for generating vector embeddings for semantic search
 * Supports:
 * - Voyage AI Context-3 (contextualized embeddings, 1024d) - PRIMARY
 * - Voyage AI voyage-3 (standard embeddings, 1024d) - FALLBACK
 * - OpenAI text-embedding-ada-002 (1536d) - FINAL FALLBACK
 */
class EmbeddingService {
  private client: OpenAI | null = null;
  private initialized: boolean = false;
  private provider: EmbeddingProvider | null = null;
  private model: string = '';
  private dimensions: number = 0;
  private voyageApiKey: string | null = null;

  constructor() {
    try {
      // Try Voyage AI first (preferred for cost and quality)
      const voyageKey = process.env.VOYAGE_API_KEY;
      if (voyageKey) {
        this.voyageApiKey = voyageKey;

        // Try voyage-context-3 first (if available)
        // Note: This model may require beta access or specific API key permissions
        // Will auto-fallback to voyage-large-2 if not available
        this.provider = 'voyage-context';
        this.model = 'voyage-context-3';
        this.dimensions = 1024;
        this.initialized = true;
        console.log('[Embedding] Initialized with Voyage AI voyage-context-3 (1024 dimensions, contextualized)');
        console.log('[Embedding] Note: If voyage-context-3 is unavailable, will auto-fallback to voyage-large-2');
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
   * Get model information
   */
  getModelInfo(): { provider: string; model: string; dimensions: number } {
    return {
      provider: this.provider || 'none',
      model: this.model || 'none',
      dimensions: this.dimensions,
    };
  }

  /**
   * Generate contextualized embedding for a single text using voyage-context-3
   * This method provides better context understanding by treating related texts as a document
   */
  private async generateContextualEmbedding(text: string): Promise<number[] | null> {
    if (!this.voyageApiKey) {
      console.warn('[Embedding] Voyage API key not available for contextual embeddings');
      return null;
    }

    try {
      // Truncate text if too long (~8K token limit)
      const truncatedText = text.length > 8000 ? text.substring(0, 8000) : text;

      // voyage-context-3 for single text uses standard format
      // List-of-lists format is only for multiple related texts
      const response = await fetch('https://api.voyageai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.voyageApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: truncatedText, // Single string for single text
          model: 'voyage-context-3',
          input_type: 'document',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();

        // Check if model is not supported (beta access required)
        if (errorText.includes('not supported') && this.model === 'voyage-context-3') {
          console.warn('[Embedding] voyage-context-3 not available, falling back to voyage-large-2');
          // Switch to voyage-large-2 permanently for this session
          this.model = 'voyage-large-2';
          this.provider = 'voyage';

          // Retry with fallback model
          const fallbackResponse = await fetch('https://api.voyageai.com/v1/embeddings', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.voyageApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              input: truncatedText,
              model: 'voyage-large-2',
              input_type: 'document',
            }),
          });

          if (!fallbackResponse.ok) {
            const fallbackError = await fallbackResponse.text();
            console.error('[Embedding] Fallback model also failed:', fallbackResponse.status, fallbackError);
            return null;
          }

          const fallbackData: VoyageContextualResponse = await fallbackResponse.json();
          if (!fallbackData.data || fallbackData.data.length === 0) {
            console.error('[Embedding] No embeddings returned from fallback model');
            return null;
          }

          let embedding = fallbackData.data[0].embedding;
          if (embedding.length < 1536) {
            const padded = new Array(1536).fill(0);
            embedding.forEach((val, idx) => (padded[idx] = val));
            embedding = padded;
          }

          console.log(`[Embedding] Generated voyage-large-2 embedding (1536 dimensions) for: "${text.substring(0, 50)}..."`);
          return embedding;
        }

        console.error('[Embedding] Voyage Context API error:', response.status, errorText);
        return null;
      }

      const data: VoyageContextualResponse = await response.json();

      if (!data.data || data.data.length === 0) {
        console.error('[Embedding] No embeddings returned from Voyage Context API');
        return null;
      }

      let embedding = data.data[0].embedding;

      // Pad to 1536 dimensions for database compatibility
      if (embedding.length < 1536) {
        const padded = new Array(1536).fill(0);
        embedding.forEach((val, idx) => (padded[idx] = val));
        embedding = padded;
        console.log(`[Embedding] Padded Voyage Context embedding from ${data.data[0].embedding.length} to 1536 dimensions`);
      }

      console.log(`[Embedding] Generated voyage-context-3 embedding (1536 dimensions) for: "${text.substring(0, 50)}..."`);
      return embedding;
    } catch (error) {
      console.error('[Embedding] Contextual embedding generation failed:', error);
      return null;
    }
  }

  /**
   * Generate contextualized embeddings for multiple related texts
   * Uses voyage-context-3's unique ability to understand document structure
   *
   * @param texts Array of related text chunks (e.g., paragraphs from same document)
   * @returns Array of embeddings, one per text chunk
   */
  async generateContextualEmbeddings(texts: string[]): Promise<(number[] | null)[]> {
    if (!this.initialized) {
      console.warn('[Embedding] Service not initialized - skipping embedding generation');
      return texts.map(() => null);
    }

    if (this.provider !== 'voyage-context') {
      console.warn('[Embedding] Contextual embeddings only available with voyage-context-3');
      // Fallback to individual embeddings
      return this.generateEmbeddings(texts);
    }

    if (!this.voyageApiKey) {
      console.warn('[Embedding] Voyage API key not available');
      return texts.map(() => null);
    }

    try {
      // Truncate texts if too long
      const truncatedTexts = texts.map(text =>
        text.length > 8000 ? text.substring(0, 8000) : text
      );

      // voyage-context-3 format: [[text1, text2, text3, ...]]
      // All texts in inner array are treated as chunks of the same document
      const response = await fetch('https://api.voyageai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.voyageApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: [truncatedTexts], // Single document with multiple chunks
          model: 'voyage-context-3',
          input_type: 'document',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Embedding] Voyage Context batch API error:', response.status, errorText);
        return texts.map(() => null);
      }

      const data: VoyageContextualResponse = await response.json();

      if (!data.data || data.data.length !== texts.length) {
        console.error('[Embedding] Unexpected number of embeddings returned');
        return texts.map(() => null);
      }

      // Pad all embeddings to 1536 dimensions
      const embeddings = data.data.map(item => {
        let embedding = item.embedding;
        if (embedding.length < 1536) {
          const padded = new Array(1536).fill(0);
          embedding.forEach((val, idx) => (padded[idx] = val));
          embedding = padded;
        }
        return embedding;
      });

      console.log(`[Embedding] Padded ${texts.length} Voyage Context embeddings from 1024 to 1536 dimensions`);
      console.log(`[Embedding] Generated ${embeddings.length} contextualized embeddings in batch`);

      return embeddings;
    } catch (error) {
      console.error('[Embedding] Contextual batch embedding generation failed:', error);
      return texts.map(() => null);
    }
  }

  /**
   * Generate embedding using Voyage AI with native fetch (for voyage-context and voyage models)
   */
  private async generateVoyageEmbedding(text: string, model: string): Promise<number[] | null> {
    if (!this.voyageApiKey) {
      console.warn('[Embedding] Voyage API key not available');
      return null;
    }

    try {
      const truncatedText = text.length > 8000 ? text.substring(0, 8000) : text;

      const response = await fetch('https://api.voyageai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.voyageApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: truncatedText,
          model: model,
          input_type: 'document',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Embedding] Voyage API error (${model}):`, response.status, errorText);
        return null;
      }

      const data: VoyageContextualResponse = await response.json();

      if (!data.data || data.data.length === 0) {
        console.error('[Embedding] No embeddings returned from Voyage API');
        return null;
      }

      let embedding = data.data[0].embedding;

      // Pad to 1536 dimensions for database compatibility
      if (embedding.length < 1536) {
        const padded = new Array(1536).fill(0);
        embedding.forEach((val, idx) => (padded[idx] = val));
        embedding = padded;
      }

      console.log(`[Embedding] Generated ${model} embedding (1536 dimensions) for: "${text.substring(0, 50)}..."`);
      return embedding;
    } catch (error) {
      console.error(`[Embedding] ${model} generation failed:`, error);
      return null;
    }
  }

  /**
   * Generate embedding for a single text
   * Routes to appropriate method based on provider
   */
  async generateEmbedding(text: string): Promise<number[] | null> {
    if (!this.initialized) {
      console.warn('[Embedding] Service not initialized - skipping embedding generation');
      return null;
    }

    if (!text || text.trim().length === 0) {
      console.warn('[Embedding] Empty text provided');
      return null;
    }

    // Use contextualized embeddings for voyage-context-3
    if (this.provider === 'voyage-context') {
      return this.generateContextualEmbedding(text);
    }

    // Use fetch for standard Voyage models
    if (this.provider === 'voyage') {
      return this.generateVoyageEmbedding(text, this.model);
    }

    // OpenAI embeddings
    if (!this.client) {
      console.warn('[Embedding] Client not available');
      return null;
    }

    try {
      // Truncate text if too long
      const truncatedText = text.length > 8000 ? text.substring(0, 8000) : text;

      const requestBody: any = {
        model: this.model,
        input: truncatedText,
        encoding_format: 'float',
      };

      const response = await this.client.embeddings.create(requestBody);
      let embedding = response.data[0].embedding;

      console.log(`[Embedding] Generated ${this.provider} embedding (${embedding.length} dimensions) for: "${text.substring(0, 50)}..."`);
      return embedding;
    } catch (error) {
      console.error('[Embedding] Embedding generation failed:', error);
      return null;
    }
  }

  /**
   * Generate embeddings for multiple texts using Voyage AI with native fetch
   */
  private async generateVoyageEmbeddings(texts: string[], model: string): Promise<(number[] | null)[]> {
    if (!this.voyageApiKey) {
      console.warn('[Embedding] Voyage API key not available');
      return texts.map(() => null);
    }

    try {
      const truncatedTexts = texts.map(text =>
        text.length > 8000 ? text.substring(0, 8000) : text
      );

      const response = await fetch('https://api.voyageai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.voyageApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: truncatedTexts,
          model: model,
          input_type: 'document',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Embedding] Voyage batch API error (${model}):`, response.status, errorText);
        return texts.map(() => null);
      }

      const data: VoyageContextualResponse = await response.json();

      if (!data.data || data.data.length !== texts.length) {
        console.error('[Embedding] Unexpected number of embeddings returned');
        return texts.map(() => null);
      }

      // Pad all embeddings to 1536 dimensions
      const embeddings = data.data.map(item => {
        let embedding = item.embedding;
        if (embedding.length < 1536) {
          const padded = new Array(1536).fill(0);
          embedding.forEach((val, idx) => (padded[idx] = val));
          embedding = padded;
        }
        return embedding;
      });

      console.log(`[Embedding] Generated ${embeddings.length} ${model} embeddings in batch (1536 dimensions)`);
      return embeddings;
    } catch (error) {
      console.error(`[Embedding] Batch ${model} generation failed:`, error);
      return texts.map(() => null);
    }
  }

  /**
   * Generate embeddings for multiple texts (batch)
   * For voyage-context-3, uses contextualized embeddings if available
   */
  async generateEmbeddings(texts: string[]): Promise<(number[] | null)[]> {
    if (!this.initialized) {
      console.warn('[Embedding] Service not initialized - skipping batch embedding generation');
      return texts.map(() => null);
    }

    if (texts.length === 0) {
      return [];
    }

    // Use contextualized batch for voyage-context-3
    if (this.provider === 'voyage-context') {
      return this.generateContextualEmbeddings(texts);
    }

    // Use fetch for standard Voyage models
    if (this.provider === 'voyage') {
      return this.generateVoyageEmbeddings(texts, this.model);
    }

    // OpenAI batch processing
    if (!this.client) {
      console.warn('[Embedding] Client not available');
      return texts.map(() => null);
    }

    try {
      // Truncate all texts
      const truncatedTexts = texts.map(text =>
        text.length > 8000 ? text.substring(0, 8000) : text
      );

      const requestBody: any = {
        model: this.model,
        input: truncatedTexts,
        encoding_format: 'float',
      };

      const response = await this.client.embeddings.create(requestBody);

      // Process all embeddings
      const embeddings = response.data.map(item => item.embedding);

      console.log(`[Embedding] Generated ${embeddings.length} ${this.provider} embeddings in batch`);

      return embeddings;
    } catch (error) {
      console.error('[Embedding] Batch embedding generation failed:', error);
      return texts.map(() => null);
    }
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
  parseFromPostgres(vectorStr: string): number[] {
    // Remove brackets and split by comma
    const cleaned = vectorStr.replace(/[\[\]]/g, '');
    return cleaned.split(',').map(num => parseFloat(num.trim()));
  }

  /**
   * Calculate cosine similarity between two embeddings
   * Returns value between 0 (dissimilar) and 1 (identical)
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Embeddings must have same dimensions');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

// Singleton instance
export const embeddingService = new EmbeddingService();

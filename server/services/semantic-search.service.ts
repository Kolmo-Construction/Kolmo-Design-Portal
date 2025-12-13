import { db, pool } from "../db";
import { conversationFacts } from "@shared/schema";
import { sql } from "drizzle-orm";
import { embeddingService } from "./embedding.service";
import type { ConversationFact } from "@shared/schema";

/**
 * Search result with similarity score
 */
export interface SemanticSearchResult {
  fact: ConversationFact;
  similarity: number; // 0.0 to 1.0
  relevanceScore: number; // Adjusted score considering confidence and priority
}

/**
 * Search filters
 */
export interface SearchFilters {
  projectId?: number;
  sessionId?: string;
  factTypes?: string[];
  minConfidence?: number;
  verificationStatus?: ('pending_approval' | 'verified' | 'rejected' | 'needs_review')[];
  activeOnly?: boolean;
  requiresAction?: boolean;
  priority?: ('critical' | 'high' | 'normal' | 'low')[];
  financialOnly?: boolean;
  minFinancialAmount?: number;
  validOnly?: boolean; // Filter out expired facts
}

/**
 * Convert snake_case database row to camelCase ConversationFact
 */
function mapRowToFact(row: any): ConversationFact {
  return {
    id: row.id,
    sessionId: row.session_id,
    projectId: row.project_id,
    userId: row.user_id,
    factType: row.fact_type,
    factContent: row.fact_content,
    factSummary: row.fact_summary,
    embedding: row.embedding,
    isActive: row.is_active,
    supersededBy: row.superseded_by,
    validUntil: row.valid_until,
    version: row.version,
    authorRole: row.author_role,
    confidenceScore: row.confidence_score,
    verificationStatus: row.verification_status,
    verifiedBy: row.verified_by,
    verifiedAt: row.verified_at,
    financialAmount: row.financial_amount,
    currency: row.currency,
    financialCategory: row.financial_category,
    financialType: row.financial_type,
    priority: row.priority,
    requiresAction: row.requires_action,
    actionDeadline: row.action_deadline,
    sourceMessageId: row.source_message_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Service for semantic search over conversation facts
 */
class SemanticSearchService {
  /**
   * Search for relevant facts using semantic similarity
   */
  async search(
    query: string,
    filters: SearchFilters = {},
    limit: number = 10
  ): Promise<SemanticSearchResult[]> {
    if (!embeddingService.isInitialized()) {
      console.warn('[SemanticSearch] Embedding service not available - falling back to keyword search');
      return this.keywordSearch(query, filters, limit);
    }

    try {
      // Generate embedding for query
      const queryEmbedding = await embeddingService.generateEmbedding(query);

      if (!queryEmbedding) {
        console.warn('[SemanticSearch] Failed to generate query embedding - falling back to keyword search');
        return this.keywordSearch(query, filters, limit);
      }

      const queryVector = embeddingService.formatForPostgres(queryEmbedding);

      // Build WHERE clause based on filters
      const conditions: string[] = [];
      const params: any[] = [queryVector];
      let paramIndex = 2;

      // Active only (default true)
      if (filters.activeOnly !== false) {
        conditions.push('is_active = true');
      }

      // Project filter
      if (filters.projectId) {
        conditions.push(`project_id = $${paramIndex}`);
        params.push(filters.projectId);
        paramIndex++;
      }

      // Session filter
      if (filters.sessionId) {
        conditions.push(`session_id = $${paramIndex}`);
        params.push(filters.sessionId);
        paramIndex++;
      }

      // Fact type filter
      if (filters.factTypes && filters.factTypes.length > 0) {
        conditions.push(`fact_type = ANY($${paramIndex})`);
        params.push(filters.factTypes);
        paramIndex++;
      }

      // Confidence filter
      if (filters.minConfidence !== undefined) {
        conditions.push(`confidence_score >= $${paramIndex}`);
        params.push(filters.minConfidence);
        paramIndex++;
      }

      // Verification status filter
      if (filters.verificationStatus && filters.verificationStatus.length > 0) {
        conditions.push(`verification_status = ANY($${paramIndex})`);
        params.push(filters.verificationStatus);
        paramIndex++;
      }

      // Requires action filter
      if (filters.requiresAction !== undefined) {
        conditions.push(`requires_action = $${paramIndex}`);
        params.push(filters.requiresAction);
        paramIndex++;
      }

      // Priority filter
      if (filters.priority && filters.priority.length > 0) {
        conditions.push(`priority = ANY($${paramIndex})`);
        params.push(filters.priority);
        paramIndex++;
      }

      // Financial filter
      if (filters.financialOnly) {
        conditions.push('financial_amount IS NOT NULL');
      }

      if (filters.minFinancialAmount !== undefined) {
        conditions.push(`financial_amount >= $${paramIndex}`);
        params.push(filters.minFinancialAmount);
        paramIndex++;
      }

      // Valid only (not expired)
      if (filters.validOnly) {
        conditions.push('(valid_until IS NULL OR valid_until > NOW())');
      }

      // Exclude facts without embeddings
      conditions.push('embedding IS NOT NULL');

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Execute semantic search query
      const query_sql = `
        SELECT
          *,
          1 - (embedding <=> $1::vector) as similarity
        FROM conversation_facts
        ${whereClause}
        ORDER BY embedding <=> $1::vector
        LIMIT ${limit}
      `;

      console.log('[SemanticSearch] Executing semantic search with filters:', filters);

      const results = await pool.query(query_sql, params);

      // Calculate relevance scores (combine similarity with confidence and priority)
      const searchResults: SemanticSearchResult[] = (results.rows as any[]).map(row => {
        const fact = mapRowToFact(row);
        const similarity = parseFloat(row.similarity) || 0;

        // Relevance score factors:
        // - Similarity: base score
        // - Confidence: boost for high-confidence facts
        // - Priority: boost for critical/high priority
        let relevanceScore = similarity;

        if (fact.confidenceScore) {
          relevanceScore *= (0.7 + 0.3 * parseFloat(fact.confidenceScore.toString()));
        }

        if (fact.priority === 'critical') {
          relevanceScore *= 1.3;
        } else if (fact.priority === 'high') {
          relevanceScore *= 1.15;
        }

        return {
          fact,
          similarity,
          relevanceScore,
        };
      });

      // Sort by relevance score
      searchResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

      console.log(`[SemanticSearch] Found ${searchResults.length} relevant facts`);

      return searchResults;
    } catch (error) {
      console.error('[SemanticSearch] Search failed:', error);
      return [];
    }
  }

  /**
   * Fallback keyword search when embeddings not available
   */
  private async keywordSearch(
    query: string,
    filters: SearchFilters,
    limit: number
  ): Promise<SemanticSearchResult[]> {
    try {
      console.log('[SemanticSearch] Using keyword search');

      // Build WHERE clause
      const conditions: any[] = [];

      // Text search in fact_summary
      if (query && query.trim().length > 0) {
        conditions.push(
          sql`fact_summary ILIKE ${`%${query}%`} OR fact_content::text ILIKE ${`%${query}%`}`
        );
      }

      // Apply filters (similar to semantic search)
      if (filters.activeOnly !== false) {
        conditions.push(sql`is_active = true`);
      }

      if (filters.projectId) {
        conditions.push(sql`project_id = ${filters.projectId}`);
      }

      if (filters.sessionId) {
        conditions.push(sql`session_id = ${filters.sessionId}`);
      }

      if (filters.factTypes && filters.factTypes.length > 0) {
        conditions.push(sql`fact_type = ANY(${filters.factTypes})`);
      }

      if (filters.minConfidence !== undefined) {
        conditions.push(sql`confidence_score >= ${filters.minConfidence}`);
      }

      if (filters.requiresAction !== undefined) {
        conditions.push(sql`requires_action = ${filters.requiresAction}`);
      }

      if (filters.financialOnly) {
        conditions.push(sql`financial_amount IS NOT NULL`);
      }

      if (filters.validOnly) {
        conditions.push(sql`(valid_until IS NULL OR valid_until > NOW())`);
      }

      // Combine conditions
      let query_builder = db.select().from(conversationFacts);

      if (conditions.length > 0) {
        // @ts-ignore - Drizzle typing complexity
        query_builder = query_builder.where(sql`${sql.join(conditions, sql` AND `)}`);
      }

      const results = await query_builder.limit(limit);

      return results.map(fact => ({
        fact,
        similarity: 0.5, // No real similarity in keyword search
        relevanceScore: 0.5,
      }));
    } catch (error) {
      console.error('[SemanticSearch] Keyword search failed:', error);
      return [];
    }
  }

  /**
   * Get similar facts to a given fact (for discovering related information)
   */
  async findSimilarFacts(
    factId: number,
    limit: number = 5
  ): Promise<SemanticSearchResult[]> {
    try {
      // Get the source fact
      const sourceFacts = await db
        .select()
        .from(conversationFacts)
        .where(sql`id = ${factId}`)
        .limit(1);

      if (sourceFacts.length === 0) {
        console.warn('[SemanticSearch] Source fact not found');
        return [];
      }

      const sourceFact = sourceFacts[0];

      // Use the fact summary as search query
      return this.search(
        sourceFact.factSummary,
        {
          projectId: sourceFact.projectId || undefined,
          activeOnly: true,
        },
        limit + 1 // +1 to account for the source fact itself
      ).then(results =>
        // Filter out the source fact
        results.filter(r => r.fact.id !== factId).slice(0, limit)
      );
    } catch (error) {
      console.error('[SemanticSearch] Failed to find similar facts:', error);
      return [];
    }
  }

  /**
   * Get facts that need attention (action required, high priority, expiring soon)
   */
  async getActionableFacts(projectId?: number, limit: number = 20): Promise<ConversationFact[]> {
    try {
      const conditions: any[] = [
        sql`is_active = true`,
        sql`requires_action = true`,
      ];

      if (projectId) {
        conditions.push(sql`project_id = ${projectId}`);
      }

      // Include facts expiring in next 7 days
      conditions.push(
        sql`(action_deadline IS NULL OR action_deadline > NOW()) OR (valid_until IS NOT NULL AND valid_until BETWEEN NOW() AND NOW() + INTERVAL '7 days')`
      );

      const results = await db
        .select()
        .from(conversationFacts)
        .where(sql`${sql.join(conditions, sql` AND `)}`)
        .orderBy(sql`
          CASE priority
            WHEN 'critical' THEN 1
            WHEN 'high' THEN 2
            WHEN 'normal' THEN 3
            WHEN 'low' THEN 4
          END,
          action_deadline ASC NULLS LAST
        `)
        .limit(limit);

      return results;
    } catch (error) {
      console.error('[SemanticSearch] Failed to get actionable facts:', error);
      return [];
    }
  }

  /**
   * Get high-value financial facts needing verification
   */
  async getUnverifiedFinancialFacts(
    projectId?: number,
    minAmount: number = 5000,
    limit: number = 10
  ): Promise<ConversationFact[]> {
    try {
      const conditions: any[] = [
        sql`is_active = true`,
        sql`financial_amount >= ${minAmount}`,
        sql`verification_status IN ('pending_approval', 'needs_review')`,
      ];

      if (projectId) {
        conditions.push(sql`project_id = ${projectId}`);
      }

      const results = await db
        .select()
        .from(conversationFacts)
        .where(sql`${sql.join(conditions, sql` AND `)}`)
        .orderBy(sql`financial_amount DESC, created_at DESC`)
        .limit(limit);

      return results;
    } catch (error) {
      console.error('[SemanticSearch] Failed to get unverified financial facts:', error);
      return [];
    }
  }
}

// Singleton instance
export const semanticSearchService = new SemanticSearchService();

import { ChatOpenAI } from "@langchain/openai";
import { db, pool } from "../db";
import { conversationFacts } from "@shared/schema";
import type { NewConversationFact } from "@shared/schema";
import { embeddingService } from "./embedding.service";
import { sql } from "drizzle-orm";

/**
 * Extracted fact structure from LLM analysis
 */
interface ExtractedFact {
  factType: 'task' | 'decision' | 'milestone' | 'financial' | 'schedule' | 'material' | 'risk' | 'constraint' | 'data_point';
  factSummary: string;
  factContent: Record<string, any>;

  // Trust & Attribution
  confidenceScore: number; // 0.0 to 1.0

  // Financial (if applicable)
  financialAmount?: number;
  financialCategory?: string;
  financialType?: 'estimate' | 'quote' | 'change_order' | 'hard_cost' | 'invoice' | 'payment' | 'budget';

  // Priority
  priority: 'critical' | 'high' | 'normal' | 'low';
  requiresAction: boolean;
  actionDeadline?: string; // ISO date string

  // Temporal
  validUntil?: string; // ISO date string
}

/**
 * Service for extracting structured facts from agent conversations
 */
class FactExtractionService {
  private extractionModel: ChatOpenAI;
  private initialized: boolean = false;

  constructor() {
    try {
      const deepseekKey = process.env.DEEPSEEK_API_KEY;
      const openaiKey = process.env.OPENAI_API_KEY;

      if (!deepseekKey && !openaiKey) {
        console.warn('[FactExtraction] No API key configured - fact extraction disabled');
        return;
      }

      // Use the same model as agent service for consistency
      if (deepseekKey) {
        this.extractionModel = new ChatOpenAI({
          modelName: "deepseek-chat",
          temperature: 0,
          apiKey: deepseekKey,
          configuration: {
            baseURL: "https://api.deepseek.com",
          },
        });
        console.log('[FactExtraction] Initialized with DeepSeek');
      } else {
        this.extractionModel = new ChatOpenAI({
          modelName: "gpt-4-turbo-preview",
          temperature: 0,
          apiKey: openaiKey,
        });
        console.log('[FactExtraction] Initialized with OpenAI');
      }

      this.initialized = true;
    } catch (error) {
      console.error('[FactExtraction] Initialization failed:', error);
    }
  }

  /**
   * Extract facts from a conversation exchange (user message + agent response)
   */
  async extractFacts(
    userMessage: string,
    agentResponse: string,
    context: {
      sessionId: string;
      projectId?: number;
      userId?: number;
      sourceMessageId?: string;
    }
  ): Promise<number> {
    if (!this.initialized) {
      console.warn('[FactExtraction] Service not initialized - skipping extraction');
      return 0;
    }

    try {
      console.log('[FactExtraction] Analyzing conversation for facts...');

      const extractedFacts = await this.analyzeConversation(userMessage, agentResponse);

      if (extractedFacts.length === 0) {
        console.log('[FactExtraction] No significant facts found');
        return 0;
      }

      console.log(`[FactExtraction] Extracted ${extractedFacts.length} facts`);

      // Store facts in database (without embeddings for now - will add in Step 3)
      let savedCount = 0;
      for (const fact of extractedFacts) {
        try {
          await this.storeFact(fact, context);
          savedCount++;
        } catch (error) {
          console.error('[FactExtraction] Failed to store fact:', error);
        }
      }

      console.log(`[FactExtraction] Successfully stored ${savedCount}/${extractedFacts.length} facts`);
      return savedCount;
    } catch (error) {
      console.error('[FactExtraction] Extraction failed:', error);
      return 0;
    }
  }

  /**
   * Use LLM to analyze conversation and extract structured facts
   */
  private async analyzeConversation(
    userMessage: string,
    agentResponse: string
  ): Promise<ExtractedFact[]> {
    const systemPrompt = `You are a fact extraction specialist for construction project management conversations.

Your job is to extract ACTIONABLE, STRUCTURED FACTS from conversations between users and an AI assistant.

FACT TYPES:
- task: Tasks to be done or created
- decision: Decisions made or approvals given
- milestone: Project milestones or deadlines
- financial: Cost estimates, quotes, invoices, payments, budgets
- schedule: Timeline information, deadlines, availability
- material: Materials, supplies, equipment mentioned
- risk: Risks, issues, or concerns identified
- constraint: Limitations or requirements
- data_point: Important data or metrics

EXTRACTION RULES:
1. Only extract facts that are NEW, SPECIFIC, and ACTIONABLE
2. Don't extract vague statements or general conversation
3. For financial facts, ALWAYS extract amount, category, and type
4. Assign confidence scores based on certainty (0.0-1.0)
5. Identify priority: critical (urgent action), high (important), normal (standard), low (FYI)
6. Flag requiresAction if the fact needs follow-up
7. Extract temporal info: validUntil for expiring facts, actionDeadline for tasks

EXAMPLES:

User: "Get me a quote for 50 cubic yards of concrete"
Agent: "I'll help you track this. The current market rate is around $150/cy, so approximately $7,500. I can create a task to get formal quotes."

Extract:
[
  {
    "factType": "financial",
    "factSummary": "Concrete estimate: 50 cubic yards at $150/cy = $7,500",
    "factContent": {
      "material": "Concrete",
      "quantity": 50,
      "unit": "cubic yards",
      "rate": 150,
      "total": 7500
    },
    "confidenceScore": 0.75,
    "financialAmount": 7500,
    "financialCategory": "03-Concrete",
    "financialType": "estimate",
    "priority": "high",
    "requiresAction": true,
    "actionDeadline": null
  },
  {
    "factType": "task",
    "factSummary": "Get formal quotes for concrete from vendors",
    "factContent": {
      "task": "Obtain formal concrete quotes",
      "quantity": "50 cubic yards",
      "purpose": "Foundation pour"
    },
    "confidenceScore": 0.85,
    "priority": "high",
    "requiresAction": true
  }
]

User: "The crane is available until Friday"
Agent: "Got it. I'll note that the crane rental window closes this Friday."

Extract:
[
  {
    "factType": "schedule",
    "factSummary": "Crane rental available until Friday",
    "factContent": {
      "resource": "Crane rental",
      "availability": "Until end of week"
    },
    "confidenceScore": 0.9,
    "priority": "high",
    "requiresAction": true,
    "validUntil": "[ISO date for Friday]"
  }
]

RESPOND WITH VALID JSON ARRAY ONLY - NO MARKDOWN, NO EXPLANATIONS.
If no significant facts found, return empty array: []`;

    const userPrompt = `Extract facts from this conversation:

User: ${userMessage}

Agent: ${agentResponse}

Extract facts as JSON array:`;

    try {
      const response = await this.extractionModel.invoke([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]);

      const responseText = response.content.toString().trim();

      // Remove markdown code blocks if present
      let jsonText = responseText;
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      }

      // Parse JSON response
      const facts: ExtractedFact[] = JSON.parse(jsonText);

      // Validate and sanitize facts
      return facts.filter(fact => this.validateFact(fact));
    } catch (error) {
      console.error('[FactExtraction] LLM analysis failed:', error);
      return [];
    }
  }

  /**
   * Validate extracted fact structure
   */
  private validateFact(fact: any): fact is ExtractedFact {
    if (!fact.factType || !fact.factSummary || !fact.factContent) {
      console.warn('[FactExtraction] Invalid fact structure:', fact);
      return false;
    }

    // Validate confidence score
    if (fact.confidenceScore < 0 || fact.confidenceScore > 1) {
      fact.confidenceScore = 0.5; // Default to moderate confidence
    }

    // Validate financial facts
    if (fact.factType === 'financial') {
      if (!fact.financialAmount || !fact.financialType) {
        console.warn('[FactExtraction] Financial fact missing required fields');
        return false;
      }
    }

    return true;
  }

  /**
   * Store extracted fact in database
   */
  private async storeFact(
    fact: ExtractedFact,
    context: {
      sessionId: string;
      projectId?: number;
      userId?: number;
      sourceMessageId?: string;
    }
  ): Promise<void> {
    // Generate embedding for the fact summary
    let embeddingVector: number[] | null = null;
    if (embeddingService.isInitialized()) {
      embeddingVector = await embeddingService.generateEmbedding(fact.factSummary);
      if (!embeddingVector) {
        console.warn('[FactExtraction] Failed to generate embedding for fact');
      }
    } else {
      console.warn('[FactExtraction] Embedding service not available - storing fact without embedding');
    }

    const newFact: any = {
      sessionId: context.sessionId,
      projectId: context.projectId || null,
      userId: context.userId || null,

      // Fact content
      factType: fact.factType,
      factContent: fact.factContent,
      factSummary: fact.factSummary,

      // Lifecycle
      isActive: true,
      supersededBy: null,
      validUntil: fact.validUntil ? new Date(fact.validUntil) : null,
      version: 1,

      // Trust & Attribution
      authorRole: 'assistant', // Facts extracted from assistant responses
      confidenceScore: fact.confidenceScore.toFixed(2),
      verificationStatus: fact.confidenceScore >= 0.9 ? 'verified' : 'pending_approval',
      verifiedBy: null,
      verifiedAt: null,

      // Financial
      financialAmount: fact.financialAmount?.toFixed(2) || null,
      currency: fact.financialAmount ? 'USD' : null,
      financialCategory: fact.financialCategory || null,
      financialType: fact.financialType || null,

      // Priority
      priority: fact.priority,
      requiresAction: fact.requiresAction,
      actionDeadline: fact.actionDeadline ? new Date(fact.actionDeadline) : null,

      // Metadata
      sourceMessageId: context.sourceMessageId || null,
    };

    // If we have an embedding, insert it using pg pool to properly handle vector type
    if (embeddingVector) {
      const vectorStr = embeddingService.formatForPostgres(embeddingVector);

      const query = `
        INSERT INTO conversation_facts (
          session_id, project_id, user_id,
          fact_type, fact_content, fact_summary, embedding,
          is_active, superseded_by, valid_until, version,
          author_role, confidence_score, verification_status, verified_by, verified_at,
          financial_amount, currency, financial_category, financial_type,
          priority, requires_action, action_deadline,
          source_message_id
        ) VALUES (
          $1, $2, $3,
          $4, $5::jsonb, $6, $7::vector,
          $8, $9, $10, $11,
          $12, $13, $14, $15, $16,
          $17, $18, $19, $20,
          $21, $22, $23,
          $24
        )
      `;

      const params = [
        newFact.sessionId,
        newFact.projectId,
        newFact.userId,
        newFact.factType,
        JSON.stringify(newFact.factContent),
        newFact.factSummary,
        vectorStr,
        newFact.isActive,
        newFact.supersededBy,
        newFact.validUntil,
        newFact.version,
        newFact.authorRole,
        newFact.confidenceScore,
        newFact.verificationStatus,
        newFact.verifiedBy,
        newFact.verifiedAt,
        newFact.financialAmount,
        newFact.currency,
        newFact.financialCategory,
        newFact.financialType,
        newFact.priority,
        newFact.requiresAction,
        newFact.actionDeadline,
        newFact.sourceMessageId,
      ];

      await pool.query(query, params);
    } else {
      // No embedding, use normal insert
      await db.insert(conversationFacts).values(newFact);
    }

    console.log(`[FactExtraction] Stored ${fact.factType} fact: "${fact.factSummary.substring(0, 50)}..."`);
  }

  /**
   * Get recent facts for a session (for context building)
   */
  async getRecentFacts(sessionId: string, limit: number = 10): Promise<any[]> {
    try {
      const facts = await db
        .select()
        .from(conversationFacts)
        .where((fields: any) =>
          fields.sessionId === sessionId &&
          fields.isActive === true
        )
        .orderBy((fields: any) => fields.createdAt)
        .limit(limit);

      return facts;
    } catch (error) {
      console.error('[FactExtraction] Failed to retrieve facts:', error);
      return [];
    }
  }

  /**
   * Get facts by project
   */
  async getProjectFacts(projectId: number, activeOnly: boolean = true): Promise<any[]> {
    try {
      let query = db
        .select()
        .from(conversationFacts)
        .where((fields: any) => fields.projectId === projectId);

      if (activeOnly) {
        query = query.where((fields: any) => fields.isActive === true);
      }

      const facts = await query.orderBy((fields: any) => fields.createdAt);

      return facts;
    } catch (error) {
      console.error('[FactExtraction] Failed to retrieve project facts:', error);
      return [];
    }
  }

  /**
   * Mark a fact as verified by a user
   */
  async verifyFact(factId: number, userId: number): Promise<boolean> {
    try {
      await db
        .update(conversationFacts)
        .set({
          verificationStatus: 'verified',
          verifiedBy: userId,
          verifiedAt: new Date(),
        })
        .where((fields: any) => fields.id === factId);

      console.log(`[FactExtraction] Fact ${factId} verified by user ${userId}`);
      return true;
    } catch (error) {
      console.error('[FactExtraction] Failed to verify fact:', error);
      return false;
    }
  }

  /**
   * Regenerate embeddings for facts that don't have them
   * Useful for backfilling or after enabling embeddings
   */
  async regenerateEmbeddings(limit: number = 100): Promise<number> {
    if (!embeddingService.isInitialized()) {
      console.warn('[FactExtraction] Embedding service not available');
      return 0;
    }

    try {
      // Get facts without embeddings
      const factsWithoutEmbeddings = await db
        .select()
        .from(conversationFacts)
        .where((fields: any) => fields.embedding === null)
        .limit(limit);

      if (factsWithoutEmbeddings.length === 0) {
        console.log('[FactExtraction] All facts have embeddings');
        return 0;
      }

      console.log(`[FactExtraction] Regenerating embeddings for ${factsWithoutEmbeddings.length} facts`);

      // Generate embeddings in batch
      const summaries = factsWithoutEmbeddings.map(f => f.factSummary);
      const embeddings = await embeddingService.generateEmbeddings(summaries);

      // Update facts with embeddings
      let updatedCount = 0;
      for (let i = 0; i < factsWithoutEmbeddings.length; i++) {
        const fact = factsWithoutEmbeddings[i];
        const embedding = embeddings[i];

        if (embedding) {
          const vectorStr = embeddingService.formatForPostgres(embedding);
          const query = `
            UPDATE conversation_facts
            SET embedding = $1::vector,
                updated_at = NOW()
            WHERE id = $2
          `;
          await pool.query(query, [vectorStr, fact.id]);

          updatedCount++;
        }
      }

      console.log(`[FactExtraction] Updated ${updatedCount} facts with embeddings`);
      return updatedCount;
    } catch (error) {
      console.error('[FactExtraction] Failed to regenerate embeddings:', error);
      return 0;
    }
  }

  /**
   * Supersede an old fact with a new version
   */
  async supersedeFact(
    oldFactId: number,
    newFactData: Partial<NewConversationFact>
  ): Promise<number | null> {
    try {
      // Get old fact
      const oldFact = await db
        .select()
        .from(conversationFacts)
        .where((fields: any) => fields.id === oldFactId)
        .limit(1);

      if (oldFact.length === 0) {
        console.error('[FactExtraction] Old fact not found');
        return null;
      }

      const old = oldFact[0];

      // Create new version
      const newFact: NewConversationFact = {
        ...old,
        ...newFactData,
        version: (old.version || 1) + 1,
        isActive: true,
        supersededBy: null,
        verificationStatus: 'needs_review',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as NewConversationFact;

      const result = await db.insert(conversationFacts).values(newFact).returning();
      const newFactId = result[0].id;

      // Mark old fact as superseded
      await db
        .update(conversationFacts)
        .set({
          isActive: false,
          supersededBy: newFactId,
        })
        .where((fields: any) => fields.id === oldFactId);

      console.log(`[FactExtraction] Fact ${oldFactId} superseded by ${newFactId}`);
      return newFactId;
    } catch (error) {
      console.error('[FactExtraction] Failed to supersede fact:', error);
      return null;
    }
  }
}

// Singleton instance
export const factExtractionService = new FactExtractionService();
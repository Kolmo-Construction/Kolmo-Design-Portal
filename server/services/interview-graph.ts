// server/services/interview-graph.ts

/**
 * LangGraph Interview Enhancement Layer
 * Adds non-linear conversation capabilities to the existing interview.service.ts:
 * - Intent classification (answering vs modifying vs asking)
 * - Intelligent multi-fact extraction
 * - Conflict resolution (latest info wins)
 * - Math capability (e.g., "add 2 feet")
 * - Context-aware question generation
 */

import { ChatOpenAI } from '@langchain/openai';
import { StateGraph, MessagesAnnotation } from '@langchain/langgraph';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';

// ============================================================================
// Types
// ============================================================================

export interface InterviewTurnInput {
  userInput: string;
  currentDraft: Record<string, any>;
  requiredFields: string[];
  conversationHistory: Array<{ role: string; content: string }>;
  collectingLineItems?: boolean;
  currentField?: string; // The field we're currently asking about
}

export interface InterviewTurnOutput {
  userIntent: 'ANSWER' | 'MODIFY' | 'ASK' | 'IGNORE';
  extractedData: Record<string, any>;
  nextQuestion: string | null;
  isComplete: boolean;
  reasoning?: string;
}

// ============================================================================
// LLM Setup
// ============================================================================

class InterviewGraphService {
  private app: any = null;
  private model: ChatOpenAI | null = null;
  private initialized: boolean = false;

  constructor() {
    try {
      const deepseekKey = process.env.DEEPSEEK_API_KEY;
      const openaiKey = process.env.OPENAI_API_KEY;

      if (!deepseekKey && !openaiKey) {
        console.warn('[InterviewGraph] No API key configured');
        return;
      }

      // Prefer DeepSeek for cost efficiency (same as agent.service.ts)
      if (deepseekKey) {
        this.model = new ChatOpenAI({
          modelName: 'deepseek-chat',
          temperature: 0.7, // Slightly creative for natural conversation
          apiKey: deepseekKey,
          configuration: { baseURL: 'https://api.deepseek.com' },
        });
        console.log('[InterviewGraph] Using DeepSeek');
      } else {
        this.model = new ChatOpenAI({
          modelName: 'gpt-4o-mini',
          temperature: 0.7,
          apiKey: openaiKey,
        });
        console.log('[InterviewGraph] Using OpenAI');
      }

      this.app = this.buildWorkflow();
      this.initialized = true;
      console.log('[InterviewGraph] Initialized successfully');
    } catch (error) {
      console.error('[InterviewGraph] Initialization failed:', error);
    }
  }

  /**
   * Build the LangGraph workflow
   * Flow: router (classify intent) -> processor (extract/merge data) -> generator (create question)
   */
  private buildWorkflow() {
    if (!this.model) {
      throw new Error('Model not initialized');
    }

    const workflow = new StateGraph(MessagesAnnotation)
      // Router: Classify user intent
      .addNode('router', async (state) => {
        const lastMessage = state.messages[state.messages.length - 1];
        const userInput = lastMessage.content.toString();

        const systemPrompt = `Classify the user's intent into ONE category:

ANSWER: User provides information (e.g., "John Smith", "12 feet", "john@example.com")
MODIFY: User changes previous answer (e.g., "Actually make it 15 feet", "Change to Jane")
ASK: User asks a question (e.g., "Do I need a permit?", "How long?")
IGNORE: Irrelevant (e.g., "hello", "thanks")

User said: "${userInput}"

Respond with ONLY ONE WORD: ANSWER, MODIFY, ASK, or IGNORE`;

        const response = await this.model!.invoke([new SystemMessage(systemPrompt)]);
        const intent = response.content.toString().trim().toUpperCase();

        console.log('[InterviewGraph] Classified intent:', intent);

        return {
          messages: [new SystemMessage(`INTENT:${intent}`)],
        };
      })

      // Processor: Extract and merge data based on intent
      .addNode('processor', async (state) => {
        // Get metadata from state (passed in initial invocation)
        // CRITICAL: Get LAST human message, not first (using findLast or reverse find)
        const userMessage = state.messages.slice().reverse().find((m: any) => m._getType() === 'human');
        const intentMessage = state.messages.find((m: any) =>
          m._getType() === 'system' && m.content.startsWith('INTENT:')
        );
        const contextMessage = state.messages.find((m: any) =>
          m._getType() === 'system' && m.content.startsWith('CONTEXT:')
        );
        const currentFieldMessage = state.messages.find((m: any) =>
          m._getType() === 'system' && m.content.startsWith('CURRENTFIELD:')
        );

        if (!userMessage || !intentMessage) {
          return { messages: [] };
        }

        const userInput = userMessage.content.toString();
        const intent = intentMessage.content.toString().replace('INTENT:', '');
        const currentDraft = contextMessage
          ? JSON.parse(contextMessage.content.toString().replace('CONTEXT:', ''))
          : {};
        const currentField = currentFieldMessage
          ? currentFieldMessage.content.toString().replace('CURRENTFIELD:', '')
          : null;

        // For ASK intent, don't extract data
        if (intent === 'ASK') {
          return { messages: [new SystemMessage('EXTRACTED:{}')
] };
        }

        // For IGNORE intent, skip extraction
        if (intent === 'IGNORE') {
          return { messages: [new SystemMessage('EXTRACTED:{}') ]};
        }

        // Extract data with intelligent prompting
        let systemPrompt = '';

        if (intent === 'MODIFY') {
          // Special prompt for modifications/corrections with context
          const currentValues = JSON.stringify(currentDraft, null, 2);
          systemPrompt = `CORRECTION MODE: User wants to CHANGE a previous answer.

Current stored values:
${currentValues}

User's correction: "${userInput}"

TASK: Extract ONLY the NEW/CORRECTED value they want to change TO.
Focus on the word AFTER "to" or "change to" or "make it" or "update to".

Examples:

Current: {"customerName":"John Smith"}
Input: "Actually, change the customer name to Jane Smith"
Extract: The word AFTER "to" is "Jane Smith"
Output: {"customerName":"Jane Smith"}

Current: {"customerEmail":"john@test.com"}
Input: "No wait, the email should be jane@example.com"
Extract: The NEW email is "jane@example.com"
Output: {"customerEmail":"jane@example.com"}

Current: {"estimatedBudget":"$10,000"}
Input: "Update it to $15,000"
Extract: The value AFTER "to" is "$15,000"
Output: {"estimatedBudget":"$15,000"}

Now extract from: "${userInput}"
Look for what comes AFTER change keywords.
Return ONLY valid JSON (NO explanations, NO markdown):`;
        } else {
          // Normal extraction prompt - use currentField to guide extraction
          const fieldHint = currentField
            ? `We are currently asking about: ${currentField}. Extract the value for THIS field.`
            : 'Extract all mentioned fields.';

          systemPrompt = `Extract information from the user's LATEST message ONLY.

LATEST USER MESSAGE: "${userInput}"

${fieldHint}

CRITICAL RULES:
1. Extract ONLY from the message above (NOT from conversation history)
2. ${currentField ? `Extract to field: "${currentField}"` : 'Extract all mentioned fields'}
3. If message contains multiple pieces of info, extract them all appropriately

Extraction examples:

Input: "Jane Smith" (for customerName field)
Output: {"customerName":"Jane Smith"}

Input: "jane.smith@example.com" (for customerEmail field)
Output: {"customerEmail":"jane.smith@example.com"}

Input: "$45,000" (for estimatedBudget field)
Output: {"estimatedBudget":"$45,000"}

Input: "Kitchen Remodel" (for projectType field)
Output: {"projectType":"Kitchen Remodel"}

Input: "john@example.com and phone 555-1234" (multi-fact)
Output: {"customerEmail":"john@example.com","customerPhone":"555-1234"}

Available fields: customerName, customerEmail, customerPhone, customerAddress, projectType, location, scopeDescription, estimatedBudget, downPaymentPercentage, estimatedStartDate, estimatedCompletionDate, validUntil

${currentField ? `IMPORTANT: Extract to the field "${currentField}"` : ''}

Extract from "${userInput}" (ONLY JSON, NO markdown):`;
        }

        try {
          const response = await this.model!.invoke([new SystemMessage(systemPrompt)]);
          let jsonText = response.content.toString().replace(/```json|```/g, '').trim();

          // Handle case where response might not be valid JSON
          if (!jsonText.startsWith('{')) {
            jsonText = '{}';
          }

          const extracted = JSON.parse(jsonText);
          console.log('[InterviewGraph] Extracted:', extracted);

          return {
            messages: [new SystemMessage(`EXTRACTED:${JSON.stringify(extracted)}`)],
          };
        } catch (error) {
          console.error('[InterviewGraph] Extraction error:', error);
          return { messages: [new SystemMessage('EXTRACTED:{}')]};
        }
      })

      // Generator: Create natural next question
      .addNode('generator', async (state) => {
        // This will be handled by the interview.service.ts
        // We just pass through here
        return { messages: [] };
      })

      // Define flow
      .addEdge('__start__', 'router')
      .addEdge('router', 'processor')
      .addEdge('processor', 'generator')
      .addEdge('generator', '__end__');

    return workflow.compile();
  }

  /**
   * Process a single interview turn using the graph
   */
  async processTurn(input: InterviewTurnInput): Promise<InterviewTurnOutput> {
    if (!this.initialized || !this.app) {
      throw new Error('Interview graph not initialized');
    }

    try {
      // Convert conversation history to messages
      const messages = input.conversationHistory.map((msg) =>
        msg.role === 'user' ? new HumanMessage(msg.content) : new AIMessage(msg.content)
      );

      // Add context about current draft (for MODIFY intent)
      messages.push(new SystemMessage(`CONTEXT:${JSON.stringify(input.currentDraft)}`));

      // Add current field being asked about
      if (input.currentField) {
        messages.push(new SystemMessage(`CURRENTFIELD:${input.currentField}`));
      }

      // Add current user input
      messages.push(new HumanMessage(input.userInput));

      // Run the graph
      const result = await this.app.invoke({ messages });

      // Extract intent and data from result messages
      const intentMsg = result.messages.find((m: any) =>
        m._getType() === 'system' && m.content.startsWith('INTENT:')
      );
      const extractedMsg = result.messages.find((m: any) =>
        m._getType() === 'system' && m.content.startsWith('EXTRACTED:')
      );

      const intent = intentMsg?.content.replace('INTENT:', '') || 'ANSWER';
      const extractedDataStr = extractedMsg?.content.replace('EXTRACTED:', '') || '{}';
      const extractedData = JSON.parse(extractedDataStr);

      // Map intent to simplified format
      let userIntent: 'ANSWER' | 'MODIFY' | 'ASK' | 'IGNORE' = 'ANSWER';
      if (intent === 'MODIFY') userIntent = 'MODIFY';
      else if (intent === 'ASK') userIntent = 'ASK';
      else if (intent === 'IGNORE') userIntent = 'IGNORE';

      // Check if complete
      const updatedDraft = { ...input.currentDraft, ...extractedData };
      const missingFields = input.requiredFields.filter(field => !updatedDraft[field]);
      const isComplete = missingFields.length === 0 && !input.collectingLineItems;

      return {
        userIntent,
        extractedData,
        nextQuestion: null, // interview.service.ts will generate this
        isComplete,
        reasoning: `Intent: ${userIntent}, Extracted: ${Object.keys(extractedData).length} fields`,
      };
    } catch (error) {
      console.error('[InterviewGraph] Processing error:', error);

      // Fallback to simple extraction
      return {
        userIntent: 'ANSWER',
        extractedData: {},
        nextQuestion: null,
        isComplete: false,
      };
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

// Export singleton instance
export const interviewGraph = new InterviewGraphService();

// server/services/interview.service.ts

/**
 * Interview Service
 * Handles AI-powered conversational interviews for quote collection
 * Enhanced with LangGraph for non-linear conversation flow
 */

import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { interviewRepository } from '../storage/repositories/interview.repository';
import { InterviewSession } from '@shared/schema';
import { storage } from '../storage';
import { interviewGraph } from './interview-graph';

// Question catalog - maps fields to natural language questions
const QUESTION_CATALOG: Record<string, {
  question: string;
  category: 'customer' | 'project' | 'financial' | 'timeline' | 'lineitems';
  validation?: (value: any) => boolean;
  dependencies?: string[];
}> = {
  customerName: {
    question: "What's the customer's full name?",
    category: 'customer',
  },
  customerEmail: {
    question: "What's the customer's email address?",
    category: 'customer',
    validation: (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
  },
  customerPhone: {
    question: "What's the customer's phone number?",
    category: 'customer',
  },
  customerAddress: {
    question: "What's the project address or customer's address?",
    category: 'customer',
  },
  projectType: {
    question: "What type of project is this? (e.g., kitchen remodel, deck construction, bathroom renovation)",
    category: 'project',
  },
  location: {
    question: "Where specifically will the work be done? (e.g., 'Outside backyard', 'Master bathroom')",
    category: 'project',
  },
  scopeDescription: {
    question: "Can you describe the scope of work in detail?",
    category: 'project',
  },
  estimatedBudget: {
    question: "What's the estimated total budget for this project?",
    category: 'financial',
    dependencies: ['scopeDescription'],
  },
  downPaymentPercentage: {
    question: "What percentage would you like as a down payment? (Default is 40%)",
    category: 'financial',
    validation: (val) => val >= 0 && val <= 100,
  },
  estimatedStartDate: {
    question: "When do you estimate this project will start?",
    category: 'timeline',
  },
  estimatedCompletionDate: {
    question: "When do you estimate completion?",
    category: 'timeline',
    dependencies: ['estimatedStartDate'],
  },
  validUntil: {
    question: "How long should this quote be valid? (e.g., 30 days, 60 days)",
    category: 'timeline',
  },
  _collectLineItems: {
    question: "What materials or services do you need for this project? Describe each item with details like quantity and estimated cost. Say 'done' when you've listed everything.",
    category: 'lineitems',
    dependencies: ['scopeDescription', 'estimatedBudget'],
  },
};

// Field collection order
const FIELD_ORDER = [
  'customerName',
  'customerEmail',
  'customerPhone',
  'customerAddress',
  'projectType',
  'location',
  'scopeDescription',
  'estimatedBudget',
  'downPaymentPercentage',
  'estimatedStartDate',
  'estimatedCompletionDate',
  'validUntil',
  '_collectLineItems', // Special state for iterative line item collection
];

class InterviewService {
  private model: ChatOpenAI | null = null;
  private initialized: boolean = false;

  constructor() {
    try {
      const deepseekKey = process.env.DEEPSEEK_API_KEY;
      const openaiKey = process.env.OPENAI_API_KEY;

      if (!deepseekKey && !openaiKey) {
        console.warn('[InterviewService] No API key configured');
        return;
      }

      // Prefer DeepSeek for cost efficiency
      if (deepseekKey) {
        this.model = new ChatOpenAI({
          modelName: "deepseek-chat",
          temperature: 0.3, // Slightly creative for conversational responses
          apiKey: deepseekKey,
          configuration: { baseURL: "https://api.deepseek.com" },
        });
      } else {
        this.model = new ChatOpenAI({
          modelName: "gpt-4-turbo-preview",
          temperature: 0.3,
          apiKey: openaiKey,
        });
      }

      this.initialized = true;
      console.log('[InterviewService] Initialized successfully');
    } catch (error) {
      console.error('[InterviewService] Initialization failed:', error);
    }
  }

  /**
   * Start a new interview session
   */
  async startSession(userId: number, leadId?: number): Promise<{
    sessionId: number;
    question: string;
    currentField: string;
    progress: {
      completedFields: string[];
      totalFields: number;
      percentComplete: number;
    };
  }> {
    // Check for existing active session
    const existingSession = await interviewRepository.getActiveSessionByUserId(userId);
    if (existingSession) {
      const progress = this.calculateProgress(existingSession.quoteDraft as Record<string, any>);
      return {
        sessionId: existingSession.id,
        question: this.getNextQuestion(existingSession.quoteDraft as Record<string, any>, existingSession.currentField || undefined),
        currentField: existingSession.currentField || FIELD_ORDER[0],
        progress,
      };
    }

    // Create new session
    const session = await interviewRepository.createSession({
      userId,
      leadId: leadId || null,
      status: 'active',
      currentField: FIELD_ORDER[0],
      quoteDraft: {},
      transcript: [],
    });

    const firstQuestion = QUESTION_CATALOG[FIELD_ORDER[0]].question;

    // Add assistant greeting to transcript
    await interviewRepository.appendToTranscript(session.id, {
      role: 'assistant',
      content: `Hi! I'll help you create a quote. Let's get started. ${firstQuestion}`,
      timestamp: new Date().toISOString(),
    });

    const progress = this.calculateProgress({});

    return {
      sessionId: session.id,
      question: firstQuestion,
      currentField: FIELD_ORDER[0],
      progress,
    };
  }

  /**
   * Process a user turn in the interview
   */
  async processTurn(
    sessionId: number,
    input: string,
    audioUri?: string
  ): Promise<{
    question: string | null;
    currentField: string | null;
    extractedData: Record<string, any>;
    quoteDraft: Record<string, any>;
    isComplete: boolean;
    progress: {
      completedFields: string[];
      totalFields: number;
      percentComplete: number;
    };
  }> {
    if (!this.initialized || !this.model) {
      throw new Error('Interview service not initialized');
    }

    // Get session
    const session = await interviewRepository.getSessionById(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    if (session.status !== 'active') {
      throw new Error('Session is not active');
    }

    // Check if session is stale (older than 24 hours)
    const ageMs = Date.now() - new Date(session.updatedAt).getTime();
    if (ageMs > 24 * 60 * 60 * 1000) {
      await interviewRepository.abandonSession(session.id);
      throw new Error('Session has expired. Please start a new interview.');
    }

    // Add user input to transcript
    await interviewRepository.appendToTranscript(session.id, {
      role: 'user',
      content: input,
      timestamp: new Date().toISOString(),
      audioUri,
    });

    const quoteDraft = session.quoteDraft as Record<string, any>;
    let extractedData: Record<string, any> = {};

    // Use LangGraph for intelligent, non-linear extraction
    if (interviewGraph.isInitialized()) {
      try {
        // Prepare conversation history for the graph
        const transcript = session.transcript as any[];
        const conversationHistory = transcript.map((entry: any) => ({
          role: entry.role === 'assistant' ? 'assistant' : 'user',
          content: entry.content,
        }));

        // Process turn with graph
        const graphResult = await interviewGraph.processTurn({
          userInput: input,
          currentDraft: quoteDraft,
          requiredFields: FIELD_ORDER.filter(f => f !== '_collectLineItems'),
          conversationHistory,
          collectingLineItems: session.currentField === '_collectLineItems',
          currentField: session.currentField || undefined,
        });

        console.log('[InterviewService] Graph result:', {
          intent: graphResult.userIntent,
          extractedFields: Object.keys(graphResult.extractedData),
          reasoning: graphResult.reasoning,
        });

        // Handle line item collection
        if (session.currentField === '_collectLineItems') {
          const isDone = this.isLineItemCollectionComplete(input);

          if (!isDone) {
            // Extract line item from input
            const lineItem = await this.extractLineItem(input);
            if (lineItem) {
              const lineItems = quoteDraft.lineItems || [];
              lineItems.push(lineItem);
              extractedData = { lineItems };
            }
          }
        } else {
          // Use graph-extracted data (handles multi-fact, corrections, math)
          extractedData = graphResult.extractedData;
        }
      } catch (error) {
        console.error('[InterviewService] Graph processing failed, falling back to linear:', error);

        // Fallback to linear extraction
        if (session.currentField === '_collectLineItems') {
          const isDone = this.isLineItemCollectionComplete(input);
          if (!isDone) {
            const lineItem = await this.extractLineItem(input);
            if (lineItem) {
              const lineItems = quoteDraft.lineItems || [];
              lineItems.push(lineItem);
              extractedData = { lineItems };
            }
          }
        } else {
          extractedData = await this.extractDataFromInput(
            input,
            session.currentField!,
            quoteDraft
          );
        }
      }
    } else {
      // Fallback to original linear logic if graph not initialized
      console.log('[InterviewService] Graph not initialized, using linear extraction');

      if (session.currentField === '_collectLineItems') {
        const isDone = this.isLineItemCollectionComplete(input);
        if (!isDone) {
          const lineItem = await this.extractLineItem(input);
          if (lineItem) {
            const lineItems = quoteDraft.lineItems || [];
            lineItems.push(lineItem);
            extractedData = { lineItems };
          }
        }
      } else {
        extractedData = await this.extractDataFromInput(
          input,
          session.currentField!,
          quoteDraft
        );
      }
    }

    // Merge extracted data into quote draft
    const updatedQuoteDraft = {
      ...quoteDraft,
      ...extractedData,
    };

    // Find next missing field
    const nextField = session.currentField === '_collectLineItems' && this.isLineItemCollectionComplete(input)
      ? null  // Done with line items
      : session.currentField === '_collectLineItems'
      ? '_collectLineItems'  // Stay in line items mode
      : this.findNextMissingField(updatedQuoteDraft);

    // Check if interview is complete
    const isComplete = nextField === null;

    let responseQuestion: string | null = null;
    if (!isComplete && nextField) {
      responseQuestion = QUESTION_CATALOG[nextField].question;
    } else if (isComplete) {
      responseQuestion = null; // Signal completion
    }

    // Update session
    await interviewRepository.updateSession(session.id, {
      quoteDraft: updatedQuoteDraft,
      currentField: nextField,
    });

    // Add assistant response to transcript
    if (responseQuestion) {
      await interviewRepository.appendToTranscript(session.id, {
        role: 'assistant',
        content: responseQuestion,
        timestamp: new Date().toISOString(),
        extractedData,
      });
    } else {
      await interviewRepository.appendToTranscript(session.id, {
        role: 'assistant',
        content: "Great! I have all the information I need. Your quote is ready for review.",
        timestamp: new Date().toISOString(),
        extractedData,
      });
    }

    // Mark session as completed if done
    if (isComplete) {
      await interviewRepository.completeSession(session.id);
    }

    const progress = this.calculateProgress(updatedQuoteDraft);

    return {
      question: responseQuestion,
      currentField: nextField,
      extractedData,
      quoteDraft: updatedQuoteDraft,
      isComplete,
      progress,
    };
  }

  /**
   * Extract structured data from user input using LLM
   */
  private async extractDataFromInput(
    input: string,
    currentField: string,
    existingData: Record<string, any>
  ): Promise<Record<string, any>> {
    if (!this.model) throw new Error('Model not initialized');

    const systemPrompt = `You are a helpful assistant extracting structured data from natural language responses during a quote interview.

CURRENT FIELD: ${currentField}
CURRENT QUESTION: ${QUESTION_CATALOG[currentField]?.question || 'Unknown field'}

EXISTING DATA:
${JSON.stringify(existingData, null, 2)}

USER RESPONSE: "${input}"

INSTRUCTIONS:
1. Extract the value for ${currentField} from the user's response
2. Also extract any other fields mentioned that aren't in EXISTING DATA yet
3. Return ONLY a JSON object with the extracted fields
4. Use null for fields you cannot extract with confidence
5. For dates, use ISO format (YYYY-MM-DD)
6. For percentages, use numbers (e.g., 40 not "40%")
7. For currency, use strings without symbols (e.g., "5000" not "$5,000")

EXAMPLE OUTPUT:
{
  "${currentField}": "extracted value",
  "otherField": "value if mentioned"
}

RESPOND WITH VALID JSON ONLY - NO MARKDOWN, NO EXPLANATIONS.`;

    try {
      const response = await this.model.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(input),
      ]);

      const content = response.content.toString().trim();

      // Extract JSON from response (handle markdown code blocks)
      let jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/);
      const jsonString = jsonMatch ? jsonMatch[1] : content;

      const extracted = JSON.parse(jsonString);

      // Validate extracted data
      const validated: Record<string, any> = {};
      for (const [key, value] of Object.entries(extracted)) {
        if (value !== null && value !== undefined && value !== '') {
          // Apply field-specific validation if exists
          const fieldConfig = QUESTION_CATALOG[key];
          if (fieldConfig?.validation && !fieldConfig.validation(value)) {
            console.warn(`[InterviewService] Validation failed for ${key}: ${value}`);
            continue;
          }
          validated[key] = value;
        }
      }

      console.log('[InterviewService] Extracted data:', validated);
      return validated;

    } catch (error) {
      console.error('[InterviewService] Data extraction error:', error);
      // Fallback: try simple keyword matching for current field
      return this.fallbackExtraction(input, currentField);
    }
  }

  /**
   * Extract line item from user input
   */
  private async extractLineItem(input: string): Promise<any | null> {
    if (!this.model) throw new Error('Model not initialized');

    const systemPrompt = `You are extracting construction line item details from user description.

USER INPUT: "${input}"

Extract these fields:
- description: What is the item/service
- category: One of: "Labor", "Materials", "Equipment", "Subcontractor", "Other"
- quantity: Number (default 1 if not mentioned)
- unit: Unit of measurement (e.g., "each", "sq ft", "linear ft", "hours", "days")
- unitPrice: Estimated price per unit (number, no $ symbol)

RESPOND WITH VALID JSON ONLY:
{
  "description": "...",
  "category": "...",
  "quantity": 1,
  "unit": "each",
  "unitPrice": 0
}

If the user didn't provide enough info, ask them by returning null.`;

    try {
      const response = await this.model.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(input),
      ]);

      const content = response.content.toString().trim();
      let jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/);
      const jsonString = jsonMatch ? jsonMatch[1] : content;

      if (jsonString === 'null') return null;

      const lineItem = JSON.parse(jsonString);

      // Validate required fields
      if (lineItem.description && lineItem.category) {
        return lineItem;
      }

      return null;
    } catch (error) {
      console.error('[InterviewService] Line item extraction error:', error);
      return null;
    }
  }

  /**
   * Check if user indicated line item collection is complete
   */
  private isLineItemCollectionComplete(input: string): boolean {
    const lowerInput = input.toLowerCase().trim();
    const doneKeywords = ['done', "that's all", 'thats all', 'finished', 'complete', 'no more', 'nothing else'];
    return doneKeywords.some(keyword => lowerInput.includes(keyword));
  }

  /**
   * Fallback extraction using simple heuristics
   */
  private fallbackExtraction(input: string, currentField: string): Record<string, any> {
    const result: Record<string, any> = {};

    // Email detection
    if (currentField === 'customerEmail') {
      const emailMatch = input.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      if (emailMatch) result[currentField] = emailMatch[0];
    }

    // Phone detection
    if (currentField === 'customerPhone') {
      const phoneMatch = input.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
      if (phoneMatch) result[currentField] = phoneMatch[0];
    }

    // Default: use the entire input
    if (Object.keys(result).length === 0) {
      result[currentField] = input.trim();
    }

    return result;
  }

  /**
   * Find the next field that needs to be collected
   */
  private findNextMissingField(quoteDraft: Record<string, any>): string | null {
    for (const field of FIELD_ORDER) {
      const fieldConfig = QUESTION_CATALOG[field];

      // Skip line items if they exist
      if (field === '_collectLineItems' && quoteDraft.lineItems && quoteDraft.lineItems.length > 0) {
        continue;
      }

      // Check dependencies
      if (fieldConfig.dependencies) {
        const depsMet = fieldConfig.dependencies.every(dep => quoteDraft[dep]);
        if (!depsMet) continue; // Skip this field if dependencies not met
      }

      // Check if field is missing or empty
      if (!quoteDraft[field] || quoteDraft[field] === '') {
        return field;
      }
    }

    return null; // All fields collected
  }

  /**
   * Calculate progress percentage
   */
  private calculateProgress(quoteDraft: Record<string, any>): {
    completedFields: string[];
    totalFields: number;
    percentComplete: number;
  } {
    const completedFields = FIELD_ORDER.filter(field => {
      if (field === '_collectLineItems') {
        return quoteDraft.lineItems && quoteDraft.lineItems.length > 0;
      }
      return quoteDraft[field] && quoteDraft[field] !== '';
    });

    return {
      completedFields,
      totalFields: FIELD_ORDER.length,
      percentComplete: Math.round((completedFields.length / FIELD_ORDER.length) * 100),
    };
  }

  /**
   * Get next question based on current state
   */
  private getNextQuestion(quoteDraft: Record<string, any>, currentField?: string): string {
    const nextField = currentField || this.findNextMissingField(quoteDraft);
    if (!nextField) {
      return "Great! I have all the information I need. Your quote is ready for review.";
    }
    return QUESTION_CATALOG[nextField].question;
  }

  /**
   * Get session with progress calculation
   */
  async getSession(sessionId: number): Promise<{
    session: InterviewSession;
    progress: {
      completedFields: string[];
      totalFields: number;
      percentComplete: number;
    };
  }> {
    const session = await interviewRepository.getSessionById(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const quoteDraft = session.quoteDraft as Record<string, any>;
    const progress = this.calculateProgress(quoteDraft);

    return {
      session,
      progress,
    };
  }

  /**
   * Create a quote from completed session
   */
  /**
   * Parse "X days" format to a future date
   */
  private parseValidUntil(value: string): Date {
    // Try to parse as date first
    const directDate = new Date(value);
    if (!isNaN(directDate.getTime())) {
      return directDate;
    }

    // Check for "X days" format
    const daysMatch = value.match(/(\d+)\s*days?/i);
    if (daysMatch) {
      const days = parseInt(daysMatch[1], 10);
      return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    }

    // Default to 30 days
    return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }

  /**
   * Generate internal project notes from conversation transcript
   */
  private async generateProjectNotes(
    transcript: any[],
    quoteDraft: Record<string, any>
  ): Promise<string> {
    if (!this.model) {
      return '';
    }

    try {
      // Build conversation summary
      const conversationText = transcript
        .map((entry: any) => `${entry.role}: ${entry.content}`)
        .join('\n');

      const systemPrompt = `You are analyzing an interview conversation to generate internal PROJECT NOTES for contractors.

CONVERSATION TRANSCRIPT:
${conversationText}

PROJECT DETAILS:
${JSON.stringify(quoteDraft, null, 2)}

TASK: Generate concise internal project notes (2-4 bullet points) that capture:
- Any special requirements or preferences mentioned
- Timeline constraints or scheduling notes
- Budget considerations or payment preferences
- Material preferences or specific requests
- Potential challenges or considerations
- Customer priorities or concerns

FORMAT: Return bullet points only, no explanations. Start each with "• ".

EXAMPLE OUTPUT:
• Customer prefers natural wood finishes for cabinets
• Tight timeline - needs completion before May for family event
• Budget allows for premium countertops
• Kitchen currently functional, can work around existing layout

Generate notes for this project:`;

      const response = await this.model.invoke([new SystemMessage(systemPrompt)]);
      const notes = response.content.toString().trim();

      return notes || '';
    } catch (error) {
      console.error('[InterviewService] Failed to generate project notes:', error);
      return '';
    }
  }

  async createQuoteFromSession(sessionId: number, createdById: number): Promise<any> {
    const { session } = await this.getSession(sessionId);

    if (session.status !== 'completed') {
      throw new Error('Session must be completed before creating quote');
    }

    const quoteDraft = session.quoteDraft as Record<string, any>;
    const transcript = session.transcript as any[];

    // Generate AI-powered project notes from conversation
    const projectNotes = await this.generateProjectNotes(transcript, quoteDraft);

    // Create quote from interview data
    const quoteData: any = {
      title: `${quoteDraft.projectType} - ${quoteDraft.customerName}`,
      description: quoteDraft.scopeDescription,
      customerName: quoteDraft.customerName,
      customerEmail: quoteDraft.customerEmail,
      customerPhone: quoteDraft.customerPhone,
      customerAddress: quoteDraft.customerAddress,
      projectType: quoteDraft.projectType,
      location: quoteDraft.location,
      scopeDescription: quoteDraft.scopeDescription,
      projectNotes: projectNotes || null,
      estimatedStartDate: quoteDraft.estimatedStartDate ? new Date(quoteDraft.estimatedStartDate) : null,
      estimatedCompletionDate: quoteDraft.estimatedCompletionDate ? new Date(quoteDraft.estimatedCompletionDate) : null,
      validUntil: quoteDraft.validUntil ? this.parseValidUntil(quoteDraft.validUntil) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      downPaymentPercentage: quoteDraft.downPaymentPercentage || 40,
      milestonePaymentPercentage: 40,
      finalPaymentPercentage: 20,
    };

    console.log('[InterviewService] Generated project notes:', projectNotes);

    const quote = await storage.quotes.createQuote(quoteData, createdById);

    // Create line items if they exist
    if (quoteDraft.lineItems && quoteDraft.lineItems.length > 0) {
      for (const item of quoteDraft.lineItems) {
        await storage.quotes.createLineItem(quote.id, {
          category: item.category,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit || 'each',
          unitPrice: item.unitPrice,
          totalPrice: item.quantity * item.unitPrice,
          sortOrder: 0,
        });
      }
    }

    // If linked to a lead, auto-convert the lead
    if (session.leadId) {
      try {
        await storage.leads.markAsConverted(session.leadId, quote.id);
        console.log(`[InterviewService] Lead ${session.leadId} auto-converted to quote ${quote.id}`);
      } catch (error) {
        console.error('[InterviewService] Failed to auto-convert lead:', error);
        // Continue anyway - quote was created successfully
      }
    }

    return quote;
  }
}

export const interviewService = new InterviewService();

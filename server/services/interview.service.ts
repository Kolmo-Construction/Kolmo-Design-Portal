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
import { uploadToR2 } from '../r2-upload';
import { geminiReceiptService } from './gemini-receipt.service';

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
  async startSession(userId: number, leadId?: number, initialData?: Record<string, any>): Promise<{
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

    // Prepare initial quote draft with location data if provided
    const quoteDraft: Record<string, any> = {};
    if (initialData?.customerAddress) {
      quoteDraft.customerAddress = initialData.customerAddress;
      quoteDraft.latitude = initialData.latitude;
      quoteDraft.longitude = initialData.longitude;
    }

    // Create new session
    const session = await interviewRepository.createSession({
      userId,
      leadId: leadId || null,
      status: 'active',
      currentField: FIELD_ORDER[0],
      quoteDraft,
      transcript: [],
    });

    const firstQuestion = QUESTION_CATALOG[FIELD_ORDER[0]].question;

    // Prepare greeting message
    let greetingMessage = "Hi! I'll help you create a quote. Let's get started.";
    if (initialData?.customerAddress) {
      greetingMessage += ` I've automatically captured your location as: ${initialData.customerAddress}. I'll confirm this with you when we get to the project address.`;
    } else {
      greetingMessage += " I'll ask you for the project address during our conversation.";
    }
    greetingMessage += ` ${firstQuestion}`;

    // Add assistant greeting to transcript
    await interviewRepository.appendToTranscript(session.id, {
      role: 'assistant',
      content: greetingMessage,
      timestamp: new Date().toISOString(),
    });

    const progress = this.calculateProgress(quoteDraft);

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

        // NEW: Build image context from uploaded images
        const imageContext = (quoteDraft.images || []).map((img: any) => ({
          caption: img.caption || '',
          detectedElements: img.detectedElements || [],
          extractedInfo: img.extractedData || {},
        }));

        // Process turn with graph
        const graphResult = await interviewGraph.processTurn({
          userInput: input,
          currentDraft: quoteDraft,
          requiredFields: FIELD_ORDER.filter(f => f !== '_collectLineItems'),
          conversationHistory,
          collectingLineItems: session.currentField === '_collectLineItems',
          currentField: session.currentField || undefined,
          // NEW: Pass image context to the graph
          imageContext: imageContext.length > 0 ? imageContext : undefined,
          hasVoiceInput: !!audioUri,
        });

        console.log('[InterviewService] Graph result:', {
          intent: graphResult.userIntent,
          extractedFields: Object.keys(graphResult.extractedData),
          reasoning: graphResult.reasoning,
          hasGeneratedQuestion: !!graphResult.nextQuestion,
        });

        // NEW: Check if this was a meta-question (user asking about interview progress)
        // If so, use the meta-response as the next question
        let metaResponse: string | null = null;
        if (graphResult.userIntent === 'ASK') {
          // The graph might have generated a meta-response for questions like "what do you need?"
          // We'll check for this later when processing the graph result again
          metaResponse = graphResult.nextQuestion;
        }

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

    // Check if we extracted anything at all
    const extractedFieldCount = Object.keys(extractedData).length;
    const wasOnField = session.currentField;

    // Find next missing field
    const nextField = session.currentField === '_collectLineItems' && this.isLineItemCollectionComplete(input)
      ? null  // Done with line items
      : session.currentField === '_collectLineItems'
      ? '_collectLineItems'  // Stay in line items mode
      : this.findNextMissingField(updatedQuoteDraft);

    // Check if interview is complete
    const isComplete = nextField === null;

    let responseQuestion: string | null = null;

    // NEW: Try to use graph-generated question first
    let graphGeneratedQuestion: string | null = null;
    if (interviewGraph.isInitialized()) {
      try {
        const transcript = session.transcript as any[];
        const conversationHistory = transcript.map((entry: any) => ({
          role: entry.role === 'assistant' ? 'assistant' : 'user',
          content: entry.content,
        }));
        const imageContext = (updatedQuoteDraft.images || []).map((img: any) => ({
          caption: img.caption || '',
          detectedElements: img.detectedElements || [],
          extractedInfo: img.extractedData || {},
        }));

        const graphResult = await interviewGraph.processTurn({
          userInput: input,
          currentDraft: updatedQuoteDraft,
          requiredFields: FIELD_ORDER.filter(f => f !== '_collectLineItems'),
          conversationHistory,
          collectingLineItems: session.currentField === '_collectLineItems',
          currentField: nextField || undefined,
          imageContext: imageContext.length > 0 ? imageContext : undefined,
          hasVoiceInput: !!audioUri,
        });

        graphGeneratedQuestion = graphResult.nextQuestion;
        console.log('[InterviewService] Graph generated question:', graphGeneratedQuestion);
      } catch (error) {
        console.error('[InterviewService] Failed to generate question via graph:', error);
      }
    }

    // Use graph-generated question if available (includes meta-responses), otherwise fall back to old logic
    if (graphGeneratedQuestion) {
      responseQuestion = graphGeneratedQuestion;
      console.log('[InterviewService] Using graph-generated question:', responseQuestion);
    } else if (extractedFieldCount === 0 && wasOnField && wasOnField !== '_collectLineItems') {
      // Nothing extracted - ask for clarification
      const isVoiceInput = !!audioUri;
      const validationMessage = await this.generateValidationFeedback(
        input,
        wasOnField,
        QUESTION_CATALOG[wasOnField],
        isVoiceInput
      );
      responseQuestion = `${validationMessage} ${QUESTION_CATALOG[wasOnField].question}`;
    } else if (extractedFieldCount > 0) {
      // Something was extracted! Generate smart acknowledgment
      responseQuestion = await this.generateSmartResponse(
        extractedData,
        updatedQuoteDraft,
        nextField,
        isComplete
      );
    } else if (!isComplete && nextField) {
      // Standard next question
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
   * ENHANCED: Extract ALL possible fields from the message, not just current field
   */
  private async extractDataFromInput(
    input: string,
    currentField: string,
    existingData: Record<string, any>
  ): Promise<Record<string, any>> {
    if (!this.model) throw new Error('Model not initialized');

    const systemPrompt = `You are an intelligent assistant extracting quote information from natural conversation.

USER MESSAGE: "${input}"

CURRENTLY ASKING ABOUT: ${currentField} - ${QUESTION_CATALOG[currentField]?.question || 'Unknown'}

ALREADY HAVE:
${JSON.stringify(existingData, null, 2)}

YOUR TASK: Extract ALL quote-related information from the user's message, not just what you asked for.

FIELDS YOU CAN EXTRACT:
- customerName: Full name (first and last)
- customerEmail: Email address
- customerPhone: Phone number
- customerAddress: Project or customer address
- projectType: Type of project - BE FLEXIBLE! Extract from variations like:
  * "deck buildout" → "deck construction"
  * "this project is a deck" → "deck construction"
  * "kitchen remodel", "kitchen renovation", "kitchen upgrade" → "kitchen remodel"
  * "bathroom redo" → "bathroom renovation"
  * Normalize to standard types: "deck construction", "kitchen remodel", "bathroom renovation", "flooring installation", etc.
- location: Specific location of work (e.g., "backyard", "master bathroom")
- scopeDescription: Detailed description of the work
- estimatedBudget: Budget amount (extract numbers, keep as string with $ if present)
- downPaymentPercentage: Down payment % (0-100)
- estimatedStartDate: Start date (YYYY-MM-DD or natural format)
- estimatedCompletionDate: Completion date (YYYY-MM-DD or natural format)
- validUntil: Quote validity period

EXAMPLES OF FLEXIBLE EXTRACTION:

Input: "The customer is John Smith, project is at 123 Main St, we're doing a kitchen remodel"
Output: {"customerName":"John Smith","customerAddress":"123 Main St","projectType":"kitchen remodel"}

Input: "This is for a deck buildout in the backyard, budget around $15000"
Output: {"projectType":"deck construction","location":"backyard","estimatedBudget":"$15000"}

Input: "This project is a deck" (normalize to standard type)
Output: {"projectType":"deck construction"}

Input: "Bathroom redo for Mrs. Johnson, about $8k"
Output: {"projectType":"bathroom renovation","estimatedBudget":"$8k"}

Input: "jane@email.com and her phone is 555-1234, address is 456 Oak Ave"
Output: {"customerEmail":"jane@email.com","customerPhone":"555-1234","customerAddress":"456 Oak Ave"}

RULES:
1. Extract EVERYTHING mentioned, even if it's not the field you asked about
2. Don't overwrite fields that are already in ALREADY HAVE unless user is correcting them
3. Use null only for fields you're completely unsure about
4. Be flexible with formats - extract the intent

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

    // Check if field already has a value - if so, ask for confirmation instead
    if (quoteDraft[nextField]) {
      // Special handling for customerAddress (auto-captured from location)
      if (nextField === 'customerAddress') {
        return `I've detected your location as: ${quoteDraft[nextField]}. Is this the correct project address, or would you like to provide a different one?`;
      }
      // For other fields, ask for confirmation
      return `I have ${nextField} as: ${quoteDraft[nextField]}. Is this correct, or would you like to change it?`;
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
    let projectNotes = await this.generateProjectNotes(transcript, quoteDraft);

    // Append image analysis to project notes if images exist
    if (quoteDraft.images && quoteDraft.images.length > 0) {
      const imageNotes = '\n\n📸 SITE IMAGES:\n' + quoteDraft.images.map((img: any, idx: number) =>
        `${idx + 1}. ${img.caption}\n   Detected: ${img.detectedElements?.join(', ') || 'N/A'}\n   Status: ${img.workStatus || 'N/A'}`
      ).join('\n');
      projectNotes = (projectNotes || '') + imageNotes;
    }

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
      // Add first image as before image if available
      beforeImageUrl: quoteDraft.images?.[0]?.url || null,
      beforeImageCaption: quoteDraft.images?.[0]?.caption || 'Site Image',
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

  /**
   * Upload and analyze image during interview
   */
  async uploadAndAnalyzeImage(
    sessionId: number,
    imageBuffer: Buffer,
    filename: string
  ): Promise<{
    imageUrl: string;
    analysis: {
      caption: string;
      detectedElements: string[];
      workStatus: string;
      suggestedTags: string[];
    };
    message: string;
  }> {
    try {
      console.log(`[InterviewService] Uploading image for session ${sessionId}`);

      // Get session to get context
      const session = await interviewRepository.getSessionById(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      const quoteDraft = session.quoteDraft as Record<string, any>;

      // Upload image to R2
      console.log(`[InterviewService] Uploading to R2...`);
      const { url: imageUrl } = await uploadToR2({
        fileName: filename,
        buffer: imageBuffer,
        mimetype: this.getMimeType(filename),
        path: `interview/${sessionId}/`,
      });
      console.log(`[InterviewService] R2 upload successful: ${imageUrl}`);

      // Build context for Gemini (even if some fields are empty)
      const projectContext = [
        quoteDraft.projectType && `Project Type: ${quoteDraft.projectType}`,
        quoteDraft.location && `Location: ${quoteDraft.location}`,
        quoteDraft.scopeDescription && `Scope: ${quoteDraft.scopeDescription}`,
        quoteDraft.customerAddress && `Address: ${quoteDraft.customerAddress}`,
      ].filter(Boolean).join('. ');

      // Analyze image with Gemini - pass buffer directly to avoid URL fetch issues
      console.log(`[InterviewService] Analyzing image with Gemini...`);
      console.log(`[InterviewService] Project context: ${projectContext || 'None yet - analyzing without context'}`);

      const analysis = await geminiReceiptService.analyzeConstructionPhoto(
        imageBuffer,
        projectContext || 'Construction project quote interview - initial image upload',
        filename
      );

      console.log(`[InterviewService] Image analysis complete:`, analysis);

      // Extract quote-relevant information from image analysis
      const imageExtractedData: Record<string, any> = {};
      if (analysis.extractedInfo) {
        // Only populate fields that are currently empty
        if (analysis.extractedInfo.projectType && !quoteDraft.projectType) {
          imageExtractedData.projectType = analysis.extractedInfo.projectType;
          quoteDraft.projectType = analysis.extractedInfo.projectType;
        }

        // Add dimensions and materials to scope description if not already set
        if (!quoteDraft.scopeDescription && analysis.extractedInfo.scopeSummary) {
          let scopeParts = [analysis.extractedInfo.scopeSummary];
          if (analysis.extractedInfo.dimensions) {
            scopeParts.push(`Dimensions: ${analysis.extractedInfo.dimensions}`);
          }
          if (analysis.extractedInfo.materials) {
            scopeParts.push(`Materials: ${analysis.extractedInfo.materials}`);
          }
          imageExtractedData.scopeDescription = scopeParts.join('. ');
          quoteDraft.scopeDescription = imageExtractedData.scopeDescription;
        } else if (quoteDraft.scopeDescription && analysis.extractedInfo.dimensions) {
          // Append dimensions to existing scope if we found them
          if (!quoteDraft.scopeDescription.includes(analysis.extractedInfo.dimensions)) {
            quoteDraft.scopeDescription += ` Dimensions: ${analysis.extractedInfo.dimensions}.`;
            imageExtractedData.scopeDescription = quoteDraft.scopeDescription;
          }
        }
      }

      console.log('[InterviewService] Extracted from image:', imageExtractedData);

      // Store image and analysis in quote draft
      if (!quoteDraft.images) {
        quoteDraft.images = [];
      }

      quoteDraft.images.push({
        url: imageUrl,
        filename,
        uploadedAt: new Date().toISOString(),
        caption: analysis.caption,
        detectedElements: analysis.detectedElements,
        workStatus: analysis.workStatus,
        tags: analysis.suggestedTags,
        extractedData: imageExtractedData, // Store what was extracted
      });

      // Update session with new image data
      await interviewRepository.updateSession(sessionId, {
        quoteDraft,
      });

      // Add to transcript
      await interviewRepository.appendToTranscript(sessionId, {
        role: 'user',
        content: `[Image uploaded: ${filename}]`,
        timestamp: new Date().toISOString(),
        imageUrl,
      });

      // NEW: Generate a conversational acknowledgment + next question using the graph
      let acknowledgment = '';
      let nextQuestion = '';

      if (interviewGraph.isInitialized()) {
        try {
          // Get updated session after image upload
          const updatedSession = await interviewRepository.getSessionById(sessionId);
          const transcript = updatedSession?.transcript as any[] || [];
          const conversationHistory = transcript.map((entry: any) => ({
            role: entry.role === 'assistant' ? 'assistant' : 'user',
            content: entry.content,
          }));

          // Build image context including the newly uploaded image
          const imageContext = (quoteDraft.images || []).map((img: any) => ({
            caption: img.caption || '',
            detectedElements: img.detectedElements || [],
            extractedInfo: img.extractedData || {},
          }));

          // Generate context-aware acknowledgment
          const systemPrompt = `You are a friendly construction quote assistant. A user just uploaded an image during the interview.

IMAGE ANALYSIS:
${analysis.caption}

DETECTED ELEMENTS:
${analysis.detectedElements.join(', ')}

EXTRACTED DATA FROM IMAGE:
${JSON.stringify(imageExtractedData, null, 2)}

CURRENT QUOTE DRAFT:
${JSON.stringify(quoteDraft, null, 2)}

YOUR TASK:
Generate a warm, conversational acknowledgment (2-3 sentences) that:
1. Acknowledges the image was received
2. Mentions what you can see (be specific - reference dimensions, materials, project type)
3. Naturally transitions to asking for the next piece of information you need

Be conversational and reference the visual details!

EXAMPLES:

Image: Deck construction, 12x16 feet
Have: Nothing yet
Response: "Perfect! I can see you're planning a deck - it looks like it's about 12x16 feet. That's a great size! What's the customer's name for this project?"

Image: Kitchen remodel, granite countertops visible
Have: customerName="John Smith"
Response: "Great photo, John! I can see you're working on a kitchen remodel with granite countertops. Can you tell me more about the scope of work - what specific updates are planned?"

Image: Bathroom renovation, tiled floor
Have: projectType, customerName, need estimatedBudget
Response: "Thanks for the image! I can see the bathroom renovation with new tiling - looks professional. What's the estimated budget for this project?"

NOW: Generate the acknowledgment and next question:`;

          const response = await this.model!.invoke([new SystemMessage(systemPrompt)]);
          const generatedResponse = response.content.toString().trim();
          acknowledgment = generatedResponse;
        } catch (error) {
          console.error('[InterviewService] Failed to generate context-aware acknowledgment:', error);
          // Fallback to simple acknowledgment
          acknowledgment = `Perfect! I've analyzed your image. ${analysis.caption}`;
        }
      } else {
        // Fallback if graph not initialized
        acknowledgment = `Perfect! I've analyzed your image. ${analysis.caption}`;
      }

      // If no acknowledgment was generated, use fallback
      if (!acknowledgment) {
        acknowledgment = `Great! I can see ${analysis.caption}`;
        if (Object.keys(imageExtractedData).length > 0) {
          const extractedParts: string[] = [];
          if (imageExtractedData.projectType) {
            extractedParts.push(`the project type: ${imageExtractedData.projectType}`);
          }
          if (analysis.extractedInfo?.dimensions) {
            extractedParts.push(`dimensions: ${analysis.extractedInfo.dimensions}`);
          }
          if (extractedParts.length > 0) {
            acknowledgment += ` I've captured ${extractedParts.join(' and ')}.`;
          }
        }
      }

      await interviewRepository.appendToTranscript(sessionId, {
        role: 'assistant',
        content: acknowledgment,
        timestamp: new Date().toISOString(),
      });

      return {
        imageUrl,
        analysis,
        message: acknowledgment,
      };
    } catch (error: any) {
      console.error(`[InterviewService] Error in uploadAndAnalyzeImage:`, error);
      console.error(`[InterviewService] Error details:`, {
        message: error.message,
        stack: error.stack,
        sessionId,
        filename,
      });
      throw error;
    }
  }

  /**
   * Generate smart conversational response acknowledging what was captured
   * and asking for what's still needed
   */
  private async generateSmartResponse(
    extractedData: Record<string, any>,
    fullQuoteDraft: Record<string, any>,
    nextMissingField: string | null,
    isComplete: boolean
  ): Promise<string> {
    if (!this.model) {
      // Fallback to simple response
      if (isComplete) {
        return "Great! I have all the information I need.";
      }
      return nextMissingField ? QUESTION_CATALOG[nextMissingField].question : "What else can you tell me?";
    }

    // Build extracted fields summary
    const extractedFields = Object.keys(extractedData).map(key => {
      const fieldConfig = QUESTION_CATALOG[key];
      return `- ${key}: ${extractedData[key]} ${fieldConfig ? `(${fieldConfig.category})` : ''}`;
    }).join('\n');

    // Build still missing fields
    const missingFields = FIELD_ORDER.filter(field => {
      if (field === '_collectLineItems') {
        return !(fullQuoteDraft.lineItems && fullQuoteDraft.lineItems.length > 0);
      }
      return !fullQuoteDraft[field];
    });

    const missingFieldsList = missingFields.map(field => {
      const config = QUESTION_CATALOG[field];
      return `- ${field}: ${config?.question || field}`;
    }).join('\n');

    const systemPrompt = `You are a friendly quote collection assistant. Generate a conversational response.

WHAT THE USER JUST PROVIDED:
${extractedFields}

STILL MISSING (${missingFields.length} fields):
${missingFieldsList || 'None - all fields collected!'}

NEXT FIELD TO ASK ABOUT: ${nextMissingField || 'None - complete!'}

YOUR TASK:
1. Acknowledge what they provided (be specific! mention the actual values)
2. ${isComplete ? 'Let them know you have everything!' : `Ask for the NEXT missing field: ${QUESTION_CATALOG[nextMissingField!]?.question || ''}`}

STYLE:
- Warm and conversational (like talking to a friend)
- Specific acknowledgment (mention actual values: "Got it, kitchen remodel at 123 Main St!")
- Natural transition to next question
- 2-3 sentences max

EXAMPLES:

Extracted: {"customerName":"John Smith","customerAddress":"123 Main St"}
Still missing: customerEmail, projectType...
Response: "Perfect! I've got John Smith at 123 Main St. Now, what's John's email address?"

Extracted: {"projectType":"deck","location":"backyard","estimatedBudget":"$15000"}
Still missing: customerName...
Response: "Great! A deck in the backyard for around $15,000 - sounds like a nice project! Let's start with the customer's full name."

Extracted: {"scopeDescription":"Replace all kitchen cabinets"}
Still missing: estimatedBudget...
Response: "Got it - replacing all the kitchen cabinets. What's the estimated total budget for this project?"

Generate your response:`;

    try {
      const response = await this.model.invoke([new SystemMessage(systemPrompt)]);
      let reply = response.content.toString().trim();

      // Remove quotes if LLM wrapped response in quotes
      reply = reply.replace(/^["']|["']$/g, '');

      return reply;
    } catch (error) {
      console.error('[InterviewService] Smart response generation failed:', error);

      // Fallback
      const extractedCount = Object.keys(extractedData).length;
      let fallback = `Thanks! I captured ${extractedCount} piece${extractedCount > 1 ? 's' : ''} of information. `;

      if (isComplete) {
        fallback += "I have everything I need!";
      } else if (nextMissingField) {
        fallback += QUESTION_CATALOG[nextMissingField].question;
      }

      return fallback;
    }
  }

  /**
   * Generate validation feedback when extraction fails
   */
  private async generateValidationFeedback(
    userInput: string,
    fieldName: string,
    fieldConfig: { question: string; category: string; validation?: (value: any) => boolean },
    isVoiceInput: boolean
  ): Promise<string> {
    if (!this.model) {
      return isVoiceInput
        ? "I'm sorry, I didn't quite catch that."
        : "Invalid format.";
    }

    const promptStyle = isVoiceInput
      ? 'conversational and natural, as if speaking to someone'
      : 'extremely brief (5-10 words max), like a text message';

    const systemPrompt = `You are helping someone fill out a quote form. They just gave an answer that doesn't match what you asked for.

FIELD: ${fieldName}
QUESTION ASKED: ${fieldConfig.question}
THEIR ANSWER: "${userInput}"

WHY IT'S WRONG: Analyze why their answer doesn't fit the question. Common issues:
- Answered a different question
- Wrong format (e.g., gave text when you need a date/number)
- Too vague or unclear
- Missing required information
- Invalid data (e.g., impossible date, negative number where positive needed)

TASK: Explain briefly WHY their answer doesn't work. Be ${promptStyle}.

${isVoiceInput ? `
VOICE RESPONSE STYLE:
- Sound natural and friendly
- Use conversational language
- 1-2 sentences max
- Example: "I need the customer's full name, but you gave me a phone number. Can you tell me their name?"
- Example: "Hmm, that doesn't sound like an email address. Could you give me their email?"
` : `
TEXT RESPONSE STYLE:
- Extremely brief (5-10 words)
- Direct and clear
- Example: "Need name, not phone"
- Example: "Invalid email format"
- Example: "Need specific date"
`}

Respond with ONLY the validation message, nothing else.`;

    try {
      const response = await this.model.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(`Field: ${fieldName}\nQuestion: ${fieldConfig.question}\nUser answer: "${userInput}"`),
      ]);

      let feedback = response.content.toString().trim();

      // Remove quotes if present
      feedback = feedback.replace(/^["']|["']$/g, '');

      // Ensure it ends with appropriate punctuation
      if (isVoiceInput && !feedback.match(/[.!?]$/)) {
        feedback += '.';
      }

      return feedback;
    } catch (error) {
      console.error('[InterviewService] Failed to generate validation feedback:', error);

      // Fallback messages
      return isVoiceInput
        ? "I'm sorry, I couldn't understand your answer. Could you try again?"
        : "Invalid format. Please try again.";
    }
  }

  /**
   * Get MIME type from filename
   */
  private getMimeType(filename: string): string {
    const ext = filename.toLowerCase().split('.').pop();
    switch (ext) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      case 'heic':
        return 'image/heic';
      default:
        return 'image/jpeg';
    }
  }
}

export const interviewService = new InterviewService();

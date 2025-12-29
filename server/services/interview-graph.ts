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
  // NEW: Contextual information from images and voice
  imageContext?: Array<{
    caption: string;
    detectedElements: string[];
    extractedInfo?: Record<string, any>;
  }>;
  hasVoiceInput?: boolean;
}

export interface InterviewTurnOutput {
  userIntent: 'ANSWER' | 'MODIFY' | 'ASK' | 'IGNORE';
  extractedData: Record<string, any>;
  nextQuestion: string | null;
  isComplete: boolean;
  reasoning?: string;
  // NEW: Context-aware response that references images/voice
  contextualAcknowledgment?: string;
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

ANSWER: User provides information OR confirms (e.g., "John Smith", "12 feet", "yes", "that is correct", "right")
MODIFY: User changes previous answer (e.g., "Actually make it 15 feet", "Change to Jane")
ASK: User asks a question (e.g., "Do I need a permit?", "How long?")
IGNORE: Irrelevant (e.g., "hello", "thanks")

IMPORTANT: "yes", "correct", "that's right", "exactly" = ANSWER (confirmation)

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

        // For ASK intent, generate a helpful response
        if (intent === 'ASK') {
          // Check if this is a meta-question about the interview
          const isMetaQuestion = /what.*(do you|information|data|still|need|left|missing|remaining|else|more)|how (much|many).*(left|more|remaining)|what'?s (left|missing|next|remaining)|can you (repeat|say that again|tell me again)|what (did you|was that)|repeat (that|the question)/i.test(userInput);

          // Also check for repeat/clarification requests
          const isRepeatRequest = /can you (repeat|say that again|tell me again)|what (did you|was that)|repeat (that|the question)|say that again|come again/i.test(userInput);

          if (isRepeatRequest) {
            // User wants to hear the last question again
            const lastAIMessage = state.messages.slice().reverse().find((m: any) => m._getType() === 'ai');

            if (lastAIMessage) {
              const previousQuestion = lastAIMessage.content.toString();
              const repeatResponse = `Sure! ${previousQuestion}`;

              return { messages: [
                new SystemMessage('EXTRACTED:{}'),
                new SystemMessage(`METARESPONSE:${repeatResponse}`)
              ]};
            }
          }

          if (isMetaQuestion) {
            // Generate a helpful meta-response
            const imageContextMessage = state.messages.find((m: any) =>
              m._getType() === 'system' && m.content.startsWith('IMAGECONTEXT:')
            );
            const missingFieldsMessage = state.messages.find((m: any) =>
              m._getType() === 'system' && m.content.startsWith('MISSINGFIELDS:')
            );

            const imageContext = imageContextMessage
              ? JSON.parse(imageContextMessage.content.toString().replace('IMAGECONTEXT:', ''))
              : [];
            const missingFields = missingFieldsMessage
              ? JSON.parse(missingFieldsMessage.content.toString().replace('MISSINGFIELDS:', ''))
              : [];

            const metaPrompt = `The user asked about the interview progress: "${userInput}"

CURRENTLY MISSING FIELDS:
${missingFields.join(', ') || 'Nothing - almost done!'}

CURRENT CONTEXT:
${JSON.stringify(currentDraft, null, 2)}

Generate a brief, friendly response (2-3 sentences) that:
1. Answers their question about what's still needed
2. Lists the missing information in a conversational way
3. Ends by asking for the NEXT piece of information

Examples:

User: "What information do you still need?"
Missing: customerEmail, estimatedBudget
Response: "I still need your email address and the estimated budget for this project. Let me start with the email - what's your email address?"

User: "What else do you need?"
Missing: estimatedStartDate, estimatedCompletionDate
Response: "Just a couple more things! I need the estimated start date and completion date for the project. When do you think you'll be able to start work?"

User: "How much more?"
Missing: downPaymentPercentage, validUntil
Response: "We're almost done! I just need to know the down payment percentage and how long this quote should be valid. What percentage would you like for the down payment?"

Generate your response (plain text, no JSON):`;

            try {
              const response = await this.model!.invoke([new SystemMessage(metaPrompt)]);
              const metaResponse = response.content.toString().trim();

              // Store the meta-response so interview.service can use it
              return { messages: [
                new SystemMessage('EXTRACTED:{}'),
                new SystemMessage(`METARESPONSE:${metaResponse}`)
              ]};
            } catch (error) {
              console.error('[InterviewGraph] Meta-response generation error:', error);
              return { messages: [new SystemMessage('EXTRACTED:{}')]};
            }
          }

          // Regular question, no data extraction
          return { messages: [new SystemMessage('EXTRACTED:{}')]};
        }

        // For IGNORE intent, skip extraction
        if (intent === 'IGNORE') {
          return { messages: [new SystemMessage('EXTRACTED:{}') ]};
        }

        // NEW: Check if this is a confirmation (yes/correct/that's right, etc.)
        const isConfirmation = /^(yes|yeah|yep|yup|correct|right|that'?s?\s*(correct|right|is\s*correct)|exactly|affirmative|sure|absolutely|indeed)$/i.test(userInput.trim());

        if (isConfirmation && intent === 'ANSWER') {
          // User is confirming - extract info from the previous AI question
          const lastAIMessage = state.messages.slice().reverse().find((m: any) => m._getType() === 'ai');

          if (lastAIMessage) {
            const aiQuestion = lastAIMessage.content.toString();

            // Use LLM to extract what the AI stated in its question
            const confirmationPrompt = `The AI asked a confirmation question and the user confirmed it.

AI QUESTION: "${aiQuestion}"
USER RESPONSE: "${userInput}"

The user confirmed what the AI stated. Extract the CONFIRMED information from the AI's question.

Examples:

AI: "I can see from your photo that you're building a 12x16 deck. Is that correct?"
User: "yes"
Extract: {"projectType":"deck construction","scopeDescription":"12x16 deck"}

AI: "So this is an exterior deck project and an interior kitchen renovation, is that right?"
User: "that is correct"
Extract: {"projectType":"exterior deck and interior kitchen renovation","location":"exterior (deck), interior (kitchen)"}

AI: "The customer is John Smith at 123 Main St, correct?"
User: "correct"
Extract: {"customerName":"John Smith","customerAddress":"123 Main St"}

Now extract from the AI's question what the user just confirmed.
Return ONLY valid JSON (NO explanations, NO markdown):`;

            try {
              const response = await this.model!.invoke([new SystemMessage(confirmationPrompt)]);
              let jsonText = response.content.toString().replace(/```json|```/g, '').trim();

              if (!jsonText.startsWith('{')) {
                jsonText = '{}';
              }

              const extracted = JSON.parse(jsonText);
              console.log('[InterviewGraph] Extracted from confirmation:', extracted);

              return {
                messages: [new SystemMessage(`EXTRACTED:${JSON.stringify(extracted)}`)],
              };
            } catch (error) {
              console.error('[InterviewGraph] Confirmation extraction error:', error);
              return { messages: [new SystemMessage('EXTRACTED:{}')]};
            }
          }
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
          // Normal extraction prompt - extract ALL fields mentioned
          const currentFieldHint = currentField
            ? `We just asked about: ${currentField}. But extract EVERYTHING they mention, not just that field!`
            : 'Extract all mentioned fields.';

          systemPrompt = `Extract ALL quote information from the user's message.

LATEST USER MESSAGE: "${userInput}"

${currentFieldHint}

CRITICAL RULES:
1. Extract EVERYTHING mentioned, even if we didn't ask for it
2. Extract ONLY from the message above (NOT from conversation history)
3. Be flexible - people don't always answer in order
4. Multiple pieces of info? Extract them ALL!

Extraction examples (BE FLEXIBLE with project types!):

Input: "Jane Smith" (when asked for name)
Output: {"customerName":"Jane Smith"}

Input: "The customer is John Smith, project is at 123 Main St, doing a kitchen remodel"
Output: {"customerName":"John Smith","customerAddress":"123 Main St","projectType":"kitchen remodel"}

Input: "This project is a deck buildout" (normalize variations!)
Output: {"projectType":"deck construction"}

Input: "deck in the backyard" (extract everything!)
Output: {"projectType":"deck construction","location":"backyard"}

Input: "jane@email.com and phone is 555-1234"
Output: {"customerEmail":"jane@email.com","customerPhone":"555-1234"}

Input: "This is for a deck in the backyard, budget around $15000"
Output: {"projectType":"deck construction","location":"backyard","estimatedBudget":"$15000"}

Input: "Kitchen renovation, replacing cabinets and countertops, about $25k"
Output: {"projectType":"kitchen remodel","scopeDescription":"replacing cabinets and countertops","estimatedBudget":"$25k"}

Input: "Bathroom redo, new tile and fixtures"
Output: {"projectType":"bathroom renovation","scopeDescription":"new tile and fixtures"}

NORMALIZE PROJECT TYPES:
- "deck", "deck buildout", "deck project" → "deck construction"
- "kitchen", "kitchen remodel", "kitchen renovation", "kitchen upgrade" → "kitchen remodel"
- "bathroom", "bathroom redo", "bathroom renovation" → "bathroom renovation"
- Be smart about variations!

Available fields: customerName, customerEmail, customerPhone, customerAddress, projectType, location, scopeDescription, estimatedBudget, downPaymentPercentage, estimatedStartDate, estimatedCompletionDate, validUntil

${currentField ? `NOTE: We asked about ${currentField}, but extract EVERYTHING they mentioned!` : ''}

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

      // Context Analyzer: Build comprehensive context from all sources
      .addNode('contextAnalyzer', async (state) => {
        // Extract all context
        const contextMessage = state.messages.find((m: any) =>
          m._getType() === 'system' && m.content.startsWith('CONTEXT:')
        );
        const imageContextMessage = state.messages.find((m: any) =>
          m._getType() === 'system' && m.content.startsWith('IMAGECONTEXT:')
        );
        const missingFieldsMessage = state.messages.find((m: any) =>
          m._getType() === 'system' && m.content.startsWith('MISSINGFIELDS:')
        );

        const currentDraft = contextMessage
          ? JSON.parse(contextMessage.content.toString().replace('CONTEXT:', ''))
          : {};
        const imageContext = imageContextMessage
          ? JSON.parse(imageContextMessage.content.toString().replace('IMAGECONTEXT:', ''))
          : [];
        const missingFields = missingFieldsMessage
          ? JSON.parse(missingFieldsMessage.content.toString().replace('MISSINGFIELDS:', ''))
          : [];

        // Build context summary for question generation
        const contextSummary = {
          hasImages: imageContext.length > 0,
          imageInsights: imageContext.map((img: any) => img.caption || '').join('; '),
          extractedFromImages: imageContext.flatMap((img: any) => Object.keys(img.extractedInfo || {})),
          currentlyKnown: Object.keys(currentDraft).filter(k => currentDraft[k] && currentDraft[k] !== ''),
          stillMissing: missingFields,
        };

        return {
          messages: [new SystemMessage(`CONTEXTSUMMARY:${JSON.stringify(contextSummary)}`)],
        };
      })

      // Generator: Create context-aware natural next question
      .addNode('generator', async (state) => {
        // Get context summary
        const contextSummaryMessage = state.messages.find((m: any) =>
          m._getType() === 'system' && m.content.startsWith('CONTEXTSUMMARY:')
        );
        const extractedMessage = state.messages.find((m: any) =>
          m._getType() === 'system' && m.content.startsWith('EXTRACTED:')
        );
        const missingFieldsMessage = state.messages.find((m: any) =>
          m._getType() === 'system' && m.content.startsWith('MISSINGFIELDS:')
        );

        if (!contextSummaryMessage || !missingFieldsMessage) {
          return { messages: [] };
        }

        const contextSummary = JSON.parse(contextSummaryMessage.content.toString().replace('CONTEXTSUMMARY:', ''));
        const extractedData = extractedMessage
          ? JSON.parse(extractedMessage.content.toString().replace('EXTRACTED:', ''))
          : {};
        const missingFields = JSON.parse(missingFieldsMessage.content.toString().replace('MISSINGFIELDS:', ''));

        // If no missing fields, we're done
        if (missingFields.length === 0) {
          return {
            messages: [new SystemMessage('NEXTQUESTION:null')],
          };
        }

        // Generate context-aware question
        const systemPrompt = `You are a conversational AI assistant collecting information for a construction quote. Generate the NEXT natural question.

CONTEXT SUMMARY:
- Has uploaded images: ${contextSummary.hasImages}
${contextSummary.hasImages ? `- Image insights: ${contextSummary.imageInsights}` : ''}
- Already know: ${contextSummary.currentlyKnown.join(', ') || 'Nothing yet'}
- Just extracted: ${Object.keys(extractedData).join(', ') || 'Nothing'}
- Still need: ${missingFields.join(', ')}

YOUR TASK:
1. Pick the MOST LOGICAL next field to ask about from "Still need" list
2. Generate a natural, conversational question that:
   - References visual context if images were shared (e.g., "I see from your photo that...")
   - Builds on what's already known
   - Feels like a natural conversation, not a form
   - Is specific and clear

PRIORITIZE:
- If images show project details, ask about related fields first
- If basic info (name, email) is missing, ask for that first
- If scope is clear but details are missing, ask for those

FIELD DESCRIPTIONS:
- customerName: Customer's full name
- customerEmail: Email address
- customerPhone: Phone number
- customerAddress: Project address
- projectType: Type of project (deck, kitchen, bathroom, etc.)
- location: Specific location on property
- scopeDescription: Detailed scope of work
- estimatedBudget: Total estimated budget
- downPaymentPercentage: Down payment %
- estimatedStartDate: Start date
- estimatedCompletionDate: Completion date
- validUntil: Quote validity period

EXAMPLES:

Context: Images show deck, have customerName, need dimensions/materials
Question: "Thanks, John! I can see from your photo that you're building a deck. What are the approximate dimensions - length and width?"

Context: No images, have projectType="kitchen remodel", need scopeDescription
Question: "Great, a kitchen remodel! Can you describe what specific work you'd like done? For example, new cabinets, countertops, appliances, flooring?"

Context: Images show "12x16 deck with composite decking", need estimatedBudget
Question: "Perfect! I see it's a 12x16 deck with composite decking. What's your estimated budget for this project?"

NOW: Generate the next question for the current context. Return ONLY the question text, nothing else.`;

        try {
          const response = await this.model!.invoke([new SystemMessage(systemPrompt)]);
          const question = response.content.toString().trim();

          return {
            messages: [new SystemMessage(`NEXTQUESTION:${question}`)],
          };
        } catch (error) {
          console.error('[InterviewGraph] Question generation error:', error);
          return { messages: [new SystemMessage('NEXTQUESTION:null')] };
        }
      })

      // Define flow
      .addEdge('__start__', 'router')
      .addEdge('router', 'processor')
      .addEdge('processor', 'contextAnalyzer')
      .addEdge('contextAnalyzer', 'generator')
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

      // NEW: Add image context
      if (input.imageContext && input.imageContext.length > 0) {
        messages.push(new SystemMessage(`IMAGECONTEXT:${JSON.stringify(input.imageContext)}`));
      }

      // NEW: Add missing fields for context-aware question generation
      const updatedDraft = { ...input.currentDraft };
      const missingFields = input.requiredFields.filter(field => !updatedDraft[field]);
      messages.push(new SystemMessage(`MISSINGFIELDS:${JSON.stringify(missingFields)}`));

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
      const nextQuestionMsg = result.messages.find((m: any) =>
        m._getType() === 'system' && m.content.startsWith('NEXTQUESTION:')
      );
      const metaResponseMsg = result.messages.find((m: any) =>
        m._getType() === 'system' && m.content.startsWith('METARESPONSE:')
      );

      const intent = intentMsg?.content.replace('INTENT:', '') || 'ANSWER';
      const extractedDataStr = extractedMsg?.content.replace('EXTRACTED:', '') || '{}';
      const extractedData = JSON.parse(extractedDataStr);
      const nextQuestion = nextQuestionMsg?.content.replace('NEXTQUESTION:', '') || null;
      const metaResponse = metaResponseMsg?.content.replace('METARESPONSE:', '') || null;

      // Map intent to simplified format
      let userIntent: 'ANSWER' | 'MODIFY' | 'ASK' | 'IGNORE' = 'ANSWER';
      if (intent === 'MODIFY') userIntent = 'MODIFY';
      else if (intent === 'ASK') userIntent = 'ASK';
      else if (intent === 'IGNORE') userIntent = 'IGNORE';

      // Check if complete
      const updatedDraftWithExtracted = { ...updatedDraft, ...extractedData };
      const remainingMissing = input.requiredFields.filter(field => !updatedDraftWithExtracted[field]);
      const isComplete = remainingMissing.length === 0 && !input.collectingLineItems;

      return {
        userIntent,
        extractedData,
        nextQuestion: metaResponse || (nextQuestion === 'null' ? null : nextQuestion), // Prioritize meta-response, then graph-generated question
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

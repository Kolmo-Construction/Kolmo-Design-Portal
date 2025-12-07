import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import { db } from "../db";
import { sql as drizzleSql } from "drizzle-orm";

export interface AgentAction {
  type: 'SUGGEST_ACTION' | 'RESPONSE';
  action?: 'CREATE_TASK' | 'UPDATE_TASK' | 'CREATE_MILESTONE' | 'SEND_INVOICE' | 'UPDATE_PROJECT_STATUS';
  payload?: Record<string, any>;
  message?: string;
}

export interface AgentConsultRequest {
  userPrompt: string;
  projectId?: number;
  context?: Record<string, any>;
}

export interface AgentConsultResponse {
  answer: string;
  actions?: AgentAction[];
  rawOutput?: string;
}

class AgentService {
  private llm: ChatOpenAI | null = null;
  private chain: any = null;
  private initialized: boolean = false;
  private initError: string | null = null;

  constructor() {
    try {
      // Check for API keys
      const deepseekKey = process.env.DEEPSEEK_API_KEY;
      const openaiKey = process.env.OPENAI_API_KEY;

      if (!deepseekKey && !openaiKey) {
        this.initError = 'AI service not configured - missing API key (set DEEPSEEK_API_KEY or OPENAI_API_KEY)';
        console.warn('[AgentService] WARNING:', this.initError);
        return;
      }

      // Initialize LLM - prefer DeepSeek if available
      if (deepseekKey) {
        this.llm = new ChatOpenAI({
          modelName: "deepseek-chat",
          temperature: 0,
          apiKey: deepseekKey,
          configuration: {
            baseURL: "https://api.deepseek.com",
          },
        });
        console.log('[AgentService] Initialized with DeepSeek');
      } else {
        this.llm = new ChatOpenAI({
          modelName: "gpt-4-turbo-preview",
          temperature: 0,
          apiKey: openaiKey,
        });
        console.log('[AgentService] Initialized with OpenAI');
      }

      this.createChain();
      this.initialized = true;
    } catch (error) {
      this.initError = error instanceof Error ? error.message : 'Unknown initialization error';
      console.error('[AgentService] Initialization failed:', error);
      // Set initialized to false to prevent usage
      this.initialized = false;
    }
  }

  /**
   * Check if the service is properly initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get initialization error if any
   */
  getInitError(): string | null {
    return this.initError;
  }

  /**
   * Get database schema information
   */
  private async getSchemaInfo(): Promise<string> {
    const schemaQuery = `
      SELECT
        table_name,
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN (
          'projects', 'tasks', 'milestones', 'invoices',
          'daily_logs', 'punch_list_items', 'progress_updates',
          'users', 'clients', 'payments'
        )
      ORDER BY table_name, ordinal_position;
    `;

    const result = await db.execute(drizzleSql.raw(schemaQuery));

    // Format schema info
    const tables: Record<string, any[]> = {};
    for (const row of result.rows as any[]) {
      if (!tables[row.table_name]) {
        tables[row.table_name] = [];
      }
      tables[row.table_name].push({
        column: row.column_name,
        type: row.data_type,
        nullable: row.is_nullable === 'YES'
      });
    }

    return Object.entries(tables)
      .map(([table, columns]) => {
        const columnInfo = columns
          .map(c => `  - ${c.column} (${c.type}${c.nullable ? ', nullable' : ''})`)
          .join('\n');
        return `Table: ${table}\n${columnInfo}`;
      })
      .join('\n\n');
  }

  /**
   * Execute a SQL query safely (SELECT only)
   */
  private async executeSafeQuery(query: string): Promise<any> {
    // Validate that it's a SELECT query
    const trimmedQuery = query.trim().toLowerCase();
    if (!trimmedQuery.startsWith('select')) {
      throw new Error('Only SELECT queries are allowed');
    }

    try {
      const result = await db.execute(drizzleSql.raw(query));
      return result.rows;
    } catch (error) {
      console.error('[AgentService] Query execution error:', error);
      throw new Error(`Query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get the system prompt for the agent
   */
  private getSystemPrompt(): string {
    return `You are Kolmo AI, an intelligent assistant for Kolmo Construction project management.

You have READ-ONLY access to the following database tables:
- projects: Construction projects with status, budget, timeline
- tasks: Project tasks with dependencies, assignments, and deadlines
- milestones: Project milestones with billing information
- invoices: Payment invoices and their status
- daily_logs: Daily construction logs and updates
- punch_list_items: Items that need attention or fixing
- progress_updates: Regular progress reports
- users: System users (admins, project managers, clients)
- clients: Client information
- payments: Payment records

CRITICAL RULES:
1. You CANNOT modify the database directly
2. When the user wants to perform an action (create, update, delete), you must suggest it in JSON format
3. Always provide helpful context and reasoning with your suggestions
4. Generate SQL queries to answer questions, but ONLY SELECT queries
5. Be concise and professional in your responses

When you need to query data, output a SQL query in this format:
SQL_QUERY: <your SELECT query here>

When suggesting actions, output JSON in this format at the end of your response:
\`\`\`json
{{
  "type": "SUGGEST_ACTION",
  "action": "CREATE_TASK" | "UPDATE_TASK" | "CREATE_MILESTONE" | "SEND_INVOICE" | "UPDATE_PROJECT_STATUS",
  "payload": {{ relevant data }},
  "reasoning": "Why this action makes sense"
}}
\`\`\`

Available actions:
- CREATE_TASK: Create a new task (requires: title, description, projectId, optional: priority, dueDate, assigneeId)
- UPDATE_TASK: Update an existing task (requires: taskId, fields to update)
- CREATE_MILESTONE: Create a project milestone (requires: title, description, projectId, optional: dueDate, amount)
- SEND_INVOICE: Trigger invoice generation (requires: projectId, amount, description)
- UPDATE_PROJECT_STATUS: Change project status (requires: projectId, status: 'planning' | 'in_progress' | 'completed' | 'on_hold')

Your responses should be:
- Professional and construction-industry appropriate
- Data-driven based on database queries
- Proactive in suggesting next steps
- Clear about dependencies and blockers`;
  }

  /**
   * Create the LangChain chain for agent consultation
   */
  private createChain() {
    const systemPrompt = this.getSystemPrompt();

    // For now, create a simple prompt-based chain
    // We'll handle SQL execution separately
    const answerPrompt = PromptTemplate.fromTemplate(
      `${systemPrompt}

Database Schema:
{schema}

User Question: {question}

Context: {context}

Please provide a helpful response. If you need to query the database, output "SQL_QUERY: <query>".
If you want to suggest an action, include it as JSON at the end.

Response:`
    );

    this.chain = RunnableSequence.from([
      answerPrompt,
      this.llm,
      new StringOutputParser(),
    ]);

    console.log('[AgentService] Chain created successfully');
  }

  /**
   * Consult the agent with a user prompt
   */
  async consult(request: AgentConsultRequest): Promise<AgentConsultResponse> {
    console.log('[AgentService] Processing consultation:', request.userPrompt);

    if (!this.initialized || !this.llm || !this.chain) {
      throw new Error(this.initError || 'Agent service not initialized');
    }

    try {
      // Get schema info
      const schema = await this.getSchemaInfo();

      // Add context to the prompt if provided
      let contextStr = '';
      if (request.projectId) {
        contextStr = `User is viewing Project ID ${request.projectId}`;
      }
      if (request.context) {
        contextStr += `\nAdditional context: ${JSON.stringify(request.context)}`;
      }

      // First pass: Get initial response
      let result = await this.chain.invoke({
        schema,
        question: request.userPrompt,
        context: contextStr || 'No specific context',
      });

      console.log('[AgentService] Initial result:', result);

      // Check if the agent requested a SQL query
      if (result.includes('SQL_QUERY:')) {
        const sqlMatch = result.match(/SQL_QUERY:\s*(.+?)(?:\n|$)/s);
        if (sqlMatch) {
          const sqlQuery = sqlMatch[1].trim();
          console.log('[AgentService] Executing SQL query:', sqlQuery);

          try {
            const queryResult = await this.executeSafeQuery(sqlQuery);
            console.log('[AgentService] Query result:', queryResult);

            // Second pass: Give the agent the query results
            const followUpPrompt = PromptTemplate.fromTemplate(
              `${this.getSystemPrompt()}

Original Question: {question}
SQL Query: {query}
Query Result: {queryResult}

Based on the query results, provide a comprehensive answer to the user's question.
If appropriate, suggest actions as JSON.

Response:`
            );

            const followUpChain = RunnableSequence.from([
              followUpPrompt,
              this.llm,
              new StringOutputParser(),
            ]);

            result = await followUpChain.invoke({
              question: request.userPrompt,
              query: sqlQuery,
              queryResult: JSON.stringify(queryResult, null, 2),
            });

            console.log('[AgentService] Follow-up result:', result);
          } catch (error) {
            console.error('[AgentService] SQL execution error:', error);
            result = result.replace(
              /SQL_QUERY:.+/s,
              `[Query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}]\n\n` +
              'I encountered an error querying the database. Please try rephrasing your question.'
            );
          }
        }
      }

      // Parse the result to extract actions
      const actions = this.parseActions(result);

      return {
        answer: result,
        actions,
        rawOutput: result,
      };
    } catch (error) {
      console.error('[AgentService] Consultation error:', error);
      throw error;
    }
  }

  /**
   * Parse actions from the agent's response
   */
  private parseActions(output: string): AgentAction[] {
    const actions: AgentAction[] = [];

    // Look for JSON blocks in the output
    const jsonRegex = /```json\n([\s\S]*?)\n```/g;
    const inlineJsonRegex = /\{[\s\S]*?"type":\s*"SUGGEST_ACTION"[\s\S]*?\}/g;

    let match;

    // Try to find JSON in code blocks
    while ((match = jsonRegex.exec(output)) !== null) {
      try {
        const jsonStr = match[1];
        const parsed = JSON.parse(jsonStr);
        if (parsed.type === 'SUGGEST_ACTION') {
          actions.push(parsed);
        }
      } catch (e) {
        console.warn('[AgentService] Failed to parse JSON block:', e);
      }
    }

    // Try to find inline JSON
    if (actions.length === 0) {
      while ((match = inlineJsonRegex.exec(output)) !== null) {
        try {
          const parsed = JSON.parse(match[0]);
          if (parsed.type === 'SUGGEST_ACTION') {
            actions.push(parsed);
          }
        } catch (e) {
          console.warn('[AgentService] Failed to parse inline JSON:', e);
        }
      }
    }

    return actions;
  }

  /**
   * Get database schema information for debugging
   */
  async getSchema(): Promise<string> {
    return await this.getSchemaInfo();
  }
}

// Export singleton instance
export const agentService = new AgentService();

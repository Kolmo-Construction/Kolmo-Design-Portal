import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { StateGraph, MessagesAnnotation } from "@langchain/langgraph";
import { db } from "../db";
import { sql as drizzleSql, eq } from "drizzle-orm";
import { chatAttachments } from "@shared/schema";
import { storage } from "../storage";
import type { InsertTask, InsertInvoice, InsertMilestone } from "@shared/schema";
import { semanticSearchService } from "./semantic-search.service";
import { factExtractionService } from "./fact-extraction.service";

// --- Types (Frontend compatibility) ---
export interface AgentAction {
  type: 'SUGGEST_ACTION';
  action: 'CREATE_TASK' | 'UPDATE_TASK' | 'CREATE_MILESTONE' | 'SEND_INVOICE' | 'UPDATE_PROJECT_STATUS' | 'CREATE_INVOICE' | 'RECORD_PAYMENT';
  payload: Record<string, any>;
  reasoning?: string;
}

export interface AgentConsultRequest {
  userPrompt: string;
  projectId?: number;
  context?: Record<string, any>;
  messageId?: string;
  userId?: number; // For audit trail
  sessionId?: string; // For conversation continuity and fact tracking
}

export interface AgentConsultResponse {
  answer: string;
  actions?: AgentAction[];
  rawOutput?: string;
}

// --- The Service ---
class AgentService {
  private app: any = null;
  private model: ChatOpenAI | null = null;
  private tools: any[] = [];
  private initialized: boolean = false;
  private initError: string | null = null;

  // Optimization: Cache schema to prevent slamming DB on every request
  private schemaCache: string | null = null;

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

      // 1. Initialize Model - prefer DeepSeek if available
      if (deepseekKey) {
        this.model = new ChatOpenAI({
          modelName: "deepseek-chat",
          temperature: 0,
          apiKey: deepseekKey,
          configuration: {
            baseURL: "https://api.deepseek.com",
          },
        });
        console.log('[AgentService] Initialized with DeepSeek');
      } else {
        this.model = new ChatOpenAI({
          modelName: "gpt-4-turbo-preview",
          temperature: 0,
          apiKey: openaiKey,
        });
        console.log('[AgentService] Initialized with OpenAI');
      }

      // 2. Define Tools
      this.tools = this.createTools();

      // 3. Build LangGraph Workflow
      this.app = this.buildWorkflow();

      this.initialized = true;
      console.log('[AgentService] Successfully initialized with LangGraph');
    } catch (error) {
      this.initError = error instanceof Error ? error.message : 'Unknown initialization error';
      console.error('[AgentService] Initialization failed:', error);
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
   * Helper to ensure date is in ISO format
   */
  private ensureISODate(dateInput: string | undefined | null): string | null {
    if (!dateInput) return null;
    try {
      const date = new Date(dateInput);
      if (isNaN(date.getTime())) return null;
      return date.toISOString();
    } catch {
      return null;
    }
  }

  /**
   * Create all tools for the agent
   */
  private createTools() {
    // TOOL A: Read Database
    const readDatabaseTool = tool(
      async ({ query }) => {
        try {
          const trimmedQuery = query.trim().toLowerCase();
          if (!trimmedQuery.startsWith("select")) {
            return "Error: Only SELECT queries are allowed for safety.";
          }

          const result = await db.execute(drizzleSql.raw(query));
          console.log('[AgentService] Query executed:', query);

          return JSON.stringify(result.rows, null, 2);
        } catch (e: any) {
          console.error('[AgentService] Database query error:', e);
          return `Database Error: ${e.message}`;
        }
      },
      {
        name: "read_database",
        description: `Execute a SQL SELECT query to retrieve information from the construction project database.
Use this to find projects, tasks, invoices, milestones, daily logs, punch list items, users, clients, and payments.
Always use proper SQL syntax with table and column names from the schema provided.`,
        schema: z.object({
          query: z.string().describe("The SQL SELECT query to execute. Must be a valid SELECT statement."),
        }),
      }
    );

    // TOOL B: Propose Action (for confirmation workflow)
    const proposeActionTool = tool(
      async ({ action, payload, reasoning }) => {
        console.log('[AgentService] Action proposed:', action);
        // This tool structures the intent - actual execution happens after confirmation
        return `Action ${action} proposed successfully with reasoning: ${reasoning}. Waiting for user confirmation to proceed.`;
      },
      {
        name: "propose_action",
        description: `Suggest a modification to the project management system.
Use this FIRST to propose an action and explain it to the user.
The user will confirm before execution.`,
        schema: z.object({
          action: z.enum(['CREATE_TASK', 'UPDATE_TASK', 'CREATE_MILESTONE', 'SEND_INVOICE', 'UPDATE_PROJECT_STATUS', 'CREATE_INVOICE', 'RECORD_PAYMENT'])
            .describe("The type of action to perform"),
          payload: z.record(z.any()).describe("The data required for the action (e.g., task details, project ID, status)"),
          reasoning: z.string().describe("Clear explanation of why this action is being suggested"),
        }),
      }
    );

    // TOOL C: Execute Create Task
    const executeCreateTaskTool = tool(
      async ({ projectId, title, description, status, priority, assigneeId, dueDate, startDate, isBillable, billingType, billingPercentage, billableAmount }) => {
        try {
          // Normalize dates to ensure proper format, then convert to Date objects
          const parsedDueDate = dueDate ? new Date(dueDate) : null;
          const parsedStartDate = startDate ? new Date(startDate) : null;

          // Validate dates
          if (dueDate && (!parsedDueDate || isNaN(parsedDueDate.getTime()))) {
            return JSON.stringify({
              success: false,
              error: `Invalid due date format: ${dueDate}. Please use ISO format (e.g., 2025-12-18T00:00:00Z)`
            });
          }
          if (startDate && (!parsedStartDate || isNaN(parsedStartDate.getTime()))) {
            return JSON.stringify({
              success: false,
              error: `Invalid start date format: ${startDate}. Please use ISO format (e.g., 2025-12-18T00:00:00Z)`
            });
          }

          const taskData: any = {
            projectId,
            title,
            description: description || null,
            status: status || 'todo',
            priority: priority || 'medium',
            assigneeId: assigneeId || null,
            dueDate: parsedDueDate,
            startDate: parsedStartDate,
            isBillable: isBillable || false,
            billingType: billingType || 'fixed',
            billingPercentage: billingPercentage || "0",
            billableAmount: billableAmount || "0",
          };

          const createdTask = await storage.tasks.createTask(taskData);

          console.log('[AgentService] Task created:', createdTask?.id);

          return JSON.stringify({
            success: true,
            message: `Successfully created task "${title}"`,
            taskId: createdTask?.id,
            task: createdTask
          }, null, 2);
        } catch (error: any) {
          console.error('[AgentService] Error creating task:', error);
          return JSON.stringify({
            success: false,
            error: error.message
          });
        }
      },
      {
        name: "execute_create_task",
        description: `Execute the creation of a new task. Only use this AFTER the user has confirmed the proposed action.`,
        schema: z.object({
          projectId: z.number().describe("Project ID"),
          title: z.string().describe("Task title"),
          description: z.string().optional().describe("Task description"),
          status: z.enum(['todo', 'in_progress', 'blocked', 'done', 'cancelled']).optional(),
          priority: z.enum(['low', 'medium', 'high']).optional(),
          assigneeId: z.number().optional().describe("User ID to assign the task to"),
          dueDate: z.string().optional().describe("Due date in ISO format"),
          startDate: z.string().optional().describe("Start date in ISO format"),
          isBillable: z.boolean().optional().describe("Whether the task is billable"),
          billingType: z.enum(['fixed', 'hourly', 'percentage']).optional(),
          billingPercentage: z.string().optional().describe("Billing percentage (0-100)"),
          billableAmount: z.string().optional().describe("Fixed billable amount"),
        }),
      }
    );

    // TOOL D: Execute Update Task
    const executeUpdateTaskTool = tool(
      async ({ taskId, title, description, status, priority, assigneeId, dueDate, startDate, isBillable, billingType, billingPercentage, billableAmount }) => {
        try {
          const updateData: any = {};

          if (title !== undefined) updateData.title = title;
          if (description !== undefined) updateData.description = description;
          if (status !== undefined) updateData.status = status;
          if (priority !== undefined) updateData.priority = priority;
          if (assigneeId !== undefined) updateData.assigneeId = assigneeId;
          if (dueDate !== undefined) updateData.dueDate = dueDate; // Keep as ISO string
          if (startDate !== undefined) updateData.startDate = startDate; // Keep as ISO string
          if (isBillable !== undefined) updateData.isBillable = isBillable;
          if (billingType !== undefined) updateData.billingType = billingType;
          if (billingPercentage !== undefined) updateData.billingPercentage = billingPercentage;
          if (billableAmount !== undefined) updateData.billableAmount = billableAmount;

          const updatedTask = await storage.tasks.updateTask(taskId, updateData);

          console.log('[AgentService] Task updated:', taskId);

          return JSON.stringify({
            success: true,
            message: `Successfully updated task ${taskId}`,
            task: updatedTask
          }, null, 2);
        } catch (error: any) {
          console.error('[AgentService] Error updating task:', error);
          return JSON.stringify({
            success: false,
            error: error.message
          });
        }
      },
      {
        name: "execute_update_task",
        description: `Execute an update to an existing task. Only use this AFTER the user has confirmed the proposed action.`,
        schema: z.object({
          taskId: z.number().describe("Task ID to update"),
          title: z.string().optional(),
          description: z.string().optional(),
          status: z.enum(['todo', 'in_progress', 'blocked', 'done', 'cancelled']).optional(),
          priority: z.enum(['low', 'medium', 'high']).optional(),
          assigneeId: z.number().optional(),
          dueDate: z.string().optional(),
          startDate: z.string().optional(),
          isBillable: z.boolean().optional(),
          billingType: z.enum(['fixed', 'hourly', 'percentage']).optional(),
          billingPercentage: z.string().optional(),
          billableAmount: z.string().optional(),
        }),
      }
    );

    // TOOL E: Execute Create Invoice
    const executeCreateInvoiceTool = tool(
      async ({ projectId, amount, description, dueDate, invoiceType, customerName, customerEmail }) => {
        try {
          // Generate invoice number
          const invoiceNumber = `INV-${Date.now()}`;

          const invoiceData: any = {
            projectId,
            invoiceNumber,
            amount: amount.toString(),
            description: description || null,
            issueDate: new Date().toISOString(), // Keep as ISO string
            dueDate: dueDate, // Keep as ISO string
            status: 'draft',
            invoiceType: invoiceType || 'regular',
            customerName: customerName || null,
            customerEmail: customerEmail || null,
          };

          const invoice = await storage.invoices.createInvoice(invoiceData);

          console.log('[AgentService] Invoice created:', invoice?.id);

          return JSON.stringify({
            success: true,
            message: `Successfully created invoice ${invoiceNumber} for $${amount}`,
            invoiceId: invoice?.id,
            invoiceNumber: invoice?.invoiceNumber,
            invoice
          }, null, 2);
        } catch (error: any) {
          console.error('[AgentService] Error creating invoice:', error);
          return JSON.stringify({
            success: false,
            error: error.message
          });
        }
      },
      {
        name: "execute_create_invoice",
        description: `Execute the creation of a new invoice. Only use this AFTER the user has confirmed the proposed action.`,
        schema: z.object({
          projectId: z.number().describe("Project ID"),
          amount: z.number().positive().describe("Invoice amount"),
          description: z.string().optional().describe("Invoice description"),
          dueDate: z.string().describe("Due date in ISO format"),
          invoiceType: z.enum(['down_payment', 'milestone', 'final', 'change_order', 'regular']).optional(),
          customerName: z.string().optional().describe("Customer name"),
          customerEmail: z.string().optional().describe("Customer email"),
        }),
      }
    );

    // TOOL F: Execute Send Invoice
    const executeSendInvoiceTool = tool(
      async ({ invoiceId }) => {
        try {
          // Update invoice status to pending (sending)
          await storage.invoices.updateInvoice(invoiceId, { status: 'pending' });

          console.log('[AgentService] Invoice sent:', invoiceId);

          return JSON.stringify({
            success: true,
            message: `Successfully sent invoice ${invoiceId} to customer. Status updated to pending.`,
            invoiceId
          }, null, 2);
        } catch (error: any) {
          console.error('[AgentService] Error sending invoice:', error);
          return JSON.stringify({
            success: false,
            error: error.message
          });
        }
      },
      {
        name: "execute_send_invoice",
        description: `Execute sending an invoice to the customer. Only use this AFTER the user has confirmed the proposed action.`,
        schema: z.object({
          invoiceId: z.number().describe("Invoice ID to send"),
        }),
      }
    );

    // TOOL G: Execute Create Milestone
    const executeCreateMilestoneTool = tool(
      async ({ projectId, title, description, plannedDate, isBillable, billingPercentage, category }) => {
        try {
          const milestoneData: any = {
            projectId,
            title,
            description: description || null,
            plannedDate: plannedDate, // Keep as ISO string
            status: 'pending',
            isBillable: isBillable || false,
            billingPercentage: billingPercentage || "0",
            category: category || 'delivery',
          };

          const milestone = await storage.milestones.createMilestone(milestoneData);

          console.log('[AgentService] Milestone created:', milestone?.id);

          return JSON.stringify({
            success: true,
            message: `Successfully created milestone "${title}"`,
            milestoneId: milestone?.id,
            milestone
          }, null, 2);
        } catch (error: any) {
          console.error('[AgentService] Error creating milestone:', error);
          return JSON.stringify({
            success: false,
            error: error.message
          });
        }
      },
      {
        name: "execute_create_milestone",
        description: `Execute the creation of a new milestone. Only use this AFTER the user has confirmed the proposed action.`,
        schema: z.object({
          projectId: z.number().describe("Project ID"),
          title: z.string().describe("Milestone title"),
          description: z.string().optional().describe("Milestone description"),
          plannedDate: z.string().describe("Planned date in ISO format"),
          isBillable: z.boolean().optional().describe("Whether the milestone is billable"),
          billingPercentage: z.string().optional().describe("Billing percentage (0-100)"),
          category: z.enum(['delivery', 'billing', 'approval', 'inspection']).optional(),
        }),
      }
    );

    // TOOL H: Execute Update Project Status
    const executeUpdateProjectTool = tool(
      async ({ projectId, status, progress }) => {
        try {
          const updateData: any = {};

          if (status !== undefined) updateData.status = status;
          if (progress !== undefined) updateData.progress = progress;

          await storage.projects.updateProjectDetailsAndClients(projectId, updateData);

          console.log('[AgentService] Project updated:', projectId);

          return JSON.stringify({
            success: true,
            message: `Successfully updated project ${projectId}`,
            projectId
          }, null, 2);
        } catch (error: any) {
          console.error('[AgentService] Error updating project:', error);
          return JSON.stringify({
            success: false,
            error: error.message
          });
        }
      },
      {
        name: "execute_update_project",
        description: `Execute an update to project status or progress. Only use this AFTER the user has confirmed the proposed action.`,
        schema: z.object({
          projectId: z.number().describe("Project ID to update"),
          status: z.enum(['planning', 'in_progress', 'on_hold', 'completed']).optional(),
          progress: z.number().min(0).max(100).optional().describe("Progress percentage (0-100)"),
        }),
      }
    );

    // TOOL I: Execute Record Payment
    const executeRecordPaymentTool = tool(
      async ({ invoiceId, amount, paymentMethod, paymentDate, reference }) => {
        try {
          const paymentData = {
            invoiceId,
            amount: amount.toString(),
            paymentDate: paymentDate || new Date().toISOString(), // Keep as ISO string
            paymentMethod,
            reference: reference || null,
            status: 'succeeded',
          };

          const payment = await storage.invoices.recordPayment(paymentData as any);

          console.log('[AgentService] Payment recorded:', payment?.id);

          return JSON.stringify({
            success: true,
            message: `Successfully recorded payment of $${amount} for invoice ${invoiceId}`,
            paymentId: payment?.id,
            payment
          }, null, 2);
        } catch (error: any) {
          console.error('[AgentService] Error recording payment:', error);
          return JSON.stringify({
            success: false,
            error: error.message
          });
        }
      },
      {
        name: "execute_record_payment",
        description: `Execute recording a payment against an invoice. Only use this AFTER the user has confirmed the proposed action.`,
        schema: z.object({
          invoiceId: z.number().describe("Invoice ID to record payment for"),
          amount: z.number().positive().describe("Payment amount"),
          paymentMethod: z.string().describe("Payment method (e.g., 'check', 'wire', 'credit_card')"),
          paymentDate: z.string().optional().describe("Payment date in ISO format (defaults to now)"),
          reference: z.string().optional().describe("Payment reference number or note"),
        }),
      }
    );

    // TOOL J: Execute Bulk Create Tasks
    const executeBulkCreateTasksTool = tool(
      async ({ projectId, tasks }) => {
        try {
          const results = [];
          const errors = [];

          for (let i = 0; i < tasks.length; i++) {
            const taskInput = tasks[i];
            try {
              // Normalize dates
              const parsedDueDate = taskInput.dueDate ? new Date(taskInput.dueDate) : null;
              const parsedStartDate = taskInput.startDate ? new Date(taskInput.startDate) : null;

              // Validate dates
              if (taskInput.dueDate && (!parsedDueDate || isNaN(parsedDueDate.getTime()))) {
                errors.push(`Task ${i + 1}: Invalid due date format: ${taskInput.dueDate}`);
                continue;
              }
              if (taskInput.startDate && (!parsedStartDate || isNaN(parsedStartDate.getTime()))) {
                errors.push(`Task ${i + 1}: Invalid start date format: ${taskInput.startDate}`);
                continue;
              }

              const taskData: any = {
                projectId,
                title: taskInput.title,
                description: taskInput.description || null,
                status: taskInput.status || 'todo',
                priority: taskInput.priority || 'medium',
                assigneeId: taskInput.assigneeId || null,
                dueDate: parsedDueDate,
                startDate: parsedStartDate,
                isBillable: taskInput.isBillable || false,
                billingType: taskInput.billingType || 'fixed',
                billingPercentage: taskInput.billingPercentage || "0",
                billableAmount: taskInput.billableAmount || "0",
              };

              const createdTask = await storage.tasks.createTask(taskData);
              results.push({
                success: true,
                taskId: createdTask?.id,
                title: taskInput.title
              });

              console.log('[AgentService] Bulk task created:', createdTask?.id, taskInput.title);
            } catch (error: any) {
              errors.push(`Task ${i + 1} (${taskInput.title}): ${error.message}`);
              console.error(`[AgentService] Error creating task ${i + 1}:`, error);
            }
          }

          return JSON.stringify({
            success: errors.length === 0,
            message: `Created ${results.length} of ${tasks.length} tasks`,
            created: results,
            errors: errors.length > 0 ? errors : undefined
          }, null, 2);
        } catch (error: any) {
          console.error('[AgentService] Error in bulk create tasks:', error);
          return JSON.stringify({
            success: false,
            error: error.message
          });
        }
      },
      {
        name: "execute_bulk_create_tasks",
        description: `Execute creation of multiple tasks at once. Use this when user wants to create several tasks together. Only use this AFTER the user has confirmed the proposed action.`,
        schema: z.object({
          projectId: z.number().describe("Project ID"),
          tasks: z.array(z.object({
            title: z.string().describe("Task title"),
            description: z.string().optional().describe("Task description"),
            status: z.enum(['todo', 'in_progress', 'blocked', 'done', 'cancelled']).optional(),
            priority: z.enum(['low', 'medium', 'high']).optional(),
            assigneeId: z.number().optional().describe("User ID to assign the task to"),
            dueDate: z.string().optional().describe("Due date in ISO format"),
            startDate: z.string().optional().describe("Start date in ISO format"),
            isBillable: z.boolean().optional().describe("Whether the task is billable"),
            billingType: z.enum(['fixed', 'hourly', 'percentage']).optional(),
            billingPercentage: z.string().optional().describe("Billing percentage (0-100)"),
            billableAmount: z.string().optional().describe("Fixed billable amount"),
          })).min(1).describe("Array of tasks to create"),
        }),
      }
    );

    return [
      readDatabaseTool,
      proposeActionTool,
      executeCreateTaskTool,
      executeUpdateTaskTool,
      executeCreateInvoiceTool,
      executeSendInvoiceTool,
      executeCreateMilestoneTool,
      executeUpdateProjectTool,
      executeRecordPaymentTool,
      executeBulkCreateTasksTool,
    ];
  }

  /**
   * Build the LangGraph workflow
   */
  private buildWorkflow() {
    if (!this.model) {
      throw new Error('Model not initialized');
    }

    const modelWithTools = this.model.bindTools(this.tools);

    const workflow = new StateGraph(MessagesAnnotation)
      .addNode("agent", async (state) => {
        const result = await modelWithTools.invoke(state.messages);
        return { messages: [result] };
      })
      .addNode("tools", async (state) => {
        const lastMessage = state.messages[state.messages.length - 1] as any;
        const toolCalls = lastMessage.tool_calls || [];
        const results = [];

        for (const call of toolCalls) {
          const tool = this.tools.find(t => t.name === call.name);
          if (tool) {
            try {
              const args = typeof call.args === 'string' ? JSON.parse(call.args) : call.args;

              const output = await tool.invoke({ ...call, args });

              results.push(new ToolMessage({
                tool_call_id: call.id,
                name: call.name,
                content: output.content as string,
              }));
            } catch (error) {
              console.error('[AgentService] Tool execution error:', error);
              results.push(new ToolMessage({
                tool_call_id: call.id,
                name: call.name,
                content: `Error: Execution failed with message "${error instanceof Error ? error.message : 'Unknown error'}". Please correct your query or stop if you are unsure.`,
              }));
            }
          }
        }
        return { messages: results };
      })
      .addEdge("__start__", "agent")
      .addConditionalEdges("agent", (state) => {
        const lastMessage = state.messages[state.messages.length - 1] as any;
        if (lastMessage.tool_calls?.length > 0) {
          return "tools";
        }
        return "__end__";
      })
      .addEdge("tools", "agent");

    return workflow.compile();
  }

  /**
   * Get database schema information (Cached)
   */
  private async getSchemaInfo(): Promise<string> {
    // Optimization: Return cached schema if available
    if (this.schemaCache) {
        return this.schemaCache;
    }

    try {
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
            'users', 'clients', 'payments', 'client_projects'
          )
        ORDER BY table_name, ordinal_position;
      `;

      const result = await db.execute(drizzleSql.raw(schemaQuery));

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

      const formattedSchema = Object.entries(tables)
        .map(([table, columns]) => {
          const columnInfo = columns
            .map(c => `  - ${c.column} (${c.type}${c.nullable ? ', nullable' : ''})`)
            .join('\n');
          return `Table: ${table}\n${columnInfo}`;
        })
        .join('\n\n');

      // Save to cache
      this.schemaCache = formattedSchema;
      return formattedSchema;

    } catch (error) {
      console.error('[AgentService] Failed to fetch schema:', error);
      return `[Schema fallback enabled due to error]
Available Tables: projects, tasks, invoices, milestones, daily_logs, users, clients`;
    }
  }

  /**
   * Build context string with project info and attachments
   */
  private async buildContext(request: AgentConsultRequest): Promise<string> {
    let contextStr = '';

    if (request.projectId) {
      contextStr = `User is currently viewing Project ID ${request.projectId}`;
    }

    if (request.context) {
      contextStr += `\nAdditional context: ${JSON.stringify(request.context)}`;
    }

    // Retrieve relevant facts from semantic search
    try {
      const relevantFacts = await semanticSearchService.search(
        request.userPrompt,
        {
          projectId: request.projectId,
          sessionId: request.sessionId,
          activeOnly: true,
          validOnly: true,
          minConfidence: 0.6,
        },
        5 // Limit to top 5 most relevant facts
      );

      if (relevantFacts.length > 0) {
        contextStr += '\n\n--- RELEVANT FACTS FROM PREVIOUS CONVERSATIONS ---';
        contextStr += '\n(Use these facts to provide context-aware responses)';

        relevantFacts.forEach((result, index) => {
          const fact = result.fact;
          contextStr += `\n\n${index + 1}. [${fact.factType.toUpperCase()}] ${fact.factSummary}`;

          if (fact.financialAmount) {
            contextStr += `\n   Amount: $${parseFloat(fact.financialAmount.toString()).toLocaleString()}`;
          }

          if (fact.priority === 'critical' || fact.priority === 'high') {
            contextStr += `\n   Priority: ${fact.priority.toUpperCase()}`;
          }

          if (fact.requiresAction && fact.actionDeadline) {
            contextStr += `\n   Action Required By: ${new Date(fact.actionDeadline).toLocaleDateString()}`;
          }

          if (fact.validUntil) {
            contextStr += `\n   Valid Until: ${new Date(fact.validUntil).toLocaleDateString()}`;
          }

          contextStr += `\n   Confidence: ${(parseFloat(fact.confidenceScore?.toString() || '0') * 100).toFixed(0)}%`;
          contextStr += `\n   Similarity: ${(result.similarity * 100).toFixed(0)}%`;
        });

        contextStr += '\n--- END RELEVANT FACTS ---';
      }
    } catch (error) {
      console.error('[AgentService] Failed to retrieve relevant facts:', error);
    }

    // Check for actionable facts (high priority items needing attention)
    try {
      const actionableFacts = await semanticSearchService.getActionableFacts(request.projectId, 3);

      if (actionableFacts.length > 0) {
        contextStr += '\n\n--- ACTION ITEMS REQUIRING ATTENTION ---';

        actionableFacts.forEach((fact, index) => {
          contextStr += `\n${index + 1}. [${fact.priority.toUpperCase()}] ${fact.factSummary}`;

          if (fact.actionDeadline) {
            const daysUntil = Math.ceil((new Date(fact.actionDeadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            contextStr += ` (Due in ${daysUntil} days)`;
          }
        });

        contextStr += '\n--- END ACTION ITEMS ---';
      }
    } catch (error) {
      console.error('[AgentService] Failed to retrieve actionable facts:', error);
    }

    if (request.messageId) {
      try {
        const attachments = await db.select()
          .from(chatAttachments)
          .where(eq(chatAttachments.messageId, request.messageId));

        if (attachments.length > 0) {
          contextStr += '\n\nUser has attached the following files:';
          attachments.forEach((att) => {
            contextStr += `\n- ${att.fileName} (${att.mimeType}, ${(att.fileSize / 1024).toFixed(1)} KB)`;
            contextStr += `\n  URL: ${att.url}`;
          });
          contextStr += '\n\nNote: You can reference these files in your response.';
        }
      } catch (error) {
        console.error('[AgentService] Failed to fetch attachments:', error);
      }
    }

    return contextStr || 'No specific context provided';
  }

  /**
   * Main consultation method
   */
  async consult(request: AgentConsultRequest): Promise<AgentConsultResponse> {
    console.log('[AgentService] Processing consultation:', request.userPrompt);

    if (!this.initialized || !this.model || !this.app) {
      throw new Error(this.initError || 'Agent service not initialized');
    }

    try {
      const schema = await this.getSchemaInfo();
      const context = await this.buildContext(request);

      const systemPrompt = `You are Kolmo AI, an intelligent assistant for Kolmo Construction project management.

CAPABILITIES:
- READ database via 'read_database' tool (SELECT queries only)
- PROPOSE actions via 'propose_action' tool
- EXECUTE actions via 'execute_*' tools (ONLY after user confirmation)

CURRENT CONTEXT:
${context}

DATABASE SCHEMA:
${schema}

WORKFLOW FOR ACTIONS:
1. Use 'read_database' to understand the current state
2. Use 'propose_action' to suggest what to do and explain WHY
3. Wait for user to confirm (they will say "yes", "do it", "proceed", "confirm", etc.)
4. Once confirmed, use the appropriate 'execute_*' tool to perform the action
5. Report the results clearly

AVAILABLE EXECUTE TOOLS:
- execute_create_task: Create a single task
- execute_bulk_create_tasks: Create MULTIPLE tasks at once (USE THIS when user asks for 2+ tasks)
- execute_update_task: Update an existing task
- execute_create_invoice: Create a new invoice
- execute_send_invoice: Send invoice to customer
- execute_create_milestone: Create a new milestone
- execute_update_project: Update project status/progress
- execute_record_payment: Record a payment against an invoice

IMPORTANT RULES:
1. NEVER execute actions without proposing first and getting confirmation
2. When user asks you to do something, first use 'propose_action' with full details
3. Explain what will change and why
4. Only call 'execute_*' tools after user explicitly confirms
5. If user says "yes", "do it", "proceed", "go ahead", or similar, that's confirmation
6. Be concise and professional
7. Always verify data before proposing changes
8. ALWAYS use ISO 8601 format for dates (e.g., "2025-12-18T00:00:00Z" or "2025-12-18T23:59:59.000Z")
9. When user asks to create MULTIPLE items (e.g., "create 5 tasks"), use execute_bulk_create_tasks with ALL items in one call

CONFIRMATION KEYWORDS:
- "yes", "yeah", "yep", "sure"
- "do it", "go ahead", "proceed"
- "confirm", "confirmed", "execute"
- "make it happen", "let's do it"

EXAMPLE WORKFLOWS:

Single Task:
User: "Create a task for foundation work"
You: [read_database to check project] → [propose_action with details] → "I propose creating a task..."
User: "yes"
You: [execute_create_task] → "Done! Created task #123"

Multiple Tasks:
User: "Create 5 tasks for the electrical work phase"
You: [read_database] → [propose_action with ALL 5 tasks listed] → "I propose creating 5 tasks: 1) Wire rough-in, 2) Panel installation..."
User: "yes"
You: [execute_bulk_create_tasks with array of 5 tasks] → "Done! Created 5 tasks: #124, #125, #126, #127, #128"
`;

      const result = await this.app.invoke({
        messages: [
          new SystemMessage(systemPrompt),
          new HumanMessage(request.userPrompt)
        ]
      });

      const lastMsg = result.messages[result.messages.length - 1];
      const answer = lastMsg.content as string;
      const actions: AgentAction[] = [];

      // Loop through all messages to find tool calls
      for (const msg of result.messages) {
        if (msg.tool_calls) {
          for (const call of msg.tool_calls) {
            if (call.name === 'propose_action') {
              let args = call.args;
              if (typeof args === 'string') {
                try {
                  args = JSON.parse(args);
                } catch (e) {
                  console.warn('[AgentService] Failed to parse action args:', args);
                  continue;
                }
              }

              actions.push({
                type: 'SUGGEST_ACTION',
                action: args.action,
                payload: args.payload,
                reasoning: args.reasoning
              });
            }
          }
        }
      }

      console.log('[AgentService] Consultation complete. Actions suggested:', actions.length);

      // Extract facts from the conversation (async, don't block response)
      if (request.sessionId) {
        factExtractionService.extractFacts(
          request.userPrompt,
          answer,
          {
            sessionId: request.sessionId,
            projectId: request.projectId,
            userId: request.userId,
            sourceMessageId: request.messageId,
          }
        ).catch(error => {
          // Log error but don't fail the request
          console.error('[AgentService] Fact extraction failed (non-blocking):', error);
        });
      }

      return {
        answer,
        actions,
        rawOutput: answer,
      };
    } catch (error) {
      console.error('[AgentService] Consultation error:', error);
      throw error;
    }
  }

  async getSchema(): Promise<string> {
    return await this.getSchemaInfo();
  }
}

export const agentService = new AgentService();

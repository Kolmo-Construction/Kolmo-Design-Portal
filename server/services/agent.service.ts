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
import { tavilySearchService } from "./tavily-search.service";

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
  private projectTools: any[] = [];
  private leadsTools: any[] = [];
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

      // 2. Define Tools (separate sets for each agent)
      this.projectTools = this.createProjectTools();
      this.leadsTools = this.createLeadsTools();
      this.tools = this.projectTools; // Default to project tools

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
   * Create tools specific to Project Management agent
   */
  private createProjectTools() {
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
   * Create tools specific to Leads/Sales agent
   */
  private createLeadsTools() {
    // SHARED TOOL: Read Database (same as project agent)
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
Use this to find leads, customers, and related information.`,
        schema: z.object({
          query: z.string().describe("The SQL SELECT query to execute. Must be a valid SELECT statement."),
        }),
      }
    );

    // SHARED TOOL: Propose Action (same as project agent)
    const proposeActionTool = tool(
      async ({ action, payload, reasoning }) => {
        console.log('[AgentService] Action proposed:', action);
        return `Action ${action} proposed successfully with reasoning: ${reasoning}. Waiting for user confirmation to proceed.`;
      },
      {
        name: "propose_action",
        description: `Suggest an action for lead management.
Use this FIRST to propose an action and explain it to the user.
The user will confirm before execution.`,
        schema: z.object({
          action: z.enum(['SEARCH_LEADS', 'SAVE_LEAD', 'UPDATE_LEAD', 'CONVERT_LEAD'])
            .describe("The type of action to perform"),
          payload: z.record(z.any()).describe("The data required for the action"),
          reasoning: z.string().describe("Clear explanation of why this action is being suggested"),
        }),
      }
    );

    // NEW TOOL: Search for leads using Tavily
    const searchLeadsTool = tool(
      async ({ location, keywords, sites }) => {
        try {
          const keywordArray = keywords.split(',').map((k: string) => k.trim());
          const siteArray = sites ? sites.split(',').map((s: string) => s.trim()) : undefined;

          const results = await tavilySearchService.searchLeads({
            location,
            keywords: keywordArray,
            sites: siteArray,
          });

          if (!results.success) {
            return JSON.stringify({
              success: false,
              error: results.error || 'Search failed',
            });
          }

          // Save promising leads to database
          const savedLeads = [];
          for (const result of results.results.slice(0, 5)) { // Top 5 only
            const lead = await storage.leads.createLead({
              name: 'Unknown User',
              contactInfo: result.url,
              source: 'web_search',
              sourceUrl: result.url,
              contentSnippet: result.content.substring(0, 500),
              location,
              confidenceScore: Math.round(result.score * 100),
              interestTags: keywordArray,
            });
            savedLeads.push(lead);
          }

          return JSON.stringify({
            success: true,
            message: `Found ${results.results.length} potential leads, saved top ${savedLeads.length}`,
            results: results.results,
            savedLeadIds: savedLeads.map(l => l.id),
          }, null, 2);
        } catch (error: any) {
          return JSON.stringify({
            success: false,
            error: error.message,
          });
        }
      },
      {
        name: 'search_leads',
        description: 'Search for potential construction leads on Reddit, Nextdoor, Houzz, or other sites using Tavily API',
        schema: z.object({
          location: z.string().describe('City, neighborhood, or region (e.g., "Seattle", "Capitol Hill")'),
          keywords: z.string().describe('Comma-separated keywords (e.g., "remodel, contractor, kitchen")'),
          sites: z.string().optional().describe('Optional: comma-separated site filters (e.g., "reddit.com, nextdoor.com")'),
        }),
      }
    );

    // NEW TOOL: Save/update lead manually
    const saveLeadTool = tool(
      async ({ name, contactInfo, source, contentSnippet, location, tags }) => {
        try {
          const lead = await storage.leads.createLead({
            name,
            contactInfo,
            source: source || 'manual',
            contentSnippet,
            location,
            interestTags: tags ? tags.split(',').map((t: string) => t.trim()) : [],
            confidenceScore: 50,
          });

          return JSON.stringify({
            success: true,
            message: `Lead "${name}" saved successfully`,
            leadId: lead.id,
            lead,
          }, null, 2);
        } catch (error: any) {
          return JSON.stringify({
            success: false,
            error: error.message,
          });
        }
      },
      {
        name: 'save_lead',
        description: 'Manually save a lead to the database',
        schema: z.object({
          name: z.string().describe('Lead name or username'),
          contactInfo: z.string().describe('Email, phone, or profile URL'),
          source: z.enum(['manual', 'web_search', 'social_media', 'thumbtack', 'homedepot', 'nextdoor', 'referral']).optional(),
          contentSnippet: z.string().describe('Original message or post content'),
          location: z.string().optional().describe('City, neighborhood, or region'),
          tags: z.string().optional().describe('Comma-separated interest tags'),
        }),
      }
    );

    // NEW TOOL: Get recent leads
    const getLeadsTool = tool(
      async ({ status, limit }) => {
        try {
          const leads = status
            ? await storage.leads.getLeadsByStatus(status)
            : await storage.leads.getRecentLeads(limit || 20);

          return JSON.stringify({
            success: true,
            count: leads.length,
            leads: leads.map(l => ({
              id: l.id,
              name: l.name,
              contactInfo: l.contactInfo,
              source: l.source,
              status: l.status,
              confidenceScore: l.confidenceScore,
              location: l.location,
              detectedAt: l.detectedAt,
            })),
          }, null, 2);
        } catch (error: any) {
          return JSON.stringify({
            success: false,
            error: error.message,
          });
        }
      },
      {
        name: 'get_leads',
        description: 'Retrieve recent leads from the database',
        schema: z.object({
          status: z.enum(['new', 'contacted', 'qualified', 'converted', 'archived']).optional(),
          limit: z.number().optional().describe('Max number of leads to return (default: 20)'),
        }),
      }
    );

    return [
      readDatabaseTool,
      proposeActionTool,
      searchLeadsTool,
      saveLeadTool,
      getLeadsTool,
    ];
  }

  /**
   * Build the LangGraph workflow with router pattern
   */
  private buildWorkflow() {
    if (!this.model) {
      throw new Error('Model not initialized');
    }

    const workflow = new StateGraph(MessagesAnnotation)
      // Router node: Classifies intent and sets tools
      .addNode("router", async (state) => {
        const lastMessage = state.messages[state.messages.length - 1];
        const userPrompt = lastMessage.content.toString();

        // Classify intent
        const agentType = await this.classifyIntent(userPrompt);

        // Set appropriate tools for the selected agent
        if (agentType === 'leads') {
          this.tools = this.leadsTools;
          console.log('[Router] Routing to LeadsAgent');
        } else {
          this.tools = this.projectTools;
          console.log('[Router] Routing to ProjectAgent');
        }

        // Store agent type in state metadata (for system prompt)
        return {
          messages: [
            new SystemMessage(`[ROUTER] Selected agent: ${agentType.toUpperCase()}`)
          ]
        };
      })

      // Agent node: LLM reasoning with context-specific tools
      .addNode("agent", async (state) => {
        // Bind current tools to model
        const modelWithTools = this.model!.bindTools(this.tools);
        const result = await modelWithTools.invoke(state.messages);
        return { messages: [result] };
      })

      // Tools node: Execute tool calls
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
                content: `Error: Execution failed with message "${error instanceof Error ? error.message : 'Unknown error'}"`,
              }));
            }
          }
        }
        return { messages: results };
      })

      // Edges
      .addEdge("__start__", "router")
      .addEdge("router", "agent")
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
  /**
   * System prompt for Project Management agent
   */
  private buildProjectSystemPrompt(context: string, schema: string): string {
    return `You are Kolmo AI, an intelligent assistant for Kolmo Construction project management.

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
  }

  /**
   * System prompt for Leads/Sales agent
   */
  private buildLeadsSystemPrompt(context: string, schema: string): string {
    return `You are Kolmo Leads AI, an intelligent assistant for discovering and qualifying construction leads.

CAPABILITIES:
- SEARCH for leads via 'search_leads' tool (Reddit, Nextdoor, Houzz, public social media)
- SAVE leads via 'save_lead' tool
- GET leads via 'get_leads' tool
- READ database via 'read_database' tool
- PROPOSE actions via 'propose_action' tool

WORKFLOW FOR LEAD DISCOVERY:
1. Ask user for location and keywords (e.g., "Seattle kitchen remodel")
2. Use 'search_leads' to find potential leads
3. Review results and suggest which leads look most promising
4. Use 'save_lead' to store high-quality leads

LEAD QUALIFICATION CRITERIA:
- Has clear construction need (remodel, addition, deck, etc.)
- Mentions location/neighborhood
- Recent post (within last week is best)
- Asks for recommendations or bids
- Shows decision-making authority

COMMUNICATION STYLE:
- Be friendly and consultative (sales tone, not robotic)
- Focus on lead quality over quantity
- Suggest personalized outreach strategies
- Highlight urgency indicators (timeline mentions, immediate need)

AVAILABLE TOOLS:
- search_leads: Search Reddit, Nextdoor, Houzz for leads
- save_lead: Manually save a lead to database
- get_leads: Retrieve recent leads by status
- read_database: Query database for context

CURRENT CONTEXT:
${context}

DATABASE SCHEMA (LEADS TABLE):
Table: leads
Columns: id, name, contact_info, source, source_url, content_snippet, interest_tags, status, draft_response, confidence_score, location, detected_at

${schema}

Be proactive, persuasive, and focus on lead generation.`;
  }

  async consult(request: AgentConsultRequest): Promise<AgentConsultResponse> {
    console.log('[AgentService] Processing consultation:', request.userPrompt);

    if (!this.initialized || !this.model || !this.app) {
      throw new Error(this.initError || 'Agent service not initialized');
    }

    try {
      const schema = await this.getSchemaInfo();
      const context = await this.buildContext(request);

      // Classify intent to determine agent type
      const agentType = await this.classifyIntent(request.userPrompt);

      // Build appropriate system prompt
      const systemPrompt = agentType === 'leads'
        ? this.buildLeadsSystemPrompt(context, schema)
        : this.buildProjectSystemPrompt(context, schema);

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

  /**
   * Get the workflow graph as a Mermaid diagram
   * @returns Mermaid diagram string representation of the agent workflow
   */
  async getGraphDiagram(): Promise<string> {
    if (!this.initialized || !this.app) {
      throw new Error(this.initError || 'Agent service not initialized');
    }

    try {
      // Use getGraphAsync (preferred async method)
      const graph = await this.app.getGraphAsync();

      // Generate Mermaid diagram with customization
      return graph.drawMermaid({
        withStyles: true,
        curveStyle: 'linear',
        wrapLabelNWords: 9
      });
    } catch (error) {
      console.error('[AgentService] Failed to generate graph diagram:', error);
      throw new Error('Failed to generate workflow graph');
    }
  }

  /**
   * Get list of all registered tools with their details
   * @returns Array of tool information objects
   */
  getRegisteredTools(): Array<{ name: string; description: string; parameters: any }> {
    if (!this.initialized) {
      throw new Error(this.initError || 'Agent service not initialized');
    }

    return this.tools.map(tool => ({
      name: tool.name,
      description: tool.description || 'No description available',
      parameters: tool.schema ? {
        type: 'object',
        properties: tool.schema._def?.schema?.shape || {},
        description: tool.schema.description || ''
      } : {}
    }));
  }

  /**
   * Classify user intent using LLM to route to appropriate agent
   * @param userPrompt - The user's input message
   * @returns 'project' or 'leads'
   */
  private async classifyIntent(userPrompt: string): Promise<'project' | 'leads'> {
    try {
      if (!this.model) {
        // Fallback to keyword matching if model unavailable
        return this.classifyIntentKeywords(userPrompt);
      }

      const classificationPrompt = `You are a query classifier for a construction management system.

Classify the following user query into one of two categories:
- "project": Questions about existing projects, tasks, invoices, milestones, payments, schedules, or construction management
- "leads": Questions about finding new customers, searching for leads, monitoring social media, discovering prospects, or sales/marketing

User Query: "${userPrompt}"

Respond with ONLY one word: either "project" or "leads"`;

      const response = await this.model.invoke([
        { role: 'user', content: classificationPrompt }
      ]);

      const classification = response.content.toString().trim().toLowerCase();

      if (classification.includes('leads')) {
        console.log('[AgentService] Intent classified as: LEADS');
        return 'leads';
      } else {
        console.log('[AgentService] Intent classified as: PROJECT');
        return 'project';
      }
    } catch (error) {
      console.error('[AgentService] Classification error, defaulting to keyword matching:', error);
      return this.classifyIntentKeywords(userPrompt);
    }
  }

  /**
   * Fallback keyword-based classification
   */
  private classifyIntentKeywords(userPrompt: string): 'project' | 'leads' {
    const lowerPrompt = userPrompt.toLowerCase();

    const leadKeywords = [
      'lead', 'leads', 'find customer', 'search', 'reddit', 'facebook',
      'thumbtack', 'nextdoor', 'houzz', 'social media', 'prospect',
      'new customer', 'sales', 'marketing', 'discover', 'monitor'
    ];

    const hasLeadKeyword = leadKeywords.some(keyword => lowerPrompt.includes(keyword));

    if (hasLeadKeyword) {
      console.log('[AgentService] Intent classified (keywords) as: LEADS');
      return 'leads';
    }

    console.log('[AgentService] Intent classified (keywords) as: PROJECT');
    return 'project';
  }
}

export const agentService = new AgentService();

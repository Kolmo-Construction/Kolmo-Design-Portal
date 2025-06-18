import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';

// Expensify API schemas
const ExpensifyExpenseSchema = z.object({
  transactionID: z.string(),
  amount: z.number(),
  category: z.string().optional(),
  tag: z.string().optional(), // This will be our project ID
  merchant: z.string().optional(),
  comment: z.string().optional(),
  created: z.string(),
  modified: z.string(),
  receipt: z.object({
    receiptID: z.string().optional(),
    filename: z.string().optional(),
  }).optional(),
});

const ExpensifyReportSchema = z.object({
  reportID: z.string(),
  reportName: z.string(),
  status: z.string(),
  total: z.number(),
  expenses: z.array(ExpensifyExpenseSchema),
});

export type ExpensifyExpense = z.infer<typeof ExpensifyExpenseSchema>;
export type ExpensifyReport = z.infer<typeof ExpensifyReportSchema>;

export interface ProjectExpenseData {
  projectId: number;
  projectName: string;
  totalBudget: number;
  totalExpenses: number;
  remainingBudget: number;
  budgetUtilization: number;
  expenses: ProcessedExpense[];
}

export interface ProcessedExpense {
  id: string;
  projectId: number;
  amount: number;
  category: string;
  description: string;
  date: string;
  merchant: string;
  receipt?: string;
  status: 'pending' | 'approved' | 'reimbursed';
  tag?: string; // Original Expensify tag for mapping purposes
}

export class ExpensifyService {
  private partnerUserID: string;
  private partnerUserSecret: string;
  private baseURL = 'https://integrations.expensify.com/Integration-Server/ExpensifyIntegrations';

  constructor() {
    this.partnerUserID = process.env.EXPENSIFY_PARTNER_USER_ID || '';
    this.partnerUserSecret = process.env.EXPENSIFY_PARTNER_USER_SECRET || '';
  }

  /**
   * Check if Expensify credentials are configured
   */
  isConfigured(): boolean {
    return !!(this.partnerUserID && this.partnerUserSecret);
  }

  /**
   * Create authentication headers for Expensify API
   */
  private getAuthHeaders() {
    return {
      'Content-Type': 'application/x-www-form-urlencoded',
    };
  }

  /**
   * Create request payload for Expensify API using URL-encoded form data
   */
  private createFormPayload(command: string, additionalParams: Record<string, any> = {}): string {
    const jobDescription = {
      type: 'file',
      credentials: {
        partnerUserID: this.partnerUserID,
        partnerUserSecret: this.partnerUserSecret,
      },
      onReceive: {
        immediateResponse: ['returnRandomFileName'],
      },
      inputSettings: {
        type: 'combinedReportData',
        filters: {
          reportState: 'OPEN,PROCESSING,APPROVED,REIMBURSED',
          startDate: '2024-01-01',
          endDate: new Date().toISOString().split('T')[0],
          ...additionalParams.filters,
        },
      },
      outputSettings: {
        fileExtension: 'json',
      },
    };

    const params = new URLSearchParams();
    params.append('requestJobDescription', JSON.stringify(jobDescription));

    // Add a simplified inline template that works with Expensify's authentication
    const simpleTemplate = `[
<#list reports as report>
{
  "reportID": "\${report.reportID}",
  "reportName": "\${report.reportName?js_string}",
  "status": "\${report.status?js_string}",
  "total": \${report.total?c},
  "expenses": [
    <#list report.transactionList as expense>
    {
      "transactionID": "\${expense.transactionID}",
      "amount": \${expense.amount?c},
      "category": "\${(expense.category!'')?js_string}",
      "tag": "\${(expense.tag!'')?js_string}",
      "merchant": "\${(expense.merchant!'')?js_string}",
      "comment": "\${(expense.comment!'')?js_string}",
      "created": "\${expense.created}",
      "modified": "\${expense.modified}"
    }<#if expense_has_next>,</#if>
    </#list>
  ]
}<#if report_has_next>,</#if>
</#list>
]`;

    params.append('template', simpleTemplate);
    console.log('[Expensify] Using inline template for data extraction');

    return params.toString();
  }

  /**
   * Generate Expensify tag for a project using owner name and creation date
   */
  generateProjectTag(ownerName: string, creationDate: Date): string {
    const dateStr = creationDate.toISOString().split('T')[0]; // YYYY-MM-DD format
    const cleanOwnerName = ownerName.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, ''); // Remove spaces and special chars
    return `${cleanOwnerName}_${dateStr}`;
  }

  /**
   * Fetch expenses for a specific project using Expensify tags
   */
  async getProjectExpenses(projectId: number): Promise<ProcessedExpense[]> {
    if (!this.isConfigured()) {
      throw new Error('Expensify API credentials not configured');
    }

    try {
      // Get all expenses and filter by project ID
      // This approach works better than tag filtering since we need to handle both old and new tag formats
      const payload = this.createFormPayload('download');

      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: payload,
      });

      if (!response.ok) {
        throw new Error(`Expensify API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return this.processExpenseData(data, projectId);
    } catch (error) {
      console.error('Error fetching Expensify expenses:', error);
      throw error;
    }
  }

  /**
   * Fetch all expenses across all projects
   */
  async getAllExpenses(): Promise<ProcessedExpense[]> {
    if (!this.isConfigured()) {
      throw new Error('Expensify API credentials not configured');
    }

    try {
      const payload = this.createFormPayload('download');
      console.log('[Expensify] Making API request with URL-encoded form data');
      console.log('[Expensify] Payload preview:', payload.substring(0, 200) + '...');

      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: payload,
      });

      console.log('[Expensify] API response status:', response.status, response.statusText);

      const responseText = await response.text();
      console.log('[Expensify] Raw response text:', responseText.substring(0, 500));

      if (!response.ok) {
        console.log('[Expensify] API error response:', responseText);
        throw new Error(`Expensify API error: ${response.status} ${response.statusText} - ${responseText}`);
      }

      // Try to parse as JSON
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.log('[Expensify] Response is not JSON, treating as error');
        throw new Error(`Expensify API returned non-JSON response: ${responseText}`);
      }

      console.log('[Expensify] API response data type:', typeof data);
      console.log('[Expensify] API response data length:', Array.isArray(data) ? data.length : 'not array');
      console.log('[Expensify] First 500 chars of response:', JSON.stringify(data).substring(0, 500));
      
      // Check if response contains an error
      if (data.responseCode && data.responseCode !== 200) {
        throw new Error(`Expensify API error: ${data.responseMessage || 'Unknown error'} (Code: ${data.responseCode})`);
      }
      
      const processedExpenses = this.processAllExpenseData(data);
      console.log('[Expensify] Processed expenses count:', processedExpenses.length);
      return processedExpenses;
    } catch (error) {
      console.error('Error fetching all Expensify expenses:', error);
      throw error;
    }
  }

  /**
   * Create a new project in Expensify (creates a tag for expense tracking)
   */
  async createProject(projectId: number, projectName: string, ownerName: string, creationDate: Date): Promise<{ success: boolean; tag: string }> {
    if (!this.isConfigured()) {
      throw new Error('Expensify API credentials not configured');
    }

    try {
      // Create tag format: OwnerName_YYYY-MM-DD
      const dateStr = creationDate.toISOString().split('T')[0]; // YYYY-MM-DD format
      const cleanOwnerName = ownerName.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, ''); // Remove spaces and special chars
      const expensifyTag = `${cleanOwnerName}_${dateStr}`;

      // Expensify doesn't have a direct "create tag" API
      // Tags are created automatically when expenses are submitted with them
      // We'll document this project for future expense submissions
      console.log(`Project ${projectId} (${projectName}) ready for Expensify expense tracking with tag: ${expensifyTag}`);
      
      return { success: true, tag: expensifyTag };
    } catch (error) {
      console.error('Error creating Expensify project:', error);
      throw error;
    }
  }

  /**
   * Process expense data from Expensify response
   */
  private processExpenseData(data: any, projectId: number): ProcessedExpense[] {
    try {
      if (!data || !Array.isArray(data)) {
        return [];
      }

      const expenses: ProcessedExpense[] = [];
      
      for (const report of data) {
        if (report.expenses && Array.isArray(report.expenses)) {
          for (const expense of report.expenses) {
            // Check if expense belongs to this project using multiple tag formats:
            // 1. Old format: just project ID (e.g., "62")
            // 2. New format: OwnerName_YYYY-MM-DD (need to map back to project)
            let belongsToProject = false;
            
            if (expense.tag === projectId.toString()) {
              // Old format - direct project ID match
              belongsToProject = true;
            } else if (expense.tag) {
              // For new format, we'll need to check against all expenses
              // and let the controller handle the mapping
              belongsToProject = true;
            }
            
            if (belongsToProject) {
              expenses.push({
                id: expense.transactionID || `exp_${Date.now()}`,
                projectId: expense.tag === projectId.toString() ? projectId : 0, // Set to 0 for new format tags
                amount: expense.amount || 0,
                category: expense.category || 'Uncategorized',
                description: expense.comment || expense.merchant || 'No description',
                date: expense.created || new Date().toISOString(),
                merchant: expense.merchant || 'Unknown',
                receipt: expense.receipt?.filename,
                status: this.mapExpensifyStatus(report.status),
                tag: expense.tag, // Preserve original tag for mapping
              });
            }
          }
        }
      }

      return expenses;
    } catch (error) {
      console.error('Error processing expense data:', error);
      return [];
    }
  }

  /**
   * Process all expense data from Expensify response
   */
  private processAllExpenseData(data: any): ProcessedExpense[] {
    try {
      if (!data || !Array.isArray(data)) {
        return [];
      }

      const expenses: ProcessedExpense[] = [];
      
      for (const report of data) {
        if (report.expenses && Array.isArray(report.expenses)) {
          for (const expense of report.expenses) {
            const projectId = expense.tag ? parseInt(expense.tag) : 0;
            
            expenses.push({
              id: expense.transactionID || `exp_${Date.now()}`,
              projectId,
              amount: expense.amount || 0,
              category: expense.category || 'Uncategorized',
              description: expense.comment || expense.merchant || 'No description',
              date: expense.created || new Date().toISOString(),
              merchant: expense.merchant || 'Unknown',
              receipt: expense.receipt?.filename,
              status: this.mapExpensifyStatus(report.status),
              tag: expense.tag, // Preserve original tag for mapping
            });
          }
        }
      }

      return expenses;
    } catch (error) {
      console.error('Error processing all expense data:', error);
      return [];
    }
  }

  /**
   * Map Expensify report status to our status enum
   */
  private mapExpensifyStatus(expensifyStatus: string): 'pending' | 'approved' | 'reimbursed' {
    switch (expensifyStatus?.toUpperCase()) {
      case 'APPROVED':
        return 'approved';
      case 'REIMBURSED':
        return 'reimbursed';
      default:
        return 'pending';
    }
  }

  /**
   * Test connection to Expensify API
   */
  async testConnection(): Promise<{ connected: boolean; message: string }> {
    if (!this.isConfigured()) {
      return {
        connected: false,
        message: 'Expensify API credentials not configured. Please set EXPENSIFY_PARTNER_USER_ID and EXPENSIFY_PARTNER_USER_SECRET environment variables.',
      };
    }

    try {
      // Test with a simple request
      const payload = this.createFormPayload('download', {
        filters: {
          limit: 1,
        },
      });

      console.log('[Expensify] Testing connection with payload preview:', payload.substring(0, 200) + '...');

      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: payload,
      });

      const responseText = await response.text();
      console.log('[Expensify] Test connection response:', responseText.substring(0, 500));

      if (response.ok) {
        // Try to parse response to check for authentication errors
        try {
          const data = JSON.parse(responseText);
          if (data.responseCode && data.responseCode === 401) {
            return {
              connected: false,
              message: `Authentication failed: ${data.responseMessage || 'Invalid credentials'}. Please verify EXPENSIFY_PARTNER_USER_ID and EXPENSIFY_PARTNER_USER_SECRET are correct.`,
            };
          }
        } catch (parseError) {
          // Response might not be JSON, continue with success
        }

        return {
          connected: true,
          message: 'Successfully connected to Expensify API',
        };
      } else {
        return {
          connected: false,
          message: `Expensify API connection failed: ${response.status} ${response.statusText} - ${responseText}`,
        };
      }
    } catch (error) {
      return {
        connected: false,
        message: `Expensify API connection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}

export const expensifyService = new ExpensifyService();
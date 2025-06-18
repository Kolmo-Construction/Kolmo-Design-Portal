import { z } from 'zod';

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
}

export class ExpensifyService {
  private apiKey: string;
  private userID: string;
  private userSecret: string;
  private baseURL = 'https://integrations.expensify.com/Integration-Server/ExpensifyIntegrations';

  constructor() {
    this.apiKey = process.env.EXPENSIFY_API_KEY || '';
    this.userID = process.env.EXPENSIFY_USER_ID || '';
    this.userSecret = process.env.EXPENSIFY_USER_SECRET || '';
  }

  /**
   * Check if Expensify credentials are configured
   */
  isConfigured(): boolean {
    return !!(this.apiKey && this.userID && this.userSecret);
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
   * Create request payload for Expensify API
   */
  private createRequestPayload(command: string, additionalParams: Record<string, any> = {}) {
    return new URLSearchParams({
      requestJobDescription: JSON.stringify({
        type: 'file',
        credentials: {
          partnerUserID: this.userID,
          partnerUserSecret: this.userSecret,
        },
        onReceive: {
          immediateResponse: ['returnRandomFileName'],
        },
        inputSettings: {
          type: 'combinedReportData',
          filters: {
            reportState: 'APPROVED,REIMBURSED',
            ...additionalParams.filters,
          },
        },
        outputSettings: {
          fileExtension: 'json',
        },
      }),
    }).toString();
  }

  /**
   * Fetch expenses for a specific project using Expensify tags
   */
  async getProjectExpenses(projectId: number): Promise<ProcessedExpense[]> {
    if (!this.isConfigured()) {
      throw new Error('Expensify API credentials not configured');
    }

    try {
      const payload = this.createRequestPayload('download', {
        filters: {
          tag: projectId.toString(), // Use project ID as tag filter
        },
      });

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
      const payload = this.createRequestPayload('download');

      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: payload,
      });

      if (!response.ok) {
        throw new Error(`Expensify API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return this.processAllExpenseData(data);
    } catch (error) {
      console.error('Error fetching all Expensify expenses:', error);
      throw error;
    }
  }

  /**
   * Create a new project in Expensify (creates a tag for expense tracking)
   */
  async createProject(projectId: number, projectName: string): Promise<boolean> {
    if (!this.isConfigured()) {
      throw new Error('Expensify API credentials not configured');
    }

    try {
      // Expensify doesn't have a direct "create tag" API
      // Tags are created automatically when expenses are submitted with them
      // We'll document this project for future expense submissions
      console.log(`Project ${projectId} (${projectName}) ready for Expensify expense tracking`);
      return true;
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
            if (expense.tag === projectId.toString()) {
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
        message: 'Expensify API credentials not configured. Please set EXPENSIFY_API_KEY, EXPENSIFY_USER_ID, and EXPENSIFY_USER_SECRET environment variables.',
      };
    }

    try {
      // Test with a simple request
      const payload = this.createRequestPayload('download', {
        filters: {
          limit: 1,
        },
      });

      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: payload,
      });

      if (response.ok) {
        return {
          connected: true,
          message: 'Successfully connected to Expensify API',
        };
      } else {
        return {
          connected: false,
          message: `Expensify API connection failed: ${response.status} ${response.statusText}`,
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
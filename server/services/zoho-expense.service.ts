import { z } from 'zod';
import { db } from '../db';
import { zohoTokens } from '../../shared/schema';
import { eq } from 'drizzle-orm';

// Zoho Expense API schemas
const ZohoExpenseSchema = z.object({
  expense_id: z.string(),
  amount: z.number(),
  category_name: z.string().optional(),
  project_name: z.string().optional(), // This will be our project mapping
  merchant: z.string().optional(),
  description: z.string().optional(),
  date: z.string(),
  created_time: z.string(),
  status: z.string(),
  receipt_name: z.string().optional(),
  currency_code: z.string().optional(),
  custom_fields: z.array(z.object({
    customfield_id: z.string(),
    value: z.string(),
  })).optional(),
});

const ZohoReportSchema = z.object({
  report_id: z.string(),
  report_name: z.string(),
  status: z.string(),
  total: z.number(),
  expenses: z.array(ZohoExpenseSchema),
});

const ZohoOrganizationSchema = z.object({
  organization_id: z.string(),
  name: z.string(),
  is_default_org: z.boolean().optional(),
});

export type ZohoExpense = z.infer<typeof ZohoExpenseSchema>;
export type ZohoReport = z.infer<typeof ZohoReportSchema>;
export type ZohoOrganization = z.infer<typeof ZohoOrganizationSchema>;

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
  projectTag?: string; // Zoho project name for mapping
}

export interface ZohoTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

export class ZohoExpenseService {
  private clientId: string;
  private clientSecret: string;
  private organizationId: string;
  private redirectUri: string;
  private baseURL = 'https://www.zohoapis.com/books/v3';
  private authURL = 'https://accounts.zoho.com/oauth/v2';
  private tokens: ZohoTokens | null = null;

  constructor() {
    this.clientId = process.env.ZOHO_CLIENT_ID || '';
    this.clientSecret = process.env.ZOHO_CLIENT_SECRET || '';
    this.organizationId = process.env.ZOHO_ORGANIZATION_ID || '';
    this.redirectUri = process.env.ZOHO_REDIRECT_URI || '';
    
    // Load tokens from database on startup
    this.loadTokensFromDatabase();
  }

  /**
   * Load tokens from database
   */
  private async loadTokensFromDatabase(): Promise<void> {
    try {
      const tokenRecord = await db.select()
        .from(zohoTokens)
        .where(eq(zohoTokens.service, 'expense'))
        .limit(1);

      if (tokenRecord.length > 0) {
        const record = tokenRecord[0];
        this.tokens = {
          access_token: record.accessToken,
          refresh_token: record.refreshToken,
          expires_at: record.expiresAt.getTime(),
        };
        
        if (record.organizationId) {
          this.organizationId = record.organizationId;
        }
        
        console.log('[Zoho] Tokens loaded from database');
      }
    } catch (error) {
      console.error('[Zoho] Failed to load tokens from database:', error);
    }
  }

  /**
   * Save tokens to database
   */
  private async saveTokensToDatabase(): Promise<void> {
    if (!this.tokens) return;

    try {
      // Check if record exists
      const existingRecord = await db.select()
        .from(zohoTokens)
        .where(eq(zohoTokens.service, 'expense'))
        .limit(1);

      const tokenData = {
        service: 'expense',
        accessToken: this.tokens.access_token,
        refreshToken: this.tokens.refresh_token,
        expiresAt: new Date(this.tokens.expires_at),
        organizationId: this.organizationId || null,
        updatedAt: new Date(),
      };

      if (existingRecord.length > 0) {
        // Update existing record
        await db.update(zohoTokens)
          .set(tokenData)
          .where(eq(zohoTokens.service, 'expense'));
      } else {
        // Insert new record
        await db.insert(zohoTokens).values({
          ...tokenData,
          createdAt: new Date(),
        });
      }
      
      console.log('[Zoho] Tokens saved to database');
    } catch (error) {
      console.error('[Zoho] Failed to save tokens to database:', error);
    }
  }

  /**
   * Check if Zoho Expense credentials are configured
   */
  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret);
  }

  /**
   * Get OAuth authorization URL for initial setup
   */
  getAuthorizationUrl(): string {
    if (!this.isConfigured()) {
      throw new Error('Zoho credentials not configured');
    }

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      scope: 'ZohoExpense.fullaccess.all',
      redirect_uri: this.redirectUri,
      access_type: 'offline',
      prompt: 'consent',
    });

    return `${this.authURL}/auth?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access tokens
   */
  async exchangeCodeForTokens(code: string): Promise<ZohoTokens> {
    if (!this.isConfigured()) {
      throw new Error('Zoho credentials not configured');
    }

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: this.redirectUri,
      code: code,
    });

    const response = await fetch(`${this.authURL}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    const data = await response.json();
    
    this.tokens = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + (data.expires_in * 1000),
    };

    // Save tokens to database
    await this.saveTokensToDatabase();

    return this.tokens;
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(): Promise<ZohoTokens> {
    if (!this.tokens?.refresh_token) {
      throw new Error('No refresh token available');
    }

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: this.tokens.refresh_token,
    });

    const response = await fetch(`${this.authURL}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token refresh failed: ${error}`);
    }

    const data = await response.json();
    
    this.tokens = {
      access_token: data.access_token,
      refresh_token: this.tokens.refresh_token, // Keep existing refresh token
      expires_at: Date.now() + (data.expires_in * 1000),
    };

    return this.tokens;
  }

  /**
   * Get valid access token, refreshing if necessary
   */
  private async getValidAccessToken(): Promise<string> {
    if (!this.tokens) {
      throw new Error('No tokens available. Please authorize first.');
    }

    // Check if token is expired (with 5 minute buffer)
    if (Date.now() >= (this.tokens.expires_at - 300000)) {
      await this.refreshAccessToken();
    }

    return this.tokens.access_token;
  }

  /**
   * Make authenticated API request to Zoho
   */
  private async makeZohoRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const accessToken = await this.getValidAccessToken();
    
    const headers = {
      'Authorization': `Zoho-oauthtoken ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const url = endpoint.startsWith('http') ? endpoint : `${this.baseURL}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Zoho API error: ${response.status} ${response.statusText} - ${error}`);
    }

    return response.json();
  }

  /**
   * Get available organizations
   */
  async getOrganizations(): Promise<ZohoOrganization[]> {
    try {
      const data = await this.makeZohoRequest('/organizations');
      return data.organizations || [];
    } catch (error) {
      console.error('Error fetching Zoho organizations:', error);
      throw error;
    }
  }

  /**
   * Set organization ID (auto-detect if not configured)
   */
  async setOrganizationId(orgId?: string): Promise<string> {
    if (orgId) {
      this.organizationId = orgId;
      return orgId;
    }

    if (this.organizationId) {
      return this.organizationId;
    }

    // Auto-detect organization
    const orgs = await this.getOrganizations();
    if (orgs.length === 0) {
      throw new Error('No Zoho organizations found');
    }

    // Use default organization or first one
    const defaultOrg = orgs.find(org => org.is_default_org) || orgs[0];
    this.organizationId = defaultOrg.organization_id;
    
    return this.organizationId;
  }

  /**
   * Generate project tag for Zoho Expense (using owner name and creation date)
   */
  generateProjectTag(ownerName: string, creationDate: Date): string {
    const dateStr = creationDate.toISOString().split('T')[0]; // YYYY-MM-DD format
    const cleanOwnerName = ownerName.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, ''); // Remove spaces and special chars
    return `${cleanOwnerName}_${dateStr}`;
  }

  /**
   * Fetch all expenses from Zoho
   */
  async getAllExpenses(): Promise<ProcessedExpense[]> {
    if (!this.isConfigured()) {
      throw new Error('Zoho Expense credentials not configured');
    }

    try {
      await this.setOrganizationId();
      
      // Get expenses with pagination
      const allExpenses: ProcessedExpense[] = [];
      let page = 1;
      const perPage = 200;
      let hasMore = true;

      while (hasMore) {
        const endpoint = `/expenses?organization_id=${this.organizationId}&page=${page}&per_page=${perPage}`;
        const data = await this.makeZohoRequest(endpoint);
        
        if (data.expenses && data.expenses.length > 0) {
          const processedExpenses = this.processExpenseData(data.expenses);
          allExpenses.push(...processedExpenses);
          
          // Check if there are more pages
          hasMore = data.expenses.length === perPage;
          page++;
        } else {
          hasMore = false;
        }
      }

      console.log(`[Zoho] Fetched ${allExpenses.length} expenses`);
      return allExpenses;
    } catch (error) {
      console.error('Error fetching Zoho expenses:', error);
      throw error;
    }
  }

  /**
   * Fetch expenses for a specific project
   */
  async getProjectExpenses(projectId: number, projectTag?: string): Promise<ProcessedExpense[]> {
    if (!this.isConfigured()) {
      throw new Error('Zoho Expense credentials not configured');
    }

    try {
      const allExpenses = await this.getAllExpenses();
      
      // Filter expenses by project
      return allExpenses.filter(expense => {
        // Match by project ID or project tag
        return expense.projectId === projectId || 
               (projectTag && expense.projectTag === projectTag);
      });
    } catch (error) {
      console.error('Error fetching project expenses from Zoho:', error);
      throw error;
    }
  }

  /**
   * Create/sync project in Zoho (create project for expense tracking)
   */
  async createProject(projectId: number, projectName: string, ownerName: string, creationDate: Date): Promise<{ success: boolean; tag: string }> {
    if (!this.isConfigured()) {
      throw new Error('Zoho Expense credentials not configured');
    }

    try {
      await this.setOrganizationId();
      
      // Generate project tag
      const projectTag = this.generateProjectTag(ownerName, creationDate);
      
      // Check if project already exists in Zoho
      const endpoint = `/projects?organization_id=${this.organizationId}`;
      const projectsData = await this.makeZohoRequest(endpoint);
      
      const existingProject = projectsData.projects?.find((p: any) => 
        p.project_name === projectTag || p.project_name === projectName
      );
      
      if (!existingProject) {
        // Create new project in Zoho
        const createEndpoint = `/projects?organization_id=${this.organizationId}`;
        const projectData = {
          project_name: projectTag,
          description: `Construction project: ${projectName} (Owner: ${ownerName})`,
          status: 'active',
        };
        
        await this.makeZohoRequest(createEndpoint, {
          method: 'POST',
          body: JSON.stringify(projectData),
        });
        
        console.log(`Created Zoho project: ${projectTag} for project ${projectId}`);
      }

      return { success: true, tag: projectTag };
    } catch (error) {
      console.error('Error creating Zoho project:', error);
      throw error;
    }
  }

  /**
   * Process expense data from Zoho API response
   */
  private processExpenseData(expenses: any[]): ProcessedExpense[] {
    return expenses.map(expense => {
      // Extract project ID from project name if it follows our tag format
      let projectId = 0;
      let projectTag = expense.project_name;
      
      // Try to match project tag format (OwnerName_YYYY-MM-DD)
      if (expense.project_name && expense.project_name.includes('_')) {
        projectTag = expense.project_name;
        // Project ID will be resolved by the controller using project mapping
      }

      return {
        id: expense.expense_id,
        projectId,
        amount: expense.amount || 0,
        category: expense.category_name || 'Uncategorized',
        description: expense.description || expense.merchant || 'No description',
        date: expense.date || expense.created_time,
        merchant: expense.merchant || 'Unknown',
        receipt: expense.receipt_name,
        status: this.mapZohoStatus(expense.status),
        projectTag,
      };
    });
  }

  /**
   * Map Zoho expense status to our status enum
   */
  private mapZohoStatus(zohoStatus: string): 'pending' | 'approved' | 'reimbursed' {
    switch (zohoStatus?.toLowerCase()) {
      case 'approved':
      case 'partially_approved':
        return 'approved';
      case 'reimbursed':
      case 'paid':
        return 'reimbursed';
      case 'rejected':
      case 'draft':
      case 'submitted':
      default:
        return 'pending';
    }
  }

  /**
   * Test connection to Zoho API
   */
  async testConnection(): Promise<{ connected: boolean; message: string }> {
    if (!this.isConfigured()) {
      return {
        connected: false,
        message: 'Zoho Expense credentials not configured. Please set ZOHO_CLIENT_ID and ZOHO_CLIENT_SECRET environment variables.',
      };
    }

    if (!this.tokens) {
      return {
        connected: false,
        message: 'Zoho Expense not authorized. Please complete OAuth authorization first.',
      };
    }

    try {
      const orgs = await this.getOrganizations();
      
      if (orgs.length === 0) {
        return {
          connected: false,
          message: 'No Zoho organizations found. Please check your account permissions.',
        };
      }

      return {
        connected: true,
        message: `Successfully connected to Zoho Expense. Found ${orgs.length} organization(s).`,
      };
    } catch (error) {
      return {
        connected: false,
        message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Set tokens (for loading from storage)
   */
  setTokens(tokens: ZohoTokens): void {
    this.tokens = tokens;
  }

  /**
   * Get current tokens (for saving to storage)
   */
  getTokens(): ZohoTokens | null {
    return this.tokens;
  }
}

// Export singleton instance
export const zohoExpenseService = new ZohoExpenseService();
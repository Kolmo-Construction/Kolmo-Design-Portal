import { Request, Response } from 'express';
import { zohoExpenseService, ProjectExpenseData, ProcessedExpense } from '../services/zoho-expense.service';
import { storage } from '../storage';

export class ZohoExpenseController {
  /**
   * Get OAuth authorization URL for Zoho setup
   */
  static async getAuthUrl(req: Request, res: Response) {
    try {
      if (!zohoExpenseService.isConfigured()) {
        return res.status(400).json({
          error: 'Zoho credentials not configured',
          message: 'Please set ZOHO_CLIENT_ID and ZOHO_CLIENT_SECRET environment variables',
        });
      }

      const authUrl = zohoExpenseService.getAuthorizationUrl();
      res.json({ authUrl });
    } catch (error) {
      console.error('Error generating Zoho auth URL:', error);
      res.status(500).json({
        error: 'Failed to generate authorization URL',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Handle OAuth callback from Zoho
   */
  static async handleCallback(req: Request, res: Response) {
    try {
      const { code } = req.query;
      
      console.log('[Zoho Callback] Received callback with code:', code);
      
      if (!code || typeof code !== 'string') {
        return res.status(400).json({ error: 'Authorization code not provided' });
      }

      console.log('[Zoho Callback] Attempting token exchange...');
      const tokens = await zohoExpenseService.exchangeCodeForTokens(code);
      
      console.log('[Zoho Callback] Token exchange successful');
      
      // Redirect to admin dashboard with success message
      res.redirect('/?zoho_connected=true');
    } catch (error) {
      console.error('Error handling Zoho callback:', error);
      
      // Redirect to admin dashboard with error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.redirect(`/?zoho_error=${encodeURIComponent(errorMessage)}`);
    }
  }

  /**
   * Test Zoho connection
   */
  static async testConnection(req: Request, res: Response) {
    try {
      const result = await zohoExpenseService.testConnection();
      res.json(result);
    } catch (error) {
      console.error('Error testing Zoho connection:', error);
      res.status(500).json({
        connected: false,
        message: 'Failed to test Zoho connection',
      });
    }
  }

  /**
   * Debug Zoho Expense integration with detailed diagnostics
   */
  static async debugZohoExpense(req: Request, res: Response) {
    console.log('=== ZOHO EXPENSE DEBUG START ===');
    
    try {
      const service = zohoExpenseService;
      
      // 1. Check basic configuration
      console.log('1. Configuration Check:');
      console.log('   - Service configured:', service.isConfigured());
      console.log('   - Client ID set:', !!process.env.ZOHO_CLIENT_ID);
      console.log('   - Client Secret set:', !!process.env.ZOHO_CLIENT_SECRET);
      console.log('   - Redirect URI:', process.env.ZOHO_REDIRECT_URI);
      
      // 2. Initialize and check tokens
      console.log('\n2. Token Check:');
      await service.initialize();
      const tokens = service.getTokens();
      console.log('   - Tokens available:', !!tokens);
      if (tokens) {
        console.log('   - Access token length:', tokens.access_token?.length);
        console.log('   - Token expires at:', new Date(tokens.expires_at));
        console.log('   - Token expired:', Date.now() >= tokens.expires_at);
      }
      
      // 3. Test organizations endpoint specifically
      console.log('\n3. Organizations API Test:');
      try {
        if (!tokens) {
          throw new Error('No tokens available - need to complete OAuth first');
        }
        
        const accessToken = await (service as any).getValidAccessToken();
        console.log('   - Valid access token obtained:', !!accessToken);
        
        // Test the exact organizations endpoint
        const orgUrl = 'https://www.zohoapis.com/expense/v1/organizations';
        console.log('   - Testing URL:', orgUrl);
        
        const orgResponse = await fetch(orgUrl, {
          headers: {
            'Authorization': `Zoho-oauthtoken ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });
        
        console.log('   - Organizations response status:', orgResponse.status);
        console.log('   - Organizations response headers:', Object.fromEntries(orgResponse.headers.entries()));
        
        if (!orgResponse.ok) {
          const errorText = await orgResponse.text();
          console.log('   - Organizations error response:', errorText);
          throw new Error(`Organizations API failed: ${orgResponse.status} - ${errorText}`);
        }
        
        const orgData = await orgResponse.json();
        console.log('   - Organizations data:', orgData);
        
        if (orgData.organizations && orgData.organizations.length > 0) {
          const firstOrg = orgData.organizations[0];
          console.log('   - First organization:', firstOrg);
          
          // 4. Test expenses endpoint with organization ID
          console.log('\n4. Expenses API Test:');
          const expenseUrl = 'https://www.zohoapis.com/expense/v1/expenses';
          console.log('   - Testing URL:', expenseUrl);
          console.log('   - Using org ID:', firstOrg.organization_id);
          
          const expenseResponse = await fetch(expenseUrl, {
            headers: {
              'Authorization': `Zoho-oauthtoken ${accessToken}`,
              'X-com-zoho-expense-organizationid': firstOrg.organization_id,
              'Content-Type': 'application/json',
            },
          });
          
          console.log('   - Expenses response status:', expenseResponse.status);
          console.log('   - Expenses response headers:', Object.fromEntries(expenseResponse.headers.entries()));
          
          if (!expenseResponse.ok) {
            const errorText = await expenseResponse.text();
            console.log('   - Expenses error response:', errorText);
            console.log('   - This might be normal if no expenses exist');
          } else {
            const expenseData = await expenseResponse.json();
            console.log('   - Expenses data structure:', Object.keys(expenseData));
            console.log('   - Expenses count:', expenseData.expenses?.length || 0);
          }
        } else {
          console.log('   - No organizations found in response');
        }
        
      } catch (apiError) {
        console.error('   - API Test Error:', apiError);
        throw apiError;
      }
      
      console.log('\n=== ZOHO EXPENSE DEBUG END ===');
      res.json({
        success: true,
        message: 'Debug completed successfully'
      });
      
    } catch (error) {
      console.error('=== ZOHO EXPENSE DEBUG ERROR ===');
      console.error('Error:', error);
      console.log('=== ZOHO EXPENSE DEBUG END ===');
      
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Debug failed - check console for details'
      });
    }
  }

  /**
   * Get budget tracking data for all projects
   */
  static async getBudgetTracking(req: Request, res: Response) {
    try {
      const projects = await storage.projects.getAllProjects();
      const budgetTrackingData: ProjectExpenseData[] = [];

      if (!zohoExpenseService.isConfigured()) {
        // Return projects with zero expenses if Zoho is not configured
        for (const project of projects) {
          budgetTrackingData.push({
            projectId: project.id,
            projectName: project.name,
            totalBudget: Number(project.totalBudget),
            totalExpenses: 0,
            remainingBudget: Number(project.totalBudget),
            budgetUtilization: 0,
            expenses: [],
          });
        }
      } else {
        // Initialize and fetch real expense data from Zoho
        await zohoExpenseService.initialize();
        const allExpenses = await zohoExpenseService.getAllExpenses();

        for (const project of projects) {
          // Generate the expected Zoho project tag for this project
          const expectedTag = zohoExpenseService.generateProjectTag(
            project.customerName || 'Unknown', 
            new Date(project.createdAt)
          );
          
          const projectExpenses: ProcessedExpense[] = allExpenses.filter(expense => {
            // Match expenses using project tag format
            return expense.projectTag === expectedTag || 
                   expense.projectId === project.id;
          });
          
          const totalExpenses = projectExpenses.reduce(
            (sum, expense) => sum + expense.amount, 
            0
          );
          
          const totalBudget = Number(project.totalBudget);
          const remainingBudget = totalBudget - totalExpenses;
          const budgetUtilization = totalBudget > 0 ? (totalExpenses / totalBudget) * 100 : 0;

          budgetTrackingData.push({
            projectId: project.id,
            projectName: project.name,
            totalBudget,
            totalExpenses,
            remainingBudget,
            budgetUtilization,
            expenses: projectExpenses,
          });
        }
      }

      res.json(budgetTrackingData);
    } catch (error) {
      console.error('Error fetching budget tracking data:', error);
      res.status(500).json({
        error: 'Failed to fetch budget tracking data',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get budget tracking data for a specific project
   */
  static async getProjectBudgetTracking(req: Request, res: Response) {
    try {
      const projectId = parseInt(req.params.projectId);
      
      if (isNaN(projectId)) {
        return res.status(400).json({ error: 'Invalid project ID' });
      }

      const project = await storage.projects.getProjectById(projectId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      let projectExpenses: ProcessedExpense[] = [];
      if (zohoExpenseService.isConfigured()) {
        await zohoExpenseService.initialize();
        const expectedTag = zohoExpenseService.generateProjectTag(
          project.customerName || 'Unknown', 
          new Date(project.createdAt)
        );
        
        projectExpenses = await zohoExpenseService.getProjectExpenses(projectId, expectedTag);
      }

      const totalExpenses = projectExpenses.reduce(
        (sum, expense) => sum + expense.amount, 
        0
      );
      
      const totalBudget = Number(project.totalBudget);
      const remainingBudget = totalBudget - totalExpenses;
      const budgetUtilization = totalBudget > 0 ? (totalExpenses / totalBudget) * 100 : 0;

      const budgetTrackingData: ProjectExpenseData = {
        projectId: project.id,
        projectName: project.name,
        totalBudget,
        totalExpenses,
        remainingBudget,
        budgetUtilization,
        expenses: projectExpenses,
      };

      res.json(budgetTrackingData);
    } catch (error) {
      console.error('Error fetching project budget tracking data:', error);
      res.status(500).json({
        error: 'Failed to fetch project budget tracking data',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Sync project to Zoho (create project for expense tracking)
   */
  static async syncProject(req: Request, res: Response) {
    try {
      const projectId = parseInt(req.params.projectId);
      
      if (isNaN(projectId)) {
        return res.status(400).json({ error: 'Invalid project ID' });
      }

      const project = await storage.projects.getProjectById(projectId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      if (!zohoExpenseService.isConfigured()) {
        return res.status(400).json({
          error: 'Zoho Expense not configured',
          message: 'Please configure Zoho API credentials and complete authorization',
        });
      }

      // Check if custom owner name and date are provided in request body
      const { customerName, creationDate } = req.body || {};
      
      // Use provided values or fall back to project defaults
      const ownerName = customerName || project.customerName || 'Unknown Owner';
      const tagDate = creationDate ? new Date(creationDate) : project.createdAt;

      const result = await zohoExpenseService.createProject(projectId, project.name, ownerName, tagDate);
      
      if (result.success) {
        res.json({
          success: true,
          message: `Project ${project.name} is ready for Zoho expense tracking with tag: ${result.tag}`,
          projectId,
          zohoTag: result.tag,
          ownerName,
          creationDate: tagDate.toISOString().split('T')[0],
        });
      } else {
        res.status(500).json({
          error: 'Failed to sync project to Zoho',
        });
      }
    } catch (error) {
      console.error('Error syncing project to Zoho:', error);
      res.status(500).json({
        error: 'Failed to sync project to Zoho',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get Zoho configuration status
   */
  static async getConfigurationStatus(req: Request, res: Response) {
    try {
      const isConfigured = zohoExpenseService.isConfigured();
      
      if (isConfigured) {
        const connectionTest = await zohoExpenseService.testConnection();
        res.json({
          configured: true,
          connected: connectionTest.connected,
          message: connectionTest.message,
        });
      } else {
        res.json({
          configured: false,
          connected: false,
          message: 'Zoho Expense credentials not configured. Please set ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, and ZOHO_ORGANIZATION_ID environment variables.',
        });
      }
    } catch (error) {
      console.error('Error checking Zoho configuration:', error);
      res.status(500).json({
        configured: false,
        connected: false,
        message: 'Failed to check Zoho configuration',
      });
    }
  }

  /**
   * Force refresh expense data from Zoho
   */
  static async refreshExpenses(req: Request, res: Response) {
    try {
      if (!zohoExpenseService.isConfigured()) {
        return res.status(400).json({
          error: 'Zoho not configured',
          message: 'Please configure Zoho API credentials and complete authorization',
        });
      }

      // Fetch fresh data from Zoho
      const allExpenses = await zohoExpenseService.getAllExpenses();
      
      res.json({
        success: true,
        message: `Refreshed ${allExpenses.length} expenses from Zoho`,
        expenseCount: allExpenses.length,
        lastRefresh: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error refreshing expenses from Zoho:', error);
      res.status(500).json({
        error: 'Failed to refresh expenses from Zoho',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get available Zoho organizations
   */
  static async getOrganizations(req: Request, res: Response) {
    try {
      const organizations = await zohoExpenseService.getOrganizations();
      res.json({ organizations });
    } catch (error) {
      console.error('Error fetching Zoho organizations:', error);
      res.status(500).json({
        error: 'Failed to fetch organizations',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
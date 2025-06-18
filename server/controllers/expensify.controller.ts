import { Request, Response } from 'express';
import { expensifyService, ProjectExpenseData, ProcessedExpense } from '../services/expensify.service';
import { storage } from '../storage';

export class ExpensifyController {
  /**
   * Test Expensify connection
   */
  static async testConnection(req: Request, res: Response) {
    try {
      const result = await expensifyService.testConnection();
      res.json(result);
    } catch (error) {
      console.error('Error testing Expensify connection:', error);
      res.status(500).json({
        connected: false,
        message: 'Failed to test Expensify connection',
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

      if (!expensifyService.isConfigured()) {
        // Return projects with zero expenses if Expensify is not configured
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
        // Fetch real expense data from Expensify
        const allExpenses = await expensifyService.getAllExpenses();

        for (const project of projects) {
          const projectExpenses: ProcessedExpense[] = allExpenses.filter(
            expense => expense.projectId === project.id
          );
          
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
      if (expensifyService.isConfigured()) {
        projectExpenses = await expensifyService.getProjectExpenses(projectId);
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
   * Sync project to Expensify (create tag for expense tracking)
   */
  static async syncProject(req: Request, res: Response) {
    try {
      const projectId = parseInt(req.params.projectId);
      
      if (isNaN(projectId)) {
        return res.status(400).json({ error: 'Invalid project ID' });
      }

      const project = await getProjectById(projectId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      if (!expensifyService.isConfigured()) {
        return res.status(400).json({
          error: 'Expensify not configured',
          message: 'Please configure Expensify API credentials',
        });
      }

      const success = await expensifyService.createProject(projectId, project.name);
      
      if (success) {
        res.json({
          success: true,
          message: `Project ${project.name} is ready for Expensify expense tracking`,
          projectId,
        });
      } else {
        res.status(500).json({
          error: 'Failed to sync project to Expensify',
        });
      }
    } catch (error) {
      console.error('Error syncing project to Expensify:', error);
      res.status(500).json({
        error: 'Failed to sync project to Expensify',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get Expensify configuration status
   */
  static async getConfigurationStatus(req: Request, res: Response) {
    try {
      const isConfigured = expensifyService.isConfigured();
      
      if (isConfigured) {
        const connectionTest = await expensifyService.testConnection();
        res.json({
          configured: true,
          connected: connectionTest.connected,
          message: connectionTest.message,
        });
      } else {
        res.json({
          configured: false,
          connected: false,
          message: 'Expensify API credentials not configured. Please set EXPENSIFY_API_KEY, EXPENSIFY_USER_ID, and EXPENSIFY_USER_SECRET environment variables.',
        });
      }
    } catch (error) {
      console.error('Error checking Expensify configuration:', error);
      res.status(500).json({
        configured: false,
        connected: false,
        message: 'Failed to check Expensify configuration',
      });
    }
  }

  /**
   * Force refresh expense data from Expensify
   */
  static async refreshExpenses(req: Request, res: Response) {
    try {
      if (!expensifyService.isConfigured()) {
        return res.status(400).json({
          error: 'Expensify not configured',
          message: 'Please configure Expensify API credentials',
        });
      }

      // Fetch fresh data from Expensify
      const allExpenses = await expensifyService.getAllExpenses();
      
      res.json({
        success: true,
        message: `Refreshed ${allExpenses.length} expenses from Expensify`,
        expenseCount: allExpenses.length,
        lastRefresh: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error refreshing expenses from Expensify:', error);
      res.status(500).json({
        error: 'Failed to refresh expenses from Expensify',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
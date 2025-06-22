import { Router } from 'express';
import { ZohoExpenseController } from '../controllers/zoho-expense.controller';
import { isAuthenticated } from '../middleware/auth.middleware';

const router = Router();

// OAuth routes for Zoho setup
router.get('/auth/url', isAuthenticated, ZohoExpenseController.getAuthUrl);
router.get('/auth/callback', ZohoExpenseController.handleCallback);

// Configuration and testing routes
router.get('/status', isAuthenticated, ZohoExpenseController.getConfigurationStatus);
router.get('/test', isAuthenticated, ZohoExpenseController.testConnection);
router.get('/debug', isAuthenticated, ZohoExpenseController.debugZohoExpense);
router.get('/organizations', isAuthenticated, ZohoExpenseController.getOrganizations);

// Budget tracking routes
router.get('/budget-tracking', isAuthenticated, ZohoExpenseController.getBudgetTracking);
router.get('/budget-tracking/:projectId', isAuthenticated, ZohoExpenseController.getProjectBudgetTracking);

// Project management routes
router.post('/projects/:projectId/sync', isAuthenticated, ZohoExpenseController.syncProject);
router.post('/expenses/refresh', isAuthenticated, ZohoExpenseController.refreshExpenses);

export default router;
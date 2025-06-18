import { Router } from 'express';
import { ExpensifyController } from '../controllers/expensify.controller';
import { isAuthenticated, isAdmin } from '../middleware/auth.middleware';

const router = Router();

// Test Expensify connection
router.get('/test', isAuthenticated, ExpensifyController.testConnection);

// Get configuration status
router.get('/config', isAuthenticated, ExpensifyController.getConfigurationStatus);

// Get budget tracking data for all projects
router.get('/budget-tracking', isAuthenticated, ExpensifyController.getBudgetTracking);

// Get budget tracking data for a specific project
router.get('/budget-tracking/:projectId', isAuthenticated, ExpensifyController.getProjectBudgetTracking);

// Sync project to Expensify
router.post('/sync/:projectId', isAuthenticated, isAdmin, ExpensifyController.syncProject);

// Force refresh expenses from Expensify
router.post('/refresh', isAuthenticated, isAdmin, ExpensifyController.refreshExpenses);

export default router;
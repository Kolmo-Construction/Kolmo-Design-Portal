// server/routes/billing-validation.routes.ts
import { Router } from "express";
import { isAuthenticated } from "@server/middleware/auth.middleware";
import { BillingValidator } from "../utils/billing-validation";
import { HttpError } from "../errors";

const router = Router({ mergeParams: true });

// GET /api/projects/:projectId/billing-validation - Get billing validation totals
router.get('/', isAuthenticated, async (req, res, next) => {
  try {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) {
      throw new HttpError(400, 'Invalid project ID');
    }

    const excludeTaskId = req.query.excludeTaskId ? parseInt(req.query.excludeTaskId as string) : undefined;
    const excludeMilestoneId = req.query.excludeMilestoneId ? parseInt(req.query.excludeMilestoneId as string) : undefined;

    const billingTotals = await BillingValidator.calculateTotalBillingPercentage(
      projectId,
      excludeTaskId,
      excludeMilestoneId
    );

    res.json(billingTotals);
  } catch (error) {
    next(error);
  }
});

// POST /api/projects/:projectId/billing-validation/validate-task - Validate task billing percentage
router.post('/validate-task', isAuthenticated, async (req, res, next) => {
  try {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) {
      throw new HttpError(400, 'Invalid project ID');
    }

    const { billingPercentage, excludeTaskId } = req.body;
    
    if (!billingPercentage || billingPercentage <= 0) {
      return res.json({ isValid: true, currentTotal: 0, remainingPercentage: 100 });
    }

    const validation = await BillingValidator.validateTaskBillingPercentage(
      projectId,
      parseFloat(billingPercentage.toString()),
      excludeTaskId
    );

    res.json(validation);
  } catch (error) {
    next(error);
  }
});

// POST /api/projects/:projectId/billing-validation/validate-milestone - Validate milestone billing percentage
router.post('/validate-milestone', isAuthenticated, async (req, res, next) => {
  try {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) {
      throw new HttpError(400, 'Invalid project ID');
    }

    const { billingPercentage, excludeMilestoneId } = req.body;
    
    if (!billingPercentage || billingPercentage <= 0) {
      return res.json({ isValid: true, currentTotal: 0, remainingPercentage: 100 });
    }

    const validation = await BillingValidator.validateMilestoneBillingPercentage(
      projectId,
      parseFloat(billingPercentage.toString()),
      excludeMilestoneId
    );

    res.json(validation);
  } catch (error) {
    next(error);
  }
});

export default router;
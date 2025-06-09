import { Router } from 'express';
import { storage } from '../storage';
import { insertMilestoneSchema, updateMilestoneSchema } from '@shared/schema';
import { HttpError } from '../errors';
import { isAuthenticated } from '../middleware/auth.middleware';
import { PaymentService } from '../services/payment.service';

const router = Router({ mergeParams: true });
const paymentService = new PaymentService();

// Get milestones for a project
router.get('/', async (req, res, next) => {
  try {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) {
      throw new HttpError(400, 'Invalid project ID');
    }

    // Verify project exists and user has access
    const project = await storage.projects.getProjectById(projectId);
    if (!project) {
      throw new HttpError(404, 'Project not found');
    }

    const milestones = await storage.milestones.getMilestonesByProjectId(projectId);
    res.json(milestones);
  } catch (error) {
    next(error);
  }
});

// Create a new milestone
router.post('/', async (req, res, next) => {
  try {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) {
      throw new HttpError(400, 'Invalid project ID');
    }

    // Verify project exists
    const project = await storage.projects.getProjectById(projectId);
    if (!project) {
      throw new HttpError(404, 'Project not found');
    }

    // Validate milestone data
    const validatedData = insertMilestoneSchema.parse({
      ...req.body,
      projectId,
    });

    // Set order index if not provided
    if (validatedData.orderIndex === undefined || validatedData.orderIndex === null) {
      const existingMilestones = await storage.milestones.getMilestonesByProjectId(projectId);
      validatedData.orderIndex = existingMilestones.length;
    }

    const milestone = await storage.milestones.createMilestone(validatedData);
    res.status(201).json(milestone);
  } catch (error) {
    next(error);
  }
});

// Update milestone
router.patch('/:milestoneId', async (req, res, next) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const milestoneId = parseInt(req.params.milestoneId);
    
    if (isNaN(projectId) || isNaN(milestoneId)) {
      throw new HttpError(400, 'Invalid project ID or milestone ID');
    }

    // Verify milestone exists and belongs to project
    const milestone = await storage.milestones.getMilestoneById(milestoneId);
    if (!milestone || milestone.projectId !== projectId) {
      throw new HttpError(404, 'Milestone not found');
    }

    // Validate the update data
    const validatedData = updateMilestoneSchema.parse(req.body);
    const updatedMilestone = await storage.milestones.updateMilestone(milestoneId, validatedData);
    res.json(updatedMilestone);
  } catch (error) {
    next(error);
  }
});

// Complete milestone
router.patch('/:milestoneId/complete', async (req, res, next) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const milestoneId = parseInt(req.params.milestoneId);
    
    if (isNaN(projectId) || isNaN(milestoneId)) {
      throw new HttpError(400, 'Invalid project ID or milestone ID');
    }

    // Verify milestone exists and belongs to project
    const milestone = await storage.milestones.getMilestoneById(milestoneId);
    if (!milestone || milestone.projectId !== projectId) {
      throw new HttpError(404, 'Milestone not found');
    }

    if (milestone.status === 'completed') {
      throw new HttpError(400, 'Milestone is already completed');
    }

    // Update milestone as completed using proper schema
    const completionData = updateMilestoneSchema.parse({
      status: 'completed',
      completedAt: new Date(),
      completedById: req.user!.id,
      actualDate: new Date(),
    });
    const updatedMilestone = await storage.milestones.updateMilestone(milestoneId, completionData);

    res.json(updatedMilestone);
  } catch (error) {
    next(error);
  }
});

// Trigger billing for a completed milestone
router.post('/:milestoneId/bill', async (req, res, next) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const milestoneId = parseInt(req.params.milestoneId);
    
    if (isNaN(projectId) || isNaN(milestoneId)) {
      throw new HttpError(400, 'Invalid project ID or milestone ID');
    }

    // Verify milestone exists and belongs to project
    const milestone = await storage.milestones.getMilestoneById(milestoneId);
    if (!milestone || milestone.projectId !== projectId) {
      throw new HttpError(404, 'Milestone not found');
    }

    if (!milestone.isBillable) {
      throw new HttpError(400, 'Milestone is not billable');
    }

    if (milestone.status !== 'completed') {
      throw new HttpError(400, 'Milestone must be completed before billing');
    }

    if (milestone.billedAt) {
      throw new HttpError(400, 'Milestone has already been billed');
    }

    // Get project details
    const project = await storage.projects.getProjectById(projectId);
    if (!project) {
      throw new HttpError(404, 'Project not found');
    }

    // Create milestone-based invoice
    const invoice = await paymentService.createMilestoneBasedPayment(
      projectId, 
      milestoneId, 
      milestone.title
    );

    // Update milestone as billed using proper schema
    const billingData = updateMilestoneSchema.parse({
      billedAt: new Date(),
      invoiceId: invoice.id,
    });
    await storage.milestones.updateMilestone(milestoneId, billingData);

    res.json({
      message: 'Milestone billing triggered successfully',
      invoice,
      milestone: await storage.milestones.getMilestoneById(milestoneId),
    });
  } catch (error) {
    next(error);
  }
});

// Delete milestone
router.delete('/api/projects/:projectId/milestones/:milestoneId', isAuthenticated, async (req, res, next) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const milestoneId = parseInt(req.params.milestoneId);
    
    if (isNaN(projectId) || isNaN(milestoneId)) {
      throw new HttpError(400, 'Invalid project ID or milestone ID');
    }

    // Verify milestone exists and belongs to project
    const milestone = await storage.milestones.getMilestoneById(milestoneId);
    if (!milestone || milestone.projectId !== projectId) {
      throw new HttpError(404, 'Milestone not found');
    }

    // Don't allow deletion of completed or billed milestones
    if (milestone.status === 'completed' || milestone.billedAt) {
      throw new HttpError(400, 'Cannot delete completed or billed milestones');
    }

    await storage.milestones.deleteMilestone(milestoneId);
    res.json({ message: 'Milestone deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export { router as milestoneRoutes };
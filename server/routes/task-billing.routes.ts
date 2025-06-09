import { Router } from 'express';
import { storage } from '../storage';
import { insertMilestoneSchema, updateTaskSchema, updateMilestoneSchema } from '@shared/schema';
import { HttpError } from '../errors';
import { isAuthenticated } from '../middleware/auth.middleware';
import { PaymentService } from '../services/payment.service';

const router = Router();
const paymentService = new PaymentService();

// Convert billable task to milestone and trigger billing
router.post('/api/projects/:projectId/tasks/:taskId/convert-to-milestone', isAuthenticated, async (req, res, next) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const taskId = parseInt(req.params.taskId);
    
    if (isNaN(projectId) || isNaN(taskId)) {
      throw new HttpError(400, 'Invalid project ID or task ID');
    }

    // Verify task exists and is billable
    const task = await storage.tasks.getTaskById(taskId);
    if (!task || task.projectId !== projectId) {
      throw new HttpError(404, 'Task not found');
    }

    if (!task.isBillable) {
      throw new HttpError(400, 'Only billable tasks can be converted to milestones');
    }

    if (task.status === 'completed') {
      throw new HttpError(400, 'Cannot convert completed task to milestone');
    }

    // Create milestone from task data
    const milestoneData = insertMilestoneSchema.parse({
      projectId: task.projectId,
      title: `Task Milestone: ${task.title}`,
      description: task.description || `Converted from billable task: ${task.title}`,
      plannedDate: task.dueDate || new Date(),
      category: 'task_conversion',
      status: 'pending',
      isBillable: true,
      billingPercentage: task.billingPercentage || 10, // Default 10% if not specified
      taskId: task.id, // Link back to original task
    });

    const milestone = await storage.milestones.createMilestone(milestoneData);

    // Update task to mark it as converted using proper schema
    const taskUpdateData = updateTaskSchema.parse({
      milestoneId: milestone.id,
      notes: (task.notes || '') + `\n[System] Converted to milestone ${milestone.id} for billing purposes.`
    });
    await storage.tasks.updateTask(taskId, taskUpdateData);

    res.json({
      message: 'Task successfully converted to billable milestone',
      milestone,
      task: await storage.tasks.getTaskById(taskId),
    });
  } catch (error) {
    next(error);
  }
});

// Complete task and automatically bill if it's linked to a milestone
router.patch('/api/projects/:projectId/tasks/:taskId/complete-and-bill', isAuthenticated, async (req, res, next) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const taskId = parseInt(req.params.taskId);
    
    if (isNaN(projectId) || isNaN(taskId)) {
      throw new HttpError(400, 'Invalid project ID or task ID');
    }

    // Verify task exists
    const task = await storage.tasks.getTaskById(taskId);
    if (!task || task.projectId !== projectId) {
      throw new HttpError(404, 'Task not found');
    }

    if (task.status === 'completed') {
      throw new HttpError(400, 'Task is already completed');
    }

    // Complete the task using proper schema validation
    const taskCompletionData = updateTaskSchema.parse({
      status: 'completed',
      completedAt: new Date(),
      actualHours: req.body.actualHours || task.actualHours,
    });
    const completedTask = await storage.tasks.updateTask(taskId, taskCompletionData);

    let invoice = null;
    let milestone = null;

    // If task is linked to a milestone, complete and bill the milestone
    if (task.milestoneId) {
      milestone = await storage.milestones.getMilestoneById(task.milestoneId);
      if (milestone && milestone.status !== 'completed') {
        // Complete the milestone using proper schema validation
        const milestoneUpdateData = updateMilestoneSchema.parse({
          status: 'completed',
          completedAt: new Date(),
          completedById: req.user!.id,
          actualDate: new Date(),
        });
        await storage.milestones.updateMilestone(milestone.id, milestoneUpdateData);

        // Generate invoice if milestone is billable
        if (milestone.isBillable) {
          invoice = await paymentService.createMilestoneBasedPayment(
            projectId,
            milestone.id,
            milestone.title
          );

          // Update milestone with billing information using proper schema validation
          const milestoneUpdateBillingData = updateMilestoneSchema.parse({
            billedAt: new Date(),
            invoiceId: invoice.id,
          });
          await storage.milestones.updateMilestone(milestone.id, milestoneUpdateBillingData);
        }
      }
    }

    res.json({
      message: 'Task completed successfully' + (invoice ? ' and invoice generated' : ''),
      task: completedTask,
      milestone,
      invoice,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
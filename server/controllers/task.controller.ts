// server/controllers/task.controller.ts
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { storage } from '../storage/index';
import { TaskWithAssignee } from '../storage/types';
import {
  // Import schema types from the shared location
  insertTaskSchema,
  insertTaskDependencySchema,
  User, // Keep User type for req.user casting
  InsertTask, // Type for creating tasks
  TaskDependency // Type for dependency data
} from '@shared/schema'; // Use alias

// Define custom enums since they don't exist in schema
const taskStatusEnum = z.enum(['todo', 'in_progress', 'blocked', 'done', 'cancelled']);
const taskPriorityEnum = z.enum(['low', 'medium', 'high']);
import { HttpError } from '../errors';
import { log as logger } from '@server/vite'; // Use logger from vite.ts

// --- Zod Schemas ---
// Schema for creating tasks (omitting server-set fields)
const taskCreateSchema = insertTaskSchema.omit({
  id: true,
  projectId: true, // Will be added from route params
  createdAt: true,
  updatedAt: true,
  // Removed createdBy and displayOrder as they don't exist in schema
});

// Schema for updating tasks (making fields optional)
const taskUpdateSchema = taskCreateSchema.partial().extend({
    status: taskStatusEnum.optional(), // Allow updating status with enum validation
    // No displayOrder field
});

// Schema for validating task dependency request bodies (both create and delete)
const taskDependencySchema = z.object({
    predecessorId: z.number().int().positive("Predecessor ID must be a positive integer."),
    successorId: z.number().int().positive("Successor ID must be a positive integer."),
});

// Define AuthenticatedRequest locally if not exported globally or from auth middleware
interface AuthenticatedRequest extends Request {
    user: User; // Use the imported User type
}


// --- Controller Functions ---

/**
 * Get all tasks for a specific project.
 * Assumes projectId is validated by middleware.
 */
export const getProjectTasks = async (
  req: Request, // Use base Request type, projectId checked by middleware
  res: Response,
  next: NextFunction
): Promise<void> => {
  logger(`[getProjectTasks] Handler reached for projectId: ${req.params.projectId}`, 'TaskController');
  try {
    // Assuming validateProjectId middleware adds projectIdNum to req
    // If not, parse it here: const projectIdNum = parseInt(req.params.projectId, 10);
    const projectIdNum = (req as any).projectIdNum;
    if (isNaN(projectIdNum)) {
         // This check might be redundant if validateProjectId is guaranteed to run first
         throw new HttpError(400, 'Invalid project ID parameter.');
    }

    logger(`[getProjectTasks] Calling repository for projectId: ${projectIdNum}`, 'TaskController');
    const tasks: TaskWithAssignee[] = await storage.tasks.getTasksForProject(projectIdNum);
    logger(`[getProjectTasks] Received ${tasks.length} tasks from repository.`, 'TaskController');

    res.status(200).json(tasks);
  } catch (error) {
    logger(`[getProjectTasks] Error occurred: ${error instanceof Error ? error.message : String(error)}`, 'TaskController');
    next(error); // Pass error to central handler
  }
};

/**
 * Get all task dependencies for a specific project.
 * Assumes projectId is validated by middleware.
 */
export const getTaskDependencies = async (
    req: Request, // projectId is validated by middleware
    res: Response,
    next: NextFunction
): Promise<void> => {
    logger(`[getTaskDependencies] Handler reached for projectId: ${req.params.projectId}`, 'TaskController');
    try {
        // Assuming validateProjectId middleware adds projectIdNum to req
        const projectIdNum = (req as any).projectIdNum;
        if (isNaN(projectIdNum)) {
             // This check might be redundant if validateProjectId is guaranteed to run first
             throw new HttpError(400, 'Invalid project ID parameter.');
        }

        logger(`[getTaskDependencies] Calling repository for projectId: ${projectIdNum}`, 'TaskController');
        const dependencies: TaskDependency[] = await storage.tasks.getDependenciesForProject(projectIdNum);
        logger(`[getTaskDependencies] Repository returned ${dependencies.length} dependencies.`, 'TaskController');

        res.status(200).json(dependencies);
    } catch (error) {
        logger(`[getTaskDependencies] Error occurred: ${error instanceof Error ? error.message : String(error)}`, 'TaskController');
        next(error); // Pass error to central handler
    }
};


/**
 * Create a new task within a project.
 * Assumes projectId is validated by middleware and user is authenticated.
 */
export const createTask = async (
  req: AuthenticatedRequest, // Expect authenticated request
  res: Response,
  next: NextFunction
): Promise<void> => {
   logger(`[createTask] Handler reached for projectId: ${req.params.projectId}`, 'TaskController');
  try {
    // Assuming validateProjectId middleware adds projectIdNum to req
    const projectIdNum = (req as any).projectIdNum;
    const user = req.user; // User from AuthenticatedRequest

    if (isNaN(projectIdNum)) {
        throw new HttpError(400, 'Invalid project ID parameter.');
    }
    // User presence is implied by AuthenticatedRequest type/middleware

    // Validate the request body
    const validationResult = taskCreateSchema.safeParse(req.body);
    if (!validationResult.success) {
      throw new HttpError(400, 'Invalid task data.', validationResult.error.flatten());
    }
    const validatedData = validationResult.data;

    // Prepare data for repository, ensuring Date objects if needed
    const newTaskData: InsertTask = {
        ...validatedData,
        projectId: projectIdNum,
        // Transform date strings to Date objects if they exist and are valid
        dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : null,
        startDate: validatedData.startDate ? new Date(validatedData.startDate) : null,
        // createdById is not in the tasks schema
    };

    logger(`[createTask] Calling repository with data for projectId ${projectIdNum}`, 'TaskController');
    const createdTask = await storage.tasks.createTask(newTaskData);
    logger(`[createTask] Repository returned task: ${createdTask?.id}`, 'TaskController');

    if (!createdTask) {
         // The repository should ideally throw an error if creation fails
         throw new HttpError(500, 'Failed to create task in repository.');
    }

    // Return the newly created task (repository should return TaskWithAssignee)
    res.status(201).json(createdTask);
  } catch (error) {
     logger(`[createTask] Error occurred: ${error instanceof Error ? error.message : String(error)}`, 'TaskController');
    next(error); // Pass error (including HttpError) to central handler
  }
};

/**
 * Update an existing task.
 * Assumes taskId is validated by middleware. ProjectId might be needed for auth checks.
 */
export const updateTask = async (
  req: Request, // Use base Request, check params/middleware attachment below
  res: Response,
  next: NextFunction
): Promise<void> => {
  logger(`[updateTask] Handler reached for taskId: ${req.params.taskId}`, 'TaskController');
  try {
    // Assuming validateResourceId('taskId') middleware adds taskIdNum
    const taskIdNum = (req as any).taskIdNum;
    // Assuming validateProjectId middleware adds projectIdNum (useful for auth)
    // const projectIdNum = (req as any).projectIdNum;

    if (isNaN(taskIdNum)) { throw new HttpError(400, 'Invalid task ID parameter.'); }
    // if (isNaN(projectIdNum)) { throw new HttpError(400, 'Invalid project ID parameter.'); }

    // TODO: Add authorization check: Does the authenticated user have permission to update tasks in this project?

    // Validate the request body
    const validationResult = taskUpdateSchema.safeParse(req.body);
    if (!validationResult.success) {
      throw new HttpError(400, 'Invalid task update data.', validationResult.error.flatten());
    }
    const validatedData = validationResult.data;

    // Prevent updates with no actual changes
    if (Object.keys(validatedData).length === 0) {
         throw new HttpError(400, 'No update data provided.');
    }

     // Prepare update data, transforming dates
     // Type matches repository expectation: Partial<Omit<InsertTask, 'id' | 'projectId' | 'createdAt'>>
     const updateData: Partial<Omit<InsertTask, 'id' | 'projectId' | 'createdAt'>> = {
        ...validatedData,
        // Transform date strings to Date objects if they exist and are valid
        ...(validatedData.dueDate && { dueDate: new Date(validatedData.dueDate) }),
        ...(validatedData.startDate && { startDate: new Date(validatedData.startDate) }),
        // Add completedAt timestamp if status is set to 'done'
        // ...(validatedData.status === 'done' && { completedAt: new Date() /* Assuming completedAt is not in schema */ })
     };
     // Remove fields that shouldn't be updated directly if necessary (though types help)
     // delete updateData.projectId; // Cannot change project
     // delete updateData.id;
     // delete updateData.createdAt;

    // Get the current task before update to check if it's billable and being completed
    const currentTask = await storage.tasks.getTaskById(taskIdNum);
    if (!currentTask) {
        throw new HttpError(404, 'Task not found.');
    }

    logger(`[updateTask] Calling repository to update taskId: ${taskIdNum}`, 'TaskController');
    const updatedTask = await storage.tasks.updateTask(taskIdNum, updateData);
    logger(`[updateTask] Repository returned task: ${updatedTask?.id}`, 'TaskController');

    if (!updatedTask) {
        // Repository returns null if task not found
        throw new HttpError(404, 'Task not found or update failed.');
    }

    // Check if this is a billable task being completed
    const isBeingCompleted = validatedData.status === 'done' && currentTask.status !== 'done';
    const isBillableTask = currentTask.isBillable;
    
    if (isBeingCompleted && isBillableTask) {
        logger(`[updateTask] Billable task ${taskIdNum} completed, triggering billing process`, 'TaskController');
        
        try {
            // Import PaymentService and trigger billing
            const { PaymentService } = await import('@server/services/payment.service');
            const paymentService = new PaymentService();
            
            // Use the complete-and-bill logic
            let invoice = null;
            let milestone = null;

            // If task is linked to a milestone, complete and bill the milestone
            if (currentTask.milestoneId) {
                milestone = await storage.milestones.getMilestoneById(currentTask.milestoneId);
                if (milestone && milestone.status !== 'completed') {
                    // Complete the milestone
                    await storage.milestones.updateMilestone(milestone.id, {
                        status: 'completed',
                        completedAt: new Date(),
                        completedById: (req as any).user?.id,
                        actualDate: new Date(),
                    });

                    // Generate DRAFT invoice if milestone is billable
                    if (milestone.isBillable) {
                        logger(`[updateTask] Milestone ${milestone.id} is billable, creating draft invoice`, 'TaskController');
                        invoice = await paymentService.createDraftInvoiceForMilestone(
                            currentTask.projectId,
                            milestone.id
                        );
                    }
                }
            } else {
                // Task doesn't have a milestone yet, create one for billing
                logger(`[updateTask] Creating milestone for billable task ${taskIdNum}`, 'TaskController');
                
                const milestoneData = {
                    projectId: currentTask.projectId,
                    title: `Task Milestone: ${currentTask.title}`,
                    description: currentTask.description || `Converted from billable task: ${currentTask.title}`,
                    plannedDate: currentTask.dueDate || new Date(),
                    category: 'task_conversion' as const,
                    status: 'completed' as const,
                    isBillable: true,
                    billingPercentage: currentTask.billingPercentage || 10,
                    taskId: currentTask.id,
                    completedAt: new Date(),
                    completedById: (req as any).user?.id,
                    actualDate: new Date(),
                };

                milestone = await storage.milestones.createMilestone(milestoneData);
                
                // Update task to link to the new milestone
                await storage.tasks.updateTask(taskIdNum, {
                    milestoneId: milestone.id,
                    notes: (currentTask.notes || '') + `\n[System] Converted to milestone ${milestone.id} for billing purposes.`
                });

                // Generate DRAFT invoice for the new milestone
                invoice = await paymentService.createDraftInvoiceForMilestone(
                    currentTask.projectId,
                    milestone.id
                );
            }
            
            if (invoice) {
                logger(`[updateTask] Invoice ${invoice.invoiceNumber} created for billable task completion`, 'TaskController');
            }
            
        } catch (billingError) {
            // Log billing error but don't fail the task update
            logger(`[updateTask] Error in billing process: ${billingError instanceof Error ? billingError.message : String(billingError)}`, 'TaskController');
            console.error('Billing error for completed task:', billingError);
        }
    }

    // Return the updated task (repository should return TaskWithAssignee)
    res.status(200).json(updatedTask);
  } catch (error) {
     logger(`[updateTask] Error occurred: ${error instanceof Error ? error.message : String(error)}`, 'TaskController');
    next(error); // Pass error (including HttpError) to central handler
  }
};

/**
 * Delete a task.
 * Assumes taskId is validated by middleware. ProjectId might be needed for auth checks.
 */
export const deleteTask = async (
  req: Request, // Use base Request, check params/middleware attachment below
  res: Response,
  next: NextFunction
): Promise<void> => {
   logger(`[deleteTask] Handler reached for taskId: ${req.params.taskId}`, 'TaskController');
  try {
    // Assuming validateResourceId('taskId') middleware adds taskIdNum
    const taskIdNum = (req as any).taskIdNum;
    // Assuming validateProjectId middleware adds projectIdNum (useful for auth)
    // const projectIdNum = (req as any).projectIdNum;

    if (isNaN(taskIdNum)) { throw new HttpError(400, 'Invalid task ID parameter.'); }
    // if (isNaN(projectIdNum)) { throw new HttpError(400, 'Invalid project ID parameter.'); }

    // TODO: Add authorization check: Does the authenticated user have permission to delete tasks in this project?

    logger(`[deleteTask] Calling repository to delete taskId: ${taskIdNum}`, 'TaskController');
    const success = await storage.tasks.deleteTask(taskIdNum); // Repo handles dependency deletion
    logger(`[deleteTask] Repository returned success: ${success}`, 'TaskController');

    if (!success) {
        // Repository returns false if task not found
        throw new HttpError(404, 'Task not found or could not be deleted.');
    }

    // Standard success response for DELETE
    res.status(204).send();
  } catch (error) {
     logger(`[deleteTask] Error occurred: ${error instanceof Error ? error.message : String(error)}`, 'TaskController');
    next(error); // Pass error (including HttpError) to central handler
  }
};

/**
 * Add a dependency between two tasks.
 * Assumes projectId is validated and user is authenticated.
 */
export const createTaskDependency = async (
    req: Request, // Use base Request, projectId checked by middleware
    res: Response,
    next: NextFunction
): Promise<void> => {
     logger(`[createTaskDependency] Handler reached for projectId: ${req.params.projectId}`, 'TaskController');
    try {
        // Assuming validateProjectId middleware adds projectIdNum
        const projectIdNum = (req as any).projectIdNum;
        if (isNaN(projectIdNum)) {
            throw new HttpError(400, 'Invalid project ID parameter.');
        }

        // Validate the request body
        const validationResult = taskDependencySchema.safeParse(req.body);
        if (!validationResult.success) {
             throw new HttpError(400, 'Invalid dependency data.', validationResult.error.flatten());
        }
        const { predecessorId, successorId } = validationResult.data;

        // TODO: Add authorization check: Does user have permission to modify tasks in this project?
        // Optional: Verify both predecessorId and successorId belong to projectIdNum before calling repo

        logger(`[createTaskDependency] Calling repository for ${predecessorId} -> ${successorId}`, 'TaskController');
        const dependency = await storage.tasks.addTaskDependency(predecessorId, successorId);
        logger(`[createTaskDependency] Repository returned dependency: ${dependency?.id}`, 'TaskController');

        // addTaskDependency throws HttpError on known issues (404, 409)
        if (!dependency) {
            // This might occur if onConflictDoNothing was triggered and no existing was found (unlikely)
            // Or if another unexpected error occurred in the repo.
            throw new HttpError(500, 'Failed to create or retrieve dependency.');
        }

        // Return the created or existing dependency
        res.status(201).json(dependency);

    } catch(error) {
         logger(`[createTaskDependency] Error occurred: ${error instanceof Error ? error.message : String(error)}`, 'TaskController');
        next(error); // Pass HttpError or other errors to central handler
    }
};


/**
 * Remove a dependency between two tasks.
 * Assumes projectId is validated and user is authenticated.
 */
export const deleteTaskDependency = async (
    req: Request, // Use base Request, projectId checked by middleware
    res: Response,
    next: NextFunction
): Promise<void> => {
     logger(`[deleteTaskDependency] Handler reached for projectId: ${req.params.projectId}`, 'TaskController');
    try {
        // Assuming validateProjectId middleware adds projectIdNum
        const projectIdNum = (req as any).projectIdNum;
        if (isNaN(projectIdNum)) {
            throw new HttpError(400, 'Invalid project ID parameter.');
        }

        // Validate the request body
        const validationResult = taskDependencySchema.safeParse(req.body);
        if (!validationResult.success) {
             throw new HttpError(400, 'Invalid dependency data.', validationResult.error.flatten());
        }
        const { predecessorId, successorId } = validationResult.data;

        // TODO: Add authorization check: Does user have permission to modify tasks in this project?
        // Optional: Verify both predecessorId and successorId belong to projectIdNum before calling repo

        logger(`[deleteTaskDependency] Calling repository for ${predecessorId} -> ${successorId}`, 'TaskController');
        const success = await storage.tasks.removeTaskDependency(predecessorId, successorId);
        logger(`[deleteTaskDependency] Repository returned success: ${success}`, 'TaskController');

        if (!success) {
            // Repository returns false if dependency not found
            throw new HttpError(404, 'Dependency not found or could not be removed.');
        }

        // Standard success response for DELETE
        res.status(204).send();

    } catch(error) {
         logger(`[deleteTaskDependency] Error occurred: ${error instanceof Error ? error.message : String(error)}`, 'TaskController');
        next(error); // Pass HttpError or other errors to central handler
    }
};

/**
 * Publish all tasks for a project, making them visible to clients.
 * Assumes projectId is validated and user is authenticated.
 */
export const publishProjectTasks = async (
    req: Request, // Use base Request, projectId checked by middleware
    res: Response,
    next: NextFunction
): Promise<void> => {
    logger(`[publishProjectTasks] Handler reached for projectId: ${req.params.projectId}`, 'TaskController');
    try {
        // Assuming validateProjectId middleware adds projectIdNum
        const projectIdNum = (req as any).projectIdNum;
        if (isNaN(projectIdNum)) {
            throw new HttpError(400, 'Invalid project ID parameter.');
        }

        // TODO: Add authorization check: Only admins and project managers should publish tasks

        logger(`[publishProjectTasks] Calling repository to publish tasks for project ${projectIdNum}`, 'TaskController');
        const success = await storage.tasks.publishProjectTasks(projectIdNum);
        logger(`[publishProjectTasks] Repository returned success: ${success}`, 'TaskController');

        if (!success) {
            throw new HttpError(500, 'Failed to publish tasks or no tasks to publish.');
        }

        // Return a success message
        res.status(200).json({ message: 'Tasks published successfully' });
    } catch(error) {
        logger(`[publishProjectTasks] Error occurred: ${error instanceof Error ? error.message : String(error)}`, 'TaskController');
        next(error); // Pass HttpError or other errors to central handler
    }
};

/**
 * Unpublish all tasks for a project, hiding them from clients.
 * Assumes projectId is validated and user is authenticated.
 */
export const unpublishProjectTasks = async (
    req: Request, // Use base Request, projectId checked by middleware
    res: Response,
    next: NextFunction
): Promise<void> => {
    logger(`[unpublishProjectTasks] Handler reached for projectId: ${req.params.projectId}`, 'TaskController');
    try {
        // Assuming validateProjectId middleware adds projectIdNum
        const projectIdNum = (req as any).projectIdNum;
        if (isNaN(projectIdNum)) {
            throw new HttpError(400, 'Invalid project ID parameter.');
        }

        // TODO: Add authorization check: Only admins and project managers should unpublish tasks

        logger(`[unpublishProjectTasks] Calling repository to unpublish tasks for project ${projectIdNum}`, 'TaskController');
        const success = await storage.tasks.unpublishProjectTasks(projectIdNum);
        logger(`[unpublishProjectTasks] Repository returned success: ${success}`, 'TaskController');

        if (!success) {
            throw new HttpError(500, 'Failed to unpublish tasks or no tasks to unpublish.');
        }

        // Return a success message
        res.status(200).json({ message: 'Tasks unpublished successfully' });
    } catch(error) {
        logger(`[unpublishProjectTasks] Error occurred: ${error instanceof Error ? error.message : String(error)}`, 'TaskController');
        next(error); // Pass HttpError or other errors to central handler
    }
};

/**
 * Import tasks from JSON
 * Handles bulk creation of tasks from JSON data in the gantt-task-react format
 */
export const importTasksFromJson = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    logger(`[importTasksFromJson] Handler reached for projectId: ${req.params.projectId}`, 'TaskController');
    try {
        const projectId = parseInt(req.params.projectId);
        if (isNaN(projectId)) {
            throw new HttpError(400, 'Invalid project ID parameter.');
        }
        
        // Get tasks from request body
        const { tasks } = req.body;
        
        if (!Array.isArray(tasks) || tasks.length === 0) {
            throw new HttpError(400, 'Invalid tasks data. Expected non-empty array.');
        }
        
        logger(`[importTasksFromJson] Importing ${tasks.length} tasks for project ${projectId}`, 'TaskController');
        
        // Process each Gantt task and convert to our schema format
        const createdTasks = [];
        for (const ganttTask of tasks) {
            // Validate required fields in gantt task
            if (!ganttTask.name || !ganttTask.start || !ganttTask.end) {
                logger(`[importTasksFromJson] Skipping invalid task: ${JSON.stringify(ganttTask)}`, 'TaskController');
                continue;
            }
            
            // Convert from gantt-task-react format to our schema
            const taskData: schema.InsertTask = {
                projectId: projectId,
                title: ganttTask.name,
                description: ganttTask.description || null,
                startDate: new Date(ganttTask.start),
                dueDate: new Date(ganttTask.end),
                status: ganttTask.progress === 100 ? 'done' : 
                        ganttTask.progress > 0 ? 'in_progress' : 'todo',
                priority: 'medium',
                assigneeId: null,
                progress: ganttTask.progress || 0,
                displayOrder: 0,
                parentId: null,
            };
            
            // Create the task in the database
            logger(`[importTasksFromJson] Creating task "${taskData.title}"`, 'TaskController');
            const createdTask = await storage.tasks.createTask(taskData);
            createdTasks.push(createdTask);
        }
        
        // Return success response with created tasks
        res.status(201).json({
            message: `Successfully imported ${createdTasks.length} tasks`,
            tasks: createdTasks
        });
        
    } catch (error) {
        logger(`[importTasksFromJson] Error occurred: ${error instanceof Error ? error.message : String(error)}`, 'TaskController');
        next(error);
    }
};

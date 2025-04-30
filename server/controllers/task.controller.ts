// server/controllers/task.controller.ts
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { storage } from '../storage/index';
import { TaskWithAssignee } from '../storage/types';
import {
  insertTaskSchema,
  insertTaskDependencySchema,
  User, // Keep User type for req.user casting
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
  projectId: true,
  createdAt: true,
  updatedAt: true,
  // Removed createdBy and displayOrder as they don't exist in schema
});

// Schema for updating tasks (making fields optional)
const taskUpdateSchema = taskCreateSchema.partial().extend({
    status: taskStatusEnum.optional(), // Allow updating status with enum validation
    // No displayOrder field
});

// Schema for task dependencies
const taskDependencySchema = z.object({
    predecessorId: z.number().int().positive(),
    successorId: z.number().int().positive(),
});

// Define AuthenticatedRequest locally if not exported or adjust import
interface AuthenticatedRequest extends Request {
    user: User; // Use the imported User type
}


// --- Controller Functions ---

/**
 * Get all tasks for a specific project.
 */
export const getProjectTasks = async (
  req: Request, // Use base Request type, projectId checked below
  res: Response,
  next: NextFunction
): Promise<void> => {
  // ADDED LOG
  logger(`[getProjectTasks] Handler reached for projectId: ${req.params.projectId}`, 'TaskController');
  try {
    const { projectId } = req.params;
    const projectIdNum = parseInt(projectId, 10);

    if (isNaN(projectIdNum)) { throw new HttpError(400, 'Invalid project ID parameter.'); }

    // ADDED LOG
    logger(`[getProjectTasks] Calling repository for projectId: ${projectIdNum}`, 'TaskController');
    const tasks = await storage.tasks.getTasksForProject(projectIdNum);
    // ADDED LOG
    logger(`[getProjectTasks] Received ${tasks.length} tasks from repository.`, 'TaskController');

    res.status(200).json(tasks);
  } catch (error) {
    // ADDED LOG
    logger(`[getProjectTasks] Error occurred: ${error instanceof Error ? error.message : String(error)}`, 'TaskController');
    next(error); // Pass error to central handler
  }
};

/**
 * Create a new task within a project.
 */
export const createTask = async (
  req: AuthenticatedRequest, // Expect authenticated request
  res: Response,
  next: NextFunction
): Promise<void> => {
   logger(`[createTask] Handler reached for projectId: ${req.params.projectId}`, 'TaskController');
  try {
    const { projectId } = req.params;
    const projectIdNum = parseInt(projectId, 10);
    const user = req.user; // User from AuthenticatedRequest

    if (isNaN(projectIdNum)) { throw new HttpError(400, 'Invalid project ID parameter.'); }
    // User presence is implied by AuthenticatedRequest type/middleware

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
         throw new HttpError(500, 'Failed to create task in repository.');
    }

    res.status(201).json(createdTask);
  } catch (error) {
     logger(`[createTask] Error occurred: ${error instanceof Error ? error.message : String(error)}`, 'TaskController');
    next(error);
  }
};

/**
 * Update an existing task.
 */
export const updateTask = async (
  req: Request, // Use base Request, check params below
  res: Response,
  next: NextFunction
): Promise<void> => {
  logger(`[updateTask] Handler reached for taskId: ${req.params.taskId}`, 'TaskController');
  try {
    // Note: projectId might be needed for authorization checks later
    // const projectIdNum = parseInt(req.params.projectId, 10);
    const taskIdNum = parseInt(req.params.taskId, 10);

    if (isNaN(taskIdNum)) { throw new HttpError(400, 'Invalid task ID parameter.'); }
    // if (isNaN(projectIdNum)) { throw new HttpError(400, 'Invalid project ID parameter.'); }

    const validationResult = taskUpdateSchema.safeParse(req.body);
    if (!validationResult.success) {
      throw new HttpError(400, 'Invalid task update data.', validationResult.error.flatten());
    }
    const validatedData = validationResult.data;
    if (Object.keys(validatedData).length === 0) {
         throw new HttpError(400, 'No update data provided.');
    }

     // Prepare update data, transforming dates
     const updateData: Partial<Omit<InsertTask, 'id' | 'projectId' | 'createdAt'>> = {
        ...validatedData,
        // Transform date strings to Date objects if they exist and are valid
        ...(validatedData.dueDate && { dueDate: new Date(validatedData.dueDate) }),
        ...(validatedData.startDate && { startDate: new Date(validatedData.startDate) }),
        // Add completedAt timestamp if status is set to 'done'
        ...(validatedData.status === 'done' && { /* completedAt: new Date() */ /* Assuming completedAt is not in schema */ })
     };
     // Remove fields that shouldn't be updated directly if necessary (though types help)
     // delete updateData.projectId;
     // delete updateData.id;
     // delete updateData.createdAt;

    logger(`[updateTask] Calling repository to update taskId: ${taskIdNum}`, 'TaskController');
    const updatedTask = await storage.tasks.updateTask(taskIdNum, updateData);
    logger(`[updateTask] Repository returned task: ${updatedTask?.id}`, 'TaskController');

    if (!updatedTask) { throw new HttpError(404, 'Task not found or update failed.'); }

    res.status(200).json(updatedTask);
  } catch (error) {
     logger(`[updateTask] Error occurred: ${error instanceof Error ? error.message : String(error)}`, 'TaskController');
    next(error);
  }
};

/**
 * Delete a task.
 */
export const deleteTask = async (
  req: Request, // Use base Request, check params below
  res: Response,
  next: NextFunction
): Promise<void> => {
   logger(`[deleteTask] Handler reached for taskId: ${req.params.taskId}`, 'TaskController');
  try {
    // const projectIdNum = parseInt(req.params.projectId, 10); // For auth checks
    const taskIdNum = parseInt(req.params.taskId, 10);

    if (isNaN(taskIdNum)) { throw new HttpError(400, 'Invalid task ID parameter.'); }
    // if (isNaN(projectIdNum)) { throw new HttpError(400, 'Invalid project ID parameter.'); }

    // Optional: Verify task belongs to project and user has permission before deleting

    logger(`[deleteTask] Calling repository to delete taskId: ${taskIdNum}`, 'TaskController');
    const success = await storage.tasks.deleteTask(taskIdNum); // Repo handles dependency deletion
    logger(`[deleteTask] Repository returned success: ${success}`, 'TaskController');

    if (!success) { throw new HttpError(404, 'Task not found or could not be deleted.'); }

    res.status(204).send();
  } catch (error) {
     logger(`[deleteTask] Error occurred: ${error instanceof Error ? error.message : String(error)}`, 'TaskController');
    next(error);
  }
};

/**
 * Add a dependency between two tasks.
 */
export const createTaskDependency = async (
    req: Request, // Use base Request
    res: Response,
    next: NextFunction
): Promise<void> => {
     logger(`[createTaskDependency] Handler reached for projectId: ${req.params.projectId}`, 'TaskController');
    try {
        const validationResult = taskDependencySchema.safeParse(req.body);
        if (!validationResult.success) {
             throw new HttpError(400, 'Invalid dependency data.', validationResult.error.flatten());
        }
        const { predecessorId, successorId } = validationResult.data;

        // Optional: Authorization checks needed here

        logger(`[createTaskDependency] Calling repository for ${predecessorId} -> ${successorId}`, 'TaskController');
        const dependency = await storage.tasks.addTaskDependency(predecessorId, successorId);
        logger(`[createTaskDependency] Repository returned dependency: ${dependency?.id}`, 'TaskController');

        // addTaskDependency throws HttpError on known issues (404, 409)
        if (!dependency) {
            // This might occur if onConflictDoNothing was triggered and no existing was found (unlikely)
            throw new HttpError(500, 'Failed to create or retrieve dependency.');
        }

        res.status(201).json(dependency);

    } catch(error) {
         logger(`[createTaskDependency] Error occurred: ${error instanceof Error ? error.message : String(error)}`, 'TaskController');
        next(error); // Pass HttpError or other errors
    }
};


/**
 * Remove a dependency between two tasks.
 */
export const deleteTaskDependency = async (
    req: Request, // Use base Request
    res: Response,
    next: NextFunction
): Promise<void> => {
     logger(`[deleteTaskDependency] Handler reached for projectId: ${req.params.projectId}`, 'TaskController');
    try {
        const validationResult = taskDependencySchema.safeParse(req.body);
        if (!validationResult.success) {
             throw new HttpError(400, 'Invalid dependency data.', validationResult.error.flatten());
        }
        const { predecessorId, successorId } = validationResult.data;

        // Optional: Authorization checks needed here

        logger(`[deleteTaskDependency] Calling repository for ${predecessorId} -> ${successorId}`, 'TaskController');
        const success = await storage.tasks.removeTaskDependency(predecessorId, successorId);
        logger(`[deleteTaskDependency] Repository returned success: ${success}`, 'TaskController');

        if (!success) { throw new HttpError(404, 'Dependency not found or could not be removed.'); }

        res.status(204).send();

    } catch(error) {
         logger(`[deleteTaskDependency] Error occurred: ${error instanceof Error ? error.message : String(error)}`, 'TaskController');
        next(error); // Pass HttpError or other errors
    }
};

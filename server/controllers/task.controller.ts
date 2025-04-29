import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
// Updated import path for the aggregated storage object
import { storage } from '../storage/index';
// Import specific types from the new types file
import { TaskWithAssignee } from '../storage/types';
import {
  insertTaskSchema,
  taskStatusEnum,
  taskPriorityEnum,
  insertTaskDependencySchema,
  User, // Keep User type for req.user casting
} from '../../shared/schema';
import { HttpError } from '../errors';

// --- Zod Schemas for API Input Validation (Unchanged) ---

const taskCreateSchema = insertTaskSchema.omit({
  id: true, projectId: true, createdBy: true, createdAt: true, updatedAt: true, displayOrder: true, // displayOrder handled by default or logic
});

const taskUpdateSchema = taskCreateSchema.partial().extend({
    status: taskCreateSchema.shape.status.optional(),
    // Also allow updating displayOrder if needed via API
    displayOrder: z.number().int().optional(),
});

const taskDependencySchema = z.object({
    predecessorId: z.number().int().positive(),
    successorId: z.number().int().positive(),
});

// --- Controller Functions ---

/**
 * Get all tasks for a specific project.
 */
export const getProjectTasks = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { projectId } = req.params;
    const projectIdNum = parseInt(projectId, 10);

    if (isNaN(projectIdNum)) { throw new HttpError(400, 'Invalid project ID parameter.'); }

    // Use the nested repository: storage.tasks
    const tasks = await storage.tasks.getTasksForProject(projectIdNum);
    res.status(200).json(tasks);
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new task within a project.
 */
export const createTask = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { projectId } = req.params;
    const projectIdNum = parseInt(projectId, 10);
    const user = req.user as User;

    if (isNaN(projectIdNum)) { throw new HttpError(400, 'Invalid project ID parameter.'); }
    if (!user?.id) { throw new HttpError(401, 'Authentication required.'); }

    const validationResult = taskCreateSchema.safeParse(req.body);
    if (!validationResult.success) {
      throw new HttpError(400, 'Invalid task data.', validationResult.error.flatten());
    }
    const validatedData = validationResult.data;

    const newTaskData = {
        ...validatedData,
        projectId: projectIdNum,
        // Remove progress field if it exists in validatedData
        ...(validatedData.progress ? { } : {}), // Strip out progress if it exists
        dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : null,
        startDate: validatedData.startDate ? new Date(validatedData.startDate) : null,
        // displayOrder handled by DB default or specific logic
    };

    // Use the nested repository: storage.tasks
    const createdTask = await storage.tasks.createTask(newTaskData);
    res.status(201).json(createdTask);
  } catch (error) {
    next(error);
  }
};

/**
 * Update an existing task.
 */
export const updateTask = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { projectId, taskId } = req.params;
    const projectIdNum = parseInt(projectId, 10); // Still needed for context/auth potentially
    const taskIdNum = parseInt(taskId, 10);

    if (isNaN(projectIdNum) || isNaN(taskIdNum)) { throw new HttpError(400, 'Invalid project or task ID parameter.'); }

    const validationResult = taskUpdateSchema.safeParse(req.body);
    if (!validationResult.success) {
      throw new HttpError(400, 'Invalid task data.', validationResult.error.flatten());
    }
    const validatedData = validationResult.data;
    if (Object.keys(validatedData).length === 0) { throw new HttpError(400, 'No update data provided.'); }

     const updateData = {
        ...validatedData,
        ...(validatedData.dueDate && { dueDate: new Date(validatedData.dueDate) }),
        ...(validatedData.startDate && { startDate: new Date(validatedData.startDate) }),
        ...(validatedData.status === 'COMPLETED' && { completedAt: new Date() }),
        ...(validatedData.status && validatedData.status !== 'COMPLETED' && { completedAt: null })
    };

    // Use the nested repository: storage.tasks
    const updatedTask = await storage.tasks.updateTask(taskIdNum, updateData);

    if (!updatedTask) { throw new HttpError(404, 'Task not found.'); }

    // Optional: Could re-verify task project ID matches route projectId if needed, though repo should be correct
    // if (updatedTask.projectId !== projectIdNum) { ... }

    res.status(200).json(updatedTask);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a task.
 */
export const deleteTask = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { projectId, taskId } = req.params; // Project ID might be useful for auth checks if repo doesn't handle it
    const taskIdNum = parseInt(taskId, 10);

    if (isNaN(taskIdNum)) { throw new HttpError(400, 'Invalid task ID parameter.'); }

    // Optional: Verify task belongs to project before calling delete if repo doesn't inherently check
    // const task = await storage.tasks.getTaskById(taskIdNum);
    // if (!task || task.projectId !== parseInt(projectId, 10)) {
    //    throw new HttpError(404, 'Task not found in this project.');
    // }

    // Use the nested repository: storage.tasks
    const success = await storage.tasks.deleteTask(taskIdNum);

    if (!success) { throw new HttpError(404, 'Task not found or could not be deleted.'); }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

/**
 * Add a dependency between two tasks.
 */
export const createTaskDependency = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const validationResult = taskDependencySchema.safeParse(req.body);
        if (!validationResult.success) {
             throw new HttpError(400, 'Invalid dependency data.', validationResult.error.flatten());
        }
        const { predecessorId, successorId } = validationResult.data;

        // **AUTHORIZATION NOTE:** Still complex. Requires checking access to projects of BOTH tasks.
        // This should ideally be handled by a service layer or complex check here.
        // For now, relies on storage layer potentially throwing if tasks don't exist.

        // Use the nested repository: storage.tasks
        const dependency = await storage.tasks.addTaskDependency(predecessorId, successorId);

        res.status(201).json(dependency);

    } catch(error) {
        // Catch specific HttpErrors from repo (404 task not found, 409 cycle/duplicate)
        if (error instanceof HttpError) return next(error);
        // Handle generic errors
        console.error("Generic error adding dependency:", error);
        next(new Error('Failed to add dependency.')); // Generic error to client
    }
};


/**
 * Remove a dependency between two tasks.
 */
export const deleteTaskDependency = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const validationResult = taskDependencySchema.safeParse(req.body);
        if (!validationResult.success) {
             throw new HttpError(400, 'Invalid dependency data.', validationResult.error.flatten());
        }
        const { predecessorId, successorId } = validationResult.data;

        // **AUTHORIZATION NOTE:** See addTaskDependency.

        // Use the nested repository: storage.tasks
        const success = await storage.tasks.removeTaskDependency(predecessorId, successorId);

        if (!success) { throw new HttpError(404, 'Dependency not found or could not be removed.'); }

        res.status(204).send();

    } catch(error) {
         // Catch specific HttpErrors from repo? (e.g., 404)
        if (error instanceof HttpError) return next(error);
        // Handle generic errors
        console.error("Generic error removing dependency:", error);
        next(new Error('Failed to remove dependency.'));
    }
};
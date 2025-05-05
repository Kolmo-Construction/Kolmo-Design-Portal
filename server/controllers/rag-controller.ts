/**
 * RAG (Retrieval Augmented Generation) Controller
 * Handles HTTP requests for AI-assisted task generation
 */
import { Request, Response, NextFunction } from 'express';
import * as ragService from '../services/rag-service';
import { 
  insertProjectVersionSchema,
  insertGenerationPromptSchema,
  insertRagTaskSchema,
  insertRagTaskDependencySchema,
  insertTaskFeedbackSchema
} from '@shared/schema';
import { createBadRequestError } from '../errors';

/**
 * Create a new project version for RAG task generation
 */
export async function createProjectVersion(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) {
      throw createBadRequestError('Invalid project ID');
    }

    // Don't require version number in request body - service will handle it
    const parsedData = {
      projectId,
      notes: req.body.notes || null
      // versionNumber will be handled in the service
    };

    const result = await ragService.createProjectVersion(parsedData);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Get all versions for a project
 */
export async function getProjectVersions(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) {
      throw createBadRequestError('Invalid project ID');
    }

    const result = await ragService.getProjectVersions(projectId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Get a specific project version
 */
export async function getProjectVersion(req: Request, res: Response, next: NextFunction) {
  try {
    const versionId = req.params.versionId;
    const result = await ragService.getProjectVersion(versionId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Create a new generation prompt
 */
export async function createGenerationPrompt(req: Request, res: Response, next: NextFunction) {
  try {
    const versionId = req.params.versionId;
    
    const parsedData = insertGenerationPromptSchema.safeParse({
      ...req.body,
      projectVersionId: versionId
    });

    if (!parsedData.success) {
      throw createBadRequestError('Invalid generation prompt data', parsedData.error);
    }

    const result = await ragService.createGenerationPrompt(parsedData.data);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Get generation prompts for a project version
 */
export async function getGenerationPrompts(req: Request, res: Response, next: NextFunction) {
  try {
    const versionId = req.params.versionId;
    const result = await ragService.getGenerationPrompts(versionId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Create a new RAG task
 */
export async function createRagTask(req: Request, res: Response, next: NextFunction) {
  try {
    const versionId = req.params.versionId;
    
    const parsedData = insertRagTaskSchema.safeParse({
      ...req.body,
      projectVersionId: versionId
    });

    if (!parsedData.success) {
      throw createBadRequestError('Invalid RAG task data', parsedData.error);
    }

    const result = await ragService.createRagTask(parsedData.data);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Get RAG tasks for a project version
 */
export async function getRagTasks(req: Request, res: Response, next: NextFunction) {
  try {
    const versionId = req.params.versionId;
    const result = await ragService.getRagTasks(versionId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Create a RAG task dependency
 */
export async function createRagTaskDependency(req: Request, res: Response, next: NextFunction) {
  try {
    const taskId = req.params.taskId;
    
    const parsedData = insertRagTaskDependencySchema.safeParse({
      ...req.body,
      taskId
    });

    if (!parsedData.success) {
      throw createBadRequestError('Invalid RAG task dependency data', parsedData.error);
    }

    const result = await ragService.createRagTaskDependency(parsedData.data);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Get RAG task dependencies for a task
 */
export async function getRagTaskDependencies(req: Request, res: Response, next: NextFunction) {
  try {
    const taskId = req.params.taskId;
    const result = await ragService.getRagTaskDependencies(taskId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Create task feedback
 */
export async function createTaskFeedback(req: Request, res: Response, next: NextFunction) {
  try {
    const taskId = req.params.taskId;
    const userId = req.user?.id;
    
    if (!userId) {
      throw createBadRequestError('User must be authenticated');
    }
    
    const parsedData = insertTaskFeedbackSchema.safeParse({
      ...req.body,
      taskId,
      userId
    });

    if (!parsedData.success) {
      throw createBadRequestError('Invalid task feedback data', parsedData.error);
    }

    const result = await ragService.createTaskFeedback(parsedData.data);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Get task feedback for a task
 */
export async function getTaskFeedback(req: Request, res: Response, next: NextFunction) {
  try {
    const taskId = req.params.taskId;
    const includeUserInfo = req.query.includeUserInfo === 'true';
    
    let result;
    if (includeUserInfo) {
      result = await ragService.getTaskFeedbackWithUserInfo(taskId);
    } else {
      result = await ragService.getTaskFeedback(taskId);
    }
    
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Convert RAG tasks to regular project tasks
 */
export async function convertRagTasksToProjectTasks(req: Request, res: Response, next: NextFunction) {
  try {
    const versionId = req.params.versionId;
    const projectId = parseInt(req.params.projectId);
    
    if (isNaN(projectId)) {
      throw createBadRequestError('Invalid project ID');
    }
    
    await ragService.convertRagTasksToProjectTasks(versionId, projectId);
    res.status(200).json({ message: 'Tasks converted successfully' });
  } catch (error) {
    next(error);
  }
}
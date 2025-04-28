// server/controllers/dailyLog.controller.ts
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
// Updated import path for the aggregated storage object
import { storage } from '../storage/index';
// Import specific types from the new types file
import { DailyLogWithAuthor } from '../storage/types';
import { insertDailyLogSchema, User } from '../../shared/schema'; // Keep User type
import { HttpError } from '../errors';

// --- Zod Schemas (Unchanged) ---
const dailyLogCreateSchema = insertDailyLogSchema.omit({ /*...*/ }).extend({
   logDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Invalid date format. Use YYYY-MM-DD.' }),
}).refine(data => data.workPerformed.trim().length > 0, { /*...*/ });

const dailyLogUpdateSchema = dailyLogCreateSchema.partial();

// --- Controller Functions ---

/**
 * Get all daily logs for a specific project.
 */
export const getDailyLogsForProject = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { projectId } = req.params;
    const projectIdNum = parseInt(projectId, 10);
    if (isNaN(projectIdNum)) { throw new HttpError(400, 'Invalid project ID parameter.'); }

    // Use the nested repository: storage.dailyLogs
    const logs = await storage.dailyLogs.getDailyLogsForProject(projectIdNum);
    res.status(200).json(logs);
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new daily log for a project.
 */
export const createDailyLog = async (
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

    const validationResult = dailyLogCreateSchema.safeParse(req.body);
    if (!validationResult.success) { throw new HttpError(400, 'Invalid daily log data.', validationResult.error.flatten()); }
    const validatedData = validationResult.data;

    const newLogData = {
        ...validatedData,
        projectId: projectIdNum,
        authorId: user.id,
        logDate: validatedData.logDate, // Pass validated string
    };

    // Use the nested repository: storage.dailyLogs
    const createdLog = await storage.dailyLogs.createDailyLog(newLogData);

    if (!createdLog) { throw new HttpError(500, 'Failed to create daily log.'); }

    res.status(201).json(createdLog); // Returns DailyLogWithAuthor
  } catch (error) {
    next(error);
  }
};

/**
 * Update an existing daily log.
 */
export const updateDailyLog = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { logId } = req.params;
    const logIdNum = parseInt(logId, 10);
    if (isNaN(logIdNum)) { throw new HttpError(400, 'Invalid log ID parameter.'); }

    const validationResult = dailyLogUpdateSchema.safeParse(req.body);
    if (!validationResult.success) { throw new HttpError(400, 'Invalid daily log data.', validationResult.error.flatten()); }
    const validatedData = validationResult.data;
    if (Object.keys(validatedData).length === 0) { throw new HttpError(400, 'No update data provided.'); }

     const updateData = {
        ...validatedData,
        ...(validatedData.logDate && { logDate: validatedData.logDate }), // Pass validated string
    };

    // Use the nested repository: storage.dailyLogs
    const updatedLog = await storage.dailyLogs.updateDailyLog(logIdNum, updateData);

    if (!updatedLog) { throw new HttpError(404, 'Daily log not found or update failed.'); }

    res.status(200).json(updatedLog); // Returns DailyLogWithAuthor
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a daily log.
 */
export const deleteDailyLog = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { logId } = req.params;
    const logIdNum = parseInt(logId, 10);
    if (isNaN(logIdNum)) { throw new HttpError(400, 'Invalid log ID parameter.'); }

    // Use the nested repository: storage.dailyLogs
    const success = await storage.dailyLogs.deleteDailyLog(logIdNum);

    if (!success) { throw new HttpError(404, 'Daily log not found or could not be deleted.'); }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
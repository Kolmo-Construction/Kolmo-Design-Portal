import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { insertDailyLogSchema, User } from '../../shared/schema';
import { HttpError } from '../errors';

// --- Zod Schemas for API Input Validation ---

// Schema for creating a daily log
const dailyLogCreateSchema = insertDailyLogSchema.omit({
  id: true,
  projectId: true, // Set from route parameter
  authorId: true, // Set from authenticated user
  createdAt: true,
  updatedAt: true,
}).extend({
  // Ensure logDate is received as a valid date string (e.g., YYYY-MM-DD)
  // Drizzle/node-postgres might handle 'YYYY-MM-DD' directly for DATE columns.
  // Using datetime() might be too strict if only date is needed.
  // Let's refine to accept YYYY-MM-DD format.
   logDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Invalid date format. Use YYYY-MM-DD.' }),
}).refine(data => data.workPerformed.trim().length > 0, {
    message: "Work performed description cannot be empty.",
    path: ["workPerformed"],
});

// Schema for updating a daily log (most fields optional)
const dailyLogUpdateSchema = dailyLogCreateSchema.partial();


// --- Controller Functions ---

/**
 * Get all daily logs for a specific project.
 * Assumes checkProjectAccess middleware runs before this.
 * Storage layer should join with author details.
 */
export const getDailyLogsForProject = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { projectId } = req.params;
    const projectIdNum = parseInt(projectId, 10);

    if (isNaN(projectIdNum)) {
      throw new HttpError(400, 'Invalid project ID parameter.');
    }

    // checkProjectAccess middleware verified access
    // Assumes storage.getDailyLogsForProject fetches logs and author info
    const logs = await storage.getDailyLogsForProject(projectIdNum);
    res.status(200).json(logs);
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new daily log for a project.
 * Assumes isAdmin middleware runs before this.
 */
export const createDailyLog = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { projectId } = req.params;
    const projectIdNum = parseInt(projectId, 10);
    const user = req.user as User; // Authenticated user (Admin)

    if (isNaN(projectIdNum)) {
      throw new HttpError(400, 'Invalid project ID parameter.');
    }
    if (!user?.id) {
      throw new HttpError(401, 'Authentication required.'); // Belt-and-suspenders
    }
    // isAdmin middleware verified access

    const validationResult = dailyLogCreateSchema.safeParse(req.body);
    if (!validationResult.success) {
      throw new HttpError(400, 'Invalid daily log data.', validationResult.error.flatten());
    }

    const validatedData = validationResult.data;

    // Prepare data for storage layer
    const newLogData = {
        ...validatedData,
        projectId: projectIdNum,
        authorId: user.id,
        // Convert validated date string to Date object for storage if necessary,
        // although node-postgres often handles 'YYYY-MM-DD' strings for DATE columns.
        // Let's assume storage expects a string here based on schema/driver behavior.
        logDate: validatedData.logDate,
        // logDate: new Date(validatedData.logDate + 'T00:00:00Z'), // Alternative if Date object needed
    };

    // Assumes storage.createDailyLog saves and returns the new log with author info
    const createdLog = await storage.createDailyLog(newLogData);

    if (!createdLog) {
        throw new HttpError(500, 'Failed to create daily log.');
    }

    res.status(201).json(createdLog);
  } catch (error) {
    next(error);
  }
};

/**
 * Update an existing daily log.
 * Assumes isAdmin middleware runs before this (applied globally to the route).
 */
export const updateDailyLog = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { logId } = req.params;
    const logIdNum = parseInt(logId, 10);

    if (isNaN(logIdNum)) {
      throw new HttpError(400, 'Invalid log ID parameter.');
    }
    // isAdmin middleware verified access globally

    const validationResult = dailyLogUpdateSchema.safeParse(req.body);
    if (!validationResult.success) {
      throw new HttpError(400, 'Invalid daily log data.', validationResult.error.flatten());
    }

    const validatedData = validationResult.data;
    if (Object.keys(validatedData).length === 0) {
      throw new HttpError(400, 'No update data provided.');
    }

     // Prepare data for storage, converting types as needed
     const updateData = {
        ...validatedData,
        // Convert date string if present
        ...(validatedData.logDate && { logDate: validatedData.logDate }), // Pass string if storage handles YYYY-MM-DD
        // ...(validatedData.logDate && { logDate: new Date(validatedData.logDate + 'T00:00:00Z') }),
    };


    const updatedLog = await storage.updateDailyLog(logIdNum, updateData); // Assumes storage.updateDailyLog exists

    if (!updatedLog) {
        throw new HttpError(404, 'Daily log not found or update failed.');
    }

    res.status(200).json(updatedLog);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a daily log.
 * Assumes isAdmin middleware runs before this (applied globally to the route).
 */
export const deleteDailyLog = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { logId } = req.params;
    const logIdNum = parseInt(logId, 10);

    if (isNaN(logIdNum)) {
      throw new HttpError(400, 'Invalid log ID parameter.');
    }
    // isAdmin middleware verified access globally

    const success = await storage.deleteDailyLog(logIdNum); // Assumes storage.deleteDailyLog exists

    if (!success) {
       throw new HttpError(404, 'Daily log not found or could not be deleted.');
    }

    res.status(204).send(); // No content on successful delete
  } catch (error) {
    next(error);
  }
};
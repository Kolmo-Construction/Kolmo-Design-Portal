// server/controllers/dailyLog.controller.ts
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { storage } from '../storage/index';
// Assuming DailyLogWithAuthor includes relations like creator and photos
import { DailyLogWithAuthor } from '../storage/types';
import { insertDailyLogSchema, User, InsertDailyLog } from '@shared/schema'; // Use @shared alias, import InsertDailyLog type
import { HttpError } from '../errors';
import { log as logger } from '@server/vite'; // Use logger from vite.ts

// Define AuthenticatedRequest locally if not exported or adjust import
interface AuthenticatedRequest extends Request {
    user: User; // Use the imported User type
}

// --- Zod Schemas ---

// Base schema for creation/update, omitting DB/server-generated fields
// Use the already extended schema from shared/schema.ts as the true base
const baseDailyLogSchema = insertDailyLogSchema.omit({
    id: true,
    projectId: true, // Will be added from route params
    createdById: true, // Will be added from authenticated user
    createdAt: true,
});

// Schema specifically for validating the CREATE request body
const dailyLogCreateBodySchema = baseDailyLogSchema.refine(
    data => data.workPerformed.trim().length > 0, {
        message: 'Work performed cannot be empty.',
        path: ['workPerformed'], // Specify the path for the refinement error
    }
);
// Note: Date/Temperature transformations are already handled in insertDailyLogSchema from schema.ts

// Schema for validating the UPDATE request body (make fields optional)
// Apply .partial() to the base schema *before* any update-specific refinements (if needed)
const dailyLogUpdateBodySchema = baseDailyLogSchema.partial();

// --- Controller Class ---
// Encapsulate logic within a class
export class DailyLogController {

    // Example of using storage directly, replace with dependency injection if preferred
    private dailyLogsRepo = storage.dailyLogs;
    // Add other repos if needed, e.g., for photos:
    // private dailyLogPhotosRepo = storage.dailyLogPhotos;

    /**
     * Get all daily logs for a specific project.
     */
    async getDailyLogsForProject(
      req: Request<{ projectId: string }>, // Use string for params initially
      res: Response,
      next: NextFunction
    ): Promise<void> {
      try {
        const projectIdNum = parseInt(req.params.projectId, 10);
        if (isNaN(projectIdNum)) { throw new HttpError(400, 'Invalid project ID parameter.'); }

        // Assuming repo method exists and returns the correct type
        const logs: DailyLogWithAuthor[] = await this.dailyLogsRepo.getDailyLogsForProject(projectIdNum);
        res.status(200).json(logs);
      } catch (error) {
         logger(`Error in getDailyLogsForProject: ${error instanceof Error ? error.message : String(error)}`, 'DailyLogController');
        next(new HttpError(500, 'Failed to retrieve daily logs.')); // Pass HttpError
      }
    }

    /**
     * Create a new daily log for a project.
     */
    async createDailyLog(
      req: AuthenticatedRequest, // Use AuthenticatedRequest
      res: Response,
      next: NextFunction
    ): Promise<void> {
      try {
        const projectIdNum = parseInt(req.params.projectId, 10);
        const user = req.user; // User should be populated by isAuthenticated middleware

        if (isNaN(projectIdNum)) { throw new HttpError(400, 'Invalid project ID parameter.'); }
        // user is guaranteed by AuthenticatedRequest if middleware is correct

        // Validate request body using the create schema
        const validationResult = dailyLogCreateBodySchema.safeParse(req.body);
        if (!validationResult.success) {
          throw new HttpError(400, 'Invalid daily log data.', validationResult.error.flatten());
        }
        // Data is now validated and transformed (e.g., logDate is a Date)
        const validatedData = validationResult.data;

        // Prepare data for repository
        // Explicitly construct the InsertDailyLog type expected by the repository
        const newLogData: InsertDailyLog = {
            ...validatedData,
            projectId: projectIdNum,
            createdById: user.id,
            // Ensure required fields from the base schema are present
            logDate: validatedData.logDate, // Already transformed to Date
            workPerformed: validatedData.workPerformed,
            // Optional fields are handled by spread
        };

        const createdLog = await this.dailyLogsRepo.createDailyLog(newLogData);

        // createDailyLog in repo should ideally return the full DailyLogWithAuthor or throw
        if (!createdLog) {
            throw new HttpError(500, 'Failed to create daily log in repository.');
        }

        res.status(201).json(createdLog); // Returns DailyLogWithAuthor from repo
      } catch (error) {
         logger(`Error in createDailyLog: ${error instanceof Error ? error.message : String(error)}`, 'DailyLogController');
        next(error); // Pass error (including HttpError) to the central handler
      }
    }

    /**
     * Update an existing daily log.
     */
    async updateDailyLog(
      // Use Partial<InsertDailyLog> for body type hint, params are strings
      req: Request<{ logId: string }, any, Partial<InsertDailyLog>>,
      res: Response,
      next: NextFunction
    ): Promise<void> {
      try {
        const logIdNum = parseInt(req.params.logId, 10);
        if (isNaN(logIdNum)) { throw new HttpError(400, 'Invalid log ID parameter.'); }

        // Validate request body against the partial update schema
        const validationResult = dailyLogUpdateBodySchema.safeParse(req.body);
        if (!validationResult.success) {
          throw new HttpError(400, 'Invalid daily log update data.', validationResult.error.flatten());
        }
        // Data is validated and transformed (e.g., logDate is Date if provided)
        const validatedData = validationResult.data;

        // Ensure there's actually data to update
        if (Object.keys(validatedData).length === 0) {
          throw new HttpError(400, 'No update data provided.');
        }

        // Prepare update data for the repository
        // The type Partial<Omit<InsertDailyLog, 'id' | 'projectId' | 'createdById' | 'createdAt'>> is accurate
        const updateData: Partial<Omit<InsertDailyLog, 'id' | 'projectId' | 'createdById' | 'createdAt'>> = validatedData;


        const updatedLog = await this.dailyLogsRepo.updateDailyLog(logIdNum, updateData);

        if (!updatedLog) {
          throw new HttpError(404, 'Daily log not found or update failed.');
        }

        res.status(200).json(updatedLog); // Returns DailyLogWithAuthor from repo
      } catch (error) {
         logger(`Error in updateDailyLog: ${error instanceof Error ? error.message : String(error)}`, 'DailyLogController');
        next(error); // Pass error (including HttpError) to the central handler
      }
    }

    /**
     * Delete a daily log.
     */
    async deleteDailyLog(
      req: Request<{ logId: string }>, // Use string for params initially
      res: Response,
      next: NextFunction
    ): Promise<void> {
      try {
        const logIdNum = parseInt(req.params.logId, 10);
        if (isNaN(logIdNum)) { throw new HttpError(400, 'Invalid log ID parameter.'); }

        // Optional: Add authorization checks here

        const success = await this.dailyLogsRepo.deleteDailyLog(logIdNum);

        if (!success) {
          throw new HttpError(404, 'Daily log not found or could not be deleted.');
        }

        res.status(204).send(); // Standard success response for DELETE
      } catch (error) {
         logger(`Error in deleteDailyLog: ${error instanceof Error ? error.message : String(error)}`, 'DailyLogController');
        next(error); // Pass error (including HttpError) to the central handler
      }
    }

    // --- Placeholder for Photo Deletion Logic ---
    // This needs to be implemented based on how photos are associated and stored
    async deleteDailyLogPhoto(
        req: Request<{ photoId: string }>, // Assuming photoId is the parameter
        res: Response,
        next: NextFunction
    ): Promise<void> {
         try {
            const photoIdNum = parseInt(req.params.photoId, 10);
             if (isNaN(photoIdNum)) { throw new HttpError(400, 'Invalid photo ID parameter.'); }

             logger(`Placeholder: Attempting to delete photo with ID: ${photoIdNum}`, 'DailyLogController');
             // TODO: Implement actual photo deletion logic here
             // 1. Find the photo record in the database (e.g., dailyLogPhotos table)
             // 2. Get the storage key/URL from the photo record.
             // 3. Delete the file from R2 storage using the key/URL.
             // 4. Delete the photo record from the database.
             // Example (requires dailyLogPhotosRepo):
             // const success = await this.dailyLogPhotosRepo.deletePhoto(photoIdNum);
             // if (!success) throw new HttpError(404, 'Photo not found.');

             res.status(200).json({ message: `Placeholder: Photo ${photoIdNum} deletion not fully implemented.` });
             // res.status(204).send(); // Use this on successful deletion

         } catch (error) {
             logger(`Error in deleteDailyLogPhoto: ${error instanceof Error ? error.message : String(error)}`, 'DailyLogController');
             next(error);
         }
     }

    // Add other methods as needed (e.g., getDailyLogById, addPhotosToDailyLog)

} // End of DailyLogController class

// --- Export an instance of the controller ---
export const dailyLogController = new DailyLogController();

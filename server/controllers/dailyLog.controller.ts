// server/controllers/dailyLog.controller.ts
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
// Import the aggregated storage object and the specific repo interface
import { storage, StorageAggregate } from '../storage/index'; // Adjusted import
import { HttpError } from '../errors';
import { insertDailyLogSchema, User } from '../../shared/schema'; // Corrected path to shared/schema

// Define Zod schema for daily log creation (adjust based on actual schema)
// Ensure it aligns with insertDailyLogSchema from shared/schema.ts
const createDailyLogInputSchema = insertDailyLogSchema.omit({
    id: true,
    projectId: true, // projectId comes from URL params
    userId: true, // userId comes from req.user
    createdAt: true,
    updatedAt: true,
});

// Define Zod schema for daily log update (adjust based on actual schema)
const updateDailyLogInputSchema = createDailyLogInputSchema.partial();


export class DailyLogController {
    // Declare private properties for injected repositories
    private dailyLogsRepo;
    private mediaRepo; // Assuming media repo is needed for photo handling

    // Constructor accepts the full storage aggregate or specific repos
    constructor(storage: StorageAggregate) {
        this.dailyLogsRepo = storage.dailyLogs;
        this.mediaRepo = storage.media; // Initialize media repo
        // Bind methods to ensure 'this' context is correct when passed as callbacks
        this.getDailyLogsForProject = this.getDailyLogsForProject.bind(this);
        this.createDailyLog = this.createDailyLog.bind(this);
        this.updateDailyLog = this.updateDailyLog.bind(this);
        this.deleteDailyLog = this.deleteDailyLog.bind(this);
        // Bind any other methods like photo handling if they exist
    }

    // --- Controller Methods ---

    // GET /api/projects/:projectId/daily-logs
    async getDailyLogsForProject(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            // projectId is validated by middleware
            const projectId = parseInt(req.params.projectId, 10);
            console.log(`[DailyLogController] Fetching logs for project ID: ${projectId}`); // Added logging

            // --- FIX: Use the correct repository method name ---
            const logs = await this.dailyLogsRepo.getDailyLogsForProject(projectId);

            console.log(`[DailyLogController] Found ${logs.length} logs for project ID: ${projectId}`); // Added logging
            res.status(200).json(logs);
        } catch (error) {
             console.error('[DailyLogController] Error in getDailyLogsForProject:', error); // Log the actual error
             // Pass a structured error to the error handler
             next(new HttpError(500, 'Failed to retrieve daily logs.', error instanceof Error ? error.message : String(error)));
        }
    }

    // POST /api/projects/:projectId/daily-logs
    async createDailyLog(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const projectId = parseInt(req.params.projectId, 10);
            const user = req.user as User; // Assuming isAuthenticated middleware sets req.user

            // Validate request body
            const validationResult = createDailyLogInputSchema.safeParse(req.body);
            if (!validationResult.success) {
                throw new HttpError(400, 'Invalid daily log data.', validationResult.error.flatten());
            }

             // Handle file uploads (req.files should be populated by multer)
             const uploadedFiles = req.files as Express.Multer.File[] | undefined;
             let photoUrls: string[] = [];

             if (uploadedFiles && uploadedFiles.length > 0) {
                 // Process uploads (e.g., upload to R2, get URLs)
                 // This is a placeholder - implement your actual upload logic using this.mediaRepo
                 console.log(`[DailyLogController] Received ${uploadedFiles.length} files to upload.`);
                 // Example: photoUrls = await this.mediaRepo.uploadFiles(uploadedFiles, `projects/${projectId}/daily-logs`);
                 // For now, just logging filenames as placeholders
                 photoUrls = uploadedFiles.map(f => f.originalname);
                 console.log(`[DailyLogController] Placeholder photo URLs: ${photoUrls.join(', ')}`);
             }


            const logData = {
                ...validationResult.data,
                projectId: projectId,
                userId: user.id,
                // Add photoUrls to the data being saved if your schema supports it
                // photos: photoUrls, // Example: Adjust based on your schema field name
            };

            // --- FIX: Use the correct repository method name ---
            // Assuming the repository method for creation is named 'createDailyLog' based on the interface
            const newLog = await this.dailyLogsRepo.createDailyLog(logData);

            res.status(201).json(newLog);
        } catch (error) {
             console.error('[DailyLogController] Error in createDailyLog:', error);
             next(error instanceof HttpError ? error : new HttpError(500, 'Failed to create daily log.', error instanceof Error ? error.message : String(error)));
        }
    }

    // PUT /api/projects/:projectId/daily-logs/:logId
    async updateDailyLog(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const logId = parseInt(req.params.logId, 10); // logId validated by middleware
            // projectId might also be needed for authorization checks if necessary
            // const projectId = parseInt(req.params.projectId, 10);

            // Validate request body
            const validationResult = updateDailyLogInputSchema.safeParse(req.body);
            if (!validationResult.success) {
                throw new HttpError(400, 'Invalid daily log update data.', validationResult.error.flatten());
            }

            // Ensure there's data to update
            if (Object.keys(validationResult.data).length === 0) {
                throw new HttpError(400, 'No update data provided.');
            }

            // --- FIX: Use the correct repository method name ---
             // Assuming the repository method for update is named 'updateDailyLog' based on the interface
            const updatedLog = await this.dailyLogsRepo.updateDailyLog(logId, validationResult.data);

            if (!updatedLog) {
                 throw new HttpError(404, 'Daily log not found or update failed.');
            }

            res.status(200).json(updatedLog);
        } catch (error) {
             console.error('[DailyLogController] Error in updateDailyLog:', error);
             next(error instanceof HttpError ? error : new HttpError(500, 'Failed to update daily log.', error instanceof Error ? error.message : String(error)));
        }
    }

    // DELETE /api/projects/:projectId/daily-logs/:logId
    async deleteDailyLog(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const logId = parseInt(req.params.logId, 10); // logId validated by middleware

            // --- FIX: Use the correct repository method name ---
            // Assuming the repository method for deletion is named 'deleteDailyLog' based on the interface
            const success = await this.dailyLogsRepo.deleteDailyLog(logId);

            if (!success) {
                throw new HttpError(404, 'Daily log not found or could not be deleted.');
            }

            res.status(204).send(); // No content on successful deletion
        } catch (error) {
             console.error('[DailyLogController] Error in deleteDailyLog:', error);
             next(error instanceof HttpError ? error : new HttpError(500, 'Failed to delete daily log.', error instanceof Error ? error.message : String(error)));
        }
    }

     // --- Add Photo Handling Methods if needed ---
    // Example: async addPhotosToDailyLog(...) { ... }
    // Example: async deleteDailyLogPhoto(...) { ... }

}

// --- Instantiate and Export ---
// Create a single instance of the controller, injecting the storage object
export const dailyLogController = new DailyLogController(storage);
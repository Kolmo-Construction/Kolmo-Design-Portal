// server/controllers/dailyLog.controller.ts
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
// Import the aggregated storage object and the specific repo interface
import { storage, StorageAggregate } from '../storage/index'; // Adjusted import
import { HttpError } from '../errors';
import { insertDailyLogSchema, User } from '../../shared/schema'; // Corrected path to shared/schema

// Define Zod schema for validation that OMITS fields set by the backend
const createDailyLogInputSchema = z.object({
    logDate: z.union([z.string().datetime(), z.date()]),
    workPerformed: z.string().min(1),
    weather: z.string().optional().nullable(),
    temperature: z.union([
        z.number().optional().nullable(),
        z.string().refine(val => val === "" || val === null || !isNaN(parseFloat(val)), {
            message: "Temperature must be a valid number"
        }).transform(val => val === "" || val === null ? null : parseFloat(val)).optional().nullable()
    ]),
    crewOnSite: z.string().optional().nullable(),
    issuesEncountered: z.string().optional().nullable(),
    safetyObservations: z.string().optional().nullable(),
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
            const projectId = parseInt(req.params.projectId, 10);
            console.log(`[DailyLogController] Fetching logs for project ID: ${projectId}`);

            const logs = await this.dailyLogsRepo.getDailyLogsForProject(projectId);

            console.log(`[DailyLogController] Found ${logs.length} logs for project ID: ${projectId}`);
            res.status(200).json(logs);
        } catch (error) {
             console.error('[DailyLogController] Error in getDailyLogsForProject:', error);
             next(new HttpError(500, 'Failed to retrieve daily logs.', error instanceof Error ? error.message : String(error)));
        }
    }

    // POST /api/projects/:projectId/daily-logs
    async createDailyLog(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const projectId = parseInt(req.params.projectId, 10);
            const user = req.user as User; // Assuming isAuthenticated middleware sets req.user

            // *** FIX: Validate against the schema that OMITS createdById ***
            const validationResult = createDailyLogInputSchema.safeParse(req.body);
            if (!validationResult.success) {
                console.error("[DailyLogController] Validation Error:", validationResult.error.flatten());
                throw new HttpError(400, 'Invalid daily log data.', validationResult.error.flatten());
            }

            // Handle file uploads
            const uploadedFiles = req.files as Express.Multer.File[] | undefined;
            let photoUrls: string[] = [];

            if (uploadedFiles && uploadedFiles.length > 0) {
                console.log(`[DailyLogController] Received ${uploadedFiles.length} files to upload.`);
                // Implement actual upload logic here
                // photoUrls = await Promise.all(uploadedFiles.map(async (file) => { ... }));
                photoUrls = uploadedFiles.map(f => `placeholder/url/for/${f.originalname}`); // Placeholder
                console.log(`[DailyLogController] Placeholder photo URLs: ${photoUrls.join(', ')}`);
            }

            // *** FIX: Construct logData using validated data AND add createdById from req.user ***
            const logData = {
                ...validationResult.data, // Use validated data (which doesn't have createdById)
                projectId: projectId,     // Add projectId from URL param
                createdById: user.id,     // *** ADD createdById from authenticated user ***
            };

            // Call repository method
            const newLog = await this.dailyLogsRepo.createDailyLog(logData);

            // Handle photo record creation if needed
            if (newLog && photoUrls.length > 0) {
                 console.log(`[DailyLogController] TODO: Implement saving photo URLs ${photoUrls} for log ID ${newLog.id}`);
                 // Example: await this.dailyLogsRepo.addPhotosToLog(newLog.id, photoUrls, user.id);
            }

            // Respond with the newly created log (potentially refetch if photos were added)
            res.status(201).json(newLog);
        } catch (error) {
             console.error('[DailyLogController] Error in createDailyLog:', error);
             next(error instanceof HttpError ? error : new HttpError(500, 'Failed to create daily log.', error instanceof Error ? error.message : String(error)));
        }
    }

    // PUT /api/projects/:projectId/daily-logs/:logId
    async updateDailyLog(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const logId = parseInt(req.params.logId, 10);

            // Validate request body against partial schema (still omits createdById)
            const validationResult = updateDailyLogInputSchema.safeParse(req.body);
            if (!validationResult.success) {
                throw new HttpError(400, 'Invalid daily log update data.', validationResult.error.flatten());
            }

            if (Object.keys(validationResult.data).length === 0) {
                throw new HttpError(400, 'No update data provided.');
            }

            // Call repository method
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
            const logId = parseInt(req.params.logId, 10);

            // TODO: Add logic to delete associated photos from R2/storage

            // Call repository method
            const success = await this.dailyLogsRepo.deleteDailyLog(logId);

            if (!success) {
                throw new HttpError(404, 'Daily log not found or could not be deleted.');
            }

            res.status(204).send();
        } catch (error) {
             console.error('[DailyLogController] Error in deleteDailyLog:', error);
             next(error instanceof HttpError ? error : new HttpError(500, 'Failed to delete daily log.', error instanceof Error ? error.message : String(error)));
        }
    }

}

// Instantiate and Export the controller
export const dailyLogController = new DailyLogController(storage);

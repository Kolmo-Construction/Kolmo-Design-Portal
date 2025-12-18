// server/controllers/punchList.controller.ts
import { Request, Response, NextFunction } from 'express'; // Added NextFunction
import { IPunchListRepository } from '../storage/repositories/punchList.repository';
import { InsertPunchListItem, User, punchListItems } from '@shared/schema'; // Use @shared alias
import { HttpError } from '../errors';
import { IMediaRepository } from '../storage/repositories/media.repository';
import { log as logger } from '../vite';
import { storage } from '../storage';
// *** ADDED: Import R2 upload function (adjust path if necessary) ***
import { uploadToR2 } from '../r2-upload';
import { approvalWorkflowService } from '../services/approval-workflow.service';

// Define request type interfaces
interface TypedRequestParams<T> extends Request {
    params: T;
}

interface TypedRequestBody<T> extends Request {
    body: T;
}

// Interface for request with file(s) from multer
interface RequestWithFile extends AuthenticatedRequest {
    file?: Express.Multer.File; // For single file upload
    files?: Express.Multer.File[]; // For multiple files
}

// Define AuthenticatedRequest locally
interface AuthenticatedRequest extends Request {
    user: User; // Use User type from schema
}

export class PunchListController {
    private punchListRepo: IPunchListRepository;
    private mediaRepo: IMediaRepository; // Keep if used for separate media endpoints

    constructor(
        punchListRepository: IPunchListRepository = storage.punchLists,
        mediaRepository: IMediaRepository = storage.media
    ) {
        this.punchListRepo = punchListRepository;
        this.mediaRepo = mediaRepository;

        // Bind methods
        this.getPunchListItemsForProject = this.getPunchListItemsForProject.bind(this);
        this.getPunchListItemById = this.getPunchListItemById.bind(this);
        this.createPunchListItem = this.createPunchListItem.bind(this);
        this.updatePunchListItem = this.updatePunchListItem.bind(this);
        this.deletePunchListItem = this.deletePunchListItem.bind(this);
        this.uploadPunchListItemMedia = this.uploadPunchListItemMedia.bind(this);
        this.deletePunchListItemMedia = this.deletePunchListItemMedia.bind(this);
    }

    // --- Get Methods (Unchanged) ---
    async getPunchListItemsForProject(req: TypedRequestParams<{ projectId: string }>, res: Response, next: NextFunction): Promise<void> {
        const projectId = Number(req.params.projectId);
        const user = req.user as User;
        if (isNaN(projectId)) {
            return next(new HttpError(400, 'Invalid project ID parameter.'));
        }
        try {
            let punchListItems = await this.punchListRepo.getPunchListItemsForProject(projectId);

            // Filter by visibility for client users
            if (user?.role === 'client') {
                punchListItems = punchListItems.filter(item => item.visibility === 'published');
            }

            res.status(200).json(punchListItems);
        } catch (error) {
            logger(`Error fetching punch list items for project ${projectId}: ${error instanceof Error ? error.message : error}`, 'PunchListController');
            next(new HttpError(500, 'Failed to fetch punch list items.')); // Use next for error handling
        }
    }

    async getPunchListItemById(req: TypedRequestParams<{ itemId: string }>, res: Response, next: NextFunction): Promise<void> {
        const itemId = Number(req.params.itemId);
        if (isNaN(itemId)) {
            return next(new HttpError(400, 'Invalid punch list item ID parameter.'));
        }
        try {
            const punchListItem = await this.punchListRepo.getPunchListItemById(itemId);
            if (!punchListItem) {
                return next(new HttpError(404, 'Punch list item not found.'));
            }
            res.status(200).json(punchListItem);
        } catch (error) {
            logger(`Error fetching punch list item ${itemId}: ${error instanceof Error ? error.message : error}`, 'PunchListController');
            next(error); // Propagate error
        }
    }

    // --- Create Method (Updated) ---
    async createPunchListItem(req: RequestWithFile, res: Response, next: NextFunction): Promise<void> {
        // Note: req.body contains text fields from FormData, req.file contains the uploaded file
        const textFields = req.body;
        const file = req.file; // Get the single uploaded file
        const userId = req.user?.id;
        const projectId = Number(req.params.projectId);

        logger(`Received create punch list request for project ${projectId}. File attached: ${!!file}`, 'PunchListController');

        if (!userId) {
            return next(new HttpError(401, 'Authentication required.'));
        }
        if (isNaN(projectId)) {
            return next(new HttpError(400, 'Invalid project ID parameter in route.'));
        }

        let uploadedPhotoUrl: string | undefined = undefined;
        let r2Key: string | undefined = undefined; // To store the key for potential cleanup

        try {
            // 1. Upload photo to R2 if it exists
            if (file) {
                logger(`Uploading file ${file.originalname} to R2...`, 'PunchListController');
                const r2Result = await uploadToR2({
                    projectId: projectId,
                    fileName: file.originalname,
                    buffer: file.buffer,
                    mimetype: file.mimetype,
                });
                uploadedPhotoUrl = r2Result.url; // Get the public URL
                r2Key = r2Result.key; // Store the key
                logger(`File uploaded successfully to ${uploadedPhotoUrl}`, 'PunchListController');
            }

            // 2. Prepare data for the database insert
            // Ensure dates and numbers are correctly parsed from FormData strings
            const itemData: InsertPunchListItem = {
                projectId: projectId,
                createdById: userId,
                description: textFields.description, // Required
                location: textFields.location || null,
                status: textFields.status || 'open',
                priority: textFields.priority || 'medium',
                assigneeId: textFields.assigneeId ? parseInt(textFields.assigneeId, 10) : null,
                dueDate: textFields.dueDate ? new Date(textFields.dueDate) : null,
                photoUrl: uploadedPhotoUrl, // Add the URL from R2 upload
                // createdAt, updatedAt, resolvedAt are handled by DB/repository
            };

            // Optional: Validate the constructed itemData again using Zod if needed
            // const validation = insertPunchListItemSchema.safeParse(itemData);
            // if (!validation.success) { ... }

            logger(`Attempting to save punch list item to DB...`, 'PunchListController');
            // 3. Save the item to the database
            const newPunchListItem = await this.punchListRepo.createPunchListItem(itemData);

            if (!newPunchListItem) {
                logger('Failed to create punch list item in repository.', 'PunchListController');
                throw new HttpError(500, 'Failed to save punch list item details.');
            }

            logger(`Punch list item ${newPunchListItem.id} created successfully.`, 'PunchListController');
            // Fetch the created item with details (if repository doesn't return full details)
            const createdItemWithDetails = await this.punchListRepo.getPunchListItemById(newPunchListItem.id);

            res.status(201).json(createdItemWithDetails || newPunchListItem); // Prefer detailed, fallback to basic

        } catch (error) {
            logger(`Error creating punch list item: ${error instanceof Error ? error.message : error}`, 'PunchListController');

            // *** ADDED: Attempt to clean up R2 upload if DB insert failed ***
            if (r2Key) {
                logger(`DB operation failed after R2 upload. Attempting to delete R2 object: ${r2Key}`, 'PunchListController');
                // Import deleteFromR2 if not already available
                // import { deleteFromR2 } from '../r2-upload'; // Adjust path
                // await deleteFromR2(r2Key).catch(cleanupError => {
                //     logger(`Failed to cleanup R2 object ${r2Key}: ${cleanupError}`, 'PunchListController');
                // });
            }
            // *** END ADDED ***

            next(error); // Propagate error to central handler
        }
    }


    // --- Update Method (Needs similar FormData handling if photo update is allowed) ---
    async updatePunchListItem(req: RequestWithFile, res: Response, next: NextFunction): Promise<void> {
        const itemId = Number(req.params.itemId);
        const textFields = req.body;
        const file = req.file;
        const removePhoto = req.body.removePhoto === 'true'; // Check for remove signal

        logger(`Received update punch list request for item ${itemId}. File attached: ${!!file}, Remove photo: ${removePhoto}`, 'PunchListController');

        if (isNaN(itemId)) {
            return next(new HttpError(400, 'Invalid punch list item ID parameter.'));
        }
        if (Object.keys(textFields).length === 0 && !file && !removePhoto) {
             return next(new HttpError(400, 'No update data or file provided.'));
        }
        if (!req.user?.id) {
            return next(new HttpError(401, 'Authentication required.'));
        }

        // TODO: Add authorization checks if needed

        let newPhotoUrl: string | undefined | null = undefined; // Use undefined to skip update, null to clear
        let r2KeyToCleanupOnError: string | undefined = undefined;

        try {
            // 1. Fetch existing item to potentially delete old photo
            const existingItem = await this.punchListRepo.getPunchListItemById(itemId);
            if (!existingItem) {
                return next(new HttpError(404, 'Punch list item not found.'));
            }
            const oldPhotoUrl = existingItem.photoUrl;

            // 2. Handle photo update/removal
            if (removePhoto) {
                newPhotoUrl = null; // Signal to clear the photoUrl in DB
                logger(`Marked photo for removal for item ${itemId}.`, 'PunchListController');
                // R2 deletion happens after successful DB update
            } else if (file) {
                logger(`Uploading new photo ${file.originalname} for item ${itemId}...`, 'PunchListController');
                const r2Result = await uploadToR2({
                    projectId: existingItem.projectId, // Use existing project ID
                    fileName: file.originalname,
                    buffer: file.buffer,
                    mimetype: file.mimetype,
                });
                newPhotoUrl = r2Result.url;
                r2KeyToCleanupOnError = r2Result.key; // Store key for potential cleanup
                logger(`New photo uploaded to ${newPhotoUrl}.`, 'PunchListController');
                 // Old photo deletion (if exists) happens after successful DB update
            }
            // If neither removePhoto nor file is present, newPhotoUrl remains undefined (no change)

            // 3. Prepare data for DB update
            const itemDataToUpdate: Partial<Omit<InsertPunchListItem, 'id' | 'projectId' | 'createdById'>> = {
                description: textFields.description,
                location: textFields.location,
                status: textFields.status,
                priority: textFields.priority,
                assigneeId: textFields.assigneeId ? parseInt(textFields.assigneeId, 10) : null,
                dueDate: textFields.dueDate ? new Date(textFields.dueDate) : null,
                 // Only include photoUrl if it's being changed (set to new URL or null)
                ...(newPhotoUrl !== undefined && { photoUrl: newPhotoUrl }),
            };

            // Remove undefined fields so they don't overwrite existing values with null
            Object.keys(itemDataToUpdate).forEach(key => itemDataToUpdate[key as keyof typeof itemDataToUpdate] === undefined && delete itemDataToUpdate[key as keyof typeof itemDataToUpdate]);

            logger(`Attempting to update punch list item ${itemId} in DB...`, 'PunchListController');
            // 4. Update item in DB
            const updatedPunchListItem = await this.punchListRepo.updatePunchListItem(itemId, itemDataToUpdate);

            if (!updatedPunchListItem) {
                // Should have been caught by the initial fetch, but check again
                throw new HttpError(404, 'Punch list item not found during update.');
            }

            logger(`Punch list item ${itemId} updated successfully in DB.`, 'PunchListController');

            // 5. Cleanup old R2 photo if replaced or removed
            // import { deleteFromR2 } from '../r2-upload'; // Adjust path
            // if (oldPhotoUrl && (newPhotoUrl !== undefined)) { // If photo was replaced or removed
            //     logger(`Deleting old R2 photo: ${oldPhotoUrl}`, 'PunchListController');
            //     const oldKey = oldPhotoUrl.substring(oldPhotoUrl.indexOf('/projects/')); // Extract key logic might need adjustment
            //     await deleteFromR2(oldKey).catch(delErr => {
            //         logger(`Warning: Failed to delete old R2 photo ${oldKey}: ${delErr}`, 'PunchListController');
            //         // Don't fail the request, just log the warning
            //     });
            // }

            // 6. Fetch and return full details
            const updatedItemWithDetails = await this.punchListRepo.getPunchListItemById(itemId);
            res.status(200).json(updatedItemWithDetails || updatedPunchListItem);

        } catch (error) {
            logger(`Error updating punch list item ${itemId}: ${error instanceof Error ? error.message : error}`, 'PunchListController');

            // Cleanup newly uploaded R2 photo if DB update failed
            // if (r2KeyToCleanupOnError) {
            //     logger(`DB update failed after R2 upload. Attempting to delete R2 object: ${r2KeyToCleanupOnError}`, 'PunchListController');
            //     await deleteFromR2(r2KeyToCleanupOnError).catch(cleanupError => {
            //         logger(`Failed to cleanup R2 object ${r2KeyToCleanupOnError}: ${cleanupError}`, 'PunchListController');
            //     });
            // }

            next(error);
        }
    }


    // --- Delete Method (Unchanged, assuming repo handles media deletion) ---
    async deletePunchListItem(req: TypedRequestParams<{ itemId: string }> & AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
        const itemId = Number(req.params.itemId);
        if (isNaN(itemId)) {
             return next(new HttpError(400, 'Invalid punch list item ID parameter.'));
        }
         if (!req.user?.id) {
            return next(new HttpError(401, 'Authentication required.'));
        }
        // Optional: Add authorization check
        try {
            const success = await this.punchListRepo.deletePunchListItem(itemId);
            if (!success) {
                 return next(new HttpError(404, 'Punch list item not found.'));
            }
            res.status(200).json({ message: 'Punch list item deleted successfully.' });
        } catch (error) {
            logger(`Error deleting punch list item ${itemId}: ${error instanceof Error ? error.message : error}`, 'PunchListController');
            next(error);
        }
    }

    // --- Separate Media Endpoints (Keep or remove based on final design) ---
    async uploadPunchListItemMedia(req: RequestWithFile, res: Response, next: NextFunction): Promise<void> {
        // Implementation for adding *additional* media items if needed
        // This would likely use mediaRepo.createMedia and link to punchListItemId
        next(new HttpError(501, 'Uploading additional media not implemented yet.'));
    }

    async deletePunchListItemMedia(req: TypedRequestParams<{ itemId: string; mediaId: string }> & AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
         // Implementation for deleting *specific* media items if needed
         next(new HttpError(501, 'Deleting specific media not implemented yet.'));
    }

    /**
     * Approve a punch list item (and optionally publish it)
     */
    async approvePunchListItem(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { itemId } = req.params;
            const itemIdNum = parseInt(itemId, 10);
            const user = req.user as User;
            const { publish = false } = req.body;

            if (isNaN(itemIdNum)) {
                throw new HttpError(400, 'Invalid punch list item ID parameter.');
            }
            if (!user?.id) {
                throw new HttpError(401, 'Authentication required.');
            }
            if (user.role !== 'admin') {
                throw new HttpError(403, 'Admin access required.');
            }

            const approvedItem = await approvalWorkflowService.approve(
                punchListItems,
                itemIdNum,
                user.id,
                publish
            );

            res.status(200).json(approvedItem);
        } catch (error) {
            logger.error('[PunchListController] Error in approvePunchListItem:', error);
            next(error);
        }
    }

    /**
     * Reject a punch list item
     */
    async rejectPunchListItem(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { itemId } = req.params;
            const itemIdNum = parseInt(itemId, 10);
            const user = req.user as User;
            const { reason } = req.body;

            if (isNaN(itemIdNum)) {
                throw new HttpError(400, 'Invalid punch list item ID parameter.');
            }
            if (!user?.id) {
                throw new HttpError(401, 'Authentication required.');
            }
            if (user.role !== 'admin') {
                throw new HttpError(403, 'Admin access required.');
            }

            const rejectedItem = await approvalWorkflowService.reject(
                punchListItems,
                itemIdNum,
                user.id,
                reason
            );

            res.status(200).json(rejectedItem);
        } catch (error) {
            logger.error('[PunchListController] Error in rejectPunchListItem:', error);
            next(error);
        }
    }

    /**
     * Publish a punch list item (make it visible to clients)
     */
    async publishPunchListItem(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { itemId } = req.params;
            const itemIdNum = parseInt(itemId, 10);
            const user = req.user as User;

            if (isNaN(itemIdNum)) {
                throw new HttpError(400, 'Invalid punch list item ID parameter.');
            }
            if (!user?.id) {
                throw new HttpError(401, 'Authentication required.');
            }
            if (user.role !== 'admin') {
                throw new HttpError(403, 'Admin access required.');
            }

            const publishedItem = await approvalWorkflowService.publish(
                punchListItems,
                itemIdNum
            );

            res.status(200).json(publishedItem);
        } catch (error) {
            logger.error('[PunchListController] Error in publishPunchListItem:', error);
            next(error);
        }
    }

    /**
     * Unpublish a punch list item (hide it from clients)
     */
    async unpublishPunchListItem(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { itemId } = req.params;
            const itemIdNum = parseInt(itemId, 10);
            const user = req.user as User;

            if (isNaN(itemIdNum)) {
                throw new HttpError(400, 'Invalid punch list item ID parameter.');
            }
            if (!user?.id) {
                throw new HttpError(401, 'Authentication required.');
            }
            if (user.role !== 'admin') {
                throw new HttpError(403, 'Admin access required.');
            }

            const unpublishedItem = await approvalWorkflowService.unpublish(
                punchListItems,
                itemIdNum
            );

            res.status(200).json(unpublishedItem);
        } catch (error) {
            logger.error('[PunchListController] Error in unpublishPunchListItem:', error);
            next(error);
        }
    }
}

// Export an instance
export const punchListController = new PunchListController();

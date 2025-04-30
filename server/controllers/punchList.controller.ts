// server/controllers/punchList.controller.ts
import { Request, Response } from 'express';
import { PunchListRepository } from '../storage/repositories/punchList.repository'; // Import the class if needed for typing/injection
import { InsertPunchListItem } from '@shared/schema'; // Use @shared alias
import type { TypedRequestBody, TypedRequestParams, TypedRequest } from '@server/types'; // Use @server alias
// import { AuthenticatedRequest } from '@server/middleware/auth.middleware'; // Assuming this type exists and is needed
// Define AuthenticatedRequest locally if not exported or adjust import
interface AuthenticatedRequest extends Request {
    user: { id: number; [key: string]: any }; // Define a minimal user structure
}

import { HttpError } from '../errors';
import { MediaRepository } from '../storage/repositories/media.repository';
import { log as logger } from '@server/vite'; // Corrected import path and renamed log to logger
import { storage } from '../storage'; // Assuming storage index exports instances


export class PunchListController {
    // Use specific repository types for clarity
    private punchListRepo: PunchListRepository;
    private mediaRepo: MediaRepository;

    constructor(
        punchListRepository: PunchListRepository = storage.punchLists, // Use correct property from storage
        mediaRepository: MediaRepository = storage.media // Use correct property from storage
    ) {
        this.punchListRepo = punchListRepository;
        this.mediaRepo = mediaRepository;
    }


    async getPunchListItemsForProject(req: TypedRequestParams<{ projectId: string }>, res: Response): Promise<void> {
        // Validate projectId properly
        const projectId = Number(req.params.projectId);
        if (isNaN(projectId)) {
            // Use HttpError for consistency
            throw new HttpError(400, 'Invalid project ID parameter.');
        }

        try {
            // Assuming the repository method exists and takes a number
            const punchListItems = await this.punchListRepo.getPunchListItems(projectId);
            res.status(200).json(punchListItems);
        } catch (error) {
            logger(`Error fetching punch list items for project ${projectId}: ${error instanceof Error ? error.message : error}`, 'PunchListController');
            // Propagate error for the central handler
            throw new HttpError(500, 'Failed to fetch punch list items.');
        }
    }

    async getPunchListItemById(req: TypedRequestParams<{ itemId: string }>, res: Response): Promise<void> {
        const itemId = Number(req.params.itemId);
        if (isNaN(itemId)) {
            throw new HttpError(400, 'Invalid punch list item ID parameter.');
        }

        try {
            const punchListItem = await this.punchListRepo.getPunchListItemById(itemId);
            if (!punchListItem) {
                throw new HttpError(404, 'Punch list item not found.');
            }
            res.status(200).json(punchListItem);
        } catch (error) {
            logger(`Error fetching punch list item ${itemId}: ${error instanceof Error ? error.message : error}`, 'PunchListController');
            // Rethrow or handle specific errors (like HttpError from repo)
             if (error instanceof HttpError) {
                 throw error; // Propagate known HTTP errors
             }
            throw new HttpError(500, 'Failed to fetch punch list item.');
        }
    }


    async createPunchListItem(req: TypedRequestBody<Omit<InsertPunchListItem, 'projectId' | 'createdById' | 'id' | 'createdAt' | 'updatedAt' | 'resolvedAt'>> & AuthenticatedRequest, res: Response): Promise<void> {
        const itemData = req.body;
        const userId = req.user?.id;
        const projectId = Number(req.params.projectId); // Get projectId from route params

        if (!userId) {
             throw new HttpError(401, 'Authentication required.');
        }
        if (isNaN(projectId)) {
            throw new HttpError(400, 'Invalid project ID parameter in route.');
        }

        try {
            // Add server-set fields
            const fullItemData: InsertPunchListItem = {
                ...itemData,
                projectId: projectId, // Add projectId from params
                createdById: userId, // Assign the creating user
                // Ensure other fields like photoUrl are handled correctly (likely null/undefined initially)
            };

            // Validate with Zod schema before sending to repository if not done by middleware
            // const validation = insertPunchListItemSchema.safeParse(fullItemData);
            // if (!validation.success) {
            //     throw new HttpError(400, 'Invalid punch list item data.', validation.error.flatten());
            // }

            const newPunchListItem = await this.punchListRepo.createPunchListItem(fullItemData);

            if (!newPunchListItem) {
                logger('Failed to create punch list item, repository returned null.', 'PunchListController');
                throw new HttpError(500, 'Failed to create punch list item.');
            }

            // Fetch the created item with details (if repository doesn't return full details)
            const createdItemWithDetails = await this.punchListRepo.getPunchListItemById(newPunchListItem.id);

             if (!createdItemWithDetails) {
                 logger(`Successfully created item ${newPunchListItem.id} but failed to fetch with details.`, 'PunchListController');
                 // Return basic item as fallback, but log the inconsistency
                 res.status(201).json(newPunchListItem);
                 return;
             }

            res.status(201).json(createdItemWithDetails);
        } catch (error) {
            logger(`Error creating punch list item: ${error instanceof Error ? error.message : error}`, 'PunchListController');
             if (error instanceof HttpError) {
                 throw error; // Propagate known HTTP errors
             }
            throw new HttpError(500, 'Failed to create punch list item.');
        }
    }


    async updatePunchListItem(req: TypedRequest<{ itemId: string }, Partial<Omit<InsertPunchListItem, 'id' | 'projectId' | 'createdById'>>> & AuthenticatedRequest, res: Response): Promise<void> {
        const itemId = Number(req.params.itemId);
        const itemDataToUpdate = req.body;

        if (isNaN(itemId)) {
            throw new HttpError(400, 'Invalid punch list item ID parameter.');
        }
        if (Object.keys(itemDataToUpdate).length === 0) {
             throw new HttpError(400, 'No update data provided.');
        }
        if (!req.user?.id) { // Ensure user is authenticated
            throw new HttpError(401, 'Authentication required.');
        }

        // Optional: Add fine-grained authorization check here

        try {
            // Ensure forbidden fields aren't in the update payload
            // delete itemDataToUpdate.id; // Should be excluded by type already
            // delete itemDataToUpdate.projectId;
            // delete itemDataToUpdate.createdById;

            const updatedPunchListItem = await this.punchListRepo.updatePunchListItem(itemId, itemDataToUpdate);

            if (!updatedPunchListItem) {
                throw new HttpError(404, 'Punch list item not found or update failed.');
            }

            // Fetch the updated item with details for consistency
            const updatedItemWithDetails = await this.punchListRepo.getPunchListItemById(itemId);

             if (!updatedItemWithDetails) {
                 logger(`Successfully updated item ${itemId} but failed to fetch with details.`, 'PunchListController');
                 res.status(200).json(updatedPunchListItem); // Return basic item as fallback
                 return;
             }

            res.status(200).json(updatedItemWithDetails);

        } catch (error) {
            logger(`Error updating punch list item ${itemId}: ${error instanceof Error ? error.message : error}`, 'PunchListController');
             if (error instanceof HttpError) {
                 throw error; // Propagate known HTTP errors
             }
            throw new HttpError(500, 'Failed to update punch list item.');
        }
    }


    async deletePunchListItem(req: TypedRequestParams<{ itemId: string }> & AuthenticatedRequest, res: Response): Promise<void> {
        const itemId = Number(req.params.itemId);
        if (isNaN(itemId)) {
             throw new HttpError(400, 'Invalid punch list item ID parameter.');
        }
         if (!req.user?.id) { // Ensure user is authenticated
            throw new HttpError(401, 'Authentication required.');
        }

        // Optional: Add fine-grained authorization check here

        try {
            // Repository method should handle deleting associated media from storage and DB
            const success = await this.punchListRepo.deletePunchListItem(itemId); // Assuming repo returns boolean or throws

            if (!success) {
                // This might mean the item didn't exist in the first place
                 throw new HttpError(404, 'Punch list item not found.');
            }

            res.status(200).json({ message: 'Punch list item deleted successfully.' }); // Send 200 with message or 204 No Content
            // res.status(204).send(); // Alternative: No Content response
        } catch (error) {
            logger(`Error deleting punch list item ${itemId}: ${error instanceof Error ? error.message : error}`, 'PunchListController');
             if (error instanceof HttpError) {
                 throw error; // Propagate known HTTP errors
             }
            throw new HttpError(500, 'Failed to delete punch list item.');
        }
    }

    // --- Media Handling Methods ---

    // Assuming upload middleware (like multer) processes files and adds them to req.files
    async uploadPunchListItemMedia(req: TypedRequestParams<{ itemId: string }> & AuthenticatedRequest & { files: Express.Multer.File[] }, res: Response): Promise<void> {
        const itemId = Number(req.params.itemId);
        const userId = req.user?.id;

        if (isNaN(itemId)) {
            throw new HttpError(400, 'Invalid punch list item ID parameter.');
        }
        if (!userId) {
            throw new HttpError(401, 'Authentication required.');
        }
        if (!req.files || req.files.length === 0) {
            throw new HttpError(400, 'No files uploaded.');
        }

        // Optional: Verify the punch list item exists and the user has permissions

        try {
            // Assuming mediaRepo.addMediaToPunchListItem handles R2 upload and DB record creation
            const uploadedMedia = await this.mediaRepo.addMediaToPunchListItem(itemId, req.files, userId);

            res.status(201).json(uploadedMedia);

        } catch (error) {
            logger(`Error uploading media for punch list item ${itemId}: ${error instanceof Error ? error.message : error}`, 'PunchListController');
            // Consider rolling back R2 uploads if DB fails
            if (error instanceof HttpError) {
                 throw error; // Propagate known HTTP errors
             }
            throw new HttpError(500, 'Failed to upload media.');
        }
    }

    async deletePunchListItemMedia(req: TypedRequestParams<{ itemId: string; mediaId: string }> & AuthenticatedRequest, res: Response): Promise<void> {
        const itemId = Number(req.params.itemId); // For context/auth checks
        const mediaId = Number(req.params.mediaId);

        if (isNaN(itemId) || isNaN(mediaId)) {
            throw new HttpError(400, 'Invalid item or media ID parameter.');
        }
        if (!req.user?.id) {
            throw new HttpError(401, 'Authentication required.');
        }

        // Optional: Verify media belongs to item and user has permissions

        try {
            // Assuming mediaRepo.deleteMedia handles R2 deletion and DB record removal
            const success = await this.mediaRepo.deleteMedia(mediaId); // Assuming returns boolean or throws

            if (!success) {
                 throw new HttpError(404, 'Media item not found.');
            }

            res.status(200).json({ message: 'Media item deleted successfully.', deletedMediaId: mediaId });
            // res.status(204).send(); // Alternative: No Content response

        } catch (error) {
            logger(`Error deleting media ${mediaId} for punch list item ${itemId}: ${error instanceof Error ? error.message : error}`, 'PunchListController');
             if (error instanceof HttpError) {
                 throw error; // Propagate known HTTP errors
             }
            throw new HttpError(500, 'Failed to delete media.');
        }
    }

    // Optional: Get media for a specific punch list item
    // async getPunchListItemMedia(req: TypedRequestParams<{ itemId: string }>, res: Response): Promise<void> {
    //     const itemId = Number(req.params.itemId);
    //      if (isNaN(itemId)) {
    //          throw new HttpError(400, 'Invalid punch list item ID');
    //      }
    //      try {
    //          // Assuming mediaRepo has a method like this
    //          const media = await this.mediaRepo.getMediaForPunchListItem(itemId);
    //          res.status(200).json(media);
    //      } catch (error) {
    //           logger(`Error fetching media for punch list item ${itemId}: ${error instanceof Error ? error.message : error}`, 'PunchListController');
    //           throw new HttpError(500, 'Failed to fetch media.');
    //      }
    // }
}

// Export an instance (or use dependency injection)
export const punchListController = new PunchListController();


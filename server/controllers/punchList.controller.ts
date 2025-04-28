// server/controllers/punchList.controller.ts
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
// Updated import path for the aggregated storage object
import { storage } from '../storage';
// Import specific types from the new types file
import { PunchListItemWithDetails, MediaItem } from '../storage/types';
import {
  insertPunchListItemSchema,
  punchListItemStatusEnum,
  insertMediaSchema,
  User,
} from '../../shared/schema';
import { HttpError } from '../errors';
// R2 functions remain separate
import { uploadToR2, deleteFromR2 } from '../r2-upload';

// --- Zod Schemas (Unchanged) ---
const punchListItemCreateSchema = insertPunchListItemSchema.omit({ /*...*/ })
 .refine(data => data.description.trim().length > 0, { /*...*/ });

const punchListItemUpdateSchema = punchListItemCreateSchema.partial().extend({
  status: z.enum(punchListItemStatusEnum.enumValues).optional(),
});

const photoUploadMetaSchema = z.object({}); // Keep simple

// --- Controller Functions ---

/**
 * Get all punch list items for a specific project.
 */
export const getPunchListItemsForProject = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { projectId } = req.params;
    const projectIdNum = parseInt(projectId, 10);
    if (isNaN(projectIdNum)) { throw new HttpError(400, 'Invalid project ID parameter.'); }

    // Use the nested repository: storage.punchLists
    const items = await storage.punchLists.getPunchListItemsForProject(projectIdNum);
    res.status(200).json(items);
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new punch list item for a project.
 */
export const createPunchListItem = async (
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

    const validationResult = punchListItemCreateSchema.safeParse(req.body);
    if (!validationResult.success) { throw new HttpError(400, 'Invalid punch list item data.', validationResult.error.flatten()); }
    const validatedData = validationResult.data;

    const newItemData = {
        ...validatedData,
        projectId: projectIdNum,
        createdBy: user.id,
        // status handled by repo/default
    };

    // Use the nested repository: storage.punchLists
    const createdItem = await storage.punchLists.createPunchListItem(newItemData);

    if (!createdItem) { throw new HttpError(500, 'Failed to create punch list item.'); }

    res.status(201).json(createdItem); // Returns simpler type without media
  } catch (error) {
    next(error);
  }
};

/**
 * Update an existing punch list item.
 */
export const updatePunchListItem = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { itemId } = req.params;
    const itemIdNum = parseInt(itemId, 10);
    if (isNaN(itemIdNum)) { throw new HttpError(400, 'Invalid item ID parameter.'); }

    const validationResult = punchListItemUpdateSchema.safeParse(req.body);
    if (!validationResult.success) { throw new HttpError(400, 'Invalid punch list item data.', validationResult.error.flatten()); }
    const validatedData = validationResult.data;
    if (Object.keys(validatedData).length === 0) { throw new HttpError(400, 'No update data provided.'); }

    const updateData = {
        ...validatedData,
        completedAt: validatedData.status === 'COMPLETED' ? new Date() : (validatedData.status ? null : undefined),
    };

    // Use the nested repository: storage.punchLists
    const updatedItem = await storage.punchLists.updatePunchListItem(itemIdNum, updateData);

    if (!updatedItem) { throw new HttpError(404, 'Punch list item not found or update failed.'); }

    res.status(200).json(updatedItem); // Returns simpler type without media
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a punch list item and its associated photos.
 */
export const deletePunchListItem = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
    let keysToDelete: string[] = [];
    try {
        const { itemId } = req.params;
        const itemIdNum = parseInt(itemId, 10);
        if (isNaN(itemIdNum)) { throw new HttpError(400, 'Invalid item ID parameter.'); }

        // 1. Get Item AND Media Keys BEFORE deleting anything
        // Use the nested repository: storage.punchLists then storage.media
        const itemInfo = await storage.punchLists.getPunchListItemById(itemIdNum); // Fetches item with media
        if (!itemInfo) {
            throw new HttpError(404, 'Punch list item not found.');
        }
        // Extract keys directly from the fetched media items
        keysToDelete = itemInfo.mediaItems?.map((media: MediaItem) => media.storageKey) ?? [];

        // 2. Delete files from R2 (unchanged)
        if (keysToDelete.length > 0) {
            console.log(`Attempting to delete R2 keys for punch list item ${itemIdNum}: ${keysToDelete.join(', ')}`);
            const deletePromises = keysToDelete.map(key => deleteFromR2(key).catch(err => {
                console.error(`Failed to delete R2 key ${key} for item ${itemIdNum}:`, err); // Log only
            }));
            await Promise.all(deletePromises);
        }

        // 3. Delete punch list item and associated media DB records (transactional in repo)
        // Use the nested repository: storage.punchLists
        const success = await storage.punchLists.deletePunchListItem(itemIdNum);

        if (!success) {
             throw new HttpError(404, 'Punch list item not found or could not be deleted from database.');
        }

        res.status(204).send();

    } catch (error) {
        next(error);
    }
};


/**
 * Add a photo to a punch list item.
 */
export const addPhotoToPunchListItem = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
    let uploadedKey: string | null = null;
    let associatedProjectId: number | null = null;

    try {
        const { itemId } = req.params;
        const itemIdNum = parseInt(itemId, 10);
        const user = req.user as User;

        if (isNaN(itemIdNum)) { throw new HttpError(400, 'Invalid item ID parameter.'); }
        if (!user?.id) { throw new HttpError(401, 'Authentication required.'); }
        if (!req.file) { throw new HttpError(400, 'No photo file uploaded.'); }

        // 1. Fetch item to get projectId (optional: verify item exists)
        // Use the nested repository: storage.punchLists
        const item = await storage.punchLists.getPunchListItemById(itemIdNum); // Use existing getter
        if (!item) { throw new HttpError(404, 'Punch list item not found.'); }
        associatedProjectId = item.projectId; // Needed for R2 & DB record

        // 2. Upload photo to R2 (unchanged)
        const r2Result = await uploadToR2({
            projectId: associatedProjectId,
            fileName: req.file.originalname, buffer: req.file.buffer, mimetype: req.file.mimetype,
        });
        if (!r2Result || !r2Result.key) { throw new HttpError(500, 'Failed to upload photo to storage.'); }
        uploadedKey = r2Result.key;

        // 3. Create media record in database using MediaRepository
        const mediaData = {
            projectId: associatedProjectId,
            punchListItemId: itemIdNum, // Link to punch list item
            progressUpdateId: null, // Ensure other link is null
            uploadedBy: user.id,
            fileName: req.file.originalname, fileSize: req.file.size,
            mimeType: req.file.mimetype, storageKey: uploadedKey,
        };

        // Validate before insert using base media schema
        const dbSchemaValidation = insertMediaSchema.safeParse(mediaData);
        if (!dbSchemaValidation.success) {
            console.error("Media DB schema validation failed:", dbSchemaValidation.error);
            throw new HttpError(500, 'Internal server error preparing media data.');
        }

        // Use the nested repository: storage.media
        const createdMedia = await storage.media.createMediaItem(dbSchemaValidation.data);

        if (!createdMedia) { throw new HttpError(500, 'Failed to save photo metadata to database.'); }

        res.status(201).json(createdMedia);

    } catch (error) {
        // Cleanup R2 if DB failed
        if (uploadedKey && !(error instanceof HttpError && error.statusCode < 500)) {
             console.error("Error occurred after R2 upload for punch list photo, attempting cleanup:", error);
             try { await deleteFromR2(uploadedKey); console.log(`Attempted R2 cleanup for key: ${uploadedKey}`); }
             catch (cleanupError) { console.error("Error during R2 cleanup process:", cleanupError); }
        }
        next(error);
    }
};
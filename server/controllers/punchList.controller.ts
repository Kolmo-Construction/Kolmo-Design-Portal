import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import {
  insertPunchListItemSchema,
  punchListItemStatusEnum, // Ensure enum is available
  insertMediaSchema,
  User,
  MediaItem, // Assuming type for media items
  PunchListItem // Assuming type for punch list items
} from '../../shared/schema';
import { HttpError } from '../errors';
import { uploadToR2, deleteFromR2 } from '../r2-upload'; // Assuming R2 functions

// --- Zod Schemas for API Input Validation ---

// Schema for creating a punch list item
const punchListItemCreateSchema = insertPunchListItemSchema.omit({
  id: true,
  projectId: true, // Set from route parameter
  createdBy: true, // Set from authenticated user
  createdAt: true,
  updatedAt: true,
  completedAt: true, // Set based on status change
  // Status likely defaults to 'OPEN' on creation
  status: true,
}).refine(data => data.description.trim().length > 0, {
    message: "Description cannot be empty.",
    path: ["description"],
});

// Schema for updating a punch list item
const punchListItemUpdateSchema = punchListItemCreateSchema.partial().extend({
  // Allow status updates explicitly
  status: z.enum(punchListItemStatusEnum.enumValues).optional(),
});

// Schema for optional metadata with photo upload
const photoUploadMetaSchema = z.object({
  // Potentially add fields like a photo description if needed
});


// --- Controller Functions ---

/**
 * Get all punch list items for a specific project.
 * Assumes checkProjectAccess middleware runs before this.
 * Storage layer should join with creator details and associated media.
 */
export const getPunchListItemsForProject = async (
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
    // Assumes storage fetches items + creator info + media items
    const items = await storage.getPunchListItemsForProject(projectIdNum);
    res.status(200).json(items);
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new punch list item for a project.
 * Assumes isAdmin middleware runs before this.
 */
export const createPunchListItem = async (
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
      throw new HttpError(401, 'Authentication required.');
    }
    // isAdmin middleware verified access

    const validationResult = punchListItemCreateSchema.safeParse(req.body);
    if (!validationResult.success) {
      throw new HttpError(400, 'Invalid punch list item data.', validationResult.error.flatten());
    }

    const validatedData = validationResult.data;

    // Prepare data for storage layer
    const newItemData = {
        ...validatedData,
        projectId: projectIdNum,
        createdBy: user.id,
        // Let storage/DB schema handle default status ('OPEN')
    };

    // Assumes storage saves and returns the new item with creator info
    const createdItem = await storage.createPunchListItem(newItemData);

    if (!createdItem) {
        throw new HttpError(500, 'Failed to create punch list item.');
    }

    res.status(201).json(createdItem);
  } catch (error) {
    next(error);
  }
};

/**
 * Update an existing punch list item.
 * Assumes isAdmin middleware runs before this (applied globally to the route).
 */
export const updatePunchListItem = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { itemId } = req.params;
    const itemIdNum = parseInt(itemId, 10);

    if (isNaN(itemIdNum)) {
      throw new HttpError(400, 'Invalid item ID parameter.');
    }
    // isAdmin middleware verified access globally

    const validationResult = punchListItemUpdateSchema.safeParse(req.body);
    if (!validationResult.success) {
      throw new HttpError(400, 'Invalid punch list item data.', validationResult.error.flatten());
    }

    const validatedData = validationResult.data;
    if (Object.keys(validatedData).length === 0) {
      throw new HttpError(400, 'No update data provided.');
    }

    // Prepare data for storage, handling status change
    const updateData = {
        ...validatedData,
        // Set completedAt if status changes to 'COMPLETED'
        ...(validatedData.status === 'COMPLETED' && { completedAt: new Date() }),
        // Clear completedAt if status changes away from 'COMPLETED'
        ...(validatedData.status && validatedData.status !== 'COMPLETED' && { completedAt: null }),
    };


    const updatedItem = await storage.updatePunchListItem(itemIdNum, updateData); // Assumes storage.updatePunchListItem exists

    if (!updatedItem) {
        throw new HttpError(404, 'Punch list item not found or update failed.');
    }

    res.status(200).json(updatedItem);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a punch list item and its associated photos.
 * Assumes isAdmin middleware runs before this (applied globally to the route).
 */
export const deletePunchListItem = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { itemId } = req.params;
    const itemIdNum = parseInt(itemId, 10);

    if (isNaN(itemIdNum)) {
      throw new HttpError(400, 'Invalid item ID parameter.');
    }
    // isAdmin middleware verified access globally

    // 1. Fetch item to get associated media keys
    // Assumes storage.getPunchListItemById includes media items
    const itemToDelete = await storage.getPunchListItemById(itemIdNum);

    if (!itemToDelete) {
       throw new HttpError(404, 'Punch list item not found.');
    }

    // 2. Delete associated photos from R2 (if any)
    if (itemToDelete.mediaItems && itemToDelete.mediaItems.length > 0) {
        const keysToDelete = itemToDelete.mediaItems.map((media: MediaItem) => media.storageKey);
        console.log(`Attempting to delete R2 keys for punch list item ${itemIdNum}: ${keysToDelete.join(', ')}`);
        const deletePromises = keysToDelete.map(key => deleteFromR2(key).catch(err => {
            // Log errors but don't stop the process
            console.error(`Failed to delete R2 key ${key} for item ${itemIdNum}:`, err);
        }));
        await Promise.all(deletePromises);
    }

    // 3. Delete the punch list item from the database
    // Storage layer should handle cascading delete of associated media table rows.
    const success = await storage.deletePunchListItem(itemIdNum); // Assumes storage.deletePunchListItem exists

    if (!success) {
       // This might happen if delete failed unexpectedly after fetching
       throw new HttpError(500, 'Failed to delete punch list item from database.');
    }

    res.status(204).send(); // No content on successful delete
  } catch (error) {
    next(error);
  }
};


/**
 * Add a photo to a punch list item.
 * Assumes isAdmin and upload.single('photo') middleware run before this.
 */
export const addPhotoToPunchListItem = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
    let uploadedKey: string | null = null; // For potential cleanup
    let associatedProjectId: number | null = null;

    try {
        const { itemId } = req.params;
        const itemIdNum = parseInt(itemId, 10);
        const user = req.user as User;

        if (isNaN(itemIdNum)) {
            throw new HttpError(400, 'Invalid item ID parameter.');
        }
         if (!user?.id) {
            throw new HttpError(401, 'Authentication required.');
        }
        // isAdmin middleware verified access globally

         if (!req.file) {
            throw new HttpError(400, 'No photo file uploaded.');
        }

        // Validate optional metadata if necessary
        // const metaValidation = photoUploadMetaSchema.safeParse(req.body);
        // ...

        // 1. Fetch the punch list item to get its project ID (needed for R2 path/DB record)
        const item = await storage.getPunchListItemById(itemIdNum);
        if (!item) {
            throw new HttpError(404, 'Punch list item not found.');
        }
        associatedProjectId = item.projectId; // Store for potential cleanup

        // 2. Upload photo to R2
        const r2Result = await uploadToR2({
            projectId: associatedProjectId,
            // Consider a subfolder for punch list items? e.g., `punchlist/${itemIdNum}`
            // Or keep flat within project folder, DB relation is key.
            fileName: req.file.originalname,
            buffer: req.file.buffer,
            mimetype: req.file.mimetype,
        });

        if (!r2Result || !r2Result.key) {
            throw new HttpError(500, 'Failed to upload photo to storage.');
        }
        uploadedKey = r2Result.key; // Track successful upload

        // 3. Create media record in database, linking it to the punch list item
        const mediaData = {
            projectId: associatedProjectId,
            punchListItemId: itemIdNum, // Link to the punch list item
            uploadedBy: user.id,
            fileName: req.file.originalname,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
            storageKey: uploadedKey,
            // url: r2Result.url // Optional
        };

        // Validate before insert
        const dbSchemaValidation = insertMediaSchema.safeParse(mediaData);
        if (!dbSchemaValidation.success) {
            console.error("Media DB schema validation failed:", dbSchemaValidation.error);
            throw new HttpError(500, 'Internal server error preparing media data.');
        }

        // Use a specific storage method to create the media linked to the punch item
        const createdMedia = await storage.createMediaItem(dbSchemaValidation.data);

        if (!createdMedia) {
            throw new HttpError(500, 'Failed to save photo metadata to database.');
        }

        res.status(201).json(createdMedia);

    } catch (error) {
        // *** Cleanup Attempt ***
        if (uploadedKey && !(error instanceof HttpError && error.statusCode < 500)) {
             console.error("Error occurred after R2 upload for punch list photo, attempting cleanup:", error);
             try {
                await deleteFromR2(uploadedKey);
                console.log(`Attempted R2 cleanup for key: ${uploadedKey}`);
             } catch (cleanupError) {
                 console.error("Error during R2 cleanup process:", cleanupError);
             }
        }
        next(error);
    }
};
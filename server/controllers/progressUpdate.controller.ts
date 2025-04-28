import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import {
  insertProgressUpdateSchema,
  insertMediaSchema, // Needed for media data structure
  User,
  MediaItem, // Assuming a type/interface for returned media
} from '../../shared/schema';
import { HttpError } from '../errors';
import { uploadToR2, deleteFromR2 } from '../r2-upload'; // Assuming R2 functions

// --- Zod Schema for API Input Validation ---

// Schema for creating a progress update (expects title and description)
const progressUpdateCreateSchema = insertProgressUpdateSchema.pick({
  title: true,
  description: true,
}).refine(data => data.title.trim().length > 0, {
  message: "Title cannot be empty.",
  path: ["title"],
}).refine(data => data.description.trim().length > 0, {
  message: "Description cannot be empty.",
  path: ["description"],
});


// Interface for R2 upload result (adjust based on actual r2-upload implementation)
interface R2UploadResult {
    key: string;
    url?: string; // Optional URL if returned/needed
}

// --- Controller Functions ---

/**
 * Get all progress updates for a specific project.
 * Assumes checkProjectAccess middleware runs before this.
 * Storage layer should join with author details and associated media.
 */
export const getProgressUpdatesForProject = async (
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
    // Assumes storage.getProgressUpdatesForProject fetches updates, author info, and media items
    const updates = await storage.getProgressUpdatesForProject(projectIdNum);
    res.status(200).json(updates);
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new progress update, optionally with attached photos.
 * Assumes isAdmin (or similar role) and upload.array('photos') middleware run before this.
 */
export const createProgressUpdate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  let uploadedKeys: string[] = []; // Keep track of successful R2 uploads for potential cleanup

  try {
    const { projectId } = req.params;
    const projectIdNum = parseInt(projectId, 10);
    const user = req.user as User; // Authenticated user (Admin/PM)

    if (isNaN(projectIdNum)) {
      throw new HttpError(400, 'Invalid project ID parameter.');
    }
    if (!user?.id) {
      throw new HttpError(401, 'Authentication required.');
    }

    // 1. Validate text fields (title, description)
    const validationResult = progressUpdateCreateSchema.safeParse(req.body);
    if (!validationResult.success) {
      throw new HttpError(400, 'Invalid progress update data.', validationResult.error.flatten());
    }
    const { title, description } = validationResult.data;

    // 2. Handle optional photo uploads (`req.files` from Multer)
    const photosToCreate: Omit<MediaItem, 'id' | 'progressUpdateId' | 'createdAt'>[] = [];
    const files = req.files as Express.Multer.File[] | undefined; // Type assertion

    if (files && files.length > 0) {
      // Upload each file to R2
      const uploadPromises = files.map(file =>
        uploadToR2({
            projectId: projectIdNum,
            fileName: file.originalname,
            buffer: file.buffer, // Assumes MemoryStorage
            mimetype: file.mimetype,
        }).catch(err => {
            // Catch individual upload errors to allow others to succeed? Or fail all?
            // Let's log and skip the failed one for now.
            console.error(`Failed to upload ${file.originalname} to R2:`, err);
            return null; // Indicate failure for this file
        })
      );

      const uploadResults = await Promise.all(uploadPromises);

      // Prepare media data for successful uploads
      for (let i = 0; i < files.length; i++) {
          const result = uploadResults[i];
          const file = files[i];
          if (result && result.key) {
              uploadedKeys.push(result.key); // Track successful uploads
              photosToCreate.push({
                  projectId: projectIdNum,
                  uploadedBy: user.id,
                  fileName: file.originalname,
                  fileSize: file.size,
                  mimeType: file.mimetype,
                  storageKey: result.key,
                  // url: result.url, // Include if available and needed
              });
          }
      }

      // Optional: If any R2 upload failed, decide whether to proceed or error out.
      // if (uploadResults.some(r => r === null)) {
      //     throw new HttpError(500, 'One or more photo uploads failed. Progress update not created.');
      // }
    }

    // 3. Create Progress Update and associated Media items in DB (ideally transactional)
    const updateData = {
        projectId: projectIdNum,
        authorId: user.id,
        title: title,
        description: description,
    };

    // Use a dedicated storage method to handle the transaction
    const createdUpdateWithMedia = await storage.createProgressUpdateWithMedia(
        updateData,
        photosToCreate // Pass the array of successfully uploaded media details
    ); // Assumes this storage method handles the DB transaction

    if (!createdUpdateWithMedia) {
        throw new HttpError(500, 'Failed to save progress update to database.');
    }

    res.status(201).json(createdUpdateWithMedia);

  } catch (error) {
    // *** Cleanup Attempt ***
    // If an error occurred *after* R2 uploads succeeded but *before* or *during* DB operations,
    // try to delete the orphaned files from R2.
    if (uploadedKeys.length > 0 && !(error instanceof HttpError && error.statusCode < 500)) { // Avoid cleanup for client errors
        console.error("Error occurred after R2 uploads, attempting cleanup:", error);
        try {
            // Call deleteFromR2 for each successfully uploaded key
            const cleanupPromises = uploadedKeys.map(key => deleteFromR2(key).catch(delErr => {
                console.error(`Failed to clean up R2 key ${key}:`, delErr); // Log cleanup errors
            }));
            await Promise.all(cleanupPromises);
            console.log(`Attempted R2 cleanup for keys: ${uploadedKeys.join(', ')}`);
        } catch (cleanupError) {
             console.error("Error during R2 cleanup process:", cleanupError);
        }
    }
    next(error); // Pass the original error to the central handler
  }
};

// Potential future controllers (if routes are added):
// export const deleteProgressUpdate = ... // Would need to delete associated media from R2 too
// export const updateProgressUpdate = ... // Complex if media can be added/removed
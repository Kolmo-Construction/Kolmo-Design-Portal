// server/controllers/progressUpdate.controller.ts
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
// Updated import path for the aggregated storage object
import { storage } from '../storage';
// Import specific types from the new types file
import { ProgressUpdateWithDetails, MediaItem } from '../storage/types';
import {
  insertProgressUpdateSchema,
  insertMediaSchema,
  User,
} from '../../shared/schema';
import { HttpError } from '../errors';
// R2 functions remain separate
import { uploadToR2, deleteFromR2 } from '../r2-upload';

// --- Zod Schema (Unchanged) ---
const progressUpdateCreateSchema = insertProgressUpdateSchema.pick({
  title: true,
  description: true,
}).refine(data => data.title.trim().length > 0, { /*...*/ })
  .refine(data => data.description.trim().length > 0, { /*...*/ });

// Interface for R2 upload result (adjust based on actual r2-upload implementation)
interface R2UploadResult { key: string; url?: string; }

// --- Controller Functions ---

/**
 * Get all progress updates for a specific project.
 */
export const getProgressUpdatesForProject = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { projectId } = req.params;
    const projectIdNum = parseInt(projectId, 10);
    if (isNaN(projectIdNum)) { throw new HttpError(400, 'Invalid project ID parameter.'); }

    // Use the nested repository: storage.progressUpdates
    const updates = await storage.progressUpdates.getProgressUpdatesForProject(projectIdNum);
    res.status(200).json(updates);
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new progress update, optionally with attached photos.
 */
export const createProgressUpdate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  let uploadedKeysAndFiles: { key: string, file: Express.Multer.File }[] = [];

  try {
    const { projectId } = req.params;
    const projectIdNum = parseInt(projectId, 10);
    const user = req.user as User;

    if (isNaN(projectIdNum)) { throw new HttpError(400, 'Invalid project ID parameter.'); }
    if (!user?.id) { throw new HttpError(401, 'Authentication required.'); }

    // 1. Validate text fields
    const validationResult = progressUpdateCreateSchema.safeParse(req.body);
    if (!validationResult.success) { throw new HttpError(400, 'Invalid progress update data.', validationResult.error.flatten()); }
    const { title, description } = validationResult.data;

    // 2. Handle optional photo uploads to R2
    const files = req.files as Express.Multer.File[] | undefined;
    const r2UploadPromises: Promise<R2UploadResult | null>[] = [];

    if (files && files.length > 0) {
      files.forEach(file => {
        r2UploadPromises.push(
          uploadToR2({
            projectId: projectIdNum, fileName: file.originalname,
            buffer: file.buffer, mimetype: file.mimetype,
          }).catch(err => {
            console.error(`Failed to upload ${file.originalname} to R2:`, err);
            return null; // Mark as failed
          })
        );
      });
    }

    const r2Results = await Promise.all(r2UploadPromises);

    // Prepare media data ONLY for successful R2 uploads
    const mediaItemsToCreate: Omit<schema.InsertMedia, 'id' | 'createdAt' | 'progressUpdateId' | 'punchListItemId'>[] = [];
    if (files && files.length > 0) {
        for (let i = 0; i < r2Results.length; i++) {
            const result = r2Results[i];
            const file = files[i];
            if (result && result.key) {
                uploadedKeysAndFiles.push({ key: result.key, file: file }); // Track for cleanup
                mediaItemsToCreate.push({
                    projectId: projectIdNum,
                    uploadedBy: user.id,
                    fileName: file.originalname,
                    fileSize: file.size,
                    mimeType: file.mimetype,
                    storageKey: result.key,
                    // url: result.url // Optional
                });
            } else {
                 // Optional: Throw error if any upload fails? Or just log and continue?
                 console.warn(`Skipping file ${file.originalname} due to R2 upload failure.`);
            }
        }
    }


    // 3. Create Progress Update and associated Media items in DB (transactional)
    const updateData = {
        projectId: projectIdNum,
        authorId: user.id,
        title: title,
        description: description,
    };

    // Use the nested repository: storage.progressUpdates
    // This repository method handles the transaction internally now
    const createdUpdateWithMedia = await storage.progressUpdates.createProgressUpdateWithMedia(
        updateData,
        mediaItemsToCreate // Pass successfully uploaded media details
    );

    if (!createdUpdateWithMedia) { throw new HttpError(500, 'Failed to save progress update to database.'); }

    res.status(201).json(createdUpdateWithMedia);

  } catch (error) {
    // Cleanup R2 uploads if DB operations failed
    if (uploadedKeysAndFiles.length > 0 && !(error instanceof HttpError && error.statusCode < 500)) {
        console.error("Error occurred after R2 uploads, attempting cleanup:", error);
        const cleanupPromises = uploadedKeysAndFiles.map(item =>
            deleteFromR2(item.key).catch(delErr => {
                console.error(`Failed to clean up R2 key ${item.key}:`, delErr);
            })
        );
        await Promise.all(cleanupPromises);
        console.log(`Attempted R2 cleanup for keys: ${uploadedKeysAndFiles.map(i => i.key).join(', ')}`);
    }
    next(error);
  }
};

/**
 * Delete a progress update and its associated media.
 */
export const deleteProgressUpdate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
    // Note: Route for this needs to be added in progressUpdate.routes.ts
    // Example route: DELETE /api/progress-updates/:updateId (requires isAdmin middleware)
    let keysToDelete: string[] = [];
    try {
        const { updateId } = req.params;
        const updateIdNum = parseInt(updateId, 10);
        if (isNaN(updateIdNum)) { throw new HttpError(400, 'Invalid update ID parameter.'); }

        // 1. Get media keys for R2 deletion BEFORE deleting DB records
        // Use the nested repository: storage.progressUpdates
        const updateInfo = await storage.progressUpdates.getProgressUpdateWithMediaKeys(updateIdNum);
        if (!updateInfo) {
            throw new HttpError(404, 'Progress update not found.');
        }
        keysToDelete = updateInfo.keys;

        // 2. Delete files from R2
        if (keysToDelete.length > 0) {
            console.log(`Attempting to delete R2 keys for progress update ${updateIdNum}: ${keysToDelete.join(', ')}`);
            const deletePromises = keysToDelete.map(key => deleteFromR2(key).catch(err => {
                // Log errors but proceed with DB deletion attempt
                 console.error(`Failed to delete R2 key ${key} for update ${updateIdNum}:`, err);
            }));
            await Promise.all(deletePromises);
        }

        // 3. Delete progress update and associated media DB records (transactional in repo)
        // Use the nested repository: storage.progressUpdates
        const success = await storage.progressUpdates.deleteProgressUpdate(updateIdNum);

        if (!success) {
            // This might happen if the item was deleted between fetch and delete, or DB error
            throw new HttpError(404, 'Progress update not found or could not be deleted from database.');
        }

        res.status(204).send();

    } catch (error) {
         // If DB delete fails after R2 delete, R2 files are orphaned.
         next(error);
    }
};
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { insertDocumentSchema, User } from '../../shared/schema';
import { HttpError } from '../errors';
// Assuming r2-upload.ts exports functions for upload and delete
import { uploadToR2, deleteFromR2, getR2DownloadUrl } from '../r2-upload';

// --- Zod Schema for potential additional form fields ---
const documentUploadMetaSchema = z.object({
  description: z.string().optional(),
  // Add other potential fields sent along with the file
});

// --- Controller Functions ---

/**
 * Get all documents for a specific project.
 * Assumes checkProjectAccess middleware runs before this.
 */
export const getDocumentsForProject = async (
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
    const documents = await storage.getDocumentsForProject(projectIdNum); // Assumes storage.getDocumentsForProject exists
    res.status(200).json(documents);
  } catch (error) {
    next(error);
  }
};

/**
 * Upload a new document to a project.
 * Assumes checkProjectAccess and upload.single('file') middleware run before this.
 */
export const uploadDocument = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { projectId } = req.params;
    const projectIdNum = parseInt(projectId, 10);
    const user = req.user as User; // Authenticated user

    if (isNaN(projectIdNum)) {
      throw new HttpError(400, 'Invalid project ID parameter.');
    }
    if (!user?.id) {
      throw new HttpError(401, 'Authentication required.');
    }
    // Check if Multer middleware successfully processed a file
    if (!req.file) {
      throw new HttpError(400, 'No file uploaded. Please include a file in the request.');
    }

    // Validate any additional metadata fields if sent
    const metaValidation = documentUploadMetaSchema.safeParse(req.body);
    // We don't strictly fail here if meta is invalid, maybe just ignore it or log?
    // Decide based on requirements. Let's allow upload even without valid description.
    const description = metaValidation.success ? metaValidation.data.description : undefined;

    // 1. Upload file to R2 storage
    //    The uploadToR2 function needs access to projectId, file details from req.file
    const r2Result = await uploadToR2({
        projectId: projectIdNum,
        fileName: req.file.originalname,
        buffer: req.file.buffer, // Assumes Multer uses MemoryStorage
        mimetype: req.file.mimetype,
    }); // Assume r2Result contains { key: string; url?: string }

    if (!r2Result || !r2Result.key) {
       throw new HttpError(500, 'Failed to upload file to storage.');
    }

    // 2. Create document record in the database
    const documentData = {
      projectId: projectIdNum,
      uploadedBy: user.id,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      storageKey: r2Result.key, // Store the key returned by R2
      description: description, // Add validated description
      // Optional: Add r2Result.url if R2 provides it and you want to store it directly
    };

     // Validate against the Drizzle schema before insertion
    const dbSchemaValidation = insertDocumentSchema.safeParse(documentData);
     if (!dbSchemaValidation.success) {
        // This indicates an internal issue mapping data to the schema
        console.error("Document DB schema validation failed:", dbSchemaValidation.error);
        // Clean up R2 upload potentially? Or log for manual cleanup.
        // await deleteFromR2(r2Result.key); // Be careful with cleanup logic
        throw new HttpError(500, 'Internal server error preparing document data.');
    }


    const createdDocument = await storage.createDocument(dbSchemaValidation.data); // Assumes storage.createDocument exists

    res.status(201).json(createdDocument);
  } catch (error) {
    // If an error occurs after R2 upload but before DB insert, the R2 file might be orphaned.
    // Consider adding cleanup logic here or in a separate process if necessary.
    next(error);
  }
};


/**
 * Delete a document.
 * Assumes checkProjectAccess middleware runs before this.
 */
export const deleteDocument = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { projectId, documentId } = req.params;
    const projectIdNum = parseInt(projectId, 10);
    const documentIdNum = parseInt(documentId, 10);

    if (isNaN(projectIdNum) || isNaN(documentIdNum)) {
      throw new HttpError(400, 'Invalid project or document ID parameter.');
    }

     // checkProjectAccess middleware verified access to the project

    // 1. Fetch the document record to get the storageKey and verify ownership
    const document = await storage.getDocumentById(documentIdNum); // Assumes storage.getDocumentById exists

    if (!document) {
       throw new HttpError(404, 'Document not found.');
    }

    // Verify the document belongs to the specified project (important!)
    if (document.projectId !== projectIdNum) {
        throw new HttpError(403, 'Document does not belong to the specified project.');
    }

    // 2. Delete the file from R2 storage
    try {
        await deleteFromR2(document.storageKey); // Assumes deleteFromR2 exists and uses the key
    } catch (r2Error) {
        // Log the R2 deletion error but proceed to delete the DB record
        console.error(`Failed to delete document key ${document.storageKey} from R2:`, r2Error);
        // Depending on policy, you might choose to stop here or continue
    }

    // 3. Delete the document record from the database
    const success = await storage.deleteDocument(documentIdNum); // Assumes storage.deleteDocument exists

    if (!success) {
      // Should not happen if getDocumentById found it, but handle defensively
       throw new HttpError(500, 'Failed to delete document record from database.');
    }

    res.status(204).send(); // No content on successful delete
  } catch (error) {
    next(error);
  }
};


/**
 * Get a download URL for a specific document.
 * Assumes checkProjectAccess middleware runs before this.
 * Generates a pre-signed URL for secure, direct download from R2.
 */
export const getDocumentDownloadUrl = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { projectId, documentId } = req.params;
    const projectIdNum = parseInt(projectId, 10);
    const documentIdNum = parseInt(documentId, 10);

    if (isNaN(projectIdNum) || isNaN(documentIdNum)) {
      throw new HttpError(400, 'Invalid project or document ID parameter.');
    }

    // checkProjectAccess middleware verified access

    // 1. Fetch the document record to get the storageKey and verify ownership
    const document = await storage.getDocumentById(documentIdNum);

    if (!document) {
       throw new HttpError(404, 'Document not found.');
    }
    if (document.projectId !== projectIdNum) {
        throw new HttpError(403, 'Document does not belong to the specified project.');
    }

    // 2. Generate a pre-signed download URL from R2
    const downloadUrl = await getR2DownloadUrl(document.storageKey, document.fileName); // Assumes getR2DownloadUrl exists

    if (!downloadUrl) {
        throw new HttpError(500, 'Could not generate download URL.');
    }

    // 3. Send the URL back to the client
    res.status(200).json({ downloadUrl });

    // Alternative: Redirect the client directly
    // res.redirect(downloadUrl);

  } catch (error) {
    next(error);
  }
};
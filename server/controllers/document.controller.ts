import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
// Updated import path for the aggregated storage object
import { storage } from '../storage/index';
// Import DocumentWithUploader directly from repository
import { DocumentWithUploader } from '../storage/repositories/document.repository';
import { insertDocumentSchema, User } from '../../shared/schema'; // Keep User type
import { HttpError } from '../errors';
// R2 functions are separate from the storage repository
import { uploadToR2, deleteFromR2, getR2DownloadUrl } from '../r2-upload';

// --- Zod Schema for potential additional form fields (Unchanged) ---
const documentUploadMetaSchema = z.object({
  description: z.string().optional(),
});

// --- Controller Functions ---

/**
 * Get all documents for a specific project.
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

    // Use the nested repository: storage.documents
    const documents = await storage.documents.getDocumentsForProject(projectIdNum);
    res.status(200).json(documents);
  } catch (error) {
    next(error);
  }
};

/**
 * Upload a new document to a project.
 */
export const uploadDocument = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  let uploadedKey: string | null = null; // For potential R2 cleanup

  try {
    const { projectId } = req.params;
    const projectIdNum = parseInt(projectId, 10);
    const user = req.user as User;

    if (isNaN(projectIdNum)) { throw new HttpError(400, 'Invalid project ID parameter.'); }
    if (!user?.id) { throw new HttpError(401, 'Authentication required.'); }
    if (!req.file) { throw new HttpError(400, 'No file uploaded.'); }

    const metaValidation = documentUploadMetaSchema.safeParse(req.body);
    const description = metaValidation.success ? metaValidation.data.description : undefined;

    // 1. Upload file to R2 storage (No change here)
    const r2Result = await uploadToR2({
        projectId: projectIdNum,
        fileName: req.file.originalname,
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
    });

    if (!r2Result || !r2Result.key) {
       throw new HttpError(500, 'Failed to upload file to storage.');
    }
    uploadedKey = r2Result.key; // Track successful upload

    // 2. Prepare document data for DB
    // Map fields to match the database schema
    const documentData = {
      projectId: projectIdNum,
      uploadedById: user.id, // Database field is 'uploadedById' not 'uploadedBy'
      name: req.file.originalname, // Database field is 'name' not 'fileName'
      fileSize: req.file.size,
      fileType: req.file.mimetype, // Database field is 'fileType' not 'mimeType'
      fileUrl: r2Result.key, // Database field is 'fileUrl' not 'storageKey'
      description: description,
      category: 'GENERAL', // Default category
    };

    // Validate against the Drizzle schema before insertion
    const dbSchemaValidation = insertDocumentSchema.safeParse(documentData);
     if (!dbSchemaValidation.success) {
        console.error("Document DB schema validation failed:", dbSchemaValidation.error);
        throw new HttpError(500, 'Internal server error preparing document data.');
    }

    // Use the nested repository: storage.documents
    const createdDocument = await storage.documents.createDocument(dbSchemaValidation.data);

    if (!createdDocument) {
        // Should not happen if insert is successful, but handle defensively
         throw new HttpError(500, 'Failed to save document record to database.');
    }

    res.status(201).json(createdDocument); // Return the basic document record

  } catch (error) {
     // Attempt R2 cleanup if DB insert failed after R2 upload
    if (uploadedKey && !(error instanceof HttpError && error.statusCode < 500)) {
        console.error("Error occurred after R2 upload for document, attempting cleanup:", error);
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


/**
 * Delete a document.
 */
export const deleteDocument = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  let storageKeyToDelete: string | null = null;
  try {
    const { projectId, documentId } = req.params;
    const projectIdNum = parseInt(projectId, 10);
    const documentIdNum = parseInt(documentId, 10);

    if (isNaN(projectIdNum) || isNaN(documentIdNum)) {
      throw new HttpError(400, 'Invalid project or document ID parameter.');
    }

    // 1. Fetch the document record to get the storageKey and verify ownership
    // Use the nested repository: storage.documents
    const document = await storage.documents.getDocumentById(documentIdNum);

    if (!document) { throw new HttpError(404, 'Document not found.'); }
    if (document.projectId !== projectIdNum) { throw new HttpError(403, 'Document does not belong to the specified project.'); }

    // Extract storage key from fileUrl (similar to download function)
    const fileUrl = document.fileUrl;
    let key = fileUrl;
    
    // Try to extract the key if it's a full URL
    if (fileUrl.includes('.com/')) {
      key = fileUrl.split('.com/')[1];
    } else if (fileUrl.includes('.dev/')) {
      key = fileUrl.split('.dev/')[1];
    } else if (fileUrl.includes('/')) {
      // Fallback: just use the part after the last slash
      key = fileUrl.split('/').pop() || fileUrl;
    }
    
    storageKeyToDelete = key;
    console.log(`Deleting file with key: ${storageKeyToDelete} from fileUrl: ${fileUrl}`);

    // 2. Delete the file from R2 storage
    await deleteFromR2(storageKeyToDelete);

    // 3. Delete the document record from the database
    // Use the nested repository: storage.documents
    const success = await storage.documents.deleteDocument(documentIdNum);

    if (!success) {
       // Should not happen normally if getDocumentById found it
       throw new HttpError(500, 'Failed to delete document record from database.');
    }

    res.status(204).send();
  } catch (error) {
     // Note: If DB delete fails after successful R2 delete, the file is orphaned.
     // More robust handling might re-try DB delete or log for manual intervention.
     // If R2 delete fails, we still proceed to delete DB record (as per original logic).
     if (error instanceof HttpError) return next(error); // Pass client errors
     if (error === deleteFromR2) { // Check if the error originated from R2 delete
        console.error(`Failed to delete document key ${storageKeyToDelete} from R2, but proceeding with DB delete:`, error);
        // If R2 fails, we still attempt DB delete in the original logic.
        // If DB delete *also* fails, the outer catch handles it.
        // If DB delete succeeds after R2 fail, the DB record is gone but R2 file remains (orphan).
        // To ensure DB delete runs even after R2 error, the logic would need adjustment,
        // but let's stick to original flow for now (R2 error stops execution before DB delete).
        console.error(`Failed to delete document key ${storageKeyToDelete} from R2:`, error);
        // Pass the error to the client/central handler
        next(new HttpError(500, `Failed to delete file from storage. Error: ${error instanceof Error ? error.message : 'Unknown R2 error'}`));

     } else {
        // Handle other errors (DB errors, parameter errors passed via next)
        next(error);
     }
  }
};


/**
 * Get a download URL for a specific document.
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

    if (isNaN(projectIdNum) || isNaN(documentIdNum)) { throw new HttpError(400, 'Invalid project or document ID parameter.'); }

    // 1. Fetch the document record for storageKey and verification
    // Use the nested repository: storage.documents
    const document = await storage.documents.getDocumentById(documentIdNum);

    if (!document) { throw new HttpError(404, 'Document not found.'); }
    if (document.projectId !== projectIdNum) { throw new HttpError(403, 'Document does not belong to the specified project.'); }

    // 2. Extract the correct R2 key from fileUrl 
    // The field in the database is named fileUrl but it contains the R2 storage key
    const fileUrl = document.fileUrl;
    let key = fileUrl;
    
    // Try to extract the key if it's a full URL
    if (fileUrl.includes('.com/')) {
      key = fileUrl.split('.com/')[1];
    } else if (fileUrl.includes('.dev/')) {
      key = fileUrl.split('.dev/')[1];
    } else if (fileUrl.includes('/')) {
      // Fallback: just use the part after the last slash
      key = fileUrl.split('/').pop() || fileUrl;
    }

    console.log(`Generating download URL for key: ${key} from fileUrl: ${fileUrl}`);
    
    // Generate a pre-signed download URL from R2
    const downloadUrl = await getR2DownloadUrl(key, document.name);

    if (!downloadUrl) { throw new HttpError(500, 'Could not generate download URL.'); }

    res.status(200).json({ downloadUrl });

  } catch (error) {
    next(error);
  }
};

/**
 * Get all documents accessible by the current user.
 */
export const getAllAccessibleDocuments = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as User;

    if (!user?.id) {
      throw new HttpError(401, 'Authentication required.');
    }

    // Use the nested repository: storage.documents
    // For admin, get all documents, for others get only documents from their projects
    let documents;
    if (user.role === 'ADMIN') {
      documents = await storage.documents.getAllDocuments();
    } else {
      documents = await storage.documents.getDocumentsForUser(user.id);
    }

    res.status(200).json(documents);
  } catch (error) {
    next(error);
  }
};
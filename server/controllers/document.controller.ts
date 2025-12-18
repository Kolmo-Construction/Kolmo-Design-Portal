// server/controllers/document.controller.ts

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
// Updated import path for the aggregated storage object
import { storage } from '../storage/index';
// Import DocumentWithUploader directly from repository
import { DocumentWithUploader } from '../storage/repositories/document.repository';
import { insertDocumentSchema, User, documents } from '../../shared/schema'; // Keep User type and ensure it's correctly typed/imported
import { HttpError } from '../errors';
// R2 functions are separate from the storage repository
import { uploadToR2, deleteFromR2, getR2DownloadUrl } from '../r2-upload';
import { approvalWorkflowService } from '../services/approval-workflow.service';

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
    const user = req.user as User;

    if (isNaN(projectIdNum)) {
      throw new HttpError(400, 'Invalid project ID parameter.');
    }

    // Permissions check (example - adjust based on your needs)
    // Clients/PMs should only access projects they're assigned to.
    // This logic might be better placed in middleware or called via a service method
    // For now, assume storage.documents.getDocumentsForProject handles necessary permission checks internally
    // OR call checkProjectAccess helper if available and appropriate here.

    // Use the nested repository: storage.documents
    let documents = await storage.documents.getDocumentsForProject(projectIdNum);

    // Filter by visibility for client users
    if (user?.role === 'client') {
      documents = documents.filter(doc => doc.visibility === 'published');
    }

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
    const user = req.user as User; // Ensure User type is imported

    if (isNaN(projectIdNum)) { throw new HttpError(400, 'Invalid project ID parameter.'); }
    if (!user?.id) { throw new HttpError(401, 'Authentication required.'); }
    if (!req.file) { throw new HttpError(400, 'No file uploaded.'); }

    // --- Updated Permission Check for Upload ---
    // 1. Explicitly deny clients
    if (user.role === 'client') { // <-- ADDED CHECK FOR UPLOAD
        throw new HttpError(403, 'Clients do not have permission to upload documents.');
    }
    // 2. Allow Admins implicitly
    // 3. Check other roles (e.g., projectManager) for project access
    else if (user.role !== 'admin') {
      const hasAccess = await storage.projects.checkUserProjectAccess(user.id.toString(), projectIdNum);
      if (!hasAccess) {
        throw new HttpError(403, 'You do not have permission to upload documents to this project.');
      }
    }
    // --- End Permission Check ---


    const metaValidation = documentUploadMetaSchema.safeParse(req.body);
    const description = metaValidation.success ? metaValidation.data.description : undefined;

    // 1. Upload file to R2 storage
    const r2Result = await uploadToR2({
        fileName: req.file.originalname,
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        path: `projects/${projectIdNum}/documents/`,
    });

    if (!r2Result || !r2Result.key) {
       throw new HttpError(500, 'Failed to upload file to storage.');
    }
    uploadedKey = r2Result.key; // Track successful upload

    // 2. Prepare document data for DB
    const documentData = {
      projectId: projectIdNum,
      uploadedById: user.id,
      name: req.file.originalname,
      fileSize: req.file.size,
      fileType: req.file.mimetype,
      fileUrl: r2Result.url, // Store the full proxy URL, not just the key
      description: description,
      category: 'GENERAL', // Default category or derive from input
    };

    // 3. Validate against the Drizzle schema before insertion
    const dbSchemaValidation = insertDocumentSchema.safeParse(documentData);
     if (!dbSchemaValidation.success) {
        console.error("Document DB schema validation failed:", dbSchemaValidation.error);
        // Consider sending flattened errors to client: throw new HttpError(400, 'Invalid document data.', dbSchemaValidation.error.flatten());
        throw new HttpError(500, 'Internal server error preparing document data.');
    }

    // 4. Use the nested repository to create the document record
    const createdDocument = await storage.documents.createDocument(dbSchemaValidation.data);

    if (!createdDocument) {
         throw new HttpError(500, 'Failed to save document record to database.');
    }

    // Consider fetching the document with uploader details if needed for the response
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
    next(error); // Pass error to the final error handler
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
  const { projectId, documentId } = req.params;
  const documentIdNum = parseInt(documentId, 10);
  
  try {
    const projectIdNum = parseInt(projectId, 10);
    const user = req.user as User; // Ensure User type is imported

    if (isNaN(projectIdNum) || isNaN(documentIdNum)) {
      throw new HttpError(400, 'Invalid project or document ID parameter.');
    }
    if (!user?.id) { throw new HttpError(401, 'Authentication required.'); }

    // --- START: Updated Permission Check for Delete ---
    // Verify the user has permission to delete documents from this project

    // 1. Explicitly deny clients
    if (user.role === 'client') { // <--- ADDED THIS CHECK
        throw new HttpError(403, 'Clients do not have permission to delete documents.');
    }
    // 2. Allow Admins implicitly
    // 3. Check other roles (e.g., projectManager) for project access
    else if (user.role !== 'admin') { // Check non-admin, non-client roles
      const hasAccess = await storage.projects.checkUserProjectAccess(user.id.toString(), projectIdNum);
      if (!hasAccess) {
        throw new HttpError(403, 'You do not have permission to delete documents from this project.');
      }
    }
    // --- END: Updated Permission Check for Delete ---


    // 1. Fetch the document record to get the storageKey and verify ownership
    const document = await storage.documents.getDocumentById(documentIdNum);

    if (!document) { throw new HttpError(404, 'Document not found.'); }
    if (document.projectId !== projectIdNum) { throw new HttpError(403, 'Document does not belong to the specified project.'); }

    // 2. Extract storage key from fileUrl
    const fileUrl = document.fileUrl; // This field stores the R2 key
    let key = fileUrl;

    // Attempt to handle cases where full URLs might have been stored previously
    // This extraction logic might need adjustment based on how keys are actually stored
    if (fileUrl.includes('.com/')) {
      key = fileUrl.split('.com/').pop() || fileUrl;
    } else if (fileUrl.includes('.dev/')) {
      key = fileUrl.split('.dev/').pop() || fileUrl;
    }
    // Assuming the key is path-like if not a full URL
    storageKeyToDelete = key;
    console.log(`Attempting to delete file with key: ${storageKeyToDelete} from derived fileUrl: ${fileUrl}`);


    // 3. Delete the file from R2 storage
    await deleteFromR2(storageKeyToDelete);
    console.log(`Successfully deleted file ${storageKeyToDelete} from R2.`);


    // 4. Delete the document record from the database
    const success = await storage.documents.deleteDocument(documentIdNum);

    if (!success) {
       // This case might indicate a race condition or inconsistency if the doc existed moments ago
       console.warn(`Document ${documentIdNum} was not found for DB deletion after R2 deletion attempt.`);
       // Depending on requirements, you might still consider the operation successful
       // or throw an error indicating potential inconsistency.
       // For now, let's treat it as "not found" from the client's perspective if DB delete fails.
       throw new HttpError(404, 'Document not found for deletion in database.');
    }

    res.status(204).send(); // Successfully deleted

  } catch (error) {
     // Log the error regardless of type for server visibility
     console.error(`Error during document deletion (${documentId}):`, error);

     // Rethrow HttpErrors to be handled by the final error handler
     if (error instanceof HttpError) {
        return next(error);
     }

     // Handle potential R2 errors specifically if possible/needed
     // (Example check, might need refinement based on actual R2 error structure)
     if (error && typeof error === 'object' && 'name' in error && typeof error.name === 'string' && error.name.includes('S3')) {
        // If R2 delete failed, the DB record might still exist.
        // Consider if you should proceed with DB deletion or not.
        // Current logic stops here if R2 delete throws.
        next(new HttpError(500, `Failed to delete file from storage. Error: ${error instanceof Error ? error.message : 'Unknown R2 error'}`));
     } else {
        // Handle other unexpected errors (DB errors, etc.)
        next(new HttpError(500, 'An unexpected error occurred while deleting the document.'));
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
    const user = req.user as User; // Ensure User type is imported

    if (isNaN(projectIdNum) || isNaN(documentIdNum)) { throw new HttpError(400, 'Invalid project or document ID parameter.'); }
    if (!user?.id) { throw new HttpError(401, 'Authentication required.'); }

    // Verify the user has permission to download documents from this project
    // This uses the same project access check logic
    if (user.role !== 'ADMIN') {
      const hasAccess = await storage.projects.checkUserProjectAccess(user.id.toString(), projectIdNum);
      if (!hasAccess) {
        throw new HttpError(403, 'You do not have permission to download documents from this project.');
      }
    }

    // 1. Fetch the document record for storageKey and verification
    const document = await storage.documents.getDocumentById(documentIdNum);

    if (!document) { throw new HttpError(404, 'Document not found.'); }
    if (document.projectId !== projectIdNum) { throw new HttpError(403, 'Document does not belong to the specified project.'); }

    // 2. Extract the correct R2 key from fileUrl
    const fileUrl = document.fileUrl; // This field contains the R2 key
    let key = fileUrl;

    // Handle potential full URLs stored previously
    if (fileUrl.includes('.com/')) {
      key = fileUrl.split('.com/').pop() || fileUrl;
    } else if (fileUrl.includes('.dev/')) {
       key = fileUrl.split('.dev/').pop() || fileUrl;
    }
    // Assume key is path-like otherwise

    console.log(`Generating download URL for key: ${key} derived from fileUrl: ${fileUrl}`);

    // 3. Generate a pre-signed download URL from R2
    const downloadUrl = await getR2DownloadUrl(key, document.name); // Pass original name for content-disposition

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
    const user = req.user as User; // Ensure User type is imported

    if (!user?.id) {
      throw new HttpError(401, 'Authentication required.');
    }

    // Use the nested repository which handles role-based access internally
    const documents = await storage.documents.getDocumentsForUser(user.id);

    // Note: getDocumentsForUser already filters based on role (Admin sees all, others see their projects)
    // The DocumentWithUploader type mapping is also handled within the repository.

    res.status(200).json(documents);
  } catch (error) {
    next(error);
  }
};

/**
 * Approve a document (and optionally publish it)
 */
export const approveDocument = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { documentId } = req.params;
    const documentIdNum = parseInt(documentId, 10);
    const user = req.user as User;
    const { publish = false } = req.body;

    if (isNaN(documentIdNum)) {
      throw new HttpError(400, 'Invalid document ID parameter.');
    }
    if (!user?.id) {
      throw new HttpError(401, 'Authentication required.');
    }
    if (user.role !== 'admin') {
      throw new HttpError(403, 'Admin access required.');
    }

    const approvedDocument = await approvalWorkflowService.approve(
      documents,
      documentIdNum,
      user.id,
      publish
    );

    res.status(200).json(approvedDocument);
  } catch (error) {
    next(error);
  }
};

/**
 * Reject a document
 */
export const rejectDocument = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { documentId } = req.params;
    const documentIdNum = parseInt(documentId, 10);
    const user = req.user as User;
    const { reason } = req.body;

    if (isNaN(documentIdNum)) {
      throw new HttpError(400, 'Invalid document ID parameter.');
    }
    if (!user?.id) {
      throw new HttpError(401, 'Authentication required.');
    }
    if (user.role !== 'admin') {
      throw new HttpError(403, 'Admin access required.');
    }

    const rejectedDocument = await approvalWorkflowService.reject(
      documents,
      documentIdNum,
      user.id,
      reason
    );

    res.status(200).json(rejectedDocument);
  } catch (error) {
    next(error);
  }
};

/**
 * Publish a document (make it visible to clients)
 */
export const publishDocument = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { documentId } = req.params;
    const documentIdNum = parseInt(documentId, 10);
    const user = req.user as User;

    if (isNaN(documentIdNum)) {
      throw new HttpError(400, 'Invalid document ID parameter.');
    }
    if (!user?.id) {
      throw new HttpError(401, 'Authentication required.');
    }
    if (user.role !== 'admin') {
      throw new HttpError(403, 'Admin access required.');
    }

    const publishedDocument = await approvalWorkflowService.publish(
      documents,
      documentIdNum
    );

    res.status(200).json(publishedDocument);
  } catch (error) {
    next(error);
  }
};

/**
 * Unpublish a document (hide it from clients)
 */
export const unpublishDocument = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { documentId } = req.params;
    const documentIdNum = parseInt(documentId, 10);
    const user = req.user as User;

    if (isNaN(documentIdNum)) {
      throw new HttpError(400, 'Invalid document ID parameter.');
    }
    if (!user?.id) {
      throw new HttpError(401, 'Authentication required.');
    }
    if (user.role !== 'admin') {
      throw new HttpError(403, 'Admin access required.');
    }

    const unpublishedDocument = await approvalWorkflowService.unpublish(
      documents,
      documentIdNum
    );

    res.status(200).json(unpublishedDocument);
  } catch (error) {
    next(error);
  }
};
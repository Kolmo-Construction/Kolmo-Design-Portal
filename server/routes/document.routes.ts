// server/routes/document.routes.ts
import { Router } from "express";
import * as documentController from "@server/controllers/document.controller"; // Updated import
import { isAuthenticated } from "@server/middleware/auth.middleware"; // Updated import
import { upload } from "@server/middleware/upload.middleware"; // Updated import
import multer from 'multer'; // Import Multer type for error handling

// This router will handle routes nested under /api/projects/:projectId/documents
export const projectDocumentRouter = Router({ mergeParams: true }); // mergeParams needed to access :projectId

// This router will handle global document routes like /api/documents
export const globalDocumentRouter = Router();

// --- Project Specific Document Routes ---

// GET /api/projects/:projectId/documents/
// Fetches documents for the specific project (permissions checked in controller)
projectDocumentRouter.get("/", documentController.getProjectDocuments);

// POST /api/projects/:projectId/documents/
// Uploads a document for the specific project (permissions checked in controller)
// Apply Multer middleware first to handle file parsing
projectDocumentRouter.post(
    "/",
    (req, res, next) => {
        // Apply multer middleware specifically here
        upload.single('documentFile')(req, res, (err: any) => {
            if (err) {
                // Handle Multer errors (like file size limit or invalid type)
                if (err instanceof multer.MulterError) {
                    console.warn(`Multer error during upload: ${err.code} - ${err.message}`);
                    let friendlyMessage = "Failed to upload file.";
                    if (err.code === 'LIMIT_FILE_SIZE') friendlyMessage = `File exceeds size limit.`;
                    // Use message from middleware if available (set via callback in upload.middleware.ts)
                    else if (err.code === 'LIMIT_UNEXPECTED_FILE') friendlyMessage = err.message || 'Invalid file type.';
                    return res.status(400).json({ message: friendlyMessage, code: err.code });
                }
                // Handle other potential errors during upload middleware processing
                console.error("Error during upload middleware:", err);
                return res.status(500).json({ message: "An unexpected error occurred during file upload." });
            }
            // If no error, proceed to the controller
            next();
        });
    },
    documentController.uploadProjectDocument // Controller assumes req.file exists
);


// --- Global Document Routes ---

// GET /api/documents
// Fetches all documents accessible by the logged-in user (role checks in controller)
globalDocumentRouter.get("/", isAuthenticated, documentController.getAllAccessibleDocuments);
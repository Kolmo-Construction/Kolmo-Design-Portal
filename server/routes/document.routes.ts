// server/routes/document.routes.ts
import { Router } from "express";
import * as documentController from "@server/controllers/document.controller"; // Updated import
import { isAuthenticated } from "@server/middleware/auth.middleware"; // Updated import
import { upload } from "@server/middleware/upload.middleware"; // Updated import
import { requireProjectPermission } from "@server/middleware/enhanced-permissions.middleware";
import multer from 'multer'; // Import Multer type for error handling

// This router will handle routes nested under /api/projects/:projectId/documents
export const projectDocumentRouter = Router({ mergeParams: true }); // mergeParams needed to access :projectId

// This router will handle global document routes like /api/documents
export const globalDocumentRouter = Router();

// --- Project Specific Document Routes ---

// GET /api/projects/:projectId/documents/
// Fetches documents for the specific project (permissions checked via middleware)
projectDocumentRouter.get("/", isAuthenticated, requireProjectPermission('canViewDocuments'), documentController.getDocumentsForProject);

// POST /api/projects/:projectId/documents/
// Upload a new document to the project (project managers have full upload access)
projectDocumentRouter.post("/", isAuthenticated, requireProjectPermission('canUploadDocuments'), upload.single('file'), documentController.uploadDocument);

// DELETE /api/projects/:projectId/documents/:documentId
// Delete a document from the project (project managers have full delete access)
projectDocumentRouter.delete("/:documentId", isAuthenticated, requireProjectPermission('canDeleteDocuments'), documentController.deleteDocument);

// PUT /api/projects/:projectId/documents/:documentId/category
// Update document category (project managers can manage document organization)
// projectDocumentRouter.put("/:documentId/category", isAuthenticated, requireProjectPermission('canManageDocumentCategories'), documentController.updateDocumentCategory);

// POST /api/projects/:projectId/documents/:documentId/publish
// Publish a document (make it visible to clients)
projectDocumentRouter.post("/:documentId/publish", isAuthenticated, requireProjectPermission('canUploadDocuments'), documentController.publishDocument);

// POST /api/projects/:projectId/documents/:documentId/unpublish
// Unpublish a document (hide it from clients)
projectDocumentRouter.post("/:documentId/unpublish", isAuthenticated, requireProjectPermission('canUploadDocuments'), documentController.unpublishDocument);

// --- Global Document Routes ---

// GET /api/documents
// Fetches all documents accessible by the logged-in user (role checks in controller)
globalDocumentRouter.get("/", isAuthenticated, documentController.getAllAccessibleDocuments);
// server/routes/punchList.routes.ts
import { Router } from 'express';
import { punchListController } from '../controllers/punchList.controller'; // Assuming controller exists

// --- Corrected Imports ---
import {
    validateResourceId,
    validateRequestBody
} from '../middleware/validation.middleware'; // Use standard validation middleware
import { insertPunchListItemSchema } from '@shared/schema'; // Import schema from shared
import { isAuthenticated, isAdmin } from '../middleware/auth.middleware'; // Use standard auth middleware (adjust isAdmin if needed)
// import { authorize } from '../middleware/permissions.middleware'; // Keep if you have complex auth logic beyond isAdmin/isAuthenticated
// import { permit } from '@/shared/roles'; // Keep if used with authorize
import { upload } from '../middleware/upload.middleware'; // Use standard upload middleware

// --- Router Setup ---
// Ensure mergeParams is true if this router is nested under /api/projects/:projectId
const router = Router({ mergeParams: true });

// --- Middleware applied to all punch list routes ---
// Use standard isAuthenticated. Add project-specific permission checks within controllers if needed.
router.use(isAuthenticated);

// --- Route Definitions ---

// GET /api/projects/:projectId/punch-list - Get all punch list items for a project
// Project ID validation happens in the parent router (server/routes.ts)
router.get('/',
    // authorize(permit('projectManager', 'client')), // Add specific auth checks in controller if needed beyond isAuthenticated
    punchListController.getPunchListItemsForProject
);

// GET /api/projects/:projectId/punch-list/:itemId - Get a specific punch list item by ID
router.get('/:itemId',
    validateResourceId('itemId'), // Validate itemId format
    // authorize(permit('projectManager', 'client')), // Add specific auth checks in controller if needed
    punchListController.getPunchListItemById
);

// POST /api/projects/:projectId/punch-list - Create a new punch list item
router.post('/',
    // isAdmin, // Example: Only admins or PMs can create? Add logic here or in controller
    validateRequestBody(insertPunchListItemSchema.omit({ projectId: true, id: true, createdAt: true, updatedAt: true, resolvedAt: true })), // Validate body against schema (excluding fields set by server/DB)
    punchListController.createPunchListItem
);

// PUT /api/projects/:projectId/punch-list/:itemId - Update a punch list item
router.put('/:itemId',
    validateResourceId('itemId'), // Validate itemId format
    // isAdmin, // Example: Add specific auth checks here or in controller
    validateRequestBody(insertPunchListItemSchema.partial()), // Validate body against partial schema
    punchListController.updatePunchListItem
);

// DELETE /api/projects/:projectId/punch-list/:itemId - Delete a punch list item
router.delete('/:itemId',
    validateResourceId('itemId'), // Validate itemId format
    // isAdmin, // Example: Only admins or PMs can delete? Add logic here or in controller
    punchListController.deletePunchListItem
);

// --- Media Routes ---

// POST /api/projects/:projectId/punch-list/:itemId/media - Upload media for a punch list item
router.post('/:itemId/media',
    validateResourceId('itemId'), // Validate item ID format
    // authorize(permit('projectManager', 'client')), // Add specific auth checks in controller if needed
    upload.array('files'), // Use standard upload middleware instance, assuming 'files' is the field name
    punchListController.uploadPunchListItemMedia // Assuming this controller exists
);

// DELETE /api/projects/:projectId/punch-list/:itemId/media/:mediaId - Delete a specific media item
router.delete('/:itemId/media/:mediaId',
    validateResourceId('itemId'), // Validate item ID format
    validateResourceId('mediaId'), // Validate media ID format
    // authorize(permit('projectManager', 'client')), // Add specific auth checks in controller if needed
    punchListController.deletePunchListItemMedia // Assuming this controller exists
);

// Optional: GET /api/projects/:projectId/punch-list/:itemId/media
// router.get('/:itemId/media',
//      validateResourceId('itemId'),
//      // authorize(permit('projectManager', 'client')),
//      punchListController.getPunchListItemMedia // Assuming this controller exists
// );

export default router;

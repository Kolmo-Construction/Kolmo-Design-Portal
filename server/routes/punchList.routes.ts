// server/routes/punchList.routes.ts
import { Router } from 'express';
import { punchListController } from '../controllers/punchList.controller';

// --- Corrected Imports ---
import {
    validateResourceId,
    validateRequestBody // Keep if needed for other routes, but POST now uses FormData
} from '../middleware/validation.middleware';
// Import the BASE insert schema, not the one omitting fields, if controller handles parsing
import { insertPunchListItemSchema } from '@shared/schema';
import { isAuthenticated, isAdmin } from '../middleware/auth.middleware';
import { requireProjectPermission } from '../middleware/enhanced-permissions.middleware';
import { upload } from '../middleware/upload.middleware'; // Import standard upload middleware

// --- Router Setup ---
const router = Router({ mergeParams: true });

// --- Middleware applied to all punch list routes ---
router.use(isAuthenticated);

// --- Route Definitions ---

// GET /api/projects/:projectId/punch-list - Get all punch list items for a project
router.get('/',
    requireProjectPermission('canViewProject'),
    punchListController.getPunchListItemsForProject
);

// GET /api/projects/:projectId/punch-list/:itemId - Get a specific punch list item by ID
router.get('/:itemId',
    validateResourceId('itemId'),
    requireProjectPermission('canViewProject'),
    punchListController.getPunchListItemById
);

// POST /api/projects/:projectId/punch-list - Create a new punch list item (Project Manager access)
router.post('/',
    requireProjectPermission('canCreatePunchListItems'),
    upload.single('punchPhoto'),
    punchListController.createPunchListItem
);

// PUT /api/projects/:projectId/punch-list/:itemId - Update a punch list item (Project Manager access)
router.put('/:itemId',
    validateResourceId('itemId'),
    requireProjectPermission('canEditPunchListItems'),
    upload.single('punchPhoto'),
    punchListController.updatePunchListItem
);

// DELETE /api/projects/:projectId/punch-list/:itemId - Delete a punch list item (Project Manager access)
router.delete('/:itemId',
    validateResourceId('itemId'),
    requireProjectPermission('canDeletePunchListItems'),
    punchListController.deletePunchListItem
);

// POST /api/projects/:projectId/punch-list/:itemId/publish - Publish a punch list item (make it visible to clients)
router.post('/:itemId/publish',
    validateResourceId('itemId'),
    requireProjectPermission('canEditPunchListItems'),
    punchListController.publishPunchListItem
);

// POST /api/projects/:projectId/punch-list/:itemId/unpublish - Unpublish a punch list item (hide it from clients)
router.post('/:itemId/unpublish',
    validateResourceId('itemId'),
    requireProjectPermission('canEditPunchListItems'),
    punchListController.unpublishPunchListItem
);

// PATCH /api/projects/:projectId/punch-list/:itemId/complete - Complete a punch list item (Project Manager access)
// Note: This functionality would be implemented in the controller when needed
// router.patch('/:itemId/complete',
//     validateResourceId('itemId'),
//     requireProjectPermission('canCompletePunchListItems'),
//     punchListController.completePunchListItem
// );

// --- Media Routes (If using separate endpoints, keep as is) ---
// If creating/updating items handles media directly, these might become redundant or change.
// For now, assuming they might still be used for *additional* media later.

// POST /api/projects/:projectId/punch-list/:itemId/media - Upload additional media
router.post('/:itemId/media',
    validateResourceId('itemId'),
    upload.array('files'), // Handles multiple files named 'files'
    punchListController.uploadPunchListItemMedia
);

// DELETE /api/projects/:projectId/punch-list/:itemId/media/:mediaId - Delete specific media
router.delete('/:itemId/media/:mediaId',
    validateResourceId('itemId'),
    validateResourceId('mediaId'),
    punchListController.deletePunchListItemMedia
);


export default router;

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
import { upload } from '../middleware/upload.middleware'; // Import standard upload middleware

// --- Router Setup ---
const router = Router({ mergeParams: true });

// --- Middleware applied to all punch list routes ---
router.use(isAuthenticated);

// --- Route Definitions ---

// GET /api/projects/:projectId/punch-list - Get all punch list items for a project
router.get('/',
    punchListController.getPunchListItemsForProject
);

// GET /api/projects/:projectId/punch-list/:itemId - Get a specific punch list item by ID
router.get('/:itemId',
    validateResourceId('itemId'),
    punchListController.getPunchListItemById
);

// POST /api/projects/:projectId/punch-list - Create a new punch list item
router.post('/',
    // isAdmin, // Uncomment if only admins/PMs can create
    upload.single('punchPhoto'), // *** ADDED: Middleware to handle single file upload named 'punchPhoto' ***
    // Remove validateRequestBody for POST as it now expects FormData, not JSON
    // validateRequestBody(insertPunchListItemSchema.omit(...)), // REMOVED
    punchListController.createPunchListItem // Controller now expects req.file and req.body
);

// PUT /api/projects/:projectId/punch-list/:itemId - Update a punch list item
// Assuming updates might also include photos, add upload middleware here too
router.put('/:itemId',
    validateResourceId('itemId'),
    // isAdmin, // Uncomment if needed
    upload.single('punchPhoto'), // *** ADDED: Middleware for potential photo update/replacement ***
    // validateRequestBody(insertPunchListItemSchema.partial()), // REMOVED - Expects FormData now
    punchListController.updatePunchListItem // Controller needs to handle req.file and req.body
);

// DELETE /api/projects/:projectId/punch-list/:itemId - Delete a punch list item
router.delete('/:itemId',
    validateResourceId('itemId'),
    // isAdmin, // Uncomment if needed
    punchListController.deletePunchListItem
);

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

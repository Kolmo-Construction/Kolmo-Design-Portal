// server/routes/dailyLog.routes.ts
import { Router } from "express";
// --- Corrected Import ---
// Import the exported INSTANCE of the controller, not the namespace
import { dailyLogController } from "@server/controllers/dailyLog.controller";
// Import necessary middleware
import { isAuthenticated } from "@server/middleware/auth.middleware";
import { validateResourceId } from "@server/middleware/validation.middleware";
import { upload } from "@server/middleware/upload.middleware";

// Ensure mergeParams is true to access :projectId from the parent router
const router = Router({ mergeParams: true });

// --- Routes ---

// GET /api/projects/:projectId/daily-logs
// Use the imported controller INSTANCE and access its method
router.get(
    "/",
    isAuthenticated,
    dailyLogController.getDailyLogsForProject // Correct: Access method on the instance
);

// POST /api/projects/:projectId/daily-logs
// Assuming 'photos' is the field name for file uploads and max 5 files
router.post(
    "/",
    isAuthenticated,
    upload.array('photos', 5), // Apply multer middleware for file uploads
    dailyLogController.createDailyLog // Correct: Access method on the instance
);

// PUT /api/projects/:projectId/daily-logs/:logId
router.put(
    "/:logId",
    isAuthenticated,
    validateResourceId('logId'), // Validate the logId parameter
    dailyLogController.updateDailyLog // Correct: Access method on the instance
);

// DELETE /api/projects/:projectId/daily-logs/:logId
router.delete(
    "/:logId",
    isAuthenticated,
    validateResourceId('logId'), // Validate the logId parameter
    dailyLogController.deleteDailyLog // Correct: Access method on the instance
);

// --- Optional Photo Routes (Example Structure) ---

// POST /api/projects/:projectId/daily-logs/:logId/photos
// Example: Add photos after log creation
// router.post(
//     "/:logId/photos",
//     isAuthenticated,
//     validateResourceId('logId'),
//     upload.array('photos', 5),
//     dailyLogController.addPhotosToDailyLog // Assuming such a controller method exists
// );

// DELETE /api/projects/:projectId/daily-logs/photos/:photoId
// Example: Delete a specific photo associated with a daily log
// router.delete(
//     "/photos/:photoId", // Or maybe /:logId/photos/:photoId depending on your structure
//     isAuthenticated,
//     validateResourceId('photoId'), // Or validate both logId and photoId if nested path
//     dailyLogController.deleteDailyLogPhoto // Assuming such a controller method exists
// );


export default router;

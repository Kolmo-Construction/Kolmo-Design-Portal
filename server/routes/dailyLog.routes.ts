// server/routes/dailyLog.routes.ts
import { Router } from "express";
import * as dailyLogController from "@server/controllers/dailyLog.controller"; // Import the controller
import { isAuthenticated } from "@server/middleware/auth.middleware"; // Import necessary middleware
import { upload } from "@server/middleware/upload.middleware"; // Import upload middleware for photos

const router = Router({ mergeParams: true }); // mergeParams to access :projectId

// GET /api/projects/:projectId/daily-logs
router.get("/", isAuthenticated, dailyLogController.getProjectDailyLogs);

// GET /api/projects/:projectId/daily-logs/:logId
// router.get("/:logId", isAuthenticated, dailyLogController.getDailyLogById); // Optional

// POST /api/projects/:projectId/daily-logs
// Use upload.array('photos', maxCount) or upload.single('photo') as per your form/backend logic
router.post("/", isAuthenticated, upload.array('photos', 5), dailyLogController.createDailyLog); // Assuming 'photos' is the field name and max 5 files

// PUT /api/projects/:projectId/daily-logs/:logId
router.put("/:logId", isAuthenticated, dailyLogController.updateDailyLog); // Might need upload middleware if photos can be updated via PUT on the log itself

// DELETE /api/projects/:projectId/daily-logs/:logId
router.delete("/:logId", isAuthenticated, dailyLogController.deleteDailyLog);

// POST /api/projects/:projectId/daily-logs/:logId/photos
// Alternative endpoint if adding photos separately after log creation
// router.post("/:logId/photos", isAuthenticated, upload.array('photos', 5), dailyLogController.uploadDailyLogPhotos);

// DELETE /api/projects/:projectId/daily-logs/photos/:photoId
// Assuming this is a global photo delete route or you extract projectId from photoId
// If photoId uniquely identifies the photo across projects, use a different root path
// If photoId is only unique within a project, the path could be /api/projects/:projectId/photos/:photoId
// For now, aligning with client usage expectation:
router.delete("/photos/:photoId", isAuthenticated, dailyLogController.deleteDailyLogPhoto); // Requires checkProjectAccess based on photoId -> logId -> projectId


export default router;
// server/routes/progressUpdate.routes.ts
import { Router } from "express";
import * as progressUpdateController from "@server/controllers/progressUpdate.controller"; // Updated import
import { isAuthenticated } from "../middleware/auth.middleware";
// Import checkProjectAccess or specific permission middleware if applying at route level

// Use mergeParams: true to access :projectId from the parent router mount point
const router = Router({ mergeParams: true });

// Both routes require authentication, handled at mount point in server/routes.ts
// Access checks for the specific project and role permissions are handled within the controllers for now.

// GET /api/projects/:projectId/updates/
router.get("/", progressUpdateController.getProjectUpdates);

// POST /api/projects/:projectId/updates/
// (Permissions check for Admin/PM done in controller)
router.post("/", progressUpdateController.createProjectUpdate);

export default router;
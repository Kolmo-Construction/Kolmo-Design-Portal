// server/routes/message.routes.ts
import { Router } from "express";
import * as messageController from "@server/controllers/message.controller"; // Updated import
import { isAuthenticated } from "@server/middleware/auth.middleware";
// Import checkProjectAccess if applying as middleware
// import { checkProjectAccess } from "../middleware/permissions.middleware";

// Use mergeParams: true to access :projectId from the parent router mount point
const router = Router({ mergeParams: true });

// Both routes require authentication, handled at mount point in server/routes.ts
// Access checks for the specific project are handled within the controllers for now.

// GET /api/projects/:projectId/messages/
router.get("/", messageController.getProjectMessages);

// POST /api/projects/:projectId/messages/
router.post("/", messageController.createProjectMessage);

export default router;
// server/routes/project.routes.ts
import { Router } from "express";
import * as projectController from "@server/controllers/project.controller"; // Updated import
import { isAuthenticated, isAdmin } from "@server/middleware/auth.middleware"; // Updated import
// Import checkProjectAccess if you want to apply it as route middleware for GET /:id
// import { checkProjectAccess } from "../middleware/permissions.middleware";

const router = Router();

// GET /api/projects - Get projects accessible to the user
router.get("/", isAuthenticated, projectController.getAllProjects);

// POST /api/projects - Create a new project (Admin only)
router.post("/", isAdmin, projectController.createProject); // isAdmin implies isAuthenticated

// GET /api/projects/:id - Get a specific project by ID
// Applying isAuthenticated ensures user is logged in.
// The controller (getProjectById) currently calls checkProjectAccess internally.
// Alternatively, apply checkProjectAccess or a wrapper middleware here.
router.get("/:id", isAuthenticated, projectController.getProjectById);

// PUT /api/projects/:id - Update a specific project (Admin only)
router.put("/:id", isAdmin, projectController.updateProject); // isAdmin implies isAuthenticated

// Note: Routes for associating clients, project managers, etc.,
// could also be added here or in admin.routes.ts as appropriate.

export default router;
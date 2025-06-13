// server/routes/project.routes.ts
import { Router } from "express";
import * as projectController from "@server/controllers/project.controller"; 
import { isAuthenticated, isAdmin } from "@server/middleware/auth.middleware";
import { validateIdParam } from "@server/middleware/validation.middleware";
import { requireProjectPermission } from "@server/middleware/enhanced-permissions.middleware";

const router = Router();

// GET /api/projects - Get projects accessible to the user
router.get("/", isAuthenticated, projectController.getProjects);

// POST /api/projects - Create a new project (Admin only)
router.post("/", isAdmin, projectController.createProject); // isAdmin implies isAuthenticated

// GET /api/projects/:id - Get a specific project by ID with enhanced permissions
router.get("/:id", isAuthenticated, validateIdParam, requireProjectPermission('canViewProject'), projectController.getProjectById);

// PUT /api/projects/:id - Update a specific project (Admin or Project Manager)
router.put("/:id", isAuthenticated, validateIdParam, requireProjectPermission('canEditProject'), projectController.updateProject);

// DELETE /api/projects/:id - Delete a specific project (Admin or Project Manager)
router.delete("/:id", isAuthenticated, validateIdParam, requireProjectPermission('canDeleteProject'), projectController.deleteProject);

// POST /api/projects/:id/recalculate-progress - Recalculate project progress (Project Manager access)
router.post("/:id/recalculate-progress", isAuthenticated, validateIdParam, requireProjectPermission('canEditProject'), projectController.recalculateProjectProgress);

// Note: Routes for associating clients, project managers, etc.,
// could also be added here or in admin.routes.ts as appropriate.

export default router;
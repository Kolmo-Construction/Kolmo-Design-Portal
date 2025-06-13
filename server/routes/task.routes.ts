// server/routes/task.routes.ts
import { Router } from "express";
import * as taskController from "@server/controllers/task.controller";
import { isAuthenticated } from "@server/middleware/auth.middleware";
import { validateResourceId } from "@server/middleware/validation.middleware";
import { requireProjectPermission } from "@server/middleware/enhanced-permissions.middleware";

const router = Router({ mergeParams: true }); // mergeParams to access :projectId from parent router

// GET /api/projects/:projectId/tasks - View access required
router.get("/", isAuthenticated, requireProjectPermission('canViewProject'), taskController.getProjectTasks);

// POST /api/projects/:projectId/tasks - Create task permission required
router.post("/", isAuthenticated, requireProjectPermission('canCreateTasks'), taskController.createTask);

// PUT /api/projects/:projectId/tasks/:taskId - Edit task permission required
router.put("/:taskId", isAuthenticated, validateResourceId('taskId'), requireProjectPermission('canEditTasks'), taskController.updateTask);

// DELETE /api/projects/:projectId/tasks/:taskId - Delete task permission required
router.delete("/:taskId", isAuthenticated, validateResourceId('taskId'), requireProjectPermission('canDeleteTasks'), taskController.deleteTask);

// GET /api/projects/:projectId/tasks/dependencies - Fetch dependencies for the project
router.get("/dependencies", isAuthenticated, requireProjectPermission('canViewTaskDependencies'), taskController.getTaskDependencies);

// POST /api/projects/:projectId/tasks/dependencies - Create a dependency
router.post("/dependencies", isAuthenticated, requireProjectPermission('canManageTaskDependencies'), taskController.createTaskDependency);

// DELETE /api/projects/:projectId/tasks/dependencies - Remove a dependency
router.delete("/dependencies", isAuthenticated, requireProjectPermission('canManageTaskDependencies'), taskController.deleteTaskDependency);

// POST /api/projects/:projectId/tasks/publish - Publish all project tasks (make visible to clients)
router.post("/publish", isAuthenticated, requireProjectPermission('canPublishTasks'), taskController.publishProjectTasks);

// POST /api/projects/:projectId/tasks/unpublish - Unpublish all project tasks (hide from clients)
router.post("/unpublish", isAuthenticated, requireProjectPermission('canPublishTasks'), taskController.unpublishProjectTasks);

// Import the function directly - bypassing the module import
import { importTasksFromJson } from '../controllers/task.controller';

// POST /api/projects/:projectId/tasks/import - Import tasks from JSON
router.post("/import", isAuthenticated, requireProjectPermission('canImportTasks'), importTasksFromJson);

export default router;
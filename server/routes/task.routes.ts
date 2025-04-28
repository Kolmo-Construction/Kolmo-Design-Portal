// server/routes/task.routes.ts
import { Router } from "express";
import * as taskController from "@server/controllers/task.controller"; // Import the controller
import { isAuthenticated } from "@server/middleware/auth.middleware"; // Import necessary middleware

const router = Router({ mergeParams: true }); // mergeParams to access :projectId

// GET /api/projects/:projectId/tasks
router.get("/", isAuthenticated, taskController.getProjectTasks);

// GET /api/projects/:projectId/tasks/:taskId
// router.get("/:taskId", isAuthenticated, taskController.getTaskById); // Optional, if fetching single task directly

// POST /api/projects/:projectId/tasks
router.post("/", isAuthenticated, taskController.createTask); // Add isAdmin/isProjectManager check as needed

// PUT /api/projects/:projectId/tasks/:taskId
router.put("/:taskId", isAuthenticated, taskController.updateTask); // Add isAdmin/isProjectManager check as needed

// DELETE /api/projects/:projectId/tasks/:taskId
router.delete("/:taskId", isAuthenticated, taskController.deleteTask); // Add isAdmin/isProjectManager check as needed

// POST /api/projects/:projectId/tasks/:successorId/dependencies
router.post("/:successorId/dependencies", isAuthenticated, taskController.createTaskDependency); // Add isAdmin/isProjectManager check as needed

// DELETE /api/projects/:projectId/tasks/dependencies/:dependencyId
router.delete("/dependencies/:dependencyId", isAuthenticated, taskController.deleteTaskDependency); // Add isAdmin/isProjectManager check as needed


export default router;
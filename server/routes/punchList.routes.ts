// server/routes/punchList.routes.ts
import { Router } from "express";
import * as punchListController from "@server/controllers/punchList.controller"; // Import the controller
import { isAuthenticated } from "@server/middleware/auth.middleware"; // Import necessary middleware
import { upload } from "@server/middleware/upload.middleware"; // Import upload middleware for photo

const router = Router({ mergeParams: true }); // mergeParams to access :projectId

// GET /api/projects/:projectId/punch-list
router.get("/", isAuthenticated, punchListController.getProjectPunchListItems);

// GET /api/projects/:projectId/punch-list/:itemId
// router.get("/:itemId", isAuthenticated, punchListController.getPunchListItemById); // Optional

// POST /api/projects/:projectId/punch-list
// Use upload.single('photo') as per your form/backend logic
router.post("/", isAuthenticated, upload.single('punchPhoto'), punchListController.createPunchListItem); // Assuming 'punchPhoto' is the field name

// PUT /api/projects/:projectId/punch-list/:itemId
// Need upload middleware if photo can be updated via PUT
router.put("/:itemId", isAuthenticated, upload.single('punchPhoto'), punchListController.updatePunchListItem); // Assuming 'punchPhoto' is the field name


// DELETE /api/projects/:projectId/punch-list/:itemId
router.delete("/:itemId", isAuthenticated, punchListController.deletePunchListItem);

export default router;
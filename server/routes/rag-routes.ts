/**
 * RAG Routes
 * Routes for the RAG (Retrieval Augmented Generation) system
 */
import { Router } from 'express';
import { isAuthenticated } from '@server/middleware/auth.middleware';
import { hasRole } from '../middleware/role.middleware';
import * as ragController from '../controllers/rag-controller';

const router = Router();

// All routes require authentication
router.use(isAuthenticated);

// Project version routes
router.post('/projects/:projectId/versions', hasRole(['admin', 'project_manager']), ragController.createProjectVersion);
router.get('/projects/:projectId/versions', ragController.getProjectVersions);
router.get('/versions/:versionId', ragController.getProjectVersion);

// Generation prompt routes
router.post('/versions/:versionId/prompts', hasRole(['admin', 'project_manager']), ragController.createGenerationPrompt);
router.get('/versions/:versionId/prompts', ragController.getGenerationPrompts);

// RAG task routes
router.post('/versions/:versionId/tasks', hasRole(['admin', 'project_manager']), ragController.createRagTask);
router.get('/versions/:versionId/tasks', ragController.getRagTasks);

// RAG task dependency routes
router.post('/tasks/:taskId/dependencies', hasRole(['admin', 'project_manager']), ragController.createRagTaskDependency);
router.get('/tasks/:taskId/dependencies', ragController.getRagTaskDependencies);

// Task feedback routes
router.post('/tasks/:taskId/feedback', ragController.createTaskFeedback);
router.get('/tasks/:taskId/feedback', ragController.getTaskFeedback);

// Convert RAG tasks to project tasks
router.post('/projects/:projectId/versions/:versionId/convert', 
  hasRole(['admin', 'project_manager']), 
  ragController.convertRagTasksToProjectTasks);

export default router;
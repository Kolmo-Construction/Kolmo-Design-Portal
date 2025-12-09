// server/routes/apikey.routes.ts
import { Router } from 'express';
import { apiKeyController } from '../controllers/apikey.controller';
import { isAuthenticated } from '../middleware/auth.middleware';

const router = Router();

/**
 * API Key Management Routes
 * All routes require session authentication (not API key auth) to manage keys
 */

// POST /api/api-keys - Generate new API key
router.post(
  '/',
  isAuthenticated,
  (req, res, next) => apiKeyController.generateKey(req, res, next)
);

// GET /api/api-keys - List user's API keys (masked)
router.get(
  '/',
  isAuthenticated,
  (req, res, next) => apiKeyController.listKeys(req, res, next)
);

// DELETE /api/api-keys/:id - Revoke API key
router.delete(
  '/:id',
  isAuthenticated,
  (req, res, next) => apiKeyController.revokeKey(req, res, next)
);

// PATCH /api/api-keys/:id - Update API key metadata
router.patch(
  '/:id',
  isAuthenticated,
  (req, res, next) => apiKeyController.updateKey(req, res, next)
);

export default router;

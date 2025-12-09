// server/controllers/apikey.controller.ts
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { apiKeyService } from '../services/apikey.service';
import { storage } from '../storage';
import { HttpError } from '../errors';
import { User } from '@shared/schema';

// Zod schema for creating API key
const createApiKeySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  expiresInDays: z.number().int().positive().max(365).optional(),
});

// Zod schema for updating API key
const updateApiKeySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
});

export class ApiKeyController {
  /**
   * Generate a new API key
   * POST /api/api-keys
   */
  async generateKey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as User;
      if (!user) {
        throw new HttpError(401, 'User not authenticated');
      }

      // Validate input
      const validated = createApiKeySchema.parse(req.body);

      console.log(`[ApiKeyController] Generating API key for user ${user.id}: ${validated.name}`);

      // Generate API key
      const apiKey = await apiKeyService.createApiKey(
        user.id,
        validated.name,
        validated.description,
        validated.expiresInDays
      );

      console.log(`[ApiKeyController] API key created: ${apiKey.keyPrefix}`);

      res.status(201).json({
        id: apiKey.id,
        fullKey: apiKey.fullKey,
        keyPrefix: apiKey.keyPrefix,
        name: apiKey.name,
        expiresAt: apiKey.expiresAt,
        createdAt: apiKey.createdAt,
        warning: 'Store this key securely. It will not be shown again.',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        next(new HttpError(400, 'Invalid input', error.errors));
      } else if (error instanceof HttpError) {
        next(error);
      } else {
        console.error('[ApiKeyController] Error generating API key:', error);
        next(new HttpError(500, 'Failed to generate API key'));
      }
    }
  }

  /**
   * List user's API keys (masked)
   * GET /api/api-keys
   */
  async listKeys(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as User;
      if (!user) {
        throw new HttpError(401, 'User not authenticated');
      }

      console.log(`[ApiKeyController] Listing API keys for user ${user.id}`);

      const apiKeys = await apiKeyService.listUserApiKeys(user.id);

      res.status(200).json(apiKeys);
    } catch (error) {
      console.error('[ApiKeyController] Error listing API keys:', error);
      next(new HttpError(500, 'Failed to list API keys'));
    }
  }

  /**
   * Revoke an API key
   * DELETE /api/api-keys/:id
   */
  async revokeKey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as User;
      if (!user) {
        throw new HttpError(401, 'User not authenticated');
      }

      const apiKeyId = parseInt(req.params.id, 10);
      if (isNaN(apiKeyId)) {
        throw new HttpError(400, 'Invalid API key ID');
      }

      console.log(`[ApiKeyController] Revoking API key ${apiKeyId} for user ${user.id}`);

      const success = await apiKeyService.revokeApiKey(apiKeyId, user.id);

      if (!success) {
        throw new HttpError(404, 'API key not found or unauthorized');
      }

      res.status(200).json({
        message: 'API key revoked successfully',
      });
    } catch (error) {
      if (error instanceof HttpError) {
        next(error);
      } else {
        console.error('[ApiKeyController] Error revoking API key:', error);
        next(new HttpError(500, 'Failed to revoke API key'));
      }
    }
  }

  /**
   * Update API key metadata
   * PATCH /api/api-keys/:id
   */
  async updateKey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as User;
      if (!user) {
        throw new HttpError(401, 'User not authenticated');
      }

      const apiKeyId = parseInt(req.params.id, 10);
      if (isNaN(apiKeyId)) {
        throw new HttpError(400, 'Invalid API key ID');
      }

      // Validate input
      const validated = updateApiKeySchema.parse(req.body);

      console.log(`[ApiKeyController] Updating API key ${apiKeyId} for user ${user.id}`);

      // Verify ownership
      const existingKey = await storage.apiKeys.findById(apiKeyId);
      if (!existingKey || existingKey.userId !== user.id) {
        throw new HttpError(404, 'API key not found or unauthorized');
      }

      // Update key
      const updated = await storage.apiKeys.update(apiKeyId, validated);

      if (!updated) {
        throw new HttpError(500, 'Failed to update API key');
      }

      res.status(200).json({
        id: updated.id,
        keyPrefix: updated.keyPrefix,
        name: updated.name,
        description: updated.description,
        isActive: updated.isActive,
        updatedAt: updated.updatedAt,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        next(new HttpError(400, 'Invalid input', error.errors));
      } else if (error instanceof HttpError) {
        next(error);
      } else {
        console.error('[ApiKeyController] Error updating API key:', error);
        next(new HttpError(500, 'Failed to update API key'));
      }
    }
  }
}

// Export singleton instance
export const apiKeyController = new ApiKeyController();

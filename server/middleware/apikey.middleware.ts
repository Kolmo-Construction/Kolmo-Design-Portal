// server/middleware/apikey.middleware.ts
import type { Request, Response, NextFunction } from 'express';
import { apiKeyService } from '../services/apikey.service';
import { log as logger } from '@server/vite';

// Extend Express Request to include auth metadata
declare global {
  namespace Express {
    interface Request {
      authMethod?: 'session' | 'apikey';
      apiKeyId?: number;
    }
  }
}

/**
 * Validates API key from request headers
 * Sets req.user if valid, allowing isAuthenticated to pass through
 *
 * This middleware runs BEFORE isAuthenticated to enable API key-based auth
 * as an alternative to session-based auth
 */
export async function validateApiKey(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const requestPath = `${req.method} ${req.originalUrl}`;

  try {
    // Extract API key from headers
    const authHeader = req.headers.authorization;
    const apiKeyHeader = req.headers['x-api-key'] as string;

    let apiKey: string | undefined;

    // Try Bearer token first (preferred method)
    if (authHeader?.startsWith('Bearer ')) {
      apiKey = authHeader.substring(7);
      logger(`[ApiKeyMiddleware] Found Bearer token for: ${requestPath}`, 'AuthMiddleware');
    } else if (apiKeyHeader) {
      // Fallback to X-API-Key header
      apiKey = apiKeyHeader;
      logger(`[ApiKeyMiddleware] Found X-API-Key header for: ${requestPath}`, 'AuthMiddleware');
    }

    // If no API key provided, continue to session auth
    if (!apiKey) {
      logger(`[ApiKeyMiddleware] No API key found, continuing to session auth for: ${requestPath}`, 'AuthMiddleware');
      return next();
    }

    // Validate API key
    logger(`[ApiKeyMiddleware] Validating API key for: ${requestPath}`, 'AuthMiddleware');
    const result = await apiKeyService.validateKey(apiKey);

    if (!result.valid || !result.user) {
      logger(`[ApiKeyMiddleware] Invalid or expired API key for: ${requestPath}`, 'AuthMiddleware');
      res.status(401).json({
        error: 'Invalid or expired API key'
      });
      return;
    }

    // Set req.user (same structure as session auth)
    req.user = result.user;

    // Mark auth method for audit logging and to allow isAuthenticated to skip session check
    req.authMethod = 'apikey';
    req.apiKeyId = result.apiKeyId;

    logger(`[ApiKeyMiddleware] Valid API key for user ${result.user.username} on: ${requestPath}`, 'AuthMiddleware');

    // Update last used timestamp (fire and forget - don't block request)
    if (result.apiKeyId) {
      apiKeyService.updateLastUsed(result.apiKeyId).catch(err => {
        logger(`[ApiKeyMiddleware] Failed to update last used: ${err}`, 'AuthMiddleware');
      });
    }

    next();
  } catch (error) {
    logger(`[ApiKeyMiddleware] Validation error for: ${requestPath} - ${error}`, 'AuthMiddleware');
    res.status(500).json({ error: 'Authentication service error' });
  }
}

/**
 * Mobile Authentication Controller
 * Handles mobile app login with API key generation
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { storage } from '../storage/index';
import { apiKeyService } from '../services/apikey.service';
import { HttpError } from '../errors';
import { comparePasswords } from '../auth';

// Validation schema for mobile login
const mobileLoginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

/**
 * Mobile Login - Returns user info and API key
 * POST /api/auth/login
 */
export const mobileLogin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    console.log('[Mobile Login] Request received:', { email: req.body.email });
    console.log('[Mobile Login] Password length:', req.body.password?.length);

    // Validate request body
    const validationResult = mobileLoginSchema.safeParse(req.body);
    if (!validationResult.success) {
      console.log('[Mobile Login] Validation failed:', validationResult.error.flatten());
      throw new HttpError(400, 'Invalid login credentials', validationResult.error.flatten());
    }

    const { email, password } = validationResult.data;

    // Find user by email
    const user = await storage.users.findUserByEmail(email);
    if (!user) {
      console.log('[Mobile Login] User not found:', email);
      throw new HttpError(401, 'Invalid email or password');
    }

    console.log('[Mobile Login] User found:', { id: user.id, email: user.email, username: user.username, hasPassword: !!user.password });

    // Verify password
    if (!user.password) {
      console.log('[Mobile Login] User has no password set:', email);
      throw new HttpError(401, 'Invalid email or password');
    }

    console.log('[Mobile Login] Comparing passwords...');
    const isValidPassword = await comparePasswords(password, user.password);
    console.log('[Mobile Login] Password comparison result:', isValidPassword);

    if (!isValidPassword) {
      console.log('[Mobile Login] Invalid password for user:', email);
      throw new HttpError(401, 'Invalid email or password');
    }

    console.log('[Mobile Login] Authentication successful for:', email);

    // Check if user has mobile access
    const accessScope = user.accessScope || 'both'; // Default to 'both' for backward compatibility
    if (accessScope === 'web') {
      console.log('[Mobile Login] User has web-only access:', email);
      throw new HttpError(403, 'This account is configured for web portal access only. Please contact your administrator.');
    }

    // Check if user already has an active API key for mobile
    const existingApiKey = await storage.apiKeys.findActiveByUserIdAndName(user.id, 'Mobile App Auto-Generated');

    let fullApiKey: string;

    // If no active key exists, create one
    if (!existingApiKey) {
      console.log('[Mobile Login] Creating new API key for user:', user.id);

      const newApiKey = await apiKeyService.createApiKey(
        user.id,
        'Mobile App Auto-Generated',
        `Automatically generated during mobile login on ${new Date().toISOString()}`,
        undefined // No expiration
      );

      fullApiKey = newApiKey.fullKey;
      console.log('[Mobile Login] API key created successfully');
    } else {
      console.log('[Mobile Login] User already has an API key');
      // For existing keys, we can't retrieve the full key (it's hashed)
      // Mobile app should have stored it from first login
      // Return an error asking them to contact admin for new key
      throw new HttpError(400, 'API key already exists. Please use your existing API key or contact admin to revoke and regenerate.');
    }

    // Return user profile and API key
    res.status(200).json({
      success: true,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
      },
      apiKey: fullApiKey,
    });

    console.log('[Mobile Login] Login successful for user:', user.id);
  } catch (error) {
    console.error('[Mobile Login] Error:', error);

    // Don't expose detailed error info for security
    if (error instanceof HttpError && error.statusCode === 401) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    } else if (error instanceof HttpError && error.statusCode === 403) {
      res.status(403).json({
        success: false,
        message: error.message,
      });
    } else {
      next(error);
    }
  }
};

/**
 * Mobile Logout - Optionally revoke API key
 * POST /api/auth/mobile/logout
 */
export const mobileLogout = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = (req as any).user;
    if (!user) {
      throw new HttpError(401, 'Unauthorized');
    }

    // Get the API key from the request header
    const apiKeyHeader = req.headers['authorization'] || req.headers['x-api-key'];
    const apiKeyValue = typeof apiKeyHeader === 'string'
      ? apiKeyHeader.replace(/^Bearer\s+/i, '')
      : undefined;

    if (apiKeyValue) {
      // Find and revoke the API key
      const apiKey = await apiKeyRepository.findByFullKey(apiKeyValue);
      if (apiKey && apiKey.userId === user.id) {
        await apiKeyRepository.revoke(apiKey.id);
        console.log('[Mobile Logout] API key revoked for user:', user.id);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('[Mobile Logout] Error:', error);
    next(error);
  }
};

/**
 * Get Current User - Returns authenticated user info
 * GET /api/auth/me
 */
export const getCurrentUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = (req as any).user;
    if (!user) {
      throw new HttpError(401, 'Unauthorized');
    }

    // Fetch fresh user data
    const userProfile = await storage.users.getUserProfileById(user.id);
    if (!userProfile) {
      throw new HttpError(404, 'User not found');
    }

    res.status(200).json({
      success: true,
      user: {
        id: userProfile.id,
        firstName: userProfile.firstName,
        lastName: userProfile.lastName,
        email: userProfile.email,
        role: userProfile.role,
      },
    });
  } catch (error) {
    console.error('[Get Current User] Error:', error);
    next(error);
  }
};

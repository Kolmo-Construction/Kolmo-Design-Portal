// server/middleware/role.middleware.ts
import type { Response, NextFunction } from "express";
import { log as logger } from '@server/vite';
import { AuthenticatedRequest } from './auth.middleware';

type Role = 'admin' | 'project_manager' | 'client';

/**
 * Express middleware to check if the authenticated user has any of the specified roles.
 * Assumes previous authentication check via isAuthenticated middleware.
 * Sends a 403 Forbidden response if the user does not have any of the required roles.
 * 
 * @param roles - Array of roles that are allowed to access the route
 */
export function hasRole(roles: Role[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const requestPath = `${req.method} ${req.originalUrl}`;
    logger(`[hasRole] Checking roles ${roles.join(', ')} for user ID ${req.user?.id} on: ${requestPath}`, 'RoleMiddleware');

    // isAuthenticated should run first, so req.user should exist
    // Add an extra check just in case
    if (!req.user) {
      logger(`[hasRole] Error: req.user is missing in hasRole middleware for ${requestPath}. Ensure isAuthenticated runs first.`, 'RoleMiddleware');
      res.status(401).json({ message: "Authentication required but user data missing." });
      return;
    }

    const userRole = req.user.role;
    
    if (roles.includes(userRole as Role)) {
      logger(`[hasRole] User ID ${req.user.id} has required role: ${userRole}. Proceeding.`, 'RoleMiddleware');
      return next(); // User has one of the required roles, proceed
    } else {
      logger(`[hasRole] User ID ${req.user.id} does not have any required roles. Has: ${userRole}, required: ${roles.join(', ')}. Sending 403.`, 'RoleMiddleware');
      // Send JSON 403 response and explicitly return
      res.status(403).json({ 
        message: `Forbidden: Access requires one of these roles: ${roles.join(', ')}` 
      });
      return; // Explicitly stop middleware chain here
    }
  };
}

/**
 * Express middleware to check if the authenticated user is a project manager.
 * Assumes previous authentication check via isAuthenticated middleware.
 * Sends a 403 Forbidden response if the user is not a project manager.
 */
export function isProjectManager(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  return hasRole(['project_manager', 'admin'])(req, res, next);
}

/**
 * Express middleware to check if the authenticated user is a client.
 * Assumes previous authentication check via isAuthenticated middleware.
 * Sends a 403 Forbidden response if the user is not a client.
 */
export function isClient(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  return hasRole(['client'])(req, res, next);
}
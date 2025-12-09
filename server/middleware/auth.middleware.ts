// server/middleware/auth.middleware.ts
import type { Request, Response, NextFunction } from "express";
import { log as logger } from '@server/vite'; // Import logger if needed

// Define AuthenticatedRequest if not globally available or imported elsewhere
// Adjust the User type path as necessary
import { User } from '@shared/schema';
export interface AuthenticatedRequest extends Request {
    user: User;
}


/**
 * Express middleware to check if a user is authenticated via Passport or API key.
 * Sends a 401 Unauthorized response if not authenticated.
 *
 * This middleware checks for API key auth first (set by validateApiKey middleware),
 * then falls back to session-based auth for backward compatibility.
 */
export async function isAuthenticated(req: Request, res: Response, next: NextFunction) {
    const requestPath = `${req.method} ${req.originalUrl}`;
    logger(`[isAuthenticated] Checking auth for: ${requestPath}`, 'AuthMiddleware');

    // Check if authenticated via API key (set by validateApiKey middleware)
    if ((req as any).authMethod === 'apikey' && req.user) {
        logger(`[isAuthenticated] User authenticated via API key: ID ${req.user.id}`, 'AuthMiddleware');
        return next();
    }

    // Fall back to session authentication
    // Only log session details in debug mode to reduce noise
    if (process.env.NODE_ENV === 'development') {
        logger(`[isAuthenticated] Session ID: ${req.sessionID}`, 'AuthMiddleware');
        logger(`[isAuthenticated] Session exists: ${!!req.session}`, 'AuthMiddleware');
        logger(`[isAuthenticated] User exists: ${!!req.user}`, 'AuthMiddleware');
        logger(`[isAuthenticated] IsAuthenticated: ${req.isAuthenticated()}`, 'AuthMiddleware');
    }

    // Ensure session is saved before checking authentication - make it synchronous
    if (req.session && req.session.save) {
        try {
            await new Promise<void>((resolve, reject) => {
                req.session.save((err) => {
                    if (err) {
                        logger(`[isAuthenticated] Session save error: ${err.message}`, 'AuthMiddleware');
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        } catch (error) {
            logger(`[isAuthenticated] Failed to save session: ${error}`, 'AuthMiddleware');
        }
    }

    // Use req.isAuthenticated() provided by Passport
    if (req.isAuthenticated() && req.user) {
        // Type assertion to use AuthenticatedRequest features if needed downstream
        const authReq = req as AuthenticatedRequest;
        logger(`[isAuthenticated] User IS authenticated via session: ID ${authReq.user?.id}`, 'AuthMiddleware');
        return next(); // User is authenticated, proceed to the next middleware/handler
    } else {
        logger(`[isAuthenticated] User IS NOT authenticated for: ${requestPath}. Sending 401.`, 'AuthMiddleware');
        // Send JSON 401 response and explicitly return to stop further processing
        res.status(401).json({ message: "Unauthorized" });
        return; // Explicitly stop middleware chain here
    }
}

/**
 * Express middleware to check if the authenticated user has the 'admin' role.
 * Assumes previous authentication check (e.g., isAuthenticated middleware).
 * Sends a 403 Forbidden response if the user is not an admin.
 */
export function isAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const requestPath = `${req.method} ${req.originalUrl}`;
    logger(`[isAdmin] Checking admin role for user ID ${req.user?.id} on: ${requestPath}`, 'AuthMiddleware');

    // isAuthenticated should run first, so req.user should exist
    // Add an extra check just in case
    if (!req.user) {
         logger(`[isAdmin] Error: req.user is missing in isAdmin middleware for ${requestPath}. Ensure isAuthenticated runs first.`, 'AuthMiddleware');
         res.status(401).json({ message: "Authentication required but user data missing." });
         return;
    }

    if (req.user.role === "admin") {
         logger(`[isAdmin] User ID ${req.user.id} has admin role. Proceeding.`, 'AuthMiddleware');
        return next(); // User is admin, proceed
    } else {
         logger(`[isAdmin] User ID ${req.user.id} does not have admin role (role: ${req.user.role}). Sending 403.`, 'AuthMiddleware');
        // Send JSON 403 response and explicitly return
        res.status(403).json({ message: "Forbidden: Admin access required" });
        return; // Explicitly stop middleware chain here
    }
}

/**
 * Express middleware to check if user has web portal access.
 * Blocks mobile-only users from accessing web-only endpoints.
 * Must be used after isAuthenticated middleware.
 */
export function requireWebAccess(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const requestPath = `${req.method} ${req.originalUrl}`;
    logger(`[requireWebAccess] Checking web access for user ID ${req.user?.id} on: ${requestPath}`, 'AuthMiddleware');

    if (!req.user) {
        logger(`[requireWebAccess] Error: req.user is missing. Ensure isAuthenticated runs first.`, 'AuthMiddleware');
        res.status(401).json({ message: "Authentication required" });
        return;
    }

    const accessScope = req.user.accessScope || 'both'; // Default to 'both' for backward compatibility

    if (accessScope === 'mobile') {
        logger(`[requireWebAccess] User ID ${req.user.id} has mobile-only access. Blocking web access. Sending 403.`, 'AuthMiddleware');
        res.status(403).json({
            message: "Forbidden: This account is configured for mobile app access only. Please use the mobile application."
        });
        return;
    }

    logger(`[requireWebAccess] User ID ${req.user.id} has web access (scope: ${accessScope}). Proceeding.`, 'AuthMiddleware');
    next();
}

/**
 * Express middleware to check if user has mobile app access.
 * Blocks web-only users from accessing mobile-only endpoints.
 * Must be used after isAuthenticated middleware.
 */
export function requireMobileAccess(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const requestPath = `${req.method} ${req.originalUrl}`;
    logger(`[requireMobileAccess] Checking mobile access for user ID ${req.user?.id} on: ${requestPath}`, 'AuthMiddleware');

    if (!req.user) {
        logger(`[requireMobileAccess] Error: req.user is missing. Ensure isAuthenticated runs first.`, 'AuthMiddleware');
        res.status(401).json({ message: "Authentication required" });
        return;
    }

    const accessScope = req.user.accessScope || 'both'; // Default to 'both' for backward compatibility

    if (accessScope === 'web') {
        logger(`[requireMobileAccess] User ID ${req.user.id} has web-only access. Blocking mobile access. Sending 403.`, 'AuthMiddleware');
        res.status(403).json({
            message: "Forbidden: This account is configured for web portal access only."
        });
        return;
    }

    logger(`[requireMobileAccess] User ID ${req.user.id} has mobile access (scope: ${accessScope}). Proceeding.`, 'AuthMiddleware');
    next();
}

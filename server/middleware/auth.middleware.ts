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
 * Express middleware to check if a user is authenticated via Passport.
 * Sends a 401 Unauthorized response if not authenticated.
 */
export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
    const requestPath = `${req.method} ${req.originalUrl}`;
    logger(`[isAuthenticated] Checking auth for: ${requestPath}`, 'AuthMiddleware');

    // Only log session details in debug mode to reduce noise
    if (process.env.NODE_ENV === 'development') {
        logger(`[isAuthenticated] Session ID: ${req.sessionID}`, 'AuthMiddleware');
        logger(`[isAuthenticated] Session exists: ${!!req.session}`, 'AuthMiddleware');
        logger(`[isAuthenticated] User exists: ${!!req.user}`, 'AuthMiddleware');
        logger(`[isAuthenticated] IsAuthenticated: ${req.isAuthenticated()}`, 'AuthMiddleware');
    }

    // Ensure session is saved before checking authentication
    if (req.session && req.session.save) {
        req.session.save((err) => {
            if (err) {
                logger(`[isAuthenticated] Session save error: ${err.message}`, 'AuthMiddleware');
            }
        });
    }

    // Use req.isAuthenticated() provided by Passport
    if (req.isAuthenticated() && req.user) {
        // Type assertion to use AuthenticatedRequest features if needed downstream
        const authReq = req as AuthenticatedRequest;
        logger(`[isAuthenticated] User IS authenticated: ID ${authReq.user?.id}`, 'AuthMiddleware');
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
